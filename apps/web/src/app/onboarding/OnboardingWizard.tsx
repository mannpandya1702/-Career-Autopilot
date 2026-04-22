'use client';

import { useMemo, useState, useTransition } from 'react';
import type { ParsedResume } from '@career-autopilot/parsers';
import type {
  ExperienceLevel,
  JobType,
  SkillCategory,
  StoryDimension,
  WorkMode,
} from '@career-autopilot/resume';
import {
  addEducationAction,
  addExperienceAction,
  addStoryAction,
  completeOnboardingAction,
  deleteSkillAction,
  saveProfileStep,
  savePreferencesAction,
  upsertQuestionAction,
  upsertSkillAction,
} from './actions';
import { WIZARD_STEPS, type OnboardingInitialData, type WizardStep } from './wizard-types';

type Status = { state: 'idle' | 'saving' | 'ok' | 'error'; message?: string };

export function OnboardingWizard({ initial }: { initial: OnboardingInitialData }) {
  const [current, setCurrent] = useState<WizardStep>(() => {
    if (!initial.profile) return 'import';
    if (initial.experiences.length === 0) return 'review';
    if (initial.skills.length === 0) return 'skills';
    if (!initial.preferences) return 'preferences';
    if (initial.stories.length === 0) return 'stories';
    return 'questions';
  });

  const [profileId, setProfileId] = useState<string | null>(initial.profile?.id ?? null);
  const [parsed, setParsed] = useState<ParsedResume | null>(null);
  const [status, setStatus] = useState<Status>({ state: 'idle' });

  const currentIdx = useMemo(
    () => WIZARD_STEPS.findIndex((s) => s.key === current),
    [current],
  );

  const goNext = () => {
    const next = WIZARD_STEPS[currentIdx + 1];
    if (next) setCurrent(next.key);
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Onboarding</h1>
        <ol className="flex flex-wrap gap-2 text-xs">
          {WIZARD_STEPS.map((step, i) => {
            const done = i < currentIdx;
            const active = i === currentIdx;
            return (
              <li
                key={step.key}
                className={[
                  'rounded-full border px-3 py-1',
                  active
                    ? 'border-foreground bg-foreground text-background'
                    : done
                      ? 'border-green-600 text-green-700'
                      : 'border-border text-muted-foreground',
                ].join(' ')}
              >
                {i + 1}. {step.label}
              </li>
            );
          })}
        </ol>
        <p className="text-sm text-muted-foreground">
          {WIZARD_STEPS[currentIdx]?.helper}
        </p>
      </header>

      {status.state === 'error' && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {status.message}
        </div>
      )}
      {status.state === 'ok' && (
        <div className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-700">
          {status.message ?? 'Saved.'}
        </div>
      )}

      {current === 'import' && (
        <ImportStep
          onParsed={(p) => {
            setParsed(p);
            setStatus({ state: 'ok', message: 'Resume parsed — review extracted fields below.' });
          }}
          onSaveProfile={async (input) => {
            setStatus({ state: 'saving' });
            const res = await saveProfileStep(input);
            if (!res.ok) return setStatus({ state: 'error', message: res.error });
            setProfileId(res.id ?? null);
            setStatus({ state: 'ok', message: 'Profile saved.' });
            goNext();
          }}
          parsed={parsed}
          initialProfile={initial.profile}
        />
      )}

      {current === 'review' && (
        <ReviewStep
          profileId={profileId}
          parsed={parsed}
          existing={initial.experiences}
          onAdd={async (exp, bullets) => {
            if (!profileId) return setStatus({ state: 'error', message: 'Profile not saved yet.' });
            setStatus({ state: 'saving' });
            const res = await addExperienceAction(profileId, exp, bullets);
            if (!res.ok) return setStatus({ state: 'error', message: res.error });
            setStatus({ state: 'ok', message: 'Experience added.' });
          }}
          onAddEducation={async (edu) => {
            if (!profileId) return setStatus({ state: 'error', message: 'Profile not saved yet.' });
            setStatus({ state: 'saving' });
            const res = await addEducationAction(profileId, edu);
            if (!res.ok) return setStatus({ state: 'error', message: res.error });
            setStatus({ state: 'ok', message: 'Education added.' });
          }}
          onNext={goNext}
        />
      )}

      {current === 'skills' && (
        <SkillsStep
          initial={initial.skills}
          parsed={parsed}
          onAdd={async (input) => {
            setStatus({ state: 'saving' });
            const res = await upsertSkillAction(input);
            if (!res.ok) return setStatus({ state: 'error', message: res.error });
            setStatus({ state: 'ok', message: 'Skill saved.' });
          }}
          onRemove={async (id) => {
            setStatus({ state: 'saving' });
            const res = await deleteSkillAction(id);
            if (!res.ok) return setStatus({ state: 'error', message: res.error });
            setStatus({ state: 'ok', message: 'Skill removed.' });
          }}
          onNext={goNext}
        />
      )}

      {current === 'preferences' && (
        <PreferencesStep
          initial={initial.preferences}
          onSave={async (input) => {
            setStatus({ state: 'saving' });
            const res = await savePreferencesAction(input);
            if (!res.ok) return setStatus({ state: 'error', message: res.error });
            setStatus({ state: 'ok', message: 'Preferences saved.' });
            goNext();
          }}
        />
      )}

      {current === 'stories' && (
        <StoriesStep
          profileId={profileId}
          existing={initial.stories.length}
          onAdd={async (input) => {
            if (!profileId) return setStatus({ state: 'error', message: 'Profile not saved yet.' });
            setStatus({ state: 'saving' });
            const res = await addStoryAction(profileId, input);
            if (!res.ok) return setStatus({ state: 'error', message: res.error });
            setStatus({ state: 'ok', message: 'Story added.' });
          }}
          onNext={goNext}
        />
      )}

      {current === 'questions' && (
        <QuestionsStep
          initial={initial.questionBank}
          onSave={async (input) => {
            setStatus({ state: 'saving' });
            const res = await upsertQuestionAction(input);
            if (!res.ok) return setStatus({ state: 'error', message: res.error });
            setStatus({ state: 'ok', message: 'Answer saved.' });
          }}
          onComplete={async () => {
            setStatus({ state: 'saving' });
            const res = await completeOnboardingAction();
            if (!res.ok) return setStatus({ state: 'error', message: res.error });
            setStatus({ state: 'ok', message: 'Onboarding complete.' });
          }}
        />
      )}
    </div>
  );
}

