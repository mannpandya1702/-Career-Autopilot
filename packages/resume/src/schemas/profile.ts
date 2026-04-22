// Zod schemas for the master profile domain. Mirrors supabase/migrations/*_profile_domain.sql.
// These are the runtime contract for everything that touches profile data: API routes,
// LLM parsers, onboarding UI, profile editor, exports.
//
// RULE: any time the migration changes, change these schemas and the generated
// Database types in the same commit.

import { z } from 'zod';

// ---- Enums (must match SQL enums) ----
export const ExperienceLevelSchema = z.enum([
  'intern',
  'entry',
  'mid',
  'senior',
  'lead',
  'principal',
]);
export type ExperienceLevel = z.infer<typeof ExperienceLevelSchema>;

export const WorkModeSchema = z.enum(['remote', 'hybrid', 'onsite']);
export type WorkMode = z.infer<typeof WorkModeSchema>;

export const JobTypeSchema = z.enum([
  'full_time',
  'part_time',
  'contract',
  'internship',
  'freelance',
]);
export type JobType = z.infer<typeof JobTypeSchema>;

export const SkillCategorySchema = z.enum([
  'language',
  'framework',
  'tool',
  'domain',
  'soft',
  'certification',
  'database',
  'cloud',
]);
export type SkillCategory = z.infer<typeof SkillCategorySchema>;

export const StoryDimensionSchema = z.enum([
  'leadership',
  'conflict',
  'failure',
  'ambiguity',
  'ownership',
  'influence',
  'learning',
  'metric_win',
  'teamwork',
  'customer_focus',
]);
export type StoryDimension = z.infer<typeof StoryDimensionSchema>;

// ---- Reusable primitives ----
const UuidSchema = z.string().uuid();
const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected ISO date YYYY-MM-DD');
const IsoTimestampSchema = z.string().datetime({ offset: true });
const UrlOrEmpty = z.union([z.string().url(), z.literal('')]).optional();

// ---- profiles ----
export const ProfileSchema = z.object({
  id: UuidSchema,
  user_id: UuidSchema,
  full_name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  linkedin_url: UrlOrEmpty.nullable(),
  github_url: UrlOrEmpty.nullable(),
  portfolio_url: UrlOrEmpty.nullable(),
  headline: z.string().max(300).nullable().optional(),
  summary: z.string().max(4000).nullable().optional(),
  derived_summary: z.string().max(2000).nullable().optional(),
  visa_status: z.string().nullable().optional(),
  work_authorization: z.array(z.string()).nullable().optional(),
  years_experience: z.number().min(0).max(80).nullable().optional(),
  created_at: IsoTimestampSchema,
  updated_at: IsoTimestampSchema,
});
export type Profile = z.infer<typeof ProfileSchema>;

export const ProfileInputSchema = ProfileSchema.omit({
  id: true,
  user_id: true,
  derived_summary: true,
  created_at: true,
  updated_at: true,
});
export type ProfileInput = z.infer<typeof ProfileInputSchema>;

// ---- experiences ----
export const ExperienceSchema = z
  .object({
    id: UuidSchema,
    user_id: UuidSchema,
    profile_id: UuidSchema,
    company: z.string().min(1),
    title: z.string().min(1),
    location: z.string().nullable().optional(),
    work_mode: WorkModeSchema.nullable().optional(),
    start_date: IsoDateSchema,
    end_date: IsoDateSchema.nullable().optional(),
    is_current: z.boolean(),
    description: z.string().nullable().optional(),
    tech_stack: z.array(z.string()).nullable().optional(),
    ord: z.number().int().nonnegative(),
    created_at: IsoTimestampSchema,
    updated_at: IsoTimestampSchema,
  })
  .refine(
    (exp) => exp.end_date === null || exp.end_date === undefined || exp.end_date >= exp.start_date,
    { message: 'end_date must be >= start_date', path: ['end_date'] },
  );
export type Experience = z.infer<typeof ExperienceSchema>;

export const ExperienceInputSchema = z
  .object({
    company: z.string().min(1),
    title: z.string().min(1),
    location: z.string().nullable().optional(),
    work_mode: WorkModeSchema.nullable().optional(),
    start_date: IsoDateSchema,
    end_date: IsoDateSchema.nullable().optional(),
    description: z.string().nullable().optional(),
    tech_stack: z.array(z.string()).nullable().optional(),
    ord: z.number().int().nonnegative().default(0),
  })
  .refine(
    (exp) => exp.end_date === null || exp.end_date === undefined || exp.end_date >= exp.start_date,
    { message: 'end_date must be >= start_date', path: ['end_date'] },
  );
export type ExperienceInput = z.infer<typeof ExperienceInputSchema>;

// ---- experience_bullets ----
export const BulletMetricsSchema = z.record(z.string(), z.union([z.number(), z.string()]));
export type BulletMetrics = z.infer<typeof BulletMetricsSchema>;

