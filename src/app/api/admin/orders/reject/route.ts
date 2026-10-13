import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { logAdminAction } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin(req);
    const body = await req.json();
    const { orderId, reason } = body;

    if (!orderId) {
      return NextResponse.json({ success: false, message: 'Order ID is required.' }, { status: 400 });
    }

    const order = await db.paymentOrder.findUnique({ where: { id: orderId } });
    if (!order) {
      return NextResponse.json({ success: false, message: 'Order not found.' }, { status: 404 });
    }

    if (order.status === 'PAID') {
      return NextResponse.json(
        { success: false, message: 'Cannot reject an already paid order. Please use Refund instead.' },
        { status: 400 }
      );
    }

    const rejectionReason = reason?.trim() || 'Payment could not be verified in UPI or bank account.';

    // Mark order as REJECTED with reason and metadata
    await db.paymentOrder.update({
      where: { id: order.id },
      data: {
        status: 'REJECTED',
        rejectionReason,
        verifiedBy: session.userId,
        verifiedAt: new Date(),
      },
    });

    // Record failed payment transaction attempt
    await db.paymentTransaction.create({
      data: {
        orderId: order.id,
        userId: order.userId,
        razorpayPaymentId: order.utrNumber ? `REJECTED_${order.utrNumber}` : `REJECTED_${Date.now()}`,
        amountInPaise: order.amountInPaise,
        status: 'FAILED',
        rawResponse: JSON.stringify({
          rejectedBy: session.userId,
          rejectionReason,
          rejectedAt: new Date().toISOString(),
        }),
      },
    });

    // Record in admin audit log
    await logAdminAction({
      adminId: session.userId,
      action: 'PAYMENT_REJECTED',
      targetType: 'PaymentOrder',
      targetId: order.id,
      details: {
        userId: order.userId,
        amountInPaise: order.amountInPaise,
        reason: rejectionReason,
        utrNumber: order.utrNumber,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Payment rejected. Zero credits were granted to user.',
      rejectionReason,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message?.includes('Admin')) {
      return NextResponse.json({ success: false, message: 'Unauthorized. Admin access required.' }, { status: 403 });
    }
    console.error('Reject payment error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
