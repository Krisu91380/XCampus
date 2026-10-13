import crypto from 'crypto';

export interface RazorpayOrderResult {
  orderId: string;
  amount: number;
  currency: string;
  isSandboxSimulation: boolean;
}

export function isRazorpayConfigured(): boolean {
  return Boolean(
    process.env.RAZORPAY_KEY_ID &&
    process.env.RAZORPAY_KEY_SECRET &&
    process.env.RAZORPAY_KEY_ID.startsWith('rzp_')
  );
}

export function getRazorpayKeyId(): string {
  if (isRazorpayConfigured()) {
    return process.env.RAZORPAY_KEY_ID!;
  }
  return 'rzp_test_placeholder_key';
}

/**
 * Creates an order on Razorpay or generates a sandbox test order
 */
export async function createRazorpayOrder({
  amountInPaise,
  receipt,
  notes,
}: {
  amountInPaise: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrderResult> {
  const isConfigured = isRazorpayConfigured();

  if (isConfigured) {
    const key = process.env.RAZORPAY_KEY_ID!;
    const secret = process.env.RAZORPAY_KEY_SECRET!;
    const auth = Buffer.from(`${key}:${secret}`).toString('base64');

    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: 'INR',
        receipt,
        notes: notes || {},
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Razorpay Order Creation Failed: ${err.error?.description || res.statusText}`);
    }

    const data = await res.json();
    return {
      orderId: data.id,
      amount: data.amount,
      currency: data.currency,
      isSandboxSimulation: false,
    };
  }

  // If Razorpay keys are not provided, return a simulation order reference
  const testOrderId = `order_sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  return {
    orderId: testOrderId,
    amount: amountInPaise,
    currency: 'INR',
    isSandboxSimulation: true,
  };
}

/**
 * Verifies Razorpay HMAC-SHA256 signature
 */
export function verifyRazorpaySignature({
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature?: string | null;
}): { verified: boolean; isSandbox: boolean } {
  // If this was a sandbox order and keys are not present
  if (!isRazorpayConfigured() && process.env.ENABLE_SANDBOX_PAYMENTS === 'true') {
    if (razorpayOrderId.startsWith('order_test_')) {
      return { verified: true, isSandbox: true };
    }
  }

  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    throw new Error('RAZORPAY_KEY_SECRET is not configured on the server.');
  }

  if (!razorpaySignature) {
    return { verified: false, isSandbox: false };
  }

  const generatedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  const generatedBuf = Buffer.from(generatedSignature);
  const signatureBuf = Buffer.from(razorpaySignature);

  if (generatedBuf.length !== signatureBuf.length) {
    return { verified: false, isSandbox: false };
  }

  const verified = crypto.timingSafeEqual(generatedBuf, signatureBuf);

  return { verified, isSandbox: false };
}

/**
 * Verifies Razorpay Webhook signature
 */
export function verifyWebhookSignature({
  payload,
  signature,
}: {
  payload: string;
  signature: string;
}): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  const expectedBuf = Buffer.from(expectedSignature);
  const signatureBuf = Buffer.from(signature);

  if (expectedBuf.length !== signatureBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, signatureBuf);
}
