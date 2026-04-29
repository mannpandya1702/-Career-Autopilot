// PDF renderer — shells out to Tectonic. Tectonic is installed on the
// Oracle VM and expected on PATH; it produces a hermetic LaTeX → PDF
// build with no system-LaTeX-Live dependency.
//
// Tests (and any environment without Tectonic) inject a stub compiler.

import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { RenderHeader, TailoredResume } from '../schemas/resume';
import { buildLatex } from './latex';

const execFileAsync = promisify(execFile);

export interface LatexCompiler {
  compile(latexSource: string): Promise<Buffer>;
}

// Default compiler: shells out to `tectonic - --outdir <tmp>` and reads
// the resulting PDF. Times out at 30s per CLAUDE.md §8.5 P5.8.
export const tectonicCompiler: LatexCompiler = {
  async compile(latexSource) {
    const dir = await mkdtemp(join(tmpdir(), 'cap-pdf-'));
    try {
      const texPath = join(dir, 'resume.tex');
      const pdfPath = join(dir, 'resume.pdf');
      await writeFile(texPath, latexSource, 'utf8');
      await execFileAsync(
        'tectonic',
        ['--outdir', dir, '--keep-logs=false', texPath],
        { timeout: 30_000 },
      );
      return await readFile(pdfPath);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
};

export interface RenderPdfOptions {
  resume: TailoredResume;
  header: RenderHeader;
  compiler?: LatexCompiler;
}

export async function renderPdf(options: RenderPdfOptions): Promise<Buffer> {
  const compiler = options.compiler ?? tectonicCompiler;
  const latex = buildLatex(options.resume, options.header);
  return compiler.compile(latex);
}

// Used by tests + worker bootstrap when Tectonic is not installed.
// Returns a dummy buffer that's still a valid PDF magic prefix so any
// downstream code that sniffs for PDFs sees the expected header.
export const stubLatexCompiler: LatexCompiler = {
  async compile(latexSource) {
    return Buffer.from(`%PDF-1.4\n%STUB\n${latexSource.length} bytes\n%%EOF`);
  },
};

// Convenience: write a rendered PDF straight to disk. The worker uploads
// the buffer to Supabase Storage; this helper is mainly for ops scripts.
export async function renderPdfToFile(
  outputPath: string,
  options: RenderPdfOptions,
): Promise<void> {
  const buf = await renderPdf(options);
  await mkdir(join(outputPath, '..'), { recursive: true });
  await writeFile(outputPath, buf);
}
