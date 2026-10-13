import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { addCredits } from '@/lib/ledger';
import { isRazorpayConfigured } from '@/lib/razorpay';

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const body = await req.json();
    const { orderId } = body;

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

    // Security check: Only allow sandbox simulation when sandbox mode is explicitly permitted or keys are not yet live
    const allowSandbox = process.env.ENABLE_SANDBOX_PAYMENTS === 'true' || !isRazorpayConfigured();
    if (!allowSandbox) {
      return NextResponse.json(
        { success: false, message: 'Sandbox payment simulation is disabled in live production mode.' },
        { status: 403 }
      );
    }

    // Idempotency: if already paid, return existing state
    if (order.status === 'PAID') {
      const pkg = await db.creditPackage.findUnique({ where: { id: order.packageId } });
      const currentBalance = await db.userCreditBalance.findUnique({ where: { userId: session.userId } });
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        creditsAdded: pkg?.credits || 0,
        balance: currentBalance?.credits || 0,
      });
    }

    // Record verified transaction in DB
    await db.paymentTransaction.create({
      data: {
        orderId: order.id,
        userId: session.userId,
        razorpayPaymentId: `pay_sandbox_${Date.now()}`,
        razorpaySignature: 'SANDBOX_VERIFIED_SIGNATURE',
        amountInPaise: order.amountInPaise,
        status: 'SUCCESS',
        rawResponse: JSON.stringify({ simulated: true, verifiedAt: new Date().toISOString() }),
      },
    });

    // Mark order as PAID
    await db.paymentOrder.update({
      where: { id: order.id },
      data: { status: 'PAID' },
    });

    // Credit user's balance atomically via immutable ledger
    const pkg = await db.creditPackage.findUnique({ where: { id: order.packageId } });
    const creditsToAdd = pkg ? pkg.credits : 1;

    const ledgerResult = await addCredits({
      userId: session.userId,
      amount: creditsToAdd,
      reason: 'PURCHASE',
      referenceId: order.razorpayOrderId,
      metadata: {
        orderId: order.id,
        packageName: pkg?.name,
        amountInPaise: order.amountInPaise,
        isSandbox: true,
      },
    });

    return NextResponse.json({
      success: true,
      creditsAdded: creditsToAdd,
      newBalance: ledgerResult.balance,
      message: `Payment verified! ${creditsToAdd} credits added to your account.`,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
