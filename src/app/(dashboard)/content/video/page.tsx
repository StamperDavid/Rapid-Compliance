'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import SubpageNav from '@/components/ui/SubpageNav';
import { CONTENT_GENERATOR_TABS } from '@/lib/constants/subpage-nav';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, FolderOpen, Loader2, Clock, Film, X, Video, LayoutTemplate, Trash2, Check, CloudOff, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVideoProjectAutoSave } from '@/hooks/useVideoProjectAutoSave';
import { StepStoryboard } from './components/StepStoryboard';
import { TemplatePickerModal } from './components/TemplatePickerModal';
import { useVideoPipelineStore } from '@/lib/stores/video-pipeline-store';
import type { PipelineProject } from '@/types/video-pipeline';
import type { VideoTemplate } from '@/lib/video/templates';

// ─── Types ────────────────────────────────────────────────────────────

/**
 * One row in the UNIFIED project list. `system` records which store the project
 * lives in so a click opens the correct surface:
 *   • 'studio'  → classic pipeline project → loads into THIS Studio editor
 *   • 'project' → shot-doc VideoProject    → opens the project review page
 * Both stores are merged into ONE list so the operator never has to know which is
 * which, or hunt for their work in a second place.
 */
interface ProjectSummary {
  id: string;
  name: string;
  system: 'studio' | 'project';
  type?: string;
  currentStep?: string;
  status: string;
  sceneCount: number;
  hasVideo: boolean;
  createdAt?: string;
  updatedAt: string;
  createdByName?: string | null;
}

// ─── Page ─────────────────────────────────────────────────────────────

