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
  details: Record<string, unknown>;
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
export function trackEvent(
  type: AlertConfig['type'],
  details: Record<string, unknown> = {}
): void {
  const key = `${type}:platform`;
  const config = DEFAULT_CONFIGS.find(c => c.type === type);
  
  if (!config?.enabled) {
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
        triggerAlert(type, existing.count, config.threshold, details);
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
function triggerAlert(
  type: AlertConfig['type'],
  count: number,
  threshold: number,
  details: Record<string, unknown>
): void {
  const alertId = `${type}:platform:${Date.now()}`;
  const counter = alertCounters.get(`${type}:platform`);
  
  if (!counter) {return;}

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
  activeAlerts.set(`${type}:platform`, alert);

  // Log to Sentry
  logger.error(`🚨 ALERT: ${alert.message}`, new Error('Alert triggered'), {
    error: `Alert ${type}: ${count} occurrences (threshold: ${threshold})`,
  });

  // Send to Sentry with high priority
  Sentry.captureMessage(`Alert: ${alert.message}`, {
    level: alert.severity === 'critical' ? 'error' : 'warning',
    tags: {
      alert_type: type,
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
    sendCriticalAlert(alert);
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
function sendCriticalAlert(alert: Alert): void {
  logger.error('🚨🚨🚨 CRITICAL ALERT', new Error(alert.message), { error: alert.message });

  // In production, implement:
  // 1. Send email to platform admin
  // 2. Send Slack message to #alerts channel
  // 3. Create PagerDuty incident
  // 4. Send SMS to on-call engineer
}

/**
 * Get active alerts
 */
export function getActiveAlerts(): Alert[] {
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
  trackError: (error: Error) => trackEvent('error_rate', { error: error.message }),
  trackTimeout: (route: string, duration: number) => trackEvent('timeout', { route, duration }),
  trackPaymentFailure: (reason: string, amount: number) => trackEvent('payment_failure', { reason, amount }),
  trackWorkflowFailure: (workflowId: string, error: string) => trackEvent('workflow_failure', { workflowId, error }),
  trackIntegrationFailure: (integration: string, error: string) => trackEvent('integration_failure', { integration, error }),
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




