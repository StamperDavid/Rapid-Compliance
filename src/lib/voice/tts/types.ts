/**
 * Text-to-Speech (TTS) Voice Engine Types
 * Multi-provider marketplace for voice synthesis
 */

// Available TTS engine providers
export type TTSEngineType = 'native' | 'unreal' | 'elevenlabs';

// Key mode: platform (we pay) or user (they pay)
export type APIKeyMode = 'platform' | 'user';

// Voice quality tiers
export type VoiceQuality = 'standard' | 'premium' | 'ultra';

// Audio output formats
export type AudioFormat = 'mp3' | 'wav' | 'pcm' | 'ogg';

/**
 * Provider configuration stored per organization
 */
export interface TTSEngineConfig {
  // Selected engine
  engine: TTSEngineType;

  // API key mode
  keyMode: APIKeyMode;

  // User's own API key (encrypted, only used when keyMode === 'user')
  userApiKey?: string;

  // Selected voice ID for this engine
  voiceId?: string;

  // Voice settings
  settings: TTSVoiceSettings;
}

/**
 * Voice synthesis settings
 */
export interface TTSVoiceSettings {
  // Speech speed (0.5 - 2.0, default 1.0)
  speed?: number;

  // Pitch adjustment (-12 to 12 semitones)
  pitch?: number;

  // Volume (0.0 - 1.0)
  volume?: number;

  // Output format
  format?: AudioFormat;

  // Sample rate (8000, 16000, 22050, 44100, 48000)
  sampleRate?: number;

  // Stability (ElevenLabs specific, 0-1)
  stability?: number;

  // Similarity boost (ElevenLabs specific, 0-1)
  similarityBoost?: number;

  // Style exaggeration (ElevenLabs specific, 0-1)
  styleExaggeration?: number;
}

/**
 * Request to synthesize audio
 */
export interface TTSSynthesizeRequest {
  // Text to synthesize
  text: string;

  // Organization ID for config lookup
  organizationId: string;

  // Optional engine override
  engine?: TTSEngineType;

  // Optional voice ID override
  voiceId?: string;

  // Optional settings override
  settings?: Partial<TTSVoiceSettings>;
}

/**
 * Synthesized audio response
 */
export interface TTSSynthesizeResponse {
  // Audio data as base64 or URL
  audio: string;

  // Audio format
  format: AudioFormat;

  // Duration in seconds
  durationSeconds: number;

  // Characters processed
  charactersUsed: number;

  // Engine used
  engine: TTSEngineType;

  // Estimated cost in cents
  estimatedCostCents: number;
}

/**
 * Available voice from a provider
 */
export interface TTSVoice {
  // Unique voice ID
  id: string;

  // Display name
  name: string;

  // Voice description
  description?: string;

  // Voice gender
  gender?: 'male' | 'female' | 'neutral';

  // Language/accent
  language?: string;

  // Voice category
  category?: 'standard' | 'premium' | 'cloned' | 'custom';

  // Preview audio URL
  previewUrl?: string;

  // Provider-specific metadata
  metadata?: Record<string, unknown>;
}

/**
 * Provider pricing info
 */
export interface TTSProviderPricing {
  // Cost per 1000 characters (in cents)
  costPer1kChars: number;

  // Free tier characters per month
  freeCharsPerMonth?: number;

  // Monthly subscription cost (if applicable)
  monthlyFee?: number;
}

/**
 * Provider info for UI display
 */
export interface TTSProviderInfo {
  // Provider type
  type: TTSEngineType;

  // Display name
  name: string;

  // Description
  description: string;

  // Quality tier
  quality: VoiceQuality;

  // Latency (low/medium/high)
  latency: 'low' | 'medium' | 'high';

  // Pricing info
  pricing: TTSProviderPricing;

  // Features supported
  features: string[];

  // Supports user API keys
  supportsUserKeys: boolean;

  // Logo/icon URL
  logoUrl?: string;
}

/**
 * Interface that all TTS providers must implement
 */
export interface TTSProvider {
  // Provider type
  readonly type: TTSEngineType;

  // Synthesize text to audio
  synthesize(
    text: string,
    voiceId: string,
    settings?: TTSVoiceSettings
  ): Promise<TTSSynthesizeResponse>;

  // List available voices
  listVoices(): Promise<TTSVoice[]>;

  // Get provider info
  getProviderInfo(): TTSProviderInfo;

  // Validate API key
  validateApiKey(apiKey: string): Promise<boolean>;

  // Get voice by ID
  getVoice(voiceId: string): Promise<TTSVoice | null>;
}

/**
 * Default configurations for each provider
 */
export const DEFAULT_TTS_CONFIGS: Record<TTSEngineType, Partial<TTSEngineConfig>> = {
  native: {
    engine: 'native',
    keyMode: 'platform',
    settings: {
      speed: 1.0,
      format: 'mp3',
      sampleRate: 22050,
    },
  },
  unreal: {
    engine: 'unreal',
    keyMode: 'platform',
    settings: {
      speed: 1.0,
      format: 'mp3',
      sampleRate: 22050,
    },
  },
  elevenlabs: {
    engine: 'elevenlabs',
    keyMode: 'platform',
    settings: {
      speed: 1.0,
      format: 'mp3',
      sampleRate: 44100,
      stability: 0.5,
      similarityBoost: 0.75,
    },
  },
};

/**
 * Provider information for marketplace display
 */
export const TTS_PROVIDER_INFO: Record<TTSEngineType, TTSProviderInfo> = {
  native: {
    type: 'native',
    name: 'Native Voice',
    description: 'Our proprietary high-quality hosted voice synthesis. Best balance of quality and cost.',
    quality: 'premium',
    latency: 'low',
    pricing: {
      costPer1kChars: 0.5, // $0.005 per 1k chars
      freeCharsPerMonth: 50000,
    },
    features: [
      'Ultra-low latency',
      'Custom voice cloning',
      'Multi-language support',
      'SSML support',
      'Emotional tones',
    ],
    supportsUserKeys: false,
  },
  unreal: {
    type: 'unreal',
    name: 'Unreal Speech',
    description: 'Cost-effective voice synthesis with fast generation. Great for high-volume use cases.',
    quality: 'standard',
    latency: 'low',
    pricing: {
      costPer1kChars: 0.1, // $0.001 per 1k chars
      freeCharsPerMonth: 250000,
    },
    features: [
      'Ultra-fast generation',
      'Low cost per character',
      'Multiple voices',
      'Streaming support',
    ],
    supportsUserKeys: true,
  },
  elevenlabs: {
    type: 'elevenlabs',
    name: 'ElevenLabs',
    description: 'Industry-leading voice quality with advanced customization. Premium tier for the best results.',
    quality: 'ultra',
    latency: 'medium',
    pricing: {
      costPer1kChars: 3.0, // $0.03 per 1k chars
      freeCharsPerMonth: 10000,
      monthlyFee: 500, // $5/month starter
    },
    features: [
      'Best-in-class quality',
      'Voice cloning',
      'Multilingual',
      'Emotional range',
      'Projects & dubbing',
      'Real-time streaming',
    ],
    supportsUserKeys: true,
  },
};
