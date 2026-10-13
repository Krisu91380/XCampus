import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

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

    // 1. If requestId provided, find by id
    let friendReq = requestId
      ? await db.friendRequest.findUnique({ where: { id: requestId } })
      : null;

    // 2. Find request between current user and target user
    if (!friendReq && targetUserId) {
      friendReq =
        (await db.friendRequest.findFirst({
          where: { senderId: session.userId, receiverId: targetUserId },
        })) ||
        (await db.friendRequest.findFirst({
          where: { senderId: targetUserId, receiverId: session.userId },
        }));
    }

    if (friendReq) {
      // Mark as DECLINED / un-friended
      await db.friendRequest.update({
        where: { id: friendReq.id },
        data: { status: 'DECLINED' },
      });
      db.store.saveToDisk();
    }

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
