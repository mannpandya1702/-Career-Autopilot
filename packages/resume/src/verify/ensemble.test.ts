import { describe, expect, it } from 'vitest';
import type { ParserClient, ParserExtraction } from '@career-autopilot/parsers';
import { runEnsemble } from './ensemble';

function fakeParser(
  name: ParserExtraction['parser'],
  result: Partial<ParserExtraction> | Error,
  delayMs = 0,
): ParserClient {
  return {
    name,
    async parse(): Promise<ParserExtraction> {
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
      if (result instanceof Error) throw result;
      return {
        parser: name,
        name: null,
        email: null,
        phone: null,
        experience_titles: [],
        companies: [],
        skills: [],
        education: [],
        detected_sections: [],
        word_count: 0,
        has_multiple_columns: false,
        has_embedded_images: false,
        warnings: [],
        ...result,
      };
    },
  };
}

describe('runEnsemble', () => {
  it('returns successful extractions and reports failures', async () => {
    const parsers = [
      fakeParser('simple', { name: 'Ada' }),
      fakeParser('pyresparser', new Error('service down')),
      fakeParser('openresume', { name: 'Ada' }),
    ];
    const result = await runEnsemble({
      pdfBuffer: Buffer.from('fake'),
      parsers,
      timeoutMs: 100,
    });
    expect(result.successful).toHaveLength(2);
    expect(result.outcomes).toHaveLength(3);
    expect(result.outcomes.find((o) => o.parser === 'pyresparser')?.ok).toBe(false);
  });

  it('times out a slow parser without dragging the ensemble down', async () => {
    const parsers = [
      fakeParser('simple', { name: 'Ada' }),
      fakeParser('pyresparser', { name: 'Ada' }, 500),
    ];
    const result = await runEnsemble({
      pdfBuffer: Buffer.from('fake'),
      parsers,
      timeoutMs: 50,
    });
    expect(result.successful).toHaveLength(1);
    const slow = result.outcomes.find((o) => o.parser === 'pyresparser');
    expect(slow?.ok).toBe(false);
    expect(slow?.error).toMatch(/timeout/);
  });
});
