import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

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
      return JSON.parse(raw);
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

export function pushSignal(signal: Omit<SignalMessage, 'id' | 'createdAt'>): SignalMessage {
  const fullSignal: SignalMessage = {
    ...signal,
    id: `sig_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: Date.now(),
  };

  const existing = signalsMap.get(signal.conversationId) || loadSignalsFromDisk(signal.conversationId);
  // Keep last 40 signals in queue
  const updated = [...existing, fullSignal].slice(-40);
  signalsMap.set(signal.conversationId, updated);
  saveSignalsToDisk(signal.conversationId, updated);

  signalEmitter.emit(`signal:${signal.conversationId}`, fullSignal);
  return fullSignal;
}

export function getSignalsForUser(
  conversationId: string,
  userId: string,
  sinceTimestamp = 0
): SignalMessage[] {
  let list = signalsMap.get(conversationId);
  if (!list || list.length === 0) {
    list = loadSignalsFromDisk(conversationId);
    if (list.length > 0) signalsMap.set(conversationId, list);
  }

  const all = list || [];
  return all.filter(
    (s) => s.toUserId === userId && s.createdAt > sinceTimestamp
  );
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
  try {
    const file = getSignalFilePath(conversationId);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch {}
}
