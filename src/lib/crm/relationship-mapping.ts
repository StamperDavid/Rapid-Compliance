/**
 * Relationship Mapping & Stakeholder Tracking
 * Maps relationships between contacts, companies, and deals
 */

import { FirestoreService } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';

export interface Relationship {
  id: string;
  workspaceId: string;
  fromEntityType: 'contact' | 'company' | 'lead';
  fromEntityId: string;
  fromEntityName?: string;
  toEntityType: 'contact' | 'company' | 'deal';
  toEntityId: string;
  toEntityName?: string;
  relationshipType: RelationshipType;
  role?: string; // e.g., "Decision Maker", "Influencer", "Champion"
  influence?: number; // 0-100
  notes?: string;
  createdAt: Date | string;
  updatedAt?: Date | string;
}

export type RelationshipType = 
  | 'works_at' // Contact works at Company
  | 'reports_to' // Contact reports to Contact
  | 'stakeholder' // Contact is stakeholder in Deal
  | 'partner' // Company is partner with Company
  | 'parent_company' // Company is parent of Company
  | 'subsidiary'; // Company is subsidiary of Company

export interface StakeholderMap {
  dealId: string;
  stakeholders: Stakeholder[];
  orgChart?: OrgChartNode[];
  buyingCommittee?: BuyingCommitteeAnalysis;
}

export interface Stakeholder {
  contactId: string;
  contactName: string;
  role: string;
  influence: number; // 0-100
  engagement: number; // 0-100
  sentiment: 'positive' | 'neutral' | 'negative';
  isChampion?: boolean;
  isDecisionMaker?: boolean;
  isBlocker?: boolean;
}

export interface OrgChartNode {
  contactId: string;
  contactName: string;
  title?: string;
  reportsTo?: string; // contactId
  subordinates: string[]; // contactIds
  level: number;
}

export interface BuyingCommitteeAnalysis {
  decisionMakers: number;
  influencers: number;
  champions: number;
  blockers: number;
  overallSentiment: 'positive' | 'neutral' | 'negative';
  engagementScore: number; // 0-100
  readiness: 'not_ready' | 'evaluating' | 'ready_to_buy';
}

/**
 * Create a relationship
 */
