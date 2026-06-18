'use client';

/**
 * VFX & B-Roll tool panel — the compact, right-column form of the Generative VFX
 * workspace. Describe the supporting shot you need → generate it from OUR own
 * fal/image (or fal/Seedance video) engine → drop it straight onto the SHARED
 * timeline. No stock-footage hunting — just describe it.
 *
 * This is the narrow-panel adaptation of `modes/GenerativeVfxMode.tsx`: it reuses
 * the exact same real generation hook (`useBrollGenerator`) and the same ADD_CLIP
 * wiring through the shared reducer. It renders NO Preview of its own — the unified
 * editor's shared Preview + Timeline are always on screen beside this column.
 *
 * REAL WIRING (unchanged from the full mode): Image generation calls
 * /api/content/asset-generator/generate (live, auth-gated, synchronous fal.ai
 * image); Video generation calls /api/video/editor/broll (live fal/Seedance
 * text-to-video). On success the permanent URL is added to the project with
 * ADD_CLIP through the shared reducer. Nothing is faked: if an endpoint errors, the
 * operator sees the exact reason and no clip is added.
 */

import { useCallback, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  Sparkles,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ImageIcon,
  Film,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SubsectionTitle, SectionDescription, Caption } from '@/components/ui/typography';
import { DEFAULT_CLIP_DURATION } from '../types';
import type { EditorToolProps } from '../editor-tools';
import {
  BROLL_ASPECTS,
  useBrollGenerator,
  type BrollAspect,
  type BrollKind,
  type GeneratedBroll,
} from '../modes/generative-vfx/useBrollGenerator';

/** Short, concrete starter ideas so a non-technical operator isn't staring at a blank box. */
const PROMPT_IDEAS: readonly string[] = [
  'Slow aerial drone shot over a coastal city at golden hour',
  'Close-up of hands typing on a laptop in a bright office',
  'Soft-focus coffee being poured, warm morning light',
  'Time-lapse of clouds over rolling green hills',
];