export const ExperienceBulletSchema = z.object({
  id: UuidSchema,
  user_id: UuidSchema,
  experience_id: UuidSchema,
  text: z.string().min(1).max(1000),
  metrics: BulletMetricsSchema.nullable().optional(),
  skill_tags: z.array(z.string()).nullable().optional(),
  story_id: UuidSchema.nullable().optional(),
  ord: z.number().int().nonnegative(),
  created_at: IsoTimestampSchema,
  updated_at: IsoTimestampSchema,
});
export type ExperienceBullet = z.infer<typeof ExperienceBulletSchema>;

export const ExperienceBulletInputSchema = z.object({
  text: z.string().min(1).max(1000),
  metrics: BulletMetricsSchema.nullable().optional(),
  skill_tags: z.array(z.string()).nullable().optional(),
  story_id: UuidSchema.nullable().optional(),
  ord: z.number().int().nonnegative().default(0),
});
export type ExperienceBulletInput = z.infer<typeof ExperienceBulletInputSchema>;

// ---- bullet_variants ----
export const BulletVariantSchema = z.object({
  id: UuidSchema,
  bullet_id: UuidSchema,
  text: z.string().min(1).max(1000),
  emphasis_tags: z.array(z.string()).nullable().optional(),
  created_at: IsoTimestampSchema,
});
export type BulletVariant = z.infer<typeof BulletVariantSchema>;

// ---- projects ----
export const ProjectSchema = z.object({
  id: UuidSchema,
  user_id: UuidSchema,
  profile_id: UuidSchema,
  name: z.string().min(1),
  role: z.string().nullable().optional(),
  start_date: IsoDateSchema.nullable().optional(),
  end_date: IsoDateSchema.nullable().optional(),
  description: z.string().nullable().optional(),
  tech_stack: z.array(z.string()).nullable().optional(),
  url: UrlOrEmpty.nullable(),
  metrics: BulletMetricsSchema.nullable().optional(),
  skill_tags: z.array(z.string()).nullable().optional(),
  ord: z.number().int().nonnegative(),
  created_at: IsoTimestampSchema,
  updated_at: IsoTimestampSchema,
});
export type Project = z.infer<typeof ProjectSchema>;

export const ProjectInputSchema = ProjectSchema.omit({
  id: true,
  user_id: true,
  profile_id: true,
  created_at: true,
  updated_at: true,
});
export type ProjectInput = z.infer<typeof ProjectInputSchema>;

// ---- skills ----
export const SkillSchema = z.object({
  id: UuidSchema,
  user_id: UuidSchema,
  name: z.string().min(1).max(120),
  category: SkillCategorySchema,
  proficiency: z.number().int().min(1).max(5).nullable().optional(),
  years_experience: z.number().min(0).max(80).nullable().optional(),
  created_at: IsoTimestampSchema,
  updated_at: IsoTimestampSchema,
});
export type Skill = z.infer<typeof SkillSchema>;

export const SkillInputSchema = z.object({
  name: z.string().min(1).max(120),
  category: SkillCategorySchema,
  proficiency: z.number().int().min(1).max(5).nullable().optional(),
  years_experience: z.number().min(0).max(80).nullable().optional(),
});
export type SkillInput = z.infer<typeof SkillInputSchema>;

// ---- education ----
export const EducationSchema = z.object({
  id: UuidSchema,
  user_id: UuidSchema,
  profile_id: UuidSchema,
  institution: z.string().min(1),
  degree: z.string().nullable().optional(),
  field: z.string().nullable().optional(),
  start_date: IsoDateSchema.nullable().optional(),
  end_date: IsoDateSchema.nullable().optional(),
  gpa: z.number().min(0).max(10).nullable().optional(),
  coursework: z.array(z.string()).nullable().optional(),
  honors: z.array(z.string()).nullable().optional(),
  ord: z.number().int().nonnegative(),
  created_at: IsoTimestampSchema,
  updated_at: IsoTimestampSchema,
});
export type Education = z.infer<typeof EducationSchema>;

export const EducationInputSchema = EducationSchema.omit({
  id: true,
  user_id: true,
  profile_id: true,
  created_at: true,
  updated_at: true,
});
export type EducationInput = z.infer<typeof EducationInputSchema>;

// ---- stories (STAR) ----
export const StorySchema = z.object({
  id: UuidSchema,
  user_id: UuidSchema,
  profile_id: UuidSchema,
  dimensions: z.array(StoryDimensionSchema).min(1),
  title: z.string().min(1).max(200),
  situation: z.string().min(1),
  task: z.string().min(1),
  action: z.string().min(1),
  result: z.string().min(1),
  reflection: z.string().nullable().optional(),
  linked_experience_id: UuidSchema.nullable().optional(),
  linked_project_id: UuidSchema.nullable().optional(),
  created_at: IsoTimestampSchema,
  updated_at: IsoTimestampSchema,
});
export type Story = z.infer<typeof StorySchema>;

export const StoryInputSchema = StorySchema.omit({
  id: true,
  user_id: true,
  profile_id: true,
  created_at: true,
  updated_at: true,
});
export type StoryInput = z.infer<typeof StoryInputSchema>;

