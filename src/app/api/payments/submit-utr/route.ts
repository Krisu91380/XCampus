import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const body = await req.json();
    const { orderId, utrNumber, receiptUrl } = body;

    if (!orderId) {
      return NextResponse.json({ success: false, message: 'Order ID is required.' }, { status: 400 });
    }

    const order = await db.paymentOrder.findUnique({ where: { id: orderId } });
    if (!order) {
      return NextResponse.json({ success: false, message: 'Order not found.' }, { status: 404 });
    }

    if (order.userId !== session.userId) {
      return NextResponse.json({ success: false, message: 'Forbidden. Order belongs to another user.' }, { status: 403 });
    }

    if (order.status === 'PAID') {
      return NextResponse.json(
        { success: false, message: 'This order has already been verified and paid.' },
        { status: 400 }
      );
    }

    // Idempotency: If already pending verification, return success without duplicate entries
    if (order.status === 'PENDING_VERIFICATION') {
      return NextResponse.json({
        success: true,
        status: 'PENDING_VERIFICATION',
        orderId: order.id,
        utrNumber: order.utrNumber,
        message: 'Your payment confirmation is already awaiting administrator verification.',
      });
    }

    // If student provided custom UTR/ref, use it; otherwise generate a clean confirmation reference
    const sanitizedUtr =
      utrNumber && typeof utrNumber === 'string' && utrNumber.trim().length > 0
        ? utrNumber.trim().toUpperCase()
        : `PAID_CONFIRMED_${order.id.slice(-6).toUpperCase()}`;

    // Update order to PENDING_VERIFICATION for administrator review
    const updated = await db.paymentOrder.update({
      where: { id: order.id },
      data: {
        status: 'PENDING_VERIFICATION',
        utrNumber: sanitizedUtr,
        receiptUrl: receiptUrl ? String(receiptUrl).trim() : null,
      },
    });

    return NextResponse.json({
      success: true,
      status: 'PENDING_VERIFICATION',
      orderId: updated.id,
      utrNumber: sanitizedUtr,
      message: 'Payment confirmation submitted. Your order is now awaiting administrator review.',
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    console.error('Submit payment confirmation error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
