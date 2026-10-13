import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserBalance, deductCreditForConversation } from '@/lib/ledger';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const { searchParams } = new URL(req.url);

    const universityId = searchParams.get('universityId');
    const gender = searchParams.get('gender');
    const query = searchParams.get('q')?.toLowerCase();

    // Fetch block lists
    const userBlocks = await db.block.findMany({ where: { blockerId: session.userId } });
    const blockedBy = await db.block.findMany({ where: { blockedId: session.userId } });
    const blockedIds = new Set([
      ...userBlocks.map((b) => b.blockedId),
      ...blockedBy.map((b) => b.blockerId),
    ]);

    // Fetch discoverable profiles
    const profiles = await db.profile.findMany({ where: { isDiscoverable: true } });
    const universities = await db.university.findMany({ where: { isActive: true } });
    const uniMap = new Map(universities.map((u) => [u.id, u]));

    const users = await db.user.findMany({ where: { status: 'ACTIVE' } });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const results = [];

    for (const p of profiles) {
      if (p.userId === session.userId) continue;
      if (blockedIds.has(p.userId)) continue;

      const user = userMap.get(p.userId);
      if (!user) continue;

      if (universityId && user.universityId !== universityId) continue;
      if (gender && p.gender !== gender && gender !== 'ALL') continue;

      const uni = user.universityId ? uniMap.get(user.universityId) : null;

      if (query) {
        const matchesName = p.displayName.toLowerCase().includes(query);
        const matchesCourse = p.course?.toLowerCase().includes(query);
        const matchesUni = uni?.name.toLowerCase().includes(query);
        const matchesInterests = p.interests.some((i) => i.toLowerCase().includes(query));
        if (!matchesName && !matchesCourse && !matchesUni && !matchesInterests) continue;
      }

      results.push({
        id: p.userId,
        displayName: p.displayName,
        gender: p.gender,
        avatarUrl: p.avatarUrl,
        bio: p.bio,
        course: p.course,
        academicYear: p.academicYear,
        language: p.language,
        interests: p.interests,
        isOnline: p.isOnline,
        university: uni
          ? {
              id: uni.id,
              name: uni.name,
              code: uni.code,
              city: uni.city,
            }
          : null,
        isVerified: user.role === 'VERIFIED_STUDENT',
      });
    }

    return NextResponse.json({ success: true, students: results });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const body = await req.json();
    const { targetUserId } = body;

    if (!targetUserId || targetUserId === session.userId) {
      return NextResponse.json({ success: false, message: 'Invalid target student.' }, { status: 400 });
    }

    // Check credits
    const balance = await getUserBalance(session.userId);
    if (balance < 1) {
      return NextResponse.json(
        {
          success: false,
          code: 'INSUFFICIENT_CREDITS',
          message: 'You need at least 1 chat credit to start a conversation.',
        },
        { status: 402 }
      );
    }

    // Check if there is already an active conversation between these two
    const myConvs = await db.conversationParticipant.findMany({ where: { userId: session.userId } });
    for (const c of myConvs) {
      const conv = await db.conversation.findUnique({ where: { id: c.conversationId } });
      if (conv && conv.status === 'ACTIVE') {
        const partnerPart = await db.conversationParticipant.findFirst({
          where: { conversationId: conv.id, userId: targetUserId },
        });
        if (partnerPart) {
          // Already have active conversation, redirect to it without charging again
          return NextResponse.json({
            success: true,
            conversationId: conv.id,
            alreadyActive: true,
          });
        }
      }
    }

    // Check blocking
    const blocked = await db.block.findUnique({
      where: { blockerId_blockedId: { blockerId: session.userId, blockedId: targetUserId } },
    });
    if (blocked) {
      return NextResponse.json({ success: false, message: 'You have blocked this user.' }, { status: 403 });
    }

    // Create conversation
    const conversation = await db.conversation.create({
      data: {
        status: 'ACTIVE',
        creditDeducted: true,
      },
    });

    await db.conversationParticipant.create({
      data: {
        conversationId: conversation.id,
        userId: session.userId,
        hasUnread: false,
      },
    });

    await db.conversationParticipant.create({
      data: {
        conversationId: conversation.id,
        userId: targetUserId,
        hasUnread: true,
      },
    });

    // Deduct 1 credit from initiator
    await deductCreditForConversation({
      userId: session.userId,
      conversationId: conversation.id,
    });

    return NextResponse.json({
      success: true,
      conversationId: conversation.id,
      message: 'Conversation started!',
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
