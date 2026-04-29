// Deterministic ATS detector — URL regex first, HTML fingerprint fallback.
// Source: docs/integrations.md §ATS detection.
// **Never** calls the LLM (CLAUDE.md §8.3 applies; this is pure string matching).

import type { AtsType } from './types.js';

export interface Detection {
  ats: AtsType;
  slug?: string;
}

// URL patterns — order matters (more specific first).
const URL_PATTERNS: { ats: AtsType; re: RegExp }[] = [
  // Greenhouse
  { ats: 'greenhouse', re: /^https?:\/\/boards-api\.greenhouse\.io\/v1\/boards\/([^/]+)/i },
  { ats: 'greenhouse', re: /^https?:\/\/boards\.greenhouse\.io\/([^/?#]+)/i },
  { ats: 'greenhouse', re: /^https?:\/\/job-boards\.greenhouse\.io\/([^/?#]+)/i },

  // Lever
  { ats: 'lever', re: /^https?:\/\/api\.(?:eu\.)?lever\.co\/v0\/postings\/([^/?#]+)/i },
  { ats: 'lever', re: /^https?:\/\/jobs\.(?:eu\.)?lever\.co\/([^/?#]+)/i },

  // Ashby
  { ats: 'ashby', re: /^https?:\/\/api\.ashbyhq\.com\/posting-api\/job-board\/([^/?#]+)/i },
  { ats: 'ashby', re: /^https?:\/\/jobs\.ashbyhq\.com\/([^/?#]+)/i },
  { ats: 'ashby', re: /^https?:\/\/([^./]+)\.ashbyhq\.com/i },

  // Workable
  { ats: 'workable', re: /^https?:\/\/apply\.workable\.com\/(?:api\/v1\/widget\/accounts\/)?([^/?#]+)/i },
  { ats: 'workable', re: /^https?:\/\/([^./]+)\.workable\.com/i },

  // SmartRecruiters
  { ats: 'smartrecruiters', re: /^https?:\/\/api\.smartrecruiters\.com\/v1\/companies\/([^/?#]+)/i },
  { ats: 'smartrecruiters', re: /^https?:\/\/jobs\.smartrecruiters\.com\/([^/?#]+)/i },
  { ats: 'smartrecruiters', re: /^https?:\/\/careers\.smartrecruiters\.com\/([^/?#]+)/i },
];

// HTML fingerprints — data attributes / script srcs on a careers page.
const HTML_PATTERNS: { ats: AtsType; re: RegExp }[] = [
  {
    ats: 'greenhouse',
    re: /boards\.greenhouse\.io\/(?:embed\/job_board\?for=|)([\w-]+)|data-for=["']([\w-]+)["']/i,
  },
  {
    ats: 'lever',
    re: /jobs\.lever\.co\/([^/"']+)\/embed|data-lever-job-id/i,
  },
  {
    ats: 'ashby',
    re: /id=["']ashby_embed_iframe["']\s+data-organization=["']([^"']+)["']|jobs\.ashbyhq\.com\/([^/"']+)\/embed\.js/i,
  },
  {
    ats: 'workable',
    re: /apply\.workable\.com\/embed\.js["'][^>]*data-account=["']([^"']+)["']/i,
  },
  {
    ats: 'smartrecruiters',
    re: /id=["']sr-careers-embed["']\s+data-customer-code=["']([^"']+)["']/i,
  },
];

export function detectFromUrl(url: string): Detection | null {
  for (const p of URL_PATTERNS) {
    const m = url.match(p.re);
    if (m) {
      const slug = m[1];
      const detection: Detection = { ats: p.ats };
      if (slug) detection.slug = slug;
      return detection;
    }
  }
  return null;
}

export function detectFromHtml(html: string): Detection | null {
  for (const p of HTML_PATTERNS) {
    const m = html.match(p.re);
    if (m) {
      // Pick the first captured group that's non-empty.
      const slug = m.slice(1).find((g) => g && g.length > 0);
      const detection: Detection = { ats: p.ats };
      if (slug) detection.slug = slug;
      return detection;
    }
  }
  return null;
}

// Preferred entry point: URL first (cheap), fall back to HTML only if caller
// already has the careers page body. Returns { ats: 'custom' } when neither
// URL nor HTML match a known vendor.
export function detect(input: { url?: string; html?: string }): Detection {
  if (input.url) {
    const fromUrl = detectFromUrl(input.url);
    if (fromUrl) return fromUrl;
  }
  if (input.html) {
    const fromHtml = detectFromHtml(input.html);
    if (fromHtml) return fromHtml;
  }
  return { ats: 'custom' };
}
