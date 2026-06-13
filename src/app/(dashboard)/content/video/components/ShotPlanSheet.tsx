'use client';

/**
 * ShotPlanSheet — OpenArt "Smart Shot"-style production sheet, in our design system.
 *
 * Renders the 4-section, field-addressable Shot Plan from the pipeline store and
 * makes EVERY field editable two ways:
 *   (a) Direct manual edit — inline Input/Textarea/Select → applyShotPlanEdit →
 *       setShotPlan (drafts autosave through the existing store + project save).
 *   (b) "Ask AI" per field — a sparkle control opening a tiny instruction box →
 *       POST /api/content/shot-plan/edit-field → setShotPlan(returned plan).
 *
 * Sections:
 *   1. Header / Shared Choices — title, cut count, palette swatches, environment
 *      fingerprint, mood keywords, cinematography notes, art style.
 *   2. Cast — sharedChoices.cast members (name/role + reference thumbnail) with
 *      an AvatarPicker (in a Dialog) to add/change cast.
 *   3. Storyboard — ordered per-shot cards (title/action/environment/camera/
 *      lighting/mood/duration/transition/dialogue + keyframe slot), with
 *      regenerate (stub), reorder, add/delete, transition toggle, and the
 *      upstreamChanged "May need review" badge (Keep / Rerun).
 *   4. Lighting / Mood / Style summary.
 *
 * Reuses: AvatarPicker, CinematicControlsPanel (advanced camera editor in a
 * Dialog), ConstructedPromptDisplay (assembledPrompt), the typography + Button +
 * Input + Dialog + Card design-system primitives, and the shot-plan-edit /
 * shot-plan-blank pure helpers. NO new top-level page — it lives inside the
 * existing /content/video Storyboard step (toggled from StepStoryboard).
 */

import { useCallback, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  Sparkles,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Users,
  Loader2,
  AlertCircle,
  Wand2,
  Camera,
  Film,
  ImageIcon,
  Scissors,
  Link2,
  Check,
  X,
  RefreshCw,
  ListVideo,
  Palette,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  SectionTitle,
  SubsectionTitle,
  CardTitle,
  SectionDescription,
  Caption,
} from '@/components/ui/typography';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useVideoPipelineStore } from '@/lib/stores/video-pipeline-store';
import { CinematicControlsPanel } from '@/components/studio/CinematicControlsPanel';
import { ConstructedPromptDisplay } from '@/components/studio/ConstructedPromptDisplay';
import { AvatarPicker } from './AvatarPicker';
import {
  applyShotPlanEdit,
  clearUpstreamChanged,
  type ShotPlanEdit,
} from '@/lib/video/shot-plan-edit';
import {
  makeBlankShotPlan,
  makeBlankShot,
  castMemberFromProfile,
} from '@/lib/video/shot-plan-blank';
import type {
  ShotPlan,
  ShotPlanShot,
  ShotPlanCastMember,
  ShotPlanShotTransition,
} from '@/types/shot-plan';
import type { CinematicConfig } from '@/types/creative-studio';

// ============================================================================
// API response shapes
// ============================================================================

interface GenerateResponse {
  success: boolean;
  plan?: ShotPlan;
  error?: string;
}

interface EditFieldResponse {
  success: boolean;
  plan?: ShotPlan;
  flaggedDownstreamShotIds?: string[];
  error?: string;
}

type EditTarget = 'shared' | 'shot' | 'plan';

/** Map a shot's camera package + look fields onto a CinematicConfig (display). */
function shotCameraToConfig(shot: ShotPlanShot): CinematicConfig {
  return {
    ...(shot.camera.shotType ? { shotType: shot.camera.shotType } : {}),
    ...(shot.camera.movement ? { camera: shot.camera.movement } : {}),
    ...(shot.camera.lens ? { lensType: shot.camera.lens } : {}),
    ...(shot.lighting ? { lighting: shot.lighting } : {}),
    ...(shot.mood ? { atmosphere: shot.mood } : {}),
  };
}

// ============================================================================
// Ask-AI per-field popover (Dialog) — the "Ask AI" half of every field edit
// ============================================================================

interface AskAiState {
  target: EditTarget;
  field: string;
  shotId?: string;
  label: string;
}

