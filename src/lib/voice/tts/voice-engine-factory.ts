/**
 * Voice Engine Factory
 * Routes TTS requests to the appropriate provider based on organization settings
 */

import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';
import {
  TTS_PROVIDER_INFO,
  DEFAULT_TTS_CONFIGS,
  type TTSEngineType,
  type TTSEngineConfig,
  type TTSProvider,
  type TTSSynthesizeRequest,
  type TTSSynthesizeResponse,
  type TTSVoice,
  type TTSProviderInfo
} from './types';
import { NativeProvider } from './providers/native-provider';
import { UnrealProvider } from './providers/unreal-provider';
import { ElevenLabsProvider } from './providers/elevenlabs-provider';

// Cache for provider instances (5 minute TTL)
const providerCache = new Map<string, { provider: TTSProvider; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cache for org configs
const configCache = new Map<string, { config: TTSEngineConfig; timestamp: number }>();

/**
 * Voice Engine Factory
 * Central hub for TTS provider management
 */
export class VoiceEngineFactory {
  /**
   * Get audio from text using organization's configured TTS engine
   */
  static async getAudio(request: TTSSynthesizeRequest): Promise<TTSSynthesizeResponse> {
    const { text, engine: engineOverride, voiceId, settings } = request;

    // Get organization's TTS config
    const config = await this.getOrgConfig();
    const effectiveEngine = engineOverride ?? config.engine;
    const effectiveVoiceId = voiceId ?? config.voiceId ?? this.getDefaultVoiceId(effectiveEngine);

    // Get the provider instance
    const provider = await this.getProvider(effectiveEngine, config);

    // Merge settings
    const effectiveSettings = {
      ...config.settings,
      ...settings,
    };

    // Synthesize audio
    return provider.synthesize(text, effectiveVoiceId, effectiveSettings);
  }

  /**
   * Get or create provider instance for an organization
   */
  static async getProvider(
    engine?: TTSEngineType,
    config?: TTSEngineConfig
  ): Promise<TTSProvider> {
    const orgConfig = config ?? await this.getOrgConfig();
    const effectiveEngine = engine ?? orgConfig.engine;
    const cacheKey = `${DEFAULT_ORG_ID}-${effectiveEngine}-${orgConfig.keyMode}`;

    // Check cache
    const cached = providerCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.provider;
    }

    // Create provider with appropriate API key
    const apiKey = this.getApiKey(effectiveEngine, orgConfig);
    const provider = this.createProvider(effectiveEngine, apiKey);

    // Cache it
    providerCache.set(cacheKey, { provider, timestamp: Date.now() });

    return provider;
  }

  /**
   * Create a provider instance
   */
  private static createProvider(engine: TTSEngineType, apiKey?: string): TTSProvider {
    switch (engine) {
      case 'native':
        return new NativeProvider(apiKey);
      case 'unreal':
        return new UnrealProvider(apiKey);
      case 'elevenlabs':
        return new ElevenLabsProvider(apiKey);
      default:
        throw new Error(`Unknown TTS engine: ${engine}`);
    }
  }

  /**
   * Get API key for provider based on org settings
   */
  private static getApiKey(
    engine: TTSEngineType,
    config: TTSEngineConfig
  ): string | undefined {
    if (config.keyMode === 'user' && config.userApiKey) {
      // User's own API key
      return config.userApiKey;
    }

    // Platform keys from environment
    switch (engine) {
      case 'native':
        return process.env.NATIVE_VOICE_API_KEY;
      case 'unreal':
        return process.env.UNREAL_SPEECH_API_KEY;
      case 'elevenlabs':
        return process.env.ELEVENLABS_API_KEY;
      default:
        return undefined;
    }
  }

  /**
   * Get organization's TTS configuration
   */
  static async getOrgConfig(): Promise<TTSEngineConfig> {
    // Check cache
    const cached = configCache.get(DEFAULT_ORG_ID);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.config;
    }

    try {
      if (!db) {
        console.warn('Firestore not initialized, using default TTS config');
        return DEFAULT_TTS_CONFIGS.native as TTSEngineConfig;
      }
      const docRef = doc(db, COLLECTIONS.ORGANIZATIONS, DEFAULT_ORG_ID, 'settings', 'ttsEngine');
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const config = docSnap.data() as TTSEngineConfig;
        configCache.set(DEFAULT_ORG_ID, { config, timestamp: Date.now() });
        return config;
      }
    } catch (error) {
      console.error('Error fetching TTS config:', error);
    }

    // Return default config (Native provider with platform keys)
    const nativeSettings = DEFAULT_TTS_CONFIGS.native.settings;
    if (!nativeSettings) {
      throw new Error('Default Native TTS settings are not configured');
    }

    const defaultConfig: TTSEngineConfig = {
      engine: 'native',
      keyMode: 'platform',
      settings: nativeSettings,
    };

    return defaultConfig;
  }

  /**
   * Save organization's TTS configuration
   */
  static async saveOrgConfig(
    config: Partial<TTSEngineConfig>,
    userId: string
  ): Promise<void> {
    const currentConfig = await this.getOrgConfig();
    const updatedConfig = {
      ...currentConfig,
      ...config,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    };

    if (!db) {
      throw new Error('Firestore not initialized');
    }
    const docRef = doc(db, COLLECTIONS.ORGANIZATIONS, DEFAULT_ORG_ID, 'settings', 'ttsEngine');
    await setDoc(docRef, updatedConfig, { merge: true });

    // Clear cache
    configCache.delete(DEFAULT_ORG_ID);
    // Clear provider cache for this org
    for (const key of providerCache.keys()) {
      if (key.startsWith(DEFAULT_ORG_ID)) {
        providerCache.delete(key);
      }
    }
  }

  /**
   * Get default voice ID for an engine
   */
  private static getDefaultVoiceId(engine: TTSEngineType): string {
    switch (engine) {
      case 'native':
        return 'native-aria';
      case 'unreal':
        return 'Scarlett';
      case 'elevenlabs':
        return '21m00Tcm4TlvDq8ikWAM'; // Rachel
      default:
        return 'native-aria';
    }
  }

  /**
   * List all available voices for an engine
   */
  static async listVoices(
    engine?: TTSEngineType
  ): Promise<TTSVoice[]> {
    const provider = await this.getProvider(engine);
    return provider.listVoices();
  }

  /**
   * Get provider info for all engines
   */
  static getAllProviderInfo(): TTSProviderInfo[] {
    return Object.values(TTS_PROVIDER_INFO);
  }

  /**
   * Get provider info for specific engine
   */
  static getProviderInfo(engine: TTSEngineType): TTSProviderInfo {
    return TTS_PROVIDER_INFO[engine];
  }

  /**
   * Validate an API key for a specific engine
   */
  static async validateApiKey(engine: TTSEngineType, apiKey: string): Promise<boolean> {
    const provider = this.createProvider(engine, apiKey);
    return provider.validateApiKey(apiKey);
  }

  /**
   * Get cost comparison for all providers
   */
  static getCostComparison(textLength: number): Array<{
    engine: TTSEngineType;
    name: string;
    estimatedCostCents: number;
    quality: string;
    latency: string;
  }> {
    return Object.values(TTS_PROVIDER_INFO).map(info => ({
      engine: info.type,
      name: info.name,
      estimatedCostCents: (textLength / 1000) * info.pricing.costPer1kChars,
      quality: info.quality,
      latency: info.latency,
    }));
  }

  /**
   * Clear all caches (useful for testing)
   */
  static clearCache(): void {
    providerCache.clear();
    configCache.clear();
  }
}

// Export types and providers for direct use
export * from './types';
export { NativeProvider } from './providers/native-provider';
export { UnrealProvider } from './providers/unreal-provider';
export { ElevenLabsProvider } from './providers/elevenlabs-provider';
