import { describe, expect, it } from 'vitest';
import { planFollowUp } from './schedule';

const NOW = new Date('2026-04-21T00:00:00Z');

function daysAgo(d: number): string {
  return new Date(NOW.getTime() - d * 24 * 60 * 60 * 1000).toISOString();
}

describe('planFollowUp', () => {
  it('returns none when an outcome already exists', () => {
    const r = planFollowUp(
      {
        submission_id: 'a',
        submitted_at: daysAgo(10),
        has_outcome: true,
        followup_sent_at: null,
        status: 'succeeded',
      },
      NOW,
    );
    expect(r.kind).toBe('none');
  });

  it('queues a follow-up at day 7 if not already sent', () => {
    const r = planFollowUp(
      {
        submission_id: 'a',
        submitted_at: daysAgo(7),
        has_outcome: false,
        followup_sent_at: null,
        status: 'succeeded',
      },
      NOW,
    );
    expect(r.kind).toBe('send_followup');
  });

  it('does not double-send when followup_sent_at is already set', () => {
    const r = planFollowUp(
      {
        submission_id: 'a',
        submitted_at: daysAgo(8),
        has_outcome: false,
        followup_sent_at: daysAgo(1),
        status: 'succeeded',
      },
      NOW,
    );
    expect(r.kind).toBe('none');
  });

  it('marks stale at day 14', () => {
    const r = planFollowUp(
      {
        submission_id: 'a',
        submitted_at: daysAgo(14),
        has_outcome: false,
        followup_sent_at: null,
        status: 'succeeded',
      },
      NOW,
    );
    expect(r.kind).toBe('mark_stale');
  });

  it('skips terminal statuses', () => {
    const r = planFollowUp(
      {
        submission_id: 'a',
        submitted_at: daysAgo(20),
        has_outcome: false,
        followup_sent_at: null,
        status: 'failed',
      },
      NOW,
    );
    expect(r.kind).toBe('none');
  });
});
