/**
 * Test Outbound Features
 * GET /api/test/outbound?orgId=xxx
 * Verifies all outbound features are configured correctly
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get('orgId');

  const results: any = {
    timestamp: new Date().toISOString(),
    tests: [],
  };

  // Test 1: Environment Variables
  results.tests.push({
    name: 'Environment Variables',
    checks: {
      sendgrid: !!process.env.SENDGRID_API_KEY,
      googleClientId: !!process.env.GOOGLE_CLIENT_ID,
      googleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      openai: !!process.env.OPENAI_API_KEY,
      firebase: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    },
    status: process.env.SENDGRID_API_KEY && process.env.GOOGLE_CLIENT_ID ? 'pass' : 'fail',
  });

  // Test 2: SendGrid Connection
  try {
    const sgMail = await import('@sendgrid/mail');
    if (process.env.SENDGRID_API_KEY) {
      sgMail.default.setApiKey(process.env.SENDGRID_API_KEY);
      results.tests.push({
        name: 'SendGrid Connection',
        status: 'pass',
        message: 'SendGrid API key is configured',
      });
    } else {
      results.tests.push({
        name: 'SendGrid Connection',
        status: 'fail',
        message: 'SENDGRID_API_KEY not configured',
      });
    }
  } catch (error: any) {
    results.tests.push({
      name: 'SendGrid Connection',
      status: 'error',
      message: error.message,
    });
  }

  // Test 3: Google OAuth Configuration
  try {
    const { getAuthUrl } = await import('@/lib/integrations/google-calendar-service');
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      const url = getAuthUrl();
      results.tests.push({
        name: 'Google OAuth',
        status: url.includes('googleapis.com') ? 'pass' : 'fail',
        message: 'Google OAuth is configured',
      });
    } else {
      results.tests.push({
        name: 'Google OAuth',
        status: 'fail',
        message: 'Google OAuth credentials not configured',
      });
    }
  } catch (error: any) {
    results.tests.push({
      name: 'Google OAuth',
      status: 'error',
      message: error.message,
    });
  }

  // Test 4: AI Email Generation
  try {
    const { generateColdEmail } = await import('@/lib/outbound/email-writer');
    if (process.env.OPENAI_API_KEY) {
      // Don't actually call the API, just check it's configured
      results.tests.push({
        name: 'AI Email Generation',
        status: 'pass',
        message: 'OpenAI API key configured',
      });
    } else {
      results.tests.push({
        name: 'AI Email Generation',
        status: 'fail',
        message: 'OPENAI_API_KEY not configured',
      });
    }
  } catch (error: any) {
    results.tests.push({
      name: 'AI Email Generation',
      status: 'error',
      message: error.message,
    });
  }

  // Test 5: Firestore Connection
  try {
    const { FirestoreService } = await import('@/lib/db/firestore-service');
    results.tests.push({
      name: 'Firestore Connection',
      status: 'pass',
      message: 'Firestore service available',
    });
  } catch (error: any) {
    results.tests.push({
      name: 'Firestore Connection',
      status: 'error',
      message: error.message,
    });
  }

  // Calculate overall status
  const passed = results.tests.filter((t: any) => t.status === 'pass').length;
  const failed = results.tests.filter((t: any) => t.status === 'fail').length;
  const errors = results.tests.filter((t: any) => t.status === 'error').length;

  results.summary = {
    passed,
    failed,
    errors,
    total: results.tests.length,
    ready: failed === 0 && errors === 0,
  };

  return NextResponse.json(results);
}











