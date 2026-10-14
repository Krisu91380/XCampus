'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  Send,
  ShieldCheck,
  GraduationCap,
  Ban,
  Flag,
  Trash2,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  UserPlus,
  Check,
  FastForward,
  Sparkles,
  Maximize2,
  Minimize2,
  CheckCheck,
  MoreVertical,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { ThemeToggle } from '@/components/ThemeProvider';

function ChatRoomContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomParam = searchParams.get('room');
  const isMatchMode = searchParams.get('match') === 'true' || searchParams.get('autoCall') === 'true';
  const conversationId = params?.id ? decodeURIComponent(params.id as string) : '';
  const callSessionIdRef = useRef<string>('');

  // Auth & Conversation State (Synchronous local cache for instant opening)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<any>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const cached = localStorage.getItem(`campusconnect_cache_conv_${conversationId}`);
      if (cached) return JSON.parse(cached).conversation || null;
    } catch {}
    return null;
  });
  const [messages, setMessages] = useState<any[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const cached = localStorage.getItem(`campusconnect_cache_conv_${conversationId}`);
      if (cached) return JSON.parse(cached).messages || [];
    } catch {}
    return [];
  });
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const cached = localStorage.getItem(`campusconnect_cache_conv_${conversationId}`);
      return !cached;
    } catch {
      return true;
    }
  });
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  // Message references for smooth delta sync & scroll
  const messagesRef = useRef<any[]>(messages);
  messagesRef.current = messages;
  const isFirstLoadRef = useRef(true);

  // Video / Omegle Room State
  const [isVideoActive, setIsVideoActive] = useState(isMatchMode);
  const [callState, setCallState] = useState<
    'IDLE' | 'STARTING' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'ENDED' | 'PARTNER_SKIPPED'
  >('IDLE');
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [callDurationSeconds, setCallDurationSeconds] = useState(0);
  const [videoError, setVideoError] = useState<string | null>(null);

  // Friend State
  const [isFriend, setIsFriend] = useState(() => Boolean(conversation?.partner?.isFriend));
  const isMoneyRoom = isFriend || roomParam === 'money';
  const [friendRequestPending, setFriendRequestPending] = useState(false);
  const [addingFriend, setAddingFriend] = useState(false);

  // Modals & Menus
  const [showMenu, setShowMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('HARASSMENT');
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Refs for WebRTC & Chat
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pollSignalingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSignalTimeRef = useRef<number>(Date.now() - 60000);
  const seenSignalsRef = useRef<Set<string>>(new Set());
  const iceCandidatesQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const isEndingCallRef = useRef(false);
  const isNearBottomRef = useRef(true);
  const isLoadingOlderRef = useRef(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
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

  // 1. Initial Data Fetch (Parallel, Stale-While-Revalidate)
  useEffect(() => {
    let isMounted = true;
    const fetchInitial = async () => {
      try {
        const [meRes, msgRes] = await Promise.all([
          fetch('/api/auth/me'),
          fetch(`/api/chat/${conversationId}/messages?limit=40`),
        ]);

        const meData = await meRes.json();
        const msgData = await msgRes.json();

        if (!isMounted) return;

        if (meData.authenticated && meData.user) {
          setCurrentUserId(meData.user.id);
        }

        if (!msgRes.ok || !msgData.success) {
          throw new Error(msgData.message || 'Failed to load conversation');
        }

        setConversation(msgData.conversation);
        setHasMore(Boolean(msgData.hasMore));

        // Reconcile server messages with any optimistic messages
        setMessages((prev) => {
          const serverMap = new Map(msgData.messages.map((m: any) => [m.id, { ...m, status: 'delivered' }]));
          const pending = prev.filter(
            (m) =>
              (m.status === 'sending' || m.status === 'failed') &&
              !serverMap.has(m.id) &&
              !serverMap.has(m.clientMessageId)
          );
          const merged = [...msgData.messages, ...pending];

          try {
            localStorage.setItem(
              `campusconnect_cache_conv_${conversationId}`,
              JSON.stringify({ conversation: msgData.conversation, messages: msgData.messages })
            );
          } catch {}

          return merged;
        });

        if (msgData.conversation?.partner?.isFriend) {
          setIsFriend(true);
        }
      } catch (err: any) {
        if (isMounted && !conversation) setErrorMessage(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchInitial();

    return () => {
      isMounted = false;
    };
  }, [conversationId]);

  // Smart Auto-Scroll Behavior: Jumps on initial load, smooth scrolls if user was near bottom, never jumps while reading older messages
  useEffect(() => {
    if (isLoadingOlderRef.current) return;
    if (isFirstLoadRef.current && messages.length > 0) {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
      isFirstLoadRef.current = false;
      isNearBottomRef.current = true;
    } else if (isNearBottomRef.current) {
      scrollToBottom('smooth');
    }
  }, [messages]);

  // 2. High-Speed Delta Polling (Only fetches messages created after latest timestamp)
  useEffect(() => {
    if (!conversationId) return;

    const interval = setInterval(async () => {
      try {
        const msgs = messagesRef.current;
        const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
        const sinceParam = lastMsg?.createdAt
          ? `?since=${encodeURIComponent(lastMsg.createdAt)}`
          : '?limit=40';

        const res = await fetch(`/api/chat/${conversationId}/messages${sinceParam}`);
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
                `campusconnect_cache_conv_${conversationId}`,
                JSON.stringify({ conversation, messages: updated })
              );
            } catch {}

            return updated;
          });

          if (data.conversation?.partner?.isFriend) {
            setIsFriend(true);
          }
        }
      } catch {}
    }, 1500);

    return () => clearInterval(interval);
  }, [conversationId, conversation]);

  // Load older messages on demand
  const handleLoadOlder = async () => {
    if (loadingOlder || !hasMore || messages.length === 0) return;
    const oldest = messages[0];
    setLoadingOlder(true);
    isLoadingOlderRef.current = true;
    const scrollContainer = messagesContainerRef.current;
    const oldScrollHeight = scrollContainer ? scrollContainer.scrollHeight : 0;

    try {
      const res = await fetch(
        `/api/chat/${conversationId}/messages?before=${encodeURIComponent(oldest.createdAt)}&limit=30`
      );
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.messages) && data.messages.length > 0) {
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const newOlder = data.messages.filter((m: any) => !existingIds.has(m.id));
          return [...newOlder, ...prev];
        });
        setHasMore(Boolean(data.hasMore));

        // Preserve scroll position
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

  // Signaling helper
  const sendSignal = useCallback(
    async (type: string, payload?: any) => {
      try {
        await fetch(`/api/chat/${conversationId}/signaling`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type,
            payload: {
              sessionId: callSessionIdRef.current,
              data: payload,
            },
          }),
        });
      } catch (e) {
        console.warn('Signaling error:', e);
      }
    },
    [conversationId]
  );

  // Clean WebRTC tracks and connection
  const cleanupWebRTC = useCallback(() => {
    if (pollSignalingTimerRef.current) {
      clearInterval(pollSignalingTimerRef.current);
      pollSignalingTimerRef.current = null;
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

    iceCandidatesQueueRef.current = [];
    seenSignalsRef.current.clear();

    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  }, []);

  // 3. Omegle WebRTC Initialization
  useEffect(() => {
    if (!isVideoActive || !conversation?.partner?.id || !currentUserId) {
      cleanupWebRTC();
      return;
    }

    let isMounted = true;
    isEndingCallRef.current = false;
    setVideoError(null);
    setCallState('STARTING');
    setCallDurationSeconds(0);
    lastSignalTimeRef.current = Date.now() - 30000;
    seenSignalsRef.current.clear();
    iceCandidatesQueueRef.current = [];

    // Deterministic Initiator: Lexicographical comparison prevents offer collisions
    const isInitiator = currentUserId < conversation.partner.id;

    const flushIceQueue = async (targetPc: RTCPeerConnection) => {
      if (iceCandidatesQueueRef.current.length === 0) return;
      const pending = [...iceCandidatesQueueRef.current];
      iceCandidatesQueueRef.current = [];
      for (const cand of pending) {
        try {
          await targetPc.addIceCandidate(new RTCIceCandidate(cand));
        } catch {}
      }
    };

    const startWebRTC = async () => {
      try {
        // A. Acquire Camera & Mic
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
            audio: { echoCancellation: true, noiseSuppression: true },
          });
        } catch (mErr: any) {
          if (mErr.name === 'NotAllowedError' || mErr.name === 'PermissionDeniedError') {
            throw new Error('Camera/Microphone permission was denied. Please allow access.');
          } else {
            throw new Error(`Media device error: ${mErr.message}`);
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

        // B. Configure STUN & TURN
        const iceServers: RTCIceServer[] = [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun.services.mozilla.com' },
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
          iceServers.unshift({
            urls: process.env.NEXT_PUBLIC_TURN_SERVER_URL,
            username: process.env.NEXT_PUBLIC_TURN_USERNAME || undefined,
            credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || undefined,
          });
        }

        const pc = new RTCPeerConnection({ iceServers });
        pcRef.current = pc;

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        pc.ontrack = (event) => {
          if (remoteVideoRef.current && event.streams[0]) {
            const tracks = event.streams[0].getTracks();
            if (tracks.length > 0) {
              remoteVideoRef.current.srcObject = event.streams[0];
              remoteVideoRef.current.play().catch(() => {});
              setCallState('CONNECTED');
            }
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            sendSignal('ice-candidate', event.candidate.toJSON());
          }
        };

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'connected') {
            if (remoteVideoRef.current?.srcObject) {
              setCallState('CONNECTED');
            }
          } else if (pc.connectionState === 'disconnected') {
            setCallState('RECONNECTING');
          } else if (pc.connectionState === 'failed') {
            setVideoError('WebRTC direct connection failed. Firewall may block P2P.');
          }
        };

        // C. Deterministic Role Negotiation
        if (isInitiator) {
          setCallState('CONNECTING');
          await sendSignal('call-request', { isVideo: true });
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await sendSignal('offer', offer);
        } else {
          setCallState('CONNECTING');
        }

        // D. Signaling Poller (Every 1000ms)
        pollSignalingTimerRef.current = setInterval(async () => {
          if (isEndingCallRef.current) return;
          try {
            const res = await fetch(
              `/api/chat/${conversationId}/signaling?since=${lastSignalTimeRef.current}`
            );
            const data = await res.json();

            if (data.success && Array.isArray(data.signals)) {
              for (const sig of data.signals) {
                if (seenSignalsRef.current.has(sig.id)) continue;
                seenSignalsRef.current.add(sig.id);

                lastSignalTimeRef.current = Math.max(lastSignalTimeRef.current, sig.createdAt);

                const rawPayload = sig.payload;
                const sigSessionId = rawPayload?.sessionId;
                const payloadData = rawPayload?.data !== undefined ? rawPayload.data : rawPayload;

                // Stale signal rejection: ignore signals from previous call sessions
                if (sigSessionId && callSessionIdRef.current && sigSessionId !== callSessionIdRef.current) {
                  if (sig.type === 'offer' && !isInitiator) {
                    callSessionIdRef.current = sigSessionId;
                  } else if (sig.type === 'ice-candidate' && !isInitiator && !pc.remoteDescription) {
                    // Cache early ICE candidate from initiator before offer arrives
                  } else {
                    continue;
                  }
                }

                // Partner skipped to next match!
                if (sig.type === 'call-next') {
                  setCallState('PARTNER_SKIPPED');
                  showToast('Your partner skipped to the next student match.');
                  cleanupWebRTC();
                  return;
                }

                if (sig.type === 'call-end' || sig.type === 'call-reject') {
                  setCallState('ENDED');
                  cleanupWebRTC();
                  return;
                }

                if (sig.type === 'offer' && !isInitiator) {
                  if (pc.signalingState !== 'stable') {
                    await pc.setLocalDescription({ type: 'rollback' } as any).catch(() => {});
                  }
                  await pc.setRemoteDescription(new RTCSessionDescription(payloadData));
                  await flushIceQueue(pc);

                  const answer = await pc.createAnswer();
                  await pc.setLocalDescription(answer);
                  await sendSignal('answer', answer);
                  setCallState('CONNECTING');
                }

                if (sig.type === 'answer' && isInitiator) {
                  if (pc.signalingState === 'have-local-offer') {
                    await pc.setRemoteDescription(new RTCSessionDescription(payloadData));
                    await flushIceQueue(pc);
                    setCallState('CONNECTING');
                  }
                }

                if (sig.type === 'ice-candidate' && payloadData) {
                  if (!pc.remoteDescription) {
                    iceCandidatesQueueRef.current.push(payloadData);
                  } else {
                    try {
                      await pc.addIceCandidate(new RTCIceCandidate(payloadData));
                    } catch {}
                  }
                }
              }
            }
          } catch {}
        }, 1000);
      } catch (err: any) {
        if (isMounted) {
          setVideoError(err.message || 'Failed to start video call.');
          cleanupWebRTC();
        }
      }
    };

    if (!callSessionIdRef.current || callState === 'IDLE' || callState === 'ENDED') {
      callSessionIdRef.current = 'call_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    }
    startWebRTC();

    return () => {
      isMounted = false;
      cleanupWebRTC();
    };
  }, [isVideoActive, conversation?.partner?.id, currentUserId, sendSignal, cleanupWebRTC]);

  // Duration Timer
  useEffect(() => {
    if (callState === 'CONNECTED') {
      durationTimerRef.current = setInterval(() => {
        setCallDurationSeconds((s) => s + 1);
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

  // Controls Handlers
  const handleToggleMic = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
        setIsMicMuted(!track.enabled);
      });
    }
  };

  const handleToggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
        setIsVideoDisabled(!track.enabled);
      });
    }
  };

  const handleToggleFullscreen = () => {
    if (!videoContainerRef.current) return;
    if (!document.fullscreenElement) {
      videoContainerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Omegle "Next Match" Handler
  const handleNextMatch = async () => {
    if (isEndingCallRef.current) return;
    isEndingCallRef.current = true;

    // Send call-next signal to partner
    await sendSignal('call-next');
    cleanupWebRTC();
    setIsVideoActive(false);

    // Immediately route to match page with autoSearch enabled
    router.push('/match?autoSearch=true');
  };

  // End Video Call (switches to text mode)
  const handleEndCall = async () => {
    if (isEndingCallRef.current) return;
    isEndingCallRef.current = true;
    await sendSignal('call-end');
    setCallState('ENDED');
    cleanupWebRTC();
    setIsVideoActive(false);
    showToast('Video call ended. Chat remains open.');
  };

  // Add Friend Handler
  const handleAddFriend = async () => {
    if (!conversation?.partner?.id || addingFriend || isFriend) return;
    setAddingFriend(true);

    try {
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: conversation.partner.id }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to send friend request');
      }

      if (data.status === 'ACCEPTED') {
        setIsFriend(true);
        showToast('You are now connected as friends!');
      } else {
        setFriendRequestPending(true);
        showToast('Friend request sent to ' + conversation.partner.displayName);
      }
    } catch (err: any) {
      showToast(err.message || 'Error adding friend');
    } finally {
      setAddingFriend(false);
    }
  };

  // Block User Handler
  const handleBlockUser = async () => {
    if (!conversation?.partner?.id) return;
    if (
      !confirm(
        `Are you sure you want to block ${conversation.partner.displayName}? They will not be able to message or match with you again.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch('/api/friends/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: conversation.partner.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to block user');
      }
      cleanupWebRTC();
      router.push('/messages');
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Delete / Clear Chat Handler
  const handleDeleteChat = async () => {
    if (
      !confirm(
        'Are you sure you want to delete this chat? Your message history will be cleared from your view.'
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/chat/${conversationId}/delete`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to delete chat');
      }
      cleanupWebRTC();
      router.push('/messages');
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Submit Safety Report
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

      showToast('Safety report submitted to campus moderators.');
      setShowReportModal(false);
      setReportDetails('');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingReport(false);
    }
  };

  // Instant Optimistic Message Sender
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || sending) return;

    const content = inputValue.trim();
    const clientMessageId = 'opt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);

    // 1. Instant Optimistic UI Update (0ms delay)
    const optimisticMessage = {
      id: clientMessageId,
      clientMessageId,
      conversationId,
      senderId: currentUserId || 'me',
      content,
      isRead: false,
      createdAt: new Date().toISOString(),
      isMine: true,
      status: 'sending' as const,
    };

    isNearBottomRef.current = true;
    setMessages((prev) => [...prev, optimisticMessage]);
    setInputValue('');
    scrollToBottom('smooth');

    // 2. Background Dispatch to PostgreSQL
    try {
      const res = await fetch(`/api/chat/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, clientMessageId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to send message');
      }

      // Mark delivered and synchronize server-assigned message ID
      setMessages((prev) =>
        prev.map((m) =>
          m.id === clientMessageId || m.clientMessageId === clientMessageId
            ? { ...data.message, status: 'delivered' }
            : m
        )
      );

      // Save to local cache
      try {
        localStorage.setItem(
          `campusconnect_cache_conv_${conversationId}`,
          JSON.stringify({
            conversation,
            messages: messagesRef.current.map((m) =>
              m.id === clientMessageId ? { ...data.message, status: 'delivered' } : m
            ),
          })
        );
      } catch {}
    } catch (err: any) {
      // Mark as failed with retry capability
      setMessages((prev) =>
        prev.map((m) =>
          m.id === clientMessageId || m.clientMessageId === clientMessageId
            ? { ...m, status: 'failed', errorMessage: err.message }
            : m
        )
      );
    }
  };

  // Retry Failed Message
  const handleRetryMessage = async (failedMsg: any) => {
    const clientMessageId = failedMsg.clientMessageId || failedMsg.id;
    setMessages((prev) =>
      prev.map((m) => (m.id === failedMsg.id ? { ...m, status: 'sending' } : m))
    );

    try {
      const res = await fetch(`/api/chat/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: failedMsg.content, clientMessageId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Retry failed');
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === failedMsg.id || m.clientMessageId === clientMessageId
            ? { ...data.message, status: 'delivered' }
            : m
        )
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === failedMsg.id ? { ...m, status: 'failed' } : m))
      );
    }
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Lightweight skeleton shown only on cold open when no cached data exists
  if (loading && !conversation) {
    return (
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-4 h-[calc(100vh-4.5rem)] flex flex-col space-y-3 animate-pulse">
        <div className="glass-card rounded-2xl px-4 py-3 border border-navy-750 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-navy-800" />
            <div className="space-y-1.5">
              <div className="w-32 h-3.5 rounded bg-navy-800" />
              <div className="w-48 h-2.5 rounded bg-navy-850" />
            </div>
          </div>
          <div className="w-24 h-8 rounded-xl bg-navy-800" />
        </div>
        <div className="flex-1 glass-card rounded-3xl border border-navy-750 p-6 flex flex-col justify-between">
          <div className="space-y-4 max-w-lg">
            <div className="w-48 h-9 rounded-2xl bg-navy-850 self-start" />
            <div className="w-64 h-9 rounded-2xl bg-brand-purple/20 ml-auto" />
            <div className="w-56 h-9 rounded-2xl bg-navy-850 self-start" />
          </div>
          <div className="h-11 rounded-xl bg-navy-900 border border-navy-800" />
        </div>
      </div>
    );
  }

  if (errorMessage && !conversation) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-white">Access Denied</h2>
        <p className="text-xs text-slate-400">{errorMessage}</p>
        <Link
          href="/messages"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-navy-850 border border-navy-700 text-slate-200 text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Messages
        </Link>
      </div>
    );
  }

  const partner = conversation?.partner;
  const isEnded = conversation?.status === 'ENDED';

  return (
    <div className="w-full max-w-7xl mx-auto md:px-4 lg:px-6 md:py-3 h-[calc(100dvh-4rem)] max-h-[calc(100dvh-4rem)] flex flex-col md:space-y-3 overflow-hidden min-h-0">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 md:top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-purple-600/90 backdrop-blur border border-white/20 text-white text-xs font-semibold shadow-2xl animate-fade-in flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-200" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Header Bar - Compact & sleek on mobile, rich on desktop */}
      <div className="md:rounded-2xl px-3 sm:px-4 py-2 sm:py-3 border-b md:border border-slate-200 dark:border-navy-750 flex items-center justify-between shrink-0 shadow-sm md:shadow-lg bg-white/95 dark:bg-navy-900/95 backdrop-blur-md z-30">
        {/* Left: Partner identity */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <Link
            href="/messages"
            className="p-1 sm:p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-navy-850 shrink-0 transition-colors"
            title="Back to Messages"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <div className="relative shrink-0">
            {partner?.avatarUrl ? (
              <img
                src={partner.avatarUrl}
                alt={partner.displayName}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border border-slate-200 dark:border-navy-700 shadow-sm"
              />
            ) : (
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                {partner?.displayName?.[0] || 'S'}
              </div>
            )}
            {partner?.isOnline && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-navy-900" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate max-w-[130px] sm:max-w-xs">
                {partner?.displayName}
              </h2>
              {partner?.isVerified && (
                <span title="Verified Student" className="shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500" />
                </span>
              )}
              {isMoneyRoom ? (
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-[10px] font-bold items-center gap-1 shadow-sm shrink-0">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>Personal Room</span>
                </span>
              ) : (
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-700 dark:text-purple-300 text-[10px] font-bold items-center gap-1 shadow-sm shrink-0">
                  <Sparkles className="w-3 h-3 text-purple-500" />
                  <span>Match Room</span>
                </span>
              )}
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate max-w-[130px] sm:max-w-xs">
              <GraduationCap className="w-3 h-3 text-purple-600 shrink-0" />
              <span className="truncate">{partner?.universityName}</span>
              {partner?.course && <span className="hidden sm:inline truncate">• {partner.course}</span>}
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Add Friend Trigger */}
          {!isFriend && (
            <button
              onClick={handleAddFriend}
              disabled={addingFriend || friendRequestPending}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                friendRequestPending
                  ? 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-navy-700'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-500 hover:opacity-90 text-white shadow-md shadow-emerald-600/20'
              }`}
              title="Establish permanent friendship"
            >
              {addingFriend ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : friendRequestPending ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Request Sent</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add Friend</span>
                </>
              )}
            </button>
          )}

          {/* Toggle Video Button */}
          {!isVideoActive ? (
            <button
              onClick={() => setIsVideoActive(true)}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-purple-600/20 transition-all cursor-pointer"
              title="Start Live Video Feed"
            >
              <Video className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Start Video</span>
            </button>
          ) : (
            <button
              onClick={handleEndCall}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-750 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 border border-slate-200 dark:border-navy-700 transition-colors cursor-pointer"
              title="Switch to Text-Only Chat"
            >
              <PhoneOff className="w-3.5 h-3.5 text-rose-500" />
              <span className="hidden sm:inline">Text Only</span>
            </button>
          )}

          {/* Omegle Next Match Button (Only in Match Room, NEVER in Money Room) */}
          {!isMoneyRoom && (
            <button
              onClick={handleNextMatch}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-95 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all cursor-pointer"
              title="End this session and automatically match with the next student"
            >
              <FastForward className="w-3.5 h-3.5" />
              <span>Next Match</span>
            </button>
          )}

          {/* Theme Toggle */}
          <div className="hidden sm:flex items-center">
            <ThemeToggle />
          </div>

          {/* Three-dot dropdown menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-850 transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-44 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-750 shadow-2xl py-1.5 z-40 text-xs">
                <button
                  onClick={() => {
                    setShowMenu(false);
                    setShowReportModal(true);
                  }}
                  className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-navy-800 dark:hover:text-white flex items-center gap-2"
                >
                  <Flag className="w-3.5 h-3.5 text-amber-500" />
                  <span>Report User</span>
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    handleDeleteChat();
                  }}
                  className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-navy-800 dark:hover:text-white flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span>Clear Chat</span>
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    handleBlockUser();
                  }}
                  className="w-full px-3.5 py-2 text-left text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Block User</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Main Layout (Video Canvas + Integrated Text Chat) */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 overflow-hidden">
        {/* Left Column: Omegle Dual Video Canvas (When video is active) */}
        {isVideoActive ? (
          <div
            ref={videoContainerRef}
            className="lg:col-span-7 xl:col-span-8 glass-card rounded-3xl border border-navy-750 flex flex-col justify-between overflow-hidden relative shadow-2xl bg-navy-950 min-h-[320px] lg:min-h-0"
          >
            {/* Top Video Status Overlay */}
            <div className="absolute top-0 left-0 right-0 z-20 p-3 sm:p-4 bg-gradient-to-b from-navy-950/90 to-transparent flex items-center justify-between pointer-events-auto">
              <div className="flex items-center gap-2">
                {callState === 'CONNECTED' ? (
                  <div className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-bold flex items-center gap-1.5 shadow">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{formatDuration(callDurationSeconds)}</span>
                  </div>
                ) : (
                  <div className="px-3 py-1 rounded-full bg-brand-purple/20 border border-brand-purple/30 text-brand-purple text-xs font-semibold flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>
                      {callState === 'STARTING' && 'Starting camera...'}
                      {callState === 'CONNECTING' && 'Connecting peer stream...'}
                      {callState === 'RECONNECTING' && 'Reconnecting...'}
                      {callState === 'PARTNER_SKIPPED' && 'Partner Skipped'}
                      {callState === 'ENDED' && 'Call Ended'}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggleFullscreen}
                  className="p-2 rounded-xl bg-navy-900/80 hover:bg-navy-800 text-slate-300 hover:text-white transition-colors"
                  title="Toggle Fullscreen"
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Video Streams Container */}
            <div className="relative flex-1 w-full h-full bg-navy-950 flex items-center justify-center overflow-hidden">
              {/* Partner Skipped / Call Ended Overlay */}
              {callState === 'PARTNER_SKIPPED' ? (
                <div className="p-6 text-center space-y-4 z-10 animate-fade-in">
                  <div className="w-16 h-16 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                    <FastForward className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      {isMoneyRoom ? 'Call Ended' : 'Partner Skipped'}
                    </h3>
                    <p className="text-xs text-slate-300 mt-1">
                      {isMoneyRoom
                        ? `${partner?.displayName || 'Your friend'} has ended the video call. Your chat and friendship remain active.`
                        : `${partner?.displayName || 'Student'} skipped to the next match.`}
                    </p>
                  </div>
                  {isMoneyRoom ? (
                    <button
                      onClick={() => setIsVideoActive(false)}
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-brand-purple to-electric-500 text-white font-bold text-xs shadow-xl shadow-brand-purple/30 hover:opacity-95 transition-all cursor-pointer"
                    >
                      Return to Chat
                    </button>
                  ) : (
                    <button
                      onClick={() => router.push('/match?autoSearch=true')}
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-brand-purple to-electric-500 text-white font-bold text-xs shadow-xl shadow-brand-purple/30 hover:opacity-95 transition-all cursor-pointer"
                    >
                      Find Next Student Match
                    </button>
                  )}
                </div>
              ) : videoError ? (
                <div className="p-6 text-center space-y-3 z-10 animate-fade-in max-w-sm">
                  <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
                  <h4 className="text-sm font-bold text-white">Video Stream Unavailable</h4>
                  <p className="text-xs text-rose-300">{videoError}</p>
                  <button
                    onClick={() => setIsVideoActive(false)}
                    className="px-4 py-2 rounded-xl bg-navy-850 hover:bg-navy-800 text-white text-xs font-semibold"
                  >
                    Continue In Text Chat
                  </button>
                </div>
              ) : (
                <>
                  {/* Remote Video (Takes Main Frame) */}
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className={`w-full h-full object-cover transition-opacity duration-300 ${
                      callState === 'CONNECTED' ? 'opacity-100' : 'opacity-0'
                    }`}
                  />

                  {/* Connecting Placeholder Canvas */}
                  {callState !== 'CONNECTED' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 space-y-4 bg-navy-950/95 z-10">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-brand-purple to-electric-500 flex items-center justify-center text-white text-2xl font-bold shadow-xl animate-pulse">
                        {partner?.displayName?.[0] || 'S'}
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-white">{partner?.displayName}</h4>
                        <p className="text-xs text-slate-400 mt-1 flex items-center justify-center gap-1.5">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-electric-400" />
                          <span>
                            {isMoneyRoom
                              ? 'Establishing secure Personal Room video feed...'
                              : 'Establishing live Match Room video connection...'}
                          </span>
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Local Video Preview (Picture-in-Picture in Corner) */}
                  <div className="absolute bottom-20 right-4 z-20 w-28 sm:w-40 aspect-video rounded-2xl overflow-hidden border-2 border-brand-purple/50 bg-navy-900 shadow-2xl">
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
                        <VideoOff className="w-4 h-4 mb-0.5" />
                        <span>Camera Off</span>
                      </div>
                    )}
                    <span className="absolute bottom-1 left-2 text-[9px] font-bold text-white/90 bg-black/50 px-1 rounded">
                      You
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Bottom Video Controls Toolbar */}
            <div className="p-3 sm:p-4 bg-gradient-to-t from-navy-950 via-navy-950/90 to-transparent flex items-center justify-center gap-3 relative z-20">
              {/* Mic Mute Button */}
              <button
                onClick={handleToggleMic}
                className={`p-3 rounded-full transition-all cursor-pointer ${
                  isMicMuted
                    ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                    : 'bg-navy-850 hover:bg-navy-800 text-slate-200'
                }`}
                title={isMicMuted ? 'Unmute Microphone' : 'Mute Microphone'}
              >
                {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              {/* Next Match Skip Button (Only in Match Room) */}
              {!isMoneyRoom && (
                <button
                  onClick={handleNextMatch}
                  className="px-5 py-2.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-95 text-navy-950 font-bold text-xs flex items-center gap-1.5 shadow-xl shadow-amber-500/30 hover:scale-105 transition-all cursor-pointer"
                  title="Skip to next match (Omegle style)"
                >
                  <FastForward className="w-4 h-4" />
                  <span>Next Match</span>
                </button>
              )}

              {/* Camera On/Off Button */}
              <button
                onClick={handleToggleVideo}
                className={`p-3 rounded-full transition-all cursor-pointer ${
                  isVideoDisabled
                    ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                    : 'bg-navy-850 hover:bg-navy-800 text-slate-200'
                }`}
                title={isVideoDisabled ? 'Enable Camera' : 'Disable Camera'}
              >
                {isVideoDisabled ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
              </button>

              {/* End Video Call */}
              <button
                onClick={handleEndCall}
                className="p-3 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 cursor-pointer"
                title="End video call"
              >
                <PhoneOff className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : null}

        {/* Right Column (or Full Width if text mode): Live Text Chat Feed */}
        <div
          className={`${
            isVideoActive ? 'lg:col-span-5 xl:col-span-4' : 'col-span-12 max-w-4xl mx-auto w-full'
          } md:rounded-3xl border-0 md:border border-slate-200 dark:border-navy-750 flex flex-col justify-between overflow-hidden md:shadow-xl flex-1 min-h-0 bg-white dark:bg-navy-950 md:bg-white md:dark:bg-navy-900/60`}
        >
          {/* Chat Messages Scroll Container */}
          <div
            ref={messagesContainerRef}
            onScroll={handleMessagesScroll}
            className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5 space-y-3 min-h-0 bg-white dark:bg-navy-950"
          >
            <div className="p-2 sm:p-2.5 rounded-xl bg-slate-50 dark:bg-navy-900/90 border border-slate-200 dark:border-navy-800 text-center text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400">
              🔒 End-to-end moderated chat session. Respect campus guidelines.
            </div>

            {/* Load older messages button if conversation history has more */}
            {hasMore && (
              <div className="text-center py-1">
                <button
                  type="button"
                  onClick={handleLoadOlder}
                  disabled={loadingOlder}
                  className="text-[11px] text-purple-600 dark:text-purple-400 hover:text-purple-700 font-semibold flex items-center justify-center gap-1.5 mx-auto py-1 px-3 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-navy-900 dark:hover:bg-navy-800 border border-slate-200 dark:border-navy-800 transition-colors cursor-pointer"
                >
                  {loadingOlder ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin text-purple-600 dark:text-purple-400" />
                      <span>Loading older messages...</span>
                    </>
                  ) : (
                    <span>Load older messages</span>
                  )}
                </button>
              </div>
            )}

            {messages.length === 0 ? (
              <div className="py-16 text-center text-slate-400 dark:text-slate-500 text-xs">
                <p>Say hello to {partner?.displayName}! Send a message below.</p>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${m.isMine ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-xs leading-relaxed shadow-sm ${
                      m.isMine
                        ? m.status === 'failed'
                          ? 'bg-rose-500 text-white rounded-br-none'
                          : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-br-none'
                        : 'bg-slate-100 dark:bg-navy-850 border border-slate-200/70 dark:border-navy-750 text-slate-900 dark:text-slate-100 rounded-bl-none'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5 px-1 font-mono text-[10px] text-slate-400 dark:text-slate-500">
                    <span>{format(new Date(m.createdAt), 'hh:mm a')}</span>
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
                              className="text-[10px] text-rose-500 underline font-sans font-semibold hover:text-rose-600 cursor-pointer"
                            >
                              Retry
                            </button>
                          </div>
                        )}
                        {(!m.status || m.status === 'delivered') && (
                          <span title="Delivered & Saved">
                            <CheckCheck className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Chat Message Input Bar */}
          {isEnded ? (
            <div className="p-3 bg-slate-100 dark:bg-navy-900 border-t border-slate-200 dark:border-navy-800 text-center text-xs text-slate-500 dark:text-slate-400">
              This conversation has ended.
            </div>
          ) : (
            <form
              onSubmit={handleSendMessage}
              className="p-2 sm:p-3 bg-white/95 dark:bg-navy-950/95 md:bg-white md:dark:bg-navy-900/80 border-t border-slate-200 dark:border-navy-850 flex items-center gap-2 shrink-0 pb-[max(0.6rem,env(safe-area-inset-bottom))] md:pb-3 backdrop-blur-md"
            >
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Message..."
                maxLength={1000}
                className="flex-1 px-4 py-2.5 rounded-full md:rounded-xl bg-slate-100 dark:bg-navy-950 border border-slate-200 dark:border-navy-750 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-xs focus:outline-none focus:border-purple-600 transition-colors shadow-inner"
              />
              <button
                type="submit"
                disabled={!inputValue.trim()}
                className="p-2.5 sm:px-4 sm:py-2.5 rounded-full md:rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs shadow-md shadow-purple-600/20 hover:opacity-95 disabled:opacity-40 transition-opacity flex items-center justify-center gap-1.5 cursor-pointer shrink-0 active:scale-95"
              >
                <Send className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                <span className="hidden sm:inline">Send</span>
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-navy-900 border border-rose-500/40 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <h3 className="font-bold text-sm text-white mb-2 flex items-center gap-2">
              <Flag className="w-4 h-4 text-rose-400" />
              Report Inappropriate Behavior
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Your report will be audited by university safety moderation.
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
                <label className="block text-slate-300 font-semibold mb-1">Details *</label>
                <textarea
                  required
                  rows={3}
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Describe what occurred..."
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
                  disabled={submittingReport || reportDetails.length < 5}
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

export default function ChatRoomPage() {
  return (
    <React.Suspense
      fallback={
        <div className="max-w-4xl mx-auto px-4 py-24 text-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-brand-purple" />
          <p className="text-xs">Connecting to secure student room...</p>
        </div>
      }
    >
      <ChatRoomContent />
    </React.Suspense>
  );
}
