/**
 * Test API Keys
 * Verifies that API keys are working
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

// Type definitions for API responses
interface OpenAIErrorResponse {
  error?: {
    message?: string;
  };
}

interface AnthropicErrorResponse {
  error?: {
    message?: string;
  };
}

interface GeminiErrorResponse {
  error?: {
    message?: string;
  };
}

interface SlackAuthResponse {
  ok: boolean;
  team?: string;
  error?: string;
}

// Type definition for API keys collection
interface ApiKeysCollection {
  openai?: string;
  anthropic?: string;
  gemini?: string;
  openrouter?: string;
  sendgrid?: string;
  resend?: string;
  twilio_account_sid?: string;
  twilio_auth_token?: string;
  google_client_id?: string;
  google_client_secret?: string;
  stripe_publishable?: string;
  stripe_secret?: string;
  paypal_client_id?: string;
  paypal_client_secret?: string;
  square_access_token?: string;
  quickbooks_client_id?: string;
  quickbooks_client_secret?: string;
  xero_client_id?: string;
  xero_client_secret?: string;
  slack_token?: string;
  teams_webhook_url?: string;
  zoom_api_key?: string;
  zoom_api_secret?: string;
  [key: string]: string | undefined;
}

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/settings/api-keys/test');
    if (rateLimitResponse) {return rateLimitResponse;}

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');
    const service = searchParams.get('service');

    if (!orgId || !service) {
      return errors.badRequest('Missing required parameters');
    }

    // Load API keys
    const apiKeys = await FirestoreService.get<ApiKeysCollection>(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}`,
      'apiKeys'
    );

    if (!apiKeys?.[service]) {
      return errors.notFound('API key not found');
    }

    const apiKey = apiKeys[service];

    if (!apiKey) {
      return errors.notFound('API key not found');
    }

    // Test the specific service
    switch (service) {
      case 'openai':
        return await testOpenAI(apiKey);

      case 'anthropic':
        return await testAnthropic(apiKey);

      case 'gemini':
        return await testGemini(apiKey);

      case 'openrouter':
        return await testOpenRouter(apiKey);

      case 'sendgrid':
        return await testSendGrid(apiKey);

      case 'resend':
        return await testResend(apiKey);

      case 'twilio_account_sid':
      case 'twilio_auth_token':
        return await testTwilio(apiKeys);

      case 'google_client_id':
      case 'google_client_secret':
        return testGoogle(apiKeys);

      case 'stripe_publishable':
      case 'stripe_secret':
        return await testStripe(apiKeys);

      case 'paypal_client_id':
      case 'paypal_client_secret':
        return await testPayPal(apiKeys);

      case 'square_access_token':
        return await testSquare(apiKey);

      case 'quickbooks_client_id':
      case 'quickbooks_client_secret':
        return testQuickBooks(apiKeys);

      case 'xero_client_id':
      case 'xero_client_secret':
        return testXero(apiKeys);

      case 'slack_token':
        return await testSlack(apiKey);

      case 'teams_webhook_url':
        return await testTeams(apiKey);

      case 'zoom_api_key':
      case 'zoom_api_secret':
        return testZoom(apiKeys);

      default:
        return NextResponse.json({
          success: true,
          message: 'API key saved (test not implemented for this service)',
        });
    }
  } catch (error: unknown) {
    logger.error('API key test error', error instanceof Error ? error : undefined, { route: '/api/settings/api-keys/test' });
    return errors.externalService('API service', error instanceof Error ? error : undefined);
  }
}

/**
 * Test OpenAI API key
 */
async function testOpenAI(apiKey: string): Promise<NextResponse> {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      return NextResponse.json({
        success: true,
        message: 'OpenAI API key is valid and working!',
      });
    } else {
      const errorData = await response.json() as OpenAIErrorResponse;
      const errorMessage = errorData.error?.message;
      return NextResponse.json({
        success: false,
        error: (errorMessage !== '' && errorMessage != null) ? errorMessage : 'Invalid API key',
      });
    }
  } catch (error: unknown) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Test SendGrid API key
 */
