// Core tailor pipeline for one (user, job) pair.
//
// Flow per docs/build-phases.md P5.6 + docs/llm-routing.md §Honesty checker:
//   1. Build TailorInput from master profile + parsed JD.
//   2. Call tailor.resume (Haiku).
//   3. Run honestyCheck.
//   4. If violations: call tailor.resume again with violations attached.
//   5. If still failing: escalate to tailor.hard (Sonnet).
//   6. If still failing: throw — caller marks the job as failed_tailor.

import {
  tailorResume,
  tailorResumeHard,
  type LlmRouter,
  type TailorInput,
  type TailorOutput,
} from '@career-autopilot/llm';
import {
  honestyCheck,
  TailoredResumeSchema,
  type MasterProfile,
  type TailoredResume,
} from '@career-autopilot/resume';

export interface TailorJobInput {
  master: MasterProfile;
  parsed_jd: unknown; // ParsedJd from job_embeddings.parsed_jd
  raw_jd_text: string;
  company_name: string;
  user_hint?: string;
}

export interface TailorJobResult {
  resume: TailoredResume;
  honesty_check_passed: boolean;
  honesty_violations: string[];
  regeneration_count: number;
  llm_model: string;
  prompt_version: string;
}

export async function runTailorPipeline(
  router: LlmRouter,
  input: TailorJobInput,
  context?: { userId?: string },
): Promise<TailorJobResult> {
  const baseInput: TailorInput = {
    master_profile_json: JSON.stringify(input.master, masterReplacer),
    stories_json: '[]', // Phase 5 ships without the stories block; Phase 7 wires it in.
    parsed_jd_json: JSON.stringify(input.parsed_jd ?? {}),
    raw_jd_text: input.raw_jd_text,
    company_name: input.company_name,
    ...(input.user_hint ? { user_hint: input.user_hint } : {}),
  };

  // ---- attempt 1: Haiku ----
  let regenerationCount = 0;
  let llmModel = 'claude-haiku-4-5-20251001';
  let promptVersion = 'v1';
  let raw = await tailorResume(router, baseInput, context);
  let resume = parseToTailoredResume(raw);
  let honesty = honestyCheck(resume, input.master);
  if (honesty.ok) {
    return {
      resume,
      honesty_check_passed: true,
      honesty_violations: [],
      regeneration_count: regenerationCount,
      llm_model: llmModel,
      prompt_version: promptVersion,
    };
  }

  // ---- attempt 2: Haiku with stricter reminder ----
  regenerationCount += 1;
  raw = await tailorResume(
    router,
    { ...baseInput, honesty_violations: honesty.violations },
    context,
  );
  resume = parseToTailoredResume(raw);
  honesty = honestyCheck(resume, input.master);
  if (honesty.ok) {
    return {
      resume,
      honesty_check_passed: true,
      honesty_violations: [],
      regeneration_count: regenerationCount,
      llm_model: llmModel,
      prompt_version: promptVersion,
    };
  }

  // ---- attempt 3: Sonnet escalation ----
  regenerationCount += 1;
  llmModel = 'claude-sonnet-4-6';
  raw = await tailorResumeHard(
    router,
    { ...baseInput, honesty_violations: honesty.violations },
    context,
  );
  resume = parseToTailoredResume(raw);
  honesty = honestyCheck(resume, input.master);
  return {
    resume,
    honesty_check_passed: honesty.ok,
    honesty_violations: honesty.violations,
    regeneration_count: regenerationCount,
    llm_model: llmModel,
    prompt_version: promptVersion,
  };
}

function parseToTailoredResume(raw: TailorOutput): TailoredResume {
  // The LLM-side schema and the resume-package schema are duplicates
  // (intentionally — see prompts/tailor/v1.ts). Re-validate to be safe.
  return TailoredResumeSchema.parse(raw);
}

// JSON.stringify replacer that drops embedding columns from the master
// profile — they're 768 floats per row and offer no value to the LLM.
function masterReplacer(key: string, value: unknown): unknown {
  if (key === 'summary_embedding') return undefined;
  return value;
}
