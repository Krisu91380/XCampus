'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Sparkles,
  Users,
  GraduationCap,
  Coins,
  ShieldCheck,
  Loader2,
  AlertCircle,
  XCircle,
  CheckCircle2,
  Search,
  ArrowRight,
  SlidersHorizontal,
} from 'lucide-react';

function MatchmakingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoSearch = searchParams.get('autoSearch') === 'true';

  const [user, setUser] = useState<any>(null);
  const [universities, setUniversities] = useState<any[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Preference Filters
  const [targetUni, setTargetUni] = useState<string>(''); // empty string = ANY
  const [userGender, setUserGender] = useState<'MALE' | 'FEMALE' | 'NON_BINARY'>('MALE');
  const [genderPref, setGenderPref] = useState<'EVERYONE' | 'BOYS' | 'GIRLS'>('EVERYONE');
  const [languagePref, setLanguagePref] = useState('English');
  const [courseFilter, setCourseFilter] = useState('');

  // Queue State
  const [isSearching, setIsSearching] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [matchResult, setMatchResult] = useState<any>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then((res) => res.json()),
      fetch('/api/universities').then((res) => res.json()),
    ])
      .then(([authData, uniData]) => {
        if (!authData.authenticated) {
          router.push('/login');
          return;
        }
        setUser(authData.user);
        if (authData.user?.profile?.gender && ['MALE', 'FEMALE', 'NON_BINARY'].includes(authData.user.profile.gender)) {
          setUserGender(authData.user.profile.gender);
        }
        if (uniData.success) {
          setUniversities(uniData.universities);
        }
        if (autoSearch && authData.user?.credits >= 1) {
          setTimeout(() => {
            const startBtn = document.getElementById('start-match-submit-btn');
            if (startBtn) startBtn.click();
          }, 300);
        }
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoadingInitial(false));
  }, [router, autoSearch]);

  // Handle Match Found Transition
  const handleMatchFound = (data: any) => {
    setIsSearching(false);
    setMatchResult(data);
    setStatusMessage('Partner matched! Redirecting to live room...');
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setTimeout(() => {
      router.push(`/chat/${data.conversationId}?match=true&autoCall=true`);
    }, 1200);
  };

  // Searching Effect: SSE + Polling Fallback
  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;
    let timerInterval: NodeJS.Timeout | null = null;

    if (isSearching) {
      setSecondsElapsed(0);
      timerInterval = setInterval(() => {
        setSecondsElapsed((s) => s + 1);
      }, 1000);

      // 1. Server-Sent Events (SSE) Stream
      try {
        const es = new EventSource('/api/match/stream');
        eventSourceRef.current = es;

        es.addEventListener('match_found', (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.conversationId) {
              handleMatchFound(data);
            }
          } catch {}
        });
      } catch {
        // SSE not supported or network error
      }

      // 2. High-frequency Polling Fallback (1.5 seconds)
      pollInterval = setInterval(async () => {
        try {
          const res = await fetch('/api/match/queue');
          const data = await res.json();

          if (data.matched && data.conversationId) {
            handleMatchFound(data);
          } else if (data.expired) {
            setIsSearching(false);
            if (eventSourceRef.current) eventSourceRef.current.close();
            setStatusMessage('No matching students are online right now. You can try again or browse student profiles.');
          }
        } catch {
          // network error during poll
        }
      }, 1500);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (timerInterval) clearInterval(timerInterval);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [isSearching]);

  const handleStartMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);
    setMatchResult(null);

    if (!user || user.credits < 1) {
      router.push('/pricing?required=true');
      return;
    }

    setIsSearching(true);

    try {
      const res = await fetch('/api/match/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUniversityId: targetUni || null,
          userGender,
          preferredPartnerGender: genderPref,
          language: languagePref,
          course: courseFilter || null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setIsSearching(false);
        if (res.status === 402) {
          router.push('/pricing?required=true');
          return;
        }
        throw new Error(data.message || 'Failed to start matchmaking');
      }

      if (data.matched && data.conversationId) {
        handleMatchFound(data);
      } else {
        setStatusMessage('Searching across active students... Please wait.');
      }
    } catch (err: any) {
      setIsSearching(false);
      setErrorMessage(err.message);
    }
  };

  const handleCancelSearch = async () => {
    setIsSearching(false);
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    try {
      await fetch('/api/match/queue', { method: 'DELETE' });
      setStatusMessage('Search cancelled. Zero chat credits were deducted.');
    } catch {
      //
    }
  };

  if (loadingInitial) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-brand-purple" />
        <p className="text-xs">Preparing matchmaking room...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-600 dark:text-purple-400 text-xs font-semibold mb-3">
          <Sparkles className="w-4 h-4 text-purple-500" />
          <span>Monkey Room • Real-Time Student Matchmaking</span>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Find Your Student Match</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          Connect with eligible, consenting students across verified universities. 1 credit is deducted
          atomically only when a mutual conversation is established.
        </p>
      </div>

      {/* Credit Lock Gate: If 0 Credits */}
      {user && user.credits < 1 && (
        <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-amber-300">
          <div className="flex items-start gap-3">
            <Coins className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white text-sm">You need chat credits to start a conversation.</p>
              <p className="text-slate-300 text-xs mt-1">
                Choose a package and complete payment to continue. Introductory chat passes start at ₹9.
              </p>
            </div>
          </div>
          <Link
            href="/pricing?required=true"
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-navy-950 font-bold transition-all shadow-lg shadow-amber-500/20 text-center whitespace-nowrap"
          >
            Buy Chat Credits
          </Link>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {statusMessage && !isSearching && !matchResult && (
        <div className="p-4 rounded-xl bg-electric-500/10 border border-electric-500/30 text-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-electric-400 flex-shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <button
            onClick={handleStartMatch}
            className="px-4 py-1.5 rounded-lg bg-electric-500 hover:bg-electric-400 text-white font-semibold text-xs transition-colors self-start sm:self-auto shrink-0"
          >
            Retry Search
          </button>
        </div>
      )}

      {/* Search Radar Active State */}
      {isSearching ? (
        <div className="glass-card rounded-3xl p-10 border border-brand-purple/40 text-center relative overflow-hidden space-y-6">
          <div className="relative w-36 h-36 mx-auto flex items-center justify-center">
            {/* Radar wave rings */}
            <div className="absolute inset-0 rounded-full border border-electric-400/20 animate-ping" />
            <div className="absolute inset-4 rounded-full border border-brand-purple/30 animate-pulse" />
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-brand-purple to-electric-500 flex items-center justify-center shadow-xl shadow-brand-purple/30">
              <Search className="w-8 h-8 text-white animate-bounce" />
            </div>
          </div>

          <div>
            <h3 className="text-xl font-bold text-white mb-1">
              Scanning for Compatible Students...
            </h3>
            <p className="text-xs text-slate-400">
              Filters applied: {genderPref} • {targetUni ? 'Specific University' : 'Any University'} •{' '}
              {languagePref}
            </p>
            <p className="font-mono text-xs text-electric-400 mt-2">
              Time elapsed: {secondsElapsed}s
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={handleCancelSearch}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 text-xs font-semibold transition-colors"
            >
              <XCircle className="w-4 h-4" />
              <span>Cancel Search (Zero credits deducted)</span>
            </button>
          </div>
        </div>
      ) : matchResult ? (
        <div className="glass-card rounded-3xl p-8 border border-emerald-500/40 text-center space-y-4 animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-2xl font-bold text-white">Student Match Established!</h3>
          <p className="text-xs text-slate-300">
            Connected with <strong className="text-white">{matchResult.partner?.displayName}</strong>{' '}
            from <strong className="text-electric-400">{matchResult.partner?.universityName}</strong>.
          </p>
          <div className="pt-2">
            <Link
              href={`/chat/${matchResult.conversationId}`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-brand-purple to-electric-500 text-white font-bold text-xs shadow-lg shadow-brand-purple/30"
            >
              <span>Enter Private Chat</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      ) : (
        /* Matchmaking Preferences Form */
        <div className="glass-card rounded-3xl p-6 sm:p-8 border border-navy-750">
          <div className="flex items-center gap-2 text-white font-bold text-sm mb-6 pb-4 border-b border-navy-800">
            <SlidersHorizontal className="w-4 h-4 text-brand-purple" />
            <span>Customize Match Criteria</span>
          </div>

          <form onSubmit={handleStartMatch} className="space-y-6 text-xs">
            {/* 1. Target University */}
            <div>
              <label className="block text-slate-300 font-semibold mb-2">
                1. Target University
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTargetUni('')}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    targetUni === ''
                      ? 'bg-brand-purple/15 border-brand-purple text-white shadow-md'
                      : 'bg-navy-900 border-navy-750 text-slate-400 hover:border-navy-700'
                  }`}
                >
                  <p className="font-bold text-white text-xs">Any University</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Match with students from LPU or any verified partner college
                  </p>
                </button>

                {universities.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setTargetUni(u.id)}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      targetUni === u.id
                        ? 'bg-brand-purple/15 border-brand-purple text-white shadow-md'
                        : 'bg-navy-900 border-navy-750 text-slate-400 hover:border-navy-700'
                    }`}
                  >
                    <p className="font-bold text-white text-xs">
                      {u.name} ({u.code})
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {u.city}, {u.state}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Your Gender (For Accurate Mutual Compatibility) */}
            <div>
              <label className="block text-slate-300 font-semibold mb-2">
                2. Your Gender (for mutual compatibility)
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setUserGender('MALE')}
                  className={`py-3 px-2 rounded-xl border font-bold text-center transition-all ${
                    userGender === 'MALE'
                      ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                      : 'bg-navy-900 border-navy-750 text-slate-400 hover:text-white'
                  }`}
                >
                  Male
                </button>

                <button
                  type="button"
                  onClick={() => setUserGender('FEMALE')}
                  className={`py-3 px-2 rounded-xl border font-bold text-center transition-all ${
                    userGender === 'FEMALE'
                      ? 'bg-pink-500/20 border-pink-500 text-pink-300'
                      : 'bg-navy-900 border-navy-750 text-slate-400 hover:text-white'
                  }`}
                >
                  Female
                </button>

                <button
                  type="button"
                  onClick={() => setUserGender('NON_BINARY')}
                  className={`py-3 px-2 rounded-xl border font-bold text-center transition-all ${
                    userGender === 'NON_BINARY'
                      ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                      : 'bg-navy-900 border-navy-750 text-slate-400 hover:text-white'
                  }`}
                >
                  Non-Binary
                </button>
              </div>
            </div>

            {/* 3. Partner Gender Preference */}
            <div>
              <label className="block text-slate-300 font-semibold mb-2">
                3. Preferred Conversation Partner
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setGenderPref('EVERYONE')}
                  className={`py-3 px-2 rounded-xl border font-bold text-center transition-all ${
                    genderPref === 'EVERYONE'
                      ? 'bg-electric-500/20 border-electric-500 text-electric-300'
                      : 'bg-navy-900 border-navy-750 text-slate-400 hover:text-white'
                  }`}
                >
                  Everyone
                </button>

                <button
                  type="button"
                  onClick={() => setGenderPref('GIRLS')}
                  className={`py-3 px-2 rounded-xl border font-bold text-center transition-all ${
                    genderPref === 'GIRLS'
                      ? 'bg-pink-500/20 border-pink-500 text-pink-300'
                      : 'bg-navy-900 border-navy-750 text-slate-400 hover:text-white'
                  }`}
                >
                  Girls
                </button>

                <button
                  type="button"
                  onClick={() => setGenderPref('BOYS')}
                  className={`py-3 px-2 rounded-xl border font-bold text-center transition-all ${
                    genderPref === 'BOYS'
                      ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                      : 'bg-navy-900 border-navy-750 text-slate-400 hover:text-white'
                  }`}
                >
                  Boys
                </button>
              </div>
            </div>

            {/* 4. Language & Course */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">
                  Chat Language
                </label>
                <select
                  value={languagePref}
                  onChange={(e) => setLanguagePref(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-navy-900 border border-navy-750 text-white focus:outline-none focus:border-brand-purple"
                >
                  <option value="English">English</option>
                  <option value="Hindi">Hindi / Hinglish</option>
                  <option value="Punjabi">Punjabi</option>
                  <option value="Tamil">Tamil</option>
                  <option value="Telugu">Telugu</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">
                  Topic / Course Filter (Optional)
                </label>
                <input
                  type="text"
                  value={courseFilter}
                  onChange={(e) => setCourseFilter(e.target.value)}
                  placeholder="e.g. Computer Science, MBA, Gaming"
                  className="w-full px-4 py-2.5 rounded-xl bg-navy-900 border border-navy-750 text-white placeholder-slate-500 focus:outline-none focus:border-brand-purple"
                />
              </div>
            </div>

            {/* Start Match CTA */}
            <div className="pt-4 border-t border-navy-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-[11px] text-slate-400 flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-400" />
                <span>
                  Uses 1 chat credit upon successful match. Your balance:{' '}
                  <strong className="text-white">{user?.credits ?? 0} credits</strong>.
                </span>
              </div>

              <button
                id="start-match-submit-btn"
                type="submit"
                disabled={user?.credits < 1}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-brand-purple to-electric-500 text-white font-bold text-sm shadow-xl shadow-brand-purple/25 hover:opacity-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Start Match Search</span>
              </button>
            </div>
          </form>

          {statusMessage && (
            <p className="text-xs text-center text-slate-400 mt-4">{statusMessage}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function MatchmakingPage() {
  return (
    <React.Suspense
      fallback={
        <div className="max-w-2xl mx-auto px-4 py-16 text-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-brand-purple" />
          <p className="text-xs">Preparing matchmaking room...</p>
        </div>
      }
    >
      <MatchmakingContent />
    </React.Suspense>
  );
}
