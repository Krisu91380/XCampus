import { db } from './db';
import { CreditLedgerEntry, UserCreditBalance } from '@/types';

export class LedgerError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'LedgerError';
  }
}

export async function getUserBalance(userId: string): Promise<number> {
  const record = await db.userCreditBalance.findUnique({ where: { userId } });
  return record ? record.credits : 0;
}

/**
 * Atomically grants credits to a user with idempotency check
 */
export async function addCredits({
  userId,
  amount,
  reason,
  referenceId,
  metadata,
}: {
  userId: string;
  amount: number;
  reason: 'PURCHASE' | 'REFUND' | 'SIGNUP_BONUS' | 'ADMIN_ADJUSTMENT';
  referenceId?: string;
  metadata?: Record<string, any>;
}): Promise<{ balance: number; ledgerEntry: CreditLedgerEntry }> {
  if (amount <= 0) {
    throw new LedgerError('Credit addition amount must be positive', 'INVALID_AMOUNT');
  }

  // Idempotency check: if referenceId is provided (e.g. razorpayOrderId), ensure it hasn't been credited yet
  if (referenceId) {
    const existingLedgers = await db.creditLedger.findMany({ where: { userId } });
    const duplicate = existingLedgers.find(
      (l) => l.referenceId === referenceId && l.reason === reason
    );
    if (duplicate) {
      const currentBalance = await getUserBalance(userId);
      return { balance: currentBalance, ledgerEntry: duplicate };
    }
  }

  const current = await db.userCreditBalance.findUnique({ where: { userId } });
  const newBalance = (current?.credits || 0) + amount;

  // Update balance atomically
  await db.userCreditBalance.upsert({
    where: { userId },
    create: { userId, credits: newBalance },
    update: { credits: { set: newBalance } },
  });

  // Record in immutable ledger
  const ledgerEntry = await db.creditLedger.create({
    data: {
      userId,
      change: amount,
      balanceAfter: newBalance,
      reason,
      referenceId: referenceId || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });

  return { balance: newBalance, ledgerEntry };
}

/**
 * Atomically deducts 1 credit when a conversation is established
 * Guarantees no duplicate charge for the same conversation
 */
export async function deductCreditForConversation({
  userId,
  conversationId,
}: {
  userId: string;
  conversationId: string;
}): Promise<{ success: boolean; balance: number; deducted: boolean }> {
  // Idempotency: verify if this conversation was already charged
  const existingLedgers = await db.creditLedger.findMany({ where: { userId } });
  const alreadyCharged = existingLedgers.some(
    (l) => l.referenceId === conversationId && l.reason === 'CONVERSATION_DEDUCTION'
  );

  if (alreadyCharged) {
    const currentBalance = await getUserBalance(userId);
    return { success: true, balance: currentBalance, deducted: false };
  }

  const balance = await getUserBalance(userId);
  if (balance < 1) {
    throw new LedgerError('Insufficient chat credits. Please purchase a chat pass to continue.', 'INSUFFICIENT_CREDITS');
  }

  const newBalance = balance - 1;

  await db.userCreditBalance.upsert({
    where: { userId },
    create: { userId, credits: newBalance },
    update: { credits: { decrement: 1 } },
  });

  await db.creditLedger.create({
    data: {
      userId,
      change: -1,
      balanceAfter: newBalance,
      reason: 'CONVERSATION_DEDUCTION',
      referenceId: conversationId,
      metadata: JSON.stringify({ conversationId, timestamp: new Date().toISOString() }),
    },
  });

  return { success: true, balance: newBalance, deducted: true };
}

/**
 * Refunds or restores a credit if a match or conversation was interrupted or disputed
 */
export async function refundCreditForConversation({
  userId,
  conversationId,
  reason = 'DISPUTE_OR_GLITCH',
}: {
  userId: string;
  conversationId: string;
  reason?: string;
}): Promise<{ balance: number }> {
  // Check that the conversation was indeed charged previously
  const ledgers = await db.creditLedger.findMany({ where: { userId } });
  const charge = ledgers.find(
    (l) => l.referenceId === conversationId && l.reason === 'CONVERSATION_DEDUCTION'
  );
  if (!charge) {
    throw new LedgerError('No credit deduction found for this conversation.', 'NO_PRIOR_DEDUCTION');
  }

  // Check if already refunded
  const alreadyRefunded = ledgers.some(
    (l) => l.referenceId === conversationId && l.reason === 'REFUND'
  );
  if (alreadyRefunded) {
    return { balance: await getUserBalance(userId) };
  }

  const result = await addCredits({
    userId,
    amount: 1,
    reason: 'REFUND',
    referenceId: conversationId,
    metadata: { reason, conversationId },
  });

  return { balance: result.balance };
}

/**
 * Deducts credits (e.g. for refund reversal or admin adjustment)
 */
export async function deductCredits({
  userId,
  amount,
  reason,
  referenceId,
  metadata,
}: {
  userId: string;
  amount: number;
  reason: 'CONVERSATION_DEDUCTION' | 'REFUND' | 'ADMIN_ADJUSTMENT';
  referenceId?: string;
  metadata?: Record<string, any>;
}): Promise<{ balance: number; ledgerEntry: CreditLedgerEntry }> {
  const current = await db.userCreditBalance.findUnique({ where: { userId } });
  const newBalance = Math.max(0, (current?.credits || 0) - amount);

  await db.userCreditBalance.upsert({
    where: { userId },
    create: { userId, credits: newBalance },
    update: { credits: { set: newBalance } },
  });

  const ledgerEntry = await db.creditLedger.create({
    data: {
      userId,
      change: -amount,
      balanceAfter: newBalance,
      reason,
      referenceId: referenceId || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });

  return { balance: newBalance, ledgerEntry };
}
