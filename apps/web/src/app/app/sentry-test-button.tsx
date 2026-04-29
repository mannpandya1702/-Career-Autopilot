'use client';

export function SentryTestButton() {
  function onClick() {
    throw new Error('Career Autopilot Sentry smoke test');
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-border bg-white px-3 py-2 text-sm font-medium text-red-600"
    >
      Trigger test error
    </button>
  );
}
