/**
 * Lead Research Types
 *
 * Types for the consolidated Lead Research page:
 * URL sources, research schedule, chat messages, and field selections.
 */

// ── URL Sources ─────────────────────────────────────────────────────────────

export type UrlSourceStatus = 'pending' | 'scraping' | 'scraped' | 'failed';

export interface UrlSource {
  id: string;
  url: string;
  label?: string;
  status: UrlSourceStatus;
  signalsFound?: number;
  scrapedAt?: string;
  addedAt: string;
  addedBy: string;
  errorMessage?: string;
}

// ── Research Schedule ───────────────────────────────────────────────────────

export type ScheduleFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';

export interface ResearchSchedule {
  enabled: boolean;
  frequency: ScheduleFrequency;
  icpProfileId: string;
  maxResults: number;
  autoApproveThreshold: number; // ICP score >= this → auto-approve
  lastRunAt?: string;
  nextRunAt?: string;
  updatedAt: string;
  updatedBy: string;
}

// ── Chat Messages ───────────────────────────────────────────────────────────

export type ChatRole = 'user' | 'assistant' | 'system' | 'tool';

export interface ResearchChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: string;
  toolCalls?: ResearchToolCall[];
  metadata?: {
    batchId?: string;
    icpProfileId?: string;
    resultsCount?: number;
  };
}

export interface ResearchToolCall {
  name: string;
  args: Record<string, unknown>;
  result?: string;
}

// ── Field Selection ─────────────────────────────────────────────────────────

export interface FieldSelection {
  companyName: boolean;
  website: boolean;
  domain: boolean;
  industry: boolean;
  companySize: boolean;
  employeeCount: boolean;
  location: boolean;
  techStack: boolean;
  fundingStage: boolean;
  revenue: boolean;
  description: boolean;
  icpScore: boolean;
}

export const DEFAULT_FIELD_SELECTION: FieldSelection = {
  companyName: true,
  website: true,
  domain: true,
  industry: true,
  companySize: true,
  employeeCount: true,
  location: true,
  techStack: true,
  fundingStage: false,
  revenue: false,
  description: false,
  icpScore: true,
};

// ── API Payloads ────────────────────────────────────────────────────────────

export interface ResearchChatRequest {
  message: string;
  conversationHistory: Array<{ role: ChatRole; content: string }>;
  icpProfileId?: string;
}

export interface ResearchChatResponse {
  message: string;
  toolCalls?: ResearchToolCall[];
  metadata?: {
    batchId?: string;
    icpProfileId?: string;
    resultsCount?: number;
  };
}

export interface UrlSourceCreateRequest {
  url: string;
  label?: string;
}

export interface ScheduleUpdateRequest {
  enabled?: boolean;
  frequency?: ScheduleFrequency;
  icpProfileId?: string;
  maxResults?: number;
  autoApproveThreshold?: number;
}

export interface CsvExportParams {
  batchId: string;
  status?: string;
  fields?: string;
}