async function testSendGrid(apiKey: string): Promise<NextResponse> {
  try {
    // SendGrid API key validation endpoint
    const response = await fetch('https://api.sendgrid.com/v3/scopes', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      return NextResponse.json({
        success: true,
        message: 'SendGrid API key is valid and working!',
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid SendGrid API key',
      });
    }
  } catch (error: unknown) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Test Google OAuth credentials
 */
function testGoogle(apiKeys: ApiKeysCollection): NextResponse {
  const clientId = apiKeys.google_client_id;
  const clientSecret = apiKeys.google_client_secret;

  if (!clientId || !clientSecret) {
    return NextResponse.json({
      success: false,
      error: 'Both Google Client ID and Client Secret are required',
    });
  }

  // Basic validation
  if (!clientId.endsWith('.apps.googleusercontent.com')) {
    return NextResponse.json({
      success: false,
      error: 'Client ID should end with .apps.googleusercontent.com',
    });
  }

  if (!clientSecret.startsWith('GOCSPX-')) {
    return NextResponse.json({
      success: false,
      error: 'Client Secret should start with GOCSPX-',
    });
  }

  return NextResponse.json({
    success: true,
    message: 'Google OAuth credentials look valid! (Full test requires user authorization)',
  });
}

/**
 * Test Stripe API keys
 */
async function testStripe(apiKeys: ApiKeysCollection): Promise<NextResponse> {
  const secretKey = apiKeys.stripe_secret;

  if (!secretKey) {
    return NextResponse.json({
      success: false,
      error: 'Stripe Secret Key is required for testing',
    });
  }

  try {
    // Test Stripe API
    const response = await fetch('https://api.stripe.com/v1/balance', {
      headers: {
        'Authorization': `Bearer ${secretKey}`,
      },
    });

    if (response.ok) {
      return NextResponse.json({
        success: true,
        message: 'Stripe API keys are valid and working!',
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid Stripe API key',
      });
    }
  } catch (error: unknown) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Test Anthropic API key
 */
async function testAnthropic(apiKey: string): Promise<NextResponse> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    });

    if (response.ok) {
      return NextResponse.json({
        success: true,
        message: 'Anthropic API key is valid and working!',
      });
    } else {
      const errorData = await response.json() as AnthropicErrorResponse;
      const errorMessage = errorData.error?.message;
      return NextResponse.json({
        success: false,
        error: (errorMessage !== '' && errorMessage != null) ? errorMessage : 'Invalid API key',
      }, { status: 400 });
    }
  } catch (error: unknown) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 400 });
  }
}

/**
 * Test Google Gemini API key
 */
async function testGemini(apiKey: string): Promise<NextResponse> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`,
      {
        method: 'GET',
      }
    );

    if (response.ok) {
      return NextResponse.json({
        success: true,
        message: 'Gemini API key is valid and working!',
      });
    } else {
      const errorData = await response.json() as GeminiErrorResponse;
      const errorMessage = errorData.error?.message;
      return NextResponse.json({
        success: false,
        error: (errorMessage !== '' && errorMessage != null) ? errorMessage : 'Invalid API key',
      }, { status: 400 });
    }
  } catch (error: unknown) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 400 });
  }
}

/**
 * Test OpenRouter API key
 */
async function testOpenRouter(apiKey: string): Promise<NextResponse> {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      return NextResponse.json({
        success: true,
        message: 'OpenRouter API key is valid and working!',
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid OpenRouter API key',
      }, { status: 400 });
    }
  } catch (error: unknown) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 400 });
  }
}

/**
 * Test Resend API key
 */
async function testResend(apiKey: string): Promise<NextResponse> {
  try {
    const response = await fetch('https://api.resend.com/domains', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      return NextResponse.json({
        success: true,
        message: 'Resend API key is valid and working!',
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid Resend API key',
      }, { status: 400 });
    }
  } catch (error: unknown) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 400 });
  }
}

/**
 * Test Twilio credentials
 */
async function testTwilio(apiKeys: ApiKeysCollection): Promise<NextResponse> {
  const accountSid = apiKeys.twilio_account_sid;
  const authToken = apiKeys.twilio_auth_token;

  if (!accountSid || !authToken) {
    return NextResponse.json({
      success: false,
      error: 'Both Twilio Account SID and Auth Token are required',
    }, { status: 400 });
  }

  try {
    // Test Twilio API
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`,
      {
        headers: {
          'Authorization': `Basic ${auth}`,
        },
      }
    );

    if (response.ok) {
      return NextResponse.json({
        success: true,
        message: 'Twilio credentials are valid and working!',
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid Twilio credentials',
      }, { status: 400 });
    }
  } catch (error: unknown) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 400 });
  }
}

/**
 * Test PayPal credentials
 */
