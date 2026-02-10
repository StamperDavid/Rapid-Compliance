import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/config';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export const dynamic = 'force-dynamic';

/**
 * Health Check Endpoint
 * Public endpoint to check system health
 */
export async function GET(request: NextRequest) {
  // Rate limiting (high limit for health checks)
  const rateLimitResponse = await rateLimitMiddleware(request, '/api/health');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: 'unknown',
      api: 'healthy',
    },
  };

  try {
    // Check Firestore connection
    if (db) {
      // Try a simple read operation
      const { collection, limit, getDocs, query } = await import('firebase/firestore');
      const testQuery = query(collection(db, 'health'), limit(1));
      await getDocs(testQuery);
      health.services.database = 'healthy';
    } else {
      health.services.database = 'unavailable';
      health.status = 'degraded';
    }
  } catch (_error) {
    health.services.database = 'unhealthy';
    health.status = 'unhealthy';
  }

  const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

  return NextResponse.json(health, { status: statusCode });
}
