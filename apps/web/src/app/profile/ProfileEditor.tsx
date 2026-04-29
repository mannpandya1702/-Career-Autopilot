'use client';

import { useState, useTransition } from 'react';
import type {
  Education,
  Experience,
  ExperienceBullet,
  Preferences,
  Profile,
  Project,
  QuestionBankEntry,
  Skill,
  Story,
} from '@career-autopilot/resume';
import {
  addEducationAction,
  addExperienceAction,
  addProjectAction,
  addStoryAction,
  deleteSkillAction,
  savePreferencesAction,
  saveProfileStep,
  upsertQuestionAction,
  upsertSkillAction,
} from '../onboarding/actions';

// The editor re-uses the onboarding server actions (same validation, same audit).
// Every mutation writes a profile_audit row (see packages/*/mutations.ts).

type Tab = 'contact' | 'experience' | 'projects' | 'skills' | 'stories' | 'preferences' | 'qa';

const TABS: { key: Tab; label: string }[] = [
  { key: 'contact', label: 'Contact' },
  { key: 'experience', label: 'Experience' },
  { key: 'projects', label: 'Projects' },
  { key: 'skills', label: 'Skills' },
  { key: 'stories', label: 'Stories' },
  { key: 'preferences', label: 'Preferences' },
  { key: 'qa', label: 'Q&A' },
];

export interface ProfileEditorData {
  profile: Profile;
  experiences: (Experience & { bullets: ExperienceBullet[] })[];
  projects: Project[];
  skills: Skill[];
  education: Education[];
  stories: Story[];
  preferences: Preferences;
  questionBank: QuestionBankEntry[];
}

type Status = { state: 'idle' | 'saving' | 'ok' | 'error'; message?: string };

export function ProfileEditor({ data }: { data: ProfileEditorData }) {
  const [tab, setTab] = useState<Tab>('contact');
  const [status, setStatus] = useState<Status>({ state: 'idle' });

  async function run(
    fn: () => Promise<{ ok: boolean; error?: string }>,
    successMessage: string,
  ) {
    setStatus({ state: 'saving' });
    try {
      const res = await fn();
      if (!res.ok) return setStatus({ state: 'error', message: res.error ?? 'failed' });
      setStatus({ state: 'ok', message: successMessage });
    } catch (e) {
      setStatus({ state: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
          <p className="text-sm text-muted-foreground">
            Signed in as <span className="font-medium">{data.profile.email}</span>
          </p>
        </div>
        <a href="/api/profile/export" className="btn-secondary" download>
          Download profile as JSON
        </a>
      </header>

      <nav className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={[
              'rounded-t-md px-3 py-2 text-sm',
              tab === t.key
                ? 'border border-border border-b-white bg-white font-medium'
                : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {status.state === 'error' && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {status.message}
        </div>
      )}
      {status.state === 'ok' && (
        <div className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-700">
          {status.message}
        </div>
      )}

      {tab === 'contact' && (
        <ContactTab
          profile={data.profile}
          onSave={(input) => run(() => saveProfileStep(input), 'Contact saved.')}
        />
      )}
      {tab === 'experience' && (
        <ExperienceTab
          profileId={data.profile.id}
          existing={data.experiences}
          education={data.education}
          onAdd={(exp, bullets) =>
            run(() => addExperienceAction(data.profile.id, exp, bullets), 'Experience added.')
          }
          onAddEducation={(edu) =>
            run(() => addEducationAction(data.profile.id, edu), 'Education added.')
          }
        />
      )}
      {tab === 'projects' && (
        <ProjectsTab
          profileId={data.profile.id}
          existing={data.projects}
          onAdd={(input) =>
            run(() => addProjectAction(data.profile.id, input), 'Project added.')
          }
        />
      )}
      {tab === 'skills' && (
        <SkillsTab
          existing={data.skills}
          onAdd={(input) => run(() => upsertSkillAction(input), 'Skill saved.')}
          onRemove={(id) => run(() => deleteSkillAction(id), 'Skill removed.')}
        />
      )}
      {tab === 'stories' && (
        <StoriesTab
          profileId={data.profile.id}
          existing={data.stories}
          onAdd={(input) =>
            run(() => addStoryAction(data.profile.id, input), 'Story added.')
          }
        />
      )}
      {tab === 'preferences' && (
        <PreferencesTab
          initial={data.preferences}
          onSave={(input) => run(() => savePreferencesAction(input), 'Preferences saved.')}
        />
      )}
      {tab === 'qa' && (
        <QaTab
          existing={data.questionBank}
          onSave={(input) => run(() => upsertQuestionAction(input), 'Answer saved.')}
        />
      )}
    </div>
  );
}

// ---------- Contact ----------
function ContactTab({
  profile,
  onSave,
}: {
  profile: Profile;
  onSave: (input: unknown) => void;
}) {
  const [form, setForm] = useState({
    full_name: profile.full_name,
    email: profile.email,
    phone: profile.phone ?? '',
    location: profile.location ?? '',
    linkedin_url: profile.linkedin_url ?? '',
    github_url: profile.github_url ?? '',
    portfolio_url: profile.portfolio_url ?? '',
    headline: profile.headline ?? '',
    summary: profile.summary ?? '',
  });
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const payload = {
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          location: form.location.trim() || null,
          linkedin_url: form.linkedin_url.trim() || null,
          github_url: form.github_url.trim() || null,
          portfolio_url: form.portfolio_url.trim() || null,
          headline: form.headline.trim() || null,
          summary: form.summary.trim() || null,
        };
        startTransition(() => onSave(payload));
      }}
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      {(
        [
          ['full_name', 'Full name', true],
          ['email', 'Email', true],
          ['phone', 'Phone', false],
          ['location', 'Location', false],
          ['linkedin_url', 'LinkedIn URL', false],
          ['github_url', 'GitHub URL', false],
          ['portfolio_url', 'Portfolio URL', false],
          ['headline', 'Headline', false],
        ] as const
      ).map(([key, label, required]) => (
        <Field key={key} label={label} required={required}>
          <input
            required={required}
            value={form[key]}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            className="input"
          />
        </Field>
      ))}
      <Field label="Summary" className="sm:col-span-2">
        <textarea
          rows={4}
          value={form.summary}
          onChange={(e) => setForm({ ...form, summary: e.target.value })}
          className="input"
        />
      </Field>
      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? 'Saving…' : 'Save contact'}
        </button>
      </div>
    </form>
  );
}

