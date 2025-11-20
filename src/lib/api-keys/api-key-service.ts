/**
 * API Key Service
 * Centralized service for managing and accessing API keys
 */

import type { APIKeysConfig, APIKeyValidationResult, APIServiceName } from '@/types/api-keys';

class APIKeyService {
  private static instance: APIKeyService;
  private keysCache: APIKeysConfig | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  static getInstance(): APIKeyService {
    if (!APIKeyService.instance) {
      APIKeyService.instance = new APIKeyService();
    }
    return APIKeyService.instance;
  }

  /**
   * Get API keys for the organization
   * Uses cache to avoid repeated database calls
   */
  async getKeys(organizationId: string): Promise<APIKeysConfig | null> {
    const now = Date.now();
    
    // Return cached keys if still valid
    if (this.keysCache && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
      if (this.keysCache.organizationId === organizationId) {
        return this.keysCache;
      }
    }

    // Fetch from storage (localStorage for now, will be Firestore in production)
    const keys = this.fetchKeysFromStorage(organizationId);
    
    if (keys) {
      this.keysCache = keys;
      this.cacheTimestamp = now;
    }

    return keys;
  }

  /**
   * Get specific API key for a service
   */
  async getServiceKey(organizationId: string, service: APIServiceName): Promise<any> {
    const keys = await this.getKeys(organizationId);
    if (!keys) return null;

    // Navigate to the specific service key
    switch (service) {
      case 'firebase':
        return keys.firebase;
      case 'googleCloud':
        return keys.googleCloud;
      case 'gemini':
        return keys.ai?.geminiApiKey;
      case 'openai':
        return keys.ai?.openaiApiKey;
      case 'anthropic':
        return keys.ai?.anthropicApiKey;
      case 'stripe':
        return keys.payments?.stripe;
      case 'square':
        return keys.payments?.square;
      case 'paypal':
        return keys.payments?.paypal;
      case 'sendgrid':
        return keys.email?.sendgrid;
      case 'resend':
        return keys.email?.resend;
      case 'smtp':
        return keys.email?.smtp;
      case 'twilio':
        return keys.sms?.twilio;
      case 'vonage':
        return keys.sms?.vonage;
      case 'cloudStorage':
        return keys.storage?.cloudStorage;
      case 's3':
        return keys.storage?.s3;
      case 'googleAnalytics':
        return keys.analytics?.googleAnalytics;
      case 'mixpanel':
        return keys.analytics?.mixpanel;
      case 'slack':
        return keys.integrations?.slack;
      case 'zapier':
        return keys.integrations?.zapier;
      default:
        return null;
    }
  }

  /**
   * Save API keys (encrypted)
   */
  async saveKeys(organizationId: string, keys: Partial<APIKeysConfig>): Promise<void> {
    // In production, this would save to Firestore with encryption
    // For now, use localStorage
    const existingKeys = this.fetchKeysFromStorage(organizationId) || this.getDefaultKeys(organizationId);
    
    const updatedKeys: APIKeysConfig = {
      ...existingKeys,
      ...keys,
      organizationId,
      updatedAt: new Date(),
      updatedBy: 'current-user', // TODO: Get from auth context
    };

    localStorage.setItem(`api-keys-${organizationId}`, JSON.stringify(updatedKeys));
    
    // Clear cache to force reload
    this.keysCache = null;
  }

  /**
   * Validate API key for a specific service
   */
  async validateKey(service: APIServiceName, key: any): Promise<APIKeyValidationResult> {
    try {
      switch (service) {
        case 'stripe':
          return await this.validateStripeKey(key);
        case 'gemini':
          return await this.validateGeminiKey(key);
        case 'sendgrid':
          return await this.validateSendgridKey(key);
        // Add more validators as needed
        default:
          return { valid: true }; // Assume valid if no validator
      }
    } catch (error: any) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Check if a service is configured
   */
  async isServiceConfigured(organizationId: string, service: APIServiceName): Promise<boolean> {
    const key = await this.getServiceKey(organizationId, service);
    return key !== null && key !== undefined;
  }

  /**
   * Clear cache (useful after key updates)
   */
  clearCache(): void {
    this.keysCache = null;
    this.cacheTimestamp = 0;
  }

  // Private helper methods

  private fetchKeysFromStorage(organizationId: string): APIKeysConfig | null {
    if (typeof window === 'undefined') return null;
    
    const stored = localStorage.getItem(`api-keys-${organizationId}`);
    if (!stored) return null;

    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }

  private getDefaultKeys(organizationId: string): APIKeysConfig {
    return {
      id: `keys-${organizationId}`,
      organizationId,
      firebase: {
        apiKey: '',
        authDomain: '',
        projectId: '',
        storageBucket: '',
        messagingSenderId: '',
        appId: '',
      },
      googleCloud: {
        projectId: '',
        location: 'us-central1',
      },
      ai: {},
      payments: {},
      email: {},
      sms: {},
      storage: {},
      analytics: {},
      integrations: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      updatedBy: 'system',
      isEncrypted: false,
    };
  }

  // Service-specific validators

  private async validateStripeKey(keys: any): Promise<APIKeyValidationResult> {
    // In production, make actual API call to Stripe
    if (!keys?.secretKey || !keys.secretKey.startsWith('sk_')) {
      return { valid: false, error: 'Invalid Stripe secret key format' };
    }
    return { valid: true };
  }

  private async validateGeminiKey(apiKey: string): Promise<APIKeyValidationResult> {
    // In production, make test API call to Gemini
    if (!apiKey || apiKey.length < 20) {
      return { valid: false, error: 'Invalid Gemini API key format' };
    }
    return { valid: true };
  }

  private async validateSendgridKey(keys: any): Promise<APIKeyValidationResult> {
    // In production, make test API call to SendGrid
    if (!keys?.apiKey || !keys.apiKey.startsWith('SG.')) {
      return { valid: false, error: 'Invalid SendGrid API key format' };
    }
    return { valid: true };
  }
}

// Export singleton instance
export const apiKeyService = APIKeyService.getInstance();

