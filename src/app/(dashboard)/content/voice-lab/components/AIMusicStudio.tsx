'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import {
  Music, Play, Pause, Download, Loader2, AlertCircle,
  Sparkles, Mic, Volume2, RefreshCw, Search, Star, Trash2,
  ChevronRight, Clock, X, Video, SkipBack, SkipForward,
  ChevronDown, Heart, Repeat, Scissors,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────────────────────

type MoodValue = 'happy' | 'energetic' | 'calm' | 'dramatic' | 'mysterious' | 'romantic' | 'dark' | 'inspiring';
type TempoValue = 'slow' | 'medium' | 'fast' | 'very-fast';
type VoiceStyle = 'male' | 'female' | 'choir' | 'robotic';
type LibraryTab = 'all' | 'favorites' | 'custom';
type SortOption = 'newest' | 'oldest' | 'duration';

interface GeneratedTrack {
  id: string;
  title: string;
  audioUrl: string;
  duration: number;
  style: string;
  mood: MoodValue[];
  tempo: TempoValue;
  hasVocals: boolean;
  voiceStyle: string | null;
  lyrics: string | null;
  prompt: string;
  isFavorite: boolean;
  isPreview: boolean;
  parentPreviewId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const GENRES = [
  { id: 'corporate', label: 'Corporate', icon: '🏢', desc: 'Professional, clean, motivational' },
  { id: 'upbeat-pop', label: 'Upbeat Pop', icon: '🎉', desc: 'Energetic, positive, catchy hooks' },
  { id: 'cinematic', label: 'Cinematic/Epic', icon: '🎬', desc: 'Sweeping, powerful, orchestral' },
  { id: 'chill-lofi', label: 'Chill/Lo-fi', icon: '🌊', desc: 'Relaxed, warm, vinyl crackle' },
  { id: 'electronic', label: 'Electronic/EDM', icon: '⚡', desc: 'Synth-heavy, driving, modern' },
  { id: 'acoustic', label: 'Acoustic', icon: '🎸', desc: 'Guitar, warm, organic, intimate' },
  { id: 'hiphop', label: 'Hip Hop', icon: '🎤', desc: 'Beat-driven, rhythmic, punchy' },
  { id: 'rnb-soul', label: 'R&B/Soul', icon: '💜', desc: 'Smooth, groovy, soulful vocals' },
  { id: 'jazz', label: 'Jazz', icon: '🎷', desc: 'Swinging, sophisticated, improvisational' },
  { id: 'rock', label: 'Rock', icon: '🤘', desc: 'Guitar-driven, energetic, powerful' },
  { id: 'ambient', label: 'Ambient', icon: '🌌', desc: 'Atmospheric, ethereal, spacious' },
  { id: 'latin', label: 'Latin', icon: '💃', desc: 'Rhythmic, passionate, percussion-heavy' },
  { id: 'country', label: 'Country', icon: '🤠', desc: 'Storytelling, steel guitar, heartfelt' },
  { id: 'classical', label: 'Classical', icon: '🎻', desc: 'Orchestral, timeless, elegant' },
  { id: 'reggae', label: 'Reggae', icon: '🌴', desc: 'Laid-back, offbeat rhythm, island vibes' },
] as const;

const MOODS: { value: MoodValue; label: string; color: string }[] = [
  { value: 'happy', label: 'Happy', color: 'bg-yellow-500/15 border-yellow-500/40 text-yellow-300' },
  { value: 'energetic', label: 'Energetic', color: 'bg-orange-500/15 border-orange-500/40 text-orange-300' },
  { value: 'calm', label: 'Calm', color: 'bg-blue-500/15 border-blue-500/40 text-blue-300' },
  { value: 'dramatic', label: 'Dramatic', color: 'bg-red-500/15 border-red-500/40 text-red-300' },
  { value: 'mysterious', label: 'Mysterious', color: 'bg-purple-500/15 border-purple-500/40 text-purple-300' },
  { value: 'romantic', label: 'Romantic', color: 'bg-pink-500/15 border-pink-500/40 text-pink-300' },
  { value: 'dark', label: 'Dark', color: 'bg-zinc-500/15 border-zinc-500/40 text-zinc-300' },
  { value: 'inspiring', label: 'Inspiring', color: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' },
];

const TEMPOS: { value: TempoValue; label: string; bpm: string }[] = [
  { value: 'slow', label: 'Slow', bpm: '60-80 BPM' },
  { value: 'medium', label: 'Medium', bpm: '80-120 BPM' },
  { value: 'fast', label: 'Fast', bpm: '120-160 BPM' },
  { value: 'very-fast', label: 'Very Fast', bpm: '160+ BPM' },
];

const VOICE_STYLES: { value: VoiceStyle; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'choir', label: 'Choir' },
  { value: 'robotic', label: 'Robotic' },
];

const DURATIONS = [
  { value: 15, label: '15s' },
  { value: 30, label: '30s' },
  { value: 60, label: '1 min' },
  { value: 120, label: '2 min' },
  { value: 180, label: '3 min' },
] as const;

// ─── Waveform Canvas ────────────────────────────────────────────────────────

function WaveformCanvas({
  width,
  height,
  progress,
  barCount,
  color,
  bgColor,
  seed,
  onClick,
}: {
  width: number;
  height: number;
  progress: number;
  barCount: number;
  color: string;
  bgColor: string;
  seed: string;
  onClick?: (fraction: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barsRef = useRef<number[]>([]);

  // Generate deterministic waveform bars from seed
  useEffect(() => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    const bars: number[] = [];
    for (let i = 0; i < barCount; i++) {
      hash = ((hash << 5) - hash) + i;
      hash = hash & hash;
      const normalized = Math.abs(hash % 100) / 100;
      // Create a more musical-looking waveform with peaks
      const wave = 0.3 + normalized * 0.7;
      bars.push(wave);
    }
    barsRef.current = bars;
  }, [seed, barCount]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) { return; }
    const ctx = canvas.getContext('2d');
    if (!ctx) { return; }

    ctx.clearRect(0, 0, width, height);

    const bars = barsRef.current;
    if (bars.length === 0) { return; }

    const barWidth = Math.max(2, (width / bars.length) - 1);
    const gap = 1;
    const progressIndex = Math.floor(progress * bars.length);

    bars.forEach((barHeight, i) => {
      const x = i * (barWidth + gap);
      const h = barHeight * height * 0.9;
      const y = (height - h) / 2;

      ctx.fillStyle = i <= progressIndex ? color : bgColor;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, h, 1);
      ctx.fill();
    });
  }, [width, height, progress, barCount, color, bgColor]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onClick) { return; }
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const fraction = Math.max(0, Math.min(1, x / rect.width));
    onClick(fraction);
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={cn('block', onClick ? 'cursor-pointer' : '')}
      onClick={handleClick}
      style={{ width, height }}
    />
  );
}

