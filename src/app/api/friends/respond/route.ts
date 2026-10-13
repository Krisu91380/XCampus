import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { generateSignedConversationId, ensureConversationAndParticipants } from '@/lib/conversation';
import { deductCreditForConversation } from '@/lib/ledger';

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const body = await req.json();
    const { requestId, action } = body;

    if (!requestId || !['ACCEPT', 'DECLINE'].includes(action)) {
      return NextResponse.json(
        { success: false, message: 'Invalid request ID or action.' },
        { status: 400 }
      );
    }

    const friendReq = await db.friendRequest.findUnique({ where: { id: requestId } });
    if (!friendReq) {
      return NextResponse.json({ success: false, message: 'Friend request not found.' }, { status: 404 });
    }

    // Verify current user is the recipient of the request
    if (friendReq.receiverId !== session.userId) {
      return NextResponse.json(
        { success: false, message: 'Forbidden. You are not the recipient of this request.' },
        { status: 403 }
      );
    }

    if (action === 'DECLINE') {
      const updated = await db.friendRequest.update({
        where: { id: friendReq.id },
        data: { status: 'DECLINED' },
      });
      return NextResponse.json({
        success: true,
        status: 'DECLINED',
        message: 'Friend request declined.',
        request: updated,
      });
    }

    // ACCEPT action
    const updated = await db.friendRequest.update({
      where: { id: friendReq.id },
      data: { status: 'ACCEPTED' },
    });

    // Create deterministic signed conversation
    const conversationId = generateSignedConversationId(friendReq.senderId, friendReq.receiverId);
    await ensureConversationAndParticipants(conversationId, friendReq.senderId, friendReq.receiverId);

    // Atomically deduct 1 credit for establishing the connection (idempotent, only if not yet deducted)
    await deductCreditForConversation({
      userId: friendReq.senderId,
      conversationId,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      status: 'ACCEPTED',
      message: 'Friend request accepted! Private conversation and calling are now unlocked.',
      conversationId,
      request: updated,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
