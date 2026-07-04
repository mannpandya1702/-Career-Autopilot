'use client';

import type { Database } from '@career-autopilot/db';
import { createBrowserClient } from '@supabase/ssr';
import { env } from '@/env';

export function createClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
