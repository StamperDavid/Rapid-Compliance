'use client';

/**
 * Content Generator → Library → Audio section.
 *
 * Two sections:
 *   1. Voice clones  — custom voices from GET /api/video/voices (provider === 'custom')
 *   2. Audio files   — all audio assets from GET /api/media?type=audio
 *
 * The two-level Library nav + page padding/spacing are supplied by the parent
 * layout (`content/library/layout.tsx`); this page renders only its own content.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { Button } from '@/components/ui/button';
import {
  PageTitle,
  SectionTitle,
  SectionDescription,
  Caption,
  CardTitle,
} from '@/components/ui/typography';
import {
  Mic,
  Music,
  Loader2,
  Play,
  Pause,
  Volume2,
} from 'lucide-react';
import type { VideoVoice } from '@/types/video';
import type { UnifiedMediaAsset, MediaAssetCategory } from '@/types/media-library';

// ============================================================================
// Response shapes
// ============================================================================

interface VoicesResponse {
  success: boolean;
  voices: VideoVoice[];
}

interface AudioAssetsResponse {
  success: boolean;
  assets: UnifiedMediaAsset[];
  items: UnifiedMediaAsset[];
  total: number;
}

// ============================================================================
// Category display label
// ============================================================================

const AUDIO_CATEGORY_DISPLAY: Partial<Record<MediaAssetCategory, string>> = {
  'music-track': 'Music',
  voiceover: 'Voiceover',
  sound: 'Sound effect',
};

function audioCategoryLabel(category: MediaAssetCategory): string {
  return AUDIO_CATEGORY_DISPLAY[category] ?? category;
}

// ============================================================================
// Duration formatter  (seconds → m:ss)
// ============================================================================

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m)}:${String(s).padStart(2, '0')}`;
}

// ============================================================================
// Mini audio player  (play/pause toggle + native <audio>)
// ============================================================================

interface AudioPlayerProps {
  url: string;
  label: string;
}

function AudioPlayer({ url, label }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el) { return; }
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      void el.play().then(() => {
        setPlaying(true);
      }).catch(() => {
        setPlaying(false);
      });
    }
  }, [playing]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) { return; }
    const onEnded = () => setPlaying(false);
    el.addEventListener('ended', onEnded);
    return () => el.removeEventListener('ended', onEnded);
  }, []);

  return (
    <div className="flex items-center gap-2">
      {/* Hidden native audio element — controlled programmatically */}
      <audio ref={audioRef} src={url} preload="none" />
      <Button
        variant="outline"
        size="sm"
        className="h-7 w-7 rounded-full p-0"
        aria-label={playing ? `Pause ${label}` : `Play ${label}`}
        onClick={toggle}
      >
        {playing ? (
          <Pause className="h-3.5 w-3.5" />
        ) : (
          <Play className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}

// ============================================================================
// Voice clone card
// ============================================================================

interface VoiceCloneCardProps {
  voice: VideoVoice;
}

function VoiceCloneCard({ voice }: VoiceCloneCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border-strong bg-card p-4">
      {/* Icon + name row */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Mic className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <CardTitle className="truncate">{voice.name}</CardTitle>
          <Caption className="mt-0.5 text-muted-foreground">
            {voice.language ?? 'English'}
            {voice.gender ? ` · ${voice.gender}` : ''}
          </Caption>
        </div>
        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
          Custom voice
        </span>
      </div>

      {/* Preview player */}
      {voice.previewUrl ? (
        <div className="flex items-center gap-2 rounded-lg bg-surface-elevated px-3 py-2">
          <Volume2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <AudioPlayer url={voice.previewUrl} label={voice.name} />
          <Caption className="text-muted-foreground">Preview</Caption>
        </div>
      ) : (
        <Caption className="text-muted-foreground">No preview available</Caption>
      )}
    </div>
  );
}

// ============================================================================
// Audio file card
// ============================================================================

interface AudioFileCardProps {
  asset: UnifiedMediaAsset;
}

function AudioFileCard({ asset }: AudioFileCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border-strong bg-card p-4">
      {/* Icon + meta row */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Music className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <CardTitle className="truncate">{asset.name}</CardTitle>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {audioCategoryLabel(asset.category)}
            </span>
            {typeof asset.duration === 'number' && (
              <Caption className="text-muted-foreground">
                {formatDuration(asset.duration)}
              </Caption>
            )}
          </div>
        </div>
      </div>

      {/* Native audio player */}
      <audio
        controls
        src={asset.url}
        preload="none"
        className="h-9 w-full"
        aria-label={asset.name}
      >
        Your browser does not support the audio element.
      </audio>
    </div>
  );
}

// ============================================================================
// Page
// ============================================================================

export default function AudioLibraryPage() {
  const authFetch = useAuthFetch();

  // Voice clones state
  const [clones, setClones] = useState<VideoVoice[]>([]);
  const [clonesLoading, setClonesLoading] = useState(true);
  const [clonesError, setClonesError] = useState<string | null>(null);

  // Audio files state
  const [audioFiles, setAudioFiles] = useState<UnifiedMediaAsset[]>([]);
  const [audioLoading, setAudioLoading] = useState(true);
  const [audioError, setAudioError] = useState<string | null>(null);

  // ── Fetch voice clones ────────────────────────────────────────────────────
  const fetchClones = useCallback(async () => {
    setClonesLoading(true);
    setClonesError(null);
    try {
      const res = await authFetch('/api/video/voices');
      if (!res.ok) {
        setClonesError(`Failed to load voice clones (${res.status})`);
        setClones([]);
        return;
      }
      const data = (await res.json()) as VoicesResponse;
      // Only show custom clones on this page — built-in provider voices
      // belong in the Audio Lab voice picker, not the library.
      setClones((data.voices ?? []).filter((v) => v.provider === 'custom'));
    } catch (err) {
      setClonesError(err instanceof Error ? err.message : 'Failed to load voice clones');
      setClones([]);
    } finally {
      setClonesLoading(false);
    }
  }, [authFetch]);

  // ── Fetch audio files ─────────────────────────────────────────────────────
  const fetchAudio = useCallback(async () => {
    setAudioLoading(true);
    setAudioError(null);
    try {
      const res = await authFetch('/api/media?type=audio');
      if (!res.ok) {
        setAudioError(`Failed to load audio files (${res.status})`);
        setAudioFiles([]);
        return;
      }
      const data = (await res.json()) as AudioAssetsResponse;
      // Prefer the `assets` key; fall back to `items` for legacy compat.
      setAudioFiles(data.assets ?? data.items ?? []);
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : 'Failed to load audio files');
      setAudioFiles([]);
    } finally {
      setAudioLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void fetchClones();
    void fetchAudio();
  }, [fetchClones, fetchAudio]);

  // ========================================================================
  // Render
  // ========================================================================

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <PageTitle className="flex items-center gap-3">
            <Volume2 className="h-7 w-7 text-primary" />
            Audio Library
          </PageTitle>
          <SectionDescription className="mt-1">
            Your voice clones and uploaded audio files — reuse them across campaigns and
            videos without re-uploading.
          </SectionDescription>
        </div>
      </div>

      {/* ── Voice clones section ────────────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionTitle>Voice clones</SectionTitle>

        {clonesError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
            <Caption className="text-destructive">{clonesError}</Caption>
          </div>
        )}

        {clonesLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : clones.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border-strong bg-card py-14 text-center">
            <Mic className="mb-3 h-10 w-10 text-muted-foreground" />
            <SectionTitle as="h3">No voice clones yet</SectionTitle>
            <SectionDescription className="mt-1 max-w-sm">
              No voice clones yet — create one in the Audio Lab.
            </SectionDescription>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {clones.map((voice) => (
              <VoiceCloneCard key={voice.id} voice={voice} />
            ))}
          </div>
        )}
      </section>

      {/* ── Audio files section ─────────────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionTitle>Audio files</SectionTitle>

        {audioError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
            <Caption className="text-destructive">{audioError}</Caption>
          </div>
        )}

        {audioLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : audioFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border-strong bg-card py-14 text-center">
            <Music className="mb-3 h-10 w-10 text-muted-foreground" />
            <SectionTitle as="h3">No audio files yet</SectionTitle>
            <SectionDescription className="mt-1 max-w-sm">
              No audio files yet.
            </SectionDescription>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {audioFiles.map((asset) => (
              <AudioFileCard key={asset.id} asset={asset} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
