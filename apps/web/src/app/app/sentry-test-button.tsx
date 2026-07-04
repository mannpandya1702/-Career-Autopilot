'use client';

import { Button } from '@/components/ui/button';
import { IconAlert } from '@/components/ui/icons';

export function SentryTestButton() {
  function onClick() {
    throw new Error('Career Autopilot Sentry smoke test');
  }
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick} className="text-destructive">
      <IconAlert /> Test error path
    </Button>
  );
}