export async function createRelationship(
  workspaceId: string,
  data: Omit<Relationship, 'id' | 'workspaceId' | 'createdAt'>
): Promise<Relationship> {
  try {
    const relationshipId = `rel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const relationship: Relationship = {
      ...data,
      id: relationshipId,
      workspaceId,
      createdAt: now,
      updatedAt: now,
    };

    await FirestoreService.set(
      `${getSubCollection('workspaces')}/${workspaceId}/relationships`,
      relationshipId,
      relationship,
      false
    );

    logger.info('Relationship created', {
      relationshipId,
      type: relationship.relationshipType,
    });

    return relationship;
  } catch (error) {
    logger.error('Failed to create relationship', error instanceof Error ? error : new Error(String(error)));
    throw new Error(`Failed to create relationship: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get relationships for an entity
 */
export async function getEntityRelationships(
  workspaceId: string,
  entityType: string,
  entityId: string
): Promise<Relationship[]> {
  try {
    const allRels = await FirestoreService.getAll<Relationship>(
      `${getSubCollection('workspaces')}/${workspaceId}/relationships`
    );

    const filtered = allRels.filter(
      rel =>
        (rel.fromEntityType === entityType && rel.fromEntityId === entityId) ||
        (rel.toEntityType === entityType && rel.toEntityId === entityId)
    );

    return filtered;
  } catch (error) {
    logger.error('Failed to get relationships', error instanceof Error ? error : new Error(String(error)));
    return [];
  }
}

/**
 * Get stakeholder map for a deal
 */
export async function getDealStakeholderMap(
  workspaceId: string,
  dealId: string
): Promise<StakeholderMap> {
  try {
    // Get all stakeholder relationships for this deal
    const allRels = await getEntityRelationships(workspaceId, 'deal', dealId);
    const stakeholderRels = allRels.filter(r => r.relationshipType === 'stakeholder');

    // Get activity stats for each stakeholder
    const { getActivityStats } = await import('./activity-service');

    const stakeholders: Stakeholder[] = [];

    for (const rel of stakeholderRels) {
      const contactId = rel.fromEntityId;
      const activityStats = await getActivityStats(workspaceId, 'contact', contactId);
      
      stakeholders.push({
        contactId,
        contactName: rel.fromEntityName ?? 'Unknown',
        role: rel.role ?? 'Stakeholder',
        influence: rel.influence ?? 50,
        engagement: activityStats.engagementScore ?? 0,
        sentiment: determineSentiment(activityStats),
        isChampion: rel.role?.toLowerCase().includes('champion'),
        isDecisionMaker: rel.role?.toLowerCase().includes('decision maker'),
        isBlocker: rel.role?.toLowerCase().includes('blocker'),
      });
    }

    // Build org chart
    const orgChart = await buildOrgChart(workspaceId, stakeholders);

    // Analyze buying committee
    const buyingCommittee = analyzeBuyingCommittee(stakeholders);

    return {
      dealId,
      stakeholders,
      orgChart,
      buyingCommittee,
    };
  } catch (error) {
    logger.error('Failed to get stakeholder map', error instanceof Error ? error : new Error(String(error)));
    throw new Error(`Failed to get stakeholder map: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Build org chart from stakeholders
 */
async function buildOrgChart(
  workspaceId: string,
  stakeholders: Stakeholder[]
): Promise<OrgChartNode[]> {
  // Get reporting relationships
  const nodes: OrgChartNode[] = [];

  for (const stakeholder of stakeholders) {
    const relationships = await getEntityRelationships(
      workspaceId,
      'contact',
      stakeholder.contactId
    );
    
    const reportsToRel = relationships.find(r => r.relationshipType === 'reports_to');
    const subordinateRels = relationships.filter(r => 
      r.relationshipType === 'reports_to' && r.toEntityId === stakeholder.contactId
    );
    
    nodes.push({
      contactId: stakeholder.contactId,
      contactName: stakeholder.contactName,
      title: stakeholder.role,
      reportsTo: reportsToRel?.toEntityId,
      subordinates: subordinateRels.map(r => r.fromEntityId),
      level: 0, // Would calculate based on hierarchy depth
    });
  }

  return nodes;
}

/**
 * Analyze buying committee composition
 */
function analyzeBuyingCommittee(stakeholders: Stakeholder[]): BuyingCommitteeAnalysis {
  const decisionMakers = stakeholders.filter(s => s.isDecisionMaker).length;
  const champions = stakeholders.filter(s => s.isChampion).length;
  const blockers = stakeholders.filter(s => s.isBlocker).length;
  const influencers = stakeholders.length - decisionMakers - champions - blockers;

  // Calculate overall sentiment
  const sentimentScores = stakeholders.map(s => 
    s.sentiment === 'positive' ? 1 : s.sentiment === 'negative' ? -1 : 0
  );
  const avgSentiment = sentimentScores.reduce((sum: number, s) => sum + s, 0) / sentimentScores.length;
  const overallSentiment = avgSentiment > 0.3 ? 'positive' : avgSentiment < -0.3 ? 'negative' : 'neutral';

  // Calculate engagement score
  const engagementScore = stakeholders.length > 0
    ? Math.round(stakeholders.reduce((sum, s) => sum + s.engagement, 0) / stakeholders.length)
    : 0;

  // Determine readiness
  let readiness: BuyingCommitteeAnalysis['readiness'] = 'not_ready';
  if (decisionMakers > 0 && champions > 0 && engagementScore > 60 && overallSentiment === 'positive') {
    readiness = 'ready_to_buy';
  } else if (stakeholders.length >= 2 && engagementScore > 40) {
    readiness = 'evaluating';
  }

  return {
    decisionMakers,
    influencers,
    champions,
    blockers,
    overallSentiment,
    engagementScore,
    readiness,
  };
}

interface ActivityStatsResult {
  engagementScore?: number;
}

/**
 * Determine sentiment from activity stats
 */
function determineSentiment(activityStats: ActivityStatsResult): 'positive' | 'neutral' | 'negative' {
  // Simple heuristic based on engagement
  const engagement = activityStats.engagementScore ?? 0;
  if (engagement > 70) {return 'positive';}
  if (engagement < 30) {return 'negative';}
  return 'neutral';
}

