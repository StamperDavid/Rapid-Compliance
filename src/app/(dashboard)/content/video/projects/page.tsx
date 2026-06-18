'use client';

/**
 * Content → Video → Projects — the multi-document video PROJECT list.
 *
 * A VideoProject is an ordered set of Shot Docs segmented from one brief. This
 * page is the entry point of the owner-confirmed flow (Jun 17 2026):
 *   1. Operator writes a brief (+ optional title) and starts a new project. The
 *      server segments the brief into several ordered Shot Docs (LONG-RUNNING —
 *      we show a clear, plain-English working state while it runs).
 *   2. Existing projects show as cards with a plain-words status ("3 of 5 videos
 *      made", "Ready to assemble"), a thumbnail, Open, and a two-step delete.
 *   3. Opening a card goes to the project detail page where each doc's video is
 *      generated, then the whole project hands off to the editor.
 *
 * Design system mandatory: page wrapper `p-8 space-y-6`, typography components,
 * Button/Input from the library, Tailwind color tokens (never CSS vars), and a
 * two-step confirm on delete. Plain English everywhere; never fail silently.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Plus,
  Trash2,
  AlertCircle,
  FolderPlus,
  ArrowRight,
} from 'lucide-react';
import type { VideoProjectStatus } from '@/types/video-project';

// ---------------------------------------------------------------------------
// API response contracts (typed — no `any`)
// ---------------------------------------------------------------------------

/** One row in the projects list (the summary shape the list endpoint returns). */
interface ProjectSummary {
  id: string;
  title: string;
  status: VideoProjectStatus;
  docCount: number;
  docsWithVideo: number;
  finalVideoUrl?: string;
  updatedAt: string;
}

interface ListProjectsResponse {
  success: boolean;
  projects?: ProjectSummary[];
  error?: string;
}

interface CreateProjectResponse {
  success: boolean;
  project?: { id: string; title: string };
  error?: string;
}

// ---------------------------------------------------------------------------
// Plain-English status helpers
// ---------------------------------------------------------------------------

/**
 * Turns the project state into a short sentence a non-technical owner reads at a
 * glance — never raw status enums.
 */
function plainStatus(project: ProjectSummary): string {
  if (project.status === 'complete') {
    return 'Final video ready';
  }
  if (project.status === 'planning' || project.docCount === 0) {
    return 'Writing the docs…';
  }
  if (project.docsWithVideo === 0) {
    return `Ready to make videos · ${project.docCount} ${project.docCount === 1 ? 'doc' : 'docs'}`;
  }
  if (project.docsWithVideo >= project.docCount) {
    return 'Ready to assemble';
  }
  return `${project.docsWithVideo} of ${project.docCount} videos made`;
}

/** A soft status pill color, expressed only as Tailwind token classes. */
function statusPillClasses(project: ProjectSummary): string {
  if (project.status === 'complete') {
    return 'bg-primary/10 text-primary';
  }
  if (project.status === 'assembled' || project.docsWithVideo >= project.docCount) {
    return 'bg-primary/10 text-primary';
  }
  if (project.status === 'planning' || project.docCount === 0) {
    return 'bg-surface-elevated text-muted-foreground';
  }
  return 'bg-surface-elevated text-foreground';
}

// ---------------------------------------------------------------------------
// Project card
// ---------------------------------------------------------------------------

interface ProjectCardProps {
  project: ProjectSummary;
  onOpen: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
}

