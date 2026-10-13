'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  Maximize2,
  Minimize2,
  AlertCircle,
  Loader2,
  UserCheck,
  ShieldCheck,
  Clock,
  Sparkles,
  PhoneCall,
  X,
} from 'lucide-react';

interface VideoCallModalProps {
  conversationId: string;
  partner: {
    id: string;
    displayName: string;
    universityName?: string;
    avatarUrl?: string | null;
  };
  isInitiator: boolean;
  isOpen: boolean;
  onClose: () => void;
}

export default function VideoCallModal({
  conversationId,
  partner,
  isInitiator,
  isOpen,
  onClose,
}: VideoCallModalProps) {
  // Call States: 'STARTING' | 'CALLING' | 'CONNECTING' | 'CONNECTED' | 'ENDED'
  const [callState, setCallState] = useState<
    'STARTING' | 'CALLING' | 'CONNECTING' | 'CONNECTED' | 'ENDED'
  >('STARTING');

  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [callDurationSeconds, setCallDurationSeconds] = useState(0);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSignalTimestampRef = useRef<number>(Date.now() - 5000);
  const isEndingRef = useRef(false);

  const sendSignal = useCallback(
    async (type: string, payload?: any) => {
      try {
        await fetch(`/api/chat/${conversationId}/signaling`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, payload }),
        });
      } catch (err) {
        console.warn('Signaling send error:', err);
      }
    },
    [conversationId]
  );

  // Clean shutdown helper
  const cleanUp = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }

    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  }, []);

  const handleEndCall = useCallback(() => {
    if (isEndingRef.current) return;
    isEndingRef.current = true;
    sendSignal('call-end');
    setCallState('ENDED');
    cleanUp();
    setTimeout(() => {
      onClose();
    }, 1200);
  }, [sendSignal, cleanUp, onClose]);

  // Main Call Initializer
  useEffect(() => {
    if (!isOpen) {
      cleanUp();
      return;
    }

    let isMounted = true;
    isEndingRef.current = false;
    setErrorMessage(null);
    setCallDurationSeconds(0);
    setCallState('STARTING');
    lastSignalTimestampRef.current = Date.now() - 4000;

    const setupCall = async () => {
      try {
        // 1. Acquire Camera & Microphone Media Stream
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: 'user',
            },
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
            },
          });
        } catch (mediaErr: any) {
          if (
            mediaErr.name === 'NotAllowedError' ||
            mediaErr.name === 'PermissionDeniedError'
          ) {
            throw new Error(
              'Camera or microphone permission was denied. Please allow camera and microphone access in your browser settings to start the video call.'
            );
          } else if (mediaErr.name === 'NotFoundError') {
            throw new Error('No camera or microphone device found on this system.');
          } else {
            throw new Error(`Media device error: ${mediaErr.message}`);
          }
        }

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // 2. Configure ICE Servers (Google STUN + Configurable TURN)
        const iceServers: RTCIceServer[] = [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
        ];

        if (process.env.NEXT_PUBLIC_TURN_SERVER_URL) {
          iceServers.push({
            urls: process.env.NEXT_PUBLIC_TURN_SERVER_URL,
            username: process.env.NEXT_PUBLIC_TURN_USERNAME || undefined,
            credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || undefined,
          });
        }

        const pc = new RTCPeerConnection({ iceServers });
        pcRef.current = pc;

        // Add local tracks to peer connection
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        // When remote track is received
        pc.ontrack = (event) => {
          if (remoteVideoRef.current && event.streams[0]) {
            remoteVideoRef.current.srcObject = event.streams[0];
            setCallState('CONNECTED');
          }
        };

        // When local ICE candidate is gathered
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            sendSignal('ice-candidate', event.candidate.toJSON());
          }
        };

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'connected') {
            setCallState('CONNECTED');
          } else if (
            pc.connectionState === 'disconnected' ||
            pc.connectionState === 'failed'
          ) {
            handleEndCall();
          }
        };

        // 3. Negotiate Role: Initiator or Receiver
        if (isInitiator) {
          setCallState('CALLING');
          await sendSignal('call-request');

          // Create WebRTC Offer
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await sendSignal('offer', offer);
        } else {
          setCallState('CONNECTING');
          await sendSignal('call-accept');
        }

        // 4. Start Signaling Poller (Every 1000ms)
        pollTimerRef.current = setInterval(async () => {
          if (isEndingRef.current) return;

          try {
            const res = await fetch(
              `/api/chat/${conversationId}/signaling?since=${lastSignalTimestampRef.current}`
            );
            const data = await res.json();

            if (data.success && Array.isArray(data.signals)) {
              for (const sig of data.signals) {
                lastSignalTimestampRef.current = Math.max(
                  lastSignalTimestampRef.current,
                  sig.createdAt
                );

                if (sig.type === 'call-end' || sig.type === 'call-reject') {
                  setCallState('ENDED');
                  handleEndCall();
                  return;
                }

                if (sig.type === 'offer' && !isInitiator) {
                  // Receiver receives offer, creates answer
                  if (pc.signalingState !== 'stable') {
                    await Promise.all([
                      pc.setLocalDescription({ type: 'rollback' } as any),
                    ]).catch(() => {});
                  }
                  await pc.setRemoteDescription(new RTCSessionDescription(sig.payload));
                  const answer = await pc.createAnswer();
                  await pc.setLocalDescription(answer);
                  await sendSignal('answer', answer);
                  setCallState('CONNECTING');
                }

                if (sig.type === 'answer' && isInitiator) {
                  // Initiator receives answer
                  if (pc.signalingState === 'have-local-offer') {
                    await pc.setRemoteDescription(
                      new RTCSessionDescription(sig.payload)
                    );
                    setCallState('CONNECTING');
                  }
                }

                if (sig.type === 'ice-candidate' && sig.payload) {
                  try {
                    await pc.addIceCandidate(new RTCIceCandidate(sig.payload));
                  } catch (e) {
                    // ICE race tolerance
                  }
                }
              }
            }
          } catch {}
        }, 1000);
      } catch (err: any) {
        if (isMounted) {
          setErrorMessage(err.message || 'Failed to initialize video call.');
          cleanUp();
        }
      }
    };

    setupCall();

    return () => {
      isMounted = false;
      cleanUp();
    };
  }, [isOpen, conversationId, isInitiator, sendSignal, cleanUp, handleEndCall]);

  // Duration Timer when call is Connected
  useEffect(() => {
    if (callState === 'CONNECTED') {
      durationTimerRef.current = setInterval(() => {
        setCallDurationSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    }

    return () => {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    };
  }, [callState]);

  const toggleMic = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
        setIsMicMuted(!track.enabled);
      });
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
        setIsVideoDisabled(!track.enabled);
      });
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  if (!isOpen) return null;

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-navy-950/90 backdrop-blur-lg animate-fade-in">
      <div
        ref={containerRef}
        className="relative w-full max-w-4xl h-[88vh] bg-navy-900 border border-navy-750 rounded-3xl shadow-2xl overflow-hidden flex flex-col justify-between"
      >
        {/* Top Floating Header */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 sm:p-6 bg-gradient-to-b from-navy-950/80 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-purple to-electric-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
              {partner?.displayName?.[0] || 'S'}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="text-sm font-bold text-white">{partner?.displayName}</h4>
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-[11px] text-slate-300">
                {partner?.universityName || 'Verified University Student'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {callState === 'CONNECTED' && (
              <div className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{formatDuration(callDurationSeconds)}</span>
              </div>
            )}

            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-xl bg-navy-800/70 hover:bg-navy-750 text-slate-300 hover:text-white transition-colors"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Center Video Canvas */}
        <div className="relative flex-1 bg-navy-950 flex items-center justify-center overflow-hidden">
          {errorMessage ? (
            /* Error State (Permissions / Devices) */
            <div className="max-w-md p-6 text-center space-y-3 z-10">
              <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-white">Video Call Unavailable</h4>
              <p className="text-xs text-rose-300 leading-relaxed">{errorMessage}</p>
              <button
                onClick={onClose}
                className="mt-3 px-5 py-2.5 rounded-xl bg-navy-800 hover:bg-navy-750 text-white text-xs font-semibold"
              >
                Close Call Window
              </button>
            </div>
          ) : callState === 'ENDED' ? (
            /* Call Ended State */
            <div className="text-center space-y-3 z-10 animate-fade-in">
              <div className="w-14 h-14 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <PhoneOff className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white">Call Ended</h4>
              <p className="text-xs text-slate-400 font-mono">
                Duration: {formatDuration(callDurationSeconds)}
              </p>
            </div>
          ) : (
            /* Active Call View */
            <>
              {/* Remote Video Stream (Full Canvas) */}
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className={`w-full h-full object-cover transition-opacity duration-500 ${
                  callState === 'CONNECTED' ? 'opacity-100' : 'opacity-0'
                }`}
              />

              {/* Calling / Connecting Overlay Banner */}
              {callState !== 'CONNECTED' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 space-y-4 bg-navy-950/90 z-10">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-brand-purple/20 border-2 border-brand-purple/40 flex items-center justify-center animate-pulse">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-brand-purple to-electric-500 flex items-center justify-center text-white text-3xl font-extrabold shadow-xl">
                        {partner?.displayName?.[0] || 'S'}
                      </div>
                    </div>
                    <span className="absolute -bottom-1 -right-1 p-2 rounded-full bg-emerald-500 text-white shadow-lg animate-bounce">
                      <PhoneCall className="w-4 h-4" />
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-white">{partner?.displayName}</h3>
                    <p className="text-xs text-brand-purple font-semibold mt-0.5">
                      {partner?.universityName || 'Student Peer'}
                    </p>
                    <p className="text-xs text-slate-400 mt-2 flex items-center justify-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-electric-400" />
                      <span>
                        {callState === 'STARTING' && 'Preparing camera and audio...'}
                        {callState === 'CALLING' && 'Calling partner student...'}
                        {callState === 'CONNECTING' && 'Securing WebRTC peer connection...'}
                      </span>
                    </p>
                  </div>
                </div>
              )}

              {/* Local Video Stream (Picture-in-Picture in Corner) */}
              <div className="absolute bottom-20 right-4 z-20 w-32 sm:w-48 aspect-video rounded-2xl overflow-hidden border-2 border-brand-purple/50 bg-navy-900 shadow-2xl">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover transform -scale-x-100 ${
                    isVideoDisabled ? 'hidden' : 'block'
                  }`}
                />
                {isVideoDisabled && (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-navy-850 text-slate-500 text-[10px]">
                    <VideoOff className="w-5 h-5 mb-1" />
                    <span>Camera off</span>
                  </div>
                )}
                <div className="absolute bottom-1 left-2 text-[9px] font-bold text-white/80 bg-black/40 px-1 rounded">
                  You
                </div>
              </div>
            </>
          )}
        </div>

        {/* Bottom Floating Controls Bar */}
        <div className="relative z-20 p-4 sm:p-5 bg-gradient-to-t from-navy-950 via-navy-950/80 to-transparent flex items-center justify-center gap-4">
          {/* Mute Audio Button */}
          <button
            onClick={toggleMic}
            className={`p-3.5 rounded-full transition-all ${
              isMicMuted
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                : 'bg-navy-800 hover:bg-navy-750 text-slate-200'
            }`}
            title={isMicMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          >
            {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* End Call Button */}
          <button
            onClick={handleEndCall}
            className="px-6 py-3.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-2 shadow-xl shadow-rose-600/40 hover:scale-105 transition-all"
            title="End Video Call"
          >
            <PhoneOff className="w-5 h-5" />
            <span className="hidden sm:inline">End Call</span>
          </button>

          {/* Toggle Video Button */}
          <button
            onClick={toggleVideo}
            className={`p-3.5 rounded-full transition-all ${
              isVideoDisabled
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                : 'bg-navy-800 hover:bg-navy-750 text-slate-200'
            }`}
            title={isVideoDisabled ? 'Enable Camera' : 'Disable Camera'}
          >
            {isVideoDisabled ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
