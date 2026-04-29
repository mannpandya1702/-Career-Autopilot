// Ensemble runner: invoke every available parser in parallel with a per-parser
// timeout, return the array of successful extractions. Parsers that fail or
// time out are reported as warnings; the scorer normalises against the number
// of parsers that succeeded so the score doesn't collapse when one is offline.

import type { ParserClient, ParserExtraction } from '@career-autopilot/parsers';

export interface EnsembleInput {
  pdfBuffer: Buffer;
  parsers: ParserClient[];
  timeoutMs?: number;
}

export interface ParserOutcome {
  parser: ParserExtraction['parser'];
  ok: boolean;
  extraction?: ParserExtraction;
  error?: string;
  duration_ms: number;
}

export interface EnsembleResult {
  outcomes: ParserOutcome[];
  successful: ParserExtraction[];
}

export async function runEnsemble(input: EnsembleInput): Promise<EnsembleResult> {
  const timeoutMs = input.timeoutMs ?? 20_000;
  const outcomes = await Promise.all(
    input.parsers.map((p) => runOne(p, input.pdfBuffer, timeoutMs)),
  );
  const successful = outcomes
    .filter((o): o is ParserOutcome & { extraction: ParserExtraction } => o.ok && !!o.extraction)
    .map((o) => o.extraction);
  return { outcomes, successful };
}

async function runOne(
  parser: ParserClient,
  pdfBuffer: Buffer,
  timeoutMs: number,
): Promise<ParserOutcome> {
  const started = Date.now();
  try {
    const extraction = await withTimeout(parser.parse(pdfBuffer), timeoutMs, parser.name);
    return {
      parser: parser.name,
      ok: true,
      extraction,
      duration_ms: Date.now() - started,
    };
  } catch (err) {
    return {
      parser: parser.name,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      duration_ms: Date.now() - started,
    };
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}