// ---- preferences ----
export const PreferencesSchema = z
  .object({
    user_id: UuidSchema,
    experience_levels: z.array(ExperienceLevelSchema).default([]),
    work_modes: z.array(WorkModeSchema).default(['remote', 'hybrid']),
    job_types: z.array(JobTypeSchema).default(['full_time']),
    salary_min: z.number().nonnegative().nullable().optional(),
    salary_max: z.number().nonnegative().nullable().optional(),
    salary_currency: z.string().length(3).default('USD'),
    locations: z.array(z.string()).nullable().optional(),
    remote_anywhere: z.boolean().default(false),
    industries_include: z.array(z.string()).nullable().optional(),
    industries_exclude: z.array(z.string()).nullable().optional(),
    company_size_min: z.number().int().nonnegative().nullable().optional(),
    company_size_max: z.number().int().nonnegative().nullable().optional(),
    notice_period_days: z.number().int().nonnegative().nullable().optional(),
    willing_to_relocate: z.boolean().default(false),
    daily_app_cap: z.number().int().positive().default(30),
    created_at: IsoTimestampSchema,
    updated_at: IsoTimestampSchema,
  })
  .refine(
    (p) =>
      p.salary_min == null || p.salary_max == null || p.salary_max >= p.salary_min,
    { message: 'salary_max must be >= salary_min', path: ['salary_max'] },
  )
  .refine(
    (p) =>
      p.company_size_min == null ||
      p.company_size_max == null ||
      p.company_size_max >= p.company_size_min,
    { message: 'company_size_max must be >= company_size_min', path: ['company_size_max'] },
  );
export type Preferences = z.infer<typeof PreferencesSchema>;

export const PreferencesInputSchema = z
  .object({
    experience_levels: z.array(ExperienceLevelSchema).default([]),
    work_modes: z.array(WorkModeSchema).default(['remote', 'hybrid']),
    job_types: z.array(JobTypeSchema).default(['full_time']),
    salary_min: z.number().nonnegative().nullable().optional(),
    salary_max: z.number().nonnegative().nullable().optional(),
    salary_currency: z.string().length(3).default('USD'),
    locations: z.array(z.string()).nullable().optional(),
    remote_anywhere: z.boolean().default(false),
    industries_include: z.array(z.string()).nullable().optional(),
    industries_exclude: z.array(z.string()).nullable().optional(),
    company_size_min: z.number().int().nonnegative().nullable().optional(),
    company_size_max: z.number().int().nonnegative().nullable().optional(),
    notice_period_days: z.number().int().nonnegative().nullable().optional(),
    willing_to_relocate: z.boolean().default(false),
    daily_app_cap: z.number().int().positive().default(30),
  })
  .refine(
    (p) =>
      p.salary_min == null || p.salary_max == null || p.salary_max >= p.salary_min,
    { message: 'salary_max must be >= salary_min', path: ['salary_max'] },
  );
export type PreferencesInput = z.infer<typeof PreferencesInputSchema>;

// ---- question_bank ----
export const QuestionBankEntrySchema = z.object({
  id: UuidSchema,
  user_id: UuidSchema,
  question_key: z.string().min(1).max(120),
  question_text: z.string().min(1),
  answer_text: z.string().min(1),
  word_limit: z.number().int().positive().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  created_at: IsoTimestampSchema,
  updated_at: IsoTimestampSchema,
});
export type QuestionBankEntry = z.infer<typeof QuestionBankEntrySchema>;

export const QuestionBankInputSchema = z.object({
  question_key: z.string().min(1).max(120),
  question_text: z.string().min(1),
  answer_text: z.string().min(1),
  word_limit: z.number().int().positive().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
});
export type QuestionBankInput = z.infer<typeof QuestionBankInputSchema>;

// ---- profile_audit ----
export const ProfileAuditSchema = z.object({
  id: UuidSchema,
  user_id: UuidSchema,
  entity_type: z.string().min(1),
  entity_id: UuidSchema,
  action: z.enum(['insert', 'update', 'delete']),
  before: z.unknown().nullable().optional(),
  after: z.unknown().nullable().optional(),
  created_at: IsoTimestampSchema,
});
export type ProfileAudit = z.infer<typeof ProfileAuditSchema>;

// ---- Full profile export ----
// The JSON shape the "Download profile as JSON" endpoint returns (P2.7) and that
// matches the onboarding form state. Composed from every schema above.
export const FullProfileSchema = z.object({
  profile: ProfileSchema,
  experiences: z.array(
    ExperienceSchema.and(
      z.object({
        bullets: z.array(ExperienceBulletSchema).default([]),
      }),
    ),
  ),
  projects: z.array(ProjectSchema),
  skills: z.array(SkillSchema),
  education: z.array(EducationSchema),
  stories: z.array(StorySchema),
  preferences: PreferencesSchema,
  question_bank: z.array(QuestionBankEntrySchema),
  exported_at: IsoTimestampSchema,
  schema_version: z.literal(1),
});
export type FullProfile = z.infer<typeof FullProfileSchema>;
