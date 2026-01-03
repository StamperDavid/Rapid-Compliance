/**
 * Lead Routing Engine
 * - Round-robin distribution
 * - Territory-based routing (ZIP, state, country, industry)
 * - Skill-based routing
 * - Load balancing
 * - Re-assignment rules
 */

import { FirestoreService } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import type { Lead } from './lead-service';

export interface RoutingRule {
  id: string;
  organizationId: string;
  name: string;
  enabled: boolean;
  priority: number; // Higher priority rules evaluated first
  routingType: 'round-robin' | 'territory' | 'skill-based' | 'load-balance' | 'custom';
  assignedUsers: string[]; // User IDs eligible for assignment
  conditions?: RoutingCondition[];
  metadata?: {
    // Territory-based
    territories?: Array<{
      userId: string;
      states?: string[];
      zipcodes?: string[];
      countries?: string[];
      industries?: string[];
    }>;
    
    // Skill-based
    skills?: Array<{
      userId: string;
      skills: string[]; // e.g., ["Spanish", "Enterprise Sales", "Technical"]
    }>;
    
    // Load balancing
    maxLeadsPerUser?: number;
    balancingPeriod?: 'day' | 'week' | 'month';
  };
  createdAt: Date;
  updatedAt?: Date;
}

export interface RoutingCondition {
  field: string; // Lead field to check
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in';
  value: any;
}

export interface RoutingResult {
  assignedTo: string;
  assignedToName?: string;
  routingRuleId: string;
  routingRuleName: string;
  reason: string;
}

/**
 * Route a lead to the appropriate user
 */
export async function routeLead(
  organizationId: string,
  workspaceId: string,
  lead: Lead
): Promise<RoutingResult> {
  try {
    // Get all routing rules for this organization
    const rulesResult = await FirestoreService.getAll<RoutingRule>(
      `organizations/${organizationId}/leadRoutingRules`
    );

    const rules = rulesResult
      .filter(r => r.enabled)
      .sort((a, b) => b.priority - a.priority); // Higher priority first

    // Evaluate rules in order
    for (const rule of rules) {
      // Check if conditions match
      if (rule.conditions && !evaluateConditions(lead, rule.conditions)) {
        continue; // Rule doesn't apply to this lead
      }

      // Apply routing strategy
      let assignedUserId: string | null = null;

      switch (rule.routingType) {
        case 'round-robin':
          assignedUserId = await getRoundRobinUser(organizationId, rule.id, rule.assignedUsers);
          break;

        case 'territory':
          assignedUserId = await getTerritoryUser(lead, rule);
          break;

        case 'load-balance':
          assignedUserId = await getLoadBalancedUser(organizationId, workspaceId, rule);
          break;

        case 'skill-based':
          assignedUserId = await getSkillBasedUser(lead, rule);
          break;

        default:
          assignedUserId = rule.assignedUsers[0]; // Fallback to first user
      }

      if (assignedUserId) {
        logger.info('Lead routed', {
          leadId: lead.id,
          assignedTo: assignedUserId,
          routingRule: rule.name,
          routingType: rule.routingType,
        });

        return {
          assignedTo: assignedUserId,
          routingRuleId: rule.id,
          routingRuleName: rule.name,
          reason: `Assigned via ${rule.routingType} (${rule.name})`,
        };
      }
    }

    // No rule matched - use default round-robin
    const defaultUserId = await getDefaultAssignment(organizationId);

    return {
      assignedTo: defaultUserId,
      routingRuleId: 'default',
      routingRuleName: 'Default Assignment',
      reason: 'No routing rules matched - assigned to default user',
    };

  } catch (error: any) {
    logger.error('Lead routing failed', error, { leadId: lead.id });
    throw error;
  }
}

/**
 * Evaluate if lead matches routing conditions
 */
function evaluateConditions(lead: Lead, conditions: RoutingCondition[]): boolean {
  return conditions.every(condition => {
    const leadValue = (lead as any)[condition.field];

    switch (condition.operator) {
      case 'equals':
        return leadValue === condition.value;
      
      case 'contains':
        return String(leadValue).toLowerCase().includes(String(condition.value).toLowerCase());
      
      case 'greater_than':
        return leadValue > condition.value;
      
      case 'less_than':
        return leadValue < condition.value;
      
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(leadValue);
      
      default:
        return false;
    }
  });
}

/**
 * Get round-robin assignment
 */
