import { NextRequest, NextResponse } from 'next/server';
import { db, isFirebaseConfigured } from '@/lib/firebase/config';
import { requireAuth, requireRole } from '@/lib/auth/api-auth';

/**
 * Detailed Health Check Endpoint
 * Requires authentication - shows detailed system status
 */
export async function GET(request: NextRequest) {
  try {
    // Require admin role for detailed health
    const authResult = await requireRole(request, ['admin', 'owner']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: {
        database: {
          status: 'unknown',
          configured: isFirebaseConfigured,
        },
        api: {
          status: 'healthy',
        },
        authentication: {
          status: 'healthy',
        },
      },
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
      },
    };

    // Check Firestore
    try {
      if (db && isFirebaseConfigured) {
        const { collection, limit, getDocs, query } = await import('firebase/firestore');
        const testQuery = query(collection(db, 'health'), limit(1));
        await getDocs(testQuery);
        health.services.database.status = 'healthy';
      } else {
        health.services.database.status = 'unavailable';
        health.status = 'degraded';
      }
    } catch (error: any) {
      health.services.database.status = 'unhealthy';
      health.services.database.error = error.message;
      health.status = 'unhealthy';
    }

    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

    return NextResponse.json(health, { status: statusCode });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'error',
        error: error.message || 'Health check failed',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}


