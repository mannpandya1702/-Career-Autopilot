// ATS detection + adapters (Greenhouse, Lever, Ashby, Workable, ...).
// Populated in Phase 3 (discovery) and Phase 8 (submission).

export const ATS_PACKAGE_VERSION = '0.1.0';

export type {
  Adapter,
  AdapterInput,
  AdapterResult,
  AtsType,
  NormalisedJob,
} from './types';
export {
  AdapterHttpError,
  AdapterShapeError,
  normaliseTitle,
  sha256Hex,
} from './types';

export { detect, detectFromHtml, detectFromUrl } from './detect';
export type { Detection } from './detect';

export { ADAPTERS, getAdapter } from './registry';

export { greenhouseAdapter } from './adapters/greenhouse';
export { leverAdapter } from './adapters/lever';
export { ashbyAdapter } from './adapters/ashby';
export { workableAdapter } from './adapters/workable';

export { decodeEntities, stripHtml } from './html-utils';
