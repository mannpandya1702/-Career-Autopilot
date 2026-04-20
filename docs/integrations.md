# Integrations — ATS Endpoint Reference

**This document is the source of truth for every ATS adapter.** Every endpoint, field name, and auth pattern below has been verified against the ATS vendor's documentation. Do not modify from memory; if a vendor changes their API, verify the new pattern via `web_fetch` against the vendor's official docs, update this file first, then update the adapter code.

**When adding a new ATS:** fetch the vendor's docs, fetch one real job posting page + one real sample API response, add a section here with the patterns you observed, only then write the adapter code. No guessing.

---

## Quick reference

| ATS | Discovery endpoint | Auth for discovery | Submit endpoint | Auth for submit |
|---|---|---|---|---|
| Greenhouse | `GET https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true` | None | `POST https://boards-api.greenhouse.io/v1/boards/{token}/jobs/{id}` | Basic Auth (Base64 API key) |
| Lever | `GET https://api.lever.co/v0/postings/{site}?mode=json` | None | `POST https://api.lever.co/v0/postings/{site}/{id}` | None (rate-limited) |
| Ashby | `GET https://api.ashbyhq.com/posting-api/job-board/{org}?includeCompensation=true` | None | `POST https://api.ashbyhq.com/applicationForm.submit` | Basic Auth |
| Workable | `GET https://apply.workable.com/api/v1/widget/accounts/{account}` | None | Via hosted form (custom careers needs partner API) | — |
| SmartRecruiters | `GET https://api.smartrecruiters.com/v1/companies/{company}/postings` | None | `POST https://api.smartrecruiters.com/v1/companies/{company}/postings/{id}/candidates` | None (public) |

All discovery endpoints are public, unauthenticated, and cached. Treat them as friendly but still apply per-adapter rate limits (default 1 req / 500ms).

---

## ATS detection

Given a URL or HTML, return one of `greenhouse | lever | ashby | workable | smartrecruiters | custom`.

### URL patterns (deterministic; check first)

```
greenhouse:      boards.greenhouse.io/*                       → token = path[1]
                 job-boards.greenhouse.io/*                   → token = path[1]
                 *.greenhouse.io/*                            (older embeds)
                 boards-api.greenhouse.io/v1/boards/{token}   (already an API URL)

lever:           jobs.lever.co/{site}/*                       → site = path[1]
                 jobs.eu.lever.co/{site}/*                    (EU instance)
                 api.lever.co/v0/postings/{site}              (already API)

ashby:           jobs.ashbyhq.com/{org}/*                     → org = path[1]
                 {org}.ashbyhq.com                            (vanity)
                 api.ashbyhq.com/posting-api/job-board/{org}  (already API)

workable:        apply.workable.com/{account}/                → account = path[1]
                 {account}.workable.com                        (vanity)

smartrecruiters: jobs.smartrecruiters.com/{company}/*         → company = path[1]
                 careers.smartrecruiters.com/{company}         (vanity)
```

### HTML fingerprint (fallback when URL is a custom careers page)

Fetch the page once, look for:
- Greenhouse: `<iframe ... src="https://boards.greenhouse.io/embed/job_board?for={token}...` OR a `<div id="grnhse_app" data-for="{token}">`
- Lever: `<script src="https://jobs.lever.co/{site}/embed"` OR a `data-lever-job-id` attribute
- Ashby: `<div id="ashby_embed_iframe" data-organization="{org}">` OR a script src to `jobs.ashbyhq.com/{org}/embed.js`
- Workable: `<script src="https://apply.workable.com/embed.js" ... data-account="{account}">`
- SmartRecruiters: `<div id="sr-careers-embed" data-customer-code="{company}">`

If neither URL nor HTML fingerprint matches a known ATS, classify as `custom` and route to the generic Playwright adapter later.

**Implementation note:** the detection function must NEVER call the LLM. It's pure string matching. Deterministic, testable, cheap.

---

## Greenhouse

Greenhouse has two APIs: the public **Job Board API** (no auth for reads, Basic Auth for writes) and the private **Harvest API** (full CRUD, not used by this system).

### List jobs (discovery)

```
GET https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs?content=true
```

