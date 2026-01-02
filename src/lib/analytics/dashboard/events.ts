/**
 * Analytics Dashboard Signal Bus Events
 * 
 * Event definitions and emitters for analytics dashboard events
 */

import { getServerSignalCoordinator } from '@/lib/orchestration';
import type { DashboardOverview, TimePeriod } from './types';

// ============================================================================
// EVENT TYPES
// ============================================================================

/**
 * Analytics dashboard event types
 */
export const ANALYTICS_EVENTS = {
  /** Dashboard analytics viewed */
  DASHBOARD_VIEWED: 'analytics.dashboard.viewed',
  
  /** Dashboard analytics generated */
  DASHBOARD_GENERATED: 'analytics.dashboard.generated',
  
  /** Analytics cache cleared */
  CACHE_CLEARED: 'analytics.cache.cleared',
  
  /** Analytics export requested */
  EXPORT_REQUESTED: 'analytics.export.requested',
  
  /** Analytics error occurred */
  ERROR_OCCURRED: 'analytics.error.occurred',
} as const;

// ============================================================================
// EVENT PAYLOADS
// ============================================================================

/**
 * Dashboard viewed event payload
 */
export interface DashboardViewedPayload {
  /** Organization ID */
  organizationId: string;
  
  /** Workspace ID */
  workspaceId: string;
  
  /** Time period selected */
  period: TimePeriod;
  
  /** User ID who viewed */
  userId?: string;
  
  /** Timestamp */
  timestamp: Date;
}

/**
 * Dashboard generated event payload
 */
export interface DashboardGeneratedPayload {
  /** Organization ID */
  organizationId: string;
  
  /** Workspace ID */
  workspaceId: string;
  
  /** Time period */
  period: TimePeriod;
  
  /** Generation time (ms) */
  generationTime: number;
  
  /** Whether served from cache */
  cached: boolean;
  
  /** Dashboard data summary */
  summary: {
    totalWorkflows: number;
    totalExecutions: number;
    totalDeals: number;
    totalRevenue: number;
  };
  
  /** Timestamp */
  timestamp: Date;
}

/**
 * Cache cleared event payload
 */
export interface CacheClearedPayload {
  /** Reason for clearing */
  reason: 'manual' | 'automatic' | 'expired';
  
  /** User ID who cleared (if manual) */
  userId?: string;
  
  /** Timestamp */
  timestamp: Date;
}

/**
 * Export requested event payload
 */
export interface ExportRequestedPayload {
  /** Organization ID */
  organizationId: string;
  
  /** Workspace ID */
  workspaceId: string;
  
  /** Export format */
  format: 'csv' | 'pdf' | 'excel';
  
  /** User ID who requested */
  userId?: string;
  
  /** Timestamp */
  timestamp: Date;
}

/**
 * Error occurred event payload
 */
export interface ErrorOccurredPayload {
  /** Error message */
  error: string;
  
  /** Error code */
  code: string;
  
  /** Organization ID (if available) */
  organizationId?: string;
  
  /** Workspace ID (if available) */
  workspaceId?: string;
  
  /** Additional context */
  context?: Record<string, unknown>;
  
  /** Timestamp */
  timestamp: Date;
}

// ============================================================================
// EVENT EMITTERS
// ============================================================================

/**
 * Emit dashboard viewed event
 */
export async function emitDashboardViewed(
  organizationId: string,
  workspaceId: string,
  period: TimePeriod,
  userId?: string
): Promise<void> {
  try {
    const coordinator = await getServerSignalCoordinator();
    
    const payload: DashboardViewedPayload = {
      organizationId,
      workspaceId,
      period,
      userId,
      timestamp: new Date(),
    };
    
    await coordinator.emitSignal({
      type: ANALYTICS_EVENTS.DASHBOARD_VIEWED,
      orgId: organizationId,
      confidence: 1.0,
      priority: 'Low',
      metadata: payload,
    });
  } catch (error) {
    console.error('Failed to emit dashboard viewed event:', error);
  }
}

/**
 * Emit dashboard generated event
 */
export async function emitDashboardGenerated(
  organizationId: string,
  workspaceId: string,
  period: TimePeriod,
  generationTime: number,
  cached: boolean,
  data: DashboardOverview
): Promise<void> {
  try {
    const coordinator = await getServerSignalCoordinator();
    
    const payload: DashboardGeneratedPayload = {
      organizationId,
      workspaceId,
      period,
      generationTime,
      cached,
      summary: {
        totalWorkflows: data.workflows.totalActiveWorkflows,
        totalExecutions: data.workflows.totalExecutions,
        totalDeals: data.deals.totalActiveDeals,
        totalRevenue: data.revenue.totalRevenue,
      },
      timestamp: new Date(),
    };
    
    await coordinator.emitSignal({
      type: ANALYTICS_EVENTS.DASHBOARD_GENERATED,
      orgId: organizationId,
      confidence: 1.0,
      priority: 'Low',
      metadata: payload,
    });
  } catch (error) {
    console.error('Failed to emit dashboard generated event:', error);
  }
}

