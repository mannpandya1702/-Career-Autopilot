// Shape returned by the resume/LinkedIn PDF parsers. Deliberately loose:
// the onboarding UI (P2.5 Step 2 — Review) surfaces these fields for the user
// to confirm, correct, or fill in.  We never silently commit them.
//
// Fields are *best-effort*; any may be missing.  The UI shows uncertainty
// via `parser_confidence` per field so the user knows what to check.

export interface ParsedContact {
  full_name?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin_url?: string;
  github_url?: string;
  portfolio_url?: string;
  headline?: string;
}

export interface ParsedExperienceBullet {
  text: string;
  // Raw metric tokens we could detect ("22%", "$180K", "3.1x") — for UI highlight.
  metric_candidates?: string[];
}

export interface ParsedExperience {
  company: string;
  title: string;
  location?: string;
  // ISO YYYY-MM-DD when we can resolve.  Raw string if we can't.
  start_date?: string;
  end_date?: string | null;
  start_date_raw?: string;
  end_date_raw?: string;
  description?: string;
  bullets: ParsedExperienceBullet[];
  tech_stack?: string[];
}

export interface ParsedProject {
  name: string;
  role?: string;
  start_date?: string;
  end_date?: string;
  description?: string;
  url?: string;
  tech_stack?: string[];
}

export interface ParsedEducation {
  institution: string;
  degree?: string;
  field?: string;
  start_date?: string;
  end_date?: string;
  gpa?: number;
  coursework?: string[];
  honors?: string[];
}

export interface ParsedSkill {
  name: string;
  // Heuristic classification the UI can let the user override.
  category_guess?:
    | 'language'
    | 'framework'
    | 'tool'
    | 'domain'
    | 'soft'
    | 'certification'
    | 'database'
    | 'cloud';
}

export interface ParserWarning {
  stage: 'extract' | 'split' | 'enrich';
  message: string;
}

export interface ParsedResume {
  source: 'resume_pdf' | 'linkedin_pdf';
  contact: ParsedContact;
  summary?: string;
  experiences: ParsedExperience[];
  projects: ParsedProject[];
  education: ParsedEducation[];
  skills: ParsedSkill[];
  raw_markdown: string;
  // Sections the deterministic splitter couldn't classify.
  unclassified_sections?: string[];
  warnings: ParserWarning[];
}
