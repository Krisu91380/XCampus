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
import { ThemeToggle } from '@/components/ThemeProvider';

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

  // Partner Profile Modal & Dropdown Menus
  const [profileModalUser, setProfileModalUser] = useState<any | null>(null);
  const [openItemMenuId, setOpenItemMenuId] = useState<string | null>(null);

  // Active chat state
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [chatPartner, setChatPartner] = useState<any>(null);
  const [activeMenuOpen, setActiveMenuOpen] = useState(false);

  // Video call state
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isCallInitiator, setIsCallInitiator] = useState(false);

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Scroll and layout control refs
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const messagesRef = useRef<any[]>(messages);
  messagesRef.current = messages;

  const isNearBottomRef = useRef(true);
  const isInitialLoadRef = useRef(true);
  const isLoadingOlderRef = useRef(false);

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

  const handleMessagesScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceFromBottom < 140;
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
      const list = data.conversations || [];
      setConversations(list);
      try {
        localStorage.setItem('campusconnect_cached_conversations', JSON.stringify(list));
      } catch {}
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
    try {
      const cached = localStorage.getItem('campusconnect_cached_conversations');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setConversations(parsed);
          setLoadingList(false);
        }
      }
    } catch {}
    fetchConversations();
    fetchFriends();
    const interval = setInterval(() => {
      fetchConversations();
      fetchFriends();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Filter conversations by search query & ensure active chat is visible
  useEffect(() => {
    let baseList = [...conversations];
    if (selectedConvId && chatPartner && !baseList.some((c) => c.id === selectedConvId)) {
      baseList.unshift({
        id: selectedConvId,
        status: 'ACTIVE',
        startedAt: new Date().toISOString(),
        partner: chatPartner,
        lastMessage: messages.length > 0 ? messages[messages.length - 1] : null,
        unreadCount: 0,
      });
    }

    if (!searchQuery.trim()) {
      setFilteredConversations(baseList);
      return;
    }
    const q = searchQuery.toLowerCase();
    const filtered = baseList.filter(
      (c) =>
        c.partner?.displayName?.toLowerCase().includes(q) ||
        c.partner?.universityName?.toLowerCase().includes(q) ||
        c.partner?.course?.toLowerCase().includes(q)
    );
    setFilteredConversations(filtered);
  }, [conversations, searchQuery, selectedConvId, chatPartner, messages]);

  // Auto-select first conversation on desktop if none selected
  useEffect(() => {
    if (!selectedConvId && conversations.length > 0 && typeof window !== 'undefined' && window.innerWidth >= 768) {
      handleSelectConversation(conversations[0].id);
    }
  }, [conversations, selectedConvId]);

  // 2. Fetch Active Conversation Messages (Stale-While-Revalidate)
  const fetchMessages = async (convId: string) => {
    try {
      const res = await fetch(`/api/chat/${convId}/messages?limit=40`);
      const data = await res.json();
      if (res.ok && data.success) {
        setHasMore(Boolean(data.hasMore));
        if (data.conversation?.partner) {
          setChatPartner(data.conversation.partner);
        }

        setMessages((prev) => {
          const serverMap = new Map(data.messages.map((m: any) => [m.id, { ...m, status: 'delivered' }]));
          const pending = prev.filter(
            (m) =>
              (m.status === 'sending' || m.status === 'failed') &&
              !serverMap.has(m.id) &&
              !serverMap.has(m.clientMessageId)
          );
          const merged = [...data.messages, ...pending];

          try {
            localStorage.setItem(
              `campusconnect_cache_conv_${convId}`,
              JSON.stringify({
                conversation: data.conversation,
                messages: data.messages,
              })
            );
          } catch {}

          return merged;
        });
      }
    } catch {
      //
    }
  };

  const handleSelectConversation = (convId: string) => {
    setSelectedConvId(convId);
    setActiveMenuOpen(false);
    isInitialLoadRef.current = true;
    isNearBottomRef.current = true;

    // 1. Instant Cache-First Display (0ms perceived load)
    let hasCache = false;
    try {
      const cached = localStorage.getItem(`campusconnect_cache_conv_${convId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
          setMessages(parsed.messages);
          if (parsed.conversation?.partner) {
            setChatPartner(parsed.conversation.partner);
          }
          hasCache = true;
        }
      }
    } catch {}

    const conv = conversations.find((c) => c.id === convId);
    if (conv?.partner && !hasCache) {
      setChatPartner(conv.partner);
    }

    if (!hasCache) {
      setLoadingChat(true);
      setMessages([]);
    }

    fetchMessages(convId).finally(() => setLoadingChat(false));
  };

  // High-Speed Delta Polling for active chat room (Every 1500ms)
  useEffect(() => {
    if (!selectedConvId) return;

    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(async () => {
      try {
        const msgs = messagesRef.current;
        const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
        const sinceParam = lastMsg?.createdAt
          ? `?since=${encodeURIComponent(lastMsg.createdAt)}`
          : '?limit=40';

        const res = await fetch(`/api/chat/${selectedConvId}/messages${sinceParam}`);
        const data = await res.json();

        if (data.success && Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages((prev) => {
            const map = new Map(prev.map((m) => [m.id, m]));
            const optMap = new Map();
            prev.forEach((m) => {
              if (m.clientMessageId) optMap.set(m.clientMessageId, m.id);
            });

            let changed = false;
            for (const m of data.messages) {
              const matchedOptId = optMap.get(m.clientMessageId) || optMap.get(m.id);
              if (matchedOptId && map.has(matchedOptId)) {
                map.set(matchedOptId, { ...m, status: 'delivered' });
                changed = true;
              } else if (!map.has(m.id)) {
                map.set(m.id, { ...m, status: 'delivered' });
                changed = true;
              }
            }

            if (!changed) return prev;
            const updated = Array.from(map.values());

            try {
              localStorage.setItem(
                `campusconnect_cache_conv_${selectedConvId}`,
                JSON.stringify({
                  conversation: { partner: chatPartner },
                  messages: updated,
                })
              );
            } catch {}

            return updated;
          });

          // Update sidebar snippet
          const latestIncoming = data.messages[data.messages.length - 1];
          setConversations((prev) =>
            prev.map((c) =>
              c.id === selectedConvId
                ? {
                    ...c,
                    lastMessage: {
                      content: latestIncoming.content,
                      createdAt: latestIncoming.createdAt,
                      isMine: false,
                    },
                  }
                : c
            )
          );
        }
      } catch {}
    }, 1500);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [selectedConvId, chatPartner]);

  // Load older messages for active conversation without viewport jump
  const handleLoadOlder = async () => {
    if (loadingOlder || !hasMore || !selectedConvId || messages.length === 0) return;
    const oldest = messages[0];
    setLoadingOlder(true);
    isLoadingOlderRef.current = true;
    const scrollContainer = messagesContainerRef.current;
    const oldScrollHeight = scrollContainer ? scrollContainer.scrollHeight : 0;

    try {
      const res = await fetch(
        `/api/chat/${selectedConvId}/messages?before=${encodeURIComponent(oldest.createdAt)}&limit=30`
      );
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.messages) && data.messages.length > 0) {
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const newOlder = data.messages.filter((m: any) => !existingIds.has(m.id));
          return [...newOlder, ...prev];
        });
        setHasMore(Boolean(data.hasMore));

        // Preserve scroll position perfectly
        requestAnimationFrame(() => {
          if (scrollContainer) {
            const newScrollHeight = scrollContainer.scrollHeight;
            scrollContainer.scrollTop = newScrollHeight - oldScrollHeight;
          }
          setTimeout(() => {
            isLoadingOlderRef.current = false;
          }, 150);
        });
      } else {
        setHasMore(false);
        isLoadingOlderRef.current = false;
      }
    } catch {
      isLoadingOlderRef.current = false;
    } finally {
      setLoadingOlder(false);
    }
  };

  // Smart Auto-Scroll Behavior:
  // Jumps instantly to bottom on initial open, scrolls smoothly only if user was already at bottom,
  // and NEVER forces bottom scroll when user is reading older messages.
  useEffect(() => {
    if (isLoadingOlderRef.current) return;

    if (isInitialLoadRef.current && messages.length > 0) {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
      isInitialLoadRef.current = false;
      isNearBottomRef.current = true;
    } else if (isNearBottomRef.current) {
      scrollToBottom('smooth');
    }
  }, [messages]);

  // 3. Instant Optimistic Message Send
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConvId || !inputValue.trim() || sending) return;

    const content = inputValue.trim();
    const clientMessageId = 'opt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);

    // 1. Instant optimistic append (0ms display delay)
    const optimisticMsg = {
      id: clientMessageId,
      clientMessageId,
      conversationId: selectedConvId,
      senderId: 'me',
      content,
      isRead: false,
      createdAt: new Date().toISOString(),
      isMine: true,
      status: 'sending' as const,
    };

    setSending(true);
    isNearBottomRef.current = true;
    setMessages((prev) => [...prev, optimisticMsg]);
    setInputValue('');
    scrollToBottom('smooth');

    // Update conversation snippet in sidebar instantly
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedConvId
          ? {
              ...c,
              lastMessage: { content, createdAt: optimisticMsg.createdAt, isMine: true },
            }
          : c
      )
    );

    // 2. Background Dispatch to PostgreSQL
    try {
      const res = await fetch(`/api/chat/${selectedConvId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, clientMessageId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to send message');
      }

      setMessages((prev) => {
        const next = prev.map((m) =>
          m.id === clientMessageId || m.clientMessageId === clientMessageId
            ? { ...m, ...data.message, id: data.message.id || clientMessageId, status: 'delivered' }
            : m
        );
        const seen = new Set<string>();
        return next.filter((m) => {
          if (seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        });
      });

      try {
        localStorage.setItem(
          `campusconnect_cache_conv_${selectedConvId}`,
          JSON.stringify({
            conversation: { partner: chatPartner },
            messages: messagesRef.current.map((m) =>
              m.id === clientMessageId ? { ...data.message, status: 'delivered' } : m
            ),
          })
        );
      } catch {}
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === clientMessageId || m.clientMessageId === clientMessageId
            ? { ...m, status: 'failed', errorMessage: err.message }
            : m
        )
      );
    } finally {
      setSending(false);
    }
  };

  // Retry Failed Message
  const handleRetryMessage = async (failedMsg: any) => {
    if (!selectedConvId) return;
    const clientMessageId = failedMsg.clientMessageId || failedMsg.id;
    setMessages((prev) =>
      prev.map((m) => (m.id === failedMsg.id ? { ...m, status: 'sending', errorMessage: undefined } : m))
    );

    try {
      const res = await fetch(`/api/chat/${selectedConvId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: failedMsg.content, clientMessageId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Retry failed');
      }

      setMessages((prev) => {
        const next = prev.map((m) =>
          m.id === failedMsg.id || m.clientMessageId === clientMessageId
            ? { ...m, ...data.message, id: data.message.id || clientMessageId, status: 'delivered' }
            : m
        );
        const seen = new Set<string>();
        return next.filter((m) => {
          if (seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        });
      });
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === failedMsg.id
            ? { ...m, status: 'failed', errorMessage: err.message }
            : m
        )
      );
    }
  };

  // Friend Request Actions
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

      showToast('Friend request accepted!');
      await Promise.all([fetchFriends(), fetchConversations()]);
    } catch (err: any) {
      setFriendActionError(err.message);
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

      showToast('Friend request declined');
      fetchFriends();
    } catch (err: any) {
      setFriendActionError(err.message);
    } finally {
      setFriendActionLoadingId(null);
    }
  };

  const handleSendFriendRequest = async (targetPartner?: any) => {
    const p = targetPartner || chatPartner;
    if (!p?.id || addingFriend) return;
    setAddingFriend(true);
    try {
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: p.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to send friend request');
      }

      if (data.status === 'ACCEPTED') {
        if (chatPartner?.id === p.id) {
          setChatPartner((prev: any) => ({ ...prev, isFriend: true }));
        }
        setConversations((prev) =>
          prev.map((c) =>
            c.partner?.id === p.id ? { ...c, partner: { ...c.partner, isFriend: true } } : c
          )
        );
        showToast('You are now connected as friends!');
      } else {
        showToast('Friend request sent to ' + p.displayName);
      }
      fetchFriends();
      fetchConversations();
    } catch (err: any) {
      showToast(err.message);
    } finally {
      setAddingFriend(false);
      setOpenItemMenuId(null);
    }
  };

  const handleRemoveFriend = async (targetPartner?: any) => {
    const p = targetPartner || chatPartner;
    if (!p?.id) return;
    if (
      !confirm(
        `Are you sure you want to remove ${p.displayName} from your friends list? Your chat history will be kept.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch('/api/friends/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: p.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to remove friend');
      }

      if (chatPartner?.id === p.id) {
        setChatPartner((prev: any) => ({ ...prev, isFriend: false }));
      }
      setConversations((prev) =>
        prev.map((c) =>
          c.partner?.id === p.id ? { ...c, partner: { ...c.partner, isFriend: false } } : c
        )
      );
      setActiveMenuOpen(false);
      setOpenItemMenuId(null);
      showToast(`${p.displayName} removed from friends.`);
      fetchFriends();
      fetchConversations();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleBlockUser = async (targetPartner?: any) => {
    const p = targetPartner || chatPartner;
    if (!p?.id) return;
    if (
      !confirm(
        `Are you sure you want to block ${p.displayName}? They will not be able to send messages, call, or match with you again.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch('/api/friends/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: p.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to block user');
      }

      setActiveMenuOpen(false);
      setOpenItemMenuId(null);
      if (chatPartner?.id === p.id) {
        setSelectedConvId(null);
        setChatPartner(null);
      }
      showToast(`${p.displayName} blocked.`);
      await Promise.all([fetchConversations(), fetchFriends()]);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteChat = async (convId?: string) => {
    const idToDelete = convId || selectedConvId;
    if (!idToDelete) return;
    if (
      !confirm(
        'Are you sure you want to delete this chat? The conversation will be removed from your list, but your friend can still message you.'
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/chat/${idToDelete}/delete`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to delete chat');
      }

      setActiveMenuOpen(false);
      setOpenItemMenuId(null);
      if (selectedConvId === idToDelete) {
        setSelectedConvId(null);
        setChatPartner(null);
      }
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
    <div className="w-full max-w-7xl mx-auto p-0 sm:p-2 md:p-3 flex-1 flex flex-col h-[calc(100dvh-4rem)] max-h-[calc(100dvh-4rem)] overflow-hidden min-h-0">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 md:top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-slate-900/90 dark:bg-brand-purple/90 backdrop-blur border border-white/20 text-white text-xs font-semibold shadow-2xl animate-fade-in flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Messages Shell: Clean White Card in Light Mode, Dark Navy in Dark Mode */}
      <div className="bg-white dark:bg-navy-900 rounded-none sm:rounded-2xl border-0 sm:border border-slate-200 dark:border-navy-800 shadow-sm flex-1 flex overflow-hidden min-h-0">
        {/* Left Column: Conversation Sidebar List */}
        <aside
          aria-label="Conversations"
          className={`w-full md:w-80 lg:w-96 border-r border-slate-200 dark:border-navy-800 flex flex-col bg-slate-50/70 dark:bg-navy-900/60 min-h-0 shrink-0 ${
            selectedConvId ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Sidebar Header */}
          <div className="p-3.5 border-b border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 space-y-3 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-brand-purple" />
                <h1 className="text-base font-bold text-slate-900 dark:text-white">Messages</h1>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-navy-800 text-[11px] font-mono text-slate-600 dark:text-slate-300 font-semibold">
                  {conversations.length}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <ThemeToggle className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 border-slate-200 dark:border-navy-700" />
                <Link
                  href="/match"
                  className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 text-white text-xs font-semibold flex items-center gap-1 shadow-xs"
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
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-100 dark:bg-navy-950 border border-slate-200 dark:border-navy-750 text-slate-900 dark:text-white placeholder-slate-400 text-xs focus:bg-white focus:outline-none focus:border-brand-purple transition-all"
              />
            </div>
          </div>

          {/* Pending Friend Requests Section */}
          {(friendsData.incoming.length > 0 || friendActionError) && (
            <div className="p-3 bg-purple-50/70 dark:bg-navy-950 border-b border-slate-200 dark:border-navy-750 space-y-2 shrink-0">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-white">
                <span className="flex items-center gap-1.5 text-brand-purple dark:text-electric-300">
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Friend Requests</span>
                </span>
                {friendsData.incoming.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-brand-purple text-[10px] text-white font-mono font-bold animate-pulse">
                    {friendsData.incoming.length}
                  </span>
                )}
              </div>

              {friendActionError && (
                <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-[11px] flex items-center justify-between gap-1.5 animate-fade-in">
                  <span>{friendActionError}</span>
                  <button onClick={() => setFriendActionError(null)} className="p-0.5 hover:opacity-80">
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
                        className="p-2.5 rounded-xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-750 flex items-center justify-between gap-2 shadow-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {student.avatarUrl ? (
                            <img
                              src={student.avatarUrl}
                              alt={student.displayName || 'Student'}
                              className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-navy-700 shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-purple to-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                              {student.displayName?.[0] || 'S'}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 dark:text-white truncate flex items-center gap-1">
                              <span>{student.displayName || 'Student'}</span>
                              {student.isVerified && (
                                <ShieldCheck className="w-3 h-3 text-emerald-500 shrink-0" />
                              )}
                            </p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                              {student.universityName || student.course || 'Campus Peer'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleAcceptFriendRequest(req.id)}
                            disabled={friendActionLoadingId === req.id}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1 shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
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
                            className="p-1 rounded-lg bg-slate-100 dark:bg-navy-800 hover:bg-rose-50 hover:text-rose-600 text-slate-500 dark:text-slate-400 text-xs border border-slate-200 dark:border-navy-700 disabled:opacity-50 transition-colors cursor-pointer"
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

          {/* Conversation List Scroll Area (Independently scrollable) */}
          <div className="flex-1 overflow-y-auto overscroll-contain min-h-0 divide-y divide-slate-100 dark:divide-navy-800/40">
            {loadingList ? (
              <div className="py-16 text-center space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-brand-purple mx-auto" />
                <p className="text-xs text-slate-500 dark:text-slate-400">Loading your conversations...</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="py-16 px-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-navy-800/60 text-slate-400 flex items-center justify-center mx-auto">
                  <Compass className="w-6 h-6" />
                </div>
                <h2 className="text-sm font-bold text-slate-800 dark:text-white">No Conversations Found</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {searchQuery
                    ? 'No match found for your search query.'
                    : 'Connect with peers from LPU and other universities to start chatting.'}
                </p>
                <Link
                  href="/match"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-purple hover:bg-brand-purple/90 text-white text-xs font-semibold shadow-xs"
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
                  <div
                    key={conv.id}
                    className={`w-full p-3.5 sm:p-4 text-left flex items-start justify-between gap-2.5 transition-colors group relative ${
                      isSelected
                        ? 'bg-slate-100/90 dark:bg-navy-850/90 border-l-4 border-brand-purple'
                        : 'hover:bg-slate-100/50 dark:hover:bg-navy-850/50'
                    }`}
                  >
                    {/* Clickable Area for Chat Selection */}
                    <div
                      onClick={() => handleSelectConversation(conv.id)}
                      className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer"
                    >
                      <div className="relative shrink-0">
                        {partner?.avatarUrl ? (
                          <img
                            src={partner.avatarUrl}
                            alt={partner.displayName}
                            className="w-11 h-11 rounded-full object-cover border border-slate-200 dark:border-navy-750"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-brand-purple to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-xs">
                            {partner?.displayName?.[0] || 'S'}
                          </div>
                        )}
                        {partner?.isOnline && (
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-navy-900" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate flex items-center gap-1">
                            <span>{partner?.displayName || 'Student'}</span>
                            {partner?.isVerified && (
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            )}
                            {partner?.isFriend && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-200 dark:border-emerald-500/30">
                                Friend
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono shrink-0">
                            {formatConversationTime(conv.lastMessage?.createdAt || conv.startedAt)}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mb-1">
                          {partner?.universityName || 'Verified University Student'}
                        </p>

                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                            {conv.lastMessage?.content ? (
                              <span>
                                {conv.lastMessage.isMine && (
                                  <span className="text-slate-400 font-medium">You: </span>
                                )}
                                {conv.lastMessage.content}
                              </span>
                            ) : (
                              <span className="italic text-slate-400">Connected. Say hello!</span>
                            )}
                          </p>

                          {conv.unreadCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full bg-brand-purple text-white font-bold text-[9px] shrink-0">
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Three-Dot Dropdown Menu for This Conversation Item */}
                    <div className="relative shrink-0 pt-0.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenItemMenuId(openItemMenuId === conv.id ? null : conv.id);
                        }}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-navy-800 transition-colors"
                        title="Chat options"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>

                      {openItemMenuId === conv.id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-full mt-1 w-44 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-750 shadow-xl py-1.5 z-40 text-xs text-slate-700 dark:text-slate-200"
                        >
                          <button
                            onClick={() => {
                              setOpenItemMenuId(null);
                              setProfileModalUser(partner);
                            }}
                            className="w-full px-3.5 py-2 text-left hover:bg-slate-100 dark:hover:bg-navy-800 flex items-center gap-2 cursor-pointer"
                          >
                            <User className="w-3.5 h-3.5 text-brand-purple" />
                            <span>View Profile</span>
                          </button>

                          {partner?.isFriend ? (
                            <button
                              onClick={() => handleRemoveFriend(partner)}
                              className="w-full px-3.5 py-2 text-left hover:bg-slate-100 dark:hover:bg-navy-800 flex items-center gap-2 cursor-pointer text-amber-600 dark:text-amber-400"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                              <span>Remove Friend</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSendFriendRequest(partner)}
                              className="w-full px-3.5 py-2 text-left hover:bg-slate-100 dark:hover:bg-navy-800 flex items-center gap-2 cursor-pointer text-emerald-600 dark:text-emerald-400"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              <span>Add Friend</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleDeleteChat(conv.id)}
                            className="w-full px-3.5 py-2 text-left hover:bg-slate-100 dark:hover:bg-navy-800 flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete Chat</span>
                          </button>

                          <button
                            onClick={() => handleBlockUser(partner)}
                            className="w-full px-3.5 py-2 text-left hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center gap-2 cursor-pointer"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>Block User</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Column: Active Conversation Messages (Instagram DM Clean Experience) */}
        <section
          aria-label="Active Conversation"
          className={`flex-1 flex flex-col bg-white dark:bg-navy-950 min-h-0 overflow-hidden ${
            selectedConvId ? 'flex' : 'hidden md:flex'
          }`}
        >
          {selectedConvId && chatPartner ? (
            <>
              {/* Active Chat Header - Instagram DM Clean Style */}
              <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-navy-800 bg-white/95 dark:bg-navy-900/95 backdrop-blur-md flex items-center justify-between z-10 shrink-0">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <button
                    onClick={() => setSelectedConvId(null)}
                    className="md:hidden p-1.5 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-850 active:scale-95 shrink-0"
                    title="Back to conversation list"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  <div className="relative shrink-0">
                    {chatPartner.avatarUrl ? (
                      <img
                        src={chatPartner.avatarUrl}
                        alt={chatPartner.displayName}
                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border border-slate-200 dark:border-navy-700"
                      />
                    ) : (
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-brand-purple to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-xs">
                        {chatPartner.displayName?.[0] || 'S'}
                      </div>
                    )}
                    {chatPartner.isOnline && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-navy-900" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate max-w-[130px] sm:max-w-xs">
                        {chatPartner.displayName}
                      </h2>
                      {chatPartner.isVerified && (
                        <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 shrink-0" />
                      )}
                      {chatPartner.isFriend ? (
                        <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold shrink-0">
                          ✓ Friends
                        </span>
                      ) : (
                        <button
                          onClick={handleSendFriendRequest}
                          disabled={addingFriend}
                          className="px-2 py-0.5 rounded-full bg-purple-50 hover:bg-brand-purple hover:text-white dark:bg-purple-500/15 border border-purple-200 dark:border-purple-500/30 text-purple-700 dark:text-purple-300 text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                        >
                          <UserPlus className="w-3 h-3" />
                          <span className="hidden sm:inline">{addingFriend ? 'Sending...' : 'Add Friend'}</span>
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate max-w-[130px] sm:max-w-xs">
                      <GraduationCap className="w-3 h-3 text-brand-purple shrink-0" />
                      <span className="truncate">{chatPartner.universityName}</span>
                      {chatPartner.course && <span className="hidden sm:inline truncate">• {chatPartner.course}</span>}
                    </p>
                  </div>
                </div>

                {/* Right Action Icons */}
                <div className="flex items-center gap-2">
                  <ThemeToggle className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 border-slate-200 dark:border-navy-700" />
                  <button
                    onClick={() => {
                      setIsCallInitiator(true);
                      setIsVideoModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                    title="Start Live Video Call"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Video Call</span>
                  </button>

                  {chatPartner.isFriend ? (
                    <Link
                      href={`/chat/${selectedConvId}?room=personal&autoCall=true`}
                      className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-500/20 hover:bg-amber-100 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/40 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all"
                      title="Enter private Monkey Room for video call with friend"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span className="hidden sm:inline">Monkey Room</span>
                    </Link>
                  ) : (
                    <Link
                      href={`/chat/${selectedConvId}?room=match&match=true&autoCall=true`}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-navy-750 hover:bg-slate-100 dark:hover:bg-navy-850 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      title="Open Match Room view"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-brand-purple" />
                      <span className="hidden sm:inline">Match Room</span>
                    </Link>
                  )}

                  {/* Three-dot dropdown menu */}
                  <div className="relative">
                    <button
                      onClick={() => setActiveMenuOpen(!activeMenuOpen)}
                      className="p-1.5 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-850 transition-colors cursor-pointer"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {activeMenuOpen && (
                      <div className="absolute right-0 top-full mt-1 w-44 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-750 shadow-xl py-1.5 z-40 text-xs text-slate-700 dark:text-slate-200">
                        <button
                          onClick={() => {
                            setActiveMenuOpen(false);
                            setProfileModalUser(chatPartner);
                          }}
                          className="w-full px-3.5 py-2 text-left hover:bg-slate-100 dark:hover:bg-navy-800 flex items-center gap-2 cursor-pointer"
                        >
                          <User className="w-3.5 h-3.5 text-brand-purple" />
                          <span>View Profile</span>
                        </button>
                        {chatPartner.isFriend ? (
                          <button
                            onClick={() => handleRemoveFriend()}
                            className="w-full px-3.5 py-2 text-left hover:bg-slate-100 dark:hover:bg-navy-800 text-amber-600 dark:text-amber-400 flex items-center gap-2 cursor-pointer"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                            <span>Remove Friend</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSendFriendRequest()}
                            className="w-full px-3.5 py-2 text-left hover:bg-slate-100 dark:hover:bg-navy-800 text-emerald-600 dark:text-emerald-400 flex items-center gap-2 cursor-pointer"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Add Friend</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteChat()}
                          className="w-full px-3.5 py-2 text-left hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-600 dark:text-slate-400 flex items-center gap-2 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete Chat</span>
                        </button>
                        <button
                          onClick={() => handleBlockUser()}
                          className="w-full px-3.5 py-2 text-left hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center gap-2 cursor-pointer"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Block User</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Messages Body (Independently scrollable message area) */}
              <div
                ref={messagesContainerRef}
                onScroll={handleMessagesScroll}
                className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-3 min-h-0 bg-white dark:bg-navy-950"
              >
                <div className="p-2 sm:p-2.5 rounded-xl bg-slate-50 dark:bg-navy-900/80 border border-slate-200 dark:border-navy-800 text-center text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  🔒 Private student conversation. Never share passwords or payment credentials.
                </div>

                {/* Load older messages button if conversation history has more */}
                {hasMore && (
                  <div className="text-center py-1">
                    <button
                      type="button"
                      onClick={handleLoadOlder}
                      disabled={loadingOlder}
                      className="text-[11px] text-brand-purple hover:underline font-semibold flex items-center justify-center gap-1.5 mx-auto py-1 px-3 rounded-full bg-slate-100 dark:bg-navy-900 border border-slate-200 dark:border-navy-800 transition-colors cursor-pointer"
                    >
                      {loadingOlder ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin text-brand-purple" />
                          <span>Loading older messages...</span>
                        </>
                      ) : (
                        <span>Load older messages</span>
                      )}
                    </button>
                  </div>
                )}

                {loadingChat && messages.length === 0 ? (
                  <div className="py-8 space-y-4 max-w-md mx-auto animate-pulse">
                    <div className="w-48 h-9 rounded-2xl bg-slate-100 dark:bg-navy-850" />
                    <div className="w-64 h-9 rounded-2xl bg-purple-100 dark:bg-brand-purple/20 ml-auto" />
                    <div className="w-52 h-9 rounded-2xl bg-slate-100 dark:bg-navy-850" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="py-20 text-center text-slate-400 text-xs">
                    <p>Start the conversation! Say hello to {chatPartner.displayName}.</p>
                  </div>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex flex-col ${m.isMine ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[85%] sm:max-w-md px-4 py-2.5 text-xs leading-relaxed break-words shadow-xs ${
                          m.isMine
                            ? m.status === 'failed'
                              ? 'bg-rose-600 text-white rounded-2xl rounded-br-sm'
                              : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl rounded-br-sm shadow-sm'
                            : 'bg-slate-100 dark:bg-navy-800 text-slate-900 dark:text-slate-100 rounded-2xl rounded-bl-sm border border-slate-200/60 dark:border-navy-700/60'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-400 dark:text-slate-500 px-1 font-mono">
                        <span>{formatMessageTime(m.createdAt)}</span>
                        {m.isMine && (
                          <>
                            {m.status === 'sending' && (
                              <span title="Sending...">
                                <Loader2 className="w-2.5 h-2.5 animate-spin text-slate-400" />
                              </span>
                            )}
                            {m.status === 'failed' && (
                              <div className="flex items-center gap-1 text-rose-500">
                                <AlertCircle className="w-3 h-3 text-rose-500" />
                                <button
                                  type="button"
                                  onClick={() => handleRetryMessage(m)}
                                  className="text-[10px] text-rose-500 underline font-sans font-semibold hover:opacity-80 cursor-pointer"
                                >
                                  Retry
                                </button>
                              </div>
                            )}
                            {(!m.status || m.status === 'delivered') && (
                              <span title="Delivered & Saved">
                                <CheckCheck className="w-3.5 h-3.5 text-brand-purple dark:text-electric-400" />
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Chat Input Bar - Instagram DM Style Fixed at Bottom */}
              <form
                onSubmit={handleSendMessage}
                className="p-3 sm:p-4 border-t border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 flex items-center gap-2 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
              >
                <input
                  type="text"
                  placeholder={`Message ${chatPartner.displayName}...`}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-full bg-slate-100 dark:bg-navy-950 border border-slate-200 dark:border-navy-750 text-slate-900 dark:text-white placeholder-slate-400 text-xs focus:bg-white focus:outline-none focus:border-brand-purple transition-all shadow-inner"
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim()}
                  className="p-2.5 sm:px-5 sm:py-2.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 disabled:opacity-40 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer shrink-0"
                >
                  <Send className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                  <span className="hidden sm:inline">Send</span>
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3 text-slate-500 dark:text-slate-400">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-navy-900 border border-slate-200 dark:border-navy-800 flex items-center justify-center text-brand-purple shadow-inner">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Your CC Inbox</h2>
              <p className="text-xs max-w-sm">
                Select a conversation from the left to start messaging, or find a new verified university student partner.
              </p>
              <Link
                href="/match"
                className="mt-2 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold shadow-md shadow-purple-500/20"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-navy-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-750 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-navy-800">
              <div className="flex items-center gap-2">
                <Ban className="w-4 h-4 text-rose-500" />
                <h3 className="text-sm font-bold">Blocked Students</h3>
              </div>
              <button
                onClick={() => setShowBlockedModal(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white"
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
                <div className="py-8 text-center text-slate-400 text-xs">
                  <p>No blocked users. You have a clean connections list!</p>
                </div>
              ) : (
                blockedUsers.map((b) => (
                  <div
                    key={b.userId}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {b.avatarUrl ? (
                        <img
                          src={b.avatarUrl}
                          alt={b.displayName}
                          className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-navy-700 shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-white text-xs font-bold shrink-0">
                          {b.displayName?.[0] || 'S'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{b.displayName}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{b.universityName || 'Student'}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleUnblockUser(b.userId)}
                      disabled={unblockingId === b.userId}
                      className="px-3 py-1 rounded-lg bg-slate-200 dark:bg-navy-800 hover:bg-slate-300 dark:hover:bg-navy-700 text-slate-800 dark:text-slate-200 text-xs font-semibold"
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

      {/* Partner Profile Modal */}
      {profileModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-navy-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center text-slate-900 dark:text-white relative">
            <button
              onClick={() => setProfileModalUser(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-20 h-20 rounded-full mx-auto overflow-hidden border-2 border-brand-purple">
              {profileModalUser.avatarUrl ? (
                <img
                  src={profileModalUser.avatarUrl}
                  alt={profileModalUser.displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-brand-purple to-indigo-600 flex items-center justify-center text-white text-2xl font-bold">
                  {profileModalUser.displayName?.[0] || 'S'}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center justify-center gap-1.5">
                <span>{profileModalUser.displayName}</span>
                {profileModalUser.isVerified && (
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                )}
              </h3>
              <p className="text-xs text-brand-purple font-medium mt-0.5">{profileModalUser.universityName}</p>
              {profileModalUser.course && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{profileModalUser.course}</p>
              )}
            </div>

            {profileModalUser.bio && (
              <p className="text-xs text-slate-600 dark:text-slate-300 italic px-2">
                &quot;{profileModalUser.bio}&quot;
              </p>
            )}

            <div className="pt-2 flex items-center justify-center gap-2">
              <button
                onClick={() => setProfileModalUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Call Modal */}
      {isVideoModalOpen && chatPartner && (
        <VideoCallModal
          isOpen={isVideoModalOpen}
          onClose={() => setIsVideoModalOpen(false)}
          conversationId={selectedConvId || ''}
          partner={chatPartner}
          isInitiator={isCallInitiator}
        />
      )}
    </div>
  );
}
