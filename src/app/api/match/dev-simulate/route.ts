import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { addCredits, getUserBalance } from '@/lib/ledger';
import { attemptMatch } from '@/lib/matching';
import { APP_CONFIG } from '@/lib/config';

export async function POST(req: NextRequest) {
  // Only available in development mode
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { success: false, message: 'Developer simulation endpoint is disabled in production.' },
      { status: 403 }
    );
  }

  try {
    // 1. Get or create primary university (Lovely Professional University)
    let uni = (await db.university.findMany())[0];
    if (!uni) {
      uni = await db.university.create({
        data: {
          name: 'Lovely Professional University',
          code: 'LPU',
          city: 'Phagwara',
          state: 'Punjab',
          country: 'India',
          approvedDomains: ['lpu.in'],
          verificationRequirements: 'Official student email or ID card',
          isActive: true,
        },
      });
    }

    const testPassword = await hashPassword('Student@1234');

    // 2. Ensure Student 1 (Male: Aarav Sharma) exists
    let student1 = await db.user.findUnique({ where: { email: 'dev.aarav@lpu.in' } });
    if (!student1) {
      student1 = await db.user.create({
        data: {
          email: 'dev.aarav@lpu.in',
          passwordHash: testPassword,
          role: 'VERIFIED_STUDENT',
          status: 'ACTIVE',
          isAgeVerified: true,
          dateOfBirth: new Date('2002-05-14'),
          universityId: uni.id,
        },
      });
      await db.profile.upsert({
        where: { userId: student1.id },
        create: {
          userId: student1.id,
          displayName: 'Aarav Sharma (Dev)',
          gender: 'MALE',
          bio: 'Computer Science student at LPU. Enjoys coding and hackathons.',
          course: 'B.Tech CSE',
          academicYear: '3rd Year',
          language: 'English',
          interests: ['Tech', 'Gaming', 'Music'],
          isOnline: true,
          isDiscoverable: true,
          lastSeenAt: new Date(),
        },
        update: {},
      });
    }

    // 3. Ensure Student 2 (Female: Pooja Verma) exists
    let student2 = await db.user.findUnique({ where: { email: 'dev.pooja@lpu.in' } });
    if (!student2) {
      student2 = await db.user.create({
        data: {
          email: 'dev.pooja@lpu.in',
          passwordHash: testPassword,
          role: 'VERIFIED_STUDENT',
          status: 'ACTIVE',
          isAgeVerified: true,
          dateOfBirth: new Date('2003-08-22'),
          universityId: uni.id,
        },
      });
      await db.profile.upsert({
        where: { userId: student2.id },
        create: {
          userId: student2.id,
          displayName: 'Pooja Verma (Dev)',
          gender: 'FEMALE',
          bio: 'ECE student at LPU. Passionate about robotics and photography.',
          course: 'B.Tech ECE',
          academicYear: '2nd Year',
          language: 'English',
          interests: ['Robotics', 'Photography', 'Reading'],
          isOnline: true,
          isDiscoverable: true,
          lastSeenAt: new Date(),
        },
        update: {},
      });
    }

    // 4. Ensure both students have at least 5 chat credits
    const bal1 = await getUserBalance(student1.id);
    if (bal1 < 3) {
      await addCredits({
        userId: student1.id,
        amount: 5,
        reason: 'ADMIN_ADJUSTMENT',
        referenceId: `dev_seed_${Date.now()}_1`,
      });
    }

    const bal2 = await getUserBalance(student2.id);
    if (bal2 < 3) {
      await addCredits({
        userId: student2.id,
        amount: 5,
        reason: 'ADMIN_ADJUSTMENT',
        referenceId: `dev_seed_${Date.now()}_2`,
      });
    }

    // 5. Enqueue Student 1 (Male wanting Girls or Everyone)
    const expiresAt = new Date(Date.now() + APP_CONFIG.queueTimeoutSeconds * 1000);
    await db.matchQueue.upsert({
      where: { userId: student1.id },
      create: {
        userId: student1.id,
        universityId: uni.id,
        targetUniversityId: null, // Any university
        userGender: 'MALE',
        preferredPartnerGender: 'GIRLS',
        language: 'English',
        course: 'B.Tech CSE',
        expiresAt,
        status: 'WAITING',
      },
      update: {
        universityId: uni.id,
        targetUniversityId: null,
        userGender: 'MALE',
        preferredPartnerGender: 'GIRLS',
        language: 'English',
        expiresAt,
        status: 'WAITING',
        matchedConversationId: null,
        matchedPartnerId: null,
      },
    });

    // 6. Enqueue Student 2 (Female wanting Boys or Everyone)
    await db.matchQueue.upsert({
      where: { userId: student2.id },
      create: {
        userId: student2.id,
        universityId: uni.id,
        targetUniversityId: null, // Any university
        userGender: 'FEMALE',
        preferredPartnerGender: 'BOYS',
        language: 'English',
        course: 'B.Tech ECE',
        expiresAt,
        status: 'WAITING',
      },
      update: {
        universityId: uni.id,
        targetUniversityId: null,
        userGender: 'FEMALE',
        preferredPartnerGender: 'BOYS',
        language: 'English',
        expiresAt,
        status: 'WAITING',
        matchedConversationId: null,
        matchedPartnerId: null,
      },
    });

    // 7. Trigger match resolution for Student 2
    const matchResult = await attemptMatch(student2.id);

    if (!matchResult.matched || !matchResult.conversationId) {
      return NextResponse.json(
        {
          success: false,
          message: 'Match simulation failed to pair students',
          reason: matchResult.reason,
        },
        { status: 500 }
      );
    }

    // 8. Verify the persistent database state
    const conv = await db.conversation.findUnique({ where: { id: matchResult.conversationId } });
    const participants = await db.conversationParticipant.findMany({
      where: { conversationId: matchResult.conversationId },
    });
    const finalBal1 = await getUserBalance(student1.id);
    const finalBal2 = await getUserBalance(student2.id);

    return NextResponse.json({
      success: true,
      message: 'Mutual matching simulation successful! Both test students paired into identical conversation.',
      conversationId: matchResult.conversationId,
      conversationStatus: conv?.status,
      participantsCount: participants.length,
      partnerFound: matchResult.partner,
      student1: {
        id: student1.id,
        email: student1.email,
        name: 'Aarav Sharma (Dev)',
        gender: 'MALE',
        creditsAfterMatch: finalBal1,
      },
      student2: {
        id: student2.id,
        email: student2.email,
        name: 'Pooja Verma (Dev)',
        gender: 'FEMALE',
        creditsAfterMatch: finalBal2,
      },
    });
  } catch (error: any) {
    console.error('Dev simulate match error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
