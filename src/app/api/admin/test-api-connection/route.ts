import type { NextRequest} from 'next/server';
import { z } from 'zod';

import { verifyAdminRequest, createErrorResponse, createSuccessResponse, isAuthError } from '@/lib/api/admin-auth';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';

export const dynamic = 'force-dynamic';

// ============================================================================
// Schemas & Type Definitions
// ============================================================================

const TestConnectionSchema = z.object({
  service: z.enum(['openai', 'anthropic', 'openrouter', 'gemini']),
});

interface ConnectionTestDetails {
  model?: string;
  [key: string]: unknown;
}

interface ConnectionTestResult {
  success: boolean;
  message?: string;
  error?: string;
  details?: ConnectionTestDetails;
}

interface OpenAIResponse {
  model?: string;
  [key: string]: unknown;
}

interface AnthropicResponse {
  model?: string;
  [key: string]: unknown;
}

interface OpenRouterResponse {
  model?: string;
  [key: string]: unknown;
}

interface ApiErrorResponse {
  error?: {
    message?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

// ============================================================================
// Type Guards
// ============================================================================

function isOpenAIResponse(data: unknown): data is OpenAIResponse {
  return typeof data === 'object' && data !== null;
}

function isAnthropicResponse(data: unknown): data is AnthropicResponse {
  return typeof data === 'object' && data !== null;
}

function isOpenRouterResponse(data: unknown): data is OpenRouterResponse {
  return typeof data === 'object' && data !== null;
}

function isApiErrorResponse(data: unknown): data is ApiErrorResponse {
  return typeof data === 'object' && data !== null;
}

function isError(error: unknown): error is Error {
  return error instanceof Error;
}

// ============================================================================
// Main Handler
// ============================================================================

/**
 * POST /api/admin/test-api-connection
 * Tests API connection for an organization's service
 * Returns success/error status from the provider
 */
export async function POST(request: NextRequest) {
  const authResult = await verifyAdminRequest(request);

  if (isAuthError(authResult)) {
    return createErrorResponse(authResult.error, authResult.status);
  }

  try {
    const body: unknown = await request.json();

    const parsed = TestConnectionSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse('Missing or invalid service', 400);
    }

    const { service } = parsed.data;

    // Get API key for the service
    const keys = await apiKeyService.getKeys();
    if (!keys) {
      return createErrorResponse('No API keys configured for this organization', 404);
    }

    let testResult: ConnectionTestResult;

    switch (service) {
      case 'openai':
        testResult = await testOpenAIConnection(keys.ai?.openaiApiKey);
        break;
      case 'anthropic':
        testResult = await testAnthropicConnection(keys.ai?.anthropicApiKey);
        break;
      case 'openrouter':
        testResult = await testOpenRouterConnection(keys.ai?.openrouterApiKey);
        break;
      case 'gemini':
        testResult = await testGeminiConnection(keys.ai?.geminiApiKey);
        break;
    }

    // Update API key document with test result
    try {
      const { adminDb } = await import('@/lib/firebase/admin');
      const { getSubCollection } = await import('@/lib/firebase/collections');
      if (adminDb) {
        const apiKeysPath = getSubCollection('apiKeys');
        await adminDb
          .collection(apiKeysPath)
          .doc(PLATFORM_ID)
          .update({
            [`ai.${service}LastChecked`]: new Date().toISOString(),
            [`ai.${service}LastError`]: testResult.success ? null : testResult.error,
            updatedAt: new Date().toISOString()
          });
      }
    } catch (updateError: unknown) {
      logger.error('Failed to update API key test result:', updateError instanceof Error ? updateError : new Error(String(updateError)), { file: 'route.ts' });
    }

    if (testResult.success) {
      return createSuccessResponse({
        message: testResult.message && testResult.message !== '' ? testResult.message : 'Connection successful',
        details: testResult.details
      });
    } else {
      return createErrorResponse(testResult.error && testResult.error !== '' ? testResult.error : 'Connection failed', 400);
    }

  } catch (error: unknown) {
    logger.error('API connection test error:', error instanceof Error ? error : new Error(String(error)), { file: 'route.ts' });
    const errorMessage = isError(error) ? error.message : 'Unknown error';
    return createErrorResponse(
      process.env.NODE_ENV === 'development'
        ? `Test failed: ${errorMessage}`
        : 'Test failed',
      500
    );
  }
}

// ============================================================================
// Connection Test Functions
// ============================================================================

/**
 * Test OpenAI API connection
 */
async function testOpenAIConnection(apiKey?: string): Promise<ConnectionTestResult> {
  if (!apiKey) {
    return { success: false, error: 'OpenAI API key not configured' };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Test connection' }],
        max_tokens: 5
      })
    });

    if (response.ok) {
      const data: unknown = await response.json();
      if (isOpenAIResponse(data)) {
        return {
          success: true,
          message: 'OpenAI API key is valid and working',
          details: { model: data.model }
        };
      }
      return {
        success: true,
        message: 'OpenAI API key is valid and working'
      };
    } else {
      const errorData: unknown = await response.json().catch(() => ({}));
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

      if (isApiErrorResponse(errorData)) {
        const errDataMsg = errorData.error?.message;
        if (errDataMsg && errDataMsg !== '') {
          errorMessage = errDataMsg;
        }
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  } catch (error: unknown) {
    const errorMessage = isError(error) ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Network error: ${errorMessage}`
    };
  }
}

/**
 * Test Anthropic API connection
 */
async function testAnthropicConnection(apiKey?: string): Promise<ConnectionTestResult> {
  if (!apiKey) {
    return { success: false, error: 'Anthropic API key not configured' };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        messages: [{ role: 'user', content: 'Test connection' }],
        max_tokens: 5
      })
    });

    if (response.ok) {
      const data: unknown = await response.json();
      if (isAnthropicResponse(data)) {
        return {
          success: true,
          message: 'Anthropic API key is valid and working',
          details: { model: data.model }
        };
      }
      return {
        success: true,
        message: 'Anthropic API key is valid and working'
      };
    } else {
      const errorData: unknown = await response.json().catch(() => ({}));
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

      if (isApiErrorResponse(errorData)) {
        const errDataMsg = errorData.error?.message;
        if (errDataMsg && errDataMsg !== '') {
          errorMessage = errDataMsg;
        }
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  } catch (error: unknown) {
    const errorMessage = isError(error) ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Network error: ${errorMessage}`
    };
  }
}

