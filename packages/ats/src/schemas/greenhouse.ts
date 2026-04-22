// Greenhouse Job Board API schema. Source: docs/integrations.md §Greenhouse.
// `passthrough()` so vendor-added fields don't break the parse.

import { z } from 'zod';

export const GreenhouseLocationSchema = z.object({
  name: z.string().nullable().optional(),
});

export const GreenhouseJobSchema = z
  .object({
    id: z.number(),
    internal_job_id: z.number().optional(),
    title: z.string(),
    updated_at: z.string().optional(),
    requisition_id: z.string().nullable().optional(),
    location: GreenhouseLocationSchema.nullable().optional(),
    absolute_url: z.string().url(),
    language: z.string().optional(),
    metadata: z.any().nullable().optional(),
    content: z.string().optional(),
    first_published: z.string().optional(),
    departments: z.array(z.object({ id: z.number(), name: z.string() })).optional(),
    offices: z
      .array(
        z.object({
          id: z.number(),
          name: z.string(),
          location: z.string().nullable().optional(),
        }),
      )
      .optional(),
  })
  .passthrough();

export const GreenhouseListResponseSchema = z.object({
  jobs: z.array(GreenhouseJobSchema),
  meta: z.object({ total: z.number() }).optional(),
});

export type GreenhouseJob = z.infer<typeof GreenhouseJobSchema>;
export type GreenhouseListResponse = z.infer<typeof GreenhouseListResponseSchema>;
