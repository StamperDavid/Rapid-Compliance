/**
 * Deal Risk Predictor - Signal Bus Events
 * 
 * Event types for risk detection and intervention tracking.
 * Integrates with Signal Bus for workflow automation and notifications.
 * 
 * @module lib/risk/events
 */

import { logger } from '@/lib/logger/logger';
import { getServerSignalCoordinator } from '@/lib/orchestration/coordinator-factory-server';
import type { SignalType } from '@/lib/orchestration/types';
import type { Deal } from '@/lib/crm/deal-service';
import type {
  DealRiskPrediction,
  Intervention,
  RiskLevel,
} from './types';

// ============================================================================
// EVENT TYPES
// ============================================================================

/**
 * Risk-related signal types
 */
export type RiskSignalType =
  | 'risk.assessed'           // Risk assessment completed
  | 'risk.detected'           // New risk detected
  | 'risk.level.changed'      // Risk level changed
  | 'risk.critical'           // Critical risk detected
  | 'risk.intervention.recommended' // Intervention recommended
  | 'risk.intervention.started'     // Intervention started
  | 'risk.intervention.completed'   // Intervention completed
  | 'risk.slippage.predicted'       // Slippage predicted
  | 'risk.mitigated';              // Risk successfully mitigated

/**
 * Risk assessment event metadata
 */
export interface RiskAssessedMetadata {
  source: 'risk-engine';
  dealId: string;
  dealName: string;
  dealValue: number;
  dealStage: string;
  riskLevel: RiskLevel;
  slippageProbability: number;
  lossProbability: number;
  riskFactorsCount: number;
  interventionsCount: number;
  confidence: number;
  calculationDuration: number;
}

/**
 * Risk detected event metadata
 */
export interface RiskDetectedMetadata {
  source: 'risk-engine';
  dealId: string;
  dealName: string;
  dealValue: number;
  riskLevel: RiskLevel;
  slippageProbability: number;
  topRiskCategory: string;
  interventionsRecommended: number;
}

/**
 * Risk level changed event metadata
 */
export interface RiskLevelChangedMetadata {
  source: 'risk-engine';
  dealId: string;
  dealName: string;
  dealValue: number;
  previousLevel: RiskLevel;
  newLevel: RiskLevel;
  slippageProbability: number;
  changeDirection: 'increased' | 'decreased';
  daysSinceLastAssessment: number;
}

/**
 * Critical risk event metadata
 */
export interface CriticalRiskMetadata {
  source: 'risk-engine';
  dealId: string;
  dealName: string;
  dealValue: number;
  slippageProbability: number;
  lossProbability: number;
  criticalRiskFactors: Array<{
    category: string;
    description: string;
    impact: number;
  }>;
  urgentInterventions: Array<{
    title: string;
    expectedImpact: number;
    deadlineDays: number;
  }>;
  revenueAtRisk: number;
}

/**
 * Intervention recommended event metadata
 */
export interface InterventionRecommendedMetadata {
  source: 'risk-engine';
  dealId: string;
  dealName: string;
  interventionId: string;
  interventionType: string;
  priority: string;
  title: string;
  expectedImpact: number;
  estimatedEffort: number;
  roiScore: number;
  deadlineDays: number;
  suggestedOwner: string;
}

/**
 * Intervention started event metadata
 */
export interface InterventionStartedMetadata {
  source: 'risk-engine';
  dealId: string;
  interventionId: string;
  interventionType: string;
  startedBy: string;
  startedAt: string;
}

/**
 * Intervention completed event metadata
 */
export interface InterventionCompletedMetadata {
  source: 'risk-engine';
  dealId: string;
  interventionId: string;
  interventionType: string;
  completedBy: string;
  completedAt: string;
  outcome: 'successful' | 'partial' | 'unsuccessful';
  impactRealized: number;
  notes?: string;
}

/**
 * Slippage predicted event metadata
 */
