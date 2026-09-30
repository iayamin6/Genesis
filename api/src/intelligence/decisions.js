import { z } from 'zod';
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) => Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
    'Invalid calendar date',
  );
const text = z.string().trim().min(1).max(4000);
export const decisionInput = z
  .object({
    requestId: z.string().uuid(),
    title: z.string().trim().min(1).max(160),
    reason: text,
    expectedResult: text,
    alternatives: z.string().trim().max(4000).default(''),
    ownerId: z.string().min(1).max(100),
    reviewDate: date,
    signalKey: z.string().max(180).optional(),
    actionIds: z
      .array(z.string().regex(/^[a-f\d]{24}$/i))
      .max(10)
      .default([]),
  })
  .strict();
export const reviewInput = z
  .object({
    requestId: z.string().uuid(),
    result: z.enum(['achieved', 'partial', 'not_achieved', 'unknown']),
    actualResult: text,
    lesson: text,
    nextReviewDate: date.optional(),
  })
  .strict();
