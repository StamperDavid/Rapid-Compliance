import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

// Force Node.js runtime
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Type-safe interfaces for diagnostics
interface EnvVars {
  FIREBASE_ADMIN_PROJECT_ID: string;
  FIREBASE_ADMIN_CLIENT_EMAIL: string;
  FIREBASE_ADMIN_PRIVATE_KEY: string;
}

interface PrivateKeyDiagnostics {
  hasBackslashN: boolean;
  hasActualNewlines: boolean;
  startsWithBegin: boolean;
  endsWithEnd: boolean;
  firstChars: string;
  lastChars: string;
}

interface AdminStatus {
  adminDb: string;
  adminAuth: string;
  adminStorage: string;
}

interface TestReadSuccess {
  success: true;
  docExists: boolean;
  docId: string;
}

interface TestReadFailure {
  success: false;
  error: string;
  code?: string;
}

type TestRead = TestReadSuccess | TestReadFailure;

interface CriticalError {
  message: string;
  stack?: string;
}

interface Diagnostics {
  timestamp: string;
  environment: string | undefined;
  runtime: string;
  envVars?: EnvVars;
  privateKeyDiagnostics?: PrivateKeyDiagnostics;
  adminStatus?: AdminStatus;
  testRead?: TestRead;
  criticalError?: CriticalError;
}

/**
 * Diagnostic endpoint to check Firebase Admin SDK status
 */
export async function GET(request: NextRequest) {
  // Authentication
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  // Rate limiting (strict - test endpoint should be disabled in production)
  const rateLimitResponse = await rateLimitMiddleware(request, '/api/test/admin-status');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const diagnostics: Diagnostics = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    runtime: 'nodejs',
  };

  try {
    // Check environment variables
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? '';
    diagnostics.envVars = {
      FIREBASE_ADMIN_PROJECT_ID: process.env.FIREBASE_ADMIN_PROJECT_ID ? 'SET' : 'MISSING',
      FIREBASE_ADMIN_CLIENT_EMAIL: process.env.FIREBASE_ADMIN_CLIENT_EMAIL ? 'SET' : 'MISSING',
      FIREBASE_ADMIN_PRIVATE_KEY: privateKey
        ? `SET (length: ${privateKey.length})`
        : 'MISSING',
    };

    // Diagnose private key format issues
    if (privateKey) {
      diagnostics.privateKeyDiagnostics = {
        hasBackslashN: privateKey.includes('\\n'),
        hasActualNewlines: privateKey.includes('\n'),
        startsWithBegin: privateKey.trim().startsWith('-----BEGIN'),
        endsWithEnd: privateKey.trim().endsWith('-----'),
        firstChars: privateKey.substring(0, 50),
        lastChars: privateKey.substring(privateKey.length - 50),
      };
    }

    // Try to import and check adminDb
    const { adminDb, adminAuth, adminStorage } = await import('@/lib/firebase/admin');

    diagnostics.adminStatus = {
      adminDb: adminDb ? 'INITIALIZED' : 'NULL',
      adminAuth: adminAuth ? 'INITIALIZED' : 'NULL',
      adminStorage: adminStorage ? 'INITIALIZED' : 'NULL',
    };

    // If adminDb exists, try a test read
    if (adminDb) {
      try {
        const { COLLECTIONS } = await import('@/lib/firebase/collections');
        const testDoc = await adminDb.collection(COLLECTIONS.ORGANIZATIONS).doc('platform-admin').get();
        diagnostics.testRead = {
          success: true,
          docExists: testDoc.exists,
          docId: testDoc.id,
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorCode = error instanceof Error && 'code' in error ? String(error.code) : undefined;
        diagnostics.testRead = {
          success: false,
          error: errorMessage,
          code: errorCode,
        };
      }
    } else {
      diagnostics.testRead = {
        success: false,
        error: 'adminDb is null - Admin SDK not initialized',
      };
    }

    return NextResponse.json(diagnostics, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    diagnostics.criticalError = {
      message: errorMessage,
      stack: errorStack,
    };
    return NextResponse.json(diagnostics, { status: 500 });
  }
}