export interface SlippagePredictedMetadata {
  source: 'risk-engine';
  dealId: string;
  dealName: string;
  dealValue: number;
  originalCloseDate: string;
  predictedSlippageDate: string;
  daysUntilSlippage: number;
  slippageProbability: number;
  primaryReasons: string[];
}

/**
 * Risk mitigated event metadata
 */
export interface RiskMitigatedMetadata {
  source: 'risk-engine';
  dealId: string;
  dealName: string;
  previousRiskLevel: RiskLevel;
  newRiskLevel: RiskLevel;
  previousSlippageProbability: number;
  newSlippageProbability: number;
  riskReduction: number;
  interventionsApplied: number;
}

// ============================================================================
// EVENT EMISSION FUNCTIONS
// ============================================================================

/**
 * Emit risk assessed event
 */
export async function emitRiskAssessed(
  prediction: DealRiskPrediction,
  deal: Deal
): Promise<void> {
  try {
    const coordinator = getServerSignalCoordinator();
    
    const metadata: RiskAssessedMetadata = {
      source: 'risk-engine',
      dealId: prediction.dealId,
      dealName: deal.name,
      dealValue: deal.value,
      dealStage: deal.stage,
      riskLevel: prediction.riskLevel,
      slippageProbability: prediction.slippageProbability,
      lossProbability: prediction.lossProbability,
      riskFactorsCount: prediction.riskFactors.length,
      interventionsCount: prediction.interventions.length,
      confidence: prediction.confidence,
      calculationDuration: prediction.metadata.calculationDuration,
    };
    
    await coordinator.emitSignal({
      type: 'risk.assessed' as SignalType,
      leadId: deal.contactId,
      workspaceId: prediction.workspaceId,
      confidence: prediction.confidence / 100,
      priority: prediction.riskLevel === 'critical' ? 'High' : 'Medium',
      metadata: metadata as unknown as Record<string, unknown>,
    });

    logger.debug('Risk assessed signal emitted', {
      dealId: prediction.dealId,
      riskLevel: prediction.riskLevel,
    });

  } catch (error) {
    logger.error('Failed to emit risk assessed signal', error instanceof Error ? error : new Error(String(error)), {
      dealId: prediction.dealId,
    });
  }
}

/**
 * Emit risk detected event
 */
export async function emitRiskDetected(
  prediction: DealRiskPrediction,
  deal: Deal
): Promise<void> {
  try {
    const coordinator = getServerSignalCoordinator();
    
    const metadata: RiskDetectedMetadata = {
      source: 'risk-engine',
      dealId: prediction.dealId,
      dealName: deal.name,
      dealValue: deal.value,
      riskLevel: prediction.riskLevel,
      slippageProbability: prediction.slippageProbability,
      topRiskCategory: prediction.riskFactors[0]?.category || 'unknown',
      interventionsRecommended: prediction.interventions.length,
    };
    
    await coordinator.emitSignal({
      type: 'risk.detected' as SignalType,
      leadId: deal.contactId,
      workspaceId: prediction.workspaceId,
      confidence: prediction.confidence / 100,
      priority: prediction.riskLevel === 'critical' ? 'High' : 'Medium',
      metadata: metadata as unknown as Record<string, unknown>,
    });

    logger.info('Risk detected signal emitted', {
      dealId: prediction.dealId,
      riskLevel: prediction.riskLevel,
      slippageProbability: prediction.slippageProbability,
    });

  } catch (error) {
    logger.error('Failed to emit risk detected signal', error instanceof Error ? error : new Error(String(error)), {
      dealId: prediction.dealId,
    });
  }
}

/**
 * Emit risk level changed event
 */