/**
 * Test OpenRouter API connection
 */
async function testOpenRouterConnection(apiKey?: string): Promise<ConnectionTestResult> {
  if (!apiKey) {
    return { success: false, error: 'OpenRouter API key not configured' };
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://salesvelocity.ai',
        'X-Title': 'SalesVelocity'
      },
      body: JSON.stringify({
        model: 'openai/gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Test connection' }],
        max_tokens: 5
      })
    });

    if (response.ok) {
      const data: unknown = await response.json();
      if (isOpenRouterResponse(data)) {
        return {
          success: true,
          message: 'OpenRouter API key is valid and working',
          details: { model: data.model }
        };
      }
      return {
        success: true,
        message: 'OpenRouter API key is valid and working'
      };
    } else {
      const errorData: unknown = await response.json().catch(() => ({}));
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

      if (isApiErrorResponse(errorData)) {
        const errDataMsg = errorData.error?.message;
        if (errDataMsg && errDataMsg !== '') {
          errorMessage = errDataMsg;
        }
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  } catch (error: unknown) {
    const errorMessage = isError(error) ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Network error: ${errorMessage}`
    };
  }
}

/**
 * Test Google Gemini API connection
 */
async function testGeminiConnection(apiKey?: string): Promise<ConnectionTestResult> {
  if (!apiKey) {
    return { success: false, error: 'Gemini API key not configured' };
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: 'Test connection' }]
        }]
      })
    });

    if (response.ok) {
      return {
        success: true,
        message: 'Gemini API key is valid and working',
        details: { model: 'gemini-pro' }
      };
    } else {
      const errorData: unknown = await response.json().catch(() => ({}));
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

      if (isApiErrorResponse(errorData)) {
        const errDataMsg = errorData.error?.message;
        if (errDataMsg && errDataMsg !== '') {
          errorMessage = errDataMsg;
        }
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  } catch (error: unknown) {
    const errorMessage = isError(error) ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Network error: ${errorMessage}`
    };
  }
}
