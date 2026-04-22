import type { ParsedResume } from '@career-autopilot/parsers';
import type {
  Education,
  Experience,
  ExperienceBullet,
  Preferences,
  Profile,
  Project,
  QuestionBankEntry,
  Skill,
  Story,
} from '@career-autopilot/resume';

export interface OnboardingInitialData {
  profile: Profile | null;
  experiences: (Experience & { bullets: ExperienceBullet[] })[];
  projects: Project[];
  skills: Skill[];
  education: Education[];
  stories: Story[];
  preferences: Preferences | null;
  questionBank: QuestionBankEntry[];
}

export type WizardStep =
  | 'import'
  | 'review'
  | 'skills'
  | 'preferences'
  | 'stories'
  | 'questions';

export interface WizardStepDef {
  key: WizardStep;
  label: string;
  helper: string;
}

export const WIZARD_STEPS: WizardStepDef[] = [
  { key: 'import', label: 'Import', helper: 'Upload your resume PDF.' },
  { key: 'review', label: 'Review', helper: 'Confirm extracted experience and education.' },
  { key: 'skills', label: 'Skills', helper: 'Tag skills by category.' },
  { key: 'preferences', label: 'Preferences', helper: 'Set targeting rules.' },
  { key: 'stories', label: 'Stories', helper: 'Draft STAR stories for interviews.' },
  { key: 'questions', label: 'Q&A', helper: 'Fill your answer bank.' },
];

export type ParsedResumeDraft = ParsedResume | null;
