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

    const { email, password } = validated.data;
    const normalizedEmail = email.toLowerCase().trim();
    const user = await db.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Invalid email or password credentials. Please verify your details or create an account.' },
        { status: 401 }
      );
    }

    if (user.status === 'SUSPENDED' || user.status === 'BANNED') {
      return NextResponse.json(
        { success: false, message: 'This account has been suspended by administration.' },
        { status: 403 }
      );
    }

    if (user.passwordHash === 'OAUTH_GOOGLE') {
      return NextResponse.json(
        {
          success: false,
          message: 'This account was created with Google Sign-In. Please sign in using the "Continue with Google" button above.',
        },
        { status: 400 }
      );
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { success: false, message: 'Invalid email or password credentials. Please check your password and try again.' },
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
