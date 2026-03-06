'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import {
  Music, Play, Pause, Download, Loader2, AlertCircle,
  Sparkles, Mic, Volume2, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────────────────────

interface GeneratedTrack {
  id: string;
  title: string;
  audioUrl: string;
  duration: number;
  style: string;
  createdAt: Date;
}

const STYLES = [
  { id: 'corporate', label: 'Corporate', emoji: '🏢', desc: 'Professional, clean, motivational' },
  { id: 'upbeat', label: 'Upbeat', emoji: '🎉', desc: 'Energetic, positive, driving' },
  { id: 'dramatic', label: 'Dramatic', emoji: '🎬', desc: 'Cinematic, epic, powerful' },
  { id: 'chill', label: 'Chill', emoji: '🌊', desc: 'Relaxed, ambient, smooth' },
  { id: 'electronic', label: 'Electronic', emoji: '⚡', desc: 'Synth, modern, techy' },
  { id: 'acoustic', label: 'Acoustic', emoji: '🎸', desc: 'Guitar, warm, organic' },
  { id: 'hiphop', label: 'Hip Hop', emoji: '🎤', desc: 'Beat-driven, rhythmic' },
  { id: 'pop', label: 'Pop', emoji: '🎵', desc: 'Catchy, mainstream, bright' },
] as const;

const DURATIONS = [
  { value: 15, label: '15s' },
  { value: 30, label: '30s' },
  { value: 60, label: '1 min' },
  { value: 120, label: '2 min' },
] as const;

// ─── Component ──────────────────────────────────────────────────────────────

