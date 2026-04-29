// Renders the fit-score badge as a fixed-position card top-right.
// Pure DOM ops so tests can drive a JSDOM document and assert the
// resulting markup.

import type { ScoreWidgetData } from './types';

const ROOT_ID = 'career-autopilot-widget';

export function mountScoreWidget(doc: Document, data: ScoreWidgetData): void {
  const existing = doc.getElementById(ROOT_ID);
  if (existing) existing.remove();

  const root = doc.createElement('div');
  root.id = ROOT_ID;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Career Autopilot fit score');
  Object.assign(root.style, {
    position: 'fixed',
    top: '80px',
    right: '20px',
    zIndex: '2147483647',
    width: '260px',
    background: 'white',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    padding: '12px',
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    fontSize: '13px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
  });

  const score = clampScore(data.overall_score);
  const colour = scoreColour(score);

  const header = doc.createElement('div');
  Object.assign(header.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '8px',
  });

  const ring = doc.createElement('div');
  Object.assign(ring.style, {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: `conic-gradient(${colour} ${score * 3.6}deg, #e5e7eb 0)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '600',
    color: colour,
  });
  const inner = doc.createElement('div');
  Object.assign(inner.style, {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  });
  inner.textContent = String(score);
  ring.append(inner);

  const title = doc.createElement('div');
  title.style.fontWeight = '600';
  title.textContent = 'Career Autopilot';

  const tier = doc.createElement('div');
  tier.style.fontSize = '11px';
  tier.style.color = '#6b7280';
  tier.textContent = data.tier.replace(/_/g, ' ');

  const titleStack = doc.createElement('div');
  titleStack.append(title, tier);

  header.append(ring, titleStack);
  root.append(header);

  if (data.must_have_gaps.length > 0) {
    const gapsHeader = doc.createElement('div');
    gapsHeader.textContent = 'Must-have gaps';
    Object.assign(gapsHeader.style, {
      fontSize: '11px',
      textTransform: 'uppercase',
      color: '#b91c1c',
      marginTop: '6px',
    });
    const list = doc.createElement('ul');
    Object.assign(list.style, {
      margin: '4px 0 0',
      paddingLeft: '18px',
      color: '#374151',
    });
    for (const gap of data.must_have_gaps.slice(0, 6)) {
      const li = doc.createElement('li');
      li.textContent = gap;
      list.append(li);
    }
    root.append(gapsHeader, list);
  }

  if (data.reasoning) {
    const para = doc.createElement('p');
    para.textContent = data.reasoning;
    Object.assign(para.style, {
      margin: '8px 0 0',
      color: '#374151',
      lineHeight: '1.4',
    });
    root.append(para);
  }

  doc.body.append(root);
}

export function unmountScoreWidget(doc: Document): void {
  doc.getElementById(ROOT_ID)?.remove();
}

function clampScore(s: number): number {
  return Math.max(0, Math.min(100, Math.round(s)));
}

function scoreColour(score: number): string {
  if (score >= 85) return '#15803d';
  if (score >= 70) return '#ca8a04';
  return '#b91c1c';
}
