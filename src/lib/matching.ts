import { db } from './db';
import { MatchQueueEntry, Conversation } from '@/types';
import { deductCreditForConversation, getUserBalance } from './ledger';
import { APP_CONFIG } from './config';
import { broadcastMatchFound } from './events';
import { generateSignedConversationId, ensureConversationAndParticipants } from './conversation';

export interface MatchResult {
  matched: boolean;
  conversationId?: string;
  partner?: {
    id: string;
    displayName: string;
    universityName: string;
    course?: string | null;
    academicYear?: string | null;
    avatarUrl?: string | null;
  };
  reason?: string;
}

export function isGenderCompatible(
  genderA: string,
  prefA: string,
  genderB: string,
  prefB: string
): boolean {
  const gA = (genderA || 'MALE').toUpperCase().trim();
  const gB = (genderB || 'MALE').toUpperCase().trim();
  const pA = (prefA || 'EVERYONE').toUpperCase().trim();
  const pB = (prefB || 'EVERYONE').toUpperCase().trim();

  // A's preference for B
  if (pA === 'BOYS' && gB !== 'MALE') return false;
  if (pA === 'GIRLS' && gB !== 'FEMALE') return false;

  // B's preference for A
  if (pB === 'BOYS' && gA !== 'MALE') return false;
  if (pB === 'GIRLS' && gA !== 'FEMALE') return false;

  return true;
}

export function isUniversityCompatible(
  targetUniA: string | null | undefined,
  actualUniB: string,
  targetUniB: string | null | undefined,
  actualUniA: string
): boolean {
  const tA = targetUniA ? targetUniA.trim() : null;
  const tB = targetUniB ? targetUniB.trim() : null;
  const aA = actualUniA ? actualUniA.trim() : '';
  const aB = actualUniB ? actualUniB.trim() : '';

  // If A specified a target university (not ANY or empty), partner must belong to it
  if (tA && tA !== 'ANY' && tA !== '' && tA !== aB) return false;
  // If B specified a target university (not ANY or empty), initiator must belong to it
  if (tB && tB !== 'ANY' && tB !== '' && tB !== aA) return false;

  return true;
}

// In-memory mutex lock for atomic matchmaking pairing
let matchmakingLock = false;

