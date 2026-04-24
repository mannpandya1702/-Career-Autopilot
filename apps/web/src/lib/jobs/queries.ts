import 'server-only';

import type { Database } from '@career-autopilot/db';
import { createClient } from '@/lib/supabase/server';

type JobRow = Database['public']['Tables']['jobs']['Row'];
type CompanyRow = Database['public']['Tables']['companies']['Row'];

export interface JobWithCompany extends JobRow {
  company: Pick<CompanyRow, 'id' | 'name' | 'ats_type' | 'ats_slug'> | null;
}

export interface ListJobsFilters {
  status?: string;
  company_id?: string;
  ats?: CompanyRow['ats_type'];
  source?: string;
  limit?: number;
  cursor_posted_at?: string;
}

export async function listJobs(filters: ListJobsFilters = {}): Promise<JobWithCompany[]> {
  const supabase = await createClient();
  const limit = Math.min(filters.limit ?? 50, 200);

  let query = supabase
    .from('jobs')
    .select('*, company:companies(id, name, ats_type, ats_slug)')
    .order('posted_at', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.company_id) query = query.eq('company_id', filters.company_id);
  if (filters.cursor_posted_at) query = query.lt('posted_at', filters.cursor_posted_at);

  const { data, error } = await query;
  if (error) throw new Error(`jobs list failed: ${error.message}`);

  let rows = (data ?? []) as unknown as JobWithCompany[];
  if (filters.ats) {
    rows = rows.filter((r) => r.company?.ats_type === filters.ats);
  }
  return rows;
}

export async function getJobById(id: string): Promise<JobWithCompany | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('jobs')
    .select('*, company:companies(id, name, ats_type, ats_slug)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`job fetch failed: ${error.message}`);
  return (data as unknown as JobWithCompany | null) ?? null;
}
