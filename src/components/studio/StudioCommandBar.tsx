'use client';

/**
 * Studio Command Bar — top of the canvas.
 *
 * Holds the prompt input and the per-tool inline selectors (model / aspect /
 * duration / video sub-mode). The bar is always visible; selectors swap based
 * on the active tool so the operator never leaves the canvas.
 */

import { useCallback, type ChangeEvent, type FormEvent } from 'react';
import Image from 'next/image';
import { Loader2, Send, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { StudioTool } from './StudioToolPalette';

// ============================================================================
// Types
// ============================================================================

export type VideoMode = 'prompt' | 'avatar';

export interface StudioCommandState {
  prompt: string;
  // Image
  imageAspect: string;
  // Video
  videoMode: VideoMode;
  videoAspect: string;
  videoDurationMs: number;
  videoPortraitUrl: string | null;
  // Music
  musicDurationSec: number;
  musicStyle: string;
  // Text
  textKind: string;
}

export const DEFAULT_COMMAND_STATE: StudioCommandState = {
  prompt: '',
  imageAspect: '1:1',
  videoMode: 'prompt',
  videoAspect: '16:9',
  videoDurationMs: 10000,
  videoPortraitUrl: null,
  musicDurationSec: 30,
  musicStyle: 'cinematic',
  textKind: 'caption',
};

// ============================================================================
// Selector option lists
// ============================================================================

const IMAGE_ASPECTS = ['1:1', '4:3', '3:4', '16:9', '9:16'] as const;
const VIDEO_ASPECTS = ['16:9', '9:16', '1:1'] as const;
const VIDEO_DURATIONS_MS = [
  { value: 5000, label: '5s' },
  { value: 10000, label: '10s' },
  { value: 15000, label: '15s' },
] as const;
const MUSIC_DURATIONS_SEC = [
  { value: 15, label: '15s' },
  { value: 30, label: '30s' },
  { value: 60, label: '1 min' },
  { value: 120, label: '2 min' },
] as const;
const MUSIC_STYLES = [
  'cinematic',
  'upbeat',
  'corporate',
  'lo-fi',
  'electronic',
  'acoustic',
] as const;
const TEXT_KINDS = [
  { value: 'caption', label: 'Social caption' },
  { value: 'script', label: 'Video script' },
  { value: 'headline', label: 'Headline' },
  { value: 'paragraph', label: 'Long-form paragraph' },
] as const;

// ============================================================================
// Component
// ============================================================================

interface StudioCommandBarProps {
  activeTool: StudioTool;
  state: StudioCommandState;
  onStateChange: (next: StudioCommandState) => void;
  onSubmit: () => void;
  onClearResult: () => void;
  isGenerating: boolean;
  hasResult: boolean;
  onPortraitUpload: (file: File) => void;
}

export function StudioCommandBar({
  activeTool,
  state,
  onStateChange,
  onSubmit,
  onClearResult,
  isGenerating,
  hasResult,
  onPortraitUpload,
}: StudioCommandBarProps) {
  const handlePromptChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      onStateChange({ ...state, prompt: event.target.value });
    },
    [state, onStateChange],
  );

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!state.prompt.trim() || isGenerating) {
        return;
      }
      onSubmit();
    },
    [state.prompt, isGenerating, onSubmit],
  );

  const handlePortraitChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        onPortraitUpload(file);
      }
      // Reset input so the same file can be selected again
      event.target.value = '';
    },
    [onPortraitUpload],
  );

  const promptPlaceholder = getPromptPlaceholder(activeTool);

  return (
    <form
      onSubmit={handleSubmit}
      className="border-b border-border-light bg-card/60 px-6 py-4 flex flex-col gap-3"
    >
      {/* Prompt + submit */}
      <div className="flex items-start gap-3">
        <Textarea
          value={state.prompt}
          onChange={handlePromptChange}
          placeholder={promptPlaceholder}
          rows={2}
          className="resize-none flex-1"
          disabled={isGenerating}
          aria-label="Generation prompt"
        />
        <div className="flex flex-col gap-2">
          <Button type="submit" disabled={isGenerating || !state.prompt.trim()}>
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                Generating
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" aria-hidden="true" />
                Generate
              </>
            )}
          </Button>
          {hasResult ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClearResult}
              disabled={isGenerating}
            >
              <X className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
              Clear
            </Button>
          ) : null}
        </div>
      </div>

      {/* Per-tool inline selectors */}
      <div className="flex flex-wrap items-center gap-3">
        {activeTool === 'image' ? (
          <Selector
            label="Aspect"
            value={state.imageAspect}
            onChange={(value) => onStateChange({ ...state, imageAspect: value })}
            options={IMAGE_ASPECTS.map((a) => ({ value: a, label: a }))}
            disabled={isGenerating}
          />
        ) : null}

        {activeTool === 'video' ? (
          <>
            <Selector
              label="Mode"
              value={state.videoMode}
              onChange={(value) =>
                onStateChange({ ...state, videoMode: value as VideoMode })
              }
              options={[
                { value: 'prompt', label: 'Prompt-only (Kling O3)' },
                { value: 'avatar', label: 'Avatar (Character 3)' },
              ]}
              disabled={isGenerating}
            />
            <Selector
              label="Aspect"
              value={state.videoAspect}
              onChange={(value) => onStateChange({ ...state, videoAspect: value })}
              options={VIDEO_ASPECTS.map((a) => ({ value: a, label: a }))}
              disabled={isGenerating}
            />
            <Selector
              label="Duration"
              value={String(state.videoDurationMs)}
              onChange={(value) =>
                onStateChange({ ...state, videoDurationMs: Number(value) })
              }
              options={VIDEO_DURATIONS_MS.map((d) => ({
                value: String(d.value),
                label: d.label,
              }))}
              disabled={isGenerating}
            />
            {state.videoMode === 'avatar' ? (
              <PortraitField
                portraitUrl={state.videoPortraitUrl}
                onUploadChange={handlePortraitChange}
                onClear={() =>
                  onStateChange({ ...state, videoPortraitUrl: null })
                }
                disabled={isGenerating}
              />
            ) : null}
          </>
        ) : null}

        {activeTool === 'music' ? (
          <>
            <Selector
              label="Duration"
              value={String(state.musicDurationSec)}
              onChange={(value) =>
                onStateChange({ ...state, musicDurationSec: Number(value) })
              }
              options={MUSIC_DURATIONS_SEC.map((d) => ({
                value: String(d.value),
                label: d.label,
              }))}
              disabled={isGenerating}
            />
            <Selector
              label="Style"
              value={state.musicStyle}
              onChange={(value) => onStateChange({ ...state, musicStyle: value })}
              options={MUSIC_STYLES.map((s) => ({ value: s, label: s }))}
              disabled={isGenerating}
            />
          </>
        ) : null}

        {activeTool === 'text' ? (
          <Selector
            label="Kind"
            value={state.textKind}
            onChange={(value) => onStateChange({ ...state, textKind: value })}
            options={TEXT_KINDS.map((t) => ({ value: t.value, label: t.label }))}
            disabled={isGenerating}
          />
        ) : null}
      </div>
    </form>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

