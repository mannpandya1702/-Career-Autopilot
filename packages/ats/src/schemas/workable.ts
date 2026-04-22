// Workable widget accounts API schema. Source: docs/integrations.md §Workable.

import { z } from 'zod';

export const WorkableLocationSchema = z
  .object({
    city: z.string().nullable().optional(),
    region: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
    workplace_type: z.enum(['on_site', 'remote', 'hybrid']).optional(),
  })
  .passthrough();

export const WorkableJobSchema = z
  .object({
    id: z.string(),
    shortcode: z.string().optional(),
    title: z.string(),
    full_title: z.string().optional(),
    location: WorkableLocationSchema.nullable().optional(),
    department: z.string().nullable().optional(),
    published_on: z.string().optional(),
    created_at: z.string().optional(),
    apply_url: z.string().url(),
    description: z.string().optional(),
    requirements: z.string().optional(),
    benefits: z.string().optional(),
    employment_type: z.string().optional(),
    salary: z
      .object({
        min: z.number().optional(),
        max: z.number().optional(),
        currency: z.string().optional(),
      })
      .nullable()
      .optional(),
  })
  .passthrough();

export const WorkableListResponseSchema = z
  .object({
    name: z.string().optional(),
    description: z.string().optional(),
    jobs: z.array(WorkableJobSchema),
  })
  .passthrough();

export type WorkableJob = z.infer<typeof WorkableJobSchema>;
