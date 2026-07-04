import type { LlmRouter } from '../router';
import {
  companyResearchPrompt,
  type CompanyResearchInput,
  type ResearchPack,
} from '../prompts/company-research/v1';

export async function summariseCompanyResearch(
  router: LlmRouter,
  input: CompanyResearchInput,
): Promise<ResearchPack> {
  return router.call(companyResearchPrompt, input);
}

export type { CompanyResearchInput, ResearchPack };
export { ResearchPackSchema } from '../prompts/company-research/v1';
