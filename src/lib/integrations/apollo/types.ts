/**
 * Apollo.io Integration Types
 * Request params, response shapes, service result wrapper, credit tracking.
 */

// ── Request Params ─────────────────────────────────────────────────────────

export interface ApolloPersonSearchParams {
  q_person_titles?: string[];
  person_seniorities?: string[];
  q_person_locations?: string[];
  q_organization_domains?: string[];
  organization_num_employees_ranges?: string[]; // e.g. ["1,10", "11,50"]
  q_keywords?: string;
  page?: number;
  per_page?: number; // max 100
}

export interface ApolloOrgSearchParams {
  q_organization_keyword_tags?: string[];
  organization_num_employees_ranges?: string[];
  q_organization_locations?: string[];
  q_keywords?: string;
  page?: number;
  per_page?: number;
}

export interface ApolloPersonEnrichParams {
  first_name?: string;
  last_name?: string;
  email?: string;
  domain?: string;
  organization_name?: string;
  linkedin_url?: string;
}

export interface ApolloOrgEnrichParams {
  domain: string;
}

// ── Response Shapes ────────────────────────────────────────────────────────

export interface ApolloPhoneNumber {
  raw_number: string;
  sanitized_number: string;
  type: string;
  position: number;
}

export interface ApolloEmploymentHistory {
  organization_name: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  current: boolean;
}

export interface ApolloPersonOrganization {
  id: string;
  name: string;
  website_url: string | null;
  industry: string | null;
  estimated_num_employees: number | null;
  linkedin_url: string | null;
}

export interface ApolloPerson {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  title: string | null;
  seniority: string | null;
  email: string | null;
  email_status: string | null; // 'verified' | 'guessed' | 'unavailable' etc.
  linkedin_url: string | null;
  phone_numbers: ApolloPhoneNumber[];
  organization: ApolloPersonOrganization | null;
  employment_history: ApolloEmploymentHistory[];
  city: string | null;
  state: string | null;
  country: string | null;
}

export interface ApolloOrganization {
  id: string;
  name: string;
  website_url: string | null;
  domain: string | null;
  industry: string | null;
  estimated_num_employees: number | null;
  city: string | null;
  state: string | null;
  country: string | null;
  founded_year: number | null;
  technologies: string[];
  total_funding: number | null;
  latest_funding_stage: string | null;
  latest_funding_round_date: string | null;
  annual_revenue_printed: string | null;
  linkedin_url: string | null;
  twitter_url: string | null;
  short_description: string | null;
}

export interface ApolloPersonSearchResponse {
  people: ApolloPerson[];
  pagination: {
    page: number;
    per_page: number;
    total_entries: number;
    total_pages: number;
  };
}

export interface ApolloOrgSearchResponse {
  organizations: ApolloOrganization[];
  pagination: {
    page: number;
    per_page: number;
    total_entries: number;
    total_pages: number;
  };
}

// ── Service Result Wrapper ─────────────────────────────────────────────────

export interface ApolloServiceResult<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  creditsUsed: number;
  cached: boolean;
}

// ── Credit Tracking ────────────────────────────────────────────────────────

export interface ApolloCreditsSnapshot {
  creditsUsedToday: number;
  creditsUsedThisMonth: number;
  searchCallsThisHour: number;
  lastUpdated: string;
}
