import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@career-autopilot/db';

export type ProfileEntityType =
  | 'profile'
  | 'experience'
  | 'experience_bullet'
  | 'bullet_variant'
  | 'project'
  | 'skill'
  | 'education'
  | 'story'
  | 'preferences'
  | 'question_bank';

type AuditArgs = {
  userId: string;
  entityType: ProfileEntityType;
  entityId: string;
  action: 'insert' | 'update' | 'delete';
  before?: Json | null;
  after?: Json | null;
};

// Append-only: every change to a profile entity lands here so downstream
// tailoring misfires are debuggable. See docs/build-phases.md P2.6.
export async function writeAudit(
  supabase: SupabaseClient<Database>,
  args: AuditArgs,
): Promise<void> {
  const { error } = await supabase.from('profile_audit').insert({
    user_id: args.userId,
    entity_type: args.entityType,
    entity_id: args.entityId,
    action: args.action,
    before: args.before ?? null,
    after: args.after ?? null,
  });
  if (error) {
    // Never swallow silently (CLAUDE.md §2.2). Bubble up; caller decides.
    throw new Error(`profile_audit insert failed: ${error.message}`);
  }
}
