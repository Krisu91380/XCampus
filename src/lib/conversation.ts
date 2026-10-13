import crypto from 'crypto';
import { db } from './db';

const SECRET_FALLBACK = 'campusconnect-secret-key-salt-91380';

function getSecret(): string {
  return process.env.JWT_SECRET || SECRET_FALLBACK;
}

/**
 * Generates a deterministic, cryptographically signed conversation ID for two users.
 * Both users will generate the exact same conversation ID regardless of who initiates.
 */
export function generateSignedConversationId(user1Id: string, user2Id: string): string {
  const sorted = [user1Id, user2Id].sort();
  const raw = `${sorted[0]}:${sorted[1]}`;
  const hmac = crypto
    .createHmac('sha256', getSecret())
    .update(raw)
    .digest('hex')
    .slice(0, 16);
  return `conv_${sorted[0]}__${sorted[1]}__${hmac}`;
}

export interface VerifiedConversation {
  valid: boolean;
  conversationId: string;
  user1Id: string;
  user2Id: string;
  partnerId: string;
  isSigned: boolean;
}

/**
 * Verifies if current user is an authorized participant in the conversation.
 * Handles both signed deterministic conversation IDs and legacy IDs.
 */
export async function verifyAndResolveParticipants(
  conversationId: string,
  currentUserId: string
): Promise<VerifiedConversation | null> {
  // 1. Check if it's a signed conversation ID format: conv_user1__user2__hmac
  if (conversationId.startsWith('conv_') && conversationId.includes('__')) {
    const parts = conversationId.replace(/^conv_/, '').split('__');
    if (parts.length === 3) {
      const [u1, u2, sig] = parts;
      const sorted = [u1, u2].sort();
      const expectedHmac = crypto
        .createHmac('sha256', getSecret())
        .update(`${sorted[0]}:${sorted[1]}`)
        .digest('hex')
        .slice(0, 16);
      const fallbackHmac = crypto
        .createHmac('sha256', SECRET_FALLBACK)
        .update(`${sorted[0]}:${sorted[1]}`)
        .digest('hex')
        .slice(0, 16);

      if (sig === expectedHmac || sig === fallbackHmac) {
        // Cryptographically verified! Now verify current user is one of the participants
        if (currentUserId === u1 || currentUserId === u2) {
          const partnerId = currentUserId === u1 ? u2 : u1;
          
          // Ensure registered in DB / memory store
          await ensureConversationAndParticipants(conversationId, u1, u2);

          return {
            valid: true,
            conversationId,
            user1Id: u1,
            user2Id: u2,
            partnerId,
            isSigned: true,
          };
        } else {
          // Attacker or unauthorized user attempting to access someone else's conversation
          return null;
        }
      }
    }
  }

  // 2. Fallback check in database for legacy or custom conversation IDs
  const myParticipant = await db.conversationParticipant.findFirst({
    where: { conversationId, userId: currentUserId },
  });

  if (myParticipant) {
    const allParticipants = await db.conversationParticipant.findMany({
      where: { conversationId },
    });
    const partner = allParticipants.find((p) => p.userId !== currentUserId);
    const partnerId = partner ? partner.userId : '';

    return {
      valid: true,
      conversationId,
      user1Id: currentUserId,
      user2Id: partnerId,
      partnerId,
      isSigned: false,
    };
  }

  return null;
}

/**
 * Ensures conversation and both participants exist in database/memory store.
 */
export async function ensureConversationAndParticipants(
  conversationId: string,
  user1Id: string,
  user2Id: string
) {
  try {
    let conv = await db.conversation.findUnique({ where: { id: conversationId } });
    if (!conv) {
      conv = await db.conversation.create({
        data: {
          id: conversationId,
          status: 'ACTIVE',
          creditDeducted: true,
        } as any,
      });
    }

    // Ensure participant 1
    const p1 = await db.conversationParticipant.findFirst({
      where: { conversationId, userId: user1Id },
    });
    if (!p1) {
      await db.conversationParticipant.create({
        data: {
          conversationId,
          userId: user1Id,
          hasUnread: false,
        },
      });
    }

    // Ensure participant 2
    const p2 = await db.conversationParticipant.findFirst({
      where: { conversationId, userId: user2Id },
    });
    if (!p2) {
      await db.conversationParticipant.create({
        data: {
          conversationId,
          userId: user2Id,
          hasUnread: false,
        },
      });
    }
  } catch (err) {
    console.warn('ensureConversationAndParticipants warning:', err);
  }
}

/**
 * Checks if communication (messages / calls) is permitted between two students:
 * Permitted if they have an ACCEPTED friend request OR were mutually matched.
 */
export async function isConnectionPermitted(
  user1Id: string,
  user2Id: string,
  conversationId: string
): Promise<{ permitted: boolean; reason?: string }> {
  // 0. Check if either user has blocked the other
  const block1 = await db.block.findFirst({
    where: { blockerId: user1Id, blockedId: user2Id },
  });
  const block2 = await db.block.findFirst({
    where: { blockerId: user2Id, blockedId: user1Id },
  });
  if (block1 || block2) {
    return {
      permitted: false,
      reason: 'Communication is blocked between these accounts.',
    };
  }

  // 1. Check if users are accepted friends
  const friendReq = await db.friendRequest.findFirst({
    where: {
      senderId: user1Id,
      receiverId: user2Id,
      status: 'ACCEPTED',
    },
  }) || await db.friendRequest.findFirst({
    where: {
      senderId: user2Id,
      receiverId: user1Id,
      status: 'ACCEPTED',
    },
  });

  if (friendReq) {
    return { permitted: true };
  }

  // 2. Check if mutual conversation was created via matchmaking
  const conv = await db.conversation.findUnique({ where: { id: conversationId } });
  if (conv && conv.status === 'ACTIVE') {
    const p1 = await db.conversationParticipant.findFirst({
      where: { conversationId, userId: user1Id },
    });
    const p2 = await db.conversationParticipant.findFirst({
      where: { conversationId, userId: user2Id },
    });
    if (p1 && p2) {
      return { permitted: true };
    }
  }

  return {
    permitted: false,
    reason: 'A friend request must be accepted before starting a private conversation or call.',
  };
}

