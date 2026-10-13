import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { db } from './db';

export interface SignalMessage {
  id: string;
  conversationId: string;
  fromUserId: string;
  toUserId: string;
  type:
    | 'call-request'
    | 'call-accept'
    | 'call-reject'
    | 'call-end'
    | 'offer'
    | 'answer'
    | 'ice-candidate';
  payload?: any;
  createdAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __campusConnectSignals: Map<string, SignalMessage[]> | undefined;
  // eslint-disable-next-line no-var
  var __campusConnectSignalEmitter: EventEmitter | undefined;
}

const signalsMap: Map<string, SignalMessage[]> =
  global.__campusConnectSignals || new Map();
const signalEmitter: EventEmitter =
  global.__campusConnectSignalEmitter || new EventEmitter();

signalEmitter.setMaxListeners(100);

if (process.env.NODE_ENV !== 'production') {
  global.__campusConnectSignals = signalsMap;
  global.__campusConnectSignalEmitter = signalEmitter;
}

function getSignalFilePath(conversationId: string): string {
  const safeId = conversationId.replace(/[^a-zA-Z0-9_-]/g, '_');
  if (process.env.VERCEL) {
    return `/tmp/cc_signals_${safeId}.json`;
  }
  return path.join(process.cwd(), 'prisma', `signals_${safeId}.json`);
}

function loadSignalsFromDisk(conversationId: string): SignalMessage[] {
  try {
    const file = getSignalFilePath(conversationId);
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function saveSignalsToDisk(conversationId: string, signals: SignalMessage[]) {
  try {
    const file = getSignalFilePath(conversationId);
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(signals), 'utf-8');
  } catch {}
}

/**
 * Returns merged, deduplicated, sorted signals from both in-memory cache and disk storage.
 * Ensures multi-process or multi-lambda environments remain consistent.
 */
function getMergedSignals(conversationId: string): SignalMessage[] {
  db.store.syncFromDiskIfNeeded();
  const dbSignals = (db.store.signals.get(conversationId) as SignalMessage[]) || [];
  const memSignals = signalsMap.get(conversationId) || [];
  const diskSignals = loadSignalsFromDisk(conversationId);
  const byId = new Map<string, SignalMessage>();

  for (const s of [...dbSignals, ...memSignals, ...diskSignals]) {
    if (s && s.id) {
      byId.set(s.id, s);
    }
  }

  // Keep latest 60 signals
  const merged = Array.from(byId.values())
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(-60);

  signalsMap.set(conversationId, merged);
  return merged;
}

export function pushSignal(signal: Omit<SignalMessage, 'id' | 'createdAt'>): SignalMessage {
  const fullSignal: SignalMessage = {
    ...signal,
    id: `sig_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    createdAt: Date.now(),
  };

  const existing = getMergedSignals(signal.conversationId);
  const updated = [...existing, fullSignal].slice(-60);
  signalsMap.set(signal.conversationId, updated);
  db.store.signals.set(signal.conversationId, updated);
  db.store.saveToDisk();
  saveSignalsToDisk(signal.conversationId, updated);

  signalEmitter.emit(`signal:${signal.conversationId}`, fullSignal);
  return fullSignal;
}

export function getSignalsForUser(
  conversationId: string,
  userId: string,
  sinceTimestamp = 0
): SignalMessage[] {
  const all = getMergedSignals(conversationId);
  return all.filter((s) => {
    // Deliver if targeted to user or from partner student in this private conversation
    const isTarget =
      s.toUserId === userId ||
      (!s.toUserId && s.fromUserId !== userId) ||
      s.toUserId === 'all' ||
      s.fromUserId !== userId;

    return isTarget && s.createdAt >= sinceTimestamp;
  });
}

export function subscribeToSignals(
  conversationId: string,
  onSignal: (signal: SignalMessage) => void
): () => void {
  const channel = `signal:${conversationId}`;
  signalEmitter.on(channel, onSignal);
  return () => {
    signalEmitter.off(channel, onSignal);
  };
}

export function clearSignals(conversationId: string) {
  signalsMap.delete(conversationId);
  db.store.signals.delete(conversationId);
  db.store.saveToDisk();
  try {
    const file = getSignalFilePath(conversationId);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch {}
}

/**
 * Checks if there is an active incoming call for currentUserId in the specified conversation.
 * Active means a call-request occurred within the last 45 seconds and has not been terminated/answered.
 */
export function getActiveCallSignal(
  conversationId: string,
  currentUserId: string
): SignalMessage | null {
  const signals = getMergedSignals(conversationId);
  const now = Date.now();
  let latestCallRequest: SignalMessage | null = null;
  let hasTerminated = false;

  for (const s of signals) {
    if (s.createdAt < now - 45000) continue;
    if (s.type === 'call-request' && s.fromUserId !== currentUserId) {
      latestCallRequest = s;
      hasTerminated = false;
    } else if (
      (s.type === 'call-end' || s.type === 'call-reject' || s.type === 'call-accept') &&
      latestCallRequest &&
      s.createdAt >= latestCallRequest.createdAt
    ) {
      hasTerminated = true;
    }
  }

  return !hasTerminated && latestCallRequest ? latestCallRequest : null;
}

