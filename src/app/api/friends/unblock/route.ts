import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const body = await req.json();
    const targetUserId = body.targetUserId || body.userId;

    if (!targetUserId) {
      return NextResponse.json(
        { success: false, message: 'Invalid target user to unblock.' },
        { status: 400 }
      );
    }

    await db.block.delete({
      where: {
        blockerId: session.userId,
        blockedId: targetUserId,
      },
    });

    db.store.saveToDisk();

    return NextResponse.json({
      success: true,
      message: 'Student unblocked successfully.',
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to unblock student.' },
      { status: 500 }
    );
  }
}
