'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { TailoredResume } from '@career-autopilot/resume';
import type { JobWithCompany } from '@/lib/jobs/queries';
import type { LoadedTailoredResume } from '@/lib/jobs/tailored';
import type { LoadedVerification } from '@/lib/jobs/verifications';
import type { LoadedCoverLetter } from '@/lib/jobs/cover-letter';
import type { LoadedQaAnswer } from '@/lib/jobs/qa';
import { PageHeader } from '@/components/app-shell';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { FitScoreRing } from '@/app/jobs/FitScoreRing';
import { cn } from '@/lib/utils';
import {
  IconArrowRight,
  IconAlert,
  IconCheck,
  IconFileText,
  IconMail,
  IconTarget,
  IconSparkles,
} from '@/components/ui/icons';

export function ReviewWorkspace({
  job,
  tailored,
  verification,
  coverLetter,
  answers,
}: {
  job: JobWithCompany;
  tailored: LoadedTailoredResume | null;
  verification: LoadedVerification | null;
  coverLetter: LoadedCoverLetter | null;
  answers: LoadedQaAnswer[];
}) {
  const [hint, setHint] = useState('');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Review workspace"
        title={job.title}
        description={[job.company?.name, job.location, job.remote_policy]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <>
            <Link href="/jobs?status=active">
              <Button variant="secondary" size="sm">
                Back to inbox
              </Button>
            </Link>
            <a href={job.apply_url} target="_blank" rel="noopener noreferrer">
              <Button size="sm">
                Apply page
                <IconArrowRight />
              </Button>
            </a>
          </>
        }
      />

      {verification ? <VerificationPanel verification={verification} /> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.3fr)_minmax(0,0.85fr)]">
        <JdPanel job={job} />
        <ResumePanel tailored={tailored} />
        <ApprovePanel tailored={tailored} hint={hint} setHint={setHint} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CoverLetterPanel coverLetter={coverLetter} />
        <QaPanel answers={answers} />
      </div>
    </div>
  );
}

/* -------------------------------- Verification -------------------------------- */

