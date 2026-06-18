'use client';

/**
 * Editor mode selector — the editor's front door. The operator picks a purpose;
 * that mode's focused workspace opens against the shared project. Switching modes
 * later never loses the project (the reducer state is shared).
 */

import { CardTitle, SectionDescription, Caption } from '@/components/ui/typography';
import { EDITOR_MODES, type EditorMode } from './editor-modes';

interface EditorModeSelectorProps {
  onSelect: (mode: EditorMode) => void;
  hasClips: boolean;
}

export default function EditorModeSelector({ onSelect, hasClips }: EditorModeSelectorProps) {
  return (
    <div className="space-y-4">
      <SectionDescription>
        Choose how you want to edit{hasClips ? ' your loaded scenes' : ''}. Each mode gives you the
        right tools for the job — and you can switch anytime without losing your project.
      </SectionDescription>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {EDITOR_MODES.map((mode) => {
          const Icon = mode.icon;
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => onSelect(mode.id)}
              className="flex flex-col items-start rounded-2xl border border-border-strong bg-card p-6 text-left transition-colors hover:border-primary/40"
            >
              <div className="mb-3 flex items-center gap-3">
                <span className="rounded-xl bg-primary/10 p-2.5">
                  <Icon className="h-5 w-5 text-primary" />
                </span>
                <CardTitle>{mode.label}</CardTitle>
              </div>
              <p className="mb-3 flex-1 text-sm text-muted-foreground">{mode.description}</p>
              <Caption>Matches: {mode.competitor}</Caption>
            </button>
          );
        })}
      </div>
    </div>
  );
}
