// Deterministic hard-filter engine (P4.2). Zero LLM.
// Rejects jobs that fail non-negotiable preferences before we spend any LLM
// budget on them.
//
// Input: the job (normalised from an ATS adapter) + the user's preferences.
// Output: { pass, reasons } — `reasons` lists every rule that failed, so the
// UI can surface "Rejected because: requires on-site SF, candidate is
// remote-only".

import type { ExperienceLevel, JobType, Preferences, WorkMode } from '../schemas/profile';
import type { ParsedJd } from '@career-autopilot/llm';

export interface HardFilterJob {
  title: string;
  description: string;
  location: string | null;
  remote_policy: WorkMode | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  // Optional extra signals from the parsed JD — pass when available so we
  // can check against structured requirements rather than keyword matching.
  parsed_jd?: ParsedJd;
}

export interface HardFilterInput {
  job: HardFilterJob;
  preferences: Pick<
    Preferences,
    | 'experience_levels'
    | 'work_modes'
    | 'job_types'
    | 'salary_min'
    | 'salary_currency'
    | 'locations'
    | 'remote_anywhere'
    | 'industries_exclude'
    | 'willing_to_relocate'
  > & {
    work_authorization?: string[] | null;
  };
}

export interface HardFilterResult {
  pass: boolean;
  reasons: string[];
}

const SENIORITY_ORDER: Record<ExperienceLevel, number> = {
  intern: 0,
  entry: 1,
  mid: 2,
  senior: 3,
  lead: 4,
  principal: 5,
};

const JOB_TYPE_KEYWORDS: Record<JobType, RegExp> = {
  full_time: /full.?time|full\s*time|permanent/i,
  part_time: /part.?time|part\s*time/i,
  contract: /\bcontract(?:or)?\b|contract-to-hire|c2c/i,
  internship: /\bintern(?:ship)?\b/i,
  freelance: /\bfreelanc/i,
};

export function runHardFilters(input: HardFilterInput): HardFilterResult {
  const reasons: string[] = [];
  const { job, preferences: p } = input;

  // --- Experience level ---
  if (p.experience_levels.length > 0 && job.parsed_jd?.role_seniority) {
    const roleSeniority = job.parsed_jd.role_seniority;
    if (roleSeniority !== 'unspecified') {
      const allowed = new Set(p.experience_levels);
      if (!allowed.has(roleSeniority as ExperienceLevel)) {
        const jobRank = SENIORITY_ORDER[roleSeniority as ExperienceLevel];
        const minAllowed = Math.min(
          ...p.experience_levels.map((l) => SENIORITY_ORDER[l]),
        );
        const maxAllowed = Math.max(
          ...p.experience_levels.map((l) => SENIORITY_ORDER[l]),
        );
        if (jobRank < minAllowed - 1 || jobRank > maxAllowed + 1) {
          reasons.push(
            `role seniority "${roleSeniority}" outside allowed range (${p.experience_levels.join(
              ', ',
            )})`,
          );
        }
      }
    }
  }

  // --- Work mode ---
  if (p.work_modes.length > 0 && job.remote_policy) {
    if (!p.work_modes.includes(job.remote_policy)) {
      // Remote-anywhere escape hatch: if candidate accepts remote AND job is
      // remote, always pass regardless of user's configured subset.
      if (!(p.remote_anywhere && job.remote_policy === 'remote')) {
        reasons.push(
          `job is ${job.remote_policy}; candidate prefers ${p.work_modes.join(', ')}`,
        );
      }
    }
  }

  // --- Job type (detected from title + description) ---
  if (p.job_types.length > 0) {
    const haystack = `${job.title}\n${job.description}`;
    const matchedTypes = (Object.keys(JOB_TYPE_KEYWORDS) as JobType[]).filter((t) =>
      JOB_TYPE_KEYWORDS[t].test(haystack),
    );
    if (matchedTypes.length > 0) {
      const overlap = matchedTypes.filter((t) => p.job_types.includes(t));
      if (overlap.length === 0) {
        reasons.push(
          `job type "${matchedTypes.join('/')}" not in preferred (${p.job_types.join(', ')})`,
        );
      }
    }
  }

  // --- Salary floor ---
  if (p.salary_min != null && job.salary_max != null) {
    // We compare only when currencies match OR the user hasn't set one.
    if (!job.salary_currency || job.salary_currency === p.salary_currency) {
      if (job.salary_max < p.salary_min) {
        reasons.push(
          `salary max ${job.salary_max} < floor ${p.salary_min} ${p.salary_currency}`,
        );
      }
    }
  }

  // --- Location match ---
  if (!p.remote_anywhere && (p.locations?.length ?? 0) > 0 && job.location) {
    const accepted = [
      ...(p.locations ?? []),
      ...(p.willing_to_relocate ? ['RELOCATION_OK'] : []),
    ].map((l) => l.toLowerCase());
    const jobLoc = job.location.toLowerCase();
    const matches =
      accepted.includes('relocation_ok') ||
      accepted.some((loc) => jobLoc.includes(loc) || loc.includes(jobLoc));
    const isRemote = job.remote_policy === 'remote';
    if (!matches && !isRemote) {
      reasons.push(
        `location "${job.location}" not in allowed (${(p.locations ?? []).join(', ')})`,
      );
    }
  }

  // --- Work authorization (from parsed JD's list of required auths) ---
  if (
    job.parsed_jd?.work_authorization_required &&
    job.parsed_jd.work_authorization_required.length > 0 &&
    p.work_authorization &&
    p.work_authorization.length > 0
  ) {
    const requiredLower = job.parsed_jd.work_authorization_required.map((s) => s.toLowerCase());
    const candidateLower = p.work_authorization.map((s) => s.toLowerCase());
    const covered = requiredLower.some((req) =>
      candidateLower.some((cand) => cand.includes(req) || req.includes(cand)),
    );
    if (!covered) {
      reasons.push(
        `work auth required (${job.parsed_jd.work_authorization_required.join(
          ', ',
        )}); candidate has ${p.work_authorization.join(', ')}`,
      );
    }
  }

  // --- Industry exclusions ---
  if (
    (p.industries_exclude?.length ?? 0) > 0 &&
    job.parsed_jd?.industry_domain
  ) {
    const excluded = (p.industries_exclude ?? []).map((s) => s.toLowerCase());
    const jdDomain = job.parsed_jd.industry_domain.toLowerCase();
    if (excluded.some((e) => jdDomain.includes(e))) {
      reasons.push(`industry "${job.parsed_jd.industry_domain}" is excluded`);
    }
  }

  return { pass: reasons.length === 0, reasons };
}
