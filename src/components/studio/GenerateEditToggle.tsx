'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Sparkles, Paintbrush } from 'lucide-react';
import { motion } from 'framer-motion';
import { Switch } from '@/components/ui/switch';
import { Tooltip } from '@/components/ui/tooltip';
import type { StudioMode } from '@/types/creative-studio';

// ─── Types ─────────────────────────────────────────────────────────

interface GenerateEditToggleProps {
  mode: StudioMode;
  onModeChange: (mode: StudioMode) => void;
  narrativeAnglePrompting?: boolean;
  onNarrativeAnglePromptingChange?: (enabled: boolean) => void;
  className?: string;
}

// ─── Mode Card ─────────────────────────────────────────────────────

interface ModeCardProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  isSelected: boolean;
  onClick: () => void;
}

function ModeCard({ icon, label, description, isSelected, onClick }: ModeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex flex-1 flex-col items-center gap-3 rounded-lg border p-5 transition-all',
        'hover:border-border hover:bg-surface-elevated/50',
        isSelected
          ? 'border-primary bg-primary/10 ring-1 ring-primary/50'
          : 'border-border-strong bg-card',
      )}
    >
      {isSelected && (
        <motion.div
          layoutId="generate-edit-indicator"
          className="absolute inset-0 rounded-lg border-2 border-primary"
          transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
        />
      )}
      <div
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-full',
          isSelected ? 'bg-primary/20 text-primary-light' : 'bg-surface-elevated text-muted-foreground',
        )}
      >
        {icon}
      </div>
      <div className="text-center">
        <p
          className={cn(
            'text-sm font-semibold',
            isSelected ? 'text-white' : 'text-foreground',
          )}
        >
          {label}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}

// ─── Main Component ────────────────────────────────────────────────

export function GenerateEditToggle({
  mode,
  onModeChange,
  narrativeAnglePrompting,
  onNarrativeAnglePromptingChange,
  className,
}: GenerateEditToggleProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Mode cards */}
      <div className="flex gap-3">
        <ModeCard
          icon={<Sparkles className="h-6 w-6" />}
          label="Generate"
          description="Create new content from prompt + reference"
          isSelected={mode === 'generate'}
          onClick={() => onModeChange('generate')}
        />
        <ModeCard
          icon={<Paintbrush className="h-6 w-6" />}
          label="Edit"
          description="Modify specific areas of an existing image"
          isSelected={mode === 'edit'}
          onClick={() => onModeChange('edit')}
        />
      </div>

      {/* Narrative Angle Prompting toggle */}
      {onNarrativeAnglePromptingChange && (
        <div className="flex items-center justify-between rounded-lg border border-border-strong bg-card px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              Narrative Angle Prompting
            </span>
            <Tooltip content="When enabled, the AI interprets your prompt as a story beat and automatically selects the best camera angles, lighting, and composition to convey the narrative emotion." />
          </div>
          <Switch
            checked={narrativeAnglePrompting ?? false}
            onCheckedChange={onNarrativeAnglePromptingChange}
            label="Toggle narrative angle prompting"
          />
        </div>
      )}
    </div>
  );
}

GenerateEditToggle.displayName = 'GenerateEditToggle';
