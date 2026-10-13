import { NextRequest, NextResponse } from 'next/server';
import { loginSchema } from '@/validators/auth';
import { verifyPassword, createSessionToken, setSessionCookie } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = loginSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { success: false, errors: validated.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email: identifier, password } = validated.data;
    const cleanId = identifier.trim();
    const lowerId = cleanId.toLowerCase();

    // 1. Look up user by exact email
    let user = await db.user.findUnique({ where: { email: cleanId } });

    // 2. If not found, look up by username prefix (e.g. "aarav.sharma" matches "aarav.sharma@lpu.in")
    if (!user) {
      const allUsers = await db.user.findMany();
      user =
        allUsers.find((u) => {
          const uEmailLower = u.email.toLowerCase();
          if (uEmailLower === lowerId) return true;
          const prefix = uEmailLower.split('@')[0];
          return prefix === lowerId;
        }) || null;
    }

    // 3. If still not found, check by display name from profile
    if (!user) {
      const allProfiles = await db.profile.findMany();
      const matchingProfile = allProfiles.find(
        (p) => p.displayName.toLowerCase() === lowerId
      );
      if (matchingProfile) {
        user = await db.user.findUnique({ where: { id: matchingProfile.userId } });
      }
    }

    // 4. If no '@' provided, try appending @lpu.in as student default
    if (!user && !lowerId.includes('@')) {
      user = await db.user.findUnique({ where: { email: `${lowerId}@lpu.in` } });
    }

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: 'Account not found. Please verify your email or student ID, or register a new account.',
        },
        { status: 401 }
      );
    }

    if (user.status === 'SUSPENDED' || user.status === 'BANNED') {
      return NextResponse.json(
        { success: false, message: 'This account has been suspended by administration.' },
        { status: 403 }
      );
    }

    const isValid = await verifyPassword(password, user.passwordHash, {
      id: user.id,
      email: user.email,
    });

    if (!isValid) {
      return NextResponse.json(
        { success: false, message: 'Incorrect password. Please check your password and try again.' },
        { status: 401 }
      );
    }

    const profile = await db.profile.findUnique({ where: { userId: user.id } });
    const displayName = profile?.displayName || user.email.split('@')[0];

    // Set online status
    if (profile) {
      await db.profile.update({
        where: { userId: user.id },
        data: { isOnline: true, lastSeenAt: new Date() },
      });
    }

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      role: user.role as any,
      isAgeVerified: user.isAgeVerified,
      universityId: user.universityId,
      displayName,
    });

    const response = NextResponse.json({
      success: true,
      message: 'Logged in successfully.',
      user: {
        id: user.id,
        email: user.email,
        displayName,
        role: user.role,
        universityId: user.universityId,
      },
    });

    await setSessionCookie(token, response);

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error during login.' },
      { status: 500 }
    );
  }
}
