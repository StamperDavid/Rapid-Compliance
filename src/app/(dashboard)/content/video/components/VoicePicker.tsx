'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { Loader2, AlertCircle, Play, Pause, Mic, Search, Check, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { HeyGenVoice } from '@/types/video';

interface VoicePickerProps {
  selectedVoiceId: string | null;
  onSelect: (voiceId: string, voiceName: string) => void;
}

const GENDER_FILTERS = ['all', 'male', 'female'] as const;

export function VoicePicker({ selectedVoiceId, onSelect }: VoicePickerProps) {
  const authFetch = useAuthFetch();
  const [voices, setVoices] = useState<HeyGenVoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [filterGender, setFilterGender] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLanguage, setFilterLanguage] = useState<string>('all');
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

  const filteredVoices = useMemo(() => {
    let result = voices;

    if (filterGender !== 'all') {
      result = result.filter((v) => v.gender === filterGender);
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
  }, [voices, filterGender, filterLanguage, searchQuery]);

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
          {error ?? 'No voices available. Configure HeyGen API key in Settings.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
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

      {/* Results count */}
      <p className="text-xs text-zinc-500">
        {filteredVoices.length} voice{filteredVoices.length !== 1 ? 's' : ''}
        {searchQuery || filterGender !== 'all' || filterLanguage !== 'all' ? ' matching filters' : ' available'}
      </p>

      {/* Voice List */}
      <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1">
        {filteredVoices.map((voice) => {
          const isSelected = selectedVoiceId === voice.id;
          const isPlaying = playingId === voice.id;

          return (
            <div
              key={voice.id}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all',
                isSelected
                  ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/30'
                  : 'border-zinc-700/50 bg-zinc-800/30 hover:border-zinc-500 hover:bg-zinc-800/60',
              )}
              onClick={() => onSelect(voice.id, voice.name)}
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

              {/* Preview Button */}
              {voice.previewUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); handlePreview(voice); }}
                  className={cn(
                    'h-9 w-9 p-0 rounded-full',
                    isPlaying
                      ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-700',
                  )}
                  title={isPlaying ? 'Stop preview' : 'Play voice sample'}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
              )}

              {/* Premium badge */}
              {voice.isPremium && (
                <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[9px] font-bold rounded flex-shrink-0">
                  PRO
                </span>
              )}
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
