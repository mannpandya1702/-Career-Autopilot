// Common shape returned by every ATS parser in the verifier ensemble.
// Each parser does its best to extract the same fields; the ensemble compares
// across parsers to compute parse-agreement.

export interface ParserExtraction {
  parser: 'simple' | 'pyresparser' | 'openresume';
  name: string | null;
  email: string | null;
  phone: string | null;
  // Title strings observed in the document (one per detected experience).
  experience_titles: string[];
  // Companies observed (paired by index with experience_titles when possible).
  companies: string[];
  // Flat skill list.
  skills: string[];
  // Education institutions observed.
  education: string[];
  // Section headings the parser successfully identified.
  detected_sections: string[];
  // Word count for format-compliance.
  word_count: number;
  // Best-effort signals for format compliance:
  has_multiple_columns: boolean;
  has_embedded_images: boolean;
  // Free-form errors / warnings.
  warnings: string[];
}

export interface ParserClient {
  readonly name: ParserExtraction['parser'];
  parse(pdfBuffer: Buffer): Promise<ParserExtraction>;
}

export class ParserHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
  ) {
    super(message);
    this.name = 'ParserHttpError';
  }
}
