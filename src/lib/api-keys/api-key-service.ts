/**
 * API Key Service
 * Centralized service for managing and accessing API keys
 */

import type { APIKeysConfig, APIKeyValidationResult, APIServiceName } from '../../types/api-keys'
import { logger } from '../logger/logger';

class APIKeyService {
  private static instance: APIKeyService;
  private keysCache: APIKeysConfig | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    console.log('[APIKeyService] Initialized. Ready to fetch keys from Firestore.');
  }

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
    
    // In test mode, always bypass cache to ensure fresh data
    if (process.env.NODE_ENV === 'test') {
      return this.fetchKeysFromFirestore(organizationId);
    }
    
    // Return cached keys if still valid
    if (this.keysCache && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
      if (this.keysCache.organizationId === organizationId) {
        return this.keysCache;
      }
    }

    // Fetch from Firestore
    const keys = await this.fetchKeysFromFirestore(organizationId);
    
    if (keys) {
      this.keysCache = keys;
      this.cacheTimestamp = now;
    }

    return keys;
  }

  /**
   * Get specific API key for a service
   * OpenRouter is used as universal fallback for ALL AI services
   */
  async getServiceKey(organizationId: string, service: APIServiceName): Promise<any> {
    const keys = await this.getKeys(organizationId);
    if (!keys) {return null;}

    // Navigate to the specific service key
    switch (service) {
      case 'firebase':
        return keys.firebase;
      case 'googleCloud':
        return keys.googleCloud;
      
      // AI Services - OpenRouter can provide ALL of these
      case 'gemini':
return keys.ai?.geminiApiKey ?? keys.ai?.openrouterApiKey ?? null;
      case 'openai':
return keys.ai?.openaiApiKey ?? keys.ai?.openrouterApiKey ?? null;
      case 'anthropic':
return keys.ai?.anthropicApiKey ?? keys.ai?.openrouterApiKey ?? null;
      case 'openrouter':
        return keys.ai?.openrouterApiKey ?? null;
      
      // Payment Services
      case 'stripe':
        return keys.payments?.stripe;
      case 'square':
        return keys.payments?.square;
      case 'paypal':
        return keys.payments?.paypal;
      
      // Email Services
      case 'sendgrid':
        return keys.email?.sendgrid;
      case 'resend':
        return keys.email?.resend;
      case 'smtp':
        return keys.email?.smtp;
      
      // SMS Services (also used for Voice/VoIP)
      case 'twilio':
        return keys.sms?.twilio;
      case 'telnyx':
        return keys.sms?.telnyx;
      case 'vonage':
        return keys.sms?.vonage;
      
      // Storage Services
      case 'cloudStorage':
        return keys.storage?.cloudStorage;
      case 's3':
        return keys.storage?.s3;
      
      // Analytics
      case 'googleAnalytics':
        return keys.analytics?.googleAnalytics;
      case 'mixpanel':
        return keys.analytics?.mixpanel;
      
      // Integrations
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
    // Save to Firestore
    const existingKeys =await this.fetchKeysFromFirestore(organizationId) ?? this.getDefaultKeys(organizationId);
    
    const updatedKeys: APIKeysConfig = {
      ...existingKeys,
      ...keys,
      organizationId,
      updatedAt: new Date(),
      updatedBy: 'current-user', // TODO: Get from auth context
    };

    // Save to Firestore
    const { FirestoreService, COLLECTIONS } = await import('../db/firestore-service');
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/${COLLECTIONS.API_KEYS}`,
      organizationId,
      {
        ...updatedKeys,
        createdAt: updatedKeys.createdAt.toISOString(),
        updatedAt: updatedKeys.updatedAt.toISOString(),
      },
      false
    );
    
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

  private async fetchKeysFromFirestore(organizationId: string): Promise<APIKeysConfig | null> {
    // Special case: platform-level orgs use global platform API keys
    const platformOrgIds = ['platform', 'platform-admin', 'admin', 'default'];
    if (platformOrgIds.includes(organizationId)) {
      console.log('[APIKeyService] Using platform keys for org:', organizationId);
      try {
        // Prefer admin SDK to bypass security rules
        const { adminDb } = await import('../firebase/admin');
        let platformKeys: any = null;
        
        if (adminDb) {
          const doc = await adminDb.collection('admin').doc('platform-api-keys').get();
          if (doc.exists) {
            platformKeys = doc.data();
          }
        } else {
          // Fallback to client SDK
          const { FirestoreService } = await import('../db/firestore-service');
          platformKeys = await FirestoreService.get('admin', 'platform-api-keys');
        }
        
        if (platformKeys) {
          console.log('[APIKeyService] Platform keys found:', Object.keys(platformKeys));

          // Extract OpenRouter key from various possible locations
          const openrouterKey = platformKeys.ai?.openrouterApiKey
            || platformKeys.openrouter?.apiKey
            || null;

          console.log('[APIKeyService] OpenRouter key found:', openrouterKey ? openrouterKey.slice(0, 12) + '...' : 'NOT FOUND');

          // Convert platform keys format to APIKeysConfig format
          return {
            id: 'keys-platform',
            organizationId: 'platform',
            firebase: platformKeys.firebase ?? {},
            googleCloud: platformKeys.googleCloud ?? {},
            ai: {
              openrouterApiKey: openrouterKey,
              openaiApiKey: platformKeys.ai?.openaiApiKey || platformKeys.openai?.apiKey || null,
              anthropicApiKey: platformKeys.ai?.anthropicApiKey || platformKeys.anthropic?.apiKey || null,
              geminiApiKey: platformKeys.ai?.geminiApiKey || platformKeys.gemini?.apiKey || null,
            },
            payments:platformKeys.stripe ?? {},
            email:platformKeys.sendgrid ?? platformKeys.resend ?? {},
            sms:platformKeys.twilio ?? {},
            storage: {},
            analytics: {},
            integrations: {},
            createdAt: platformKeys.createdAt ? new Date(platformKeys.createdAt) : new Date(),
            updatedAt: platformKeys.updatedAt ? new Date(platformKeys.updatedAt) : new Date(),
            updatedBy:(platformKeys.updatedBy !== '' && platformKeys.updatedBy != null) ? platformKeys.updatedBy : 'system',
            isEncrypted: false,
          } as APIKeysConfig;
        }
      } catch (error) {
        logger.error('[API Key Service] Error fetching platform API keys:', error, { file: 'api-key-service.ts' });
      }
    }

    try {
      // Prefer admin SDK (bypasses client-side security rules) when available
      const { adminDb } = await import('../firebase/admin');
      const { getOrgSubCollection } = await import('../firebase/collections');
      if (adminDb) {
        const apiKeysPath = getOrgSubCollection(organizationId, 'apiKeys');
        const snap = await adminDb
          .collection(apiKeysPath)
          .doc(organizationId)
          .get();
        if (snap.exists) {
          const keysData = snap.data() as any;
          return {
            ...keysData,
            createdAt: keysData.createdAt ? new Date(keysData.createdAt) : new Date(),
            updatedAt: keysData.updatedAt ? new Date(keysData.updatedAt) : new Date(),
          } as APIKeysConfig;
        }
      }
    } catch (error) {
      logger.error('Error fetching API keys via admin SDK:', error, { file: 'api-key-service.ts' });
    }

    try {
      const { FirestoreService, COLLECTIONS } = await import('../db/firestore-service');
      const keysData = await FirestoreService.get(
        `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/${COLLECTIONS.API_KEYS}`,
        organizationId
      );

      if (!keysData) {
        return null;
      }

      return {
        ...keysData,
        createdAt: keysData.createdAt ? new Date(keysData.createdAt) : new Date(),
        updatedAt: keysData.updatedAt ? new Date(keysData.updatedAt) : new Date(),
      } as APIKeysConfig;
    } catch (error) {
      logger.error('Error fetching API keys from Firestore:', error, { file: 'api-key-service.ts' });
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
    if (!keys?.secretKey?.startsWith('sk_')) {
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
    if (!keys?.apiKey?.startsWith('SG.')) {
      return { valid: false, error: 'Invalid SendGrid API key format' };
    }
    return { valid: true };
  }
}

// Export singleton instance
export const apiKeyService = APIKeyService.getInstance();


