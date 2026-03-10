/**
 * Onboarding Status API Route
 *
 * Returns a checklist of setup tasks with completion status.
 * Used by the Jasper Task Reminder on the dashboard.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SetupTask {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  /** URL to navigate to for completing this task */
  actionUrl: string;
  /** Priority: lower = more important */
  priority: number;
}

interface OnboardingStatusResponse {
  tasks: SetupTask[];
  completedCount: number;
  totalCount: number;
  allComplete: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { AdminFirestoreService } = await import('@/lib/db/admin-firestore-service');

    // Check all setup milestones in parallel
    const [
      onboardingDoc,
      personaDoc,
      knowledgeBaseDoc,
      baseModelsResult,
      apiKeysDoc,
      featureConfigDoc,
    ] = await Promise.all([
      AdminFirestoreService.get(getSubCollection('onboarding'), 'current').catch(() => null),
      AdminFirestoreService.get(getSubCollection('agentPersona'), 'current').catch(() => null),
      AdminFirestoreService.get(getSubCollection('knowledgeBase'), 'current').catch(() => null),
      AdminFirestoreService.getAll(getSubCollection('baseModels')).catch(() => []),
      AdminFirestoreService.get(getSubCollection('settings'), 'api-keys').catch(() => null),
      AdminFirestoreService.get(getSubCollection('settings'), 'feature_config').catch(() => null),
    ]);

    // Check API keys — at minimum OpenRouter is needed
    const apiKeys = apiKeysDoc as Record<string, unknown> | null;
    const hasOpenRouter = Boolean(apiKeys && typeof apiKeys === 'object' && apiKeys.openrouter);

    // Build task checklist
    const tasks: SetupTask[] = [
      {
        id: 'onboarding',
        label: 'Complete onboarding',
        description: 'Tell us about your business so Jasper can learn your industry',
        completed: onboardingDoc != null,
        actionUrl: '/onboarding/industry',
        priority: 1,
      },
      {
        id: 'api_keys',
        label: 'Configure AI API key',
        description: 'Connect your OpenRouter API key to power AI features',
        completed: hasOpenRouter,
        actionUrl: '/settings/api-keys',
        priority: 2,
      },
      {
        id: 'persona',
        label: 'AI agent persona created',
        description: 'Your AI agent\'s personality, tone, and greeting are configured',
        completed: personaDoc != null,
        actionUrl: '/settings/ai-agents',
        priority: 3,
      },
      {
        id: 'knowledge_base',
        label: 'Knowledge base built',
        description: 'FAQs, product info, and business details loaded for AI responses',
        completed: knowledgeBaseDoc != null,
        actionUrl: '/settings/ai-agents',
        priority: 4,
      },
      {
        id: 'base_model',
        label: 'Base model created',
        description: 'Your AI agent\'s core intelligence model is ready',
        completed: Array.isArray(baseModelsResult) && baseModelsResult.length > 0,
        actionUrl: '/settings/ai-agents/training',
        priority: 5,
      },
      {
        id: 'feature_config',
        label: 'Feature modules configured',
        description: 'Enable the tools your business needs (email, social, video, etc.)',
        completed: featureConfigDoc != null,
        actionUrl: '/settings/features',
        priority: 6,
      },
    ];

    // Sort by priority
    tasks.sort((a, b) => a.priority - b.priority);

    const completedCount = tasks.filter((t) => t.completed).length;

    const response: OnboardingStatusResponse = {
      tasks,
      completedCount,
      totalCount: tasks.length,
      allComplete: completedCount === tasks.length,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error(
      'Error fetching onboarding status',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/onboarding/status' }
    );
    return NextResponse.json(
      { error: 'Failed to fetch onboarding status' },
      { status: 500 }
    );
  }
}
