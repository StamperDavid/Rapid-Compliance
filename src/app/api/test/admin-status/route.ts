import { NextResponse } from 'next/server';

// Force Node.js runtime
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Diagnostic endpoint to check Firebase Admin SDK status
 */
export async function GET() {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    runtime: 'nodejs',
  };

  try {
    // Check environment variables
    diagnostics.envVars = {
      FIREBASE_ADMIN_PROJECT_ID: process.env.FIREBASE_ADMIN_PROJECT_ID ? 'SET' : 'MISSING',
      FIREBASE_ADMIN_CLIENT_EMAIL: process.env.FIREBASE_ADMIN_CLIENT_EMAIL ? 'SET' : 'MISSING',
      FIREBASE_ADMIN_PRIVATE_KEY: process.env.FIREBASE_ADMIN_PRIVATE_KEY 
        ? `SET (length: ${process.env.FIREBASE_ADMIN_PRIVATE_KEY.length})` 
        : 'MISSING',
    };

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
        const testDoc = await adminDb.collection('organizations').doc('platform-admin').get();
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
