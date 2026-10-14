import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  uploadBannerToSupabase,
  deleteBannerFromSupabase,
  isSupabaseConfigured,
} from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);

    const formData = await req.formData();
    const file = formData.get('banner') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, message: 'No banner image file provided.' },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid image format. Supported formats: JPEG, PNG, WebP.',
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          success: false,
          message: 'Banner image exceeds 5MB limit. Please choose a smaller file.',
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let bannerUrl: string | null = null;

    // 1. Upload to Supabase Storage if configured
    if (isSupabaseConfigured()) {
      bannerUrl = await uploadBannerToSupabase(session.userId, buffer, file.type);
    }

    // 2. Fallback to base64 data URI if storage client is unavailable
    if (!bannerUrl) {
      const base64 = buffer.toString('base64');
      bannerUrl = `data:${file.type};base64,${base64}`;
    }

    // 3. Clean up previous banner from Supabase if different
    const currentProfile = await db.profile.findUnique({ where: { userId: session.userId } });
    const currentSocialLinks = (currentProfile?.socialLinks as any) || {};
    const oldBanner = currentSocialLinks.bannerUrl;

    if (oldBanner && oldBanner !== bannerUrl && oldBanner.includes('/avatars/')) {
      deleteBannerFromSupabase(oldBanner).catch(() => {});
    }

    // 4. Persist bannerUrl inside socialLinks metadata in PostgreSQL
    const updatedSocialLinks = {
      ...currentSocialLinks,
      bannerUrl,
    };

    await db.profile.upsert({
      where: { userId: session.userId },
      create: {
        userId: session.userId,
        displayName: session.displayName || 'Student',
        socialLinks: updatedSocialLinks,
      },
      update: {
        socialLinks: updatedSocialLinks,
        updatedAt: new Date(),
      },
    });

    db.store.saveToDisk();

    return NextResponse.json({
      success: true,
      message: 'Profile banner updated successfully!',
      bannerUrl,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to upload banner.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await requireAuth(req);

    const currentProfile = await db.profile.findUnique({ where: { userId: session.userId } });
    const currentSocialLinks = (currentProfile?.socialLinks as any) || {};
    const oldBanner = currentSocialLinks.bannerUrl;

    if (oldBanner && oldBanner.includes('/avatars/')) {
      await deleteBannerFromSupabase(oldBanner).catch(() => {});
    }

    const updatedSocialLinks = {
      ...currentSocialLinks,
      bannerUrl: null,
      bannerPattern: 'default',
    };

    await db.profile.update({
      where: { userId: session.userId },
      data: {
        socialLinks: updatedSocialLinks,
        updatedAt: new Date(),
      },
    });

    db.store.saveToDisk();

    return NextResponse.json({
      success: true,
      message: 'Profile banner removed.',
      bannerUrl: null,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to remove banner.' },
      { status: 500 }
    );
  }
}
