import { z } from 'zod';

export const createOrderSchema = z.object({
  packageId: z.string().min(1, 'Package ID is required'),
});

export const verifyPaymentSchema = z.object({
  orderId: z.string().min(1, 'Internal Order ID is required'),
  razorpayOrderId: z.string().min(1, 'Razorpay Order ID is required'),
  razorpayPaymentId: z.string().min(1, 'Razorpay Payment ID is required'),
  razorpaySignature: z.string().optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
