'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { PhoneCall, PhoneOff, Video, Volume2, ShieldCheck, User } from 'lucide-react';

interface IncomingCallData {
  conversationId: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string | null;
  callerUniversity?: string;
  isVideo?: boolean;
  createdAt: number;
}

export default function GlobalIncomingCallBanner() {
  const router = useRouter();
  const pathname = usePathname();

  const [activeCall, setActiveCall] = useState<IncomingCallData | null>(null);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const ringtoneTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isRingingRef = useRef(false);
  const declinedCallsRef = useRef<Set<string>>(new Set());

  // Stop Ringtone Audio cleanly
  const stopRingtone = useCallback(() => {
    isRingingRef.current = false;
    if (ringtoneTimerRef.current) {
      clearInterval(ringtoneTimerRef.current);
      ringtoneTimerRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close().catch(() => {});
      } catch {}
      audioContextRef.current = null;
    }
  }, []);

  // Web Audio API Ringtone Synthesizer
  const playRingtoneChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioCtx();
      }

      const ctx = audioContextRef.current;

      if (ctx.state === 'suspended') {
        setSoundBlocked(true);
        ctx.resume().catch(() => {});
      } else {
        setSoundBlocked(false);
      }

      // Play pleasant repeating chime pulse (520Hz & 659Hz harmonized chords)
      const now = ctx.currentTime;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.25, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      gain.connect(ctx.destination);

      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now); // C5
      osc1.frequency.setValueAtTime(659.25, now + 0.2); // E5
      osc1.connect(gain);
      osc1.start(now);
      osc1.stop(now + 0.9);

      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(659.25, now); // E5
      osc2.frequency.setValueAtTime(783.99, now + 0.2); // G5
      osc2.connect(gain);
      osc2.start(now);
      osc2.stop(now + 0.9);
    } catch {
      // Audio autoplay policy restriction
      setSoundBlocked(true);
    }
  }, []);

  // Start Repeating Ringtone
  const startRingtone = useCallback(() => {
    if (isRingingRef.current) return;
    isRingingRef.current = true;
    playRingtoneChime();
    ringtoneTimerRef.current = setInterval(() => {
      if (isRingingRef.current) {
        playRingtoneChime();
      }
    }, 2400);
  }, [playRingtoneChime]);

  // Unlock Audio upon user interaction if blocked
  const handleUnlockAudio = () => {
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().then(() => {
        setSoundBlocked(false);
        playRingtoneChime();
      });
    } else {
      setSoundBlocked(false);
      playRingtoneChime();
    }
  };

  // Poll for Incoming Calls across the entire website (Every 2.5 seconds)
  useEffect(() => {
    let isMounted = true;

    const checkIncomingCall = async () => {
      try {
        const res = await fetch('/api/calls/incoming');
        if (!res.ok) return;
        const data = await res.json();

        if (!isMounted) return;

        if (data.hasIncomingCall && data.call) {
          const call = data.call;
          const callKey = `${call.conversationId}_${call.createdAt}`;

          // Don't ring if user already declined this specific call
          if (declinedCallsRef.current.has(callKey)) {
            return;
          }

          // If user is already on the exact chat page with call modal active, don't show duplicate top banner
          if (pathname === `/chat/${call.conversationId}`) {
            // Already inside the call room
            return;
          }

          setActiveCall(call);
          if (!isRingingRef.current) {
            startRingtone();
          }
        } else {
          // No active call or caller hung up
          if (activeCall) {
            setActiveCall(null);
            stopRingtone();
          }
        }
      } catch {
        // Network retry
      }
    };

    const interval = setInterval(checkIncomingCall, 2500);
    // Initial check
    checkIncomingCall();

    return () => {
      isMounted = false;
      clearInterval(interval);
      stopRingtone();
    };
  }, [pathname, activeCall, startRingtone, stopRingtone]);

  const handleAcceptCall = () => {
    if (!activeCall) return;
    const convId = activeCall.conversationId;
    stopRingtone();
    setActiveCall(null);
    router.push(`/chat/${convId}?autoAccept=true`);
  };

  const handleDeclineCall = async () => {
    if (!activeCall) return;
    const convId = activeCall.conversationId;
    const callKey = `${convId}_${activeCall.createdAt}`;
    declinedCallsRef.current.add(callKey);

    stopRingtone();
    setActiveCall(null);

    try {
      await fetch(`/api/chat/${convId}/signaling`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'call-reject' }),
      });
    } catch {}
  };

  if (!activeCall) return null;

  return (
    <aside aria-label="Incoming Call Alert" className="sticky top-0 z-[60] w-full bg-gradient-to-r from-brand-purple via-indigo-600 to-electric-500 shadow-2xl border-b border-white/20 animate-fade-in text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Caller Identity */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center font-bold text-sm shadow-md overflow-hidden">
              {activeCall.callerAvatar ? (
                <img
                  src={activeCall.callerAvatar}
                  alt={activeCall.callerName}
                  className="w-full h-full object-cover"
                />
              ) : (
                activeCall.callerName[0] || 'S'
              )}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-brand-purple animate-ping" />
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm tracking-wide text-white">
                {activeCall.callerName}
              </span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
            </div>
            <p className="text-[11px] text-white/90 font-medium">
              Incoming Live Video Call • {activeCall.callerUniversity || 'Student Peer'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {soundBlocked && (
            <button
              onClick={handleUnlockAudio}
              className="px-2.5 py-1 rounded-lg bg-black/30 hover:bg-black/50 text-[10px] font-semibold text-amber-200 border border-amber-300/40 flex items-center gap-1 transition-colors"
            >
              <Volume2 className="w-3 h-3" />
              <span>Enable Ringtone</span>
            </button>
          )}

          {/* Accept Button */}
          <button
            onClick={handleAcceptCall}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs shadow-lg shadow-emerald-500/40 hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5"
          >
            <Video className="w-4 h-4" />
            <span>Accept</span>
          </button>

          {/* Decline Button */}
          <button
            onClick={handleDeclineCall}
            className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/40 hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            <span>Decline</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
