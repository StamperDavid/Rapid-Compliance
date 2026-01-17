/**
 * Deal Monitor Service
 * 
 * Real-time deal monitoring using the Signal Bus.
 * Observes deal-related signals and triggers automated recommendations.
 * 
 * LIVING LEDGER COMPLIANCE:
 * - Real-time signal observation (deal.created, deal.stage.changed, deal.won, deal.lost)
 * - Automatic health score recalculation on deal changes
 * - Next Best Action recommendations triggered by signals
 * - Signal Bus integration for event-driven architecture
 * 
 * Signal Flow:
 * 1. Deal event occurs → Signal emitted by deal-service
 * 2. Deal Monitor observes signal → Triggers analysis
 * 3. Calculate health score → Generate recommendations
 * 4. Emit recommendation signals → Frontend/automation consumes
 */

import { logger } from '@/lib/logger/logger';
import { getServerSignalCoordinator } from '@/lib/orchestration/coordinator-factory-server';
import { calculateDealHealth, type DealHealthScore } from './deal-health';
import { generateNextBestActions, type ActionRecommendations } from './next-best-action-engine';
import type { SalesSignal } from '@/lib/orchestration/types';
import type { Deal } from './deal-service';

// ============================================================================
// TYPES
// ============================================================================

export interface DealMonitorConfig {
  organizationId: string;
  workspaceId: string;
  autoGenerateRecommendations?: boolean; // Default: true
  autoRecalculateHealth?: boolean; // Default: true
  signalPriority?: 'High' | 'Medium' | 'Low'; // Default: Medium
}

// ============================================================================
// SIGNAL OBSERVATION
// ============================================================================

/**
 * Start monitoring deal signals
 * 
 * Observes deal-related signals and triggers automated actions.
 * 
 * @param config - Monitor configuration
 * @returns Unsubscribe function
 * 
 * @example
 * ```typescript
 * const unsubscribe = await startDealMonitor({
 *   organizationId: 'org_123',
 *   workspaceId: 'default',
 *   autoGenerateRecommendations: true,
 * });
 * 
 * // Later, to stop monitoring:
 * unsubscribe();
 * ```
 */
export function startDealMonitor(
  config: DealMonitorConfig
): () => void {
  const {
    organizationId,
    workspaceId,
    autoGenerateRecommendations = true,
    autoRecalculateHealth = true,
    signalPriority = 'Medium',
  } = config;

  logger.info('Starting deal monitor', {
    organizationId,
    workspaceId,
    autoGenerateRecommendations,
    autoRecalculateHealth,
  });

  try {
    const coordinator = getServerSignalCoordinator();

    // Observe deal signals
    const unsubscribe = coordinator.observeSignals(
      {
        types: [
          'deal.created',
          'deal.stage.changed',
          'deal.won',
          'deal.lost',
        ],
        orgId: organizationId,
        workspaceId,
      },
      async (signal: SalesSignal) => {
        await handleDealSignal(
          signal,
          organizationId,
          workspaceId,
          autoGenerateRecommendations,
          autoRecalculateHealth,
          signalPriority
        );
      }
    );

    logger.info('Deal monitor started successfully', {
      organizationId,
      workspaceId,
    });

    return unsubscribe;
  } catch (error) {
    logger.error('Failed to start deal monitor', error instanceof Error ? error : new Error(String(error)), {
      organizationId,
      workspaceId,
    });
    throw error;
  }
}

/**
 * Handle deal signal
 */
