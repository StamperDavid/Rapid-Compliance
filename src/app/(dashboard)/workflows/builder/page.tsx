'use client';

import { PLATFORM_ID } from '@/lib/constants/platform';

/**
 * Visual Workflow Builder Page
 *
 * A premium SaaS-style visual workflow editor featuring:
 * - Step-by-step visual editor (simpler than node-based for v1)
 * - Left panel: Trigger/Action palette (clickable cards)
 * - Center: Workflow steps displayed as connected cards
 * - Right panel: Properties panel for selected step
 *
 * Design: Dark theme with glassmorphism and indigo accents
 */

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FirestoreService } from '@/lib/db/firestore-service';
import { Timestamp } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';

import WorkflowStepCard, { type WorkflowStep } from '@/components/workflow/WorkflowStepCard';
import WorkflowPalette, { type PaletteItem } from '@/components/workflow/WorkflowPalette';
import WorkflowPropertiesPanel from '@/components/workflow/WorkflowPropertiesPanel';

interface WorkflowData {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  status: 'draft' | 'active' | 'paused' | 'archived';
}

export default function WorkflowBuilderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { user } = useAuth();
  const workflowId = searchParams.get('id');

  // Workflow state
  const [workflow, setWorkflow] = useState<WorkflowData>({
    id: '',
    name: '',
    description: '',
    steps: [],
    status: 'draft',
  });

  // UI state
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!!workflowId);
  const [isSaving, setIsSaving] = useState(false);
  const [showPalette, setShowPalette] = useState(true);
  const [showProperties, setShowProperties] = useState(true);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const loadWorkflow = useCallback(async (id: string) => {
    try {
      setIsLoading(true);
      const data = await FirestoreService.get(
        `organizations/${PLATFORM_ID}/workspaces/default/workflows`,
        id
      );

      if (data) {
        // Convert stored format to builder format
        const steps: WorkflowStep[] = [];

        // Add trigger as first step
        if (data.trigger && typeof data.trigger === 'object') {
          const trigger = data.trigger as Record<string, unknown>;
          steps.push({
            id: (trigger.id as string) ?? `trigger-${Date.now()}`,
            type: 'trigger',
            actionType: (trigger.type as string) ?? 'manual',
            name: (trigger.name as string) ?? 'Trigger',
            config: trigger,
            order: 0,
          });
        }

        // Add actions
        if (data.actions && Array.isArray(data.actions)) {
          data.actions.forEach((action: Record<string, unknown>, index: number) => {
            steps.push({
              id: (action.id as string) ?? `action-${Date.now()}-${index}`,
              type: 'action',
              actionType: (action.type as string) ?? 'delay',
              name: (action.name as string) ?? `Action ${index + 1}`,
              config: action,
              order: index + 1,
            });
          });
        }

        setWorkflow({
          id: data.id as string,
          name: (data.name as string) ?? '',
          description: (data.description as string) ?? '',
          steps,
          status: (data.status as WorkflowData['status']) ?? 'draft',
        });
      }
    } catch (error) {
      logger.error('Error loading workflow:', error instanceof Error ? error : new Error(String(error)), { file: 'builder/page.tsx' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load existing workflow if editing
  useEffect(() => {
    if (workflowId) {
      void loadWorkflow(workflowId);
    }
  }, [workflowId, loadWorkflow]);

  // Get selected step
  const selectedStep = workflow.steps.find(s => s.id === selectedStepId) ?? null;

  // Check if workflow has a trigger
  const hasTrigger = workflow.steps.some(s => s.type === 'trigger');

  // Add step from palette
  const handleAddStep = useCallback((item: PaletteItem) => {
    const newStep: WorkflowStep = {
      id: `${item.type}-${Date.now()}`,
      type: item.type,
      actionType: item.actionType,
      name: item.name,
      description: item.description,
      config: {},
      order: workflow.steps.length,
    };

    // If adding a trigger, it should be first
    if (item.type === 'trigger') {
      setWorkflow(prev => ({
        ...prev,
        steps: [newStep, ...prev.steps.map((s, i) => ({ ...s, order: i + 1 }))],
      }));
    } else {
      setWorkflow(prev => ({
        ...prev,
        steps: [...prev.steps, newStep],
      }));
    }

    // Select the new step
    setSelectedStepId(newStep.id);
    setShowProperties(true);
  }, [workflow.steps.length]);

  // Update step
  const handleUpdateStep = useCallback((stepId: string, updates: Partial<WorkflowStep>) => {
    setWorkflow(prev => ({
      ...prev,
      steps: prev.steps.map(step =>
        step.id === stepId ? { ...step, ...updates } : step
      ),
    }));
  }, []);

  // Delete step
  const handleDeleteStep = useCallback((stepId: string) => {
    setWorkflow(prev => {
      const filteredSteps = prev.steps.filter(s => s.id !== stepId);
      // Reorder remaining steps
      return {
        ...prev,
        steps: filteredSteps.map((step, index) => ({ ...step, order: index })),
      };
    });

    if (selectedStepId === stepId) {
      setSelectedStepId(null);
    }
  }, [selectedStepId]);

  // Drag and drop handlers
  const handleDragStart = useCallback((index: number) => (e: React.DragEvent) => {
    setDraggedIndex(index);
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((targetIndex: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      return;
    }

    setWorkflow(prev => {
      const newSteps = [...prev.steps];
      const [movedStep] = newSteps.splice(draggedIndex, 1);
      newSteps.splice(targetIndex, 0, movedStep);

      // Reorder all steps
      return {
        ...prev,
        steps: newSteps.map((step, index) => ({ ...step, order: index })),
      };
    });

    setDraggedIndex(null);
  }, [draggedIndex]);

  // Save workflow
  const handleSave = async () => {
    if (!workflow.name) {
      toast.error('Please enter a workflow name');
      return;
    }

    try {
      setIsSaving(true);

      const id = workflow.id || `workflow-${Date.now()}`;
      const now = Timestamp.now();

      // Extract trigger from steps
      const triggerStep = workflow.steps.find(s => s.type === 'trigger');
      const actionSteps = workflow.steps.filter(s => s.type !== 'trigger');

      const workflowData = {
        id,
        workspaceId: 'default',
        name: workflow.name,
        description: workflow.description,
        trigger: triggerStep ? {
          id: triggerStep.id,
          type: triggerStep.actionType,
          name: triggerStep.name,
          ...triggerStep.config,
        } : { id: `trigger-${Date.now()}`, type: 'manual', name: 'Manual Trigger' },
        actions: actionSteps.map((step, index) => ({
          id: step.id,
          type: step.actionType,
          name: step.name,
          order: index,
          continueOnError: false,
          ...step.config,
        })),
        conditions: [],
        settings: {
          stopOnError: false,
          parallel: false,
          timeout: 300000,
          maxConcurrentRuns: 1,
        },
        permissions: {
          canView: ['owner', 'admin'],
          canEdit: ['owner', 'admin'],
          canExecute: ['owner', 'admin', 'member'],
        },
        stats: {
          totalRuns: 0,
          successfulRuns: 0,
          failedRuns: 0,
        },
        status: workflow.status,
        version: 1,
        createdAt: workflowId ? undefined : now,
        updatedAt: now,
        createdBy: user?.id ?? 'anonymous',
      };

      if (workflowId) {
        await FirestoreService.update(
          `organizations/${PLATFORM_ID}/workspaces/default/workflows`,
          id,
          workflowData
        );
      } else {
        await FirestoreService.set(
          `organizations/${PLATFORM_ID}/workspaces/default/workflows`,
          id,
          workflowData,
          false
        );
      }

      router.push(`/workflows`);
    } catch (error) {
      logger.error('Error saving workflow:', error instanceof Error ? error : new Error(String(error)), { file: 'builder/page.tsx' });
      toast.error('Failed to save workflow');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen bg-surface-main flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[var(--color-text-secondary)] text-sm">Loading workflow...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-surface-main flex flex-col overflow-hidden font-sans">
      {/* Header */}
      <header className="h-16 border-b border-border-light bg-surface-main/80 backdrop-blur-sm flex items-center justify-between px-4 shrink-0 z-50">
        <div className="flex items-center gap-4">
          {/* Back Button */}
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-surface-elevated transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Workflow Name Input */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(var(--color-primary-rgb), 0.2)' }}>
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <input
              type="text"
              value={workflow.name}
              onChange={(e) => setWorkflow(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Untitled Workflow"
              className="bg-transparent text-xl font-semibold text-[var(--color-text-primary)] placeholder-[var(--color-text-disabled)] border-none outline-none focus:ring-0 w-64"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Toggle Panels */}
          <div className="flex items-center bg-surface-elevated rounded-lg p-1">
            <button
              onClick={() => setShowPalette(!showPalette)}
              className={`p-2 rounded-md transition-colors ${showPalette ? 'bg-surface-elevated text-[var(--color-text-primary)]' : 'text-[var(--color-text-disabled)] hover:text-[var(--color-text-secondary)]'}`}
              title="Toggle Palette"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
              </svg>
            </button>
            <button
              onClick={() => setShowProperties(!showProperties)}
              className={`p-2 rounded-md transition-colors ${showProperties ? 'bg-surface-elevated text-[var(--color-text-primary)]' : 'text-[var(--color-text-disabled)] hover:text-[var(--color-text-secondary)]'}`}
              title="Toggle Properties"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </button>
          </div>

          {/* Status Badge */}
          <select
            value={workflow.status}
            onChange={(e) => setWorkflow(prev => ({ ...prev, status: e.target.value as WorkflowData['status'] }))}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-elevated border border-border-light text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </select>

          {/* Save Button */}
          <button
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="px-5 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:from-primary-light hover:to-secondary-light disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Saving...
              </span>
            ) : (
              'Save Workflow'
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Palette */}
        {showPalette && (
          <div className="w-80 border-r border-border-light shrink-0">
            <WorkflowPalette
              onAddStep={handleAddStep}
              hasTrigger={hasTrigger}
            />
          </div>
        )}

        {/* Center - Canvas */}
        <div className="flex-1 overflow-auto bg-gradient-to-b from-surface-main to-surface-paper">
          <div className="min-h-full p-8">
            {/* Description Input */}
            <div className="max-w-md mx-auto mb-8">
              <textarea
                value={workflow.description}
                onChange={(e) => setWorkflow(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Add a description for this workflow..."
                rows={2}
                className="w-full px-4 py-3 bg-surface-elevated border border-border-light rounded-xl text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-disabled)] focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary resize-none transition-all"
              />
            </div>

            {/* Workflow Steps */}
            <div className="flex flex-col items-center">
              {/* Start Marker */}
              <div className="flex flex-col items-center mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-success to-success flex items-center justify-center shadow-lg shadow-primary/25">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <span className="text-xs text-[var(--color-text-disabled)] mt-2 font-medium">Start</span>
              </div>

              {/* Steps */}
              {workflow.steps.length === 0 ? (
                <div className="flex flex-col items-center py-8">
                  {/* Connection line */}
                  <div className="w-0.5 h-8 bg-gradient-to-b from-success to-border-light" />

                  {/* Empty state */}
                  <div className="mt-4 p-6 rounded-xl border-2 border-dashed border-border-light bg-surface-elevated text-center max-w-md">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(var(--color-primary-rgb), 0.1)' }}>
                      <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                      Build Your Workflow
                    </h3>
                    <p className="text-sm text-[var(--color-text-disabled)] mb-4">
                      Start by adding a trigger from the palette on the left, then add actions to automate your process.
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      <span className="px-3 py-1 rounded-full text-success text-xs font-medium" style={{ backgroundColor: 'rgba(var(--color-success-rgb), 0.1)' }}>
                        1. Add Trigger
                      </span>
                      <span className="px-3 py-1 rounded-full text-primary text-xs font-medium" style={{ backgroundColor: 'rgba(var(--color-primary-rgb), 0.1)' }}>
                        2. Add Actions
                      </span>
                      <span className="px-3 py-1 rounded-full text-secondary text-xs font-medium" style={{ backgroundColor: 'rgba(var(--color-secondary-rgb), 0.1)' }}>
                        3. Configure
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {workflow.steps.map((step, index) => (
                    <WorkflowStepCard
                      key={step.id}
                      step={step}
                      isSelected={selectedStepId === step.id}
                      isFirst={index === 0}
                      isLast={index === workflow.steps.length - 1}
                      onSelect={() => {
                        setSelectedStepId(step.id);
                        setShowProperties(true);
                      }}
                      onDelete={() => handleDeleteStep(step.id)}
                      onDragStart={handleDragStart(index)}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop(index)}
                    />
                  ))}

                  {/* Add step button after last step */}
                  <div className="flex flex-col items-center mt-4">
                    <div className="w-0.5 h-4 bg-border-light" />
                    <button
                      onClick={() => setShowPalette(true)}
                      className="mt-2 p-3 rounded-xl border-2 border-dashed border-border-light hover:border-primary bg-surface-elevated transition-all duration-200 group"
                      style={{ backgroundColor: 'var(--color-bg-elevated)' }}
                    >
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-[var(--color-text-disabled)] group-hover:text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span className="text-sm text-[var(--color-text-disabled)] group-hover:text-primary">Add Step</span>
                      </div>
                    </button>
                  </div>

                  {/* End Marker */}
                  <div className="flex flex-col items-center mt-4">
                    <div className="w-0.5 h-8 bg-gradient-to-b from-border-light to-border-light" />
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br flex items-center justify-center mt-4" style={{ background: 'linear-gradient(135deg, var(--color-border-main), var(--color-border-light))' }}>
                      <svg className="w-6 h-6 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-xs text-[var(--color-text-disabled)] mt-2 font-medium">End</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - Properties */}
        {showProperties && (
          <div className="w-80 border-l border-border-light shrink-0">
            <WorkflowPropertiesPanel
              step={selectedStep}
              onUpdate={handleUpdateStep}
              onClose={() => setSelectedStepId(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
