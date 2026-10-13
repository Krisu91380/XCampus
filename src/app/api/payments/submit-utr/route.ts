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

    if (!utrNumber || typeof utrNumber !== 'string' || utrNumber.trim().length < 4) {
      return NextResponse.json(
        { success: false, message: 'Please provide a valid UTR or UPI Transaction Reference Number (min 4 characters).' },
        { status: 400 }
      );
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

    const sanitizedUtr = utrNumber.trim().toUpperCase();

    // Update order to PENDING_VERIFICATION with UTR and optional receipt URL
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
      message: 'Payment reference submitted. Your transaction is now awaiting administrator verification.',
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    console.error('Submit UTR error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
