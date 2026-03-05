/**
 * ICP Profile Service
 *
 * CRUD operations for Ideal Customer Profiles and weighted scoring
 * of company data against ICP criteria.
 *
 * Uses AdminFirestoreService (server-side only).
 */

import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import type { IcpProfile, CreateIcpProfileInput, UpdateIcpProfileInput } from '@/types/icp-profile';
import type { EnrichmentData } from '@/types/crm-entities';

const COLLECTION = 'icp-profiles';

function getCollection(): string {
  return getSubCollection(COLLECTION);
}

// ── CRUD ────────────────────────────────────────────────────────────────────

export async function createIcpProfile(input: CreateIcpProfileInput): Promise<IcpProfile> {
  const id = `icp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const now = new Date().toISOString();

  // If this profile is active, deactivate all others
  if (input.isActive) {
    await deactivateAllProfiles();
  }

  const profile: IcpProfile = {
    ...input,
    id,
    feedbackStats: input.feedbackStats ?? { positiveCount: 0, negativeCount: 0 },
    createdAt: now,
    updatedAt: now,
  };

  await AdminFirestoreService.set(getCollection(), id, profile as unknown as Record<string, unknown>, false);
  logger.info('ICP profile created', { id, name: input.name });
  return profile;
}

export async function getIcpProfile(id: string): Promise<IcpProfile | null> {
  const doc = await AdminFirestoreService.get(getCollection(), id);
  return doc as IcpProfile | null;
}

export async function listIcpProfiles(): Promise<IcpProfile[]> {
  const docs = await AdminFirestoreService.getAll(getCollection(), []);
  return docs as unknown as IcpProfile[];
}

export async function updateIcpProfile(id: string, updates: UpdateIcpProfileInput): Promise<IcpProfile> {
  const existing = await getIcpProfile(id);
  if (!existing) {
    throw new Error(`ICP profile not found: ${id}`);
  }

  // If activating this profile, deactivate all others first
  if (updates.isActive && !existing.isActive) {
    await deactivateAllProfiles();
  }

  const data = {
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await AdminFirestoreService.update(getCollection(), id, data as unknown as Record<string, unknown>);
  logger.info('ICP profile updated', { id, fields: Object.keys(updates) });

  const updated = await getIcpProfile(id);
  if (!updated) {throw new Error('Profile not found after update');}
  return updated;
}

export async function deleteIcpProfile(id: string): Promise<void> {
  await AdminFirestoreService.delete(getCollection(), id);
  logger.info('ICP profile deleted', { id });
}

export async function getActiveIcpProfile(): Promise<IcpProfile | null> {
  const { where } = await import('firebase/firestore');
  const docs = await AdminFirestoreService.getAll(getCollection(), [
    where('isActive', '==', true),
  ]);
  return docs.length > 0 ? (docs[0] as unknown as IcpProfile) : null;
}

async function deactivateAllProfiles(): Promise<void> {
  const { where } = await import('firebase/firestore');
  const activeProfiles = await AdminFirestoreService.getAll(getCollection(), [
    where('isActive', '==', true),
  ]);
  for (const profile of activeProfiles) {
    const p = profile as unknown as IcpProfile;
    await AdminFirestoreService.update(getCollection(), p.id, { isActive: false });
  }
}

// ── SCORING ─────────────────────────────────────────────────────────────────

interface ScoreBreakdown {
  industry: number;
  companySize: number;
  location: number;
  techStack: number;
  fundingStage: number;
  title: number;
  seniority: number;
}

export interface IcpScoreResult {
  totalScore: number;
  breakdown: ScoreBreakdown;
  maxPossibleScore: number;
}

/**
 * Score a company's enrichment data against an ICP profile.
 * Returns 0-100.
 */
export function scoreCompanyAgainstIcp(
  companyData: EnrichmentData,
  profile: IcpProfile
): IcpScoreResult {
  const weights = profile.weights;
  const breakdown: ScoreBreakdown = {
    industry: 0,
    companySize: 0,
    location: 0,
    techStack: 0,
    fundingStage: 0,
    title: 0,
    seniority: 0,
  };

  // Industry match
  if (companyData.industry && profile.targetIndustries.length > 0) {
    const industryLower = companyData.industry.toLowerCase();
    if (profile.excludedIndustries.some(ex => industryLower.includes(ex.toLowerCase()))) {
      breakdown.industry = 0; // Excluded industry = 0
    } else if (profile.targetIndustries.some(ti => industryLower.includes(ti.toLowerCase()))) {
      breakdown.industry = 10;
    } else {
      breakdown.industry = 3; // Known industry but not target
    }
  }

  // Company size match
  if (companyData.employeeCount !== undefined) {
    const count = companyData.employeeCount;
    const { min, max } = profile.companySizeRange;
    if (count >= min && count <= max) {
      breakdown.companySize = 10;
    } else {
      // Partial credit for being close
      const distance = count < min ? (min - count) / min : (count - max) / max;
      breakdown.companySize = Math.max(0, Math.round(10 * (1 - distance)));
    }
  } else if (companyData.companySize) {
    // Rough mapping from category
    const sizeMap: Record<string, number> = {
      startup: 10, small: 25, medium: 150, enterprise: 1000,
    };
    const estimated = sizeMap[companyData.companySize] ?? 0;
    if (estimated > 0) {
      const { min, max } = profile.companySizeRange;
      breakdown.companySize = estimated >= min && estimated <= max ? 7 : 3;
    }
  }

  // Location match
  if (profile.preferredLocations.length > 0) {
    const locParts = [companyData.city, companyData.state, companyData.country].filter(Boolean);
    const locString = locParts.join(' ').toLowerCase();
    if (profile.preferredLocations.some(loc => locString.includes(loc.toLowerCase()))) {
      breakdown.location = 10;
    }
  }

  // Tech stack match
  if (companyData.techStack && companyData.techStack.length > 0 && profile.preferredTechStack.length > 0) {
    const matchCount = companyData.techStack.filter(tech =>
      profile.preferredTechStack.some(pt => tech.toLowerCase().includes(pt.toLowerCase()))
    ).length;
    const matchRatio = matchCount / profile.preferredTechStack.length;
    breakdown.techStack = Math.round(matchRatio * 10);
  }

  // Funding stage match
  if (companyData.fundingStage && profile.preferredFundingStages.length > 0) {
    const stageLower = companyData.fundingStage.toLowerCase();
    if (profile.preferredFundingStages.some(fs => stageLower.includes(fs.toLowerCase()))) {
      breakdown.fundingStage = 10;
    }
  }

  // Title match
  if (companyData.title && profile.targetTitles.length > 0) {
    const titleLower = companyData.title.toLowerCase();
    if (profile.targetTitles.some(tt => titleLower.includes(tt.toLowerCase()))) {
      breakdown.title = 10;
    }
  }

  // Seniority match (inferred from title)
  if (companyData.title && profile.targetSeniority.length > 0) {
    const titleLower = companyData.title.toLowerCase();
    const inferredSeniority = inferSeniority(titleLower);
    if (inferredSeniority && profile.targetSeniority.includes(inferredSeniority)) {
      breakdown.seniority = 10;
    }
  }

  // Calculate weighted total
  const totalWeight = weights.industry + weights.companySize + weights.location +
    weights.techStack + weights.fundingStage + weights.title + weights.seniority;

  if (totalWeight === 0) {
    return { totalScore: 0, breakdown, maxPossibleScore: 0 };
  }

  const weightedScore =
    (breakdown.industry * weights.industry) +
    (breakdown.companySize * weights.companySize) +
    (breakdown.location * weights.location) +
    (breakdown.techStack * weights.techStack) +
    (breakdown.fundingStage * weights.fundingStage) +
    (breakdown.title * weights.title) +
    (breakdown.seniority * weights.seniority);

  const maxPossible = totalWeight * 10;
  const normalizedScore = Math.round((weightedScore / maxPossible) * 100);

  return {
    totalScore: Math.min(100, Math.max(0, normalizedScore)),
    breakdown,
    maxPossibleScore: maxPossible,
  };
}

function inferSeniority(titleLower: string): IcpProfile['targetSeniority'][number] | null {
  if (/\b(ceo|cto|cfo|coo|cmo|chief|founder|co-founder)\b/.test(titleLower)) {return 'c-level';}
  if (/\b(vp|vice president)\b/.test(titleLower)) {return 'vp';}
  if (/\bdirector\b/.test(titleLower)) {return 'director';}
  if (/\bmanager\b/.test(titleLower)) {return 'manager';}
  return 'individual';
}
