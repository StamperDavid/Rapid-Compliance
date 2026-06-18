'use client';

/**
 * Content → Video → Projects → [projectId] — the project detail page.
 *
 * This is steps 2-4 of the owner-confirmed flow (Jun 17 2026):
 *   - Step 2: show every Shot Doc in order as a card with a still/preview.
 *   - Step 3: "Generate video" on a doc renders THAT doc's video (the act of
 *     generating IS the approval). Generating is LONG-RUNNING — we show a clear,
 *     plain-English working state and never fail silently. A doc that already has
 *     a video shows a small player + "Regenerate".
 *   - Step 4: once EVERY doc has a video, a prominent "Open project in editor"
 *     button appears so the doc-videos can be stitched into the final film.
 *
 * Editing a doc is NOT built here — each card links to the existing doc editor.
 *
 * Design system mandatory: page wrapper `p-8 space-y-6`, typography components,
 * Button from the library, Tailwind color tokens (never CSS vars), responsive
 * grid for the doc list. Plain English throughout.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
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
  Pencil,
  RefreshCw,
  Wand2,
  CheckCircle2,
} from 'lucide-react';
import type { ShotPlan } from '@/types/shot-plan';
import {
  type VideoProject,
  docHasVideo,
  countDocsWithVideo,
  allDocsHaveVideo,
} from '@/types/video-project';
import { seedEditorFromProject } from '@/lib/video/editor-seed';

// ---------------------------------------------------------------------------
// API response contracts (typed — no `any`)
// ---------------------------------------------------------------------------

interface GetProjectResponse {
  success: boolean;
  project?: VideoProject;
  error?: string;
}

interface GenerateDocResponse {
  success: boolean;
  project?: VideoProject;
  error?: string;
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Plain-English project status
// ---------------------------------------------------------------------------

function plainProjectStatus(project: VideoProject): string {
  if (project.status === 'complete') {
    return 'Final video is ready.';
  }
  if (project.docs.length === 0) {
    return 'We are still writing the docs for this project.';
  }
  const made = countDocsWithVideo(project);
  if (made === 0) {
    return `${project.docs.length} ${project.docs.length === 1 ? 'doc is' : 'docs are'} ready. Make a video for each one to continue.`;
  }
  if (made >= project.docs.length) {
    return 'Every doc has a video. You can stitch them together in the editor.';
  }
  return `${made} of ${project.docs.length} videos made. Keep going to finish the project.`;
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

// ---------------------------------------------------------------------------
// Doc card
// ---------------------------------------------------------------------------

interface DocCardProps {
  doc: ShotPlan;
  index: number;
  generating: boolean;
  error: string | null;
  onGenerate: (docId: string) => void;
  onEdit: (docId: string) => void;
}

function DocCard({
  doc,
  index,
  generating,
  error,
  onGenerate,
  onEdit,
}: DocCardProps): React.JSX.Element {
  const hasVideo = docHasVideo(doc);
  const still = firstKeyframe(doc);
  const title = doc.title.trim() || `Doc ${index + 1}`;

  return (
    <div className="bg-card border border-border-strong rounded-2xl p-6 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-xs font-semibold text-foreground">
          {index + 1}
        </span>
        <CardTitle className="line-clamp-1">{title}</CardTitle>
        {hasVideo && (
          <CheckCircle2 className="ml-auto h-5 w-5 text-primary shrink-0" aria-label="Video made" />
        )}
      </div>

      {/* Preview: the doc's own video if it has one, else its first still. */}
      <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-surface-elevated flex items-center justify-center">
        {hasVideo && doc.finalVideoUrl ? (
          <video
            src={doc.finalVideoUrl}
            poster={still}
            controls
            playsInline
            preload="metadata"
            className="w-full h-full object-cover"
          />
        ) : still ? (
          // Keyframe/hero URLs are external, dynamic generation output → unoptimized.
          <Image src={still} alt={`Still from ${title}`} fill unoptimized className="object-cover" />
        ) : (
          <Film className="h-10 w-10 text-muted-foreground" aria-hidden />
        )}
      </div>

      <Caption>
        {doc.shots.length} {doc.shots.length === 1 ? 'shot' : 'shots'}
        {hasVideo ? ' · video made' : ' · still preview'}
      </Caption>

      {error && (
        <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      {generating && (
        <div className="flex items-start gap-2 rounded-md bg-surface-elevated px-3 py-2 text-sm text-foreground">
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" aria-hidden />
          <span>Making this doc&apos;s video… this can take a few minutes.</span>
        </div>
      )}

      <div className="mt-auto flex items-center gap-2">
        <Button
          variant={hasVideo ? 'outline' : 'default'}
          size="sm"
          className="flex-1"
          onClick={() => onGenerate(doc.id)}
          disabled={generating}
        >
          {generating ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
              Working…
            </>
          ) : hasVideo ? (
            <>
              <RefreshCw className="mr-1.5 h-4 w-4" aria-hidden />
              Regenerate
            </>
          ) : (
            <>
              <Wand2 className="mr-1.5 h-4 w-4" aria-hidden />
              Generate video
            </>
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(doc.id)}
          disabled={generating}
          aria-label="Edit this doc"
        >
          <Pencil className="h-4 w-4" aria-hidden />
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

  // Per-doc generation state, keyed by doc id.
  const [generatingDocId, setGeneratingDocId] = useState<string | null>(null);
  const [docErrors, setDocErrors] = useState<Record<string, string>>({});

  const loadProject = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await authFetch(`/api/video-project/${projectId}`);
      const data = (await res.json()) as GetProjectResponse;
      if (!res.ok || !data.success || !data.project) {
        throw new Error(data.error ?? 'We could not load this project. Please try again.');
      }
      setProject(data.project);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'We could not load this project. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, [authFetch, projectId]);

  useEffect(() => {
    void loadProject();
  }, [loadProject]);

  const handleGenerate = useCallback(
    async (docId: string) => {
      setGeneratingDocId(docId);
      setDocErrors((prev) => {
        const next = { ...prev };
        delete next[docId];
        return next;
      });
      try {
        const res = await authFetch(
          `/api/video-project/${projectId}/docs/${docId}/generate`,
          { method: 'POST' }
        );
        const data = (await res.json()) as GenerateDocResponse;
        if (!res.ok || !data.success || !data.project) {
          throw new Error(
            data.error ?? "We could not make this doc's video. Please try again."
          );
        }
        setProject(data.project);
      } catch (err) {
        setDocErrors((prev) => ({
          ...prev,
          [docId]:
            err instanceof Error
              ? err.message
              : "We could not make this doc's video. Please try again.",
        }));
      } finally {
        setGeneratingDocId(null);
      }
    },
    [authFetch, projectId]
  );

  const handleEdit = useCallback(
    (docId: string) => {
      // The doc editor is an existing workstream — link out to it, don't rebuild.
      router.push(`/content/video/projects/${projectId}/docs/${docId}`);
    },
    [router, projectId]
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

      {/* Ready-to-assemble banner + editor hand-off (step 4) */}
      {readyToAssemble && (
        <div className="bg-primary/5 border border-primary/30 rounded-2xl p-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Clapperboard className="mt-0.5 h-6 w-6 shrink-0 text-primary" aria-hidden />
            <div className="space-y-0.5">
              <CardTitle>Every doc has a video</CardTitle>
              <SectionDescription>
                Open the project in the editor to stitch the videos together with
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

      {/* Ordered doc list (step 2 + step 3) */}
      <section className="space-y-4">
        <SectionTitle>Docs in this project</SectionTitle>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {project.docs.map((doc, index) => (
              <DocCard
                key={doc.id}
                doc={doc}
                index={index}
                generating={generatingDocId === doc.id}
                error={docErrors[doc.id] ?? null}
                onGenerate={(docId) => void handleGenerate(docId)}
                onEdit={handleEdit}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