export async function attemptMatch(userId: string): Promise<MatchResult> {
  // Wait if another match resolution is in flight
  while (matchmakingLock) {
    await new Promise((res) => setTimeout(res, 50));
  }

  matchmakingLock = true;
  try {
    const userEntry = await db.matchQueue.findUnique({ where: { userId } });
    if (!userEntry || userEntry.status !== 'WAITING') {
      return { matched: false, reason: 'NOT_IN_QUEUE' };
    }

    // Check credit balance before attempting match
    const balance = await getUserBalance(userId);
    if (balance < 1) {
      await db.matchQueue.delete({ where: { userId } });
      return { matched: false, reason: 'INSUFFICIENT_CREDITS' };
    }

    const now = new Date();
    // Fetch all active waiting candidates
    const allWaiting = await db.matchQueue.findMany({ where: { status: 'WAITING' } });

    // Filter out expired or self entries
    const candidates = allWaiting.filter((entry) => {
      if (entry.userId === userId) return false;
      if (new Date(entry.expiresAt) < now) return false;
      return true;
    });

    // Check blocking relations
    const userBlocks = await db.block.findMany({ where: { blockerId: userId } });
    const blockedBy = await db.block.findMany({ where: { blockedId: userId } });
    const blockedIds = new Set([
      ...userBlocks.map((b) => b.blockedId),
      ...blockedBy.map((b) => b.blockerId),
    ]);

    let matchedPartnerEntry: MatchQueueEntry | null = null;

    for (const candidate of candidates) {
      if (blockedIds.has(candidate.userId)) continue;

      // Verify candidate has credits
      const candidateBalance = await getUserBalance(candidate.userId);
      if (candidateBalance < 1) continue;

      // Check gender compatibility
      if (
        !isGenderCompatible(
          userEntry.userGender,
          userEntry.preferredPartnerGender,
          candidate.userGender,
          candidate.preferredPartnerGender
        )
      ) {
        continue;
      }

      // Check university compatibility
      if (
        !isUniversityCompatible(
          userEntry.targetUniversityId,
          candidate.universityId,
          candidate.targetUniversityId,
          userEntry.universityId
        )
      ) {
        continue;
      }

      // Found a matching partner!
      matchedPartnerEntry = candidate;
      break;
    }

    if (!matchedPartnerEntry) {
      return { matched: false, reason: 'NO_COMPATIBLE_STUDENT_FOUND' };
    }

    // Atomically create single signed conversation for both students
    const conversationId = generateSignedConversationId(userId, matchedPartnerEntry.userId);
    const conversation = await db.conversation.create({
      data: {
        id: conversationId,
        status: 'ACTIVE',
        creditDeducted: true,
      } as any,
    });

    // Ensure both participants are registered
    await ensureConversationAndParticipants(conversationId, userId, matchedPartnerEntry.userId);

    // Atomically deduct 1 credit from each participant
    await deductCreditForConversation({ userId, conversationId: conversation.id });
    await deductCreditForConversation({
      userId: matchedPartnerEntry.userId,
      conversationId: conversation.id,
    });

    // Update partner's queue entry with MATCHED status and the conversation ID
    // CRITICAL: DO NOT delete partner's queue entry yet; partner's browser will poll or stream this!
    await db.matchQueue.update({
      where: { userId: matchedPartnerEntry.userId },
      data: {
        status: 'MATCHED',
        matchedConversationId: conversation.id,
        matchedPartnerId: userId,
      },
    });

    // Remove initiating user from active queue
    await db.matchQueue.delete({ where: { userId } }).catch(() => {});

    // Fetch partner profile & university for response
    const partnerProfile = await db.profile.findUnique({ where: { userId: matchedPartnerEntry.userId } });
    const partnerUni = await db.university.findUnique({ where: { id: matchedPartnerEntry.universityId } });

    // Fetch initiator profile & university for partner notification
    const userProfile = await db.profile.findUnique({ where: { userId } });
    const userUni = userEntry.universityId ? await db.university.findUnique({ where: { id: userEntry.universityId } }) : null;

    const partnerDataForInitiator = {
      id: matchedPartnerEntry.userId,
      displayName: partnerProfile?.displayName || 'Student',
      universityName: partnerUni?.name || 'Verified University',
      course: partnerProfile?.course,
      academicYear: partnerProfile?.academicYear,
      avatarUrl: partnerProfile?.avatarUrl,
    };

    const initiatorDataForPartner = {
      id: userId,
      displayName: userProfile?.displayName || 'Student',
      universityName: userUni?.name || 'Verified University',
      course: userProfile?.course,
      academicYear: userProfile?.academicYear,
      avatarUrl: userProfile?.avatarUrl,
    };

    // Broadcast instant real-time events to both students
    broadcastMatchFound(matchedPartnerEntry.userId, {
      matched: true,
      conversationId: conversation.id,
      partner: initiatorDataForPartner,
    });

    broadcastMatchFound(userId, {
      matched: true,
      conversationId: conversation.id,
      partner: partnerDataForInitiator,
    });

    return {
      matched: true,
      conversationId: conversation.id,
      partner: partnerDataForInitiator,
    };
  } finally {
    matchmakingLock = false;
  }
}

export async function expireStaleQueueEntries() {
  const now = new Date();
  const queue = await db.matchQueue.findMany({ where: { status: 'WAITING' } });
  for (const entry of queue) {
    if (new Date(entry.expiresAt) < now) {
      await db.matchQueue.delete({ where: { userId: entry.userId } });
    }
  }
}
