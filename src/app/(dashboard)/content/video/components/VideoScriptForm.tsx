'use client';

/**
 * VideoScriptForm — VP-C video front door.
 *
 * Two phases held in local state:
 *   Phase "brief"  — the operator fills a short creative brief, optionally selects
 *                    saved characters up-front, then fires the Screenwriter agent.
 *   Phase "review" — the returned ScriptDocument is rendered as a fully editable
 *                    form; the operator tweaks scenes/shots/dialogue then approves,
 *                    which hands off to the Shot Doc agent and navigates to the
 *                    new video project.
 *
 * Design-system rules respected throughout:
 *   - Outer wrapper: <div className="p-8 space-y-6">
 *   - Typography: PageTitle / SectionTitle / SubsectionTitle / CardTitle /
 *                 SectionDescription / Caption from @/components/ui/typography
 *   - Buttons:    Button from @/components/ui/button
 *   - Inputs:     Input from @/components/ui/input (textareas use the same CSS class)
 *   - Cards:      bg-card border border-border-strong rounded-2xl p-6
 *   - Colors:     Tailwind tokens only — never CSS vars or hex
 *   - Grids:      responsive Tailwind — never inline style={{ gridTemplateColumns }}
 *   - Destructive two-step: first click arms, 5 s auto-disarm, second click fires
 *   - Plain English everywhere; never fail silently
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  AlertCircle,
  Check,
  Loader2,
  Plus,
  Trash2,
  User,
  X,
} from 'lucide-react';

import { useAuthFetch } from '@/hooks/useAuthFetch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  CardTitle,
  Caption,
  PageTitle,
  SectionDescription,
  SectionTitle,
  SubsectionTitle,
} from '@/components/ui/typography';

import {
  LOCATION_TYPES,
  deriveScriptTotalSeconds,
  type LocationType,
  type OnScreenText,
  type ScriptDocument,
  type ScriptLine,
  type ScriptScene,
  type ScriptSceneCharacter,
  type ScriptSfxCue,
  type ScriptShot,
  type ScriptSpeaker,
  type VideoLocation,
} from '@/types/video-script';

// ============================================================================
// API response contracts — typed, zero `any`
// ============================================================================

interface AvatarProfileItem {
  id: string;
  name: string;
  frontalImageUrl: string;
  description: string | null;
}

interface AvatarProfilesResponse {
  success: boolean;
  profiles: AvatarProfileItem[];
}

interface GenerateScriptResponse {
  success: boolean;
  script?: ScriptDocument;
  error?: string;
}

interface FromScriptResponse {
  success: boolean;
  project?: { id: string };
  error?: string;
}

// ============================================================================
// Shared textarea class (mirrors the style used on the projects page)
// ============================================================================

const TEXTAREA_CLASS =
  'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

// ============================================================================
// TwoStepRemoveButton — reusable two-step destructive confirm
// ============================================================================

interface TwoStepRemoveButtonProps {
  onConfirm: () => void;
  label?: string;
  size?: 'sm' | 'default';
  disabled?: boolean;
}

function TwoStepRemoveButton({
  onConfirm,
  label = 'Remove',
  size = 'sm',
  disabled = false,
}: TwoStepRemoveButtonProps): React.JSX.Element {
  const [armed, setArmed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) { clearTimeout(timerRef.current); }
    };
  }, []);

  const handleClick = useCallback(() => {
    if (!armed) {
      setArmed(true);
      timerRef.current = setTimeout(() => setArmed(false), 5000);
      return;
    }
    if (timerRef.current) { clearTimeout(timerRef.current); }
    setArmed(false);
    onConfirm();
  }, [armed, onConfirm]);

  return (
    <Button
      variant={armed ? 'destructive' : 'outline'}
      size={size}
      onClick={handleClick}
      disabled={disabled}
      type="button"
    >
      {armed ? (
        <>
          <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden />
          Click again to confirm
        </>
      ) : (
        <>
          <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden />
          {label}
        </>
      )}
    </Button>
  );
}

// ============================================================================
// ChipEditor — editable list of string tags (palette / moodKeywords)
// ============================================================================

interface ChipEditorProps {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}

function ChipEditor({ label, items, onChange, placeholder = 'Add…' }: ChipEditorProps): React.JSX.Element {
  const [draft, setDraft] = useState('');

  const add = useCallback(() => {
    const trimmed = draft.trim();
    if (!trimmed) { return; }
    onChange([...items, trimmed]);
    setDraft('');
  }, [draft, items, onChange]);

  const remove = useCallback(
    (idx: number) => {
      onChange(items.filter((_, i) => i !== idx));
    },
    [items, onChange],
  );

  return (
    <div className="space-y-1.5">
      <Caption>{label}</Caption>
      <div className="flex flex-wrap gap-2">
        {items.map((item, idx) => (
          <span
            key={`${item}-${idx}`}
            className="inline-flex items-center gap-1 rounded-full bg-surface-elevated border border-border-strong px-2.5 py-0.5 text-xs text-foreground"
          >
            {item}
            <button
              type="button"
              aria-label={`Remove ${item}`}
              onClick={() => remove(idx)}
              className="ml-0.5 text-muted-foreground hover:text-destructive transition-colors"
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          className="h-8 text-xs"
        />
        <Button type="button" size="sm" variant="outline" onClick={add} className="shrink-0">
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Add
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// ErrorAlert — shared destructive alert
// ============================================================================

function ErrorAlert({ message }: { message: string }): React.JSX.Element {
  return (
    <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}

// ============================================================================
// Phase 1 — Brief entry + character picker
// ============================================================================

interface BriefPhaseProps {
  onScriptReady: (
    script: ScriptDocument,
    selectedIds: string[],
    idToName: Map<string, string>,
    briefInputs: BriefInputs,
  ) => void;
}

function BriefPhase({ onScriptReady }: BriefPhaseProps): React.JSX.Element {
  const authFetch = useAuthFetch();

  // Brief form state
  const [brief, setBrief] = useState('');
  const [title, setTitle] = useState('');
  const [tone, setTone] = useState('');
  const [platformsRaw, setPlatformsRaw] = useState('');

  // Character picker state
  const [profiles, setProfiles] = useState<AvatarProfileItem[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Fetch saved characters
  const fetchProfiles = useCallback(async () => {
    setProfilesLoading(true);
    setProfilesError(null);
    try {
      const res = await authFetch('/api/video/avatar-profiles');
      const data = (await res.json()) as AvatarProfilesResponse;
      if (!res.ok || !data.success) {
        throw new Error('We could not load your saved characters.');
      }
      setProfiles(data.profiles ?? []);
    } catch (err) {
      setProfilesError(
        err instanceof Error ? err.message : 'We could not load your saved characters.',
      );
    } finally {
      setProfilesLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void fetchProfiles();
  }, [fetchProfiles]);

  const toggleCharacter = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const idToName = useMemo((): Map<string, string> => {
    const map = new Map<string, string>();
    for (const p of profiles) {
      map.set(p.id, p.name);
    }
    return map;
  }, [profiles]);

  const handleGenerate = useCallback(async () => {
    const trimmedBrief = brief.trim();
    if (!trimmedBrief) {
      setGenError('Please describe your video before we can write the script.');
      return;
    }
    setGenerating(true);
    setGenError(null);

    const platforms = platformsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const body: Record<string, unknown> = { brief: trimmedBrief };
    if (title.trim()) { body.title = title.trim(); }
    if (tone.trim()) { body.tone = tone.trim(); }
    if (platforms.length > 0) { body.platforms = platforms; }
    if (selectedIds.size > 0) { body.selectedCharacterIds = Array.from(selectedIds); }

    try {
      const res = await authFetch('/api/content/video-script/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as GenerateScriptResponse;
      if (!res.ok || !data.success || !data.script) {
        throw new Error(
          data.error ?? 'Something went wrong writing the script. Please try again.',
        );
      }
      onScriptReady(data.script, Array.from(selectedIds), idToName, {
        brief: trimmedBrief,
        title: title.trim(),
        tone: tone.trim(),
        platforms,
        selectedCharacterIds: Array.from(selectedIds),
      });
    } catch (err) {
      setGenError(
        err instanceof Error
          ? err.message
          : 'Something went wrong writing the script. Please try again.',
      );
      setGenerating(false);
    }
  }, [authFetch, brief, title, tone, platformsRaw, selectedIds, idToName, onScriptReady]);

  return (
    <div className="p-8 space-y-6">
      <div className="space-y-1">
        <PageTitle>Write a video script</PageTitle>
        <SectionDescription>
          Tell us what your video is about and we will write a full timed script —
          scenes, shots, dialogue, and all. You review and edit it before anything is rendered.
        </SectionDescription>
      </div>

      {/* Brief form card */}
      <section className="bg-card border border-border-strong rounded-2xl p-6 space-y-5">
        <SectionTitle>Your brief</SectionTitle>

        <div className="space-y-1.5">
          <Caption>Title (optional)</Caption>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Product launch — spring 2026"
            disabled={generating}
          />
        </div>

        <div className="space-y-1.5">
          <Caption>What is this video about? (required)</Caption>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Describe the story, the message, who it is for, and any key points to land. The more detail you give, the better the script."
            disabled={generating}
            rows={5}
            className={TEXTAREA_CLASS}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Caption>Tone (optional)</Caption>
            <Input
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              placeholder="e.g. conversational, bold, cinematic"
              disabled={generating}
            />
          </div>
          <div className="space-y-1.5">
            <Caption>Target platforms (optional, comma-separated)</Caption>
            <Input
              value={platformsRaw}
              onChange={(e) => setPlatformsRaw(e.target.value)}
              placeholder="e.g. youtube, tiktok, instagram"
              disabled={generating}
            />
          </div>
        </div>
      </section>

      {/* Character picker card */}
      <section className="bg-card border border-border-strong rounded-2xl p-6 space-y-4">
        <div className="space-y-1">
          <SectionTitle>Add saved characters (optional)</SectionTitle>
          <SectionDescription>
            Select any characters you want the script to feature. You can add more later in the review.
          </SectionDescription>
        </div>

        {profilesLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading your saved characters…
          </div>
        ) : profilesError ? (
          <ErrorAlert message={profilesError} />
        ) : profiles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No saved characters yet — we will create fresh ones for your script.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {profiles.map((profile) => {
              const isSelected = selectedIds.has(profile.id);
              return (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => toggleCharacter(profile.id)}
                  className={[
                    'relative flex flex-col items-center gap-2 p-3 rounded-xl border transition-all text-left',
                    isSelected
                      ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                      : 'border-border-strong bg-surface-elevated hover:border-border hover:bg-surface-elevated/80',
                  ].join(' ')}
                  aria-pressed={isSelected}
                >
                  {/* Round thumbnail */}
                  {profile.frontalImageUrl ? (
                    <div className="relative h-16 w-16 overflow-hidden rounded-full ring-2 ring-border-strong">
                      <Image
                        src={profile.frontalImageUrl}
                        alt={profile.name}
                        fill
                        className="object-cover"
                        sizes="64px"
                        unoptimized={
                          profile.frontalImageUrl.startsWith('data:') ||
                          profile.frontalImageUrl.includes('imagedelivery.net')
                        }
                      />
                    </div>
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-border-strong ring-2 ring-border-strong/50">
                      <User className="h-7 w-7 text-muted-foreground" aria-hidden />
                    </div>
                  )}

                  <span className="w-full truncate text-center text-xs font-medium text-foreground">
                    {profile.name}
                  </span>

                  {/* Selected check badge */}
                  {isSelected && (
                    <span className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                      <Check className="h-3 w-3 text-primary-foreground" aria-hidden />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {selectedIds.size > 0 && (
          <p className="text-xs text-muted-foreground">
            {selectedIds.size} character{selectedIds.size !== 1 ? 's' : ''} selected
          </p>
        )}
      </section>

      {/* Error / loading / action */}
      {genError && <ErrorAlert message={genError} />}

      {generating && (
        <div className="flex items-start gap-2 rounded-md bg-surface-elevated px-3 py-2 text-sm text-foreground">
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" aria-hidden />
          <span>Writing your script… this takes a few seconds. Please keep this tab open.</span>
        </div>
      )}

      <Button
        onClick={() => void handleGenerate()}
        disabled={generating || !brief.trim()}
        size="lg"
      >
        {generating ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            Writing…
          </>
        ) : (
          'Write the script'
        )}
      </Button>
    </div>
  );
}

// ============================================================================
// Phase 2 helpers — SfxRow / OnScreenRow / LineRow / ShotEditor
// ============================================================================

// -- SfxRow --

interface SfxRowProps {
  cue: ScriptSfxCue;
  onChange: (next: ScriptSfxCue) => void;
  onRemove: () => void;
}

function SfxRow({ cue, onChange, onRemove }: SfxRowProps): React.JSX.Element {
  return (
    <div className="flex items-start gap-2">
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="sm:col-span-2 space-y-1">
          <Caption>Description</Caption>
          <Input
            value={cue.description}
            onChange={(e) => onChange({ ...cue, description: e.target.value })}
            placeholder="e.g. deep whoosh"
          />
        </div>
        <div className="space-y-1">
          <Caption>Start (s)</Caption>
          <Input
            type="number"
            min={0}
            value={cue.startSec}
            onChange={(e) =>
              onChange({ ...cue, startSec: Math.max(0, Number(e.target.value)) })
            }
          />
        </div>
      </div>
      <Button type="button" variant="ghost" size="icon" onClick={onRemove} className="mt-5 shrink-0" aria-label="Remove SFX cue">
        <X className="h-3.5 w-3.5" aria-hidden />
      </Button>
    </div>
  );
}

// -- OnScreenRow --

interface OnScreenRowProps {
  item: OnScreenText;
  onChange: (next: OnScreenText) => void;
  onRemove: () => void;
}

function OnScreenRow({ item, onChange, onRemove }: OnScreenRowProps): React.JSX.Element {
  return (
    <div className="flex items-start gap-2">
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-2">
        <div className="sm:col-span-2 space-y-1">
          <Caption>Text</Caption>
          <Input
            value={item.text}
            onChange={(e) => onChange({ ...item, text: e.target.value })}
            placeholder="e.g. Call us today"
          />
        </div>
        <div className="space-y-1">
          <Caption>Start (s)</Caption>
          <Input
            type="number"
            min={0}
            value={item.startSec}
            onChange={(e) =>
              onChange({ ...item, startSec: Math.max(0, Number(e.target.value)) })
            }
          />
        </div>
        <div className="space-y-1">
          <Caption>End (s)</Caption>
          <Input
            type="number"
            min={0}
            value={item.endSec}
            onChange={(e) =>
              onChange({ ...item, endSec: Math.max(0, Number(e.target.value)) })
            }
          />
        </div>
        <div className="sm:col-span-4 space-y-1">
          <Caption>Style (optional)</Caption>
          <Input
            value={item.style ?? ''}
            onChange={(e) => onChange({ ...item, style: e.target.value || undefined })}
            placeholder="e.g. lower-third, big-impact center"
          />
        </div>
      </div>
      <Button type="button" variant="ghost" size="icon" onClick={onRemove} className="mt-5 shrink-0" aria-label="Remove on-screen text">
        <X className="h-3.5 w-3.5" aria-hidden />
      </Button>
    </div>
  );
}

// -- LineRow --

interface LineRowProps {
  line: ScriptLine;
  presentCharacterIds: string[];
  idToName: Map<string, string>;
  onChange: (next: ScriptLine) => void;
  onRemove: () => void;
}

function LineRow({ line, presentCharacterIds, idToName, onChange, onRemove }: LineRowProps): React.JSX.Element {
  const speakerValue =
    line.speaker.kind === 'narrator' ? 'narrator' : line.speaker.characterId;

  const handleSpeakerChange = useCallback(
    (value: string) => {
      const speaker: ScriptSpeaker =
        value === 'narrator' ? { kind: 'narrator' } : { kind: 'character', characterId: value };
      onChange({ ...line, speaker });
    },
    [line, onChange],
  );

  return (
    <div className="flex items-start gap-2">
      <div className="flex-1 space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          {/* Speaker */}
          <div className="space-y-1">
            <Caption>Speaker</Caption>
            <select
              value={speakerValue}
              onChange={(e) => handleSpeakerChange(e.target.value)}
              className={`${TEXTAREA_CLASS} h-10`}
            >
              <option value="narrator">Narrator</option>
              {presentCharacterIds.map((cid) => (
                <option key={cid} value={cid}>
                  {idToName.get(cid) ?? cid}
                </option>
              ))}
            </select>
          </div>
          {/* Start */}
          <div className="space-y-1">
            <Caption>Start (s)</Caption>
            <Input
              type="number"
              min={0}
              value={line.startSec}
              onChange={(e) =>
                onChange({ ...line, startSec: Math.max(0, Number(e.target.value)) })
              }
            />
          </div>
          {/* End */}
          <div className="space-y-1">
            <Caption>End (s)</Caption>
            <Input
              type="number"
              min={0}
              value={line.endSec}
              onChange={(e) =>
                onChange({ ...line, endSec: Math.max(0, Number(e.target.value)) })
              }
            />
          </div>
          {/* Delivery note */}
          <div className="space-y-1">
            <Caption>Delivery note</Caption>
            <Input
              value={line.deliveryNote ?? ''}
              onChange={(e) =>
                onChange({ ...line, deliveryNote: e.target.value || undefined })
              }
              placeholder="e.g. warm, urgent"
            />
          </div>
        </div>
        {/* Text */}
        <div className="space-y-1">
          <Caption>Spoken text</Caption>
          <textarea
            value={line.text}
            onChange={(e) => onChange({ ...line, text: e.target.value })}
            placeholder="What they say…"
            rows={2}
            className={TEXTAREA_CLASS}
          />
        </div>
      </div>
      <Button type="button" variant="ghost" size="icon" onClick={onRemove} className="mt-5 shrink-0" aria-label="Remove line">
        <X className="h-3.5 w-3.5" aria-hidden />
      </Button>
    </div>
  );
}

// -- ShotEditor --

interface ShotEditorProps {
  shot: ScriptShot;
  shotNumber: number;
  presentCharacterIds: string[];
  idToName: Map<string, string>;
  onChange: (next: ScriptShot) => void;
  onRemove: () => void;
  isOnly: boolean;
}

function ShotEditor({
  shot,
  shotNumber,
  presentCharacterIds,
  idToName,
  onChange,
  onRemove,
  isOnly,
}: ShotEditorProps): React.JSX.Element {
  const updateLine = useCallback(
    (idx: number, next: ScriptLine) => {
      onChange({ ...shot, lines: shot.lines.map((l, i) => (i === idx ? next : l)) });
    },
    [shot, onChange],
  );

  const removeLine = useCallback(
    (idx: number) => {
      onChange({ ...shot, lines: shot.lines.filter((_, i) => i !== idx) });
    },
    [shot, onChange],
  );

  const addLine = useCallback(() => {
    const newLine: ScriptLine = {
      id: crypto.randomUUID(),
      speaker: { kind: 'narrator' },
      text: '',
      startSec: 0,
      endSec: 1,
    };
    onChange({ ...shot, lines: [...shot.lines, newLine] });
  }, [shot, onChange]);

  const updateOnScreen = useCallback(
    (idx: number, next: OnScreenText) => {
      onChange({ ...shot, onScreenText: shot.onScreenText.map((o, i) => (i === idx ? next : o)) });
    },
    [shot, onChange],
  );

  const removeOnScreen = useCallback(
    (idx: number) => {
      onChange({ ...shot, onScreenText: shot.onScreenText.filter((_, i) => i !== idx) });
    },
    [shot, onChange],
  );

  const addOnScreen = useCallback(() => {
    const next: OnScreenText = {
      id: crypto.randomUUID(),
      text: '',
      startSec: 0,
      endSec: 1,
    };
    onChange({ ...shot, onScreenText: [...shot.onScreenText, next] });
  }, [shot, onChange]);

  const updateSfx = useCallback(
    (idx: number, next: ScriptSfxCue) => {
      onChange({ ...shot, sfxCues: shot.sfxCues.map((s, i) => (i === idx ? next : s)) });
    },
    [shot, onChange],
  );

  const removeSfx = useCallback(
    (idx: number) => {
      onChange({ ...shot, sfxCues: shot.sfxCues.filter((_, i) => i !== idx) });
    },
    [shot, onChange],
  );

  const addSfx = useCallback(() => {
    const next: ScriptSfxCue = {
      id: crypto.randomUUID(),
      description: '',
      startSec: 0,
    };
    onChange({ ...shot, sfxCues: [...shot.sfxCues, next] });
  }, [shot, onChange]);

  return (
    <div className="bg-surface-elevated border border-border-light rounded-xl p-4 space-y-4">
      {/* Shot header row */}
      <div className="flex items-center justify-between">
        <SubsectionTitle>Shot {shotNumber}</SubsectionTitle>
        {!isOnly && (
          <TwoStepRemoveButton onConfirm={onRemove} label="Remove shot" />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Action */}
        <div className="md:col-span-2 space-y-1">
          <Caption>Action / blocking</Caption>
          <textarea
            value={shot.action}
            onChange={(e) => onChange({ ...shot, action: e.target.value })}
            placeholder="What happens in this cut — subject movement, action…"
            rows={2}
            className={TEXTAREA_CLASS}
          />
        </div>
        {/* Movement */}
        <div className="space-y-1">
          <Caption>Camera movement</Caption>
          <Input
            value={shot.movement ?? ''}
            onChange={(e) => onChange({ ...shot, movement: e.target.value || undefined })}
            placeholder="e.g. slow push-in, static, handheld follow"
          />
        </div>
        {/* Duration */}
        <div className="space-y-1">
          <Caption>Duration (seconds)</Caption>
          <Input
            type="number"
            min={1}
            value={shot.durationSec}
            onChange={(e) =>
              onChange({ ...shot, durationSec: Math.max(1, Number(e.target.value)) })
            }
          />
        </div>
      </div>

      {/* Dialogue lines */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Caption>Dialogue lines</Caption>
          <Button type="button" size="sm" variant="outline" onClick={addLine}>
            <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
            Add line
          </Button>
        </div>
        {shot.lines.length === 0 && (
          <p className="text-xs text-muted-foreground">No dialogue lines yet.</p>
        )}
        <div className="space-y-3">
          {shot.lines.map((line, idx) => (
            <LineRow
              key={line.id}
              line={line}
              presentCharacterIds={presentCharacterIds}
              idToName={idToName}
              onChange={(next) => updateLine(idx, next)}
              onRemove={() => removeLine(idx)}
            />
          ))}
        </div>
      </div>

      {/* On-screen text */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Caption>On-screen text / captions</Caption>
          <Button type="button" size="sm" variant="outline" onClick={addOnScreen}>
            <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
            Add text
          </Button>
        </div>
        {shot.onScreenText.length === 0 && (
          <p className="text-xs text-muted-foreground">No on-screen text yet.</p>
        )}
        <div className="space-y-3">
          {shot.onScreenText.map((item, idx) => (
            <OnScreenRow
              key={item.id}
              item={item}
              onChange={(next) => updateOnScreen(idx, next)}
              onRemove={() => removeOnScreen(idx)}
            />
          ))}
        </div>
      </div>

      {/* SFX cues */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Caption>SFX cues</Caption>
          <Button type="button" size="sm" variant="outline" onClick={addSfx}>
            <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
            Add cue
          </Button>
        </div>
        {shot.sfxCues.length === 0 && (
          <p className="text-xs text-muted-foreground">No SFX cues yet.</p>
        )}
        <div className="space-y-3">
          {shot.sfxCues.map((cue, idx) => (
            <SfxRow
              key={cue.id}
              cue={cue}
              onChange={(next) => updateSfx(idx, next)}
              onRemove={() => removeSfx(idx)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Phase 2 — SceneCard
// ============================================================================

interface SceneCardProps {
  scene: ScriptScene;
  sceneNumber: number;
  allLocations: VideoLocation[];
  allCastIds: string[];
  idToName: Map<string, string>;
  onChange: (next: ScriptScene) => void;
  onRemove: () => void;
  isOnly: boolean;
}

function SceneCard({
  scene,
  sceneNumber,
  allLocations,
  allCastIds,
  idToName,
  onChange,
  onRemove,
  isOnly,
}: SceneCardProps): React.JSX.Element {
  const presentIds = useMemo(
    () => scene.charactersPresent.map((c) => c.characterId),
    [scene.charactersPresent],
  );

  const toggleCharacter = useCallback(
    (characterId: string) => {
      const isPresent = scene.charactersPresent.some((c) => c.characterId === characterId);
      const next: ScriptSceneCharacter[] = isPresent
        ? scene.charactersPresent.filter((c) => c.characterId !== characterId)
        : [...scene.charactersPresent, { characterId }];
      onChange({ ...scene, charactersPresent: next });
    },
    [scene, onChange],
  );

  const updateCharacterOverlay = useCallback(
    (characterId: string, field: 'wardrobe' | 'state', value: string) => {
      onChange({
        ...scene,
        charactersPresent: scene.charactersPresent.map((c) =>
          c.characterId === characterId
            ? { ...c, [field]: value || undefined }
            : c,
        ),
      });
    },
    [scene, onChange],
  );

  const updateShot = useCallback(
    (idx: number, next: ScriptShot) => {
      onChange({ ...scene, shots: scene.shots.map((s, i) => (i === idx ? next : s)) });
    },
    [scene, onChange],
  );

  const removeShot = useCallback(
    (idx: number) => {
      onChange({
        ...scene,
        shots: scene.shots.filter((_, i) => i !== idx).map((s, i) => ({ ...s, index: i })),
      });
    },
    [scene, onChange],
  );

  const addShot = useCallback(() => {
    const newShot: ScriptShot = {
      id: crypto.randomUUID(),
      index: scene.shots.length,
      cinematic: {},
      action: '',
      durationSec: 3,
      trimHandles: { preRollSec: 0, postRollSec: 0 },
      lines: [],
      onScreenText: [],
      sfxCues: [],
    };
    onChange({ ...scene, shots: [...scene.shots, newShot] });
  }, [scene, onChange]);

  return (
    <div className="bg-card border border-border-strong rounded-2xl p-6 space-y-5">
      {/* Scene header */}
      <div className="flex items-center justify-between">
        <SectionTitle>Scene {sceneNumber}</SectionTitle>
        {!isOnly && (
          <TwoStepRemoveButton onConfirm={onRemove} label="Remove scene" />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Purpose */}
        <div className="md:col-span-2 space-y-1">
          <Caption>Purpose of this scene</Caption>
          <textarea
            value={scene.purpose}
            onChange={(e) => onChange({ ...scene, purpose: e.target.value })}
            placeholder="What is this beat doing narratively? e.g. the hook, the turn, the close."
            rows={2}
            className={TEXTAREA_CLASS}
          />
        </div>

        {/* Location */}
        <div className="space-y-1">
          <Caption>Location</Caption>
          <select
            value={scene.locationId}
            onChange={(e) => onChange({ ...scene, locationId: e.target.value })}
            className={`${TEXTAREA_CLASS} h-10`}
          >
            {allLocations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>

        {/* Scene mood */}
        <div className="space-y-1">
          <Caption>Scene mood</Caption>
          <Input
            value={scene.sceneMood ?? ''}
            onChange={(e) => onChange({ ...scene, sceneMood: e.target.value || undefined })}
            placeholder="e.g. tense, warm and inviting"
          />
        </div>

        {/* Time of day */}
        <div className="space-y-1">
          <Caption>Time of day (overrides location default)</Caption>
          <Input
            value={scene.timeOfDay ?? ''}
            onChange={(e) => onChange({ ...scene, timeOfDay: e.target.value || undefined })}
            placeholder="e.g. golden hour, late afternoon"
          />
        </div>

        {/* Weather */}
        <div className="space-y-1">
          <Caption>Weather (overrides location default)</Caption>
          <Input
            value={scene.weather ?? ''}
            onChange={(e) => onChange({ ...scene, weather: e.target.value || undefined })}
            placeholder="e.g. clear, overcast, rain"
          />
        </div>

        {/* Ambience */}
        <div className="md:col-span-2 space-y-1">
          <Caption>Ambience / sound bed</Caption>
          <Input
            value={scene.ambience ?? ''}
            onChange={(e) => onChange({ ...scene, ambience: e.target.value || undefined })}
            placeholder="e.g. quiet office hum, distant keyboards"
          />
        </div>
      </div>

      {/* Characters in this scene */}
      {allCastIds.length > 0 && (
        <div className="space-y-2">
          <Caption>Characters in this scene</Caption>
          <div className="flex flex-wrap gap-2">
            {allCastIds.map((cid) => {
              const isPresent = presentIds.includes(cid);
              const name = idToName.get(cid) ?? cid;
              return (
                <button
                  key={cid}
                  type="button"
                  onClick={() => toggleCharacter(cid)}
                  aria-pressed={isPresent}
                  className={[
                    'rounded-full px-3 py-1 text-xs font-medium border transition-all',
                    isPresent
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-surface-elevated border-border-strong text-muted-foreground hover:border-border hover:text-foreground',
                  ].join(' ')}
                >
                  {isPresent && <Check className="mr-1 inline h-3 w-3" aria-hidden />}
                  {name}
                </button>
              );
            })}
          </div>

          {/* Per-character wardrobe + state */}
          {scene.charactersPresent.length > 0 && (
            <div className="space-y-3 pl-1">
              {scene.charactersPresent.map((ssc) => (
                <div key={ssc.characterId} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Caption>{idToName.get(ssc.characterId) ?? ssc.characterId} — wardrobe</Caption>
                    <Input
                      value={ssc.wardrobe ?? ''}
                      onChange={(e) =>
                        updateCharacterOverlay(ssc.characterId, 'wardrobe', e.target.value)
                      }
                      placeholder="e.g. soaked wool trench coat"
                    />
                  </div>
                  <div className="space-y-1">
                    <Caption>{idToName.get(ssc.characterId) ?? ssc.characterId} — state</Caption>
                    <Input
                      value={ssc.state ?? ''}
                      onChange={(e) =>
                        updateCharacterOverlay(ssc.characterId, 'state', e.target.value)
                      }
                      placeholder="e.g. exhausted, limping"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Shots */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <SubsectionTitle>Shots</SubsectionTitle>
          <Button type="button" size="sm" variant="outline" onClick={addShot}>
            <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
            Add shot
          </Button>
        </div>

        {scene.shots.length === 0 && (
          <p className="text-sm text-muted-foreground">No shots yet — add one above.</p>
        )}

        <div className="space-y-4">
          {scene.shots.map((shot, idx) => (
            <ShotEditor
              key={shot.id}
              shot={shot}
              shotNumber={idx + 1}
              presentCharacterIds={presentIds}
              idToName={idToName}
              onChange={(next) => updateShot(idx, next)}
              onRemove={() => removeShot(idx)}
              isOnly={scene.shots.length === 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Phase 2 — LocationCard
// ============================================================================

interface LocationCardProps {
  location: VideoLocation;
  onChange: (next: VideoLocation) => void;
  onRemove: () => void;
  isOnly: boolean;
}

function LocationCard({ location, onChange, onRemove, isOnly }: LocationCardProps): React.JSX.Element {
  return (
    <div className="bg-card border border-border-strong rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <CardTitle>{location.name || 'Untitled location'}</CardTitle>
        {!isOnly && (
          <TwoStepRemoveButton onConfirm={onRemove} label="Remove location" />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Caption>Name</Caption>
          <Input
            value={location.name}
            onChange={(e) => onChange({ ...location, name: e.target.value })}
            placeholder="e.g. David's home office"
          />
        </div>

        <div className="space-y-1">
          <Caption>Interior / exterior</Caption>
          <select
            value={location.locationType}
            onChange={(e) =>
              onChange({ ...location, locationType: e.target.value as LocationType })
            }
            className={`${TEXTAREA_CLASS} h-10`}
          >
            {LOCATION_TYPES.map((lt) => (
              <option key={lt} value={lt}>
                {lt}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Caption>Locale</Caption>
          <Input
            value={location.locale ?? ''}
            onChange={(e) => onChange({ ...location, locale: e.target.value || undefined })}
            placeholder="e.g. downtown high-rise, rural Montana"
          />
        </div>

        <div className="space-y-1">
          <Caption>Default time of day</Caption>
          <Input
            value={location.defaultTimeOfDay ?? ''}
            onChange={(e) =>
              onChange({ ...location, defaultTimeOfDay: e.target.value || undefined })
            }
            placeholder="e.g. golden hour"
          />
        </div>

        <div className="space-y-1">
          <Caption>Default weather</Caption>
          <Input
            value={location.defaultWeather ?? ''}
            onChange={(e) =>
              onChange({ ...location, defaultWeather: e.target.value || undefined })
            }
            placeholder="e.g. clear, warm side-light"
          />
        </div>

        <div className="md:col-span-2 space-y-1">
          <Caption>Description</Caption>
          <textarea
            value={location.description}
            onChange={(e) => onChange({ ...location, description: e.target.value })}
            placeholder="What this place IS — prose description of the set."
            rows={2}
            className={TEXTAREA_CLASS}
          />
        </div>

        <div className="md:col-span-2 space-y-1">
          <Caption>Environment look</Caption>
          <textarea
            value={location.environmentLook}
            onChange={(e) => onChange({ ...location, environmentLook: e.target.value })}
            placeholder="The hero visual signature of this set — mood, defining features, set design."
            rows={2}
            className={TEXTAREA_CLASS}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Phase 2 — ReviewPhase
// ============================================================================

interface ReviewPhaseProps {
  initialScript: ScriptDocument;
  savedCharacterIds: string[];
  initialIdToName: Map<string, string>;
  onStartOver: () => void;
  onRewrite: () => void;
}

function ReviewPhase({
  initialScript,
  savedCharacterIds,
  initialIdToName,
  onStartOver,
  onRewrite,
}: ReviewPhaseProps): React.JSX.Element {
  const router = useRouter();
  const authFetch = useAuthFetch();

  const [script, setScript] = useState<ScriptDocument>(initialScript);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  // Derived runtime — recomputed whenever scenes/shots change
  const totalSeconds = useMemo(() => deriveScriptTotalSeconds(script), [script]);

  // Merge any saved-character names into the map (the script's cast may include
  // ids the agent invented that are NOT in the saved library — those display as the raw id)
  const idToName = useMemo((): Map<string, string> => {
    const map = new Map(initialIdToName);
    return map;
  }, [initialIdToName]);

  // ── top-level field updaters ──────────────────────────────────────────────

  const updateTop = useCallback(
    <K extends keyof ScriptDocument>(field: K, value: ScriptDocument[K]) => {
      setScript((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  // ── look bible updaters ───────────────────────────────────────────────────

  const updateLookBible = useCallback(
    <K extends keyof ScriptDocument['lookBible']>(
      field: K,
      value: ScriptDocument['lookBible'][K],
    ) => {
      setScript((prev) => ({ ...prev, lookBible: { ...prev.lookBible, [field]: value } }));
    },
    [],
  );

  // ── location updaters ─────────────────────────────────────────────────────

  const updateLocation = useCallback((idx: number, next: VideoLocation) => {
    setScript((prev) => ({
      ...prev,
      locations: prev.locations.map((l, i) => (i === idx ? next : l)),
    }));
  }, []);

  const removeLocation = useCallback((idx: number) => {
    setScript((prev) => ({
      ...prev,
      locations: prev.locations.filter((_, i) => i !== idx),
    }));
  }, []);

  const addLocation = useCallback(() => {
    const newLoc: VideoLocation = {
      id: crypto.randomUUID(),
      name: '',
      locationType: 'INT',
      description: '',
      environmentLook: '',
    };
    setScript((prev) => ({ ...prev, locations: [...prev.locations, newLoc] }));
  }, []);

  // ── scene updaters ────────────────────────────────────────────────────────

  const updateScene = useCallback((idx: number, next: ScriptScene) => {
    setScript((prev) => ({
      ...prev,
      scenes: prev.scenes.map((s, i) => (i === idx ? next : s)),
    }));
  }, []);

  const removeScene = useCallback((idx: number) => {
    setScript((prev) => ({
      ...prev,
      scenes: prev.scenes
        .filter((_, i) => i !== idx)
        .map((s, i) => ({ ...s, index: i })),
    }));
  }, []);

  const addScene = useCallback(() => {
    setScript((prev) => {
      const defaultLocationId = prev.locations[0]?.id ?? '';
      const newScene: ScriptScene = {
        id: crypto.randomUUID(),
        index: prev.scenes.length,
        purpose: '',
        locationId: defaultLocationId,
        charactersPresent: [],
        shots: [
          {
            id: crypto.randomUUID(),
            index: 0,
            cinematic: {},
            action: '',
            durationSec: 3,
            trimHandles: { preRollSec: 0, postRollSec: 0 },
            lines: [],
            onScreenText: [],
            sfxCues: [],
          },
        ],
      };
      return { ...prev, scenes: [...prev.scenes, newScene] };
    });
  }, []);

  // ── approve ───────────────────────────────────────────────────────────────

  const handleApprove = useCallback(async () => {
    setApproving(true);
    setApproveError(null);

    // Build a plain-object id→name map for the API body
    const characterNames: Record<string, string> = {};
    idToName.forEach((name, id) => {
      characterNames[id] = name;
    });

    // Sync derived totalSeconds before sending
    const finalScript: ScriptDocument = {
      ...script,
      totalSeconds,
    };

    try {
      const res = await authFetch('/api/video-project/from-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: finalScript,
          savedCharacterIds,
          characterNames,
        }),
      });
      const data = (await res.json()) as FromScriptResponse;
      if (!res.ok || !data.success || !data.project) {
        throw new Error(
          data.error ??
            'Something went wrong building the project. Please try again.',
        );
      }
      router.push(`/content/video/projects/${data.project.id}`);
    } catch (err) {
      setApproveError(
        err instanceof Error
          ? err.message
          : 'Something went wrong building the project. Please try again.',
      );
      setApproving(false);
    }
  }, [authFetch, script, totalSeconds, savedCharacterIds, idToName, router]);

  const runtimeLabel = useMemo(() => {
    if (totalSeconds < 60) { return `~${totalSeconds}s`; }
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return secs > 0 ? `~${mins}m ${secs}s` : `~${mins}m`;
  }, [totalSeconds]);

  return (
    <div className="p-8 space-y-6">
      <div className="space-y-1">
        <PageTitle>Review your script</PageTitle>
        <SectionDescription>
          Edit any part of the script below, then approve it to start building your videos.
          Total runtime: {runtimeLabel}
        </SectionDescription>
      </div>

      {/* ── Video header card ─────────────────────────────────────────────── */}
      <section className="bg-card border border-border-strong rounded-2xl p-6 space-y-4">
        <SectionTitle>Video details</SectionTitle>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-1">
            <Caption>Title</Caption>
            <Input
              value={script.title}
              onChange={(e) => updateTop('title', e.target.value)}
              placeholder="Untitled video"
            />
          </div>

          <div className="md:col-span-2 space-y-1">
            <Caption>Objective</Caption>
            <textarea
              value={script.objective}
              onChange={(e) => updateTop('objective', e.target.value)}
              placeholder="What must this video achieve?"
              rows={2}
              className={TEXTAREA_CLASS}
            />
          </div>

          <div className="md:col-span-2 space-y-1">
            <Caption>Core message</Caption>
            <textarea
              value={script.coreMessage}
              onChange={(e) => updateTop('coreMessage', e.target.value)}
              placeholder="The single message the video drives home."
              rows={2}
              className={TEXTAREA_CLASS}
            />
          </div>

          <div className="space-y-1">
            <Caption>Audience</Caption>
            <Input
              value={script.audience}
              onChange={(e) => updateTop('audience', e.target.value)}
              placeholder="Who is this for?"
            />
          </div>

          <div className="space-y-1">
            <Caption>Tone</Caption>
            <Input
              value={script.tone ?? ''}
              onChange={(e) => updateTop('tone', e.target.value || undefined)}
              placeholder="e.g. conversational, bold, cinematic"
            />
          </div>

          <div className="space-y-1">
            <Caption>Call to action</Caption>
            <Input
              value={script.callToAction ?? ''}
              onChange={(e) => updateTop('callToAction', e.target.value || undefined)}
              placeholder="What should viewers do?"
            />
          </div>

          <div className="space-y-1">
            <Caption>Music direction</Caption>
            <Input
              value={script.musicDirection ?? ''}
              onChange={(e) => updateTop('musicDirection', e.target.value || undefined)}
              placeholder="e.g. warm underscore building to the CTA"
            />
          </div>

          <div className="md:col-span-2">
            <p className="text-sm text-muted-foreground">
              Total runtime: <span className="font-medium text-foreground">{runtimeLabel}</span>
            </p>
          </div>
        </div>
      </section>

      {/* ── Look bible card ───────────────────────────────────────────────── */}
      <section className="bg-card border border-border-strong rounded-2xl p-6 space-y-4">
        <SectionTitle>Look bible</SectionTitle>

        <ChipEditor
          label="Colour palette"
          items={script.lookBible.palette}
          onChange={(next) => updateLookBible('palette', next)}
          placeholder="e.g. cold steel blue"
        />

        <ChipEditor
          label="Mood keywords"
          items={script.lookBible.moodKeywords}
          onChange={(next) => updateLookBible('moodKeywords', next)}
          placeholder="e.g. tense, hopeful"
        />

        <div className="space-y-1">
          <Caption>Film look</Caption>
          <Input
            value={script.lookBible.filmLook ?? ''}
            onChange={(e) =>
              updateLookBible('filmLook', e.target.value || undefined)
            }
            placeholder="e.g. gritty 16mm documentary, clean corporate 4K"
          />
        </div>
      </section>

      {/* ── Locations section ─────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <SectionTitle>Locations</SectionTitle>
          <Button type="button" size="sm" variant="outline" onClick={addLocation}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />
            Add location
          </Button>
        </div>

        {script.locations.length === 0 && (
          <p className="text-sm text-muted-foreground">No locations yet — add one above.</p>
        )}

        <div className="space-y-4">
          {script.locations.map((loc, idx) => (
            <LocationCard
              key={loc.id}
              location={loc}
              onChange={(next) => updateLocation(idx, next)}
              onRemove={() => removeLocation(idx)}
              isOnly={script.locations.length === 1}
            />
          ))}
        </div>
      </section>

      {/* ── Scenes section ────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <SectionTitle>Scenes</SectionTitle>
          <Button type="button" size="sm" variant="outline" onClick={addScene}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />
            Add scene
          </Button>
        </div>

        {script.scenes.length === 0 && (
          <p className="text-sm text-muted-foreground">No scenes yet — add one above.</p>
        )}

        <div className="space-y-6">
          {script.scenes.map((scene, idx) => (
            <SceneCard
              key={scene.id}
              scene={scene}
              sceneNumber={idx + 1}
              allLocations={script.locations}
              allCastIds={script.cast}
              idToName={idToName}
              onChange={(next) => updateScene(idx, next)}
              onRemove={() => removeScene(idx)}
              isOnly={script.scenes.length === 1}
            />
          ))}
        </div>
      </section>

      {/* ── Footer action bar ─────────────────────────────────────────────── */}
      <div className="sticky bottom-0 bg-background border-t border-border-light -mx-8 px-8 py-4 flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={onStartOver} disabled={approving}>
          Start over
        </Button>

        <Button type="button" variant="secondary" onClick={onRewrite} disabled={approving}>
          Rewrite draft
        </Button>

        <div className="ml-auto flex flex-col items-end gap-2">
          {approveError && <ErrorAlert message={approveError} />}

          {approving && (
            <div className="flex items-start gap-2 rounded-md bg-surface-elevated px-3 py-2 text-sm text-foreground">
              <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" aria-hidden />
              <span>
                Building your videos — writing each scene&apos;s shot doc and rendering stills.
                This can take a few minutes; keep this tab open.
              </span>
            </div>
          )}

          <Button
            type="button"
            size="lg"
            onClick={() => void handleApprove()}
            disabled={approving}
          >
            {approving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Building…
              </>
            ) : (
              'Approve & build the videos'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// VideoScriptForm — the exported page-level component
// ============================================================================

type Phase = 'brief' | 'review';

interface ReviewState {
  script: ScriptDocument;
  selectedIds: string[];
  idToName: Map<string, string>;
  /** The original brief inputs, kept so "Rewrite draft" can re-fire them. */
  briefInputs: BriefInputs;
  /** Bumped on each successful rewrite to remount ReviewPhase with the fresh draft. */
  nonce: number;
}

interface BriefInputs {
  brief: string;
  title: string;
  tone: string;
  platforms: string[];
  selectedCharacterIds: string[];
}

export function VideoScriptForm(): React.JSX.Element {
  const authFetch = useAuthFetch();
  const [phase, setPhase] = useState<Phase>('brief');
  const [reviewState, setReviewState] = useState<ReviewState | null>(null);

  // Rewrite: re-fires the generate call with the same brief inputs
  const [rewriting, setRewriting] = useState(false);
  const [rewriteError, setRewriteError] = useState<string | null>(null);

  const handleScriptReady = useCallback(
    (
      script: ScriptDocument,
      selectedIds: string[],
      idToName: Map<string, string>,
      briefInputs: BriefInputs,
    ) => {
      setReviewState({ script, selectedIds, idToName, briefInputs, nonce: 0 });
      setPhase('review');
    },
    [],
  );

  const handleStartOver = useCallback(() => {
    setReviewState(null);
    setRewriteError(null);
    setPhase('brief');
  }, []);

  // "Rewrite draft" re-runs generation with the original brief inputs (captured on
  // the way into review) and swaps in the fresh draft IN PLACE — bumping `nonce`
  // remounts ReviewPhase so its edit state re-seeds from the new script. If no brief
  // was captured (shouldn't happen), fall back to the brief phase.
  const handleRewrite = useCallback(async () => {
    if (!reviewState) { return; }

    const { briefInputs } = reviewState;
    if (!briefInputs.brief.trim()) {
      setPhase('brief');
      return;
    }

    setRewriting(true);
    setRewriteError(null);

    const body: Record<string, unknown> = { brief: briefInputs.brief };
    if (briefInputs.title) { body.title = briefInputs.title; }
    if (briefInputs.tone) { body.tone = briefInputs.tone; }
    if (briefInputs.platforms.length > 0) { body.platforms = briefInputs.platforms; }
    if (briefInputs.selectedCharacterIds.length > 0) {
      body.selectedCharacterIds = briefInputs.selectedCharacterIds;
    }

    try {
      const res = await authFetch('/api/content/video-script/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as GenerateScriptResponse;
      if (!res.ok || !data.success || !data.script) {
        throw new Error(
          data.error ?? 'Something went wrong rewriting the script. Please try again.',
        );
      }
      const freshScript = data.script;
      setReviewState((prev) =>
        prev ? { ...prev, script: freshScript, nonce: prev.nonce + 1 } : null,
      );
    } catch (err) {
      setRewriteError(
        err instanceof Error
          ? err.message
          : 'Something went wrong rewriting the script. Please try again.',
      );
    } finally {
      setRewriting(false);
    }
  }, [authFetch, reviewState]);

  if (phase === 'brief' || !reviewState) {
    return <BriefPhase onScriptReady={handleScriptReady} />;
  }

  return (
    <>
      {rewriteError && (
        <div className="px-8 pt-4">
          <ErrorAlert message={rewriteError} />
        </div>
      )}
      {rewriting && (
        <div className="px-8 pt-4">
          <div className="flex items-start gap-2 rounded-md bg-surface-elevated px-3 py-2 text-sm text-foreground">
            <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" aria-hidden />
            <span>Rewriting your script… this takes a few seconds.</span>
          </div>
        </div>
      )}
      <ReviewPhase
        key={`review-${reviewState.nonce}`}
        initialScript={reviewState.script}
        savedCharacterIds={reviewState.selectedIds}
        initialIdToName={reviewState.idToName}
        onStartOver={handleStartOver}
        onRewrite={() => void handleRewrite()}
      />
    </>
  );
}
