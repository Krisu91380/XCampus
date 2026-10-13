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

    const cleanId = String(requestId).trim();

    // 1. Look up by exact request ID
    let friendReq = await db.friendRequest.findUnique({ where: { id: cleanId } });

    // 2. Fallback: client might have passed the sender's user ID
    if (!friendReq) {
      friendReq = await db.friendRequest.findFirst({
        where: { senderId: cleanId, receiverId: session.userId },
      });
    }

    // 3. Fallback: client might have passed the receiver's user ID
    if (!friendReq) {
      friendReq = await db.friendRequest.findFirst({
        where: { senderId: session.userId, receiverId: cleanId },
      });
    }

    // 4. Fallback: Search all friend requests if still not found
    if (!friendReq) {
      const all = await db.friendRequest.findMany();
      friendReq = all.find(
        (r) =>
          r.id === cleanId ||
          (r.receiverId === session.userId && r.senderId === cleanId) ||
          (r.senderId === session.userId && r.receiverId === cleanId)
      ) || null;
    }

    if (!friendReq) {
      return NextResponse.json({ success: false, message: 'Friend request not found.' }, { status: 404 });
    }

    // Verify current user is a participant
    if (friendReq.receiverId !== session.userId && friendReq.senderId !== session.userId) {
      return NextResponse.json(
        { success: false, message: 'Forbidden. You are not a participant in this friend request.' },
        { status: 403 }
      );
    }

    // Handle already ACCEPTED
    if (friendReq.status === 'ACCEPTED') {
      const conversationId = generateSignedConversationId(friendReq.senderId, friendReq.receiverId);
      await ensureConversationAndParticipants(conversationId, friendReq.senderId, friendReq.receiverId);
      return NextResponse.json({
        success: true,
        status: 'ACCEPTED',
        alreadyProcessed: true,
        message: 'Friend request was already accepted! Private conversation is ready.',
        conversationId,
        request: friendReq,
      });
    }

    // Handle already DECLINED
    if (friendReq.status === 'DECLINED' && action === 'DECLINE') {
      return NextResponse.json({
        success: true,
        status: 'DECLINED',
        alreadyProcessed: true,
        message: 'Friend request was already declined.',
        request: friendReq,
      });
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
    console.error('Error in friends/respond:', error);
    return NextResponse.json({ success: false, message: error.message || 'Internal server error' }, { status: 500 });
  }
}
