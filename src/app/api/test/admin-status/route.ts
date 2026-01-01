import { NextRequest, NextResponse } from 'next/server';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

// Force Node.js runtime
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Diagnostic endpoint to check Firebase Admin SDK status
 */
export async function GET(request: NextRequest) {
  // Rate limiting (strict - test endpoint should be disabled in production)
  const rateLimitResponse = await rateLimitMiddleware(request, '/api/test/admin-status');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    runtime: 'nodejs',
  };

  try {
    // Check environment variables
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY || '';
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
      } catch (error: any) {
        diagnostics.testRead = {
          success: false,
          error: error.message,
          code: error.code,
        };
      }
    } else {
      diagnostics.testRead = {
        success: false,
        error: 'adminDb is null - Admin SDK not initialized',
      };
    }

    return NextResponse.json(diagnostics, { status: 200 });
  } catch (error: any) {
    diagnostics.criticalError = {
      message: error.message,
      stack: error.stack,
    };
    return NextResponse.json(diagnostics, { status: 500 });
  }
}







