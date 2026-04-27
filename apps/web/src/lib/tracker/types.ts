// Client-safe types + constants shared between the tracker server query
// and the kanban client component. Anything that needs `'server-only'`
// stays in queries.ts.

import type { OutcomeType } from '@career-autopilot/db';

export type KanbanColumn =
  | 'submitted'
  | 'acknowledged'
  | 'responded'
  | 'interviewing'
  | 'offered'
  | 'rejected';

export interface TrackerCard {
  submission_id: string;
  job_id: string;
  job_title: string;
  company_name: string;
  apply_url: string | null;
  submitted_at: string | null;
  current_stage: OutcomeType | 'submitted';
  column: KanbanColumn;
  stage_reached_at: string;
}

export const STAGE_TO_COLUMN: Record<OutcomeType, KanbanColumn> = {
  submitted: 'submitted',
  acknowledged: 'acknowledged',
  callback: 'responded',
  rejection: 'rejected',
  interview_invite: 'interviewing',
  interview_completed: 'interviewing',
  offer: 'offered',
  declined: 'offered',
  accepted: 'offered',
  ghosted: 'submitted',
};

export const KANBAN_COLUMNS: { key: KanbanColumn; label: string }[] = [
  { key: 'submitted', label: 'Submitted' },
  { key: 'acknowledged', label: 'Acknowledged' },
  { key: 'responded', label: 'Responded' },
  { key: 'interviewing', label: 'Interviewing' },
  { key: 'offered', label: 'Offered' },
  { key: 'rejected', label: 'Rejected' },
];