export default function VideoStudioPage() {
  const authFetch = useAuthFetch();
  const {
    currentStep,
    projectId,
    projectName,
    setStep,
    reset,
    loadProject,
    loadTemplate,
  } = useVideoPipelineStore();

  const searchParams = useSearchParams();
  const router = useRouter();

  // Auto-save: persists the project to Firestore (debounced) whenever it has
  // real content, so work is never lost and is always recallable.
  const { saveStatus } = useVideoProjectAutoSave();
  // While a server-side shot-doc build runs the client autosave is paused (the
  // server owns the doc), so saveStatus stays 'idle' — surface the build + the
  // persisted state so the operator always sees where their work stands.
  const shotPlan = useVideoPipelineStore((s) => s.shotPlan);
  const shotPlanBuildStatus = useVideoPipelineStore((s) => s.shotPlanBuildStatus);

  const [showLoadModal, setShowLoadModal] = useState(false);
  // Scrap-the-current-project (two-step) on the shot-doc screen itself.
  const [confirmScrap, setConfirmScrap] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loadingProjectId, setLoadingProjectId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [autoLoading, setAutoLoading] = useState(false);

  const handleNewProject = useCallback(() => {
    reset();
  }, [reset]);

  const handleTemplateSelect = useCallback(
    (template: VideoTemplate) => {
      loadTemplate(template);
      setShowTemplates(false);
    },
    [loadTemplate],
  );

  const handleOpenLoadModal = useCallback(async () => {
    setShowLoadModal(true);
    setLoadingProjects(true);
    try {
      // ONE list of ALL the operator's projects, pulled from BOTH stores: the classic
      // Studio pipeline AND the shot-doc VideoProjects. These used to be two separate
      // lists, which is exactly why rendered projects seemed to vanish — the operator
      // looked here and their work was in the other one.
      const [studioRes, docRes] = await Promise.all([
        authFetch('/api/video/project/list').catch(() => null),
        authFetch('/api/video-project').catch(() => null),
      ]);

      const merged: ProjectSummary[] = [];

      if (studioRes?.ok) {
        const data = (await studioRes.json()) as {
          success: boolean;
          projects?: Array<{
            id: string; name: string; status: string; sceneCount: number;
            hasVideo: boolean; type?: string; currentStep?: string; updatedAt: string;
          }>;
        };
        if (data.success && data.projects) {
          for (const p of data.projects) {
            merged.push({ ...p, system: 'studio' });
          }
        }
      }

      if (docRes?.ok) {
        const data = (await docRes.json()) as {
          success: boolean;
          projects?: Array<{
            id: string; title: string; status: string; docCount: number;
            docsWithVideo: number; createdBy?: { name: string } | null; updatedAt: string;
          }>;
        };
        if (data.success && data.projects) {
          for (const p of data.projects) {
            merged.push({
              id: p.id,
              name: p.title,
              system: 'project',
              status: p.status,
              sceneCount: p.docCount,
              hasVideo: p.docsWithVideo > 0,
              updatedAt: p.updatedAt,
              createdByName: p.createdBy?.name ?? null,
            });
          }
        }
      }

      // Newest first across both stores.
      merged.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
      setProjects(merged);
    } catch {
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  }, [authFetch]);

  const handleLoadProject = useCallback(async (id: string) => {
    setLoadingProjectId(id);
    try {
      const response = await authFetch(`/api/video/project/${id}`);
      if (!response.ok) {
        throw new Error('Failed to load project');
      }
      const data = await response.json() as { success: boolean; project: PipelineProject };
      if (data.success && data.project) {
        loadProject(data.project);
        setShowLoadModal(false);
      }
    } catch {
      // Load error — button returns to default state
    } finally {
      setLoadingProjectId(null);
    }
  }, [loadProject, authFetch]);

  // Open whichever project the operator clicked, sending it to the RIGHT surface:
  // a shot-doc VideoProject opens its review page; a classic studio project loads
  // into this editor. One list, two correct destinations — no wrong-place dead ends.
  const handleOpenProject = useCallback(
    (proj: ProjectSummary) => {
      if (proj.system === 'project') {
        setShowLoadModal(false);
        router.push(`/content/video/projects/${proj.id}`);
        return;
      }
      void handleLoadProject(proj.id);
    },
    [router, handleLoadProject],
  );

  // Delete a saved project (two-step confirm via confirmDeleteId). Routes to the
  // correct store's delete endpoint based on which system the project lives in.
  const handleDeleteProject = useCallback(async (id: string, system: 'studio' | 'project') => {
    setConfirmDeleteId(null);
    setDeletingProjectId(id);
    try {
      const endpoint =
        system === 'project' ? `/api/video-project/${id}` : `/api/video/project/${id}`;
      const response = await authFetch(endpoint, { method: 'DELETE' });
      if (response.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== id));
        // If the project being deleted is the one currently loaded in the store,
        // clear it — otherwise auto-save keeps POSTing to the now-deleted doc (500s)
        // and the editor keeps GETting it (404s) forever.
        if (id === projectId) {
          reset();
        }
      }
    } catch {
      // ignore — row stays
    } finally {
      setDeletingProjectId(null);
    }
  }, [authFetch, projectId, reset]);

  // Auto-load project from ?load={projectId} URL parameter
  useEffect(() => {
    const loadId = searchParams.get('load');
    if (loadId && loadId !== projectId) {
      setAutoLoading(true);
      void handleLoadProject(loadId).finally(() => setAutoLoading(false));
    }
  }, [searchParams, handleLoadProject, projectId]);

  // Pre-fill brief from ?brief=...&batchWeekId=...&batchIndex=... (Content Calendar integration)
  const setBrief = useVideoPipelineStore((s) => s.setBrief);
  useEffect(() => {
    const briefParam = searchParams.get('brief');
    const batchWeekId = searchParams.get('batchWeekId');
    const batchIndex = searchParams.get('batchIndex');
    if (briefParam && !projectId) {
      reset();
      setBrief({ description: briefParam });
      // Store batch link info in sessionStorage so save can link back
      if (batchWeekId && batchIndex) {
        sessionStorage.setItem('batch_link', JSON.stringify({ weekId: batchWeekId, index: Number(batchIndex) }));
      }
    }
  }, [searchParams, projectId, reset, setBrief]);

  // NOTE: Focus handler removed — it was reloading the project from Firestore
  // on every tab focus, which clobbered in-session navigation state (currentStep,
  // generatedScenes). In a single-user workflow, the Zustand store + localStorage
  // persistence is the source of truth. Full reload or Load Project modal can be
  // used to re-fetch from Firestore when needed.

  // Normalize any persisted legacy 'request'/Studio step onto the storyboard
  // so the stepper highlights the right step after the Studio opening's removal.
  useEffect(() => {
    if (currentStep === 'request') {
      setStep('storyboard');
    }
  }, [currentStep, setStep]);

  // The Storyboard creator is the entry screen. The legacy 'request'/Studio
  // opening is retired — it maps to the storyboard like the other legacy steps.
  // The Shot Plan is the sole video-creation surface; it renders the clips on
  // fal / Seedance and hands off to the editor. There are no other wizard steps.
  const renderCurrentStep = () => <StepStoryboard />;

  // What the save indicator shows. A server build pauses client autosave, so map
  // through: building → saving → error → saved (explicit), and finally treat any
  // persisted project (has an id + content) as "Saved" when otherwise idle.
  const hasPersistableContent = Boolean(shotPlan) || Boolean(projectId);
  const displayStatus: 'idle' | 'building' | 'saving' | 'saved' | 'error' =
    shotPlanBuildStatus === 'generating'
      ? 'building'
      : saveStatus === 'saving'
        ? 'saving'
        : saveStatus === 'error'
          ? 'error'
          : saveStatus === 'saved'
            ? 'saved'
            : projectId && hasPersistableContent
              ? 'saved'
              : 'idle';

  return (
    <div className="bg-background">
      {/* ── Top Navigation ──────────────────────────────────────── */}
      <div className="sticky top-0 z-40 border-b border-border-strong bg-background/95 backdrop-blur-sm">
        <div className="px-6 pt-4 pb-0">
          <SubpageNav items={CONTENT_GENERATOR_TABS} />
        </div>

        {/* ── Header + Project Controls ────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-3">
          <div>
            <h1 className="text-xl font-bold text-white">
              AI Video <span className="text-primary">Studio</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {projectId
                ? `Project: ${projectName || 'Untitled'}`
                : 'Cinematic video production powered by AI'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Auto-save indicator — shows the build, the live save, and (when idle
                with a persisted project) a steady "Saved" so the operator always
                knows their shot doc is kept. */}
            {displayStatus !== 'idle' && (
              <span
                className={`flex items-center gap-1.5 text-xs mr-1 ${
                  displayStatus === 'error' ? 'text-destructive' : 'text-muted-foreground'
                }`}
                aria-live="polite"
                title="Your project auto-saves. Reopen it any time from Load Project."
              >
                {displayStatus === 'building' && (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Building &amp; saving…
                  </>
                )}
                {displayStatus === 'saving' && (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving…
                  </>
                )}
                {displayStatus === 'saved' && (
                  <>
                    <Check className="w-3.5 h-3.5 text-green-400" />
                    Saved
                  </>
                )}
                {displayStatus === 'error' && (
                  <>
                    <CloudOff className="w-3.5 h-3.5" />
                    Save failed
                  </>
                )}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/content/video/projects')}
              className="gap-2 border-border-strong"
              title="Multi-scene projects — generate a whole film as several shot docs, then stitch"
            >
              <Layers className="w-4 h-4" />
              Projects
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNewProject}
              className="gap-2 border-border-strong"
            >
              <Plus className="w-4 h-4" />
              New Project
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTemplates(true)}
              className="gap-2 border-border-strong"
            >
              <LayoutTemplate className="w-4 h-4" />
              Templates
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-border-strong"
              onClick={() => { void handleOpenLoadModal(); }}
            >
              <FolderOpen className="w-4 h-4" />
              Load Project
            </Button>

            {/* Scrap the CURRENT project (two-step). Deletes the saved doc, so it
                also disappears from Load Project, and resets the editor. */}
            {projectId && (
              deletingProjectId === projectId ? (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Scrapping…
                </span>
              ) : confirmScrap ? (
                <span className="flex items-center gap-1">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => { setConfirmScrap(false); void handleDeleteProject(projectId, 'studio'); }}
                  >
                    <Trash2 className="w-4 h-4" />
                    Confirm scrap
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => setConfirmScrap(false)}
                  >
                    Cancel
                  </Button>
                </span>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-border-strong text-muted-foreground hover:text-destructive"
                  onClick={() => setConfirmScrap(true)}
                  title="Scrap this project — deletes it and removes it from Load Project"
                >
                  <Trash2 className="w-4 h-4" />
                  Scrap
                </Button>
              )
            )}
          </div>
        </div>

      </div>

      {/* ── Main Content ────────────────────────────────────────── */}
      {autoLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Loading project...</span>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            <div className="p-6 space-y-6">
              {renderCurrentStep()}
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* ── Template Picker Modal ─────────────────────────────── */}
      <TemplatePickerModal
        isOpen={showTemplates}
        onClose={() => setShowTemplates(false)}
        onSelect={handleTemplateSelect}
      />

      {/* ── Load Project Modal ────────────────────────────────── */}
      {showLoadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border-strong rounded-xl w-full max-w-lg mx-4 shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-border-strong">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-primary" />
                Load Project
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowLoadModal(false)}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-white"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {loadingProjects ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="ml-2 text-muted-foreground">Loading projects...</span>
                </div>
              ) : projects.length === 0 ? (
                <div className="text-center py-12">
                  <Video className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No saved projects yet.</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Create a video and save it to see it here.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {projects.map((project) => (
                    <div
                      key={`${project.system}-${project.id}`}
                      className="w-full p-3 rounded-lg border border-border-strong hover:border-primary/50 hover:bg-surface-elevated/50 transition-colors group flex items-start justify-between gap-2"
                    >
                      <button
                        onClick={() => handleOpenProject(project)}
                        disabled={loadingProjectId === project.id}
                        className="flex-1 text-left min-w-0 disabled:opacity-50"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <h3 className="text-sm font-medium text-white truncate group-hover:text-primary-light transition-colors">
                            {project.name}
                          </h3>
                          {project.system === 'project' && (
                            <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary-light">
                              Shot doc
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Film className="w-3 h-3" />
                            {project.sceneCount} scene{project.sceneCount !== 1 ? 's' : ''}
                          </span>
                          {project.createdByName && (
                            <span className="truncate">by {project.createdByName}</span>
                          )}
                          <span className={
                            project.status === 'completed' ? 'text-green-400' :
                            project.status === 'generating' ? 'text-primary-light' :
                            'text-muted-foreground'
                          }>
                            {project.status}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(project.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </button>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {loadingProjectId === project.id || deletingProjectId === project.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        ) : confirmDeleteId === project.id ? (
                          <>
                            <button
                              onClick={() => { void handleDeleteProject(project.id, project.system); }}
                              className="px-2 py-1 rounded text-xs bg-destructive text-white"
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(project.id)}
                            title="Delete project"
                            className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