// ------------------- Step 1: Import -------------------
function ImportStep({
  onParsed,
  onSaveProfile,
  parsed,
  initialProfile,
}: {
  onParsed: (parsed: ParsedResume) => void;
  onSaveProfile: (input: unknown) => Promise<void>;
  parsed: ParsedResume | null;
  initialProfile: OnboardingInitialData['profile'];
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const initial = parsed?.contact ?? {};
  const [fullName, setFullName] = useState(
    initialProfile?.full_name ?? initial.full_name ?? '',
  );
  const [email, setEmail] = useState(initialProfile?.email ?? initial.email ?? '');
  const [phone, setPhone] = useState(initialProfile?.phone ?? initial.phone ?? '');
  const [location, setLocation] = useState(initialProfile?.location ?? initial.location ?? '');
  const [linkedin, setLinkedin] = useState(
    initialProfile?.linkedin_url ?? initial.linkedin_url ?? '',
  );
  const [github, setGithub] = useState(initialProfile?.github_url ?? initial.github_url ?? '');
  const [portfolio, setPortfolio] = useState(
    initialProfile?.portfolio_url ?? initial.portfolio_url ?? '',
  );
  const [headline, setHeadline] = useState(
    initialProfile?.headline ?? initial.headline ?? '',
  );
  const [summary, setSummary] = useState(
    initialProfile?.summary ?? parsed?.summary ?? '',
  );

  async function upload(file: File, source: 'resume_pdf' | 'linkedin_pdf') {
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('source', source);
      const res = await fetch('/api/profile/parse', { method: 'POST', body: form });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `parse failed: ${res.status}`);
      }
      const body = (await res.json()) as { parsed: ParsedResume };
      onParsed(body.parsed);
      if (body.parsed.contact.full_name) setFullName(body.parsed.contact.full_name);
      if (body.parsed.contact.email) setEmail(body.parsed.contact.email);
      if (body.parsed.contact.phone) setPhone(body.parsed.contact.phone);
      if (body.parsed.contact.linkedin_url) setLinkedin(body.parsed.contact.linkedin_url);
      if (body.parsed.contact.github_url) setGithub(body.parsed.contact.github_url);
      if (body.parsed.contact.portfolio_url) setPortfolio(body.parsed.contact.portfolio_url);
      if (body.parsed.summary && !summary) setSummary(body.parsed.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="rounded-md border border-dashed border-border p-4">
        <h2 className="text-sm font-medium">Upload resume PDF</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          We extract contact info, experience, education, and skills. You review before saving.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label className="inline-flex cursor-pointer items-center justify-center rounded border border-border px-3 py-2 text-sm">
            <input
              type="file"
              accept="application/pdf"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f, 'resume_pdf');
              }}
            />
            Choose resume PDF
          </label>
          <label className="inline-flex cursor-pointer items-center justify-center rounded border border-border px-3 py-2 text-sm">
            <input
              type="file"
              accept="application/pdf"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f, 'linkedin_pdf');
              }}
            />
            LinkedIn export (optional)
          </label>
        </div>
        {uploading && <p className="mt-2 text-xs text-muted-foreground">Parsing…</p>}
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        {parsed && (
          <p className="mt-2 text-xs text-green-700">
            Parsed: {parsed.experiences.length} experiences, {parsed.skills.length} skills,
            {parsed.education.length} education entries.
            {parsed.warnings.length > 0 && ` ${parsed.warnings.length} warnings.`}
          </p>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const payload = {
            full_name: fullName.trim(),
            email: email.trim(),
            phone: phone.trim() || null,
            location: location.trim() || null,
            linkedin_url: linkedin.trim() || null,
            github_url: github.trim() || null,
            portfolio_url: portfolio.trim() || null,
            headline: headline.trim() || null,
            summary: summary.trim() || null,
          };
          startTransition(() => {
            void onSaveProfile(payload);
          });
        }}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        <Field label="Full name" required>
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Email" required>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Phone">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
        </Field>
        <Field label="Location">
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="LinkedIn URL">
          <input
            value={linkedin}
            onChange={(e) => setLinkedin(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="GitHub URL">
          <input value={github} onChange={(e) => setGithub(e.target.value)} className="input" />
        </Field>
        <Field label="Portfolio URL">
          <input
            value={portfolio}
            onChange={(e) => setPortfolio(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Headline">
          <input
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Summary" className="sm:col-span-2">
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={4}
            className="input"
          />
        </Field>
        <div className="sm:col-span-2">
          <button type="submit" disabled={isPending} className="btn-primary">
            {isPending ? 'Saving…' : 'Save and continue'}
          </button>
        </div>
      </form>
    </section>
  );
}

// ------------------- Step 2: Review -------------------
function ReviewStep({
  profileId,
  parsed,
  existing,
  onAdd,
  onAddEducation,
  onNext,
}: {
  profileId: string | null;
  parsed: ParsedResume | null;
  existing: OnboardingInitialData['experiences'];
  onAdd: (exp: unknown, bullets: unknown[]) => Promise<void>;
  onAddEducation: (edu: unknown) => Promise<void>;
  onNext: () => void;
}) {
  const suggestedExp = parsed?.experiences ?? [];
  const suggestedEdu = parsed?.education ?? [];
  const [isPending, startTransition] = useTransition();

  const [exp, setExp] = useState({
    company: '',
    title: '',
    start_date: '',
    end_date: '',
    description: '',
    bullets: '',
  });
  const [edu, setEdu] = useState({
    institution: '',
    degree: '',
    field: '',
    end_date: '',
  });

  function prefillExp(i: number) {
    const e = suggestedExp[i];
    if (!e) return;
    setExp({
      company: e.company,
      title: e.title,
      start_date: e.start_date ?? '',
      end_date: e.end_date ?? '',
      description: e.description ?? '',
      bullets: e.bullets.map((b) => `- ${b.text}`).join('\n'),
    });
  }

  return (
    <section className="flex flex-col gap-6">
      {!profileId && (
        <p className="text-sm text-red-600">
          Save the profile step before adding experiences.
        </p>
      )}

      <div className="rounded-md border border-border p-4">
        <h2 className="text-sm font-medium">Extracted experiences ({suggestedExp.length})</h2>
        <ul className="mt-2 space-y-1 text-xs">
          {suggestedExp.map((e, i) => (
            <li key={i} className="flex items-center justify-between">
              <span>
                <strong>{e.title || '(no title)'}</strong> — {e.company}
              </span>
              <button
                type="button"
                className="text-blue-600 underline"
                onClick={() => prefillExp(i)}
              >
                Use
              </button>
            </li>
          ))}
          {suggestedExp.length === 0 && (
            <li className="text-muted-foreground">
              None detected. Add experiences manually below.
            </li>
          )}
        </ul>
      </div>

      <form
        onSubmit={(evt) => {
          evt.preventDefault();
          const bulletsParsed = exp.bullets
            .split('\n')
            .map((l) => l.replace(/^[-*•]\s*/, '').trim())
            .filter(Boolean)
            .map((text, ord) => ({ text, ord }));
          const payload = {
            company: exp.company.trim(),
            title: exp.title.trim(),
            start_date: exp.start_date,
            end_date: exp.end_date || null,
            description: exp.description.trim() || null,
          };
          startTransition(() => {
            void onAdd(payload, bulletsParsed).then(() => {
              setExp({ company: '', title: '', start_date: '', end_date: '', description: '', bullets: '' });
            });
          });
        }}
        className="grid grid-cols-1 gap-3 rounded-md border border-border p-4 sm:grid-cols-2"
      >
        <h2 className="sm:col-span-2 text-sm font-medium">Add experience</h2>
        <Field label="Company" required>
          <input
            required
            value={exp.company}
            onChange={(e) => setExp({ ...exp, company: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="Title" required>
          <input
            required
            value={exp.title}
            onChange={(e) => setExp({ ...exp, title: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="Start date" required>
          <input
            required
            type="date"
            value={exp.start_date}
            onChange={(e) => setExp({ ...exp, start_date: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="End date (blank = current)">
          <input
            type="date"
            value={exp.end_date}
            onChange={(e) => setExp({ ...exp, end_date: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="Description" className="sm:col-span-2">
          <textarea
            rows={2}
            value={exp.description}
            onChange={(e) => setExp({ ...exp, description: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="Bullets (one per line)" className="sm:col-span-2">
          <textarea
            rows={5}
            value={exp.bullets}
            onChange={(e) => setExp({ ...exp, bullets: e.target.value })}
            className="input"
          />
        </Field>
        <div className="sm:col-span-2">
          <button type="submit" disabled={isPending || !profileId} className="btn-primary">
            {isPending ? 'Saving…' : 'Add experience'}
          </button>
        </div>
      </form>

      <div className="rounded-md border border-border p-4">
        <h2 className="text-sm font-medium">Extracted education ({suggestedEdu.length})</h2>
        <ul className="mt-2 space-y-1 text-xs">
          {suggestedEdu.map((e, i) => (
            <li key={i} className="flex items-center justify-between">
              <span>{e.institution}</span>
              <button
                type="button"
                className="text-blue-600 underline"
                onClick={() => setEdu({ institution: e.institution, degree: '', field: '', end_date: '' })}
              >
                Use
              </button>
            </li>
          ))}
          {suggestedEdu.length === 0 && (
            <li className="text-muted-foreground">None detected. Add manually below.</li>
          )}
        </ul>
      </div>

      <form
        onSubmit={(evt) => {
          evt.preventDefault();
          const payload = {
            institution: edu.institution.trim(),
            degree: edu.degree.trim() || null,
            field: edu.field.trim() || null,
            end_date: edu.end_date || null,
            ord: 0,
          };
          startTransition(() => {
            void onAddEducation(payload).then(() => {
              setEdu({ institution: '', degree: '', field: '', end_date: '' });
            });
          });
        }}
        className="grid grid-cols-1 gap-3 rounded-md border border-border p-4 sm:grid-cols-2"
      >
        <h2 className="sm:col-span-2 text-sm font-medium">Add education</h2>
        <Field label="Institution" required>
          <input
            required
            value={edu.institution}
            onChange={(e) => setEdu({ ...edu, institution: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="Degree">
          <input
            value={edu.degree}
            onChange={(e) => setEdu({ ...edu, degree: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="Field">
          <input
            value={edu.field}
            onChange={(e) => setEdu({ ...edu, field: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="End date">
          <input
            type="date"
            value={edu.end_date}
            onChange={(e) => setEdu({ ...edu, end_date: e.target.value })}
            className="input"
          />
        </Field>
        <div className="sm:col-span-2">
          <button type="submit" disabled={isPending || !profileId} className="btn-primary">
            {isPending ? 'Saving…' : 'Add education'}
          </button>
        </div>
      </form>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Existing in your profile: {existing.length} experiences.
        </p>
        <button type="button" className="btn-secondary" onClick={onNext}>
          Continue
        </button>
      </div>
    </section>
  );
}

// ------------------- Step 3: Skills -------------------
const SKILL_CATEGORY_OPTIONS: SkillCategory[] = [
  'language',
  'framework',
  'tool',
  'domain',
  'soft',
  'certification',
  'database',
  'cloud',
];

function SkillsStep({
  initial,
  parsed,
  onAdd,
  onRemove,
  onNext,
}: {
  initial: OnboardingInitialData['skills'];
  parsed: ParsedResume | null;
  onAdd: (input: unknown) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onNext: () => void;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<SkillCategory>('language');
  const [proficiency, setProficiency] = useState<number | ''>('');
  const [isPending, startTransition] = useTransition();

  const suggestions = (parsed?.skills ?? []).filter(
    (s) => !initial.some((i) => i.name.toLowerCase() === s.name.toLowerCase()),
  );

  return (
    <section className="flex flex-col gap-6">
      <div className="rounded-md border border-border p-4">
        <h2 className="text-sm font-medium">Current skills ({initial.length})</h2>
        <ul className="mt-2 flex flex-wrap gap-2 text-xs">
          {initial.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-1 rounded-full border border-border px-2 py-1"
            >
              <span>
                {s.name}{' '}
                <span className="text-muted-foreground">({s.category})</span>
              </span>
              <button
                type="button"
                onClick={() => void onRemove(s.id)}
                className="text-red-600"
                aria-label={`Remove ${s.name}`}
              >
                ×
              </button>
            </li>
          ))}
          {initial.length === 0 && (
            <li className="text-muted-foreground">Add skills below.</li>
          )}
        </ul>
      </div>

      {suggestions.length > 0 && (
        <div className="rounded-md border border-dashed border-border p-4">
          <h3 className="text-sm font-medium">Parsed suggestions</h3>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {suggestions.map((s) => (
              <button
                type="button"
                key={s.name}
                onClick={() => {
                  setName(s.name);
                  if (s.category_guess) setCategory(s.category_guess);
                }}
                className="rounded-full border border-border px-2 py-1 hover:bg-slate-100"
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const payload = {
            name: name.trim(),
            category,
            proficiency: proficiency === '' ? null : Number(proficiency),
          };
          startTransition(() => {
            void onAdd(payload).then(() => {
              setName('');
              setProficiency('');
            });
          });
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <Field label="Skill" required>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Category">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as SkillCategory)}
            className="input"
          >
            {SKILL_CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Proficiency (1–5)">
          <input
            type="number"
            min={1}
            max={5}
            value={proficiency}
            onChange={(e) =>
              setProficiency(e.target.value === '' ? '' : Number(e.target.value))
            }
            className="input w-24"
          />
        </Field>
        <button type="submit" disabled={isPending} className="btn-primary">
          Add skill
        </button>
      </form>

      <div className="flex justify-end">
        <button type="button" className="btn-secondary" onClick={onNext}>
          Continue
        </button>
      </div>
    </section>
  );
}

// ------------------- Step 4: Preferences -------------------
const EXPERIENCE_LEVELS: ExperienceLevel[] = [
  'intern',
  'entry',
  'mid',
  'senior',
  'lead',
  'principal',
];
const WORK_MODES: WorkMode[] = ['remote', 'hybrid', 'onsite'];
const JOB_TYPES: JobType[] = ['full_time', 'part_time', 'contract', 'internship', 'freelance'];

function PreferencesStep({
  initial,
  onSave,
}: {
  initial: OnboardingInitialData['preferences'];
  onSave: (input: unknown) => Promise<void>;
}) {
  const [levels, setLevels] = useState<ExperienceLevel[]>(
    initial?.experience_levels ?? ['mid'],
  );
  const [modes, setModes] = useState<WorkMode[]>(
    initial?.work_modes ?? ['remote', 'hybrid'],
  );
  const [types, setTypes] = useState<JobType[]>(initial?.job_types ?? ['full_time']);
  const [salaryMin, setSalaryMin] = useState<string>(
    initial?.salary_min != null ? String(initial.salary_min) : '',
  );
  const [salaryMax, setSalaryMax] = useState<string>(
    initial?.salary_max != null ? String(initial.salary_max) : '',
  );
  const [currency, setCurrency] = useState(initial?.salary_currency ?? 'USD');
  const [locations, setLocations] = useState((initial?.locations ?? []).join(', '));
  const [remoteAnywhere, setRemoteAnywhere] = useState(initial?.remote_anywhere ?? false);
  const [noticeDays, setNoticeDays] = useState<string>(
    initial?.notice_period_days != null ? String(initial.notice_period_days) : '',
  );
  const [relocate, setRelocate] = useState(initial?.willing_to_relocate ?? false);
  const [cap, setCap] = useState<string>(String(initial?.daily_app_cap ?? 30));
  const [isPending, startTransition] = useTransition();

  const toggle = <T,>(arr: T[], v: T): T[] =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const payload = {
          experience_levels: levels,
          work_modes: modes,
          job_types: types,
          salary_min: salaryMin === '' ? null : Number(salaryMin),
          salary_max: salaryMax === '' ? null : Number(salaryMax),
          salary_currency: currency.toUpperCase(),
          locations: locations
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          remote_anywhere: remoteAnywhere,
          notice_period_days: noticeDays === '' ? null : Number(noticeDays),
          willing_to_relocate: relocate,
          daily_app_cap: Number(cap) || 30,
        };
        startTransition(() => {
          void onSave(payload);
        });
      }}
      className="flex flex-col gap-4"
    >
      <CheckboxGroup
        label="Experience levels"
        options={EXPERIENCE_LEVELS}
        value={levels}
        onChange={(v) => setLevels(toggle(levels, v))}
      />
      <CheckboxGroup
        label="Work modes"
        options={WORK_MODES}
        value={modes}
        onChange={(v) => setModes(toggle(modes, v))}
      />
      <CheckboxGroup
        label="Job types"
        options={JOB_TYPES}
        value={types}
        onChange={(v) => setTypes(toggle(types, v))}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Salary min">
          <input
            type="number"
            value={salaryMin}
            onChange={(e) => setSalaryMin(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Salary max">
          <input
            type="number"
            value={salaryMax}
            onChange={(e) => setSalaryMax(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Currency">
          <input
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            maxLength={3}
            className="input"
          />
        </Field>
      </div>
      <Field label="Locations (comma-separated)">
        <input
          value={locations}
          onChange={(e) => setLocations(e.target.value)}
          className="input"
        />
      </Field>
      <label className="inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={remoteAnywhere}
          onChange={(e) => setRemoteAnywhere(e.target.checked)}
        />
        Anywhere remote
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Notice period (days)">
          <input
            type="number"
            value={noticeDays}
            onChange={(e) => setNoticeDays(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Daily application cap">
          <input
            type="number"
            min={1}
            value={cap}
            onChange={(e) => setCap(e.target.value)}
            className="input"
          />
        </Field>
      </div>
      <label className="inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={relocate}
          onChange={(e) => setRelocate(e.target.checked)}
        />
        Willing to relocate
      </label>

      <button type="submit" disabled={isPending} className="btn-primary self-start">
        {isPending ? 'Saving…' : 'Save preferences'}
      </button>
    </form>
  );
}

// ------------------- Step 5: Stories (STAR) -------------------
const STORY_PROMPTS: { key: StoryDimension; label: string }[] = [
  { key: 'leadership', label: 'Leadership' },
  { key: 'conflict', label: 'Conflict' },
  { key: 'failure', label: 'Failure' },
  { key: 'ambiguity', label: 'Ambiguity' },
  { key: 'ownership', label: 'Ownership' },
  { key: 'influence', label: 'Influence' },
  { key: 'learning', label: 'Learning' },
  { key: 'metric_win', label: 'Metric-driven win' },
];

function StoriesStep({
  profileId,
  existing,
  onAdd,
  onNext,
}: {
  profileId: string | null;
  existing: number;
  onAdd: (input: unknown) => Promise<void>;
  onNext: () => void;
}) {
  const [dims, setDims] = useState<StoryDimension[]>(['leadership']);
  const [title, setTitle] = useState('');
  const [situation, setSituation] = useState('');
  const [task, setTask] = useState('');
  const [action, setAction] = useState('');
  const [result, setResult] = useState('');
  const [reflection, setReflection] = useState('');
  const [isPending, startTransition] = useTransition();

  const toggleDim = (d: StoryDimension) =>
    setDims(dims.includes(d) ? dims.filter((x) => x !== d) : [...dims, d]);

  return (
    <section className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        Aim for 6–8 stories across dimensions. You have {existing} so far.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const payload = {
            dimensions: dims,
            title: title.trim(),
            situation: situation.trim(),
            task: task.trim(),
            action: action.trim(),
            result: result.trim(),
            reflection: reflection.trim() || null,
          };
          startTransition(() => {
            void onAdd(payload).then(() => {
              setTitle('');
              setSituation('');
              setTask('');
              setAction('');
              setResult('');
              setReflection('');
            });
          });
        }}
        className="flex flex-col gap-3"
      >
        <div>
          <span className="text-xs font-medium">Dimensions</span>
          <div className="mt-1 flex flex-wrap gap-2 text-xs">
            {STORY_PROMPTS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => toggleDim(p.key)}
                className={[
                  'rounded-full border px-2 py-1',
                  dims.includes(p.key)
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border',
                ].join(' ')}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <Field label="Title" required>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Situation" required>
          <textarea
            required
            rows={2}
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Task" required>
          <textarea
            required
            rows={2}
            value={task}
            onChange={(e) => setTask(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Action" required>
          <textarea
            required
            rows={3}
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Result" required>
          <textarea
            required
            rows={2}
            value={result}
            onChange={(e) => setResult(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Reflection (optional)">
          <textarea
            rows={2}
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            className="input"
          />
        </Field>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending || !profileId || dims.length === 0}
            className="btn-primary"
          >
            {isPending ? 'Saving…' : 'Add story'}
          </button>
          <button type="button" className="btn-secondary" onClick={onNext}>
            Continue
          </button>
        </div>
      </form>
    </section>
  );
}

// ------------------- Step 6: Q&A -------------------
const SEED_QUESTIONS: { key: string; text: string; word_limit: number | null }[] = [
  { key: 'tell_me_about_yourself_150', text: 'Tell us about yourself (≤150 words).', word_limit: 150 },
  { key: 'tell_me_about_yourself_300', text: 'Tell us about yourself (≤300 words).', word_limit: 300 },
  { key: 'why_this_company', text: 'Why this company?', word_limit: 200 },
  { key: 'why_leaving_current_role', text: 'Why are you leaving your current role?', word_limit: 150 },
  { key: 'salary_expectation', text: 'Salary expectation.', word_limit: 50 },
  { key: 'notice_period', text: 'Notice period.', word_limit: 30 },
  { key: 'willingness_to_relocate', text: 'Willingness to relocate.', word_limit: 50 },
  { key: 'work_authorization', text: 'Work authorization status.', word_limit: 50 },
];

function QuestionsStep({
  initial,
  onSave,
  onComplete,
}: {
  initial: OnboardingInitialData['questionBank'];
  onSave: (input: unknown) => Promise<void>;
  onComplete: () => Promise<void>;
}) {
  const byKey = new Map(initial.map((q) => [q.question_key, q]));
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = {};
    for (const q of SEED_QUESTIONS) {
      d[q.key] = byKey.get(q.key)?.answer_text ?? '';
    }
    return d;
  });
  const [isPending, startTransition] = useTransition();

  const saveOne = (q: (typeof SEED_QUESTIONS)[number]) => {
    const payload = {
      question_key: q.key,
      question_text: q.text,
      answer_text: (drafts[q.key] ?? '').trim(),
      word_limit: q.word_limit,
    };
    startTransition(() => {
      void onSave(payload);
    });
  };

  return (
    <section className="flex flex-col gap-4">
      {SEED_QUESTIONS.map((q) => (
        <div key={q.key} className="rounded-md border border-border p-3">
          <label className="text-sm font-medium">{q.text}</label>
          <textarea
            rows={3}
            value={drafts[q.key] ?? ''}
            onChange={(e) => setDrafts({ ...drafts, [q.key]: e.target.value })}
            className="input mt-2"
          />
          <div className="mt-2 flex justify-end">
            <button type="button" className="btn-secondary" onClick={() => saveOne(q)}>
              Save
            </button>
          </div>
        </div>
      ))}

      <div className="flex justify-end">
        <button
          type="button"
          disabled={isPending}
          className="btn-primary"
          onClick={() => {
            startTransition(() => {
              void onComplete();
            });
          }}
        >
          Mark onboarding complete
        </button>
      </div>
    </section>
  );
}

// ------------------- small helpers -------------------
function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={['flex flex-col gap-1 text-xs', className ?? ''].join(' ')}>
      <span className="font-medium text-slate-700">
        {label} {required ? <span className="text-red-600">*</span> : null}
      </span>
      {children}
    </label>
  );
}

function CheckboxGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: T[];
  value: T[];
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <span className="text-xs font-medium">{label}</span>
      <div className="mt-1 flex flex-wrap gap-2 text-xs">
        {options.map((opt) => (
          <label
            key={opt}
            className={[
              'cursor-pointer rounded-full border px-2 py-1',
              value.includes(opt)
                ? 'border-foreground bg-foreground text-background'
                : 'border-border',
            ].join(' ')}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={value.includes(opt)}
              onChange={() => onChange(opt)}
            />
            {opt}
          </label>
        ))}
      </div>
    </div>
  );
}
