/**
 * API Keys Service
 * Loads API keys from Firestore instead of environment variables
 * Fallback to env vars if not found in Firestore
 */

import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

/**
 * Type definition for API keys stored in Firestore
 */
interface APIKeysDocument {
  id?: string;
  openai?: string;
  sendgrid?: string;
  google_client_id?: string;
  google_client_secret?: string;
  stripe_publishable?: string;
  stripe_secret?: string;
}

/**
 * Get API key for organization
 * Checks Firestore first, falls back to environment variables
 */
export async function getAPIKey(
  service: 'openai' | 'sendgrid' | 'google_client_id' | 'google_client_secret' | 'stripe_publishable' | 'stripe_secret'
): Promise<string | null> {
  try {
    // Try Firestore first
    const apiKeys = await FirestoreService.get<APIKeysDocument>(
      `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}`,
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
    logger.error('[API Keys] Error loading key:', error instanceof Error ? error : new Error(String(error)), { file: 'api-keys.ts' });
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
  service: 'openai' | 'sendgrid' | 'google_client_id' | 'google_client_secret' | 'stripe_publishable' | 'stripe_secret'
): Promise<boolean> {
  const key = await getAPIKey(service);
  return !!key;
}

/**
 * Get all configured services for an organization
 */
export async function getConfiguredServices(): Promise<string[]> {
  const services = ['openai', 'sendgrid', 'google_client_id', 'google_client_secret', 'stripe_publishable', 'stripe_secret'] as const;
  const configured: string[] = [];

  for (const service of services) {
    if (await isServiceConfigured(service)) {
      configured.push(service);
    }
  }

  return configured;
}






















