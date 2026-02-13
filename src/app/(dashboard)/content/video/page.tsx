'use client';

import { useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, FolderOpen } from 'lucide-react';
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
import { PIPELINE_STEPS, type PipelineStep } from '@/types/video-pipeline';

export default function VideoStudioPage() {
  const {
    currentStep,
    projectId,
    projectName,
    setStep,
    reset,
  } = useVideoPipelineStore();

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
            disabled
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
    </div>
  );
}
