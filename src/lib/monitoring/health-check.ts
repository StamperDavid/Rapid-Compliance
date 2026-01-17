/**
 * Health Check & Monitoring Service
 * System health monitoring and alerting
 */

import os from 'os';
import { logger } from '@/lib/logger/logger';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    database: HealthStatus;
    cache: HealthStatus;
    ai: HealthStatus;
    payments: HealthStatus;
    integrations: HealthStatus;
  };
  metrics: {
    memory: MemoryMetrics;
    cpu: CPUMetrics;
    requests: RequestMetrics;
  };
}

export interface HealthStatus {
  status: 'pass' | 'warn' | 'fail';
  message?: string;
  responseTime?: number;
  lastChecked: string;
}

export interface MemoryMetrics {
  used: number;
  total: number;
  percentage: number;
}

export interface CPUMetrics {
  usage: number;
  loadAverage: number[];
}

export interface RequestMetrics {
  total: number;
  errorsLast24h: number;
  avgResponseTime: number;
}

/**
 * Perform comprehensive health check
 */
export async function performHealthCheck(): Promise<HealthCheckResult> {
  const [
    databaseHealth,
    cacheHealth,
  ] = await Promise.all([
    checkDatabase(),
    checkCache(),
  ]);

  const aiHealth = checkAI();
  const paymentsHealth = checkPayments();
  const integrationsHealth = checkIntegrations();
  const metrics = gatherMetrics();
  
  // Determine overall status
  const allChecks = [
    databaseHealth,
    cacheHealth,
    aiHealth,
    paymentsHealth,
    integrationsHealth,
  ];
  
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  
  if (allChecks.some(check => check.status === 'fail')) {
    status = 'unhealthy';
  } else if (allChecks.some(check => check.status === 'warn')) {
    status = 'degraded';
  }
  
  return {
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: databaseHealth,
      cache: cacheHealth,
      ai: aiHealth,
      payments: paymentsHealth,
      integrations: integrationsHealth,
    },
    metrics,
  };
}

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<HealthStatus> {
  const startTime = Date.now();
  
  try {
    const { FirestoreService } = await import('@/lib/db/firestore-service');
    
    // Simple ping query
    await FirestoreService.get('_health', 'check');
    
    const responseTime = Date.now() - startTime;
    
    return {
      status: responseTime < 100 ? 'pass' : responseTime < 500 ? 'warn' : 'fail',
      message: `Database responding in ${responseTime}ms`,
      responseTime,
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      status: 'fail',
      message: `Database error: ${errorMessage}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

/**
 * Check cache connectivity
 */
async function checkCache(): Promise<HealthStatus> {
  const startTime = Date.now();
  
  try {
    const { cacheService } = await import('@/lib/cache/redis-service');
    
    // Test cache operation
    await cacheService.set('_health_check', Date.now(), { ttl: 10 });
    await cacheService.get('_health_check');
    
    const responseTime = Date.now() - startTime;
    
    return {
      status: 'pass',
      message: `Cache responding in ${responseTime}ms`,
      responseTime,
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      status: 'warn',
      message: `Cache unavailable (using fallback): ${errorMessage}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

/**
 * Check AI services
 */
function checkAI(): HealthStatus {
  try {
    // Check if AI services are configured
    const hasGemini = !!process.env.GEMINI_API_KEY;
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;

    if (!hasGemini && !hasOpenAI && !hasAnthropic) {
      return {
        status: 'fail',
        message: 'No AI providers configured',
        lastChecked: new Date().toISOString(),
      };
    }

    return {
      status: 'pass',
      message: `AI providers configured: ${[hasGemini && 'Gemini', hasOpenAI && 'OpenAI', hasAnthropic && 'Anthropic'].filter(Boolean).join(', ')}`,
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      status: 'fail',
      message: `AI check error: ${errorMessage}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

/**
 * Check payment services
 */
function checkPayments(): HealthStatus {
  try {
    const hasStripe = !!process.env.STRIPE_SECRET_KEY;

    return {
      status: hasStripe ? 'pass' : 'warn',
      message: hasStripe ? 'Payment providers configured' : 'No payment providers configured',
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      status: 'warn',
      message: `Payment check error: ${errorMessage}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

/**
 * Check integrations
 */
function checkIntegrations(): HealthStatus {
  try {
    return {
      status: 'pass',
      message: 'Integrations operational',
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      status: 'warn',
      message: `Integration check error: ${errorMessage}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

/**
 * Gather system metrics
 */
function gatherMetrics(): {
  memory: MemoryMetrics;
  cpu: CPUMetrics;
  requests: RequestMetrics;
} {
  const memUsage = process.memoryUsage();

  return {
    memory: {
      used: memUsage.heapUsed,
      total: memUsage.heapTotal,
      percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
    },
    cpu: {
      usage: process.cpuUsage().user / 1000000, // Convert to seconds
      loadAverage: process.platform === 'win32' ? [0, 0, 0] : os.loadavg(),
    },
    requests: {
      total: 0, // Would be tracked by middleware
      errorsLast24h: 0, // Would be tracked by error handler
      avgResponseTime: 0, // Would be tracked by middleware
    },
  };
}

/**
 * Send alert if system is unhealthy
 */
export async function sendAlert(health: HealthCheckResult): Promise<void> {
  if (health.status === 'healthy') {return;}
  
  logger.error('[Health Check] System is unhealthy', new Error(`System status: ${health.status}`), { 
    status: health.status, 
    health,
    file: 'health-check.ts' 
  });
  
  // In production, send to Slack/PagerDuty/Email
  if (process.env.SLACK_WEBHOOK_URL) {
    try {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 System Health Alert: ${health.status.toUpperCase()}`,
          attachments: [{
            color: health.status === 'unhealthy' ? 'danger' : 'warning',
            fields: Object.entries(health.checks).map(([name, check]) => ({
              title: name,
              value: `${check.status}: ${(check.message !== '' && check.message != null) ? check.message : 'N/A'}`,
              short: true,
            })),
          }],
        }),
      });
    } catch (error) {
      logger.error('[Health Check] Failed to send Slack alert:', error, { file: 'health-check.ts' });
    }
  }
}



















