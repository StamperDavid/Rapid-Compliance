'use client';

/**
 * Content → Video → Projects → [projectId] — the project REVIEW page.
 *
 * This is the System B (`VideoProject`) review surface. A project's `docs` are
 * full field-addressable Shot Docs (each a `ShotPlan`). The Content Manager
 * creates a project and sends the operator here to do exactly what it told them:
 * "review the fields, cast your character, and mark each ready", then generate.
 *
 * Per doc the operator can:
 *   - SEE every field — the same image-forward production-sheet render used in the
 *     System A storyboard (reused `ShotPlanDocument`), expandable per card.
 *   - CAST a saved character onto the doc — the same `AvatarPicker` +
 *     `castMemberFromProfile` flow System A uses, persisted via the doc PUT route.
 *   - MARK the doc ready — flips the doc's `status` to `ready`, persisted the same
 *     way; a plain badge shows which docs are reviewed.
 *   - GENERATE the doc's video — wired to the existing per-doc generate route. The
 *     act of generating IS final approval; this is LONG-RUNNING so we show a clear,
 *     plain-English working state and never fail silently.
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
import Image from 'next/image';
import { useRouter, useParams } from 'next/navigation';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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
  Users,
  UserPlus,
  ChevronDown,
  ChevronUp,
  BadgeCheck,
} from 'lucide-react';
import type { ShotPlan, ShotPlanCastMember } from '@/types/shot-plan';
import {
  type VideoProject,
  docHasVideo,
  countDocsWithVideo,
  allDocsHaveVideo,
} from '@/types/video-project';
import { seedEditorFromProject } from '@/lib/video/editor-seed';
import { castMemberFromProfile } from '@/lib/video/shot-plan-blank';
import { AvatarPicker } from '../../components/AvatarPicker';
import { ShotPlanDocument } from '../../components/ShotPlanDocument';

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
// Cast picker dialog — the EXACT System A flow (AvatarPicker + castMemberFromProfile)
// ---------------------------------------------------------------------------

function CastDialog({
  open,
  onOpenChange,
  onCast,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCast: (member: ShotPlanCastMember) => void;
}): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border border-border-strong max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Users className="w-4 h-4 text-primary" /> Cast a character
          </DialogTitle>
          <DialogDescription>
            Pick one of your saved characters. They become available to every shot in
            this doc.
          </DialogDescription>
        </DialogHeader>
        <AvatarPicker
          selectedAvatarId={null}
          onSelect={() => {
            /* Full reference data comes through onProfileLoaded below. */
          }}
          onProfileLoaded={(profile) => onCast(castMemberFromProfile(profile))}
        />
      </DialogContent>
    </Dialog>
  );
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
  onGenerate: (docId: string) => void;
  onOpenCast: (docId: string) => void;
  onRemoveCast: (docId: string, characterId: string) => void;
  onToggleReady: (docId: string) => void;
}

