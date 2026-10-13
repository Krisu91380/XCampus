import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { NextRequest, NextResponse } from 'next/server';
import { AuthenticatedUserSession, UserRole } from '@/types';
import { db } from './db';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'campusconnect-dev-super-secure-jwt-secret-key-32-chars-long'
);
export const COOKIE_NAME = 'campusconnect_session';
export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 7 days
};

export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, 10);
}

export async function verifyPassword(plainText: string, hashed: string): Promise<boolean> {
  if (!plainText || !hashed) return false;
  if (hashed === 'OAUTH_GOOGLE') return false;
  try {
    const isMatch = await bcrypt.compare(plainText, hashed);
    if (isMatch) return true;
    if (plainText.trim() !== plainText) {
      return await bcrypt.compare(plainText.trim(), hashed);
    }
    return false;
  } catch (err) {
    console.error('Password verification error:', err);
    return false;
  }
}

export function isAtLeast18(dateOfBirth: Date | string): boolean {
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return false;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age >= 18;
}

export async function createSessionToken(payload: AuthenticatedUserSession): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

export async function verifySessionToken(token: string): Promise<AuthenticatedUserSession | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as AuthenticatedUserSession;
  } catch (err) {
    return null;
  }
}

export async function setSessionCookie(token: string, res?: NextResponse) {
  if (res) {
    res.cookies.set(COOKIE_NAME, token, COOKIE_OPTIONS);
    return;
  }
  try {
    const { cookies } = await import('next/headers');
    const cookieStore = cookies();
    cookieStore.set(COOKIE_NAME, token, COOKIE_OPTIONS);
  } catch {
    //
  }
}

export async function clearSessionCookie(res?: NextResponse) {
  if (res) {
    res.cookies.set(COOKIE_NAME, '', { ...COOKIE_OPTIONS, maxAge: 0 });
    return;
  }
  try {
    const { cookies } = await import('next/headers');
    const cookieStore = cookies();
    cookieStore.set(COOKIE_NAME, '', { ...COOKIE_OPTIONS, maxAge: 0 });
  } catch {
    //
  }
}

export async function getSession(req?: NextRequest): Promise<AuthenticatedUserSession | null> {
  let token: string | undefined;

  if (req) {
    token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) {
      const authHeader = req.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }
  } else {
    try {
      const { cookies } = await import('next/headers');
      const cookieStore = cookies();
      token = cookieStore.get(COOKIE_NAME)?.value;
    } catch {
      // Outside request context
    }
  }

  if (!token) return null;
  const session = await verifySessionToken(token);
  if (!session) return null;

  // Verify user still exists and is not suspended/banned
  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user || user.status !== 'ACTIVE') return null;

  return session;
}

export async function requireAuth(req?: NextRequest): Promise<AuthenticatedUserSession> {
  const session = await getSession(req);
  if (!session) {
    throw new Error('UNAUTHORIZED');
  }
  return session;
}

export async function requireAdmin(req?: NextRequest): Promise<AuthenticatedUserSession> {
  const session = await requireAuth(req);
  if (session.role !== 'ADMIN' && session.role !== 'MODERATOR') {
    throw new Error('FORBIDDEN_ADMIN_ONLY');
  }
  return session;
}