export default function VfxToolPanel({ state, dispatch, authFetch }: EditorToolProps) {
  const { gallery, isGenerating, error, generate, markInserted, discard, clearError } =
    useBrollGenerator(authFetch);

  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<BrollAspect['value']>('16:9');
  const [kind, setKind] = useState<BrollKind>('image');

  const trimmedPrompt = prompt.trim();
  const canGenerate = trimmedPrompt.length > 0 && !isGenerating;

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) {
      return;
    }
    await generate(trimmedPrompt, aspectRatio, kind);
  }, [canGenerate, generate, trimmedPrompt, aspectRatio, kind]);

  const handleInsert = useCallback(
    (item: GeneratedBroll) => {
      const isVideo = item.kind === 'video';
      dispatch({
        type: 'ADD_CLIP',
        clip: {
          name: item.name,
          url: item.url,
          // A still image is its own thumbnail; a video has no still frame here, so
          // the timeline derives one from the clip itself.
          thumbnailUrl: isVideo ? null : item.url,
          // A video clip carries the real generated duration; an image uses the
          // editor's default still duration.
          duration: isVideo ? item.durationSeconds ?? DEFAULT_CLIP_DURATION : DEFAULT_CLIP_DURATION,
          source: 'url',
        },
      });
      // The reducer assigns the real clip id; we only record THAT this B-roll is now
      // on the timeline so the gallery can show "Added" without inventing an id.
      markInserted(item.id);
    },
    [dispatch, markInserted],
  );

  const insertedCount = useMemo(
    () => gallery.filter((item) => item.inserted).length,
    [gallery],
  );

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pb-4">
      {/* Prompt + controls */}
      <Card className="border-border-strong p-4">
        <SubsectionTitle as="h4">Generate B-roll</SubsectionTitle>
        <SectionDescription className="mt-1">
          Describe the supporting shot you need. Your brand colors are applied automatically.
        </SectionDescription>

        {/* Image / Video toggle */}
        <div className="mt-3">
          <Caption className="mb-1.5 block text-muted-foreground">What should we make?</Caption>
          <div className="flex w-full rounded-lg border border-border-light bg-background p-1">
            <Button
              type="button"
              size="sm"
              variant={kind === 'image' ? 'default' : 'ghost'}
              onClick={() => setKind('image')}
              disabled={isGenerating}
              className="flex-1 gap-1.5"
              aria-pressed={kind === 'image'}
            >
              <ImageIcon className="h-4 w-4" />
              Image
            </Button>
            <Button
              type="button"
              size="sm"
              variant={kind === 'video' ? 'default' : 'ghost'}
              onClick={() => setKind('video')}
              disabled={isGenerating}
              className="flex-1 gap-1.5"
              aria-pressed={kind === 'video'}
            >
              <Film className="h-4 w-4" />
              Video
            </Button>
          </div>
          <Caption className="mt-1.5 block text-muted-foreground">
            {kind === 'video'
              ? 'A real moving B-roll clip. This takes longer than a still — usually a minute or two.'
              : 'A high-quality still frame you can drop on the timeline instantly.'}
          </Caption>
        </div>

        {/* Prompt input */}
        <div className="mt-3">
          <Input
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              if (error) {
                clearError();
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canGenerate) {
                void handleGenerate();
              }
            }}
            placeholder="e.g. Slow aerial shot over a coastal city at golden hour"
            disabled={isGenerating}
            className="w-full"
            aria-label="Describe the B-roll you want"
          />
        </div>

        {/* Aspect ratio */}
        <div className="mt-3">
          <Caption className="mb-1.5 block text-muted-foreground">Shape</Caption>
          <select
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value as BrollAspect['value'])}
            disabled={isGenerating}
            aria-label="B-roll aspect ratio"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {BROLL_ASPECTS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </div>

        {/* Generate */}
        <Button
          onClick={() => void handleGenerate()}
          disabled={!canGenerate}
          className="mt-4 w-full gap-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {kind === 'video' ? 'Generating clip...' : 'Generating...'}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              {kind === 'video' ? 'Generate B-roll clip' : 'Generate B-roll'}
            </>
          )}
        </Button>

        {/* Starter ideas */}
        <div className="mt-3 flex flex-wrap gap-2">
          {PROMPT_IDEAS.map((idea) => (
            <button
              key={idea}
              type="button"
              onClick={() => {
                setPrompt(idea);
                if (error) {
                  clearError();
                }
              }}
              disabled={isGenerating}
              className="rounded-full border border-border-light bg-background px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {idea}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="flex-1">
              <Caption className="font-medium text-destructive">Generation didn&apos;t work</Caption>
              <p className="mt-0.5 text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
        )}
      </Card>

      {/* Gallery */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <SubsectionTitle as="h4">Generated B-roll</SubsectionTitle>
          {gallery.length > 0 && (
            <Caption className="text-muted-foreground">
              {insertedCount}/{gallery.length} on timeline
            </Caption>
          )}
        </div>

        {gallery.length === 0 ? (
          <Card className="border-dashed border-border-strong p-6 text-center">
            <Sparkles className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            <SectionDescription>
              Nothing generated yet. Describe a shot above and your B-roll appears here, ready to
              drop on the timeline.
            </SectionDescription>
            <Caption className="mt-2 block text-muted-foreground">
              {state.clips.length} clip(s) in project
            </Caption>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {gallery.map((item) => {
              const inserted = item.inserted;
              return (
                <Card key={item.id} className="overflow-hidden border-border-strong">
                  <div className="relative aspect-video w-full bg-surface-elevated">
                    {item.kind === 'video' ? (
                      <video
                        src={item.url}
                        controls
                        playsInline
                        muted
                        preload="metadata"
                        className="h-full w-full object-cover"
                        aria-label={item.name}
                      />
                    ) : (
                      <Image
                        src={item.url}
                        alt={item.name}
                        fill
                        unoptimized
                        sizes="380px"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="line-clamp-2 text-sm font-medium text-foreground">{item.name}</p>
                    <Caption className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                      {item.kind === 'video' ? (
                        <>
                          <Film className="h-3 w-3" />
                          Video clip · {item.aspectRatio}
                          {typeof item.durationSeconds === 'number'
                            ? ` · ${item.durationSeconds}s`
                            : ''}
                        </>
                      ) : (
                        <>
                          <ImageIcon className="h-3 w-3" />
                          Still frame · {item.aspectRatio}
                        </>
                      )}
                    </Caption>

                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={inserted ? 'secondary' : 'default'}
                        onClick={() => handleInsert(item)}
                        className="flex-1 gap-1.5"
                      >
                        {inserted ? (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            Added — add again
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4" />
                            Add to timeline
                          </>
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => discard(item.id)}
                        aria-label={`Remove ${item.name} from the gallery`}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
