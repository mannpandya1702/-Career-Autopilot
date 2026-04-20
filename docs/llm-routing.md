# LLM Routing — Model Selection, Prompts, Caching, Cost

**This document is the source of truth for every LLM interaction.** Every prompt, every model choice, every retry policy lives here. If you're about to write `anthropic.messages.create(...)` or `generativeAI.generateContent(...)` in feature code, stop — that goes in `packages/llm/src/tasks/<task>.ts`, routed through `packages/llm/src/router.ts`, using a prompt from `packages/llm/src/prompts/<task>/v1.ts`.

---

## Core principles

1. **One router, one entry point.** All LLM calls go through `LlmRouter.call(task, input)`. No direct SDK calls elsewhere.
2. **Privacy gates model choice.** Tasks that touch master-profile fields (name, email, phone, address, salary, visa, detailed experience, STAR stories) route to the privacy provider. Tasks that touch only public text (JD, company research) route to the free provider.
3. **Prompts are versioned files, not inline strings.** A prompt change is a new version file (`v2.ts`), never an in-place edit.
4. **Structured outputs are validated.** Every task declares a Zod schema for its output; the router validates before returning. Invalid output → 1 retry → fail.
5. **Caching is mandatory for any prompt whose prefix repeats.** Master profile + template + system instructions come first, variable content last.
6. **Cost is logged on every call.** Per-call tokens go to `llm_calls`, aggregated nightly for the analytics dashboard.

---

## Providers and models

As of this document's writing, current models and list prices per million tokens:

| Provider | Model | Input | Output | Notes |
|---|---|---|---|---|
| Anthropic | `claude-haiku-4-5-20251001` | $1.00 | $5.00 | Privacy-safe (no training on API data) |
| Anthropic | `claude-sonnet-4-6` | $3.00 | $15.00 | Privacy-safe; reserved for hardest tailoring |
| Google | `gemini-2.5-pro` | free tier 100 RPD; paid $1.25/$10 | | Free-tier prompts may be used for product improvement |
| Google | `gemini-2.5-flash` | free tier 250 RPD | free tier | Same privacy caveat |
| Google | `gemini-2.5-flash-lite` | free tier 1000 RPD | free tier | Same privacy caveat; highest free throughput |
| Google | `text-embedding-004` | free tier, generous | — | 768-dim embeddings |

**Privacy classification:**
- **SENSITIVE**: any prompt containing master-profile fields. Route to Anthropic (Haiku by default, Sonnet for hard cases).
- **PUBLIC**: prompts containing only JD text, company research, or derived-summary paragraphs that have been pre-approved by the user as non-sensitive. Route to Gemini free tier.

Never violate the classification. If unsure, classify as SENSITIVE.

---

## Task catalog

Every LLM task is registered in `packages/llm/src/tasks/index.ts`. Current tasks:

| Task ID | Purpose | Privacy | Default model | Max tokens out | Timeout |
|---|---|---|---|---|---|
| `jd.parse` | Extract structured JD requirements from raw JD text | PUBLIC | gemini-2.5-flash-lite | 2000 | 30s |
| `fit.judge` | Score a job for fit given profile summary + parsed JD | PUBLIC | gemini-2.5-flash | 1500 | 30s |
| `profile.summarize` | Generate derived summary from master profile | SENSITIVE | claude-haiku-4-5 | 500 | 30s |
| `tailor.resume` | Tailor structured resume for a job | SENSITIVE | claude-haiku-4-5 | 4000 | 90s |
| `tailor.hard` | Fallback tailor for difficult cases | SENSITIVE | claude-sonnet-4-6 | 4000 | 120s |
| `cover.letter` | Generate cover letter | SENSITIVE | claude-haiku-4-5 | 1500 | 60s |
| `qa.answer` | Answer one application question | SENSITIVE | claude-haiku-4-5 | 1000 | 30s |
| `email.classify` | Classify an inbound email's outcome type | PUBLIC | gemini-2.5-flash-lite | 500 | 15s |
| `company.research` | Summarize recent company news | PUBLIC | gemini-2.5-flash | 1000 | 30s |
| `embed.jd` | Embed a job description | PUBLIC | text-embedding-004 | — | 15s |
| `embed.profile_summary` | Embed derived profile summary | PUBLIC (summary is safe) | text-embedding-004 | — | 15s |

Escalation rule: if `tailor.resume` produces output that fails honesty check OR verifier score < 60 on two consecutive attempts, the worker escalates the job to `tailor.hard` (Sonnet) once. If that also fails, the job goes to manual review.

---

## Router implementation

### Responsibilities

