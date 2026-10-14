'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface MinimizedChatData {
  id: string; // conversationId
  partner: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
    universityName?: string;
    course?: string;
    isOnline?: boolean;
    isVerified?: boolean;
  };
  draft: string;
  isOpen: boolean; // true = expanded floating window; false = compact bar/pill
  unreadCount?: number;
}

interface ChatContextType {
  minimizedChats: MinimizedChatData[];
  minimizeChat: (convId: string, partner: any, draft?: string) => void;
  restoreChat: (convId: string) => void;
  toggleFloatingChat: (convId: string) => void;
  closeMinimizedChat: (convId: string) => void;
  setChatDraft: (convId: string, draft: string) => void;
  isChatMinimized: (convId: string) => boolean;
}

const ChatContext = createContext<ChatContextType>({
  minimizedChats: [],
  minimizeChat: () => {},
  restoreChat: () => {},
  toggleFloatingChat: () => {},
  closeMinimizedChat: () => {},
  setChatDraft: () => {},
  isChatMinimized: () => false,
});

const STORAGE_KEY = 'cc_minimized_chats';

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [minimizedChats, setMinimizedChats] = useState<MinimizedChatData[]>([]);

  // Load from session/local storage
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setMinimizedChats(parsed);
        }
      }
    } catch {}
  }, []);

  // Save to storage
  const saveChats = useCallback((chats: MinimizedChatData[]) => {
    setMinimizedChats(chats);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
    } catch {}
  }, []);

  const minimizeChat = useCallback(
    (convId: string, partner: any, draft: string = '') => {
      setMinimizedChats((prev) => {
        const existingIdx = prev.findIndex((c) => c.id === convId);
        let next: MinimizedChatData[];
        if (existingIdx >= 0) {
          next = [...prev];
          next[existingIdx] = {
            ...next[existingIdx],
            partner: partner || next[existingIdx].partner,
            draft: draft !== undefined ? draft : next[existingIdx].draft,
            isOpen: false, // collapsed into pill initially
          };
        } else {
          // Keep at most 3 minimized chats to prevent screen clutter
          const trimmed = prev.slice(-2);
          next = [
            ...trimmed,
            {
              id: convId,
              partner,
              draft: draft || '',
              isOpen: false,
              unreadCount: 0,
            },
          ];
        }
        try {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    []
  );

  const toggleFloatingChat = useCallback((convId: string) => {
    setMinimizedChats((prev) => {
      const next = prev.map((c) => (c.id === convId ? { ...c, isOpen: !c.isOpen } : c));
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const restoreChat = useCallback((convId: string) => {
    setMinimizedChats((prev) => {
      const next = prev.map((c) => (c.id === convId ? { ...c, isOpen: true } : c));
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const closeMinimizedChat = useCallback((convId: string) => {
    setMinimizedChats((prev) => {
      const next = prev.filter((c) => c.id !== convId);
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const setChatDraft = useCallback((convId: string, draft: string) => {
    setMinimizedChats((prev) => {
      const next = prev.map((c) => (c.id === convId ? { ...c, draft } : c));
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const isChatMinimized = useCallback(
    (convId: string) => {
      return minimizedChats.some((c) => c.id === convId);
    },
    [minimizedChats]
  );

  return (
    <ChatContext.Provider
      value={{
        minimizedChats,
        minimizeChat,
        restoreChat,
        toggleFloatingChat,
        closeMinimizedChat,
        setChatDraft,
        isChatMinimized,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  return useContext(ChatContext);
}
