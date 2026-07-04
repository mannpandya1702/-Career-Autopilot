import type { PlasmoCSConfig } from 'plasmo';
import { extractIndeedJob, isIndeedJobUrl } from '../sites/indeed';
import { mountScoreWidget, unmountScoreWidget } from '../widget';
import type { ExtensionMessage, ExtensionResponse } from '../types';

export const config: PlasmoCSConfig = {
  matches: [
    'https://www.indeed.com/viewjob*',
    'https://indeed.com/viewjob*',
    'https://*.indeed.com/viewjob*',
  ],
  run_at: 'document_idle',
};

async function tick(): Promise<void> {
  if (!isIndeedJobUrl(location.href)) {
    unmountScoreWidget(document);
    return;
  }
  const job = extractIndeedJob(document, location.href);
  if (!job) return;

  const res = await sendMessage({ kind: 'score', job });
  if (res.kind === 'score_ok') {
    mountScoreWidget(document, res.data);
  }
}

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

let lastHref = location.href;
setInterval(() => {
  if (location.href !== lastHref) {
    lastHref = location.href;
    void tick();
  }
}, 1000);

void tick();
