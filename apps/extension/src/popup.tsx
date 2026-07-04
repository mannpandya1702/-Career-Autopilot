// Popup that the toolbar icon opens. Shows auth state + a one-click
// "Tailor + autofill" CTA the user can fire on the active tab when an
// Easy Apply / Indeed Apply form is open.

import { useEffect, useState } from 'react';
import type { ExtensionMessage, ExtensionResponse } from './types';

const APP_BASE =
  process.env['PLASMO_PUBLIC_APP_BASE_URL'] ?? 'http://localhost:3000';

// Career Autopilot palette (light-mode teal + orange), inlined so the popup
// doesn't need Tailwind. Kept in sync with apps/web/src/app/globals.css.
const T = {
  bg: '#F0FDFA',
  surface: '#FFFFFF',
  fg: '#134E4A',
  muted: '#4A6B69',
  border: '#99F6E4',
  primary: '#0D9488',
  primaryFg: '#F0FDFA',
  accent: '#EA580C',
  success: '#059669',
};

const FONT_STACK =
  '"Fira Sans", system-ui, -apple-system, "Segoe UI", sans-serif';

interface AuthStatus {
  signed_in: boolean;
  email: string | null;
}

function send(msg: ExtensionMessage): Promise<ExtensionResponse> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (r: ExtensionResponse | undefined) => {
      resolve(r ?? { kind: 'error', message: 'no response' });
    });
  });
}

export default function Popup() {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh(): Promise<void> {
    const r = await send({ kind: 'auth_status' });
    if (r.kind === 'auth_status') {
      setStatus({ signed_in: r.signed_in, email: r.email });
    }
  }

  async function tailorAndAutofill(): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        setMessage('No active tab');
        return;
      }
      const resp: ExtensionResponse = await new Promise((resolve) => {
        chrome.tabs.sendMessage(
          tab.id!,
          { kind: 'easy_apply', job: null } as unknown as ExtensionMessage,
          (r: ExtensionResponse | undefined) => {
            resolve(r ?? { kind: 'error', message: 'no response from tab' });
          },
        );
      });
      if (resp.kind === 'easy_apply_ok') {
        setMessage('Filled — review every field before you click submit yourself.');
      } else if (resp.kind === 'error') {
        setMessage(`Error: ${resp.message}`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        width: '340px',
        padding: '16px',
        fontFamily: FONT_STACK,
        fontSize: '13px',
        lineHeight: 1.45,
        background: T.bg,
        color: T.fg,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '14px',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: T.primary,
            color: T.primaryFg,
            display: 'grid',
            placeItems: 'center',
            fontFamily: '"Fira Code", monospace',
            fontWeight: 700,
            fontSize: '14px',
            boxShadow: '0 2px 8px rgba(13, 148, 136, 0.25)',
          }}
          aria-hidden="true"
        >
          {'>'}
        </div>
        <div>
          <div
            style={{
              fontFamily: '"Fira Code", monospace',
              fontWeight: 600,
              fontSize: '13px',
              color: T.fg,
            }}
          >
            career.autopilot
          </div>
          <div style={{ fontSize: '11px', color: T.muted }}>
            LinkedIn + Indeed assistant
          </div>
        </div>
      </header>

      {status?.signed_in ? (
        <section>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 10px',
              marginBottom: '12px',
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: '8px',
              fontSize: '12px',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: '6px',
                height: '6px',
                borderRadius: '999px',
                background: T.success,
              }}
              aria-hidden="true"
            />
            <span
              style={{
                fontFamily: '"Fira Code", monospace',
                color: T.fg,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {status.email ?? 'signed in'}
            </span>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void tailorAndAutofill()}
            style={primaryButtonStyle(busy)}
          >
            {busy ? 'Working…' : 'Tailor + autofill'}
          </button>
          <p style={{ fontSize: '11px', color: T.muted, margin: '6px 0 0' }}>
            Review every field before you click submit yourself.
          </p>
          <div
            style={{
              display: 'flex',
              gap: '6px',
              marginTop: '12px',
            }}
          >
            <a
              href={APP_BASE}
              target="_blank"
              rel="noopener noreferrer"
              style={secondaryAnchorStyle}
            >
              Open workspace
            </a>
            <button
              type="button"
              onClick={async () => {
                await send({ kind: 'auth_clear' });
                await refresh();
              }}
              style={secondaryButtonStyle}
            >
              Sign out
            </button>
          </div>
        </section>
      ) : (
        <section>
          <p style={{ color: T.fg, marginBottom: '12px', fontSize: '12px' }}>
            Sign in to score jobs you view on LinkedIn or Indeed and use the tailor +
            autofill assist.
          </p>
          <a
            href={`${APP_BASE}/auth/extension`}
            target="_blank"
            rel="noopener noreferrer"
            style={primaryAnchorStyle}
          >
            Sign in with magic link
          </a>
        </section>
      )}

      {message ? (
        <div
          role="status"
          style={{
            marginTop: '12px',
            padding: '8px 10px',
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: '8px',
            color: T.fg,
            fontSize: '12px',
          }}
        >
          {message}
        </div>
      ) : null}

      <p
        style={{
          marginTop: '14px',
          paddingTop: '10px',
          borderTop: `1px solid ${T.border}`,
          fontSize: '11px',
          color: T.muted,
        }}
      >
        We never submit on LinkedIn for you — you always click the final button.
      </p>
    </main>
  );
}

function primaryButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    display: 'block',
    width: '100%',
    padding: '9px 12px',
    background: disabled ? '#5EEAD4' : T.primary,
    color: T.primaryFg,
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 500,
    letterSpacing: '-0.005em',
    cursor: disabled ? 'not-allowed' : 'pointer',
    boxShadow: disabled ? 'none' : '0 2px 8px rgba(13, 148, 136, 0.25)',
    transition: 'background 120ms ease-out',
  };
}

const primaryAnchorStyle: React.CSSProperties = {
  display: 'block',
  textAlign: 'center',
  padding: '9px 12px',
  background: T.primary,
  color: T.primaryFg,
  borderRadius: '8px',
  textDecoration: 'none',
  fontWeight: 500,
  fontSize: '13px',
  boxShadow: '0 2px 8px rgba(13, 148, 136, 0.25)',
};

const secondaryAnchorStyle: React.CSSProperties = {
  flex: 1,
  display: 'inline-block',
  textAlign: 'center',
  padding: '7px 10px',
  background: T.surface,
  color: T.fg,
  border: `1px solid ${T.border}`,
  borderRadius: '6px',
  fontSize: '12px',
  textDecoration: 'none',
};

const secondaryButtonStyle: React.CSSProperties = {
  flex: 1,
  display: 'inline-block',
  textAlign: 'center',
  padding: '7px 10px',
  background: T.surface,
  color: T.muted,
  border: `1px solid ${T.border}`,
  borderRadius: '6px',
  fontSize: '12px',
  cursor: 'pointer',
};
