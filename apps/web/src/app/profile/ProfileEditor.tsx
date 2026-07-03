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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Textarea, Label, HelperText } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { IconCheck, IconAlert, IconX, IconUser } from '@/components/ui/icons';

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
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 shadow-elevation-1">
        <span className="grid size-9 place-items-center rounded-md bg-primary/10 text-primary">
          <IconUser className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {data.profile.full_name}
          </p>
          <p className="truncate font-mono text-xs text-muted-foreground">
            {data.profile.email}
          </p>
        </div>
      </div>

      {status.state === 'error' && (
        <StatusBanner
          tone="error"
          message={status.message ?? 'Something went wrong'}
        />
      )}
      {status.state === 'ok' && (
        <StatusBanner tone="success" message={status.message ?? 'Saved'} />
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="flex-wrap">
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="contact">
          <ContactTab
            profile={data.profile}
            onSave={(input) => run(() => saveProfileStep(input), 'Contact saved.')}
          />
        </TabsContent>
        <TabsContent value="experience">
          <ExperienceTab
            existing={data.experiences}
            education={data.education}
            onAdd={(exp, bullets) =>
              run(() => addExperienceAction(data.profile.id, exp, bullets), 'Experience added.')
            }
            onAddEducation={(edu) =>
              run(() => addEducationAction(data.profile.id, edu), 'Education added.')
            }
          />
        </TabsContent>
        <TabsContent value="projects">
          <ProjectsTab
            existing={data.projects}
            onAdd={(input) =>
              run(() => addProjectAction(data.profile.id, input), 'Project added.')
            }
          />
        </TabsContent>
        <TabsContent value="skills">
          <SkillsTab
            existing={data.skills}
            onAdd={(input) => run(() => upsertSkillAction(input), 'Skill saved.')}
            onRemove={(id) => run(() => deleteSkillAction(id), 'Skill removed.')}
          />
        </TabsContent>
        <TabsContent value="stories">
          <StoriesTab
            existing={data.stories}
            onAdd={(input) => run(() => addStoryAction(data.profile.id, input), 'Story added.')}
          />
        </TabsContent>
        <TabsContent value="preferences">
          <PreferencesTab
            initial={data.preferences}
            onSave={(input) => run(() => savePreferencesAction(input), 'Preferences saved.')}
          />
        </TabsContent>
        <TabsContent value="qa">
          <QaTab
            existing={data.questionBank}
            onSave={(input) => run(() => upsertQuestionAction(input), 'Answer saved.')}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatusBanner({ tone, message }: { tone: 'error' | 'success'; message: string }) {
  const styles =
    tone === 'error'
      ? 'border-destructive/30 bg-destructive/5 text-destructive'
      : 'border-success/30 bg-success/5 text-success';
  const Icon = tone === 'error' ? IconAlert : IconCheck;
  return (
    <div
      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${styles} animate-fade-in`}
      role="alert"
    >
      <Icon className="size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

/* ---------- Contact ---------- */

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
    <Card>
      <CardHeader>
        <CardTitle>Contact details</CardTitle>
        <CardDescription>How employers and application forms can reach you.</CardDescription>
      </CardHeader>
      <CardContent>
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
          className="grid gap-4 sm:grid-cols-2"
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
            <div key={key}>
              <Label htmlFor={key} required={required}>
                {label}
              </Label>
              <Input
                id={key}
                required={required}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </div>
          ))}
          <div className="sm:col-span-2">
            <Label htmlFor="summary">Summary</Label>
            <Textarea
              id="summary"
              rows={4}
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
              placeholder="One or two paragraphs. This is what tailors quote from."
            />
            <HelperText>
              Tailors will draw from this — keep it accurate and current.
            </HelperText>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" loading={pending}>
              {pending ? 'Saving' : 'Save contact'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/* ---------- Experience ---------- */

function ExperienceTab({
  existing,
  education,
  onAdd,
  onAddEducation,
}: {
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

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Experience</CardTitle>
            <Badge variant="neutral">{existing.length}</Badge>
          </div>
          <CardDescription>Roles the tailor is allowed to quote from.</CardDescription>
        </CardHeader>
        <CardContent>
          {existing.length === 0 ? (
            <p className="text-sm text-muted-foreground">None yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {existing.map((e) => (
                <li
                  key={e.id}
                  className="rounded-md border border-border bg-surface-elevated p-3"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-medium text-foreground">{e.title}</p>
                    <p className="shrink-0 font-mono text-2xs text-muted-foreground">
                      {e.start_date} → {e.end_date ?? 'present'}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">{e.company}</p>
                  <p className="mt-1 text-2xs text-muted-foreground">
                    {e.bullets.length} bullet{e.bullets.length === 1 ? '' : 's'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add experience</CardTitle>
          <CardDescription>Bullet lines: one per row.</CardDescription>
        </CardHeader>
        <CardContent>
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
            className="grid gap-3 sm:grid-cols-2"
          >
            <div>
              <Label required>Company</Label>
              <Input
                required
                value={exp.company}
                onChange={(e) => setExp({ ...exp, company: e.target.value })}
              />
            </div>
            <div>
              <Label required>Title</Label>
              <Input
                required
                value={exp.title}
                onChange={(e) => setExp({ ...exp, title: e.target.value })}
              />
            </div>
            <div>
              <Label required>Start date</Label>
              <Input
                required
                type="date"
                value={exp.start_date}
                onChange={(e) => setExp({ ...exp, start_date: e.target.value })}
              />
            </div>
            <div>
              <Label>End date (blank = current)</Label>
              <Input
                type="date"
                value={exp.end_date}
                onChange={(e) => setExp({ ...exp, end_date: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Description</Label>
              <Textarea
                rows={2}
                value={exp.description}
                onChange={(e) => setExp({ ...exp, description: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Bullets (one per line)</Label>
              <Textarea
                rows={5}
                value={exp.bullets}
                onChange={(e) => setExp({ ...exp, bullets: e.target.value })}
                placeholder="Shipped feature X that reduced Y by 30%…"
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" loading={pending}>
                {pending ? 'Adding' : 'Add experience'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Education</CardTitle>
            <Badge variant="neutral">{education.length}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {education.length === 0 ? (
            <p className="text-sm text-muted-foreground">None yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {education.map((e) => (
                <li key={e.id} className="text-foreground/85">
                  <strong>{e.institution}</strong>
                  {e.degree && ` — ${e.degree}`}
                  {e.field && `, ${e.field}`}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add education</CardTitle>
        </CardHeader>
        <CardContent>
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
            className="grid gap-3 sm:grid-cols-2"
          >
            <div className="sm:col-span-2">
              <Label required>Institution</Label>
              <Input
                required
                value={edu.institution}
                onChange={(e) => setEdu({ ...edu, institution: e.target.value })}
              />
            </div>
            <div>
              <Label>Degree</Label>
              <Input
                value={edu.degree}
                onChange={(e) => setEdu({ ...edu, degree: e.target.value })}
              />
            </div>
            <div>
              <Label>Field</Label>
              <Input
                value={edu.field}
                onChange={(e) => setEdu({ ...edu, field: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>End date</Label>
              <Input
                type="date"
                value={edu.end_date}
                onChange={(e) => setEdu({ ...edu, end_date: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" loading={pending}>
                Add education
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- Projects ---------- */

function ProjectsTab({
  existing,
  onAdd,
}: {
  existing: Project[];
  onAdd: (input: unknown) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [p, setP] = useState({ name: '', role: '', description: '', url: '' });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Projects</CardTitle>
            <Badge variant="neutral">{existing.length}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {existing.length === 0 ? (
            <p className="text-sm text-muted-foreground">None yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {existing.map((pr) => (
                <li key={pr.id}>
                  <strong className="text-foreground">{pr.name}</strong>
                  {pr.role ? (
                    <span className="text-muted-foreground"> — {pr.role}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Add project</CardTitle>
        </CardHeader>
        <CardContent>
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
            className="grid gap-3 sm:grid-cols-2"
          >
            <div>
              <Label required>Name</Label>
              <Input
                required
                value={p.name}
                onChange={(e) => setP({ ...p, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Role</Label>
              <Input
                value={p.role}
                onChange={(e) => setP({ ...p, role: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>URL</Label>
              <Input
                value={p.url}
                onChange={(e) => setP({ ...p, url: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={p.description}
                onChange={(e) => setP({ ...p, description: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" loading={pending}>
                Add project
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- Skills ---------- */

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
    <Card>
      <CardHeader>
        <CardTitle>Skills</CardTitle>
        <CardDescription>These are the only skills the tailor is allowed to claim.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {existing.length === 0 ? (
          <EmptyState
            title="No skills yet"
            description="Add at least the languages and frameworks you use daily."
          />
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {existing.map((s) => (
              <li key={s.id}>
                <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-elevated px-2 py-1 text-xs">
                  <span className="text-foreground">{s.name}</span>
                  <span className="font-mono text-2xs text-muted-foreground">({s.category})</span>
                  <button
                    type="button"
                    onClick={() => onRemove(s.id)}
                    className="ml-0.5 rounded-sm p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Remove ${s.name}`}
                  >
                    <IconX className="size-2.5" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(() => {
              onAdd({ name: name.trim(), category });
              setName('');
            });
          }}
          className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end"
        >
          <div>
            <Label required>Skill</Label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Category</Label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Skill['category'])}
              className="flex h-9 w-full rounded-md border border-input bg-surface px-3 py-1.5 text-sm text-foreground shadow-elevation-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          </div>
          <Button type="submit" loading={pending}>
            Add skill
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/* ---------- Stories ---------- */

