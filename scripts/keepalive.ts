/**
 * Supabase keepalive ping. Invoked by .github/workflows/keepalive.yml daily
 * to prevent free-tier project pause after 7 days of inactivity.
 *
 * Calls the `health` Edge Function which runs `select 1` against the DB.
 */

async function main(): Promise<void> {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const anon = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  if (!url || !anon) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
    process.exit(1);
  }

  const endpoint = `${url.replace(/\/$/, '')}/functions/v1/health`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: { apikey: anon, Authorization: `Bearer ${anon}` },
      signal: controller.signal,
    });
    const body = await res.text();
    if (!res.ok) {
      console.error(`keepalive failed: ${res.status} ${body}`);
      process.exit(1);
    }
    console.warn(`keepalive ok: ${body}`);
  } catch (err) {
    console.error('keepalive error:', err);
    process.exit(1);
  } finally {
    clearTimeout(timeout);
  }
}

void main();
