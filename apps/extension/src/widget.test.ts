// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { mountScoreWidget, unmountScoreWidget } from './widget';

describe('mountScoreWidget', () => {
  it('renders the widget into the document', () => {
    document.body.innerHTML = '';
    mountScoreWidget(document, {
      overall_score: 87,
      must_have_gaps: ['Kubernetes'],
      reasoning: 'Strong fit on the language stack.',
      tier: 'pending_review',
    });
    const root = document.getElementById('career-autopilot-widget');
    expect(root).not.toBeNull();
    expect(root?.textContent).toContain('Career Autopilot');
    expect(root?.textContent).toContain('87');
    expect(root?.textContent).toContain('Kubernetes');
    expect(root?.textContent).toContain('Strong fit');
  });

  it('replaces the widget on remount (single instance)', () => {
    mountScoreWidget(document, {
      overall_score: 50,
      must_have_gaps: [],
      reasoning: null,
      tier: 'low_fit',
    });
    mountScoreWidget(document, {
      overall_score: 75,
      must_have_gaps: [],
      reasoning: null,
      tier: 'needs_decision',
    });
    expect(document.querySelectorAll('#career-autopilot-widget')).toHaveLength(1);
  });
});

describe('unmountScoreWidget', () => {
  it('removes the widget when present', () => {
    mountScoreWidget(document, {
      overall_score: 80,
      must_have_gaps: [],
      reasoning: null,
      tier: 'pending_review',
    });
    expect(document.getElementById('career-autopilot-widget')).not.toBeNull();
    unmountScoreWidget(document);
    expect(document.getElementById('career-autopilot-widget')).toBeNull();
  });
});
