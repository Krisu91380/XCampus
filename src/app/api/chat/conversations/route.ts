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
      if (p.hidden) continue;

      const conv = await db.conversation.findUnique({ where: { id: p.conversationId } });
      if (!conv) continue;

      // Find partner
      const allParts = await db.conversationParticipant.findMany({
        where: { conversationId: conv.id },
      });
      const partnerPart = allParts.find((x) => x.userId !== session.userId);

      let partnerInfo = null;
      if (partnerPart) {
        // Check if either user blocked the other
        const isBlocked = await db.block.findFirst({
          where: { blockerId: session.userId, blockedId: partnerPart.userId },
        });
        const isBlockedBy = await db.block.findFirst({
          where: { blockerId: partnerPart.userId, blockedId: session.userId },
        });
        if (isBlocked || isBlockedBy) continue;

        const partnerUser = await db.user.findUnique({ where: { id: partnerPart.userId } });
        const partnerProfile = await db.profile.findUnique({ where: { userId: partnerPart.userId } });
        const partnerUni = partnerUser?.universityId
          ? await db.university.findUnique({ where: { id: partnerUser.universityId } })
          : null;

        const isFriend = Boolean(
          await db.friendRequest.findFirst({
            where: {
              senderId: session.userId,
              receiverId: partnerPart.userId,
              status: 'ACCEPTED',
            },
          }) ||
          await db.friendRequest.findFirst({
            where: {
              senderId: partnerPart.userId,
              receiverId: session.userId,
              status: 'ACCEPTED',
            },
          })
        );

        partnerInfo = {
          id: partnerPart.userId,
          displayName: partnerProfile?.displayName || 'Student',
          avatarUrl: partnerProfile?.avatarUrl,
          course: partnerProfile?.course,
          branch: partnerProfile?.branch,
          academicYear: partnerProfile?.academicYear,
          semester: partnerProfile?.semester,
          isOnline: partnerProfile?.isOnline || false,
          isVerified: partnerUser?.role === 'VERIFIED_STUDENT',
          isFriend,
          universityName: partnerUni?.name || 'University',
          universityCode: partnerUni?.code || 'UNI',
        };
      }

      // Fetch messages ordered desc to get latest (respecting clearedAt if chat was previously cleared)
      const messages = await db.message.findMany({
        where: {
          conversationId: conv.id,
          afterTimestamp: p.clearedAt || undefined,
        },
        orderBy: { createdAt: 'desc' },
      });
      const lastMessage = messages[0] || null;
      const unreadCount = messages.filter((m) => m.senderId !== session.userId && !m.isRead).length;

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
        hasUnread: p.hasUnread || unreadCount > 0,
        unreadCount: unreadCount > 0 ? unreadCount : p.hasUnread ? 1 : 0,
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
