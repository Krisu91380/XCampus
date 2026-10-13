import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { logAdminAction } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const universities = await db.university.findMany();
    return NextResponse.json({ success: true, universities });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 403 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin(req);
    const body = await req.json();
    const { name, code, city, state, country, approvedDomains, verificationRequirements } = body;

    if (!name || !code || !city || !state) {
      return NextResponse.json({ success: false, message: 'Missing required university fields.' }, { status: 400 });
    }

    const domains = Array.isArray(approvedDomains)
      ? approvedDomains
      : typeof approvedDomains === 'string'
      ? approvedDomains.split(',').map((d: string) => d.trim().toLowerCase()).filter(Boolean)
      : [];

    const university = await db.university.create({
      data: {
        name,
        code: code.toUpperCase(),
        city,
        state,
        country: country || 'India',
        approvedDomains: domains,
        isActive: true,
        verificationRequirements: verificationRequirements || 'Student email or ID Card',
      },
    });

    await logAdminAction({
      adminId: session.userId,
      action: 'UNIVERSITY_CREATED',
      targetType: 'University',
      targetId: university.id,
      details: { name: university.name, code: university.code },
    });

    return NextResponse.json({ success: true, university });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 403 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAdmin(req);
    const body = await req.json();
    const { id, isActive, name, verificationRequirements } = body;

    if (!id) {
      return NextResponse.json({ success: false, message: 'University ID required.' }, { status: 400 });
    }

    const updated = await db.university.update({
      where: { id },
      data: {
        ...(isActive !== undefined ? { isActive } : {}),
        ...(name ? { name } : {}),
        ...(verificationRequirements ? { verificationRequirements } : {}),
      },
    });

    await logAdminAction({
      adminId: session.userId,
      action: 'UNIVERSITY_UPDATED',
      targetType: 'University',
      targetId: id,
      details: { isActive, name },
    });

    return NextResponse.json({ success: true, university: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 403 });
  }
}
