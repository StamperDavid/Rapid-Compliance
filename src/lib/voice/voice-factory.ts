/**
 * VoIP Provider Factory
 * Creates and manages voice provider instances
 * Supports cost comparison and automatic failover
 */

import type { VoiceProvider, VoiceProviderType, VoiceProviderConfig, VoiceProviderCosts } from './types';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';

// Type definitions for provider-specific API key structures
interface TwilioKeys {
  accountSid?: string;
  account_sid?: string;
  authToken?: string;
  auth_token?: string;
  phoneNumber?: string;
  phone_number?: string;
}

interface TelnyxKeys {
  apiKey?: string;
  api_key?: string;
  apiSecret?: string;
  api_secret?: string;
  phoneNumber?: string;
  phone_number?: string;
}

interface BandwidthKeys {
  accountId?: string;
  account_id?: string;
  apiToken?: string;
  api_token?: string;
  phoneNumber?: string;
  phone_number?: string;
}

interface VonageKeys {
  apiKey?: string;
  api_key?: string;
  apiSecret?: string;
  api_secret?: string;
  phoneNumber?: string;
  phone_number?: string;
}

// Provider cost reference (cents)
const PROVIDER_COSTS: Record<VoiceProviderType, VoiceProviderCosts> = {
  twilio: {
    voicePerMinuteCents: 1.3,
    smsPerMessageCents: 0.79,
    phoneNumberMonthlyCents: 1500,
    recordingPerMinuteCents: 0.25,
  },
  telnyx: {
    voicePerMinuteCents: 0.4,
    smsPerMessageCents: 0.4,
    phoneNumberMonthlyCents: 200,
    recordingPerMinuteCents: 0.2,
  },
  bandwidth: {
    voicePerMinuteCents: 0.4,
    smsPerMessageCents: 0.35,
    phoneNumberMonthlyCents: 500,
    recordingPerMinuteCents: 0.2,
  },
  vonage: {
    voicePerMinuteCents: 1.0,
    smsPerMessageCents: 0.65,
    phoneNumberMonthlyCents: 700,
    recordingPerMinuteCents: 0.4,
  },
};

// Provider instances cache
const providerCache = new Map<string, { provider: VoiceProvider; createdAt: Date }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Voice Provider Factory
 */
export class VoiceProviderFactory {
  /**
   * Get a voice provider for the organization
   * Uses cached instance if available and not expired
   */
  static async getProvider(
    preferredProvider?: VoiceProviderType
  ): Promise<VoiceProvider> {
    const cacheKey = `${PLATFORM_ID}:${preferredProvider ?? 'default'}`;
    const cached = providerCache.get(cacheKey);

    if (cached && Date.now() - cached.createdAt.getTime() < CACHE_TTL_MS) {
      return cached.provider;
    }

    const provider = await this.createProvider(preferredProvider);
    providerCache.set(cacheKey, { provider, createdAt: new Date() });

    return provider;
  }

  /**
   * Create a new provider instance
   */
  private static async createProvider(
    preferredProvider?: VoiceProviderType
  ): Promise<VoiceProvider> {
    // Try providers in order of preference/cost
    const providerOrder: VoiceProviderType[] = preferredProvider
      ? [preferredProvider, 'telnyx', 'twilio', 'bandwidth', 'vonage']
      : ['telnyx', 'twilio', 'bandwidth', 'vonage'];

    for (const providerType of providerOrder) {
      try {
        const config = await this.getProviderConfig(providerType);
        if (!config) {continue;}

        const provider = await this.instantiateProvider(providerType, config);

        // Validate the provider works
        const isValid = await provider.validateConfig();
        if (isValid) {
          logger.info(`[VoiceFactory] Using ${providerType} for org ${PLATFORM_ID}`, { file: 'voice-factory.ts' });
          return provider;
        }
      } catch (error) {
        logger.warn(`[VoiceFactory] Provider ${providerType} not available: ${error}`, { file: 'voice-factory.ts' });
      }
    }

    throw new Error('No voice provider configured. Please add Twilio or Telnyx credentials in Settings > API Keys.');
  }

