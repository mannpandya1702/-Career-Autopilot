import 'server-only';

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@career-autopilot/db';
import { env } from '@/env';

// Resolve the user from the Bearer token an extension request carries.
// Uses the anon-key client (Supabase verifies the JWT itself); falls
// back to null on invalid/expired tokens.
export async function userFromBearer(
  request: Request,
): Promise<{ id: string; email: string | null } | null> {
  const auth = request.headers.get('authorization');
  if (!auth?.toLowerCase().startsWith('bearer ')) return null;
  const token = auth.slice('bearer '.length).trim();
  if (!token) return null;

  const supabase = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}
