// Supabase Edge Function: health
// Used by the keepalive workflow to prevent free-tier project pause.
// Runs `select 1` against the project's Postgres via the service role.

import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async () => {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !serviceKey) {
    return new Response(
      JSON.stringify({ ok: false, error: 'missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    );
  }

  const client = createClient(url, serviceKey, { auth: { persistSession: false } });

  try {
    // Minimal DB touch: reads from an always-present system view.
    const { error } = await client.from('user_profiles').select('user_id').limit(1);
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    return new Response(JSON.stringify({ ok: true, ts: new Date().toISOString() }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    );
  }
});
