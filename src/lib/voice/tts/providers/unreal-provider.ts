/**
 * Unreal Speech Provider
 * Cost-effective, fast voice synthesis
 * https://unrealspeech.com/
 */

import {
  TTS_PROVIDER_INFO,
  type TTSProvider,
  type TTSSynthesizeResponse,
  type TTSVoice,
  type TTSVoiceSettings,
  type TTSProviderInfo
} from '../types';

const UNREAL_API_URL = 'https://api.v7.unrealspeech.com';

// Unreal Speech available voices
const UNREAL_VOICES: TTSVoice[] = [
  {
    id: 'Scarlett',
    name: 'Scarlett',
    description: 'American female, warm and conversational',
    gender: 'female',
    language: 'en-US',
    category: 'standard',
  },
  {
    id: 'Dan',
    name: 'Dan',
    description: 'American male, confident and clear',
    gender: 'male',
    language: 'en-US',
    category: 'standard',
  },
  {
    id: 'Liv',
    name: 'Liv',
    description: 'American female, professional and articulate',
    gender: 'female',
    language: 'en-US',
    category: 'standard',
  },
  {
    id: 'Will',
    name: 'Will',
    description: 'American male, friendly and engaging',
    gender: 'male',
    language: 'en-US',
    category: 'standard',
  },
  {
    id: 'Amy',
    name: 'Amy',
    description: 'British female, sophisticated and elegant',
    gender: 'female',
    language: 'en-GB',
    category: 'standard',
  },
];

export class UnrealProvider implements TTSProvider {
  readonly type = 'unreal' as const;
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.UNREAL_SPEECH_API_KEY ?? '';
  }

  async synthesize(
    text: string,
    voiceId: string,
    settings?: TTSVoiceSettings
  ): Promise<TTSSynthesizeResponse> {
    const effectiveSettings = {
      speed: settings?.speed ?? 0, // Unreal uses -1 to 1 scale
      format: settings?.format ?? 'mp3',
    };

    // Convert our speed (0.5-2.0) to Unreal's scale (-1 to 1)
    // 1.0 -> 0, 0.5 -> -1, 2.0 -> 1
    const unrealSpeed = ((effectiveSettings.speed || 1) - 1) * 2;
    const clampedSpeed = Math.max(-1, Math.min(1, unrealSpeed));

    try {
      const response = await fetch(`${UNREAL_API_URL}/speech`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          Text: text,
          VoiceId: voiceId,
          Bitrate: '192k',
          Speed: clampedSpeed,
          Pitch: settings?.pitch ?? 1.0,
          TimestampType: 'sentence',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Unreal Speech API error: ${response.status} - ${error}`);
      }

      const data = await response.json() as {
        OutputUri?: string;
        SynthesisTask?: { OutputUri?: string };
        TimestampsUri?: string;
      };

      // Calculate metrics
      const charactersUsed = text.length;
      const costPer1kChars = TTS_PROVIDER_INFO.unreal.pricing.costPer1kChars;
      const estimatedCostCents = (charactersUsed / 1000) * costPer1kChars;

      // Unreal returns OutputUri with the audio URL
      return {
        audio: data.OutputUri ?? data.SynthesisTask?.OutputUri ?? '',
        format: effectiveSettings.format,
        durationSeconds: this.estimateDuration(text),
        charactersUsed,
        engine: 'unreal',
        estimatedCostCents: Math.round(estimatedCostCents * 100) / 100,
      };
    } catch (error) {
      console.error('Unreal Speech synthesis error:', error);
      throw error;
    }
  }

  private estimateDuration(text: string): number {
    const wordsPerMinute = 150;
    const wordCount = text.split(/\s+/).length;
    return Math.round((wordCount / wordsPerMinute) * 60 * 10) / 10;
  }

  listVoices(): Promise<TTSVoice[]> {
    // Unreal Speech has a fixed set of voices, no API to list them
    return Promise.resolve(UNREAL_VOICES);
  }

  getProviderInfo(): TTSProviderInfo {
    return TTS_PROVIDER_INFO.unreal;
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      // Make a minimal API call to validate
      const response = await fetch(`${UNREAL_API_URL}/speech`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          Text: 'test',
          VoiceId: 'Scarlett',
          Bitrate: '64k',
        }),
      });

      // 401/403 = invalid key, other errors might be rate limits etc.
      return response.status !== 401 && response.status !== 403;
    } catch {
      return false;
    }
  }

  async getVoice(voiceId: string): Promise<TTSVoice | null> {
    const voices = await this.listVoices();
    return voices.find(v => v.id === voiceId) ?? null;
  }
}
