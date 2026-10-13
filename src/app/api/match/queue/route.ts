import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { joinQueueSchema } from '@/validators/match';
import { db } from '@/lib/db';
import { getUserBalance } from '@/lib/ledger';
import { attemptMatch } from '@/lib/matching';
import { APP_CONFIG } from '@/lib/config';

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const body = await req.json();
    const validated = joinQueueSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { success: false, errors: validated.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { targetUniversityId, preferredPartnerGender, userGender, language, course } = validated.data;

    // Server-enforced credit lock: User must have at least 1 paid credit
    const credits = await getUserBalance(session.userId);
    if (credits < 1) {
      return NextResponse.json(
        {
          success: false,
          code: 'INSUFFICIENT_CREDITS',
          message: 'You need chat credits to start a conversation. Choose a package and complete payment to continue.',
        },
        { status: 402 }
      );
    }

    // Fetch user profile and university
    const user = await db.user.findUnique({ where: { id: session.userId } });
    const profile = await db.profile.findUnique({ where: { userId: session.userId } });

    if (!user?.universityId) {
      return NextResponse.json(
        { success: false, message: 'Please select your university in your profile before matching.' },
        { status: 400 }
      );
    }

    // Determine student's effective gender: explicit choice in form, or profile gender, or fallback to MALE
    const effectiveGender = userGender || profile?.gender || 'MALE';

    // If profile gender wasn't set or was PREFER_NOT_TO_SAY, update it with user's selected gender
    if (userGender && profile && profile.gender !== userGender) {
      await db.profile.update({
        where: { userId: session.userId },
        data: { gender: userGender },
      });
    }

    const expiresAt = new Date(Date.now() + APP_CONFIG.queueTimeoutSeconds * 1000);

    // Save or update queue entry
    await db.matchQueue.upsert({
      where: { userId: session.userId },
      create: {
        userId: session.userId,
        universityId: user.universityId,
        targetUniversityId: targetUniversityId || null,
        userGender: effectiveGender,
        preferredPartnerGender,
        language: language || profile?.language || 'English',
        course: course || profile?.course || null,
        expiresAt,
        status: 'WAITING',
      },
      update: {
        targetUniversityId: targetUniversityId || null,
        userGender: effectiveGender,
        preferredPartnerGender,
        language: language || profile?.language || 'English',
        course: course || profile?.course || null,
        expiresAt,
        status: 'WAITING',
        matchedConversationId: null,
        matchedPartnerId: null,
      },
    });

    // Save preferences
    await db.matchingPreference.upsert({
      where: { userId: session.userId },
      create: {
        userId: session.userId,
        targetUniversityId: targetUniversityId || null,
        preferredPartnerGender,
        preferredLanguage: language || null,
        preferredCourse: course || null,
        randomMatch: true,
      },
      update: {
        targetUniversityId: targetUniversityId || null,
        preferredPartnerGender,
        preferredLanguage: language || null,
      },
    });

    // Attempt instant match
    const result = await attemptMatch(session.userId);

    if (result.matched) {
      return NextResponse.json({
        success: true,
        matched: true,
        conversationId: result.conversationId,
        partner: result.partner,
      });
    }

    return NextResponse.json({
      success: true,
      matched: false,
      waiting: true,
      expiresAt: expiresAt.toISOString(),
      message: 'Searching for an eligible, consenting student partner...',
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    console.error('Match queue error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);

    // 1. Check if user has an entry in the matchmaking queue
    const queueEntry = await db.matchQueue.findUnique({ where: { userId: session.userId } });

    if (!queueEntry) {
      return NextResponse.json({ success: true, matched: false, waiting: false });
    }

    // 2. If another user matched with this student, queueEntry.status is MATCHED
    if (queueEntry.status === 'MATCHED' && queueEntry.matchedConversationId) {
      let partnerInfo = null;

      if (queueEntry.matchedPartnerId) {
        const partnerProfile = await db.profile.findUnique({
          where: { userId: queueEntry.matchedPartnerId },
        });
        const partnerUser = await db.user.findUnique({
          where: { id: queueEntry.matchedPartnerId },
        });
        const partnerUni = partnerUser?.universityId
          ? await db.university.findUnique({ where: { id: partnerUser.universityId } })
          : null;

        partnerInfo = {
          id: queueEntry.matchedPartnerId,
          displayName: partnerProfile?.displayName || 'Student',
          universityName: partnerUni?.name || 'Verified University',
          course: partnerProfile?.course,
          academicYear: partnerProfile?.academicYear,
          avatarUrl: partnerProfile?.avatarUrl,
        };
      }

      // Match info is retrieved, safely remove queue entry now
      await db.matchQueue.delete({ where: { userId: session.userId } }).catch(() => {});

      return NextResponse.json({
        success: true,
        matched: true,
        conversationId: queueEntry.matchedConversationId,
        partner: partnerInfo,
      });
    }

    // 3. If still waiting, check for expiration
    if (queueEntry.status === 'WAITING') {
      if (new Date(queueEntry.expiresAt) < new Date()) {
        await db.matchQueue.delete({ where: { userId: session.userId } }).catch(() => {});
        return NextResponse.json({
          success: true,
          matched: false,
          waiting: false,
          expired: true,
          message: 'No available students found matching your exact criteria at this moment.',
        });
      }

      // Try matching again during polling
      const result = await attemptMatch(session.userId);
      if (result.matched) {
        return NextResponse.json({
          success: true,
          matched: true,
          conversationId: result.conversationId,
          partner: result.partner,
        });
      }

      return NextResponse.json({
        success: true,
        matched: false,
        waiting: true,
        expiresAt: queueEntry.expiresAt,
      });
    }

    return NextResponse.json({ success: true, matched: false, waiting: false });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    await db.matchQueue.delete({ where: { userId: session.userId } }).catch(() => {});
    return NextResponse.json({
      success: true,
      message: 'Matchmaking search cancelled. Zero chat credits were deducted.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
}
