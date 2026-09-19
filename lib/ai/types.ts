import { z } from 'zod';

export const JobCategoryEnum = z.enum([
  'APPLICATION',
  'APPLICATION_RECEIVED',
  'RECRUITER',
  'ASSESSMENT',
  'INTERVIEW',
  'INTERVIEW_SCHEDULE',
  'REJECTION',
  'OFFER',
  'FOLLOW_UP',
  'OTHER_JOB',
  'NOT_JOB_RELATED',
]);

export type JobCategory = z.infer<typeof JobCategoryEnum>;

export const ClassificationResultSchema = z.object({
  isJobRelated: z.boolean(),
  category: JobCategoryEnum,
  company: z.string().nullable(),
  role: z.string().nullable(),
  platform: z.string().default('Unknown'),
  requiresAttention: z.boolean(),
  confidence: z.number().min(0).max(1),
});

export type ClassificationResult = z.infer<typeof ClassificationResultSchema>;

export interface EmailClassificationInput {
  subject: string;
  sender: string;
  senderEmail: string;
  snippet: string;
  bodyText?: string;
  links?: string[];
}
