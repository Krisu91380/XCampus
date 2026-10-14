import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);

    const user = await db.user.findUnique({ where: { id: session.userId } });
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found.' }, { status: 404 });
    }

    const profile = await db.profile.findUnique({ where: { userId: user.id } });
    const uni = user.universityId
      ? await db.university.findUnique({ where: { id: user.universityId } })
      : null;

    return NextResponse.json({
      success: true,
      _debug: {
        sessionUserId: session.userId,
        userId: user.id,
        profileFound: Boolean(profile),
        profileId: profile?.id,
        profileRawAvatar: profile?.avatarUrl,
      },
      profile: {
        userId: user.id,
        email: user.email,
        displayName: profile?.displayName || 'Student',
        gender: profile?.gender || 'PREFER_NOT_TO_SAY',
        avatarUrl: profile?.avatarUrl || null,
        bio: profile?.bio || '',
        course: profile?.course || '',
        branch: profile?.branch || '',
        academicYear: profile?.academicYear || '',
        semester: profile?.semester || '',
        language: profile?.language || 'English',
        interests: profile?.interests || [],
        skills: profile?.skills || [],
        socialLinks: profile?.socialLinks || {},
        universityName: uni?.name || 'Lovely Professional University',
        universityCode: uni?.code || 'LPU',
        isVerified: user.role === 'VERIFIED_STUDENT',
        isOnline: profile?.isOnline ?? true,
        isDiscoverable: profile?.isDiscoverable ?? true,
        createdAt: profile?.createdAt || user.createdAt,
      },
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch profile.' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const body = await req.json();

    const displayName = (body.displayName || '').trim();
    if (!displayName || displayName.length < 2) {
      return NextResponse.json(
        { success: false, message: 'Full name must be at least 2 characters.' },
        { status: 400 }
      );
    }

    // Format interests & skills as clean arrays
    const interests = Array.isArray(body.interests)
      ? body.interests.map((s: any) => String(s).trim()).filter(Boolean).slice(0, 20)
      : typeof body.interests === 'string'
      ? body.interests.split(',').map((s: string) => s.trim()).filter(Boolean).slice(0, 20)
      : [];

    const skills = Array.isArray(body.skills)
      ? body.skills.map((s: any) => String(s).trim()).filter(Boolean).slice(0, 20)
      : typeof body.skills === 'string'
      ? body.skills.split(',').map((s: string) => s.trim()).filter(Boolean).slice(0, 20)
      : [];

    const socialLinks = typeof body.socialLinks === 'object' && body.socialLinks !== null
      ? {
          github: body.socialLinks.github ? String(body.socialLinks.github).trim() : '',
          linkedin: body.socialLinks.linkedin ? String(body.socialLinks.linkedin).trim() : '',
          instagram: body.socialLinks.instagram ? String(body.socialLinks.instagram).trim() : '',
          twitter: body.socialLinks.twitter ? String(body.socialLinks.twitter).trim() : '',
          website: body.socialLinks.website ? String(body.socialLinks.website).trim() : '',
        }
      : {};

    const updated = await db.profile.upsert({
      where: { userId: session.userId },
      create: {
        userId: session.userId,
        displayName,
        gender: body.gender || 'PREFER_NOT_TO_SAY',
        avatarUrl: body.avatarUrl || null,
        bio: (body.bio || '').trim().slice(0, 500),
        course: (body.course || '').trim().slice(0, 100),
        branch: (body.branch || '').trim().slice(0, 100),
        academicYear: (body.academicYear || '').trim().slice(0, 50),
        semester: (body.semester || '').trim().slice(0, 50),
        language: (body.language || 'English').trim(),
        interests,
        skills,
        socialLinks,
        isOnline: true,
        isDiscoverable: body.isDiscoverable !== false,
        lastSeenAt: new Date(),
      },
      update: {
        displayName,
        gender: body.gender || undefined,
        avatarUrl: body.avatarUrl !== undefined ? body.avatarUrl : undefined,
        bio: (body.bio || '').trim().slice(0, 500),
        course: (body.course || '').trim().slice(0, 100),
        branch: (body.branch || '').trim().slice(0, 100),
        academicYear: (body.academicYear || '').trim().slice(0, 50),
        semester: (body.semester || '').trim().slice(0, 50),
        language: (body.language || 'English').trim(),
        interests,
        skills,
        socialLinks,
        isDiscoverable: body.isDiscoverable !== false,
        updatedAt: new Date(),
      },
    });

    db.store.saveToDisk();

    return NextResponse.json({
      success: true,
      message: 'Student profile updated successfully!',
      profile: updated,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to update profile.' },
      { status: 500 }
    );
  }
}
