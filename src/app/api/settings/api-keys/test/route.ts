/**
 * Test API Keys
 * Verifies that API keys are working
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');
    const service = searchParams.get('service');

    if (!orgId || !service) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Load API keys
    const apiKeys = await FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}`,
      'apiKeys'
    );

    if (!apiKeys || !apiKeys[service]) {
      return NextResponse.json(
        { success: false, error: 'API key not found' },
        { status: 404 }
      );
    }

    const apiKey = apiKeys[service];

    // Test the specific service
    switch (service) {
      case 'openai':
        return await testOpenAI(apiKey);
      
      case 'sendgrid':
        return await testSendGrid(apiKey);
      
      case 'google_client_id':
      case 'google_client_secret':
        return await testGoogle(apiKeys);
      
      case 'stripe_publishable':
      case 'stripe_secret':
        return await testStripe(apiKeys);
      
      default:
        return NextResponse.json({
          success: true,
          message: 'API key saved (test not implemented for this service)',
        });
    }
  } catch (error: any) {
    console.error('[API Keys Test] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
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
      const error = await response.json();
      return NextResponse.json({
        success: false,
        error: error.error?.message || 'Invalid API key',
      });
    }
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
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
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Test Google OAuth credentials
 */
async function testGoogle(apiKeys: any): Promise<NextResponse> {
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
async function testStripe(apiKeys: any): Promise<NextResponse> {
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
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    });
  }
}


















