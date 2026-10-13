'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  MessageSquare,
  Search,
  Send,
  Video,
  ShieldCheck,
  GraduationCap,
  ArrowLeft,
  Loader2,
  Sparkles,
  CheckCheck,
  User,
  Plus,
  Compass,
  UserPlus,
  UserMinus,
  Check,
  X,
  Ban,
  Trash2,
  MoreVertical,
  AlertCircle,
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import VideoCallModal from '@/components/VideoCallModal';

export default function MessagesPage() {
  const router = useRouter();

  // Conversations State
  const [conversations, setConversations] = useState<any[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);

  // Friend Requests state
  const [friendsData, setFriendsData] = useState<{
    incoming: any[];
    outgoing: any[];
    friends: any[];
  }>({ incoming: [], outgoing: [], friends: [] });
  const [friendActionLoadingId, setFriendActionLoadingId] = useState<string | null>(null);
  const [friendActionError, setFriendActionError] = useState<string | null>(null);
  const [addingFriend, setAddingFriend] = useState(false);

  // Blocked Users State & Modal
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  // Active chat state
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [chatPartner, setChatPartner] = useState<any>(null);
  const [activeMenuOpen, setActiveMenuOpen] = useState(false);

  // Video call state
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isCallInitiator, setIsCallInitiator] = useState(false);

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior,
      });
    }
  };

  // 1. Fetch Conversations List
  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/chat/conversations');
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (res.status === 401) {
          router.push('/login');
          return;
        }
        return;
      }
      setConversations(data.conversations || []);
    } catch {
      //
    } finally {
      setLoadingList(false);
    }
  };

  // 1b. Fetch Friends & Pending Friend Requests
  const fetchFriends = async () => {
    try {
      const res = await fetch('/api/friends');
      const data = await res.json();
      if (res.ok && data.success) {
        setFriendsData({
          incoming: data.incoming || [],
          outgoing: data.outgoing || [],
          friends: data.friends || [],
        });
      }
    } catch {
      //
    }
  };

  // 1c. Fetch Blocked Users
  const fetchBlockedUsers = async () => {
    setLoadingBlocked(true);
    try {
      const res = await fetch('/api/friends/blocked');
      const data = await res.json();
      if (res.ok && data.success) {
        setBlockedUsers(data.blockedUsers || []);
      }
    } catch {
      //
    } finally {
      setLoadingBlocked(false);
    }
  };

  useEffect(() => {
    fetchConversations();
    fetchFriends();
    const interval = setInterval(() => {
      fetchConversations();
      fetchFriends();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Filter conversations by search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredConversations(conversations);
      return;
    }
    const q = searchQuery.toLowerCase();
    const filtered = conversations.filter(
      (c) =>
        c.partner?.displayName?.toLowerCase().includes(q) ||
        c.partner?.universityName?.toLowerCase().includes(q) ||
        c.partner?.course?.toLowerCase().includes(q)
    );
    setFilteredConversations(filtered);
  }, [conversations, searchQuery]);

  // Auto-select first conversation on desktop if none selected
  useEffect(() => {
    if (!selectedConvId && conversations.length > 0 && typeof window !== 'undefined' && window.innerWidth >= 768) {
      handleSelectConversation(conversations[0].id);
    }
  }, [conversations, selectedConvId]);

  // 2. Fetch Active Conversation Messages
  const fetchMessages = async (convId: string) => {
    try {
      const res = await fetch(`/api/chat/${convId}/messages`);
      const data = await res.json();
      if (res.ok && data.success) {
        setMessages(data.messages || []);
        if (data.conversation?.partner) {
          setChatPartner(data.conversation.partner);
        }
      }
    } catch {
      //
    }
  };

  const handleSelectConversation = (convId: string) => {
    setSelectedConvId(convId);
    setLoadingChat(true);
    setActiveMenuOpen(false);

    const conv = conversations.find((c) => c.id === convId);
    if (conv?.partner) {
      setChatPartner(conv.partner);
    }

    fetchMessages(convId).finally(() => setLoadingChat(false));
  };

  // Poll messages for active chat room every 2.5s
  useEffect(() => {
    if (!selectedConvId) return;

    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(() => {
      fetchMessages(selectedConvId);
    }, 2500);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [selectedConvId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 3. Send Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConvId || !inputValue.trim() || sending) return;

    const content = inputValue.trim();
    setInputValue('');
    setSending(true);

    try {
      const res = await fetch(`/api/chat/${selectedConvId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setMessages((prev) => [...prev, data.message]);
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConvId
              ? {
                  ...c,
                  lastMessage: { content, createdAt: new Date().toISOString(), isMine: true },
                }
              : c
          )
        );
      }
    } catch {
      // Error
    } finally {
      setSending(false);
    }
  };

  // 4. Friend Management Actions
  const handleAcceptFriendRequest = async (requestId: string) => {
    setFriendActionLoadingId(requestId);
    setFriendActionError(null);
    try {
      const res = await fetch('/api/friends/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action: 'ACCEPT' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to accept friend request');
      }

      setFriendsData((prev) => ({
        ...prev,
        incoming: prev.incoming.filter((r) => r.id !== requestId),
      }));

      await Promise.all([fetchFriends(), fetchConversations()]);

      if (data.conversationId) {
        handleSelectConversation(data.conversationId);
      }
      showToast('Friend request accepted!');
    } catch (err: any) {
      setFriendActionError(err.message || 'Error accepting friend request');
      fetchFriends();
    } finally {
      setFriendActionLoadingId(null);
    }
  };

  const handleDeclineFriendRequest = async (requestId: string) => {
    setFriendActionLoadingId(requestId);
    setFriendActionError(null);
    try {
      const res = await fetch('/api/friends/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action: 'DECLINE' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to decline friend request');
      }

      setFriendsData((prev) => ({
        ...prev,
        incoming: prev.incoming.filter((r) => r.id !== requestId),
      }));

      await fetchFriends();
      showToast('Friend request declined.');
    } catch (err: any) {
      setFriendActionError(err.message || 'Error declining friend request');
      fetchFriends();
    } finally {
      setFriendActionLoadingId(null);
    }
  };

  const handleSendFriendRequest = async () => {
    if (!chatPartner?.id || addingFriend) return;
    setAddingFriend(true);
    try {
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: chatPartner.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to send friend request');
      }

      if (data.status === 'ACCEPTED') {
        setChatPartner((prev: any) => ({ ...prev, isFriend: true }));
        showToast('You are now connected as friends!');
      } else {
        showToast('Friend request sent to ' + chatPartner.displayName);
      }
      fetchFriends();
    } catch (err: any) {
      showToast(err.message);
    } finally {
      setAddingFriend(false);
    }
  };

  const handleRemoveFriend = async () => {
    if (!chatPartner?.id) return;
    if (
      !confirm(
        `Are you sure you want to remove ${chatPartner.displayName} from your friends list? Your chat history will be kept.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch('/api/friends/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: chatPartner.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to remove friend');
      }

      setChatPartner((prev: any) => ({ ...prev, isFriend: false }));
      setActiveMenuOpen(false);
      showToast(`${chatPartner.displayName} removed from friends.`);
      fetchFriends();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleBlockUser = async () => {
    if (!chatPartner?.id) return;
    if (
      !confirm(
        `Are you sure you want to block ${chatPartner.displayName}? They will not be able to send messages, call, or match with you again.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch('/api/friends/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: chatPartner.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to block user');
      }

      setActiveMenuOpen(false);
      setSelectedConvId(null);
      setChatPartner(null);
      showToast(`${chatPartner.displayName} blocked.`);
      await Promise.all([fetchConversations(), fetchFriends()]);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteChat = async () => {
    if (!selectedConvId) return;
    if (
      !confirm(
        'Are you sure you want to delete this chat? The conversation will be removed from your list, but your friend can still message you.'
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/chat/${selectedConvId}/delete`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to delete chat');
      }

      setActiveMenuOpen(false);
      setSelectedConvId(null);
      setChatPartner(null);
      showToast('Conversation deleted.');
      fetchConversations();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUnblockUser = async (userId: string) => {
    setUnblockingId(userId);
    try {
      const res = await fetch('/api/friends/unblock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: userId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to unblock user');
      }

      setBlockedUsers((prev) => prev.filter((b) => b.userId !== userId));
      showToast('Student unblocked successfully.');
      fetchConversations();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUnblockingId(null);
    }
  };

  const formatMessageTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return format(d, 'h:mm a');
    } catch {
      return '';
    }
  };

  const formatConversationTime = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isToday(d)) return format(d, 'h:mm a');
      if (isYesterday(d)) return 'Yesterday';
      return format(d, 'MMM d');
    } catch {
      return '';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-4 sm:py-6 w-full flex-1 flex flex-col h-[calc(100vh-4.5rem)]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-brand-purple/90 backdrop-blur border border-white/20 text-white text-xs font-semibold shadow-2xl animate-fade-in flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-electric-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="glass-card rounded-3xl border border-navy-750 shadow-2xl flex-1 flex overflow-hidden">
        {/* Left Column: Conversation Sidebar List */}
        <aside
          aria-label="Conversations"
          className={`w-full md:w-80 lg:w-96 border-r border-navy-750 flex flex-col bg-navy-900/60 ${
            selectedConvId ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Sidebar Header */}
          <div className="p-4 border-b border-navy-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-electric-400" />
                <h1 className="text-base font-bold text-white">Messages</h1>
                <span className="px-2 py-0.5 rounded-full bg-navy-800 text-[11px] font-mono text-slate-300">
                  {conversations.length}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    fetchBlockedUsers();
                    setShowBlockedModal(true);
                  }}
                  className="p-1.5 rounded-xl bg-navy-850 hover:bg-navy-800 text-slate-400 hover:text-white text-xs border border-navy-750 transition-colors"
                  title="Manage Blocked Users"
                >
                  <Ban className="w-3.5 h-3.5" />
                </button>

                <Link
                  href="/match"
                  className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-brand-purple to-electric-500 hover:opacity-90 text-white text-xs font-semibold flex items-center gap-1 shadow-sm"
                  title="Find a new student match"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Match</span>
                </Link>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by student name, university..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-navy-950/80 border border-navy-750 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-brand-purple transition-colors"
              />
            </div>
          </div>

          {/* Pending Friend Requests Section */}
          {(friendsData.incoming.length > 0 || friendActionError) && (
            <div className="p-3 bg-gradient-to-r from-brand-purple/20 via-navy-900 to-electric-500/15 border-b border-navy-750 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-white">
                <span className="flex items-center gap-1.5 text-electric-300">
                  <UserPlus className="w-3.5 h-3.5 text-electric-400" />
                  <span>Friend Requests</span>
                </span>
                {friendsData.incoming.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-electric-500 text-[10px] text-white font-mono font-bold animate-pulse">
                    {friendsData.incoming.length}
                  </span>
                )}
              </div>

              {friendActionError && (
                <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] flex items-center justify-between gap-1.5 animate-fade-in">
                  <span>{friendActionError}</span>
                  <button onClick={() => setFriendActionError(null)} className="p-0.5 hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {friendsData.incoming.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {friendsData.incoming.map((req) => {
                    const student = req.sender || req.fromUser || {};
                    return (
                      <div
                        key={req.id}
                        className="p-2.5 rounded-xl bg-navy-950/90 border border-navy-750 flex items-center justify-between gap-2 shadow-sm"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {student.avatarUrl ? (
                            <img
                              src={student.avatarUrl}
                              alt={student.displayName || 'Student'}
                              className="w-8 h-8 rounded-full object-cover border border-navy-700 shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-purple to-electric-500 flex items-center justify-center text-white font-bold text-xs shrink-0">
                              {student.displayName?.[0] || 'S'}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate flex items-center gap-1">
                              <span>{student.displayName || 'Student'}</span>
                              {student.isVerified && (
                                <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                              )}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">
                              {student.universityName || student.course || 'Campus Peer'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleAcceptFriendRequest(req.id)}
                            disabled={friendActionLoadingId === req.id}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1 shadow disabled:opacity-50 transition-colors cursor-pointer"
                            title="Accept and start chatting"
                          >
                            {friendActionLoadingId === req.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <>
                                <Check className="w-3 h-3" />
                                <span>Accept</span>
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleDeclineFriendRequest(req.id)}
                            disabled={friendActionLoadingId === req.id}
                            className="p-1 rounded-lg bg-navy-800 hover:bg-rose-950/50 hover:text-rose-400 text-slate-400 text-xs border border-navy-700 disabled:opacity-50 transition-colors cursor-pointer"
                            title="Decline request"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Conversation List Scroll Area */}
          <div className="flex-1 overflow-y-auto divide-y divide-navy-800/40">
            {loadingList ? (
              <div className="py-16 text-center space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-brand-purple mx-auto" />
                <p className="text-xs text-slate-400">Loading your conversations...</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="py-16 px-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-navy-800/60 text-slate-400 flex items-center justify-center mx-auto">
                  <Compass className="w-6 h-6" />
                </div>
                <h2 className="text-sm font-bold text-white">No Conversations Found</h2>
                <p className="text-xs text-slate-400">
                  {searchQuery
                    ? 'No match found for your search query.'
                    : 'Connect with peers from LPU and other universities to start chatting.'}
                </p>
                <Link
                  href="/match"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-purple hover:bg-brand-purple/90 text-white text-xs font-semibold"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Find a Match</span>
                </Link>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = conv.id === selectedConvId;
                const partner = conv.partner;
                return (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv.id)}
                    className={`w-full p-3.5 sm:p-4 text-left flex items-start gap-3 transition-colors ${
                      isSelected
                        ? 'bg-electric-500/15 border-l-4 border-electric-500'
                        : 'hover:bg-navy-850/60'
                    }`}
                  >
                    <div className="relative shrink-0">
                      {partner?.avatarUrl ? (
                        <img
                          src={partner.avatarUrl}
                          alt={partner.displayName}
                          className="w-11 h-11 rounded-full object-cover border border-navy-700"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-brand-purple to-electric-500 flex items-center justify-center text-white font-bold text-sm shadow">
                          {partner?.displayName?.[0] || 'S'}
                        </div>
                      )}
                      {partner?.isOnline && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-navy-900" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="text-xs font-bold text-white truncate flex items-center gap-1">
                          <span>{partner?.displayName || 'Student'}</span>
                          {partner?.isVerified && (
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          )}
                          {partner?.isFriend && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 font-semibold">
                              Friend
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
                          {formatConversationTime(conv.lastMessage?.createdAt || conv.startedAt)}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-400 truncate mb-1">
                        {partner?.universityName || 'Verified University Student'}
                      </p>

                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] text-slate-300 truncate">
                          {conv.lastMessage?.content ? (
                            <span>
                              {conv.lastMessage.isMine && (
                                <span className="text-slate-400 font-medium">You: </span>
                              )}
                              {conv.lastMessage.content}
                            </span>
                          ) : (
                            <span className="italic text-slate-500">Connected. Say hello!</span>
                          )}
                        </p>

                        {conv.unreadCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-electric-500 text-white font-bold text-[9px] shrink-0">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Column: Active Conversation Messages */}
        <section
          aria-label="Active Conversation"
          className={`flex-1 flex flex-col bg-navy-950/70 ${
            selectedConvId ? 'flex' : 'hidden md:flex'
          }`}
        >
          {selectedConvId && chatPartner ? (
            <>
              {/* Active Chat Header */}
              <div className="p-3.5 sm:p-4 border-b border-navy-800 bg-navy-900/60 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedConvId(null)}
                    className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-navy-800"
                    title="Back to conversation list"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  <div className="relative">
                    {chatPartner.avatarUrl ? (
                      <img
                        src={chatPartner.avatarUrl}
                        alt={chatPartner.displayName}
                        className="w-10 h-10 rounded-full object-cover border border-navy-700"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-purple to-electric-500 flex items-center justify-center text-white font-bold text-sm">
                        {chatPartner.displayName?.[0] || 'S'}
                      </div>
                    )}
                    {chatPartner.isOnline && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-navy-900" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <h2 className="text-sm font-bold text-white">{chatPartner.displayName}</h2>
                      {chatPartner.isVerified && (
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      )}
                      {chatPartner.isFriend ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                          ✓ Friends
                        </span>
                      ) : (
                        <button
                          onClick={handleSendFriendRequest}
                          disabled={addingFriend}
                          className="px-2 py-0.5 rounded-full bg-electric-500/15 border border-electric-500/30 text-electric-300 hover:bg-electric-500 hover:text-white text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <UserPlus className="w-3 h-3" />
                          <span>{addingFriend ? 'Sending...' : 'Add Friend'}</span>
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 flex items-center gap-1">
                      <GraduationCap className="w-3 h-3 text-brand-purple" />
                      <span>{chatPartner.universityName}</span>
                      {chatPartner.course && <span>• {chatPartner.course}</span>}
                    </p>
                  </div>
                </div>

                {/* Right Action Icons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setIsCallInitiator(true);
                      setIsVideoModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-brand-purple to-electric-500 hover:opacity-90 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-brand-purple/20 transition-all"
                    title="Start Live Video Call"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Video Call</span>
                  </button>

                  <Link
                    href={`/chat/${selectedConvId}?match=true`}
                    className="px-2.5 py-1.5 rounded-xl border border-navy-750 hover:bg-navy-850 text-slate-300 text-xs transition-colors"
                    title="Open Omegle room view"
                  >
                    Omegle Room
                  </Link>

                  {/* Three-dot dropdown menu */}
                  <div className="relative">
                    <button
                      onClick={() => setActiveMenuOpen(!activeMenuOpen)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-navy-850 transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {activeMenuOpen && (
                      <div className="absolute right-0 top-full mt-1 w-44 rounded-2xl bg-navy-900 border border-navy-750 shadow-2xl py-1.5 z-40 text-xs">
                        {chatPartner.isFriend && (
                          <button
                            onClick={handleRemoveFriend}
                            className="w-full px-3.5 py-2 text-left text-slate-300 hover:bg-navy-800 hover:text-white flex items-center gap-2"
                          >
                            <UserMinus className="w-3.5 h-3.5 text-amber-400" />
                            <span>Remove Friend</span>
                          </button>
                        )}
                        <button
                          onClick={handleDeleteChat}
                          className="w-full px-3.5 py-2 text-left text-slate-300 hover:bg-navy-800 hover:text-white flex items-center gap-2"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>Delete Chat</span>
                        </button>
                        <button
                          onClick={handleBlockUser}
                          className="w-full px-3.5 py-2 text-left text-rose-400 hover:bg-rose-950/40 flex items-center gap-2"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Block User</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Messages Body */}
              <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5">
                <div className="p-2.5 rounded-xl bg-navy-900/80 border border-navy-800 text-center text-[11px] text-slate-400 max-w-md mx-auto">
                  🔒 Private student conversation. Never share financial passwords or UPI PINs.
                </div>

                {loadingChat ? (
                  <div className="py-20 text-center space-y-2">
                    <Loader2 className="w-6 h-6 animate-spin text-brand-purple mx-auto" />
                    <p className="text-xs text-slate-400">Loading message history...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="py-20 text-center text-slate-500 text-xs">
                    <p>Start the conversation! Say hello to {chatPartner.displayName}.</p>
                  </div>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex flex-col ${m.isMine ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[85%] sm:max-w-md px-4 py-2.5 rounded-2xl text-xs leading-relaxed break-words shadow-sm ${
                          m.isMine
                            ? 'bg-gradient-to-r from-brand-purple to-electric-500 text-white rounded-br-none'
                            : 'bg-navy-850 border border-navy-750 text-slate-200 rounded-bl-none'
                        }`}
                      >
                        <p>{m.content}</p>
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400 px-1 font-mono">
                        <span>{formatMessageTime(m.createdAt)}</span>
                        {m.isMine && <CheckCheck className="w-3 h-3 text-electric-400" />}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Chat Input Bar */}
              <form
                onSubmit={handleSendMessage}
                className="p-3 sm:p-4 border-t border-navy-800 bg-navy-900/60 flex items-center gap-2"
              >
                <input
                  type="text"
                  placeholder={`Message ${chatPartner.displayName}...`}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-navy-950 border border-navy-750 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-electric-500 transition-colors"
                />
                <button
                  type="submit"
                  disabled={sending || !inputValue.trim()}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-purple to-electric-500 hover:opacity-90 disabled:opacity-40 text-white font-semibold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-brand-purple/20 cursor-pointer"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Send</span>
                      <Send className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3 text-slate-400">
              <div className="w-16 h-16 rounded-full bg-navy-900 border border-navy-800 flex items-center justify-center text-electric-400 shadow-inner">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h2 className="text-base font-bold text-white">Your CampusConnect Inbox</h2>
              <p className="text-xs max-w-sm">
                Select a conversation from the left to start messaging, or find a new verified university student partner.
              </p>
              <Link
                href="/match"
                className="mt-2 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-purple to-electric-500 text-white text-xs font-bold shadow-lg shadow-brand-purple/20"
              >
                <Sparkles className="w-4 h-4" />
                <span>Find a Match</span>
              </Link>
            </div>
          )}
        </section>
      </div>

      {/* Blocked Users Modal */}
      {showBlockedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-navy-900 border border-navy-750 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-navy-800">
              <div className="flex items-center gap-2">
                <Ban className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-bold text-white">Blocked Students</h3>
              </div>
              <button
                onClick={() => setShowBlockedModal(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2.5">
              {loadingBlocked ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1 text-brand-purple" />
                  <span>Loading blocked accounts...</span>
                </div>
              ) : blockedUsers.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  <p>No blocked users. You have a clean connections list!</p>
                </div>
              ) : (
                blockedUsers.map((b) => (
                  <div
                    key={b.userId}
                    className="p-3 rounded-2xl bg-navy-950 border border-navy-800 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {b.avatarUrl ? (
                        <img
                          src={b.avatarUrl}
                          alt={b.displayName}
                          className="w-8 h-8 rounded-full object-cover border border-navy-700 shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {b.displayName?.[0] || 'S'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{b.displayName}</p>
                        <p className="text-[10px] text-slate-400 truncate">{b.universityName}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleUnblockUser(b.userId)}
                      disabled={unblockingId === b.userId}
                      className="px-3 py-1.5 rounded-xl bg-navy-800 hover:bg-emerald-600 hover:text-white text-slate-300 text-xs font-semibold border border-navy-700 transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
                    >
                      {unblockingId === b.userId ? 'Unblocking...' : 'Unblock'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Embedded Video Call Modal */}
      {isVideoModalOpen && selectedConvId && chatPartner && (
        <VideoCallModal
          conversationId={selectedConvId}
          partner={chatPartner}
          isInitiator={isCallInitiator}
          isOpen={isVideoModalOpen}
          onClose={() => setIsVideoModalOpen(false)}
        />
      )}
    </div>
  );
}