function DocCard({
  doc,
  index,
  generating,
  saving,
  error,
  onGenerate,
  onOpenCast,
  onRemoveCast,
  onToggleReady,
}: DocCardProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const hasVideo = docHasVideo(doc);
  const ready = docIsReady(doc);
  const still = firstKeyframe(doc);
  // No engine stitch — preview the scene's first generated clip (clips are
  // assembled in the editor, not pre-merged here).
  const firstClip =
    [...doc.shots]
      .sort((a, b) => a.index - b.index)
      .find((shot) => shot.generated?.videoUrl)?.generated?.videoUrl ?? null;
  const title = doc.title.trim() || `Doc ${index + 1}`;
  const cast = doc.sharedChoices.cast;
  const busy = generating || saving;

  return (
    <div className="bg-card border border-border-strong rounded-2xl p-6 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-xs font-semibold text-foreground">
          {index + 1}
        </span>
        <CardTitle className="line-clamp-1">{title}</CardTitle>
        <div className="ml-auto flex items-center gap-1.5">
          {ready && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Ready
            </span>
          )}
          {hasVideo && (
            <CheckCircle2 className="h-5 w-5 text-primary shrink-0" aria-label="Video made" />
          )}
        </div>
      </div>

      {/* Preview: the scene's first generated clip if it has one, else its first still. */}
      <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-surface-elevated flex items-center justify-center">
        {firstClip ? (
          <video
            src={firstClip}
            poster={still ?? undefined}
            controls
            playsInline
            preload="metadata"
            className="w-full h-full object-cover"
          />
        ) : still ? (
          // Keyframe/hero URLs are external, dynamic generation output → unoptimized.
          <Image src={still} alt={`Still from ${title}`} fill unoptimized className="object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <Film className="h-10 w-10" aria-hidden />
            <Caption>Still being prepared…</Caption>
          </div>
        )}
      </div>

      <Caption>
        {doc.shots.length} {doc.shots.length === 1 ? 'shot' : 'shots'}
        {hasVideo ? ' · clips made' : ' · still preview'}
      </Caption>

      {/* Cast — assign a saved character onto this doc. */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Caption className="flex items-center gap-1.5 font-medium text-muted-foreground">
            <Users className="h-3.5 w-3.5" aria-hidden /> Cast
          </Caption>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => onOpenCast(doc.id)}
            disabled={busy}
          >
            <UserPlus className="h-3.5 w-3.5" aria-hidden /> Cast character
          </Button>
        </div>
        {cast.length === 0 ? (
          <Caption>No characters cast yet.</Caption>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {cast.map((member) => (
              <span
                key={member.characterId}
                className="inline-flex items-center gap-1 rounded-full border border-border-light bg-surface-elevated px-2.5 py-0.5 text-xs text-foreground"
              >
                {member.name}
                <button
                  type="button"
                  onClick={() => onRemoveCast(doc.id, member.characterId)}
                  disabled={busy}
                  className="text-muted-foreground transition-colors hover:text-destructive disabled:opacity-40"
                  aria-label={`Remove ${member.name} from this doc`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Expand to review every field — the production-sheet render. */}
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-center gap-1.5"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {expanded ? (
          <>
            <ChevronUp className="h-4 w-4" aria-hidden /> Hide the fields
          </>
        ) : (
          <>
            <ChevronDown className="h-4 w-4" aria-hidden /> Review the fields
          </>
        )}
      </Button>
      {expanded && (
        <div className="overflow-hidden rounded-xl border border-border-strong">
          {/* Read-only review render (the System A production sheet). Section/shot
              clicks are review-only here — deep field editing lives in the storyboard. */}
          <ShotPlanDocument
            plan={doc}
            onEdit={() => undefined}
            onEditSection={() => undefined}
          />
        </div>
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
          <span>Making this doc&apos;s video… this can take a few minutes.</span>
        </div>
      )}

      <div className="mt-auto flex items-center gap-2">
        <Button
          variant={ready ? 'default' : 'outline'}
          size="sm"
          className="gap-1.5"
          onClick={() => onToggleReady(doc.id)}
          disabled={busy}
          title={ready ? 'Mark this doc as still in review' : 'Mark this doc ready to make'}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <BadgeCheck className="h-4 w-4" aria-hidden />
          )}
          {ready ? 'Marked ready' : 'Mark ready'}
        </Button>
        <Button
          variant={hasVideo ? 'outline' : 'default'}
          size="sm"
          className="flex-1"
          onClick={() => onGenerate(doc.id)}
          disabled={busy}
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
  // Per-doc non-generation save (cast / mark-ready) state, keyed by doc id.
  const [savingDocId, setSavingDocId] = useState<string | null>(null);
  const [docErrors, setDocErrors] = useState<Record<string, string>>({});

  // The doc the cast picker is currently open for (null = closed).
  const [castDocId, setCastDocId] = useState<string | null>(null);

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
    async (docId: string) => {
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
            data.error ?? "We could not make this doc's video. Please try again."
          );
        }
        setProject(data.project);
      } catch (err) {
        setDocError(
          docId,
          err instanceof Error
            ? err.message
            : "We could not make this doc's video. Please try again."
        );
      } finally {
        setGeneratingDocId(null);
      }
    },
    [authFetch, projectId, setDocError]
  );

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

  const handleCast = useCallback(
    async (docId: string, member: ShotPlanCastMember) => {
      if (!project) {
        return;
      }
      const doc = project.docs.find((d) => d.id === docId);
      if (!doc) {
        return;
      }
      // Skip if already cast (same identity) — close the picker, no write.
      if (doc.sharedChoices.cast.some((c) => c.characterId === member.characterId)) {
        setCastDocId(null);
        return;
      }
      const nextDoc: ShotPlan = {
        ...doc,
        sharedChoices: {
          ...doc.sharedChoices,
          cast: [...doc.sharedChoices.cast, member],
        },
      };
      setCastDocId(null);
      await saveDoc(nextDoc, 'We could not add that character. Please try again.');
    },
    [project, saveDoc]
  );

  const handleRemoveCast = useCallback(
    async (docId: string, characterId: string) => {
      if (!project) {
        return;
      }
      const doc = project.docs.find((d) => d.id === docId);
      if (!doc) {
        return;
      }
      const nextDoc: ShotPlan = {
        ...doc,
        sharedChoices: {
          ...doc.sharedChoices,
          cast: doc.sharedChoices.cast.filter((c) => c.characterId !== characterId),
        },
      };
      await saveDoc(nextDoc, 'We could not remove that character. Please try again.');
    },
    [project, saveDoc]
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

      {/* Ordered doc list — review + cast + mark-ready + generate per doc */}
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
                saving={savingDocId === doc.id}
                error={docErrors[doc.id] ?? null}
                onGenerate={(docId) => void handleGenerate(docId)}
                onOpenCast={(docId) => setCastDocId(docId)}
                onRemoveCast={(docId, characterId) => void handleRemoveCast(docId, characterId)}
                onToggleReady={(docId) => void handleToggleReady(docId)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Cast picker — opens for whichever doc the operator chose. */}
      <CastDialog
        open={castDocId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCastDocId(null);
          }
        }}
        onCast={(member) => {
          if (castDocId) {
            void handleCast(castDocId, member);
          }
        }}
      />
    </div>
  );
}
