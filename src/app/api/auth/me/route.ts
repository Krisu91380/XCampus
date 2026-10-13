import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserBalance } from '@/lib/ledger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    const user = await db.user.findUnique({ where: { id: session.userId } });
    if (!user) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    const profile = await db.profile.findUnique({ where: { userId: user.id } });
    const university = user.universityId
      ? await db.university.findUnique({ where: { id: user.universityId } })
      : null;
    const credits = await getUserBalance(user.id);
    const verifications = await db.verification.findMany({ where: { userId: user.id } });
    const latestVerification = verifications[verifications.length - 1] || null;

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isAgeVerified: user.isAgeVerified,
        status: user.status,
        createdAt: user.createdAt,
        profile: profile
          ? {
              displayName: profile.displayName,
              gender: profile.gender,
              avatarUrl: profile.avatarUrl,
              bio: profile.bio,
              course: profile.course,
              academicYear: profile.academicYear,
              language: profile.language,
              interests: profile.interests,
              isOnline: profile.isOnline,
              isDiscoverable: profile.isDiscoverable,
            }
          : null,
        university: university
          ? {
              id: university.id,
              name: university.name,
              code: university.code,
              city: university.city,
              state: university.state,
            }
          : null,
        credits,
        verificationStatus: latestVerification?.status || 'UNVERIFIED',
      },
    });
  } catch (error: any) {
    console.error('Error in /api/auth/me:', error);
    return NextResponse.json({ authenticated: false, user: null }, { status: 500 });
  }
}
