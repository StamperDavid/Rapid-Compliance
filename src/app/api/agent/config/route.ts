import { type NextRequest, NextResponse } from 'next/server';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

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

interface SaveConfigRequestBody {
  orgId: string;
  selectedModel?: string;
  modelConfig?: ModelConfig;
}

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
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/agent/config');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // PENTHOUSE: Always use DEFAULT_ORG_ID
    const orgId = DEFAULT_ORG_ID;

    // Get agent configuration
    const agentConfigRaw = await FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/agentConfig`,
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
        orgId,
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
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/agent/config');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await request.json() as SaveConfigRequestBody;
    const { selectedModel, modelConfig } = body;

    // PENTHOUSE: Always use DEFAULT_ORG_ID
    const orgId = DEFAULT_ORG_ID;

    // Prepare configuration data with defaults
    const configData: AgentConfigData = {
      selectedModel: (selectedModel && selectedModel !== '') ? selectedModel : DEFAULT_MODEL,
      modelConfig: modelConfig ?? DEFAULT_MODEL_CONFIG,
      updatedAt: new Date().toISOString(),
    };

    // Save agent configuration (single model - ensemble removed for MVP)
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/agentConfig`,
      'default',
      configData,
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

