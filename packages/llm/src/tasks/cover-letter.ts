import type { LlmRouter } from '../router';
import {
  coverLetterPrompt,
  type CoverLetterInput,
  type CoverLetterOutput,
} from '../prompts/cover-letter/v1';

export async function generateCoverLetter(
  router: LlmRouter,
  input: CoverLetterInput,
  context?: { userId?: string },
): Promise<CoverLetterOutput> {
  return router.call(coverLetterPrompt, input, context);
}

export type { CoverLetterInput, CoverLetterOutput };
export { CoverLetterSchema } from '../prompts/cover-letter/v1';
