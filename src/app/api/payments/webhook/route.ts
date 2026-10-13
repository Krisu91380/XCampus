import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/razorpay';
import { db } from '@/lib/db';
import { addCredits } from '@/lib/ledger';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature');

    if (!signature) {
      return NextResponse.json({ success: false, message: 'Missing signature header' }, { status: 400 });
    }

    const isValid = verifyWebhookSignature({ payload: rawBody, signature });
    if (!isValid) {
      return NextResponse.json({ success: false, message: 'Invalid webhook signature' }, { status: 400 });
    }

    const event = JSON.parse(rawBody);
    const eventId = event.event_id || event.id || `evt_${Date.now()}`;

    // Webhook idempotency: check if already processed
    const existing = await db.paymentOrder.findUnique({
      where: { razorpayOrderId: event.payload?.payment?.entity?.order_id },
    });

    if (event.event === 'payment.captured') {
      const paymentEntity = event.payload.payment.entity;
      const razorpayOrderId = paymentEntity.order_id;
      const razorpayPaymentId = paymentEntity.id;

      const order = await db.paymentOrder.findUnique({ where: { razorpayOrderId } });
      if (order && order.status !== 'PAID') {
        await db.paymentOrder.update({
          where: { id: order.id },
          data: { status: 'PAID' },
        });

        const pkg = await db.creditPackage.findUnique({ where: { id: order.packageId } });
        const credits = pkg ? pkg.credits : 1;

        await addCredits({
          userId: order.userId,
          amount: credits,
          reason: 'PURCHASE',
          referenceId: razorpayOrderId,
          metadata: {
            webhookEventId: eventId,
            razorpayPaymentId,
            amount: paymentEntity.amount,
          },
        });
      }
    }

    return NextResponse.json({ status: 'ok', received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
