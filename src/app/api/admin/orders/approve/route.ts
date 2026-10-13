import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { addCredits } from '@/lib/ledger';
import { logAdminAction } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin(req);
    const body = await req.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json({ success: false, message: 'Order ID is required.' }, { status: 400 });
    }

    const order = await db.paymentOrder.findUnique({ where: { id: orderId } });
    if (!order) {
      return NextResponse.json({ success: false, message: 'Order not found.' }, { status: 404 });
    }

    // Idempotency: Prevent duplicate approval
    if (order.status === 'PAID') {
      return NextResponse.json(
        { success: false, message: 'This order has already been approved and credited.' },
        { status: 400 }
      );
    }

    // Mark order as PAID and set verification metadata
    await db.paymentOrder.update({
      where: { id: order.id },
      data: {
        status: 'PAID',
        verifiedBy: session.userId,
        verifiedAt: new Date(),
      },
    });

    // Record verified payment transaction
    await db.paymentTransaction.create({
      data: {
        orderId: order.id,
        userId: order.userId,
        razorpayPaymentId: order.utrNumber ? `UTR_${order.utrNumber}` : `ADMIN_VERIFIED_${Date.now()}`,
        razorpaySignature: 'ADMIN_MANUAL_VERIFICATION',
        amountInPaise: order.amountInPaise,
        status: 'SUCCESS',
        rawResponse: JSON.stringify({
          verifiedByAdmin: session.userId,
          verifiedAt: new Date().toISOString(),
          utrNumber: order.utrNumber,
          receiptUrl: order.receiptUrl,
        }),
      },
    });

    // Fetch package details to grant exact credits
    const pkg = await db.creditPackage.findUnique({ where: { id: order.packageId } });
    const creditsToAdd = pkg ? pkg.credits : 1;

    // Atomically grant credits via auditable ledger
    const ledgerResult = await addCredits({
      userId: order.userId,
      amount: creditsToAdd,
      reason: 'PURCHASE',
      referenceId: order.utrNumber || order.razorpayOrderId,
      metadata: {
        orderId: order.id,
        packageName: pkg?.name,
        amountInPaise: order.amountInPaise,
        verifiedBy: session.userId,
      },
    });

    // Record admin security audit log
    await logAdminAction({
      adminId: session.userId,
      action: 'PAYMENT_APPROVED',
      targetType: 'PaymentOrder',
      targetId: order.id,
      details: {
        userId: order.userId,
        amountInPaise: order.amountInPaise,
        creditsGranted: creditsToAdd,
        utrNumber: order.utrNumber,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Payment approved! Successfully credited ${creditsToAdd} credits to student.`,
      creditsGranted: creditsToAdd,
      newBalance: ledgerResult.balance,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message?.includes('Admin')) {
      return NextResponse.json({ success: false, message: 'Unauthorized. Admin access required.' }, { status: 403 });
    }
    console.error('Approve payment error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
