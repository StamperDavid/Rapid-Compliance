import { type NextRequest, NextResponse } from 'next/server';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { performHealthCheck } from '@/lib/monitoring/health-check';

export const dynamic = 'force-dynamic';

/**
 * Health Check Endpoint
 * Public endpoint to check system health
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimitMiddleware(request, '/api/health');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const health = await performHealthCheck();
  const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

  return NextResponse.json(health, { status: statusCode });
}
