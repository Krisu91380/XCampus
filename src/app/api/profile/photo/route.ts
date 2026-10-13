import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { uploadProfilePhotoToSupabase, isSupabaseConfigured } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);

    const formData = await req.formData();
    const file = formData.get('photo') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, message: 'No image file provided.' },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid image format. Supported formats: JPEG, PNG, WebP, GIF.',
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          success: false,
          message: 'File size exceeds 5MB limit. Please choose a smaller photo.',
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let avatarUrl: string | null = null;

    // 1. If Supabase Storage is configured, upload directly to Supabase
    if (isSupabaseConfigured()) {
      avatarUrl = await uploadProfilePhotoToSupabase(session.userId, buffer, file.type);
    }

    // 2. If Supabase is not configured or failed, save locally or as resilient base64 data URI
    if (!avatarUrl) {
      try {
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'avatars');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        const ext = file.type.includes('png') ? 'png' : file.type.includes('webp') ? 'webp' : 'jpg';
        const fileName = `user_${session.userId}_${Date.now()}.${ext}`;
        const filePath = path.join(uploadsDir, fileName);
        fs.writeFileSync(filePath, buffer);
        avatarUrl = `/uploads/avatars/${fileName}`;
      } catch {
        // Fallback to data URI to survive serverless container rotations
        const base64 = buffer.toString('base64');
        avatarUrl = `data:${file.type};base64,${base64}`;
      }
    }

    // 3. Persist image URL to student profile in database
    await db.profile.upsert({
      where: { userId: session.userId },
      create: {
        userId: session.userId,
        displayName: session.displayName || 'Student',
        avatarUrl,
        gender: 'PREFER_NOT_TO_SAY',
        language: 'English',
        interests: ['Coding', 'Campus Life'],
        isOnline: true,
        isDiscoverable: true,
        lastSeenAt: new Date(),
      },
      update: {
        avatarUrl,
        updatedAt: new Date(),
      },
    });

    db.store.saveToDisk();

    return NextResponse.json({
      success: true,
      message: 'Profile photo updated successfully!',
      avatarUrl,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    console.error('Photo upload error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to upload photo.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await requireAuth(req);

    await db.profile.upsert({
      where: { userId: session.userId },
      create: {
        userId: session.userId,
        displayName: session.displayName || 'Student',
        avatarUrl: null,
        gender: 'PREFER_NOT_TO_SAY',
        language: 'English',
        interests: ['Coding', 'Campus Life'],
        isOnline: true,
        isDiscoverable: true,
        lastSeenAt: new Date(),
      },
      update: {
        avatarUrl: null,
        updatedAt: new Date(),
      },
    });

    db.store.saveToDisk();

    return NextResponse.json({
      success: true,
      message: 'Profile photo removed successfully.',
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to remove photo.' },
      { status: 500 }
    );
  }
}
