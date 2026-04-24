// Core types for the LLM router. Everything is driven off these:
// tasks name a prompt + provider + schema; providers implement a small
// interface that the router calls into. Per CLAUDE.md §8.3, concrete SDK
// imports live only inside this package.

import type { z } from 'zod';

export type ProviderName = 'anthropic' | 'gemini';
export type Privacy = 'SENSITIVE' | 'PUBLIC';

export type TaskId =
  | 'jd.parse'
  | 'fit.judge'
  | 'profile.summarize'
  | 'tailor.resume'
  | 'tailor.hard'
  | 'cover.letter'
  | 'qa.answer'
  | 'email.classify'
  | 'company.research'
  | 'embed.jd'
  | 'embed.profile_summary';

export type ContentRole = 'system' | 'user' | 'assistant';

export interface ContentBlock {
  role: ContentRole;
  text: string;
  // Cache hint: the router turns this into cache_control on Anthropic; for
  // Gemini, stable-prefix blocks come first so implicit caching kicks in.
  cache?: 'short' | 'long';
}

export interface PromptDefinition<Input, Output> {
  version: string;
  task: TaskId;
  provider: ProviderName;
  model: string;
  privacy: Privacy;
  system: string;
  buildMessages: (input: Input) => ContentBlock[];
  outputSchema: z.ZodType<Output>;
  maxOutputTokens: number;
  timeoutMs: number;
}

export interface GenerationRequest {
  system: string;
  messages: ContentBlock[];
  model: string;
  maxOutputTokens: number;
  timeoutMs: number;
  // Used by logger + cost accounting.
  task: TaskId;
  promptVersion: string;
}

export interface GenerationResult {
  text: string;
  tokensIn: number;
  tokensOut: number;
  cachedTokens: number;
  latencyMs: number;
  rawModel: string;
}

export interface EmbeddingRequest {
  text: string;
  model: string;
  timeoutMs: number;
}

export interface EmbeddingResult {
  vector: number[];
  tokensIn: number;
  latencyMs: number;
  dimension: number;
}

// Concrete SDK calls live behind this interface so feature code can never
// touch @anthropic-ai/sdk or @google/generative-ai directly.
export interface Provider {
  readonly name: ProviderName;
  generate(req: GenerationRequest): Promise<GenerationResult>;
  embed?(req: EmbeddingRequest): Promise<EmbeddingResult>;
}

// Record emitted for every call; persisted by the caller into llm_calls.
export interface CallRecord {
  task: TaskId;
  provider: ProviderName;
  model: string;
  promptVersion: string;
  tokensIn: number;
  tokensOut: number;
  cachedTokens: number;
  costUsd: number;
  latencyMs: number;
  success: boolean;
  errorCode?: string;
  userId?: string;
}

export type CallSink = (record: CallRecord) => void | Promise<void>;

export class LlmRouterError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'provider_error'
      | 'timeout'
      | 'rate_limited'
      | 'invalid_output'
      | 'privacy_violation',
  ) {
    super(message);
    this.name = 'LlmRouterError';
  }
}
