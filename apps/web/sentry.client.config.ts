import * as Sentry from '@sentry/nextjs';
import { scrub } from '@career-autopilot/shared/observability/scrub';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    beforeSend(event) {
      return scrub(event);
    },
    beforeBreadcrumb(breadcrumb) {
      return scrub(breadcrumb);
    },
  });
}
