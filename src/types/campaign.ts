/**
 * Campaign Orchestration Pipeline — Type Definitions
 *
 * Unified data model tying blog + video + social + email + image deliverables
 * together under a single campaign brief for Mission Review.
 *
 * Firestore paths:
 * - organizations/{PLATFORM_ID}/campaigns/{campaignId}
 * - organizations/{PLATFORM_ID}/campaigns/{campaignId}/deliverables/{deliverableId}
 *
 * @module types/campaign
 */

import { z } from 'zod';

// ============================================================================
// DELIVERABLE
// ============================================================================

export const DELIVERABLE_TYPES = [
  'blog',
  'video',
  'social_post',
  'image',
  'email',
  'research',
  'strategy',
  'landing_page',
] as const;

export type DeliverableType = (typeof DELIVERABLE_TYPES)[number];

export const DELIVERABLE_STATUSES = [
  'drafting',
  'pending_review',
  'approved',
  'rejected',
  'revision_requested',
  'published',
] as const;

export type DeliverableStatus = (typeof DELIVERABLE_STATUSES)[number];

export interface CampaignDeliverable {
  id: string;
  campaignId: string;
  missionId: string;
  type: DeliverableType;
  title: string;
  status: DeliverableStatus;
  /** Type-specific preview content (e.g. projectId, excerpt, copy) */
  previewData: Record<string, unknown>;
  /** Deep link to full editor/viewer */
  reviewLink: string;
  /** Client's rejection/revision notes */
  feedback?: string;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  publishedAt?: string;
  /** Mission ID created for revising this deliverable */
  revisionMissionId?: string;
}

// ============================================================================
// CAMPAIGN
// ============================================================================

export const CAMPAIGN_STATUSES = [
  'researching',
  'strategizing',
  'producing',
  'pending_review',
  'approved',
  'published',
] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export interface Campaign {
  id: string;
  missionId: string;
  /** Original client request */
  brief: string;
  /** Findings from research phase */
  research?: Record<string, unknown>;
  /** Positioning, messaging, audience */
  strategy?: Record<string, unknown>;
  /** Deliverable IDs */
  deliverables: string[];
  status: CampaignStatus;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// ZOD SCHEMAS — API Validation
// ============================================================================

export const CreateCampaignSchema = z.object({
  missionId: z.string().min(1, 'missionId is required'),
  brief: z.string().min(1, 'brief is required'),
  research: z.record(z.unknown()).optional(),
  strategy: z.record(z.unknown()).optional(),
  status: z.enum(CAMPAIGN_STATUSES).optional(),
});

export type CreateCampaignInput = z.infer<typeof CreateCampaignSchema>;

export const UpdateCampaignSchema = z.object({
  brief: z.string().min(1).optional(),
  research: z.record(z.unknown()).optional(),
  strategy: z.record(z.unknown()).optional(),
  status: z.enum(CAMPAIGN_STATUSES).optional(),
});

export type UpdateCampaignInput = z.infer<typeof UpdateCampaignSchema>;

export const CreateDeliverableSchema = z.object({
  missionId: z.string().min(1, 'missionId is required'),
  type: z.enum(DELIVERABLE_TYPES),
  title: z.string().min(1, 'title is required'),
  status: z.enum(DELIVERABLE_STATUSES).optional(),
  previewData: z.record(z.unknown()).default({}),
  reviewLink: z.string().min(1, 'reviewLink is required'),
  feedback: z.string().optional(),
});

export type CreateDeliverableInput = z.infer<typeof CreateDeliverableSchema>;

export const UpdateDeliverableSchema = z.object({
  status: z.enum(DELIVERABLE_STATUSES).optional(),
  feedback: z.string().optional(),
  previewData: z.record(z.unknown()).optional(),
  title: z.string().min(1).optional(),
  reviewLink: z.string().min(1).optional(),
});

export type UpdateDeliverableInput = z.infer<typeof UpdateDeliverableSchema>;
