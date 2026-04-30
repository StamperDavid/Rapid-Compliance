'use client';

/**
 * Studio Canvas — the persistent center stage.
 *
 * Renders one of: empty state, generating spinner, error, or completed result.
 * The result element is the canonical "thing the operator just made" — it
 * stays here while the operator iterates. Switching tools doesn't blow it
 * away because the parent stores per-tool result state.
 *
 * Drop target: the canvas accepts drags from the Recent sidebar so the
 * operator can drop an image onto the Video tool to seed a portrait.
 */

import { type DragEvent, useCallback } from 'react';
import Image from 'next/image';
import { Loader2, AlertTriangle, Sparkles } from 'lucide-react';
import type { StudioTool } from './StudioToolPalette';

// ============================================================================
// Result discriminated union — exported for the page to use.
// ============================================================================

export type StudioResult =
  | { kind: 'image'; url: string; prompt: string; mediaId: string | null }
  | { kind: 'video'; url: string | null; prompt: string; mediaId: string | null; generationId: string | null }
  | { kind: 'audio'; url: string; prompt: string; mediaId: string | null }
  | { kind: 'text'; text: string; prompt: string; mediaId: string | null };

// ============================================================================
// Types
// ============================================================================

interface StudioCanvasProps {
  activeTool: StudioTool;
  result: StudioResult | null;
  isGenerating: boolean;
  error: string | null;
  onDropMediaUrl: (url: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export function StudioCanvas({
  activeTool,
  result,
  isGenerating,
  error,
  onDropMediaUrl,
}: StudioCanvasProps) {
  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (event.dataTransfer.types.includes('application/x-studio-media')) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const url = event.dataTransfer.getData('text/plain');
      if (url) {
        onDropMediaUrl(url);
      }
    },
    [onDropMediaUrl],
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="flex-1 overflow-auto bg-background flex items-center justify-center p-6"
    >
      <div className="w-full max-w-3xl">
        {isGenerating ? (
          <GeneratingState tool={activeTool} />
        ) : error ? (
          <ErrorState message={error} />
        ) : result ? (
          <ResultDisplay result={result} />
        ) : (
          <EmptyState tool={activeTool} />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// States
// ============================================================================

function EmptyState({ tool }: { tool: StudioTool }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-border-light bg-card/30 px-10 py-16 text-center">
      <div className="rounded-full bg-primary/10 p-4">
        <Sparkles className="h-8 w-8 text-primary" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-foreground">
          {getEmptyHeading(tool)}
        </h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Generate your first asset to get started. Type a prompt above and
          click Generate. Your result will appear here, and you can keep
          iterating without leaving this canvas.
        </p>
      </div>
    </div>
  );
}

function GeneratingState({ tool }: { tool: StudioTool }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-border-light bg-card/50 px-10 py-20 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
      <div className="space-y-1">
        <p className="text-base font-medium text-foreground">
          Generating {tool}...
        </p>
        <p className="text-sm text-muted-foreground">
          This usually takes a few seconds. Hang tight.
        </p>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-destructive/40 bg-destructive/5 px-10 py-16 text-center">
      <div className="rounded-full bg-destructive/10 p-3">
        <AlertTriangle className="h-7 w-7 text-destructive" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-medium text-foreground">Generation failed</p>
        <p className="text-sm text-muted-foreground max-w-lg break-words">
          {message}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Result rendering — by media type
// ============================================================================

function ResultDisplay({ result }: { result: StudioResult }) {
  switch (result.kind) {
    case 'image':
      return (
        <div className="flex flex-col gap-3 rounded-2xl border border-border-light bg-card p-4 shadow-sm">
          <Image
            src={result.url}
            alt={result.prompt || 'Generated image'}
            unoptimized
            width={0}
            height={0}
            sizes="100vw"
            className="w-full h-auto rounded-lg"
            style={{ width: '100%', height: 'auto' }}
          />
          <p className="text-xs text-muted-foreground line-clamp-2">
            {result.prompt}
          </p>
        </div>
      );
    case 'video':
      return (
        <div className="flex flex-col gap-3 rounded-2xl border border-border-light bg-card p-4 shadow-sm">
          {result.url ? (
            <video
              src={result.url}
              controls
              className="w-full h-auto rounded-lg bg-black"
            />
          ) : (
            <div className="rounded-lg bg-surface-elevated p-8 text-center text-sm text-muted-foreground">
              Video generation submitted. Check the Recent panel once it&apos;s ready.
            </div>
          )}
          <p className="text-xs text-muted-foreground line-clamp-2">
            {result.prompt}
          </p>
        </div>
      );
    case 'audio':
      return (
        <div className="flex flex-col gap-3 rounded-2xl border border-border-light bg-card p-6 shadow-sm">
          <audio src={result.url} controls className="w-full" />
          <p className="text-xs text-muted-foreground line-clamp-2">
            {result.prompt}
          </p>
        </div>
      );
    case 'text':
      return (
        <div className="flex flex-col gap-3 rounded-2xl border border-border-light bg-card p-6 shadow-sm">
          <p className="whitespace-pre-wrap text-sm text-foreground">
            {result.text}
          </p>
          <p className="text-xs text-muted-foreground line-clamp-2 border-t border-border-light pt-3">
            Prompt: {result.prompt}
          </p>
        </div>
      );
  }
}

// ============================================================================
// Helpers
// ============================================================================

function getEmptyHeading(tool: StudioTool): string {
  switch (tool) {
    case 'image':
      return 'Ready to generate an image';
    case 'video':
      return 'Ready to generate a video';
    case 'music':
      return 'Ready to generate music';
    case 'text':
      return 'Ready to generate text';
  }
}
