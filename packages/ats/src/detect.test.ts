import { describe, expect, it } from 'vitest';
import { detect, detectFromHtml, detectFromUrl } from './detect';

describe('detectFromUrl', () => {
  const cases: { url: string; ats: string; slug?: string }[] = [
    { url: 'https://boards.greenhouse.io/airbnb/jobs/12345', ats: 'greenhouse', slug: 'airbnb' },
    { url: 'https://boards-api.greenhouse.io/v1/boards/stripe/jobs', ats: 'greenhouse', slug: 'stripe' },
    { url: 'https://job-boards.greenhouse.io/linear', ats: 'greenhouse', slug: 'linear' },

    { url: 'https://jobs.lever.co/leverdemo', ats: 'lever', slug: 'leverdemo' },
    { url: 'https://jobs.eu.lever.co/deliveroo/abc123', ats: 'lever', slug: 'deliveroo' },
    { url: 'https://api.lever.co/v0/postings/leverdemo', ats: 'lever', slug: 'leverdemo' },

    { url: 'https://jobs.ashbyhq.com/Notion', ats: 'ashby', slug: 'Notion' },
    { url: 'https://api.ashbyhq.com/posting-api/job-board/linear', ats: 'ashby', slug: 'linear' },

    { url: 'https://apply.workable.com/shopify/', ats: 'workable', slug: 'shopify' },
    { url: 'https://apply.workable.com/api/v1/widget/accounts/shopify', ats: 'workable', slug: 'shopify' },

    { url: 'https://jobs.smartrecruiters.com/Bosch', ats: 'smartrecruiters', slug: 'Bosch' },
  ];

  for (const c of cases) {
    it(`detects ${c.ats} from ${c.url}`, () => {
      const d = detectFromUrl(c.url);
      expect(d?.ats).toBe(c.ats);
      if (c.slug) expect(d?.slug).toBe(c.slug);
    });
  }

  it('returns null for unknown URLs', () => {
    expect(detectFromUrl('https://example.com/careers')).toBeNull();
  });
});

describe('detectFromHtml', () => {
  it('finds a Greenhouse embed marker', () => {
    const html = '<div id="grnhse_app" data-for="airbnb"></div>';
    expect(detectFromHtml(html)?.ats).toBe('greenhouse');
  });
  it('finds a Lever embed script', () => {
    const html = '<script src="https://jobs.lever.co/leverdemo/embed"></script>';
    expect(detectFromHtml(html)?.ats).toBe('lever');
  });
  it('finds an Ashby embed div', () => {
    const html = '<div id="ashby_embed_iframe" data-organization="Notion"></div>';
    const d = detectFromHtml(html);
    expect(d?.ats).toBe('ashby');
    expect(d?.slug).toBe('Notion');
  });
  it('finds a Workable embed script', () => {
    const html = '<script src="https://apply.workable.com/embed.js" data-account="shopify"></script>';
    expect(detectFromHtml(html)?.ats).toBe('workable');
  });
});

describe('detect (combined)', () => {
  it('prefers URL over HTML', () => {
    expect(detect({ url: 'https://boards.greenhouse.io/airbnb' }).ats).toBe('greenhouse');
  });
  it('falls back to HTML when URL is unknown', () => {
    expect(
      detect({
        url: 'https://example.com/careers',
        html: '<script src="https://apply.workable.com/embed.js" data-account="x"></script>',
      }).ats,
    ).toBe('workable');
  });
  it('returns custom when nothing matches', () => {
    expect(detect({ url: 'https://example.com/jobs', html: '<html></html>' }).ats).toBe('custom');
  });
});
