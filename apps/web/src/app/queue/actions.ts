'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function resolveQueueItem(
  itemId: string,
  resolution: 'submitted_manually' | 'abandoned',
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('manual_review_queue')
    .update({
      resolved_at: new Date().toISOString(),
      resolution,
    })
    .eq('id', itemId)
    .eq('user_id', user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/queue');
  return { ok: true };
}