async function handleDealSignal(
  signal: SalesSignal,
  organizationId: string,
  workspaceId: string,
  autoGenerateRecommendations: boolean,
  autoRecalculateHealth: boolean,
  signalPriority: 'High' | 'Medium' | 'Low'
): Promise<void> {
  try {
    const dealId = signal.metadata?.dealId as string;
    if (!dealId) {
      logger.warn('Deal signal missing dealId', { signalType: signal.type });
      return;
    }

    logger.info('Processing deal signal', {
      signalType: signal.type,
      dealId,
      organizationId,
    });

    // Step 1: Recalculate health score
    let healthScore;
    if (autoRecalculateHealth && signal.type !== 'deal.created') {
      try {
        healthScore = await calculateDealHealth(
          organizationId,
          workspaceId,
          dealId
        );

        logger.info('Deal health recalculated', {
          dealId,
          healthScore: healthScore.overall,
          status: healthScore.status,
        });

        // Emit health score update signal
        await emitHealthScoreSignal(
          organizationId,
          workspaceId,
          dealId,
          healthScore,
          signalPriority
        );
      } catch (error) {
        logger.error('Failed to recalculate health score', error instanceof Error ? error : new Error(String(error)), { dealId });
      }
    }

    // Step 2: Generate next best action recommendations
    if (autoGenerateRecommendations) {
      try {
        const recommendations = await generateNextBestActions(
          organizationId,
          workspaceId,
          dealId
        );

        logger.info('Recommendations generated', {
          dealId,
          actionCount: recommendations.actions.length,
          urgency: recommendations.urgency,
          topAction: recommendations.actions[0]?.type,
        });

        // Emit recommendations signal
        await emitRecommendationsSignal(
          organizationId,
          workspaceId,
          dealId,
          recommendations,
          signalPriority
        );
      } catch (error) {
        logger.error('Failed to generate recommendations', error instanceof Error ? error : new Error(String(error)), { dealId });
      }
    }

    // Step 3: Handle specific signal types
    await handleSpecificSignalType(
      signal,
      organizationId,
      workspaceId,
      dealId,
      signalPriority
    );
  } catch (error) {
    logger.error('Failed to handle deal signal', error instanceof Error ? error : new Error(String(error)), {
      signalType: signal.type,
    });
  }
}

/**
 * Handle specific signal types
 */
async function handleSpecificSignalType(
  signal: SalesSignal,
  organizationId: string,
  workspaceId: string,
  dealId: string,
  signalPriority: 'High' | 'Medium' | 'Low'
): Promise<void> {
  const coordinator = getServerSignalCoordinator();

  switch (signal.type) {
    case 'deal.created':
      // New deal created - emit onboarding recommendations
      await coordinator.emitSignal({
        type: 'deal.action.recommended',
        leadId: signal.metadata?.contactId as string,
        orgId: organizationId,
        workspaceId,
        confidence: 0.9,
        priority: signalPriority,
        metadata: {
          source: 'deal-monitor',
          dealId,
          actionType: 'qualification',
          reason: 'New deal requires qualification call',
          suggestedTimeline: 'This Week',
        },
      });
      break;

    case 'deal.stage.changed': {
      // Stage changed - recalculate and notify
      const oldStage = signal.metadata?.oldStage;
      const newStage = signal.metadata?.newStage;

      logger.info('Deal stage changed', {
        dealId,
        oldStage,
        newStage,
      });

      // If moved to negotiation, emit high-priority signal
      if (newStage === 'negotiation') {
        await coordinator.emitSignal({
          type: 'deal.action.recommended',
          orgId: organizationId,
          workspaceId,
          confidence: 0.95,
          priority: 'High',
          metadata: {
            source: 'deal-monitor',
            dealId,
            actionType: 'negotiate',
            reason: 'Deal entered negotiation - schedule final terms meeting',
            suggestedTimeline: 'This Week',
          },
        });
      }
      break;
    }

    case 'deal.won':
      // Deal won - emit onboarding signal
      await coordinator.emitSignal({
        type: 'deal.action.recommended',
        orgId: organizationId,
        workspaceId,
        confidence: 1.0,
        priority: 'High',
        metadata: {
          source: 'deal-monitor',
          dealId,
          actionType: 'onboarding',
          reason: 'Deal won - initiate customer onboarding',
          suggestedTimeline: 'Today',
        },
      });
      break;

    case 'deal.lost':
      // Deal lost - emit post-mortem signal
      await coordinator.emitSignal({
        type: 'deal.action.recommended',
        orgId: organizationId,
        workspaceId,
        confidence: 0.7,
        priority: 'Low',
        metadata: {
          source: 'deal-monitor',
          dealId,
          actionType: 'postmortem',
          reason: 'Deal lost - conduct loss analysis',
          lostReason: signal.metadata?.lostReason,
          suggestedTimeline: 'Next Week',
        },
      });
      break;
  }
}

/**
 * Emit health score update signal
 */
async function emitHealthScoreSignal(
  organizationId: string,
  workspaceId: string,
  dealId: string,
  healthScore: DealHealthScore,
  priority: 'High' | 'Medium' | 'Low'
): Promise<void> {
  try {
    const coordinator = getServerSignalCoordinator();

    await coordinator.emitSignal({
      type: 'deal.health.updated',
      orgId: organizationId,
      workspaceId,
      confidence: 0.8, // Health score is deterministic
      priority:
        healthScore.status === 'critical'
          ? 'High'
          : healthScore.status === 'at-risk'
          ? 'Medium'
          : priority,
      metadata: {
        source: 'deal-monitor',
        dealId,
        healthScore: healthScore.overall,
        status: healthScore.status,
        warnings: healthScore.warnings,
        recommendations: healthScore.recommendations,
        factors: healthScore.factors.map((f: { name: string; score: number; impact: string }) => ({
          name: f.name,
          score: f.score,
          impact: f.impact,
        })),
      },
    });

    logger.info('Health score signal emitted', {
      dealId,
      healthScore: healthScore.overall,
      status: healthScore.status,
    });
  } catch (error) {
    logger.error('Failed to emit health score signal', error instanceof Error ? error : new Error(String(error)), { dealId });
  }
}