  /**
   * Get provider configuration from organization settings
   */
  private static async getProviderConfig(
    providerType: VoiceProviderType
  ): Promise<VoiceProviderConfig | null> {
    try {
      const keysRaw: unknown = await apiKeyService.getServiceKey(PLATFORM_ID, providerType);
      if (!keysRaw) {return null;}

      // Map provider-specific key names to standard config
      switch (providerType) {
        case 'twilio': {
          const keys = keysRaw as TwilioKeys;
          return {
            accountId: keys.accountSid ?? keys.account_sid ?? '',
            authToken: keys.authToken ?? keys.auth_token ?? '',
            phoneNumber: keys.phoneNumber ?? keys.phone_number ?? '',
            webhookBaseUrl: process.env.NEXT_PUBLIC_APP_URL,
          };
        }

        case 'telnyx': {
          const keys = keysRaw as TelnyxKeys;
          return {
            accountId: keys.apiKey ?? keys.api_key ?? '',
            authToken: keys.apiSecret ?? keys.api_secret ?? keys.apiKey ?? '',
            phoneNumber: keys.phoneNumber ?? keys.phone_number ?? '',
            webhookBaseUrl: process.env.NEXT_PUBLIC_APP_URL,
          };
        }

        case 'bandwidth': {
          const keys = keysRaw as BandwidthKeys;
          return {
            accountId: keys.accountId ?? keys.account_id ?? '',
            authToken: keys.apiToken ?? keys.api_token ?? '',
            phoneNumber: keys.phoneNumber ?? keys.phone_number ?? '',
            webhookBaseUrl: process.env.NEXT_PUBLIC_APP_URL,
          };
        }

        case 'vonage': {
          const keys = keysRaw as VonageKeys;
          return {
            accountId: keys.apiKey ?? keys.api_key ?? '',
            authToken: keys.apiSecret ?? keys.api_secret ?? '',
            phoneNumber: keys.phoneNumber ?? keys.phone_number ?? '',
            webhookBaseUrl: process.env.NEXT_PUBLIC_APP_URL,
          };
        }

        default:
          return null;
      }
    } catch {
      return null;
    }
  }

  /**
   * Instantiate the appropriate provider class
   */
  private static async instantiateProvider(
    providerType: VoiceProviderType,
    config: VoiceProviderConfig
  ): Promise<VoiceProvider> {
    switch (providerType) {
      case 'twilio': {
        const { TwilioProvider } = await import('./providers/twilio-provider');
        return new TwilioProvider(config);
      }

      case 'telnyx': {
        const { TelnyxProvider } = await import('./providers/telnyx-provider');
        return new TelnyxProvider(config);
      }

      case 'bandwidth': {
        // Placeholder for future implementation
        throw new Error('Bandwidth provider not yet implemented');
      }

      case 'vonage': {
        // Placeholder for future implementation
        throw new Error('Vonage provider not yet implemented');
      }

      default:
        throw new Error(`Unknown provider type: ${providerType}`);
    }
  }

  /**
   * Get cost comparison for all configured providers
   */
  static async getCostComparison(): Promise<
    Array<{
      provider: VoiceProviderType;
      configured: boolean;
      costs: VoiceProviderCosts;
      savingsVsTwilio: {
        voicePercent: number;
        smsPercent: number;
        phoneNumberPercent: number;
      };
    }>
  > {
    const twilioBaseline = PROVIDER_COSTS.twilio;
    const results = [];

    for (const [provider, costs] of Object.entries(PROVIDER_COSTS)) {
      const providerType = provider as VoiceProviderType;
      const config = await this.getProviderConfig(providerType);

      results.push({
        provider: providerType,
        configured: config !== null,
        costs,
        savingsVsTwilio: {
          voicePercent: Math.round((1 - costs.voicePerMinuteCents / twilioBaseline.voicePerMinuteCents) * 100),
          smsPercent: Math.round((1 - costs.smsPerMessageCents / twilioBaseline.smsPerMessageCents) * 100),
          phoneNumberPercent: Math.round((1 - costs.phoneNumberMonthlyCents / twilioBaseline.phoneNumberMonthlyCents) * 100),
        },
      });
    }

    return results;
  }

  /**
   * Clear provider cache for an organization
   */
  static clearCache(): void {
    providerCache.clear();
  }

  /**
   * Get provider costs
   */
  static getProviderCosts(providerType: VoiceProviderType): VoiceProviderCosts {
    return PROVIDER_COSTS[providerType];
  }
}

export default VoiceProviderFactory;
