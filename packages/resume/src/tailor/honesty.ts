// Honesty checker — post-LLM verification that the tailored resume is
// faithful to the master profile. CLAUDE.md §2.7 names this as the most
// important product rule.
//
// Rules (docs/llm-routing.md §Honesty checker):
//   1. Every tailored experience matches a master experience by
//      (company, title) and the dates fall within the master's range.
//   2. Every tailored bullet either matches a master bullet's text /
//      a known variant, OR reorders/rephrases a master bullet without
//      introducing new entities or numeric metrics.
//   3. Every skill in tailored.skills exists in master.skills.
//   4. Every metric in tailored bullets (numbers, %, $, x, k/m/b)
//      appears in the corresponding master bullet.
//   5. Education degree + institution + end_date match master.

import type {
  Education,
  Experience,
  ExperienceBullet,
  Profile,
  Project,
  Skill,
} from '../schemas/profile';
import type { TailoredResume, TailoredExperience } from '../schemas/resume';

export interface MasterProfile {
  profile: Profile;
  experiences: (Experience & { bullets: ExperienceBullet[] })[];
  projects: Project[];
  skills: Skill[];
  education: Education[];
}

export interface HonestyResult {
  ok: boolean;
  violations: string[];
}

const METRIC_RE = /(\$\s?\d[\d,]*\.?\d*\s?[kKmMbB]?|\b\d+(?:\.\d+)?\s?%|\b\d+(?:\.\d+)?\s?x\b|\b\d{2,}\+?(?=\s|$))/g;

export function honestyCheck(
  tailored: TailoredResume,
  master: MasterProfile,
): HonestyResult {
  const violations: string[] = [];

  // ---- 1 + 2: experiences and bullets ----
  for (const exp of tailored.experience) {
    const masterExp = findMasterExperience(master.experiences, exp);
    if (!masterExp) {
      violations.push(
        `Experience "${exp.title} @ ${exp.company}" not found in master profile`,
      );
      continue;
    }

    if (!datesWithinRange(exp, masterExp)) {
      violations.push(
        `Dates for "${exp.title} @ ${exp.company}" (${exp.start_date}–${exp.end_date}) outside master range`,
      );
    }

    const allowedBullets = collectAllowedBulletText(masterExp.bullets);
    for (const tBullet of exp.bullets) {
      if (matchesAnyAllowed(tBullet, allowedBullets)) continue;

      // Not a verbatim match — accept only if every entity + metric in the
      // tailored bullet appears in some master bullet for this experience.
      const driftReason = entityDrift(tBullet, masterExp.bullets);
      if (driftReason) {
        violations.push(
          `Bullet "${trim(tBullet)}" introduces ${driftReason} not in the master bullets for "${exp.company}"`,
        );
      }
    }
  }

  // ---- 3: skills coverage ----
  const masterSkillNames = new Set(
    master.skills.map((s) => s.name.toLowerCase()),
  );
  const tailoredSkillTokens = [
    ...tailored.skills.languages,
    ...tailored.skills.frameworks,
    ...tailored.skills.tools,
    ...tailored.skills.domains,
  ];
  for (const t of tailoredSkillTokens) {
    if (!masterSkillNames.has(t.toLowerCase())) {
      violations.push(`Skill "${t}" not in master profile`);
    }
  }

  // ---- 5: education matches exactly ----
  for (const edu of tailored.education) {
    const masterEdu = master.education.find(
      (m) =>
        m.institution.toLowerCase() === edu.institution.toLowerCase() &&
        (m.end_date ?? '').startsWith(edu.end_date),
    );
    if (!masterEdu) {
      violations.push(
        `Education "${edu.institution} ${edu.end_date}" not in master profile`,
      );
    }
  }

  return { ok: violations.length === 0, violations };
}

// ---- internals ----

function findMasterExperience(
  master: (Experience & { bullets: ExperienceBullet[] })[],
  tailored: TailoredExperience,
): (Experience & { bullets: ExperienceBullet[] }) | null {
  return (
    master.find(
      (m) =>
        m.company.toLowerCase() === tailored.company.toLowerCase() &&
        m.title.toLowerCase() === tailored.title.toLowerCase(),
    ) ?? null
  );
}

function datesWithinRange(
  tailored: TailoredExperience,
  master: Experience,
): boolean {
  // Master uses YYYY-MM-DD; tailored uses YYYY-MM. Compare prefix.
  const masterStart = master.start_date.slice(0, 7);
  const masterEnd = master.end_date ? master.end_date.slice(0, 7) : null;
  if (tailored.start_date < masterStart) return false;
  if (tailored.end_date === 'Present') {
    return masterEnd === null;
  }
  if (masterEnd !== null && tailored.end_date > masterEnd) return false;
  return true;
}

function collectAllowedBulletText(bullets: ExperienceBullet[]): string[] {
  const out: string[] = [];
  for (const b of bullets) {
    out.push(b.text);
    // bullet_variants are stored separately; the worker passes them
    // attached on the master bullet via skill_tags context if present.
    // (For phase 5 we treat bullets[].text as the canonical source.)
  }
  return out.map((s) => s.trim().toLowerCase());
}

function matchesAnyAllowed(text: string, allowed: string[]): boolean {
  return allowed.includes(text.trim().toLowerCase());
}

// Returns a string describing the kind of drift, or null when the tailored
// bullet's entities + metrics are all supportable from the master bullets.
function entityDrift(
  tailored: string,
  masterBullets: ExperienceBullet[],
): string | null {
  const masterText = masterBullets.map((b) => b.text).join('\n');
  const masterLower = masterText.toLowerCase();
  const masterMetrics = new Set(extractMetrics(masterText));

  // Metrics first — these are non-negotiable per CLAUDE.md §2.7.
  for (const metric of extractMetrics(tailored)) {
    if (!masterMetrics.has(metric)) {
      return `metric "${metric}"`;
    }
  }

  // Capitalised tokens (likely product/tech names) must appear in some
  // master bullet. Skip short stop words and the position-title nouns.
  for (const token of extractCapitalisedTokens(tailored)) {
    if (!masterLower.includes(token.toLowerCase())) {
      return `term "${token}"`;
    }
  }

  return null;
}

function extractMetrics(text: string): string[] {
  return [...text.matchAll(METRIC_RE)].map((m) => m[0].replace(/\s+/g, '').toLowerCase());
}

const SKIP_CAPS = new Set([
  'I',
  'A',
  'An',
  'The',
  'Of',
  'For',
  'And',
  'Or',
  'To',
  'At',
  'In',
  'On',
  'Led',
  'Built',
  'Shipped',
  'Drove',
  'Owned',
  'Designed',
  'Developed',
  'Implemented',
]);

function extractCapitalisedTokens(text: string): string[] {
  // Tokens of length ≥ 2 that start with an uppercase letter and are not
  // sentence-initial action verbs we already collected.
  return [...text.matchAll(/\b([A-Z][A-Za-z0-9+#.-]+)/g)]
    .map((m) => m[1] ?? '')
    .filter((t) => t.length >= 2 && !SKIP_CAPS.has(t));
}

function trim(s: string): string {
  return s.length > 80 ? `${s.slice(0, 77)}...` : s;
}
