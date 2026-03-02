/**
 * Agent Performance Analysis API
 *
 * POST /api/agent-performance/analyze — trigger coaching analysis for an agent rep profile
 *
 * Runs the coaching analytics engine against an AI agent's production data,
 * then bridges the resulting insights into the training pipeline via
 * coaching-training-bridge.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { AnalyzeAgentPerformanceRequestSchema } from '@/lib/training/agent-training-validation';
import { getAgentRepProfile } from '@/lib/agents/agent-rep-profiles';
import { CoachingAnalyticsEngine } from '@/lib/coaching/coaching-analytics-engine';
import { CoachingGenerator } from '@/lib/coaching/coaching-generator';
import { mapCoachingToTrainingSignals, createTrainingRequestFromCoaching } from '@/lib/training/coaching-training-bridge';
import { emitCoachingSignal, createAgentPerformanceAnalyzedEvent, createAgentTrainingTriggeredEvent } from '@/lib/coaching/events';
import { adminDal } from '@/lib/firebase/admin-dal';
import { DEFAULT_COACHING_MODEL } from '@/lib/coaching/coaching-models';
import type { TimePeriod } from '@/lib/coaching/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/agent-performance/analyze');
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    // Parse and validate body
    const body = await request.json() as unknown;
    const parseResult = AnalyzeAgentPerformanceRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return errors.badRequest(parseResult.error.errors[0]?.message ?? 'Invalid request');
    }

    const { agentId, period } = parseResult.data;

    // 1. Load agent rep profile
    const agentProfile = await getAgentRepProfile(agentId);
    if (!agentProfile) {
      return errors.notFound(`Agent rep profile not found: ${agentId}`);
    }

    if (!adminDal) {
      return errors.internal('Database not available');
    }

    // 2. Run coaching analytics engine against this agent's data
    const analyticsEngine = new CoachingAnalyticsEngine(adminDal);
    const performance = await analyticsEngine.analyzeRepPerformance(agentId, period as TimePeriod);

    // Mark as AI
    performance.isAI = true;

    // 3. Generate coaching insights
    const generator = new CoachingGenerator({ model: DEFAULT_COACHING_MODEL });
    const insights = await generator.generateCoachingInsights(performance, {
      includeDetailed: true,
      includeTraining: true,
      includeActionItems: true,
    });

    // 4. Map coaching insights → training signals
    const improvements = mapCoachingToTrainingSignals(insights, agentProfile.agentType);

    // 5. Create training request if there are improvements
    let updateRequest = null;
    if (improvements.length > 0 && agentProfile.goldenMasterId) {
      updateRequest = await createTrainingRequestFromCoaching(
        agentProfile.goldenMasterId,
        insights,
        agentProfile.agentType
      );
    }

    // 6. Emit signals
    await emitCoachingSignal(createAgentPerformanceAnalyzedEvent(
      agentId,
      agentProfile.agentType,
      'manual_analysis',
      performance.overallScore,
      false,
      agentProfile.performanceThresholds.flagForTrainingBelow,
      []
    ));

    if (updateRequest) {
      await emitCoachingSignal(createAgentTrainingTriggeredEvent(
        agentProfile.agentType,
        updateRequest.goldenMasterId,
        updateRequest.id,
        'coaching_bridge',
        updateRequest.improvements.length,
        updateRequest.impactAnalysis.expectedScoreImprovement,
        updateRequest.impactAnalysis.confidence
      ));
    }

    logger.info('[AgentPerformanceAPI] Analysis complete', {
      agentId,
      agentType: agentProfile.agentType,
      overallScore: performance.overallScore,
      improvementCount: improvements.length,
      updateRequestCreated: !!updateRequest,
    });

    return NextResponse.json({
      success: true,
      agentId,
      agentType: agentProfile.agentType,
      performance: {
        overallScore: performance.overallScore,
        tier: performance.tier,
        period: performance.period,
        trend: performance.vsTeamAverage?.overallScoreDelta !== undefined
          ? (performance.vsTeamAverage.overallScoreDelta > 2 ? 'improving' : performance.vsTeamAverage.overallScoreDelta < -2 ? 'declining' : 'stable')
          : 'stable',
      },
      insights: {
        weaknessCount: insights.weaknesses.length,
        recommendationCount: insights.recommendations.length,
        trainingCount: insights.training.length,
        riskCount: insights.risks.length,
        confidenceScore: insights.confidenceScore,
        // Full coaching insights for the Training Center UI
        strengths: insights.strengths,
        weaknesses: insights.weaknesses,
        recommendations: insights.recommendations,
        training: insights.training,
        risks: insights.risks,
        actionItems: insights.actionItems,
        performanceSummary: insights.performanceSummary,
      },
      training: {
        improvementCount: improvements.length,
        updateRequestId: updateRequest?.id ?? null,
        updateRequestStatus: updateRequest?.status ?? null,
      },
    });
  } catch (error) {
    logger.error(
      '[AgentPerformanceAPI] Analysis failed',
      error instanceof Error ? error : new Error(String(error))
    );
    return errors.internal(
      error instanceof Error ? error.message : 'Agent performance analysis failed'
    );
  }
}