function StoriesTab({
  existing,
  onAdd,
}: {
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
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>STAR stories</CardTitle>
            <Badge variant="neutral">{existing.length}</Badge>
          </div>
          <CardDescription>The narrative bank the cover-letter and Q&A workers draw from.</CardDescription>
        </CardHeader>
        <CardContent>
          {existing.length === 0 ? (
            <p className="text-sm text-muted-foreground">None yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {existing.map((x) => (
                <li key={x.id} className="rounded-md border border-border bg-surface-elevated p-3">
                  <p className="font-medium text-foreground">{x.title}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {x.dimensions.map((d) => (
                      <Badge key={d} variant="outline" className="text-2xs">
                        {d}
                      </Badge>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add story</CardTitle>
          <CardDescription>Situation → Task → Action → Result.</CardDescription>
        </CardHeader>
        <CardContent>
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
            className="flex flex-col gap-3"
          >
            <div>
              <Label required>Title</Label>
              <Input required value={s.title} onChange={(e) => setS({ ...s, title: e.target.value })} />
            </div>
            {(
              [
                ['situation', 'Situation', 2],
                ['task', 'Task', 2],
                ['action', 'Action', 3],
                ['result', 'Result', 2],
              ] as const
            ).map(([key, label, rows]) => (
              <div key={key}>
                <Label required>{label}</Label>
                <Textarea
                  required
                  rows={rows}
                  value={s[key]}
                  onChange={(e) => setS({ ...s, [key]: e.target.value })}
                />
              </div>
            ))}
            <Button type="submit" loading={pending} className="self-start">
              Add story
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- Preferences ---------- */

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
    <Card>
      <CardHeader>
        <CardTitle>Preferences</CardTitle>
        <CardDescription>Salary floor/ceiling, daily cap, and remote scope.</CardDescription>
      </CardHeader>
      <CardContent>
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
          className="grid gap-4 sm:grid-cols-3"
        >
          <div>
            <Label>Salary min</Label>
            <Input type="number" value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} />
          </div>
          <div>
            <Label>Salary max</Label>
            <Input type="number" value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} />
          </div>
          <div>
            <Label>Currency</Label>
            <Input
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              maxLength={3}
              className="font-mono uppercase"
            />
          </div>
          <div>
            <Label>Daily application cap</Label>
            <Input
              type="number"
              min={1}
              value={cap}
              onChange={(e) => setCap(e.target.value)}
              className="font-mono"
            />
          </div>
          <label className="col-span-full flex items-center gap-2 rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={remoteAnywhere}
              onChange={(e) => setRemoteAnywhere(e.target.checked)}
              className="size-4 accent-primary"
            />
            <span className="text-foreground">Anywhere remote</span>
          </label>
          <div className="col-span-full flex items-center justify-between">
            <p className="text-2xs text-muted-foreground">
              Use the onboarding wizard for bulk preference edits.
            </p>
            <Button type="submit" loading={pending}>
              Save preferences
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/* ---------- Q&A ---------- */

function QaTab({
  existing,
  onSave,
}: {
  existing: QuestionBankEntry[];
  onSave: (input: unknown) => void;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      {existing.length === 0 ? (
        <EmptyState
          title="No entries yet"
          description="Complete the Q&A step in onboarding first."
        />
      ) : (
        existing.map((q) => (
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
        ))
      )}
    </div>
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
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{entry.question_text}</CardTitle>
        {entry.word_limit ? (
          <CardDescription className="font-mono text-2xs">
            Word limit: {entry.word_limit}
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent>
        <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="mt-2 flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={disabled}
            onClick={() => onSave(text.trim())}
          >
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
