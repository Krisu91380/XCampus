import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { verifyPaymentSchema } from '@/validators/payment';
import { db } from '@/lib/db';
import { verifyRazorpaySignature } from '@/lib/razorpay';
import { addCredits } from '@/lib/ledger';

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const body = await req.json();
    const validated = verifyPaymentSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { success: false, errors: validated.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = validated.data;

    // Find the internal order
    const order = await db.paymentOrder.findUnique({ where: { id: orderId } });
    if (!order) {
      return NextResponse.json({ success: false, message: 'Order not found.' }, { status: 404 });
    }

    // Verify ownership
    if (order.userId !== session.userId) {
      return NextResponse.json({ success: false, message: 'Forbidden. Order belongs to another user.' }, { status: 403 });
    }

    // Idempotency check: if order is already marked as paid
    if (order.status === 'PAID') {
      const pkg = await db.creditPackage.findUnique({ where: { id: order.packageId } });
      const currentBalance = await db.userCreditBalance.findUnique({ where: { userId: session.userId } });
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        message: 'Payment already processed and credited.',
        creditsAdded: pkg?.credits || 0,
        balance: currentBalance?.credits || 0,
      });
    }

    // Cryptographic signature verification
    const { verified, isSandbox } = verifyRazorpaySignature({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });

    if (!verified) {
      // Record failed transaction attempt
      await db.paymentTransaction.create({
        data: {
          orderId: order.id,
          userId: session.userId,
          razorpayPaymentId,
          razorpaySignature: razorpaySignature || null,
          amountInPaise: order.amountInPaise,
          status: 'FAILED',
          rawResponse: JSON.stringify({ error: 'Signature verification failed' }),
        },
      });

      return NextResponse.json(
        { success: false, message: 'Payment verification failed: Invalid cryptographic signature.' },
        { status: 400 }
      );
    }

    // Record verified transaction
    await db.paymentTransaction.create({
      data: {
        orderId: order.id,
        userId: session.userId,
        razorpayPaymentId,
        razorpaySignature: razorpaySignature || (isSandbox ? 'SANDBOX_SIGNATURE' : null),
        amountInPaise: order.amountInPaise,
        status: 'SUCCESS',
        rawResponse: JSON.stringify({ isSandbox, verifiedAt: new Date().toISOString() }),
      },
    });

    // Mark order as PAID
    await db.paymentOrder.update({
      where: { id: order.id },
      data: { status: 'PAID' },
    });

    // Fetch package details for credit allocation
    const pkg = await db.creditPackage.findUnique({ where: { id: order.packageId } });
    const creditsToAdd = pkg ? pkg.credits : 1;

    // Atomically add credits via auditable ledger
    const ledgerResult = await addCredits({
      userId: session.userId,
      amount: creditsToAdd,
      reason: 'PURCHASE',
      referenceId: order.razorpayOrderId,
      metadata: {
        orderId: order.id,
        paymentId: razorpayPaymentId,
        amountInPaise: order.amountInPaise,
        packageName: pkg?.name,
        isSandbox,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Payment confirmed! ${creditsToAdd} chat credits added to your account.`,
      creditsAdded: creditsToAdd,
      newBalance: ledgerResult.balance,
      isSandbox,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    console.error('Payment verify error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
