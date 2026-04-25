// LLM router, prompts, caching. Populated from Phase 4 onward.
// See docs/llm-routing.md for the full provider/prompt/caching design.

export const LLM_PACKAGE_VERSION = '0.1.0';

export type {
  CallRecord,
  CallSink,
  ContentBlock,
  EmbeddingRequest,
  EmbeddingResult,
  GenerationRequest,
  GenerationResult,
  PromptDefinition,
  Provider,
  ProviderName,
  Privacy,
  TaskId,
} from './types';
export { LlmRouterError } from './types';

export { LlmRouter } from './router';
export type { RouterOptions } from './router';

export { computeCost } from './pricing';

export { makeStubProvider } from './providers/stub';

// Prompts
export { jdParsePrompt, ParsedJdSchema } from './prompts/jd-parse/v1';
export type { JdParseInput, ParsedJd } from './prompts/jd-parse/v1';
export { fitJudgePrompt, FitJudgmentSchema } from './prompts/fit-judge/v1';
export type { FitJudgeInput, FitJudgment } from './prompts/fit-judge/v1';
export {
  tailorPrompt,
  tailorHardPrompt,
  TailorOutputSchema,
} from './prompts/tailor/v1';
export type { TailorInput, TailorOutput } from './prompts/tailor/v1';

// Tasks
export { parseJd } from './tasks/jd-parse';
export { judgeFit } from './tasks/fit-judge';
export { tailorResume, tailorResumeHard } from './tasks/tailor';
export {
  embedJd,
  embedProfileSummary,
  toPgVectorLiteral,
  cosineSimilarity,
} from './tasks/embed';
