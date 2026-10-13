import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { createRazorpayOrder, isRazorpayConfigured, getRazorpayKeyId } from '@/lib/razorpay';

import { getPaymentSettings } from '@/lib/payment-settings';

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const body = await req.json();
    const { packageId } = body;

    const paymentSettings = getPaymentSettings();
    if (!paymentSettings.isEnabled) {
      return NextResponse.json(
        { success: false, message: 'UPI payments are currently disabled by the administrator for maintenance.' },
        { status: 503 }
      );
    }

    if (!packageId) {
      return NextResponse.json({ success: false, message: 'Package ID is required.' }, { status: 400 });
    }

    const pkg = await db.creditPackage.findUnique({ where: { id: packageId } });
    if (!pkg || !pkg.isActive) {
      return NextResponse.json({ success: false, message: 'Invalid or inactive credit package.' }, { status: 404 });
    }

    // Amount strictly calculated on server
    const amountInInr = pkg.priceInInr;
    const amountInPaise = Math.round(amountInInr * 100);
    const receipt = `rcpt_${session.userId.substring(0, 8)}_${Date.now()}`;
    const idempotencyKey = `idemp_${session.userId}_${pkg.id}_${Date.now()}`;

    // Create payment order (via Razorpay API or test sandbox)
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

    // Save order in database
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

    // Merchant UPI ID from payment settings or env
    const merchantVpa = paymentSettings.upiId || process.env.RAZORPAY_MERCHANT_VPA || 'campusconnect@razorpay';
    const upiNote = encodeURIComponent(`CampusConnect ${pkg.credits} Credits Ref ${order.id.slice(-6)}`);
    
    // Standard National Payments Corporation of India (NPCI) UPI Intent URL
    const upiUrl = `upi://pay?pa=${merchantVpa}&pn=${encodeURIComponent(paymentSettings.receiverName || 'CampusConnect')}&am=${amountInInr.toFixed(2)}&tr=${razorpayOrder.orderId}&tn=${upiNote}&cu=INR`;

    // Render QR Code as fallback if no custom QR image uploaded
    let qrCodeDataUrl = '';
    if (!paymentSettings.qrImageUrl) {
      qrCodeDataUrl = await QRCode.toDataURL(upiUrl, {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 320,
        color: {
          dark: '#0a0f1d',
          light: '#ffffff',
        },
      });
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      razorpayOrderId: razorpayOrder.orderId,
      amountInInr,
      amountInPaise,
      packageName: pkg.name,
      credits: pkg.credits,
      upiUrl,
      merchantVpa,
      qrCodeDataUrl,
      status: 'CREATED',
      keyId: getRazorpayKeyId(),
      isSandbox: razorpayOrder.isSandboxSimulation,
      isRazorpayConfigured: isRazorpayConfigured(),
      // Custom UPI QR settings
      customQrImageUrl: paymentSettings.qrImageUrl || null,
      receiverName: paymentSettings.receiverName || 'KRISH SO ANIL KUMAR',
      upiId: paymentSettings.upiId || '',
      instructions: paymentSettings.instructions,
      isCustomQr: Boolean(paymentSettings.qrImageUrl),
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    console.error('Create QR order error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
