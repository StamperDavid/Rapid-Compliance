import { type NextRequest, NextResponse } from 'next/server';
import { db, isFirebaseConfigured } from '@/lib/firebase/config';
import { requireRole } from '@/lib/auth/api-auth';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

/**
 * Detailed Health Check Endpoint
 * Requires authentication - shows detailed system status
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/health/detailed');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Require admin role for detailed health
    const authResult = await requireRole(request, ['admin', 'owner']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? '1.0.0',
      environment: process.env.NODE_ENV ?? 'development',
      services: {
        database: {
          status: 'unknown' as string,
          configured: isFirebaseConfigured,
          error: undefined as string | undefined,
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      health.services.database.status = 'unhealthy';
      health.services.database.error = errorMessage;
      health.status = 'unhealthy';
    }

    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

    return NextResponse.json(health, { status: statusCode });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Health check failed';
    return NextResponse.json(
      {
        status: 'error',
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