export async function emitRiskLevelChanged(
  dealId: string,
  dealName: string,
  dealValue: number,
  previousLevel: RiskLevel,
  newLevel: RiskLevel,
  slippageProbability: number,
  daysSinceLastAssessment: number,
  workspaceId: string,
  contactId?: string
): Promise<void> {
  try {
    const coordinator = getServerSignalCoordinator();
    
    const changeDirection: 'increased' | 'decreased' = 
      getRiskLevelScore(newLevel) > getRiskLevelScore(previousLevel) 
        ? 'increased' 
        : 'decreased';
    
    const metadata: RiskLevelChangedMetadata = {
      source: 'risk-engine',
      dealId,
      dealName,
      dealValue,
      previousLevel,
      newLevel,
      slippageProbability,
      changeDirection,
      daysSinceLastAssessment,
    };
    
    await coordinator.emitSignal({
      type: 'risk.level.changed' as SignalType,
      leadId: contactId,
      workspaceId,
      confidence: 0.9,
      priority: newLevel === 'critical' ? 'High' : 'Medium',
      metadata: metadata as unknown as Record<string, unknown>,
    });

    logger.info('Risk level changed signal emitted', {
      dealId,
      previousLevel,
      newLevel,
      changeDirection,
    });

  } catch (error) {
    logger.error('Failed to emit risk level changed signal', error instanceof Error ? error : new Error(String(error)), { dealId });
  }
}

/**
 * Emit critical risk event
 */
export async function emitCriticalRisk(
  prediction: DealRiskPrediction,
  deal: Deal
): Promise<void> {
  try {
    const coordinator = getServerSignalCoordinator();
    
    const criticalRiskFactors = prediction.riskFactors
      .filter(f => f.severity === 'critical')
      .map(f => ({
        category: f.category,
        description: f.description,
        impact: f.impact,
      }));
    
    const urgentInterventions = prediction.interventions
      .filter(i => i.priority === 'critical' || i.priority === 'high')
      .slice(0, 3)
      .map(i => ({
        title: i.title,
        expectedImpact: i.expectedImpact,
        deadlineDays: i.deadlineDays,
      }));
    
    const metadata: CriticalRiskMetadata = {
      source: 'risk-engine',
      dealId: prediction.dealId,
      dealName: deal.name,
      dealValue: deal.value,
      slippageProbability: prediction.slippageProbability,
      lossProbability: prediction.lossProbability,
      criticalRiskFactors,
      urgentInterventions,
      revenueAtRisk: deal.value * (prediction.slippageProbability / 100),
    };
    
    await coordinator.emitSignal({
      type: 'risk.critical' as SignalType,
      leadId: deal.contactId,
      workspaceId: prediction.workspaceId,
      confidence: prediction.confidence / 100,
      priority: 'High',
      metadata: metadata as unknown as Record<string, unknown>,
    });

    logger.warn('Critical risk signal emitted', {
      dealId: prediction.dealId,
      slippageProbability: prediction.slippageProbability,
      criticalRisks: criticalRiskFactors.length,
    });

  } catch (error) {
    logger.error('Failed to emit critical risk signal', error instanceof Error ? error : new Error(String(error)), {
      dealId: prediction.dealId,
    });
  }
}

/**
 * Emit intervention recommended event
 */
export async function emitInterventionRecommended(
  intervention: Intervention,
  dealId: string,
  dealName: string,
  workspaceId: string,
  contactId?: string
): Promise<void> {
  try {
    const coordinator = getServerSignalCoordinator();

    const metadata: InterventionRecommendedMetadata = {
      source: 'risk-engine',
      dealId,
      dealName,
      interventionId: intervention.id,
      interventionType: intervention.type,
      priority: intervention.priority,
      title: intervention.title,
      expectedImpact: intervention.expectedImpact,
      estimatedEffort: intervention.estimatedEffort,
      roiScore: intervention.roiScore,
      deadlineDays: intervention.deadlineDays,
      suggestedOwner: intervention.suggestedOwner,
    };
    
    await coordinator.emitSignal({
      type: 'risk.intervention.recommended' as SignalType,
      leadId: contactId,
      workspaceId,
      confidence: 0.85,
      priority: intervention.priority === 'critical' ? 'High' : 'Medium',
      metadata: metadata as unknown as Record<string, unknown>,
    });

    logger.debug('Intervention recommended signal emitted', {
      dealId,
      interventionId: intervention.id,
      interventionType: intervention.type,
    });

  } catch (error) {
    logger.error('Failed to emit intervention recommended signal', error instanceof Error ? error : new Error(String(error)), {
      dealId,
      interventionId: intervention.id,
    });
  }
}

