'use client';

/**
 * StepStoryboard — Manual-first, human-walkable scene builder.
 *
 * The operator builds a video scene-by-scene with rich, plain-language context
 * grouped into Shot · Setting · Look & Camera · Sound · Cast · References.
 * Each group can copy-forward from the previous scene for continuity. Scenes
 * are unlimited; a thumbnail is auto-generated from the scene description.
 *
 * Context channels (all feed the SAME generation):
 *  1. Structured fields  — the grouped inputs below.
 *  2. Conversation       — the Content Assistant pre-fills fields (separate panel).
 *  3. Uploaded refs      — per-scene image / video / audio / text in References.
 *
 * Engine is Hedra only. The model is inferred per scene (character present →
 * Character-3 avatar model; none → Kling O3 prompt model) — these are Hedra
 * models, never separate "providers".
 *
 * Reuses: PipelineScene + CinematicConfig + CinematicControlsPanel (the preset
 * library) + AvatarPicker/VoicePicker + the video-pipeline Zustand store.
 */

import {
  useState,
  useCallback,
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
  ArrowLeft,
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
import { AvatarPicker } from './AvatarPicker';
import { VoicePicker } from './VoicePicker';
import type { PipelineScene, SceneReference } from '@/types/video-pipeline';
import type { CinematicConfig } from '@/types/creative-studio';

// ============================================================================
// Helpers
// ============================================================================

/** Summarize the cinematic config into a short prompt fragment. */
function cinematicSummary(config?: CinematicConfig): string {
  if (!config) {
    return '';
  }
  return Object.entries(config)
    .filter(([key, val]) =>
      val !== undefined &&
      val !== null &&
      val !== '' &&
      key !== 'temperature' &&
      key !== 'subjectUnawareOfCamera',
    )
    .map(([, val]) => (Array.isArray(val) ? val.join(', ') : String(val)))
    .join(', ');
}

/** Compose the Setting + Sound fields into the environment prompt fed to generation. */
function composeBackgroundPrompt(scene: PipelineScene): string | null {
  const parts = [
    scene.location,
    scene.timeOfDay,
    scene.weather,
    scene.ambience ? `ambience: ${scene.ambience}` : '',
  ].filter((p): p is string => Boolean(p?.trim()));
  if (parts.length === 0) {
    return scene.backgroundPrompt ?? null;
  }
  return parts.join(', ');
}

/** Build the auto-thumbnail prompt from the scene's plain-language fields. */
function buildThumbnailPrompt(scene: PipelineScene): string {
  const cine = cinematicSummary(scene.cinematicConfig);
  const prompt = [
    'Cinematic film still, photorealistic, professional color grade.',
    scene.title ? `Scene: ${scene.title}.` : '',
    scene.visualDescription ? `Action: ${scene.visualDescription}.` : '',
    scene.location ? `Location: ${scene.location}.` : '',
    scene.timeOfDay ? `Time of day: ${scene.timeOfDay}.` : '',
    scene.weather ? `Weather/light: ${scene.weather}.` : '',
    scene.wardrobe ? `Wardrobe: ${scene.wardrobe}.` : '',
    cine ? `Style: ${cine}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
  // The asset-generator caps prompts at 1000 chars.
  return prompt.length > 1000 ? `${prompt.slice(0, 997)}...` : prompt;
}

function hasText(value?: string | null): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Does the scene have enough description to picture it? */
function sceneHasDescription(scene: PipelineScene): boolean {
  return hasText(scene.title) || hasText(scene.visualDescription) || hasText(scene.location);
}

/** Human-readable label for a scene, falling back to its position. */
function sceneLabel(scene: PipelineScene, index: number): string {
  const trimmed = scene.title?.trim();
  return trimmed !== undefined && trimmed.length > 0 ? trimmed : `Scene ${index + 1}`;
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
  /** Shown as a "Same as previous" button when a copy handler is provided. */
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
            title="Copy these fields from the previous scene"
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

// Small labelled text input
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
// Scene strip item (draggable thumbnail)
// ============================================================================

interface SceneStripItemProps {
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

const SceneStripItem = forwardRef<HTMLDivElement, SceneStripItemProps>(function SceneStripItem(
  {
    scene,
    index,
    isSelected,
    isGeneratingThumb,
    onSelect,
    onDelete,
    onDuplicate,
    onGenerateThumb,
    onDragStart,
    onDrop,
  },
  ref,
) {
  const [imgBroken, setImgBroken] = useState(false);
  const handleImageError = useCallback((e: SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.style.display = 'none';
    setImgBroken(true);
  }, []);

  return (
    // Plain div (not motion.div) so native HTML5 drag handlers don't collide
    // with framer-motion's own onDragStart/onDrag pointer-gesture signatures.
    <div
      ref={ref}
      draggable
      onDragStart={onDragStart}
      onDragOver={(e: DragEvent) => e.preventDefault()}
      onDrop={onDrop}
      onClick={onSelect}
      className={`group relative w-44 flex-shrink-0 cursor-pointer rounded-lg border overflow-hidden transition-all ${
        isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-border-strong hover:border-border'
      }`}
    >
      <div className="relative aspect-video bg-surface-elevated/50">
        {scene.screenshotUrl && !imgBroken ? (
          <Image
            src={scene.screenshotUrl}
            alt={`Scene ${index + 1}`}
            fill
            className="object-cover"
            unoptimized
            onError={handleImageError}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
            {isGeneratingThumb ? (
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            ) : (
              <>
                <ImageIcon className="w-6 h-6 mb-1" />
                <span className="text-[9px]">{imgBroken ? 'Preview expired' : 'No preview'}</span>
              </>
            )}
          </div>
        )}

        <div className="absolute top-1.5 left-1.5 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
          Shot {index + 1}
        </div>

        <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onGenerateThumb(); }}
            disabled={isGeneratingThumb}
            className="bg-black/70 hover:bg-primary text-white p-1 rounded transition-colors"
            title="Generate thumbnail from this scene"
          >
            {isGeneratingThumb ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
            className="bg-black/70 hover:bg-border-strong text-white p-1 rounded transition-colors"
            title="Duplicate scene"
          >
            <Copy className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="bg-black/70 hover:bg-destructive text-white p-1 rounded transition-colors"
            title="Delete scene"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>

        <div className="absolute bottom-1.5 left-1.5 opacity-0 group-hover:opacity-60 transition-opacity cursor-grab">
          <GripVertical className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="absolute bottom-1.5 right-1.5 bg-black/70 text-foreground text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" />
          {scene.duration}s
        </div>
      </div>

      <div className="p-2">
        <p className="text-[11px] font-semibold text-white truncate">
          {sceneLabel(scene, index)}
        </p>
        <div className="flex items-center gap-1 mt-0.5">
          {scene.avatarId ? (
            <Badge variant="secondary" className="text-[8px] px-1 py-0 bg-primary/20 text-primary-light">
              <Theater className="w-2 h-2 mr-0.5" />
              {scene.avatarName ?? 'Character'}
            </Badge>
          ) : (
            <span className="text-[9px] text-muted-foreground">No character</span>
          )}
        </div>
      </div>
    </div>
  );
});

// ============================================================================
// Character picker modal (per-scene Cast)
// ============================================================================

interface CharacterPickerModalProps {
  currentAvatarId: string | null;
  onSelect: (avatarId: string, avatarName: string, voiceId: string | null, voiceProvider: PipelineScene['voiceProvider']) => void;
  onClear: () => void;
  onClose: () => void;
}

function CharacterPickerModal({ currentAvatarId, onSelect, onClear, onClose }: CharacterPickerModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border-strong rounded-xl w-full max-w-3xl shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-border-strong">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Cast a character into this scene
          </h2>
          <div className="flex items-center gap-2">
            {currentAvatarId && (
              <Button variant="outline" size="sm" className="text-xs" onClick={onClear}>
                Clear
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="p-4 max-h-[65vh] overflow-y-auto">
          <AvatarPicker
            selectedAvatarId={currentAvatarId}
            onSelect={() => { /* full selection handled via onProfileLoaded for voice data */ }}
            onProfileLoaded={(profile) => {
              onSelect(profile.id, profile.name, profile.voiceId, profile.voiceProvider);
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// References uploader (image / video / audio / text)
// ============================================================================

interface ReferenceUploaderProps {
  references: SceneReference[];
  isUploading: boolean;
  onUpload: (files: FileList) => void;
  onRemove: (refId: string) => void;
}

function ReferenceUploader({ references, isUploading, onUpload, onRemove }: ReferenceUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          if (e.dataTransfer.files.length > 0) {
            onUpload(e.dataTransfer.files);
          }
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-3 py-5 cursor-pointer transition-colors ${
          dragActive ? 'border-primary bg-primary/5' : 'border-border-strong hover:border-primary/50'
        }`}
      >
        {isUploading ? (
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        ) : (
          <Upload className="w-5 h-5 text-muted-foreground" />
        )}
        <p className="text-xs text-muted-foreground text-center">
          Drop or click to upload context — image, video, audio, or text
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*,audio/*,.txt,.md,.pdf,.doc,.docx"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onUpload(e.target.files);
              e.target.value = '';
            }
          }}
        />
      </div>

      {references.length > 0 && (
        <div className="space-y-1.5">
          {references.map((ref) => (
            <div
              key={ref.id}
              className="flex items-center gap-2 rounded-md border border-border-strong bg-surface-elevated px-2.5 py-1.5"
            >
              {ref.type === 'image' ? (
                <div className="relative w-9 h-9 rounded overflow-hidden bg-card flex-shrink-0">
                  <Image src={ref.url} alt={ref.name} fill className="object-cover" unoptimized />
                </div>
              ) : (
                <span className="flex w-9 h-9 items-center justify-center rounded bg-card text-primary flex-shrink-0">
                  {REFERENCE_ICON[ref.type]}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs text-foreground truncate">{ref.name}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{ref.type}</p>
              </div>
              <button
                type="button"
                onClick={() => onRemove(ref.id)}
                className="text-muted-foreground hover:text-destructive p-1"
                title="Remove reference"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Scene detail editor (plain-language groups)
// ============================================================================

interface SceneDetailEditorProps {
  scene: PipelineScene;
  index: number;
  previousScene: PipelineScene | null;
  isUploadingRef: boolean;
  onUpdate: (updates: Partial<PipelineScene>) => void;
  onOpenCharacterPicker: () => void;
  onUploadReference: (files: FileList) => void;
  onRemoveReference: (refId: string) => void;
}

function SceneDetailEditor({
  scene,
  index,
  previousScene,
  isUploadingRef,
  onUpdate,
  onOpenCharacterPicker,
  onUploadReference,
  onRemoveReference,
}: SceneDetailEditorProps) {
  const config = scene.cinematicConfig ?? {};
  const handleConfigChange = useCallback(
    (newConfig: CinematicConfig) => onUpdate({ cinematicConfig: newConfig }),
    [onUpdate],
  );

  const usesCharacter = Boolean(scene.avatarId);
  const hedraModel = usesCharacter ? 'Hedra Character-3 (avatar)' : 'Hedra Kling O3 (prompt)';

  return (
    <Card className="bg-card/80 border-primary/30 border">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Film className="w-4 h-4 text-primary" />
            Scene {index + 1}{scene.title?.trim() ? ` — ${scene.title}` : ''}
          </h3>
          <Badge variant="secondary" className="text-[10px] bg-surface-elevated text-muted-foreground">
            {hedraModel}
          </Badge>
        </div>

        {/* ── Shot ─────────────────────────────────────────────── */}
        <Group title="Shot" icon={<Film className="w-4 h-4" />}>
          <Field
            label="Title"
            value={scene.title ?? ''}
            onChange={(v) => onUpdate({ title: v || undefined })}
            placeholder={`Scene ${index + 1} — e.g. "The Hook"`}
          />
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Action (what happens on screen)</Label>
            <Textarea
              value={scene.visualDescription ?? ''}
              onChange={(e) => onUpdate({ visualDescription: e.target.value || undefined })}
              rows={2}
              placeholder="Sarah turns to her laptop as the dashboard lights up..."
              className="bg-surface-elevated border-border-strong text-white placeholder:text-muted-foreground text-sm resize-y"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Dialogue / Voiceover</Label>
            <Textarea
              value={scene.scriptText}
              onChange={(e) => onUpdate({ scriptText: e.target.value })}
              rows={3}
              placeholder={'NARRATOR: Welcome to SalesVelocity...\nSARAH (to camera): I used to spend hours on spreadsheets.'}
              className="bg-surface-elevated border-border-strong text-white placeholder:text-muted-foreground text-sm resize-y font-mono"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-[11px] text-muted-foreground">Duration</Label>
            <Input
              type="number"
              value={scene.duration}
              onChange={(e) => onUpdate({ duration: Math.max(1, Number(e.target.value)) })}
              min={1}
              max={120}
              className="w-20 bg-surface-elevated border-border-strong text-white text-center h-8"
            />
            <span className="text-xs text-muted-foreground">seconds</span>
          </div>
        </Group>

        {/* ── Setting ──────────────────────────────────────────── */}
        <Group
          title="Setting"
          icon={<MapPin className="w-4 h-4" />}
          onCopyForward={previousScene ? () => onUpdate({
            location: previousScene.location,
            timeOfDay: previousScene.timeOfDay,
            weather: previousScene.weather,
          }) : undefined}
        >
          <Field label="Location" value={scene.location ?? ''} onChange={(v) => onUpdate({ location: v || undefined })} placeholder="Modern open-plan office" />
          <Field label="Time of day" value={scene.timeOfDay ?? ''} onChange={(v) => onUpdate({ timeOfDay: v || undefined })} placeholder="Late afternoon" />
          <Field label="Weather / light" value={scene.weather ?? ''} onChange={(v) => onUpdate({ weather: v || undefined })} placeholder="Golden-hour sun through the windows" />
        </Group>

        {/* ── Look & Camera (cinematic preset library) ─────────── */}
        <Group
          title="Look & Camera"
          icon={<Camera className="w-4 h-4" />}
          defaultOpen={false}
          onCopyForward={previousScene?.cinematicConfig ? () => onUpdate({ cinematicConfig: previousScene.cinematicConfig }) : undefined}
        >
          <p className="text-[10px] text-muted-foreground">
            Lighting, mood, shot type, lens, film stock & color — pick a quick style or open advanced controls.
          </p>
          <CinematicControlsPanel config={config} onChange={handleConfigChange} compact />
        </Group>

        {/* ── Sound ────────────────────────────────────────────── */}
        <Group
          title="Sound"
          icon={<Volume2 className="w-4 h-4" />}
          defaultOpen={false}
          onCopyForward={previousScene ? () => onUpdate({
            ambience: previousScene.ambience,
            musicCue: previousScene.musicCue,
          }) : undefined}
        >
          <Field label="Background ambience / noise" value={scene.ambience ?? ''} onChange={(v) => onUpdate({ ambience: v || undefined })} placeholder="Quiet office hum, distant keyboards" />
          <Field label="Music cue" value={scene.musicCue ?? ''} onChange={(v) => onUpdate({ musicCue: v || undefined })} placeholder="Uplifting corporate underscore building to the CTA" />
        </Group>

        {/* ── Cast ─────────────────────────────────────────────── */}
        <Group
          title="Cast"
          icon={<Users className="w-4 h-4" />}
          defaultOpen={false}
          onCopyForward={previousScene ? () => onUpdate({
            avatarId: previousScene.avatarId,
            avatarName: previousScene.avatarName,
            voiceId: previousScene.voiceId,
            voiceProvider: previousScene.voiceProvider,
            wardrobe: previousScene.wardrobe,
          }) : undefined}
        >
          <div className="flex items-center gap-2">
            {scene.avatarId ? (
              <Badge variant="secondary" className="text-xs bg-primary/20 text-primary-light gap-1">
                <Theater className="w-3 h-3" />
                {scene.avatarName ?? 'Character'}
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground">No character — scene renders prompt-only (Kling O3)</span>
            )}
            <Button variant="outline" size="sm" className="text-xs gap-1.5 ml-auto" onClick={onOpenCharacterPicker}>
              <Users className="w-3.5 h-3.5" />
              {scene.avatarId ? 'Change character' : 'Choose character'}
            </Button>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Shirt className="w-3 h-3" /> Wardrobe
            </Label>
            <Input
              value={scene.wardrobe ?? ''}
              onChange={(e) => onUpdate({ wardrobe: e.target.value || undefined })}
              placeholder="Smart-casual blazer, no tie"
              className="bg-surface-elevated border-border-strong text-white placeholder:text-muted-foreground text-sm h-9"
            />
          </div>
        </Group>

        {/* ── References ───────────────────────────────────────── */}
        <Group title="References" icon={<Upload className="w-4 h-4" />} defaultOpen={false}>
          <ReferenceUploader
            references={scene.references ?? []}
            isUploading={isUploadingRef}
            onUpload={onUploadReference}
            onRemove={onRemoveReference}
          />
        </Group>
      </CardContent>
    </Card>
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
  const [activeTab, setActiveTab] = useState<'scenes' | 'avatar' | 'voice'>('scenes');
  const dragIndexRef = useRef<number | null>(null);

  // ── AI assist: draft scenes from the brief (manual-first — only on click) ──
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
        throw new Error(errData.error ?? 'Could not draft scenes');
      }
      const data = (await response.json()) as {
        success: boolean;
        plan: {
          scenes: {
            sceneNumber: number;
            title: string;
            scriptText: string;
            visualDescription: string;
            suggestedDuration: number;
            engine: string | null;
            backgroundPrompt: string | null;
          }[];
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
      setDecompositionError(err instanceof Error ? err.message : 'Could not draft scenes');
    } finally {
      setIsDecomposing(false);
    }
  }, [brief, authFetch, setDecompositionPlan, setScenes]);

  // ── Add scene (optionally copy-forward continuity fields) ──────────────────
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

  const handleAddScene = useCallback(
    (copyForward: boolean) => {
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

  // ── Auto-thumbnail via /api/content/asset-generator/generate ───────────────
  const handleGenerateThumbnail = useCallback(
    async (sceneId: string): Promise<void> => {
      const scene = useVideoPipelineStore.getState().scenes.find((s) => s.id === sceneId);
      if (!scene) {
        return;
      }
      if (!sceneHasDescription(scene)) {
        setThumbError(`Scene ${scene.sceneNumber}: add a shot title, action, or location first so we can picture it.`);
        return;
      }
      setGeneratingThumbs((prev) => new Set(prev).add(sceneId));
      try {
        const response = await authFetch('/api/content/asset-generator/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: buildThumbnailPrompt(scene),
            aspectRatio: brief.aspectRatio,
            name: scene.title?.trim()
              ? `Scene ${scene.sceneNumber}: ${scene.title}`
              : `Scene ${scene.sceneNumber} thumbnail`,
          }),
        });
        const data = (await response.json().catch(() => null)) as
          | { success: boolean; url?: string; error?: string }
          | null;
        if (!response.ok || !data?.success || !data.url) {
          setThumbError(`Scene ${scene.sceneNumber}: ${data?.error ?? `thumbnail failed (${response.status})`}`);
          return;
        }
        updateScene(sceneId, { screenshotUrl: data.url });
        setThumbError(null);
        // Persist to the project doc so it survives reloads (fire-and-forget).
        if (projectId) {
          authFetch(`/api/video/project/${projectId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sceneId, updates: { screenshotUrl: data.url } }),
          }).catch(() => { /* non-critical */ });
        }
      } catch (err) {
        setThumbError(`Scene ${scene.sceneNumber}: ${err instanceof Error ? err.message : 'thumbnail failed'}`);
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
          const data = (await res.json().catch(() => null)) as
            | { success: boolean; asset?: { id: string; url: string }; error?: string }
            | null;
          if (res.ok && data?.success && data.asset) {
            const newRef: SceneReference = {
              id: crypto.randomUUID(),
              type: refType,
              name: file.name,
              url: data.asset.url,
              mediaId: data.asset.id,
            };
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
    missingRequirements.push('Add at least one scene');
  }
  if (scenes.length > 0 && scenes.some((s) => !s.scriptText.trim())) {
    missingRequirements.push('Every scene needs dialogue or voiceover');
  }
  const totalDuration = scenes.reduce((sum, s) => sum + s.duration, 0);
  const isReady = missingRequirements.length === 0;

  // ── Generate: auto-thumbnail missing scenes, compose context, save, advance ─
  const handleGenerateVideo = useCallback(async () => {
    if (!isReady) {
      return;
    }
    setIsSaving(true);
    try {
      // 1. Auto-thumbnail any scene still missing a preview (best-effort).
      const missingThumbs = useVideoPipelineStore.getState().scenes.filter((s) => !s.screenshotUrl);
      for (const s of missingThumbs) {
        if (sceneHasDescription(s)) {
          await handleGenerateThumbnail(s.id);
        }
      }

      // 2. Compose Setting/Sound into backgroundPrompt so generation sees the context.
      for (const s of useVideoPipelineStore.getState().scenes) {
        const bg = composeBackgroundPrompt(s);
        if (bg !== s.backgroundPrompt) {
          updateScene(s.id, { backgroundPrompt: bg });
        }
      }

      // 3. Read batch link (Content Calendar integration).
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

      // 4. Save the full storyboard.
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
  }, [
    isReady,
    handleGenerateThumbnail,
    updateScene,
    authFetch,
    projectId,
    projectName,
    brief,
    avatarId,
    avatarName,
    voiceId,
    voiceName,
    voiceProvider,
    setStep,
  ]);

  const selectedScene = selectedSceneId ? scenes.find((s) => s.id === selectedSceneId) ?? null : null;
  const selectedIndex = selectedScene ? scenes.indexOf(selectedScene) : -1;
  const previousScene = selectedIndex > 0 ? scenes[selectedIndex - 1] : null;
  const pickerScene = characterPickerSceneId ? scenes.find((s) => s.id === characterPickerSceneId) ?? null : null;

  // ════════════════════════════════════════════════════════════════════════
  // Render
  // ════════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            Storyboard
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Build your video scene by scene. Fill in the context, cast a character, drop in references.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {brief.description.trim() && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              onClick={() => { void handleDecompose(); }}
              disabled={isDecomposing}
            >
              {isDecomposing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {scenes.length > 0 ? 'Redraft with AI' : 'Draft scenes with AI'}
            </Button>
          )}
        </div>
      </div>

      {/* Error banners */}
      {thumbError && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20">
          <div className="flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {thumbError}
          </div>
          <button type="button" className="text-destructive/60 hover:text-destructive" onClick={() => setThumbError(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {decompositionError && (
        <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive">{decompositionError}</p>
          <Button size="sm" variant="ghost" onClick={() => { void handleDecompose(); }} className="ml-auto text-destructive">
            Retry
          </Button>
        </div>
      )}

      {/* Summary bar */}
      <Card className="bg-card/50 border-border-strong">
        <CardContent className="p-3">
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" />{scenes.length} scenes</span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {Math.floor(totalDuration / 60)}:{String(Math.floor(totalDuration % 60)).padStart(2, '0')}
            </span>
            <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />{avatarName ?? <span className="text-muted-foreground">No default character</span>}</span>
            <span className="flex items-center gap-1.5"><Mic className="w-3.5 h-3.5" />{voiceName ?? <span className="text-muted-foreground">No default voice</span>}</span>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border-strong">
        {[
          { id: 'scenes' as const, label: 'Scenes', icon: Layers, count: scenes.length },
          { id: 'avatar' as const, label: 'Default Character', icon: Users, badge: avatarName },
          { id: 'voice' as const, label: 'Default Voice', icon: Mic, badge: voiceName },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === tab.id ? 'border-primary text-primary-light' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
            {tab.count !== undefined && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">{tab.count}</Badge>
            )}
            {tab.badge && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 bg-green-500/20 text-green-400">{tab.badge}</Badge>
            )}
          </button>
        ))}
      </div>

      {/* Scenes tab */}
      {activeTab === 'scenes' && (
        <>
          {isDecomposing && (
            <Card className="bg-card/50 border-border-strong">
              <CardContent className="p-8 flex flex-col items-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
                <p className="text-sm text-foreground">Drafting your scenes from the brief...</p>
              </CardContent>
            </Card>
          )}

          {scenes.length === 0 && !isDecomposing ? (
            <Card className="bg-card/50 border-border-strong border-dashed">
              <CardContent className="p-12 flex flex-col items-center text-center">
                <Layers className="w-12 h-12 text-muted-foreground mb-3" />
                <p className="text-foreground text-sm mb-1">Start your first scene</p>
                <p className="text-muted-foreground text-xs mb-4 max-w-sm">
                  Add a scene and fill in the shot, setting, look, sound, cast and references — or let AI draft a first pass from your brief.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" className="gap-1.5 bg-primary hover:bg-primary-dark text-white" onClick={() => handleAddScene(false)}>
                    <Plus className="w-3.5 h-3.5" />
                    Add Scene
                  </Button>
                  {brief.description.trim() && (
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { void handleDecompose(); }}>
                      <Sparkles className="w-3.5 h-3.5" />
                      Draft with AI
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Scene strip */}
              <div className="flex gap-3 overflow-x-auto pb-2">
                <AnimatePresence mode="popLayout">
                  {scenes.map((scene, idx) => (
                    <SceneStripItem
                      key={scene.id}
                      scene={scene}
                      index={idx}
                      isSelected={selectedSceneId === scene.id}
                      isGeneratingThumb={generatingThumbs.has(scene.id)}
                      onSelect={() => setSelectedSceneId(scene.id)}
                      onDelete={() => {
                        removeScene(scene.id);
                        if (selectedSceneId === scene.id) {
                          setSelectedSceneId(null);
                        }
                      }}
                      onDuplicate={() => {
                        addScene({ ...buildNewScene(scene), title: `${sceneLabel(scene, idx)} (copy)`, scriptText: scene.scriptText, visualDescription: scene.visualDescription });
                      }}
                      onGenerateThumb={() => { void handleGenerateThumbnail(scene.id); }}
                      onDragStart={() => { dragIndexRef.current = idx; }}
                      onDrop={() => handleDrop(idx)}
                    />
                  ))}
                </AnimatePresence>

                {/* Add scene tile */}
                <div className="flex flex-col gap-2 w-44 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handleAddScene(false)}
                    className="flex-1 aspect-video bg-card/30 border-2 border-dashed border-border-strong rounded-lg flex flex-col items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors"
                  >
                    <Plus className="w-6 h-6 mb-1" />
                    <span className="text-[11px] font-medium">Add Scene</span>
                  </button>
                  {scenes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleAddScene(true)}
                      className="flex items-center justify-center gap-1 text-[10px] text-primary-light hover:underline py-1"
                      title="Add a scene that copies the setting, look and cast from the last scene"
                    >
                      <CopyPlus className="w-3 h-3" />
                      Add similar scene
                    </button>
                  )}
                </div>
              </div>

              {/* Selected scene detail */}
              {selectedScene && (
                <SceneDetailEditor
                  key={selectedScene.id}
                  scene={selectedScene}
                  index={selectedIndex}
                  previousScene={previousScene}
                  isUploadingRef={uploadingRefScenes.has(selectedScene.id)}
                  onUpdate={(updates) => updateScene(selectedScene.id, updates)}
                  onOpenCharacterPicker={() => setCharacterPickerSceneId(selectedScene.id)}
                  onUploadReference={(files) => { void handleUploadReference(selectedScene.id, files); }}
                  onRemoveReference={(refId) => handleRemoveReference(selectedScene.id, refId)}
                />
              )}
            </>
          )}
        </>
      )}

      {activeTab === 'avatar' && (
        <Card className="bg-card/50 border-border-strong">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-3">
              This character is the default for scenes that don&apos;t set their own. Cast a per-scene character from the Cast group inside any scene.
            </p>
            <AvatarPicker selectedAvatarId={avatarId} onSelect={(id, name) => setAvatar(id, name)} />
          </CardContent>
        </Card>
      )}

      {activeTab === 'voice' && (
        <Card className="bg-card/50 border-border-strong">
          <CardContent className="p-4">
            <VoicePicker selectedVoiceId={voiceId} onSelect={(id, name, provider) => setVoice(id, name, provider)} />
          </CardContent>
        </Card>
      )}

      {/* Readiness */}
      {missingRequirements.length > 0 && scenes.length > 0 && (
        <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
          <p className="text-xs font-medium text-primary-light mb-1">Before generating:</p>
          <ul className="text-xs text-primary-light/70 space-y-0.5">
            {missingRequirements.map((req) => (
              <li key={req} className="flex items-center gap-1.5"><AlertCircle className="w-3 h-3" />{req}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-between items-center pt-2">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setStep('request')}>
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </Button>
        <Button
          size="sm"
          className="gap-2 bg-primary hover:bg-primary-dark text-white"
          disabled={!isReady || isSaving}
          onClick={() => { void handleGenerateVideo(); }}
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {isSaving ? 'Preparing…' : 'Generate Video'}
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Per-scene character picker modal */}
      {pickerScene && (
        <CharacterPickerModal
          currentAvatarId={pickerScene.avatarId}
          onSelect={(id, name, vId, vProvider) => {
            updateScene(pickerScene.id, {
              avatarId: id,
              avatarName: name,
              ...(vId ? { voiceId: vId, voiceProvider: vProvider } : {}),
            });
            setCharacterPickerSceneId(null);
          }}
          onClear={() => {
            updateScene(pickerScene.id, { avatarId: null, avatarName: null });
            setCharacterPickerSceneId(null);
          }}
          onClose={() => setCharacterPickerSceneId(null)}
        />
      )}
    </div>
  );
}
