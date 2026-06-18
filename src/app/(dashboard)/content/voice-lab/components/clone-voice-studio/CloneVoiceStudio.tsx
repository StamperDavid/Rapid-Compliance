'use client';

/**
 * Clone Voice Studio
 * ------------------
 * An in-app voice recorder with a karaoke-style auto-scrolling teleprompter.
 * The operator reads the approved capture script aloud in two passes (a STEADY
 * pass and an EXPRESSIVE pass); we record their microphone, send the takes to
 * the existing ElevenLabs voice-clone route, and assign the resulting clone to
 * one of their characters — all without leaving the studio.
 *
 * Reused, existing endpoints (no new APIs invented):
 *   - POST /api/video/voice-clone            → create the ElevenLabs clone
 *   - GET  /api/video/avatar-profiles?scope=own → list the operator's characters
 *   - PATCH /api/video/avatar-profiles/[id]  → assign voiceId/voiceName/voiceProvider
 *
 * Reused building blocks:
 *   - usePassRecorder        → MediaRecorder mic capture (mirrors VoiceRecorderStudio)
 *   - Teleprompter           → karaoke auto-scroll at ~115 wpm
 *   - DEFAULT_CAPTURE_SCRIPT → the approved 6-section capture script
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Mic,
  Square,
  RotateCcw,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Pencil,
  Undo2,
  UserSquare2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  PageTitle,
  SectionTitle,
  SectionDescription,
  CardTitle,
  Caption,
} from '@/components/ui/typography';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { cn } from '@/lib/utils';
import { Teleprompter } from './Teleprompter';
import { usePassRecorder, type PassRecording } from './usePassRecorder';
import {
  DEFAULT_CAPTURE_SCRIPT,
  DEFAULT_WORDS_PER_MINUTE,
  type ScriptSection,
} from './capture-script';

// ── Types for the existing APIs we call ──────────────────────────────────────

interface VoiceCloneResponse {
  success: boolean;
  voiceId?: string;
  voiceName?: string;
  provider?: string;
  error?: string;
}

interface CharacterOption {
  id: string;
  name: string;
  frontalImageUrl: string;
  voiceName: string | null;
}

interface ListProfilesResponse {
  success: boolean;
  profiles?: Array<{
    id: string;
    name: string;
    frontalImageUrl: string;
    voiceName: string | null;
  }>;
  error?: string;
}

interface UpdateProfileResponse {
  success: boolean;
  error?: string;
}

type CloneStage = 'idle' | 'cloning' | 'assigning' | 'done' | 'error';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Serialize the (possibly edited) script back into editable plain text. */
function scriptToText(sections: ScriptSection[]): string {
  return sections
    .map((section) => {
      const header = `${section.label}`;
      const body = section.lines
        .map((l) => (l.cue ? `(${l.cue}) ${l.text}` : l.text))
        .join('\n');
      return `${header}\n${body}`;
    })
    .join('\n\n');
}

/**
 * Parse edited plain text back into sections. Section labels are lines that
 * start with the section sigil "§"; a leading "(cue)" becomes the line's cue.
 * Anything before the first section header is ignored. Unknown sections keep
 * their text but lose timing nuance — acceptable for a free-edit field.
 */
function textToScript(text: string, template: ScriptSection[]): ScriptSection[] {
  const lines = text.split('\n');
  const result: ScriptSection[] = [];
  let current: ScriptSection | null = null;

  const templateById = new Map(template.map((s) => [s.label, s]));

  for (const raw of lines) {
    const line = raw.trim();
    if (line.length === 0) {
      continue;
    }
    if (line.startsWith('§')) {
      const tmpl = templateById.get(line);
      current = {
        id: tmpl?.id ?? `section-${result.length}`,
        label: line,
        purpose: tmpl?.purpose ?? '',
        approxSeconds: tmpl?.approxSeconds ?? 30,
        warmUp: tmpl?.warmUp ?? false,
        lines: [],
      };
      result.push(current);
      continue;
    }
    if (!current) {
      continue;
    }
    const cueMatch = line.match(/^\(([^)]+)\)\s*(.*)$/);
    if (cueMatch && cueMatch[2].length > 0) {
      current.lines.push({ cue: cueMatch[1], text: cueMatch[2] });
    } else {
      current.lines.push({ text: line });
    }
  }

  return result.length > 0 ? result : template;
}