/**
 * Emit cache cleared event
 */
export async function emitCacheCleared(
  reason: 'manual' | 'automatic' | 'expired',
  userId?: string
): Promise<void> {
  try {
    const coordinator = await getServerSignalCoordinator();
    
    const payload: CacheClearedPayload = {
      reason,
      userId,
      timestamp: new Date(),
    };
    
    await coordinator.emitSignal({
      type: ANALYTICS_EVENTS.CACHE_CLEARED,
      orgId: 'system',
      confidence: 1.0,
      priority: 'Low',
      metadata: payload,
    });
  } catch (error) {
    console.error('Failed to emit cache cleared event:', error);
  }
}

/**
 * Emit export requested event
 */
export async function emitExportRequested(
  organizationId: string,
  workspaceId: string,
  format: 'csv' | 'pdf' | 'excel',
  userId?: string
): Promise<void> {
  try {
    const coordinator = await getServerSignalCoordinator();
    
    const payload: ExportRequestedPayload = {
      organizationId,
      workspaceId,
      format,
      userId,
      timestamp: new Date(),
    };
    
    await coordinator.emitSignal({
      type: ANALYTICS_EVENTS.EXPORT_REQUESTED,
      orgId: organizationId,
      confidence: 1.0,
      priority: 'Low',
      metadata: payload,
    });
  } catch (error) {
    console.error('Failed to emit export requested event:', error);
  }
}

/**
 * Emit error occurred event
 */
export async function emitAnalyticsError(
  error: string,
  code: string,
  organizationId?: string,
  workspaceId?: string,
  context?: Record<string, unknown>
): Promise<void> {
  try {
    const coordinator = await getServerSignalCoordinator();
    
    const payload: ErrorOccurredPayload = {
      error,
      code,
      organizationId,
      workspaceId,
      context,
      timestamp: new Date(),
    };
    
    await coordinator.emitSignal({
      type: ANALYTICS_EVENTS.ERROR_OCCURRED,
      orgId: organizationId || 'system',
      confidence: 1.0,
      priority: 'Medium',
      metadata: payload,
    });
  } catch (err) {
    console.error('Failed to emit analytics error event:', err);
  }
}

// ============================================================================
// EVENT HANDLERS (EXAMPLES)
// ============================================================================

/**
 * Example handler for dashboard viewed events
 * Can be used for usage tracking, analytics, etc.
 */
export async function handleDashboardViewed(payload: DashboardViewedPayload): Promise<void> {
  // Example: Log to analytics service
  console.log('Dashboard viewed:', {
    org: payload.organizationId,
    workspace: payload.workspaceId,
    period: payload.period,
    user: payload.userId,
  });
  
  // Example: Track in usage analytics
  // await trackUsage('dashboard_view', payload);
  
  // Example: Update user activity
  // await updateUserActivity(payload.userId, 'dashboard_view');
}

/**
 * Example handler for dashboard generated events
 * Can be used for performance monitoring
 */
export async function handleDashboardGenerated(payload: DashboardGeneratedPayload): Promise<void> {
  // Example: Log performance metrics
  console.log('Dashboard generated:', {
    org: payload.organizationId,
    generationTime: payload.generationTime,
    cached: payload.cached,
    summary: payload.summary,
  });
  
  // Example: Track performance
  // await trackPerformance('dashboard_generation', {
  //   duration: payload.generationTime,
  //   cached: payload.cached,
  // });
  
  // Example: Alert if generation is slow
  if (payload.generationTime > 5000 && !payload.cached) {
    console.warn('Slow dashboard generation:', payload.generationTime, 'ms');
    // await sendAlert('slow_dashboard_generation', payload);
  }
}

/**
 * Example handler for analytics errors
 * Can be used for error tracking and alerting
 */
export async function handleAnalyticsError(payload: ErrorOccurredPayload): Promise<void> {
  // Example: Log error
  console.error('Analytics error:', {
    error: payload.error,
    code: payload.code,
    org: payload.organizationId,
    workspace: payload.workspaceId,
  });
  
  // Example: Send to error tracking service
  // await captureError(payload.error, {
  //   code: payload.code,
  //   context: payload.context,
  // });
  
  // Example: Alert on critical errors
  if (payload.code === 'INTERNAL_ERROR') {
    // await sendCriticalAlert('analytics_internal_error', payload);
  }
}
