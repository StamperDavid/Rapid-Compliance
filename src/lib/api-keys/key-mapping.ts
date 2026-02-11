/**
 * Key Mapping - Bidirectional mapping between flat UI service IDs
 * and nested APIKeysConfig dot-paths.
 *
 * The Settings UI uses flat IDs like "openrouter" or "stripe_secret".
 * The APIKeysConfig type uses nested paths like "ai.openrouterApiKey"
 * or "payments.stripe.secretKey". This module bridges the two.
 */

import type { APIKeysConfig } from '@/types/api-keys';

/**
 * Maps flat UI service IDs to their nested paths in APIKeysConfig
 */
export const UI_TO_CONFIG_MAP: Record<string, string> = {
  // AI Services
  openrouter: 'ai.openrouterApiKey',
  openai: 'ai.openaiApiKey',
  anthropic: 'ai.anthropicApiKey',
  gemini: 'ai.geminiApiKey',

  // Email Services
  sendgrid: 'email.sendgrid.apiKey',
  resend: 'email.resend.apiKey',

  // Payment Services
  stripe_publishable: 'payments.stripe.publicKey',
  stripe_secret: 'payments.stripe.secretKey',
  paypal_client_id: 'payments.paypal.clientId',

  // SMS / Voice
  twilio_account_sid: 'sms.twilio.accountSid',
  twilio_auth_token: 'sms.twilio.authToken',

  // Integrations
  slack_webhook: 'integrations.slack.webhookUrl',
  zapier_webhook: 'integrations.zapier.webhookUrl',
  hubspot_api_key: 'integrations.hubspot.apiKey',
  google_client_id: 'integrations.googleWorkspace.clientId',
  google_client_secret: 'integrations.googleWorkspace.clientSecret',

  // Enrichment
  clearbit_api_key: 'enrichment.clearbitApiKey',
  crunchbase: 'enrichment.crunchbaseApiKey',
  newsapi: 'enrichment.newsApiKey',
  rapidapi: 'enrichment.rapidApiKey',
  serper: 'enrichment.serperApiKey',

  // Video
  heygen: 'video.heygen.apiKey',
  runway: 'video.runway.apiKey',

  // Voice
  elevenlabs: 'voice.elevenlabs.apiKey',
  unreal_speech: 'voice.unrealSpeech.apiKey',
};

/**
 * Set a value at a nested dot-path on an object.
 * Creates intermediate objects as needed.
 *
 * Example: setNestedValue(obj, 'ai.openrouterApiKey', 'sk-xxx')
 *   → obj.ai.openrouterApiKey = 'sk-xxx'
 */
export function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: string,
): void {
  const segments = path.split('.');
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (!(seg in current) || typeof current[seg] !== 'object' || current[seg] === null) {
      current[seg] = {};
    }
    current = current[seg] as Record<string, unknown>;
  }

  current[segments[segments.length - 1]] = value;
}

/**
 * Get a string value at a nested dot-path from an object.
 * Returns null if the path doesn't exist or the value isn't a string.
 */
export function getNestedValue(
  obj: Record<string, unknown>,
  path: string,
): string | null {
  const segments = path.split('.');
  let current: unknown = obj;

  for (const seg of segments) {
    if (typeof current !== 'object' || current === null) {return null;}
    current = (current as Record<string, unknown>)[seg];
  }

  return typeof current === 'string' ? current : null;
}

/**
 * Flatten an APIKeysConfig into flat UI key-value pairs.
 * Only includes keys that have non-empty string values.
 */
export function flattenConfigToUI(config: APIKeysConfig): Record<string, string> {
  const flat: Record<string, string> = {};
  const raw = config as unknown as Record<string, unknown>;

  for (const [uiId, configPath] of Object.entries(UI_TO_CONFIG_MAP)) {
    const value = getNestedValue(raw, configPath);
    if (value) {
      flat[uiId] = value;
    }
  }

  return flat;
}

/**
 * Apply a single UI key update to an existing config object (mutates in place).
 * Throws if the serviceId is not recognized.
 */
export function applyUIKeyToConfig(
  config: Record<string, unknown>,
  serviceId: string,
  keyValue: string,
): void {
  const configPath = UI_TO_CONFIG_MAP[serviceId];
  if (!configPath) {
    throw new Error(`Unknown service ID: ${serviceId}`);
  }

  setNestedValue(config, configPath, keyValue);
}
