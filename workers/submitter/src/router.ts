// P8.2 — submitter router. Picks an adapter per docs/integrations.md:
//   greenhouse → ATS API (when key present); else Playwright.
//   lever      → ATS API.
//   ashby      → ATS API (when key present); else Playwright.
//   workable   → Playwright always.
//   custom     → Playwright always.
//
// LinkedIn is excluded by design (CLAUDE.md §12) — the extension handles it.

import type { AtsType } from '@career-autopilot/db';
import { ashbySubmitAdapter } from './adapters/ashby';
import { greenhouseSubmitAdapter } from './adapters/greenhouse';
import { leverSubmitAdapter } from './adapters/lever';
import { workableSubmitAdapter } from './adapters/workable';
import type { SubmitAdapter } from './types';

export interface RouterOptions {
  // The generic Playwright adapter is wired in at worker startup (it
  // depends on a browser factory, which we don't want to import at
  // module top-level for tree-shaking + Edge-runtime reasons).
  playwrightAdapter?: SubmitAdapter;
  // Per-ATS API keys. When undefined, the API adapter routes to
  // Playwright instead (greenhouse, ashby).
  hasGreenhouseKey?: boolean;
  hasAshbyKey?: boolean;
}

export function pickSubmitAdapter(
  ats: AtsType,
  options: RouterOptions = {},
): SubmitAdapter | null {
  switch (ats) {
    case 'greenhouse':
      return options.hasGreenhouseKey
        ? greenhouseSubmitAdapter
        : options.playwrightAdapter ?? null;
    case 'lever':
      return leverSubmitAdapter;
    case 'ashby':
      return options.hasAshbyKey
        ? ashbySubmitAdapter
        : options.playwrightAdapter ?? null;
    case 'workable':
      return options.playwrightAdapter ?? workableSubmitAdapter;
    case 'smartrecruiters':
      // Phase 11 — until then route to Playwright if available.
      return options.playwrightAdapter ?? null;
    case 'custom':
      return options.playwrightAdapter ?? null;
  }
}

export {
  ashbySubmitAdapter,
  greenhouseSubmitAdapter,
  leverSubmitAdapter,
  workableSubmitAdapter,
};
export { createGenericPlaywrightAdapter } from './adapters/playwright';
export type { BrowserFactory, PwBrowser, PwContext, PwPage } from './adapters/playwright';
