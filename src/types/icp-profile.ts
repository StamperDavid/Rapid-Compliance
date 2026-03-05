/**
 * Ideal Customer Profile (ICP) Types
 *
 * Defines target demographics for lead discovery.
 * Used by the discovery engine to score and filter prospective companies.
 */

import { z } from 'zod';
import type { FirestoreDate } from './crm-entities';

export type SeniorityLevel = 'c-level' | 'vp' | 'director' | 'manager' | 'individual';

export interface IcpProfile {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;

  // Company criteria
  targetIndustries: string[];
  excludedIndustries: string[];
  companySizeRange: { min: number; max: number };
  preferredLocations: string[];
  preferredTechStack: string[];
  preferredFundingStages: string[];
  revenueRange?: { min: number; max: number };

  // Person criteria
  targetTitles: string[];
  targetDepartments: string[];
  targetSeniority: SeniorityLevel[];

  // Scoring weights (0-10 for each criterion)
  weights: {
    industry: number;
    companySize: number;
    location: number;
    techStack: number;
    fundingStage: number;
    title: number;
    seniority: number;
  };

  // Positive/negative example companies for reference
  exampleCompanies: Array<{ domain: string; isPositive: boolean }>;

  // Feedback-driven learning
  feedbackStats: { positiveCount: number; negativeCount: number };

  // Metadata
  createdAt: FirestoreDate;
  updatedAt: FirestoreDate;
  createdBy: string;
}

export type CreateIcpProfileInput = Omit<IcpProfile, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateIcpProfileInput = Partial<Omit<IcpProfile, 'id' | 'createdAt' | 'createdBy'>>;

// ── Zod Schemas ─────────────────────────────────────────────────────────────

const seniorityLevelSchema = z.enum(['c-level', 'vp', 'director', 'manager', 'individual']);

export const IcpProfileSchema = z.object({
  name: z.string().min(1, 'Profile name is required').max(100),
  description: z.string().max(500).optional(),
  isActive: z.boolean().default(false),

  targetIndustries: z.array(z.string()).default([]),
  excludedIndustries: z.array(z.string()).default([]),
  companySizeRange: z.object({
    min: z.number().int().min(0).default(1),
    max: z.number().int().min(1).default(10000),
  }).default({ min: 1, max: 10000 }),
  preferredLocations: z.array(z.string()).default([]),
  preferredTechStack: z.array(z.string()).default([]),
  preferredFundingStages: z.array(z.string()).default([]),
  revenueRange: z.object({
    min: z.number().min(0),
    max: z.number().min(0),
  }).optional(),

  targetTitles: z.array(z.string()).default([]),
  targetDepartments: z.array(z.string()).default([]),
  targetSeniority: z.array(seniorityLevelSchema).default([]),

  weights: z.object({
    industry: z.number().min(0).max(10).default(5),
    companySize: z.number().min(0).max(10).default(5),
    location: z.number().min(0).max(10).default(3),
    techStack: z.number().min(0).max(10).default(3),
    fundingStage: z.number().min(0).max(10).default(2),
    title: z.number().min(0).max(10).default(4),
    seniority: z.number().min(0).max(10).default(4),
  }).default({
    industry: 5, companySize: 5, location: 3,
    techStack: 3, fundingStage: 2, title: 4, seniority: 4,
  }),

  exampleCompanies: z.array(z.object({
    domain: z.string().min(1),
    isPositive: z.boolean(),
  })).default([]),
});

export type IcpProfileFormData = z.infer<typeof IcpProfileSchema>;
