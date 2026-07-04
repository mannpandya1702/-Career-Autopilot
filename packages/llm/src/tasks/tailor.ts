import type { LlmRouter } from '../router';
import {
  tailorPrompt,
  tailorHardPrompt,
  type TailorInput,
  type TailorOutput,
} from '../prompts/tailor/v1';

export async function tailorResume(
  router: LlmRouter,
  input: TailorInput,
  context?: { userId?: string },
): Promise<TailorOutput> {
  return router.call(tailorPrompt, input, context);
}

// Sonnet escalation path. Same prompt, different model.
export async function tailorResumeHard(
  router: LlmRouter,
  input: TailorInput,
  context?: { userId?: string },
): Promise<TailorOutput> {
  return router.call(tailorHardPrompt, input, context);
}

export type { TailorInput, TailorOutput };
export { TailorOutputSchema } from '../prompts/tailor/v1';
