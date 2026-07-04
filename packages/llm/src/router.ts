// LlmRouter — single entry point for every LLM call.
// See docs/llm-routing.md §Router implementation.
//
// Design:
//   - Providers are injected. Tests pass stubs; production passes the real
//     Anthropic + Gemini adapters (wired in packages/llm/src/providers/*).
//   - Each task's prompt definition is passed explicitly (not looked up
//     from a registry) so tree-shaking can drop unused prompts.
//   - On schema validation failure we retry once with a stricter reminder
//     appended to the system prompt; second failure throws InvalidOutput.
//   - Every call emits a CallRecord via the optional sink so callers can
//     persist into llm_calls without the router owning the DB client.

import {
  type CallRecord,
  type CallSink,
  type ContentBlock,
  type GenerationRequest,
  type GenerationResult,
  type PromptDefinition,
  type Provider,
  type ProviderName,
  LlmRouterError,
} from './types';
import { computeCost } from './pricing';

export interface RouterOptions {
  providers: Partial<Record<ProviderName, Provider>>;
  sink?: CallSink;
  // Override the privacy provider when LLM_PRIVACY_MODE=gemini_paid. In that
  // mode, SENSITIVE tasks still route to gemini but to a different model.
  privacyMode?: 'claude_haiku' | 'gemini_paid';
}

export class LlmRouter {
  constructor(private readonly opts: RouterOptions) {}

  async call<Input, Output>(
    prompt: PromptDefinition<Input, Output>,
    input: Input,
    context: { userId?: string } = {},
  ): Promise<Output> {
    const provider = this.resolveProvider(prompt);
    const messages = prompt.buildMessages(input);
    const req: GenerationRequest = {
      system: prompt.system,
      messages,
      model: prompt.model,
      maxOutputTokens: prompt.maxOutputTokens,
      timeoutMs: prompt.timeoutMs,
      task: prompt.task,
      promptVersion: prompt.version,
    };

    let lastError: unknown;

    for (let attempt = 0; attempt < 2; attempt++) {
      const attemptReq =
        attempt === 0 ? req : this.withStricterReminder(req, lastError);
      const started = Date.now();
      let genResult: GenerationResult | undefined;
      try {
        genResult = await provider.generate(attemptReq);
      } catch (err) {
        await this.emit(
          {
            ...buildRecord(
              attemptReq,
              provider.name,
              prompt,
              null,
              Date.now() - started,
              false,
              err instanceof Error ? err.message : 'unknown',
            ),
            ...(context.userId ? { userId: context.userId } : {}),
          },
        );
        throw wrapProviderError(err);
      }

      const parsed = tryParseJson(genResult.text);
      const validation = prompt.outputSchema.safeParse(parsed);
      if (validation.success) {
        await this.emit({
          ...buildRecord(
            attemptReq,
            provider.name,
            prompt,
            genResult,
            genResult.latencyMs,
            true,
          ),
          ...(context.userId ? { userId: context.userId } : {}),
        });
        return validation.data;
      }

      await this.emit({
        ...buildRecord(
          attemptReq,
          provider.name,
          prompt,
          genResult,
          genResult.latencyMs,
          false,
          'invalid_output',
        ),
        ...(context.userId ? { userId: context.userId } : {}),
      });
      lastError = validation.error;
    }

    throw new LlmRouterError(
      `Output failed schema validation after 2 attempts: ${errorSummary(lastError)}`,
      'invalid_output',
    );
  }

  private resolveProvider<Input, Output>(
    prompt: PromptDefinition<Input, Output>,
  ): Provider {
    // Privacy-mode override: when set to gemini_paid, SENSITIVE tasks still
    // route to Gemini (paid tier where Google does not use data for training).
    // For now we trust the prompt's declared provider; the paid-mode wiring
    // happens by swapping the Gemini provider instance with a paid client.
    const provider = this.opts.providers[prompt.provider];
    if (!provider) {
      throw new LlmRouterError(
        `No provider configured for "${prompt.provider}"`,
        'provider_error',
      );
    }
    return provider;
  }

  private withStricterReminder(
    req: GenerationRequest,
    error: unknown,
  ): GenerationRequest {
    const reminder: ContentBlock = {
      role: 'system',
      text: `Your previous response failed schema validation. Errors: ${errorSummary(
        error,
      )}. Reply again using the exact schema. No prose, no explanation — pure JSON matching the schema.`,
    };
    return {
      ...req,
      system: `${req.system}\n\n${reminder.text}`,
    };
  }

  private async emit(record: CallRecord): Promise<void> {
    if (!this.opts.sink) return;
    try {
      await this.opts.sink(record);
    } catch {
      // Sink failure must never block the caller.
    }
  }

  async embed(
    provider: ProviderName,
    text: string,
    model: string,
    timeoutMs = 15_000,
  ): Promise<number[]> {
    const p = this.opts.providers[provider];
    if (!p) {
      throw new LlmRouterError(
        `No provider configured for "${provider}"`,
        'provider_error',
      );
    }
    if (!p.embed) {
      throw new LlmRouterError(
        `Provider "${provider}" does not support embedding`,
        'provider_error',
      );
    }
    const result = await p.embed({ text, model, timeoutMs });
    return result.vector;
  }
}

function buildRecord(
  req: GenerationRequest,
  providerName: ProviderName,
  prompt: { version: string; task: PromptDefinition<unknown, unknown>['task'] },
  result: GenerationResult | null,
  latencyMs: number,
  success: boolean,
  errorCode?: string,
): CallRecord {
  const tokensIn = result?.tokensIn ?? 0;
  const tokensOut = result?.tokensOut ?? 0;
  const cachedTokens = result?.cachedTokens ?? 0;
  const record: CallRecord = {
    task: prompt.task,
    provider: providerName,
    model: req.model,
    promptVersion: prompt.version,
    tokensIn,
    tokensOut,
    cachedTokens,
    costUsd: computeCost(req.model, tokensIn, tokensOut, cachedTokens),
    latencyMs,
    success,
  };
  if (errorCode !== undefined) record.errorCode = errorCode;
  return record;
}

function tryParseJson(text: string): unknown {
  // Be generous: LLMs occasionally wrap JSON in ```json ... ``` fences.
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(stripped);
  } catch {
    return { __unparseable: stripped };
  }
}

function errorSummary(err: unknown): string {
  if (err instanceof Error) {
    return err.message.slice(0, 400);
  }
  return String(err).slice(0, 400);
}

function wrapProviderError(err: unknown): LlmRouterError {
  if (err instanceof LlmRouterError) return err;
  const message = err instanceof Error ? err.message : String(err);
  if (/timeout/i.test(message)) {
    return new LlmRouterError(message, 'timeout');
  }
  if (/429|rate/i.test(message)) {
    return new LlmRouterError(message, 'rate_limited');
  }
  return new LlmRouterError(message, 'provider_error');
}