- `board_token` is the company's slug (e.g., `vaulttec`).
- `content=true` returns the full job description inline; without it, descriptions are omitted.
- No auth required.
- No documented rate limit on reads, but apply a polite 1 req / 500ms per company anyway.

**Response shape (verified):**

```json
{
  "jobs": [
    {
      "id": 127817,
      "internal_job_id": 144381,
      "title": "Vault Designer",
      "updated_at": "2016-01-14T10:55:28-05:00",
      "requisition_id": "50",
      "location": { "name": "NYC" },
      "absolute_url": "https://boards.greenhouse.io/vaulttec/jobs/127817",
      "language": "en",
      "metadata": null,
      "content": "This is the job description. &lt;p&gt;HTML is escaped.&lt;/p&gt;",
      "departments": [
        { "id": 13583, "name": "Department of Departments", "parent_id": null, "child_ids": [13585] }
      ],
      "offices": [
        { "id": 8304, "name": "East Coast", "location": "United States", "parent_id": null, "child_ids": [8787] }
      ]
    }
  ],
  "meta": { "total": 1 }
}
```

**Important quirks:**
- The `content` field contains HTML but is double-escaped (`&lt;p&gt;` not `<p>`). Our normalizer must HTML-unescape before storing.
- `absolute_url` points to the hosted job page (human-facing). Store this as `jobs.apply_url`.
- `location.name` is a free-form string, not structured. We apply location-normalization downstream.
- `updated_at` can be used as a cheap change-detector; compare against our last `last_seen_at`.

### Get single job (when we need the application form schema)

```
GET https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs/{job_id}?questions=true
```

- Adds `questions` array with the application form schema.
- Questions can be nested (multiple fields under one logical question, e.g., "Resume" accepts file OR textarea).

### Submit an application

```
POST https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs/{id}
Authorization: Basic {base64(api_key + ":")}
Content-Type: multipart/form-data
```

**Important:** Submission requires the company's Job Board API Key. We cannot submit to arbitrary Greenhouse boards without the company's cooperation. **In practice, most companies' boards accept form-data POSTs that originate from their hosted job board page** — the same endpoint the browser's form uses. For production, we fall back to the generic Playwright adapter when we don't have a company-provided key.

**Required fields:**
- `first_name`, `last_name`, `email`
- `resume` (file, multipart) OR a resume text via `resume_text`

