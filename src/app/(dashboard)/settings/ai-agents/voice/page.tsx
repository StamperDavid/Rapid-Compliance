'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import SubpageNav from '@/components/ui/SubpageNav';
import { useAuth } from '@/hooks/useAuth';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import { auth } from '@/lib/firebase/config';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// Types
// ============================================================================

type TTSEngineType = 'elevenlabs' | 'unreal';

interface TTSVoice {
  id: string;
  name: string;
  description?: string;
  gender?: 'male' | 'female' | 'neutral';
  language?: string;
  category?: string;
  previewUrl?: string;
}

interface TTSProviderInfo {
  type: TTSEngineType;
  name: string;
  description: string;
  quality: string;
  latency: string;
  pricing: {
    costPer1kChars: number;
    freeCharsPerMonth?: number;
    monthlyFee?: number;
  };
  features: string[];
  supportsUserKeys: boolean;
}

interface TTSConfig {
  engine: TTSEngineType;
  keyMode: 'platform' | 'user';
  userApiKey?: string;
  voiceId?: string;
  settings: Record<string, unknown>;
}

interface ProvidersApiResponse {
  success: boolean;
  providers: TTSProviderInfo[];
}

interface ConfigApiResponse {
  success: boolean;
  config: TTSConfig;
}

interface VoicesApiResponse {
  success: boolean;
  voices: TTSVoice[];
}

interface ValidateApiResponse {
  success: boolean;
  valid: boolean;
}

interface SaveApiResponse {
  success: boolean;
  error?: string;
}

interface SynthesizeApiResponse {
  success: boolean;
  audio?: string;
  error?: string;
}

// ============================================================================
// Component
// ============================================================================