/**
 * Emit recommendations signal
 */
async function emitRecommendationsSignal(
  organizationId: string,
  workspaceId: string,
  dealId: string,
  recommendations: ActionRecommendations,
  priority: 'High' | 'Medium' | 'Low'
): Promise<void> {
  try {
    const coordinator = getServerSignalCoordinator();

    await coordinator.emitSignal({
      type: 'deal.recommendations.generated',
      orgId: organizationId,
      workspaceId,
      confidence: recommendations.confidence,
      priority:
        recommendations.urgency === 'critical'
          ? 'High'
          : recommendations.urgency === 'high'
          ? 'High'
          : recommendations.urgency === 'medium'
          ? 'Medium'
          : priority,
      metadata: {
        source: 'deal-monitor',
        dealId,
        actionCount: recommendations.actions.length,
        urgency: recommendations.urgency,
        topAction: recommendations.actions[0]
          ? {
              type: recommendations.actions[0].type,
              title: recommendations.actions[0].title,
              priority: recommendations.actions[0].priority,
              confidence: recommendations.actions[0].confidence,
              suggestedTimeline: recommendations.actions[0].suggestedTimeline,
            }
          : null,
        allActions: recommendations.actions.map((action: { id: string; type: string; priority: string; title: string; confidence: number }) => ({
          id: action.id,
          type: action.type,
          priority: action.priority,
          title: action.title,
          confidence: action.confidence,
        })),
      },
    });

    logger.info('Recommendations signal emitted', {
      dealId,
      actionCount: recommendations.actions.length,
      urgency: recommendations.urgency,
    });
  } catch (error) {
    logger.error('Failed to emit recommendations signal', error instanceof Error ? error : new Error(String(error)), { dealId });
  }
}

// ============================================================================
// BATCH MONITORING
// ============================================================================

/**
 * Monitor all deals and generate recommendations for at-risk deals
 * 
 * This is useful for periodic batch processing (e.g., daily health check).
 * 
 * @param organizationId - Organization ID
 * @param workspaceId - Workspace ID
 * @returns Summary of monitored deals
 */
export async function runDealHealthCheck(
  organizationId: string,
  workspaceId: string = 'default'
): Promise<{
  total: number;
  healthy: number;
  atRisk: number;
  critical: number;
  recommendationsGenerated: number;
}> {
  try {
    logger.info('Running deal health check', {
      organizationId,
      workspaceId,
    });

    // Get all active deals
    const { getDeals } = await import('./deal-service');
    const { data: deals } = await getDeals(organizationId, workspaceId, {
      // Filter out closed deals
    });

    const activeDeals = deals.filter(
      (d: Deal) => d.stage !== 'closed_won' && d.stage !== 'closed_lost'
    );

    let healthy = 0;
    let atRisk = 0;
    let critical = 0;
    let recommendationsGenerated = 0;

    // Process each deal
    for (const deal of activeDeals) {
      try {
        // Calculate health
        const healthScore = await calculateDealHealth(
          organizationId,
          workspaceId,
          deal.id
        );

        // Count by status
        if (healthScore.status === 'healthy') {healthy++;}
        else if (healthScore.status === 'at-risk') {atRisk++;}
        else if (healthScore.status === 'critical') {critical++;}

        // Generate recommendations for at-risk and critical deals
        if (
          healthScore.status === 'at-risk' ||
          healthScore.status === 'critical'
        ) {
          await generateNextBestActions(
            organizationId,
            workspaceId,
            deal.id,
            deal
          );
          recommendationsGenerated++;
        }
      } catch (error) {
        logger.error('Failed to process deal in health check', error instanceof Error ? error : new Error(String(error)), {
          dealId: deal.id,
        });
      }
    }

    const summary = {
      total: activeDeals.length,
      healthy,
      atRisk,
      critical,
      recommendationsGenerated,
    };

    logger.info('Deal health check complete', summary);

    return summary;
  } catch (error) {
    logger.error('Failed to run deal health check', error instanceof Error ? error : new Error(String(error)), {
      organizationId,
      workspaceId,
    });
    throw error;
  }
}
