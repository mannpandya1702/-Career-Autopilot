'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { TailoredResume } from '@career-autopilot/resume';
import type { JobWithCompany } from '@/lib/jobs/queries';
import type { LoadedTailoredResume } from '@/lib/jobs/tailored';

export function ReviewWorkspace({
  job,
  tailored,
}: {
  job: JobWithCompany;
  tailored: LoadedTailoredResume | null;
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_1.4fr_0.9fr]">
        <JdPanel job={job} />
        <ResumePanel tailored={tailored} />
        <ApprovePanel job={job} tailored={tailored} hint={hint} setHint={setHint} />
      </div>
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
