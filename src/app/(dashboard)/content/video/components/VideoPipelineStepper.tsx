'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  MessageSquare,
  Layers,
  Film,
  CheckCircle,
  Zap,
  Puzzle,
  Wand2,
} from 'lucide-react';
import { PIPELINE_STEPS, PIPELINE_STEP_LABELS, type PipelineStep } from '@/types/video-pipeline';

const STEP_ICONS: Record<PipelineStep, React.ElementType> = {
  'request': MessageSquare,
  'decompose': Layers,
  'pre-production': Film,
  'approval': CheckCircle,
  'generation': Zap,
  'assembly': Puzzle,
  'post-production': Wand2,
};

interface VideoPipelineStepperProps {
  currentStep: PipelineStep;
  onStepClick: (step: PipelineStep) => void;
  completedSteps: PipelineStep[];
}

export function VideoPipelineStepper({
  currentStep,
  onStepClick,
  completedSteps,
}: VideoPipelineStepperProps) {
  const currentIndex = PIPELINE_STEPS.indexOf(currentStep);

  return (
    <div className="w-full py-4">
      <div className="flex items-center justify-between">
        {PIPELINE_STEPS.map((step, index) => {
          const Icon = STEP_ICONS[step];
          const isCompleted = completedSteps.includes(step);
          const isCurrent = step === currentStep;
          const isClickable = isCompleted || isCurrent;
          const isPast = index < currentIndex;

          return (
            <div key={step} className="flex items-center flex-1 last:flex-none">
              <button
                onClick={() => isClickable && onStepClick(step)}
                disabled={!isClickable}
                className={cn(
                  'flex flex-col items-center gap-1.5 transition-all duration-200',
                  isClickable ? 'cursor-pointer' : 'cursor-not-allowed opacity-40',
                )}
              >
                <motion.div
                  className={cn(
                    'flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors',
                    isCurrent
                      ? 'border-amber-500 bg-amber-500/10 text-amber-500'
                      : isCompleted || isPast
                        ? 'border-green-500 bg-green-500/10 text-green-500'
                        : 'border-zinc-600 bg-zinc-800/50 text-zinc-500',
                  )}
                  whileHover={isClickable ? { scale: 1.1 } : undefined}
                  whileTap={isClickable ? { scale: 0.95 } : undefined}
                >
                  {isCompleted ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </motion.div>
                <span
                  className={cn(
                    'text-xs font-medium whitespace-nowrap',
                    isCurrent
                      ? 'text-amber-400'
                      : isCompleted || isPast
                        ? 'text-green-400'
                        : 'text-zinc-500',
                  )}
                >
                  {PIPELINE_STEP_LABELS[step]}
                </span>
              </button>

              {/* Connecting line */}
              {index < PIPELINE_STEPS.length - 1 && (
                <div className="flex-1 mx-2 mt-[-18px]">
                  <div
                    className={cn(
                      'h-0.5 w-full transition-colors duration-300',
                      index < currentIndex
                        ? 'bg-green-500'
                        : index === currentIndex
                          ? 'bg-amber-500/50'
                          : 'bg-zinc-700',
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
