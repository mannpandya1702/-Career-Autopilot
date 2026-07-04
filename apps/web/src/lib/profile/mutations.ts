import 'server-only';

import type {
  EducationInput,
  ExperienceBulletInput,
  ExperienceInput,
  PreferencesInput,
  ProfileInput,
  ProjectInput,
  QuestionBankInput,
  SkillInput,
  StoryInput,
} from '@career-autopilot/resume';
import type { Json } from '@career-autopilot/db';
import { createClient } from '@/lib/supabase/server';
import { writeAudit } from './audit';

// Strip keys whose value is `undefined`. The Zod `.optional().nullable()` inputs
// produce `T | null | undefined`, but the generated DB types under
// `exactOptionalPropertyTypes` only accept `T | null` for optional columns
// (undefined is not a valid SQL value — omit the column instead).
function stripUndefined<T extends Record<string, unknown>>(
  obj: T,
): { [K in keyof T]: Exclude<T[K], undefined> } {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as { [K in keyof T]: Exclude<T[K], undefined> };
}

// Single upsert for the profile row. Creates on first call, updates after.
export async function upsertProfile(
  userId: string,
  input: ProfileInput,
): Promise<{ id: string }> {
  const supabase = await createClient();

  const existing = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);

  const payload = stripUndefined({ user_id: userId, ...input });
  const { data, error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'user_id' })
    .select('*')
    .single();
  if (error) throw new Error(`profiles upsert failed: ${error.message}`);

  await writeAudit(supabase, {
    userId,
    entityType: 'profile',
    entityId: data.id,
    action: existing.data ? 'update' : 'insert',
    before: (existing.data ?? null) as Json | null,
    after: data as unknown as Json,
  });

  return { id: data.id };
}

export async function addExperience(
  userId: string,
  profileId: string,
  input: ExperienceInput,
  bullets: ExperienceBulletInput[] = [],
): Promise<{ id: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('experiences')
    .insert(stripUndefined({ user_id: userId, profile_id: profileId, ...input }))
    .select('*')
    .single();
  if (error) throw new Error(`experiences insert failed: ${error.message}`);

  if (bullets.length > 0) {
    const { error: bulletError } = await supabase.from('experience_bullets').insert(
      bullets.map((b, ord) =>
        stripUndefined({
          user_id: userId,
          experience_id: data.id,
          text: b.text,
          metrics: (b.metrics ?? null) as Json | null,
          skill_tags: b.skill_tags ?? null,
          story_id: b.story_id ?? null,
          ord: b.ord ?? ord,
        }),
      ),
    );
    if (bulletError) throw new Error(`bullets insert failed: ${bulletError.message}`);
  }

  await writeAudit(supabase, {
    userId,
    entityType: 'experience',
    entityId: data.id,
    action: 'insert',
    after: data as unknown as Json,
  });

  return { id: data.id };
}

export async function upsertSkill(userId: string, input: SkillInput): Promise<{ id: string }> {
  const supabase = await createClient();
  const existing = await supabase
    .from('skills')
    .select('*')
    .eq('user_id', userId)
    .eq('name', input.name)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);

  const { data, error } = await supabase
    .from('skills')
    .upsert(stripUndefined({ user_id: userId, ...input }), { onConflict: 'user_id,name' })
    .select('*')
    .single();
  if (error) throw new Error(`skills upsert failed: ${error.message}`);

  await writeAudit(supabase, {
    userId,
    entityType: 'skill',
    entityId: data.id,
    action: existing.data ? 'update' : 'insert',
    before: (existing.data ?? null) as Json | null,
    after: data as unknown as Json,
  });

  return { id: data.id };
}

export async function deleteSkill(userId: string, skillId: string): Promise<void> {
  const supabase = await createClient();
  const existing = await supabase
    .from('skills')
    .select('*')
    .eq('id', skillId)
    .eq('user_id', userId)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (!existing.data) return;

  const { error } = await supabase.from('skills').delete().eq('id', skillId).eq('user_id', userId);
  if (error) throw new Error(`skills delete failed: ${error.message}`);

  await writeAudit(supabase, {
    userId,
    entityType: 'skill',
    entityId: skillId,
    action: 'delete',
    before: existing.data as unknown as Json,
  });
}

export async function addProject(
  userId: string,
  profileId: string,
  input: ProjectInput,
): Promise<{ id: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('projects')
    .insert(stripUndefined({ user_id: userId, profile_id: profileId, ...input }))
    .select('*')
    .single();
  if (error) throw new Error(`projects insert failed: ${error.message}`);
  await writeAudit(supabase, {
    userId,
    entityType: 'project',
    entityId: data.id,
    action: 'insert',
    after: data as unknown as Json,
  });
  return { id: data.id };
}

export async function addEducation(
  userId: string,
  profileId: string,
  input: EducationInput,
): Promise<{ id: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('education')
    .insert(stripUndefined({ user_id: userId, profile_id: profileId, ...input }))
    .select('*')
    .single();
  if (error) throw new Error(`education insert failed: ${error.message}`);
  await writeAudit(supabase, {
    userId,
    entityType: 'education',
    entityId: data.id,
    action: 'insert',
    after: data as unknown as Json,
  });
  return { id: data.id };
}

export async function addStory(
  userId: string,
  profileId: string,
  input: StoryInput,
): Promise<{ id: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('stories')
    .insert(stripUndefined({ user_id: userId, profile_id: profileId, ...input }))
    .select('*')
    .single();
  if (error) throw new Error(`stories insert failed: ${error.message}`);
  await writeAudit(supabase, {
    userId,
    entityType: 'story',
    entityId: data.id,
    action: 'insert',
    after: data as unknown as Json,
  });
  return { id: data.id };
}

export async function upsertPreferences(
  userId: string,
  input: PreferencesInput,
): Promise<void> {
  const supabase = await createClient();
  const existing = await supabase
    .from('preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);

  const { data, error } = await supabase
    .from('preferences')
    .upsert(stripUndefined({ user_id: userId, ...input }), { onConflict: 'user_id' })
    .select('*')
    .single();
  if (error) throw new Error(`preferences upsert failed: ${error.message}`);

  await writeAudit(supabase, {
    userId,
    entityType: 'preferences',
    entityId: userId,
    action: existing.data ? 'update' : 'insert',
    before: (existing.data ?? null) as Json | null,
    after: data as unknown as Json,
  });
}

export async function upsertQuestionBankEntry(
  userId: string,
  input: QuestionBankInput,
): Promise<{ id: string }> {
  const supabase = await createClient();
  const existing = await supabase
    .from('question_bank')
    .select('*')
    .eq('user_id', userId)
    .eq('question_key', input.question_key)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);

  const { data, error } = await supabase
    .from('question_bank')
    .upsert(stripUndefined({ user_id: userId, ...input }), {
      onConflict: 'user_id,question_key',
    })
    .select('*')
    .single();
  if (error) throw new Error(`question_bank upsert failed: ${error.message}`);

  await writeAudit(supabase, {
    userId,
    entityType: 'question_bank',
    entityId: data.id,
    action: existing.data ? 'update' : 'insert',
    before: (existing.data ?? null) as Json | null,
    after: data as unknown as Json,
  });

  return { id: data.id };
}
