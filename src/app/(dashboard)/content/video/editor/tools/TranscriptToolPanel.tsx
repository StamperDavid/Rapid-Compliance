'use client';

/**
 * Transcript tool panel — edit by transcript.
 *
 * Reuses the proven Script & Podcast logic: transcribe each clip via Deepgram
 * (/api/video/editor/transcribe), read the result as selectable word tokens, then
 * cut transcript spans out of the video through the SHARED reducer (SPLIT_CLIP /
 * REMOVE_CLIP / UPDATE_CLIP). Delete-selected / Remove-filler-words / Remove-silences
 * all drive that reducer — this panel never forks its own copy of the project.
 *
 * This is a NARROW right-column panel beside the unified editor's Preview + Timeline:
 * it renders NO Preview of its own and no transport controls — the editor already
 * shows those. When Deepgram isn't configured we surface an honest "not connected"
 * state; we never fake a transcript.
 */

import {
  FileText,
  Loader2,
  AlertTriangle,
  Scissors,
  Trash2,
  Wind,
  RefreshCw,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SubsectionTitle, SectionDescription, Caption } from '@/components/ui/typography';
import type { EditorToolProps } from '../editor-tools';
import type { TranscriptToken } from '../modes/script-podcast/transcript-model';
import TranscriptPanel from '../modes/script-podcast/TranscriptPanel';
import {
  useTranscriptEditing,
  type TranscribeStatus,
} from './transcript/use-transcript-editing';

export default function TranscriptToolPanel({ state, dispatch, authFetch }: EditorToolProps) {
  const { clips, playheadTime } = state;
  const hasClips = clips.length > 0;

  const {
    status,
    ready,
    tokens,
    selectedIds,
    selectedCount,
    activeTokenId,
    fillerCount,
    silenceCount,
    isCutting,
    transcribe,
    onWordClick,
    deleteSelection,
    removeFillers,
    removeSilences,
  } = useTranscriptEditing({ clips, playheadTime, dispatch, authFetch });

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pr-1">
      {/* ── Header + Transcribe ─────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <SubsectionTitle as="h3" className="text-base">
            Transcript
          </SubsectionTitle>
        </div>
        <SectionDescription>
          Turn your clips into an editable script. Delete words to cut the video, and
          strip filler words and silences in one click.
        </SectionDescription>

        {ready ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={isCutting}
            onClick={() => void transcribe()}
          >
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Re-transcribe
          </Button>
        ) : (
          <Button
            size="sm"
            className="w-full"
            disabled={!hasClips || status.phase === 'loading'}
            onClick={() => void transcribe()}
          >
            {status.phase === 'loading' ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-1.5 h-4 w-4" />
            )}
            {status.phase === 'loading' ? 'Transcribing…' : 'Transcribe project'}
          </Button>
        )}
      </div>

      {/* ── Transcript reader / honest status ───────────────────────────── */}
      <TranscriptStatusBody
        status={status}
        hasClips={hasClips}
        tokens={tokens}
        selectedIds={selectedIds}
        activeTokenId={activeTokenId}
        onWordClick={onWordClick}
      />

      {/* ── Edit actions ────────────────────────────────────────────────── */}
      {ready && (
        <div className="space-y-2 rounded-xl border border-border-strong bg-card p-3">
          <SubsectionTitle as="h4" className="text-sm">
            Edits
          </SubsectionTitle>
          <Button
            size="sm"
            variant="destructive"
            className="w-full justify-start"
            disabled={selectedCount === 0 || isCutting}
            onClick={deleteSelection}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            Delete selected{selectedCount > 0 ? ` (${selectedCount})` : ''}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="w-full justify-start"
            disabled={fillerCount === 0 || isCutting}
            onClick={removeFillers}
          >
            <Scissors className="mr-1.5 h-4 w-4" />
            Remove filler words{fillerCount > 0 ? ` (${fillerCount})` : ''}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="w-full justify-start"
            disabled={silenceCount === 0 || isCutting}
            onClick={removeSilences}
          >
            <Wind className="mr-1.5 h-4 w-4" />
            Remove silences{silenceCount > 0 ? ` (${silenceCount})` : ''}
          </Button>
          {isCutting && (
            <Caption className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Applying cuts…
            </Caption>
          )}
          <Caption className="block">
            Click a word to jump there. Click one word then Shift-click another to select
            a span, then Delete to cut it from the video. Filler words are tinted amber.
          </Caption>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Transcript body — switches between the reader and the honest status states.
// ===========================================================================

interface TranscriptStatusBodyProps {
  status: TranscribeStatus;
  hasClips: boolean;
  tokens: TranscriptToken[];
  selectedIds: ReadonlySet<string>;
  activeTokenId: string | null;
  onWordClick: (token: TranscriptToken, shiftKey: boolean) => void;
}

function TranscriptStatusBody({
  status,
  hasClips,
  tokens,
  selectedIds,
  activeTokenId,
  onWordClick,
}: TranscriptStatusBodyProps) {
  if (status.phase === 'ready') {
    return (
      <div className="rounded-xl border border-border-strong bg-card p-3">
        <TranscriptPanel
          tokens={tokens}
          selectedIds={selectedIds}
          activeTokenId={activeTokenId}
          onWordClick={onWordClick}
        />
      </div>
    );
  }

  if (status.phase === 'not_connected') {
    return (
      <div className="rounded-xl border border-dashed border-border-strong bg-surface-elevated p-5 text-center">
        <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-amber-500" />
        <SubsectionTitle as="h4" className="text-sm">
          Transcription isn&apos;t connected yet
        </SubsectionTitle>
        <SectionDescription className="mt-1">
          {status.message} Connect a transcription service to enable script editing.
        </SectionDescription>
      </div>
    );
  }

  if (status.phase === 'error') {
    return (
      <div className="rounded-xl border border-dashed border-destructive/50 bg-surface-elevated p-5 text-center">
        <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-destructive" />
        <SectionDescription>{status.message}</SectionDescription>
      </div>
    );
  }

  // idle / loading
  return (
    <div className="rounded-xl border border-dashed border-border-strong bg-surface-elevated p-5 text-center">
      <FileText className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
      <SectionDescription>
        {hasClips
          ? status.phase === 'loading'
            ? 'Transcribing your clips — this can take a moment.'
            : 'Click “Transcribe project” to turn your clips into an editable script.'
          : 'Add clips to your project first, then transcribe them to edit by script.'}
      </SectionDescription>
    </div>
  );
}