async function getRoundRobinUser(
  organizationId: string,
  ruleId: string,
  userIds: string[]
): Promise<string> {
  try {
    const state = await FirestoreService.get<{ lastIndex: number }>(
      `organizations/${organizationId}/leadRoutingRules/${ruleId}/state`,
      'roundRobin'
    );

    const lastIndex = state?.lastIndex ?? -1;
    const nextIndex = (lastIndex + 1) % userIds.length;
    const assignedUserId = userIds[nextIndex];

    await FirestoreService.set(
      `organizations/${organizationId}/leadRoutingRules/${ruleId}/state`,
      'roundRobin',
      { lastIndex: nextIndex, updatedAt: new Date() },
      true
    );

    return assignedUserId;

  } catch (error) {
    return userIds[0];
  }
}

/**
 * Get territory-based assignment
 */
async function getTerritoryUser(lead: Lead, rule: RoutingRule): Promise<string | null> {
  const territories = rule.metadata?.territories || [];

  for (const territory of territories) {
    // Check state match
    if (territory.states && lead.customFields?.state) {
      if (territory.states.includes(lead.customFields.state)) {
        return territory.userId;
      }
    }

    // Check country match
    if (territory.countries && lead.customFields?.country) {
      if (territory.countries.includes(lead.customFields.country)) {
        return territory.userId;
      }
    }

    // Check industry match
    if (territory.industries && lead.enrichmentData?.industry) {
      if (territory.industries.includes(lead.enrichmentData.industry)) {
        return territory.userId;
      }
    }
  }

  return null;
}

/**
 * Get load-balanced assignment
 */
async function getLoadBalancedUser(
  organizationId: string,
  workspaceId: string,
  rule: RoutingRule
): Promise<string> {
  try {
    const maxLeads = rule.metadata?.maxLeadsPerUser || 100;
    const period = rule.metadata?.balancingPeriod || 'week';

    // Get lead counts for each user in the period
    const userCounts = new Map<string, number>();

    for (const userId of rule.assignedUsers) {
      const count = await getUserLeadCount(organizationId, workspaceId, userId, period);
      userCounts.set(userId, count);
    }

    // Find user with lowest count under max
    let minCount = Infinity;
    let selectedUser = rule.assignedUsers[0];

    userCounts.forEach((count, userId) => {
      if (count < maxLeads && count < minCount) {
        minCount = count;
        selectedUser = userId;
      }
    });

    return selectedUser;

  } catch (error) {
    logger.warn('Load balancing failed, using first user', error as Error);
    return rule.assignedUsers[0];
  }
}

/**
 * Get user's lead count in period
 */
async function getUserLeadCount(
  organizationId: string,
  workspaceId: string,
  userId: string,
  period: 'day' | 'week' | 'month'
): Promise<number> {
  try {
    const { getLeads } = await import('./lead-service');
    
    const since = new Date();
    if (period === 'day') since.setDate(since.getDate() - 1);
    else if (period === 'week') since.setDate(since.getDate() - 7);
    else since.setDate(since.getDate() - 30);

    const result = await getLeads(
      organizationId,
      workspaceId,
      { ownerId: userId },
      { pageSize: 1000 }
    );

    // Filter by creation date
    const recentLeads = result.data.filter(lead => {
      const createdAt = lead.createdAt?.toDate ? lead.createdAt.toDate() : new Date(lead.createdAt);
      return createdAt >= since;
    });

    return recentLeads.length;

  } catch (error) {
    return 0;
  }
}

/**
 * Get skill-based assignment
 */
async function getSkillBasedUser(lead: Lead, rule: RoutingRule): Promise<string | null> {
  const skillMappings = rule.metadata?.skills || [];

  // Check if lead requires specific skills
  // Example: Spanish-speaking leads need Spanish-speaking reps
  // This would be enhanced with AI to detect required skills from lead data

  // For now, simple logic
  if (lead.customFields?.language) {
    const requiredLanguage = lead.customFields.language;
    
    const match = skillMappings.find(mapping => 
      mapping.skills.some(skill => 
        skill.toLowerCase().includes(requiredLanguage.toLowerCase())
      )
    );

    if (match) {
      return match.userId;
    }
  }

  return null;
}

/**
 * Get default assignment (fallback)
 */
async function getDefaultAssignment(organizationId: string): Promise<string> {
  try {
    // Get organization members
    const membersResult = await FirestoreService.getAll<any>(
      `organizations/${organizationId}/members`
    );

    const activeMembers = membersResult.filter(m => m.role === 'admin' || m.role === 'member');

    if (activeMembers.length > 0) {
      // Round-robin through org members
      const timestamp = Date.now();
      const index = timestamp % activeMembers.length;
      return activeMembers[index].userId;
    }

    // Fallback to org owner
    const org = await FirestoreService.get<any>('organizations', organizationId);
    return org?.ownerId || org?.createdBy || 'unknown';

  } catch (error) {
    logger.error('Failed to get default assignment', error);
    return 'unknown';
  }
}

