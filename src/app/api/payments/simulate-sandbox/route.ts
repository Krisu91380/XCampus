import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  // Security: Test payments are disabled to prevent granting unverified credits
  return NextResponse.json(
    {
      success: false,
      message: 'Test payment simulation is permanently disabled. Please use Direct UPI QR or live Razorpay payments.',
    },
    { status: 403 }
  );
}
