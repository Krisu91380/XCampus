import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { sendMessageSchema } from '@/validators/chat';
import { db } from '@/lib/db';
import { broadcastMessage } from '@/lib/events';
import { APP_CONFIG } from '@/lib/config';

// In-memory rate limiting map: userId -> lastMessageTimestamp
const userMessageRateMap = new Map<string, number>();

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth(req);
    const conversationId = params.id;

    // Verify participant authorization (IDOR protection)
    const participant = await db.conversationParticipant.findFirst({
      where: { conversationId, userId: session.userId },
    });
    if (!participant) {
      return NextResponse.json(
        { success: false, message: 'Access denied. You are not a participant in this conversation.' },
        { status: 403 }
      );
    }

    const conv = await db.conversation.findUnique({ where: { id: conversationId } });
    if (!conv) {
      return NextResponse.json({ success: false, message: 'Conversation not found.' }, { status: 404 });
    }

    // Mark unread as false for this participant
    await db.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: session.userId } },
      data: { hasUnread: false },
    });

    const messages = await db.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });

    // Partner details
    const allParts = await db.conversationParticipant.findMany({ where: { conversationId } });
    const partnerPart = allParts.find((x) => x.userId !== session.userId);

    let partner = null;
    if (partnerPart) {
      const pProfile = await db.profile.findUnique({ where: { userId: partnerPart.userId } });
      const pUser = await db.user.findUnique({ where: { id: partnerPart.userId } });
      const pUni = pUser?.universityId
        ? await db.university.findUnique({ where: { id: pUser.universityId } })
        : null;

      partner = {
        id: partnerPart.userId,
        displayName: pProfile?.displayName || 'Student',
        gender: pProfile?.gender,
        avatarUrl: pProfile?.avatarUrl,
        course: pProfile?.course,
        academicYear: pProfile?.academicYear,
        isOnline: pProfile?.isOnline || false,
        isVerified: pUser?.role === 'VERIFIED_STUDENT',
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

    // Verify participant authorization
    const participant = await db.conversationParticipant.findFirst({
      where: { conversationId, userId: session.userId },
    });
    if (!participant) {
      return NextResponse.json(
        { success: false, message: 'Access denied. You are not a participant in this conversation.' },
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

    // Mark unread for other participant
    const otherParticipants = (await db.conversationParticipant.findMany({
      where: { conversationId },
    })).filter((x) => x.userId !== session.userId);

    for (const other of otherParticipants) {
      await db.conversationParticipant.update({
        where: { conversationId_userId: { conversationId, userId: other.userId } },
        data: { hasUnread: true },
      });
    }

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