// ─── Mini Waveform for Track Cards ─────────────────────────────────────────

function MiniWaveform({ trackId, progress }: { trackId: string; progress: number }) {
  return (
    <WaveformCanvas
      width={120}
      height={32}
      progress={progress}
      barCount={40}
      color="#ec4899"
      bgColor="#3f3f46"
      seed={trackId}
    />
  );
}

// ─── Full Waveform for Detail View ─────────────────────────────────────────

function FullWaveform({
  trackId,
  progress,
  onSeek,
}: {
  trackId: string;
  progress: number;
  onSeek: (fraction: number) => void;
}) {
  return (
    <WaveformCanvas
      width={600}
      height={64}
      progress={progress}
      barCount={100}
      color="#ec4899"
      bgColor="#27272a"
      seed={trackId}
      onClick={onSeek}
    />
  );
}

// ─── Musical Note Loading Animation ─────────────────────────────────────────

function MusicLoadingAnimation() {
  return (
    <div className="flex items-center justify-center gap-1 py-8">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="w-1 bg-gradient-to-t from-pink-500 to-purple-500 rounded-full"
          style={{
            animation: `musicBar 0.8s ease-in-out infinite alternate`,
            animationDelay: `${i * 0.15}s`,
            height: '20px',
          }}
        />
      ))}
      <style>{`
        @keyframes musicBar {
          0% { height: 8px; opacity: 0.4; }
          100% { height: 32px; opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ─── Format Helpers ─────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `0:${secs.toString().padStart(2, '0')}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) { return ''; }
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Step Indicator ─────────────────────────────────────────────────────────

type CreationStep = 'genre' | 'describe' | 'preview' | 'generate';

function StepIndicator({ current }: { current: CreationStep }) {
  const steps: { key: CreationStep; label: string; num: number }[] = [
    { key: 'genre', label: 'Style', num: 1 },
    { key: 'describe', label: 'Describe', num: 2 },
    { key: 'preview', label: 'Preview', num: 3 },
    { key: 'generate', label: 'Generate', num: 4 },
  ];

  const currentIdx = steps.findIndex((s) => s.key === current);

  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((step, i) => {
        const isActive = step.key === current;
        const isComplete = i < currentIdx;
        return (
          <div key={step.key} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={cn(
                  'w-8 h-px',
                  isComplete ? 'bg-pink-500' : 'bg-zinc-700',
                )}
              />
            )}
            <div className="flex items-center gap-1.5">
              <div
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                  isActive
                    ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/30'
                    : isComplete
                      ? 'bg-pink-500/30 text-pink-300'
                      : 'bg-zinc-800 text-zinc-500',
                )}
              >
                {step.num}
              </div>
              <span
                className={cn(
                  'text-xs font-medium hidden sm:inline',
                  isActive ? 'text-white' : isComplete ? 'text-pink-400' : 'text-zinc-600',
                )}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Genre Browser ──────────────────────────────────────────────────────────

function GenreBrowser({
  selectedGenre,
  onSelect,
  customStyle,
  onCustomStyleChange,
}: {
  selectedGenre: string;
  onSelect: (genre: string) => void;
  customStyle: string;
  onCustomStyleChange: (val: string) => void;
}) {
  const [showCustom, setShowCustom] = useState(false);

  return (
    <div>
      <h3 className="text-sm font-semibold text-zinc-300 mb-3">Choose a Style</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {GENRES.map((genre) => {
          const isSelected = selectedGenre === genre.id;
          return (
            <button
              key={genre.id}
              onClick={() => {
                onSelect(genre.id);
                setShowCustom(false);
                onCustomStyleChange('');
              }}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left group',
                isSelected
                  ? 'bg-pink-500/10 border-pink-500/50 shadow-lg shadow-pink-500/5'
                  : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/50',
              )}
            >
              <span className="text-2xl flex-shrink-0">{genre.icon}</span>
              <div className="min-w-0">
                <p
                  className={cn(
                    'text-sm font-medium truncate',
                    isSelected ? 'text-pink-300' : 'text-zinc-200 group-hover:text-white',
                  )}
                >
                  {genre.label}
                </p>
                <p className="text-xs text-zinc-500 truncate">{genre.desc}</p>
              </div>
            </button>
          );
        })}

        {/* Custom Style Card */}
        <button
          onClick={() => {
            setShowCustom(true);
            onSelect('custom');
          }}
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left group',
            showCustom || selectedGenre === 'custom'
              ? 'bg-purple-500/10 border-purple-500/50 shadow-lg shadow-purple-500/5'
              : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/50',
          )}
        >
          <span className="text-2xl flex-shrink-0">🎨</span>
          <div className="min-w-0">
            <p
              className={cn(
                'text-sm font-medium',
                showCustom || selectedGenre === 'custom' ? 'text-purple-300' : 'text-zinc-200 group-hover:text-white',
              )}
            >
              Custom Style
            </p>
            <p className="text-xs text-zinc-500">Type your own style tags</p>
          </div>
        </button>
      </div>

      {/* Custom style input */}
      {(showCustom || selectedGenre === 'custom') && (
        <div className="mt-3">
          <input
            type="text"
            value={customStyle}
            onChange={(e) => onCustomStyleChange(e.target.value)}
            placeholder="e.g., tropical house, synthwave, dreampop, future bass"
            className="w-full px-4 py-2.5 bg-zinc-800/80 border border-purple-500/30 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            autoFocus
          />
        </div>
      )}
    </div>
  );
}

