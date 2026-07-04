'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
          <h1 className="text-2xl font-semibold">Something went wrong.</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            An unexpected error occurred. It has been reported.
          </p>
        </main>
      </body>
    </html>
  );
}
