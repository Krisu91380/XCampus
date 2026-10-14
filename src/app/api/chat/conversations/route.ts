import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { generateSignedConversationId, ensureConversationAndParticipants } from '@/lib/conversation';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);

    // 1. Fetch friend requests and user's participations in parallel
    const [allFriendRequests, participations, userBlocks, partnerBlocks] = await Promise.all([
      db.friendRequest.findMany(),
      db.conversationParticipant.findMany({ where: { userId: session.userId } }),
      db.block.findMany({ where: { blockerId: session.userId } }),
      db.block.findMany({ where: { blockedId: session.userId } }),
    ]);

    const blockedUserIds = new Set<string>([
      ...userBlocks.map((b) => b.blockedId),
      ...partnerBlocks.map((b) => b.blockerId),
    ]);

    const myAcceptedFriendships = allFriendRequests.filter(
      (r) =>
        r.status === 'ACCEPTED' &&
        (r.senderId === session.userId || r.receiverId === session.userId)
    );

    // Fast ensure for friends not in blocked list
    for (const fr of myAcceptedFriendships) {
      const partnerId = fr.senderId === session.userId ? fr.receiverId : fr.senderId;
      if (blockedUserIds.has(partnerId)) continue;
      const convId = generateSignedConversationId(session.userId, partnerId);
      // Ensure conversation asynchronously or in-memory
      ensureConversationAndParticipants(convId, session.userId, partnerId).catch(() => {});
    }

    const conversations = [];
    const seenPartnerIds = new Set<string>();
    const seenConvIds = new Set<string>();

    // 2. Process active participations in parallel
    const validParticipations = participations.filter((p) => !p.hidden);

    const convDetails = await Promise.all(
      validParticipations.map(async (p) => {
        if (seenConvIds.has(p.conversationId)) return null;

        const [conv, allParts, latestMessages] = await Promise.all([
          db.conversation.findUnique({ where: { id: p.conversationId } }),
          db.conversationParticipant.findMany({ where: { conversationId: p.conversationId } }),
          db.message.findMany({
            where: {
              conversationId: p.conversationId,
              afterTimestamp: p.clearedAt || undefined,
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          }),
        ]);

        if (!conv) return null;
        const partnerPart = allParts.find((x) => x.userId !== session.userId);
        if (!partnerPart || blockedUserIds.has(partnerPart.userId)) return null;

        const [partnerUser, partnerProfile] = await Promise.all([
          db.user.findUnique({ where: { id: partnerPart.userId } }),
          db.profile.findUnique({ where: { userId: partnerPart.userId } }),
        ]);

        let partnerUni = null;
        if (partnerUser?.universityId) {
          partnerUni = await db.university.findUnique({ where: { id: partnerUser.universityId } });
        }

        const isFriend = myAcceptedFriendships.some(
          (fr) =>
            (fr.senderId === session.userId && fr.receiverId === partnerPart.userId) ||
            (fr.senderId === partnerPart.userId && fr.receiverId === session.userId)
        );

        const lastMessage = latestMessages[0] || null;

        return {
          id: conv.id,
          status: conv.status,
          startedAt: conv.startedAt,
          endedAt: conv.endedAt,
          partner: {
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
          },
          lastMessage: lastMessage
            ? {
                content: lastMessage.content,
                createdAt: lastMessage.createdAt,
                isMine: lastMessage.senderId === session.userId,
              }
            : null,
          hasUnread: Boolean(p.hasUnread),
          unreadCount: p.hasUnread ? 1 : 0,
        };
      })
    );

    for (const item of convDetails) {
      if (item) {
        conversations.push(item);
        seenConvIds.add(item.id);
        if (item.partner?.id) seenPartnerIds.add(item.partner.id);
      }
    }

    // 3. Guarantee that every accepted friend appears in conversations list even before first message
    for (const fr of myAcceptedFriendships) {
      const partnerId = fr.senderId === session.userId ? fr.receiverId : fr.senderId;
      if (seenPartnerIds.has(partnerId) || blockedUserIds.has(partnerId)) continue;

      const convId = generateSignedConversationId(session.userId, partnerId);
      if (seenConvIds.has(convId)) continue;

      const [partnerUser, partnerProfile, latestMessages] = await Promise.all([
        db.user.findUnique({ where: { id: partnerId } }),
        db.profile.findUnique({ where: { userId: partnerId } }),
        db.message.findMany({
          where: { conversationId: convId },
          orderBy: { createdAt: 'desc' },
          take: 1,
        }),
      ]);

      let partnerUni = null;
      if (partnerUser?.universityId) {
        partnerUni = await db.university.findUnique({ where: { id: partnerUser.universityId } });
      }

      const lastMessage = latestMessages[0] || null;

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
