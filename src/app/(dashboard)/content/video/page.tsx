'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import SubpageNav from '@/components/ui/SubpageNav';
import { CONTENT_GENERATOR_TABS } from '@/lib/constants/subpage-nav';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, FolderOpen, Loader2, Clock, Film, X, Video, LayoutTemplate } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VideoPipelineStepper } from './components/VideoPipelineStepper';
import { StepStoryboard } from './components/StepStoryboard';
import { StepGeneration } from './components/StepGeneration';
import { StepAssembly } from './components/StepAssembly';
import { StepPostProduction } from './components/StepPostProduction';
import { StepPublish } from './components/StepPublish';
import { TemplatePickerModal } from './components/TemplatePickerModal';
import { useVideoPipelineStore } from '@/lib/stores/video-pipeline-store';
import { PIPELINE_STEPS, type PipelineStep, type PipelineProject } from '@/types/video-pipeline';
import type { VideoTemplate } from '@/lib/video/templates';

// ─── Types ────────────────────────────────────────────────────────────

interface ProjectSummary {
  id: string;
  name: string;
  type: string;
  currentStep: string;
  status: string;
  sceneCount: number;
  hasVideo: boolean;
  createdAt: string;
  updatedAt: string;
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

  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loadingProjectId, setLoadingProjectId] = useState<string | null>(null);
  const [autoLoading, setAutoLoading] = useState(false);

  // Subscribe to the reactive data that canAdvanceTo depends on
  const scenes = useVideoPipelineStore((s) => s.scenes);
  const generatedScenes = useVideoPipelineStore((s) => s.generatedScenes);
  const finalVideoUrl = useVideoPipelineStore((s) => s.finalVideoUrl);
  const postProductionVideoUrl = useVideoPipelineStore((s) => s.postProductionVideoUrl);

  // Compute which steps are reachable based on actual store data
  const reachableSteps = useMemo(() => {
    const reachable: PipelineStep[] = [];
    // Storyboard is manual-first — always reachable so you can build scenes
    // directly without going through the Studio/brief funnel first.
    reachable.push('storyboard');
    if (scenes.length > 0 && scenes.every((s) => s.scriptText.trim().length > 0)) {
      reachable.push('generation');
    }
    if (
      generatedScenes.length > 0 &&
      generatedScenes.every((s) => s.status === 'completed' || s.status === 'failed') &&
      generatedScenes.some((s) => s.status === 'completed' && s.videoUrl)
    ) {
      reachable.push('assembly');
    }
    if (finalVideoUrl) {
      reachable.push('post-production');
    }
    if (postProductionVideoUrl || finalVideoUrl) {
      reachable.push('publish');
    }
    return reachable;
  }, [scenes, generatedScenes, finalVideoUrl, postProductionVideoUrl]);

  const completedSteps = useMemo(() => {
    // Steps before current are completed, plus all steps before any reachable step
    const completed = new Set<PipelineStep>();
    const currentIndex = PIPELINE_STEPS.indexOf(currentStep);
    for (let i = 0; i < currentIndex; i++) {
      completed.add(PIPELINE_STEPS[i]);
    }
    for (const step of reachableSteps) {
      const stepIndex = PIPELINE_STEPS.indexOf(step);
      for (let i = 0; i < stepIndex; i++) {
        completed.add(PIPELINE_STEPS[i]);
      }
    }
    return [...completed];
  }, [currentStep, reachableSteps]);

  const handleStepClick = useCallback(
    (step: PipelineStep) => {
      const targetIndex = PIPELINE_STEPS.indexOf(step);
      const currentIndex = PIPELINE_STEPS.indexOf(currentStep);
      if (targetIndex <= currentIndex || reachableSteps.includes(step)) {
        setStep(step);
      }
    },
    [currentStep, setStep, reachableSteps],
  );

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
      const response = await authFetch('/api/video/project/list');
      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }
      const data = await response.json() as { success: boolean; projects: ProjectSummary[] };
      if (data.success) {
        setProjects(data.projects);
      }
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
  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'generation':
        return <StepGeneration />;
      case 'assembly':
        return <StepAssembly />;
      case 'post-production':
        return <StepPostProduction />;
      case 'publish':
        return <StepPublish />;
      case 'request':
      case 'storyboard':
      case 'decompose':
      case 'pre-production':
      case 'approval':
      default:
        return <StepStoryboard />;
    }
  };

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
          </div>
        </div>

        {/* ── Pipeline Stepper (always visible) ────────────────── */}
        <div className="px-6 pb-2">
          <VideoPipelineStepper
            currentStep={currentStep}
            onStepClick={handleStepClick}
            completedSteps={completedSteps}
            reachableSteps={reachableSteps}
          />
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
                    <button
                      key={project.id}
                      onClick={() => { void handleLoadProject(project.id); }}
                      disabled={loadingProjectId === project.id}
                      className="w-full text-left p-3 rounded-lg border border-border-strong hover:border-primary/50 hover:bg-surface-elevated/50 transition-colors group disabled:opacity-50"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-medium text-white truncate group-hover:text-primary-light transition-colors">
                            {project.name}
                          </h3>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Film className="w-3 h-3" />
                              {project.sceneCount} scene{project.sceneCount !== 1 ? 's' : ''}
                            </span>
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
                        </div>
                        {loadingProjectId === project.id && (
                          <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0 ml-2" />
                        )}
                      </div>
                    </button>
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
