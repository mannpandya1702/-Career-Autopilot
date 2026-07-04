// HTTP client for the OpenResume parser service. Same response contract
// as the pyresparser service for ensemble compatibility.
//
// The OpenResume parser implements the 4-step algorithm from
// open-resume.com (lines → sections → feature-scoring → extraction).
// We ship it as a small Node service running alongside the worker stack
// because porting it 1:1 into shared code is heavier than running a
// dedicated service.

import { z } from 'zod';
import { ParserHttpError, type ParserClient, type ParserExtraction } from './types';

const ResponseSchema = z.object({
  name: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  experience_titles: z.array(z.string()),
  companies: z.array(z.string()),
  skills: z.array(z.string()),
  education: z.array(z.string()),
  detected_sections: z.array(z.string()),
  word_count: z.number().int().nonnegative(),
  has_multiple_columns: z.boolean(),
  has_embedded_images: z.boolean(),
  warnings: z.array(z.string()),
});

export interface OpenResumeClientOptions {
  baseUrl: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export function createOpenResumeClient(opts: OpenResumeClientOptions): ParserClient {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 20_000;
  return {
    name: 'openresume',
    async parse(pdfBuffer: Buffer): Promise<ParserExtraction> {
      const url = `${opts.baseUrl.replace(/\/+$/, '')}/parse`;
      const form = new FormData();
      form.append(
        'pdf',
        new Blob([new Uint8Array(pdfBuffer)], { type: 'application/pdf' }),
        'resume.pdf',
      );

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetchImpl(url, {
          method: 'POST',
          body: form,
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new ParserHttpError(`openresume ${res.status}`, res.status, url);
        }
        const body = (await res.json()) as unknown;
        const parsed = ResponseSchema.safeParse(body);
        if (!parsed.success) {
          throw new ParserHttpError(
            `openresume shape mismatch: ${parsed.error.issues
              .slice(0, 3)
              .map((i) => i.path.join('.'))
              .join(', ')}`,
            200,
            url,
          );
        }
        return { parser: 'openresume', ...parsed.data };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
