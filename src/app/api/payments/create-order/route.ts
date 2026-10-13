import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createOrderSchema } from '@/validators/payment';
import { db } from '@/lib/db';
import { createRazorpayOrder, getRazorpayKeyId, isRazorpayConfigured } from '@/lib/razorpay';

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const body = await req.json();
    const validated = createOrderSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { success: false, errors: validated.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { packageId } = validated.data;
    const pkg = await db.creditPackage.findUnique({ where: { id: packageId } });

    if (!pkg || !pkg.isActive) {
      return NextResponse.json({ success: false, message: 'Invalid or inactive credit package.' }, { status: 404 });
    }

    // Always compute amount on server in paise (1 INR = 100 paise)
    const amountInPaise = Math.round(pkg.priceInInr * 100);
    const receipt = `rcpt_${session.userId.substring(0, 8)}_${Date.now()}`;
    const idempotencyKey = `idemp_${session.userId}_${pkg.id}_${Date.now()}`;

    // Call Razorpay API or test sandbox
    const razorpayOrder = await createRazorpayOrder({
      amountInPaise,
      receipt,
      notes: {
        userId: session.userId,
        packageId: pkg.id,
        credits: String(pkg.credits),
        packageName: pkg.name,
      },
    });

    // Persist PaymentOrder in DB
    const order = await db.paymentOrder.create({
      data: {
        userId: session.userId,
        packageId: pkg.id,
        razorpayOrderId: razorpayOrder.orderId,
        amountInPaise,
        currency: 'INR',
        status: 'CREATED',
        idempotencyKey,
      },
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      razorpayOrderId: razorpayOrder.orderId,
      amount: amountInPaise,
      currency: 'INR',
      keyId: getRazorpayKeyId(),
      packageName: pkg.name,
      credits: pkg.credits,
      isConfigured: isRazorpayConfigured(),
      isSandbox: razorpayOrder.isSandboxSimulation,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    console.error('Payment order creation error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
