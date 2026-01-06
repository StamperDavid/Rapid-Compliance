/**
 * Activity Service
 * Tracks all interactions with CRM entities
 * Foundation for timeline, insights, and recommendations
 */

import { FirestoreService } from '@/lib/db/firestore-service';
import type { QueryConstraint, QueryDocumentSnapshot} from 'firebase/firestore';
import { where, orderBy, limit } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';
import type { 
  Activity, 
  ActivityFilters, 
  ActivityStats, 
  ActivityInsight,
  NextBestAction,
  TimelineGroup,
  CreateActivityInput,
  ActivityType,
  RelatedEntityType
} from '@/types/activity';

interface PaginationOptions {
  pageSize?: number;
  lastDoc?: QueryDocumentSnapshot;
}

interface PaginatedResult<T> {
  data: T[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

/**
 * Create a new activity
 */
export async function createActivity(
  organizationId: string,
  workspaceId: string,
  data: CreateActivityInput
): Promise<Activity> {
  try {
    const activityId = `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const activity: Activity = {
      ...data,
      id: activityId,
      organizationId,
      workspaceId,
      occurredAt: (data.occurredAt || now) as any,
      createdAt: now as any,
    };

    await FirestoreService.set(
      `organizations/${organizationId}/workspaces/${workspaceId}/activities`,
      activityId,
      activity,
      false
    );

    logger.info('Activity created', {
      organizationId,
      activityId,
      type: activity.type,
      relatedEntities: activity.relatedTo.length,
    });

    return activity;
  } catch (error: any) {
    logger.error('Failed to create activity', error, { organizationId, data });
    throw new Error(`Failed to create activity: ${error.message}`);
  }
}

/**
 * Get activities with filtering and pagination
 */
export async function getActivities(
  organizationId: string,
  workspaceId: string,
  filters?: ActivityFilters,
  options?: PaginationOptions
): Promise<PaginatedResult<Activity>> {
  try {
    const constraints: QueryConstraint[] = [];

    // Filter by entity
    if (filters?.entityId && filters?.entityType) {
      // Note: This requires a composite index in Firestore
      // For now, we'll fetch all and filter client-side (not ideal for production)
      // TODO: Add Firestore composite index for relatedTo queries
    }

    // Filter by activity types
    if (filters?.types && filters.types.length > 0) {
      // Multiple types requires IN query (max 10 items)
      if (filters.types.length <= 10) {
        constraints.push(where('type', 'in', filters.types));
      }
    }

    // Filter by creator
    if (filters?.createdBy) {
      constraints.push(where('createdBy', '==', filters.createdBy));
    }

    // Filter by direction
    if (filters?.direction) {
      constraints.push(where('direction', '==', filters.direction));
    }

    // Order by occurrence time (most recent first)
    constraints.push(orderBy('occurredAt', 'desc'));

    const result = await FirestoreService.getAllPaginated<Activity>(
      `organizations/${organizationId}/workspaces/${workspaceId}/activities`,
      constraints,
      options?.pageSize || 50,
      options?.lastDoc
    );

    // Client-side filtering for entity (until we add composite index)
    let filteredData = result.data;
    if (filters?.entityId && filters?.entityType) {
      filteredData = result.data.filter(activity =>
        activity.relatedTo.some(
          entity => entity.entityId === filters.entityId && entity.entityType === filters.entityType
        )
      );
    }

    // Date range filter
    if (filters?.dateRange) {
      filteredData = filteredData.filter(activity => {
        const occurredAt = activity.occurredAt?.toDate ? activity.occurredAt.toDate() : new Date(activity.occurredAt as any);
        return occurredAt >= filters.dateRange!.start && occurredAt <= filters.dateRange!.end;
      });
    }

    logger.info('Activities retrieved', {
      organizationId,
      count: filteredData.length,
      filters,
    });

    return {
      data: filteredData,
      lastDoc: result.lastDoc,
      hasMore: result.hasMore,
    };
  } catch (error: any) {
    logger.error('Failed to get activities', error, { organizationId, filters });
    throw new Error(`Failed to retrieve activities: ${error.message}`);
  }
}

/**
 * Get activity timeline for an entity (grouped by date)
 */
export async function getEntityTimeline(
  organizationId: string,
  workspaceId: string,
  entityType: RelatedEntityType,
  entityId: string,
  options?: PaginationOptions
): Promise<TimelineGroup[]> {
  try {
    const result = await getActivities(
      organizationId,
      workspaceId,
      { entityType, entityId },
      options
    );

    // Group by date
    const grouped = new Map<string, Activity[]>();
    
    result.data.forEach(activity => {
      const occurredAt = activity.occurredAt?.toDate ? activity.occurredAt.toDate() : new Date(activity.occurredAt as any);
      const dateKey = occurredAt.toISOString().split('T')[0]; // YYYY-MM-DD
      
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(activity);
    });

    // Convert to array and sort by date desc
    const timeline: TimelineGroup[] = Array.from(grouped.entries())
      .map(([date, activities]) => ({
        date,
        activities: activities.sort((a, b) => {
          const aTime = a.occurredAt?.toDate ? a.occurredAt.toDate().getTime() : new Date(a.occurredAt as any).getTime();
          const bTime = b.occurredAt?.toDate ? b.occurredAt.toDate().getTime() : new Date(b.occurredAt as any).getTime();
          return bTime - aTime;
        }),
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    logger.info('Timeline generated', {
      organizationId,
      entityType,
      entityId,
      days: timeline.length,
      totalActivities: result.data.length,
    });

    return timeline;
  } catch (error: any) {
    logger.error('Failed to get timeline', error, { organizationId, entityType, entityId });
    throw new Error(`Failed to retrieve timeline: ${error.message}`);
  }
}

/**
 * Get activity statistics for an entity
 */
export async function getActivityStats(
  organizationId: string,
  workspaceId: string,
  entityType: RelatedEntityType,
  entityId: string
): Promise<ActivityStats> {
  try {
    const result = await getActivities(
      organizationId,
      workspaceId,
      { entityType, entityId },
      { pageSize: 1000 } // Get all recent activities
    );

    const activities = result.data;
    const activitiesByType: Partial<Record<ActivityType, number>> = {};
    
    activities.forEach(activity => {
      activitiesByType[activity.type] = (activitiesByType[activity.type] || 0) + 1;
    });

    // Find most common type
    let mostCommonType: ActivityType | undefined;
    let maxCount = 0;
    Object.entries(activitiesByType).forEach(([type, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonType = type as ActivityType;
      }
    });

    // Calculate last activity date
    let lastActivityDate: Date | undefined;
    if (activities.length > 0) {
      const lastActivity = activities[0]; // Already sorted by occurredAt desc
      lastActivityDate = lastActivity.occurredAt?.toDate ? 
        lastActivity.occurredAt.toDate() : 
        new Date(lastActivity.occurredAt as any);
    }

    // Calculate avg activities per day (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentActivities = activities.filter(a => {
      const occurredAt = a.occurredAt?.toDate ? a.occurredAt.toDate() : new Date(a.occurredAt as any);
      return occurredAt >= thirtyDaysAgo;
    });
    const avgActivitiesPerDay = recentActivities.length / 30;

    // Calculate engagement score (0-100)
    const engagementScore = calculateEngagementScore(activities);

    const stats: ActivityStats = {
      totalActivities: activities.length,
      activitiesByType: activitiesByType as Record<ActivityType, number>,
      lastActivityDate,
      mostCommonType,
      avgActivitiesPerDay,
      engagementScore,
    };

    logger.info('Activity stats calculated', {
      organizationId,
      entityType,
      entityId,
      totalActivities: stats.totalActivities,
      engagementScore: stats.engagementScore,
    });

    return stats;
  } catch (error: any) {
    logger.error('Failed to calculate activity stats', error, { organizationId, entityType, entityId });
    throw new Error(`Failed to calculate stats: ${error.message}`);
  }
}

/**
 * Calculate engagement score based on activity frequency and recency
 */
function calculateEngagementScore(activities: Activity[]): number {
  if (activities.length === 0) {return 0;}

  let score = 0;

  // Recency score (0-50 points)
  const lastActivity = activities[0];
  const lastActivityDate = lastActivity.occurredAt?.toDate ? 
    lastActivity.occurredAt.toDate() : 
    new Date(lastActivity.occurredAt as any);
  const daysSinceLastActivity = (Date.now() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24);
  
  if (daysSinceLastActivity < 1) {score += 50;}
  else if (daysSinceLastActivity < 3) {score += 40;}
  else if (daysSinceLastActivity < 7) {score += 30;}
  else if (daysSinceLastActivity < 14) {score += 20;}
  else if (daysSinceLastActivity < 30) {score += 10;}
  else {score += 0;}

  // Frequency score (0-50 points)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentActivities = activities.filter(a => {
    const occurredAt = a.occurredAt?.toDate ? a.occurredAt.toDate() : new Date(a.occurredAt as any);
    return occurredAt >= thirtyDaysAgo;
  });

  if (recentActivities.length >= 20) {score += 50;}
  else if (recentActivities.length >= 10) {score += 40;}
  else if (recentActivities.length >= 5) {score += 30;}
  else if (recentActivities.length >= 3) {score += 20;}
  else if (recentActivities.length >= 1) {score += 10;}
  else {score += 0;}

  return Math.min(score, 100);
}

/**
 * Get insights based on activity patterns
 */
export async function getActivityInsights(
  organizationId: string,
  workspaceId: string,
  entityType: RelatedEntityType,
  entityId: string
): Promise<ActivityInsight[]> {
  try {
    const stats = await getActivityStats(organizationId, workspaceId, entityType, entityId);
    const insights: ActivityInsight[] = [];

    // No recent activity warning
    if (stats.lastActivityDate) {
      const daysSinceLastActivity = (Date.now() - stats.lastActivityDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceLastActivity > 14 && entityType === 'deal') {
        insights.push({
          type: 'warning',
          message: `No activity in ${Math.floor(daysSinceLastActivity)} days`,
          recommendation: 'Schedule a follow-up call or send a check-in email to re-engage',
          confidence: 90,
        });
      } else if (daysSinceLastActivity > 7 && entityType === 'lead') {
        insights.push({
          type: 'warning',
          message: `Lead has been inactive for ${Math.floor(daysSinceLastActivity)} days`,
          recommendation: 'Enroll in nurture sequence or mark as cold',
          confidence: 85,
        });
      }
    }

    // High engagement
    if (stats.engagementScore && stats.engagementScore > 70) {
      insights.push({
        type: 'success',
        message: `High engagement score (${stats.engagementScore}/100)`,
        recommendation: entityType === 'lead' ? 'This lead is hot - schedule a demo ASAP' : 'Keep the momentum going with regular touchpoints',
        confidence: 95,
      });
    }

    // Low engagement
    if (stats.engagementScore && stats.engagementScore < 30 && stats.totalActivities > 3) {
      insights.push({
        type: 'warning',
        message: `Low engagement score (${stats.engagementScore}/100)`,
        recommendation: 'Try a different outreach channel or re-qualify this lead',
        confidence: 80,
        });
    }

    // Email opened but no reply
    const emailsSent = stats.activitiesByType.email_sent || 0;
    const emailsOpened = stats.activitiesByType.email_opened || 0;
    const emailsReceived = stats.activitiesByType.email_received || 0;
    
    if (emailsSent > 2 && emailsOpened > 2 && emailsReceived === 0) {
      insights.push({
        type: 'info',
        message: 'Emails are being opened but no responses yet',
        recommendation: 'Try a different subject line or call to action. Consider a phone call instead.',
        confidence: 75,
      });
    }

    logger.info('Activity insights generated', {
      organizationId,
      entityType,
      entityId,
      insightCount: insights.length,
    });

    return insights;
  } catch (error: any) {
    logger.error('Failed to generate insights', error, { organizationId, entityType, entityId });
    throw new Error(`Failed to generate insights: ${error.message}`);
  }
}

/**
 * Get next best action recommendation
 */
export async function getNextBestAction(
  organizationId: string,
  workspaceId: string,
  entityType: RelatedEntityType,
  entityId: string
): Promise<NextBestAction | null> {
  try {
    const stats = await getActivityStats(organizationId, workspaceId, entityType, entityId);
    const recentActivities = await getActivities(
      organizationId,
      workspaceId,
      { entityType, entityId },
      { pageSize: 20 }
    );

    // Analyze recent activity pattern
    const lastActivities = recentActivities.data.slice(0, 5);
    const lastActivityTypes = lastActivities.map(a => a.type);

    // Rule-based recommendations (in production, this would use ML)
    
    // High engagement + no meeting scheduled = schedule meeting
    if (stats.engagementScore && stats.engagementScore > 70 && 
        !lastActivityTypes.includes('meeting_scheduled')) {
      return {
        action: 'schedule_meeting',
        priority: 'high',
        reasoning: 'High engagement detected. Prospect is actively interested.',
        suggestedDueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days
        confidence: 85,
        basedOn: lastActivities.map(a => a.id),
      };
    }

    // Email opened multiple times but no response = follow up call
    const recentEmailOpens = lastActivityTypes.filter(t => t === 'email_opened').length;
    const recentEmailResponses = lastActivityTypes.filter(t => t === 'email_received').length;
    
    if (recentEmailOpens >= 2 && recentEmailResponses === 0) {
      return {
        action: 'make_call',
        priority: 'medium',
        reasoning: 'Emails are being read but no response. Time for a phone call.',
        suggestedDueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day
        confidence: 75,
        basedOn: lastActivities.map(a => a.id),
      };
    }

    // No activity in 7+ days for deal = urgent follow-up
    if (entityType === 'deal' && stats.lastActivityDate) {
      const daysSinceLastActivity = (Date.now() - stats.lastActivityDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceLastActivity > 7) {
        return {
          action: 'follow_up',
          priority: 'urgent',
          reasoning: `Deal has been inactive for ${Math.floor(daysSinceLastActivity)} days. Risk of losing momentum.`,
          suggestedDueDate: new Date(), // Today
          confidence: 90,
          basedOn: lastActivities.map(a => a.id),
        };
      }
    }

    // Meeting completed recently = send proposal/follow-up
    const lastMeeting = lastActivities.find(a => a.type === 'meeting_completed');
    if (lastMeeting) {
      const meetingDate = lastMeeting.occurredAt?.toDate ? 
        lastMeeting.occurredAt.toDate() : 
        new Date(lastMeeting.occurredAt as any);
      const daysSinceMeeting = (Date.now() - meetingDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceMeeting < 2) {
        return {
          action: 'send_proposal',
          priority: 'high',
          reasoning: 'Recent meeting completed. Strike while iron is hot.',
          suggestedDueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day
          confidence: 80,
          basedOn: [lastMeeting.id],
        };
      }
    }

    // Low engagement but early stage = send email
    if (stats.engagementScore && stats.engagementScore < 40 && stats.totalActivities < 5) {
      return {
        action: 'send_email',
        priority: 'medium',
        reasoning: 'Limited engagement so far. Try personalized email outreach.',
        suggestedDueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days
        confidence: 60,
        basedOn: lastActivities.map(a => a.id),
      };
    }

    // No strong signal = wait
    return {
      action: 'wait',
      priority: 'low',
      reasoning: 'Continue monitoring. No urgent action needed at this time.',
      confidence: 50,
      basedOn: [],
    };

  } catch (error: any) {
    logger.error('Failed to get next best action', error, { organizationId, entityType, entityId });
    return null;
  }
}

/**
 * Bulk create activities (for imports, integrations)
 */
export async function bulkCreateActivities(
  organizationId: string,
  workspaceId: string,
  activities: CreateActivityInput[]
): Promise<number> {
  try {
    let successCount = 0;

    for (const activityData of activities) {
      try {
        await createActivity(organizationId, workspaceId, activityData);
        successCount++;
      } catch (error) {
        logger.warn('Failed to create activity in bulk operation', { error });
      }
    }

    logger.info('Bulk activity creation completed', {
      organizationId,
      total: activities.length,
      successful: successCount,
      failed: activities.length - successCount,
    });

    return successCount;
  } catch (error: any) {
    logger.error('Bulk activity creation failed', error, { organizationId });
    throw new Error(`Bulk creation failed: ${error.message}`);
  }
}

/**
 * Delete activity
 */
export async function deleteActivity(
  organizationId: string,
  workspaceId: string,
  activityId: string
): Promise<void> {
  try {
    await FirestoreService.delete(
      `organizations/${organizationId}/workspaces/${workspaceId}/activities`,
      activityId
    );

    logger.info('Activity deleted', { organizationId, activityId });
  } catch (error: any) {
    logger.error('Failed to delete activity', error, { organizationId, activityId });
    throw new Error(`Failed to delete activity: ${error.message}`);
  }
}

