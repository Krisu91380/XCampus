import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { sendMessageSchema } from '@/validators/chat';
import { db } from '@/lib/db';
import { broadcastMessage } from '@/lib/events';
import { APP_CONFIG } from '@/lib/config';
import { verifyAndResolveParticipants, isConnectionPermitted } from '@/lib/conversation';

// In-memory rate limiting map: userId -> lastMessageTimestamp (150ms window)
const userMessageRateMap = new Map<string, number>();

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth(req);
    const conversationId = params.id;

    // Fast participant verification (utilizes in-memory cryptographic verification & cache)
    const verified = await verifyAndResolveParticipants(conversationId, session.userId);
    if (!verified) {
      return NextResponse.json(
        { success: false, message: 'Access denied. You are not a participant in this conversation.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const since = searchParams.get('since');
    const before = searchParams.get('before');
    const limitParam = parseInt(searchParams.get('limit') || '40', 10);
    const limit = Math.min(Math.max(limitParam, 1), 100);

    // =========================================================================
    // 1. FAST DELTA POLLING SYNC: If client passes ?since=<timestamp>
    // =========================================================================
    if (since) {
      const deltaMessages = await db.message.findMany({
        where: {
          conversationId,
          afterTimestamp: since,
        },
        orderBy: { createdAt: 'asc' },
      });

      return NextResponse.json({
        success: true,
        messages: deltaMessages.map((m) => ({
          id: m.id,
          clientMessageId: m.id,
          senderId: m.senderId,
          content: m.content,
          isRead: m.isRead,
          createdAt: m.createdAt,
          isMine: m.senderId === session.userId,
        })),
      });
    }

    // =========================================================================
    // 2. PAGINATION FOR OLDER MESSAGES: If client passes ?before=<timestamp>
    // =========================================================================
    if (before) {
      const olderMessages = await db.message.findMany({
        where: {
          conversationId,
          beforeTimestamp: before,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      // Reverse so messages are delivered in chronological order
      olderMessages.reverse();

      return NextResponse.json({
        success: true,
        messages: olderMessages.map((m) => ({
          id: m.id,
          clientMessageId: m.id,
          senderId: m.senderId,
          content: m.content,
          isRead: m.isRead,
          createdAt: m.createdAt,
          isMine: m.senderId === session.userId,
        })),
        hasMore: olderMessages.length === limit,
      });
    }

    // =========================================================================
    // 3. FULL INITIAL CONVERSATION LOAD
    // =========================================================================
    // Check permission (cached for 30s)
    const perm = await isConnectionPermitted(session.userId, verified.partnerId, conversationId);
    if (!perm.permitted) {
      return NextResponse.json(
        { success: false, message: perm.reason || 'Friend request must be accepted first.' },
        { status: 403 }
      );
    }

    const partnerId = verified.partnerId;

    // Run independent database fetches in parallel
    const [conv, myParticipant, rawMessages, pProfile, pUser, fr1, fr2] = await Promise.all([
      db.conversation.findUnique({ where: { id: conversationId } }),
      db.conversationParticipant.findFirst({
        where: { conversationId, userId: session.userId },
      }),
      db.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      partnerId ? db.profile.findUnique({ where: { userId: partnerId } }) : Promise.resolve(null),
      partnerId ? db.user.findUnique({ where: { id: partnerId } }) : Promise.resolve(null),
      partnerId
        ? db.friendRequest.findFirst({
            where: { senderId: session.userId, receiverId: partnerId, status: 'ACCEPTED' },
          })
        : Promise.resolve(null),
      partnerId
        ? db.friendRequest.findFirst({
            where: { senderId: partnerId, receiverId: session.userId, status: 'ACCEPTED' },
          })
        : Promise.resolve(null),
    ]);

    // Ensure conversation exists in DB
    let activeConv = conv;
    if (!activeConv) {
      activeConv = await db.conversation.create({
        data: {
          id: conversationId,
          status: 'ACTIVE',
          creditDeducted: true,
        } as any,
      });
    }

    // Mark unread as false for this participant in background
    if (myParticipant?.hasUnread) {
      db.conversationParticipant
        .update({
          where: { conversationId_userId: { conversationId, userId: session.userId } },
          data: { hasUnread: false },
        })
        .catch(() => {});
    }

    // Fetch university info if partner has one
    let pUni = null;
    if (pUser?.universityId) {
      pUni = await db.university.findUnique({ where: { id: pUser.universityId } });
    }

    const isFriend = Boolean(fr1 || fr2);

    const partner = partnerId
      ? {
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
        }
      : null;

    // Filter by clearedAt if user previously cleared history
    let filteredMessages = rawMessages;
    if (myParticipant?.clearedAt) {
      const clearTime = new Date(myParticipant.clearedAt).getTime();
      filteredMessages = filteredMessages.filter((m) => new Date(m.createdAt).getTime() > clearTime);
    }

    // Reverse descending slice so frontend receives chronological order
    filteredMessages.reverse();

    return NextResponse.json({
      success: true,
      conversation: {
        id: activeConv.id,
        status: activeConv.status,
        startedAt: activeConv.startedAt,
        endedAt: activeConv.endedAt,
        partner,
      },
      messages: filteredMessages.map((m) => ({
        id: m.id,
        clientMessageId: m.id,
        senderId: m.senderId,
        content: m.content,
        isRead: m.isRead,
        createdAt: m.createdAt,
        isMine: m.senderId === session.userId,
      })),
      hasMore: rawMessages.length === limit,
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

    // Fast participant verification
    const verified = await verifyAndResolveParticipants(conversationId, session.userId);
    if (!verified) {
      return NextResponse.json(
        { success: false, message: 'Access denied. You are not a participant in this conversation.' },
        { status: 403 }
      );
    }

    // Fast connection permission check (cached)
    const perm = await isConnectionPermitted(session.userId, verified.partnerId, conversationId);
    if (!perm.permitted) {
      return NextResponse.json(
        { success: false, message: perm.reason || 'Friend request must be accepted first.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validated = sendMessageSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { success: false, errors: validated.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const clientMessageId =
      typeof body.clientMessageId === 'string' && body.clientMessageId.trim()
        ? body.clientMessageId.trim()
        : null;

    // Idempotency: prevent duplicates on retry
    if (clientMessageId) {
      const existing = await db.message.findUnique({ where: { id: clientMessageId } });
      if (existing) {
        return NextResponse.json({
          success: true,
          message: {
            id: existing.id,
            clientMessageId,
            senderId: existing.senderId,
            content: existing.content,
            createdAt: existing.createdAt,
            isMine: true,
          },
        });
      }
    }

    // Rate limiting: 1 message per 150ms per user (allows natural fast typing while preventing flood)
    const lastSent = userMessageRateMap.get(session.userId) || 0;
    const now = Date.now();
    if (now - lastSent < 150) {
      return NextResponse.json(
        { success: false, message: 'You are sending messages too quickly. Please slow down.' },
        { status: 429 }
      );
    }
    userMessageRateMap.set(session.userId, now);

    // Sanitize message content
    const sanitizedContent = validated.data.content
      .replace(/<[^>]*>?/gm, '') // Strip HTML tags
      .slice(0, APP_CONFIG.maxMessageLength);

    // Commit to PostgreSQL
    const message = await db.message.create({
      data: {
        id: clientMessageId || undefined,
        conversationId,
        senderId: session.userId,
        content: sanitizedContent,
        isRead: false,
      },
    });

    // Run participant unread and unhide updates asynchronously so HTTP response is returned immediately
    (async () => {
      try {
        await Promise.all([
          db.conversationParticipant.update({
            where: { conversationId_userId: { conversationId, userId: verified.partnerId } },
            data: { hasUnread: true, hidden: false },
          }),
          db.conversationParticipant.update({
            where: { conversationId_userId: { conversationId, userId: session.userId } },
            data: { hidden: false },
          }),
        ]);
      } catch (err: any) {
        console.warn('Async participant status update error:', err.message);
      }
    })();

    // Broadcast in real-time
    broadcastMessage(conversationId, message);

    return NextResponse.json({
      success: true,
      message: {
        id: message.id,
        clientMessageId,
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
