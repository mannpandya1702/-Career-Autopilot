// Placeholder until `pnpm db:types` runs against a live Supabase project.
// After any migration, regenerate with `pnpm db:types` (see scripts/gen-types.sh).
// Mirrors the DDL in supabase/migrations — kept in sync by hand until we can run
// the Supabase CLI against a real project.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ---- Enums (match SQL `create type ... as enum`) ----
export type ExperienceLevel = 'intern' | 'entry' | 'mid' | 'senior' | 'lead' | 'principal';
export type WorkMode = 'remote' | 'hybrid' | 'onsite';
export type JobType = 'full_time' | 'part_time' | 'contract' | 'internship' | 'freelance';
export type SkillCategory =
  | 'language'
  | 'framework'
  | 'tool'
  | 'domain'
  | 'soft'
  | 'certification'
  | 'database'
  | 'cloud';
export type StoryDimension =
  | 'leadership'
  | 'conflict'
  | 'failure'
  | 'ambiguity'
  | 'ownership'
  | 'influence'
  | 'learning'
  | 'metric_win'
  | 'teamwork'
  | 'customer_focus';

export type AtsType =
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'workable'
  | 'smartrecruiters'
  | 'custom';

type Timestamped = {
  created_at: string;
  updated_at: string;
};

type TimestampedInsert = {
  created_at?: string;
  updated_at?: string;
};

