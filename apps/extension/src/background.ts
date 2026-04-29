// Background service worker. Sole holder of the user's Supabase
// session tokens (CLAUDE.md §8.8). Content scripts message the worker;
// the worker calls the user's own backend at NEXT_PUBLIC_APP_BASE_URL
// — never any third-party host.

import type {
  EasyApplyContent,
  ExtensionMessage,
  ExtensionResponse,
  ExtractedJob,
  ScoreWidgetData,
} from './types';

// Plasmo replaces process.env.PLASMO_PUBLIC_* at build time. Default to
// localhost so a fresh dev install works against `pnpm dev`.
const APP_BASE =
  process.env['PLASMO_PUBLIC_APP_BASE_URL'] ?? 'http://localhost:3000';

interface StoredSession {
  access_token: string;
  refresh_token: string;
  email: string | null;
}

async function getSession(): Promise<StoredSession | null> {
  const { session } = (await chrome.storage.local.get('session')) as {
    session?: StoredSession;
  };
  return session ?? null;
}

async function setSession(session: StoredSession | null): Promise<void> {
  if (session) {
    await chrome.storage.local.set({ session });
  } else {
    await chrome.storage.local.remove('session');
  }
}

async function backendFetch<T>(path: string, body: unknown): Promise<T> {
  const session = await getSession();
  if (!session) throw new Error('Not signed in');
  const res = await fetch(`${APP_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    await setSession(null);
    throw new Error('Session expired — sign in again');
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`backend ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

chrome.runtime.onMessage.addListener(
  (msg: ExtensionMessage, _sender, send: (r: ExtensionResponse) => void) => {
    void handle(msg).then(send).catch((err: unknown) => {
      send({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    });
    return true; // async
  },
);

async function handle(msg: ExtensionMessage): Promise<ExtensionResponse> {
  switch (msg.kind) {
    case 'auth_status': {
      const session = await getSession();
      return {
        kind: 'auth_status',
        signed_in: !!session,
        email: session?.email ?? null,
      };
    }
    case 'auth_set': {
      // The web app's /auth/extension page POSTs the tokens via a
      // chrome.runtime.sendMessage from the page's context using
      // externally_connectable. We accept here and persist.
      let email: string | null = null;
      try {
        const profile = await fetch(`${APP_BASE}/api/extension/whoami`, {
          headers: { Authorization: `Bearer ${msg.access_token}` },
        });
        if (profile.ok) {
          email = ((await profile.json()) as { email?: string }).email ?? null;
        }
      } catch {
        /* fall through with email=null */
      }
      await setSession({
        access_token: msg.access_token,
        refresh_token: msg.refresh_token,
        email,
      });
      return { kind: 'auth_ack' };
    }
    case 'auth_clear': {
      await setSession(null);
      return { kind: 'auth_ack' };
    }
    case 'score': {
      const data = await backendFetch<ScoreWidgetData>('/api/extension/score', {
        job: msg.job satisfies ExtractedJob,
      });
      return { kind: 'score_ok', data };
    }
    case 'easy_apply': {
      const data = await backendFetch<EasyApplyContent>(
        '/api/extension/easy-apply',
        { job: msg.job satisfies ExtractedJob },
      );
      return { kind: 'easy_apply_ok', data };
    }
  }
}
