// Internal normalised shape that every ATS adapter produces. The crawler
// upserts into public.jobs using this exact shape — see docs/integrations.md
// for vendor-specific mappings.

import type { WorkMode } from '@career-autopilot/db';

export type AtsType = 'greenhouse' | 'lever' | 'ashby' | 'workable' | 'smartrecruiters' | 'custom';

export interface NormalisedJob {
  // Vendor's stable identifier, unique within the company.
  external_id: string;
  title: string;
  // Lowercased, punctuation-stripped title for dedup/trigram matching.
  normalized_title: string;
  location: string | null;
  remote_policy: WorkMode | null;
  description: string;
  // sha256 of description — cheap change detection.
  description_hash: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  apply_url: string;
  posted_at: string | null; // ISO timestamp
  raw_payload: unknown;
}

export interface AdapterInput {
  ats_slug: string;
  // Optional override — Lever has an EU instance at api.eu.lever.co.
  region?: 'us' | 'eu';
  // Injected for testability; defaults to the native fetch.
  fetchImpl?: typeof fetch;
}

export interface AdapterResult {
  jobs: NormalisedJob[];
  vendor_job_count: number;
}

export interface Adapter {
  readonly ats: AtsType;
  list(input: AdapterInput): Promise<AdapterResult>;
}

// Utility: normalise a title for dedup/trigram matching.
// Lowercases, strips punctuation, collapses whitespace, drops common noise words.
export function normaliseTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w))
    .join(' ')
    .trim();
}

const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'of',
  'for',
  'and',
  'or',
  'to',
  'at',
  'in',
  'on',
  'ii',
  'iii',
  'iv',
]);

// SHA-256 hex using Web Crypto (available in Node 18+ and all edge runtimes).
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export class AdapterHttpError extends Error {
  readonly status: number;
  readonly url: string;
  constructor(message: string, status: number, url: string) {
    super(message);
    this.name = 'AdapterHttpError';
    this.status = status;
    this.url = url;
  }
}

export class AdapterShapeError extends Error {
  readonly url: string;
  constructor(message: string, url: string) {
    super(message);
    this.name = 'AdapterShapeError';
    this.url = url;
  }
}
