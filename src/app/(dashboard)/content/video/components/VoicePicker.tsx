'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { Loader2, AlertCircle, Play, Pause, Mic, Search, Check, Volume2, AlertTriangle, Upload, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { HeyGenVoice } from '@/types/video';

interface VoicePickerProps {
  selectedVoiceId: string | null;
  onSelect: (voiceId: string, voiceName: string, provider?: 'heygen' | 'elevenlabs' | 'unrealspeech' | 'custom') => void;
}

const GENDER_FILTERS = ['all', 'male', 'female'] as const;
const PROVIDER_FILTERS = ['all', 'custom', 'elevenlabs', 'unrealspeech', 'heygen'] as const;

export function VoicePicker({ selectedVoiceId, onSelect }: VoicePickerProps) {
  const authFetch = useAuthFetch();
  const [voices, setVoices] = useState<HeyGenVoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [filterGender, setFilterGender] = useState<string>('all');
  const [filterProvider, setFilterProvider] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLanguage, setFilterLanguage] = useState<string>('all');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [loadingPreviewId, setLoadingPreviewId] = useState<string | null>(null);

  // Voice clone state
  const [showCloneUI, setShowCloneUI] = useState(false);
  const [cloneName, setCloneName] = useState('');
  const [cloneFiles, setCloneFiles] = useState<File[]>([]);
  const [cloneLoading, setCloneLoading] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [cloneSuccess, setCloneSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchVoices = useCallback(async () => {
    try {
      const response = await authFetch('/api/video/voices');
      if (!response.ok) {
        throw new Error('Failed to fetch voices');
      }
      const data = await response.json() as { success: boolean; voices: HeyGenVoice[] };
      setVoices(data.voices ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load voices');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void fetchVoices();
  }, [fetchVoices]);

  // Build unique language list
  const languages = useMemo(() => {
    const langs = new Set<string>();
    for (const v of voices) {
      if (v.language) {
        langs.add(v.language);
      }
    }
    return Array.from(langs).sort();
  }, [voices]);

  // Check if we have voices from multiple providers
  const hasMultipleProviders = useMemo(() => {
    const providers = new Set(voices.map((v) => v.provider ?? 'heygen'));
    return providers.size > 1;
  }, [voices]);

  const filteredVoices = useMemo(() => {
    let result = voices;

    if (filterGender !== 'all') {
      result = result.filter((v) => v.gender === filterGender);
    }

    if (filterProvider !== 'all') {
      result = result.filter((v) => (v.provider ?? 'heygen') === filterProvider);
    }

    if (filterLanguage !== 'all') {
      result = result.filter((v) => v.language === filterLanguage);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (v) =>
          v.name.toLowerCase().includes(query) ||
          (v.language?.toLowerCase().includes(query) ?? false) ||
          (v.accent?.toLowerCase().includes(query) ?? false),
      );
    }

    return result;
  }, [voices, filterGender, filterProvider, filterLanguage, searchQuery]);

  const playAudioUrl = (voiceId: string, url: string, voiceName: string) => {
    try {
      const audio = new Audio(url);
      audioRef.current = audio;
      setPlayingId(voiceId);

      audio.onended = () => setPlayingId(null);
      audio.onerror = () => {
        setPlayingId(null);
        setPreviewError(`Failed to play preview for ${voiceName}`);
      };

      audio.play().catch(() => {
        setPlayingId(null);
        setPreviewError(`Browser blocked audio playback. Click again to retry.`);
      });
    } catch {
      setPreviewError(`Failed to load preview for ${voiceName}`);
    }
  };

  const handlePreview = async (voice: HeyGenVoice) => {
    setPreviewError(null);

    if (playingId === voice.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    // If the voice already has a preview URL, play it directly
    if (voice.previewUrl) {
      playAudioUrl(voice.id, voice.previewUrl, voice.name);
      return;
    }

    const voiceProvider = voice.provider ?? 'heygen';

    // HeyGen voices can't be previewed standalone
    if (voiceProvider === 'heygen') {
      setPreviewError(`HeyGen voices don't support preview. Use ElevenLabs filter for voices with preview support.`);
      return;
    }

    // Generate preview on-demand via API
    setLoadingPreviewId(voice.id);
    try {
      const response = await authFetch('/api/video/voice-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceId: voice.id,
          voiceName: voice.name,
          provider: voiceProvider,
        }),
      });

      const data = await response.json() as { success: boolean; audioUrl?: string; error?: string };
      if (!data.success || !data.audioUrl) {
        setPreviewError(data.error ?? `Failed to generate preview for ${voice.name}`);
        return;
      }

      playAudioUrl(voice.id, data.audioUrl, voice.name);
    } catch {
      setPreviewError(`Failed to generate preview for ${voice.name}`);
    } finally {
      setLoadingPreviewId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-zinc-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading voices...</span>
      </div>
    );
  }

  if (error || voices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <AlertCircle className="w-8 h-8 text-zinc-500" />
        <p className="text-sm text-zinc-400">
          {error ?? 'No voices available. Configure API keys in Settings.'}
        </p>
      </div>
    );
  }

  const handleCloneSubmit = async () => {
    if (!cloneName.trim() || cloneFiles.length === 0) { return; }
    setCloneLoading(true);
    setCloneError(null);
    setCloneSuccess(null);

    try {
      const formData = new FormData();
      formData.append('name', cloneName.trim());
      for (const file of cloneFiles) {
        formData.append('samples', file);
      }

      const response = await authFetch('/api/video/voice-clone', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json() as { success: boolean; voiceId?: string; voiceName?: string; error?: string };
      if (!data.success) {
        setCloneError(data.error ?? 'Voice cloning failed');
        return;
      }

      setCloneSuccess(`Voice "${data.voiceName}" created! It will appear in the ElevenLabs voices list.`);
      setCloneName('');
      setCloneFiles([]);
      setShowCloneUI(false);

      // Refresh voices list to include the new clone
      void fetchVoices();

      // Auto-select the new voice
      if (data.voiceId && data.voiceName) {
        onSelect(data.voiceId, data.voiceName, 'elevenlabs');
      }
    } catch {
      setCloneError('Voice cloning failed. Try again.');
    } finally {
      setCloneLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Clone My Voice Section */}
      <div className="border border-purple-500/20 bg-purple-500/5 rounded-lg overflow-hidden">
        <button
          onClick={() => setShowCloneUI(!showCloneUI)}
          className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-purple-500/10 transition-colors"
        >
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-purple-300">Clone My Voice</span>
          <span className="text-xs text-zinc-500 ml-1">Upload audio samples to create your own voice</span>
        </button>
        {showCloneUI && (
          <div className="px-4 pb-4 space-y-3 border-t border-purple-500/10">
            <p className="text-xs text-zinc-400 pt-3">
              Record yourself speaking clearly for 30+ seconds. MP3, WAV, or M4A accepted. More samples = better quality.
            </p>
            <input
              type="text"
              value={cloneName}
              onChange={(e) => setCloneName(e.target.value)}
              placeholder="Voice name (e.g. David's Voice)"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) {
                    setCloneFiles(Array.from(e.target.files));
                  }
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-1.5 text-xs border-zinc-700 text-zinc-300"
              >
                <Upload className="w-3.5 h-3.5" />
                {cloneFiles.length > 0
                  ? `${cloneFiles.length} file${cloneFiles.length !== 1 ? 's' : ''} selected`
                  : 'Upload Audio Samples'}
              </Button>
              <Button
                size="sm"
                onClick={() => { void handleCloneSubmit(); }}
                disabled={cloneLoading || !cloneName.trim() || cloneFiles.length === 0}
                className="gap-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white"
              >
                {cloneLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Clone Voice
              </Button>
            </div>
            {cloneError && (
              <p className="text-xs text-red-400">{cloneError}</p>
            )}
          </div>
        )}
      </div>

      {cloneSuccess && (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg">
          <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
          <p className="text-xs text-green-400">{cloneSuccess}</p>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search voices by name, language, or accent..."
          className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
        />
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap gap-3">
        {/* Provider filter */}
        {hasMultipleProviders && (
          <div className="flex gap-1.5">
            {PROVIDER_FILTERS.map((provider) => (
              <button
                key={provider}
                onClick={() => setFilterProvider(provider)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  filterProvider === provider
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600',
                )}
              >
                {provider === 'all' ? 'All'
                  : provider === 'custom' ? 'My Clones'
                  : provider === 'elevenlabs' ? 'ElevenLabs'
                  : provider === 'unrealspeech' ? 'UnrealSpeech'
                  : 'HeyGen'}
              </button>
            ))}
          </div>
        )}

        {/* Gender */}
        <div className="flex gap-1.5">
          {GENDER_FILTERS.map((gender) => (
            <button
              key={gender}
              onClick={() => setFilterGender(gender)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                filterGender === gender
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600',
              )}
            >
              {gender.charAt(0).toUpperCase() + gender.slice(1)}
            </button>
          ))}
        </div>

        {/* Language dropdown */}
        {languages.length > 1 && (
          <select
            value={filterLanguage}
            onChange={(e) => setFilterLanguage(e.target.value)}
            className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          >
            <option value="all">All Languages</option>
            {languages.map((lang) => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
        )}
      </div>

      {/* Preview error */}
      {previewError && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/5 border border-amber-500/20 rounded-lg">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          <p className="text-xs text-amber-400">{previewError}</p>
        </div>
      )}

      {/* Results count */}
      <p className="text-xs text-zinc-500">
        {filteredVoices.length} voice{filteredVoices.length !== 1 ? 's' : ''}
        {searchQuery || filterGender !== 'all' || filterLanguage !== 'all' || filterProvider !== 'all' ? ' matching filters' : ' available'}
      </p>

      {/* Voice List */}
      <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1">
        {filteredVoices.map((voice) => {
          const isSelected = selectedVoiceId === voice.id;
          const isPlaying = playingId === voice.id;
          const voiceProvider = voice.provider ?? 'heygen';

          return (
            <div
              key={voice.id}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all',
                isSelected
                  ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/30'
                  : 'border-zinc-700/50 bg-zinc-800/30 hover:border-zinc-500 hover:bg-zinc-800/60',
              )}
              onClick={() => onSelect(voice.id, voice.name, voiceProvider)}
            >
              {/* Icon */}
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                isSelected ? 'bg-amber-500/20' : 'bg-zinc-700/50',
              )}>
                {isPlaying ? (
                  <Volume2 className="w-5 h-5 text-amber-400 animate-pulse" />
                ) : (
                  <Mic className={cn('w-5 h-5', isSelected ? 'text-amber-400' : 'text-zinc-400')} />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white truncate">{voice.name}</p>
                  {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-zinc-500">{voice.language}</span>
                  {voice.accent && (
                    <>
                      <span className="text-zinc-600">·</span>
                      <span className="text-xs text-zinc-500">{voice.accent}</span>
                    </>
                  )}
                  {voice.gender && (
                    <>
                      <span className="text-zinc-600">·</span>
                      <span className="text-xs text-zinc-500 capitalize">{voice.gender}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Preview Button — always shown */}
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); void handlePreview(voice); }}
                disabled={loadingPreviewId === voice.id}
                className={cn(
                  'h-9 w-9 p-0 rounded-full',
                  isPlaying
                    ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-700',
                )}
                title={isPlaying ? 'Stop preview' : 'Play voice sample'}
              >
                {loadingPreviewId === voice.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </Button>

              {/* Provider badge */}
              <span className={cn(
                'px-1.5 py-0.5 text-[9px] font-bold rounded flex-shrink-0',
                voiceProvider === 'custom' ? 'bg-green-500/20 text-green-400'
                  : voiceProvider === 'elevenlabs' ? 'bg-purple-500/20 text-purple-400'
                  : voiceProvider === 'unrealspeech' ? 'bg-orange-500/20 text-orange-400'
                  : 'bg-blue-500/20 text-blue-400',
              )}>
                {voiceProvider === 'custom' ? 'CLONE'
                  : voiceProvider === 'elevenlabs' ? 'XI'
                  : voiceProvider === 'unrealspeech' ? 'US'
                  : 'HG'}
              </span>
            </div>
          );
        })}
      </div>

      {filteredVoices.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <Search className="w-6 h-6 text-zinc-600" />
          <p className="text-sm text-zinc-500">No voices match your search.</p>
        </div>
      )}
    </div>
  );
}
