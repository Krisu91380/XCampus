import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { blockUserSchema } from '@/validators/chat';
import { db } from '@/lib/db';
import { broadcastEndConversation } from '@/lib/events';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth(req);
    const conversationId = params.id;
    const body = await req.json();
    const validated = blockUserSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { success: false, errors: validated.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { blockedId } = validated.data;
    if (blockedId === session.userId) {
      return NextResponse.json({ success: false, message: 'You cannot block yourself.' }, { status: 400 });
    }

    // Create block entry
    await db.block.create({
      data: {
        blockerId: session.userId,
        blockedId,
      },
    });

    // Also automatically end the active conversation
    const conv = await db.conversation.findUnique({ where: { id: conversationId } });
    if (conv && conv.status === 'ACTIVE') {
      await db.conversation.update({
        where: { id: conversationId },
        data: {
          status: 'ENDED',
          endedAt: new Date(),
          endedByUserId: session.userId,
          endReason: 'USER_BLOCKED',
        },
      });
      broadcastEndConversation(conversationId, session.userId, 'USER_BLOCKED');
    }

    return NextResponse.json({
      success: true,
      message: 'User blocked successfully. They will not be able to match or message you again.',
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
