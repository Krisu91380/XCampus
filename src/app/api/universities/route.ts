import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const universities = await db.university.findMany({ where: { isActive: true } });
    return NextResponse.json({ success: true, universities });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: 'Failed to fetch universities.' },
      { status: 500 }
    );
  }
}
