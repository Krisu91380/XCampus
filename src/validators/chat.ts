import { z } from 'zod';

export const sendMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Message cannot be empty')
    .max(1000, 'Message cannot exceed 1000 characters'),
});

export const reportUserSchema = z.object({
  reportedUserId: z.string().min(1, 'Target user is required'),
  conversationId: z.string().optional(),
  reason: z.enum([
    'HARASSMENT',
    'INAPPROPRIATE_CONTENT',
    'UNDERAGE',
    'SPAM',
    'IMPERSONATION',
    'OTHER',
  ]),
  details: z.string().min(10, 'Please provide at least 10 characters of detail').max(1000),
});

export const blockUserSchema = z.object({
  blockedId: z.string().min(1, 'Target user is required'),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type ReportUserInput = z.infer<typeof reportUserSchema>;
export type BlockUserInput = z.infer<typeof blockUserSchema>;