/**
 * Emit intervention started event
 */
export async function emitInterventionStarted(
  interventionId: string,
  interventionType: string,
  dealId: string,
  startedBy: string,
  workspaceId: string,
  contactId?: string
): Promise<void> {
  try {
    const coordinator = getServerSignalCoordinator();

    const metadata: InterventionStartedMetadata = {
      source: 'risk-engine',
      dealId,
      interventionId,
      interventionType,
      startedBy,
      startedAt: new Date().toISOString(),
    };
    
    await coordinator.emitSignal({
      type: 'risk.intervention.started' as SignalType,
      leadId: contactId,
      workspaceId,
      confidence: 1.0,
      priority: 'Medium',
      metadata: metadata as unknown as Record<string, unknown>,
    });

    logger.info('Intervention started signal emitted', {
      dealId,
      interventionId,
      startedBy,
    });

  } catch (error) {
    logger.error('Failed to emit intervention started signal', error instanceof Error ? error : new Error(String(error)), {
      dealId,
      interventionId,
    });
  }
}

/**
 * Emit intervention completed event
 */
export async function emitInterventionCompleted(
  interventionId: string,
  interventionType: string,
  dealId: string,
  completedBy: string,
  outcome: 'successful' | 'partial' | 'unsuccessful',
  impactRealized: number,
  workspaceId: string,
  contactId?: string,
  notes?: string
): Promise<void> {
  try {
    const coordinator = getServerSignalCoordinator();

    const metadata: InterventionCompletedMetadata = {
      source: 'risk-engine',
      dealId,
      interventionId,
      interventionType,
      completedBy,
      completedAt: new Date().toISOString(),
      outcome,
      impactRealized,
      notes,
    };
    
    await coordinator.emitSignal({
      type: 'risk.intervention.completed' as SignalType,
      leadId: contactId,
      workspaceId,
      confidence: 1.0,
      priority: 'Low',
      metadata: metadata as unknown as Record<string, unknown>,
    });

    logger.info('Intervention completed signal emitted', {
      dealId,
      interventionId,
      outcome,
      impactRealized,
    });

  } catch (error) {
    logger.error('Failed to emit intervention completed signal', error instanceof Error ? error : new Error(String(error)), {
      dealId,
      interventionId,
    });
  }
}

/**
 * Emit slippage predicted event
 */
export async function emitSlippagePredicted(
  prediction: DealRiskPrediction,
  deal: Deal
): Promise<void> {
  try {
    if (!prediction.predictedSlippageDate || !deal.expectedCloseDate) {
      return; // No slippage predicted
    }
    
    const coordinator = getServerSignalCoordinator();
    
    const primaryReasons = prediction.riskFactors
      .slice(0, 3)
      .map(f => f.description);
    
    const metadata: SlippagePredictedMetadata = {
      source: 'risk-engine',
      dealId: prediction.dealId,
      dealName: deal.name,
      dealValue: deal.value,
      originalCloseDate: new Date(deal.expectedCloseDate as string | number | Date).toISOString(),
      predictedSlippageDate: prediction.predictedSlippageDate.toISOString(),
      daysUntilSlippage: prediction.daysUntilSlippage ?? 0,
      slippageProbability: prediction.slippageProbability,
      primaryReasons,
    };
    
    await coordinator.emitSignal({
      type: 'risk.slippage.predicted' as SignalType,
      leadId: deal.contactId,
      workspaceId: prediction.workspaceId,
      confidence: prediction.confidence / 100,
      priority: 'High',
      metadata: metadata as unknown as Record<string, unknown>,
    });

    logger.warn('Slippage predicted signal emitted', {
      dealId: prediction.dealId,
      daysUntilSlippage: prediction.daysUntilSlippage,
      slippageProbability: prediction.slippageProbability,
    });

  } catch (error) {
    logger.error('Failed to emit slippage predicted signal', error instanceof Error ? error : new Error(String(error)), {
      dealId: prediction.dealId,
    });
  }
}

