import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { getActiveCallSignal } from '@/lib/signaling';
import { isConnectionPermitted } from '@/lib/conversation';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ hasIncomingCall: false });
    }

    const participations = await db.conversationParticipant.findMany({
      where: { userId: session.userId },
    });

    for (const p of participations) {
      const activeSignal = await getActiveCallSignal(p.conversationId, session.userId);
      if (activeSignal) {
        const callerId = activeSignal.fromUserId;

        // Verify caller is not blocked and is authorized to call current user
        const perm = await isConnectionPermitted(callerId, session.userId, p.conversationId);
        if (!perm.permitted) {
          continue;
        }

        // Fetch caller info
        const callerUser = await db.user.findUnique({ where: { id: callerId } });
        const callerProfile = await db.profile.findUnique({ where: { userId: callerId } });
        const callerUni = callerUser?.universityId
          ? await db.university.findUnique({ where: { id: callerUser.universityId } })
          : null;

        return NextResponse.json({
          hasIncomingCall: true,
          call: {
            conversationId: p.conversationId,
            callerId,
            callerName: callerProfile?.displayName || 'Student',
            callerAvatar: callerProfile?.avatarUrl || null,
            callerUniversity: callerUni?.name || 'Verified Student',
            isVideo: true,
            createdAt: activeSignal.createdAt,
          },
        });
      }
    }

    return NextResponse.json({ hasIncomingCall: false });
  } catch (error: any) {
    return NextResponse.json({ hasIncomingCall: false, error: error.message }, { status: 500 });
  }
}
