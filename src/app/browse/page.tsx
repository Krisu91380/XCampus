'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Compass,
  Search,
  Filter,
  GraduationCap,
  ShieldCheck,
  MessageSquare,
  Coins,
  Loader2,
  Sparkles,
  UserPlus,
  Clock,
  Check,
  X,
  UserCheck,
} from 'lucide-react';

export default function BrowseStudentsPage() {
  const router = useRouter();
  const [students, setStudents] = useState<any[]>([]);
  const [universities, setUniversities] = useState<any[]>([]);
  const [friendsData, setFriendsData] = useState<{
    incoming: any[];
    outgoing: any[];
    friends: any[];
  }>({ incoming: [], outgoing: [], friends: [] });
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUni, setSelectedUni] = useState('');
  const [selectedGender, setSelectedGender] = useState('ALL');

  const fetchStudents = async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('q', searchQuery);
      if (selectedUni) params.append('universityId', selectedUni);
      if (selectedGender !== 'ALL') params.append('gender', selectedGender);

      const [studRes, uniRes, friRes] = await Promise.all([
        fetch(`/api/browse?${params.toString()}`),
        fetch('/api/universities'),
        fetch('/api/friends').catch(() => ({ json: () => ({ success: false }) })),
      ]);

      const studData = await studRes.json();
      if (studData.success) {
        setStudents(studData.students);
      }

      const uniData = await uniRes.json();
      if (uniData.success) {
        setUniversities(uniData.universities);
      }

      const friData = await (friRes as any).json();
      if (friData.success) {
        setFriendsData({
          incoming: friData.incoming || [],
          outgoing: friData.outgoing || [],
          friends: friData.friends || [],
        });
      }
    } catch {
      //
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [selectedUni, selectedGender]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    fetchStudents();
  };

  const handleSendFriendRequest = async (targetUserId: string) => {
    setActionLoadingId(targetUserId);
    try {
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to send friend request');
      }

      // Refresh friends state
      const friRes = await fetch('/api/friends');
      const friData = await friRes.json();
      if (friData.success) {
        setFriendsData({
          incoming: friData.incoming || [],
          outgoing: friData.outgoing || [],
          friends: friData.friends || [],
        });
      }
    } catch (err: any) {
      setErrorNotice(err.message || 'Error sending friend request');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleAcceptFriendRequest = async (requestId: string) => {
    setActionLoadingId(requestId);
    setErrorNotice(null);
    try {
      const res = await fetch('/api/friends/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action: 'ACCEPT' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to accept request');
      }

      if (data.conversationId) {
        router.push(`/chat/${data.conversationId}`);
      } else {
        fetchStudents();
      }
    } catch (err: any) {
      setErrorNotice(err.message || 'Error accepting friend request');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeclineFriendRequest = async (requestId: string) => {
    setActionLoadingId(requestId);
    setErrorNotice(null);
    try {
      const res = await fetch('/api/friends/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action: 'DECLINE' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to decline request');
      }
      fetchStudents();
    } catch (err: any) {
      setErrorNotice(err.message || 'Error declining friend request');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {errorNotice && (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-2 animate-fade-in">
          <span>{errorNotice}</span>
          <button
            onClick={() => setErrorNotice(null)}
            className="p-1 text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-purple/10 border border-brand-purple/30 text-brand-purple text-xs font-semibold mb-2">
            <Compass className="w-3.5 h-3.5" />
            <span>Discoverable Student Directory</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Browse Student Profiles</h1>
          <p className="text-xs text-slate-400 mt-1">
            Real consenting peers from Lovely Professional University and leading campuses.
          </p>
        </div>

        <Link
          href="/match"
          className="self-start sm:self-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-purple to-electric-500 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-brand-purple/20"
        >
          <Sparkles className="w-4 h-4" />
          <span>Try Auto-Matchmaker</span>
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="glass-card rounded-2xl p-3.5 sm:p-4 border border-navy-750">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:grid sm:grid-cols-4 gap-2.5 sm:gap-3 text-xs">
          {/* Search Input */}
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, course, interests..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-navy-900 border border-navy-750 text-white placeholder-slate-500 focus:outline-none focus:border-brand-purple text-xs"
            />
          </div>

          {/* University Dropdown */}
          <div className="w-full">
            <select
              value={selectedUni}
              onChange={(e) => setSelectedUni(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-navy-900 border border-navy-750 text-white focus:outline-none focus:border-brand-purple text-xs"
            >
              <option value="">All Universities</option>
              {universities.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.code})
                </option>
              ))}
            </select>
          </div>

          {/* Gender Filter */}
          <div className="flex items-center gap-2">
            <select
              value={selectedGender}
              onChange={(e) => setSelectedGender(e.target.value)}
              className="flex-1 px-3 py-2.5 rounded-xl bg-navy-900 border border-navy-750 text-white focus:outline-none focus:border-brand-purple text-xs"
            >
              <option value="ALL">All Genders</option>
              <option value="FEMALE">Girls</option>
              <option value="MALE">Boys</option>
              <option value="NON_BINARY">Non-Binary</option>
            </select>

            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-purple to-electric-500 hover:opacity-95 text-white font-bold transition-opacity cursor-pointer shrink-0 shadow-sm"
            >
              Filter
            </button>
          </div>
        </form>
      </div>

      {/* Student Cards Grid */}
      {loading ? (
        <div className="py-20 text-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-brand-purple" />
          <p className="text-xs">Finding available students...</p>
        </div>
      ) : students.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center border border-navy-750 text-slate-400 text-xs space-y-2">
          <Compass className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-white">No Matching Students Found</h3>
          <p className="max-w-md mx-auto">
            Try broadening your search query or selecting "All Universities" to discover more peers.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {students.map((st) => (
            <div
              key={st.id}
              className="glass-card rounded-2xl p-6 border border-navy-750 hover:border-brand-purple/40 transition-all flex flex-col justify-between"
            >
              <div>
                {/* Header: Avatar, Name, Online Badge */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      {st.avatarUrl ? (
                        <img
                          src={st.avatarUrl}
                          alt={st.displayName}
                          className="w-12 h-12 rounded-full object-cover border border-navy-700"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-brand-purple to-electric-500 flex items-center justify-center text-white font-bold text-base">
                          {st.displayName[0]}
                        </div>
                      )}
                      {st.isOnline && (
                        <span
                          title="Online right now"
                          className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-navy-900"
                        />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-bold text-white">{st.displayName}</h3>
                        {st.isVerified && (
                          <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {st.academicYear || 'Student'}
                      </p>
                    </div>
                  </div>

                  <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-navy-800 text-slate-300">
                    {st.university?.code || 'UNI'}
                  </span>
                </div>

                {/* University & Course */}
                <div className="text-xs text-slate-300 mb-3 space-y-1">
                  <p className="font-semibold text-brand-purple flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5" />
                    {st.university?.name || 'Verified University'}
                  </p>
                  {st.course && (
                    <p className="text-[11px] text-slate-400">{st.course}</p>
                  )}
                </div>

                {/* Bio */}
                {st.bio && (
                  <p className="text-xs text-slate-400 italic mb-4 line-clamp-2">
                    "{st.bio}"
                  </p>
                )}

                {/* Interests Tags */}
                {st.interests && st.interests.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-6">
                    {st.interests.slice(0, 4).map((tag: string) => (
                      <span
                        key={tag}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-navy-850 text-slate-300 border border-navy-750"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Button: Friend Request Workflow */}
              {(() => {
                const isFriend = friendsData.friends.find((f: any) => f.partner?.userId === st.id);
                if (isFriend) {
                  return (
                    <Link
                      href={`/chat/${isFriend.conversationId}`}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 hover:opacity-95 transition-all"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Open Chat &amp; Call</span>
                    </Link>
                  );
                }

                const incomingReq = friendsData.incoming.find((i: any) => i.sender?.userId === st.id);
                if (incomingReq) {
                  return (
                    <div className="flex items-center gap-2 w-full">
                      <button
                        onClick={() => handleAcceptFriendRequest(incomingReq.id)}
                        disabled={actionLoadingId === incomingReq.id}
                        className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1 shadow-md shadow-emerald-600/20 cursor-pointer"
                      >
                        {actionLoadingId === incomingReq.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>Accept</span>
                      </button>
                      <button
                        onClick={() => handleDeclineFriendRequest(incomingReq.id)}
                        disabled={actionLoadingId === incomingReq.id}
                        className="px-3 py-2 rounded-xl bg-navy-800 hover:bg-navy-750 text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
                        title="Decline request"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                }

                const outgoingReq = friendsData.outgoing.find(
                  (o: any) => o.receiver?.userId === st.id && o.status === 'PENDING'
                );
                if (outgoingReq) {
                  return (
                    <div className="w-full py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center justify-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>Request Sent (Pending)</span>
                    </div>
                  );
                }

                return (
                  <button
                    onClick={() => handleSendFriendRequest(st.id)}
                    disabled={actionLoadingId === st.id}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-brand-purple to-electric-500 text-white text-xs font-bold hover:opacity-95 disabled:opacity-50 transition-opacity flex items-center justify-center gap-1.5 shadow-md shadow-brand-purple/20 cursor-pointer"
                  >
                    {actionLoadingId === st.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <UserPlus className="w-3.5 h-3.5" />
                    )}
                    <span>Add Friend</span>
                  </button>
                );
              })()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
