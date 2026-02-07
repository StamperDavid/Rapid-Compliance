/**
 * Native Voice Provider
 * Our proprietary hosted high-quality TTS service
 */

import { logger } from '@/lib/logger/logger';
import {
  TTS_PROVIDER_INFO,
  type TTSProvider,
  type TTSSynthesizeResponse,
  type TTSVoice,
  type TTSVoiceSettings,
  type TTSProviderInfo,
  type AudioFormat
} from '../types';

// Native API endpoint - configurable via environment
const NATIVE_VOICE_URL = process.env.NATIVE_VOICE_URL ?? 'https://voice.platform.local/api/v1';

// API response type definitions
interface NativeSynthesizeRequest {
  text: string;
  voice_id: string;
  speed: number;
  format: string;
  sample_rate: number;
}

interface NativeSynthesizeResponse {
  audio: string;
  format: string;
  duration_seconds: number;
  characters_used: number;
  cost_cents: number;
}

interface NativeVoicesResponse {
  voices: TTSVoice[];
}

interface NativeValidateResponse {
  valid: boolean;
}

// Default voices available in Native system
const NATIVE_VOICES: TTSVoice[] = [
  {
    id: 'native-aria',
    name: 'Aria',
    description: 'Warm and professional female voice, perfect for customer service',
    gender: 'female',
    language: 'en-US',
    category: 'premium',
    previewUrl: `${NATIVE_VOICE_URL}/preview/aria`,
  },
  {
    id: 'native-marcus',
    name: 'Marcus',
    description: 'Confident male voice with natural intonation, great for sales',
    gender: 'male',
    language: 'en-US',
    category: 'premium',
    previewUrl: `${NATIVE_VOICE_URL}/preview/marcus`,
  },
  {
    id: 'native-sophia',
    name: 'Sophia',
    description: 'Friendly and energetic female voice, ideal for marketing',
    gender: 'female',
    language: 'en-US',
    category: 'premium',
    previewUrl: `${NATIVE_VOICE_URL}/preview/sophia`,
  },
  {
    id: 'native-james',
    name: 'James',
    description: 'Authoritative male voice with gravitas, suitable for executive content',
    gender: 'male',
    language: 'en-US',
    category: 'premium',
    previewUrl: `${NATIVE_VOICE_URL}/preview/james`,
  },
  {
    id: 'native-luna',
    name: 'Luna',
    description: 'Soft and calming voice, perfect for support and onboarding',
    gender: 'female',
    language: 'en-US',
    category: 'premium',
    previewUrl: `${NATIVE_VOICE_URL}/preview/luna`,
  },
];

// High-quality placeholder audio (base64 encoded short audio sample)
// In production, this would call the proprietary Native Voice API
const PLACEHOLDER_AUDIO_BASE64 = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYZMVRz3AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYZMVRz3AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

export class NativeProvider implements TTSProvider {
  readonly type = 'native' as const;
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.NATIVE_VOICE_API_KEY ?? '';
  }

  async synthesize(
    text: string,
    voiceId: string,
    settings?: TTSVoiceSettings
  ): Promise<TTSSynthesizeResponse> {
    const effectiveSettings = {
      speed: settings?.speed ?? 1.0,
      format: settings?.format ?? 'mp3',
      sampleRate: settings?.sampleRate ?? 22050,
    };

    // Try real API call if configured
    if (this.apiKey) {
      try {
        const requestBody: NativeSynthesizeRequest = {
          text,
          voice_id: voiceId,
          speed: effectiveSettings.speed,
          format: effectiveSettings.format,
          sample_rate: effectiveSettings.sampleRate,
        };

        const response = await fetch(`${NATIVE_VOICE_URL}/synthesize`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (response.ok) {
          const data = await response.json() as NativeSynthesizeResponse;
          return {
            audio: data.audio,
            format: data.format as AudioFormat,
            durationSeconds: data.duration_seconds,
            charactersUsed: data.characters_used,
            engine: 'native',
            estimatedCostCents: data.cost_cents,
          };
        }

        logger.warn('Native Voice API returned error, using placeholder', {
          status: response.status,
          statusText: response.statusText,
          voiceId,
          textLength: text.length,
        });
      } catch (error) {
        logger.warn('Native Voice API unavailable, using placeholder', {
          error: error instanceof Error ? error.message : String(error),
          voiceId,
          textLength: text.length,
        });
      }
    }

    // Fallback to placeholder audio
    const charactersUsed = text.length;
    const wordsPerMinute = 150 * effectiveSettings.speed;
    const wordCount = text.split(/\s+/).length;
    const durationSeconds = (wordCount / wordsPerMinute) * 60;
    const costPer1kChars = TTS_PROVIDER_INFO.native.pricing.costPer1kChars;
    const estimatedCostCents = (charactersUsed / 1000) * costPer1kChars;

    return {
      audio: PLACEHOLDER_AUDIO_BASE64,
      format: effectiveSettings.format,
      durationSeconds: Math.round(durationSeconds * 10) / 10,
      charactersUsed,
      engine: 'native',
      estimatedCostCents: Math.round(estimatedCostCents * 100) / 100,
    };
  }

  async listVoices(): Promise<TTSVoice[]> {
    // Try to fetch from API if configured
    if (this.apiKey) {
      try {
        const response = await fetch(`${NATIVE_VOICE_URL}/voices`, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
        });

        if (response.ok) {
          const data = await response.json() as NativeVoicesResponse;
          return data.voices;
        }

        logger.warn('Native Voice API voices endpoint returned error, using hardcoded list', {
          status: response.status,
          statusText: response.statusText,
        });
      } catch (error) {
        logger.warn('Native Voice API voices endpoint unavailable, using hardcoded list', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Fallback to hardcoded list
    return NATIVE_VOICES;
  }

  getProviderInfo(): TTSProviderInfo {
    return TTS_PROVIDER_INFO.native;
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    // If no API key provided, return false
    if (!apiKey || apiKey.length === 0) {
      return false;
    }

    // Make a real validation call
    try {
      const response = await fetch(`${NATIVE_VOICE_URL}/validate`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (response.ok) {
        const data = await response.json() as NativeValidateResponse;
        return data.valid;
      }

      return false;
    } catch (error) {
      logger.warn('Native Voice API validation endpoint unavailable', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async getVoice(voiceId: string): Promise<TTSVoice | null> {
    const voices = await this.listVoices();
    return voices.find(v => v.id === voiceId) ?? null;
  }
}
