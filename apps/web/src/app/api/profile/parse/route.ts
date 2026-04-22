import { NextResponse } from 'next/server';
import { parseLinkedInPdf, parseResumePdf } from '@career-autopilot/parsers';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Accept multipart/form-data with:
//   file: the PDF
//   source: 'resume_pdf' | 'linkedin_pdf'  (default: resume_pdf)
//
// Returns: { parsed: ParsedResume }  (see @career-autopilot/parsers).
// The onboarding UI displays this for confirmation; it is NOT persisted here.
export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const form = await request.formData();
  const file = form.get('file');
  const source = (form.get('source') ?? 'resume_pdf').toString();

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file field missing' }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'file > 5MB' }, { status: 413 });
  }
  if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'expected PDF' }, { status: 415 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    const parsed =
      source === 'linkedin_pdf' ? await parseLinkedInPdf(buffer) : await parseResumePdf(buffer);
    return NextResponse.json({ parsed });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'parse failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
