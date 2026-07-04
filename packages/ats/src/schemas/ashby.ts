// Ashby Public Job Posting API schema. Source: docs/integrations.md §Ashby.
// Note: workplaceType uses PascalCase (Remote | OnSite | Hybrid), unlike Lever.

import { z } from 'zod';

export const AshbyCompensationSchema = z
  .object({
    compensationTierSummary: z.string().optional(),
    scrapeableCompensationSalarySummary: z.string().optional(),
  })
  .passthrough();

export const AshbyPostingSchema = z
  .object({
    // Ashby's discovery response doesn't always include a top-level id. We recover
    // the id from applyUrl in the adapter; keep it optional here.
    id: z.string().optional(),
    title: z.string(),
    location: z.string().nullable().optional(),
    secondaryLocations: z.array(z.unknown()).optional(),
    department: z.string().nullable().optional(),
    team: z.string().nullable().optional(),
    isListed: z.boolean().optional(),
    isRemote: z.boolean().optional(),
    workplaceType: z.enum(['Remote', 'OnSite', 'Hybrid']).optional(),
    descriptionHtml: z.string().optional(),
    descriptionPlain: z.string().optional(),
    publishedAt: z.string().optional(),
    employmentType: z
      .enum(['FullTime', 'PartTime', 'Intern', 'Contract', 'Temporary'])
      .optional(),
    jobUrl: z.string().url().optional(),
    applyUrl: z.string().url(),
    compensation: AshbyCompensationSchema.optional(),
  })
  .passthrough();

export const AshbyListResponseSchema = z.object({
  apiVersion: z.string().optional(),
  jobs: z.array(AshbyPostingSchema),
});

export type AshbyPosting = z.infer<typeof AshbyPostingSchema>;
