// Small HTML entity decoder for the handful of entities that appear in ATS job
// descriptions. Greenhouse double-escapes HTML (`&lt;p&gt;` instead of `<p>`);
// after decoding we still keep the tags so downstream HTML-to-text can run once.
// We deliberately do NOT import a 200KB entities library — 10 entities cover 99%.

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&ndash;': '–',
  '&mdash;': '—',
  '&hellip;': '…',
};

export function decodeEntities(input: string): string {
  let out = input;
  // Named entities first.
  for (const [name, char] of Object.entries(ENTITIES)) {
    if (out.includes(name)) out = out.split(name).join(char);
  }
  // Numeric entities (&#123; and &#x1F;).
  out = out.replace(/&#(\d+);/g, (_, code: string) =>
    String.fromCodePoint(Number.parseInt(code, 10)),
  );
  out = out.replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) =>
    String.fromCodePoint(Number.parseInt(code, 16)),
  );
  return out;
}

// Strip HTML tags. Keeps text content plus newlines on block-level boundaries.
export function stripHtml(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
