// Derived summary: a short paragraph describing the candidate in the third person,
// used downstream for:
//   - embedding (Gemini free tier, safe because this is the DERIVED text, not raw fields).
//   - prompt context in the fit-scoring judge.
//
// Why derived (not raw): CLAUDE.md §2.5 — the free-tier Gemini policy allows Google
// to use free-tier prompts for product improvement. Raw profile fields (phone, address,
// salary) must never flow into free-tier calls. A derived paragraph ("Experienced Python
// engineer with 3 years building healthcare integrations…") has no identifiers.
//
// This module defines the SHAPE. The actual LLM call is injected. The default stub
// produces a heuristic summary when no LLM is configured — good enough for local
// development and tests; the real run uses Claude Haiku (privacy provider).

import type {
  Experience,
  ExperienceBullet,
  Preferences,
  Profile,
  Skill,
} from '@career-autopilot/resume';

export interface SummaryInput {
  profile: Profile;
  experiences: (Experience & { bullets: ExperienceBullet[] })[];
  skills: Skill[];
  preferences?: Preferences | null;
}

export interface Summarizer {
  summarize(input: SummaryInput): Promise<string>;
}

// Heuristic fallback: no LLM, no secrets, deterministic. Used in tests and local
// dev without API keys. Produces ~200 chars of privacy-safe text.
export const heuristicSummarizer: Summarizer = {
  async summarize({ profile, experiences, skills }) {
    const years = profile.years_experience ?? inferYears(experiences);
    const seniority = yearsToSeniority(years);
    const topSkills = skills
      .filter((s) => s.category === 'language' || s.category === 'framework')
      .slice(0, 5)
      .map((s) => s.name);
    const latestRole = experiences[0];
    const domainCue = latestRole
      ? ` with recent experience as ${latestRole.title} at ${latestRole.company}`
      : '';

    return [
      `${seniority} engineer${domainCue}.`,
      topSkills.length > 0 ? `Core stack: ${topSkills.join(', ')}.` : '',
      profile.headline ? profile.headline : '',
    ]
      .filter(Boolean)
      .join(' ')
      .slice(0, 1000);
  },
};

function inferYears(experiences: { start_date: string }[]): number {
  if (experiences.length === 0) return 0;
  const earliest = experiences
    .map((e) => new Date(e.start_date))
    .sort((a, b) => a.getTime() - b.getTime())[0];
  if (!earliest) return 0;
  const ms = Date.now() - earliest.getTime();
  return Math.round((ms / (365.25 * 24 * 60 * 60 * 1000)) * 10) / 10;
}

function yearsToSeniority(years: number): string {
  if (years < 1) return 'Early-career';
  if (years < 3) return 'Mid-level';
  if (years < 6) return 'Senior';
  if (years < 10) return 'Staff-level';
  return 'Principal-level';
}
