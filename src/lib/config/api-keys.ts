/**
 * API Keys Service
 * Loads API keys from Firestore instead of environment variables
 * Fallback to env vars if not found in Firestore
 */

import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service'
import { logger } from '@/lib/logger/logger';

/**
 * Get API key for organization
 * Checks Firestore first, falls back to environment variables
 */
export async function getAPIKey(
  organizationId: string,
  service: 'openai' | 'sendgrid' | 'google_client_id' | 'google_client_secret' | 'stripe_publishable' | 'stripe_secret'
): Promise<string | null> {
  try {
    // Try Firestore first
    const apiKeys = await FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}`,
      'apiKeys'
    );

    if (apiKeys?.[service]) {
      return apiKeys[service];
    }

    // Fallback to environment variables
    const envMap: Record<string, string | undefined> = {
      openai: process.env.OPENAI_API_KEY,
      sendgrid: process.env.SENDGRID_API_KEY,
      google_client_id: process.env.GOOGLE_CLIENT_ID,
      google_client_secret: process.env.GOOGLE_CLIENT_SECRET,
      stripe_publishable: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      stripe_secret: process.env.STRIPE_SECRET_KEY,
    };

    return envMap[service] ?? null;
  } catch (error) {
    logger.error('[API Keys] Error loading key:', error, { file: 'api-keys.ts' });
    // Fallback to env
    const envMap: Record<string, string | undefined> = {
      openai: process.env.OPENAI_API_KEY,
      sendgrid: process.env.SENDGRID_API_KEY,
      google_client_id: process.env.GOOGLE_CLIENT_ID,
      google_client_secret: process.env.GOOGLE_CLIENT_SECRET,
      stripe_publishable: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      stripe_secret: process.env.STRIPE_SECRET_KEY,
    };
    return envMap[service] ?? null;
  }
}

/**
 * Check if a service is configured
 */
export async function isServiceConfigured(
  organizationId: string,
  service: 'openai' | 'sendgrid' | 'google_client_id' | 'google_client_secret' | 'stripe_publishable' | 'stripe_secret'
): Promise<boolean> {
  const key = await getAPIKey(organizationId, service);
  return !!key;
}

/**
 * Get all configured services for an organization
 */
export async function getConfiguredServices(organizationId: string): Promise<string[]> {
  const services = ['openai', 'sendgrid', 'google_client_id', 'google_client_secret', 'stripe_publishable', 'stripe_secret'] as const;
  const configured: string[] = [];

  for (const service of services) {
    if (await isServiceConfigured(organizationId, service)) {
      configured.push(service);
    }
  }

  return configured;
}






















