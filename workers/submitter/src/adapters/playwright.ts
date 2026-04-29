// Generic Playwright adapter — drives the apply page in a fresh browser
// context and fills the standard fields. The real Playwright runtime is
// pinned at the workspace root (CLAUDE.md §3); we keep the adapter
// interface here and inject the runtime so tests + CI environments
// without browsers can stub it.
//
// Failure modes (CLAUDE.md §8.5 + docs/integrations.md):
//   - Captcha / SSO / unknown URL state → manual review.
//   - Required selector missing → manual review.
//   - ENABLE_AUTO_SUBMIT=false → bail before clicking submit.

import type {
  SubmissionInput,
  SubmissionOptions,
  SubmitAdapter,
  SubmitResult,
} from '../types';

// Minimal subset of Playwright's API we lean on. The real implementation
// imports from 'playwright' (pinned 1.49.0). Tests inject a stub that
// implements only what the adapter calls.
export interface PwBrowser {
  newContext(): Promise<PwContext>;
  close(): Promise<void>;
}
export interface PwContext {
  newPage(): Promise<PwPage>;
  close(): Promise<void>;
}
export interface PwPage {
  goto(url: string, options?: { timeout?: number; waitUntil?: 'load' | 'networkidle' }): Promise<void>;
  fill(selector: string, value: string): Promise<void>;
  setInputFiles(selector: string, files: { name: string; mimeType: string; buffer: Buffer }): Promise<void>;
  click(selector: string, options?: { timeout?: number }): Promise<void>;
  screenshot(options?: { fullPage?: boolean }): Promise<Buffer>;
  waitForLoadState(state?: 'load' | 'networkidle', options?: { timeout?: number }): Promise<void>;
  url(): string;
  // True when the selector exists in the DOM within the timeout.
  isVisible(selector: string, options?: { timeout?: number }): Promise<boolean>;
}

export interface BrowserFactory {
  launch(): Promise<PwBrowser>;
}

const STANDARD_SELECTORS = {
  resume: 'input[type="file"][accept*="pdf"], input[name="resume"], input[name="resumeFile"]',
  name: 'input[name="name"], input[name="full_name"], input[id*="name"]',
  firstName: 'input[name="first_name"], input[name="firstName"], input[id*="first"]',
  lastName: 'input[name="last_name"], input[name="lastName"], input[id*="last"]',
  email: 'input[type="email"], input[name="email"], input[id*="email"]',
  phone: 'input[type="tel"], input[name="phone"], input[id*="phone"]',
  coverLetter: 'textarea[name*="cover"], textarea[id*="cover"]',
  submit: 'button[type="submit"], button[id*="submit"], input[type="submit"]',
  captcha: 'iframe[src*="recaptcha"], iframe[src*="hcaptcha"], div[class*="captcha"]',
  ssoIndicator: 'a[href*="okta"], a[href*="auth0"], a[href*="accounts.google"]',
};

export interface PlaywrightAdapterOptions {
  browserFactory: BrowserFactory;
}

