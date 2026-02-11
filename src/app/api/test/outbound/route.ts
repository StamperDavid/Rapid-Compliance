/**
 * Test Outbound Features
 * GET /api/test/outbound
 * Verifies all outbound features are configured correctly
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export const dynamic = 'force-dynamic';

// Type-safe interfaces for test results
interface EnvironmentChecks {
  sendgrid: boolean;
  googleClientId: boolean;
  googleClientSecret: boolean;
  openai: boolean;
  firebase: boolean;
}

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'error';
  message?: string;
  checks?: EnvironmentChecks;
}

interface TestSummary {
  passed: number;
  failed: number;
  errors: number;
  total: number;
  ready: boolean;
}

interface TestResults {
  timestamp: string;
  tests: TestResult[];
  summary?: TestSummary;
}

export async function GET(request: NextRequest) {
  // Authentication
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  // Rate limiting (strict - test endpoint should be disabled in production)
  const rateLimitResponse = await rateLimitMiddleware(request, '/api/test/outbound');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const results: TestResults = {
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
  } catch (error: unknown) {
    results.tests.push({
      name: 'SendGrid Connection',
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
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
  } catch (error: unknown) {
    results.tests.push({
      name: 'Google OAuth',
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }

  // Test 4: AI Email Generation
  try {
    const { generateColdEmail: _generateColdEmail } = await import('@/lib/outbound/email-writer');
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
  } catch (error: unknown) {
    results.tests.push({
      name: 'AI Email Generation',
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }

  // Test 5: Firestore Connection
  try {
    const { FirestoreService: _FirestoreService } = await import('@/lib/db/firestore-service');
    results.tests.push({
      name: 'Firestore Connection',
      status: 'pass',
      message: 'Firestore service available',
    });
  } catch (error: unknown) {
    results.tests.push({
      name: 'Firestore Connection',
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }

  // Calculate overall status
  const passed = results.tests.filter((t: TestResult) => t.status === 'pass').length;
  const failed = results.tests.filter((t: TestResult) => t.status === 'fail').length;
  const errors = results.tests.filter((t: TestResult) => t.status === 'error').length;

  results.summary = {
    passed,
    failed,
    errors,
    total: results.tests.length,
    ready: failed === 0 && errors === 0,
  };

  return NextResponse.json(results);
}
