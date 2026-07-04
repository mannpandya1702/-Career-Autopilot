import type { LlmRouter } from '../router';
import { jdParsePrompt, type JdParseInput, type ParsedJd } from '../prompts/jd-parse/v1';

export async function parseJd(
  router: LlmRouter,
  input: JdParseInput,
  context?: { userId?: string },
): Promise<ParsedJd> {
  return router.call(jdParsePrompt, input, context);
}

export type { JdParseInput, ParsedJd };
export { ParsedJdSchema } from '../prompts/jd-parse/v1';