**Optional common fields:**
- `phone`, `location`, `latitude`, `longitude`
- `cover_letter` (file) OR `cover_letter_text`
- `gender`, `race`, `veteran_status`, `disability_status` (integer enums; values from the board's config)
- `question_{id}` for custom questions (where `{id}` comes from the form schema)
  - Short text → string
  - Multi-select → array of option IDs
  - File upload → `question_{id}_url` + `question_{id}_url_filename` OR `question_{id}_content` (base64) + `question_{id}_content_filename`
- `educations[]` and `employments[]` as nested arrays with school/degree/discipline IDs (from `List Schools`, `List Degrees`, `List Disciplines` endpoints)

**Response:** JSON with `success: true` and a `candidate_id`, or 4xx with validation errors.

**Adapter implementation checklist:**
- [ ] Fetch form schema via `?questions=true` on every submission (don't cache — custom fields change).
- [ ] Map our `TailoredResume` and `QuestionAnswer[]` to the Greenhouse field names using the form schema.
- [ ] Handle file uploads as multipart streams (never load into memory as a single buffer).
- [ ] On 429, backoff exponentially starting at 2s, max 60s, max 3 retries.
- [ ] On success, record the Greenhouse `candidate_id` as `submissions.external_confirmation_id`.

---

## Lever

Lever's Postings API is the public one. All endpoints are `/v0/`.

### List postings (discovery)

```
GET https://api.lever.co/v0/postings/{site}?mode=json
```

- `site` is the company's Lever customer ID (e.g., `lever` for Lever itself).
- `mode=json` required; without it, Lever serves HTML.
- No auth.
- Supports filters: `?location=`, `?commitment=`, `?team=`, `?department=`, `?level=`. Multiple values OR'ed. **Note: values are case-sensitive.** We don't rely on these filters; we fetch all and filter client-side.
- EU instance: `api.eu.lever.co` (detect from the job URL domain).

**Response shape (verified):**

```json
[
  {
    "id": "ff7ef527-b0d3-4c44-836a-8d6b58ac321e",
    "text": "Account Executive",
    "hostedUrl": "https://jobs.lever.co/leverdemo/ff7ef527-.../",
    "applyUrl": "https://jobs.lever.co/leverdemo/ff7ef527-.../apply",
    "categories": {
      "commitment": "Full Time",
      "department": "Sales",
      "location": "Toronto",
      "team": "Account Executive"
    },
    "createdAt": 1502907172814,
    "descriptionPlain": "Work at Lever...",
    "description": "<div>...HTML...</div>",
    "additionalPlain": "The Lever Story...",
    "additional": "<div>...HTML...</div>",
    "lists": [
      { "text": "About the Gig:", "content": "<li>...</li>" },
      { "text": "About You:", "content": "<li>...</li>" }
    ],
    "workplaceType": "remote",
    "salaryRange": { "currency": "USD", "interval": "per-year-salary", "min": 80000, "max": 120000 },
    "salaryDescription": "Plus equity..."
  }
]
```

**Important quirks:**
- Response is a **bare JSON array**, not wrapped in `{ jobs: [...] }`. Our normalizer handles this.
- `createdAt` is a Unix timestamp in **milliseconds**. Convert to ISO timestamp.
- `description` and `additional` are full HTML; we concatenate them (plus `lists`) to form the full JD for scoring and embedding.
- `workplaceType` enum: `unspecified | on-site | remote | hybrid` — maps directly to our `work_mode`, with `on-site` → `onsite`.
- No `updated_at` field. Change detection uses `description_hash` in our DB, not vendor timestamps.

### Get single posting

```
GET https://api.lever.co/v0/postings/{site}/{id}?mode=json
```

Same shape as list.

### Submit application

```
POST https://api.lever.co/v0/postings/{site}/{id}
Content-Type: multipart/form-data
```

- No authentication for Postings API submissions.
- Rate limited; expect 429s. Lever's docs explicitly warn: Application create requests are rate limited. Your team will need to properly handle 429 responses if you build a custom job application page.

**Required fields:**
- `name`, `email`
- `resume` (multipart file)

**Common optional fields:**
- `phone`, `org`, `comments`
- `urls[github]`, `urls[twitter]`, `urls[linkedin]`, `urls[portfolio]`
- `silent=true` to suppress the auto-email to candidate
- Custom form fields: `cards[{cardId}][field{N}]=value`

**Response:** On success, `{ok: true, applicationId: "..."}`. Full profile visible at `https://hire.lever.co/search/application/{applicationId}` (requires Lever login).

**Adapter implementation checklist:**
- [ ] Dedupe on email — Lever silently merges duplicate emails. In testing, use unique email aliases.
- [ ] Resume is required; must be multipart; PDF recommended.
- [ ] On 429, exponential backoff 2s → 60s, max 3 retries.
- [ ] Log the returned `applicationId` as `submissions.external_confirmation_id`.

---

## Ashby

Ashby has two public API families: the **Public Job Posting API** (unauthenticated, for discovery) and the **Developer API** (authenticated, for submission via `applicationForm.submit`).

### List postings (discovery)

```
GET https://api.ashbyhq.com/posting-api/job-board/{org}?includeCompensation=true
```

- `org` is the organization's Ashby job board slug (e.g., `Ashby` for `jobs.ashbyhq.com/Ashby`).
- `includeCompensation=true` adds salary data when the org has it configured.
- No auth.

**Response shape (verified):**

```json
{
  "apiVersion": "1",
  "jobs": [
    {
      "title": "Product Manager",
      "location": "Houston, TX",
      "secondaryLocations": [
        { "location": "San Francisco", "address": { "addressLocality": "San Francisco", "addressRegion": "California", "addressCountry": "USA" } }
      ],
      "department": "Product",
      "team": "Growth",
      "isListed": true,
      "isRemote": true,
      "workplaceType": "Remote",
      "descriptionHtml": "<p>Join our team</p>",
      "descriptionPlain": "Join our team",
      "publishedAt": "2021-04-30T16:21:55.393+00:00",
      "employmentType": "FullTime",
      "address": {
        "postalAddress": { "addressLocality": "Houston", "addressRegion": "Texas", "addressCountry": "USA" }
      },
      "jobUrl": "https://jobs.ashbyhq.com/example_job",
      "applyUrl": "https://jobs.ashbyhq.com/example/apply",
      "compensation": {
        "compensationTierSummary": "$81K – $87K • 0.5% – 1.75% • Offers Bonus",
        "scrapeableCompensationSalarySummary": "$81K - $87K"
      }
    }
  ]
}
```

**Important quirks:**
- Job ID is **not** in the discovery response. The ID we need for submission is embedded in `applyUrl`; extract via regex (`/jobs\.ashbyhq\.com\/[^/]+\/([^/?#]+)/`).
- `workplaceType` enum: `Remote | OnSite | Hybrid`. Note capitalization differs from Lever.
- `employmentType` enum: `FullTime | PartTime | Intern | Contract | Temporary`.
- `descriptionHtml` is real HTML (not double-escaped like Greenhouse).

### Submit application (requires auth)

**Important:** Ashby requires an API key for submissions. Without the company's key, we cannot use the direct API. Our default path for Ashby is the generic Playwright adapter against the `applyUrl`.

For companies that partner with us (provide an API key):

```
POST https://api.ashbyhq.com/applicationForm.submit
Authorization: Basic {base64(api_key + ":")}
Content-Type: multipart/form-data
```

**Request body:**
- `applicationForm` — JSON string of `{fieldSubmissions: [{path, value}, ...]}`.
  - Common `path` values: `_systemfield_name`, `_systemfield_email`, `_systemfield_resume`, `_systemfield_phone`.
  - For `_systemfield_resume`, the `value` is a field reference name (e.g., `resume_1`) that corresponds to a multipart field below.
- `jobPostingId` — the ID extracted from the apply URL or from `jobPosting.list`.
- `resume_1` — the actual resume file (multipart; the field name matches the reference above).
- `utmData` — optional JSON string of UTM params.

**Form schema discovery** (required before building a submission):

```
POST https://api.ashbyhq.com/jobPosting.info
Authorization: Basic {base64(api_key + ":")}
Content-Type: application/json

{"jobPostingId": "{id}"}
```

Returns the form definition with every field, its `path`, type, and required flag.

**Adapter implementation checklist:**
- [ ] If no Ashby API key available, route to Playwright adapter.
- [ ] Always call `jobPosting.info` before submitting — field schemas are per-posting.
- [ ] Handle the three form-field type classes: system fields (name/email/resume), custom questions, and survey (EEO) fields — survey submissions use a separate endpoint `surveySubmission.create`.

---

## Workable

Workable's public widget API is for discovery only. Submission requires the Partner API (authenticated, not generally available) so our Workable adapter defaults to Playwright.

### List jobs (discovery)

```
GET https://apply.workable.com/api/v1/widget/accounts/{account}?details=true
```

- `account` is the company's Workable account subdomain.
- `details=true` includes full descriptions.
- No auth.

**Response shape:**

```json
{
  "name": "Example Co",
  "description": "Company description",
  "jobs": [
    {
      "id": "ABC123",
      "shortcode": "ABC123",
      "title": "Senior Engineer",
      "full_title": "Senior Engineer - Platform",
      "location": { "city": "Berlin", "country": "Germany", "workplace_type": "hybrid" },
      "department": "Engineering",
      "published_on": "2025-01-15",
      "created_at": "2025-01-10T12:00:00Z",
      "apply_url": "https://apply.workable.com/example/j/ABC123/",
      "description": "<p>Full HTML description...</p>",
      "requirements": "<p>Requirements...</p>",
      "benefits": "<p>Benefits...</p>",
      "employment_type": "Full-time",
      "salary": null
    }
  ]
}
```

**Important quirks:**
- Full JD is split across `description`, `requirements`, `benefits`. Concatenate them.
- `employment_type` free-form string; we pattern-match (`/full.?time/i`, `/part.?time/i`, etc.).
- Workplace type is inside `location.workplace_type`: `on_site | remote | hybrid`.

### Submit

Route to the Playwright adapter pointing at `apply_url`.

---

## SmartRecruiters

### List postings (discovery)

```
GET https://api.smartrecruiters.com/v1/companies/{company}/postings
```

- Paginated with `?limit=100&offset=0`.
- `company` is the SmartRecruiters customer identifier.

**Response shape:**

```json
{
  "offset": 0,
  "limit": 100,
  "totalFound": 42,
  "content": [
    {
      "id": "abcd-1234",
      "name": "Senior Engineer",
      "uuid": "...",
      "jobAdId": "...",
      "refNumber": "REQ-100",
      "releasedDate": "2025-01-15T00:00:00.000Z",
      "location": { "city": "Amsterdam", "country": "nl", "remote": true },
      "industry": { "id": "...", "label": "..." },
      "department": { "id": "...", "label": "Engineering" },
      "function": { "id": "...", "label": "..." },
      "typeOfEmployment": { "label": "Permanent" },
      "experienceLevel": { "label": "Senior" },
      "company": { "name": "Example Co" },
      "ref": "https://api.smartrecruiters.com/v1/companies/{company}/postings/abcd-1234",
      "jobAd": { "sections": { "jobDescription": { "title": "Job Description", "text": "..." }, "qualifications": {...}, "additionalInformation": {...} } }
    }
  ]
}
```

### Get single posting

```
GET https://api.smartrecruiters.com/v1/companies/{company}/postings/{id}
```

### Submit

```
POST https://api.smartrecruiters.com/v1/companies/{company}/postings/{id}/candidates
Content-Type: multipart/form-data
```

No auth for public submission on most boards. Fields: `firstName`, `lastName`, `email`, `phoneNumber`, `location`, `resume` (multipart file), plus custom answers.

---

## Generic Playwright adapter (custom portals)

For `custom` ATS or for Greenhouse/Ashby where we don't have an API key, we drive the apply page with Playwright. The adapter lives in `workers/submitter/src/adapters/generic/`.

### Known portal patterns

Over time, accumulate a selector library keyed by portal signature. Initial patterns:

| Portal signature (HTML fingerprint) | Resume selector | Name field | Email field |
|---|---|---|---|
| Has `input[name="resume"]` with `type="file"` | `input[name="resume"]` | `input[name="name"]` or `input[name="first_name"]` | `input[name="email"]` |
| Workday (`*.myworkdayjobs.com`) | `button[data-automation-id="addResumeAttachment"]` then file input | `input[data-automation-id="legalNameSection_firstName"]` | `input[data-automation-id="email"]` |
| iCIMS (`*.icims.com`) | `input[name="resumeFileName"]` | `input[name="firstname"]` | `input[name="email"]` |
| SuccessFactors (`*.successfactors.com`) | varies; use `input[type="file"][accept*="pdf"]` | Complex; rely on label-based selectors | `input[type="email"]` |
| Taleo (`*.taleo.net`) | `input[id*="resume"]` | `input[id*="first"]` | `input[id*="email"]` |

For anything else, use label-based selectors via Playwright's `getByLabel()`. Take a screenshot before and after each form interaction for debugging.

### Generic flow

1. Navigate to `apply_url` in a fresh browser context with a real user-agent.
2. Wait for the application form to be idle.
3. Detect the portal signature (URL domain + key DOM nodes).
4. Load the selector map for that portal; for unknown portals, use the label-based fallback.
5. Fill required fields from the tailored resume + profile.
6. Upload the PDF.
7. For each custom question on the page, call the LLM (privacy provider) with `{questionText, fieldType, wordLimit, targetJobId, tailoredResumeId}` → get an answer from the Q&A engine.
8. Screenshot: `before_submit.png`.
9. **If `ENABLE_AUTO_SUBMIT=true`**, click the submit button; else bail to manual review.
10. Wait for confirmation (URL change, success toast, or a known confirmation selector).
11. Screenshot: `after_submit.png`.
12. Record all screenshots and the final state to `submission_attempts.screenshots`.

### Failure modes → manual review queue

- Captcha detected (hCaptcha, reCAPTCHA, Cloudflare Turnstile) → bail immediately.
- SSO redirect (Okta, Google, Microsoft) → bail.
- Unexpected URL after submit click (redirect to a confirmation page we don't recognize within 10s) → bail with screenshot.
- Any required field we can't fill (unknown question, missing data in profile) → bail.
- Any exception → bail.

Bail = move to `manual_review_queue` with full context; do not retry automatically.

---

## Anti-patterns (things we specifically do not do)

- **Do not** attempt to apply via LinkedIn's Easy Apply from a headless browser. LinkedIn's ToS forbids this and their detection is good. LinkedIn is handled exclusively via the Chrome extension in the user's own session (Phase 10).
- **Do not** scrape Indeed's sponsored job listings via headless browser. Their bot detection is aggressive and their ToS forbids scraping. Use the extension pattern on Indeed too.
- **Do not** store an ATS API key in the codebase or in our Supabase DB without the company's explicit permission. Keys we're not authorized to use are a security + legal liability.
- **Do not** submit demographic/EEO responses (race, gender, veteran_status, disability_status) without an explicit consented value from the user. Default these to "prefer not to answer" if the field is required; leave blank otherwise.
- **Do not** resubmit an application to the same `(company_id, external_job_id, user_id)` tuple — we enforce uniqueness in the `submissions` table.

---

## Verifying this document stays current

Quarterly (or when an adapter starts failing), verify each ATS's discovery endpoint still returns the documented shape:

```bash
# Example verification script (run via pnpm ats:verify)
for ats in greenhouse lever ashby workable smartrecruiters; do
  pnpm tsx scripts/verify-ats.ts --ats=$ats --sample-company="$SAMPLE_COMPANY"
done
```

The script hits each ATS's discovery endpoint, validates the response against the Zod schema in `packages/ats/src/schemas/<ats>.ts`, and reports any schema drift. Update this doc and the adapter together when drift is detected.

---

## Per-ATS Zod schemas

Each adapter has a schema file at `packages/ats/src/schemas/<ats>.ts`. The schemas are the runtime contract. If a vendor ships a new field, we either extend the schema to include it or ignore it via Zod's `.passthrough()` — but we never break on new fields.

```ts
// Example: packages/ats/src/schemas/greenhouse.ts
import { z } from 'zod';

export const GreenhouseLocationSchema = z.object({
  name: z.string(),
});

export const GreenhouseJobSchema = z.object({
  id: z.number(),
  internal_job_id: z.number().optional(),
  title: z.string(),
  updated_at: z.string(),
  requisition_id: z.string().nullable().optional(),
  location: GreenhouseLocationSchema,
  absolute_url: z.string().url(),
  language: z.string().optional(),
  metadata: z.any().nullable(),
  content: z.string().optional(),
  departments: z.array(z.object({ id: z.number(), name: z.string() })).optional(),
  offices: z.array(z.object({ id: z.number(), name: z.string(), location: z.string().nullable() })).optional(),
}).passthrough();

export const GreenhouseListResponseSchema = z.object({
  jobs: z.array(GreenhouseJobSchema),
  meta: z.object({ total: z.number() }),
});
```

Mirror this structure for each ATS. The **normalizer** (separate file) maps from the ATS-specific schema to our internal `Job` type — always via explicit field mapping, never via "spread everything."

---

## Troubleshooting runbook

| Symptom | Likely cause | Fix |
|---|---|---|
| Greenhouse list returns 404 | Wrong `board_token` | Verify in the company's careers page URL |
| Greenhouse `content` is empty | Missing `?content=true` | Add query param |
| Lever returns HTML instead of JSON | Missing `?mode=json` and no `Accept: application/json` header | Add both |
| Lever returns empty array | Company uses EU instance | Retry against `api.eu.lever.co` |
| Ashby returns `{jobs: []}` | Wrong `org` slug OR all postings are unlisted | Verify slug in `jobs.ashbyhq.com/{org}`; check `isListed` flag |
| Workable times out | Account subdomain wrong | Inspect `apply.workable.com/{account}` in browser first |
| SmartRecruiters returns 401 | Rare; public API no longer public for this company | Fall back to Playwright against hosted board |
| Playwright adapter fails on portal X | Site changed its DOM | Update selectors in the portal's constants file; add a regression test |

Every fix is a code change + a doc change here. Don't patch silently.