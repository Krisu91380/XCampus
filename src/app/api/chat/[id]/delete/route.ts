import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { verifyAndResolveParticipants } from '@/lib/conversation';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth(req);
    const conversationId = decodeURIComponent(params.id);

    const verified = await verifyAndResolveParticipants(conversationId, session.userId);
    if (!verified) {
      return NextResponse.json(
        { success: false, message: 'Access denied. You are not a participant in this conversation.' },
        { status: 403 }
      );
    }

    // Mark current user's participant record as hidden and set clearedAt to now
    // This hides the conversation only for current user and clears past message history for them,
    // while preserving the partner's chat history untouched.
    const existingPart = await db.conversationParticipant.findFirst({
      where: {
        conversationId,
        userId: session.userId,
      },
    });

    if (existingPart) {
      await db.conversationParticipant.update({
        where: { id: existingPart.id },
        data: {
          hidden: true,
          clearedAt: new Date(),
          hasUnread: false,
        },
      });
    } else {
      await db.conversationParticipant.create({
        data: {
          conversationId,
          userId: session.userId,
          hidden: true,
          clearedAt: new Date(),
          hasUnread: false,
        },
      });
    }

    db.store.saveToDisk();

    return NextResponse.json({
      success: true,
      message: 'Conversation deleted successfully.',
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to delete chat.' },
      { status: 500 }
    );
  }
}