function VerificationPanel({ verification }: { verification: LoadedVerification }) {
  const v = verification;
  const tone = v.passed
    ? 'border-success/30 bg-success/5'
    : 'border-warning/30 bg-warning/5';
  return (
    <section
      className={cn('rounded-lg border p-5 shadow-elevation-1', tone)}
      aria-label="Verifier result"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <FitScoreRing score={v.overall_score} size={64} />
          <div>
            <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              ATS verifier
            </p>
            <h2 className="text-lg font-semibold tracking-tight">
              {v.overall_score}/100 —{' '}
              <span className={v.passed ? 'text-success' : 'text-warning'}>
                {v.passed ? 'passed' : 'below threshold'}
              </span>
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Ran {new Date(v.created_at).toLocaleString()}
            </p>
          </div>
        </div>
        <Badge variant={v.passed ? 'success' : 'warning'}>
          {v.passed ? <IconCheck className="size-3" /> : <IconAlert className="size-3" />}
          {v.passed ? 'Ready to submit' : 'Regenerate suggested'}
        </Badge>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <ScoreCell label="Parse agreement" score={v.parse_agreement_score} weight="40%" />
        <ScoreCell label="Keyword coverage" score={v.keyword_coverage_score} weight="50%" />
        <ScoreCell label="Format compliance" score={v.format_compliance_score} weight="10%" />
      </div>

      {(v.missing_keywords && v.missing_keywords.length > 0) ||
      (v.format_issues && v.format_issues.length > 0) ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {v.missing_keywords && v.missing_keywords.length > 0 ? (
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                Missing keywords
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {v.missing_keywords.map((k, i) => (
                  <Badge key={i} variant="destructive">
                    {k}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
          {v.format_issues && v.format_issues.length > 0 ? (
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                Format issues
              </p>
              <ul className="mt-1 space-y-1 text-xs text-foreground/80">
                {v.format_issues.map((i, k) => (
                  <li key={k} className="flex items-start gap-2">
                    <IconAlert className="mt-0.5 size-3 shrink-0 text-warning" />
                    {i}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function ScoreCell({ label, score, weight }: { label: string; score: number; weight: string }) {
  const color = score >= 80 ? 'text-success' : score >= 60 ? 'text-warning' : 'text-destructive';
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="flex items-center justify-between text-2xs uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono">{weight}</span>
      </div>
      <p className={cn('mt-1 font-mono text-2xl font-semibold tabular-nums', color)}>{score}</p>
    </div>
  );
}

/* --------------------------------- Panels --------------------------------- */

function JdPanel({ job }: { job: JobWithCompany }) {
  const gaps = job.score?.must_have_gaps ?? [];
  return (
    <Card className="flex max-h-[70vh] flex-col overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <IconFileText className="size-4 text-primary" /> Job description
            </CardTitle>
            <CardDescription>The role, as posted on {job.company?.ats_type}.</CardDescription>
          </div>
        </div>
      </CardHeader>
      {gaps.length > 0 ? (
        <div className="mx-5 mb-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
            <IconAlert className="size-3" /> Must-have gaps
          </p>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-foreground/80">
            {gaps.map((g, i) => <li key={i}>{g}</li>)}
          </ul>
        </div>
      ) : null}
      <div className="flex-1 overflow-y-auto px-5 pb-5 pt-1 text-sm leading-relaxed text-foreground/85 whitespace-pre-wrap">
        {job.description}
      </div>
    </Card>
  );
}

function ResumePanel({ tailored }: { tailored: LoadedTailoredResume | null }) {
  return (
    <Card className="flex max-h-[70vh] flex-col overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <IconTarget className="size-4 text-primary" /> Tailored résumé
            </CardTitle>
            {tailored ? (
              <CardDescription className="font-mono text-2xs">
                {tailored.llm_model} · {tailored.prompt_version} · regen{' '}
                {tailored.regeneration_count}
              </CardDescription>
            ) : (
              <CardDescription>Not tailored yet.</CardDescription>
            )}
          </div>
          {tailored ? (
            <Badge variant={tailored.honesty_check_passed ? 'success' : 'destructive'}>
              {tailored.honesty_check_passed ? <IconCheck className="size-3" /> : <IconAlert className="size-3" />}
              {tailored.honesty_check_passed ? 'Honest' : 'Honesty failed'}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      {tailored ? (
        <ResumePreview resume={tailored.resume} />
      ) : (
        <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
          No tailored résumé yet. Click <span className="mx-1 font-mono">Tailor</span> in the actions panel.
        </div>
      )}
    </Card>
  );
}

function ResumePreview({ resume }: { resume: TailoredResume }) {
  return (
    <div className="flex-1 overflow-y-auto px-5 pb-5 pt-1 text-sm">
      <Section label="Summary">
        <p className="text-foreground/85">{resume.summary}</p>
      </Section>

      <Section label="Experience">
        <div className="space-y-4">
          {resume.experience.map((exp, i) => (
            <div key={i}>
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-medium text-foreground">{exp.title}</p>
                <p className="shrink-0 font-mono text-2xs text-muted-foreground">
                  {exp.start_date} – {exp.end_date}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {exp.company}
                {exp.location ? `, ${exp.location}` : ''}
              </p>
              <ul className="mt-1.5 list-outside list-disc space-y-0.5 pl-5 text-sm text-foreground/85">
                {exp.bullets.map((b, j) => <li key={j}>{b}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {resume.projects.length > 0 ? (
        <Section label="Projects">
          <div className="space-y-3">
            {resume.projects.map((p, i) => (
              <div key={i}>
                <p className="font-medium text-foreground">{p.name}</p>
                {p.role ? <p className="text-xs text-muted-foreground">{p.role}</p> : null}
                <ul className="mt-1.5 list-outside list-disc space-y-0.5 pl-5 text-sm text-foreground/85">
                  {p.bullets.map((b, j) => <li key={j}>{b}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      <Section label="Skills">
        <dl className="space-y-1 text-xs">
          {resume.skills.languages.length > 0 ? (
            <SkillRow term="Languages" value={resume.skills.languages.join(', ')} />
          ) : null}
          {resume.skills.frameworks.length > 0 ? (
            <SkillRow term="Frameworks" value={resume.skills.frameworks.join(', ')} />
          ) : null}
          {resume.skills.tools.length > 0 ? (
            <SkillRow term="Tools" value={resume.skills.tools.join(', ')} />
          ) : null}
          {resume.skills.domains.length > 0 ? (
            <SkillRow term="Domains" value={resume.skills.domains.join(', ')} />
          ) : null}
        </dl>
      </Section>

      <Section label="Education">
        <div className="space-y-1.5 text-sm">
          {resume.education.map((e, i) => (
            <p key={i}>
              <span className="font-medium">{e.institution}</span> — {e.degree}
              {e.field ? `, ${e.field}` : ''}{' '}
              <span className="font-mono text-2xs text-muted-foreground">({e.end_date})</span>
            </p>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 first:mt-0">
      <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function SkillRow({ term, value }: { term: string; value: string }) {
  return (
    <div className="grid grid-cols-[80px_1fr] gap-2">
      <dt className="font-mono text-muted-foreground">{term}</dt>
      <dd className="text-foreground/85">{value}</dd>
    </div>
  );
}

function ApprovePanel({
  tailored,
  hint,
  setHint,
}: {
  tailored: LoadedTailoredResume | null;
  hint: string;
  setHint: (v: string) => void;
}) {
  return (
    <Card className="flex max-h-[70vh] flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <IconSparkles className="size-4 text-accent" /> Actions
        </CardTitle>
        <CardDescription>Review, regenerate, or approve.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 overflow-y-auto">
        {tailored ? (
          <div className="flex flex-col gap-2">
            {tailored.pdf_url ? (
              <a href={`/api/tailored/${tailored.id}/pdf`} target="_blank" rel="noopener noreferrer">
                <Button variant="secondary" size="sm" className="w-full">
                  <IconFileText /> Download PDF
                </Button>
              </a>
            ) : null}
            {tailored.docx_url ? (
              <a href={`/api/tailored/${tailored.id}/docx`} target="_blank" rel="noopener noreferrer">
                <Button variant="secondary" size="sm" className="w-full">
                  <IconFileText /> Download DOCX
                </Button>
              </a>
            ) : null}
          </div>
        ) : null}

        <div className="my-1 border-t border-border" />

        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground/80" htmlFor="regen-hint">
            Hint for next regeneration
          </label>
          <Textarea
            id="regen-hint"
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            rows={3}
            placeholder="e.g. Emphasize the healthcare integration work."
          />
        </div>

        <Button variant="secondary" size="sm" disabled>
          <IconSparkles /> Regenerate résumé
        </Button>
        <Button variant="secondary" size="sm" disabled>
          Edit bullets
        </Button>
        <Button size="sm" disabled>
          <IconCheck /> Approve for submission
        </Button>

        {tailored?.honesty_violations && tailored.honesty_violations.length > 0 ? (
          <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
              <IconAlert className="size-3" /> Honesty violations
            </p>
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-foreground/80">
              {tailored.honesty_violations.map((v, i) => <li key={i}>{v}</li>)}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CoverLetterPanel({ coverLetter }: { coverLetter: LoadedCoverLetter | null }) {
  const [draft, setDraft] = useState(coverLetter?.body ?? '');
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <IconMail className="size-4 text-primary" /> Cover letter
            </CardTitle>
            {coverLetter ? (
              <CardDescription className="font-mono text-2xs">
                {coverLetter.llm_model} · {coverLetter.prompt_version}
                {coverLetter.word_count != null ? ` · ${coverLetter.word_count} words` : ''}
              </CardDescription>
            ) : (
              <CardDescription>Not generated yet.</CardDescription>
            )}
          </div>
          {coverLetter ? (
            <Badge variant={coverLetter.honesty_check_passed ? 'success' : 'destructive'}>
              {coverLetter.honesty_check_passed ? 'Honest' : 'Honesty failed'}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {coverLetter ? (
          <Tabs defaultValue="preview">
            <TabsList>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="edit">Edit</TabsTrigger>
            </TabsList>
            <TabsContent value="preview">
              <div className="rounded-md border border-border bg-surface-elevated p-4 text-sm">
                {coverLetter.greeting ? (
                  <p className="font-medium">{coverLetter.greeting}</p>
                ) : null}
                <p className="mt-2 whitespace-pre-wrap text-foreground/85">{coverLetter.body}</p>
                {coverLetter.signoff ? (
                  <p className="mt-3 whitespace-pre-line text-foreground/85">{coverLetter.signoff}</p>
                ) : null}
              </div>
            </TabsContent>
            <TabsContent value="edit">
              <Textarea
                rows={14}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="font-mono text-xs"
              />
              <div className="mt-2 flex items-center justify-between">
                <Button variant="secondary" size="sm" disabled>
                  <IconSparkles /> Regenerate
                </Button>
                <span className="text-2xs text-muted-foreground">
                  Saved {new Date(coverLetter.created_at).toLocaleString()}
                </span>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <p className="text-sm text-muted-foreground">
            The cover-letter worker runs after the tailor completes.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function QaPanel({ answers }: { answers: LoadedQaAnswer[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle>Q&amp;A answers</CardTitle>
          <Badge variant="neutral">{answers.length}</Badge>
        </div>
        <CardDescription>Prefilled by the worker. Review before you submit.</CardDescription>
      </CardHeader>
      <CardContent>
        {answers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No answers yet — generated once the submitter discovers the application form.
          </p>
        ) : (
          <ul className="space-y-3 text-sm">
            {answers.map((a) => (
              <li key={a.id} className="rounded-md border border-border bg-surface-elevated p-3">
                <p className="font-medium text-foreground">{a.question_text}</p>
                <p className="mt-0.5 font-mono text-2xs text-muted-foreground">
                  {a.question_type}
                  {a.word_limit ? ` · limit ${a.word_limit}w` : ''}
                  {a.confidence != null ? ` · conf ${a.confidence.toFixed(2)}` : ''}
                  {a.source ? ` · ${a.source}` : ''}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-foreground/85">{a.answer_text}</p>
                {a.consistency_check_passed === false ? (
                  <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 p-2.5">
                    <p className="text-xs font-semibold text-destructive">
                      Inconsistent with résumé
                    </p>
                    <ul className="mt-1 list-inside list-disc space-y-0.5 text-2xs text-foreground/80">
                      {(a.consistency_violations ?? []).map((v, i) => <li key={i}>{v}</li>)}
                    </ul>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
