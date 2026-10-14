import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { broadcastEndConversation } from '@/lib/events';
import { clearSignals } from '@/lib/signaling';
import { invalidateConversationCache } from '@/lib/conversation';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const body = await req.json();
    const targetUserId = body.targetUserId || body.userId;

    if (!targetUserId || targetUserId === session.userId) {
      return NextResponse.json(
        { success: false, message: 'Invalid target user to block.' },
        { status: 400 }
      );
    }

    // 1. Create block record in database
    await db.block.create({
      data: {
        blockerId: session.userId,
        blockedId: targetUserId,
      },
    });

    // 2. Remove / decline any friend requests between these two users
    const allReqs = await db.friendRequest.findMany();
    for (const r of allReqs) {
      if (
        (r.senderId === session.userId && r.receiverId === targetUserId) ||
        (r.senderId === targetUserId && r.receiverId === session.userId)
      ) {
        await db.friendRequest.update({
          where: { id: r.id },
          data: { status: 'DECLINED' },
        });
      }
    }

    // 3. Find and terminate any active conversations between the two users
    const myParts = await db.conversationParticipant.findMany({
      where: { userId: session.userId },
    });
    for (const part of myParts) {
      const allParts = await db.conversationParticipant.findMany({
        where: { conversationId: part.conversationId },
      });
      const partner = allParts.find((p) => p.userId === targetUserId);
      if (partner) {
        const conv = await db.conversation.findUnique({
          where: { id: part.conversationId },
        });
        if (conv && conv.status === 'ACTIVE') {
          await db.conversation.update({
            where: { id: conv.id },
            data: {
              status: 'ENDED',
              endedAt: new Date(),
              endedByUserId: session.userId,
              endReason: 'USER_BLOCKED',
            },
          });
          broadcastEndConversation(conv.id, session.userId, 'USER_BLOCKED');
          clearSignals(conv.id);
        }
      }
    }

    // 4. Remove target from matchQueue if actively waiting
    const queueEntry = await db.matchQueue.findUnique({ where: { userId: session.userId } });
    if (queueEntry && queueEntry.status === 'WAITING') {
      // Keep session in queue but they will not pair with targetUser
    }

    invalidateConversationCache();
    db.store.saveToDisk();

    return NextResponse.json({
      success: true,
      message: 'Student blocked successfully. They can no longer match, message, or call you.',
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to block student.' },
      { status: 500 }
    );
  }
}
