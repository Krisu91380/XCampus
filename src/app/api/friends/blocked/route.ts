import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);

    const blocks = await db.block.findMany({
      where: { blockerId: session.userId },
    });

    const blockedUsers = [];
    for (const b of blocks) {
      const user = await db.user.findUnique({ where: { id: b.blockedId } });
      const profile = await db.profile.findUnique({ where: { userId: b.blockedId } });
      const uni = user?.universityId
        ? await db.university.findUnique({ where: { id: user.universityId } })
        : null;

      blockedUsers.push({
        blockId: b.id,
        userId: b.blockedId,
        displayName: profile?.displayName || 'Student',
        avatarUrl: profile?.avatarUrl || null,
        course: profile?.course || null,
        universityName: uni?.name || 'University',
        blockedAt: b.createdAt,
      });
    }

    return NextResponse.json({
      success: true,
      blockedUsers,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch blocked users.' },
      { status: 500 }
    );
  }
}
