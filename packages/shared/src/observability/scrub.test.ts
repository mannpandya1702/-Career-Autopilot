import { describe, expect, it } from 'vitest';
import { scrub } from './scrub.js';

describe('scrub', () => {
  it('redacts PII-keyed fields', () => {
    const out = scrub({ email: 'a@b.com', name: 'n', nested: { phone: '+1-555-123-9999' } });
    expect(out).toEqual({
      email: '[redacted]',
      name: 'n',
      nested: { phone: '[redacted]' },
    });
  });

  it('redacts email / phone patterns inside free-text strings', () => {
    const out = scrub({ message: 'email me at me@x.io or +91 98765 43210' });
    expect(out.message).toBe('email me at [redacted-email] or [redacted-phone]');
  });

  it('preserves primitive values and short arrays', () => {
    expect(scrub(42)).toBe(42);
    expect(scrub(null)).toBeNull();
    expect(scrub(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('stops recursing past a reasonable depth', () => {
    type Rec = { next?: Rec };
    const root: Rec = {};
    let cur = root;
    for (let i = 0; i < 10; i++) {
      cur.next = {};
      cur = cur.next;
    }
    expect(() => scrub(root)).not.toThrow();
  });
});
