import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { invalidateConversationCache } from '@/lib/conversation';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const body = await req.json();
    const targetUserId = body.targetUserId || body.userId;
    const requestId = body.requestId;

    if (!targetUserId && !requestId) {
      return NextResponse.json(
        { success: false, message: 'Invalid target friend.' },
        { status: 400 }
      );
    }

    if (targetUserId) {
      const allRequests = await db.friendRequest.findMany({
        where: {
          OR: [
            { senderId: session.userId, receiverId: targetUserId },
            { senderId: targetUserId, receiverId: session.userId },
          ],
        },
      });
      for (const fr of allRequests) {
        await db.friendRequest.update({
          where: { id: fr.id },
          data: { status: 'DECLINED' },
        });
      }
    }

    if (requestId) {
      await db.friendRequest.update({
        where: { id: requestId },
        data: { status: 'DECLINED' },
      }).catch(() => {});
    }

    // Invalidate permission cache so new messages/calls are blocked immediately
    invalidateConversationCache();
    db.store.saveToDisk();

    return NextResponse.json({
      success: true,
      message: 'Friend removed successfully.',
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to remove friend.' },
      { status: 500 }
    );
  }
}
