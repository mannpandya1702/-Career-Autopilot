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
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Textarea, Label, HelperText } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { IconCheck, IconAlert, IconArrowRight, IconX, IconFileText } from '@/components/ui/icons';

type Status = { state: 'idle' | 'saving' | 'ok' | 'error'; message?: string };

const SELECT_CLASSES =
  'flex h-9 w-full rounded-md border border-input bg-surface px-3 py-1.5 text-sm text-foreground shadow-elevation-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

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
    <div className="flex flex-col gap-5">
      <Stepper current={current} onSelect={setCurrent} />

      {status.state === 'error' ? (
        <StatusBanner tone="error" message={status.message ?? 'Something went wrong'} />
      ) : null}
      {status.state === 'ok' ? (
        <StatusBanner tone="success" message={status.message ?? 'Saved'} />
      ) : null}

      {current === 'import' ? (
        <ImportStep
          onParsed={(p) => {
            setParsed(p);
            setStatus({
              state: 'ok',
              message: 'Résumé parsed — review the extracted fields below.',
            });
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
      ) : null}

      {current === 'review' ? (
        <ReviewStep
          profileId={profileId}
          parsed={parsed}
          existing={initial.experiences}
          onAdd={async (exp, bullets) => {
            if (!profileId)
              return setStatus({ state: 'error', message: 'Profile not saved yet.' });
            setStatus({ state: 'saving' });
            const res = await addExperienceAction(profileId, exp, bullets);
            if (!res.ok) return setStatus({ state: 'error', message: res.error });
            setStatus({ state: 'ok', message: 'Experience added.' });
          }}
          onAddEducation={async (edu) => {
            if (!profileId)
              return setStatus({ state: 'error', message: 'Profile not saved yet.' });
            setStatus({ state: 'saving' });
            const res = await addEducationAction(profileId, edu);
            if (!res.ok) return setStatus({ state: 'error', message: res.error });
            setStatus({ state: 'ok', message: 'Education added.' });
          }}
          onNext={goNext}
        />
      ) : null}

      {current === 'skills' ? (
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
      ) : null}

      {current === 'preferences' ? (
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
      ) : null}

      {current === 'stories' ? (
        <StoriesStep
          profileId={profileId}
          existing={initial.stories.length}
          onAdd={async (input) => {
            if (!profileId)
              return setStatus({ state: 'error', message: 'Profile not saved yet.' });
            setStatus({ state: 'saving' });
            const res = await addStoryAction(profileId, input);
            if (!res.ok) return setStatus({ state: 'error', message: res.error });
            setStatus({ state: 'ok', message: 'Story added.' });
          }}
          onNext={goNext}
        />
      ) : null}

      {current === 'questions' ? (
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
      ) : null}
    </div>
  );
}