// ---------- Experience ----------
function ExperienceTab({
  profileId,
  existing,
  education,
  onAdd,
  onAddEducation,
}: {
  profileId: string;
  existing: ProfileEditorData['experiences'];
  education: Education[];
  onAdd: (exp: unknown, bullets: unknown[]) => void;
  onAddEducation: (edu: unknown) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [exp, setExp] = useState({
    company: '',
    title: '',
    start_date: '',
    end_date: '',
    description: '',
    bullets: '',
  });
  const [edu, setEdu] = useState({ institution: '', degree: '', field: '', end_date: '' });

  void profileId;

  return (
    <section className="flex flex-col gap-6">
      <div className="rounded-md border border-border p-4">
        <h2 className="text-sm font-medium">Experiences ({existing.length})</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {existing.map((e) => (
            <li key={e.id} className="rounded border border-border p-2">
              <div className="font-medium">
                {e.title} — {e.company}
              </div>
              <div className="text-xs text-muted-foreground">
                {e.start_date} → {e.end_date ?? 'present'} · {e.bullets.length} bullets
              </div>
            </li>
          ))}
          {existing.length === 0 && (
            <li className="text-muted-foreground">None yet.</li>
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
            onAdd(payload, bulletsParsed);
            setExp({ company: '', title: '', start_date: '', end_date: '', description: '', bullets: '' });
          });
        }}
        className="grid grid-cols-1 gap-3 rounded-md border border-border p-4 sm:grid-cols-2"
      >
        <h3 className="sm:col-span-2 text-sm font-medium">Add experience</h3>
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
          <button type="submit" disabled={pending} className="btn-primary">
            Add experience
          </button>
        </div>
      </form>

      <div className="rounded-md border border-border p-4">
        <h2 className="text-sm font-medium">Education ({education.length})</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {education.map((e) => (
            <li key={e.id}>
              <strong>{e.institution}</strong>
              {e.degree && ` — ${e.degree}`}
              {e.field && `, ${e.field}`}
            </li>
          ))}
          {education.length === 0 && <li className="text-muted-foreground">None yet.</li>}
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
            onAddEducation(payload);
            setEdu({ institution: '', degree: '', field: '', end_date: '' });
          });
        }}
        className="grid grid-cols-1 gap-3 rounded-md border border-border p-4 sm:grid-cols-2"
      >
        <h3 className="sm:col-span-2 text-sm font-medium">Add education</h3>
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
          <button type="submit" disabled={pending} className="btn-primary">
            Add education
          </button>
        </div>
      </form>
    </section>
  );
}