export function createGenericPlaywrightAdapter(
  pwOptions: PlaywrightAdapterOptions,
): SubmitAdapter {
  return {
    ats: 'custom',
    method: 'playwright',
    async submit(input: SubmissionInput, options: SubmissionOptions): Promise<SubmitResult> {
      const started = Date.now();
      const browser = await pwOptions.browserFactory.launch();
      let context: PwContext | null = null;
      const screenshots: Buffer[] = [];

      try {
        context = await browser.newContext();
        const page = await context.newPage();
        await page.goto(input.apply_url, { timeout: 30_000, waitUntil: 'networkidle' });

        // Bail immediately on captcha/SSO — we don't fight bot detection.
        if (await page.isVisible(STANDARD_SELECTORS.captcha, { timeout: 1500 })) {
          screenshots.push(await page.screenshot({ fullPage: true }));
          return manualReview(
            input,
            'captcha',
            { detected: 'captcha' },
            screenshots,
            started,
          );
        }
        if (await page.isVisible(STANDARD_SELECTORS.ssoIndicator, { timeout: 1500 })) {
          screenshots.push(await page.screenshot({ fullPage: true }));
          return manualReview(
            input,
            'sso',
            { detected: 'sso' },
            screenshots,
            started,
          );
        }

        // Resume upload first — many forms only enable other fields after.
        const resumeVisible = await page.isVisible(STANDARD_SELECTORS.resume, {
          timeout: 5000,
        });
        if (!resumeVisible) {
          screenshots.push(await page.screenshot({ fullPage: true }));
          return manualReview(
            input,
            'selector_missing',
            { missing: 'resume' },
            screenshots,
            started,
          );
        }
        await page.setInputFiles(STANDARD_SELECTORS.resume, {
          name: input.resume_filename,
          mimeType: 'application/pdf',
          buffer: input.resume_pdf,
        });

        // Name — full or first/last split.
        try {
          await page.fill(STANDARD_SELECTORS.name, input.candidate.full_name);
        } catch {
          const [first, ...rest] = input.candidate.full_name.split(/\s+/);
          await page.fill(STANDARD_SELECTORS.firstName, first ?? '');
          await page.fill(STANDARD_SELECTORS.lastName, rest.join(' '));
        }

        await page.fill(STANDARD_SELECTORS.email, input.candidate.email);
        if (input.candidate.phone) {
          try {
            await page.fill(STANDARD_SELECTORS.phone, input.candidate.phone);
          } catch {
            // phone often optional; ignore.
          }
        }
        if (input.cover_letter_text) {
          try {
            await page.fill(STANDARD_SELECTORS.coverLetter, input.cover_letter_text);
          } catch {
            // No cover letter field; ignore.
          }
        }

        // Pre-submit screenshot is always taken so the user can audit.
        screenshots.push(await page.screenshot({ fullPage: true }));

        if (!options.enable_auto_submit) {
          return manualReview(
            input,
            'auto_submit_disabled',
            { dry_run: true, url_at_pause: page.url() },
            screenshots,
            started,
          );
        }

        // Click submit, then wait for either a URL change or a known
        // confirmation indicator. Anything else → manual review.
        const beforeUrl = page.url();
        await page.click(STANDARD_SELECTORS.submit, { timeout: 10_000 });
        try {
          await page.waitForLoadState('networkidle', { timeout: 15_000 });
        } catch {
          // Fall through; we still capture state below.
        }
        const afterUrl = page.url();
        screenshots.push(await page.screenshot({ fullPage: true }));

        if (afterUrl === beforeUrl) {
          return manualReview(
            input,
            'unexpected_error',
            { reason: 'no URL change after submit click' },
            screenshots,
            started,
          );
        }

        return {
          outcome: 'succeeded',
          external_confirmation_id: null,
          attempt: {
            method: 'playwright',
            success: true,
            request_payload: { apply_url: input.apply_url, before_url: beforeUrl },
            response_payload: { after_url: afterUrl },
            duration_ms: Date.now() - started,
          },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return manualReview(
          input,
          'unexpected_error',
          { error: message },
          screenshots,
          started,
        );
      } finally {
        if (context) await context.close();
        await browser.close();
      }
    },
  };
}

function manualReview(
  input: SubmissionInput,
  reason: Exclude<
    Parameters<SubmitAdapter['submit']>[0]['ats'],
    never
  > extends infer _ ? // dummy ternary to keep TS happy
    | 'captcha'
    | 'sso'
    | 'selector_missing'
    | 'auto_submit_disabled'
    | 'unexpected_error'
    | 'unsupported_ats'
    | 'missing_credentials'
  : never,
  context: Record<string, unknown>,
  _screenshots: Buffer[],
  started: number,
): SubmitResult {
  return {
    outcome: 'manual_review',
    reason,
    context: { ...context, apply_url: input.apply_url },
    attempt: {
      method: 'playwright',
      success: false,
      request_payload: { apply_url: input.apply_url },
      response_payload: context,
      error_message: `playwright bailed: ${reason}`,
      duration_ms: Date.now() - started,
    },
  };
}
