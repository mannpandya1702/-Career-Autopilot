// Read config/target-companies.yml and upsert into public.companies via the
// service-role Supabase client.
//
// Usage:
//   pnpm seed:companies
//
// Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in the env.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@career-autopilot/db';

const CompanyRowSchema = z.object({
  name: z.string().min(1),
  ats: z.enum(['greenhouse', 'lever', 'ashby', 'workable', 'smartrecruiters']),
  slug: z.string().min(1),
  priority: z.number().int().min(0).max(10).default(0),
  careers_url: z.string().url().optional(),
  website: z.string().url().optional(),
  industry: z.string().optional(),
});

const FileSchema = z.array(CompanyRowSchema);

async function main(): Promise<void> {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the environment',
    );
  }

  const path = resolve(process.cwd(), 'config/target-companies.yml');
  const raw = readFileSync(path, 'utf8');
  const parsed = FileSchema.safeParse(parseYaml(raw));
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`target-companies.yml validation failed:\n${issues}`);
  }

  const supabase = createClient<Database>(url, key, {
    auth: { persistSession: false },
  });

  let upserted = 0;
  for (const row of parsed.data) {
    const payload = {
      name: row.name,
      ats_type: row.ats,
      ats_slug: row.slug,
      priority: row.priority,
      ...(row.careers_url ? { careers_url: row.careers_url } : {}),
      ...(row.website ? { website: row.website } : {}),
      ...(row.industry ? { industry: row.industry } : {}),
    };
    const { error } = await supabase
      .from('companies')
      .upsert(payload, { onConflict: 'ats_type,ats_slug' });
    if (error) {
      // eslint-disable-next-line no-console
      console.error(`[seed] ${row.ats}/${row.slug} failed: ${error.message}`);
      continue;
    }
    upserted += 1;
  }

  // eslint-disable-next-line no-console
  console.log(`[seed] upserted ${upserted}/${parsed.data.length} companies`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
