'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  X,
  Minus,
  Maximize2,
  Send,
  Loader2,
  ShieldCheck,
  CheckCheck,
  ChevronUp,
} from 'lucide-react';
import { useChat, MinimizedChatData } from '@/context/ChatContext';

function SingleFloatingChatWindow({
  chat,
  onClose,
  onMinimize,
}: {
  chat: MinimizedChatData;
  onClose: () => void;
  onMinimize: () => void;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputValue, setInputValue] = useState(chat.draft || '');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const { setChatDraft } = useChat();

  // Load and poll recent messages
  useEffect(() => {
    let isMounted = true;
    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/chat/${chat.id}/messages`);
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && data.success && Array.isArray(data.messages)) {
          setMessages(data.messages);
        }
      } catch {} finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 3500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [chat.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || sending) return;

    const content = inputValue.trim();
    const clientMessageId = 'opt-float-' + Date.now();

    // Optimistic UI update
    const optMsg = {
      id: clientMessageId,
      content,
      isMine: true,
      createdAt: new Date().toISOString(),
      status: 'sending',
    };

    setMessages((prev) => [...prev, optMsg]);
    setInputValue('');
    setChatDraft(chat.id, '');
    setSending(true);

    try {
      const res = await fetch(`/api/chat/${chat.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, clientMessageId }),
      });
      const data = await res.json();
      if (data.success && data.message) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === clientMessageId ? { ...data.message, isMine: true } : m
          )
        );
      }
    } catch {} finally {
      setSending(false);
    }
  };

  const handleInputChange = (val: string) => {
    setInputValue(val);
    setChatDraft(chat.id, val);
  };

  return (
    <div className="w-80 sm:w-84 h-96 sm:h-[400px] bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-750 rounded-t-2xl shadow-2xl flex flex-col overflow-hidden pointer-events-auto">
      {/* Header */}
      <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-navy-950 border-b border-slate-200 dark:border-navy-750 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative shrink-0">
            {chat.partner.avatarUrl ? (
              <img
                src={chat.partner.avatarUrl}
                alt={chat.partner.displayName}
                className="w-7 h-7 rounded-full object-cover border border-slate-200 dark:border-navy-700"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-navy-800 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-xs">
                {chat.partner.displayName[0] || 'S'}
              </div>
            )}
            {chat.partner.isOnline && (
              <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 border border-white dark:border-navy-900" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-900 dark:text-white truncate flex items-center gap-1">
              <span>{chat.partner.displayName}</span>
              {chat.partner.isVerified && (
                <ShieldCheck className="w-3 h-3 text-emerald-500 shrink-0" />
              )}
            </p>
            <p className="text-[10px] text-slate-400 truncate">
              {chat.partner.universityName || 'Campus Student'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Open full chat in /messages */}
          <button
            onClick={() => {
              router.push(`/messages?conv=${chat.id}`);
              onClose();
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-navy-800 transition-colors"
            title="Open in full Messages"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          {/* Minimize into bottom bar pill */}
          <button
            onClick={onMinimize}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-navy-800 transition-colors"
            title="Minimize"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-200/60 dark:hover:bg-navy-800 transition-colors"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs bg-slate-50/50 dark:bg-navy-900">
        {loading ? (
          <div className="py-12 text-center text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1 text-brand-purple" />
            <span className="text-[10px]">Loading messages...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            <p>No messages yet.</p>
            <p className="text-[10px] text-slate-500 mt-1">Send a message below!</p>
          </div>
        ) : (
          messages.map((m: any, idx: number) => {
            const isMine = m.isMine;
            return (
              <div
                key={m.id || idx}
                className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`px-3 py-1.5 rounded-2xl max-w-[85%] text-xs leading-relaxed break-words ${
                    isMine
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-br-xs'
                      : 'bg-slate-200/80 dark:bg-navy-800 text-slate-900 dark:text-slate-100 rounded-bl-xs'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <form
        onSubmit={handleSend}
        className="p-2 bg-white dark:bg-navy-950 border-t border-slate-200 dark:border-navy-750 flex items-center gap-1.5 shrink-0"
      >
        <input
          type="text"
          placeholder="Message..."
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          className="flex-1 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-navy-900 border border-slate-200 dark:border-navy-750 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-purple"
        />
        <button
          type="submit"
          disabled={!inputValue.trim() || sending}
          className="p-1.5 rounded-full bg-brand-purple hover:bg-brand-purple/90 text-white disabled:opacity-40 transition-opacity cursor-pointer shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}

export default function GlobalFloatingChat() {
  const pathname = usePathname();
  const { minimizedChats, toggleFloatingChat, closeMinimizedChat } = useChat();

  // Hide on mobile (mobile uses full screen views without floating clutter)
  if (minimizedChats.length === 0) return null;

  return (
    <div className="hidden md:flex fixed bottom-0 right-6 z-40 gap-3 items-end pointer-events-none pb-[env(safe-area-inset-bottom)]">
      {minimizedChats.map((chat) => {
        // If user is currently on the exact /messages page with this conversation actively selected, don't duplicate
        if (pathname === '/messages' && window.location.search.includes(chat.id)) {
          return null;
        }

        if (chat.isOpen) {
          return (
            <SingleFloatingChatWindow
              key={chat.id}
              chat={chat}
              onClose={() => closeMinimizedChat(chat.id)}
              onMinimize={() => toggleFloatingChat(chat.id)}
            />
          );
        }

        // Collapsed Floating Bar / Pill
        return (
          <div
            key={chat.id}
            onClick={() => toggleFloatingChat(chat.id)}
            className="h-10 px-3 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-750 rounded-t-xl shadow-xl flex items-center gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-navy-850 transition-all pointer-events-auto select-none"
            title={`Restore chat with ${chat.partner.displayName}`}
          >
            <div className="relative shrink-0">
              {chat.partner.avatarUrl ? (
                <img
                  src={chat.partner.avatarUrl}
                  alt={chat.partner.displayName}
                  className="w-6 h-6 rounded-full object-cover border border-slate-200 dark:border-navy-700"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-navy-800 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-[10px]">
                  {chat.partner.displayName[0] || 'S'}
                </div>
              )}
              {chat.partner.isOnline && (
                <span className="absolute bottom-0 right-0 w-1.5 h-1.5 rounded-full bg-emerald-500 border border-white dark:border-navy-900" />
              )}
            </div>

            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 max-w-[100px] truncate">
              {chat.partner.displayName}
            </span>

            {chat.unreadCount && chat.unreadCount > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full bg-brand-purple text-white text-[9px] font-bold">
                {chat.unreadCount}
              </span>
            ) : null}

            <ChevronUp className="w-3.5 h-3.5 text-slate-400 ml-1" />

            <button
              onClick={(e) => {
                e.stopPropagation();
                closeMinimizedChat(chat.id);
              }}
              className="p-0.5 rounded text-slate-400 hover:text-rose-500 transition-colors ml-0.5"
              title="Close"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
