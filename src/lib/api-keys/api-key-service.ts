/**
 * API Key Service
 * Centralized service for managing and accessing API keys
 */

import type { APIKeysConfig, APIKeyValidationResult, APIServiceName } from '../../types/api-keys'
import { logger } from '../logger/logger';
import { PLATFORM_ID } from '../constants/platform';

// Type for Firestore document data (raw data before conversion)
interface FirestoreKeysData {
  id?: string;
  PLATFORM_ID?: string;
  firebase?: Record<string, unknown>;
  googleCloud?: Record<string, unknown>;
  ai?: {
    openrouterApiKey?: string;
    openaiApiKey?: string;
    anthropicApiKey?: string;
    geminiApiKey?: string;
  };
  payments?: Record<string, unknown>;
  email?: Record<string, unknown>;
  sms?: Record<string, unknown>;
  storage?: Record<string, unknown>;
  analytics?: Record<string, unknown>;
  integrations?: Record<string, unknown>;
  stripe?: Record<string, unknown>;
  sendgrid?: Record<string, unknown>;
  resend?: Record<string, unknown>;
  twilio?: Record<string, unknown>;
  openrouter?: {
    apiKey?: string;
  };
  openai?: {
    apiKey?: string;
  };
  anthropic?: {
    apiKey?: string;
  };
  gemini?: {
    apiKey?: string;
  };
  createdAt?: string | Date;
  updatedAt?: string | Date;
  updatedBy?: string;
  isEncrypted?: boolean;
}

// Type for service keys that may have nested structures
type ServiceKeyResult = string | Record<string, unknown> | null;

// Type for validation input - can be a string key or a key object
interface StripeKeys {
  secretKey?: string;
  publicKey?: string;
  webhookSecret?: string;
}

interface SendgridKeys {
  apiKey?: string;
  fromEmail?: string;
  fromName?: string;
}

