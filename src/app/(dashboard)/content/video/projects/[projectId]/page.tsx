'use client';

/**
 * Content → Video → Projects → [projectId] — the project REVIEW page.
 *
 * This is the System B (`VideoProject`) review surface. A project's `docs` are
 * full field-addressable Shot Docs (each a `ShotPlan`). The Content Manager
 * creates a project and sends the operator here to do exactly what it told them:
 * "review the fields, cast your character, and mark each ready", then generate.
 *
 * Each shot doc is REVIEWED here in full (the image-forward production-sheet render,
 * reused `ShotPlanDocument`) with its grading column beside it. Characters are written
 * into the scene by the planner — there is no manual cast control on the doc.
 *
 * Per doc the operator can:
 *   - REVIEW every field — the full production-sheet render.
 *   - GRADE the layout — the `ShotDocGradePanel` trains the Shot Plan Planner.
 *   - MARK the scene reviewed — flips the doc's `status` to `ready`, persisted via the
 *     doc PUT route; a plain badge shows which scenes are reviewed.
 *
 * Generation is ONE project-level commit ("Generate all videos") — never per-scene — so
 * nothing renders (and nothing is charged) until every scene has been reviewed.
 *
 * When every doc has a video, a prominent "Open project in editor" button appears
 * so the doc-videos can be stitched into the final film.
 *
 * A freshly CM-created project (status `review`, docs still rendering stills)
 * displays gracefully — partial docs show a still/placeholder and all controls.
 *
 * Design system mandatory: page wrapper `p-8 space-y-6`, typography components,
 * Button/Dialog from the library, Tailwind color tokens (never CSS vars),
 * responsive grid. Plain English throughout.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { Button } from '@/components/ui/button';
import {
  PageTitle,
  SectionTitle,
  SectionDescription,
  CardTitle,
  Caption,
} from '@/components/ui/typography';
import {
  Film,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Clapperboard,
  RefreshCw,
  Wand2,
  CheckCircle2,
  BadgeCheck,
} from 'lucide-react';
import type { ShotPlan } from '@/types/shot-plan';
import {
  type VideoProject,
  docHasVideo,
  countDocsWithVideo,
  allDocsHaveVideo,
} from '@/types/video-project';
import { seedEditorFromProject } from '@/lib/video/editor-seed';
import { ShotPlanDocument } from '../../components/ShotPlanDocument';
import { ShotDocGradePanel } from '../../components/ShotDocGradePanel';
import { ZoomPanViewport } from '../../components/ZoomPanViewport';

// ---------------------------------------------------------------------------
// API response contracts (typed — no `any`)
// ---------------------------------------------------------------------------

interface GetProjectResponse {
  success: boolean;
  project?: VideoProject;
  error?: string;
}

/** Shared by the generate + doc-update routes — both return the re-derived project. */
interface MutateProjectResponse {
  success: boolean;
  project?: VideoProject;
  error?: string;
}

// ---------------------------------------------------------------------------
// Plain-English project status
// ---------------------------------------------------------------------------

function plainProjectStatus(project: VideoProject): string {
  // While the background build runs, the build phase IS the status (most current truth).
  if (project.build?.status === 'running') {
    const { phase, done, total } = project.build;
    return total > 0 ? `${phase} — ${done} of ${total} ready to review so far.` : phase;
  }
  if (project.build?.status === 'error') {
    return project.build.phase;
  }
  if (project.status === 'complete') {
    return 'Final video is ready.';
  }
  if (project.docs.length === 0) {
    return 'We are still writing the docs for this project.';
  }
  const made = countDocsWithVideo(project);
  if (made === 0) {
    return `${project.docs.length} ${project.docs.length === 1 ? 'doc is' : 'docs are'} ready to review. Cast your characters, mark each ready, then make its video.`;
  }
  if (made >= project.docs.length) {
    return 'All your clips are made. Open the editor to arrange them into your final video.';
  }
  return `${made} of ${project.docs.length} ${project.docs.length === 1 ? 'doc has' : 'docs have'} their clips. Keep going to finish the project.`;
}

// ---------------------------------------------------------------------------
// Doc still — the best available preview for a doc
// ---------------------------------------------------------------------------

/** The first usable keyframe across a doc's shots, used as the still preview. */
function firstKeyframe(doc: ShotPlan): string | undefined {
  for (const shot of doc.shots) {
    const key = shot.generated?.keyframeUrl;
    if (typeof key === 'string' && key.length > 0) {
      return key;
    }
  }
  // Fall back to the environment hero render if no shot keyframe exists yet.
  return doc.sharedChoices.environmentHeroImageUrl;
}

