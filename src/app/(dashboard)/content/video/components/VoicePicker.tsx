'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { Loader2, AlertCircle, Play, Pause, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { HeyGenVoice } from '@/types/video';

interface VoicePickerProps {
  selectedVoiceId: string | null;
  onSelect: (voiceId: string, voiceName: string) => void;
}

export function VoicePicker({ selectedVoiceId, onSelect }: VoicePickerProps) {
  const authFetch = useAuthFetch();
  const [voices, setVoices] = useState<HeyGenVoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [filterGender, setFilterGender] = useState<string>('all');
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  const handlePreview = (voice: HeyGenVoice) => {
    if (playingId === voice.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }

    if (!voice.previewUrl) {
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(voice.previewUrl);
    audioRef.current = audio;
    void audio.play();
    setPlayingId(voice.id);
    audio.onended = () => setPlayingId(null);
  };

  const filteredVoices = filterGender === 'all'
    ? voices
    : voices.filter((v) => v.gender === filterGender);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 gap-2 text-zinc-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading voices...</span>
      </div>
    );
  }

  if (error || voices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2">
        <AlertCircle className="w-6 h-6 text-zinc-500" />
        <p className="text-sm text-zinc-400">
          {error ?? 'No voices available. Configure HeyGen API key in Settings.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Gender Filter */}
      <div className="flex gap-2">
        {['all', 'male', 'female'].map((gender) => (
          <button
            key={gender}
            onClick={() => setFilterGender(gender)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium transition-colors',
              filterGender === gender
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600',
            )}
          >
            {gender.charAt(0).toUpperCase() + gender.slice(1)}
          </button>
        ))}
      </div>

      {/* Voice List */}
      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
        {filteredVoices.map((voice) => (
          <div
            key={voice.id}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors',
              selectedVoiceId === voice.id
                ? 'border-amber-500 bg-amber-500/10'
                : 'border-zinc-700/50 bg-zinc-800/30 hover:border-zinc-600',
            )}
            onClick={() => onSelect(voice.id, voice.name)}
          >
            <Mic className="w-4 h-4 text-zinc-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{voice.name}</p>
              <p className="text-xs text-zinc-500">{voice.language}{voice.accent ? ` · ${voice.accent}` : ''}{voice.gender ? ` · ${voice.gender}` : ''}</p>
            </div>
            {voice.previewUrl && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); handlePreview(voice); }}
                className="h-7 w-7 p-0 text-zinc-400 hover:text-white"
              >
                {playingId === voice.id ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </Button>
            )}
            {voice.isPremium && (
              <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[9px] font-medium rounded flex-shrink-0">
                PRO
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