// ─── Song Description Panel ─────────────────────────────────────────────────

function SongDescriptionPanel({
  prompt,
  onPromptChange,
  selectedMoods,
  onMoodToggle,
  tempo,
  onTempoChange,
  instrumental,
  onInstrumentalChange,
  voiceStyle,
  onVoiceStyleChange,
  lyrics,
  onLyricsChange,
}: {
  prompt: string;
  onPromptChange: (val: string) => void;
  selectedMoods: MoodValue[];
  onMoodToggle: (mood: MoodValue) => void;
  tempo: TempoValue;
  onTempoChange: (val: TempoValue) => void;
  instrumental: boolean;
  onInstrumentalChange: (val: boolean) => void;
  voiceStyle: VoiceStyle;
  onVoiceStyleChange: (val: VoiceStyle) => void;
  lyrics: string;
  onLyricsChange: (val: string) => void;
}) {
  return (
    <div className="space-y-5">
      {/* Purpose / Description */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1.5">
          Message / Purpose
        </label>
        <textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder="Describe the message or purpose of this track... e.g., 'Energetic opener for a SaaS product launch video with confident, modern feel'"
          rows={3}
          className="w-full px-4 py-3 bg-zinc-800/80 border border-zinc-700 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 resize-none"
        />
      </div>

      {/* Mood Selector */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1.5">
          Mood <span className="text-zinc-500 font-normal">(select up to 3)</span>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {MOODS.map((mood) => {
            const isSelected = selectedMoods.includes(mood.value);
            const isDisabled = !isSelected && selectedMoods.length >= 3;
            return (
              <button
                key={mood.value}
                onClick={() => { if (!isDisabled) { onMoodToggle(mood.value); } }}
                disabled={isDisabled}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                  isSelected
                    ? mood.color
                    : isDisabled
                      ? 'bg-zinc-900 border-zinc-800 text-zinc-700 cursor-not-allowed'
                      : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:border-zinc-500',
                )}
              >
                {mood.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tempo Selector */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1.5">Tempo</label>
        <div className="flex gap-1.5">
          {TEMPOS.map((t) => (
            <button
              key={t.value}
              onClick={() => onTempoChange(t.value)}
              className={cn(
                'flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-all text-center',
                tempo === t.value
                  ? 'bg-pink-500/15 border-pink-500/40 text-pink-300'
                  : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:border-zinc-500',
              )}
            >
              <div>{t.label}</div>
              <div className="text-[10px] opacity-60 mt-0.5">{t.bpm}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Vocals Toggle */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1.5">Vocals</label>
        <div className="flex gap-2">
          <button
            onClick={() => onInstrumentalChange(true)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all flex-1',
              instrumental
                ? 'bg-pink-500/15 border-pink-500/40 text-pink-300'
                : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:border-zinc-500',
            )}
          >
            <Music className="w-4 h-4" />
            Instrumental Only
          </button>
          <button
            onClick={() => onInstrumentalChange(false)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all flex-1',
              !instrumental
                ? 'bg-pink-500/15 border-pink-500/40 text-pink-300'
                : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:border-zinc-500',
            )}
          >
            <Mic className="w-4 h-4" />
            With Vocals
          </button>
        </div>
      </div>

      {/* Vocal Options (shown when vocals enabled) */}
      {!instrumental && (
        <div className="space-y-4 pl-4 border-l-2 border-pink-500/20">
          {/* Voice Style */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Voice Style</label>
            <div className="flex gap-1.5">
              {VOICE_STYLES.map((vs) => (
                <button
                  key={vs.value}
                  onClick={() => onVoiceStyleChange(vs.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                    voiceStyle === vs.value
                      ? 'bg-pink-500/15 border-pink-500/40 text-pink-300'
                      : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:border-zinc-500',
                  )}
                >
                  {vs.label}
                </button>
              ))}
            </div>
          </div>

          {/* Lyrics */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Lyrics <span className="text-zinc-600">(optional — AI generates if empty)</span>
            </label>
            <textarea
              value={lyrics}
              onChange={(e) => onLyricsChange(e.target.value)}
              placeholder="Write your lyrics here, or leave empty for AI-generated lyrics..."
              rows={4}
              className="w-full px-4 py-3 bg-zinc-800/80 border border-zinc-700 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 resize-none font-mono"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Track Detail View ──────────────────────────────────────────────────────

function TrackDetailView({
  track,
  isPlaying,
  progress,
  volume,
  onPlay,
  onPause,
  onSeek,
  onVolumeChange,
  onClose,
  onFavorite,
  onDelete,
  onRegenerateSimilar,
}: {
  track: GeneratedTrack;
  isPlaying: boolean;
  progress: number;
  volume: number;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (fraction: number) => void;
  onVolumeChange: (vol: number) => void;
  onClose: () => void;
  onFavorite: () => void;
  onDelete: () => void;
  onRegenerateSimilar: () => void;
}) {
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(track.duration);
  const [fadeIn, setFadeIn] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [loopEnabled, setLoopEnabled] = useState(false);

  return (
    <div className="rounded-2xl border border-zinc-700 bg-zinc-900/95 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
            <Music className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">{track.title}</h3>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{track.style}</span>
              {track.mood.length > 0 && track.mood.map((m) => (
                <span key={m} className="px-1.5 py-0.5 rounded bg-zinc-800/50 text-zinc-500">{m}</span>
              ))}
              <span>{formatDuration(track.duration)}</span>
            </div>
          </div>
        </div>
        <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white transition-colors rounded-lg hover:bg-zinc-800">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Large Waveform */}
      <div className="px-6 py-6">
        <div className="flex justify-center">
          <FullWaveform trackId={track.id} progress={progress} onSeek={onSeek} />
        </div>

        {/* Time display */}
        <div className="flex items-center justify-between mt-2 text-xs text-zinc-500">
          <span>{formatDuration(progress * track.duration)}</span>
          <span>{formatDuration(track.duration)}</span>
        </div>
      </div>

      {/* Playback Controls */}
      <div className="flex items-center justify-center gap-4 pb-4">
        <button className="p-2 text-zinc-500 hover:text-white transition-colors" onClick={() => onSeek(0)}>
          <SkipBack className="w-5 h-5" />
        </button>
        <button
          onClick={isPlaying ? onPause : onPlay}
          className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center hover:shadow-lg hover:shadow-pink-500/30 transition-all"
        >
          {isPlaying ? (
            <Pause className="w-6 h-6 text-white" />
          ) : (
            <Play className="w-6 h-6 text-white ml-0.5" />
          )}
        </button>
        <button className="p-2 text-zinc-500 hover:text-white transition-colors" onClick={() => onSeek(1)}>
          <SkipForward className="w-5 h-5" />
        </button>
      </div>

      {/* Volume Control */}
      <div className="flex items-center justify-center gap-2 pb-4">
        <Volume2 className="w-4 h-4 text-zinc-500" />
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          className="w-32 accent-pink-500"
        />
      </div>

      {/* Metadata */}
      <div className="px-6 pb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="px-3 py-2 bg-zinc-800/50 rounded-lg">
            <p className="text-[10px] uppercase text-zinc-600 tracking-wider">Genre</p>
            <p className="text-sm text-zinc-200 mt-0.5">{track.style}</p>
          </div>
          <div className="px-3 py-2 bg-zinc-800/50 rounded-lg">
            <p className="text-[10px] uppercase text-zinc-600 tracking-wider">Tempo</p>
            <p className="text-sm text-zinc-200 mt-0.5 capitalize">{track.tempo}</p>
          </div>
          <div className="px-3 py-2 bg-zinc-800/50 rounded-lg">
            <p className="text-[10px] uppercase text-zinc-600 tracking-wider">Duration</p>
            <p className="text-sm text-zinc-200 mt-0.5">{formatDuration(track.duration)}</p>
          </div>
          <div className="px-3 py-2 bg-zinc-800/50 rounded-lg">
            <p className="text-[10px] uppercase text-zinc-600 tracking-wider">Created</p>
            <p className="text-sm text-zinc-200 mt-0.5">{formatDate(track.createdAt)}</p>
          </div>
        </div>
      </div>

      {/* Edit & Remix Section */}
      <div className="px-6 pb-4">
        <div className="flex items-center gap-2 mb-3">
          <Scissors className="w-4 h-4 text-zinc-500" />
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Edit & Remix</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Trim Start */}
          <div>
            <label className="block text-[10px] text-zinc-600 mb-1">Trim Start</label>
            <input
              type="number"
              min={0}
              max={trimEnd - 1}
              step={0.5}
              value={trimStart}
              onChange={(e) => setTrimStart(parseFloat(e.target.value) || 0)}
              className="w-full px-2.5 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-pink-500/50"
            />
          </div>
          {/* Trim End */}
          <div>
            <label className="block text-[10px] text-zinc-600 mb-1">Trim End</label>
            <input
              type="number"
              min={trimStart + 1}
              max={track.duration}
              step={0.5}
              value={trimEnd}
              onChange={(e) => setTrimEnd(parseFloat(e.target.value) || track.duration)}
              className="w-full px-2.5 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-pink-500/50"
            />
          </div>
          {/* Fade In/Out */}
          <div className="flex items-end gap-2">
            <button
              onClick={() => setFadeIn(!fadeIn)}
              className={cn(
                'flex-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all',
                fadeIn
                  ? 'bg-pink-500/15 border-pink-500/40 text-pink-300'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-zinc-500',
              )}
            >
              Fade In
            </button>
            <button
              onClick={() => setFadeOut(!fadeOut)}
              className={cn(
                'flex-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all',
                fadeOut
                  ? 'bg-pink-500/15 border-pink-500/40 text-pink-300'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-zinc-500',
              )}
            >
              Fade Out
            </button>
          </div>
          {/* Loop */}
          <div className="flex items-end">
            <button
              onClick={() => setLoopEnabled(!loopEnabled)}
              className={cn(
                'w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all',
                loopEnabled
                  ? 'bg-pink-500/15 border-pink-500/40 text-pink-300'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-zinc-500',
              )}
            >
              <Repeat className="w-3 h-3" />
              Loop
            </button>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 px-6 pb-6">
        <Button
          size="sm"
          onClick={onRegenerateSimilar}
          className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Regenerate Similar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onFavorite}
          className={cn(
            'gap-1.5 rounded-xl text-xs',
            track.isFavorite ? 'text-yellow-400' : 'text-zinc-500 hover:text-yellow-400',
          )}
        >
          <Star className={cn('w-3.5 h-3.5', track.isFavorite && 'fill-yellow-400')} />
          {track.isFavorite ? 'Favorited' : 'Favorite'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-zinc-500 hover:text-white rounded-xl text-xs"
          onClick={() => {
            const a = document.createElement('a');
            a.href = track.audioUrl;
            a.download = `${track.title}.mp3`;
            a.click();
          }}
        >
          <Download className="w-3.5 h-3.5" />
          Download
        </Button>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="gap-1.5 text-red-500/60 hover:text-red-400 rounded-xl text-xs"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </Button>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function AIMusicStudio() {
  const authFetch = useAuthFetch();

  // ── API key check ──
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  // ── Creation workflow state ──
  const [step, setStep] = useState<CreationStep>('genre');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [customStyle, setCustomStyle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [selectedMoods, setSelectedMoods] = useState<MoodValue[]>([]);
  const [tempo, setTempo] = useState<TempoValue>('medium');
  const [instrumental, setInstrumental] = useState(true);
  const [voiceStyle, setVoiceStyle] = useState<VoiceStyle>('female');
  const [lyrics, setLyrics] = useState('');
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [previewTrack, setPreviewTrack] = useState<GeneratedTrack | null>(null);
  const [selectedDuration, setSelectedDuration] = useState(30);
  const [isGeneratingFull, setIsGeneratingFull] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Library state ──
  const [tracks, setTracks] = useState<GeneratedTrack[]>([]);
  const [libraryTab, setLibraryTab] = useState<LibraryTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showSortMenu, setShowSortMenu] = useState(false);

  // ── Playback state ──
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState<Record<string, number>>({});
  const [volume, setVolume] = useState(0.8);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ── Detail view ──
  const [detailTrack, setDetailTrack] = useState<GeneratedTrack | null>(null);

  // ── Delete confirmation ──
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // ── Resolved style string ──
  const resolvedStyle = useMemo(() => {
    if (selectedGenre === 'custom') { return customStyle || 'custom'; }
    const match = GENRES.find((g) => g.id === selectedGenre);
    return match ? match.label : selectedGenre;
  }, [selectedGenre, customStyle]);

  // ── Check API key ──
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

  // ── Load tracks ──
  const loadTracks = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (sortBy) { params.set('sort', sortBy); }
      if (searchQuery) { params.set('search', searchQuery); }
      params.set('limit', '50');

      const res = await authFetch(`/api/audio/music/tracks?${params.toString()}`);
      if (res.ok) {
        const data = await res.json() as { success: boolean; tracks: GeneratedTrack[] };
        setTracks(data.tracks ?? []);
      }
    } catch {
      // Silent — tracks are supplementary
    }
  }, [authFetch, sortBy, searchQuery]);

  useEffect(() => {
    void loadTracks();
  }, [loadTracks]);

  // ── Filtered tracks ──
  const filteredTracks = useMemo(() => {
    let result = [...tracks];

    // Filter by library tab
    if (libraryTab === 'favorites') {
      result = result.filter((t) => t.isFavorite);
    } else if (libraryTab === 'custom') {
      result = result.filter((t) => !t.isPreview);
    }

    // Filter out preview tracks from main library
    if (libraryTab === 'all') {
      result = result.filter((t) => !t.isPreview);
    }

    return result;
  }, [tracks, libraryTab]);

  // ── Playback management ──
  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setPlayingId(null);
  }, []);

  const playTrack = useCallback((track: GeneratedTrack) => {
    cleanupAudio();

    const audio = new Audio(track.audioUrl);
    audio.volume = volume;
    audioRef.current = audio;
    setPlayingId(track.id);

    audio.onended = () => {
      setPlayingId(null);
      setPlaybackProgress((prev) => ({ ...prev, [track.id]: 0 }));
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };

    audio.onerror = () => {
      setPlayingId(null);
    };

    progressIntervalRef.current = setInterval(() => {
      if (audio.duration > 0) {
        setPlaybackProgress((prev) => ({
          ...prev,
          [track.id]: audio.currentTime / audio.duration,
        }));
      }
    }, 100);

    audio.play().catch(() => {
      setPlayingId(null);
    });
  }, [cleanupAudio, volume]);

  const pauseTrack = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setPlayingId(null);
  }, []);

  const seekTrack = useCallback((fraction: number) => {
    if (audioRef.current?.duration) {
      audioRef.current.currentTime = fraction * audioRef.current.duration;
    }
  }, []);

  // Update volume on audio element when volume state changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, [cleanupAudio]);

  // ── Mood toggle ──
  const handleMoodToggle = (mood: MoodValue) => {
    setSelectedMoods((prev) =>
      prev.includes(mood)
        ? prev.filter((m) => m !== mood)
        : prev.length < 3
          ? [...prev, mood]
          : prev,
    );
  };

  // ── Adapter: UnifiedMediaAsset (new API) → local GeneratedTrack shape ──
  const adaptAssetToTrack = useCallback((
    asset: {
      id: string;
      name: string;
      url: string;
      duration?: number;
      aiPrompt?: string;
      createdAt: string;
      updatedAt: string;
    },
    opts: { isPreview: boolean; parentPreviewId: string | null },
  ): GeneratedTrack => ({
    id: asset.id,
    title: asset.name,
    audioUrl: asset.url,
    duration: asset.duration ?? 0,
    style: resolvedStyle,
    mood: selectedMoods,
    tempo,
    hasVocals: !instrumental,
    voiceStyle: !instrumental ? voiceStyle : null,
    lyrics: !instrumental && lyrics.trim() ? lyrics.trim() : null,
    prompt: asset.aiPrompt ?? prompt.trim(),
    isFavorite: false,
    isPreview: opts.isPreview,
    parentPreviewId: opts.parentPreviewId,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  }), [resolvedStyle, selectedMoods, tempo, instrumental, voiceStyle, lyrics, prompt]);

  // ── Generate Preview ──
  const handleGeneratePreview = async () => {
    if (!prompt.trim() || !selectedGenre) { return; }
    setIsGeneratingPreview(true);
    setError(null);
    setPreviewTrack(null);

    try {
      const moodLabel = selectedMoods.length > 0 ? selectedMoods.join(', ') : undefined;
      const res = await authFetch('/api/content/music/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          genre: resolvedStyle,
          mood: moodLabel,
          durationSeconds: 10,
        }),
      });

      const data = await res.json() as {
        success: boolean;
        asset?: {
          id: string;
          name: string;
          url: string;
          duration?: number;
          aiPrompt?: string;
          createdAt: string;
          updatedAt: string;
        };
        error?: string;
      };

      if (!data.success || !data.asset) {
        setError(data.error ?? 'Preview generation failed');
        return;
      }

      const track = adaptAssetToTrack(data.asset, { isPreview: true, parentPreviewId: null });
      setPreviewTrack(track);
      setStep('preview');

      // Auto-play the preview
      setTimeout(() => {
        playTrack(track);
      }, 500);
    } catch {
      setError('Failed to generate preview. Check your API key configuration.');
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  // ── Generate Full Track ──
  const handleGenerateFullTrack = async () => {
    if (!prompt.trim() || !selectedGenre) { return; }
    setIsGeneratingFull(true);
    setError(null);

    try {
      const moodLabel = selectedMoods.length > 0 ? selectedMoods.join(', ') : undefined;
      const res = await authFetch('/api/content/music/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          genre: resolvedStyle,
          mood: moodLabel,
          durationSeconds: selectedDuration,
        }),
      });

      const data = await res.json() as {
        success: boolean;
        asset?: {
          id: string;
          name: string;
          url: string;
          duration?: number;
          aiPrompt?: string;
          createdAt: string;
          updatedAt: string;
        };
        error?: string;
      };

      if (!data.success || !data.asset) {
        setError(data.error ?? 'Generation failed');
        return;
      }

      const fullTrack = adaptAssetToTrack(data.asset, {
        isPreview: false,
        parentPreviewId: previewTrack?.id ?? null,
      });
      setTracks((prev) => [fullTrack, ...prev]);
      setStep('genre');
      setPreviewTrack(null);
      setPrompt('');
      setSelectedGenre('');
      setSelectedMoods([]);
      setCustomStyle('');
      setLyrics('');
      cleanupAudio();
    } catch {
      setError('Failed to generate music. Check your API key configuration.');
    } finally {
      setIsGeneratingFull(false);
    }
  };

  // ── Toggle Favorite ──
  const handleToggleFavorite = async (trackId: string) => {
    const track = tracks.find((t) => t.id === trackId);
    if (!track) { return; }

    const newFav = !track.isFavorite;

    // Optimistic update
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, isFavorite: newFav } : t)),
    );

    if (detailTrack?.id === trackId) {
      setDetailTrack((prev) => prev ? { ...prev, isFavorite: newFav } : null);
    }

    try {
      await authFetch('/api/audio/music/tracks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId, isFavorite: newFav }),
      });
    } catch {
      // Revert on failure
      setTracks((prev) =>
        prev.map((t) => (t.id === trackId ? { ...t, isFavorite: !newFav } : t)),
      );
    }
  };

  // ── Delete Track ──
  const handleDeleteTrack = async (trackId: string) => {
    try {
      const res = await authFetch('/api/audio/music/tracks', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId }),
      });

      if (res.ok) {
        setTracks((prev) => prev.filter((t) => t.id !== trackId));
        if (detailTrack?.id === trackId) {
          setDetailTrack(null);
        }
        if (playingId === trackId) {
          cleanupAudio();
        }
      }
    } catch {
      // Silent failure
    }
    setDeleteConfirmId(null);
  };

  // ── Regenerate Similar ──
  const handleRegenerateSimilar = (track: GeneratedTrack) => {
    setSelectedGenre(
      GENRES.find((g) => g.label.toLowerCase() === track.style.toLowerCase())?.id ?? 'custom',
    );
    if (!GENRES.find((g) => g.label.toLowerCase() === track.style.toLowerCase())) {
      setCustomStyle(track.style);
    }
    setPrompt(track.prompt);
    setSelectedMoods(track.mood);
    setTempo(track.tempo);
    setInstrumental(!track.hasVocals);
    if (track.voiceStyle) {
      setVoiceStyle(track.voiceStyle as VoiceStyle);
    }
    if (track.lyrics) {
      setLyrics(track.lyrics);
    }
    setStep('describe');
    setDetailTrack(null);
  };

  // ── Handle play toggle for a track ──
  const handlePlayToggle = (track: GeneratedTrack) => {
    if (playingId === track.id) {
      pauseTrack();
    } else {
      playTrack(track);
    }
  };

  // ── Can advance to describe ──
  const canGoToDescribe = selectedGenre !== '' && (selectedGenre !== 'custom' || customStyle.trim() !== '');

  return (
    <div className="space-y-6">
      {/* ── API Key Warning ── */}
      {hasApiKey === false && (
        <div className="flex items-start gap-3 px-5 py-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-300">AI Music API not configured</p>
            <p className="text-xs text-zinc-400 mt-1">
              Add a MiniMax API key in <span className="text-amber-400 font-medium">Settings &rarr; API Keys</span> to enable
              AI music generation. MiniMax creates professional-quality songs, jingles, and background music with lyrics support.
            </p>
          </div>
        </div>
      )}

      {/* ── Creation Panel ── */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 overflow-hidden">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Create Music</h2>
              <p className="text-xs text-zinc-500">Jingles, backing tracks, and production music with AI</p>
            </div>
          </div>

          {/* Step Indicator */}
          <StepIndicator current={step} />

          {/* ─── Step 1: Genre Browser ─── */}
          {step === 'genre' && (
            <div>
              <GenreBrowser
                selectedGenre={selectedGenre}
                onSelect={setSelectedGenre}
                customStyle={customStyle}
                onCustomStyleChange={setCustomStyle}
              />

              <div className="mt-6 flex justify-end">
                <Button
                  onClick={() => setStep('describe')}
                  disabled={!canGoToDescribe || hasApiKey === false}
                  className="gap-2 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white rounded-xl"
                >
                  Continue
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ─── Step 2: Describe ─── */}
          {step === 'describe' && (
            <div>
              {/* Selected genre pill */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs text-zinc-500">Style:</span>
                <span className="px-2.5 py-1 rounded-full bg-pink-500/15 border border-pink-500/30 text-xs text-pink-300 font-medium">
                  {resolvedStyle}
                </span>
                <button
                  onClick={() => setStep('genre')}
                  className="text-xs text-zinc-600 hover:text-zinc-400 underline"
                >
                  change
                </button>
              </div>

              <SongDescriptionPanel
                prompt={prompt}
                onPromptChange={setPrompt}
                selectedMoods={selectedMoods}
                onMoodToggle={handleMoodToggle}
                tempo={tempo}
                onTempoChange={setTempo}
                instrumental={instrumental}
                onInstrumentalChange={setInstrumental}
                voiceStyle={voiceStyle}
                onVoiceStyleChange={setVoiceStyle}
                lyrics={lyrics}
                onLyricsChange={setLyrics}
              />

              {/* Generate Preview Button */}
              <div className="mt-6 flex items-center gap-3">
                <button
                  onClick={() => setStep('genre')}
                  className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Back
                </button>
                <div className="flex-1" />
                <Button
                  size="lg"
                  onClick={() => { void handleGeneratePreview(); }}
                  disabled={isGeneratingPreview || !prompt.trim() || hasApiKey === false}
                  className="gap-2 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white h-12 px-8 text-sm rounded-xl shadow-lg shadow-pink-500/20"
                >
                  {isGeneratingPreview ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  {isGeneratingPreview ? 'Generating Preview...' : 'Generate Preview'}
                </Button>
              </div>

              {/* Loading animation */}
              {isGeneratingPreview && <MusicLoadingAnimation />}
            </div>
          )}

          {/* ─── Step 3: Preview ─── */}
          {step === 'preview' && previewTrack && (
            <div>
              <div className="text-center mb-6">
                <h3 className="text-base font-semibold text-white mb-1">Preview Ready</h3>
                <p className="text-xs text-zinc-500">Listen to your {resolvedStyle} preview</p>
              </div>

              {/* Preview playback card */}
              <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl p-6 mb-6">
                <div className="flex items-center justify-center gap-4 mb-4">
                  <button
                    onClick={() => handlePlayToggle(previewTrack)}
                    className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center hover:shadow-lg hover:shadow-pink-500/30 transition-all"
                  >
                    {playingId === previewTrack.id ? (
                      <Pause className="w-6 h-6 text-white" />
                    ) : (
                      <Play className="w-6 h-6 text-white ml-0.5" />
                    )}
                  </button>
                </div>

                <div className="flex justify-center">
                  <MiniWaveform
                    trackId={previewTrack.id}
                    progress={playbackProgress[previewTrack.id] ?? 0}
                  />
                </div>

                <div className="flex items-center justify-between mt-2 text-xs text-zinc-500">
                  <span>{formatDuration((playbackProgress[previewTrack.id] ?? 0) * previewTrack.duration)}</span>
                  <span>{formatDuration(previewTrack.duration)}</span>
                </div>

                <p className="text-center text-sm text-zinc-300 mt-3 font-medium">{previewTrack.title}</p>
              </div>

              {/* Choose length and generate full */}
              <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-xl p-5">
                <p className="text-sm text-zinc-300 font-medium mb-3">
                  <Heart className="w-4 h-4 inline-block mr-1.5 text-pink-400" />
                  Like it? Choose length and generate the full track
                </p>

                <div className="flex gap-1.5 mb-4">
                  {DURATIONS.map((d) => (
                    <button
                      key={d.value}
                      onClick={() => setSelectedDuration(d.value)}
                      className={cn(
                        'flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-all text-center',
                        selectedDuration === d.value
                          ? 'bg-pink-500/15 border-pink-500/40 text-pink-300'
                          : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:border-zinc-500',
                      )}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>

                <Button
                  size="lg"
                  onClick={() => { void handleGenerateFullTrack(); }}
                  disabled={isGeneratingFull || hasApiKey === false}
                  className="gap-2 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white w-full h-12 text-sm rounded-xl shadow-lg shadow-pink-500/20"
                >
                  {isGeneratingFull ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {isGeneratingFull ? 'Generating Full Track...' : `Generate Full Track (${DURATIONS.find((d) => d.value === selectedDuration)?.label ?? ''})`}
                </Button>

                {isGeneratingFull && <MusicLoadingAnimation />}
              </div>

              {/* Back / Start Over */}
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={() => setStep('describe')}
                  className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Back to editing
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => {
                    setStep('genre');
                    setPreviewTrack(null);
                    cleanupAudio();
                  }}
                  className="text-sm text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  Start Over
                </button>
              </div>
            </div>
          )}

          {/* ─── Step 4: Generate (shown only during full generation from describe step if skipped preview) ─── */}
          {step === 'generate' && (
            <div className="text-center py-8">
              <MusicLoadingAnimation />
              <p className="text-sm text-zinc-400 mt-4">Generating your track...</p>
            </div>
          )}

          {/* ─── Error Display ─── */}
          {error && (
            <div className="mt-4 flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-xs text-red-400 flex-1">{error}</p>
              <button onClick={() => setError(null)} className="text-red-500 hover:text-red-400">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Track Detail View ── */}
      {detailTrack && (
        <TrackDetailView
          track={detailTrack}
          isPlaying={playingId === detailTrack.id}
          progress={playbackProgress[detailTrack.id] ?? 0}
          volume={volume}
          onPlay={() => playTrack(detailTrack)}
          onPause={pauseTrack}
          onSeek={seekTrack}
          onVolumeChange={setVolume}
          onClose={() => setDetailTrack(null)}
          onFavorite={() => { void handleToggleFavorite(detailTrack.id); }}
          onDelete={() => setDeleteConfirmId(detailTrack.id)}
          onRegenerateSimilar={() => handleRegenerateSimilar(detailTrack)}
        />
      )}

      {/* ── Music Library ── */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 overflow-hidden">
        <div className="p-6">
          {/* Library Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Music className="w-5 h-5 text-pink-400" />
              <h2 className="text-lg font-semibold text-white">Music Library</h2>
              <span className="text-xs text-zinc-600 ml-1">({filteredTracks.length} tracks)</span>
            </div>
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

          {/* Library Tabs */}
          <div className="flex gap-1 mb-4">
            {([
              { key: 'all' as const, label: 'All Tracks' },
              { key: 'favorites' as const, label: 'Favorites' },
              { key: 'custom' as const, label: 'My Music' },
            ]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setLibraryTab(tab.key)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  libraryTab === tab.key
                    ? 'bg-pink-500/15 text-pink-300'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search & Filter */}
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
              <input
                type="text"
                placeholder="Search tracks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-zinc-800/80 border border-zinc-700 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-pink-500/30"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Sort dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowSortMenu(!showSortMenu)}
                className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800/80 border border-zinc-700 rounded-xl text-xs text-zinc-400 hover:text-zinc-300 transition-colors"
              >
                <Clock className="w-3.5 h-3.5" />
                {sortBy === 'newest' ? 'Newest' : sortBy === 'oldest' ? 'Oldest' : 'Duration'}
                <ChevronDown className="w-3 h-3" />
              </button>
              {showSortMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl z-20 py-1 min-w-[120px]">
                    {([
                      { value: 'newest' as const, label: 'Newest First' },
                      { value: 'oldest' as const, label: 'Oldest First' },
                      { value: 'duration' as const, label: 'Duration' },
                    ]).map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setSortBy(opt.value);
                          setShowSortMenu(false);
                        }}
                        className={cn(
                          'w-full px-3 py-1.5 text-xs text-left transition-colors',
                          sortBy === opt.value
                            ? 'text-pink-300 bg-pink-500/10'
                            : 'text-zinc-400 hover:text-white hover:bg-zinc-700/50',
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Track List */}
          {filteredTracks.length > 0 ? (
            <div className="space-y-2">
              {filteredTracks.map((track) => {
                const isPlaying = playingId === track.id;
                const progress = playbackProgress[track.id] ?? 0;
                const isDeleting = deleteConfirmId === track.id;

                return (
                  <div
                    key={track.id}
                    className={cn(
                      'group flex items-center gap-3 px-4 py-3 rounded-xl border transition-all cursor-pointer',
                      isPlaying
                        ? 'border-pink-500/30 bg-pink-500/5'
                        : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-800/30',
                    )}
                    onClick={() => setDetailTrack(track)}
                  >
                    {/* Play Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayToggle(track);
                      }}
                      className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all',
                        isPlaying
                          ? 'bg-pink-500/20 text-pink-400'
                          : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700',
                      )}
                    >
                      {isPlaying ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4 ml-0.5" />
                      )}
                    </button>

                    {/* Track Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{track.title}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">{track.style}</span>
                        <span className="text-[10px] text-zinc-600">{formatDuration(track.duration)}</span>
                        {track.mood.length > 0 && (
                          <span className="text-[10px] text-zinc-600 hidden sm:inline">
                            {track.mood.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Mini Waveform */}
                    <div className="hidden md:block flex-shrink-0">
                      <MiniWaveform trackId={track.id} progress={progress} />
                    </div>

                    {/* Playing indicator */}
                    {isPlaying && (
                      <Volume2 className="w-4 h-4 text-pink-400 animate-pulse flex-shrink-0" />
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      {/* Favorite */}
                      <button
                        onClick={() => { void handleToggleFavorite(track.id); }}
                        className={cn(
                          'p-2 rounded-lg transition-colors',
                          track.isFavorite
                            ? 'text-yellow-400 hover:text-yellow-300'
                            : 'text-zinc-600 hover:text-yellow-400 opacity-0 group-hover:opacity-100',
                        )}
                        title="Favorite"
                      >
                        <Star className={cn('w-3.5 h-3.5', track.isFavorite && 'fill-yellow-400')} />
                      </button>

                      {/* Download */}
                      <button
                        className="p-2 rounded-lg text-zinc-600 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                        onClick={() => {
                          const a = document.createElement('a');
                          a.href = track.audioUrl;
                          a.download = `${track.title}.mp3`;
                          a.click();
                        }}
                        title="Download MP3"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      {/* Use in Video */}
                      <button
                        className="p-2 rounded-lg text-zinc-600 hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100"
                        onClick={() => {
                          void navigator.clipboard.writeText(track.audioUrl);
                        }}
                        title="Copy URL for video production"
                      >
                        <Video className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete */}
                      {isDeleting ? (
                        <div className="flex items-center gap-1 ml-1">
                          <button
                            onClick={() => { void handleDeleteTrack(track.id); }}
                            className="px-2 py-1 text-[10px] bg-red-500/20 text-red-400 rounded-md hover:bg-red-500/30 font-medium"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-2 py-1 text-[10px] bg-zinc-800 text-zinc-400 rounded-md hover:bg-zinc-700"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(track.id)}
                          className="p-2 rounded-lg text-zinc-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // Empty State
            <div className="flex flex-col items-center py-12 gap-3">
              <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 flex items-center justify-center">
                <Music className="w-8 h-8 text-zinc-700" />
              </div>
              <p className="text-sm text-zinc-500 font-medium">
                {libraryTab === 'favorites'
                  ? 'No favorite tracks yet'
                  : searchQuery
                    ? 'No tracks match your search'
                    : 'No tracks generated yet'
                }
              </p>
              <p className="text-xs text-zinc-600 max-w-sm text-center">
                {libraryTab === 'favorites'
                  ? 'Star your best tracks to find them quickly here.'
                  : 'Create your first track using the music generator above. Choose a style, describe the vibe, and let AI compose something unique.'
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
