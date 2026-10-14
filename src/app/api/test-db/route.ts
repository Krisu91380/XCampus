import { NextRequest, NextResponse } from 'next/server';
import { db, prisma } from '@/lib/db';
import { getSupabaseClient, isSupabaseConfigured, getSupabaseUrl } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const results: any = {
    isSupabaseConfigured: isSupabaseConfigured(),
    supabaseUrl: getSupabaseUrl(),
    hasPrisma: Boolean(prisma),
  };

  // Test Prisma
  if (prisma) {
    try {
      const pProfile = await prisma.profile.findFirst({
        where: { userId: 'user-student-krish' },
      });
      results.prismaProfile = pProfile;
    } catch (e: any) {
      results.prismaError = e.message;
    }
  }

  // Test Supabase
  const sb = getSupabaseClient();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('Profile')
        .select('*')
        .eq('userId', 'user-student-krish');
      results.supabaseProfiles = data;
      results.supabaseError = error;
    } catch (e: any) {
      results.supabaseException = e.message;
    }

    try {
      // Also test lowercase profile table
      const { data: dataLower, error: errorLower } = await sb
        .from('profile')
        .select('*')
        .limit(1);
      results.supabaseLower = { data: dataLower, error: errorLower };
    } catch (e: any) {
      results.supabaseLowerException = e.message;
    }
  }

  // Test db.profile.findUnique
  try {
    const prof = await db.profile.findUnique({ where: { userId: 'user-student-krish' } });
    results.dbProfile = prof;
  } catch (e: any) {
    results.dbProfileError = e.message;
  }

  return NextResponse.json(results);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const testAvatarUrl = body.avatarUrl || 'https://test-avatar.png';
  const out: any = {};

  const sb = getSupabaseClient();
  if (sb) {
    try {
      const updateRes = await sb
        .from('Profile')
        .update({ avatarUrl: testAvatarUrl, updatedAt: new Date().toISOString() })
        .eq('userId', 'user-student-krish')
        .select();
      out.directSupabaseUpdate = updateRes;
    } catch (e: any) {
      out.directSupabaseUpdateError = e.message;
    }
  }

  try {
    const upsertRes = await db.profile.upsert({
      where: { userId: 'user-student-krish' },
      create: {
        userId: 'user-student-krish',
        displayName: 'Krish Barak',
        avatarUrl: testAvatarUrl,
      },
      update: {
        avatarUrl: testAvatarUrl,
      },
    });
    out.dbUpsertResult = upsertRes;
  } catch (e: any) {
    out.dbUpsertError = e.message;
  }

  try {
    const after = await db.profile.findUnique({ where: { userId: 'user-student-krish' } });
    out.profileAfter = after;
  } catch (e: any) {
    out.profileAfterError = e.message;
  }

  return NextResponse.json(out);
}
