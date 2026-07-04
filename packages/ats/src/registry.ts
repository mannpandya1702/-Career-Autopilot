import type { Adapter, AtsType } from './types';
import { greenhouseAdapter } from './adapters/greenhouse';
import { leverAdapter } from './adapters/lever';
import { ashbyAdapter } from './adapters/ashby';
import { workableAdapter } from './adapters/workable';

// Phase 3 covers these four ATSes. SmartRecruiters will be added in a later
// phase per docs/integrations.md §SmartRecruiters, but only after a real
// sample response is checked in.
export const ADAPTERS: Partial<Record<AtsType, Adapter>> = {
  greenhouse: greenhouseAdapter,
  lever: leverAdapter,
  ashby: ashbyAdapter,
  workable: workableAdapter,
};

export function getAdapter(ats: AtsType): Adapter | null {
  return ADAPTERS[ats] ?? null;
}
