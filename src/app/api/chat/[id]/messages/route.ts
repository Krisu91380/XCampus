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

    // Fetch current user's participant state (contains leftAt / clearedAt for per-user chat deletion)
    const myParticipant = await db.conversationParticipant.findFirst({
      where: { conversationId, userId: session.userId },
    });
    const userClearedAt = myParticipant?.clearedAt || myParticipant?.leftAt;

    // =========================================================================
    // 1. FAST DELTA POLLING SYNC: If client passes ?since=<timestamp>
    // =========================================================================
    if (since) {
      const sinceDate = new Date(since);
      const afterTimestamp =
        userClearedAt && new Date(userClearedAt).getTime() > sinceDate.getTime()
          ? userClearedAt
          : since;

      const deltaMessages = await db.message.findMany({
        where: {
          conversationId,
          afterTimestamp,
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
          afterTimestamp: userClearedAt || undefined,
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
    const partnerId = verified.partnerId;

    // Run independent database fetches in parallel
    const [conv, rawMessages, pProfile, pUser, fr1, fr2, myBlock, partnerBlock, activeMatch] = await Promise.all([
      db.conversation.findUnique({ where: { id: conversationId } }),
      db.message.findMany({
        where: {
          conversationId,
          afterTimestamp: userClearedAt || undefined,
        },
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
      partnerId
        ? db.block.findFirst({ where: { blockerId: session.userId, blockedId: partnerId } })
        : Promise.resolve(null),
      partnerId
        ? db.block.findFirst({ where: { blockerId: partnerId, blockedId: session.userId } })
        : Promise.resolve(null),
      db.matchQueue.findFirst({
        where: { matchedConversationId: conversationId, status: 'MATCHED' },
      }),
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
    const isBlockedByMe = Boolean(myBlock);
    const isBlockedByPartner = Boolean(partnerBlock);
    const isMatch = Boolean(activeMatch);
    const canMessage = !isBlockedByMe && !isBlockedByPartner && (isFriend || isMatch);
    const canCall = !isBlockedByMe && !isBlockedByPartner && isFriend;

    let notice: string | null = null;
    if (isBlockedByMe) {
      notice = 'You blocked this person.';
    } else if (isBlockedByPartner) {
      notice = 'This user is unavailable. You cannot message or call this account.';
    } else if (!isFriend && !isMatch) {
      notice = 'You are no longer friends. Send a friend request to start messaging again.';
    }

    const partner = partnerId
      ? {
          id: partnerId,
          displayName: isBlockedByPartner ? 'Campus User' : (pProfile?.displayName || 'Student'),
          username: isBlockedByPartner ? '' : ((pProfile as any)?.username || (pProfile?.socialLinks as any)?.username || (pUser as any)?.username || ''),
          gender: isBlockedByPartner ? null : pProfile?.gender,
          avatarUrl: isBlockedByPartner ? null : pProfile?.avatarUrl,
          course: isBlockedByPartner ? null : pProfile?.course,
          branch: isBlockedByPartner ? null : pProfile?.branch,
          academicYear: isBlockedByPartner ? null : pProfile?.academicYear,
          semester: isBlockedByPartner ? null : pProfile?.semester,
          bio: isBlockedByPartner ? null : pProfile?.bio,
          interests: isBlockedByPartner ? [] : (pProfile?.interests || []),
          skills: isBlockedByPartner ? [] : (pProfile?.skills || []),
          isOnline: isBlockedByPartner ? false : (pProfile?.isOnline || false),
          isVerified: !isBlockedByPartner && pUser?.role === 'VERIFIED_STUDENT',
          isFriend,
          isBlockedByMe,
          isBlockedByPartner,
          universityName: isBlockedByPartner ? 'Campus' : (pUni?.name || 'University'),
          universityCode: isBlockedByPartner ? 'CC' : (pUni?.code || 'UNI'),
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
      isBlockedByMe,
      isBlockedByPartner,
      isFriend,
      canMessage,
      canCall,
      notice,
      conversation: {
        id: activeConv.id,
        status: activeConv.status,
        startedAt: activeConv.startedAt,
        endedAt: activeConv.endedAt,
        isBlockedByMe,
        isBlockedByPartner,
        isFriend,
        canMessage,
        canCall,
        notice,
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
        const partnerPart = await db.conversationParticipant.findFirst({
          where: { conversationId, userId: verified.partnerId },
        });

        const updates: Promise<any>[] = [
          db.conversationParticipant.update({
            where: { conversationId_userId: { conversationId, userId: session.userId } },
            data: { hidden: false, leftAt: null as any },
          }),
          db.conversationParticipant.update({
            where: { conversationId_userId: { conversationId, userId: verified.partnerId } },
            data: { hidden: false, leftAt: null as any, hasUnread: true },
          }),
        ];

        await Promise.all(updates);
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
