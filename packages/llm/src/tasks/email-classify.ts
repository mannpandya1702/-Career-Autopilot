import type { LlmRouter } from '../router';
import {
  emailClassifyPrompt,
  type EmailClassifyInput,
  type EmailClassification,
} from '../prompts/email-classify/v1';

export async function classifyEmail(
  router: LlmRouter,
  input: EmailClassifyInput,
  context?: { userId?: string },
): Promise<EmailClassification> {
  return router.call(emailClassifyPrompt, input, context);
}

export type { EmailClassifyInput, EmailClassification };
export { EmailClassificationSchema } from '../prompts/email-classify/v1';
