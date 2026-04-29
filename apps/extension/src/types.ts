// Wire format used in three places: the content script, the background
// service worker, and the backend `/api/extension/*` routes. Keep it
// synced — every field has a Zod equivalent on the server side.

export interface ExtractedJob {
  // Where we found it.
  source: 'linkedin' | 'indeed';
  source_url: string;
  // Vendor's stable id when we can find it (LinkedIn = currentJobId param,
  // Indeed = jk param). Falls back to a sha-of-(title+company) on the
  // backend when null.
  external_id: string | null;
  title: string;
  company: string;
  location: string | null;
  remote_policy: 'remote' | 'hybrid' | 'onsite' | null;
  description: string;
  // True when LinkedIn's Easy Apply button is visible — the popup
  // surfaces a "Tailor + autofill" CTA only when this is true.
  easy_apply: boolean;
  posted_at: string | null;
}

// Payload the backend returns for the score widget.
export interface ScoreWidgetData {
  overall_score: number; // 0-100
  must_have_gaps: string[];
  reasoning: string | null;
  tier: 'pending_review' | 'needs_decision' | 'low_fit' | 'rejected' | 'auto_apply';
}

// Payload for the Easy Apply autofill modal.
export interface EasyApplyContent {
  full_name: string;
  email: string;
  phone: string | null;
  // Resume text — the modal pastes this when LinkedIn lets us; otherwise
  // the user uploads the PDF themselves from Storage.
  resume_summary: string;
  cover_letter_body: string | null;
  // Pre-baked answers for any question the modal recognises.
  answers: { question_text: string; answer_text: string }[];
}

// Background → backend messages. The background worker is the only piece
// that holds the user's session token; content scripts never see it.
export type ExtensionMessage =
  | { kind: 'auth_status' }
  | { kind: 'auth_set'; access_token: string; refresh_token: string }
  | { kind: 'auth_clear' }
  | { kind: 'score'; job: ExtractedJob }
  | { kind: 'easy_apply'; job: ExtractedJob };

export type ExtensionResponse =
  | { kind: 'auth_status'; signed_in: boolean; email: string | null }
  | { kind: 'auth_ack' }
  | { kind: 'score_ok'; data: ScoreWidgetData }
  | { kind: 'easy_apply_ok'; data: EasyApplyContent }
  | { kind: 'error'; message: string };