function ProjectCard({ project, onOpen, onDelete }: ProjectCardProps): React.JSX.Element {
  const [armed, setArmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const disarmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (disarmTimer.current) {
        clearTimeout(disarmTimer.current);
      }
    };
  }, []);

  const handleDeleteClick = useCallback(async () => {
    if (!armed) {
      // First click ARMS the delete; auto-disarm after 5s.
      setArmed(true);
      disarmTimer.current = setTimeout(() => setArmed(false), 5000);
      return;
    }
    // Second click FIRES.
    if (disarmTimer.current) {
      clearTimeout(disarmTimer.current);
    }
    setDeleting(true);
    try {
      await onDelete(project.id);
    } finally {
      setDeleting(false);
      setArmed(false);
    }
  }, [armed, onDelete, project.id]);

  const title = project.title.trim() || 'Untitled project';

  return (
    <div className="bg-card border border-border-strong rounded-2xl p-6 flex flex-col gap-4">
      {/* Thumbnail — the final video poster if exported, else a placeholder. */}
      <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-surface-elevated flex items-center justify-center">
        {project.finalVideoUrl ? (
          <video
            src={project.finalVideoUrl}
            className="w-full h-full object-cover"
            muted
            playsInline
            preload="metadata"
          />
        ) : (
          <Film className="h-10 w-10 text-muted-foreground" aria-hidden />
        )}
      </div>

      <div className="space-y-1">
        <CardTitle className="line-clamp-1">{title}</CardTitle>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusPillClasses(project)}`}
        >
          {plainStatus(project)}
        </span>
      </div>

      <div className="mt-auto flex items-center gap-2">
        <Button
          variant="default"
          size="sm"
          className="flex-1"
          onClick={() => onOpen(project.id)}
        >
          Open
          <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
        </Button>
        <Button
          variant={armed ? 'destructive' : 'outline'}
          size="sm"
          onClick={() => void handleDeleteClick()}
          disabled={deleting}
          aria-label={armed ? 'Click again to confirm delete' : 'Delete project'}
        >
          {deleting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : armed ? (
            'Click again to confirm'
          ) : (
            <Trash2 className="h-4 w-4" aria-hidden />
          )}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function VideoProjectsPage(): React.JSX.Element {
  const router = useRouter();
  const authFetch = useAuthFetch();

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // New-project form state.
  const [brief, setBrief] = useState('');
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await authFetch('/api/video-project');
      const data = (await res.json()) as ListProjectsResponse;
      if (!res.ok || !data.success || !data.projects) {
        throw new Error(data.error ?? 'We could not load your projects. Please try again.');
      }
      setProjects(data.projects);
    } catch (err) {
      setLoadError(
        err instanceof Error
          ? err.message
          : 'We could not load your projects. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const handleCreate = useCallback(async () => {
    const trimmedBrief = brief.trim();
    if (!trimmedBrief) {
      setCreateError('Please describe your video first so we know what to make.');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await authFetch('/api/video-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief: trimmedBrief,
          ...(title.trim() ? { title: title.trim() } : {}),
        }),
      });
      const data = (await res.json()) as CreateProjectResponse;
      if (!res.ok || !data.success || !data.project) {
        throw new Error(
          data.error ?? 'We could not start that project. Please try again.'
        );
      }
      // Brief is now segmented into docs — go straight into the new project.
      router.push(`/content/video/projects/${data.project.id}`);
    } catch (err) {
      setCreateError(
        err instanceof Error
          ? err.message
          : 'We could not start that project. Please try again.'
      );
      setCreating(false);
    }
  }, [authFetch, brief, title, router]);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        const res = await authFetch(`/api/video-project/${id}`, { method: 'DELETE' });
        const data = (await res.json()) as { success: boolean; error?: string };
        if (!res.ok || !data.success) {
          throw new Error(data.error ?? 'We could not delete that project.');
        }
        setProjects((prev) => prev.filter((p) => p.id !== id));
      } catch (err) {
        setLoadError(
          err instanceof Error ? err.message : 'We could not delete that project.'
        );
      }
    },
    [authFetch]
  );

  const handleOpen = useCallback(
    (id: string) => {
      router.push(`/content/video/projects/${id}`);
    },
    [router]
  );

  return (
    <div className="p-8 space-y-6">
      <div className="space-y-1">
        <PageTitle>Video projects</PageTitle>
        <SectionDescription>
          A project turns one brief into several short docs, makes a video for each,
          then stitches them into one finished film.
        </SectionDescription>
      </div>

      {/* New project */}
      <section className="bg-card border border-border-strong rounded-2xl p-6 space-y-4">
        <div className="space-y-1">
          <SectionTitle>Start a new project</SectionTitle>
          <SectionDescription>
            Describe the video you want. We will break it into a few short docs you can
            review and make one at a time.
          </SectionDescription>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Caption>Title (optional)</Caption>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Spring product launch"
              disabled={creating}
            />
          </div>

          <div className="space-y-1.5">
            <Caption>What is this video about?</Caption>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Tell us the story, the message, who it's for, and roughly how long it should be."
              disabled={creating}
              rows={5}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {createError && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{createError}</span>
            </div>
          )}

          {creating && (
            <div className="flex items-start gap-2 rounded-md bg-surface-elevated px-3 py-2 text-sm text-foreground">
              <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" aria-hidden />
              <span>
                Breaking your brief into docs… this can take a minute. Please keep this
                tab open.
              </span>
            </div>
          )}

          <Button onClick={() => void handleCreate()} disabled={creating || !brief.trim()}>
            {creating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Working…
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" aria-hidden />
                Create project
              </>
            )}
          </Button>
        </div>
      </section>

      {/* Existing projects */}
      <section className="space-y-4">
        <SectionTitle>Your projects</SectionTitle>

        {loadError && (
          <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{loadError}</span>
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => void loadProjects()}>
              Try again
            </Button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading your projects…
          </div>
        ) : projects.length === 0 && !loadError ? (
          <div className="bg-card border border-border-strong rounded-2xl p-10 flex flex-col items-center text-center gap-3">
            <FolderPlus className="h-10 w-10 text-muted-foreground" aria-hidden />
            <div className="space-y-1">
              <CardTitle>No projects yet</CardTitle>
              <SectionDescription>
                Start your first project above. We will turn your brief into a few short
                docs you can make videos from.
              </SectionDescription>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={handleOpen}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
