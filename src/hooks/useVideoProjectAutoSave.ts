/**
 * useVideoProjectAutoSave
 *
 * Auto-persists the active video pipeline project to Firestore
 * (`video_pipeline_projects` via POST /api/video/project/save) so that work
 * built on the Storyboard canvas is never lost and is always recallable via
 * "Load Project".
 *
 * Behaviour:
 *  - Watches the persisted pipeline store fields. Whenever they change AND the
 *    project has real content (>= 1 non-empty storyboard), a debounced save
 *    (~2.5s) fires.
 *  - The first successful save CREATEs the doc and writes the returned
 *    `projectId` back into the store, so every later save UPDATEs the SAME doc
 *    (no duplicate projects per session).
 *  - `flush()` lets callers persist immediately on key events (e.g. Generate
 *    pressed) without waiting for the debounce.
 *  - Exposes `saveStatus` ('idle' | 'saving' | 'saved' | 'error') for a small
 *    "Saved ✓ / Saving…" indicator.
 *
 * Auth + tenancy: uses `useAuthFetch` → the Admin-SDK save route resolves the
 * org server-side. No org id is referenced in the client.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useVideoPipelineStore } from '@/lib/stores/video-pipeline-store';
import type { PipelineScene, PipelineStep, ProjectStatus } from '@/types/video-pipeline';

export type ProjectSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** Debounce window after the last change before an auto-save fires. */
const AUTOSAVE_DEBOUNCE_MS = 2500;

/** A storyboard counts as "real content" if it carries any authored detail. */
function sceneHasContent(scene: PipelineScene): boolean {
  if ((scene.scriptText ?? '').trim().length > 0) {
    return true;
  }
  if ((scene.visualDescription ?? '').trim().length > 0) {
    return true;
  }
  if ((scene.title ?? '').trim().length > 0) {
    return true;
  }
  if ((scene.location ?? '').trim().length > 0) {
    return true;
  }
  if (scene.screenshotUrl !== null && scene.screenshotUrl !== undefined) {
    return true;
  }
  if (scene.references !== undefined && scene.references.length > 0) {
    return true;
  }
  return false;
}

/** True once the project is worth persisting (>= 1 non-empty storyboard). */
function hasRealContent(scenes: PipelineScene[]): boolean {
  return scenes.length > 0 && scenes.some(sceneHasContent);
}

/** Derive a sensible auto name from the project / brief / first scene. */
function deriveProjectName(
  projectName: string,
  briefDescription: string,
  scenes: PipelineScene[],
): string {
  const explicit = projectName.trim();
  if (explicit) {
    return explicit.slice(0, 80);
  }
  const fromBrief = briefDescription.trim();
  if (fromBrief) {
    return fromBrief.slice(0, 50);
  }
  const firstTitled = scenes.find((s) => s.title?.trim());
  if (firstTitled?.title) {
    return firstTitled.title.trim().slice(0, 50);
  }
  const firstScripted = scenes.find((s) => s.scriptText?.trim());
  if (firstScripted?.scriptText) {
    return firstScripted.scriptText.trim().slice(0, 50);
  }
  // Last resort: a timestamped untitled name so it's still findable.
  const stamp = new Date().toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `Untitled Video — ${stamp}`;
}

/**
 * The save route's `currentStep` enum does not include 'publish'; clamp it so
 * an auto-save from the Publish step still validates.
 */
function clampStepForSave(step: PipelineStep): PipelineStep {
  return step === 'publish' ? 'post-production' : step;
}

interface SaveResponse {
  success: boolean;
  projectId?: string;
}

export interface UseVideoProjectAutoSaveResult {
  saveStatus: ProjectSaveStatus;
  /** Persist immediately (skips the debounce). Resolves when the save settles. */
  flush: () => Promise<void>;
}

