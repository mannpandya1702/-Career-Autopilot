'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { TailoredResume } from '@career-autopilot/resume';
import type { JobWithCompany } from '@/lib/jobs/queries';
import type { LoadedTailoredResume } from '@/lib/jobs/tailored';
import type { LoadedVerification } from '@/lib/jobs/verifications';
import type { LoadedCoverLetter } from '@/lib/jobs/cover-letter';
import type { LoadedQaAnswer } from '@/lib/jobs/qa';

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
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-4 px-6 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{job.title}</h1>
          <p className="text-sm text-muted-foreground">
            {job.company?.name}
            {job.location && ` · ${job.location}`}
            {job.remote_policy && ` · ${job.remote_policy}`}
          </p>
        </div>
        <Link href={`/jobs?status=active`} className="btn-secondary">
          Back to inbox
        </Link>
      </header>

      {verification && <VerificationPanel verification={verification} />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_1.4fr_0.9fr]">
        <JdPanel job={job} />
        <ResumePanel tailored={tailored} />
        <ApprovePanel job={job} tailored={tailored} hint={hint} setHint={setHint} />
      </div>

      <CoverLetterPanel coverLetter={coverLetter} />
      <QaPanel answers={answers} />
    </div>
  );
}

function JdPanel({ job }: { job: JobWithCompany }) {
  const gaps = job.score?.must_have_gaps ?? [];
  return (
    <section className="flex max-h-[80vh] flex-col overflow-hidden rounded-md border border-border bg-white">
      <header className="border-b border-border p-3">
        <h2 className="text-sm font-medium">Job description</h2>
        <a
          href={job.apply_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block text-xs text-blue-700 underline"
        >
          Apply page ↗
        </a>
      </header>
      {gaps.length > 0 && (
        <div className="border-b border-border bg-red-50 p-3 text-xs text-red-700">
          <div className="font-medium">Must-have gaps</div>
          <ul className="mt-1 list-disc pl-4">
            {gaps.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </div>
      )}
      <pre className="flex-1 overflow-y-auto whitespace-pre-wrap p-3 text-sm">
        {job.description}
      </pre>
    </section>
  );
}

function ResumePanel({ tailored }: { tailored: LoadedTailoredResume | null }) {
  return (
    <section className="flex max-h-[80vh] flex-col overflow-hidden rounded-md border border-border bg-white">
      <header className="border-b border-border p-3">
        <h2 className="text-sm font-medium">Tailored resume</h2>
        {tailored && (
          <p className="mt-1 text-xs text-muted-foreground">
            {tailored.llm_model} · {tailored.prompt_version} · regen {tailored.regeneration_count}
            {!tailored.honesty_check_passed && (
              <span className="ml-2 text-red-700">honesty failed</span>
            )}
          </p>
        )}
      </header>
      {tailored ? (
        <ResumePreview resume={tailored.resume} />
      ) : (
        <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
          No tailored resume yet. Click &ldquo;Tailor&rdquo; to generate.
        </div>
      )}
    </section>
  );
}

function ResumePreview({ resume }: { resume: TailoredResume }) {
  return (
    <div className="flex-1 overflow-y-auto p-4 text-sm">
      <p className="text-xs uppercase text-muted-foreground">Summary</p>
      <p className="mt-1">{resume.summary}</p>

      <h3 className="mt-4 text-xs uppercase text-muted-foreground">Experience</h3>
      {resume.experience.map((exp, i) => (
        <div key={i} className="mt-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-medium">{exp.title}</span>
            <span className="text-xs text-muted-foreground">
              {exp.start_date} – {exp.end_date}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            {exp.company}
            {exp.location && `, ${exp.location}`}
          </div>
          <ul className="mt-1 list-disc pl-5 text-sm">
            {exp.bullets.map((b, j) => (
              <li key={j}>{b}</li>
            ))}
          </ul>
        </div>
      ))}

      {resume.projects.length > 0 && (
        <>
          <h3 className="mt-4 text-xs uppercase text-muted-foreground">Projects</h3>
          {resume.projects.map((p, i) => (
            <div key={i} className="mt-2">
              <div className="font-medium">{p.name}</div>
              {p.role && <div className="text-xs text-muted-foreground">{p.role}</div>}
              <ul className="mt-1 list-disc pl-5">
                {p.bullets.map((b, j) => (
                  <li key={j}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}

      <h3 className="mt-4 text-xs uppercase text-muted-foreground">Skills</h3>
      <div className="mt-1 space-y-0.5 text-xs">
        {resume.skills.languages.length > 0 && (
          <div>
            <span className="font-medium">Languages:</span> {resume.skills.languages.join(', ')}
          </div>
        )}
        {resume.skills.frameworks.length > 0 && (
          <div>
            <span className="font-medium">Frameworks:</span> {resume.skills.frameworks.join(', ')}
          </div>
        )}
        {resume.skills.tools.length > 0 && (
          <div>
            <span className="font-medium">Tools:</span> {resume.skills.tools.join(', ')}
          </div>
        )}
        {resume.skills.domains.length > 0 && (
          <div>
            <span className="font-medium">Domains:</span> {resume.skills.domains.join(', ')}
          </div>
        )}
      </div>

      <h3 className="mt-4 text-xs uppercase text-muted-foreground">Education</h3>
      {resume.education.map((e, i) => (
        <div key={i} className="mt-1 text-sm">
          <span className="font-medium">{e.institution}</span>
          {' — '}
          {e.degree}
          {e.field && `, ${e.field}`}
          {' '}
          <span className="text-xs text-muted-foreground">({e.end_date})</span>
        </div>
      ))}
    </div>
  );
}

function ApprovePanel({
  job: _job,
  tailored,
  hint,
  setHint,
}: {
  job: JobWithCompany;
  tailored: LoadedTailoredResume | null;
  hint: string;
  setHint: (v: string) => void;
}) {
  return (
    <aside className="flex max-h-[80vh] flex-col gap-3 overflow-y-auto rounded-md border border-border bg-white p-3">
      <h2 className="text-sm font-medium">Actions</h2>

      {tailored && (
        <div className="flex flex-col gap-2 text-xs">
          {tailored.pdf_url && (
            <a
              href={`/api/tailored/${tailored.id}/pdf`}
              className="btn-secondary"
              target="_blank"
              rel="noopener noreferrer"
            >
              Download PDF
            </a>
          )}
          {tailored.docx_url && (
            <a
              href={`/api/tailored/${tailored.id}/docx`}
              className="btn-secondary"
              target="_blank"
              rel="noopener noreferrer"
            >
              Download DOCX
            </a>
          )}
        </div>
      )}

      <hr className="my-2 border-border" />

      <label className="text-xs">
        <span className="font-medium">Hint for next regeneration</span>
        <textarea
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          rows={3}
          placeholder="e.g. Emphasize the healthcare experience more."
          className="input mt-1"
        />
      </label>

      <button type="button" className="btn-secondary" disabled>
        Regenerate (Phase 5 worker — wire-up pending live keys)
      </button>
      <button type="button" className="btn-secondary" disabled>
        Edit bullets (Phase 6)
      </button>
      <button type="button" className="btn-primary" disabled>
        Approve for submission (Phase 8)
      </button>

      {tailored?.honesty_violations && tailored.honesty_violations.length > 0 && (
        <div className="mt-2 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700">
          <div className="font-medium">Honesty violations</div>
          <ul className="mt-1 list-disc pl-4">
            {tailored.honesty_violations.map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}

function VerificationPanel({ verification }: { verification: LoadedVerification }) {
  const v = verification;
  const tone = v.passed ? 'border-green-300 bg-green-50' : 'border-amber-300 bg-amber-50';
  return (
    <section className={`flex flex-col gap-3 rounded-md border ${tone} p-3 text-sm`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium">
          ATS verifier · overall {v.overall_score}/100 ·{' '}
          <span className={v.passed ? 'text-green-700' : 'text-amber-700'}>
            {v.passed ? 'passed' : 'below threshold'}
          </span>
        </h2>
        <span className="text-xs text-muted-foreground">
          {new Date(v.created_at).toLocaleString()}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <ScoreCell label="Parse agreement" score={v.parse_agreement_score} weight="40%" />
        <ScoreCell label="Keyword coverage" score={v.keyword_coverage_score} weight="50%" />
        <ScoreCell label="Format compliance" score={v.format_compliance_score} weight="10%" />
      </div>
      {v.missing_keywords && v.missing_keywords.length > 0 && (
        <div className="text-xs">
          <span className="font-medium">Missing keywords:</span>{' '}
          {v.missing_keywords.join(', ')}
        </div>
      )}
      {v.format_issues && v.format_issues.length > 0 && (
        <div className="text-xs">
          <span className="font-medium">Format issues:</span>
          <ul className="mt-1 list-disc pl-4">
            {v.format_issues.map((i, k) => (
              <li key={k}>{i}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ScoreCell({ label, score, weight }: { label: string; score: number; weight: string }) {
  const colour = score >= 80 ? 'text-green-700' : score >= 60 ? 'text-amber-700' : 'text-red-700';
  return (
    <div className="rounded border border-border bg-white p-2">
      <div className="flex items-center justify-between text-[10px] uppercase text-muted-foreground">
        <span>{label}</span>
        <span>{weight}</span>
      </div>
      <div className={`mt-0.5 text-sm font-semibold ${colour}`}>{score}</div>
    </div>
  );
}

function CoverLetterPanel({ coverLetter }: { coverLetter: LoadedCoverLetter | null }) {
  const [draft, setDraft] = useState(coverLetter?.body ?? '');
  return (
    <section className="rounded-md border border-border bg-white p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Cover letter</h2>
        {coverLetter && (
          <span className="text-xs text-muted-foreground">
            {coverLetter.llm_model} · {coverLetter.prompt_version}
            {coverLetter.word_count != null && ` · ${coverLetter.word_count} words`}
            {!coverLetter.honesty_check_passed && (
              <span className="ml-2 text-red-700">honesty failed</span>
            )}
          </span>
        )}
      </header>

      {coverLetter ? (
        <>
          <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr]">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Preview</p>
              <div className="mt-1 whitespace-pre-wrap rounded border border-border bg-slate-50 p-3 text-sm">
                {coverLetter.greeting && (
                  <p className="font-medium">{coverLetter.greeting}</p>
                )}
                <p className="mt-2">{coverLetter.body}</p>
                {coverLetter.signoff && (
                  <p className="mt-2 whitespace-pre-line">{coverLetter.signoff}</p>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Edit body</p>
              <textarea
                rows={14}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="input mt-1 font-mono text-xs"
              />
              <div className="mt-2 flex items-center gap-2">
                <button type="button" className="btn-secondary" disabled>
                  Regenerate (worker call — Phase 8 trigger)
                </button>
                <span className="text-xs text-muted-foreground">
                  Saved {new Date(coverLetter.created_at).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          No cover letter generated yet. The cover-letter worker runs after the tailor
          worker completes.
        </p>
      )}
    </section>
  );
}

function QaPanel({ answers }: { answers: LoadedQaAnswer[] }) {
  return (
    <section className="rounded-md border border-border bg-white p-4">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Q&amp;A answers ({answers.length})</h2>
        <span className="text-xs text-muted-foreground">
          Answers are prefilled by the worker; review before submission.
        </span>
      </header>
      {answers.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          No Q&amp;A answers yet. They&rsquo;re generated by the worker once the
          submitter discovers the application form.
        </p>
      ) : (
        <ul className="mt-3 space-y-3 text-sm">
          {answers.map((a) => (
            <li key={a.id} className="rounded border border-border p-3">
              <p className="font-medium">{a.question_text}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {a.question_type}
                {a.word_limit ? ` · limit ${a.word_limit} words` : ''}
                {a.confidence != null && ` · confidence ${a.confidence.toFixed(2)}`}
                {a.source && ` · source ${a.source}`}
              </p>
              <p className="mt-2 whitespace-pre-wrap">{a.answer_text}</p>
              {a.consistency_check_passed === false && (
                <div className="mt-2 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700">
                  <div className="font-medium">Inconsistent with resume</div>
                  <ul className="mt-1 list-disc pl-4">
                    {(a.consistency_violations ?? []).map((v, i) => (
                      <li key={i}>{v}</li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
