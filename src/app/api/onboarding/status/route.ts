/**
 * Onboarding Status API Route
 *
 * Returns a checklist of setup tasks with completion status.
 * Used by the Jasper Task Reminder banner on the dashboard.
 *
 * The API key check is feature-aware: it only reports keys as missing
 * if they're required by a feature module the user has enabled.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';
import { FEATURE_MODULES } from '@/lib/constants/feature-modules';
import type { FeatureConfig } from '@/types/feature-modules';

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
  /** For api_keys task: which specific keys are missing */
  missingKeys?: string[];
}

interface OnboardingStatusResponse {
  tasks: SetupTask[];
  completedCount: number;
  totalCount: number;
  allComplete: boolean;
}

/**
 * Check which required API keys are configured based on enabled feature modules.
 *
 * Returns { allConfigured, missingKeys } where missingKeys lists the human-readable
 * labels of API keys that are required by enabled features but not yet set up.
 */
function checkFeatureApiKeys(
  apiKeysDoc: Record<string, unknown> | null,
  featureConfigDoc: Record<string, unknown> | null,
): { allConfigured: boolean; missingKeys: string[] } {
  // OpenRouter is always required — it's the foundation
  const hasOpenRouter = Boolean(
    apiKeysDoc &&
    typeof apiKeysDoc === 'object' &&
    (apiKeysDoc.openrouter ?? (apiKeysDoc.ai as Record<string, unknown> | undefined)?.openrouterApiKey)
  );

  if (!hasOpenRouter) {
    return { allConfigured: false, missingKeys: ['OpenRouter API Key (required for all AI features)'] };
  }

  // If no feature config, user hasn't gone through feature setup yet — just check OpenRouter
  if (!featureConfigDoc) {
    return { allConfigured: true, missingKeys: [] };
  }

  const modules = (featureConfigDoc as Partial<FeatureConfig>).modules;
  if (!modules) {
    return { allConfigured: true, missingKeys: [] };
  }

  const missingKeys: string[] = [];

  // For each enabled module, check if its required keys are configured
  for (const moduleDef of FEATURE_MODULES) {
    const isEnabled = modules[moduleDef.id];
    if (!isEnabled) {
      continue;
    }

    // Only check 'required' priority keys, not 'recommended' or 'optional'
    const requiredKeys = moduleDef.requiredApiKeys.filter(k => k.priority === 'required');

    for (const key of requiredKeys) {
      const isConfigured = checkApiKeyPresence(apiKeysDoc, key.serviceId);
      if (!isConfigured) {
        missingKeys.push(`${key.label} (for ${moduleDef.label})`);
      }
    }
  }

  return {
    allConfigured: missingKeys.length === 0,
    missingKeys,
  };
}

/**
 * Check if a specific API key service ID is present in the api-keys document.
 * Handles the nested structure of the Firestore api-keys doc.
 */
function checkApiKeyPresence(apiKeysDoc: Record<string, unknown> | null, serviceId: string): boolean {
  if (!apiKeysDoc) {
    return false;
  }

  // Map service IDs to their location in the Firestore api-keys document
  const keyPaths: Record<string, (doc: Record<string, unknown>) => boolean> = {
    openrouter: (d) => Boolean(d.openrouter ?? (d.ai as Record<string, unknown> | undefined)?.openrouterApiKey),
    sendgrid: (d) => Boolean((d.email as Record<string, unknown> | undefined)?.sendgrid),
    resend: (d) => Boolean((d.email as Record<string, unknown> | undefined)?.resend),
    stripe_secret: (d) => {
      const stripe = (d.payments as Record<string, unknown> | undefined)?.stripe;
      return Boolean(stripe && typeof stripe === 'object' && (stripe as Record<string, unknown>).secretKey);
    },
    stripe_publishable: (d) => {
      const stripe = (d.payments as Record<string, unknown> | undefined)?.stripe;
      return Boolean(stripe && typeof stripe === 'object' && (stripe as Record<string, unknown>).publishableKey);
    },
    paypal_client_id: (d) => Boolean((d.payments as Record<string, unknown> | undefined)?.paypal),
    twilio_account_sid: (d) => Boolean((d.sms as Record<string, unknown> | undefined)?.twilio),
    hedra: (d) => Boolean((d.video as Record<string, unknown> | undefined)?.hedra),
    fal: (d) => Boolean((d.imageGeneration as Record<string, unknown> | undefined)?.fal ?? d.fal),
    elevenlabs: (d) => Boolean((d.voice as Record<string, unknown> | undefined)?.elevenlabs ?? d.elevenlabs),
    twitter_consumer_key: (d) => Boolean((d.social as Record<string, unknown> | undefined)?.twitter ?? d.twitter),
    later: (d) => Boolean(d.later),
    google_client_id: (d) => Boolean(d.google_client_id ?? (d.oauth as Record<string, unknown> | undefined)?.google),
    pagespeed: (d) => Boolean(d.pagespeed ?? (d.seo as Record<string, unknown> | undefined)?.pagespeed),
    dataforseo_login: (d) => Boolean(d.dataforseo ?? (d.seo as Record<string, unknown> | undefined)?.dataforseo),
    clearbit_api_key: (d) => Boolean((d.enrichment as Record<string, unknown> | undefined)?.clearbitApiKey ?? d.clearbit),
    serper: (d) => Boolean((d.enrichment as Record<string, unknown> | undefined)?.serperApiKey ?? d.serper),
  };

  const checker = keyPaths[serviceId];
  if (checker) {
    return checker(apiKeysDoc);
  }

  // Fallback: check if the service ID exists as a top-level key
  return Boolean(apiKeysDoc[serviceId]);
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { AdminFirestoreService } = await import('@/lib/db/admin-firestore-service');

    // Check all setup milestones in parallel
    const { PLATFORM_ID } = await import('@/lib/constants/platform');

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
      AdminFirestoreService.get(getSubCollection('apiKeys'), PLATFORM_ID).catch(() => null),
      AdminFirestoreService.get(getSubCollection('settings'), 'feature_config').catch(() => null),
    ]);

    // Feature-aware API key check
    const apiKeys = apiKeysDoc as Record<string, unknown> | null;
    const featureConfig = featureConfigDoc as Record<string, unknown> | null;
    const { allConfigured, missingKeys } = checkFeatureApiKeys(apiKeys, featureConfig);

    // Build API key task description based on what's missing
    let apiKeyDescription = 'All required API keys are configured';
    let apiKeyLabel = 'API keys configured';
    if (!allConfigured && missingKeys.length > 0) {
      if (missingKeys.length === 1) {
        apiKeyDescription = `Missing: ${missingKeys[0]}`;
      } else {
        apiKeyDescription = `${missingKeys.length} keys needed for your enabled features`;
      }
      apiKeyLabel = `Configure API keys (${missingKeys.length} missing)`;
    }

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
        label: apiKeyLabel,
        description: apiKeyDescription,
        completed: allConfigured,
        actionUrl: '/settings/api-keys',
        priority: 2,
        missingKeys: missingKeys.length > 0 ? missingKeys : undefined,
      },
      {
        id: 'persona',
        label: 'AI agent persona created',
        description: 'Your AI agent\'s personality, tone, and greeting are configured',
        completed: personaDoc != null,
        actionUrl: '/settings/ai-agents/persona',
        priority: 3,
      },
      {
        id: 'knowledge_base',
        label: 'Knowledge base built',
        description: 'FAQs, product info, and business details loaded for AI responses',
        completed: knowledgeBaseDoc != null,
        actionUrl: '/settings/ai-agents/business-setup',
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