export default function VoiceSettingsPage() {
  const { user } = useAuth();
  const { theme } = useOrgTheme();

  const primaryColor = theme?.colors?.primary?.main || 'var(--color-primary)';

  // State
  const [providers, setProviders] = useState<TTSProviderInfo[]>([]);
  const [selectedEngine, setSelectedEngine] = useState<TTSEngineType>('elevenlabs');
  const [voices, setVoices] = useState<TTSVoice[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
  const [apiKey, setApiKey] = useState('');
  const [keyMode, setKeyMode] = useState<'platform' | 'user'>('platform');
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch auth token
  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const currentUser = auth?.currentUser;
    if (!currentUser) { return {}; }
    const idToken = await currentUser.getIdToken(true);
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    };
  }, []);

  // Load providers and config on mount
  useEffect(() => {
    async function loadData() {
      try {
        const headers = await getAuthHeaders();
        if (!headers.Authorization) { return; }

        const [providersRes, configRes] = await Promise.all([
          fetch('/api/voice/tts?action=providers', { headers }),
          fetch('/api/voice/tts?action=config', { headers }),
        ]);

        const providersData = await providersRes.json() as ProvidersApiResponse;
        const configData = await configRes.json() as ConfigApiResponse;

        if (providersData.success && providersData.providers) {
          setProviders(providersData.providers);
        }

        if (configData.success && configData.config) {
          setSelectedEngine(configData.config.engine);
          setKeyMode(configData.config.keyMode);
          setSelectedVoiceId(configData.config.voiceId ?? '');
          if (configData.config.userApiKey) {
            setApiKey(configData.config.userApiKey);
          }
        }
      } catch (error) {
        logger.error('Failed to load voice settings', error instanceof Error ? error : new Error(String(error)));
      } finally {
        setIsLoading(false);
      }
    }
    void loadData();
  }, [getAuthHeaders]);

  // Load voices when engine changes
  useEffect(() => {
    async function loadVoices() {
      try {
        const headers = await getAuthHeaders();
        if (!headers.Authorization) { return; }

        const res = await fetch(`/api/voice/tts?engine=${selectedEngine}`, { headers });
        const data = await res.json() as VoicesApiResponse;

        if (data.success && data.voices) {
          setVoices(data.voices);
          // Auto-select first voice if current selection doesn't belong to this engine
          if (data.voices.length > 0 && !data.voices.find(v => v.id === selectedVoiceId)) {
            setSelectedVoiceId(data.voices[0].id);
          }
        }
      } catch (error) {
        logger.error('Failed to load voices', error instanceof Error ? error : new Error(String(error)));
      }
    }
    void loadVoices();
  }, [selectedEngine, getAuthHeaders, selectedVoiceId]);

  // Validate API key
  const handleValidate = async () => {
    if (!apiKey.trim()) { return; }
    setIsValidating(true);
    setValidationResult(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/voice/tts', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'validate-key',
          engine: selectedEngine,
          apiKey: apiKey.trim(),
        }),
      });
      const data = await res.json() as ValidateApiResponse;
      setValidationResult(data.success && data.valid);
    } catch {
      setValidationResult(false);
    } finally {
      setIsValidating(false);
    }
  };

  // Save config
  const handleSave = async () => {
    if (!user?.id) { return; }
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/voice/tts', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'save-config',
          config: {
            engine: selectedEngine,
            keyMode,
            userApiKey: keyMode === 'user' ? apiKey.trim() : undefined,
            voiceId: selectedVoiceId,
          },
          userId: user.id,
        }),
      });
      const data = await res.json() as SaveApiResponse;

      if (data.success) {
        setSaveMessage({ type: 'success', text: 'Voice settings saved successfully' });
      } else {
        setSaveMessage({ type: 'error', text: data.error ?? 'Failed to save settings' });
      }
    } catch {
      setSaveMessage({ type: 'error', text: 'Network error — could not save settings' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMessage(null), 4000);
    }
  };

  // Test voice preview
  const handleTestVoice = async () => {
    if (!selectedVoiceId) { return; }
    setIsTesting(true);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/voice/tts', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text: 'Hello! This is a preview of your selected voice. The quality sounds great and is ready for production use.',
          engine: selectedEngine,
          voiceId: selectedVoiceId,
        }),
      });
      const data = await res.json() as SynthesizeApiResponse;

      if (data.success && data.audio) {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        const audio = new Audio(data.audio);
        audioRef.current = audio;
        await audio.play();
      } else {
        setSaveMessage({ type: 'error', text: data.error ?? 'Failed to generate voice preview' });
        setTimeout(() => setSaveMessage(null), 4000);
      }
    } catch {
      setSaveMessage({ type: 'error', text: 'Failed to test voice — check your API key and try again' });
      setTimeout(() => setSaveMessage(null), 4000);
    } finally {
      setIsTesting(false);
    }
  };

  const getProviderForEngine = (engine: TTSEngineType): TTSProviderInfo | undefined =>
    providers.find(p => p.type === engine);

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Loading voice settings...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', overflowY: 'auto' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Breadcrumb */}
        <div style={{ marginBottom: '2rem' }}>
          <Link
            href="/settings/ai-agents"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: primaryColor, fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none', marginBottom: '1.5rem' }}
          >
            ← Back to AI Agent
          </Link>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '0.5rem', marginTop: '1rem' }}>
            Voice & Speech
          </h1>
          <p style={{ color: 'var(--color-text-disabled)', fontSize: '0.875rem' }}>
            Configure Jasper&apos;s voice provider, select voices, and manage TTS settings
          </p>
          <SubpageNav items={[
            { label: 'Training Center', href: '/settings/ai-agents/training' },
            { label: 'Persona', href: '/settings/ai-agents/persona' },
            { label: 'Voice & Speech', href: '/settings/ai-agents/voice' },
            { label: 'Voice AI Lab', href: '/voice/training' },
            { label: 'Social AI Lab', href: '/social/training' },
            { label: 'SEO AI Lab', href: '/seo/training' },
          ]} />
        </div>

        {/* Section 1: Provider Selection */}
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '1rem' }}>
            Voice Provider
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
            {(['elevenlabs', 'unreal'] as TTSEngineType[]).map((engine) => {
              const info = getProviderForEngine(engine);
              const isSelected = selectedEngine === engine;
              const qualityLabel = engine === 'elevenlabs' ? 'Ultra' : 'Standard';
              const costLabel = info ? `$${(info.pricing.costPer1kChars / 100).toFixed(4)}/1k chars` : '';

              return (
                <button
                  key={engine}
                  type="button"
                  onClick={() => {
                    setSelectedEngine(engine);
                    setValidationResult(null);
                    setApiKey('');
                  }}
                  style={{
                    backgroundColor: 'var(--color-bg-paper)',
                    border: isSelected ? `2px solid ${primaryColor}` : '1px solid var(--color-border-strong)',
                    borderRadius: '1rem',
                    padding: '1.5rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    position: 'relative',
                    outline: 'none',
                  }}
                >
                  {isSelected && (
                    <div style={{
                      position: 'absolute',
                      top: '0.75rem',
                      right: '0.75rem',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: primaryColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                    }}>
                      ✓
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '0.75rem',
                      background: engine === 'elevenlabs'
                        ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                        : 'linear-gradient(135deg, #06b6d4, #0ea5e9)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.5rem',
                      flexShrink: 0,
                    }}>
                      {engine === 'elevenlabs' ? '🎙️' : '⚡'}
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '0.125rem' }}>
                        {info?.name ?? engine}
                      </h3>
                      <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem' }}>
                        <span style={{ color: primaryColor, fontWeight: '600' }}>{qualityLabel} Quality</span>
                        <span style={{ color: 'var(--color-text-disabled)' }}>{costLabel}</span>
                      </div>
                    </div>
                  </div>

                  <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: '1.5', marginBottom: '1rem' }}>
                    {info?.description ?? ''}
                  </p>

                  {info?.features && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                      {info.features.slice(0, 4).map((feature) => (
                        <span
                          key={feature}
                          style={{
                            fontSize: '0.6875rem',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '1rem',
                            backgroundColor: 'var(--color-bg-elevated)',
                            color: 'var(--color-text-secondary)',
                          }}
                        >
                          {feature}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 2: Voice Selection */}
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '1rem' }}>
            Voice Selection
          </h2>
          <div style={{
            backgroundColor: 'var(--color-bg-paper)',
            border: '1px solid var(--color-border-strong)',
            borderRadius: '1rem',
            padding: '1.5rem',
          }}>
            {voices.length === 0 ? (
              <p style={{ color: 'var(--color-text-disabled)', fontSize: '0.875rem', textAlign: 'center', padding: '2rem 0' }}>
                No voices available. Configure an API key below to load voices.
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
                {voices.map((voice) => {
                  const isSelected = selectedVoiceId === voice.id;
                  return (
                    <button
                      key={voice.id}
                      type="button"
                      onClick={() => setSelectedVoiceId(voice.id)}
                      style={{
                        backgroundColor: isSelected ? `${primaryColor}15` : 'var(--color-bg-main)',
                        border: isSelected ? `2px solid ${primaryColor}` : '1px solid var(--color-border-light)',
                        borderRadius: '0.75rem',
                        padding: '1rem',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        outline: 'none',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                        <span style={{ fontSize: '0.9375rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>
                          {voice.name}
                        </span>
                        {voice.gender && (
                          <span style={{
                            fontSize: '0.6875rem',
                            padding: '0.125rem 0.375rem',
                            borderRadius: '0.25rem',
                            backgroundColor: voice.gender === 'female' ? 'rgba(236, 72, 153, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                            color: voice.gender === 'female' ? '#ec4899' : '#3b82f6',
                            fontWeight: '500',
                          }}>
                            {voice.gender}
                          </span>
                        )}
                      </div>
                      {voice.description && (
                        <p style={{
                          fontSize: '0.75rem',
                          color: 'var(--color-text-disabled)',
                          lineHeight: '1.4',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}>
                          {voice.description}
                        </p>
                      )}
                      {voice.language && (
                        <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-disabled)', marginTop: '0.375rem', display: 'block' }}>
                          {voice.language}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Test Voice Button */}
            {selectedVoiceId && (
              <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => void handleTestVoice()}
                  disabled={isTesting || !selectedVoiceId}
                  style={{
                    padding: '0.625rem 1.25rem',
                    borderRadius: '0.5rem',
                    border: 'none',
                    backgroundColor: isTesting ? 'var(--color-bg-elevated)' : primaryColor,
                    color: isTesting ? 'var(--color-text-disabled)' : '#fff',
                    fontSize: '0.8125rem',
                    fontWeight: '600',
                    cursor: isTesting ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {isTesting ? 'Playing...' : 'Test Voice'}
                </button>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>
                  Hear a preview of the selected voice
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Section 3: API Key Configuration */}
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '1rem' }}>
            API Key
          </h2>
          <div style={{
            backgroundColor: 'var(--color-bg-paper)',
            border: '1px solid var(--color-border-strong)',
            borderRadius: '1rem',
            padding: '1.5rem',
          }}>
            {/* Key Mode Toggle */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem' }}>
              <button
                type="button"
                onClick={() => setKeyMode('platform')}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  border: keyMode === 'platform' ? `2px solid ${primaryColor}` : '1px solid var(--color-border-light)',
                  backgroundColor: keyMode === 'platform' ? `${primaryColor}15` : 'transparent',
                  color: keyMode === 'platform' ? primaryColor : 'var(--color-text-secondary)',
                  fontSize: '0.8125rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                Platform Key (We Pay)
              </button>
              <button
                type="button"
                onClick={() => setKeyMode('user')}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  border: keyMode === 'user' ? `2px solid ${primaryColor}` : '1px solid var(--color-border-light)',
                  backgroundColor: keyMode === 'user' ? `${primaryColor}15` : 'transparent',
                  color: keyMode === 'user' ? primaryColor : 'var(--color-text-secondary)',
                  fontSize: '0.8125rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                Your Own Key
              </button>
            </div>

            {keyMode === 'platform' ? (
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: '1.5' }}>
                Using the platform&apos;s API key. Voice synthesis costs are included in your plan.
              </p>
            ) : (
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                  {selectedEngine === 'elevenlabs' ? 'ElevenLabs' : 'Unreal Speech'} API Key
                </label>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      setValidationResult(null);
                    }}
                    placeholder={selectedEngine === 'elevenlabs' ? 'xi-...' : 'Enter your API key'}
                    style={{
                      flex: 1,
                      padding: '0.625rem 0.875rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--color-border-light)',
                      backgroundColor: 'var(--color-bg-main)',
                      color: 'var(--color-text-primary)',
                      fontSize: '0.875rem',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => void handleValidate()}
                    disabled={!apiKey.trim() || isValidating}
                    style={{
                      padding: '0.625rem 1.25rem',
                      borderRadius: '0.5rem',
                      border: 'none',
                      backgroundColor: !apiKey.trim() || isValidating ? 'var(--color-bg-elevated)' : primaryColor,
                      color: !apiKey.trim() || isValidating ? 'var(--color-text-disabled)' : '#fff',
                      fontSize: '0.8125rem',
                      fontWeight: '600',
                      cursor: !apiKey.trim() || isValidating ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isValidating ? 'Validating...' : 'Validate'}
                  </button>
                </div>
                {validationResult !== null && (
                  <p style={{
                    marginTop: '0.5rem',
                    fontSize: '0.8125rem',
                    fontWeight: '500',
                    color: validationResult ? 'var(--color-success)' : 'var(--color-error)',
                  }}>
                    {validationResult ? 'API key is valid' : 'API key is invalid — please check and try again'}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Save Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
            style={{
              padding: '0.75rem 2rem',
              borderRadius: '0.75rem',
              border: 'none',
              background: isSaving ? 'var(--color-bg-elevated)' : `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`,
              color: isSaving ? 'var(--color-text-disabled)' : '#fff',
              fontSize: '0.9375rem',
              fontWeight: '600',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {isSaving ? 'Saving...' : 'Save Voice Settings'}
          </button>
          {saveMessage && (
            <span style={{
              fontSize: '0.8125rem',
              fontWeight: '500',
              color: saveMessage.type === 'success' ? 'var(--color-success)' : 'var(--color-error)',
            }}>
              {saveMessage.text}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
