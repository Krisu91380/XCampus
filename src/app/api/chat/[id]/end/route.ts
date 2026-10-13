import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { broadcastEndConversation } from '@/lib/events';
import { verifyAndResolveParticipants } from '@/lib/conversation';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth(req);
    const conversationId = params.id;

    // Check participation
    const verified = await verifyAndResolveParticipants(conversationId, session.userId);
    if (!verified) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
    }

    const conv = await db.conversation.findUnique({ where: { id: conversationId } });
    if (!conv) {
      return NextResponse.json({ success: false, message: 'Conversation not found' }, { status: 404 });
    }

    if (conv.status === 'ENDED') {
      return NextResponse.json({ success: true, message: 'Conversation already ended' });
    }

    await db.conversation.update({
      where: { id: conversationId },
      data: {
        status: 'ENDED',
        endedAt: new Date(),
        endedByUserId: session.userId,
        endReason: 'USER_LEFT',
      },
    });

    broadcastEndConversation(conversationId, session.userId, 'USER_LEFT');

    return NextResponse.json({ success: true, message: 'Conversation ended.' });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
