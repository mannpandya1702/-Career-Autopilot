// Lever Postings API schema. Source: docs/integrations.md §Lever.
// Lever's response is a BARE ARRAY, not `{ jobs: [...] }`.

import { z } from 'zod';

export const LeverCategoriesSchema = z
  .object({
    commitment: z.string().optional(),
    department: z.string().optional(),
    location: z.string().optional(),
    team: z.string().optional(),
    level: z.string().optional(),
    allLocations: z.array(z.string()).optional(),
  })
  .passthrough();

export const LeverSalarySchema = z
  .object({
    currency: z.string().optional(),
    interval: z.string().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
  })
  .passthrough();

export const LeverListSchema = z.object({
  text: z.string().optional(),
  content: z.string().optional(),
});

export const LeverPostingSchema = z
  .object({
    id: z.string(),
    text: z.string(),
    hostedUrl: z.string().url(),
    applyUrl: z.string().url().optional(),
    categories: LeverCategoriesSchema.optional(),
    createdAt: z.number().optional(), // Unix ms
    descriptionPlain: z.string().optional(),
    description: z.string().optional(),
    additionalPlain: z.string().optional(),
    additional: z.string().optional(),
    lists: z.array(LeverListSchema).optional(),
    workplaceType: z.enum(['unspecified', 'on-site', 'remote', 'hybrid']).optional(),
    salaryRange: LeverSalarySchema.optional(),
    salaryDescription: z.string().optional(),
  })
  .passthrough();

export const LeverListResponseSchema = z.array(LeverPostingSchema);

export type LeverPosting = z.infer<typeof LeverPostingSchema>;