/**
 * Emit risk mitigated event
 */
export async function emitRiskMitigated(
  dealId: string,
  dealName: string,
  previousRiskLevel: RiskLevel,
  newRiskLevel: RiskLevel,
  previousSlippageProbability: number,
  newSlippageProbability: number,
  interventionsApplied: number,
  workspaceId: string,
  contactId?: string
): Promise<void> {
  try {
    const coordinator = getServerSignalCoordinator();

    const riskReduction = previousSlippageProbability - newSlippageProbability;
    
    const metadata: RiskMitigatedMetadata = {
      source: 'risk-engine',
      dealId,
      dealName,
      previousRiskLevel,
      newRiskLevel,
      previousSlippageProbability,
      newSlippageProbability,
      riskReduction,
      interventionsApplied,
    };
    
    await coordinator.emitSignal({
      type: 'risk.mitigated' as SignalType,
      leadId: contactId,
      workspaceId,
      confidence: 0.9,
      priority: 'Low',
      metadata: metadata as unknown as Record<string, unknown>,
    });

    logger.info('Risk mitigated signal emitted', {
      dealId,
      previousLevel: previousRiskLevel,
      newLevel: newRiskLevel,
      riskReduction,
    });

  } catch (error) {
    logger.error('Failed to emit risk mitigated signal', error instanceof Error ? error : new Error(String(error)), { dealId });
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get numeric score for risk level (for comparison)
 */
function getRiskLevelScore(level: RiskLevel): number {
  const scores: Record<RiskLevel, number> = {
    critical: 5,
    high: 4,
    medium: 3,
    low: 2,
    minimal: 1,
  };
  return scores[level];
}

/**
 * Emit all relevant signals for a new risk prediction
 */
export async function emitRiskPredictionSignals(
  prediction: DealRiskPrediction,
  deal: Deal
): Promise<void> {
  try {
    // Always emit risk assessed
    await emitRiskAssessed(prediction, deal);
    
    // Emit risk detected for medium+ risks
    if (prediction.riskLevel !== 'minimal' && prediction.riskLevel !== 'low') {
      await emitRiskDetected(prediction, deal);
    }
    
    // Emit critical risk for critical level
    if (prediction.riskLevel === 'critical') {
      await emitCriticalRisk(prediction, deal);
    }
    
    // Emit slippage predicted if applicable
    if (prediction.predictedSlippageDate) {
      await emitSlippagePredicted(prediction, deal);
    }
    
    // Emit intervention recommendations
    for (const intervention of prediction.interventions.slice(0, 3)) {
      await emitInterventionRecommended(
        intervention,
        prediction.dealId,
        deal.name,
        prediction.workspaceId,
        deal.contactId
      );
    }
    
    logger.info('All risk prediction signals emitted', {
      dealId: prediction.dealId,
      signalsEmitted: 2 + (prediction.riskLevel === 'critical' ? 1 : 0) +
                      (prediction.predictedSlippageDate ? 1 : 0) +
                      Math.min(3, prediction.interventions.length),
    });

  } catch (error) {
    logger.error('Failed to emit risk prediction signals', error instanceof Error ? error : new Error(String(error)), {
      dealId: prediction.dealId,
    });
  }
}
