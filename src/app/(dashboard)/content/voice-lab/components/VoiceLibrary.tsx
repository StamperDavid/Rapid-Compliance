'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import {
  Mic, Play, Pause, Loader2, AudioWaveform,
  Volume2, Video, PhoneCall, AlertCircle, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { HeyGenVoice } from '@/types/video';

interface VoiceItem {
  id: string;
  name: string;
  provider: 'elevenlabs' | 'heygen';
  language?: string;
  gender?: string;
  previewUrl?: string;
  isCustom?: boolean;
}

export function VoiceLibrary() {
  const authFetch = useAuthFetch();
  const [voices, setVoices] = useState<VoiceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingPreviewId, setLoadingPreviewId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'custom' | 'elevenlabs' | 'heygen'>('all');
  const [settingDefault, setSettingDefault] = useState<string | null>(null);
  const [defaultVoiceId, setDefaultVoiceId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fetchVoices = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await authFetch('/api/video/voices');
      if (!res.ok) { throw new Error('Failed to fetch voices'); }
      const data = await res.json() as { success: boolean; voices: HeyGenVoice[] };
      const items: VoiceItem[] = (data.voices ?? []).map((v) => ({
        id: v.id,
        name: v.name,
        provider: v.provider ?? 'heygen',
        language: v.language,
        gender: v.gender,
        previewUrl: v.previewUrl,
        isCustom: v.name.includes('Clone') || v.name.includes('clone'),
      }));
      setVoices(items);

      // Fetch defaults
      const defRes = await authFetch('/api/video/defaults');
      if (defRes.ok) {
        const defData = await defRes.json() as { success: boolean; defaults?: { voiceId?: string } };
        setDefaultVoiceId(defData.defaults?.voiceId ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load voices');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void fetchVoices();
  }, [fetchVoices]);

  const filteredVoices = voices.filter((v) => {
    if (filter === 'all') { return true; }
    if (filter === 'custom') { return v.isCustom; }
    return v.provider === filter;
  });

  const handlePlay = async (voice: VoiceItem) => {
    if (playingId === voice.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current) { audioRef.current.pause(); }

    if (voice.previewUrl) {
      playUrl(voice.id, voice.previewUrl);
      return;
    }

    if (voice.provider === 'heygen') { return; }

    setLoadingPreviewId(voice.id);
    try {
      const res = await authFetch('/api/video/voice-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceId: voice.id, voiceName: voice.name, provider: voice.provider }),
      });
      const data = await res.json() as { success: boolean; audioUrl?: string };
      if (data.audioUrl) { playUrl(voice.id, data.audioUrl); }
    } catch { /* silent */ } finally {
      setLoadingPreviewId(null);
    }
  };

  const playUrl = (id: string, url: string) => {
    const audio = new Audio(url);
    audioRef.current = audio;
    setPlayingId(id);
    audio.onended = () => setPlayingId(null);
    audio.play().catch(() => setPlayingId(null));
  };

  const handleSetDefault = async (voice: VoiceItem) => {
    setSettingDefault(voice.id);
    try {
      await authFetch('/api/video/defaults', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceId: voice.id, voiceName: voice.name, voiceProvider: voice.provider }),
      });
      setDefaultVoiceId(voice.id);
    } catch { /* silent */ } finally {
      setSettingDefault(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 gap-2 text-zinc-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading voice library...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-sm text-red-400">{error}</p>
        <Button variant="outline" size="sm" onClick={() => { void fetchVoices(); }} className="gap-2">
          <RefreshCw className="w-3 h-3" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Voice Library</h2>
          <p className="text-xs text-zinc-500">{voices.length} voices available across all providers</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { void fetchVoices(); }}
          className="gap-1.5 border-zinc-700 text-zinc-400"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5">
        {(['all', 'custom', 'elevenlabs', 'heygen'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
              filter === f
                ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                : 'bg-zinc-800/50 text-zinc-400 border-zinc-700/50 hover:border-zinc-600',
            )}
          >
            {f === 'all' ? `All (${voices.length})` :
             f === 'custom' ? `Custom (${voices.filter((v) => v.isCustom).length})` :
             f === 'elevenlabs' ? `ElevenLabs (${voices.filter((v) => v.provider === 'elevenlabs').length})` :
             `HeyGen (${voices.filter((v) => v.provider === 'heygen').length})`}
          </button>
        ))}
      </div>

      {/* Voice Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filteredVoices.slice(0, 50).map((voice) => {
          const isPlaying = playingId === voice.id;
          const isDefault = defaultVoiceId === voice.id;

          return (
            <div
              key={voice.id}
              className={cn(
                'relative rounded-xl border p-4 transition-all',
                isDefault
                  ? 'border-purple-500/50 bg-purple-500/5'
                  : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700',
              )}
            >
              {isDefault && (
                <span className="absolute top-2 right-2 px-1.5 py-0.5 text-[9px] font-bold bg-purple-500/20 text-purple-400 rounded">
                  DEFAULT
                </span>
              )}

              <div className="flex items-start gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                  isPlaying ? 'bg-purple-500/20' : 'bg-zinc-800',
                )}>
                  {isPlaying ? (
                    <Volume2 className="w-5 h-5 text-purple-400 animate-pulse" />
                  ) : (
                    <Mic className="w-5 h-5 text-zinc-500" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{voice.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {voice.language && <span className="text-[10px] text-zinc-500">{voice.language}</span>}
                    {voice.gender && (
                      <>
                        <span className="text-zinc-700">·</span>
                        <span className="text-[10px] text-zinc-500 capitalize">{voice.gender}</span>
                      </>
                    )}
                    <span className={cn(
                      'px-1 py-0.5 text-[8px] font-bold rounded',
                      voice.provider === 'elevenlabs'
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'bg-blue-500/20 text-blue-400',
                    )}>
                      {voice.provider === 'elevenlabs' ? 'XI' : 'HG'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 mt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { void handlePlay(voice); }}
                  disabled={loadingPreviewId === voice.id}
                  className="h-7 px-2 text-xs gap-1"
                >
                  {loadingPreviewId === voice.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="w-3 h-3" />
                  ) : (
                    <Play className="w-3 h-3" />
                  )}
                  {isPlaying ? 'Stop' : 'Preview'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { void handleSetDefault(voice); }}
                  disabled={settingDefault === voice.id || isDefault}
                  className="h-7 px-2 text-xs gap-1"
                  title="Set as default voice for videos"
                >
                  {settingDefault === voice.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Video className="w-3 h-3" />
                  )}
                  Video
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1"
                  title="Use as voice agent voice"
                >
                  <PhoneCall className="w-3 h-3" />
                  Agent
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredVoices.length > 50 && (
        <p className="text-xs text-zinc-500 text-center">
          Showing 50 of {filteredVoices.length} voices. Use filters to narrow results.
        </p>
      )}

      {filteredVoices.length === 0 && (
        <div className="flex flex-col items-center py-16 gap-3">
          <AudioWaveform className="w-10 h-10 text-zinc-700" />
          <p className="text-sm text-zinc-500">No voices match this filter.</p>
        </div>
      )}
    </div>
  );
}
