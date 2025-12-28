/**
 * Monitoring & Alerting
 * Basic monitoring with automatic alerts for production issues
 */

import { logger } from '@/lib/logger/logger';
import * as Sentry from '@sentry/nextjs';

export interface AlertConfig {
  type: 'error_rate' | 'timeout' | 'payment_failure' | 'workflow_failure' | 'integration_failure';
  threshold: number;
  window: number; // Time window in minutes
  enabled: boolean;
}

export interface Alert {
  id: string;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  count: number;
  threshold: number;
  firstOccurrence: Date;
  lastOccurrence: Date;
  details: any;
}

// In-memory alert tracking (in production, use Redis or Firestore)
const alertCounters = new Map<string, { count: number; firstSeen: Date; lastSeen: Date }>();
const activeAlerts = new Map<string, Alert>();

/**
 * Default alert configurations
 */
const DEFAULT_CONFIGS: AlertConfig[] = [
  { type: 'error_rate', threshold: 10, window: 5, enabled: true }, // 10 errors in 5 min
  { type: 'timeout', threshold: 5, window: 5, enabled: true }, // 5 timeouts in 5 min
  { type: 'payment_failure', threshold: 3, window: 10, enabled: true }, // 3 payment failures in 10 min
  { type: 'workflow_failure', threshold: 5, window: 10, enabled: true }, // 5 workflow failures in 10 min
  { type: 'integration_failure', threshold: 3, window: 5, enabled: true }, // 3 integration failures in 5 min
];

/**
 * Track an event and trigger alert if threshold exceeded
 */
export async function trackEvent(
  type: AlertConfig['type'],
  details: any = {},
  orgId?: string
): Promise<void> {
  const key = `${type}:${orgId || 'platform'}`;
  const config = DEFAULT_CONFIGS.find(c => c.type === type);
  
  if (!config || !config.enabled) {
    return;
  }

  // Update counter
  const now = new Date();
  const existing = alertCounters.get(key);
  
  if (existing) {
    // Check if still within window
    const windowMs = config.window * 60 * 1000;
    const elapsed = now.getTime() - existing.firstSeen.getTime();
    
    if (elapsed > windowMs) {
      // Window expired, reset counter
      alertCounters.set(key, { count: 1, firstSeen: now, lastSeen: now });
    } else {
      // Increment counter
      existing.count++;
      existing.lastSeen = now;
      alertCounters.set(key, existing);
      
      // Check if threshold exceeded
      if (existing.count >= config.threshold && !activeAlerts.has(key)) {
        await triggerAlert(type, existing.count, config.threshold, details, orgId);
      }
    }
  } else {
    // First occurrence
    alertCounters.set(key, { count: 1, firstSeen: now, lastSeen: now });
  }
}

/**
 * Trigger an alert
 */
async function triggerAlert(
  type: AlertConfig['type'],
  count: number,
  threshold: number,
  details: any,
  orgId?: string
): Promise<void> {
  const alertId = `${type}:${orgId || 'platform'}:${Date.now()}`;
  const counter = alertCounters.get(`${type}:${orgId || 'platform'}`);
  
  if (!counter) return;

  const alert: Alert = {
    id: alertId,
    type,
    severity: determineSeverity(type, count, threshold),
    message: getAlertMessage(type, count, threshold),
    count,
    threshold,
    firstOccurrence: counter.firstSeen,
    lastOccurrence: counter.lastSeen,
    details,
  };

  // Store alert
  activeAlerts.set(`${type}:${orgId || 'platform'}`, alert);

  // Log to console and Sentry
  logger.error(`🚨 ALERT: ${alert.message}`, new Error('Alert triggered'), {
    alertId,
    type,
    count,
    threshold,
    orgId,
    details,
  });

  // Send to Sentry with high priority
  Sentry.captureMessage(`Alert: ${alert.message}`, {
    level: alert.severity === 'critical' ? 'error' : 'warning',
    tags: {
      alert_type: type,
      organization_id: orgId || 'platform',
      severity: alert.severity,
    },
    extra: {
      count,
      threshold,
      details,
    },
  });

  // In production, also send:
  // - Email to admin
  // - Slack notification
  // - PagerDuty incident (for critical)
  
  if (alert.severity === 'critical') {
    await sendCriticalAlert(alert);
  }
}

/**
 * Determine alert severity
 */
function determineSeverity(type: string, count: number, threshold: number): 'critical' | 'warning' | 'info' {
  const ratio = count / threshold;
  
  if (type === 'payment_failure' || ratio >= 2) {
    return 'critical';
  } else if (ratio >= 1.5) {
    return 'warning';
  }
  
  return 'info';
}

/**
 * Get human-readable alert message
 */
function getAlertMessage(type: string, count: number, threshold: number): string {
  const messages: Record<string, string> = {
    error_rate: `High error rate: ${count} errors (threshold: ${threshold})`,
    timeout: `Request timeouts: ${count} slow requests (threshold: ${threshold})`,
    payment_failure: `Payment failures: ${count} failed transactions (threshold: ${threshold})`,
    workflow_failure: `Workflow failures: ${count} failed executions (threshold: ${threshold})`,
    integration_failure: `Integration failures: ${count} failed API calls (threshold: ${threshold})`,
  };
  
  return messages[type] || `Alert triggered: ${type} (${count} occurrences)`;
}

/**
 * Send critical alert via multiple channels
 */
async function sendCriticalAlert(alert: Alert): Promise<void> {
  logger.error('🚨🚨🚨 CRITICAL ALERT', new Error(alert.message), { alert });
  
  // In production, implement:
  // 1. Send email to platform admin
  // 2. Send Slack message to #alerts channel
  // 3. Create PagerDuty incident
  // 4. Send SMS to on-call engineer
  
  console.error('🚨 CRITICAL ALERT:', alert.message);
}

/**
 * Get active alerts
 */
export function getActiveAlerts(orgId?: string): Alert[] {
  if (orgId) {
    return Array.from(activeAlerts.values()).filter(a => a.details.orgId === orgId);
  }
  return Array.from(activeAlerts.values());
}

/**
 * Clear alert
 */
export function clearAlert(alertId: string): void {
  for (const [key, alert] of activeAlerts.entries()) {
    if (alert.id === alertId) {
      activeAlerts.delete(key);
      alertCounters.delete(key.replace(/:[\d]+$/, ''));
      break;
    }
  }
}

/**
 * Helper functions for common events
 */
export const alerts = {
  trackError: (error: Error, orgId?: string) => trackEvent('error_rate', { error: error.message }, orgId),
  trackTimeout: (route: string, duration: number, orgId?: string) => trackEvent('timeout', { route, duration }, orgId),
  trackPaymentFailure: (reason: string, amount: number, orgId?: string) => trackEvent('payment_failure', { reason, amount }, orgId),
  trackWorkflowFailure: (workflowId: string, error: string, orgId?: string) => trackEvent('workflow_failure', { workflowId, error }, orgId),
  trackIntegrationFailure: (integration: string, error: string, orgId?: string) => trackEvent('integration_failure', { integration, error }, orgId),
};

/**
 * Cleanup old counters (call periodically)
 */
export function cleanupOldCounters(): void {
  const now = new Date();
  const maxAge = 60 * 60 * 1000; // 1 hour
  
  for (const [key, counter] of alertCounters.entries()) {
    if (now.getTime() - counter.lastSeen.getTime() > maxAge) {
      alertCounters.delete(key);
    }
  }
}

// Cleanup every 10 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupOldCounters, 10 * 60 * 1000);
}




