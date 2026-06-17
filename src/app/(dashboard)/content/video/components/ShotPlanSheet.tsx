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

import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
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
  ImageIcon,
  Scissors,
  Link2,
  Check,
  X,
  RefreshCw,
  ListVideo,
  Palette,
  Clock,
  CheckCircle2,
  Clapperboard,
  PlayCircle,
  Download,
  Film,
  FileUp,
  LibraryBig,
  FileVideo,
  FileText,
  File as FileIcon,
  Package,
  type LucideIcon,
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
  SubsectionTitle,
  CardTitle,
  SectionDescription,
  Caption,
} from '@/components/ui/typography';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useVideoPipelineStore } from '@/lib/stores/video-pipeline-store';
import { CinematicControlsPanel } from '@/components/studio/CinematicControlsPanel';
import { ConstructedPromptDisplay } from '@/components/studio/ConstructedPromptDisplay';
import { MediaLibraryPicker, type LibraryAsset } from '@/components/content/MediaLibraryPicker';
import { AvatarPicker } from './AvatarPicker';
import { FloorPlanCanvas } from './FloorPlanCanvas';
import { ShotPlanDocument } from './ShotPlanDocument';
import { ZoomPanViewport } from './ZoomPanViewport';
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
import { shotPlanToScenes, buildEffectiveCinematicConfig } from '@/lib/video/shot-plan-mapping';
import { writeEditorSeed, type EditorSeedClip } from '@/lib/video/editor-seed';
import type {
  ShotPlan,
  ShotPlanShot,
  ShotPlanCastMember,
  ShotPlanObject,
  ShotPlanShotTransition,
  ShotPlanShotGenerationStatus,
  ShotPlanCharacterStateRef,
  ShotPlanPropStateRef,
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

// ============================================================================
// Reference materials — upload + select-from-library, parity with the Content
// Assistant. We reuse its exact upload route, analyze route, MediaLibraryPicker,
// and chip pattern. The planner consumes each reference's description (the LLM is
// text-only), so we have the agent "understand" every file before generation.
// ============================================================================

type ReferenceKind = 'image' | 'video' | 'document' | 'other';

/** A reference the operator attached to shape the plan. */
interface ShotPlanReferenceAttachment {
  /** Local-only id so we can key + remove chips. */
  id: string;
  url: string;
  fileName: string;
  contentType: string;
  kind: ReferenceKind;
  /** Object-URL preview for images (revoked on remove). */
  previewUrl?: string;
  /** True while the agent is reading the file. */
  analyzing?: boolean;
  /** The agent's read of the file — what the planner actually consumes. */
  description?: string;
}

/** The payload shape the generate route expects for each reference. */
interface ShotPlanReferencePayload {
  url: string;
  description?: string;
  kind?: string;
}

/** Map a reference attachment onto the medium icon it should show. */
function referenceMedium(att: ShotPlanReferenceAttachment): ReferenceKind {
  if (att.kind === 'image' || att.kind === 'video' || att.kind === 'document') {
    return att.kind;
  }
  return 'other';
}

/** Map a media-library asset's type onto our reference kind. */
function libraryAssetKind(type: LibraryAsset['type']): ReferenceKind {
  if (type === 'image' || type === 'video' || type === 'document') {
    return type;
  }
  return 'other';
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
// EditableTextSimple — inline manual edit WITHOUT Ask-AI. Used for nested fields
// (e.g. per-cast-member identity) that commit through an array-replace path the
// field-scoped Ask-AI route can't address.
// ============================================================================

function EditableTextSimple({
  label,
  value,
  placeholder,
  onCommit,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
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
      <Caption className="font-medium text-muted-foreground">{label}</Caption>
      <Input
        data-field={label}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        placeholder={placeholder}
        className="bg-surface-elevated border-border-strong text-foreground placeholder:text-muted-foreground"
      />
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
// TagArrayEditor — tag-list editor WITHOUT Ask-AI, for nested array fields
// (e.g. per-cast-member accessories) committed via an array-replace path.
// ============================================================================

function TagArrayEditor({
  label,
  items,
  placeholder,
  onCommit,
}: {
  label: string;
  items: string[];
  placeholder: string;
  onCommit: (next: string[]) => void;
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
      <Caption className="font-medium text-muted-foreground">{label}</Caption>
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

// ============================================================================
// Two-step confirm remove button — first click arms, second click fires,
// auto-disarm after ~5s (project rule for destructive actions).
// ============================================================================

function ConfirmRemoveButton({
  onConfirm,
  label,
  className,
  iconClassName,
}: {
  onConfirm: () => void;
  /** Accessible label, e.g. "Remove David from cast". */
  label: string;
  /** Wrapper button classes for the disarmed (icon) state. */
  className?: string;
  /** Icon size/classes for the disarmed state. */
  iconClassName?: string;
}) {
  const [armed, setArmed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const disarm = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setArmed(false);
  }, []);

  const handleClick = useCallback(() => {
    if (armed) {
      disarm();
      onConfirm();
      return;
    }
    setArmed(true);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setArmed(false);
    }, 5000);
  }, [armed, disarm, onConfirm]);

  if (armed) {
    return (
      <span className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={handleClick}
          className="inline-flex items-center gap-1 rounded-md bg-destructive/15 px-2 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/25"
        >
          <Trash2 className="h-3 w-3" /> Click again to confirm
        </button>
        <button
          type="button"
          onClick={disarm}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
          aria-label="Cancel remove"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      title={label}
      className={className ?? 'rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-destructive'}
    >
      <Trash2 className={iconClassName ?? 'h-4 w-4'} />
    </button>
  );
}

function CastCard({
  member,
  cast,
  editing,
  onRemove,
  onCastChange,
}: {
  member: ShotPlanCastMember;
  /** The full cast array — edits clone it and replace THIS member. */
  cast: ShotPlanCastMember[];
  /** Show the inline identity & wardrobe editor (Edit mode only). */
  editing: boolean;
  onRemove: () => void;
  /** Commit a whole-array cast replacement (mirrors removeCast). */
  onCastChange: (next: ShotPlanCastMember[]) => void;
}) {
  const [imgBroken, setImgBroken] = useState(false);
  const [open, setOpen] = useState(false);
  const thumb = member.referenceImageUrls[0];

  // Update exactly THIS member (matched by characterId) and hand back the whole
  // array — the established cast-edit pattern (see removeCast).
  const patchMember = useCallback(
    (fields: Partial<ShotPlanCastMember>) => {
      onCastChange(
        cast.map((c) => (c.characterId === member.characterId ? { ...c, ...fields } : c)),
      );
    },
    [cast, member.characterId, onCastChange],
  );

  return (
    <div className="rounded-2xl border border-border-strong bg-card p-3">
      <div className="flex items-center gap-3">
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
        {editing && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            title="Identity & wardrobe"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
          >
            {open ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
          </button>
        )}
        <button
          type="button"
          onClick={onRemove}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-destructive"
          aria-label={`Remove ${member.name} from cast`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {editing && open && (
        <div className="mt-3 space-y-3 border-t border-border-light pt-3">
          <Caption className="font-medium uppercase tracking-wider text-muted-foreground">Identity &amp; wardrobe</Caption>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <EditableTextSimple
              label="Apparent age"
              value={member.apparentAge ?? ''}
              placeholder="e.g. late 30s"
              onCommit={(v) => patchMember({ apparentAge: v.trim() ? v.trim() : undefined })}
            />
            <EditableTextSimple
              label="Gender"
              value={member.gender ?? ''}
              placeholder="e.g. female, androgynous"
              onCommit={(v) => patchMember({ gender: v.trim() ? v.trim() : undefined })}
            />
            <EditableTextSimple
              label="Ethnicity"
              value={member.ethnicity ?? ''}
              placeholder="e.g. East Asian, Latina"
              onCommit={(v) => patchMember({ ethnicity: v.trim() ? v.trim() : undefined })}
            />
            <EditableTextSimple
              label="Build"
              value={member.build ?? ''}
              placeholder="e.g. tall, lean"
              onCommit={(v) => patchMember({ build: v.trim() ? v.trim() : undefined })}
            />
            <EditableTextSimple
              label="Hair color"
              value={member.hairColor ?? ''}
              placeholder="e.g. jet black"
              onCommit={(v) => patchMember({ hairColor: v.trim() ? v.trim() : undefined })}
            />
            <EditableTextSimple
              label="Hair style"
              value={member.hairStyle ?? ''}
              placeholder="e.g. slicked back"
              onCommit={(v) => patchMember({ hairStyle: v.trim() ? v.trim() : undefined })}
            />
          </div>
          <EditableTextSimple
            label="Wardrobe"
            value={member.wardrobe ?? ''}
            placeholder="The defining outfit, e.g. soaked wool trench coat"
            onCommit={(v) => patchMember({ wardrobe: v.trim() ? v.trim() : undefined })}
          />
          <TagArrayEditor
            label="Accessories"
            items={member.accessories ?? []}
            placeholder="Add an accessory, e.g. watch…"
            onCommit={(next) => patchMember({ accessories: next.length > 0 ? next : undefined })}
          />
          <div className="space-y-1">
            <Caption className="font-medium text-muted-foreground">Wardrobe across scenes</Caption>
            <select
              value={member.wardrobeMode ?? 'flexible'}
              onChange={(e) => patchMember({ wardrobeMode: e.target.value as 'flexible' | 'signature' })}
              className="w-full rounded-md border border-border-strong bg-surface-elevated px-3 py-2 text-sm text-foreground"
            >
              <option value="flexible">Flexible — re-costume per scene</option>
              <option value="signature">Signature — keep this outfit constant</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Object / prop card — mirrors CastCard; shows up to 3 reference thumbnails,
// the description, and a two-step-confirm remove.
// ============================================================================

function ObjectThumb({ url, alt }: { url: string; alt: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-background">
      {!broken ? (
        <Image src={url} alt={alt} fill unoptimized className="object-cover" onError={() => setBroken(true)} />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-muted-foreground">
          <ImageIcon className="h-5 w-5" />
        </span>
      )}
    </div>
  );
}

function ObjectCard({ object, onRemove }: { object: ShotPlanObject; onRemove: () => void }) {
  const thumbs = object.referenceImageUrls.slice(0, 3);
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border-strong bg-card p-3">
      {thumbs[0] ? (
        <ObjectThumb url={thumbs[0]} alt={object.name} />
      ) : (
        <div className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-elevated text-muted-foreground">
          <Package className="h-5 w-5" />
        </div>
      )}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-medium text-foreground">{object.name}</p>
          <ConfirmRemoveButton
            onConfirm={onRemove}
            label={`Remove ${object.name}`}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-destructive"
            iconClassName="h-4 w-4"
          />
        </div>
        {object.description && <Caption className="line-clamp-2">{object.description}</Caption>}
        {thumbs.length > 1 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {thumbs.slice(1).map((url, i) => (
              <ObjectThumb key={`${url}-${i}`} url={url} alt={`${object.name} reference ${i + 2}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Add-object dialog — name + optional description + library-picked reference
// images. Image-LIBRARY based (MediaLibraryPicker); no disk-upload flow.
// ============================================================================

function AddObjectDialog({
  open,
  onOpenChange,
  onSave,
  authFetch,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (object: ShotPlanObject) => void;
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [referenceImageUrls, setReferenceImageUrls] = useState<string[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const reset = useCallback(() => {
    setName('');
    setDescription('');
    setReferenceImageUrls([]);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        reset();
      }
      onOpenChange(next);
    },
    [reset, onOpenChange],
  );

  const addFromLibrary = useCallback((picked: LibraryAsset[]) => {
    const urls = picked.filter((a) => a.type === 'image').map((a) => a.url);
    setReferenceImageUrls((prev) => [...prev, ...urls.filter((u) => !prev.includes(u))]);
  }, []);

  const removeImage = useCallback((url: string) => {
    setReferenceImageUrls((prev) => prev.filter((u) => u !== url));
  }, []);

  const handleSave = useCallback(() => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      return;
    }
    onSave({
      id: crypto.randomUUID(),
      name: trimmed,
      referenceImageUrls,
      ...(description.trim() ? { description: description.trim() } : {}),
    });
    reset();
    onOpenChange(false);
  }, [name, description, referenceImageUrls, onSave, reset, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-card border border-border-strong max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Package className="w-4 h-4 text-primary" /> Add an object or prop
          </DialogTitle>
          <DialogDescription>
            A recurring object, prop, vehicle or product the engine should render the
            same way in every shot. Add reference images so its look stays consistent.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Caption className="font-medium text-muted-foreground">Name</Caption>
            <Input
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Weaponized drone — BARRD-9X"
              className="bg-surface-elevated border-border-strong text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div className="space-y-1">
            <Caption className="font-medium text-muted-foreground">Description (optional)</Caption>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Material/detail note, e.g. matte gunmetal, scarred armor…"
              className="w-full rounded-md border border-border-strong bg-surface-elevated px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-y"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Caption className="font-medium text-muted-foreground">Reference images</Caption>
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setLibraryOpen(true)}>
                <LibraryBig className="h-3.5 w-3.5" /> Add reference image
              </Button>
            </div>
            {referenceImageUrls.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {referenceImageUrls.map((url, i) => (
                  <div
                    key={`${url}-${i}`}
                    className="relative h-16 w-16 overflow-hidden rounded-lg border border-border-light bg-surface-elevated"
                  >
                    <Image src={url} alt={`Reference ${i + 1}`} fill sizes="64px" unoptimized className="object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(url)}
                      aria-label={`Remove reference ${i + 1}`}
                      className="absolute right-0.5 top-0.5 rounded-md bg-background/80 p-0.5 text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)}>Cancel</Button>
            <Button size="sm" className="gap-1.5" disabled={name.trim().length === 0} onClick={handleSave}>
              <Check className="w-3.5 h-3.5" /> Add object
            </Button>
          </div>
        </div>
        <MediaLibraryPicker open={libraryOpen} onOpenChange={setLibraryOpen} onSelect={addFromLibrary} authFetch={authFetch} />
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Shot card — every per-shot field, manual + Ask AI, plus shot-level actions
// ============================================================================

/** Visual descriptor for a shot's generation status badge. */
function statusBadge(status: ShotPlanShotGenerationStatus | undefined): {
  label: string;
  className: string;
  icon: 'spin' | 'check' | 'alert' | 'clock';
} | null {
  switch (status) {
    case 'processing':
      return { label: 'Generating…', className: 'border-primary/40 bg-primary/10 text-primary-light', icon: 'spin' };
    case 'completed':
      return { label: 'Generated', className: 'border-green-500/40 bg-green-500/10 text-green-400', icon: 'check' };
    case 'failed':
      return { label: 'Failed', className: 'border-destructive/40 bg-destructive/10 text-destructive', icon: 'alert' };
    case 'pending':
      return { label: 'Queued', className: 'border-border-light bg-surface-elevated text-muted-foreground', icon: 'clock' };
    default:
      return null;
  }
}

// ============================================================================
// Continuity block — the Script-Supervisor layer. For every character in this
// shot: their physical/emotional state + costume condition; for every object in
// this shot: its condition. Each commits the rebuilt array via onEditField.
// ============================================================================

function ContinuityBlock({
  shot,
  plan,
  onEditField,
}: {
  shot: ShotPlanShot;
  plan: ShotPlan;
  onEditField: (field: keyof ShotPlanShot, value: ShotPlanShot[keyof ShotPlanShot]) => void;
}) {
  const castInShot = shot.castMemberIds
    .map((id) => plan.sharedChoices.cast.find((c) => c.characterId === id))
    .filter((c): c is ShotPlanCastMember => Boolean(c));
  const objectsInShot = (shot.objectIds ?? [])
    .map((id) => (plan.sharedChoices.objects ?? []).find((o) => o.id === id))
    .filter((o): o is ShotPlanObject => Boolean(o));

  if (castInShot.length === 0 && objectsInShot.length === 0) {
    return null;
  }

  // Build the next state-ref array: replace this subject's entry (or drop it when
  // cleared) and keep every other entry untouched.
  const commitCharacterState = (
    field: 'characterStates' | 'costumeStates',
    characterId: string,
    state: string,
  ): void => {
    const current = shot[field] ?? [];
    const without = current.filter((r) => r.characterId !== characterId);
    const next: ShotPlanCharacterStateRef[] = state.trim()
      ? [...without, { characterId, state: state.trim() }]
      : without;
    onEditField(field, next.length > 0 ? next : undefined);
  };

  const commitPropState = (objectId: string, state: string): void => {
    const current = shot.propStates ?? [];
    const without = current.filter((r) => r.objectId !== objectId);
    const next: ShotPlanPropStateRef[] = state.trim()
      ? [...without, { objectId, state: state.trim() }]
      : without;
    onEditField('propStates', next.length > 0 ? next : undefined);
  };

  return (
    <div className="space-y-3 rounded-lg border border-border-light bg-surface-elevated/40 p-3">
      <Caption className="font-medium uppercase tracking-wider text-muted-foreground">Continuity</Caption>
      {castInShot.map((member) => {
        const charState = (shot.characterStates ?? []).find((r) => r.characterId === member.characterId)?.state ?? '';
        const costumeState = (shot.costumeStates ?? []).find((r) => r.characterId === member.characterId)?.state ?? '';
        return (
          <div key={member.characterId} className="space-y-2">
            <Caption className="font-medium text-foreground">{member.name}</Caption>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <EditableTextSimple
                label="State"
                value={charState}
                placeholder="e.g. exhausted, limping"
                onCommit={(v) => commitCharacterState('characterStates', member.characterId, v)}
              />
              <EditableTextSimple
                label="Costume condition"
                value={costumeState}
                placeholder="e.g. coat torn, muddy"
                onCommit={(v) => commitCharacterState('costumeStates', member.characterId, v)}
              />
            </div>
          </div>
        );
      })}
      {objectsInShot.map((object) => {
        const propState = (shot.propStates ?? []).find((r) => r.objectId === object.id)?.state ?? '';
        return (
          <EditableTextSimple
            key={object.id}
            label={`${object.name} — condition`}
            value={propState}
            placeholder="e.g. lantern lit, lantern spent"
            onCommit={(v) => commitPropState(object.id, v)}
          />
        );
      })}
    </div>
  );
}

interface ShotCardProps {
  plan: ShotPlan;
  shot: ShotPlanShot;
  position: number;
  total: number;
  /** This shot is generating right now (single-shot or part of a Generate-all run). */
  isGenerating: boolean;
  /** A keyframe still is being generated for this shot right now. */
  isKeyframing: boolean;
  /** Any generation is in flight anywhere in the plan — disables shot-level actions. */
  busy: boolean;
  onEditField: (field: keyof ShotPlanShot, value: ShotPlanShot[keyof ShotPlanShot]) => void;
  onAskAi: (field: keyof ShotPlanShot, label: string) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
  onKeepUpstream: () => void;
  onRerun: () => void;
  onRegenerate: () => void;
  onGenerateKeyframe: () => void;
  onOpenCamera: () => void;
}

function ShotCard({
  plan,
  shot,
  position,
  total,
  isGenerating,
  isKeyframing,
  busy,
  onEditField,
  onAskAi,
  onMove,
  onDelete,
  onKeepUpstream,
  onRerun,
  onRegenerate,
  onGenerateKeyframe,
  onOpenCamera,
}: ShotCardProps) {
  const [imgBroken, setImgBroken] = useState(false);
  const generatedVideoUrl = shot.generated?.videoUrl ?? null;
  // Prefer the cheap pre-video keyframe still, then the saved last frame.
  const keyframe = shot.generated?.keyframeUrl ?? shot.generated?.lastFrameUrl ?? null;
  const planObjects = plan.sharedChoices.objects ?? [];
  const selectedObjectIds = shot.objectIds ?? [];
  const badge = statusBadge(shot.generated?.status);
  const hasRun = Boolean(shot.generated?.videoUrl);
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

  const toggleObject = useCallback(
    (objectId: string) => {
      const current = shot.objectIds ?? [];
      const next = current.includes(objectId)
        ? current.filter((id) => id !== objectId)
        : [...current, objectId];
      onEditField('objectIds', next);
    },
    [shot.objectIds, onEditField],
  );

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
          {badge && (
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${badge.className}`}>
              {badge.icon === 'spin' && <Loader2 className="w-3 h-3 animate-spin" />}
              {badge.icon === 'check' && <CheckCircle2 className="w-3 h-3" />}
              {badge.icon === 'alert' && <AlertCircle className="w-3 h-3" />}
              {badge.icon === 'clock' && <Clock className="w-3 h-3" />}
              {badge.label}
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
            <Button variant="outline" size="sm" className="gap-1.5" onClick={onKeepUpstream} disabled={busy}>
              <Check className="w-3.5 h-3.5" /> Keep this output
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={onRerun}
              disabled={busy}
              title="Regenerate this shot with the updated upstream context"
            >
              {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Rerun
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,_240px)_1fr] gap-4">
        {/* Generated clip / keyframe slot */}
        <div className="space-y-2">
          <div className="relative aspect-video overflow-hidden rounded-xl border border-border-strong bg-surface-elevated">
            {generatedVideoUrl ? (
              <video
                src={generatedVideoUrl}
                poster={shot.generated?.lastFrameUrl ?? undefined}
                controls
                playsInline
                preload="metadata"
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : keyframe && !imgBroken ? (
              <Image src={keyframe} alt={`Shot ${position + 1} keyframe`} fill unoptimized className="object-cover" onError={() => setImgBroken(true)} />
            ) : isGenerating ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
                <Caption>Generating this shot…</Caption>
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground">
                <ImageIcon className="h-7 w-7" />
                <Caption>Not generated yet</Caption>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5"
              onClick={onRegenerate}
              disabled={busy}
              title={hasRun ? 'Regenerate this shot' : 'Generate this shot'}
            >
              {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              {isGenerating ? 'Generating…' : hasRun ? 'Regenerate shot' : 'Generate shot'}
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={onOpenCamera} disabled={busy} title="Open the advanced camera editor">
              <Camera className="w-3.5 h-3.5" />
            </Button>
          </div>
          {/* Cheap pre-video keyframe still — see/approve the look before the
              (expensive) full video render. */}
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5"
            onClick={onGenerateKeyframe}
            disabled={busy}
            title="Generate a quick still to preview this shot's look before the full video"
          >
            {isKeyframing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
            {isKeyframing ? 'Generating still…' : 'Preview still'}
          </Button>
          {castNames.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Users className="h-3 w-3 text-muted-foreground" />
              {castNames.map((n) => (
                <span key={n} className="rounded-full bg-surface-elevated px-2 py-0.5 text-[11px] text-foreground">{n}</span>
              ))}
            </div>
          )}
          {/* Per-shot object selection — toggle which props/objects appear in
              THIS shot. Renders nothing until objects are defined. */}
          {planObjects.length > 0 && (
            <div className="space-y-1.5">
              <Caption className="flex items-center gap-1.5 font-medium text-muted-foreground">
                <Package className="h-3 w-3" /> Objects in this shot
              </Caption>
              <div className="flex flex-wrap gap-1.5">
                {planObjects.map((obj) => {
                  const active = selectedObjectIds.includes(obj.id);
                  return (
                    <button
                      key={obj.id}
                      type="button"
                      onClick={() => toggleObject(obj.id)}
                      aria-pressed={active}
                      className={
                        active
                          ? 'inline-flex items-center gap-1 rounded-full border border-primary bg-primary/15 px-2.5 py-0.5 text-[11px] font-medium text-primary transition-colors'
                          : 'inline-flex items-center gap-1 rounded-full border border-border-light bg-surface-elevated px-2.5 py-0.5 text-[11px] text-foreground transition-colors hover:border-primary'
                      }
                    >
                      {active && <Check className="h-3 w-3" />}
                      {obj.name}
                    </button>
                  );
                })}
              </div>
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
            <EditableText
              label="Time of day"
              value={shot.timeOfDay ?? ''}
              placeholder="e.g. golden hour, night, dawn"
              onCommit={(v) => onEditField('timeOfDay', v || undefined)}
              onAskAi={() => onAskAi('timeOfDay', 'the time of day')}
            />
            <EditableText
              label="Weather"
              value={shot.weather ?? ''}
              placeholder="e.g. heavy rain, clear, fog"
              onCommit={(v) => onEditField('weather', v || undefined)}
              onAskAi={() => onAskAi('weather', 'the weather')}
            />
          </div>
          <ContinuityBlock shot={shot} plan={plan} onEditField={onEditField} />
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
              config={buildEffectiveCinematicConfig(plan, shot)}
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

/** Camera-movement options (no preset category exists for movement in the panel). */
const CAMERA_MOVEMENT_OPTIONS = [
  'static',
  'slow push-in',
  'push-in',
  'dolly out',
  'pan left',
  'pan right',
  'tilt up',
  'tilt down',
  'tracking shot',
  'crane up',
  'crane down',
  'handheld',
  'steadicam',
  'orbit',
  'zoom in',
  'zoom out',
  'crash zoom',
] as const;

/** What the camera dialog commits back: the per-shot camera + lighting/mood accents. */
interface ShotLookCommit {
  camera: ShotPlanShot['camera'];
  lighting?: string;
  mood?: string;
}

function CameraDialog({
  shot,
  onClose,
  onCommit,
}: {
  shot: ShotPlanShot | null;
  onClose: () => void;
  onCommit: (update: ShotLookCommit) => void;
}) {
  // The panel edits a CinematicConfig; we map only the PER-SHOT dimensions to/from
  // it (framing, lens, composition, angle, lighting/atmosphere accents). Movement
  // has no preset category, so it gets its own control below.
  const [config, setConfig] = useState<CinematicConfig>({});
  const [movement, setMovement] = useState('');

  // Seed config when a shot is opened.
  const seedKey = shot?.id ?? null;
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (shot && seededFor !== seedKey) {
    setSeededFor(seedKey);
    setConfig({
      ...(shot.camera.shotType ? { shotType: shot.camera.shotType } : {}),
      ...(shot.camera.lensType ? { lensType: shot.camera.lensType } : {}),
      ...(shot.camera.focalLength ? { focalLength: shot.camera.focalLength } : {}),
      ...(shot.camera.composition ? { composition: shot.camera.composition } : {}),
      ...(shot.camera.viewingDirection ? { viewingDirection: shot.camera.viewingDirection } : {}),
      ...(shot.camera.subjectUnawareOfCamera ? { subjectUnawareOfCamera: true } : {}),
      ...(shot.lighting ? { lighting: shot.lighting } : {}),
      ...(shot.mood ? { atmosphere: shot.mood } : {}),
    });
    setMovement(shot.camera.movement ?? '');
  }

  // Preserve a planner/custom movement value that isn't in our preset list.
  const movementOptions =
    movement && !CAMERA_MOVEMENT_OPTIONS.includes(movement as (typeof CAMERA_MOVEMENT_OPTIONS)[number])
      ? [movement, ...CAMERA_MOVEMENT_OPTIONS]
      : [...CAMERA_MOVEMENT_OPTIONS];

  const handleSave = useCallback(() => {
    if (!shot) {
      return;
    }
    const camera: ShotPlanShot['camera'] = {
      ...(config.shotType ? { shotType: config.shotType } : {}),
      ...(movement.trim() ? { movement: movement.trim() } : {}),
      // Preserve any legacy free-text lens; lensType is the preset path.
      ...(shot.camera.lens ? { lens: shot.camera.lens } : {}),
      ...(config.lensType ? { lensType: config.lensType } : {}),
      ...(config.focalLength ? { focalLength: config.focalLength } : {}),
      ...(config.composition ? { composition: config.composition } : {}),
      ...(config.viewingDirection ? { viewingDirection: config.viewingDirection } : {}),
      ...(config.subjectUnawareOfCamera ? { subjectUnawareOfCamera: true } : {}),
    };
    onCommit({
      camera,
      lighting: config.lighting?.trim() ? config.lighting.trim() : undefined,
      mood: config.atmosphere?.trim() ? config.atmosphere.trim() : undefined,
    });
  }, [config, movement, shot, onCommit]);

  return (
    <Dialog open={shot !== null} onOpenChange={(o) => { if (!o) { onClose(); } }}>
      <DialogContent className="bg-card border border-border-strong max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Camera className="w-4 h-4 text-primary" /> Camera &amp; look — this shot
          </DialogTitle>
          <DialogDescription>
            Direct THIS shot — framing, lens, composition, angle and lighting/mood accents.
            Your project-wide look (movie look, film stock, camera body, color grade) is set
            once in the Look Bible and inherited here automatically.
          </DialogDescription>
        </DialogHeader>
        {/* Camera movement — dedicated control (no preset category for it). */}
        <div className="space-y-1">
          <Caption className="font-medium text-muted-foreground">Camera movement</Caption>
          <select
            value={movement}
            onChange={(e) => setMovement(e.target.value)}
            className="w-full rounded-md border border-border-strong bg-surface-elevated px-3 py-2 text-sm text-foreground"
          >
            <option value="">No movement specified</option>
            {movementOptions.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <CinematicControlsPanel config={config} onChange={setConfig} compact={false} studioMode="advanced" medium="video" />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" className="gap-1.5" onClick={handleSave}>
            <Check className="w-3.5 h-3.5" /> Save shot look
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Reference materials — upload + select-from-library (Content Assistant parity)
// ============================================================================

/**
 * Reference uploader + library picker + removable chips, reusing the exact
 * Content Assistant flow: upload → /api/settings/brand-identity/asset, then
 * "understand" each file via /api/settings/brand-identity/asset/analyze, and
 * select-from-library via the shared MediaLibraryPicker. The plan is shaped by
 * each reference's `description` (the planner is text-only).
 */
function ReferenceMaterials({
  references,
  onChange,
}: {
  references: ShotPlanReferenceAttachment[];
  onChange: (next: ShotPlanReferenceAttachment[]) => void;
}) {
  const authFetch = useAuthFetch();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Always read+write through the latest list so concurrent uploads/analyses
  // don't clobber each other.
  const refsRef = useRef<ShotPlanReferenceAttachment[]>(references);
  refsRef.current = references;
  const patch = useCallback(
    (id: string, fields: Partial<ShotPlanReferenceAttachment>) => {
      onChange(refsRef.current.map((r) => (r.id === id ? { ...r, ...fields } : r)));
    },
    [onChange],
  );
  const append = useCallback(
    (att: ShotPlanReferenceAttachment) => {
      onChange([...refsRef.current, att]);
    },
    [onChange],
  );

  // Have the agent read the file — exactly like the Content Assistant does.
  const analyze = useCallback(
    async (id: string, url: string, contentType: string, kind: ReferenceKind) => {
      patch(id, { analyzing: true });
      try {
        const res = await authFetch('/api/settings/brand-identity/asset/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, contentType, kind }),
        });
        const data = (await res.json()) as { success?: boolean; aiSummary?: string };
        const summary = res.ok && data.aiSummary ? data.aiSummary.trim() : '';
        patch(id, { analyzing: false, ...(summary ? { description: summary } : {}) });
      } catch {
        patch(id, { analyzing: false });
      }
    },
    [authFetch, patch],
  );

  const uploadOne = useCallback(
    async (file: File) => {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      const id = crypto.randomUUID();
      const previewUrl = isImage ? URL.createObjectURL(file) : undefined;

      setUploadingCount((n) => n + 1);
      try {
        const form = new FormData();
        form.append('file', file);
        const res = await authFetch('/api/settings/brand-identity/asset', { method: 'POST', body: form });
        const data = (await res.json()) as {
          success: boolean;
          url?: string;
          fileName?: string;
          contentType?: string;
          kind?: ReferenceKind;
          error?: string;
        };
        if (!res.ok || !data.success || !data.url) {
          throw new Error(data.error ?? `"${file.name}" could not be uploaded.`);
        }
        const kind: ReferenceKind = data.kind ?? (isVideo ? 'video' : isImage ? 'image' : 'other');
        append({
          id,
          url: data.url,
          fileName: data.fileName ?? file.name,
          contentType: data.contentType ?? file.type,
          kind,
          analyzing: true,
          ...(previewUrl ? { previewUrl } : {}),
        });
        void analyze(id, data.url, data.contentType ?? file.type, kind);
      } catch (err) {
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
        }
        setError(err instanceof Error ? err.message : `"${file.name}" could not be uploaded.`);
      } finally {
        setUploadingCount((n) => n - 1);
      }
    },
    [authFetch, analyze, append],
  );

  const onFileSelected = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const list = Array.from(e.target.files ?? []);
      e.target.value = '';
      setError(null);
      for (const file of list) {
        void uploadOne(file);
      }
    },
    [uploadOne],
  );

  const addFromLibrary = useCallback(
    (picked: LibraryAsset[]) => {
      for (const asset of picked) {
        const id = crypto.randomUUID();
        const kind = libraryAssetKind(asset.type);
        append({
          id,
          url: asset.url,
          fileName: asset.name,
          contentType: asset.mimeType,
          kind,
          analyzing: true,
          ...(asset.type === 'image' ? { previewUrl: asset.url } : {}),
        });
        void analyze(id, asset.url, asset.mimeType, kind);
      }
    },
    [analyze, append],
  );

  const remove = useCallback(
    (id: string) => {
      const target = refsRef.current.find((r) => r.id === id);
      if (target?.previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(target.previewUrl);
      }
      onChange(refsRef.current.filter((r) => r.id !== id));
    },
    [onChange],
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Caption className="font-medium text-muted-foreground">
          Reference materials (optional) — the look, style, world or characters to follow
        </Caption>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.md,application/pdf"
            multiple
            className="hidden"
            onChange={onFileSelected}
          />
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()}>
            <FileUp className="h-3.5 w-3.5" /> Upload
          </Button>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setLibraryOpen(true)}>
            <LibraryBig className="h-3.5 w-3.5" /> Library
          </Button>
        </div>
      </div>

      {(references.length > 0 || uploadingCount > 0) && (
        <div className="flex flex-wrap gap-2">
          {references.map((att) => {
            const medium = referenceMedium(att);
            return (
              <div
                key={att.id}
                className="flex max-w-xs items-center gap-2 rounded-xl border border-border-light bg-surface-elevated px-2 py-1.5"
              >
                <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-background">
                  {medium === 'image' && att.previewUrl ? (
                    <Image src={att.previewUrl} alt={att.fileName} fill sizes="36px" unoptimized className="object-cover" />
                  ) : medium === 'video' ? (
                    <FileVideo className="h-4 w-4 text-muted-foreground" />
                  ) : medium === 'document' ? (
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <FileIcon className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-xs text-foreground">{att.fileName}</span>
                  {att.analyzing ? (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Understanding…
                    </span>
                  ) : att.description ? (
                    <span className="truncate text-[11px] text-muted-foreground" title={att.description}>
                      ✓ Understood
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => remove(att.id)}
                  aria-label={`Remove ${att.fileName}`}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-background hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
          {uploadingCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-border-light bg-surface-elevated px-3 py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              <Caption>Uploading {uploadingCount} file{uploadingCount > 1 ? 's' : ''}…</Caption>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      <MediaLibraryPicker open={libraryOpen} onOpenChange={setLibraryOpen} onSelect={addFromLibrary} authFetch={authFetch} />
    </div>
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
  onGenerate: (brief: string, references: ShotPlanReferencePayload[]) => void;
  onStartBlank: () => void;
  isGenerating: boolean;
  error: string | null;
}) {
  const [brief, setBrief] = useState('');
  const [references, setReferences] = useState<ShotPlanReferenceAttachment[]>([]);

  const stillReading = references.some((r) => r.analyzing);

  const submit = useCallback(() => {
    const payload: ShotPlanReferencePayload[] = references.map((r) => ({
      url: r.url,
      ...(r.description ? { description: r.description } : {}),
      kind: r.kind,
    }));
    onGenerate(brief.trim(), payload);
  }, [brief, references, onGenerate]);

  return (
    <div className="rounded-2xl border border-border-strong border-dashed bg-card p-8 space-y-5">
      <div className="text-center space-y-1">
        <ListVideo className="mx-auto h-10 w-10 text-muted-foreground" />
        <SubsectionTitle>Build a Shot Doc</SubsectionTitle>
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
        <ReferenceMaterials references={references} onChange={setReferences} />
        {stillReading && (
          <Caption className="flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" /> Reading your references — they&apos;ll shape the plan.
          </Caption>
        )}
        {error && (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {error}
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            className="gap-2"
            disabled={isGenerating || stillReading || brief.trim().length === 0}
            onClick={submit}
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
// Production-sheet section frame — numbered, dense, film-studio styling
// ============================================================================

/**
 * One numbered section of the production sheet (e.g. "SECTION 1 · CHARACTERS &
 * OBJECTS"), styled like a real shot-sheet: a primary number badge, an uppercase
 * tracked title, an optional right-aligned action, and a bordered body. Sections
 * stack inside the single sheet container divided by borders (not floating cards).
 */
function SheetSection({
  number,
  title,
  icon: Icon,
  action,
  children,
}: {
  number: number;
  title: string;
  icon: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-border-strong px-6 py-5 last:border-b-0">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-xs font-bold text-primary">
            {number}
          </span>
          <Icon className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

// ============================================================================
// Storyboard strip panel — a compact numbered keyframe card (OpenArt-style)
// ============================================================================

/**
 * One panel in the horizontal storyboard strip: the keyframe still, a CUT number,
 * the transition (continue/cut), a `lens · movement · shot-size · duration`
 * metadata line, and the action. Click to open the full per-shot editor below.
 */
function StoryboardPanel({
  shot,
  position,
  selected,
  isGenerating,
  onSelect,
}: {
  shot: ShotPlanShot;
  position: number;
  selected: boolean;
  isGenerating: boolean;
  onSelect: () => void;
}) {
  const [imgBroken, setImgBroken] = useState(false);
  const still = shot.generated?.keyframeUrl ?? shot.generated?.lastFrameUrl ?? null;
  const badge = statusBadge(shot.generated?.status);
  const specs = [
    shot.camera.shotType,
    shot.camera.movement,
    shot.camera.lensType ?? shot.camera.lens ?? shot.camera.focalLength,
  ]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s));

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative flex w-56 flex-shrink-0 flex-col overflow-hidden rounded-lg border bg-card text-left transition-colors ${
        selected ? 'border-primary ring-1 ring-primary' : 'border-border-strong hover:border-primary/60'
      }`}
    >
      <div className="relative aspect-video bg-surface-elevated">
        {still && !imgBroken ? (
          <Image
            src={still}
            alt={`Shot ${position + 1} keyframe`}
            fill
            sizes="224px"
            unoptimized
            className="object-cover"
            onError={() => setImgBroken(true)}
          />
        ) : isGenerating ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <ImageIcon className="h-6 w-6" />
          </div>
        )}
        {/* Cut number + transition */}
        <div className="absolute left-1.5 top-1.5 flex items-center gap-1">
          <span className="rounded bg-background/85 px-1.5 py-0.5 text-[11px] font-bold text-primary">
            {position + 1}
          </span>
          <span className="inline-flex items-center gap-0.5 rounded bg-background/85 px-1 py-0.5 text-[10px] text-foreground">
            {shot.transitionIn === 'continue' ? (
              <><Link2 className="h-2.5 w-2.5 text-primary" /> CONT</>
            ) : (
              <><Scissors className="h-2.5 w-2.5 text-primary" /> CUT</>
            )}
          </span>
        </div>
        {badge && (
          <span
            className={`absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] ${badge.className}`}
          >
            {badge.icon === 'spin' && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
            {badge.icon === 'check' && <CheckCircle2 className="h-2.5 w-2.5" />}
            {badge.label}
          </span>
        )}
      </div>
      <div className="space-y-1 p-2">
        <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {specs.length > 0 ? specs.join(' · ') : 'camera not set'} · {shot.durationSeconds}s
        </div>
        <div className="line-clamp-2 text-xs text-foreground">
          {shot.title?.trim() || shot.action?.trim() || 'Untitled shot'}
        </div>
      </div>
    </button>
  );
}

// ============================================================================
// Main component
// ============================================================================

/** Response shape for the per-shot + all-shots generation routes. */
interface ShotGenerationResponse {
  success: boolean;
  plan?: ShotPlan;
  /** generate-all returns the partially-generated plan on a mid-run halt. */
  partialPlan?: ShotPlan;
  /** generate-all sets this when every shot rendered but the final stitch failed. */
  stitchError?: string;
  error?: string;
}

export function ShotPlanSheet() {
  const authFetch = useAuthFetch();
  const router = useRouter();
  const shotPlan = useVideoPipelineStore((s) => s.shotPlan);
  const setShotPlan = useVideoPipelineStore((s) => s.setShotPlan);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [askAi, setAskAi] = useState<AskAiState | null>(null);
  const [askAiSubmitting, setAskAiSubmitting] = useState(false);
  const [askAiError, setAskAiError] = useState<string | null>(null);
  const [castPickerOpen, setCastPickerOpen] = useState(false);
  const [cameraShotId, setCameraShotId] = useState<string | null>(null);
  // The storyboard panel currently expanded into the full per-shot editor below the strip.
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);
  // The Shot Doc stays the visual reference; clicking a storyboard opens THIS shot's
  // details in a scrollable popup (not a whole-page mode switch).
  const [detailShotId, setDetailShotId] = useState<string | null>(null);
  // Review = the cinematic production-sheet document (default); Edit = the full form.
  const [viewMode, setViewMode] = useState<'review' | 'edit'>('review');
  const [objectDialogOpen, setObjectDialogOpen] = useState(false);
  const [envLibraryOpen, setEnvLibraryOpen] = useState(false);

  // ── Shot-generation state (wires the orchestrator routes) ──
  // The set of shot ids currently rendering (single-shot or part of an all-run).
  const [generatingShotIds, setGeneratingShotIds] = useState<Set<string>>(new Set());
  // The set of shot ids whose cheap pre-video keyframe still is rendering.
  const [keyframingShotIds, setKeyframingShotIds] = useState<Set<string>>(new Set());
  // True while a Generate-all run is in flight (the whole plan is long-running).
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  // True while the final video is being stitched (manual "Build final video" path).
  const [isStitching, setIsStitching] = useState(false);
  // Plain-English generation failure surfaced to the operator (never silent).
  const [shotGenError, setShotGenError] = useState<string | null>(null);
  // While the just-generated plan's images (floor plan + keyframes) are rendering
  // so the document arrives COMPLETE for review.
  const [isRenderingSheet, setIsRenderingSheet] = useState(false);

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
          throw new Error(data.error ?? 'Could not generate a Shot Doc');
        }
        // Show the structured plan immediately…
        setShotPlan(data.plan);
        setIsGenerating(false);

        // …then render the image spread PROGRESSIVELY — one short request per asset,
        // applying each result as it lands (so images pop in one-by-one and persist),
        // instead of one multi-minute request that can drop before the browser gets it.
        // Best-effort per step: a failed asset is skipped, never aborting the rest.
        setIsRenderingSheet(true);
        // Each step reads the LATEST plan from the store (set by the prior step) so
        // results accumulate without a closure variable racing across awaits.
        const renderStep = async (step: string, shotId?: string): Promise<void> => {
          const current = useVideoPipelineStore.getState().shotPlan;
          if (!current) {
            return;
          }
          try {
            const res = await authFetch('/api/content/shot-plan/render-asset', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ plan: current, step, ...(shotId ? { shotId } : {}) }),
            });
            const d = (await res.json()) as GenerateResponse;
            if (res.ok && d.success && d.plan) {
              setShotPlan(d.plan);
            }
          } catch {
            /* best-effort — skip this asset, keep rendering the rest */
          }
        };
        try {
          await renderStep('floor-plan');
          await renderStep('environment-hero');
          await renderStep('lighting');
          await renderStep('characters');
          const shotIds = [...(useVideoPipelineStore.getState().shotPlan?.shots ?? [])]
            .sort((a, b) => a.index - b.index)
            .map((s) => s.id);
          for (const id of shotIds) {
            await renderStep('keyframe', id);
          }
        } finally {
          setIsRenderingSheet(false);
        }
      } catch (err) {
        setGenerateError(err instanceof Error ? err.message : 'Could not generate a Shot Doc');
        setIsGenerating(false);
        setIsRenderingSheet(false);
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

  // Commit the camera dialog's full per-shot look (camera + lighting + mood) in a
  // SINGLE store update — chaining edits on the accumulating plan so all three
  // stick (three separate editShotField calls would each start from a stale plan).
  const commitShotLook = useCallback(
    (shotId: string, update: ShotLookCommit) => {
      if (!shotPlan) {
        return;
      }
      try {
        let next = applyShotPlanEdit(shotPlan, { target: 'shot', shotId, field: 'camera', value: update.camera });
        next = applyShotPlanEdit(next, { target: 'shot', shotId, field: 'lighting', value: update.lighting });
        next = applyShotPlanEdit(next, { target: 'shot', shotId, field: 'mood', value: update.mood });
        setShotPlan(next);
      } catch {
        // An out-of-contract value is rejected; the fields revert on next render.
      }
    },
    [shotPlan, setShotPlan],
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

  // ── Generation: any run in flight disables editing/competing generations ──
  const busy = isGeneratingAll || isStitching || generatingShotIds.size > 0 || keyframingShotIds.size > 0;

  // Generate (or regenerate) ONE shot through the orchestrator route. The route
  // returns the updated plan with this shot's `generated` field written; we swap
  // it into the store so the status badge + clip render immediately.
  const generateOneShot = useCallback(
    async (shotId: string) => {
      const plan = useVideoPipelineStore.getState().shotPlan;
      if (!plan || busy) {
        return;
      }
      setShotGenError(null);
      setGeneratingShotIds((prev) => new Set(prev).add(shotId));
      try {
        const res = await authFetch('/api/content/shot-plan/generate-shot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan, shotId }),
        });
        const data = (await res.json()) as ShotGenerationResponse;
        if (!res.ok || !data.success || !data.plan) {
          throw new Error(data.error ?? 'That shot could not be generated. Please try again.');
        }
        setShotPlan(data.plan);
      } catch (err) {
        setShotGenError(err instanceof Error ? err.message : 'That shot could not be generated. Please try again.');
      } finally {
        setGeneratingShotIds((prev) => {
          const next = new Set(prev);
          next.delete(shotId);
          return next;
        });
      }
    },
    [authFetch, setShotPlan, busy],
  );

  // Generate a CHEAP pre-video keyframe still for ONE shot. Mirrors
  // generateOneShot but hits the keyframe route and tracks its own id set.
  const generateOneKeyframe = useCallback(
    async (shotId: string) => {
      const plan = useVideoPipelineStore.getState().shotPlan;
      if (!plan || busy) {
        return;
      }
      setShotGenError(null);
      setKeyframingShotIds((prev) => new Set(prev).add(shotId));
      try {
        const res = await authFetch('/api/content/shot-plan/generate-keyframe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan, shotId }),
        });
        const data = (await res.json()) as ShotGenerationResponse;
        if (!res.ok || !data.success || !data.plan) {
          throw new Error(data.error ?? 'That still could not be generated. Please try again.');
        }
        setShotPlan(data.plan);
      } catch (err) {
        setShotGenError(err instanceof Error ? err.message : 'That still could not be generated. Please try again.');
      } finally {
        setKeyframingShotIds((prev) => {
          const next = new Set(prev);
          next.delete(shotId);
          return next;
        });
      }
    },
    [authFetch, setShotPlan, busy],
  );

  // Generate EVERY shot in order. Long-running (one render + persist per shot);
  // all shot badges show "Generating…" while it runs. On a mid-run halt the route
  // returns the partially-generated plan so completed shots are still shown.
  const generateAll = useCallback(async () => {
    const plan = useVideoPipelineStore.getState().shotPlan;
    if (!plan || busy || plan.shots.length === 0) {
      return;
    }
    setShotGenError(null);
    setIsGeneratingAll(true);
    setGeneratingShotIds(new Set(plan.shots.map((s) => s.id)));
    try {
      const res = await authFetch('/api/content/shot-plan/generate-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = (await res.json()) as ShotGenerationResponse;
      if (!res.ok || !data.success || !data.plan) {
        // Surface the failure AND keep whatever did generate (partialPlan).
        if (data.partialPlan) {
          setShotPlan(data.partialPlan);
        }
        throw new Error(data.error ?? 'Generation stopped before all shots finished. Please try again.');
      }
      setShotPlan(data.plan);
      // Every shot rendered but combining them into one video failed — surface it
      // (non-fatal: the clips are saved, the operator can Build the final video).
      if (data.stitchError) {
        setShotGenError(data.stitchError);
      }
    } catch (err) {
      setShotGenError(err instanceof Error ? err.message : 'Generation stopped before all shots finished. Please try again.');
    } finally {
      setIsGeneratingAll(false);
      setGeneratingShotIds(new Set());
    }
  }, [authFetch, setShotPlan, busy]);

  // ── Build (or rebuild) the final video — the manual stitch path ──
  // Combines every generated shot into ONE deliverable video. Also the retry path
  // when the automatic stitch inside Generate-all failed, or after regenerating a
  // single shot. Plain English on failure; never silent.
  const stitchFinal = useCallback(async () => {
    const plan = useVideoPipelineStore.getState().shotPlan;
    if (!plan || busy) {
      return;
    }
    const hasClips = plan.shots.some((s) => s.generated?.status === 'completed' && s.generated.videoUrl);
    if (!hasClips) {
      setShotGenError('Generate at least one shot before building the final video.');
      return;
    }
    setShotGenError(null);
    setIsStitching(true);
    try {
      const res = await authFetch('/api/content/shot-plan/stitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = (await res.json()) as ShotGenerationResponse;
      if (!res.ok || !data.success || !data.plan) {
        throw new Error(data.error ?? 'Building the final video failed. Please try again.');
      }
      setShotPlan(data.plan);
    } catch (err) {
      setShotGenError(err instanceof Error ? err.message : 'Building the final video failed. Please try again.');
    } finally {
      setIsStitching(false);
    }
  }, [authFetch, setShotPlan, busy]);

  // ── Open the generated clips in the existing Video Editor ──
  // Map the plan's completed shots (in order) into the editor seed, hand it off
  // via sessionStorage, and navigate. Reuses the established editor flow.
  const openInEditor = useCallback(() => {
    const plan = useVideoPipelineStore.getState().shotPlan;
    if (!plan) {
      return;
    }
    const scenes = shotPlanToScenes(plan);
    const ordered = [...plan.shots].sort((a, b) => a.index - b.index);
    const clips: EditorSeedClip[] = [];
    ordered.forEach((shot, i) => {
      const url = shot.generated?.videoUrl;
      if (shot.generated?.status === 'completed' && url) {
        const scene = scenes.find((s) => s.id === shot.id);
        clips.push({
          url,
          thumbnailUrl: shot.generated?.lastFrameUrl ?? null,
          name: scene?.title ?? `Shot ${i + 1}`,
          duration: shot.durationSeconds,
        });
      }
    });
    if (clips.length === 0) {
      setShotGenError('Generate at least one shot before opening the editor.');
      return;
    }
    writeEditorSeed({ clips });
    router.push('/content/video/editor');
  }, [router]);

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

  // Replace the whole cast array — the commit path for per-member identity edits
  // (mirrors removeCast's whole-array replacement).
  const setCast = useCallback(
    (next: ShotPlanCastMember[]) => {
      applyEdit({ target: 'shared', field: 'cast', value: next });
    },
    [applyEdit],
  );

  // ── Objects & props helpers ──
  const addObject = useCallback(
    (object: ShotPlanObject) => {
      if (!shotPlan) {
        return;
      }
      applyEdit({
        target: 'shared',
        field: 'objects',
        value: [...(shotPlan.sharedChoices.objects ?? []), object],
      });
    },
    [shotPlan, applyEdit],
  );

  const removeObject = useCallback(
    (objectId: string) => {
      if (!shotPlan) {
        return;
      }
      applyEdit({
        target: 'shared',
        field: 'objects',
        value: (shotPlan.sharedChoices.objects ?? []).filter((o) => o.id !== objectId),
      });
    },
    [shotPlan, applyEdit],
  );

  // ── Environment reference images helpers ──
  const addEnvironmentImages = useCallback(
    (urls: string[]) => {
      if (!shotPlan || urls.length === 0) {
        return;
      }
      const existing = shotPlan.sharedChoices.environmentReferenceImageUrls ?? [];
      // Append only URLs we don't already have.
      const merged = [...existing, ...urls.filter((u) => !existing.includes(u))];
      applyEdit({ target: 'shared', field: 'environmentReferenceImageUrls', value: merged });
    },
    [shotPlan, applyEdit],
  );

  const removeEnvironmentImage = useCallback(
    (url: string) => {
      if (!shotPlan) {
        return;
      }
      applyEdit({
        target: 'shared',
        field: 'environmentReferenceImageUrls',
        value: (shotPlan.sharedChoices.environmentReferenceImageUrls ?? []).filter((u) => u !== url),
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
  const completedCount = orderedShots.filter((s) => s.generated?.status === 'completed' && s.generated.videoUrl).length;

  return (
    <div className="space-y-6">
      {/* ── Generation toolbar — the creation → editor path ── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border-strong bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clapperboard className="h-4 w-4 text-primary" />
          {shotPlan.finalVideoUrl ? (
            <span className="text-foreground">Final video ready — all {orderedShots.length} shots combined into one film.</span>
          ) : completedCount === orderedShots.length && orderedShots.length > 0 ? (
            <span className="text-foreground">All {orderedShots.length} shots generated — build your final video.</span>
          ) : (
            <span>
              {completedCount}/{orderedShots.length} shots generated.
              {' '}Generate every shot — they’re automatically combined into one final video.
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border-strong bg-surface-elevated p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('review')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${viewMode === 'review' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Review
            </button>
            <button
              type="button"
              onClick={() => setViewMode('edit')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${viewMode === 'edit' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Edit
            </button>
          </div>
          <Button
            className="gap-1.5"
            onClick={() => { void generateAll(); }}
            disabled={busy || orderedShots.length === 0}
          >
            {isGeneratingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {isGeneratingAll ? 'Generating all shots…' : 'Generate all shots'}
          </Button>
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={() => { void stitchFinal(); }}
            disabled={busy || completedCount === 0}
            title={completedCount === 0 ? 'Generate at least one shot first' : 'Combine every generated shot into one final video'}
          >
            {isStitching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
            {isStitching ? 'Building…' : shotPlan.finalVideoUrl ? 'Rebuild final video' : 'Build final video'}
          </Button>
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={openInEditor}
            disabled={busy || completedCount === 0}
            title={completedCount === 0 ? 'Generate at least one shot first' : 'Open the generated clips in the editor to fine-tune'}
          >
            <PlayCircle className="h-4 w-4" /> Open in editor
          </Button>
        </div>
      </div>

      {/* ── Final stitched video — the deliverable ── */}
      {shotPlan.finalVideoUrl && (
        <div className="space-y-3 rounded-2xl border border-border-strong bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Film className="h-4 w-4 text-primary" /> Your final video
            </div>
            <a
              href={shotPlan.finalVideoUrl}
              download
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-strong bg-surface-elevated px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface-main"
            >
              <Download className="h-3.5 w-3.5" /> Download
            </a>
          </div>
          <video
            key={shotPlan.finalVideoUrl}
            src={shotPlan.finalVideoUrl}
            controls
            className="w-full rounded-lg border border-border-light bg-black"
          />
        </div>
      )}

      {/* The just-generated plan is rendering its images so the document arrives complete */}
      {isRenderingSheet && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-foreground">
          <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-primary" />
          Rendering your production sheet — generating the floor plan and every shot still so the document is complete and ready to edit…
        </div>
      )}

      {/* Generation error — plain English, never silent */}
      {shotGenError && (
        <div className="flex items-start justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{shotGenError}</span>
          </div>
          <button
            type="button"
            onClick={() => setShotGenError(null)}
            className="text-destructive/60 transition-colors hover:text-destructive"
            aria-label="Dismiss error"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {/* ══ REVIEW — the cinematic production-sheet document ══ */}
      {viewMode === 'review' && (
        <ZoomPanViewport>
          <ShotPlanDocument
            plan={shotPlan}
            onEdit={(id) => setDetailShotId((prev) => (prev === id ? null : id))}
            onEditSection={() => { setViewMode('edit'); }}
            onFloorPlanChange={(fp) => applyEdit({ target: 'plan', field: 'floorPlan', value: fp })}
          />
        </ZoomPanViewport>
      )}

      {/* ══ EDIT — the full production-sheet form ══ */}
      {viewMode === 'edit' && (
      <>
      <div className="overflow-hidden rounded-2xl border border-border-strong bg-card">
        {/* SHARED CHOICES header bar — the at-a-glance look bible every cut inherits */}
        <div className="border-b border-border-strong bg-surface-elevated px-6 py-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">Shared choices</span>
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">the look bible every cut inherits</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="flex items-center gap-2">
              <Caption className="uppercase tracking-wider text-muted-foreground">Cut count</Caption>
              <span className="rounded-md bg-primary/15 px-2 py-0.5 text-sm font-bold text-primary">{orderedShots.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <Caption className="uppercase tracking-wider text-muted-foreground">Palette</Caption>
              {sharedChoices.colorPalette.length > 0 ? (
                <div className="flex items-center gap-1">
                  {sharedChoices.colorPalette.slice(0, 8).map((sw, i) => (
                    <span
                      key={`${sw.hex}-${i}`}
                      title={`${sw.name} (${sw.hex})`}
                      className="h-5 w-5 rounded border border-border-light"
                      style={{ backgroundColor: sw.hex }}
                    />
                  ))}
                </div>
              ) : (
                <Caption>—</Caption>
              )}
            </div>
            <div className="flex min-w-[220px] flex-1 items-center gap-2">
              <Caption className="uppercase tracking-wider text-muted-foreground">Environment</Caption>
              <span className="truncate text-sm text-foreground">{sharedChoices.environmentFingerprint || '—'}</span>
            </div>
          </div>
        </div>

        {/* Plan title */}
        <div className="border-b border-border-strong px-6 py-3">
          <EditableText
            label="Plan title"
            value={shotPlan.title}
            placeholder="Untitled Shot Doc"
            onCommit={(v) => applyEdit({ target: 'plan', field: 'title', value: v })}
            onAskAi={() => setAskAi({ target: 'plan', field: 'title', label: 'the plan title' })}
          />
        </div>

        <SheetSection number={1} title="Look &amp; World" icon={Clapperboard}>
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
          <EditableText
            label="Time period"
            value={sharedChoices.timePeriod ?? ''}
            placeholder="e.g. 1947 post-war, near-future 2090"
            onCommit={(v) => applyEdit({ target: 'shared', field: 'timePeriod', value: v.trim() ? v.trim() : undefined })}
            onAskAi={() => setAskAi({ target: 'shared', field: 'timePeriod', label: 'the time period' })}
          />
          <EditableText
            label="Genre"
            value={sharedChoices.genre ?? ''}
            placeholder="e.g. neo-noir, corporate explainer"
            onCommit={(v) => applyEdit({ target: 'shared', field: 'genre', value: v.trim() ? v.trim() : undefined })}
            onAskAi={() => setAskAi({ target: 'shared', field: 'genre', label: 'the genre' })}
          />
        </div>

        {/* Environment reference images — establishing-shot anchors that pin the
            look of the world alongside the written fingerprint. Library-based. */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Caption className="flex items-center gap-1.5 font-medium text-muted-foreground">
              <ImageIcon className="w-3.5 h-3.5" /> Environment reference images
            </Caption>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEnvLibraryOpen(true)}>
              <Plus className="w-3.5 h-3.5" /> Add image
            </Button>
          </div>
          {(sharedChoices.environmentReferenceImageUrls ?? []).length === 0 ? (
            <Caption>Add images of the world/set to anchor its look across every shot.</Caption>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(sharedChoices.environmentReferenceImageUrls ?? []).map((url, i) => (
                <div
                  key={`${url}-${i}`}
                  className="relative h-20 w-20 overflow-hidden rounded-lg border border-border-light bg-surface-elevated"
                >
                  <Image src={url} alt={`Environment reference ${i + 1}`} fill sizes="80px" unoptimized className="object-cover" />
                  <div className="absolute right-0.5 top-0.5 rounded-md bg-background/80">
                    <ConfirmRemoveButton
                      onConfirm={() => removeEnvironmentImage(url)}
                      label={`Remove environment reference ${i + 1}`}
                      className="rounded-md p-0.5 text-muted-foreground transition-colors hover:text-destructive"
                      iconClassName="h-3.5 w-3.5"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Look Bible — the deep, image-backed cinematic controls, set ONCE and
            inherited by every shot. This is the RenderZero depth, and it owns
            art style (so there is no duplicate standalone art-style field). */}
        <div className="space-y-2 border-t border-border-light pt-5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <CardTitle className="flex items-center gap-2">
              <Clapperboard className="w-4 h-4 text-primary" /> Cinematic look
            </CardTitle>
            <span className="rounded-full border border-border-light bg-surface-elevated px-2 py-0.5 text-[11px] text-muted-foreground">
              Set once · every shot inherits this
            </span>
          </div>
          <SectionDescription>
            The deep look bible — movie look, film stock, camera body, lens, color grade,
            photographer/videographer style and more, chosen from visual options. Each shot
            can fine-tune its own framing in its camera editor.
          </SectionDescription>
          <CinematicControlsPanel
            config={sharedChoices.lookBible ?? {}}
            onChange={(c) => applyEdit({ target: 'shared', field: 'lookBible', value: c })}
            compact={false}
            studioMode="advanced"
            medium="video"
          />
        </div>
        </SheetSection>

        <SheetSection
          number={2}
          title="Cast"
          icon={Users}
          action={
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setCastPickerOpen(true)}>
              <Plus className="w-3.5 h-3.5" /> Add cast
            </Button>
          }
        >
        {sharedChoices.cast.length === 0 ? (
          <SectionDescription>No cast yet. Add your saved characters to use them across shots.</SectionDescription>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {sharedChoices.cast.map((member) => (
              <CastCard
                key={member.characterId}
                member={member}
                cast={sharedChoices.cast}
                editing
                onRemove={() => removeCast(member.characterId)}
                onCastChange={setCast}
              />
            ))}
          </div>
        )}
        </SheetSection>

        <SheetSection
          number={3}
          title="Objects &amp; Props"
          icon={Package}
          action={
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setObjectDialogOpen(true)}>
              <Plus className="w-3.5 h-3.5" /> Add object
            </Button>
          }
        >
        {(sharedChoices.objects ?? []).length === 0 ? (
          <SectionDescription>
            No objects yet. Add a recurring prop, vehicle or product with reference images so the
            engine renders it the same way across shots.
          </SectionDescription>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(sharedChoices.objects ?? []).map((object) => (
              <ObjectCard key={object.id} object={object} onRemove={() => removeObject(object.id)} />
            ))}
          </div>
        )}
        </SheetSection>

        <SheetSection
          number={4}
          title="Storyboard"
          icon={ListVideo}
          action={
            <Button variant="outline" size="sm" className="gap-1.5" onClick={addShot} disabled={busy}>
              <Plus className="w-3.5 h-3.5" /> Add shot
            </Button>
          }
        >
        {/* Horizontal numbered keyframe strip — the storyboard at a glance */}
        <div className="flex gap-3 overflow-x-auto pb-2">
          {orderedShots.map((shot, i) => (
            <StoryboardPanel
              key={shot.id}
              shot={shot}
              position={i}
              selected={selectedShotId === shot.id}
              isGenerating={generatingShotIds.has(shot.id) || keyframingShotIds.has(shot.id)}
              onSelect={() => setSelectedShotId((prev) => (prev === shot.id ? null : shot.id))}
            />
          ))}
        </div>

        {/* Click a panel to open its full per-shot editor here */}
        {(() => {
          const selected = orderedShots.find((s) => s.id === selectedShotId);
          const selectedIndex = orderedShots.findIndex((s) => s.id === selectedShotId);
          if (!selected) {
            return (
              <Caption className="mt-3 block">
                Select a shot above to edit its action, camera, lighting and dialogue — or regenerate its still.
              </Caption>
            );
          }
          return (
            <div className="mt-4">
              <ShotCard
                plan={shotPlan}
                shot={selected}
                position={selectedIndex}
                total={orderedShots.length}
                isGenerating={generatingShotIds.has(selected.id)}
                isKeyframing={keyframingShotIds.has(selected.id)}
                busy={busy}
                onEditField={(field, value) => editShotField(selected.id, field, value)}
                onAskAi={(field, label) => setAskAi({ target: 'shot', shotId: selected.id, field, label })}
                onMove={(dir) => moveShot(selected.id, dir)}
                onDelete={() => { deleteShot(selected.id); setSelectedShotId(null); }}
                onKeepUpstream={() => keepUpstream(selected.id)}
                onRerun={() => { void generateOneShot(selected.id); }}
                onRegenerate={() => { void generateOneShot(selected.id); }}
                onGenerateKeyframe={() => { void generateOneKeyframe(selected.id); }}
                onOpenCamera={() => setCameraShotId(selected.id)}
              />
            </div>
          );
        })()}
        </SheetSection>

        <SheetSection number={5} title="Floor Plan &amp; Camera Blocking" icon={ListVideo}>
        <SectionDescription>
          A top-down map of your set — the AI places your actors, objects, zones and a numbered
          camera for each shot with its movement; you fine-tune by dragging. This blocking is
          translated into precise camera direction for every shot, so the map actually directs the
          camera, not just decorates the plan.
        </SectionDescription>
        <div className="mt-3">
        <FloorPlanCanvas
          floorPlan={shotPlan.floorPlan}
          shots={orderedShots.map((s) => ({ id: s.id, index: s.index, title: s.title }))}
          cast={sharedChoices.cast.map((c) => ({ characterId: c.characterId, name: c.name }))}
          objects={(sharedChoices.objects ?? []).map((o) => ({ id: o.id, name: o.name }))}
          onChange={(fp) => applyEdit({ target: 'plan', field: 'floorPlan', value: fp })}
        />
        </div>
        </SheetSection>

        <SheetSection number={6} title="Lighting, Mood &amp; Style" icon={Sparkles}>
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
            <p className="text-sm text-foreground">{sharedChoices.lookBible?.artStyle ?? sharedChoices.artStyle ?? '—'}</p>
          </div>
        </div>
        </SheetSection>
      </div>
      {/* ══ end production sheet ══ */}
      </>
      )}

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
        onCommit={(update) => {
          if (cameraShot) {
            commitShotLook(cameraShot.id, update);
          }
          setCameraShotId(null);
        }}
      />

      {/* Per-shot details popup — opened by clicking a storyboard on the Shot Doc.
          The Shot Doc stays the visual reference; this overlays its full details,
          scrollable, and closes via the X / overlay / clicking the storyboard again. */}
      {(() => {
        const detail = orderedShots.find((s) => s.id === detailShotId);
        const detailIndex = orderedShots.findIndex((s) => s.id === detailShotId);
        return (
          <Dialog open={detail != null} onOpenChange={(o) => { if (!o) { setDetailShotId(null); } }}>
            <DialogContent className="bg-card border border-border-strong max-w-3xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-foreground">
                  <ListVideo className="w-4 h-4 text-primary" />
                  Cut {detailIndex + 1}{detail?.title ? ` — ${detail.title}` : ''}
                </DialogTitle>
                <DialogDescription>
                  Full details for this shot — action, camera, lighting, dialogue and its still. Edits save straight to the Shot Doc.
                </DialogDescription>
              </DialogHeader>
              {detail && (
                <ShotCard
                  plan={shotPlan}
                  shot={detail}
                  position={detailIndex}
                  total={orderedShots.length}
                  isGenerating={generatingShotIds.has(detail.id)}
                  isKeyframing={keyframingShotIds.has(detail.id)}
                  busy={busy}
                  onEditField={(field, value) => editShotField(detail.id, field, value)}
                  onAskAi={(field, label) => setAskAi({ target: 'shot', shotId: detail.id, field, label })}
                  onMove={(dir) => moveShot(detail.id, dir)}
                  onDelete={() => { deleteShot(detail.id); setDetailShotId(null); }}
                  onKeepUpstream={() => keepUpstream(detail.id)}
                  onRerun={() => { void generateOneShot(detail.id); }}
                  onRegenerate={() => { void generateOneShot(detail.id); }}
                  onGenerateKeyframe={() => { void generateOneKeyframe(detail.id); }}
                  onOpenCamera={() => setCameraShotId(detail.id)}
                />
              )}
            </DialogContent>
          </Dialog>
        );
      })()}

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

      <AddObjectDialog
        open={objectDialogOpen}
        onOpenChange={setObjectDialogOpen}
        onSave={addObject}
        authFetch={authFetch}
      />

      {/* Environment reference image picker — appends image URLs to the shared look. */}
      <MediaLibraryPicker
        open={envLibraryOpen}
        onOpenChange={setEnvLibraryOpen}
        onSelect={(picked) => addEnvironmentImages(picked.filter((a) => a.type === 'image').map((a) => a.url))}
        authFetch={authFetch}
      />
    </div>
  );
}
