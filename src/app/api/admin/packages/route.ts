import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { logAdminAction } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const packages = await db.creditPackage.findMany();
    return NextResponse.json({ success: true, packages });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 403 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin(req);
    const body = await req.json();
    const { name, credits, priceInInr, description, isPopular } = body;

    if (!name || credits <= 0 || priceInInr <= 0) {
      return NextResponse.json({ success: false, message: 'Invalid package attributes' }, { status: 400 });
    }

    const pkg = await db.creditPackage.create({
      data: {
        name,
        credits: parseInt(credits),
        priceInInr: parseFloat(priceInInr),
        description: description || '',
        isPopular: Boolean(isPopular),
        isActive: true,
      },
    });

    await logAdminAction({
      adminId: session.userId,
      action: 'PACKAGE_CREATED',
      targetType: 'CreditPackage',
      targetId: pkg.id,
      details: { name, credits, priceInInr },
    });

    return NextResponse.json({ success: true, package: pkg });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 403 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAdmin(req);
    const body = await req.json();
    const { id, priceInInr, credits, isActive, isPopular, name, description } = body;

    if (!id) {
      return NextResponse.json({ success: false, message: 'Package ID required' }, { status: 400 });
    }

    const updated = await db.creditPackage.update({
      where: { id },
      data: {
        ...(priceInInr !== undefined ? { priceInInr: parseFloat(priceInInr) } : {}),
        ...(credits !== undefined ? { credits: parseInt(credits) } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(isPopular !== undefined ? { isPopular } : {}),
        ...(name ? { name } : {}),
        ...(description ? { description } : {}),
      },
    });

    await logAdminAction({
      adminId: session.userId,
      action: 'PACKAGE_UPDATED',
      targetType: 'CreditPackage',
      targetId: id,
      details: body,
    });

    return NextResponse.json({ success: true, package: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 403 });
  }
}
