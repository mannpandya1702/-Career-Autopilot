// HTTP client for the pyresparser FastAPI service that runs on the Oracle VM.
// Service contract (see docker-compose.yml > pyresparser-svc):
//   POST {baseUrl}/parse
//   Content-Type: multipart/form-data
//   Body: pdf=<binary>
//
//   200 OK
//   {
//     "name": string | null,
//     "email": string | null,
//     "phone": string | null,
//     "experience_titles": string[],
//     "companies": string[],
//     "skills": string[],
//     "education": string[],
//     "detected_sections": string[],
//     "word_count": number,
//     "has_multiple_columns": boolean,
//     "has_embedded_images": boolean,
//     "warnings": string[]
//   }
//
// The service is implemented by a small FastAPI shim that wraps the
// pyresparser library (Python 3.11). When the service is unreachable
// the ensemble degrades gracefully via offlineExtraction().

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

export interface PyresparserClientOptions {
  baseUrl: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export function createPyresparserClient(opts: PyresparserClientOptions): ParserClient {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 20_000;
  return {
    name: 'pyresparser',
    async parse(pdfBuffer: Buffer): Promise<ParserExtraction> {
      const url = `${opts.baseUrl.replace(/\/+$/, '')}/parse`;
      const form = new FormData();
      // FormData accepts a Blob — wrap the buffer.
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
          throw new ParserHttpError(`pyresparser ${res.status}`, res.status, url);
        }
        const body = (await res.json()) as unknown;
        const parsed = ResponseSchema.safeParse(body);
        if (!parsed.success) {
          throw new ParserHttpError(
            `pyresparser shape mismatch: ${parsed.error.issues
              .slice(0, 3)
              .map((i) => i.path.join('.'))
              .join(', ')}`,
            200,
            url,
          );
        }
        return { parser: 'pyresparser', ...parsed.data };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