// ---------- Projects ----------
function ProjectsTab({
  profileId,
  existing,
  onAdd,
}: {
  profileId: string;
  existing: Project[];
  onAdd: (input: unknown) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [p, setP] = useState({ name: '', role: '', description: '', url: '' });
  void profileId;
  return (
    <section className="flex flex-col gap-6">
      <div className="rounded-md border border-border p-4">
        <h2 className="text-sm font-medium">Projects ({existing.length})</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {existing.map((pr) => (
            <li key={pr.id}>
              <strong>{pr.name}</strong>
              {pr.role && ` — ${pr.role}`}
            </li>
          ))}
          {existing.length === 0 && <li className="text-muted-foreground">None yet.</li>}
        </ul>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const payload = {
            name: p.name.trim(),
            role: p.role.trim() || null,
            description: p.description.trim() || null,
            url: p.url.trim() || null,
            ord: 0,
          };
          startTransition(() => {
            onAdd(payload);
            setP({ name: '', role: '', description: '', url: '' });
          });
        }}
        className="grid grid-cols-1 gap-3 rounded-md border border-border p-4 sm:grid-cols-2"
      >
        <h3 className="sm:col-span-2 text-sm font-medium">Add project</h3>
        <Field label="Name" required>
          <input
            required
            value={p.name}
            onChange={(e) => setP({ ...p, name: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="Role">
          <input
            value={p.role}
            onChange={(e) => setP({ ...p, role: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="URL">
          <input
            value={p.url}
            onChange={(e) => setP({ ...p, url: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="Description" className="sm:col-span-2">
          <textarea
            rows={3}
            value={p.description}
            onChange={(e) => setP({ ...p, description: e.target.value })}
            className="input"
          />
        </Field>
        <div className="sm:col-span-2">
          <button type="submit" disabled={pending} className="btn-primary">
            Add project
          </button>
        </div>
      </form>
    </section>
  );
}

// ---------- Skills ----------
function SkillsTab({
  existing,
  onAdd,
  onRemove,
}: {
  existing: Skill[];
  onAdd: (input: unknown) => void;
  onRemove: (id: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Skill['category']>('language');
  return (
    <section className="flex flex-col gap-4">
      <ul className="flex flex-wrap gap-2 text-xs">
        {existing.map((s) => (
          <li key={s.id} className="flex items-center gap-1 rounded-full border border-border px-2 py-1">
            <span>
              {s.name} <span className="text-muted-foreground">({s.category})</span>
            </span>
            <button
              type="button"
              onClick={() => onRemove(s.id)}
              className="text-red-600"
              aria-label={`Remove ${s.name}`}
            >
              ×
            </button>
          </li>
        ))}
        {existing.length === 0 && <li className="text-muted-foreground">None yet.</li>}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(() => {
            onAdd({ name: name.trim(), category });
            setName('');
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
            onChange={(e) => setCategory(e.target.value as Skill['category'])}
            className="input"
          >
            {(
              [
                'language',
                'framework',
                'tool',
                'domain',
                'soft',
                'certification',
                'database',
                'cloud',
              ] as Skill['category'][]
            ).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <button type="submit" disabled={pending} className="btn-primary">
          Add skill
        </button>
      </form>
    </section>
  );
}

// ---------- Stories ----------
function StoriesTab({
  profileId,
  existing,
  onAdd,
}: {
  profileId: string;
  existing: Story[];
  onAdd: (input: unknown) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [s, setS] = useState({
    dimensions: ['leadership'] as Story['dimensions'],
    title: '',
    situation: '',
    task: '',
    action: '',
    result: '',
  });
  void profileId;
  return (
    <section className="flex flex-col gap-4">
      <div className="rounded-md border border-border p-4">
        <h2 className="text-sm font-medium">Stories ({existing.length})</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {existing.map((x) => (
            <li key={x.id}>
              <strong>{x.title}</strong>{' '}
              <span className="text-xs text-muted-foreground">
                ({x.dimensions.join(', ')})
              </span>
            </li>
          ))}
          {existing.length === 0 && <li className="text-muted-foreground">None yet.</li>}
        </ul>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const payload = {
            dimensions: s.dimensions,
            title: s.title.trim(),
            situation: s.situation.trim(),
            task: s.task.trim(),
            action: s.action.trim(),
            result: s.result.trim(),
          };
          startTransition(() => {
            onAdd(payload);
            setS({
              dimensions: ['leadership'],
              title: '',
              situation: '',
              task: '',
              action: '',
              result: '',
            });
          });
        }}
        className="flex flex-col gap-3 rounded-md border border-border p-4"
      >
        <h3 className="text-sm font-medium">Add story</h3>
        <Field label="Title" required>
          <input
            required
            value={s.title}
            onChange={(e) => setS({ ...s, title: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="Situation" required>
          <textarea
            required
            rows={2}
            value={s.situation}
            onChange={(e) => setS({ ...s, situation: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="Task" required>
          <textarea
            required
            rows={2}
            value={s.task}
            onChange={(e) => setS({ ...s, task: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="Action" required>
          <textarea
            required
            rows={3}
            value={s.action}
            onChange={(e) => setS({ ...s, action: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="Result" required>
          <textarea
            required
            rows={2}
            value={s.result}
            onChange={(e) => setS({ ...s, result: e.target.value })}
            className="input"
          />
        </Field>
        <button type="submit" disabled={pending} className="btn-primary self-start">
          Add story
        </button>
      </form>
    </section>
  );
}

// ---------- Preferences ----------
function PreferencesTab({
  initial,
  onSave,
}: {
  initial: Preferences;
  onSave: (input: unknown) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [salaryMin, setSalaryMin] = useState<string>(
    initial.salary_min != null ? String(initial.salary_min) : '',
  );
  const [salaryMax, setSalaryMax] = useState<string>(
    initial.salary_max != null ? String(initial.salary_max) : '',
  );
  const [currency, setCurrency] = useState(initial.salary_currency);
  const [cap, setCap] = useState<string>(String(initial.daily_app_cap));
  const [remoteAnywhere, setRemoteAnywhere] = useState(initial.remote_anywhere);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const payload = {
          experience_levels: initial.experience_levels,
          work_modes: initial.work_modes,
          job_types: initial.job_types,
          salary_min: salaryMin === '' ? null : Number(salaryMin),
          salary_max: salaryMax === '' ? null : Number(salaryMax),
          salary_currency: currency.toUpperCase(),
          locations: initial.locations,
          remote_anywhere: remoteAnywhere,
          industries_include: initial.industries_include,
          industries_exclude: initial.industries_exclude,
          company_size_min: initial.company_size_min,
          company_size_max: initial.company_size_max,
          notice_period_days: initial.notice_period_days,
          willing_to_relocate: initial.willing_to_relocate,
          daily_app_cap: Number(cap) || 30,
        };
        startTransition(() => onSave(payload));
      }}
      className="grid grid-cols-1 gap-3 sm:grid-cols-3"
    >
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
      <Field label="Daily application cap">
        <input
          type="number"
          min={1}
          value={cap}
          onChange={(e) => setCap(e.target.value)}
          className="input"
        />
      </Field>
      <label className="inline-flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          checked={remoteAnywhere}
          onChange={(e) => setRemoteAnywhere(e.target.checked)}
        />
        Anywhere remote
      </label>
      <div className="sm:col-span-3">
        <button type="submit" disabled={pending} className="btn-primary">
          Save preferences
        </button>
      </div>
      <p className="sm:col-span-3 text-xs text-muted-foreground">
        Use the onboarding wizard for bulk preference edits (experience levels, work modes, job
        types, locations, industries).
      </p>
    </form>
  );
}

// ---------- Q&A ----------
function QaTab({
  existing,
  onSave,
}: {
  existing: QuestionBankEntry[];
  onSave: (input: unknown) => void;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <section className="flex flex-col gap-3">
      {existing.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No entries yet. Complete the Q&amp;A step in onboarding first, or add one below.
        </p>
      )}
      {existing.map((q) => (
        <InlineQaEditor
          key={q.id}
          entry={q}
          onSave={(text) =>
            startTransition(() => {
              onSave({
                question_key: q.question_key,
                question_text: q.question_text,
                answer_text: text,
                word_limit: q.word_limit,
              });
            })
          }
          disabled={pending}
        />
      ))}
    </section>
  );
}

function InlineQaEditor({
  entry,
  onSave,
  disabled,
}: {
  entry: QuestionBankEntry;
  onSave: (text: string) => void;
  disabled: boolean;
}) {
  const [text, setText] = useState(entry.answer_text);
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-sm font-medium">{entry.question_text}</div>
      <textarea
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="input mt-2"
      />
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          disabled={disabled}
          className="btn-secondary"
          onClick={() => onSave(text.trim())}
        >
          Save
        </button>
      </div>
    </div>
  );
}

// ---------- field helper ----------
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
