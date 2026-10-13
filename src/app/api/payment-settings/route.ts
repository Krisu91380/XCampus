import { NextResponse } from 'next/server';
import { getPaymentSettings } from '@/lib/payment-settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const settings = getPaymentSettings();
    return NextResponse.json({
      success: true,
      settings: {
        isEnabled: settings.isEnabled,
        receiverName: settings.receiverName,
        upiId: settings.upiId,
        qrImageUrl: settings.qrImageUrl,
        instructions: settings.instructions,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
