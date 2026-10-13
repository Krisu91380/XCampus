import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);

    const participations = await db.conversationParticipant.findMany({
      where: { userId: session.userId },
    });

    const conversations = [];

    for (const p of participations) {
      const conv = await db.conversation.findUnique({ where: { id: p.conversationId } });
      if (!conv) continue;

      // Find partner
      const allParts = await db.conversationParticipant.findMany({
        where: { conversationId: conv.id },
      });
      const partnerPart = allParts.find((x) => x.userId !== session.userId);

      let partnerInfo = null;
      if (partnerPart) {
        const partnerUser = await db.user.findUnique({ where: { id: partnerPart.userId } });
        const partnerProfile = await db.profile.findUnique({ where: { userId: partnerPart.userId } });
        const partnerUni = partnerUser?.universityId
          ? await db.university.findUnique({ where: { id: partnerUser.universityId } })
          : null;

        partnerInfo = {
          id: partnerPart.userId,
          displayName: partnerProfile?.displayName || 'Student',
          avatarUrl: partnerProfile?.avatarUrl,
          course: partnerProfile?.course,
          academicYear: partnerProfile?.academicYear,
          isOnline: partnerProfile?.isOnline || false,
          isVerified: partnerUser?.role === 'VERIFIED_STUDENT',
          universityName: partnerUni?.name || 'University',
          universityCode: partnerUni?.code || 'UNI',
        };
      }

      // Fetch last message
      const messages = await db.message.findMany({
        where: { conversationId: conv.id },
        orderBy: { createdAt: 'desc' },
      });
      const lastMessage = messages[messages.length - 1] || null;

      conversations.push({
        id: conv.id,
        status: conv.status,
        startedAt: conv.startedAt,
        endedAt: conv.endedAt,
        partner: partnerInfo,
        lastMessage: lastMessage
          ? {
              content: lastMessage.content,
              createdAt: lastMessage.createdAt,
              isMine: lastMessage.senderId === session.userId,
            }
          : null,
        hasUnread: p.hasUnread,
      });
    }

    // Sort by most recent activity
    conversations.sort((a, b) => {
      const timeA = new Date(a.lastMessage?.createdAt || a.startedAt).getTime();
      const timeB = new Date(b.lastMessage?.createdAt || b.startedAt).getTime();
      return timeB - timeA;
    });

    return NextResponse.json({ success: true, conversations });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
