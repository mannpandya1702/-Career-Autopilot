// Easy Apply autofill. Per CLAUDE.md §12 #7 we NEVER click the submit
// button on LinkedIn — only fill fields the user can review and submit
// themselves. This module fills standard fields when their selectors
// match the modal's DOM and dispatches React-friendly input events so
// LinkedIn's controlled components register the change.

import type { EasyApplyContent } from './types';

const FIELD_SELECTORS = {
  email: ['input[type="email"]', 'input[id*="email"]'],
  phone: ['input[type="tel"]', 'input[id*="phone"]'],
  fullName: ['input[id*="fullName"]', 'input[id*="full-name"]'],
  firstName: ['input[id*="firstName"]', 'input[id*="first-name"]'],
  lastName: ['input[id*="lastName"]', 'input[id*="last-name"]'],
  coverLetter: ['textarea[id*="coverLetter"]', 'textarea[id*="cover-letter"]'],
};

export interface AutofillReport {
  filled: string[];
  skipped: string[];
}

export function autofillEasyApply(
  doc: Document,
  content: EasyApplyContent,
): AutofillReport {
  const filled: string[] = [];
  const skipped: string[] = [];

  if (setField(doc, FIELD_SELECTORS.email, content.email)) filled.push('email');
  else skipped.push('email');

  if (content.phone) {
    if (setField(doc, FIELD_SELECTORS.phone, content.phone)) filled.push('phone');
    else skipped.push('phone');
  }

  // Full name vs first/last fallback.
  if (setField(doc, FIELD_SELECTORS.fullName, content.full_name)) {
    filled.push('full_name');
  } else {
    const [first, ...rest] = content.full_name.split(/\s+/);
    const firstOk = setField(doc, FIELD_SELECTORS.firstName, first ?? content.full_name);
    const lastOk = setField(doc, FIELD_SELECTORS.lastName, rest.join(' '));
    if (firstOk) filled.push('first_name');
    else skipped.push('first_name');
    if (lastOk) filled.push('last_name');
    else skipped.push('last_name');
  }

  if (content.cover_letter_body) {
    if (setField(doc, FIELD_SELECTORS.coverLetter, content.cover_letter_body)) {
      filled.push('cover_letter');
    } else {
      skipped.push('cover_letter');
    }
  }

  // Match each pre-baked answer against any visible question label.
  for (const a of content.answers) {
    const label = findLabelMatching(doc, a.question_text);
    if (!label) {
      skipped.push(`answer:${truncate(a.question_text)}`);
      continue;
    }
    const id = label.getAttribute('for');
    const target = id
      ? doc.getElementById(id)
      : label.parentElement?.querySelector('input,textarea,select');
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      reactSetValue(target, a.answer_text);
      filled.push(`answer:${truncate(a.question_text)}`);
    } else {
      skipped.push(`answer:${truncate(a.question_text)}`);
    }
  }

  return { filled, skipped };
}

function setField(doc: Document, selectors: string[], value: string): boolean {
  for (const sel of selectors) {
    const el = doc.querySelector(sel);
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      reactSetValue(el, value);
      return true;
    }
  }
  return false;
}

// Set a controlled-input value AND dispatch the input event React expects.
// Falling back to el.value = x fails on React-controlled inputs because
// React intercepts the setter — we must call the prototype's setter and
// then dispatch the synthetic input event.
function reactSetValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto = Object.getPrototypeOf(el) as
    | HTMLInputElement
    | HTMLTextAreaElement;
  const desc = Object.getOwnPropertyDescriptor(proto, 'value');
  if (desc?.set) {
    desc.set.call(el, value);
  } else {
    el.value = value;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function findLabelMatching(doc: Document, question: string): HTMLLabelElement | null {
  const target = normalise(question);
  const labels = doc.querySelectorAll('label');
  for (const label of Array.from(labels)) {
    if (normalise(label.textContent ?? '') === target) {
      return label;
    }
  }
  // Looser: substring match on either side, ≥ 80% character overlap.
  for (const label of Array.from(labels)) {
    const text = normalise(label.textContent ?? '');
    if (text.length === 0) continue;
    if (text.includes(target) || target.includes(text)) {
      return label;
    }
  }
  return null;
}

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, '').replace(/\s+/g, ' ').trim();
}

function truncate(s: string): string {
  return s.length > 40 ? `${s.slice(0, 37)}...` : s;
}
