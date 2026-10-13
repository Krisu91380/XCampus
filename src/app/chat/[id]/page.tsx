'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Send,
  ShieldCheck,
  ShieldAlert,
  GraduationCap,
  Ban,
  Flag,
  XCircle,
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCheck,
} from 'lucide-react';
import { format } from 'date-fns';

export default function ChatRoomPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.id as string;

  const [conversation, setConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modals
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('HARASSMENT');
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchInitialData = async () => {
    try {
      const res = await fetch(`/api/chat/${conversationId}/messages`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to load conversation');
      }
      setConversation(data.conversation);
      setMessages(data.messages);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, [conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Real-Time Server-Sent Events (SSE) Listener
  useEffect(() => {
    if (!conversationId) return;

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`/api/chat/${conversationId}/stream`);

      eventSource.addEventListener('message', (event) => {
        try {
          const newMsg = JSON.parse(event.data);
          setMessages((prev) => {
            // Check if already in list
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        } catch {
          //
        }
      });

      eventSource.addEventListener('conversation_ended', (event) => {
        try {
          const endData = JSON.parse(event.data);
          setConversation((prev: any) => ({ ...prev, status: 'ENDED' }));
          alert(`This conversation has been ended (${endData.reason || 'Closed'}).`);
        } catch {}
      });
    } catch {
      // EventSource failed or unsupported
    }

    // Dual sync: polling fallback every 3 seconds in case SSE stream is buffered
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/chat/${conversationId}/messages`);
        const data = await res.json();
        if (data.success && data.messages) {
          setMessages((prev) => {
            const map = new Map(prev.map((m) => [m.id, m]));
            let changed = false;
            for (const m of data.messages) {
              if (!map.has(m.id)) {
                map.set(m.id, m);
                changed = true;
              }
            }
            return changed ? Array.from(map.values()) : prev;
          });
          if (data.conversation?.status === 'ENDED') {
            setConversation((prev: any) => ({ ...prev, status: 'ENDED' }));
          }
        }
      } catch {}
    }, 3000);

    return () => {
      if (eventSource) eventSource.close();
      clearInterval(pollInterval);
    };
  }, [conversationId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || sending) return;

    const content = inputValue.trim();
    setInputValue('');
    setSending(true);

    try {
      const res = await fetch(`/api/chat/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to send message');
      }

      setMessages((prev) => {
        if (prev.some((m) => m.id === data.message.id)) return prev;
        return [...prev, data.message];
      });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleEndConversation = async () => {
    if (!confirm('Are you sure you want to end this conversation? You will not be charged again.')) {
      return;
    }

    try {
      await fetch(`/api/chat/${conversationId}/end`, { method: 'POST' });
      setConversation((prev: any) => ({ ...prev, status: 'ENDED' }));
      alert('Conversation ended.');
    } catch (err: any) {
      alert('Failed to end conversation');
    }
  };

  const handleBlockPartner = async () => {
    if (!conversation?.partner?.id) return;
    if (
      !confirm(
        `Are you sure you want to block ${conversation.partner.displayName}? They will never be matched with you again.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/chat/${conversationId}/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockedId: conversation.partner.id }),
      });
      const data = await res.json();
      alert(data.message || 'User blocked.');
      router.push('/dashboard');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conversation?.partner?.id) return;
    setSubmittingReport(true);

    try {
      const res = await fetch(`/api/chat/${conversationId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportedUserId: conversation.partner.id,
          reason: reportReason,
          details: reportDetails,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to submit report');
      }

      alert('Report submitted to safety moderation. Thank you for keeping our campus safe.');
      setShowReportModal(false);
      setReportDetails('');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingReport(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-brand-purple" />
        <p className="text-xs">Establishing secure private chat room...</p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-white">Access Denied</h2>
        <p className="text-xs text-slate-400">{errorMessage}</p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-navy-850 border border-navy-700 text-slate-200 text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
      </div>
    );
  }

  const partner = conversation?.partner;
  const isEnded = conversation?.status === 'ENDED';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 h-[calc(100vh-5rem)] flex flex-col">
      {/* 1. Partner Header Bar */}
      <div className="glass-card rounded-2xl p-4 border border-navy-750 flex items-center justify-between mb-4 shadow-lg">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-navy-850"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <div className="relative">
            {partner?.avatarUrl ? (
              <img
                src={partner.avatarUrl}
                alt={partner.displayName}
                className="w-10 h-10 rounded-full object-cover border border-navy-700"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-purple to-electric-500 flex items-center justify-center text-white font-bold text-sm">
                {partner?.displayName?.[0] || 'S'}
              </div>
            )}
            {partner?.isOnline && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-navy-900" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-bold text-white">{partner?.displayName}</h2>
              {partner?.isVerified && (
                <span title="Verified Student">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1">
              <GraduationCap className="w-3 h-3 text-brand-purple" />
              <span>{partner?.universityName}</span>
              {partner?.course && <span>• {partner.course}</span>}
            </p>
          </div>
        </div>

        {/* Action Controls: End, Block, Report */}
        <div className="flex items-center gap-2">
          {!isEnded && (
            <button
              onClick={handleEndConversation}
              className="px-3 py-1.5 rounded-xl border border-navy-700 hover:bg-navy-850 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5 text-slate-400" />
              <span>End Chat</span>
            </button>
          )}

          <button
            onClick={() => setShowReportModal(true)}
            className="p-2 rounded-xl text-slate-400 hover:text-amber-400 hover:bg-navy-850 transition-colors"
            title="Report abuse or inappropriate behavior"
          >
            <Flag className="w-4 h-4" />
          </button>

          <button
            onClick={handleBlockPartner}
            className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-navy-850 transition-colors"
            title="Block this user"
          >
            <Ban className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Messages Scroll Container */}
      <div className="flex-1 overflow-y-auto glass-card rounded-2xl p-4 sm:p-6 border border-navy-750 space-y-4 mb-4">
        {/* Safety Notice Banner */}
        <div className="p-3 rounded-xl bg-navy-900 border border-navy-800 text-center text-[11px] text-slate-400 max-w-lg mx-auto">
          🔒 End-to-end moderated chat session between verified students. Never share sensitive passwords, financial info, or UPI PINs.
        </div>

        {messages.length === 0 ? (
          <div className="py-20 text-center text-slate-500 text-xs">
            <p>Say hello to {partner?.displayName}! This is the beginning of your conversation.</p>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.isMine ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[78%] sm:max-w-[65%] px-4 py-2.5 rounded-2xl text-xs leading-relaxed shadow-sm ${
                  m.isMine
                    ? 'bg-gradient-to-r from-brand-purple to-electric-600 text-white rounded-br-none'
                    : 'bg-navy-850 border border-navy-750 text-slate-200 rounded-bl-none'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 px-1">
                {format(new Date(m.createdAt), 'hh:mm a')}
              </span>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 3. Message Input or Ended Banner */}
      {isEnded ? (
        <div className="p-4 rounded-2xl bg-navy-900 border border-navy-800 text-center text-xs text-slate-400">
          This conversation has ended. You can find another partner or return to your dashboard.
        </div>
      ) : (
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type your message (Max 1000 characters)..."
            maxLength={1000}
            className="flex-1 px-4 py-3 rounded-xl bg-navy-900 border border-navy-750 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-brand-purple transition-colors"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || sending}
            className="px-5 py-3 rounded-xl bg-gradient-to-r from-brand-purple to-electric-500 text-white font-bold text-xs shadow-md shadow-brand-purple/20 hover:opacity-95 disabled:opacity-40 transition-opacity flex items-center gap-1.5"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-navy-900 border border-rose-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <h3 className="font-bold text-sm text-white mb-2 flex items-center gap-2">
              <Flag className="w-4 h-4 text-rose-400" />
              Report Inappropriate Behavior
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Your report will be reviewed by campus moderators. Private chat transcripts are only
              accessed under strict audited security investigations.
            </p>

            <form onSubmit={handleSubmitReport} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Reason</label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-navy-950 border border-navy-700 text-white"
                >
                  <option value="HARASSMENT">Harassment or Abuse</option>
                  <option value="INAPPROPRIATE_CONTENT">Inappropriate Content</option>
                  <option value="UNDERAGE">Suspected Underage Account</option>
                  <option value="SPAM">Commercial Spam or Bot</option>
                  <option value="IMPERSONATION">Impersonation or Fake Student</option>
                  <option value="OTHER">Other Community Rule Violation</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Specific Details *
                </label>
                <textarea
                  required
                  rows={3}
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Describe what occurred (min 10 characters)..."
                  className="w-full px-3 py-2 rounded-xl bg-navy-950 border border-navy-700 text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-navy-700 text-slate-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReport || reportDetails.length < 10}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold disabled:opacity-50"
                >
                  {submittingReport ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
