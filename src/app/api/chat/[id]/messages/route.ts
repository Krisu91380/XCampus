import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { sendMessageSchema } from '@/validators/chat';
import { db } from '@/lib/db';
import { broadcastMessage } from '@/lib/events';
import { APP_CONFIG } from '@/lib/config';
import { verifyAndResolveParticipants, isConnectionPermitted } from '@/lib/conversation';

// In-memory rate limiting map: userId -> lastMessageTimestamp
const userMessageRateMap = new Map<string, number>();

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth(req);
    const conversationId = params.id;

    // Verify participant authorization (IDOR protection & signed recovery)
    const verified = await verifyAndResolveParticipants(conversationId, session.userId);
    if (!verified) {
      return NextResponse.json(
        { success: false, message: 'Access denied. You are not a participant in this conversation.' },
        { status: 403 }
      );
    }

    // Verify friendship or matchmaking permission
    const perm = await isConnectionPermitted(session.userId, verified.partnerId, conversationId);
    if (!perm.permitted) {
      return NextResponse.json(
        { success: false, message: perm.reason || 'Friend request must be accepted first.' },
        { status: 403 }
      );
    }

    let conv = await db.conversation.findUnique({ where: { id: conversationId } });
    if (!conv) {
      conv = await db.conversation.create({
        data: {
          id: conversationId,
          status: 'ACTIVE',
          creditDeducted: true,
        } as any,
      });
    }

    // Mark unread as false for this participant and get clearedAt
    const myParticipant = await db.conversationParticipant.findFirst({
      where: { conversationId, userId: session.userId },
    });

    await db.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: session.userId } },
      data: { hasUnread: false },
    }).catch(() => {});

    const messages = await db.message.findMany({
      where: {
        conversationId,
        afterTimestamp: myParticipant?.clearedAt || undefined,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Partner details
    const partnerId = verified.partnerId;
    let partner = null;
    if (partnerId) {
      const pProfile = await db.profile.findUnique({ where: { userId: partnerId } });
      const pUser = await db.user.findUnique({ where: { id: partnerId } });
      const pUni = pUser?.universityId
        ? await db.university.findUnique({ where: { id: pUser.universityId } })
        : null;

      const isFriend = Boolean(
        await db.friendRequest.findFirst({
          where: {
            senderId: session.userId,
            receiverId: partnerId,
            status: 'ACCEPTED',
          },
        }) ||
        await db.friendRequest.findFirst({
          where: {
            senderId: partnerId,
            receiverId: session.userId,
            status: 'ACCEPTED',
          },
        })
      );

      partner = {
        id: partnerId,
        displayName: pProfile?.displayName || 'Student',
        gender: pProfile?.gender,
        avatarUrl: pProfile?.avatarUrl,
        course: pProfile?.course,
        branch: pProfile?.branch,
        academicYear: pProfile?.academicYear,
        semester: pProfile?.semester,
        bio: pProfile?.bio,
        interests: pProfile?.interests,
        skills: pProfile?.skills,
        isOnline: pProfile?.isOnline || false,
        isVerified: pUser?.role === 'VERIFIED_STUDENT',
        isFriend,
        universityName: pUni?.name || 'University',
        universityCode: pUni?.code || 'UNI',
      };
    }

    return NextResponse.json({
      success: true,
      conversation: {
        id: conv.id,
        status: conv.status,
        startedAt: conv.startedAt,
        endedAt: conv.endedAt,
        partner,
      },
      messages: messages.map((m) => ({
        id: m.id,
        senderId: m.senderId,
        content: m.content,
        isRead: m.isRead,
        createdAt: m.createdAt,
        isMine: m.senderId === session.userId,
      })),
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth(req);
    const conversationId = params.id;

    // Verify participant authorization (IDOR protection & signed recovery)
    const verified = await verifyAndResolveParticipants(conversationId, session.userId);
    if (!verified) {
      return NextResponse.json(
        { success: false, message: 'Access denied. You are not a participant in this conversation.' },
        { status: 403 }
      );
    }

    // Verify friendship or matchmaking permission
    const perm = await isConnectionPermitted(session.userId, verified.partnerId, conversationId);
    if (!perm.permitted) {
      return NextResponse.json(
        { success: false, message: perm.reason || 'Friend request must be accepted first.' },
        { status: 403 }
      );
    }

    const conv = await db.conversation.findUnique({ where: { id: conversationId } });
    if (!conv || conv.status !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, message: 'This conversation has ended. No further messages can be sent.' },
        { status: 400 }
      );
    }

    // Rate limiting: 1 message per 400ms per user
    const lastSent = userMessageRateMap.get(session.userId) || 0;
    const now = Date.now();
    if (now - lastSent < 400) {
      return NextResponse.json(
        { success: false, message: 'You are sending messages too quickly. Please slow down.' },
        { status: 429 }
      );
    }
    userMessageRateMap.set(session.userId, now);

    const body = await req.json();
    const validated = sendMessageSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { success: false, errors: validated.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Sanitize message content
    const sanitizedContent = validated.data.content
      .replace(/<[^>]*>?/gm, '') // Strip HTML tags
      .slice(0, APP_CONFIG.maxMessageLength);

    const message = await db.message.create({
      data: {
        conversationId,
        senderId: session.userId,
        content: sanitizedContent,
        isRead: false,
      },
    });

    // Mark unread for other participant and ensure chat is not hidden
    const otherParticipants = (await db.conversationParticipant.findMany({
      where: { conversationId },
    })).filter((x) => x.userId !== session.userId);

    for (const other of otherParticipants) {
      await db.conversationParticipant.update({
        where: { conversationId_userId: { conversationId, userId: other.userId } },
        data: { hasUnread: true, hidden: false },
      });
    }

    // Unhide for current user if they previously hid it
    await db.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: session.userId } },
      data: { hidden: false },
    });

    // Broadcast in real-time
    broadcastMessage(conversationId, message);

    return NextResponse.json({
      success: true,
      message: {
        id: message.id,
        senderId: message.senderId,
        content: message.content,
        createdAt: message.createdAt,
        isMine: true,
      },
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