class APIKeyService {
  private static instance: APIKeyService;
  private keysCache: APIKeysConfig | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    logger.info('[APIKeyService] Initialized. Ready to fetch keys from Firestore.', { file: 'api-key-service.ts' });
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
  async getKeys(): Promise<APIKeysConfig | null> {
      const now = Date.now();

    // In test mode, always bypass cache to ensure fresh data
    if (process.env.NODE_ENV === 'test') {
      return this.fetchKeysFromFirestore(PLATFORM_ID);
    }

    // Return cached keys if still valid
    if (this.keysCache && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
      // In penthouse model, cache is org-agnostic
      return this.keysCache;
    }

    // Fetch from Firestore
    const keys = await this.fetchKeysFromFirestore(PLATFORM_ID);
    
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
  async getServiceKey(PLATFORM_ID: string, service: APIServiceName): Promise<ServiceKeyResult> {
    const keys = await this.getKeys();
    if (!keys) {return null;}

    // Navigate to the specific service key
    switch (service) {
      case 'firebase':
        return keys.firebase ?? null;
      case 'googleCloud':
        return keys.googleCloud ?? null;
      
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
        return keys.payments?.stripe ?? null;
      case 'square':
        return keys.payments?.square ?? null;
      case 'paypal':
        return keys.payments?.paypal ?? null;

      // Email Services
      case 'sendgrid':
        return keys.email?.sendgrid ?? null;
      case 'resend':
        return keys.email?.resend ?? null;
      case 'smtp':
        return keys.email?.smtp ?? null;

      // SMS Services (also used for Voice/VoIP)
      case 'twilio':
        return keys.sms?.twilio ?? null;
      case 'telnyx':
        return keys.sms?.telnyx ?? null;
      case 'vonage':
        return keys.sms?.vonage ?? null;

      // Storage Services
      case 'cloudStorage':
        return keys.storage?.cloudStorage ?? null;
      case 's3':
        return keys.storage?.s3 ?? null;

      // Analytics
      case 'googleAnalytics':
        return keys.analytics?.googleAnalytics ?? null;
      case 'mixpanel':
        return keys.analytics?.mixpanel ?? null;

      // Integrations
      case 'slack':
        return keys.integrations?.slack ?? null;
      case 'zapier':
        return keys.integrations?.zapier ?? null;

      // Video Services
      case 'heygen':
        return keys.video?.heygen?.apiKey ?? null;
      case 'sora':
        return keys.video?.sora?.apiKey ?? keys.ai?.openaiApiKey ?? null;
      case 'runway':
        return keys.video?.runway?.apiKey ?? null;

      // Voice Services
      case 'elevenlabs':
        return keys.voice?.elevenlabs?.apiKey ?? null;
      case 'unrealSpeech':
        return keys.voice?.unrealSpeech?.apiKey ?? null;

      // Enrichment Services
      case 'serper':
        return keys.enrichment?.serperApiKey ?? null;
      case 'clearbit':
        return keys.enrichment?.clearbitApiKey ?? null;
      case 'crunchbase':
        return keys.enrichment?.crunchbaseApiKey ?? null;
      case 'newsapi':
        return keys.enrichment?.newsApiKey ?? null;
      case 'rapidapi':
        return keys.enrichment?.rapidApiKey ?? null;
      case 'builtwith':
        return keys.enrichment?.builtWithApiKey ?? null;

      // SEO Services
      case 'pagespeed':
        return keys.seo?.pagespeedApiKey ?? null;
      case 'dataforseo':
        return keys.seo ? { login: keys.seo.dataforseoLogin, password: keys.seo.dataforseoPassword } : null;

      // Social Media
      case 'twitter':
        return keys.social?.twitter ?? null;
      case 'linkedin':
        return keys.social?.linkedin ?? null;

      default:
        return null;
    }
  }

  /**
   * Save API keys (encrypted)
   */
  async saveKeys(keys: Partial<APIKeysConfig>, userId: string = 'system'): Promise<void> {
    const existingKeys = await this.fetchKeysFromFirestore(PLATFORM_ID) ?? this.getDefaultKeys();

    const updatedKeys: APIKeysConfig = {
      ...existingKeys,
      ...keys,
      updatedAt: new Date(),
      updatedBy: userId,
    };

    const dataToSave = {
      ...updatedKeys,
      createdAt: updatedKeys.createdAt.toISOString(),
      updatedAt: updatedKeys.updatedAt.toISOString(),
    };

    // Prefer Admin SDK (bypasses Firestore security rules) — same as fetchKeys
    const { adminDb } = await import('../firebase/admin');
    if (adminDb) {
      const { getSubCollection } = await import('../firebase/collections');
      const apiKeysPath = getSubCollection('apiKeys');
      await adminDb.collection(apiKeysPath).doc(PLATFORM_ID).set(dataToSave, { merge: true });
    } else {
      // Fallback to client SDK
      const { FirestoreService } = await import('../db/firestore-service');
      const { getSubCollection } = await import('../firebase/collections');
      await FirestoreService.set(
        getSubCollection('apiKeys'),
        PLATFORM_ID,
        dataToSave,
        false
      );
    }

    // Clear cache to force reload
    this.keysCache = null;
  }

  /**
   * Validate API key for a specific service
   */
  validateKey(service: APIServiceName, key: string | StripeKeys | SendgridKeys): APIKeyValidationResult {
    try {
      switch (service) {
        case 'stripe':
          return this.validateStripeKey(key as StripeKeys);
        case 'gemini':
          return this.validateGeminiKey(key as string);
        case 'sendgrid':
          return this.validateSendgridKey(key as SendgridKeys);
        // Add more validators as needed
        default:
          return { valid: true }; // Assume valid if no validator
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
      return { valid: false, error: errorMessage };
    }
  }

  /**
   * Check if a service is configured
   */
  async isServiceConfigured(service: APIServiceName): Promise<boolean> {
      const key = await this.getServiceKey(PLATFORM_ID, service);
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

  private async fetchKeysFromFirestore(PLATFORM_ID: string): Promise<APIKeysConfig | null> {
    // Special case: platform-level orgs use global platform API keys
    const platformOrgIds = ['platform', 'platform-admin', 'admin', 'default'];
    if (platformOrgIds.includes(PLATFORM_ID)) {
      logger.info('[APIKeyService] Using platform keys for org:', { PLATFORM_ID, file: 'api-key-service.ts' });
      try {
        // Prefer admin SDK to bypass security rules
        const { adminDb } = await import('../firebase/admin');
        let platformKeys: FirestoreKeysData | null = null;
        
        if (adminDb) {
          const doc = await adminDb.collection('admin').doc('platform-api-keys').get();
          if (doc.exists) {
            platformKeys = (doc.data() as FirestoreKeysData) ?? null;
          }
        } else {
          // Fallback to client SDK
          const { FirestoreService } = await import('../db/firestore-service');
          platformKeys = await FirestoreService.get('admin', 'platform-api-keys');
        }
        
        if (platformKeys) {
          logger.info('[APIKeyService] Platform keys found:', { keys: Object.keys(platformKeys), file: 'api-key-service.ts' });

          // Extract OpenRouter key from various possible locations
          const openrouterKey = platformKeys.ai?.openrouterApiKey
            ?? platformKeys.openrouter?.apiKey
            ?? null;

          logger.info('[APIKeyService] OpenRouter key found:', {
            keyPreview: openrouterKey ? `${openrouterKey.slice(0, 12)}...` : 'NOT FOUND',
            file: 'api-key-service.ts'
          });

          // Convert platform keys format to APIKeysConfig format
          return {
            id: 'keys-platform',
            firebase: platformKeys.firebase ?? {},
            googleCloud: platformKeys.googleCloud ?? {},
            ai: {
              openrouterApiKey: openrouterKey,
              openaiApiKey: platformKeys.ai?.openaiApiKey ?? platformKeys.openai?.apiKey ?? null,
              anthropicApiKey: platformKeys.ai?.anthropicApiKey ?? platformKeys.anthropic?.apiKey ?? null,
              geminiApiKey: platformKeys.ai?.geminiApiKey ?? platformKeys.gemini?.apiKey ?? null,
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
        logger.error('[API Key Service] Error fetching platform API keys:', error instanceof Error ? error : undefined, { file: 'api-key-service.ts' });
      }
    }

    try {
      // Prefer admin SDK (bypasses client-side security rules) when available
      const { adminDb } = await import('../firebase/admin');
      const { getSubCollection } = await import('../firebase/collections');
      if (adminDb) {
        const apiKeysPath = getSubCollection('apiKeys');
        const snap = await adminDb
          .collection(apiKeysPath)
          .doc(PLATFORM_ID)
          .get();
        if (snap.exists) {
          const keysData = snap.data() as FirestoreKeysData;
          return {
            ...keysData,
            createdAt: keysData.createdAt ? new Date(keysData.createdAt) : new Date(),
            updatedAt: keysData.updatedAt ? new Date(keysData.updatedAt) : new Date(),
          } as APIKeysConfig;
        }
      }
    } catch (error) {
      logger.error('Error fetching API keys via admin SDK:', error instanceof Error ? error : undefined, { file: 'api-key-service.ts' });
    }

    try {
      const { FirestoreService } = await import('../db/firestore-service');
      const { getSubCollection } = await import('../firebase/collections');
      const keysData = await FirestoreService.get(
        getSubCollection('apiKeys'),
        PLATFORM_ID
      );

      if (!keysData) {
        return null;
      }

      return {
        ...keysData,
        createdAt: keysData.createdAt instanceof Date
          ? keysData.createdAt
          : keysData.createdAt
            ? new Date(String(keysData.createdAt))
            : new Date(),
        updatedAt: keysData.updatedAt instanceof Date
          ? keysData.updatedAt
          : keysData.updatedAt
            ? new Date(String(keysData.updatedAt))
            : new Date(),
      } as APIKeysConfig;
    } catch (error) {
      logger.error('Error fetching API keys from Firestore:', error instanceof Error ? error : undefined, { file: 'api-key-service.ts' });
      return null;
    }
  }

  private getDefaultKeys(): APIKeysConfig {
      return {
      id: `keys-${PLATFORM_ID}`,
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

  private validateStripeKey(keys: StripeKeys): APIKeyValidationResult {
    // In production, make actual API call to Stripe
    if (!keys?.secretKey?.startsWith('sk_')) {
      return { valid: false, error: 'Invalid Stripe secret key format' };
    }
    return { valid: true };
  }

  private validateGeminiKey(apiKey: string): APIKeyValidationResult {
    // In production, make test API call to Gemini
    if (!apiKey || apiKey.length < 20) {
      return { valid: false, error: 'Invalid Gemini API key format' };
    }
    return { valid: true };
  }

  private validateSendgridKey(keys: SendgridKeys): APIKeyValidationResult {
    // In production, make test API call to SendGrid
    if (!keys?.apiKey?.startsWith('SG.')) {
      return { valid: false, error: 'Invalid SendGrid API key format' };
    }
    return { valid: true };
  }
}

// Export singleton instance
export const apiKeyService = APIKeyService.getInstance();


