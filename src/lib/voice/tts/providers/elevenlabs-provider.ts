/**
 * ElevenLabs Provider
 * Premium voice synthesis with best-in-class quality
 * https://elevenlabs.io/
 */

import type {
  TTSProvider,
  TTSSynthesizeResponse,
  TTSVoice,
  TTSVoiceSettings,
  TTSProviderInfo,
  AudioFormat} from '../types';
import {
  TTS_PROVIDER_INFO
} from '../types';

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

// Popular ElevenLabs voices (there are many more available via API)
const ELEVENLABS_DEFAULT_VOICES: TTSVoice[] = [
  {
    id: 'EXAVITQu4vr4xnSDxMaL',
    name: 'Sarah',
    description: 'Soft and conversational, great for narration',
    gender: 'female',
    language: 'en-US',
    category: 'premium',
  },
  {
    id: 'TX3LPaxmHKxFdv7VOQHJ',
    name: 'Liam',
    description: 'Young male, articulate and clear',
    gender: 'male',
    language: 'en-US',
    category: 'premium',
  },
  {
    id: 'pFZP5JQG7iQjIQuC4Bku',
    name: 'Lily',
    description: 'British female, warm and expressive',
    gender: 'female',
    language: 'en-GB',
    category: 'premium',
  },
  {
    id: 'onwK4e9ZLuTAKqWW03F9',
    name: 'Daniel',
    description: 'British male, deep and authoritative',
    gender: 'male',
    language: 'en-GB',
    category: 'premium',
  },
  {
    id: 'XB0fDUnXU5powFXDhCwa',
    name: 'Charlotte',
    description: 'Swedish female, natural and calm',
    gender: 'female',
    language: 'en-US',
    category: 'premium',
  },
  {
    id: 'JBFqnCBsd6RMkjVDRZzb',
    name: 'George',
    description: 'British male, warm and storytelling',
    gender: 'male',
    language: 'en-GB',
    category: 'premium',
  },
  {
    id: '21m00Tcm4TlvDq8ikWAM',
    name: 'Rachel',
    description: 'American female, calm and professional',
    gender: 'female',
    language: 'en-US',
    category: 'premium',
  },
  {
    id: 'AZnzlk1XvdvUeBnXmlld',
    name: 'Domi',
    description: 'American female, strong and confident',
    gender: 'female',
    language: 'en-US',
    category: 'premium',
  },
];

export class ElevenLabsProvider implements TTSProvider {
  readonly type = 'elevenlabs' as const;
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.ELEVENLABS_API_KEY || '';
  }

  async synthesize(
    text: string,
    voiceId: string,
    settings?: TTSVoiceSettings
  ): Promise<TTSSynthesizeResponse> {
    const effectiveSettings = {
      stability: settings?.stability ?? 0.5,
      similarityBoost: settings?.similarityBoost ?? 0.75,
      styleExaggeration: settings?.styleExaggeration ?? 0,
      format: settings?.format ?? 'mp3',
    };

    // Map format to ElevenLabs output format
    const outputFormat = this.mapOutputFormat(effectiveSettings.format);

    try {
      const response = await fetch(
        `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}?output_format=${outputFormat}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: effectiveSettings.stability,
              similarity_boost: effectiveSettings.similarityBoost,
              style: effectiveSettings.styleExaggeration,
              use_speaker_boost: true,
            },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
      }

      // ElevenLabs returns raw audio bytes
      const audioBuffer = await response.arrayBuffer();
      const base64Audio = Buffer.from(audioBuffer).toString('base64');

      // Calculate metrics
      const charactersUsed = text.length;
      const costPer1kChars = TTS_PROVIDER_INFO.elevenlabs.pricing.costPer1kChars;
      const estimatedCostCents = (charactersUsed / 1000) * costPer1kChars;

      return {
        audio: `data:audio/${effectiveSettings.format};base64,${base64Audio}`,
        format: effectiveSettings.format,
        durationSeconds: this.estimateDuration(text),
        charactersUsed,
        engine: 'elevenlabs',
        estimatedCostCents: Math.round(estimatedCostCents * 100) / 100,
      };
    } catch (error) {
      console.error('ElevenLabs synthesis error:', error);
      throw error;
    }
  }

  private mapOutputFormat(format: AudioFormat | string): string {
    const formatMap: Record<string, string> = {
      mp3: 'mp3_44100_128',
      wav: 'pcm_44100',
      pcm: 'pcm_44100',
      ogg: 'mp3_44100_128', // Fallback to mp3
    };
    return formatMap[format] || 'mp3_44100_128';
  }

  private estimateDuration(text: string): number {
    const wordsPerMinute = 150;
    const wordCount = text.split(/\s+/).length;
    return Math.round((wordCount / wordsPerMinute) * 60 * 10) / 10;
  }

  async listVoices(): Promise<TTSVoice[]> {
    try {
      const response = await fetch(`${ELEVENLABS_API_URL}/voices`, {
        headers: {
          'xi-api-key': this.apiKey,
        },
      });

      if (!response.ok) {
        console.warn('Failed to fetch ElevenLabs voices, using defaults');
        return ELEVENLABS_DEFAULT_VOICES;
      }

      const data = await response.json();

      return data.voices.map((voice: {
        voice_id: string;
        name: string;
        description?: string;
        labels?: { gender?: string; accent?: string };
        preview_url?: string;
        category?: string;
      }) => ({
        id: voice.voice_id,
        name: voice.name,
        description: voice.description || '',
        gender: voice.labels?.gender || 'neutral',
        language: voice.labels?.accent || 'en-US',
        category: voice.category === 'cloned' ? 'cloned' : 'premium',
        previewUrl: voice.preview_url,
      }));
    } catch (error) {
      console.error('Error fetching ElevenLabs voices:', error);
      return ELEVENLABS_DEFAULT_VOICES;
    }
  }

  getProviderInfo(): TTSProviderInfo {
    return TTS_PROVIDER_INFO.elevenlabs;
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(`${ELEVENLABS_API_URL}/user`, {
        headers: {
          'xi-api-key': apiKey,
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  async getVoice(voiceId: string): Promise<TTSVoice | null> {
    try {
      const response = await fetch(`${ELEVENLABS_API_URL}/voices/${voiceId}`, {
        headers: {
          'xi-api-key': this.apiKey,
        },
      });

      if (!response.ok) {
        return null;
      }

      const voice = await response.json();

      return {
        id: voice.voice_id,
        name: voice.name,
        description: voice.description || '',
        gender: voice.labels?.gender || 'neutral',
        language: voice.labels?.accent || 'en-US',
        category: voice.category === 'cloned' ? 'cloned' : 'premium',
        previewUrl: voice.preview_url,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get user's subscription info (useful for showing remaining characters)
   */
  async getSubscriptionInfo(): Promise<{
    characterCount: number;
    characterLimit: number;
    tier: string;
  } | null> {
    try {
      const response = await fetch(`${ELEVENLABS_API_URL}/user/subscription`, {
        headers: {
          'xi-api-key': this.apiKey,
        },
      });

      if (!response.ok) {return null;}

      const data = await response.json();

      return {
        characterCount: data.character_count,
        characterLimit: data.character_limit,
        tier: data.tier,
      };
    } catch {
      return null;
    }
  }
}