function AskAiDialog({
  state,
  isSubmitting,
  error,
  onSubmit,
  onClose,
}: {
  state: AskAiState | null;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (instruction: string) => void;
  onClose: () => void;
}) {
  const [instruction, setInstruction] = useState('');

  const handleClose = useCallback(() => {
    setInstruction('');
    onClose();
  }, [onClose]);

  return (
    <Dialog open={state !== null} onOpenChange={(o) => { if (!o) { handleClose(); } }}>
      <DialogContent className="bg-card border border-border-strong max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Sparkles className="w-4 h-4 text-primary" />
            Ask AI to revise {state?.label ?? 'this field'}
          </DialogTitle>
          <DialogDescription>
            Describe the change in plain language. Only this one field changes — the rest
            of your plan stays exactly as it is.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            rows={3}
            autoFocus
            placeholder="e.g. make it punchier, set it at dusk, add more tension…"
            className="w-full rounded-md border border-border-strong bg-surface-elevated px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-y"
          />
          {error && (
            <div className="flex items-center gap-2 text-xs text-destructive">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              disabled={isSubmitting || instruction.trim().length === 0}
              onClick={() => onSubmit(instruction.trim())}
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              {isSubmitting ? 'Revising…' : 'Revise field'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Small sparkle "Ask AI" trigger
// ============================================================================

function AskAiButton({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-primary"
    >
      <Sparkles className="w-3.5 h-3.5" />
    </button>
  );
}

// ============================================================================
// EditableText — manual inline edit + Ask AI, the field-edit primitive
// ============================================================================

function EditableText({
  label,
  value,
  multiline,
  placeholder,
  onCommit,
  onAskAi,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  placeholder?: string;
  onCommit: (next: string) => void;
  onAskAi: () => void;
}) {
  const [draft, setDraft] = useState(value);
  // Keep local draft in sync when the underlying value changes from elsewhere
  // (e.g. an Ask-AI edit) — compare-and-set avoids clobbering active typing.
  if (draft !== value && document.activeElement?.getAttribute('data-field') !== label) {
    setDraft(value);
  }

  const commit = useCallback(() => {
    if (draft !== value) {
      onCommit(draft);
    }
  }, [draft, value, onCommit]);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Caption className="font-medium text-muted-foreground">{label}</Caption>
        <AskAiButton onClick={onAskAi} title={`Ask AI to revise ${label.toLowerCase()}`} />
      </div>
      {multiline ? (
        <textarea
          data-field={label}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          rows={2}
          placeholder={placeholder}
          className="w-full rounded-md border border-border-strong bg-surface-elevated px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-y"
        />
      ) : (
        <Input
          data-field={label}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          placeholder={placeholder}
          className="bg-surface-elevated border-border-strong text-foreground placeholder:text-muted-foreground"
        />
      )}
    </div>
  );
}

// ============================================================================
// Tag list editor (palette names, mood keywords, cinematography notes)
// ============================================================================

function TagListEditor({
  label,
  items,
  placeholder,
  onCommit,
  onAskAi,
}: {
  label: string;
  items: string[];
  placeholder: string;
  onCommit: (next: string[]) => void;
  onAskAi: () => void;
}) {
  const [draft, setDraft] = useState('');

  const addItem = useCallback(() => {
    const v = draft.trim();
    if (v.length === 0) {
      return;
    }
    onCommit([...items, v]);
    setDraft('');
  }, [draft, items, onCommit]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Caption className="font-medium text-muted-foreground">{label}</Caption>
        <AskAiButton onClick={onAskAi} title={`Ask AI to revise ${label.toLowerCase()}`} />
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, i) => (
            <span
              key={`${item}-${i}`}
              className="inline-flex items-center gap-1 rounded-full border border-border-light bg-surface-elevated px-2.5 py-0.5 text-xs text-foreground"
            >
              {item}
              <button
                type="button"
                onClick={() => onCommit(items.filter((_, idx) => idx !== i))}
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${item}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
          placeholder={placeholder}
          className="bg-surface-elevated border-border-strong text-foreground placeholder:text-muted-foreground"
        />
        <Button variant="outline" size="sm" onClick={addItem} disabled={draft.trim().length === 0}>
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Color palette editor (swatches use the stored hex via inline style — the one
// legit dynamic-data exception to the no-inline-color rule)
// ============================================================================

function PaletteEditor({
  swatches,
  onCommit,
  onAskAi,
}: {
  swatches: ShotPlan['sharedChoices']['colorPalette'];
  onCommit: (next: ShotPlan['sharedChoices']['colorPalette']) => void;
  onAskAi: () => void;
}) {
  const [name, setName] = useState('');
  const [hex, setHex] = useState('#2563eb');

  const addSwatch = useCallback(() => {
    if (name.trim().length === 0) {
      return;
    }
    onCommit([...swatches, { name: name.trim(), hex }]);
    setName('');
  }, [name, hex, swatches, onCommit]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Caption className="flex items-center gap-1.5 font-medium text-muted-foreground">
          <Palette className="w-3.5 h-3.5" /> Color palette
        </Caption>
        <AskAiButton onClick={onAskAi} title="Ask AI to revise the color palette" />
      </div>
      {swatches.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {swatches.map((sw, i) => (
            <span
              key={`${sw.hex}-${i}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-border-light bg-surface-elevated px-2 py-0.5 text-xs text-foreground"
            >
              {/* Palette swatch — stored hex is dynamic data (allowed inline). */}
              <span
                className="h-3.5 w-3.5 rounded-full border border-border-light"
                style={{ backgroundColor: sw.hex }}
                aria-hidden
              />
              {sw.name}
              <button
                type="button"
                onClick={() => onCommit(swatches.filter((_, idx) => idx !== i))}
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${sw.name}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={hex}
          onChange={(e) => setHex(e.target.value)}
          aria-label="Swatch color"
          className="h-9 w-9 cursor-pointer rounded-md border border-border-strong bg-surface-elevated p-0.5"
        />
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSwatch(); } }}
          placeholder="Swatch name, e.g. cold steel blue"
          className="bg-surface-elevated border-border-strong text-foreground placeholder:text-muted-foreground"
        />
        <Button variant="outline" size="sm" onClick={addSwatch} disabled={name.trim().length === 0}>
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Cast member card
// ============================================================================

function CastCard({ member, onRemove }: { member: ShotPlanCastMember; onRemove: () => void }) {
  const [imgBroken, setImgBroken] = useState(false);
  const thumb = member.referenceImageUrls[0];
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border-strong bg-card p-3">
      <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full bg-surface-elevated">
        {thumb && !imgBroken ? (
          <Image src={thumb} alt={member.name} fill unoptimized className="object-cover" onError={() => setImgBroken(true)} />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-muted-foreground">
            <Users className="h-5 w-5" />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{member.name}</p>
        {member.role && <Caption className="capitalize">{member.role}</Caption>}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-destructive"
        aria-label={`Remove ${member.name} from cast`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

// ============================================================================
// Shot card — every per-shot field, manual + Ask AI, plus shot-level actions
// ============================================================================

interface ShotCardProps {
  plan: ShotPlan;
  shot: ShotPlanShot;
  position: number;
  total: number;
  onEditField: (field: keyof ShotPlanShot, value: ShotPlanShot[keyof ShotPlanShot]) => void;
  onAskAi: (field: keyof ShotPlanShot, label: string) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
  onKeepUpstream: () => void;
  onRerun: () => void;
  onRegenerate: () => void;
  onOpenCamera: () => void;
}

function ShotCard({
  plan,
  shot,
  position,
  total,
  onEditField,
  onAskAi,
  onMove,
  onDelete,
  onKeepUpstream,
  onRerun,
  onRegenerate,
  onOpenCamera,
}: ShotCardProps) {
  const [imgBroken, setImgBroken] = useState(false);
  const keyframe = shot.generated?.videoUrl ?? shot.generated?.lastFrameUrl ?? null;
  const castNames = shot.castMemberIds
    .map((id) => plan.sharedChoices.cast.find((c) => c.characterId === id)?.name)
    .filter((n): n is string => Boolean(n));

  const cameraSummary = [shot.camera.shotType, shot.camera.movement, shot.camera.lens]
    .filter((p): p is string => Boolean(p?.trim()))
    .join(' · ');

  const toggleTransition = useCallback(() => {
    const next: ShotPlanShotTransition = shot.transitionIn === 'continue' ? 'cut' : 'continue';
    onEditField('transitionIn', next);
  }, [shot.transitionIn, onEditField]);

  return (
    <div className="rounded-2xl border border-border-strong bg-card p-6 space-y-4">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-xs font-bold text-primary">
            {position + 1}
          </span>
          {/* Transition toggle (first shot is always a cut) */}
          {position === 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-border-light px-2 py-0.5 text-xs text-muted-foreground">
              <Scissors className="w-3 h-3" /> Opening cut
            </span>
          ) : (
            <button
              type="button"
              onClick={toggleTransition}
              title="Toggle how this shot begins"
              className="inline-flex items-center gap-1 rounded-full border border-border-light bg-surface-elevated px-2 py-0.5 text-xs text-foreground transition-colors hover:border-primary"
            >
              {shot.transitionIn === 'continue' ? (
                <><Link2 className="w-3 h-3 text-primary" /> Continue</>
              ) : (
                <><Scissors className="w-3 h-3 text-primary" /> Cut</>
              )}
            </button>
          )}
          {shot.upstreamChanged && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">
              <AlertCircle className="w-3 h-3" /> May need review
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={position === 0}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground disabled:opacity-30"
            aria-label="Move shot up"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={position === total - 1}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground disabled:opacity-30"
            aria-label="Move shot down"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-destructive"
            aria-label="Delete shot"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Upstream-changed actions */}
      {shot.upstreamChanged && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
          <Caption className="text-amber-400/90">
            An earlier shot changed — this one may need to be regenerated.
          </Caption>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={onKeepUpstream}>
              <Check className="w-3.5 h-3.5" /> Keep this output
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={onRerun} disabled title="Rerun is wired in the generation step">
              <RefreshCw className="w-3.5 h-3.5" /> Rerun
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,_240px)_1fr] gap-4">
        {/* Keyframe slot */}
        <div className="space-y-2">
          <div className="relative aspect-video overflow-hidden rounded-xl border border-border-strong bg-surface-elevated">
            {keyframe && !imgBroken ? (
              <Image src={keyframe} alt={`Shot ${position + 1} keyframe`} fill unoptimized className="object-cover" onError={() => setImgBroken(true)} />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground">
                <ImageIcon className="h-7 w-7" />
                <Caption>No keyframe yet</Caption>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5"
              onClick={onRegenerate}
              disabled
              title="Single-shot generation is wired in the generation step"
            >
              <Wand2 className="w-3.5 h-3.5" /> Regenerate shot
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={onOpenCamera} title="Open the advanced camera editor">
              <Camera className="w-3.5 h-3.5" />
            </Button>
          </div>
          {castNames.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Users className="h-3 w-3 text-muted-foreground" />
              {castNames.map((n) => (
                <span key={n} className="rounded-full bg-surface-elevated px-2 py-0.5 text-[11px] text-foreground">{n}</span>
              ))}
            </div>
          )}
        </div>

        {/* Fields */}
        <div className="space-y-3">
          <EditableText
            label="Title"
            value={shot.title}
            placeholder="e.g. The hook"
            onCommit={(v) => onEditField('title', v)}
            onAskAi={() => onAskAi('title', 'the shot title')}
          />
          <EditableText
            label="Action"
            value={shot.action}
            multiline
            placeholder="What happens on screen…"
            onCommit={(v) => onEditField('action', v)}
            onAskAi={() => onAskAi('action', 'the action')}
          />
          <EditableText
            label="Environment"
            value={shot.environment}
            multiline
            placeholder="This shot's setting (consistent with the world)…"
            onCommit={(v) => onEditField('environment', v)}
            onAskAi={() => onAskAi('environment', 'the environment')}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <EditableText
              label="Lighting"
              value={shot.lighting ?? ''}
              placeholder="e.g. soft window light"
              onCommit={(v) => onEditField('lighting', v || undefined)}
              onAskAi={() => onAskAi('lighting', 'the lighting')}
            />
            <EditableText
              label="Mood"
              value={shot.mood ?? ''}
              placeholder="e.g. tense, hopeful"
              onCommit={(v) => onEditField('mood', v || undefined)}
              onAskAi={() => onAskAi('mood', 'the mood')}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Caption className="font-medium text-muted-foreground">Duration (seconds)</Caption>
              <Input
                type="number"
                min={1}
                max={120}
                value={shot.durationSeconds}
                onChange={(e) => onEditField('durationSeconds', Math.max(1, Math.min(120, Number(e.target.value) || 1)))}
                className="bg-surface-elevated border-border-strong text-foreground"
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Caption className="font-medium text-muted-foreground">Camera</Caption>
                <AskAiButton onClick={() => onAskAi('camera', 'the camera package')} title="Ask AI to revise the camera" />
              </div>
              <button
                type="button"
                onClick={onOpenCamera}
                className="flex w-full items-center gap-2 rounded-md border border-border-strong bg-surface-elevated px-3 py-2 text-left text-sm text-foreground transition-colors hover:border-primary"
              >
                <Camera className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="truncate">{cameraSummary || 'Set shot type, movement, lens…'}</span>
              </button>
            </div>
          </div>
          <EditableText
            label="Dialogue / Voiceover"
            value={shot.dialogue ?? ''}
            multiline
            placeholder="Spoken line (optional)…"
            onCommit={(v) => onEditField('dialogue', v || undefined)}
            onAskAi={() => onAskAi('dialogue', 'the dialogue')}
          />
          {/* assembledPrompt override via ConstructedPromptDisplay */}
          <div className="space-y-1">
            <Caption className="font-medium text-muted-foreground">Assembled prompt (override)</Caption>
            <ConstructedPromptDisplay
              basePrompt={shot.assembledPrompt ?? shot.action}
              config={shotCameraToConfig(shot)}
              onEdit={(text) => onEditField('assembledPrompt', text.trim() ? text.trim() : undefined)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Camera editor dialog — reuses the full CinematicControlsPanel
// ============================================================================

function CameraDialog({
  shot,
  onClose,
  onCommit,
}: {
  shot: ShotPlanShot | null;
  onClose: () => void;
  onCommit: (camera: ShotPlanShot['camera']) => void;
}) {
  // Map the shot's camera onto a CinematicConfig the panel understands and back.
  const [config, setConfig] = useState<CinematicConfig>({});

  // Seed config when a shot is opened.
  const seedKey = shot?.id ?? null;
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (shot && seededFor !== seedKey) {
    setSeededFor(seedKey);
    setConfig({
      ...(shot.camera.shotType ? { shotType: shot.camera.shotType } : {}),
      ...(shot.camera.lens ? { lensType: shot.camera.lens } : {}),
      ...(shot.camera.movement ? { camera: shot.camera.movement } : {}),
    });
  }

  const handleSave = useCallback(() => {
    onCommit({
      ...(config.shotType ? { shotType: config.shotType } : {}),
      ...(config.camera ? { movement: config.camera } : {}),
      ...(config.lensType ? { lens: config.lensType } : {}),
    });
  }, [config, onCommit]);

  return (
    <Dialog open={shot !== null} onOpenChange={(o) => { if (!o) { onClose(); } }}>
      <DialogContent className="bg-card border border-border-strong max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Camera className="w-4 h-4 text-primary" /> Camera &amp; look
          </DialogTitle>
          <DialogDescription>
            Direct the shot like a cinematographer — shot type, movement, lens and the full
            look surface. Saving updates this shot&apos;s camera package.
          </DialogDescription>
        </DialogHeader>
        <CinematicControlsPanel config={config} onChange={setConfig} compact={false} studioMode="advanced" medium="video" />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" className="gap-1.5" onClick={handleSave}>
            <Check className="w-3.5 h-3.5" /> Save camera
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Entry screen — Generate with AI / Start blank
// ============================================================================

function EntryScreen({
  onGenerate,
  onStartBlank,
  isGenerating,
  error,
}: {
  onGenerate: (brief: string) => void;
  onStartBlank: () => void;
  isGenerating: boolean;
  error: string | null;
}) {
  const [brief, setBrief] = useState('');
  return (
    <div className="rounded-2xl border border-border-strong border-dashed bg-card p-8 space-y-5">
      <div className="text-center space-y-1">
        <ListVideo className="mx-auto h-10 w-10 text-muted-foreground" />
        <SubsectionTitle>Build a Shot Plan</SubsectionTitle>
        <SectionDescription className="mx-auto max-w-md">
          A production sheet for your video — a shared look bible plus an ordered set of shots,
          every field editable by hand or with AI. Describe your video and we&apos;ll draft the
          plan and cast your saved characters, or start blank and fill it in yourself.
        </SectionDescription>
      </div>
      <div className="mx-auto max-w-xl space-y-3">
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={3}
          placeholder="e.g. A 30-second ad showing a stressed sales rep discovering SalesVelocity and closing deals faster."
          className="w-full rounded-md border border-border-strong bg-surface-elevated px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-y"
        />
        {error && (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {error}
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            className="gap-2"
            disabled={isGenerating || brief.trim().length === 0}
            onClick={() => onGenerate(brief.trim())}
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isGenerating ? 'Drafting your plan…' : 'Generate with AI'}
          </Button>
          <Button variant="outline" className="gap-2" onClick={onStartBlank} disabled={isGenerating}>
            <Plus className="w-4 h-4" /> Start blank / fill manually
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main component
// ============================================================================

export function ShotPlanSheet() {
  const authFetch = useAuthFetch();
  const shotPlan = useVideoPipelineStore((s) => s.shotPlan);
  const setShotPlan = useVideoPipelineStore((s) => s.setShotPlan);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [askAi, setAskAi] = useState<AskAiState | null>(null);
  const [askAiSubmitting, setAskAiSubmitting] = useState(false);
  const [askAiError, setAskAiError] = useState<string | null>(null);
  const [castPickerOpen, setCastPickerOpen] = useState(false);
  const [cameraShotId, setCameraShotId] = useState<string | null>(null);

  const cameraShot = useMemo(
    () => (cameraShotId ? shotPlan?.shots.find((s) => s.id === cameraShotId) ?? null : null),
    [cameraShotId, shotPlan],
  );

  // ── Apply a typed edit immutably and store it (autosaves via the store) ──
  const applyEdit = useCallback(
    (edit: ShotPlanEdit) => {
      if (!shotPlan) {
        return;
      }
      try {
        const next = applyShotPlanEdit(shotPlan, edit);
        setShotPlan(next);
      } catch {
        // An out-of-contract value is rejected; the field reverts on next render.
      }
    },
    [shotPlan, setShotPlan],
  );

  // ── Generate / start blank ──
  const handleGenerate = useCallback(
    async (brief: string) => {
      setIsGenerating(true);
      setGenerateError(null);
      try {
        const res = await authFetch('/api/content/shot-plan/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brief }),
        });
        const data = (await res.json()) as GenerateResponse;
        if (!res.ok || !data.success || !data.plan) {
          throw new Error(data.error ?? 'Could not generate a Shot Plan');
        }
        setShotPlan(data.plan);
      } catch (err) {
        setGenerateError(err instanceof Error ? err.message : 'Could not generate a Shot Plan');
      } finally {
        setIsGenerating(false);
      }
    },
    [authFetch, setShotPlan],
  );

  const handleStartBlank = useCallback(() => {
    setShotPlan(makeBlankShotPlan());
  }, [setShotPlan]);

  // ── Ask-AI submit ──
  const handleAskAiSubmit = useCallback(
    async (instruction: string) => {
      if (!shotPlan || !askAi) {
        return;
      }
      setAskAiSubmitting(true);
      setAskAiError(null);
      try {
        const res = await authFetch('/api/content/shot-plan/edit-field', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan: shotPlan,
            target: askAi.target,
            ...(askAi.shotId ? { shotId: askAi.shotId } : {}),
            field: askAi.field,
            instruction,
          }),
        });
        const data = (await res.json()) as EditFieldResponse;
        if (!res.ok || !data.success || !data.plan) {
          throw new Error(data.error ?? 'Could not revise that field');
        }
        setShotPlan(data.plan);
        setAskAi(null);
      } catch (err) {
        setAskAiError(err instanceof Error ? err.message : 'Could not revise that field');
      } finally {
        setAskAiSubmitting(false);
      }
    },
    [shotPlan, askAi, authFetch, setShotPlan],
  );

  // ── Shot-level helpers ──
  const editShotField = useCallback(
    (shotId: string, field: keyof ShotPlanShot, value: ShotPlanShot[keyof ShotPlanShot]) => {
      applyEdit({ target: 'shot', shotId, field, value });
    },
    [applyEdit],
  );

  const moveShot = useCallback(
    (shotId: string, dir: -1 | 1) => {
      if (!shotPlan) {
        return;
      }
      const ordered = [...shotPlan.shots].sort((a, b) => a.index - b.index);
      const pos = ordered.findIndex((s) => s.id === shotId);
      const target = pos + dir;
      if (pos === -1 || target < 0 || target >= ordered.length) {
        return;
      }
      // Swap indices, then re-normalize 0..n. Index edits ripple downstream flags.
      [ordered[pos], ordered[target]] = [ordered[target], ordered[pos]];
      let next = shotPlan;
      ordered.forEach((s, i) => {
        if (s.index !== i) {
          next = applyShotPlanEdit(next, { target: 'shot', shotId: s.id, field: 'index', value: i });
        }
      });
      setShotPlan(next);
    },
    [shotPlan, setShotPlan],
  );

  const addShot = useCallback(() => {
    if (!shotPlan) {
      return;
    }
    const newShot = makeBlankShot(shotPlan.shots.length);
    const nextShots = [...shotPlan.shots, newShot];
    // Re-validate via a shared edit path: bump cutCount + append shot. We mutate
    // the shots array directly then push cutCount through applyShotPlanEdit so the
    // whole plan is re-validated.
    const withShot: ShotPlan = { ...shotPlan, shots: nextShots };
    const next = applyShotPlanEdit(withShot, {
      target: 'shared',
      field: 'cutCount',
      value: nextShots.length,
    });
    setShotPlan(next);
  }, [shotPlan, setShotPlan]);

  const deleteShot = useCallback(
    (shotId: string) => {
      if (!shotPlan) {
        return;
      }
      const remaining = shotPlan.shots
        .filter((s) => s.id !== shotId)
        .sort((a, b) => a.index - b.index)
        .map((s, i) => ({ ...s, index: i }));
      const withShots: ShotPlan = { ...shotPlan, shots: remaining };
      const next = applyShotPlanEdit(withShots, {
        target: 'shared',
        field: 'cutCount',
        value: remaining.length,
      });
      setShotPlan(next);
    },
    [shotPlan, setShotPlan],
  );

  const keepUpstream = useCallback(
    (shotId: string) => {
      if (!shotPlan) {
        return;
      }
      setShotPlan(clearUpstreamChanged(shotPlan, shotId));
    },
    [shotPlan, setShotPlan],
  );

  // ── Cast helpers ──
  const addCast = useCallback(
    (member: ShotPlanCastMember) => {
      if (!shotPlan) {
        return;
      }
      if (shotPlan.sharedChoices.cast.some((c) => c.characterId === member.characterId)) {
        setCastPickerOpen(false);
        return;
      }
      applyEdit({ target: 'shared', field: 'cast', value: [...shotPlan.sharedChoices.cast, member] });
      setCastPickerOpen(false);
    },
    [shotPlan, applyEdit],
  );

  const removeCast = useCallback(
    (characterId: string) => {
      if (!shotPlan) {
        return;
      }
      applyEdit({
        target: 'shared',
        field: 'cast',
        value: shotPlan.sharedChoices.cast.filter((c) => c.characterId !== characterId),
      });
    },
    [shotPlan, applyEdit],
  );

  // ── Empty state ──
  if (!shotPlan) {
    return (
      <EntryScreen
        onGenerate={(b) => { void handleGenerate(b); }}
        onStartBlank={handleStartBlank}
        isGenerating={isGenerating}
        error={generateError}
      />
    );
  }

  const orderedShots = [...shotPlan.shots].sort((a, b) => a.index - b.index);
  const { sharedChoices } = shotPlan;

  return (
    <div className="space-y-6">
      {/* ── Section 1: Header / Shared Choices ── */}
      <div className="rounded-2xl border border-border-strong bg-card p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-3">
            <EditableText
              label="Plan title"
              value={shotPlan.title}
              placeholder="Untitled Shot Plan"
              onCommit={(v) => applyEdit({ target: 'plan', field: 'title', value: v })}
              onAskAi={() => setAskAi({ target: 'plan', field: 'title', label: 'the plan title' })}
            />
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border-light bg-surface-elevated px-3 py-1 text-xs text-muted-foreground">
            <Film className="w-3.5 h-3.5 text-primary" />
            {orderedShots.length} cut{orderedShots.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <PaletteEditor
            swatches={sharedChoices.colorPalette}
            onCommit={(v) => applyEdit({ target: 'shared', field: 'colorPalette', value: v })}
            onAskAi={() => setAskAi({ target: 'shared', field: 'colorPalette', label: 'the color palette' })}
          />
          <EditableText
            label="Environment fingerprint"
            value={sharedChoices.environmentFingerprint}
            multiline
            placeholder="The written signature of the world — your strongest consistency anchor…"
            onCommit={(v) => applyEdit({ target: 'shared', field: 'environmentFingerprint', value: v })}
            onAskAi={() => setAskAi({ target: 'shared', field: 'environmentFingerprint', label: 'the environment fingerprint' })}
          />
          <TagListEditor
            label="Mood keywords"
            items={sharedChoices.moodKeywords}
            placeholder="Add a mood keyword…"
            onCommit={(v) => applyEdit({ target: 'shared', field: 'moodKeywords', value: v })}
            onAskAi={() => setAskAi({ target: 'shared', field: 'moodKeywords', label: 'the mood keywords' })}
          />
          <TagListEditor
            label="Cinematography notes"
            items={sharedChoices.cinematographyNotes}
            placeholder="Add a cinematography note…"
            onCommit={(v) => applyEdit({ target: 'shared', field: 'cinematographyNotes', value: v })}
            onAskAi={() => setAskAi({ target: 'shared', field: 'cinematographyNotes', label: 'the cinematography notes' })}
          />
          <div className="lg:col-span-2">
            <EditableText
              label="Art style"
              value={sharedChoices.artStyle ?? ''}
              placeholder="e.g. gritty documentary, Pixar 3D…"
              onCommit={(v) => applyEdit({ target: 'shared', field: 'artStyle', value: v || undefined })}
              onAskAi={() => setAskAi({ target: 'shared', field: 'artStyle', label: 'the art style' })}
            />
          </div>
        </div>
      </div>

      {/* ── Section 2: Cast ── */}
      <div className="rounded-2xl border border-border-strong bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> Cast
          </CardTitle>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setCastPickerOpen(true)}>
            <Plus className="w-3.5 h-3.5" /> Add cast
          </Button>
        </div>
        {sharedChoices.cast.length === 0 ? (
          <SectionDescription>No cast yet. Add your saved characters to use them across shots.</SectionDescription>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {sharedChoices.cast.map((member) => (
              <CastCard key={member.characterId} member={member} onRemove={() => removeCast(member.characterId)} />
            ))}
          </div>
        )}
      </div>

      {/* ── Section 3: Storyboard ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <SectionTitle className="flex items-center gap-2">
            <ListVideo className="w-5 h-5 text-primary" /> Storyboard
          </SectionTitle>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={addShot}>
            <Plus className="w-3.5 h-3.5" /> Add shot
          </Button>
        </div>
        {orderedShots.map((shot, i) => (
          <ShotCard
            key={shot.id}
            plan={shotPlan}
            shot={shot}
            position={i}
            total={orderedShots.length}
            onEditField={(field, value) => editShotField(shot.id, field, value)}
            onAskAi={(field, label) => setAskAi({ target: 'shot', shotId: shot.id, field, label })}
            onMove={(dir) => moveShot(shot.id, dir)}
            onDelete={() => deleteShot(shot.id)}
            onKeepUpstream={() => keepUpstream(shot.id)}
            onRerun={() => { /* TODO: wire single-shot rerun in the generation step */ }}
            onRegenerate={() => { /* TODO: wire single-shot generation in the generation step */ }}
            onOpenCamera={() => setCameraShotId(shot.id)}
          />
        ))}
      </div>

      {/* ── Section 4: Lighting / Mood / Style summary ── */}
      <div className="rounded-2xl border border-border-strong bg-card p-6 space-y-3">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" /> Lighting, mood &amp; style
        </CardTitle>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Caption className="font-medium text-muted-foreground">Mood</Caption>
            <p className="text-sm text-foreground">
              {sharedChoices.moodKeywords.length > 0 ? sharedChoices.moodKeywords.join(', ') : '—'}
            </p>
          </div>
          <div className="space-y-1">
            <Caption className="font-medium text-muted-foreground">Cinematography</Caption>
            <p className="text-sm text-foreground">
              {sharedChoices.cinematographyNotes.length > 0 ? sharedChoices.cinematographyNotes.join('. ') : '—'}
            </p>
          </div>
          <div className="space-y-1">
            <Caption className="font-medium text-muted-foreground">Art style</Caption>
            <p className="text-sm text-foreground">{sharedChoices.artStyle ?? '—'}</p>
          </div>
        </div>
      </div>

      {/* ── Dialogs ── */}
      <AskAiDialog
        state={askAi}
        isSubmitting={askAiSubmitting}
        error={askAiError}
        onSubmit={(instruction) => { void handleAskAiSubmit(instruction); }}
        onClose={() => { setAskAi(null); setAskAiError(null); }}
      />

      <CameraDialog
        shot={cameraShot}
        onClose={() => setCameraShotId(null)}
        onCommit={(camera) => {
          if (cameraShot) {
            editShotField(cameraShot.id, 'camera', camera);
          }
          setCameraShotId(null);
        }}
      />

      <Dialog open={castPickerOpen} onOpenChange={setCastPickerOpen}>
        <DialogContent className="bg-card border border-border-strong max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Users className="w-4 h-4 text-primary" /> Add a character to the cast
            </DialogTitle>
            <DialogDescription>
              Pick from your saved characters. They become available to every shot in this plan.
            </DialogDescription>
          </DialogHeader>
          <AvatarPicker
            selectedAvatarId={null}
            onSelect={() => { /* handled via onProfileLoaded for full reference data */ }}
            onProfileLoaded={(profile) => addCast(castMemberFromProfile(profile))}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
