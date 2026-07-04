'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  EducationInputSchema,
  ExperienceBulletInputSchema,
  ExperienceInputSchema,
  PreferencesInputSchema,
  ProfileInputSchema,
  ProjectInputSchema,
  QuestionBankInputSchema,
  SkillInputSchema,
  StoryInputSchema,
} from '@career-autopilot/resume';
import { createClient } from '@/lib/supabase/server';
import {
  addEducation,
  addExperience,
  addProject,
  addStory,
  deleteSkill as deleteSkillMutation,
  upsertPreferences,
  upsertProfile,
  upsertQuestionBankEntry,
  upsertSkill,
} from '@/lib/profile/mutations';

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return user;
}

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

function issuesToMessage(issues: { path: (string | number)[]; message: string }[]): string {
  return issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join(', ');
}

export async function saveProfileStep(
  input: unknown,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = ProfileInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: issuesToMessage(parsed.error.issues) };
  }
  const { id } = await upsertProfile(user.id, parsed.data);
  revalidatePath('/onboarding');
  revalidatePath('/profile');
  return { ok: true, id };
}

export async function addExperienceAction(
  profileId: string,
  experience: unknown,
  bullets: unknown[] = [],
): Promise<ActionResult> {
  const user = await requireUser();
  const expParsed = ExperienceInputSchema.safeParse(experience);
  if (!expParsed.success) return { ok: false, error: issuesToMessage(expParsed.error.issues) };

  const bulletsParsed: { text: string; ord: number }[] = [];
  for (const b of bullets) {
    const p = ExperienceBulletInputSchema.safeParse(b);
    if (!p.success) return { ok: false, error: issuesToMessage(p.error.issues) };
    bulletsParsed.push({ text: p.data.text, ord: p.data.ord ?? 0 });
  }

  const { id } = await addExperience(user.id, profileId, expParsed.data, bulletsParsed);
  revalidatePath('/onboarding');
  revalidatePath('/profile');
  return { ok: true, id };
}

export async function addProjectAction(
  profileId: string,
  input: unknown,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = ProjectInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: issuesToMessage(parsed.error.issues) };
  const { id } = await addProject(user.id, profileId, parsed.data);
  revalidatePath('/profile');
  return { ok: true, id };
}

export async function addEducationAction(
  profileId: string,
  input: unknown,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = EducationInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: issuesToMessage(parsed.error.issues) };
  const { id } = await addEducation(user.id, profileId, parsed.data);
  revalidatePath('/profile');
  return { ok: true, id };
}

export async function upsertSkillAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = SkillInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: issuesToMessage(parsed.error.issues) };
  const { id } = await upsertSkill(user.id, parsed.data);
  revalidatePath('/onboarding');
  revalidatePath('/profile');
  return { ok: true, id };
}

export async function deleteSkillAction(skillId: string): Promise<ActionResult> {
  const user = await requireUser();
  await deleteSkillMutation(user.id, skillId);
  revalidatePath('/onboarding');
  revalidatePath('/profile');
  return { ok: true };
}

export async function savePreferencesAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = PreferencesInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: issuesToMessage(parsed.error.issues) };
  await upsertPreferences(user.id, parsed.data);
  revalidatePath('/onboarding');
  revalidatePath('/profile');
  return { ok: true };
}

export async function addStoryAction(
  profileId: string,
  input: unknown,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = StoryInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: issuesToMessage(parsed.error.issues) };
  const { id } = await addStory(user.id, profileId, parsed.data);
  revalidatePath('/onboarding');
  revalidatePath('/profile');
  return { ok: true, id };
}

export async function upsertQuestionAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = QuestionBankInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: issuesToMessage(parsed.error.issues) };
  const { id } = await upsertQuestionBankEntry(user.id, parsed.data);
  revalidatePath('/onboarding');
  revalidatePath('/profile');
  return { ok: true, id };
}

export async function completeOnboardingAction(): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from('user_profiles')
    .update({ onboarded_at: new Date().toISOString() })
    .eq('user_id', user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/app');
  revalidatePath('/profile');
  return { ok: true };
}