async function testPayPal(apiKeys: ApiKeysCollection): Promise<NextResponse> {
  const clientId = apiKeys.paypal_client_id;
  const clientSecret = apiKeys.paypal_client_secret;

  if (!clientId || !clientSecret) {
    return NextResponse.json({
      success: false,
      error: 'Both PayPal Client ID and Client Secret are required',
    }, { status: 400 });
  }

  try {
    // Get OAuth token from PayPal
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (response.ok) {
      return NextResponse.json({
        success: true,
        message: 'PayPal credentials are valid and working!',
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid PayPal credentials',
      }, { status: 400 });
    }
  } catch (error: unknown) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 400 });
  }
}

/**
 * Test Square access token
 */
async function testSquare(apiKey: string): Promise<NextResponse> {
  try {
    const response = await fetch('https://connect.squareupsandbox.com/v2/locations', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Square-Version': '2023-12-13',
      },
    });

    if (response.ok) {
      return NextResponse.json({
        success: true,
        message: 'Square access token is valid and working!',
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid Square access token',
      }, { status: 400 });
    }
  } catch (error: unknown) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 400 });
  }
}

/**
 * Test QuickBooks credentials
 */
function testQuickBooks(apiKeys: ApiKeysCollection): NextResponse {
  const clientId = apiKeys.quickbooks_client_id;
  const clientSecret = apiKeys.quickbooks_client_secret;

  if (!clientId || !clientSecret) {
    return NextResponse.json({
      success: false,
      error: 'Both QuickBooks Client ID and Client Secret are required',
    }, { status: 400 });
  }

  // Basic validation for QuickBooks OAuth credentials
  if (!clientId || clientId.length < 10) {
    return NextResponse.json({
      success: false,
      error: 'QuickBooks Client ID appears invalid',
    }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    message: 'QuickBooks credentials saved! (Full test requires user authorization)',
  });
}

/**
 * Test Xero credentials
 */
function testXero(apiKeys: ApiKeysCollection): NextResponse {
  const clientId = apiKeys.xero_client_id;
  const clientSecret = apiKeys.xero_client_secret;

  if (!clientId || !clientSecret) {
    return NextResponse.json({
      success: false,
      error: 'Both Xero Client ID and Client Secret are required',
    }, { status: 400 });
  }

  // Basic validation for Xero OAuth credentials
  if (!clientId || clientId.length < 10) {
    return NextResponse.json({
      success: false,
      error: 'Xero Client ID appears invalid',
    }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    message: 'Xero credentials saved! (Full test requires user authorization)',
  });
}

/**
 * Test Slack token
 */
async function testSlack(apiKey: string): Promise<NextResponse> {
  try {
    const response = await fetch('https://slack.com/api/auth.test', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    const data = await response.json() as SlackAuthResponse;

    if (data.ok) {
      return NextResponse.json({
        success: true,
        message: `Slack token is valid! Connected to: ${data.team ?? 'Unknown team'}`,
      });
    } else {
      return NextResponse.json({
        success: false,
        error:(data.error !== '' && data.error != null) ? data.error : 'Invalid Slack token',
      }, { status: 400 });
    }
  } catch (error: unknown) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 400 });
  }
}

/**
 * Test Microsoft Teams webhook URL
 */
async function testTeams(webhookUrl: string): Promise<NextResponse> {
  try {
    // Send a test message to the webhook
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: 'AI Sales Platform: Test message - your Teams webhook is configured correctly!',
      }),
    });

    if (response.ok || response.status === 200) {
      return NextResponse.json({
        success: true,
        message: 'Teams webhook URL is valid and working!',
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid Teams webhook URL',
      }, { status: 400 });
    }
  } catch (error: unknown) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 400 });
  }
}

/**
 * Test Zoom credentials
 */
function testZoom(apiKeys: ApiKeysCollection): NextResponse {
  const apiKey = apiKeys.zoom_api_key;
  const apiSecret = apiKeys.zoom_api_secret;

  if (!apiKey || !apiSecret) {
    return NextResponse.json({
      success: false,
      error: 'Both Zoom API Key and API Secret are required',
    }, { status: 400 });
  }

  // Basic validation for Zoom credentials
  if (!apiKey || apiKey.length < 10 || !apiSecret || apiSecret.length < 10) {
    return NextResponse.json({
      success: false,
      error: 'Zoom credentials appear invalid',
    }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    message: 'Zoom credentials saved! (Full test requires generating JWT token)',
  });
}