// ─────────────────────────────────────────────────────────────────────────────

interface CloneVoiceStudioProps {
  /**
   * Lock the studio to one character: hides the character dropdown and
   * auto-assigns the new clone to this character. Used when the studio is
   * launched from a character's edit screen ("record this character's voice").
   */
  targetCharacter?: { id: string; name: string };
  /** Hide the big page header when embedded inside another surface (e.g. a dialog). */
  embedded?: boolean;
  /**
   * Fired after the clone is created AND assigned to the target character, so an
   * embedding form can sync its own voice state and close the studio.
   */
  onAssigned?: (result: { voiceId: string; voiceName: string }) => void;
}

export function CloneVoiceStudio({
  targetCharacter,
  embedded = false,
  onAssigned,
}: CloneVoiceStudioProps = {}) {
  const authFetch = useAuthFetch();
  const targetCharacterIdProp = targetCharacter?.id;

  // Script (editable). We keep both the structured form (for the teleprompter)
  // and a plain-text draft (for the edit textarea).
  const [script, setScript] = useState<ScriptSection[]>(DEFAULT_CAPTURE_SCRIPT);
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState(() => scriptToText(DEFAULT_CAPTURE_SCRIPT));

  const [wordsPerMinute, setWordsPerMinute] = useState(DEFAULT_WORDS_PER_MINUTE);

  // Two independent recorders, one per capture pass.
  const steady = usePassRecorder();
  const expressive = usePassRecorder();

  // Voice clone + assignment state.
  const [voiceName, setVoiceName] = useState(
    targetCharacter ? `${targetCharacter.name}'s voice` : '',
  );
  const [characters, setCharacters] = useState<CharacterOption[]>([]);
  const [charactersLoading, setCharactersLoading] = useState(false);
  const [targetCharacterId, setTargetCharacterId] = useState(targetCharacter?.id ?? '');
  const [stage, setStage] = useState<CloneStage>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [createdVoiceLabel, setCreatedVoiceLabel] = useState('');

  // ── Load the operator's characters (for the assignment dropdown) ───────────
  // Skipped entirely when locked to one character — we already know the target.
  useEffect(() => {
    if (targetCharacterIdProp) {
      return;
    }
    let cancelled = false;
    setCharactersLoading(true);
    void (async () => {
      try {
        const res = await authFetch('/api/video/avatar-profiles?scope=own');
        if (!res.ok) {
          return;
        }
        const data = (await res.json()) as ListProfilesResponse;
        if (!cancelled) {
          setCharacters(
            (data.profiles ?? []).map((p) => ({
              id: p.id,
              name: p.name,
              frontalImageUrl: p.frontalImageUrl,
              voiceName: p.voiceName,
            })),
          );
        }
      } catch {
        /* characters are optional — clone still works without assignment */
      } finally {
        if (!cancelled) {
          setCharactersLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch, targetCharacterIdProp]);

  // ── Script editing ─────────────────────────────────────────────────────────
  const startEditing = useCallback(() => {
    setDraftText(scriptToText(script));
    setEditing(true);
  }, [script]);

  const saveEditing = useCallback(() => {
    setScript(textToScript(draftText, DEFAULT_CAPTURE_SCRIPT));
    setEditing(false);
  }, [draftText]);

  const resetScript = useCallback(() => {
    setScript(DEFAULT_CAPTURE_SCRIPT);
    setDraftText(scriptToText(DEFAULT_CAPTURE_SCRIPT));
    setEditing(false);
  }, []);

  // ── Clone + assign ─────────────────────────────────────────────────────────
  const bothRecorded = steady.recording !== null && expressive.recording !== null;

  const handleCreateClone = useCallback(async () => {
    const name = voiceName.trim();
    if (!name) {
      setStage('error');
      setStatusMessage('Give the voice a name first (for example, "David — my voice").');
      return;
    }
    if (!steady.recording || !expressive.recording) {
      setStage('error');
      setStatusMessage('Record both passes — the steady read and the expressive read — before cloning.');
      return;
    }

    setStage('cloning');
    setStatusMessage('Sending both recordings to ElevenLabs to build your voice clone…');
    setCreatedVoiceLabel('');

    let voiceId = '';
    let clonedName = name;
    try {
      const form = new FormData();
      form.append('name', name);
      form.append(
        'description',
        'Cloned in the Clone Voice Studio from a steady pass and an expressive pass.',
      );
      // The clone route accepts multiple "samples" — send both passes.
      form.append('samples', steady.recording.blob, 'steady-pass.webm');
      form.append('samples', expressive.recording.blob, 'expressive-pass.webm');

      const res = await authFetch('/api/video/voice-clone', {
        method: 'POST',
        body: form,
      });
      const data = (await res.json()) as VoiceCloneResponse;

      if (!res.ok || !data.success || !data.voiceId) {
        setStage('error');
        setStatusMessage(data.error ?? 'The voice clone could not be created. Please try again.');
        return;
      }
      voiceId = data.voiceId;
      clonedName = data.voiceName ?? name;
    } catch {
      setStage('error');
      setStatusMessage('Something went wrong while creating the clone. Please try again.');
      return;
    }

    // If no character was chosen, we are done after cloning.
    if (!targetCharacterId) {
      setStage('done');
      setCreatedVoiceLabel(clonedName);
      setStatusMessage(
        `Your voice "${clonedName}" was created and added to your voice library. Pick a character above and clone again if you'd like to assign it.`,
      );
      return;
    }

    // Assign the new clone to the chosen character via the existing PATCH route.
    setStage('assigning');
    setStatusMessage('Assigning the new voice to your character…');
    try {
      const res = await authFetch(`/api/video/avatar-profiles/${targetCharacterId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceId,
          voiceName: clonedName,
          voiceProvider: 'custom',
        }),
      });
      const data = (await res.json()) as UpdateProfileResponse;
      if (!res.ok || !data.success) {
        // The clone DID succeed — be honest that only the assignment failed.
        setStage('error');
        setStatusMessage(
          `Your voice "${clonedName}" was created, but assigning it to the character failed: ${
            data.error ?? 'unknown error'
          }. You can assign it from the character's edit screen.`,
        );
        return;
      }
    } catch {
      setStage('error');
      setStatusMessage(
        `Your voice "${clonedName}" was created, but assigning it to the character failed. You can assign it from the character's edit screen.`,
      );
      return;
    }

    const charName =
      targetCharacter?.name ??
      characters.find((c) => c.id === targetCharacterId)?.name ??
      'your character';
    setCreatedVoiceLabel(clonedName);
    setStage('done');
    setStatusMessage(`Done! "${clonedName}" is now ${charName}'s voice. It is also in your voice library.`);
    // Reflect the new assignment in the dropdown labels.
    setCharacters((prev) =>
      prev.map((c) => (c.id === targetCharacterId ? { ...c, voiceName: clonedName } : c)),
    );
    // Let an embedding form (the character edit screen) sync + close.
    onAssigned?.({ voiceId, voiceName: clonedName });
  }, [
    voiceName,
    steady.recording,
    expressive.recording,
    targetCharacterId,
    characters,
    authFetch,
    targetCharacter,
    onAssigned,
  ]);

  const busy = stage === 'cloning' || stage === 'assigning';

  const editedSummary = useMemo(
    () => script.reduce((acc, s) => acc + s.lines.length, 0),
    [script],
  );

  return (
    <div className="space-y-6">
      {/* Header — hidden when embedded (the host surface provides its own title) */}
      {!embedded && (
        <div>
          <PageTitle className="flex items-center gap-3">
            <Mic className="h-7 w-7 text-primary" />
            Clone Voice Studio
          </PageTitle>
          <SectionDescription className="mt-1 max-w-3xl">
            Read the script aloud while it scrolls. You&apos;ll record it twice — once steady and
            once expressive — and we&apos;ll build an ElevenLabs voice clone and assign it to a
            character. Find a quiet room and stay 6–12 inches from your microphone.
          </SectionDescription>
        </div>
      )}
      {embedded && targetCharacter && (
        <SectionDescription className="max-w-3xl">
          Read the script aloud while it scrolls — once steady, once expressive. We&apos;ll build
          the voice clone and set it as <span className="text-foreground font-medium">{targetCharacter.name}</span>&apos;s
          voice. Find a quiet room and stay 6–12 inches from your microphone.
        </SectionDescription>
      )}

      {/* Script editor toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Caption>
          {editedSummary} lines · ~4 minutes · scrolls at {DEFAULT_WORDS_PER_MINUTE} words per minute
        </Caption>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button variant="outline" onClick={() => setEditing(false)} className="gap-2">
                Cancel
              </Button>
              <Button onClick={saveEditing} className="gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Save script
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={resetScript} className="gap-2">
                <Undo2 className="h-4 w-4" />
                Reset to default
              </Button>
              <Button variant="outline" onClick={startEditing} className="gap-2">
                <Pencil className="h-4 w-4" />
                Edit script
              </Button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <div className="rounded-2xl border border-border-strong bg-card p-6">
          <CardTitle className="mb-1">Edit the capture script</CardTitle>
          <Caption className="mb-3 block">
            Keep the &ldquo;§&rdquo; section headers. Put a delivery hint in parentheses at the start
            of a line, like &ldquo;(soft, slow) Take a breath…&rdquo;. Each line should be short —
            about one breath.
          </Caption>
          <textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            rows={16}
            className="w-full resize-y rounded-md border border-border-strong bg-surface-elevated px-3 py-2 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      ) : (
        <Teleprompter
          sections={script}
          wordsPerMinute={wordsPerMinute}
          onWordsPerMinuteChange={setWordsPerMinute}
        />
      )}

      {/* Two recording passes */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PassPanel
          title="Pass 1 · Steady"
          hint="Even, natural, unhurried. Let the script carry the read — no big swings."
          recorder={steady}
        />
        <PassPanel
          title="Pass 2 · Expressive"
          hint="Same script, but lean into the emotions and dynamics. Big questions, bright excitement, real feeling."
          recorder={expressive}
        />
      </div>

      {/* Clone + assign */}
      <div className="rounded-2xl border border-border-strong bg-card p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <SectionTitle as="h2">Create the clone &amp; assign it</SectionTitle>
        </div>

        {!bothRecorded && (
          <div className="flex items-start gap-2 rounded-md border border-border-light bg-surface-elevated p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
            <Caption>
              Record both passes above to enable cloning. Both takes make the clone richer.
            </Caption>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Voice name */}
          <div>
            <Caption className="mb-1 block">Voice name</Caption>
            <input
              type="text"
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value)}
              placeholder='e.g. "David — my voice"'
              className="w-full rounded-md border border-border-strong bg-surface-elevated px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {/* Character to assign — a fixed target when launched from a character */}
          <div>
            <Caption className="mb-1 block">
              {targetCharacter ? 'Assigning to' : 'Assign to character (optional)'}
            </Caption>
            {targetCharacter ? (
              <div className="flex items-center gap-2 rounded-md border border-border-strong bg-surface-elevated px-3 py-2">
                <UserSquare2 className="h-4 w-4 flex-shrink-0 text-primary" />
                <span className="truncate text-sm text-foreground">{targetCharacter.name}</span>
              </div>
            ) : (
              <>
                <select
                  value={targetCharacterId}
                  onChange={(e) => setTargetCharacterId(e.target.value)}
                  disabled={charactersLoading}
                  className="w-full rounded-md border border-border-strong bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                  <option value="">
                    {charactersLoading ? 'Loading characters…' : "Don't assign — just save to library"}
                  </option>
                  {characters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.voiceName ? ` · currently: ${c.voiceName}` : ''}
                    </option>
                  ))}
                </select>
                {!charactersLoading && characters.length === 0 && (
                  <Caption className="mt-1 block">
                    No characters yet — create one in the Character Library to assign a voice.
                  </Caption>
                )}
              </>
            )}
          </div>
        </div>

        <Button
          onClick={() => {
            void handleCreateClone();
          }}
          disabled={!bothRecorded || busy || voiceName.trim().length === 0}
          className="gap-2"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {stage === 'cloning'
            ? 'Creating clone…'
            : stage === 'assigning'
              ? 'Assigning voice…'
              : targetCharacterId
                ? 'Clone my voice & assign it'
                : 'Clone my voice'}
        </Button>

        {/* Status — always plain English, never silent */}
        {stage === 'done' && (
          <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/10 p-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
            <div>
              {createdVoiceLabel && (
                <CardTitle className="mb-0.5 flex items-center gap-1.5">
                  <UserSquare2 className="h-4 w-4 text-primary" />
                  {createdVoiceLabel}
                </CardTitle>
              )}
              <Caption className="text-foreground">{statusMessage}</Caption>
            </div>
          </div>
        )}
        {stage === 'error' && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
            <Caption className="text-destructive">{statusMessage}</Caption>
          </div>
        )}
        {busy && (
          <div className="flex items-start gap-2 rounded-md border border-border-light bg-surface-elevated p-3">
            <Loader2 className="mt-0.5 h-4 w-4 flex-shrink-0 animate-spin text-primary" />
            <Caption>{statusMessage}</Caption>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Per-pass recorder panel ──────────────────────────────────────────────────

interface PassPanelProps {
  title: string;
  hint: string;
  recorder: ReturnType<typeof usePassRecorder>;
}

function PassPanel({ title, hint, recorder }: PassPanelProps) {
  const { status, level, elapsedSeconds, recording, error, start, stop, reset } = recorder;

  const done: PassRecording | null = recording;

  return (
    <div
      className={cn(
        'rounded-2xl border bg-card p-6 transition-colors',
        status === 'recording' ? 'border-destructive/50' : 'border-border-strong',
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <CardTitle>{title}</CardTitle>
        {status === 'recording' && (
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
            <span className="font-mono text-xs text-destructive">REC</span>
          </span>
        )}
        {status === 'recorded' && (
          <span className="flex items-center gap-1.5 text-primary">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs">Recorded</span>
          </span>
        )}
      </div>
      <Caption className="mb-4 block">{hint}</Caption>

      {/* Level + elapsed */}
      <div className="mb-4 flex items-center gap-4">
        <span
          className={cn(
            'font-mono text-2xl tabular-nums',
            status === 'recording' ? 'text-destructive' : 'text-foreground',
          )}
        >
          {formatElapsed(elapsedSeconds)}
        </span>
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-elevated">
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-75',
              level > 0.6 ? 'bg-destructive' : level > 0.3 ? 'bg-primary' : 'bg-primary/60',
            )}
            style={{ width: `${Math.min(level * 300, 100)}%` }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {status === 'idle' && (
          <Button
            onClick={() => {
              void start();
            }}
            className="gap-2 bg-destructive text-white hover:bg-destructive/90"
          >
            <Mic className="h-4 w-4" />
            Record this pass
          </Button>
        )}
        {status === 'recording' && (
          <Button onClick={stop} className="gap-2">
            <Square className="h-4 w-4 fill-current" />
            Stop
          </Button>
        )}
        {status === 'recorded' && (
          <Button
            variant="outline"
            onClick={reset}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Re-record
          </Button>
        )}
      </div>

      {/* Playback of the finished take */}
      {done && status === 'recorded' && (
        <audio controls src={done.url} className="mt-4 w-full">
          <track kind="captions" />
        </audio>
      )}

      {/* Inline mic error — never silent */}
      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
          <Caption className="text-destructive">{error}</Caption>
        </div>
      )}
    </div>
  );
}
