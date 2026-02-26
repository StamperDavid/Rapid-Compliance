import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { getSubCollection } from '@/lib/firebase/collections';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

/**
 * Agent Configuration Types
 */
interface ModelConfig {
  temperature: number;
  maxTokens: number;
  topP: number;
  topK?: number;
  stopSequences?: string[];
  presencePenalty?: number;
  frequencyPenalty?: number;
}

interface AgentConfigData {
  selectedModel: string;
  modelConfig: ModelConfig;
  updatedAt?: string;
}

interface _AgentConfigResponse {
  success: true;
  selectedModel: string;
  modelConfig: ModelConfig;
  updatedAt?: string;
}

interface _SaveConfigResponse {
  success: true;
  message: string;
}

const modelConfigSchema = z.object({
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().int().positive(),
  topP: z.number().min(0).max(1),
  topK: z.number().int().optional(),
  stopSequences: z.array(z.string()).optional(),
  presencePenalty: z.number().optional(),
  frequencyPenalty: z.number().optional(),
});

const saveConfigRequestSchema = z.object({
  selectedModel: z.string().optional(),
  modelConfig: modelConfigSchema.optional(),
});

/**
 * Default model configuration
 */
const DEFAULT_MODEL_CONFIG: ModelConfig = {
  temperature: 0.7,
  maxTokens: 2048,
  topP: 0.9,
};

const DEFAULT_MODEL = 'gpt-4-turbo';

/**
 * Type guard for agent config data
 */
function isValidAgentConfig(data: unknown): data is AgentConfigData {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const config = data as Record<string, unknown>;

  return (
    typeof config.selectedModel === 'string' &&
    typeof config.modelConfig === 'object' &&
    config.modelConfig !== null
  );
}

/**
 * GET: Load agent configuration
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const rateLimitResponse = await rateLimitMiddleware(request, '/api/agent/config');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Get agent configuration
    const agentConfigRaw = await AdminFirestoreService.get(
      getSubCollection('agentConfig'),
      'default'
    );

    if (!agentConfigRaw) {
      // Return defaults if no config exists (single model - ensemble removed for MVP)
      return NextResponse.json({
        success: true,
        selectedModel: DEFAULT_MODEL,
        modelConfig: DEFAULT_MODEL_CONFIG,
      });
    }

    // Validate and type the configuration
    if (!isValidAgentConfig(agentConfigRaw)) {
      logger.warn('Invalid agent config structure, returning defaults', {
        route: '/api/agent/config',
      });

      return NextResponse.json({
        success: true,
        selectedModel: DEFAULT_MODEL,
        modelConfig: DEFAULT_MODEL_CONFIG,
      });
    }

    return NextResponse.json({
      success: true,
      selectedModel: agentConfigRaw.selectedModel,
      modelConfig: agentConfigRaw.modelConfig,
      updatedAt: agentConfigRaw.updatedAt,
    });
  } catch (error) {
    logger.error('Error loading agent config', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/agent/config'
    });
    return errors.database(
      'Failed to load configuration',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * POST: Save agent configuration
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const rateLimitResponse = await rateLimitMiddleware(request, '/api/agent/config');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const rawBody: unknown = await request.json();
    const parsed = saveConfigRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return errors.badRequest(
        parsed.error.errors[0]?.message ?? 'Invalid request body'
      );
    }
    const { selectedModel, modelConfig } = parsed.data;

    // Prepare configuration data with defaults
    const configData: AgentConfigData = {
      selectedModel: (selectedModel && selectedModel !== '') ? selectedModel : DEFAULT_MODEL,
      modelConfig: modelConfig ?? DEFAULT_MODEL_CONFIG,
      updatedAt: new Date().toISOString(),
    };

    // Save agent configuration (single model - ensemble removed for MVP)
    await AdminFirestoreService.set(
      getSubCollection('agentConfig'),
      'default',
      configData as unknown as Record<string, unknown>,
      false
    );

    return NextResponse.json({
      success: true,
      message: 'AI configuration saved successfully',
    });
  } catch (error) {
    logger.error('Error saving agent config', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/agent/config'
    });
    return errors.database(
      'Failed to save configuration',
      error instanceof Error ? error : undefined
    );
  }
}

