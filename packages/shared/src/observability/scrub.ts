// PII scrubber for Sentry breadcrumbs and logs.
// Any field whose key matches PII_KEY_PATTERN is replaced with '[redacted]'.
// String values that look like emails or phone numbers are redacted in place.

const PII_KEY_PATTERN =
  /email|phone|address|salary|ssn|dob|birth|fullname|full_name|first_name|last_name|resume|cover_letter|visa/i;

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/g;

export function scrub<T>(value: T, depth = 0): T {
  if (depth > 6) return value;

  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    return value
      .replace(EMAIL_RE, '[redacted-email]')
      .replace(PHONE_RE, '[redacted-phone]') as unknown as T;
  }

  if (Array.isArray(value)) {
    return value.map((v) => scrub(v, depth + 1)) as unknown as T;
  }

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (PII_KEY_PATTERN.test(k)) {
        out[k] = '[redacted]';
      } else {
        out[k] = scrub(v, depth + 1);
      }
    }
    return out as unknown as T;
  }

  return value;
}
