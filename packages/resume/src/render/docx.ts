// DOCX renderer — uses the `docx` npm package. Same content shape as the
// LaTeX template (single column, standard headings) so ATS parsers see
// equivalent output regardless of which file the user uploads.

import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TabStopPosition,
  TabStopType,
  TextRun,
} from 'docx';
import type { RenderHeader, TailoredResume } from '../schemas/resume';

export async function renderDocx(
  resume: TailoredResume,
  header: RenderHeader,
): Promise<Buffer> {
  const doc = new Document({
    creator: 'Career Autopilot',
    title: header.full_name,
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22 }, // 11pt
        },
      },
    },
    sections: [
      {
        properties: {},
        children: [
          ...buildHeader(header),
          sectionHeading('Summary'),
          new Paragraph({ children: [new TextRun(resume.summary)] }),
          sectionHeading('Experience'),
          ...resume.experience.flatMap(buildExperience),
          ...(resume.projects.length > 0
            ? [sectionHeading('Projects'), ...resume.projects.flatMap(buildProject)]
            : []),
          sectionHeading('Skills'),
          ...buildSkills(resume.skills),
          sectionHeading('Education'),
          ...resume.education.map(buildEducation),
          ...(resume.certifications.length > 0
            ? [
                sectionHeading('Certifications'),
                ...resume.certifications.map(
                  (c) =>
                    new Paragraph({
                      bullet: { level: 0 },
                      children: [new TextRun(c)],
                    }),
                ),
              ]
            : []),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true })],
  });
}

function buildHeader(header: RenderHeader): Paragraph[] {
  const contactBits = [
    header.email,
    header.phone,
    header.location,
    header.linkedin_url,
    header.github_url,
    header.portfolio_url,
  ].filter((s): s is string => Boolean(s));

  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: header.full_name, bold: true, size: 36 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: contactBits.join('  |  '), size: 20 })],
    }),
  ];
}

function buildExperience(
  exp: TailoredResume['experience'][number],
): Paragraph[] {
  const dates = `${exp.start_date} – ${exp.end_date}`;
  const heading = new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    children: [
      new TextRun({ text: exp.title, bold: true }),
      new TextRun({ text: '\t' + dates }),
    ],
  });
  const subheading = new Paragraph({
    children: [
      new TextRun({
        text: `${exp.company}${exp.location ? `, ${exp.location}` : ''}`,
        italics: true,
      }),
    ],
  });
  const bullets = exp.bullets.map(
    (b) =>
      new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun(b)],
      }),
  );
  return [heading, subheading, ...bullets];
}

function buildProject(p: TailoredResume['projects'][number]): Paragraph[] {
  const techPart = p.tech.length > 0 ? ` (${p.tech.join(', ')})` : '';
  const heading = new Paragraph({
    children: [new TextRun({ text: `${p.name}${techPart}`, bold: true })],
  });
  const role = p.role
    ? [new Paragraph({ children: [new TextRun({ text: p.role, italics: true })] })]
    : [];
  const url = p.url
    ? [new Paragraph({ children: [new TextRun({ text: p.url, color: '1f4ed8' })] })]
    : [];
  const bullets = p.bullets.map(
    (b) =>
      new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun(b)],
      }),
  );
  return [heading, ...role, ...url, ...bullets];
}

function buildSkills(skills: TailoredResume['skills']): Paragraph[] {
  const out: Paragraph[] = [];
  if (skills.languages.length > 0) {
    out.push(skillLine('Languages', skills.languages));
  }
  if (skills.frameworks.length > 0) {
    out.push(skillLine('Frameworks', skills.frameworks));
  }
  if (skills.tools.length > 0) {
    out.push(skillLine('Tools', skills.tools));
  }
  if (skills.domains.length > 0) {
    out.push(skillLine('Domains', skills.domains));
  }
  return out;
}

function skillLine(label: string, items: string[]): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true }),
      new TextRun(items.join(', ')),
    ],
  });
}

function buildEducation(e: TailoredResume['education'][number]): Paragraph {
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    children: [
      new TextRun({ text: e.institution, bold: true }),
      new TextRun({ text: '\t' + e.end_date }),
      new TextRun({ text: `\n${e.degree}${e.field ? `, ${e.field}` : ''}` }),
    ],
  });
}
