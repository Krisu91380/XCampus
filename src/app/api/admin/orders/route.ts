import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { logAdminAction } from '@/lib/audit';
import { deductCredits } from '@/lib/ledger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const orders = await db.paymentOrder.findMany();
    const users = await db.user.findMany();
    const packages = await db.creditPackage.findMany();

    const userMap = new Map((users as any[]).map((u) => [u.id, u]));
    const pkgMap = new Map((packages as any[]).map((p) => [p.id, p]));

    const enrichedOrders = (orders as any[]).map((o) => {
      const user = userMap.get(o.userId);
      const pkg = pkgMap.get(o.packageId);
      return {
        id: o.id,
        userId: o.userId,
        userEmail: user?.email || 'Unknown User',
        packageId: o.packageId,
        packageName: pkg?.name || 'Custom Package',
        credits: pkg?.credits || 0,
        amountInInr: o.amountInPaise / 100,
        razorpayOrderId: o.razorpayOrderId,
        status: o.status,
        utrNumber: o.utrNumber,
        receiptUrl: o.receiptUrl,
        verifiedBy: o.verifiedBy,
        verifiedAt: o.verifiedAt,
        rejectionReason: o.rejectionReason,
        createdAt: o.createdAt,
      };
    });

    // Sort by createdAt descending
    enrichedOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ success: true, orders: enrichedOrders });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 403 });
  }
}

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

    if (order.status !== 'PAID') {
      return NextResponse.json({ success: false, message: 'Only paid orders can be refunded.' }, { status: 400 });
    }

    // Mark order as REFUNDED
    await db.paymentOrder.update({
      where: { id: order.id },
      data: { status: 'REFUNDED' },
    });

    const pkg = await db.creditPackage.findUnique({ where: { id: order.packageId } });
    const creditsToDeduct = pkg?.credits || 1;

    // Deduct credits from user ledger
    await deductCredits({
      userId: order.userId,
      amount: creditsToDeduct,
      reason: 'REFUND',
      referenceId: order.razorpayOrderId,
      metadata: { refundedBy: session.userId, orderId: order.id },
    });

    // Record admin security audit log
    await logAdminAction({
      adminId: session.userId,
      action: 'ORDER_REFUNDED',
      targetType: 'PaymentOrder',
      targetId: order.id,
      details: {
        userId: order.userId,
        amountInPaise: order.amountInPaise,
        creditsDeducted: creditsToDeduct,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Order ${order.id} refunded successfully. ${creditsToDeduct} credits reversed from user account.`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 403 });
  }
}
