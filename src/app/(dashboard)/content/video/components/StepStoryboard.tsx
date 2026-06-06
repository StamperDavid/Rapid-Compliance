'use client';

/**
 * StepStoryboard — RenderZero-layout storyboard creator.
 *
 * You build a video like a director builds a shoot: one STORYBOARD (an
 * independent clip) at a time, with deep cinematographer-grade prompting.
 * Storyboards stack left-to-right along the bottom; on Generate they all
 * render through Hedra and stitch in order into one long video.
 *
 * Layout (RenderZero's layout + depth, our design system):
 *  - Left   = the selected storyboard's deep control stack. Plain-language
 *             groups (Shot / Setting / Cast / Sound / References) wrap the
 *             full 400-preset cinematic surface (CinematicControlsPanel,
 *             advanced — camera body, lens, focal length, film stock,
 *             lighting/mood, photographer & movie look, composition, …).
 *  - Right  = the live Constructed Prompt + the auto-thumbnail preview for
 *             this storyboard + the inferred Hedra model.
 *  - Bottom = the storyboards, in order, drag-reorder / duplicate / delete.
 *
 * Engine = Hedra only. Model is inferred per storyboard: character present →
 * Character-3 (avatar); none → Kling O3 (prompt). Never a "provider" list.
 *
 * Reuses: PipelineScene + CinematicConfig + CinematicControlsPanel +
 * ConstructedPromptDisplay + AvatarPicker/VoicePicker + the pipeline store.
 */

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  forwardRef,
  type SyntheticEvent,
  type ReactNode,
  type DragEvent,
} from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers,
  Plus,
  Trash2,
  Copy,
  GripVertical,
  ImageIcon,
  Loader2,
  ArrowRight,
  Sparkles,
  Users,
  Mic,
  CheckCircle2,
  AlertCircle,
  Clock,
  Wand2,
  X,
  Film,
  MapPin,
  Volume2,
  Camera,
  Upload,
  FileText,
  Music,
  Video as VideoIcon,
  Shirt,
  Theater,
  ChevronDown,
  CopyPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useVideoPipelineStore } from '@/lib/stores/video-pipeline-store';
import { CinematicControlsPanel } from '@/components/studio/CinematicControlsPanel';
import { ConstructedPromptDisplay } from '@/components/studio/ConstructedPromptDisplay';
import { AvatarPicker } from './AvatarPicker';
import { VoicePicker } from './VoicePicker';
import { REFERENCE_PURPOSES, type PipelineScene, type SceneReference } from '@/types/video-pipeline';
import type { CinematicConfig } from '@/types/creative-studio';
import {
  sceneHasDescription,
  hasText,
  requestStoryboardThumbnail,
} from '@/lib/video/storyboard-thumbnail';

// ============================================================================
// Helpers
// ============================================================================

/** Base subject line for the live Constructed Prompt (presets get appended). */
function buildBasePrompt(scene: PipelineScene): string {
  return [
    scene.visualDescription,
    scene.location,
    scene.timeOfDay,
    scene.weather,
    hasText(scene.wardrobe) ? `wearing ${scene.wardrobe}` : '',
  ]
    .filter((p): p is string => hasText(p))
    .join(', ');
}

/** Compose Setting + Sound into the environment prompt fed to generation. */
function composeBackgroundPrompt(scene: PipelineScene): string | null {
  const parts = [
    scene.location,
    scene.timeOfDay,
    scene.weather,
    hasText(scene.ambience) ? `ambience: ${scene.ambience}` : '',
  ].filter((p): p is string => hasText(p));
  if (parts.length === 0) {
    return scene.backgroundPrompt ?? null;
  }
  return parts.join(', ');
}

function sceneLabel(scene: PipelineScene, index: number): string {
  const trimmed = scene.title?.trim();
  return trimmed !== undefined && trimmed.length > 0 ? trimmed : `Storyboard ${index + 1}`;
}

const REFERENCE_ICON: Record<SceneReference['type'], ReactNode> = {
  image: <ImageIcon className="w-3.5 h-3.5" />,
  video: <VideoIcon className="w-3.5 h-3.5" />,
  audio: <Music className="w-3.5 h-3.5" />,
  text: <FileText className="w-3.5 h-3.5" />,
};

function fileToMediaType(file: File): { mediaType: 'image' | 'video' | 'audio' | 'document'; refType: SceneReference['type'] } {
  if (file.type.startsWith('image/')) {
    return { mediaType: 'image', refType: 'image' };
  }
  if (file.type.startsWith('video/')) {
    return { mediaType: 'video', refType: 'video' };
  }
  if (file.type.startsWith('audio/')) {
    return { mediaType: 'audio', refType: 'audio' };
  }
  return { mediaType: 'document', refType: 'text' };
}

// ============================================================================
// Collapsible group
// ============================================================================

interface GroupProps {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  onCopyForward?: () => void;
  defaultOpen?: boolean;
}

