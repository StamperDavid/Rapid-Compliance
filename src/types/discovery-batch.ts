/**
 * Discovery Batch & Result Types
 *
 * Used by the discovery engine to find, score, and track
 * companies matching an ICP profile.
 */

import type { FirestoreDate, EnrichmentData } from './crm-entities';

export type DiscoveryBatchStatus = 'queued' | 'running' | 'completed' | 'failed';
export type DiscoveryResultStatus = 'pending' | 'approved' | 'rejected' | 'converted';

export interface DiscoverySearchCriteria {
  keywords: string[];
  companyNames?: string[];
  domains?: string[];
  maxResults: number;
}

export interface DiscoveryBatch {
  id: string;
  icpProfileId: string;
  icpProfileName: string;
  status: DiscoveryBatchStatus;
  searchCriteria: DiscoverySearchCriteria;

  // Progress tracking
  totalFound: number;
  totalScored: number;
  totalApproved: number;
  totalRejected: number;
  totalConverted: number;

  // Metadata
  startedAt: FirestoreDate;
  completedAt?: FirestoreDate;
  createdBy: string;
  errorMessage?: string;
}

export interface IcpScoreBreakdown {
  industry: number;
  companySize: number;
  location: number;
  techStack: number;
  fundingStage: number;
  title: number;
  seniority: number;
}

export interface DiscoveryResult {
  id: string;
  batchId: string;
  icpProfileId: string;

  // Company data (from enrichment)
  companyData: EnrichmentData;

  // Scoring
  icpScore: number;
  icpScoreBreakdown: IcpScoreBreakdown;

  // Review workflow
  status: DiscoveryResultStatus;
  reviewedBy?: string;
  reviewedAt?: FirestoreDate;
  rejectionNotes?: string;

  // Conversion tracking
  leadId?: string;
  convertedAt?: FirestoreDate;

  // Metadata
  createdAt: FirestoreDate;
}

export type CreateDiscoveryBatchInput = Omit<DiscoveryBatch, 'id' | 'startedAt' | 'completedAt' | 'totalFound' | 'totalScored' | 'totalApproved' | 'totalRejected' | 'totalConverted'>;
