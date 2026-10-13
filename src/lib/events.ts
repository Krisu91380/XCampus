import { EventEmitter } from 'events';
import { Message } from '@/types';

// Global singleton event emitter for real-time chat broadcasts across Next.js API routes
declare global {
  // eslint-disable-next-line no-var
  var __campusConnectEvents: EventEmitter | undefined;
}

const chatEmitter = global.__campusConnectEvents || new EventEmitter();
chatEmitter.setMaxListeners(100);

if (process.env.NODE_ENV !== 'production') {
  global.__campusConnectEvents = chatEmitter;
}

export const CHAT_EVENTS = {
  MESSAGE_SENT: 'message_sent',
  CONVERSATION_ENDED: 'conversation_ended',
  USER_TYPING: 'user_typing',
  MATCH_FOUND: 'match_found',
};

export function broadcastMessage(conversationId: string, message: Message) {
  chatEmitter.emit(`${CHAT_EVENTS.MESSAGE_SENT}:${conversationId}`, message);
}

export function broadcastEndConversation(conversationId: string, endedByUserId: string, reason?: string) {
  chatEmitter.emit(`${CHAT_EVENTS.CONVERSATION_ENDED}:${conversationId}`, { endedByUserId, reason });
}

export function broadcastMatchFound(userId: string, matchData: any) {
  chatEmitter.emit(`${CHAT_EVENTS.MATCH_FOUND}:${userId}`, matchData);
}

export function subscribeToMatch(
  userId: string,
  onMatch: (data: any) => void
): () => void {
  const matchChannel = `${CHAT_EVENTS.MATCH_FOUND}:${userId}`;
  chatEmitter.on(matchChannel, onMatch);
  return () => {
    chatEmitter.off(matchChannel, onMatch);
  };
}

export function subscribeToConversation(
  conversationId: string,
  onMessage: (msg: Message) => void,
  onEnd?: (data: { endedByUserId: string; reason?: string }) => void
): () => void {
  const msgChannel = `${CHAT_EVENTS.MESSAGE_SENT}:${conversationId}`;
  const endChannel = `${CHAT_EVENTS.CONVERSATION_ENDED}:${conversationId}`;

  chatEmitter.on(msgChannel, onMessage);
  if (onEnd) chatEmitter.on(endChannel, onEnd);

  return () => {
    chatEmitter.off(msgChannel, onMessage);
    if (onEnd) chatEmitter.off(endChannel, onEnd);
  };
}
