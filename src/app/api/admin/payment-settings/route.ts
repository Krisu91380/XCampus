import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getPaymentSettings, savePaymentSettings } from '@/lib/payment-settings';
import { logAdminAction } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const settings = getPaymentSettings();
    return NextResponse.json({ success: true, settings });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 403 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin(req);
    const body = await req.json();
    const { isEnabled, receiverName, upiId, qrImageUrl, instructions } = body;

    if (!receiverName || !qrImageUrl) {
      return NextResponse.json(
        { success: false, message: 'Receiver name and QR code image URL are required.' },
        { status: 400 }
      );
    }

    const updated = savePaymentSettings(
      {
        isEnabled: Boolean(isEnabled),
        receiverName: String(receiverName).trim(),
        upiId: upiId ? String(upiId).trim() : '',
        qrImageUrl: String(qrImageUrl).trim(),
        instructions: String(instructions || '').trim(),
      },
      session.userId
    );

    await logAdminAction({
      adminId: session.userId,
      action: 'PAYMENT_SETTINGS_UPDATED',
      targetType: 'PaymentSettings',
      targetId: 'global',
      details: { receiverName, isEnabled, qrImageUrl },
    });

    return NextResponse.json({
      success: true,
      settings: updated,
      message: 'Payment settings saved successfully.',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 403 });
  }
}
