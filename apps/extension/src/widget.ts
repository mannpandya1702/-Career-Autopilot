// Renders the fit-score badge as a fixed-position card top-right.
// Pure DOM ops so tests can drive a JSDOM document and assert the
// resulting markup.

import type { ScoreWidgetData } from './types';

const ROOT_ID = 'career-autopilot-widget';

// Career Autopilot palette (light-mode teal + orange), inlined so we don't need
// to load Tailwind into the host page's DOM. Kept in sync with globals.css.
const T = {
  surface: '#FFFFFF',
  fg: '#134E4A',
  muted: '#4A6B69',
  border: '#99F6E4',
  primary: '#0D9488',
  primaryFg: '#F0FDFA',
  accent: '#EA580C',
  success: '#059669',
  warning: '#D97706',
  destructive: '#DC2626',
  destructiveBg: '#FEF2F2',
};

const FONT_STACK =
  '"Fira Sans", system-ui, -apple-system, "Segoe UI", sans-serif';
const MONO_STACK = '"Fira Code", ui-monospace, SFMono-Regular, monospace';

export function mountScoreWidget(doc: Document, data: ScoreWidgetData): void {
  const existing = doc.getElementById(ROOT_ID);
  if (existing) existing.remove();

  const root = doc.createElement('div');
  root.id = ROOT_ID;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Career Autopilot fit score');
  Object.assign(root.style, {
    position: 'fixed',
    top: '84px',
    right: '20px',
    zIndex: '2147483647',
    width: '288px',
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: '12px',
    padding: '14px',
    fontFamily: FONT_STACK,
    fontSize: '13px',
    lineHeight: '1.45',
    color: T.fg,
    boxShadow: '0 12px 32px rgba(19, 78, 74, 0.18), 0 2px 4px rgba(19, 78, 74, 0.08)',
  });

  const score = clampScore(data.overall_score);
  const colour = scoreColour(score);

  const header = doc.createElement('div');
  Object.assign(header.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '10px',
  });

  const ring = doc.createElement('div');
  Object.assign(ring.style, {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    background: `conic-gradient(${colour} ${score * 3.6}deg, #E6F7F4 0)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: '0',
  });
  const inner = doc.createElement('div');
  Object.assign(inner.style, {
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    background: T.surface,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: MONO_STACK,
    fontWeight: '600',
    fontSize: '14px',
    fontVariantNumeric: 'tabular-nums',
    color: colour,
  });
  inner.textContent = String(score);
  ring.append(inner);

  const titleStack = doc.createElement('div');
  Object.assign(titleStack.style, { display: 'flex', flexDirection: 'column', gap: '2px' });

  const brand = doc.createElement('div');
  Object.assign(brand.style, {
    fontFamily: MONO_STACK,
    fontWeight: '600',
    fontSize: '12px',
    color: T.fg,
    letterSpacing: '-0.01em',
  });
  brand.textContent = 'career.autopilot';

  const tier = doc.createElement('div');
  Object.assign(tier.style, {
    fontSize: '11px',
    color: T.muted,
    textTransform: 'capitalize',
  });
  tier.textContent = data.tier.replace(/_/g, ' ');

  titleStack.append(brand, tier);
  header.append(ring, titleStack);
  root.append(header);

  if (data.must_have_gaps.length > 0) {
    const gapsCard = doc.createElement('div');
    Object.assign(gapsCard.style, {
      marginTop: '10px',
      padding: '8px 10px',
      background: T.destructiveBg,
      border: `1px solid rgba(220, 38, 38, 0.2)`,
      borderRadius: '8px',
    });

    const gapsHeader = doc.createElement('div');
    gapsHeader.textContent = `Must-have gaps · ${data.must_have_gaps.length}`;
    Object.assign(gapsHeader.style, {
      fontSize: '10px',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      fontWeight: '600',
      color: T.destructive,
      marginBottom: '4px',
    });

    const list = doc.createElement('ul');
    Object.assign(list.style, {
      margin: '0',
      paddingLeft: '16px',
      color: T.fg,
      fontSize: '12px',
      listStyle: 'disc',
    });
    for (const gap of data.must_have_gaps.slice(0, 6)) {
      const li = doc.createElement('li');
      li.textContent = gap;
      list.append(li);
    }
    gapsCard.append(gapsHeader, list);
    root.append(gapsCard);
  }

  if (data.reasoning) {
    const para = doc.createElement('p');
    para.textContent = data.reasoning;
    Object.assign(para.style, {
      margin: '10px 0 0',
      color: T.muted,
      fontSize: '12px',
      lineHeight: '1.5',
      borderLeft: `2px solid ${T.primary}`,
      paddingLeft: '10px',
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
  if (score >= 85) return T.success;
  if (score >= 70) return T.warning;
  return T.destructive;
}