function Group({ title, icon, children, onCopyForward, defaultOpen = true }: GroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-border-strong bg-surface-elevated/40">
      <div className="flex items-center justify-between px-3 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-sm font-semibold text-foreground"
        >
          <span className="text-primary">{icon}</span>
          {title}
          <ChevronDown
            className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? '' : '-rotate-90'}`}
          />
        </button>
        {onCopyForward && (
          <button
            type="button"
            onClick={onCopyForward}
            className="flex items-center gap-1 text-[10px] text-primary-light hover:text-primary-light hover:underline"
            title="Copy these fields from the previous storyboard"
          >
            <CopyPlus className="w-3 h-3" />
            Same as previous
          </button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-surface-elevated border-border-strong text-white placeholder:text-muted-foreground text-sm h-9"
      />
    </div>
  );
}

// ============================================================================
// Generic modal shell
// ============================================================================

function Modal({ title, icon, onClose, headerExtra, children }: {
  title: string;
  icon: ReactNode;
  onClose: () => void;
  headerExtra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border-strong rounded-xl w-full max-w-3xl shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-border-strong">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <span className="text-primary">{icon}</span>
            {title}
          </h2>
          <div className="flex items-center gap-2">
            {headerExtra}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="p-4 max-h-[65vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// ============================================================================
// Storyboard strip item (bottom row, draggable)
// ============================================================================

interface StripItemProps {
  scene: PipelineScene;
  index: number;
  isSelected: boolean;
  isGeneratingThumb: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onGenerateThumb: () => void;
  onDragStart: () => void;
  onDrop: () => void;
}

const StripItem = forwardRef<HTMLDivElement, StripItemProps>(function StripItem(
  { scene, index, isSelected, isGeneratingThumb, onSelect, onDelete, onDuplicate, onGenerateThumb, onDragStart, onDrop },
  ref,
) {
  const [imgBroken, setImgBroken] = useState(false);
  const handleImageError = useCallback((e: SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.style.display = 'none';
    setImgBroken(true);
  }, []);

  return (
    <div
      ref={ref}
      draggable
      onDragStart={onDragStart}
      onDragOver={(e: DragEvent) => e.preventDefault()}
      onDrop={onDrop}
      onClick={onSelect}
      className={`group relative w-40 flex-shrink-0 cursor-pointer rounded-lg border overflow-hidden transition-all ${
        isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-border-strong hover:border-border'
      }`}
    >
      <div className="relative aspect-video bg-surface-elevated/50">
        {scene.screenshotUrl && !imgBroken ? (
          <Image src={scene.screenshotUrl} alt={`Storyboard ${index + 1}`} fill className="object-cover" unoptimized onError={handleImageError} />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
            {isGeneratingThumb ? <Loader2 className="w-6 h-6 animate-spin text-primary" /> : <><ImageIcon className="w-6 h-6 mb-1" /><span className="text-[9px]">{imgBroken ? 'Preview expired' : 'No preview'}</span></>}
          </div>
        )}
        <div className="absolute top-1.5 left-1.5 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">SB {index + 1}</div>
        <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button type="button" onClick={(e) => { e.stopPropagation(); onGenerateThumb(); }} disabled={isGeneratingThumb} className="bg-black/70 hover:bg-primary text-white p-1 rounded transition-colors" title="Generate thumbnail">
            {isGeneratingThumb ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onDuplicate(); }} className="bg-black/70 hover:bg-border-strong text-white p-1 rounded transition-colors" title="Duplicate storyboard"><Copy className="w-3 h-3" /></button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="bg-black/70 hover:bg-destructive text-white p-1 rounded transition-colors" title="Delete storyboard"><Trash2 className="w-3 h-3" /></button>
        </div>
        <div className="absolute bottom-1.5 left-1.5 opacity-0 group-hover:opacity-60 transition-opacity cursor-grab"><GripVertical className="w-3.5 h-3.5 text-white" /></div>
        <div className="absolute bottom-1.5 right-1.5 bg-black/70 text-foreground text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{scene.duration}s</div>
      </div>
      <div className="p-2">
        <p className="text-[11px] font-semibold text-white truncate flex items-center gap-1">
          {scene.status === 'approved' && <CheckCircle2 className="w-3 h-3 text-green-400 flex-shrink-0" />}
          {sceneLabel(scene, index)}
        </p>
        <div className="flex items-center gap-1 mt-0.5">
          {scene.avatarId ? (
            <Badge variant="secondary" className="text-[8px] px-1 py-0 bg-primary/20 text-primary-light"><Theater className="w-2 h-2 mr-0.5" />{scene.avatarName ?? 'Character'}</Badge>
          ) : (
            <span className="text-[9px] text-muted-foreground">Prompt-only</span>
          )}
        </div>
      </div>
    </div>
  );
});

// ============================================================================
// References uploader
// ============================================================================

function ReferenceUploader({ references, isUploading, onUpload, onRemove, onUpdate }: {
  references: SceneReference[];
  isUploading: boolean;
  onUpload: (files: FileList) => void;
  onRemove: (refId: string) => void;
  onUpdate: (refId: string, updates: Partial<SceneReference>) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => { e.preventDefault(); setDragActive(false); if (e.dataTransfer.files.length > 0) { onUpload(e.dataTransfer.files); } }}
        onClick={() => inputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-3 py-5 cursor-pointer transition-colors ${dragActive ? 'border-primary bg-primary/5' : 'border-border-strong hover:border-primary/50'}`}
      >
        {isUploading ? <Loader2 className="w-5 h-5 animate-spin text-primary" /> : <Upload className="w-5 h-5 text-muted-foreground" />}
        <p className="text-xs text-muted-foreground text-center">Drop or click to upload — image, video, audio, or text. Tell the AI how to use each one.</p>
        <input ref={inputRef} type="file" multiple accept="image/*,video/*,audio/*,.txt,.md,.pdf,.doc,.docx" className="hidden" onChange={(e) => { if (e.target.files && e.target.files.length > 0) { onUpload(e.target.files); e.target.value = ''; } }} />
      </div>
      {references.length > 0 && (
        <div className="space-y-2">
          {references.map((ref) => {
            const needsUsage = !hasText(ref.usage);
            return (
              <div key={ref.id} className="rounded-md border border-border-strong bg-surface-elevated p-2.5 space-y-2">
                <div className="flex items-center gap-2">
                  {ref.type === 'image' ? (
                    <div className="relative w-9 h-9 rounded overflow-hidden bg-card flex-shrink-0"><Image src={ref.url} alt={ref.name} fill className="object-cover" unoptimized /></div>
                  ) : (
                    <span className="flex w-9 h-9 items-center justify-center rounded bg-card text-primary flex-shrink-0">{REFERENCE_ICON[ref.type]}</span>
                  )}
                  <div className="min-w-0 flex-1"><p className="text-xs text-foreground truncate">{ref.name}</p><p className="text-[10px] text-muted-foreground capitalize">{ref.type}</p></div>
                  <button type="button" onClick={() => onRemove(ref.id)} className="text-muted-foreground hover:text-destructive p-1" title="Remove reference"><X className="w-3.5 h-3.5" /></button>
                </div>

                {/* Standard purpose */}
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">How should the AI use this?</Label>
                  <select
                    value={ref.purpose ?? ''}
                    onChange={(e) => onUpdate(ref.id, { purpose: e.target.value || undefined })}
                    className="w-full bg-surface-elevated border border-border-strong rounded px-2 py-1.5 text-sm text-white focus:border-primary focus:outline-none"
                  >
                    <option value="">Select purpose…</option>
                    {REFERENCE_PURPOSES.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>

                {/* Required free-text instruction */}
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                    Notes for the AI <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    value={ref.usage ?? ''}
                    onChange={(e) => onUpdate(ref.id, { usage: e.target.value || undefined })}
                    rows={2}
                    placeholder="Explain exactly how to use this — e.g. 'match this lighting and color grade', 'this is the founder's face for the avatar', 'feature this product label exactly'."
                    className={`bg-surface-elevated text-white placeholder:text-muted-foreground text-sm resize-y ${needsUsage ? 'border-destructive/50' : 'border-border-strong'}`}
                  />
                  {needsUsage && <p className="text-[10px] text-destructive">Tell the AI how to use this material.</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Left column — deep storyboard controls
// ============================================================================

interface StoryboardControlsProps {
  scene: PipelineScene;
  index: number;
  previousScene: PipelineScene | null;
  isUploadingRef: boolean;
  onUpdate: (updates: Partial<PipelineScene>) => void;
  onOpenCharacterPicker: () => void;
  onUploadReference: (files: FileList) => void;
  onRemoveReference: (refId: string) => void;
  onUpdateReference: (refId: string, updates: Partial<SceneReference>) => void;
}

function StoryboardControls({
  scene,
  index,
  previousScene,
  isUploadingRef,
  onUpdate,
  onOpenCharacterPicker,
  onUploadReference,
  onRemoveReference,
  onUpdateReference,
}: StoryboardControlsProps) {
  const config = scene.cinematicConfig ?? {};
  const handleConfigChange = useCallback((newConfig: CinematicConfig) => onUpdate({ cinematicConfig: newConfig }), [onUpdate]);

  return (
    <div className="space-y-3">
      {/* ── Shot ── */}
      <Group title="Shot" icon={<Film className="w-4 h-4" />}>
        <Field label="Title" value={scene.title ?? ''} onChange={(v) => onUpdate({ title: v || undefined })} placeholder={`Storyboard ${index + 1} — e.g. "The Hook"`} />
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Action (what happens on screen)</Label>
          <Textarea value={scene.visualDescription ?? ''} onChange={(e) => onUpdate({ visualDescription: e.target.value || undefined })} rows={2} placeholder="Sarah turns to her laptop as the dashboard lights up..." className="bg-surface-elevated border-border-strong text-white placeholder:text-muted-foreground text-sm resize-y" />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Dialogue / Voiceover</Label>
          <Textarea value={scene.scriptText} onChange={(e) => onUpdate({ scriptText: e.target.value })} rows={3} placeholder={'NARRATOR: Welcome to SalesVelocity...\nSARAH (to camera): I used to spend hours on spreadsheets.'} className="bg-surface-elevated border-border-strong text-white placeholder:text-muted-foreground text-sm resize-y font-mono" />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-[11px] text-muted-foreground">Duration</Label>
          <Input type="number" value={scene.duration} onChange={(e) => onUpdate({ duration: Math.max(1, Number(e.target.value)) })} min={1} max={120} className="w-20 bg-surface-elevated border-border-strong text-white text-center h-8" />
          <span className="text-xs text-muted-foreground">seconds</span>
        </div>
      </Group>

      {/* ── Setting ── */}
      <Group
        title="Setting"
        icon={<MapPin className="w-4 h-4" />}
        onCopyForward={previousScene ? () => onUpdate({ location: previousScene.location, timeOfDay: previousScene.timeOfDay, weather: previousScene.weather }) : undefined}
      >
        <Field label="Location" value={scene.location ?? ''} onChange={(v) => onUpdate({ location: v || undefined })} placeholder="Modern open-plan office" />
        <Field label="Time of day" value={scene.timeOfDay ?? ''} onChange={(v) => onUpdate({ timeOfDay: v || undefined })} placeholder="Late afternoon" />
        <Field label="Weather / light" value={scene.weather ?? ''} onChange={(v) => onUpdate({ weather: v || undefined })} placeholder="Golden-hour sun through the windows" />
      </Group>

      {/* ── Cast ── */}
      <Group
        title="Cast"
        icon={<Users className="w-4 h-4" />}
        onCopyForward={previousScene ? () => onUpdate({ avatarId: previousScene.avatarId, avatarName: previousScene.avatarName, voiceId: previousScene.voiceId, voiceProvider: previousScene.voiceProvider, wardrobe: previousScene.wardrobe }) : undefined}
      >
        <div className="flex items-center gap-2">
          {scene.avatarId ? (
            <Badge variant="secondary" className="text-xs bg-primary/20 text-primary-light gap-1"><Theater className="w-3 h-3" />{scene.avatarName ?? 'Character'}</Badge>
          ) : (
            <span className="text-xs text-muted-foreground">No character — renders prompt-only (Kling O3)</span>
          )}
          <Button variant="outline" size="sm" className="text-xs gap-1.5 ml-auto" onClick={onOpenCharacterPicker}>
            <Users className="w-3.5 h-3.5" />
            {scene.avatarId ? 'Change character' : 'Choose character'}
          </Button>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground flex items-center gap-1"><Shirt className="w-3 h-3" /> Wardrobe</Label>
          <Input value={scene.wardrobe ?? ''} onChange={(e) => onUpdate({ wardrobe: e.target.value || undefined })} placeholder="Smart-casual blazer, no tie" className="bg-surface-elevated border-border-strong text-white placeholder:text-muted-foreground text-sm h-9" />
        </div>
      </Group>

      {/* ── Camera & Look — the deep RenderZero control surface ── */}
      <div className="rounded-lg border border-primary/30 bg-surface-elevated/40">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border-strong">
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground"><Camera className="w-4 h-4 text-primary" /> Camera &amp; Look</span>
          {previousScene?.cinematicConfig && (
            <button type="button" onClick={() => onUpdate({ cinematicConfig: previousScene.cinematicConfig })} className="flex items-center gap-1 text-[10px] text-primary-light hover:underline" title="Copy the look from the previous storyboard">
              <CopyPlus className="w-3 h-3" /> Same as previous
            </button>
          )}
        </div>
        <div className="px-3 py-3">
          <p className="text-[10px] text-muted-foreground mb-3">Direct the shot like a cinematographer — shot type, lens, film stock, lighting, color, photographer &amp; movie looks.</p>
          <CinematicControlsPanel config={config} onChange={handleConfigChange} compact={false} studioMode="advanced" />
        </div>
      </div>

      {/* ── Sound ── */}
      <Group
        title="Sound"
        icon={<Volume2 className="w-4 h-4" />}
        defaultOpen={false}
        onCopyForward={previousScene ? () => onUpdate({ ambience: previousScene.ambience, musicCue: previousScene.musicCue }) : undefined}
      >
        <Field label="Background ambience / noise" value={scene.ambience ?? ''} onChange={(v) => onUpdate({ ambience: v || undefined })} placeholder="Quiet office hum, distant keyboards" />
        <Field label="Music cue" value={scene.musicCue ?? ''} onChange={(v) => onUpdate({ musicCue: v || undefined })} placeholder="Uplifting corporate underscore building to the CTA" />
      </Group>

      {/* ── Upload Reference Materials ── */}
      <Group title="Upload Reference Materials" icon={<Upload className="w-4 h-4" />} defaultOpen={false}>
        <ReferenceUploader references={scene.references ?? []} isUploading={isUploadingRef} onUpload={onUploadReference} onRemove={onRemoveReference} onUpdate={onUpdateReference} />
      </Group>
    </div>
  );
}

// ============================================================================
// Right column — live prompt + thumbnail preview
// ============================================================================

function PreviewPanel({ scene, isGeneratingThumb, onGenerateThumb, onToggleReady }: {
  scene: PipelineScene;
  isGeneratingThumb: boolean;
  onGenerateThumb: () => void;
  onToggleReady: () => void;
}) {
  const [imgBroken, setImgBroken] = useState(false);
  const usesCharacter = Boolean(scene.avatarId);
  const hedraModel = usesCharacter ? 'Hedra · Character-3' : 'Hedra · Kling O3';
  const isReady = scene.status === 'approved';

  return (
    <div className="space-y-3 lg:sticky lg:top-4 self-start">
      {/* Thumbnail preview */}
      <Card className="bg-card border-border-strong overflow-hidden">
        <div className="relative aspect-video bg-surface-elevated/50">
          {scene.screenshotUrl && !imgBroken ? (
            <Image src={scene.screenshotUrl} alt="Storyboard preview" fill className="object-cover" unoptimized onError={() => setImgBroken(true)} />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-2">
              {isGeneratingThumb ? (
                <><Loader2 className="w-8 h-8 animate-spin text-primary" /><span className="text-xs">Generating preview…</span></>
              ) : (
                <><ImageIcon className="w-10 h-10" /><span className="text-xs">No preview yet</span></>
              )}
            </div>
          )}
          <div className="absolute top-2 left-2"><Badge variant="secondary" className="text-[10px] bg-black/70 text-white">{hedraModel}</Badge></div>
        </div>
        <CardContent className="p-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="w-3.5 h-3.5" />{scene.duration}s clip</span>
          {isGeneratingThumb ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="w-3.5 h-3.5 animate-spin" />Generating preview…</span>
          ) : scene.screenshotUrl ? (
            <Button size="sm" variant="ghost" className="gap-1.5 text-xs text-muted-foreground" onClick={onGenerateThumb}><Wand2 className="w-3.5 h-3.5" />Regenerate</Button>
          ) : (
            <span className="text-[11px] text-muted-foreground">Preview generates automatically</span>
          )}
        </CardContent>
      </Card>

      {/* Mark this storyboard ready — the "this one's done" beat */}
      <Button
        size="sm"
        variant="outline"
        onClick={onToggleReady}
        className={`w-full gap-1.5 ${isReady ? 'border-green-600 text-green-400 bg-green-500/10' : ''}`}
      >
        <CheckCircle2 className={`w-4 h-4 ${isReady ? 'text-green-400' : ''}`} />
        {isReady ? 'Ready — click to keep editing' : 'Mark this storyboard ready'}
      </Button>

      {/* Live constructed prompt (RenderZero-style) */}
      <ConstructedPromptDisplay basePrompt={buildBasePrompt(scene)} config={scene.cinematicConfig ?? {}} />
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function StepStoryboard() {
  const authFetch = useAuthFetch();
  const {
    projectId,
    projectName,
    brief,
    scenes,
    avatarId,
    avatarName,
    voiceId,
    voiceName,
    voiceProvider,
    setDecompositionPlan,
    setScenes,
    addScene,
    updateScene,
    removeScene,
    reorderScenes,
    setAvatar,
    setVoice,
    setStep,
  } = useVideoPipelineStore();

  const [isDecomposing, setIsDecomposing] = useState(false);
  const [decompositionError, setDecompositionError] = useState<string | null>(null);
  const [generatingThumbs, setGeneratingThumbs] = useState<Set<string>>(new Set());
  const [thumbError, setThumbError] = useState<string | null>(null);
  const [uploadingRefScenes, setUploadingRefScenes] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(scenes[0]?.id ?? null);
  const [characterPickerSceneId, setCharacterPickerSceneId] = useState<string | null>(null);
  const [defaultPicker, setDefaultPicker] = useState<'character' | 'voice' | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const prevSelectedRef = useRef<string | null>(selectedSceneId);

  // Keep a storyboard selected — e.g. when the Content Assistant adds them, or
  // after the current one is deleted — so the editor always has something open.
  useEffect(() => {
    if (!selectedSceneId && scenes.length > 0) {
      setSelectedSceneId(scenes[0].id);
    }
  }, [scenes, selectedSceneId]);

  // ── AI assist: draft storyboards from the brief (manual-first — on click) ──
  const handleDecompose = useCallback(async () => {
    if (!brief.description.trim()) {
      return;
    }
    setIsDecomposing(true);
    setDecompositionError(null);
    try {
      const response = await authFetch('/api/video/decompose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: brief.description,
          videoType: brief.videoType,
          platform: brief.platform,
          duration: brief.duration,
          targetAudience: brief.targetAudience,
          painPoints: brief.painPoints,
          talkingPoints: brief.talkingPoints,
          tone: brief.tone,
          callToAction: brief.callToAction,
        }),
      });
      if (!response.ok) {
        const errData = (await response.json()) as { error?: string };
        throw new Error(errData.error ?? 'Could not draft storyboards');
      }
      const data = (await response.json()) as {
        success: boolean;
        plan: {
          scenes: { sceneNumber: number; title: string; scriptText: string; visualDescription: string; suggestedDuration: number; engine: string | null; backgroundPrompt: string | null }[];
          [key: string]: unknown;
        };
      };
      if (data.success && data.plan) {
        setDecompositionPlan({
          videoType: brief.videoType,
          targetAudience: brief.targetAudience ?? '',
          keyMessages: [],
          scenes: data.plan.scenes.map((s) => ({ ...s, engine: 'hedra' as const })),
          assetsNeeded: [],
          avatarRecommendation: null,
          estimatedTotalDuration: data.plan.scenes.reduce((sum, s) => sum + s.suggestedDuration, 0),
          generatedBy: 'ai',
        });
        const pipelineScenes: PipelineScene[] = data.plan.scenes.map((scene) => ({
          id: crypto.randomUUID(),
          sceneNumber: scene.sceneNumber,
          title: scene.title,
          visualDescription: scene.visualDescription,
          scriptText: scene.scriptText,
          screenshotUrl: null,
          avatarId: null,
          avatarName: null,
          voiceId: null,
          voiceProvider: null,
          duration: scene.suggestedDuration,
          engine: 'hedra',
          backgroundPrompt: scene.backgroundPrompt,
          status: 'draft' as const,
        }));
        setScenes(pipelineScenes);
        setSelectedSceneId(pipelineScenes[0]?.id ?? null);
      }
    } catch (err) {
      setDecompositionError(err instanceof Error ? err.message : 'Could not draft storyboards');
    } finally {
      setIsDecomposing(false);
    }
  }, [brief, authFetch, setDecompositionPlan, setScenes]);

  // ── Add storyboard (optionally copy-forward continuity fields) ─────────────
  const buildNewScene = useCallback(
    (copyFrom?: PipelineScene): Omit<PipelineScene, 'id'> => ({
      sceneNumber: scenes.length + 1,
      title: '',
      scriptText: '',
      visualDescription: '',
      screenshotUrl: null,
      avatarId: copyFrom?.avatarId ?? null,
      avatarName: copyFrom?.avatarName ?? null,
      voiceId: copyFrom?.voiceId ?? null,
      voiceProvider: copyFrom?.voiceProvider ?? null,
      duration: copyFrom?.duration ?? 5,
      engine: 'hedra',
      backgroundPrompt: copyFrom?.backgroundPrompt ?? null,
      cinematicConfig: copyFrom?.cinematicConfig,
      location: copyFrom?.location,
      timeOfDay: copyFrom?.timeOfDay,
      weather: copyFrom?.weather,
      ambience: copyFrom?.ambience,
      musicCue: copyFrom?.musicCue,
      wardrobe: copyFrom?.wardrobe,
      status: 'draft',
    }),
    [scenes.length],
  );

  // ── Auto-thumbnail via /api/content/asset-generator/generate ───────────────
  const handleGenerateThumbnail = useCallback(
    async (sceneId: string): Promise<void> => {
      const scene = useVideoPipelineStore.getState().scenes.find((s) => s.id === sceneId);
      if (!scene) {
        return;
      }
      if (!sceneHasDescription(scene)) {
        setThumbError(`Storyboard ${scene.sceneNumber}: add a title, action, or location first so we can picture it.`);
        return;
      }
      setGeneratingThumbs((prev) => new Set(prev).add(sceneId));
      try {
        const result = await requestStoryboardThumbnail(authFetch, scene, brief.aspectRatio);
        if ('error' in result) {
          setThumbError(`Storyboard ${scene.sceneNumber}: ${result.error}`);
          return;
        }
        updateScene(sceneId, { screenshotUrl: result.url });
        setThumbError(null);
        if (projectId) {
          authFetch(`/api/video/project/${projectId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sceneId, updates: { screenshotUrl: result.url } }),
          }).catch(() => { /* non-critical */ });
        }
      } finally {
        setGeneratingThumbs((prev) => {
          const next = new Set(prev);
          next.delete(sceneId);
          return next;
        });
      }
    },
    [authFetch, updateScene, projectId, brief.aspectRatio],
  );

  const handleAddScene = useCallback(
    (copyForward: boolean) => {
      // The storyboard being left auto-generates its preview via the
      // selection-change effect below — no manual step needed.
      const last = scenes[scenes.length - 1];
      addScene(buildNewScene(copyForward ? last : undefined));
      const updated = useVideoPipelineStore.getState().scenes;
      const newScene = updated[updated.length - 1];
      if (newScene) {
        setSelectedSceneId(newScene.id);
      }
    },
    [scenes, addScene, buildNewScene],
  );

  // Auto-generate a preview for the storyboard you just left — the "finished
  // this one" moment. Previews appear automatically, no button required.
  useEffect(() => {
    const prevId = prevSelectedRef.current;
    prevSelectedRef.current = selectedSceneId;
    if (!prevId || prevId === selectedSceneId) {
      return;
    }
    const prev = useVideoPipelineStore.getState().scenes.find((s) => s.id === prevId);
    if (prev && !prev.screenshotUrl && sceneHasDescription(prev) && !generatingThumbs.has(prevId)) {
      void handleGenerateThumbnail(prevId);
    }
  }, [selectedSceneId, generatingThumbs, handleGenerateThumbnail]);

  // Marking a storyboard ready also generates its preview if it doesn't have one.
  const handleToggleReady = useCallback(
    (sceneId: string) => {
      const scene = useVideoPipelineStore.getState().scenes.find((s) => s.id === sceneId);
      if (!scene) {
        return;
      }
      const nowReady = scene.status !== 'approved';
      updateScene(sceneId, { status: nowReady ? 'approved' : 'draft' });
      if (nowReady && !scene.screenshotUrl && sceneHasDescription(scene) && !generatingThumbs.has(sceneId)) {
        void handleGenerateThumbnail(sceneId);
      }
    },
    [updateScene, generatingThumbs, handleGenerateThumbnail],
  );

  // ── Upload reference material (image / video / audio / text) ───────────────
  const handleUploadReference = useCallback(
    async (sceneId: string, files: FileList): Promise<void> => {
      setUploadingRefScenes((prev) => new Set(prev).add(sceneId));
      try {
        for (const file of Array.from(files)) {
          const { mediaType, refType } = fileToMediaType(file);
          const formData = new FormData();
          formData.append('file', file);
          formData.append('type', mediaType);
          formData.append('name', file.name);
          const res = await authFetch('/api/media', { method: 'POST', body: formData });
          const data = (await res.json().catch(() => null)) as { success: boolean; asset?: { id: string; url: string }; error?: string } | null;
          if (res.ok && data?.success && data.asset) {
            const newRef: SceneReference = { id: crypto.randomUUID(), type: refType, name: file.name, url: data.asset.url, mediaId: data.asset.id };
            const current = useVideoPipelineStore.getState().scenes.find((s) => s.id === sceneId);
            updateScene(sceneId, { references: [...(current?.references ?? []), newRef] });
          } else {
            setThumbError(`Upload failed for ${file.name}: ${data?.error ?? 'unknown error'}`);
          }
        }
      } finally {
        setUploadingRefScenes((prev) => {
          const next = new Set(prev);
          next.delete(sceneId);
          return next;
        });
      }
    },
    [authFetch, updateScene],
  );

  const handleRemoveReference = useCallback(
    (sceneId: string, refId: string) => {
      const current = useVideoPipelineStore.getState().scenes.find((s) => s.id === sceneId);
      updateScene(sceneId, { references: (current?.references ?? []).filter((r) => r.id !== refId) });
    },
    [updateScene],
  );

  const handleUpdateReference = useCallback(
    (sceneId: string, refId: string, updates: Partial<SceneReference>) => {
      const current = useVideoPipelineStore.getState().scenes.find((s) => s.id === sceneId);
      updateScene(sceneId, {
        references: (current?.references ?? []).map((r) => (r.id === refId ? { ...r, ...updates } : r)),
      });
    },
    [updateScene],
  );

  // ── Reorder via drag-and-drop ──────────────────────────────────────────────
  const handleDrop = useCallback(
    (toIndex: number) => {
      const from = dragIndexRef.current;
      if (from !== null && from !== toIndex) {
        reorderScenes(from, toIndex);
      }
      dragIndexRef.current = null;
    },
    [reorderScenes],
  );

  // ── Readiness ──────────────────────────────────────────────────────────────
  const missingRequirements: string[] = [];
  if (scenes.length === 0) {
    missingRequirements.push('Add at least one storyboard');
  }
  if (scenes.length > 0 && scenes.some((s) => !s.scriptText.trim())) {
    missingRequirements.push('Every storyboard needs dialogue or voiceover');
  }
  const totalDuration = scenes.reduce((sum, s) => sum + s.duration, 0);
  const readyCount = scenes.filter((s) => s.status === 'approved').length;
  const draftCount = scenes.length - readyCount;
  const isReady = missingRequirements.length === 0;

  // ── Generate: thumbnail missing, compose context, save, advance to render ──
  const handleGenerateVideo = useCallback(async () => {
    if (!isReady) {
      return;
    }
    setIsSaving(true);
    try {
      const missingThumbs = useVideoPipelineStore.getState().scenes.filter((s) => !s.screenshotUrl);
      for (const s of missingThumbs) {
        if (sceneHasDescription(s)) {
          await handleGenerateThumbnail(s.id);
        }
      }
      for (const s of useVideoPipelineStore.getState().scenes) {
        const bg = composeBackgroundPrompt(s);
        if (bg !== s.backgroundPrompt) {
          updateScene(s.id, { backgroundPrompt: bg });
        }
      }

      let batchWeekId: string | undefined;
      let batchIndex: number | undefined;
      if (!projectId) {
        try {
          const raw = sessionStorage.getItem('batch_link');
          if (raw) {
            const parsed = JSON.parse(raw) as { weekId: string; index: number };
            batchWeekId = parsed.weekId;
            batchIndex = parsed.index;
            sessionStorage.removeItem('batch_link');
          }
        } catch {
          // ignore
        }
      }

      const freshScenes = useVideoPipelineStore.getState().scenes;
      await authFetch('/api/video/project/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: projectId ?? undefined,
          batchWeekId,
          batchIndex,
          name: projectName || brief.description.slice(0, 50) || 'Untitled Video',
          brief,
          currentStep: 'generation',
          scenes: freshScenes.map((s) => ({
            id: s.id,
            sceneNumber: s.sceneNumber,
            title: s.title,
            visualDescription: s.visualDescription,
            scriptText: s.scriptText,
            screenshotUrl: s.screenshotUrl ?? null,
            avatarId: s.avatarId ?? null,
            avatarName: s.avatarName ?? null,
            voiceId: s.voiceId ?? null,
            voiceProvider: s.voiceProvider ?? null,
            duration: s.duration,
            engine: s.engine ?? 'hedra',
            backgroundPrompt: s.backgroundPrompt ?? null,
            cinematicConfig: s.cinematicConfig,
            location: s.location,
            timeOfDay: s.timeOfDay,
            weather: s.weather,
            ambience: s.ambience,
            musicCue: s.musicCue,
            wardrobe: s.wardrobe,
            references: s.references,
            status: s.status,
          })),
          avatarId: avatarId ?? null,
          avatarName: avatarName ?? null,
          voiceId: voiceId ?? null,
          voiceName: voiceName ?? null,
          voiceProvider: voiceProvider ?? null,
          status: 'approved',
        }),
      });
    } catch {
      // Non-critical — continue to generation even if save fails.
    } finally {
      setIsSaving(false);
    }
    setStep('generation');
  }, [isReady, handleGenerateThumbnail, updateScene, authFetch, projectId, projectName, brief, avatarId, avatarName, voiceId, voiceName, voiceProvider, setStep]);

  const selectedScene = selectedSceneId ? scenes.find((s) => s.id === selectedSceneId) ?? null : null;
  const selectedIndex = selectedScene ? scenes.indexOf(selectedScene) : -1;
  const previousScene = selectedIndex > 0 ? scenes[selectedIndex - 1] : null;
  const pickerScene = characterPickerSceneId ? scenes.find((s) => s.id === characterPickerSceneId) ?? null : null;

  // ════════════════════════════════════════════════════════════════════════
  // Render
  // ════════════════════════════════════════════════════════════════════════

  return (
    // pb-28 keeps the footer / strip clear of the floating Content Assistant launcher.
    <div className="space-y-4 pb-28">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><Layers className="w-5 h-5 text-primary" />Storyboard</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Build your video one storyboard at a time. Each is a clip; on Generate they stitch in order.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setDefaultPicker('character')} title="Default character for storyboards that don't set their own">
            <Users className="w-3.5 h-3.5" />{avatarName ?? 'Default character'}
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setDefaultPicker('voice')} title="Default voice">
            <Mic className="w-3.5 h-3.5" />{voiceName ?? 'Default voice'}
          </Button>
          {brief.description.trim() && (
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { void handleDecompose(); }} disabled={isDecomposing}>
              {isDecomposing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {scenes.length > 0 ? 'Redraft with AI' : 'Draft with AI'}
            </Button>
          )}
        </div>
      </div>

      {/* Error banners */}
      {thumbError && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20">
          <div className="flex items-center gap-2 text-xs text-destructive"><AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{thumbError}</div>
          <button type="button" className="text-destructive/60 hover:text-destructive" onClick={() => setThumbError(null)}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
      {decompositionError && (
        <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive">{decompositionError}</p>
          <Button size="sm" variant="ghost" onClick={() => { void handleDecompose(); }} className="ml-auto text-destructive">Retry</Button>
        </div>
      )}

      {isDecomposing && (
        <Card className="bg-card/50 border-border-strong">
          <CardContent className="p-8 flex flex-col items-center"><Loader2 className="w-8 h-8 animate-spin text-primary mb-3" /><p className="text-sm text-foreground">Drafting your storyboards from the brief...</p></CardContent>
        </Card>
      )}

      {/* Main: deep controls (left) + live preview (right) */}
      {scenes.length === 0 && !isDecomposing ? (
        <Card className="bg-card/50 border-border-strong border-dashed">
          <CardContent className="p-12 flex flex-col items-center text-center">
            <Layers className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-foreground text-sm mb-1">Start your first storyboard</p>
            <p className="text-muted-foreground text-xs mb-4 max-w-sm">Add a storyboard and direct the shot — action, setting, cast, camera and look — or let AI draft a first pass from your brief.</p>
            <div className="flex gap-2">
              <Button size="sm" className="gap-1.5 bg-primary hover:bg-primary-dark text-white" onClick={() => handleAddScene(false)}><Plus className="w-3.5 h-3.5" />Add Storyboard</Button>
              {brief.description.trim() && (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { void handleDecompose(); }}><Sparkles className="w-3.5 h-3.5" />Draft with AI</Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : selectedScene ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(340px,_400px)] gap-4">
          <div>
            <StoryboardControls
              key={selectedScene.id}
              scene={selectedScene}
              index={selectedIndex}
              previousScene={previousScene}
              isUploadingRef={uploadingRefScenes.has(selectedScene.id)}
              onUpdate={(updates) => updateScene(selectedScene.id, updates)}
              onOpenCharacterPicker={() => setCharacterPickerSceneId(selectedScene.id)}
              onUploadReference={(files) => { void handleUploadReference(selectedScene.id, files); }}
              onRemoveReference={(refId) => handleRemoveReference(selectedScene.id, refId)}
              onUpdateReference={(refId, updates) => handleUpdateReference(selectedScene.id, refId, updates)}
            />
          </div>
          <PreviewPanel
            scene={selectedScene}
            isGeneratingThumb={generatingThumbs.has(selectedScene.id)}
            onGenerateThumb={() => { void handleGenerateThumbnail(selectedScene.id); }}
            onToggleReady={() => handleToggleReady(selectedScene.id)}
          />
        </div>
      ) : (
        <Card className="bg-card/50 border-border-strong">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">Select a storyboard below to edit it.</CardContent>
        </Card>
      )}

      {/* Bottom: storyboard strip */}
      {scenes.length > 0 && (
        <div className="rounded-lg border border-border-strong bg-card/40 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5"><Film className="w-3.5 h-3.5 text-primary" />Storyboards · {readyCount}/{scenes.length} ready</span>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{Math.floor(totalDuration / 60)}:{String(Math.floor(totalDuration % 60)).padStart(2, '0')} total · drag to reorder</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {scenes.map((scene, idx) => (
              <StripItem
                key={scene.id}
                scene={scene}
                index={idx}
                isSelected={selectedSceneId === scene.id}
                isGeneratingThumb={generatingThumbs.has(scene.id)}
                onSelect={() => setSelectedSceneId(scene.id)}
                onDelete={() => { removeScene(scene.id); if (selectedSceneId === scene.id) { setSelectedSceneId(null); } }}
                onDuplicate={() => { addScene({ ...buildNewScene(scene), title: `${sceneLabel(scene, idx)} (copy)`, scriptText: scene.scriptText, visualDescription: scene.visualDescription }); }}
                onGenerateThumb={() => { void handleGenerateThumbnail(scene.id); }}
                onDragStart={() => { dragIndexRef.current = idx; }}
                onDrop={() => handleDrop(idx)}
              />
            ))}
            <div className="flex flex-col gap-2 w-40 flex-shrink-0">
              <button type="button" onClick={() => handleAddScene(false)} className="flex-1 aspect-video bg-card/30 border-2 border-dashed border-border-strong rounded-lg flex flex-col items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors">
                <Plus className="w-6 h-6 mb-1" /><span className="text-[11px] font-medium">Add Storyboard</span>
              </button>
              <button type="button" onClick={() => handleAddScene(true)} className="flex items-center justify-center gap-1 text-[10px] text-primary-light hover:underline py-1" title="Add a storyboard that copies setting, look and cast from the last one">
                <CopyPlus className="w-3 h-3" />Add similar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Readiness */}
      {missingRequirements.length > 0 && scenes.length > 0 && (
        <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
          <p className="text-xs font-medium text-primary-light mb-1">Before generating:</p>
          <ul className="text-xs text-primary-light/70 space-y-0.5">
            {missingRequirements.map((req) => (<li key={req} className="flex items-center gap-1.5"><AlertCircle className="w-3 h-3" />{req}</li>))}
          </ul>
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-between items-center pt-2">
        <div className="text-xs text-muted-foreground">
          {scenes.length === 0
            ? ''
            : draftCount > 0
              ? `${draftCount} storyboard${draftCount > 1 ? 's' : ''} still in draft — you can generate anyway`
              : 'All storyboards marked ready'}
        </div>
        <Button size="sm" className="gap-2 bg-primary hover:bg-primary-dark text-white" disabled={!isReady || isSaving} onClick={() => { void handleGenerateVideo(); }}>
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {isSaving ? 'Preparing…' : 'Generate Video'}
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Per-storyboard character picker */}
      {pickerScene && (
        <Modal
          title="Cast a character into this storyboard"
          icon={<Users className="w-4 h-4" />}
          onClose={() => setCharacterPickerSceneId(null)}
          headerExtra={pickerScene.avatarId ? (
            <Button variant="outline" size="sm" className="text-xs" onClick={() => { updateScene(pickerScene.id, { avatarId: null, avatarName: null }); setCharacterPickerSceneId(null); }}>Clear</Button>
          ) : undefined}
        >
          <AvatarPicker
            selectedAvatarId={pickerScene.avatarId}
            onSelect={() => { /* voice data handled via onProfileLoaded */ }}
            onProfileLoaded={(profile) => {
              updateScene(pickerScene.id, {
                avatarId: profile.id,
                avatarName: profile.name,
                ...(profile.voiceId ? { voiceId: profile.voiceId, voiceProvider: profile.voiceProvider } : {}),
              });
              setCharacterPickerSceneId(null);
            }}
          />
        </Modal>
      )}

      {/* Default character / voice pickers */}
      {defaultPicker === 'character' && (
        <Modal title="Default character" icon={<Users className="w-4 h-4" />} onClose={() => setDefaultPicker(null)}>
          <p className="text-xs text-muted-foreground mb-3">Used for any storyboard that doesn&apos;t cast its own character.</p>
          <AvatarPicker selectedAvatarId={avatarId} onSelect={(id, name) => { setAvatar(id, name); setDefaultPicker(null); }} />
        </Modal>
      )}
      {defaultPicker === 'voice' && (
        <Modal title="Default voice" icon={<Mic className="w-4 h-4" />} onClose={() => setDefaultPicker(null)}>
          <VoicePicker selectedVoiceId={voiceId} onSelect={(id, name, provider) => { setVoice(id, name, provider); setDefaultPicker(null); }} />
        </Modal>
      )}
    </div>
  );
}
