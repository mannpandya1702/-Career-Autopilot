// Listens on the web app's /auth/extension page for the postMessage
// the page emits with the user's Supabase session tokens. Forwards
// them to the background worker which is the sole holder of secrets.

import type { PlasmoCSConfig } from 'plasmo';
import type { ExtensionMessage } from '../types';

export const config: PlasmoCSConfig = {
  matches: ['<all_urls>'],
  run_at: 'document_idle',
};

interface HandoffPayload {
  kind: 'cap-extension-handoff';
  access_token: string;
  refresh_token: string;
  email: string | null;
}

window.addEventListener('message', (ev) => {
  if (ev.source !== window) return;
  const data = ev.data as Partial<HandoffPayload> | null;
  if (!data || data.kind !== 'cap-extension-handoff') return;
  if (!data.access_token || !data.refresh_token) return;
  const msg: ExtensionMessage = {
    kind: 'auth_set',
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  };
  chrome.runtime.sendMessage(msg, () => {
    // ignore response; the popup re-fetches auth status next time it opens
  });
});