interface SelectorProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
  disabled: boolean;
}

function Selector({ label, value, onChange, options, disabled }: SelectorProps) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>{label}</span>
      <div className="w-44">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger
            className="h-9 text-sm"
            disabled={disabled}
            aria-label={label}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </label>
  );
}

interface PortraitFieldProps {
  portraitUrl: string | null;
  onUploadChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  disabled: boolean;
}

function PortraitField({
  portraitUrl,
  onUploadChange,
  onClear,
  disabled,
}: PortraitFieldProps) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>Portrait</span>
      {portraitUrl ? (
        <div className="flex items-center gap-2">
          <Image
            src={portraitUrl}
            alt="Selected portrait"
            unoptimized
            width={36}
            height={36}
            className="h-9 w-9 rounded-md border border-border-light object-cover"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClear}
            disabled={disabled}
          >
            Remove
          </Button>
        </div>
      ) : (
        <label
          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm hover:bg-accent hover:text-accent-foreground"
        >
          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
          Upload portrait
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={onUploadChange}
            disabled={disabled}
          />
        </label>
      )}
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function getPromptPlaceholder(tool: StudioTool): string {
  switch (tool) {
    case 'image':
      return 'Describe the image you want to generate...';
    case 'video':
      return 'Describe the video scene, action, or dialogue...';
    case 'music':
      return 'Describe the mood, instruments, and vibe...';
    case 'text':
      return 'Describe what you want written...';
  }
}
