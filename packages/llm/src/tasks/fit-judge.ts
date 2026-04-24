import type { LlmRouter } from '../router';
import {
  fitJudgePrompt,
  type FitJudgeInput,
  type FitJudgment,
} from '../prompts/fit-judge/v1';

export async function judgeFit(
  router: LlmRouter,
  input: FitJudgeInput,
  context?: { userId?: string },
): Promise<FitJudgment> {
  return router.call(fitJudgePrompt, input, context);
}

export type { FitJudgeInput, FitJudgment };
export { FitJudgmentSchema } from '../prompts/fit-judge/v1';
