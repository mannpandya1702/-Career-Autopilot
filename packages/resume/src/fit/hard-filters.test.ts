import { describe, expect, it } from 'vitest';
import { runHardFilters, type HardFilterInput } from './hard-filters';

const BASE_PREFS: HardFilterInput['preferences'] = {
  experience_levels: ['mid', 'senior'],
  work_modes: ['remote', 'hybrid'],
  job_types: ['full_time'],
  salary_min: 100_000,
  salary_currency: 'USD',
  locations: ['San Francisco', 'New York'],
  remote_anywhere: false,
  industries_exclude: ['tobacco'],
  willing_to_relocate: false,
};

const BASE_JOB: HardFilterInput['job'] = {
  title: 'Senior Engineer',
  description: 'Full-time senior engineering role.',
  location: 'San Francisco',
  remote_policy: 'remote',
  salary_min: 140_000,
  salary_max: 180_000,
  salary_currency: 'USD',
};

describe('runHardFilters', () => {
  it('passes a matching job', () => {
    const result = runHardFilters({ job: BASE_JOB, preferences: BASE_PREFS });
    expect(result.pass).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it('rejects onsite when only remote/hybrid accepted', () => {
    const result = runHardFilters({
      job: { ...BASE_JOB, remote_policy: 'onsite' },
      preferences: BASE_PREFS,
    });
    expect(result.pass).toBe(false);
    expect(result.reasons[0]).toMatch(/onsite/);
  });

  it('passes remote when remote_anywhere=true even if work_modes excludes remote', () => {
    const result = runHardFilters({
      job: BASE_JOB,
      preferences: {
        ...BASE_PREFS,
        work_modes: ['onsite'],
        remote_anywhere: true,
      },
    });
    expect(result.pass).toBe(true);
  });

  it('rejects salary below floor when currencies match', () => {
    const result = runHardFilters({
      job: { ...BASE_JOB, salary_max: 60_000 },
      preferences: BASE_PREFS,
    });
    expect(result.pass).toBe(false);
    expect(result.reasons[0]).toMatch(/salary max/);
  });

  it('does not reject on salary when currency differs', () => {
    const result = runHardFilters({
      job: { ...BASE_JOB, salary_max: 60_000, salary_currency: 'EUR' },
      preferences: BASE_PREFS,
    });
    expect(result.pass).toBe(true);
  });

  it('rejects an excluded industry when parsed_jd carries it', () => {
    const result = runHardFilters({
      job: {
        ...BASE_JOB,
        parsed_jd: {
          must_have_skills: [],
          nice_to_have_skills: [],
          required_years_experience: null,
          required_education: null,
          role_seniority: 'senior',
          work_authorization_required: null,
          tech_stack: [],
          industry_domain: 'tobacco',
          red_flags: [],
          keywords: [],
          acronyms: [],
        },
      },
      preferences: BASE_PREFS,
    });
    expect(result.pass).toBe(false);
    expect(result.reasons[0]).toMatch(/tobacco/);
  });

  it('rejects contract role when only full_time preferred', () => {
    const result = runHardFilters({
      job: {
        ...BASE_JOB,
        title: 'Senior Engineer (Contract)',
        description: '6-month contract role.',
      },
      preferences: BASE_PREFS,
    });
    expect(result.pass).toBe(false);
    expect(result.reasons[0]).toMatch(/contract/);
  });

  it('accepts a location that is a prefix match (no structured parse yet)', () => {
    const result = runHardFilters({
      job: { ...BASE_JOB, location: 'San Francisco, CA', remote_policy: 'onsite' },
      preferences: {
        ...BASE_PREFS,
        work_modes: ['onsite'],
      },
    });
    expect(result.pass).toBe(true);
  });

  it('rejects a location not in allowed list and not remote', () => {
    const result = runHardFilters({
      job: { ...BASE_JOB, location: 'Austin, TX', remote_policy: 'onsite' },
      preferences: {
        ...BASE_PREFS,
        work_modes: ['onsite'],
      },
    });
    expect(result.pass).toBe(false);
    expect(result.reasons.some((r) => r.includes('Austin'))).toBe(true);
  });
});
