'use client';

/**
 * StepStoryboard — the Shot Plan creation step (the SOLE video-creation flow).
 *
 * The old RenderZero storyboard-strip authoring UI was phased out: its value
 * (the deep cinematographer-grade controls) now lives inside the Shot Plan as
 * each shot's ADVANCED camera editor (ShotPlanSheet → CinematicControlsPanel).
 *
 * This step is a thin shell around <ShotPlanSheet/>:
 *   - A header describing the flow.
 *   - A two-step "Scrap video" action (deletes the saved project, if any, and
 *     clears the in-progress plan) per the destructive-action rule.
 *   - The Shot Plan itself, which owns generation (per-shot + Generate-all) and
 *     the "Open in editor" hand-off to the existing editor for final assembly.
 *
 * The component keeps the export name `StepStoryboard` so the pipeline page and
 * any other consumers continue to resolve it unchanged.
 */

import { useCallback, useState } from 'react';
import { Clapperboard, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useVideoPipelineStore } from '@/lib/stores/video-pipeline-store';
import { ShotPlanSheet } from './ShotPlanSheet';

export function StepStoryboard() {
  const authFetch = useAuthFetch();
  const projectId = useVideoPipelineStore((s) => s.projectId);
  const reset = useVideoPipelineStore((s) => s.reset);

  const [scrapArmed, setScrapArmed] = useState(false);

  // Scrap the whole video — delete the saved project (if any) and clear the
  // in-progress plan. Two-step confirm (arm, then fire) per the destructive-
  // action rule; auto-disarms after 4s.
  const handleScrap = useCallback(() => {
    if (!scrapArmed) {
      setScrapArmed(true);
      setTimeout(() => setScrapArmed(false), 4000);
      return;
    }
    setScrapArmed(false);
    if (projectId) {
      authFetch(`/api/video/project/${projectId}`, { method: 'DELETE' }).catch(() => {
        /* best-effort */
      });
    }
    reset();
  }, [scrapArmed, projectId, authFetch, reset]);

  // pb-28 keeps the footer clear of the floating Content Assistant launcher.
  return (
    <div className="space-y-6 pb-28">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
            <Clapperboard className="h-5 w-5 text-primary" />
            Shot Doc
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Build your video as a production sheet — a shared look bible plus an ordered set of
            shots. Generate every shot, then open the clips in the editor to stitch them together.
          </p>
        </div>
        <Button
          size="sm"
          variant={scrapArmed ? 'destructive' : 'outline'}
          className="gap-1.5 text-xs"
          onClick={handleScrap}
          title="Delete this video and clear the Shot Doc"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {scrapArmed ? 'Click again to scrap' : 'Scrap video'}
        </Button>
      </div>

      {/* The Shot Plan — the only creation surface. Owns generation + editor path. */}
      <ShotPlanSheet />
    </div>
  );
}