export function AIMusicStudio() {
  const authFetch = useAuthFetch();

  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('corporate');
  const [durationSec, setDurationSec] = useState(30);
  const [instrumental, setInstrumental] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tracks, setTracks] = useState<GeneratedTrack[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Check if Suno API key is configured
  useEffect(() => {
    const checkKey = async () => {
      try {
        const res = await authFetch('/api/audio/music/status');
        if (res.ok) {
          const data = await res.json() as { configured: boolean };
          setHasApiKey(data.configured);
        } else {
          setHasApiKey(false);
        }
      } catch {
        setHasApiKey(false);
      }
    };
    void checkKey();
  }, [authFetch]);

  // Load previously generated tracks
  const loadTracks = useCallback(async () => {
    try {
      const res = await authFetch('/api/audio/music/tracks');
      if (res.ok) {
        const data = await res.json() as { success: boolean; tracks: GeneratedTrack[] };
        setTracks(data.tracks ?? []);
      }
    } catch {
      // Silent — tracks are supplementary
    }
  }, [authFetch]);

  useEffect(() => {
    void loadTracks();
  }, [loadTracks]);

  const handleGenerate = async () => {
    if (!prompt.trim()) { return; }
    setIsGenerating(true);
    setError(null);

    try {
      const res = await authFetch('/api/audio/music/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          style,
          duration: durationSec,
          instrumental,
        }),
      });

      const data = await res.json() as {
        success: boolean;
        track?: GeneratedTrack;
        error?: string;
      };

      if (!data.success) {
        setError(data.error ?? 'Generation failed');
        return;
      }

      if (data.track) {
        const newTrack = data.track;
        setTracks((prev) => [newTrack, ...prev]);
      }
    } catch {
      setError('Failed to generate music. Check your API key configuration.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePlay = (track: GeneratedTrack) => {
    if (playingId === track.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }

    if (audioRef.current) { audioRef.current.pause(); }
    const audio = new Audio(track.audioUrl);
    audioRef.current = audio;
    setPlayingId(track.id);
    audio.onended = () => setPlayingId(null);
    audio.play().catch(() => setPlayingId(null));
  };

  return (
    <div className="space-y-6">
      {/* Generator Card */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 overflow-hidden">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Music className="w-5 h-5 text-pink-400" />
            <h2 className="text-lg font-semibold text-white">AI Music Generator</h2>
          </div>

          {hasApiKey === false && (
            <div className="mb-6 flex items-start gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-amber-300">AI Music API not configured</p>
                <p className="text-xs text-zinc-400 mt-1">
                  Add a Suno API key in <span className="text-amber-400">Settings &rarr; API Keys</span> to enable
                  AI music generation. Suno creates professional-quality songs, jingles, and background music from
                  text descriptions.
                </p>
              </div>
            </div>
          )}

          {/* Prompt */}
          <div className="mb-4">
            <label className="block text-xs text-zinc-400 mb-1.5">Describe your music</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Upbeat corporate jingle for a SaaS marketing video, 120 BPM, inspiring and modern with light synths and a confident feel"
              rows={3}
              className="w-full px-4 py-3 bg-zinc-800/80 border border-zinc-700 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 resize-none"
            />
          </div>

          {/* Style Grid */}
          <div className="mb-4">
            <label className="block text-xs text-zinc-400 mb-1.5">Style</label>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  className={cn(
                    'flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg text-xs transition-all border',
                    style === s.id
                      ? 'bg-pink-500/15 border-pink-500/40 text-pink-300'
                      : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:border-zinc-600',
                  )}
                  title={s.desc}
                >
                  <span className="text-lg">{s.emoji}</span>
                  <span className="font-medium">{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Duration & Options */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Duration</label>
              <div className="flex gap-1">
                {DURATIONS.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => setDurationSec(d.value)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                      durationSec === d.value
                        ? 'bg-pink-500/15 border-pink-500/40 text-pink-300'
                        : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:border-zinc-600',
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Type</label>
              <div className="flex gap-1">
                <button
                  onClick={() => setInstrumental(true)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                    instrumental
                      ? 'bg-pink-500/15 border-pink-500/40 text-pink-300'
                      : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:border-zinc-600',
                  )}
                >
                  <Music className="w-3 h-3" />
                  Instrumental
                </button>
                <button
                  onClick={() => setInstrumental(false)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                    !instrumental
                      ? 'bg-pink-500/15 border-pink-500/40 text-pink-300'
                      : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:border-zinc-600',
                  )}
                >
                  <Mic className="w-3 h-3" />
                  With Vocals
                </button>
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <Button
            size="lg"
            onClick={() => { void handleGenerate(); }}
            disabled={isGenerating || !prompt.trim() || hasApiKey === false}
            className="gap-2 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white w-full h-12 text-sm rounded-xl shadow-lg shadow-pink-500/20"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {isGenerating ? 'Generating...' : 'Generate Music'}
          </Button>

          {error && (
            <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Generated Tracks */}
      {tracks.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-zinc-300">Generated Tracks</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { void loadTracks(); }}
              className="h-7 px-2 text-xs gap-1 text-zinc-500"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </Button>
          </div>

          {tracks.map((track) => {
            const isPlaying = playingId === track.id;
            return (
              <div
                key={track.id}
                className="flex items-center gap-4 px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 transition-colors"
              >
                <button
                  onClick={() => handlePlay(track)}
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors',
                    isPlaying
                      ? 'bg-pink-500/20 text-pink-400'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white',
                  )}
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4 ml-0.5" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{track.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-zinc-500">{track.style}</span>
                    <span className="text-zinc-700">·</span>
                    <span className="text-[10px] text-zinc-500">{Math.round(track.duration)}s</span>
                  </div>
                </div>

                {isPlaying && (
                  <Volume2 className="w-4 h-4 text-pink-400 animate-pulse flex-shrink-0" />
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs gap-1 text-zinc-500 hover:text-white"
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = track.audioUrl;
                    a.download = `${track.title}.mp3`;
                    a.click();
                  }}
                >
                  <Download className="w-3 h-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {tracks.length === 0 && !isGenerating && (
        <div className="flex flex-col items-center py-12 gap-3">
          <Music className="w-12 h-12 text-zinc-800" />
          <p className="text-sm text-zinc-600">No tracks generated yet</p>
          <p className="text-xs text-zinc-700 max-w-sm text-center">
            Describe the kind of music you want — a jingle for your video, background music for a presentation,
            or a full song with AI vocals.
          </p>
        </div>
      )}
    </div>
  );
}
