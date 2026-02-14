'use client';

import { useCallback, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, FolderOpen, Loader2, Clock, Film, X, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { VideoPipelineStepper } from './components/VideoPipelineStepper';
import { StepRequest } from './components/StepRequest';
import { StepDecompose } from './components/StepDecompose';
import { StepPreProduction } from './components/StepPreProduction';
import { StepApproval } from './components/StepApproval';
import { StepGeneration } from './components/StepGeneration';
import { StepAssembly } from './components/StepAssembly';
import { StepPostProduction } from './components/StepPostProduction';
import { useVideoPipelineStore } from '@/lib/stores/video-pipeline-store';
import { PIPELINE_STEPS, type PipelineStep, type PipelineProject } from '@/types/video-pipeline';

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

export default function VideoStudioPage() {
  const {
    currentStep,
    projectId,
    projectName,
    setStep,
    reset,
    loadProject,
  } = useVideoPipelineStore();

  const [showLoadModal, setShowLoadModal] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loadingProjectId, setLoadingProjectId] = useState<string | null>(null);

  const completedSteps = useMemo(() => {
    const currentIndex = PIPELINE_STEPS.indexOf(currentStep);
    return PIPELINE_STEPS.slice(0, currentIndex);
  }, [currentStep]);

  const handleStepClick = useCallback(
    (step: PipelineStep) => {
      const targetIndex = PIPELINE_STEPS.indexOf(step);
      const currentIndex = PIPELINE_STEPS.indexOf(currentStep);
      if (targetIndex <= currentIndex) {
        setStep(step);
      }
    },
    [currentStep, setStep],
  );

  const handleNewProject = useCallback(() => {
    reset();
  }, [reset]);

  const handleOpenLoadModal = useCallback(async () => {
    setShowLoadModal(true);
    setLoadingProjects(true);
    try {
      const response = await fetch('/api/video/project/list');
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
  }, []);

  const handleLoadProject = useCallback(async (id: string) => {
    setLoadingProjectId(id);
    try {
      const response = await fetch(`/api/video/project/${id}`);
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
  }, [loadProject]);

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'request':
        return <StepRequest />;
      case 'decompose':
        return <StepDecompose />;
      case 'pre-production':
        return <StepPreProduction />;
      case 'approval':
        return <StepApproval />;
      case 'generation':
        return <StepGeneration />;
      case 'assembly':
        return <StepAssembly />;
      case 'post-production':
        return <StepPostProduction />;
      default:
        return <StepRequest />;
    }
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            AI Video Studio
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            {projectId
              ? `Project: ${projectName || 'Untitled'}`
              : '7-step video production pipeline powered by HeyGen'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleNewProject}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            New Project
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => { void handleOpenLoadModal(); }}
          >
            <FolderOpen className="w-4 h-4" />
            Load Project
          </Button>
        </div>
      </div>

      {/* Stepper */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="pt-4 pb-2">
          <VideoPipelineStepper
            currentStep={currentStep}
            onStepClick={handleStepClick}
            completedSteps={completedSteps}
          />
        </CardContent>
      </Card>

      {/* Current Step Panel */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
        >
          {renderCurrentStep()}
        </motion.div>
      </AnimatePresence>

      {/* Load Project Modal */}
      {showLoadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg mx-4 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-amber-500" />
                Load Project
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowLoadModal(false)}
                className="h-8 w-8 p-0 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {loadingProjects ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                  <span className="ml-2 text-zinc-400">Loading projects...</span>
                </div>
              ) : projects.length === 0 ? (
                <div className="text-center py-12">
                  <Video className="w-10 h-10 mx-auto text-zinc-600 mb-3" />
                  <p className="text-zinc-400">No saved projects yet.</p>
                  <p className="text-sm text-zinc-600 mt-1">
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
                      className="w-full text-left p-3 rounded-lg border border-zinc-800 hover:border-amber-500/50 hover:bg-zinc-800/50 transition-colors group disabled:opacity-50"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-medium text-white truncate group-hover:text-amber-400 transition-colors">
                            {project.name}
                          </h3>
                          <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                            <span className="flex items-center gap-1">
                              <Film className="w-3 h-3" />
                              {project.sceneCount} scene{project.sceneCount !== 1 ? 's' : ''}
                            </span>
                            <span className={
                              project.status === 'completed' ? 'text-green-400' :
                              project.status === 'generating' ? 'text-amber-400' :
                              'text-zinc-500'
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
                          <Loader2 className="w-4 h-4 animate-spin text-amber-500 flex-shrink-0 ml-2" />
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
