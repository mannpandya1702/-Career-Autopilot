// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { autofillEasyApply } from './autofill';
import type { EasyApplyContent } from './types';

const CONTENT: EasyApplyContent = {
  full_name: 'Ada Lovelace',
  email: 'ada@example.com',
  phone: '+1 415-555-0100',
  resume_summary: 'Senior engineer.',
  cover_letter_body: 'Dear hiring team,\n\nI am applying.',
  answers: [
    {
      question_text: 'Are you authorized to work in the US?',
      answer_text: 'Yes',
    },
  ],
};

describe('autofillEasyApply', () => {
  it('fills standard fields and reports them', () => {
    document.body.innerHTML = `
      <input type="email" id="email-input" />
      <input type="tel" id="phone-input" />
      <input id="firstName-input" />
      <input id="lastName-input" />
      <textarea id="coverLetter-input"></textarea>
      <label for="auth-q">Are you authorized to work in the US?</label>
      <input id="auth-q" type="text" />
    `;
    const report = autofillEasyApply(document, CONTENT);
    expect(report.filled).toContain('email');
    expect(report.filled).toContain('phone');
    expect(report.filled).toContain('first_name');
    expect(report.filled).toContain('last_name');
    expect(report.filled).toContain('cover_letter');
    expect(report.filled.some((f) => f.startsWith('answer:'))).toBe(true);

    const email = document.getElementById('email-input') as HTMLInputElement;
    expect(email.value).toBe('ada@example.com');
    const cover = document.getElementById('coverLetter-input') as HTMLTextAreaElement;
    expect(cover.value).toContain('hiring team');
    const auth = document.getElementById('auth-q') as HTMLInputElement;
    expect(auth.value).toBe('Yes');
  });

  it('records missing selectors as skipped', () => {
    document.body.innerHTML = `<input type="email" id="email-input" />`;
    const report = autofillEasyApply(document, CONTENT);
    expect(report.filled).toContain('email');
    // No name fields exist — both first/last selectors should report skipped.
    expect(report.skipped).toContain('first_name');
    expect(report.skipped).toContain('last_name');
  });

  it('never clicks a submit button (verified by absence of click events)', () => {
    let clicked = false;
    document.body.innerHTML = `
      <input type="email" id="email-input" />
      <button type="submit" id="submit">Submit</button>
    `;
    document.getElementById('submit')!.addEventListener('click', () => {
      clicked = true;
    });
    autofillEasyApply(document, CONTENT);
    expect(clicked).toBe(false);
  });
});
