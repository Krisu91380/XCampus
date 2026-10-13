import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { generateSignedConversationId, ensureConversationAndParticipants } from '@/lib/conversation';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);

    // 1. Ensure all accepted friends have deterministic conversations & participants in database
    const allFriendRequests = await db.friendRequest.findMany();
    const myAcceptedFriendships = allFriendRequests.filter(
      (r) =>
        r.status === 'ACCEPTED' &&
        (r.senderId === session.userId || r.receiverId === session.userId)
    );

    for (const fr of myAcceptedFriendships) {
      const partnerId = fr.senderId === session.userId ? fr.receiverId : fr.senderId;

      // Skip if blocked
      const isBlocked = await db.block.findFirst({
        where: { blockerId: session.userId, blockedId: partnerId },
      });
      const isBlockedBy = await db.block.findFirst({
        where: { blockerId: partnerId, blockedId: session.userId },
      });
      if (isBlocked || isBlockedBy) continue;

      const convId = generateSignedConversationId(session.userId, partnerId);
      await ensureConversationAndParticipants(convId, session.userId, partnerId);
    }

    const participations = await db.conversationParticipant.findMany({
      where: { userId: session.userId },
    });

    const conversations = [];
    const seenPartnerIds = new Set<string>();
    const seenConvIds = new Set<string>();

    for (const p of participations) {
      if (p.hidden) continue;
      if (seenConvIds.has(p.conversationId)) continue;

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

      seenConvIds.add(conv.id);
      if (partnerInfo?.id) {
        seenPartnerIds.add(partnerInfo.id);
      }

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

    // 2. Guarantee that every accepted friend appears in conversations list even before first message
    for (const fr of myAcceptedFriendships) {
      const partnerId = fr.senderId === session.userId ? fr.receiverId : fr.senderId;
      if (seenPartnerIds.has(partnerId)) continue;

      const isBlocked = await db.block.findFirst({
        where: { blockerId: session.userId, blockedId: partnerId },
      });
      const isBlockedBy = await db.block.findFirst({
        where: { blockerId: partnerId, blockedId: session.userId },
      });
      if (isBlocked || isBlockedBy) continue;

      const convId = generateSignedConversationId(session.userId, partnerId);
      const partnerUser = await db.user.findUnique({ where: { id: partnerId } });
      const partnerProfile = await db.profile.findUnique({ where: { userId: partnerId } });
      const partnerUni = partnerUser?.universityId
        ? await db.university.findUnique({ where: { id: partnerUser.universityId } })
        : null;

      const messages = await db.message.findMany({
        where: { conversationId: convId },
        orderBy: { createdAt: 'desc' },
      });
      const lastMessage = messages[0] || null;

      conversations.push({
        id: convId,
        status: 'ACTIVE',
        startedAt: fr.updatedAt || fr.createdAt || new Date().toISOString(),
        endedAt: null,
        partner: {
          id: partnerId,
          displayName: partnerProfile?.displayName || 'Student',
          avatarUrl: partnerProfile?.avatarUrl,
          course: partnerProfile?.course,
          branch: partnerProfile?.branch,
          academicYear: partnerProfile?.academicYear,
          semester: partnerProfile?.semester,
          isOnline: partnerProfile?.isOnline || false,
          isVerified: partnerUser?.role === 'VERIFIED_STUDENT',
          isFriend: true,
          universityName: partnerUni?.name || 'University',
          universityCode: partnerUni?.code || 'UNI',
        },
        lastMessage: lastMessage
          ? {
              content: lastMessage.content,
              createdAt: lastMessage.createdAt,
              isMine: lastMessage.senderId === session.userId,
            }
          : null,
        hasUnread: false,
        unreadCount: 0,
      });

      seenPartnerIds.add(partnerId);
      seenConvIds.add(convId);
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
