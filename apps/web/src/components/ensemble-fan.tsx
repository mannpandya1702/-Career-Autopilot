'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { IconCheck, IconTarget, IconFileText } from './ui/icons';

type Parser = {
  key: string;
  label: string;
  strengths: string[];
  weight: string;
  accent: 'primary' | 'accent' | 'info';
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

const PARSERS: Parser[] = [
  {
    key: 'simple',
    label: 'simple',
    strengths: ['Structured field grab', 'Section detection', 'Always-on baseline'],
    weight: '30%',
    accent: 'info',
    Icon: IconFileText,
  },
  {
    key: 'pyresparser',
    label: 'pyresparser',
    strengths: ['Skills NER', 'Company/role extraction', 'Trained on 200k+ résumés'],
    weight: '35%',
    accent: 'primary',
    Icon: IconTarget,
  },
  {
    key: 'openresume',
    label: 'openresume',
    strengths: ['Layout parsing', 'Multi-column detection', 'ATS-mirror behaviour'],
    weight: '35%',
    accent: 'accent',
    Icon: IconCheck,
  },
];

/**
 * Three résumé-parser cards stacked in the middle. On hover of the container
 * the left and right cards fan outward — replicates the 21st stacked-cards
 * interaction with CSS transforms only (no framer-motion added).
 * Respects prefers-reduced-motion via the fan-card utility (see globals.css).
 */
export function EnsembleFan() {
  return (
    <div className="ensemble-fan group relative mx-auto h-[420px] w-full max-w-[900px] cursor-default">
      {PARSERS.map((parser, idx) => (
        <FanCard key={parser.key} parser={parser} idx={idx} />
      ))}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-2xs text-muted-foreground transition-opacity duration-200 group-hover:opacity-0"
      >
        Hover to fan the ensemble open
      </div>
    </div>
  );
}

function FanCard({ parser, idx }: { parser: Parser; idx: number }) {
  const accentClass =
    parser.accent === 'primary'
      ? 'text-primary bg-primary/10 border-primary/25'
      : parser.accent === 'accent'
        ? 'text-accent bg-accent/10 border-accent/25'
        : 'text-info bg-info/10 border-info/25';

  const isCenter = idx === 1;
  const restingRotate = isCenter ? 0 : idx === 0 ? -3 : 3;
  const hoverX = isCenter ? 0 : idx === 0 ? -240 : 240;
  const hoverRotate = isCenter ? 0 : idx === 0 ? -8 : 8;
  const hoverY = isCenter ? -12 : 6;
  const zBase = isCenter ? 20 : idx === 0 ? 10 : 15;

  return (
    <div
      className="absolute left-1/2 top-6"
      style={
        {
          zIndex: zBase,
          ['--fan-rest-rotate' as string]: `${restingRotate}deg`,
          ['--fan-hover-x' as string]: `${hoverX}px`,
          ['--fan-hover-y' as string]: `${hoverY}px`,
          ['--fan-hover-rotate' as string]: `${hoverRotate}deg`,
          transitionDelay: `${idx * 50}ms`,
        } as React.CSSProperties
      }
    >
      <div className="fan-card w-[300px] rounded-2xl border border-border bg-surface p-5 shadow-elevation-2 sm:w-[320px]">
        <div className="mb-4 flex items-center justify-between">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-2xs font-semibold uppercase tracking-wider',
              accentClass,
            )}
          >
            <parser.Icon className="size-3" />
            {parser.label}
          </span>
          <span className="font-mono text-2xs text-muted-foreground">
            weight <span className="text-foreground">{parser.weight}</span>
          </span>
        </div>
        <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
          What it&apos;s good at
        </p>
        <ul className="mt-2 space-y-1.5 text-sm text-foreground/85">
          {parser.strengths.map((s) => (
            <li key={s} className="flex items-start gap-2">
              <span className="mt-1 inline-block size-1.5 shrink-0 rounded-full bg-primary" />
              {s}
            </li>
          ))}
        </ul>
        <div className="mt-4 rounded-md border border-border/70 bg-surface-elevated/60 p-2.5">
          <p className="font-mono text-2xs uppercase text-muted-foreground">
            Sample verdict
          </p>
          <p className="mt-1 font-mono text-xs text-foreground/85">
            <span className="text-success">parse_agreement</span>{' '}
            <span className="tabular-nums">0.87</span>
          </p>
        </div>
      </div>
    </div>
  );
}
