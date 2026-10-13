import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserBalance } from '@/lib/ledger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json({ success: false, message: 'Order ID is required.' }, { status: 400 });
    }

    const order = await db.paymentOrder.findUnique({ where: { id: orderId } });
    if (!order) {
      return NextResponse.json({ success: false, message: 'Order not found.' }, { status: 404 });
    }

    if (order.userId !== session.userId) {
      return NextResponse.json({ success: false, message: 'Forbidden.' }, { status: 403 });
    }

    const pkg = await db.creditPackage.findUnique({ where: { id: order.packageId } });
    const currentBalance = await getUserBalance(session.userId);

    return NextResponse.json({
      success: true,
      orderId: order.id,
      razorpayOrderId: order.razorpayOrderId,
      status: order.status,
      packageName: pkg?.name,
      credits: pkg?.credits,
      currentBalance,
      isPaid: order.status === 'PAID',
      utrNumber: order.utrNumber,
      receiptUrl: order.receiptUrl,
      rejectionReason: order.rejectionReason,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
