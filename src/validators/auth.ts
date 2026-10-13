import { z } from 'zod';
import { isAtLeast18 } from '@/lib/auth';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  displayName: z.string().min(2, 'Name must be at least 2 characters').max(50).trim(),
  dateOfBirth: z.string().refine((val) => isAtLeast18(val), {
    message: 'You must be at least 18 years of age to join CampusConnect.',
  }),
  universityId: z.string().min(1, 'Please select your university'),
  gender: z.enum(['MALE', 'FEMALE', 'NON_BINARY', 'OTHER', 'PREFER_NOT_TO_SAY']),
  course: z.string().max(100).optional(),
  academicYear: z.string().max(50).optional(),
  bio: z.string().max(300).optional(),
  language: z.string().default('English'),
  interests: z.array(z.string()).max(10).default([]),
  termsAccepted: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the Terms and Community Guidelines' }),
  }),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
