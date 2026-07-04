import 'server-only';

import type {
  Education,
  Experience,
  ExperienceBullet,
  FullProfile,
  Preferences,
  Profile,
  Project,
  QuestionBankEntry,
  Skill,
  Story,
} from '@career-autopilot/resume';
import { createClient } from '@/lib/supabase/server';

// Row selectors aligned with the Zod schemas. `select('*')` because every column
// maps 1:1; we validate shape at the edge with Zod before returning to callers.

export async function loadProfileForUser(userId: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`profiles fetch failed: ${error.message}`);
  if (!data) return null;
  // summary_embedding is a pgvector string; we drop it from the domain type.
  const { summary_embedding: _ignored, ...rest } = data;
  return rest as unknown as Profile;
}

export async function loadFullProfileForUser(
  userId: string,
): Promise<Omit<FullProfile, 'exported_at' | 'schema_version'> | null> {
  const supabase = await createClient();

  const profileResult = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (profileResult.error) throw new Error(profileResult.error.message);
  if (!profileResult.data) return null;
  const { summary_embedding: _dropEmbedding, ...profileRow } = profileResult.data;
  const profile = profileRow as unknown as Profile;

  const [
    experiencesResult,
    bulletsResult,
    projectsResult,
    skillsResult,
    educationResult,
    storiesResult,
    preferencesResult,
    questionBankResult,
  ] = await Promise.all([
    supabase.from('experiences').select('*').eq('user_id', userId).order('ord'),
    supabase.from('experience_bullets').select('*').eq('user_id', userId).order('ord'),
    supabase.from('projects').select('*').eq('user_id', userId).order('ord'),
    supabase.from('skills').select('*').eq('user_id', userId).order('name'),
    supabase.from('education').select('*').eq('user_id', userId).order('ord'),
    supabase.from('stories').select('*').eq('user_id', userId),
    supabase.from('preferences').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('question_bank').select('*').eq('user_id', userId),
  ]);

  for (const r of [
    experiencesResult,
    bulletsResult,
    projectsResult,
    skillsResult,
    educationResult,
    storiesResult,
    preferencesResult,
    questionBankResult,
  ]) {
    if (r.error) throw new Error(r.error.message);
  }

  const bullets = (bulletsResult.data ?? []) as unknown as ExperienceBullet[];
  const bulletsByExp = new Map<string, ExperienceBullet[]>();
  for (const b of bullets) {
    const list = bulletsByExp.get(b.experience_id) ?? [];
    list.push(b);
    bulletsByExp.set(b.experience_id, list);
  }

  const experiences = ((experiencesResult.data ?? []) as unknown as Experience[]).map(
    (exp) => ({ ...exp, bullets: bulletsByExp.get(exp.id) ?? [] }),
  );

  const fallbackPreferences: Preferences = {
    user_id: userId,
    experience_levels: [],
    work_modes: ['remote', 'hybrid'],
    job_types: ['full_time'],
    salary_min: null,
    salary_max: null,
    salary_currency: 'USD',
    locations: null,
    remote_anywhere: false,
    industries_include: null,
    industries_exclude: null,
    company_size_min: null,
    company_size_max: null,
    notice_period_days: null,
    willing_to_relocate: false,
    daily_app_cap: 30,
    created_at: profile.created_at,
    updated_at: profile.updated_at,
  };

  return {
    profile,
    experiences,
    projects: (projectsResult.data ?? []) as unknown as Project[],
    skills: (skillsResult.data ?? []) as unknown as Skill[],
    education: (educationResult.data ?? []) as unknown as Education[],
    stories: (storiesResult.data ?? []) as unknown as Story[],
    preferences: (preferencesResult.data as unknown as Preferences | null) ?? fallbackPreferences,
    question_bank: (questionBankResult.data ?? []) as unknown as QuestionBankEntry[],
  };
}