/** True when the operator has marked this doc reviewed/ready. */
function docIsReady(doc: ShotPlan): boolean {
  return doc.status === 'ready';
}

// ---------------------------------------------------------------------------
// Doc card
// ---------------------------------------------------------------------------

interface DocCardProps {
  doc: ShotPlan;
  index: number;
  generating: boolean;
  /** A non-generation save (cast / mark-ready) is in flight for this doc. */
  saving: boolean;
  error: string | null;
  /** Any project-wide generation run is in flight — locks per-scene edits. */
  anyGenerating: boolean;
  onToggleReady: (docId: string) => void;
}

function DocCard({
  doc,
  index,
  generating,
  saving,
  error,
  anyGenerating,
  onToggleReady,
}: DocCardProps): React.JSX.Element {
  const hasVideo = docHasVideo(doc);
  const ready = docIsReady(doc);
  const still = firstKeyframe(doc);
  // No engine stitch — preview the scene's first generated clip (clips are
  // assembled in the editor, not pre-merged here).
  const firstClip =
    [...doc.shots]
      .sort((a, b) => a.index - b.index)
      .find((shot) => shot.generated?.videoUrl)?.generated?.videoUrl ?? null;
  const title = doc.title.trim() || `Scene ${index + 1}`;
  const busy = generating || saving || anyGenerating;

  return (
    <div className="bg-card border border-border-strong rounded-2xl p-6 space-y-4">
      {/* Header — which scene this is + review/made state. */}
      <div className="flex items-center gap-2">
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-xs font-semibold text-foreground">
          {index + 1}
        </span>
        <div className="min-w-0">
          <CardTitle className="line-clamp-1">{title}</CardTitle>
          <Caption>
            {doc.shots.length} {doc.shots.length === 1 ? 'shot' : 'shots'}
            {hasVideo ? ' · clips made' : ''}
          </Caption>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {ready && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Reviewed
            </span>
          )}
          {hasVideo && (
            <CheckCircle2 className="h-5 w-5 text-primary shrink-0" aria-label="Video made" />
          )}
        </div>
      </div>

      {/* THE SHOT DOC — reviewed here in full, with the grading column to the right so
          the operator can train the layout agent (same surface as the editor). */}
      <div className="flex flex-col items-start gap-4 xl:flex-row">
        <div className="min-w-0 flex-1">
          <ZoomPanViewport>
            <ShotPlanDocument plan={doc} onEdit={() => undefined} onEditSection={() => undefined} />
          </ZoomPanViewport>
        </div>
        <ShotDocGradePanel plan={doc} />
      </div>

      {/* The generated clip, once this scene has been made. */}
      {firstClip && (
        <video
          src={firstClip}
          poster={still ?? undefined}
          controls
          playsInline
          preload="metadata"
          className="w-full max-w-md rounded-xl border border-border-strong"
        />
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      {generating && (
        <div className="flex items-start gap-2 rounded-md bg-surface-elevated px-3 py-2 text-sm text-foreground">
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" aria-hidden />
          <span>Making this scene&apos;s video… this can take a few minutes.</span>
        </div>
      )}

      {/* Per-scene review action only. Generation is ONE project-level commit (below the
          list) — there is no per-scene Generate button; you fix every scene first, then
          render them all at once so you never pay for a render you haven't reviewed. */}
      <div className="flex items-center gap-2 border-t border-border-light pt-4">
        <Button
          variant={ready ? 'default' : 'outline'}
          size="sm"
          className="gap-1.5"
          onClick={() => onToggleReady(doc.id)}
          disabled={busy}
          title={ready ? 'Mark this scene as still in review' : 'Mark this scene reviewed'}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <BadgeCheck className="h-4 w-4" aria-hidden />
          )}
          {ready ? 'Reviewed' : 'Mark reviewed'}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function VideoProjectDetailPage(): React.JSX.Element {
  const router = useRouter();
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const authFetch = useAuthFetch();

  const [project, setProject] = useState<VideoProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Per-doc generation state, keyed by doc id (which scene is rendering right now).
  const [generatingDocId, setGeneratingDocId] = useState<string | null>(null);
  // True while the project-level "Generate all" run is walking every scene.
  const [generatingAll, setGeneratingAll] = useState(false);
  // Per-doc non-generation save (cast / mark-ready) state, keyed by doc id.
  const [savingDocId, setSavingDocId] = useState<string | null>(null);
  const [docErrors, setDocErrors] = useState<Record<string, string>>({});

  const fetchProject = useCallback(
    async (silent: boolean) => {
      if (!silent) {
        setLoading(true);
        setLoadError(null);
      }
      try {
        const res = await authFetch(`/api/video-project/${projectId}`);
        const data = (await res.json()) as GetProjectResponse;
        if (!res.ok || !data.success || !data.project) {
          throw new Error(data.error ?? 'We could not load this project. Please try again.');
        }
        setProject(data.project);
      } catch (err) {
        // A transient POLL failure must not replace the page the operator is already
        // reviewing — only surface errors on the initial full load.
        if (!silent) {
          setLoadError(
            err instanceof Error ? err.message : 'We could not load this project. Please try again.'
          );
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [authFetch, projectId]
  );

  const loadProject = useCallback(() => fetchProject(false), [fetchProject]);

  useEffect(() => {
    void loadProject();
  }, [loadProject]);

  // While the Content Manager is still building this project's docs in the background,
  // poll so each scene's doc streams onto the page the moment it finishes — no manual
  // refresh. Stops as soon as the build is complete (or errored).
  const isBuilding = project?.build?.status === 'running';
  useEffect(() => {
    if (!isBuilding) {
      return;
    }
    const interval = setInterval(() => {
      void fetchProject(true);
    }, 4000);
    return () => clearInterval(interval);
  }, [isBuilding, fetchProject]);

  const setDocError = useCallback((docId: string, message: string | null) => {
    setDocErrors((prev) => {
      const next = { ...prev };
      if (message === null) {
        delete next[docId];
      } else {
        next[docId] = message;
      }
      return next;
    });
  }, []);

  const handleGenerate = useCallback(
    async (docId: string): Promise<boolean> => {
      setGeneratingDocId(docId);
      setDocError(docId, null);
      try {
        const res = await authFetch(
          `/api/video-project/${projectId}/docs/${docId}/generate`,
          { method: 'POST' }
        );
        const data = (await res.json()) as MutateProjectResponse;
        if (!res.ok || !data.success || !data.project) {
          throw new Error(
            data.error ?? "We could not make this scene's video. Please try again."
          );
        }
        setProject(data.project);
        return true;
      } catch (err) {
        setDocError(
          docId,
          err instanceof Error
            ? err.message
            : "We could not make this scene's video. Please try again."
        );
        return false;
      } finally {
        setGeneratingDocId(null);
      }
    },
    [authFetch, projectId, setDocError]
  );

  // Generate EVERY scene's video in one commit — the costly step happens once, after the
  // operator has reviewed/graded/fixed all the shot docs (which is free). Renders each
  // scene that doesn't already have a clip, in order, stopping if one fails.
  const handleGenerateAll = useCallback(async () => {
    if (!project) {
      return;
    }
    setGeneratingAll(true);
    try {
      const pending = project.docs.filter((d) => !docHasVideo(d));
      for (const doc of pending) {
        const ok = await handleGenerate(doc.id);
        if (!ok) {
          break; // surface the per-scene error; don't keep spending on a broken run
        }
      }
    } finally {
      setGeneratingAll(false);
    }
  }, [project, handleGenerate]);

  /**
   * Persist a whole edited doc (cast change or mark-ready) via the doc PUT route.
   * Returns true on success so callers can branch (e.g. close the picker).
   */
  const saveDoc = useCallback(
    async (doc: ShotPlan, failMessage: string): Promise<boolean> => {
      setSavingDocId(doc.id);
      setDocError(doc.id, null);
      try {
        const res = await authFetch(
          `/api/video-project/${projectId}/docs/${doc.id}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(doc),
          }
        );
        const data = (await res.json()) as MutateProjectResponse;
        if (!res.ok || !data.success || !data.project) {
          throw new Error(data.error ?? failMessage);
        }
        setProject(data.project);
        return true;
      } catch (err) {
        setDocError(doc.id, err instanceof Error ? err.message : failMessage);
        return false;
      } finally {
        setSavingDocId(null);
      }
    },
    [authFetch, projectId, setDocError]
  );

  const handleToggleReady = useCallback(
    async (docId: string) => {
      if (!project) {
        return;
      }
      const doc = project.docs.find((d) => d.id === docId);
      if (!doc) {
        return;
      }
      // Toggle the doc's review flag. 'ready' = reviewed; 'draft' = back in review.
      // Leave a generating/complete doc's status alone — only review states toggle.
      const nextStatus: ShotPlan['status'] = doc.status === 'ready' ? 'draft' : 'ready';
      const nextDoc: ShotPlan = { ...doc, status: nextStatus };
      await saveDoc(nextDoc, 'We could not save that. Please try again.');
    },
    [project, saveDoc]
  );

  const handleOpenEditor = useCallback(() => {
    if (!project) {
      return;
    }
    // Record the intended hand-off (stub until the multi-doc seed lands), then
    // navigate to the existing editor.
    seedEditorFromProject(project);
    router.push('/content/video/editor');
  }, [project, router]);

  const readyToAssemble = useMemo(
    () => (project ? allDocsHaveVideo(project) : false),
    [project]
  );

  // ----- Loading / error gates -----

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading this project…
        </div>
      </div>
    );
  }

  if (loadError || !project) {
    return (
      <div className="p-8 space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.push('/content/video/projects')}>
          <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden />
          Back to projects
        </Button>
        <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{loadError ?? 'We could not find this project.'}</span>
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => void loadProject()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const projectTitle = project.title.trim() || 'Untitled project';
  // Scenes that still need a clip (the "Generate all" run targets exactly these).
  const pendingCount = project.docs.filter((d) => !docHasVideo(d)).length;
  // Which scene is rendering right now (1-based) during a Generate-all run, for progress.
  const currentSceneNumber = generatingDocId
    ? project.docs.findIndex((d) => d.id === generatingDocId) + 1
    : 0;

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/content/video/projects')}>
          <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden />
          Back to projects
        </Button>
        <div className="space-y-1">
          <PageTitle>{projectTitle}</PageTitle>
          <SectionDescription>{plainProjectStatus(project)}</SectionDescription>
        </div>
      </div>

      {/* Background-build banner — the docs stream in as each scene finishes. */}
      {project.build?.status === 'running' && (
        <div className="bg-primary/5 border border-primary/30 rounded-2xl p-5 flex items-start gap-3">
          <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-primary" aria-hidden />
          <div className="space-y-0.5">
            <CardTitle>Building your shot docs…</CardTitle>
            <SectionDescription>
              {project.build.total > 0
                ? `${project.build.phase} — ${project.build.done} of ${project.build.total} ready so far. You can start reviewing each scene as it appears below; no need to wait for all of them.`
                : `${project.build.phase} You can leave this page and come back — it keeps building.`}
            </SectionDescription>
          </div>
        </div>
      )}
      {project.build?.status === 'error' && (
        <div className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <span>{project.build.phase}</span>
        </div>
      )}

      {/* Ready-to-assemble banner + editor hand-off */}
      {readyToAssemble && (
        <div className="bg-primary/5 border border-primary/30 rounded-2xl p-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Clapperboard className="mt-0.5 h-6 w-6 shrink-0 text-primary" aria-hidden />
            <div className="space-y-0.5">
              <CardTitle>All your clips are ready</CardTitle>
              <SectionDescription>
                Open the editor to arrange your clips on the timeline and add
                transitions and music.
              </SectionDescription>
            </div>
          </div>
          <Button onClick={handleOpenEditor} className="shrink-0">
            <Clapperboard className="mr-2 h-4 w-4" aria-hidden />
            Open project in editor
          </Button>
        </div>
      )}

      {/* Ordered doc list — review/grade each scene, then ONE generate-all commit. */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle>Review your shot {project.docs.length === 1 ? 'doc' : 'docs'}</SectionTitle>
          {project.docs.length > 0 && !isBuilding && !readyToAssemble && (
            <Button onClick={() => void handleGenerateAll()} disabled={generatingAll}>
              {generatingAll ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  {currentSceneNumber > 0
                    ? `Generating scene ${currentSceneNumber} of ${project.docs.length}…`
                    : 'Generating…'}
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" aria-hidden />
                  {project.docs.length === 1
                    ? 'Generate the video'
                    : `Generate all ${pendingCount} ${pendingCount === 1 ? 'video' : 'videos'}`}
                </>
              )}
            </Button>
          )}
        </div>
        <SectionDescription>
          Review and grade each scene below. When everything looks right, generate all the
          videos in one go — that&apos;s the step that costs credits, so nothing renders until
          you say so.
        </SectionDescription>
        {project.docs.length === 0 ? (
          <div className="bg-card border border-border-strong rounded-2xl p-10 flex flex-col items-center text-center gap-3">
            <Film className="h-10 w-10 text-muted-foreground" aria-hidden />
            <div className="space-y-1">
              <CardTitle>No docs yet</CardTitle>
              <SectionDescription>
                We are still writing the docs for this project. Check back in a moment.
              </SectionDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => void loadProject()}>
              <RefreshCw className="mr-1.5 h-4 w-4" aria-hidden />
              Refresh
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {project.docs.map((doc, index) => (
              <DocCard
                key={doc.id}
                doc={doc}
                index={index}
                generating={generatingDocId === doc.id}
                saving={savingDocId === doc.id}
                error={docErrors[doc.id] ?? null}
                anyGenerating={generatingAll}
                onToggleReady={(docId) => void handleToggleReady(docId)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