function Stepper({
  current,
  onSelect,
}: {
  current: WizardStep;
  onSelect: (s: WizardStep) => void;
}) {
  const currentIdx = WIZARD_STEPS.findIndex((s) => s.key === current);
  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-elevation-1">
      <ol className="flex flex-wrap items-center gap-2">
        {WIZARD_STEPS.map((step, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <li key={step.key} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSelect(step.key)}
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground shadow-elevation-1'
                    : done
                      ? 'bg-success/10 text-success hover:bg-success/15'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <span
                  className={cn(
                    'grid size-4 place-items-center rounded-full text-2xs',
                    active
                      ? 'bg-primary-foreground/20'
                      : done
                        ? 'bg-success text-success-foreground'
                        : 'bg-muted text-muted-foreground',
                  )}
                >
                  {done ? <IconCheck className="size-2.5" /> : <span>{i + 1}</span>}
                </span>
                {step.label}
              </button>
              {i < WIZARD_STEPS.length - 1 ? (
                <span className="text-muted-foreground/60">·</span>
              ) : null}
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-sm text-muted-foreground">{WIZARD_STEPS[currentIdx]?.helper}</p>
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
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-center gap-2 rounded-md border px-3 py-2 text-sm animate-fade-in',
        styles,
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

/* ---------------------- Step 1: Import ---------------------- */

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
  const [headline, setHeadline] = useState(initialProfile?.headline ?? initial.headline ?? '');
  const [summary, setSummary] = useState(initialProfile?.summary ?? parsed?.summary ?? '');

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
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconFileText className="size-4 text-primary" /> Upload résumé
          </CardTitle>
          <CardDescription>
            We extract contact info, experience, education, and skills. You review before saving.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <FileUpload label="Résumé PDF" onFile={(f) => void upload(f, 'resume_pdf')} />
            <FileUpload
              label="LinkedIn export (optional)"
              onFile={(f) => void upload(f, 'linkedin_pdf')}
            />
          </div>
          {uploading ? (
            <p className="text-xs text-muted-foreground">Parsing…</p>
          ) : null}
          {error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : null}
          {parsed ? (
            <p className="text-xs text-success">
              Parsed: {parsed.experiences.length} experiences, {parsed.skills.length} skills,{' '}
              {parsed.education.length} education entries.
              {parsed.warnings.length > 0 ? ` ${parsed.warnings.length} warnings.` : ''}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact details</CardTitle>
          <CardDescription>Review and confirm before saving.</CardDescription>
        </CardHeader>
        <CardContent>
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
            className="grid gap-3 sm:grid-cols-2"
          >
            <div>
              <Label required>Full name</Label>
              <Input required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <Label required>Email</Label>
              <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <Label>Location</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div>
              <Label>LinkedIn URL</Label>
              <Input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} />
            </div>
            <div>
              <Label>GitHub URL</Label>
              <Input value={github} onChange={(e) => setGithub(e.target.value)} />
            </div>
            <div>
              <Label>Portfolio URL</Label>
              <Input value={portfolio} onChange={(e) => setPortfolio(e.target.value)} />
            </div>
            <div>
              <Label>Headline</Label>
              <Input value={headline} onChange={(e) => setHeadline(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Summary</Label>
              <Textarea rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" loading={isPending}>
                Save and continue <IconArrowRight />
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function FileUpload({
  label,
  onFile,
}: {
  label: string;
  onFile: (f: File) => void;
}) {
  return (
    <label className="group inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-border bg-surface px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary">
      <input
        type="file"
        accept="application/pdf"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      <IconFileText className="size-4" />
      <span>{label}</span>
    </label>
  );
}

/* ---------------------- Step 2: Review ---------------------- */

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
  const [edu, setEdu] = useState({ institution: '', degree: '', field: '', end_date: '' });

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
    <div className="flex flex-col gap-4">
      {!profileId ? (
        <StatusBanner tone="error" message="Save the profile step before adding experiences." />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Extracted experiences</CardTitle>
              <Badge variant="neutral">{suggestedExp.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {suggestedExp.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                None detected. Add experiences manually.
              </p>
            ) : (
              <ul className="space-y-1 text-sm">
                {suggestedExp.map((e, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface-elevated px-2 py-1.5"
                  >
                    <span className="truncate">
                      <strong className="text-foreground">{e.title || '(no title)'}</strong>{' '}
                      <span className="text-muted-foreground">— {e.company}</span>
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => prefillExp(i)}>
                      Use
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add experience</CardTitle>
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
                  void onAdd(payload, bulletsParsed).then(() => {
                    setExp({
                      company: '',
                      title: '',
                      start_date: '',
                      end_date: '',
                      description: '',
                      bullets: '',
                    });
                  });
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
                <Label>End (blank = current)</Label>
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
                />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" loading={isPending} disabled={!profileId}>
                  Add experience
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Extracted education</CardTitle>
              <Badge variant="neutral">{suggestedEdu.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {suggestedEdu.length === 0 ? (
              <p className="text-sm text-muted-foreground">None detected.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {suggestedEdu.map((e, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface-elevated px-2 py-1.5"
                  >
                    <span className="truncate text-foreground/85">{e.institution}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setEdu({
                          institution: e.institution,
                          degree: '',
                          field: '',
                          end_date: '',
                        })
                      }
                    >
                      Use
                    </Button>
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
                  void onAddEducation(payload).then(() => {
                    setEdu({ institution: '', degree: '', field: '', end_date: '' });
                  });
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
                <Button type="submit" loading={isPending} disabled={!profileId}>
                  Add education
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border bg-surface-elevated/70 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          Existing:{' '}
          <span className="font-mono tabular-nums text-foreground">{existing.length}</span>{' '}
          experience{existing.length === 1 ? '' : 's'} in your profile.
        </p>
        <Button variant="secondary" onClick={onNext}>
          Continue <IconArrowRight />
        </Button>
      </div>
    </div>
  );
}

/* ---------------------- Step 3: Skills ---------------------- */

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
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Current skills</CardTitle>
            <Badge variant="neutral">{initial.length}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {initial.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add skills below.</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {initial.map((s) => (
                <li key={s.id}>
                  <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-elevated px-2 py-1 text-xs">
                    <span className="text-foreground">{s.name}</span>
                    <span className="font-mono text-2xs text-muted-foreground">
                      ({s.category})
                    </span>
                    <button
                      type="button"
                      onClick={() => void onRemove(s.id)}
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
        </CardContent>
      </Card>

      {suggestions.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Parsed suggestions</CardTitle>
            <CardDescription>Click one to prefill the form below.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  type="button"
                  key={s.name}
                  onClick={() => {
                    setName(s.name);
                    if (s.category_guess) setCategory(s.category_guess);
                  }}
                  className="rounded-md border border-dashed border-border bg-surface px-2 py-1 text-xs text-foreground/80 transition-colors hover:border-primary/50 hover:text-primary"
                >
                  {s.name}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Add skill</CardTitle>
        </CardHeader>
        <CardContent>
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
            className="grid gap-3 sm:grid-cols-[1fr_180px_140px_auto] sm:items-end"
          >
            <div>
              <Label required>Skill</Label>
              <Input required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Category</Label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as SkillCategory)}
                className={SELECT_CLASSES}
              >
                {SKILL_CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Proficiency (1–5)</Label>
              <Input
                type="number"
                min={1}
                max={5}
                value={proficiency}
                onChange={(e) =>
                  setProficiency(e.target.value === '' ? '' : Number(e.target.value))
                }
                className="font-mono"
              />
            </div>
            <Button type="submit" loading={isPending}>
              Add
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="secondary" onClick={onNext}>
          Continue <IconArrowRight />
        </Button>
      </div>
    </div>
  );
}

/* ---------------------- Step 4: Preferences ---------------------- */

const EXPERIENCE_LEVELS: ExperienceLevel[] = ['intern', 'entry', 'mid', 'senior', 'lead', 'principal'];
const WORK_MODES: WorkMode[] = ['remote', 'hybrid', 'onsite'];
const JOB_TYPES: JobType[] = ['full_time', 'part_time', 'contract', 'internship', 'freelance'];

function PreferencesStep({
  initial,
  onSave,
}: {
  initial: OnboardingInitialData['preferences'];
  onSave: (input: unknown) => Promise<void>;
}) {
  const [levels, setLevels] = useState<ExperienceLevel[]>(initial?.experience_levels ?? ['mid']);
  const [modes, setModes] = useState<WorkMode[]>(initial?.work_modes ?? ['remote', 'hybrid']);
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
    <Card>
      <CardHeader>
        <CardTitle>Targeting rules</CardTitle>
        <CardDescription>Sets what the fit scorer counts as in-bounds.</CardDescription>
      </CardHeader>
      <CardContent>
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
          className="flex flex-col gap-5"
        >
          <ChipGroup
            label="Experience levels"
            options={EXPERIENCE_LEVELS}
            value={levels}
            onChange={(v) => setLevels(toggle(levels, v))}
          />
          <ChipGroup
            label="Work modes"
            options={WORK_MODES}
            value={modes}
            onChange={(v) => setModes(toggle(modes, v))}
          />
          <ChipGroup
            label="Job types"
            options={JOB_TYPES}
            value={types}
            onChange={(v) => setTypes(toggle(types, v))}
          />

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Salary min</Label>
              <Input
                type="number"
                value={salaryMin}
                onChange={(e) => setSalaryMin(e.target.value)}
                className="font-mono"
              />
            </div>
            <div>
              <Label>Salary max</Label>
              <Input
                type="number"
                value={salaryMax}
                onChange={(e) => setSalaryMax(e.target.value)}
                className="font-mono"
              />
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
          </div>

          <div>
            <Label>Locations (comma-separated)</Label>
            <Input value={locations} onChange={(e) => setLocations(e.target.value)} />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Notice period (days)</Label>
              <Input
                type="number"
                value={noticeDays}
                onChange={(e) => setNoticeDays(e.target.value)}
                className="font-mono"
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
              <HelperText>Hard cap. Nothing submits above this.</HelperText>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Toggle
              checked={remoteAnywhere}
              onChange={setRemoteAnywhere}
              label="Anywhere remote"
            />
            <Toggle checked={relocate} onChange={setRelocate} label="Willing to relocate" />
          </div>

          <div>
            <Button type="submit" loading={isPending}>
              Save preferences <IconArrowRight />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="inline-flex flex-1 cursor-pointer items-center gap-2 rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-primary"
      />
      <span className="text-foreground">{label}</span>
    </label>
  );
}

/* ---------------------- Step 5: Stories ---------------------- */

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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>STAR stories</CardTitle>
            <CardDescription>
              Aim for 6–8 across dimensions. You have {existing} so far.
            </CardDescription>
          </div>
          <Badge variant={existing >= 6 ? 'success' : 'neutral'}>{existing} / 6+</Badge>
        </div>
      </CardHeader>
      <CardContent>
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
          className="flex flex-col gap-4"
        >
          <div>
            <Label>Dimensions</Label>
            <div className="flex flex-wrap gap-1.5">
              {STORY_PROMPTS.map((p) => {
                const active = dims.includes(p.key);
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => toggleDim(p.key)}
                    className={cn(
                      'rounded-md border px-2 py-1 text-xs font-medium transition-colors',
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <Label required>Title</Label>
            <Input required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          {(
            [
              ['Situation', situation, setSituation, 2, true],
              ['Task', task, setTask, 2, true],
              ['Action', action, setAction, 3, true],
              ['Result', result, setResult, 2, true],
              ['Reflection (optional)', reflection, setReflection, 2, false],
            ] as const
          ).map(([label, val, set, rows, req]) => (
            <div key={label}>
              <Label required={req}>{label}</Label>
              <Textarea rows={rows} value={val} onChange={(e) => set(e.target.value)} />
            </div>
          ))}
          <div className="flex items-center justify-between">
            <Button
              type="submit"
              loading={isPending}
              disabled={!profileId || dims.length === 0}
            >
              Add story
            </Button>
            <Button type="button" variant="secondary" onClick={onNext}>
              Continue <IconArrowRight />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/* ---------------------- Step 6: Q&A ---------------------- */

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
    <div className="flex flex-col gap-3">
      {SEED_QUESTIONS.map((q) => (
        <Card key={q.key}>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <CardTitle className="text-sm">{q.text}</CardTitle>
              {q.word_limit ? (
                <Badge variant="outline" className="font-mono">
                  ≤{q.word_limit} words
                </Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              rows={3}
              value={drafts[q.key] ?? ''}
              onChange={(e) => setDrafts({ ...drafts, [q.key]: e.target.value })}
            />
            <div className="mt-2 flex justify-end">
              <Button type="button" size="sm" variant="secondary" onClick={() => saveOne(q)}>
                Save
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-end pt-2">
        <Button
          type="button"
          loading={isPending}
          onClick={() => {
            startTransition(() => {
              void onComplete();
            });
          }}
        >
          <IconCheck /> Mark onboarding complete
        </Button>
      </div>
    </div>
  );
}

/* ---------------------- helpers ---------------------- */

function ChipGroup<T extends string>({
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
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = value.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={cn(
                'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
              )}
            >
              {opt.replace(/_/g, ' ')}
            </button>
          );
        })}
      </div>
    </div>
  );
}
