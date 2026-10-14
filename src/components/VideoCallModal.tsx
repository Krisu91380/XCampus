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
  ShieldCheck,
  PhoneCall,
  Minus,
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
  // Call States: 'STARTING' | 'CALLING' | 'RINGING' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'ENDED'
  const [callState, setCallState] = useState<
    'STARTING' | 'CALLING' | 'RINGING' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'ENDED'
  >('STARTING');

  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [callDurationSeconds, setCallDurationSeconds] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSignalTimestampRef = useRef<number>(Date.now() - 120000);
  const seenSignalIdsRef = useRef<Set<string>>(new Set());
  const iceCandidateQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const isEndingRef = useRef(false);

  const sendSignal = useCallback(
    async (type: string, payload?: any) => {
      try {
        await fetch(`/api/chat/${conversationId}/signaling`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type,
            payload: {
              sessionId: 'modal_' + conversationId,
              data: payload,
            },
          }),
        });
      } catch (err) {
        console.warn('Signaling send error:', err);
      }
    },
    [conversationId]
  );

  // Clean shutdown helper
  const cleanUp = useCallback(() => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
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
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }

    iceCandidateQueueRef.current = [];
    seenSignalIdsRef.current.clear();

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
    lastSignalTimestampRef.current = Date.now() - 120000;
    seenSignalIdsRef.current.clear();
    iceCandidateQueueRef.current = [];

    const flushIceCandidateQueue = async (targetPc: RTCPeerConnection) => {
      if (iceCandidateQueueRef.current.length === 0) return;
      const pending = [...iceCandidateQueueRef.current];
      iceCandidateQueueRef.current = [];
      for (const cand of pending) {
        try {
          await targetPc.addIceCandidate(new RTCIceCandidate(cand));
        } catch (err) {
          console.warn('Queued ICE candidate application error:', err);
        }
      }
    };

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

        // 2. Configure ICE Servers (Google STUN + Resilient TURN Relay)
        const iceServers: RTCIceServer[] = [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun.services.mozilla.com' },
          // High-reliability TURN relay for NAT traversal & restrictive firewalls
          {
            urls: [
              'turn:global.relay.metered.ca:80',
              'turn:global.relay.metered.ca:80?transport=tcp',
              'turn:global.relay.metered.ca:443',
              'turns:global.relay.metered.ca:443?transport=tcp',
            ],
            username: process.env.NEXT_PUBLIC_TURN_USERNAME || 'openrelayproject',
            credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || 'openrelayproject',
          },
        ];

        if (process.env.NEXT_PUBLIC_STUN_SERVER_URL) {
          iceServers.unshift({ urls: process.env.NEXT_PUBLIC_STUN_SERVER_URL });
        }

        if (process.env.NEXT_PUBLIC_TURN_SERVER_URL) {
          const turnServer: RTCIceServer = {
            urls: process.env.NEXT_PUBLIC_TURN_SERVER_URL,
            username: process.env.NEXT_PUBLIC_TURN_USERNAME || undefined,
            credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || undefined,
          };
          iceServers.unshift(turnServer);
        }

        const pc = new RTCPeerConnection({ iceServers });
        pcRef.current = pc;

        // Add local tracks to peer connection
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        // When remote track is received
        pc.ontrack = (event) => {
          if (remoteVideoRef.current && event.streams[0]) {
            remoteVideoRef.current.srcObject = event.streams[0];
            remoteVideoRef.current.play().catch((e) => console.warn('Remote video play error:', e));
            setCallState('CONNECTED');
            if (connectionTimeoutRef.current) {
              clearTimeout(connectionTimeoutRef.current);
              connectionTimeoutRef.current = null;
            }
          }
        };

        // When local ICE candidate is gathered
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            sendSignal('ice-candidate', event.candidate.toJSON());
          }
        };

        // Monitor ICE connection state changes
        pc.oniceconnectionstatechange = () => {
          if (
            pc.iceConnectionState === 'connected' ||
            pc.iceConnectionState === 'completed'
          ) {
            setCallState('CONNECTED');
            if (connectionTimeoutRef.current) {
              clearTimeout(connectionTimeoutRef.current);
              connectionTimeoutRef.current = null;
            }
          } else if (pc.iceConnectionState === 'disconnected') {
            setCallState('RECONNECTING');
          } else if (pc.iceConnectionState === 'failed') {
            setErrorMessage(
              'ICE negotiation failed. Direct peer-to-peer connection could not be established. Network or firewall restrictions may require a TURN relay.'
            );
          }
        };

        // Monitor connection state changes
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'connected') {
            setCallState('CONNECTED');
            if (connectionTimeoutRef.current) {
              clearTimeout(connectionTimeoutRef.current);
              connectionTimeoutRef.current = null;
            }
          } else if (pc.connectionState === 'disconnected') {
            setCallState('RECONNECTING');
          } else if (pc.connectionState === 'failed') {
            setErrorMessage(
              'WebRTC connection failed. Please check your internet connection or firewall settings.'
            );
          }
        };

        // Set 25-second connection timeout to prevent hanging indefinitely
        connectionTimeoutRef.current = setTimeout(() => {
          if (
            pcRef.current &&
            pcRef.current.connectionState !== 'connected' &&
            !isEndingRef.current
          ) {
            setErrorMessage(
              'Connection timed out while securing WebRTC peer connection. The other student may have disconnected or your network blocks peer-to-peer traffic.'
            );
          }
        }, 25000);

        // 3. Negotiate Role: Initiator or Receiver
        if (isInitiator) {
          setCallState('RINGING');
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
                // Deduplicate signals
                if (seenSignalIdsRef.current.has(sig.id)) continue;
                seenSignalIdsRef.current.add(sig.id);

                lastSignalTimestampRef.current = Math.max(
                  lastSignalTimestampRef.current,
                  sig.createdAt
                );

                if (sig.type === 'call-end' || sig.type === 'call-reject') {
                  setCallState('ENDED');
                  handleEndCall();
                  return;
                }

                if (sig.type === 'call-accept' && isInitiator) {
                  // Partner accepted call. Wait for ICE and answer negotiation without duplicating offer
                  setCallState('CONNECTING');
                }

                const payloadData = sig.payload?.data !== undefined ? sig.payload.data : sig.payload;

                if (sig.type === 'offer' && !isInitiator) {
                  // Receiver receives offer, creates answer
                  if (pc.signalingState !== 'stable') {
                    await Promise.all([
                      pc.setLocalDescription({ type: 'rollback' } as any),
                    ]).catch(() => {});
                  }
                  await pc.setRemoteDescription(new RTCSessionDescription(payloadData));
                  await flushIceCandidateQueue(pc);

                  const answer = await pc.createAnswer();
                  await pc.setLocalDescription(answer);
                  await sendSignal('answer', answer);
                  setCallState('CONNECTING');
                }

                if (sig.type === 'answer' && isInitiator) {
                  // Initiator receives answer
                  if (pc.signalingState === 'have-local-offer') {
                    await pc.setRemoteDescription(
                      new RTCSessionDescription(payloadData)
                    );
                    await flushIceCandidateQueue(pc);
                    setCallState('CONNECTING');
                  }
                }

                if (sig.type === 'ice-candidate' && payloadData) {
                  if (!pc.remoteDescription) {
                    iceCandidateQueueRef.current.push(payloadData);
                  } else {
                    try {
                      await pc.addIceCandidate(new RTCIceCandidate(payloadData));
                    } catch (e) {
                      // ICE race tolerance
                    }
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
    <div
      className={
        isMinimized
          ? "fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 pointer-events-auto"
          : "fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-navy-950/90 backdrop-blur-lg animate-fade-in"
      }
    >
      <div
        ref={containerRef}
        className={
          isMinimized
            ? "relative w-72 sm:w-80 aspect-video bg-navy-950 border-2 border-brand-purple rounded-2xl shadow-2xl overflow-hidden flex flex-col justify-between"
            : "relative w-full max-w-4xl h-[88vh] bg-navy-900 border border-navy-750 rounded-3xl shadow-2xl overflow-hidden flex flex-col justify-between"
        }
      >
        {/* Top Floating Header */}
        <div className={`absolute top-0 left-0 right-0 z-20 flex items-center justify-between ${isMinimized ? 'p-2 bg-navy-950/90' : 'p-4 sm:p-6 bg-gradient-to-b from-navy-950/80 to-transparent'}`}>
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className={`rounded-full bg-gradient-to-tr from-brand-purple to-electric-500 flex items-center justify-center text-white font-bold shadow-md shrink-0 ${isMinimized ? 'w-6 h-6 text-xs' : 'w-10 h-10 text-sm'}`}>
              {partner?.displayName?.[0] || 'S'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs sm:text-sm font-bold text-white truncate max-w-[100px] sm:max-w-none">{partner?.displayName}</h4>
                {!isMinimized && <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />}
              </div>
              {!isMinimized && (
                <p className="text-[11px] text-slate-300 truncate">
                  {partner?.universityName || 'Verified University Student'}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {callState === 'CONNECTED' && (
              <div className={`px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-mono font-bold flex items-center gap-1 sm:gap-1.5 ${isMinimized ? 'text-[10px]' : 'text-xs'}`}>
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{formatDuration(callDurationSeconds)}</span>
              </div>
            )}

            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1.5 sm:p-2 rounded-xl bg-navy-800/70 hover:bg-navy-750 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title={isMinimized ? "Restore Call" : "Minimize Call"}
            >
              {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minus className="w-4 h-4" />}
            </button>

            {!isMinimized && (
              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-xl bg-navy-800/70 hover:bg-navy-750 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Toggle Fullscreen"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>

        {/* Center Video Canvas */}
        <div className="relative flex-1 bg-navy-950 flex items-center justify-center overflow-hidden">
          {errorMessage ? (
            /* Error State (Permissions / Devices / Timeout) */
            <div className="max-w-md p-6 text-center space-y-3 z-10 animate-fade-in">
              <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-white">Video Call Unavailable</h4>
              <p className="text-xs text-rose-300 leading-relaxed">{errorMessage}</p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={handleEndCall}
                  className="px-5 py-2.5 rounded-xl bg-navy-800 hover:bg-navy-750 text-white text-xs font-semibold"
                >
                  Close Call Window
                </button>
              </div>
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
                        {callState === 'RINGING' && 'Ringing partner student...'}
                        {callState === 'CONNECTING' && 'Securing WebRTC peer connection...'}
                        {callState === 'RECONNECTING' && 'Reconnecting WebRTC stream...'}
                      </span>
                    </p>
                  </div>
                </div>
              )}

              {/* Local Video Stream (Picture-in-Picture in Corner) */}
              <div className={`absolute z-20 aspect-video rounded-xl sm:rounded-2xl overflow-hidden border-2 border-brand-purple/50 bg-navy-900 shadow-2xl ${isMinimized ? 'w-20 bottom-12 right-2' : 'bottom-20 right-4 w-32 sm:w-48'}`}>
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
        <div className={`relative z-20 ${isMinimized ? 'p-1.5 bg-navy-950/90 gap-2' : 'p-4 sm:p-5 bg-gradient-to-t from-navy-950 via-navy-950/80 to-transparent gap-4'} flex items-center justify-center`}>
          {/* Mute Audio Button */}
          <button
            onClick={toggleMic}
            className={`${isMinimized ? 'p-2' : 'p-3.5'} rounded-full transition-all cursor-pointer ${
              isMicMuted
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                : 'bg-navy-800 hover:bg-navy-750 text-slate-200'
            }`}
            title={isMicMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          >
            {isMicMuted ? <MicOff className={isMinimized ? "w-3.5 h-3.5" : "w-5 h-5"} /> : <Mic className={isMinimized ? "w-3.5 h-3.5" : "w-5 h-5"} />}
          </button>

          {/* End Call Button */}
          <button
            onClick={handleEndCall}
            className={`${isMinimized ? 'p-2' : 'px-6 py-3.5 gap-2'} rounded-full bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center shadow-xl shadow-rose-600/40 hover:scale-105 transition-all cursor-pointer`}
            title="End Video Call"
          >
            <PhoneOff className={isMinimized ? "w-3.5 h-3.5" : "w-5 h-5"} />
            {!isMinimized && <span className="hidden sm:inline">End Call</span>}
          </button>

          {/* Toggle Video Button */}
          <button
            onClick={toggleVideo}
            className={`${isMinimized ? 'p-2' : 'p-3.5'} rounded-full transition-all cursor-pointer ${
              isVideoDisabled
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                : 'bg-navy-800 hover:bg-navy-750 text-slate-200'
            }`}
            title={isVideoDisabled ? 'Enable Camera' : 'Disable Camera'}
          >
            {isVideoDisabled ? <VideoOff className={isMinimized ? "w-3.5 h-3.5" : "w-5 h-5"} /> : <Video className={isMinimized ? "w-3.5 h-3.5" : "w-5 h-5"} />}
          </button>
        </div>
      </div>
    </div>
  );
}
