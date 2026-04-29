'use client';

import { useEffect, useState } from 'react';

// The extension manifest declares this page in `externally_connectable`
// or — simpler — installs a content script on this exact route that
// listens for `cap-extension-handoff` messages. We post the message
// every time the user clicks the button below.

export function ExtensionHandoff({
  accessToken,
  refreshToken,
  email,
}: {
  accessToken: string;
  refreshToken: string;
  email: string | null;
}) {
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle');

  useEffect(() => {
    // Auto-fire once on load. The extension's content script picks it up
    // and the popup's auth_status flips to signed_in next time it opens.
    window.postMessage(
      {
        kind: 'cap-extension-handoff',
        access_token: accessToken,
        refresh_token: refreshToken,
        email,
      },
      window.location.origin,
    );
    setStatus('sent');
  }, [accessToken, refreshToken, email]);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-sm">
      <h1 className="text-xl font-semibold">Connect extension</h1>
      {status === 'sent' ? (
        <>
          <p className="text-center text-green-700">
            Session sent to the extension. Open the toolbar icon — you should be
            signed in as <strong>{email ?? 'you'}</strong>.
          </p>
          <p className="text-center text-xs text-muted-foreground">
            Didn&rsquo;t work? Click the button to resend.
          </p>
        </>
      ) : (
        <p>Preparing handoff…</p>
      )}
      <button
        type="button"
        onClick={() => {
          window.postMessage(
            {
              kind: 'cap-extension-handoff',
              access_token: accessToken,
              refresh_token: refreshToken,
              email,
            },
            window.location.origin,
          );
          setStatus('sent');
        }}
        className="btn-secondary"
      >
        Resend to extension
      </button>
      <a href="/app" className="text-xs text-blue-700 underline">
        Back to dashboard
      </a>
    </div>
  );
}
