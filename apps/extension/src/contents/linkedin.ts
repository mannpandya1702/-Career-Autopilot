// Plasmo content script for linkedin.com/jobs. Runs in the page; talks
// to the background service worker for everything that needs the user's
// session token (CLAUDE.md §8.8 — content scripts never see secrets).

import type { PlasmoCSConfig } from 'plasmo';
import { extractLinkedInJob, isLinkedInJobUrl } from '../sites/linkedin';
import { autofillEasyApply } from '../autofill';
import { mountScoreWidget, unmountScoreWidget } from '../widget';
import type { ExtensionMessage, ExtensionResponse } from '../types';

export const config: PlasmoCSConfig = {
  matches: ['https://www.linkedin.com/jobs/*', 'https://linkedin.com/jobs/*'],
  run_at: 'document_idle',
};

let lastJobId: string | null = null;

async function tick(): Promise<void> {
  if (!isLinkedInJobUrl(location.href)) {
    unmountScoreWidget(document);
    lastJobId = null;
    return;
  }

  const job = extractLinkedInJob(document, location.href);
  if (!job) return;
  if (job.external_id && job.external_id === lastJobId) return;
  lastJobId = job.external_id;

  const res = await sendMessage({ kind: 'score', job });
  if (res.kind === 'score_ok') {
    mountScoreWidget(document, res.data);
  }
}

// Listen for the popup's "Tailor + autofill" CTA via window.postMessage —
// the popup forwards through the background since the popup runs in its
// own context.
chrome.runtime.onMessage.addListener((msg: ExtensionMessage, _sender, send) => {
  if (msg.kind !== 'easy_apply') return;
  const job = extractLinkedInJob(document, location.href);
  if (!job) {
    send({ kind: 'error', message: 'No job extracted on this page' });
    return true;
  }
  void sendMessage({ kind: 'easy_apply', job }).then((res) => {
    if (res.kind === 'easy_apply_ok') {
      const report = autofillEasyApply(document, res.data);
      send({ kind: 'easy_apply_ok', data: { ...res.data } });
      // eslint-disable-next-line no-console
      console.info('[Career Autopilot] autofill report', report);
    } else {
      send(res);
    }
  });
  return true; // async response
});

async function sendMessage(msg: ExtensionMessage): Promise<ExtensionResponse> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (response: ExtensionResponse | undefined) => {
      if (chrome.runtime.lastError) {
        resolve({ kind: 'error', message: chrome.runtime.lastError.message ?? 'unknown' });
        return;
      }
      resolve(response ?? { kind: 'error', message: 'no response' });
    });
  });
}

// Re-evaluate on SPA navigation. LinkedIn uses pushState; we poll the URL
// every second and re-run when it changes — robust enough for this MVP.
let lastHref = location.href;
setInterval(() => {
  if (location.href !== lastHref) {
    lastHref = location.href;
    void tick();
  }
}, 1000);

void tick();
