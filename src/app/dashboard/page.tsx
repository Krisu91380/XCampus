'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Coins,
  MessageSquare,
  Compass,
  ArrowRight,
  GraduationCap,
  Bell,
  Eye,
  EyeOff,
  UserCheck,
  CheckCircle2,
  Clock,
  Layers,
  Settings,
  ChevronRight,
} from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlineToggle, setOnlineToggle] = useState(true);
  const [discoverableToggle, setDiscoverableToggle] = useState(true);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const [authRes, convRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch('/api/chat/conversations'),
      ]);

      const authData = await authRes.json();
      if (!authData.authenticated) {
        router.push('/login');
        return;
      }
      setData(authData.user);
      setOnlineToggle(authData.user?.profile?.isOnline ?? true);
      setDiscoverableToggle(authData.user?.profile?.isDiscoverable ?? true);

      const convData = await convRes.json();
      if (convData.success) {
        setConversations(convData.conversations);
      }
    } catch {
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleToggleOnline = async () => {
    const nextVal = !onlineToggle;
    setOnlineToggle(nextVal);
    // Persist via browse or auth state
  };

  const activeConversations = conversations.filter((c) => c.status === 'ACTIVE');
  const pastConversations = conversations.filter((c) => c.status === 'ENDED');

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-slate-400">
        <div className="w-12 h-12 border-2 border-brand-purple border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-xs">Loading student dashboard...</p>
      </div>
    );
  }

  const profile = data?.profile;
  const isVerified = data?.role === 'VERIFIED_STUDENT';

  // Calculate profile completion percentage
  let completionPoints = 0;
  if (data?.displayName || profile?.displayName) completionPoints += 25;
  if (data?.university) completionPoints += 25;
  if (profile?.course) completionPoints += 20;
  if (profile?.interests && profile.interests.length > 0) completionPoints += 20;
  if (isVerified) completionPoints += 10;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* 1. Header Banner */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 border border-navy-750 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
              Welcome back, {profile?.displayName || 'Student'}!
            </h1>
            {isVerified ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" /> Verified Student
              </span>
            ) : (
              <Link
                href="/dashboard/verification"
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 text-xs font-semibold hover:bg-amber-500/25"
              >
                <ShieldAlert className="w-3.5 h-3.5" /> Verify Student ID
              </Link>
            )}
          </div>
          <p className="text-xs text-slate-400 flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-brand-purple" />
            <span>{data?.university?.name || 'Lovely Professional University'}</span>
            <span>•</span>
            <span>{profile?.course || 'Student'} ({profile?.academicYear || 'Undergrad'})</span>
          </p>
        </div>

        {/* Action Controls & Credit Count */}
        <div className="flex items-center gap-3">
          <Link
            href="/pricing"
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold hover:bg-amber-500/20 transition-all shadow-md"
          >
            <Coins className="w-4 h-4 text-amber-400" />
            <span>{data?.credits} Credits Available</span>
            <span className="text-[10px] bg-amber-400/20 px-1.5 py-0.5 rounded text-amber-200">
              + Top Up
            </span>
          </Link>

          <Link
            href="/match"
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-brand-purple to-electric-500 text-white text-xs font-bold shadow-lg shadow-brand-purple/25 hover:opacity-95 transition-opacity flex items-center gap-1.5"
          >
            <Sparkles className="w-4 h-4" />
            <span>Find a Match</span>
          </Link>
        </div>
      </div>

      {/* 2. Grid Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Quick Actions & Profile Status */}
        <div className="space-y-6">
          {/* Action Hub */}
          <div className="glass-card rounded-2xl p-6 border border-navy-750 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Explore Connections
            </h3>

            <Link
              href="/match"
              className="w-full p-4 rounded-xl bg-gradient-to-r from-brand-purple/20 to-navy-850 border border-brand-purple/40 hover:border-brand-purple text-left flex items-center justify-between group transition-all"
            >
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-electric-400" />
                  Instant Matchmaking
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Filter by gender, partner university & topics
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
            </Link>

            <Link
              href="/browse"
              className="w-full p-4 rounded-xl bg-navy-850 hover:bg-navy-800 border border-navy-700 text-left flex items-center justify-between group transition-all"
            >
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-brand-purple" />
                  Browse Student Directory
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Discover verified peers from LPU and other campuses
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
            </Link>
          </div>

          {/* Profile Strength & Verification Status */}
          <div className="glass-card rounded-2xl p-6 border border-navy-750">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-white">Profile Strength</h4>
              <span className="text-xs font-bold text-electric-400">{completionPoints}%</span>
            </div>
            <div className="w-full bg-navy-800 h-2 rounded-full overflow-hidden mb-4">
              <div
                className="bg-gradient-to-r from-brand-purple to-electric-500 h-full rounded-full transition-all"
                style={{ width: `${completionPoints}%` }}
              />
            </div>

            {!isVerified && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300">
                <p className="font-semibold mb-1">Boost Trust with Verification</p>
                <p className="text-slate-400 mb-2">
                  Verify your LPU institutional email or upload student ID proof to get the verified
                  badge.
                </p>
                <Link
                  href="/dashboard/verification"
                  className="font-bold text-amber-400 hover:underline"
                >
                  Submit Student ID Proof →
                </Link>
              </div>
            )}
          </div>

          {/* Privacy Controls */}
          <div className="glass-card rounded-2xl p-6 border border-navy-750 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Privacy & Availability
            </h4>

            <div className="flex items-center justify-between text-xs">
              <div>
                <p className="font-semibold text-white">Online Status</p>
                <p className="text-[11px] text-slate-400">Show green active presence indicator</p>
              </div>
              <button
                onClick={handleToggleOnline}
                className={`w-11 h-6 rounded-full transition-colors relative ${
                  onlineToggle ? 'bg-emerald-500' : 'bg-navy-700'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
                    onlineToggle ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between text-xs pt-3 border-t border-navy-800">
              <div>
                <p className="font-semibold text-white">Public Discovery</p>
                <p className="text-[11px] text-slate-400">Appear on the Browse Students page</p>
              </div>
              <button
                onClick={() => setDiscoverableToggle(!discoverableToggle)}
                className={`w-11 h-6 rounded-full transition-colors relative ${
                  discoverableToggle ? 'bg-brand-purple' : 'bg-navy-700'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
                    discoverableToggle ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Right 2 Columns: Active & Recent Conversations */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Conversations Section */}
          <div className="glass-card rounded-2xl p-6 border border-navy-750">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                Active Conversations ({activeConversations.length})
              </h3>
            </div>

            {activeConversations.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-navy-900/50 border border-navy-800 text-slate-400 text-xs">
                <MessageSquare className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="font-semibold text-white mb-1">No Active Chat In Progress</p>
                <p className="max-w-sm mx-auto mb-4">
                  Ready to connect? Start an instant match or browse students from Lovely Professional
                  University.
                </p>
                <Link
                  href="/match"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-purple to-electric-500 text-white font-semibold shadow-md shadow-brand-purple/20"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Start Matchmaking
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {activeConversations.map((c) => (
                  <Link
                    key={c.id}
                    href={`/chat/${c.id}`}
                    className="p-4 rounded-xl bg-navy-850 hover:bg-navy-800 border border-navy-700 hover:border-brand-purple/40 transition-all flex items-center justify-between block group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-purple to-electric-500 flex items-center justify-center text-white font-bold text-sm">
                        {c.partner?.displayName?.[0] || 'S'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white group-hover:text-electric-400 transition-colors">
                            {c.partner?.displayName || 'Student Partner'}
                          </h4>
                          {c.partner?.isVerified && (
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {c.partner?.universityName} • {c.partner?.course || 'Campus Peer'}
                        </p>
                        {c.lastMessage && (
                          <p className="text-xs text-slate-300 mt-1 max-w-md truncate">
                            {c.lastMessage.isMine ? 'You: ' : ''}
                            {c.lastMessage.content}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {c.hasUnread && (
                        <span className="w-2.5 h-2.5 rounded-full bg-electric-400 animate-pulse" />
                      )}
                      <span className="text-xs font-semibold text-electric-400 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                        Chat Now <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Past Conversations Section */}
          <div className="glass-card rounded-2xl p-6 border border-navy-750">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              Past Conversation History ({pastConversations.length})
            </h3>

            {pastConversations.length === 0 ? (
              <p className="text-xs text-slate-500">No past completed conversations yet.</p>
            ) : (
              <div className="space-y-2">
                {pastConversations.map((c) => (
                  <Link
                    key={c.id}
                    href={`/chat/${c.id}`}
                    className="p-3 rounded-xl bg-navy-900 border border-navy-800 text-xs flex items-center justify-between text-slate-300 hover:bg-navy-850"
                  >
                    <div>
                      <span className="font-semibold text-white">
                        {c.partner?.displayName || 'Student'}
                      </span>{' '}
                      <span className="text-slate-500">({c.partner?.universityName})</span>
                    </div>
                    <span className="text-[11px] text-slate-500">Ended</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
