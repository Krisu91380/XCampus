import { NextRequest, NextResponse } from 'next/server';
import { registerSchema } from '@/validators/auth';
import { hashPassword, createSessionToken, setSessionCookie } from '@/lib/auth';
import { db } from '@/lib/db';
import { addCredits } from '@/lib/ledger';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = registerSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { success: false, errors: validated.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const {
      email,
      password,
      displayName,
      dateOfBirth,
      universityId,
      gender,
      course,
      academicYear,
      bio,
      language,
      interests,
    } = validated.data;

    // Check if email already registered
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { success: false, message: 'An account with this email address already exists.' },
        { status: 409 }
      );
    }

    // Verify university exists
    const uni = await db.university.findUnique({ where: { id: universityId } });
    if (!uni) {
      return NextResponse.json(
        { success: false, message: 'Invalid university selected.' },
        { status: 400 }
      );
    }

    // Hash password securely
    const passwordHash = await hashPassword(password);

    // Create user record
    const user = await db.user.create({
      data: {
        email,
        passwordHash,
        role: 'USER',
        status: 'ACTIVE',
        isAgeVerified: true,
        dateOfBirth: new Date(dateOfBirth),
        universityId,
      },
    });

    // Create profile
    await db.profile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        displayName,
        gender,
        bio: bio || null,
        course: course || null,
        academicYear: academicYear || null,
        language: language || 'English',
        interests,
        isOnline: true,
        isDiscoverable: true,
        lastSeenAt: new Date(),
      },
      update: {},
    });

    // Initialize user credit balance to 0 credits (must purchase credits before paid matching/chat)
    await db.userCreditBalance.upsert({
      where: { userId: user.id },
      create: { userId: user.id, credits: 0 },
      update: {},
    });

    // Check if university email automatically matches approved domains
    let autoVerified = false;
    const domain = email.split('@')[1]?.toLowerCase();
    if (domain && uni.approvedDomains.includes(domain)) {
      await db.user.update({
        where: { id: user.id },
        data: { role: 'VERIFIED_STUDENT' },
      });
      await db.verification.create({
        data: {
          userId: user.id,
          universityId: uni.id,
          institutionalEmail: email,
          documentType: 'INSTITUTION_EMAIL',
          status: 'APPROVED',
          reviewedBy: 'SYSTEM_DOMAIN_CHECK',
          reviewedAt: new Date(),
        },
      });
      autoVerified = true;
    }

    // Create session token
    const sessionToken = await createSessionToken({
      userId: user.id,
      email: user.email,
      role: autoVerified ? 'VERIFIED_STUDENT' : 'USER',
      isAgeVerified: true,
      universityId: user.universityId,
      displayName,
    });

    const response = NextResponse.json(
      {
        success: true,
        message: 'Account successfully registered.',
        user: {
          id: user.id,
          email: user.email,
          displayName,
          role: autoVerified ? 'VERIFIED_STUDENT' : 'USER',
          universityName: uni.name,
          credits: 2,
        },
      },
      { status: 201 }
    );

    await setSessionCookie(sessionToken, response);

    return response;
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error during registration.' },
      { status: 500 }
    );
  }
}
