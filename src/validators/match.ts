import { z } from 'zod';

export const matchPreferenceSchema = z.object({
  targetUniversityId: z.string().nullable().optional(),
  preferredPartnerGender: z.enum(['BOYS', 'GIRLS', 'EVERYONE']),
  preferredLanguage: z.string().nullable().optional(),
  preferredCourse: z.string().nullable().optional(),
  preferredYear: z.string().nullable().optional(),
  randomMatch: z.boolean().default(true),
});

export const joinQueueSchema = z.object({
  targetUniversityId: z.string().nullable().optional(),
  preferredPartnerGender: z.enum(['BOYS', 'GIRLS', 'EVERYONE']),
  userGender: z.enum(['MALE', 'FEMALE', 'NON_BINARY', 'OTHER', 'PREFER_NOT_TO_SAY']).optional(),
  language: z.string().nullable().optional(),
  course: z.string().nullable().optional(),
});

export type MatchPreferenceInput = z.infer<typeof matchPreferenceSchema>;
export type JoinQueueInput = z.infer<typeof joinQueueSchema>;
