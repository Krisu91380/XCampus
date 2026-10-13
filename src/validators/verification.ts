import { z } from 'zod';

export const submitVerificationSchema = z.object({
  universityId: z.string().min(1, 'University is required'),
  documentType: z.enum(['INSTITUTION_EMAIL', 'ID_CARD', 'ADMISSION_LETTER']),
  institutionalEmail: z.string().email('Invalid institutional email').optional().or(z.literal('')),
  idCardUrl: z.string().url('Invalid document URL').optional().or(z.literal('')),
});

export const reviewVerificationSchema = z.object({
  verificationId: z.string().min(1, 'Verification ID is required'),
  action: z.enum(['APPROVE', 'REJECT']),
  rejectionReason: z.string().optional(),
});

export type SubmitVerificationInput = z.infer<typeof submitVerificationSchema>;
export type ReviewVerificationInput = z.infer<typeof reviewVerificationSchema>;