export function useVideoProjectAutoSave(): UseVideoProjectAutoSaveResult {
  const authFetch = useAuthFetch();
  const setProjectId = useVideoPipelineStore((s) => s.setProjectId);

  // Subscribe to the persisted content so the effect re-runs on real changes.
  const projectId = useVideoPipelineStore((s) => s.projectId);
  const projectName = useVideoPipelineStore((s) => s.projectName);
  const brief = useVideoPipelineStore((s) => s.brief);
  const scenes = useVideoPipelineStore((s) => s.scenes);
  const avatarId = useVideoPipelineStore((s) => s.avatarId);
  const avatarName = useVideoPipelineStore((s) => s.avatarName);
  const voiceId = useVideoPipelineStore((s) => s.voiceId);
  const voiceName = useVideoPipelineStore((s) => s.voiceName);
  const voiceProvider = useVideoPipelineStore((s) => s.voiceProvider);
  const generatedScenes = useVideoPipelineStore((s) => s.generatedScenes);
  const finalVideoUrl = useVideoPipelineStore((s) => s.finalVideoUrl);
  const transitionType = useVideoPipelineStore((s) => s.transitionType);
  const currentStep = useVideoPipelineStore((s) => s.currentStep);
  // The Shot Plan is its own content source — a plan (with its rendered images)
  // must persist even when there are no legacy pipeline "scenes".
  const shotPlan = useVideoPipelineStore((s) => s.shotPlan);
  // While a server-side shot-doc build runs, the server owns the doc — skip
  // autosaving so a stale polled plan never clobbers a newer server write.
  const shotPlanBuildStatus = useVideoPipelineStore((s) => s.shotPlanBuildStatus);

  const [saveStatus, setSaveStatus] = useState<ProjectSaveStatus>('idle');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The currently-running save, if any. A new request chains off it rather than
  // running concurrently, so saves serialize and we never write two docs.
  const inFlightRef = useRef<Promise<void> | null>(null);
  // Set when a change arrives while a save is in flight — triggers a re-save.
  const pendingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * Build the save payload from the LIVE store state (not the closed-over
   * values) so a flush always persists the latest edits.
   */
  const buildPayload = useCallback((): Record<string, unknown> | null => {
    const state = useVideoPipelineStore.getState();
    // While a SERVER-SIDE shot-doc build is running, the server owns the project
    // doc — it writes the plan + progress as each asset renders. A client autosave
    // here would write a slightly-stale POLLED plan back over a newer server write,
    // so skip saving entirely until the build is no longer 'generating'.
    if (state.shotPlanBuildStatus === 'generating') {
      return null;
    }
    // Save when there are real scenes OR a Shot Plan (the shot-plan flow has no
    // pipeline scenes, so gating only on scenes meant plans never persisted).
    if (!hasRealContent(state.scenes) && !state.shotPlan) {
      return null;
    }

    const name = deriveProjectName(state.projectName, state.brief.description, state.scenes);

    const status: ProjectStatus =
      state.finalVideoUrl !== null
        ? 'assembled'
        : state.generatedScenes.some((g) => g.status === 'completed')
          ? 'generated'
          : 'draft';

    return {
      projectId: state.projectId ?? undefined,
      name,
      brief: state.brief,
      currentStep: clampStepForSave(state.currentStep),
      scenes: state.scenes.map((s) => ({
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
        engine: s.engine ?? 'fal',
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
      avatarId: state.avatarId ?? null,
      avatarName: state.avatarName ?? null,
      voiceId: state.voiceId ?? null,
      voiceName: state.voiceName ?? null,
      voiceProvider: state.voiceProvider ?? null,
      generatedScenes: state.generatedScenes,
      finalVideoUrl: state.finalVideoUrl,
      transitionType: state.transitionType,
      shotPlan: state.shotPlan ?? null,
      status,
    };
  }, []);

  /** One save round-trip (no concurrency control — see runSave). */
  const performSave = useCallback(async (): Promise<void> => {
    const payload = buildPayload();
    if (!payload) {
      return;
    }

    if (mountedRef.current) {
      setSaveStatus('saving');
    }

    try {
      const response = await authFetch('/api/video/project/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as SaveResponse;

      if (response.ok && data.success) {
        // Persist the returned id so subsequent saves UPDATE the same doc.
        if (data.projectId && useVideoPipelineStore.getState().projectId !== data.projectId) {
          setProjectId(data.projectId);
        }
        if (mountedRef.current) {
          setSaveStatus('saved');
        }
      } else if (mountedRef.current) {
        setSaveStatus('error');
      }
    } catch {
      if (mountedRef.current) {
        setSaveStatus('error');
      }
    }
  }, [authFetch, buildPayload, setProjectId]);

  /**
   * Serialized save. If a save is already running, just flag that another pass
   * is needed; the running chain picks it up when it settles. This guarantees
   * saves never overlap, so a create is never issued twice.
   */
  const runSave = useCallback((): Promise<void> => {
    if (inFlightRef.current) {
      pendingRef.current = true;
      return inFlightRef.current;
    }

    const chain = (async () => {
      // Keep saving while changes keep queueing up.
      do {
        pendingRef.current = false;
        await performSave();
      } while (pendingRef.current && mountedRef.current);
    })().finally(() => {
      inFlightRef.current = null;
    });

    inFlightRef.current = chain;
    return chain;
  }, [performSave]);

  // ── Debounced auto-save on content change ────────────────────────────────
  useEffect(() => {
    // Server-side build in flight → the server owns the doc; do not autosave.
    if (shotPlanBuildStatus === 'generating') {
      return;
    }
    if (!hasRealContent(scenes) && !shotPlan) {
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      void runSave();
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
    // Re-run whenever any persisted field changes.
  }, [
    runSave,
    projectId,
    projectName,
    brief,
    scenes,
    avatarId,
    avatarName,
    voiceId,
    voiceName,
    voiceProvider,
    generatedScenes,
    finalVideoUrl,
    transitionType,
    currentStep,
    shotPlan,
    shotPlanBuildStatus,
  ]);

  // ── Immediate save (key events) ──────────────────────────────────────────
  const flush = useCallback(async (): Promise<void> => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    await runSave();
  }, [runSave]);

  return { saveStatus, flush };
}
