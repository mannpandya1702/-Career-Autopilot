// Resume domain: master profile schemas, tailor logic, honesty check, renderers.
// Populated in Phase 2 (profile schema), Phase 4 (fit filters), Phase 5 (tailor + render).

export const RESUME_PACKAGE_VERSION = '0.1.0';

export * from './schemas/profile';
export * from './schemas/resume';
export * from './fit/hard-filters';
export * from './fit/semantic';
export * from './fit/tiering';
export * from './tailor/honesty';
export * from './render';
export * from './verify';
