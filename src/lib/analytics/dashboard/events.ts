/**
 * Analytics Dashboard Signal Bus Events
 * 
 * Event definitions and emitters for analytics dashboard events
 */

import { getServerSignalCoordinator } from '@/lib/orchestration';
import type { SignalType } from '@/lib/orchestration/types';
import type { DashboardOverview, TimePeriod } from './types';
import { logger } from '@/lib/logger/logger';

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
  period: TimePeriod,
  userId?: string
): Promise<void> {
  try {
    const { PLATFORM_ID } = await import('@/lib/constants/platform');
    const coordinator = getServerSignalCoordinator();

    const payload: DashboardViewedPayload = {
      period,
      userId,
      timestamp: new Date(),
    };

    await coordinator.emitSignal({
      type: ANALYTICS_EVENTS.DASHBOARD_VIEWED as SignalType,
      confidence: 1.0,
      priority: 'Low',
      metadata: payload as unknown as Record<string, unknown>,
    });
  } catch (error: unknown) {
    logger.error('Failed to emit dashboard viewed event:', error instanceof Error ? error : new Error(String(error)), { file: 'events.ts' });
  }
}

/**
 * Emit dashboard generated event
 */
export async function emitDashboardGenerated(
  period: TimePeriod,
  generationTime: number,
  cached: boolean,
  data: DashboardOverview
): Promise<void> {
  try {
    const { PLATFORM_ID } = await import('@/lib/constants/platform');
    const coordinator = getServerSignalCoordinator();

    const payload: DashboardGeneratedPayload = {
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
      type: ANALYTICS_EVENTS.DASHBOARD_GENERATED as SignalType,
      confidence: 1.0,
      priority: 'Low',
      metadata: payload as unknown as Record<string, unknown>,
    });
  } catch (error: unknown) {
    logger.error('Failed to emit dashboard generated event:', error instanceof Error ? error : new Error(String(error)), { file: 'events.ts' });
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
    const coordinator = getServerSignalCoordinator();
    
    const payload: CacheClearedPayload = {
      reason,
      userId,
      timestamp: new Date(),
    };
    
    await coordinator.emitSignal({
      type: ANALYTICS_EVENTS.CACHE_CLEARED as SignalType,
      confidence: 1.0,
      priority: 'Low',
      metadata: payload as unknown as Record<string, unknown>,
    });
  } catch (error: unknown) {
    logger.error('Failed to emit cache cleared event:', error instanceof Error ? error : new Error(String(error)), { file: 'events.ts' });
  }
}

/**
 * Emit export requested event
 */
export async function emitExportRequested(
  format: 'csv' | 'pdf' | 'excel',
  userId?: string
): Promise<void> {
  try {
    const { PLATFORM_ID } = await import('@/lib/constants/platform');
    const coordinator = getServerSignalCoordinator();

    const payload: ExportRequestedPayload = {
      format,
      userId,
      timestamp: new Date(),
    };

    await coordinator.emitSignal({
      type: ANALYTICS_EVENTS.EXPORT_REQUESTED as SignalType,
      confidence: 1.0,
      priority: 'Low',
      metadata: payload as unknown as Record<string, unknown>,
    });
  } catch (error: unknown) {
    logger.error('Failed to emit export requested event:', error instanceof Error ? error : new Error(String(error)), { file: 'events.ts' });
  }
}

/**
 * Emit error occurred event
 */
export async function emitAnalyticsError(
  error: string,
  code: string,
  context?: Record<string, unknown>
): Promise<void> {
  try {
    const coordinator = getServerSignalCoordinator();

    const payload: ErrorOccurredPayload = {
      error,
      code,
      context,
      timestamp: new Date(),
    };

    await coordinator.emitSignal({
      type: ANALYTICS_EVENTS.ERROR_OCCURRED as SignalType,
      confidence: 1.0,
      priority: 'Medium',
      metadata: payload as unknown as Record<string, unknown>,
    });
  } catch (err: unknown) {
    logger.error('Failed to emit analytics error event:', err instanceof Error ? err : new Error(String(err)), { file: 'events.ts' });
  }
}

// ============================================================================
// EVENT HANDLERS (EXAMPLES)
// ============================================================================

/**
 * Example handler for dashboard viewed events
 * Can be used for usage tracking, analytics, etc.
 */
export function handleDashboardViewed(payload: DashboardViewedPayload): void {
  // Log to analytics service
  logger.info('Dashboard viewed', {
    period: payload.period,
    user: payload.userId,
    file: 'events.ts',
  });

  // Track in usage analytics
  // await trackUsage('dashboard_view', payload);

  // Update user activity
  // await updateUserActivity(payload.userId, 'dashboard_view');
}

/**
 * Example handler for dashboard generated events
 * Can be used for performance monitoring
 */
export function handleDashboardGenerated(payload: DashboardGeneratedPayload): void {
  // Log performance metrics
  logger.info('Dashboard generated', {
    generationTime: payload.generationTime,
    cached: payload.cached,
    totalWorkflows: payload.summary.totalWorkflows,
    totalExecutions: payload.summary.totalExecutions,
    totalDeals: payload.summary.totalDeals,
    totalRevenue: payload.summary.totalRevenue,
    file: 'events.ts',
  });

  // Track performance
  // await trackPerformance('dashboard_generation', {
  //   duration: payload.generationTime,
  //   cached: payload.cached,
  // });

  // Alert if generation is slow
  if (payload.generationTime > 5000 && !payload.cached) {
    logger.warn('Slow dashboard generation', { generationTime: payload.generationTime, file: 'events.ts' });
    // await sendAlert('slow_dashboard_generation', payload);
  }
}

/**
 * Example handler for analytics errors
 * Can be used for error tracking and alerting
 */
export function handleAnalyticsError(payload: ErrorOccurredPayload): void {
  // Log error
  logger.error('Analytics error', new Error(payload.error), {
    code: payload.code,
    file: 'events.ts',
  });

  // Send to error tracking service
  // await captureError(payload.error, {
  //   code: payload.code,
  //   context: payload.context,
  // });

  // Alert on critical errors
  if (payload.code === 'INTERNAL_ERROR') {
    // await sendCriticalAlert('analytics_internal_error', payload);
  }
}
