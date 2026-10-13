import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserBalance } from '@/lib/ledger';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);

    const balance = await getUserBalance(session.userId);
    const ledgerEntries = await db.creditLedger.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: 'desc' },
    });
    const orders = await db.paymentOrder.findMany({
      where: { userId: session.userId },
    });

    const packages = await db.creditPackage.findMany({ where: { isActive: true } });

    return NextResponse.json({
      success: true,
      balance,
      ledger: ledgerEntries,
      orders,
      packages,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
