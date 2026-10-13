import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const packages = await db.creditPackage.findMany({ where: { isActive: true } });
    // Sort packages by credits ascending
    packages.sort((a, b) => a.credits - b.credits);
    return NextResponse.json({ success: true, packages });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
