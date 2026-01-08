import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { verifyAdminRequest, createErrorResponse, createSuccessResponse, isAuthError } from '@/lib/api/admin-auth';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { logger } from '@/lib/logger/logger';

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
    const body = await request.json();
    const { orgId, service } = body;

    if (!orgId || !service) {
      return createErrorResponse('Missing orgId or service', 400);
    }

    // Get API key for the service
    const keys = await apiKeyService.getKeys(orgId);
    if (!keys) {
      return createErrorResponse('No API keys configured for this organization', 404);
    }

    let testResult;
    let errorDetails;

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
      default:
        return createErrorResponse(`Unsupported service: ${service}`, 400);
    }

    // Update API key document with test result
    try {
      const { adminDb } = await import('@/lib/firebase/admin');
      const { getOrgSubCollection } = await import('@/lib/firebase/collections');
      if (adminDb) {
        const apiKeysPath = getOrgSubCollection(orgId, 'apiKeys');
        await adminDb
          .collection(apiKeysPath)
          .doc(orgId)
          .update({
            [`ai.${service}LastChecked`]: new Date().toISOString(),
            [`ai.${service}LastError`]: testResult.success ? null : testResult.error,
            updatedAt: new Date().toISOString()
          });
      }
    } catch (updateError) {
      logger.error('Failed to update API key test result:', updateError, { file: 'route.ts' });
    }

    if (testResult.success) {
      return createSuccessResponse({
        message:(testResult.message !== '' && testResult.message != null) ? testResult.message : 'Connection successful',
        details: testResult.details
      });
    } else {
      return createErrorResponse((testResult.error !== '' && testResult.error != null) ? testResult.error : 'Connection failed', 400);
    }

  } catch (error: any) {
    logger.error('API connection test error:', error, { file: 'route.ts' });
    return createErrorResponse(
      process.env.NODE_ENV === 'development' 
        ? `Test failed: ${error.message}`
        : 'Test failed',
      500
    );
  }
}

/**
 * Test OpenAI API connection
 */
async function testOpenAIConnection(apiKey?: string): Promise<{ success: boolean; message?: string; error?: string; details?: any }> {
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
      const data = await response.json();
      return {
        success: true,
        message: 'OpenAI API key is valid and working',
        details: { model: data.model }
      };
    } else {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?(.message !== '' && .message != null) ? .message : `HTTP ${response.status}: ${response.statusText}`;
      return {
        success: false,
        error: errorMessage
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: `Network error: ${error.message}`
    };
  }
}

/**
 * Test Anthropic API connection
 */
async function testAnthropicConnection(apiKey?: string): Promise<{ success: boolean; message?: string; error?: string; details?: any }> {
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
      const data = await response.json();
      return {
        success: true,
        message: 'Anthropic API key is valid and working',
        details: { model: data.model }
      };
    } else {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?(.message !== '' && .message != null) ? .message : `HTTP ${response.status}: ${response.statusText}`;
      return {
        success: false,
        error: errorMessage
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: `Network error: ${error.message}`
    };
  }
}

/**
 * Test OpenRouter API connection
 */
async function testOpenRouterConnection(apiKey?: string): Promise<{ success: boolean; message?: string; error?: string; details?: any }> {
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
        'X-Title': 'SalesVelocity AI'
      },
      body: JSON.stringify({
        model: 'openai/gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Test connection' }],
        max_tokens: 5
      })
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        message: 'OpenRouter API key is valid and working',
        details: { model: data.model }
      };
    } else {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?(.message !== '' && .message != null) ? .message : `HTTP ${response.status}: ${response.statusText}`;
      return {
        success: false,
        error: errorMessage
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: `Network error: ${error.message}`
    };
  }
}

/**
 * Test Google Gemini API connection
 */
async function testGeminiConnection(apiKey?: string): Promise<{ success: boolean; message?: string; error?: string; details?: any }> {
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
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?(.message !== '' && .message != null) ? .message : `HTTP ${response.status}: ${response.statusText}`;
      return {
        success: false,
        error: errorMessage
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: `Network error: ${error.message}`
    };
  }
}
