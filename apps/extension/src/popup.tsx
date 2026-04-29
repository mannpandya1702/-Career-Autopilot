// Popup that the toolbar icon opens. Shows auth state + a one-click
// "Tailor + autofill" CTA the user can fire on the active tab when an
// Easy Apply / Indeed Apply form is open.

import { useEffect, useState } from 'react';
import type { ExtensionMessage, ExtensionResponse } from './types';

const APP_BASE =
  process.env['PLASMO_PUBLIC_APP_BASE_URL'] ?? 'http://localhost:3000';

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
      // Send through the active tab's content script so it can extract
      // the current job and apply the autofill report itself.
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
        setMessage('Filled — review every field before clicking submit yourself.');
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
        width: '320px',
        padding: '14px',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        fontSize: '13px',
        background: '#fff',
        color: '#111827',
      }}
    >
      <header style={{ marginBottom: '10px' }}>
        <strong>Career Autopilot</strong>
        <div style={{ fontSize: '11px', color: '#6b7280' }}>
          LinkedIn + Indeed assistant
        </div>
      </header>

      {status?.signed_in ? (
        <section>
          <div style={{ marginBottom: '8px', color: '#374151' }}>
            Signed in as <strong>{status.email ?? 'you'}</strong>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void tailorAndAutofill()}
            style={primaryButtonStyle(busy)}
          >
            {busy ? 'Working…' : 'Tailor + autofill (review before submit)'}
          </button>
          <a href={APP_BASE} target="_blank" rel="noopener noreferrer" style={linkStyle}>
            Open Career Autopilot
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
        </section>
      ) : (
        <section>
          <p style={{ color: '#374151', marginBottom: '10px' }}>
            Sign in to score jobs you view on LinkedIn / Indeed and to use the
            tailor + autofill assist.
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

      {message && (
        <p style={{ marginTop: '10px', color: '#374151' }}>{message}</p>
      )}

      <p
        style={{
          marginTop: '14px',
          paddingTop: '10px',
          borderTop: '1px solid #e5e7eb',
          fontSize: '11px',
          color: '#6b7280',
        }}
      >
        We never submit on LinkedIn for you — you click the final button. Per
        their ToS this is the only safe path.
      </p>
    </main>
  );
}

function primaryButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    display: 'block',
    width: '100%',
    padding: '8px 12px',
    background: disabled ? '#9ca3af' : '#111827',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    marginBottom: '8px',
  };
}

const primaryAnchorStyle: React.CSSProperties = {
  display: 'block',
  textAlign: 'center',
  padding: '8px 12px',
  background: '#111827',
  color: 'white',
  borderRadius: '6px',
  textDecoration: 'none',
  fontWeight: 500,
};

const secondaryButtonStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '6px 10px',
  marginTop: '4px',
  background: 'white',
  color: '#374151',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  fontSize: '12px',
  cursor: 'pointer',
};

const linkStyle: React.CSSProperties = {
  display: 'block',
  textAlign: 'center',
  padding: '6px',
  color: '#1d4ed8',
  fontSize: '12px',
  textDecoration: 'underline',
};