```ts
// packages/llm/src/router.ts
export class LlmRouter {
  async call<T extends TaskId>(
    task: T,
    input: TaskInput[T],
    opts?: CallOptions,
  ): Promise<TaskOutput[T]> {
    // 1. Lookup task definition → provider, model, prompt version, schema, timeout
    // 2. Respect LLM_PRIVACY_MODE: if task is SENSITIVE, force anthropic or gemini_paid
    // 3. Check rate limiter; if exceeded, wait or queue
    // 4. Construct messages from prompt file (system + user)
    // 5. Apply caching markers (anthropic: cache_control; gemini: implicit via prefix stability)
    // 6. Invoke provider SDK with timeout
    // 7. Parse response → validate with Zod schema
    // 8. On validation fail: retry once with stricter system reminder
    // 9. On transient error (429/500/503): exponential backoff, max 3 retries
    // 10. Log tokens_in/out/cached to llm_calls
    // 11. Return validated output
  }
}
```

### Retry policy

- **429 (rate limit):** Exponential backoff starting 2s, doubling, capped at 60s. Max 3 retries.
- **500/502/503/504 (server error):** Same backoff. Max 3 retries.
- **Validation error (output doesn't match schema):** Retry once with an appended system message: `"Your previous response failed schema validation with errors: [errors]. Reply again using the exact schema. No prose, no explanation — pure JSON matching the schema."` If second try also fails, throw `InvalidOutputError` and the worker fails the job.
- **All other errors:** Fail immediately, no retry.

### Rate limiting

The router maintains an in-memory token bucket per provider based on published limits, updated from the `kv_store` table so multiple worker instances can share state.

Gemini free tier limits (adjust if Google changes them):
- `gemini-2.5-pro`: 5 RPM, 100 RPD
- `gemini-2.5-flash`: 10 RPM, 250 RPD
- `gemini-2.5-flash-lite`: 15 RPM, 1000 RPD
- `text-embedding-004`: conservative estimate of 1500 RPD

Anthropic: Depends on the user's account tier; default to 5 RPM and 50 RPD conservatively for a new account; update by reading `x-ratelimit-*` headers on responses.

When approaching a limit (< 20% remaining), log a warning. When exceeded, queue requests with a delay until reset.

---

## Caching strategy

Caching is the single biggest cost lever. Structured correctly, LLM spend drops ~60%.

### Anthropic (explicit cache_control)

Use `cache_control: { type: "ephemeral" }` on the stable prefix content blocks. 5-minute TTL by default; 1-hour TTL for the base master-profile block (which rarely changes between applications).

Order of content blocks (stable → variable):
1. System prompt (stable per prompt version) — cached, 1h
2. Master profile block (stable per profile version) — cached, 1h
3. Task-specific instructions + few-shot examples — cached, 5min
4. Variable inputs (JD text, question text) — not cached

Minimum cacheable prefix: 1024 tokens for Haiku, 2048 for Sonnet. If your master profile is smaller than this, pack additional context (e.g., the STAR stories bank, the full experience list) into the cached block until it qualifies.

### Gemini (implicit caching)

Gemini caches implicitly when the prefix repeats AND the total input is large enough (varies by model; aim for >= 2048 tokens cached). Keep the order of message parts stable: same system instructions, same format examples, same reference documents, then the variable input.

---

## Prompt templates

Every prompt file exports:

```ts
export const prompt = {
  version: 'v1' as const,
  task: 'tailor.resume' as const,
  provider: 'anthropic' as const,
  model: 'claude-haiku-4-5-20251001' as const,
  privacy: 'SENSITIVE' as const,
  system: string,
  buildUser: (input: TailorInput) => ContentBlock[],
  outputSchema: ZodSchema,
  cacheBreakpoints: Array<{ afterBlock: number, ttl: 'short' | 'long' }>,
};
```

Full templates for the critical tasks below.

### `jd.parse` — v1

**System prompt:**

```
You are a hiring requirements extractor. Given a job description, extract the structured requirements as JSON. Be precise and literal — do not infer requirements that aren't stated.

Output strictly matches this schema:
{
  "must_have_skills": string[],      // Explicitly required; use the exact phrasing from the JD
  "nice_to_have_skills": string[],   // "Bonus", "preferred", "plus"
  "required_years_experience": number | null,
  "required_education": { level: "bachelors|masters|phd|none", field: string | null } | null,
  "role_seniority": "intern|entry|mid|senior|lead|principal|unspecified",
  "work_authorization_required": string[] | null,  // e.g., ["US Citizen", "Clearance required"]
  "tech_stack": string[],            // Technologies mentioned
  "industry_domain": string | null,   // e.g., "healthcare", "fintech"
  "red_flags": string[],             // Things that might be dealbreakers, e.g., "Must work on-site in San Francisco"
  "keywords": string[],              // Important phrases worth matching in a resume
  "acronyms": { full: string, abbrev: string }[]  // Pairs like { full: "Search Engine Optimization", abbrev: "SEO" }
}

Rules:
- Do not invent requirements not present in the text.
- If a skill is listed as both required and preferred, classify as "must_have".
- Acronyms: extract every acronym that appears alongside its spelled-out form.
- No prose. JSON only.
```

**User content:** The raw JD text (public; OK to use free tier).

**Output schema:** matches the JSON above; `z.object(...)` strict.

### `fit.judge` — v1

**System prompt:**

```
You are a fit-evaluation assistant. Given a candidate's derived summary and a parsed job description, produce a structured fit score.

You never see the candidate's raw personal data — only a derived summary. You never see the employer's identity — only the job requirements.

Output strictly matches this schema:
{
  "overall_score": number,   // 0-100
  "dimensions": {
    "skills": number,        // 0-100, how well skills match
    "experience": number,    // 0-100, seniority & years match
    "domain": number,        // 0-100, industry/domain fit
    "seniority": number,     // 0-100, level match
    "logistics": number      // 0-100, remote/location/auth
  },
  "must_have_gaps": string[],  // Required skills/experience the candidate appears to lack
  "nice_to_have_matches": string[],  // Bonus items the candidate has
  "reasoning": string  // 2-3 sentences, specific
}

Scoring guidance:
- 90+: Strong match, candidate should definitely apply.
- 75-89: Good match with minor gaps.
- 60-74: Partial match; worth reviewing but not auto-apply.
- < 60: Poor match; candidate likely lacks core requirements.

Be honest about gaps. Do not inflate scores to be encouraging.
```

**User content blocks:**

1. `[PROFILE_SUMMARY]` block (stable per profile version; **cacheable**)
2. `[PARSED_JD]` block (variable; not cached)

**Output schema:** matches the JSON strictly.

### `profile.summarize` — v1

**System prompt:**

```
You are a career summarizer. Given a candidate's full structured profile (experience, projects, skills), write a single 80-120 word third-person summary paragraph that captures:
- Role and seniority
- Core technical domains
- Distinctive projects or achievements
- Years of experience

This summary will be used for job-fit matching. It must be honest, specific, and must NOT invent details. It must NOT include personal identifiers (name, email, phone, address).

Output: one paragraph of plain text. No markdown. No bullet points. No intro/outro phrases.
```

**User content:** The structured profile in JSON (SENSITIVE; route to Anthropic).

**Output schema:** `z.object({ summary: z.string().min(50).max(800) })` (enforce via a post-parse validator since the prompt returns plain text — wrap as `{summary: text}` on the caller side).

### `tailor.resume` — v1 (the most important prompt)

**System prompt (verbatim — this is the honesty contract):**

```
You are a resume tailor. Your job is to take a candidate's master profile and a target job description, and produce a TAILORED resume as structured JSON.

HARD RULES — violating any of these produces an invalid response:
1. Only re-emphasize, rephrase, and reorder experience, skills, metrics, and achievements that EXIST in the provided master profile. Never invent tools, years of experience, employers, metrics, or achievements.
2. If a bullet in the master profile has alternate phrasings provided, you may select among them.
3. You may rewrite a bullet's wording to mirror the JD's language, but the underlying claim must remain true to the master profile.
4. If the JD requires something the candidate does not have, do NOT claim it. The output will be automatically verified against the master profile and will be rejected if it contains claims not supported.
5. Preserve dates, employer names, and degree information exactly. Never alter these.
6. Metrics (numbers, percentages) must be copied verbatim from the master profile. Do not round, aggregate, or compose new metrics.

Your goal is to:
- Select the 4-6 most relevant experiences/projects for this role
- Select the 3-5 most relevant bullets per experience
- Pick alternate phrasings that emphasize the skills the JD cares about
- Generate a tight 2-3 sentence summary at the top tailored to the target role
- Filter the skills list to the most relevant 12-18 items (prioritize JD-matching skills)

Output strictly matches the TailoredResume schema:
{
  "summary": string,
  "experience": [
    { "company": string, "title": string, "location": string, "start_date": "YYYY-MM", "end_date": "YYYY-MM" | "Present", "bullets": string[] }
  ],
  "projects": [
    { "name": string, "role": string, "tech": string[], "bullets": string[], "url": string | null }
  ],
  "skills": { "languages": string[], "frameworks": string[], "tools": string[], "domains": string[] },
  "education": [
    { "institution": string, "degree": string, "field": string, "end_date": "YYYY-MM" }
  ],
  "certifications": string[],
  "selections": {
    "experience_ids_used": string[],
    "bullet_ids_used": string[],
    "alternate_variants_used": { "bullet_id": string, "variant_id": string }[]
  }
}

The `selections` field is used for audit; include the source IDs from the master profile for every item you used.
```

**User content blocks (in order):**

1. Master profile in structured JSON (SENSITIVE; **cacheable, 1h TTL** since profile changes rarely)
2. STAR stories bank (SENSITIVE; **cacheable, 1h TTL**)
3. Target JD (parsed + raw) (variable; not cached)
4. Company name + any user hint (variable; not cached)

**Output schema:** matches exactly. The Zod schema enforces shape; the downstream honesty checker enforces content fidelity.

### `tailor.hard` — v1

Same prompt as `tailor.resume`, same schema, but routed to `claude-sonnet-4-6`. Used as escalation path after two failed attempts on Haiku. The Sonnet fallback occasionally catches subtle failures in Haiku's structured output.

### `cover.letter` — v1

**System prompt:**

```
You are a cover-letter writer. Given a tailored resume, the target JD, the company name, and optional recent-company-research, write a concise cover letter of 200-280 words.

HARD RULES:
1. Every claim must be supported by the tailored resume. Do not invent projects, metrics, or experience.
2. Tone: professional but not stiff; conversational but not casual.
3. Structure: opening hook (1 sentence), why-this-role (2-3 sentences, cite one specific JD element), why-you (2-3 sentences, cite one specific resume item), why-this-company (1-2 sentences, cite recent-research if provided), close (1 sentence).
4. Do NOT start with "I am writing to apply for..." or similar boilerplate.
5. Do NOT use the phrase "I am a good fit" or "I would be a great asset" — show, don't assert.
6. If research is provided, weave it in naturally; if not, keep the why-this-company generic but specific to the role, not platitudes about the company's mission.

Output JSON:
{
  "greeting": string,   // "Dear Hiring Manager," or similar
  "body": string,        // The full body as a single string with \n\n paragraph breaks
  "signoff": string,     // "Sincerely,\n[User's Name]" — use the name from the profile
  "word_count": number
}
```

**User content blocks:**

1. System prompt (cacheable)
2. Candidate name block (cacheable, 1h)
3. Tailored resume JSON (cacheable per job; short TTL)
4. JD parsed + raw (variable)
5. Company name + research pack (variable)

### `qa.answer` — v1

**System prompt:**

```
You are answering a single job-application question on behalf of a candidate. You have access to their tailored resume, their STAR stories, and their master Q&A bank.

HARD RULES:
1. The answer MUST NOT contradict the tailored resume. If the resume says 3 years of X, the answer cannot say 4.
2. Prefer short, direct answers. Only go long if the question asks for narrative (e.g., "Tell us about a time...").
3. Respect word limits strictly. If word_limit is given, stay at or below it.
4. If the question is a standard one (work auth, notice period, salary expectation), use the exact answer from the Q&A bank.
5. If the question is behavioral, use the most-relevant STAR story; shorten to fit.
6. If you genuinely cannot answer from the provided context, respond with an empty answer and set `needs_human: true`.

Output JSON:
{
  "answer": string,
  "source": "qa_bank" | "story_{id}" | "resume" | "generated",
  "confidence": number,   // 0.0-1.0
  "needs_human": boolean
}
```

**User content blocks:**

1. System prompt (cacheable)
2. Q&A bank (cacheable, 1h)
3. STAR stories (cacheable, 1h)
4. Tailored resume (cacheable per job)
5. The question + metadata (variable)

### `email.classify` — v1

**System prompt:**

```
Classify an inbound email as one of: callback | rejection | interview_invite | recruiter_outreach | status_update | spam | other.

Output JSON:
{
  "outcome_type": "submitted" | "acknowledged" | "callback" | "rejection" | "interview_invite" | "interview_completed" | "offer" | "ghosted" | "other",
  "job_match_signal": string | null,  // Company or role name if mentioned
  "confidence": number,   // 0.0-1.0
  "reasoning": string     // 1 sentence
}
```

**User content:** The email subject + body (PUBLIC enough — no raw profile data; route to Gemini free).

### `company.research` — v1

**System prompt:**

```
Given a set of recent articles, blog posts, or press releases about a company, produce a brief research pack focused on what matters for a candidate writing a cover letter.

Output JSON:
{
  "recent_highlights": [ { "date": "YYYY-MM-DD", "headline": string, "one_sentence_summary": string } ],
  "notable_themes": string[],  // Up to 3: "aggressive hiring", "platform expansion", "leadership change"
  "potential_talking_points": string[]  // Up to 3 specific things a candidate could cite in a cover letter
}
```

**User content:** The articles as concatenated text (PUBLIC; Gemini free).

---

## Honesty checker

Post-LLM verification that the tailored output is faithful to the master profile. This is code, not an LLM call:

```ts
// packages/resume/src/tailor/honesty.ts
export function honestyCheck(
  tailored: TailoredResume,
  master: MasterProfile,
): { ok: boolean; violations: string[] } {
  const violations: string[] = [];

  // 1. Every experience in tailored.experience must match a master experience by (company, title, start_date)
  // 2. Every bullet in tailored must either:
  //    (a) exactly match a bullet in master.experience_bullets for the same experience
  //    (b) match a bullet's alternate_variant
  //    (c) be a rewording flagged in tailored.selections.alternate_variants_used
  //        AND the rewording must preserve all entities/numbers from the original
  // 3. Every skill in tailored.skills must exist in master.skills
  // 4. All dates match exactly
  // 5. All metrics (regex /\d+(?:\.\d+)?[%xkKmMbB+]?/ across bullets) must appear in the corresponding master bullet

  // If any check fails, push to violations; return ok: violations.length === 0
}
```

The tailor worker:
1. Calls `tailor.resume`.
2. Runs `honestyCheck`.
3. If `ok`, proceeds.
4. If not, calls `tailor.resume` again with an additional system message: `"Your previous attempt violated the honesty constraint. Specifically: [violations]. Regenerate, strictly adhering to the constraint."`
5. If second attempt still fails, escalates to `tailor.hard`.
6. If `tailor.hard` fails, marks the job as `failed_tailor` and queues for manual review.

---

## Cost accounting

Every call writes a row to `llm_calls`:

```ts
type LlmCall = {
  id: string;
  user_id: string | null;
  provider: 'anthropic' | 'gemini';
  model: string;
  task: TaskId;
  prompt_version: string;
  tokens_in: number;
  tokens_out: number;
  cached_tokens: number;
  cost_usd: number;
  latency_ms: number;
  success: boolean;
  error_code: string | null;
};
```

Cost is computed at call-time via a rate table (`packages/llm/src/pricing.ts`). Rate table is updated when vendors change pricing; it's a code change, not a config change, because prices affect routing decisions.

The analytics dashboard sums `cost_usd` by day / task / model, and surfaces cost-per-application as a headline metric.

---

## Worked example: one full job application

To build intuition, here's the LLM call sequence for a single job, start to finish, with approximate token counts and cost estimates.

| Step | Task | Provider | Model | Tokens in | Tokens out | Cost |
|---|---|---|---|---|---|---|
| 1 | `jd.parse` | Gemini | flash-lite | 1.2k | 0.5k | $0 (free) |
| 2 | `embed.jd` | Gemini | emb-004 | 0.5k | — | $0 (free) |
| 3 | `fit.judge` | Gemini | flash | 2.5k | 0.5k | $0 (free) |
| 4 | `tailor.resume` | Anthropic | haiku-4-5 | 8k (6k cached) | 2.5k | $0.010 |
| 5 | `cover.letter` | Anthropic | haiku-4-5 | 6k (5k cached) | 0.5k | $0.006 |
| 6 | `qa.answer` × ~5 | Anthropic | haiku-4-5 | 4k × 5 (3k cached each) | 0.3k × 5 | $0.020 |

**Approximate total per application: $0.036** with aggressive caching. Without caching: ~$0.09. Over 30 applications/day = ~$1.08/day = ~$32/month — well within the user's $5-15 target.

---

## Changelog

Every prompt version change gets a row here. Do not edit a shipped prompt; create `v2.ts` and append to this table.

| Prompt | Version | Date | Change | Measured impact |
|---|---|---|---|---|
| `tailor.resume` | v1 | 2026-04-20 | Initial release | Baseline |
| `cover.letter` | v1 | 2026-04-20 | Initial release | Baseline |
| `fit.judge` | v1 | 2026-04-20 | Initial release | Baseline |
| `jd.parse` | v1 | 2026-04-20 | Initial release | Baseline |
| `qa.answer` | v1 | 2026-04-20 | Initial release | Baseline |
| `profile.summarize` | v1 | 2026-04-20 | Initial release | Baseline |
| `email.classify` | v1 | 2026-04-20 | Initial release | Baseline |
| `company.research` | v1 | 2026-04-20 | Initial release | Baseline |