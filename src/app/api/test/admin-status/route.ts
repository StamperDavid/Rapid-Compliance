import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Test endpoint to check Firebase Admin SDK status
 */
export async function GET() {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    environment: {
      FIREBASE_ADMIN_PROJECT_ID: process.env.FIREBASE_ADMIN_PROJECT_ID ? 'SET' : 'MISSING',
      FIREBASE_ADMIN_CLIENT_EMAIL: process.env.FIREBASE_ADMIN_CLIENT_EMAIL ? 'SET' : 'MISSING',
      FIREBASE_ADMIN_PRIVATE_KEY: process.env.FIREBASE_ADMIN_PRIVATE_KEY 
        ? `SET (length: ${process.env.FIREBASE_ADMIN_PRIVATE_KEY.length})` 
        : 'MISSING',
    },
    adminSdk: {
      status: 'unknown',
      error: null,
    },
  };

  try {
    const { adminDb } = await import('@/lib/firebase/admin');
    
    if (adminDb) {
      diagnostics.adminSdk.status = 'initialized';
      
      // Try to read a document
      try {
        const testDoc = await adminDb.collection('organizations').doc('platform-admin').get();
        diagnostics.adminSdk.canReadFirestore = testDoc.exists ? 'yes - document exists' : 'yes - but document not found';
        diagnostics.adminSdk.documentData = testDoc.exists ? 'exists' : 'not found';
      } catch (readError: any) {
        diagnostics.adminSdk.canReadFirestore = 'no';
        diagnostics.adminSdk.readError = readError.message;
      }
    } else {
      diagnostics.adminSdk.status = 'not initialized';
      diagnostics.adminSdk.error = 'adminDb is null';
    }
  } catch (error: any) {
    diagnostics.adminSdk.status = 'error';
    diagnostics.adminSdk.error = error.message;
    diagnostics.adminSdk.stack = error.stack;
  }

  return NextResponse.json(diagnostics, { status: 200 });
}