export interface Database {
  public: {
    Tables: {
      // ---- Phase 1 ----
      user_profiles: {
        Row: {
          user_id: string;
          display_name: string | null;
          timezone: string;
          onboarded_at: string | null;
        } & Timestamped;
        Insert: {
          user_id: string;
          display_name?: string | null;
          timezone?: string;
          onboarded_at?: string | null;
        } & TimestampedInsert;
        Update: {
          user_id?: string;
          display_name?: string | null;
          timezone?: string;
          onboarded_at?: string | null;
        } & TimestampedInsert;
        Relationships: [];
      };

      // ---- Phase 2 ----
      profiles: {
        Row: {
          id: string;
          user_id: string;
          full_name: string;
          email: string;
          phone: string | null;
          location: string | null;
          linkedin_url: string | null;
          github_url: string | null;
          portfolio_url: string | null;
          headline: string | null;
          summary: string | null;
          derived_summary: string | null;
          summary_embedding: string | null; // pgvector serialized
          visa_status: string | null;
          work_authorization: string[] | null;
          years_experience: number | null;
        } & Timestamped;
        Insert: {
          id?: string;
          user_id: string;
          full_name: string;
          email: string;
          phone?: string | null;
          location?: string | null;
          linkedin_url?: string | null;
          github_url?: string | null;
          portfolio_url?: string | null;
          headline?: string | null;
          summary?: string | null;
          derived_summary?: string | null;
          summary_embedding?: string | null;
          visa_status?: string | null;
          work_authorization?: string[] | null;
          years_experience?: number | null;
        } & TimestampedInsert;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
        Relationships: [];
      };

      experiences: {
        Row: {
          id: string;
          user_id: string;
          profile_id: string;
          company: string;
          title: string;
          location: string | null;
          work_mode: WorkMode | null;
          start_date: string;
          end_date: string | null;
          is_current: boolean;
          description: string | null;
          tech_stack: string[] | null;
          ord: number;
        } & Timestamped;
        Insert: {
          id?: string;
          user_id: string;
          profile_id: string;
          company: string;
          title: string;
          location?: string | null;
          work_mode?: WorkMode | null;
          start_date: string;
          end_date?: string | null;
          description?: string | null;
          tech_stack?: string[] | null;
          ord?: number;
        } & TimestampedInsert;
        Update: Partial<Database['public']['Tables']['experiences']['Insert']>;
        Relationships: [];
      };

      experience_bullets: {
        Row: {
          id: string;
          user_id: string;
          experience_id: string;
          text: string;
          metrics: Json | null;
          skill_tags: string[] | null;
          story_id: string | null;
          ord: number;
        } & Timestamped;
        Insert: {
          id?: string;
          user_id: string;
          experience_id: string;
          text: string;
          metrics?: Json | null;
          skill_tags?: string[] | null;
          story_id?: string | null;
          ord?: number;
        } & TimestampedInsert;
        Update: Partial<Database['public']['Tables']['experience_bullets']['Insert']>;
        Relationships: [];
      };

      bullet_variants: {
        Row: {
          id: string;
          bullet_id: string;
          text: string;
          emphasis_tags: string[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          bullet_id: string;
          text: string;
          emphasis_tags?: string[] | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['bullet_variants']['Insert']>;
        Relationships: [];
      };

      projects: {
        Row: {
          id: string;
          user_id: string;
          profile_id: string;
          name: string;
          role: string | null;
          start_date: string | null;
          end_date: string | null;
          description: string | null;
          tech_stack: string[] | null;
          url: string | null;
          metrics: Json | null;
          skill_tags: string[] | null;
          ord: number;
        } & Timestamped;
        Insert: {
          id?: string;
          user_id: string;
          profile_id: string;
          name: string;
          role?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          description?: string | null;
          tech_stack?: string[] | null;
          url?: string | null;
          metrics?: Json | null;
          skill_tags?: string[] | null;
          ord?: number;
        } & TimestampedInsert;
        Update: Partial<Database['public']['Tables']['projects']['Insert']>;
        Relationships: [];
      };

      skills: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          category: SkillCategory;
          proficiency: number | null;
          years_experience: number | null;
        } & Timestamped;
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          category: SkillCategory;
          proficiency?: number | null;
          years_experience?: number | null;
        } & TimestampedInsert;
        Update: Partial<Database['public']['Tables']['skills']['Insert']>;
        Relationships: [];
      };

      education: {
        Row: {
          id: string;
          user_id: string;
          profile_id: string;
          institution: string;
          degree: string | null;
          field: string | null;
          start_date: string | null;
          end_date: string | null;
          gpa: number | null;
          coursework: string[] | null;
          honors: string[] | null;
          ord: number;
        } & Timestamped;
        Insert: {
          id?: string;
          user_id: string;
          profile_id: string;
          institution: string;
          degree?: string | null;
          field?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          gpa?: number | null;
          coursework?: string[] | null;
          honors?: string[] | null;
          ord?: number;
        } & TimestampedInsert;
        Update: Partial<Database['public']['Tables']['education']['Insert']>;
        Relationships: [];
      };

      stories: {
        Row: {
          id: string;
          user_id: string;
          profile_id: string;
          dimensions: StoryDimension[];
          title: string;
          situation: string;
          task: string;
          action: string;
          result: string;
          reflection: string | null;
          linked_experience_id: string | null;
          linked_project_id: string | null;
        } & Timestamped;
        Insert: {
          id?: string;
          user_id: string;
          profile_id: string;
          dimensions: StoryDimension[];
          title: string;
          situation: string;
          task: string;
          action: string;
          result: string;
          reflection?: string | null;
          linked_experience_id?: string | null;
          linked_project_id?: string | null;
        } & TimestampedInsert;
        Update: Partial<Database['public']['Tables']['stories']['Insert']>;
        Relationships: [];
      };

      preferences: {
        Row: {
          user_id: string;
          experience_levels: ExperienceLevel[];
          work_modes: WorkMode[];
          job_types: JobType[];
          salary_min: number | null;
          salary_max: number | null;
          salary_currency: string;
          locations: string[] | null;
          remote_anywhere: boolean;
          industries_include: string[] | null;
          industries_exclude: string[] | null;
          company_size_min: number | null;
          company_size_max: number | null;
          notice_period_days: number | null;
          willing_to_relocate: boolean;
          daily_app_cap: number;
        } & Timestamped;
        Insert: {
          user_id: string;
          experience_levels?: ExperienceLevel[];
          work_modes?: WorkMode[];
          job_types?: JobType[];
          salary_min?: number | null;
          salary_max?: number | null;
          salary_currency?: string;
          locations?: string[] | null;
          remote_anywhere?: boolean;
          industries_include?: string[] | null;
          industries_exclude?: string[] | null;
          company_size_min?: number | null;
          company_size_max?: number | null;
          notice_period_days?: number | null;
          willing_to_relocate?: boolean;
          daily_app_cap?: number;
        } & TimestampedInsert;
        Update: Partial<Database['public']['Tables']['preferences']['Insert']>;
        Relationships: [];
      };

      question_bank: {
        Row: {
          id: string;
          user_id: string;
          question_key: string;
          question_text: string;
          answer_text: string;
          word_limit: number | null;
          tags: string[] | null;
        } & Timestamped;
        Insert: {
          id?: string;
          user_id: string;
          question_key: string;
          question_text: string;
          answer_text: string;
          word_limit?: number | null;
          tags?: string[] | null;
        } & TimestampedInsert;
        Update: Partial<Database['public']['Tables']['question_bank']['Insert']>;
        Relationships: [];
      };

      skill_profiles: {
        Row: {
          id: string;
          user_id: string;
          skill_id: string;
          experience_id: string | null;
          project_id: string | null;
          weight: number;
        } & Timestamped;
        Insert: {
          id?: string;
          user_id: string;
          skill_id: string;
          experience_id?: string | null;
          project_id?: string | null;
          weight?: number;
        } & TimestampedInsert;
        Update: Partial<Database['public']['Tables']['skill_profiles']['Insert']>;
        Relationships: [];
      };

      profile_audit: {
        Row: {
          id: string;
          user_id: string;
          entity_type: string;
          entity_id: string;
          action: 'insert' | 'update' | 'delete';
          before: Json | null;
          after: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          entity_type: string;
          entity_id: string;
          action: 'insert' | 'update' | 'delete';
          before?: Json | null;
          after?: Json | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profile_audit']['Insert']>;
        Relationships: [];
      };

      // ---- Phase 3 ----
      companies: {
        Row: {
          id: string;
          name: string;
          ats_type: AtsType;
          ats_slug: string;
          careers_url: string | null;
          website: string | null;
          industry: string | null;
          size_min: number | null;
          size_max: number | null;
          research_pack: Json | null;
          last_crawled_at: string | null;
          priority: number;
        } & Timestamped;
        Insert: {
          id?: string;
          name: string;
          ats_type: AtsType;
          ats_slug: string;
          careers_url?: string | null;
          website?: string | null;
          industry?: string | null;
          size_min?: number | null;
          size_max?: number | null;
          research_pack?: Json | null;
          last_crawled_at?: string | null;
          priority?: number;
        } & TimestampedInsert;
        Update: Partial<Database['public']['Tables']['companies']['Insert']>;
        Relationships: [];
      };

      jobs: {
        Row: {
          id: string;
          company_id: string;
          external_id: string;
          title: string;
          normalized_title: string | null;
          location: string | null;
          remote_policy: WorkMode | null;
          description: string;
          description_hash: string;
          salary_min: number | null;
          salary_max: number | null;
          salary_currency: string | null;
          apply_url: string;
          posted_at: string | null;
          first_seen_at: string;
          last_seen_at: string;
          status: string;
          canonical_job_id: string | null;
          raw_payload: Json | null;
        } & Timestamped;
        Insert: {
          id?: string;
          company_id: string;
          external_id: string;
          title: string;
          normalized_title?: string | null;
          location?: string | null;
          remote_policy?: WorkMode | null;
          description: string;
          description_hash: string;
          salary_min?: number | null;
          salary_max?: number | null;
          salary_currency?: string | null;
          apply_url: string;
          posted_at?: string | null;
          first_seen_at?: string;
          last_seen_at?: string;
          status?: string;
          canonical_job_id?: string | null;
          raw_payload?: Json | null;
        } & TimestampedInsert;
        Update: Partial<Database['public']['Tables']['jobs']['Insert']>;
        Relationships: [];
      };

      job_crawl_runs: {
        Row: {
          id: string;
          company_id: string | null;
          started_at: string;
          completed_at: string | null;
          jobs_found: number | null;
          jobs_new: number | null;
          jobs_updated: number | null;
          error: string | null;
        };
        Insert: {
          id?: string;
          company_id?: string | null;
          started_at?: string;
          completed_at?: string | null;
          jobs_found?: number | null;
          jobs_new?: number | null;
          jobs_updated?: number | null;
          error?: string | null;
        };
        Update: Partial<Database['public']['Tables']['job_crawl_runs']['Insert']>;
        Relationships: [];
      };

      // ---- Phase 4 ----
      job_embeddings: {
        Row: {
          job_id: string;
          jd_embedding: string; // pgvector serialized
          parsed_jd: Json;
        } & Timestamped;
        Insert: {
          job_id: string;
          jd_embedding: string;
          parsed_jd: Json;
        } & TimestampedInsert;
        Update: Partial<Database['public']['Tables']['job_embeddings']['Insert']>;
        Relationships: [];
      };

      job_scores: {
        Row: {
          id: string;
          user_id: string;
          job_id: string;
          profile_version_hash: string;
          hard_filter_pass: boolean;
          hard_filter_reasons: string[] | null;
          semantic_score: number | null;
          overall_score: number | null;
          dimensions: Json | null;
          must_have_gaps: string[] | null;
          judge_reasoning: string | null;
          tier: 'auto_apply' | 'pending_review' | 'needs_decision' | 'low_fit' | 'rejected';
        } & Timestamped;
        Insert: {
          id?: string;
          user_id: string;
          job_id: string;
          profile_version_hash: string;
          hard_filter_pass: boolean;
          hard_filter_reasons?: string[] | null;
          semantic_score?: number | null;
          overall_score?: number | null;
          dimensions?: Json | null;
          must_have_gaps?: string[] | null;
          judge_reasoning?: string | null;
          tier: 'auto_apply' | 'pending_review' | 'needs_decision' | 'low_fit' | 'rejected';
        } & TimestampedInsert;
        Update: Partial<Database['public']['Tables']['job_scores']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      experience_level: ExperienceLevel;
      work_mode: WorkMode;
      job_type: JobType;
      skill_category: SkillCategory;
      story_dimension: StoryDimension;
      ats_type: AtsType;
    };
    CompositeTypes: Record<string, never>;
  };
}
