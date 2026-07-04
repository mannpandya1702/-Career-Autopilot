import { describe, expect, it } from 'vitest';
import {
  ExperienceInputSchema,
  FullProfileSchema,
  PreferencesInputSchema,
  ProfileInputSchema,
  SkillInputSchema,
  StoryInputSchema,
} from './profile';

describe('ProfileInputSchema', () => {
  it('accepts a minimal profile', () => {
    const parsed = ProfileInputSchema.safeParse({
      full_name: 'Ada Lovelace',
      email: 'ada@example.com',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const parsed = ProfileInputSchema.safeParse({
      full_name: 'Ada Lovelace',
      email: 'not-an-email',
    });
    expect(parsed.success).toBe(false);
  });
});

describe('ExperienceInputSchema', () => {
  it('rejects end_date before start_date', () => {
    const parsed = ExperienceInputSchema.safeParse({
      company: 'Acme',
      title: 'Engineer',
      start_date: '2024-06-01',
      end_date: '2024-01-01',
    });
    expect(parsed.success).toBe(false);
  });

  it('accepts current role (end_date null)', () => {
    const parsed = ExperienceInputSchema.safeParse({
      company: 'Acme',
      title: 'Engineer',
      start_date: '2024-01-01',
      end_date: null,
    });
    expect(parsed.success).toBe(true);
  });
});

describe('SkillInputSchema', () => {
  it('requires a known category', () => {
    const good = SkillInputSchema.safeParse({ name: 'TypeScript', category: 'language' });
    const bad = SkillInputSchema.safeParse({ name: 'TypeScript', category: 'magic' });
    expect(good.success).toBe(true);
    expect(bad.success).toBe(false);
  });

  it('clamps proficiency to 1-5', () => {
    const bad = SkillInputSchema.safeParse({
      name: 'TypeScript',
      category: 'language',
      proficiency: 7,
    });
    expect(bad.success).toBe(false);
  });
});

describe('StoryInputSchema', () => {
  it('requires at least one dimension', () => {
    const parsed = StoryInputSchema.safeParse({
      dimensions: [],
      title: 'Shipped v1',
      situation: 's',
      task: 't',
      action: 'a',
      result: 'r',
    });
    expect(parsed.success).toBe(false);
  });
});

describe('PreferencesInputSchema', () => {
  it('rejects salary_max < salary_min', () => {
    const parsed = PreferencesInputSchema.safeParse({
      salary_min: 120_000,
      salary_max: 100_000,
    });
    expect(parsed.success).toBe(false);
  });

  it('applies defaults', () => {
    const parsed = PreferencesInputSchema.parse({});
    expect(parsed.work_modes).toEqual(['remote', 'hybrid']);
    expect(parsed.job_types).toEqual(['full_time']);
    expect(parsed.daily_app_cap).toBe(30);
    expect(parsed.salary_currency).toBe('USD');
  });
});

describe('FullProfileSchema', () => {
  it('rejects empty object', () => {
    const parsed = FullProfileSchema.safeParse({});
    expect(parsed.success).toBe(false);
  });
});
