'use client';

/**
 * Generative VFX & B-Roll mode (our AI edge).
 *
 * Describe the B-roll you want → generate it from OUR own fal/image engine → drop it
 * straight onto the shared timeline. This is the workspace where the platform's
 * generative engines beat a plain editor: the operator doesn't go hunting for stock
 * footage, they describe the supporting shot and it appears in the project.
 *
 * REAL WIRING: the operator chooses Image or Video. Image generation calls
 * /api/content/asset-generator/generate (the live, auth-gated, synchronous fal.ai
 * image endpoint); Video generation calls /api/video/editor/broll (the live
 * fal/Seedance text-to-video endpoint). On success the permanent URL is added to the
 * project with ADD_CLIP through the SHARED reducer — never a private copy of project
 * state. Nothing is ever faked: if an endpoint errors, the operator sees the exact
 * reason and no clip is added.
 *
 * Image B-roll lands as a still clip at the default clip duration; Video B-roll lands
 * as a real moving clip at the duration the engine returned. Either can be trimmed,
 * transitioned, and reordered with the rest of the project. Video takes longer to
 * generate than a still — the panel says so.
 */

import { useCallback, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  Wand2,
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
import { SectionTitle, SubsectionTitle, SectionDescription, Caption } from '@/components/ui/typography';
import { DEFAULT_CLIP_DURATION } from '../types';
import type { EditorModeProps } from '../editor-modes';
import {
  BROLL_ASPECTS,
  useBrollGenerator,
  type BrollAspect,
  type BrollKind,
  type GeneratedBroll,
} from './generative-vfx/useBrollGenerator';

/** Short, concrete starter ideas so a non-technical operator isn't staring at a blank box. */
const PROMPT_IDEAS: readonly string[] = [
  'Slow aerial drone shot over a coastal city at golden hour',
  'Close-up of hands typing on a laptop in a bright modern office',
  'Soft-focus coffee being poured into a cup, warm morning light',
  'Time-lapse of clouds moving over rolling green hills',
];

export default function GenerativeVfxMode({ state, dispatch, authFetch }: EditorModeProps) {
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
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-border-strong bg-card p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-2">
            <Wand2 className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <SectionTitle as="h3">Generative VFX &amp; B-Roll</SectionTitle>
            <SectionDescription className="mt-1 max-w-2xl">
              Describe the supporting shot you need and our AI generates it as a still frame or a
              real video clip, then drop it straight onto your timeline. No stock-footage hunting —
              just describe it.
            </SectionDescription>
          </div>
          <Caption className="whitespace-nowrap text-muted-foreground">
            {state.clips.length} clip(s) in project
          </Caption>
        </div>
      </div>

      {/* Generation panel */}
      <Card className="border-border-strong p-6">
        <SubsectionTitle as="h4">Describe the B-roll you want</SubsectionTitle>
        <SectionDescription className="mt-1">
          Be specific about the scene, mood, and lighting. Your brand colors are applied
          automatically.
        </SectionDescription>

        {/* Image / Video toggle */}
        <div className="mt-4">
          <Caption className="mb-1.5 block text-muted-foreground">What should we make?</Caption>
          <div className="inline-flex rounded-lg border border-border-light bg-background p-1">
            <Button
              type="button"
              size="sm"
              variant={kind === 'image' ? 'default' : 'ghost'}
              onClick={() => setKind('image')}
              disabled={isGenerating}
              className="gap-1.5"
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
              className="gap-1.5"
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

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
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
            className="flex-1"
            aria-label="Describe the B-roll you want"
          />

          <select
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value as BrollAspect['value'])}
            disabled={isGenerating}
            aria-label="B-roll aspect ratio"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {BROLL_ASPECTS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>

          <Button onClick={() => void handleGenerate()} disabled={!canGenerate} className="gap-2">
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
        </div>

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
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
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
        <div className="mb-3 flex items-center justify-between">
          <SubsectionTitle as="h4">Generated B-roll</SubsectionTitle>
          {gallery.length > 0 && (
            <Caption className="text-muted-foreground">
              {gallery.length} generated · {insertedCount} on timeline
            </Caption>
          )}
        </div>

        {gallery.length === 0 ? (
          <Card className="border-dashed border-border-strong p-10 text-center">
            <Sparkles className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <SectionDescription className="mx-auto max-w-md">
              Nothing generated yet. Describe a shot above and your B-roll will appear here, ready to
              drop on the timeline.
            </SectionDescription>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="p-4">
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
