// Public API for the scorer worker.

export { scoreJob, canonicalJdForEmbedding } from './score-job';
export type { ScoreJobInput, ScoreJobResult } from './score-job';
export { persistScore } from './persist';
