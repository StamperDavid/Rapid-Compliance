'use client';

/**
 * Modular Template Editor
 * 
 * Single-page document editor with sticky sidebar and modular sections
 */

import { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Save, X, AlertCircle, RotateCcw, Plus } from 'lucide-react';
import type { IndustryTemplate } from '@/lib/persona/templates/types';
import { TableOfContents } from './modular-sections/TableOfContents';
import { BasicInfoSection } from './modular-sections/BasicInfoSection';
import { ScraperSection } from './modular-sections/ScraperSection';
import { CRMFieldsSection } from './modular-sections/CRMFieldsSection';
import { HighValueSignalsSection } from './modular-sections/HighValueSignalsSection';
import { FluffPatternsSection } from './modular-sections/FluffPatternsSection';
import { ScoringRulesSection } from './modular-sections/ScoringRulesSection';
import { CoreIdentitySection } from './modular-sections/CoreIdentitySection';
import { CognitiveLogicSection } from './modular-sections/CognitiveLogicSection';
import { KnowledgeRAGSection } from './modular-sections/KnowledgeRAGSection';
import { LearningLoopsSection } from './modular-sections/LearningLoopsSection';
import { TacticalExecutionSection } from './modular-sections/TacticalExecutionSection';
import { AddSectionDialog } from './modular-sections/AddSectionDialog';

interface ModularTemplateEditorProps {
  template: IndustryTemplate;
  onSave: (template: IndustryTemplate) => Promise<void>;
  onCancel: () => void;
  onDelete: (templateId: string) => Promise<void>;
  isLoading: boolean;
}

export interface SectionConfig {
  id: string;
  title: string;
  required: boolean;
  visible: boolean;
}

export function ModularTemplateEditor({
  template,
  onSave,
  onCancel,
  onDelete,
  isLoading,
}: ModularTemplateEditorProps) {
  const [editedTemplate, setEditedTemplate] = useState<IndustryTemplate>(template);
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddSection, setShowAddSection] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Section visibility management
  const [sections, setSections] = useState<SectionConfig[]>([
    { id: 'basic-info', title: 'Basic Information', required: true, visible: true },
    { id: 'scraper', title: 'Web Scraper', required: true, visible: true },
    { id: 'crm-fields', title: 'CRM Fields', required: false, visible: true },
    { id: 'signals', title: 'High-Value Signals', required: true, visible: true },
    { id: 'fluff', title: 'Fluff Patterns', required: true, visible: true },
    { id: 'scoring', title: 'Scoring Rules', required: true, visible: true },
    { id: 'core-identity', title: 'Core Identity (AI)', required: true, visible: true },
    { id: 'cognitive', title: 'Cognitive Logic', required: true, visible: true },
    { id: 'knowledge', title: 'Knowledge Base (RAG)', required: true, visible: true },
    { id: 'learning', title: 'Learning Loops', required: true, visible: true },
    { id: 'tactical', title: 'Tactical Execution', required: true, visible: true },
  ]);

  // Refs for scrolling to sections
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Track changes
  useEffect(() => {
    const changed = JSON.stringify(editedTemplate) !== JSON.stringify(template);
    setHasChanges(changed);
  }, [editedTemplate, template]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setValidationErrors({});
      await onSave(editedTemplate);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save template';
      setError(errorMessage);
      
      // Parse validation errors if present
      if (errorMessage.includes('Validation errors:')) {
        const errors: Record<string, string> = {};
        const lines = errorMessage.split('\n').slice(1);
        lines.forEach(line => {
          const match = line.match(/^(.+?):\s*(.+)$/);
          if (match) {
            const [, path, message] = match;
            errors[path] = message;
          }
        });
        setValidationErrors(errors);
      }
      
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      // TODO: Replace with proper confirmation dialog
      // eslint-disable-next-line no-alert
      if (!confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        return;
      }
    }
    onCancel();
  };

  const handleRevert = async () => {
    // TODO: Replace with proper confirmation dialog
    // eslint-disable-next-line no-alert
    if (!confirm('Are you sure you want to revert this template to its default? This will delete any customizations.')) {
      return;
    }
    try {
      await onDelete(editedTemplate.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revert template');
    }
  };

  const updateTemplate = (updates: Partial<IndustryTemplate>) => {
    setEditedTemplate(prev => ({ ...prev, ...updates }));
  };

  const scrollToSection = (sectionId: string) => {
    const element = sectionRefs.current[sectionId];
    if (element) {
      const yOffset = -80; // Account for sticky header
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  const toggleSection = (sectionId: string) => {
    setSections(prev =>
      prev.map(s => (s.id === sectionId ? { ...s, visible: !s.visible } : s))
    );
  };

  const addSection = (sectionId: string) => {
    setSections(prev =>
      prev.map(s => (s.id === sectionId ? { ...s, visible: true } : s))
    );
    // Scroll to newly added section
    setTimeout(() => scrollToSection(sectionId), 100);
  };

  const visibleSections = sections.filter(s => s.visible);

  return (
    <div className="relative">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-background border-b mb-6">
        <Card className="rounded-none border-x-0 border-t-0">
          <CardHeader className="py-4">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-xl">{editedTemplate.name}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {editedTemplate.category} • {editedTemplate.id}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddSection(true)}
                  disabled={isLoading || isSaving}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Section
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { void handleRevert(); }}
                  disabled={isLoading || isSaving}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Revert to Default
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  disabled={isLoading || isSaving}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => { void handleSave(); }}
                  disabled={!hasChanges || isLoading || isSaving}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive" className="rounded-none border-x-0">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="whitespace-pre-wrap">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Changes Indicator */}
        {hasChanges && (
          <Alert className="rounded-none border-x-0 border-t">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You have unsaved changes. Remember to save before leaving.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Main Layout: Sidebar + Content */}
      <div className="container mx-auto px-4 pb-12">
        <div className="flex gap-8">
          {/* Sticky Sidebar - Table of Contents */}
          <TableOfContents
            sections={visibleSections}
            onNavigate={scrollToSection}
            validationErrors={validationErrors}
          />

          {/* Main Content Area */}
          <div className="flex-1 space-y-6">
            {/* Basic Information */}
            {sections.find(s => s.id === 'basic-info')?.visible && (
              <div ref={el => { sectionRefs.current['basic-info'] = el; }}>
                <BasicInfoSection
                  template={editedTemplate}
                  onUpdate={updateTemplate}
                  disabled={isLoading || isSaving}
                  errors={validationErrors}
                />
              </div>
            )}

            {/* Web Scraper */}
            {sections.find(s => s.id === 'scraper')?.visible && (
              <div ref={el => { sectionRefs.current['scraper'] = el; }}>
                <ScraperSection
                  template={editedTemplate}
                  onUpdate={updateTemplate}
                  disabled={isLoading || isSaving}
                  onRemove={() => toggleSection('scraper')}
                  canRemove={!sections.find(s => s.id === 'scraper')?.required}
                  errors={validationErrors}
                />
              </div>
            )}

            {/* CRM Fields */}
            {sections.find(s => s.id === 'crm-fields')?.visible && (
              <div ref={el => { sectionRefs.current['crm-fields'] = el; }}>
                <CRMFieldsSection
                  template={editedTemplate}
                  onUpdate={updateTemplate}
                  disabled={isLoading || isSaving}
                  onRemove={() => toggleSection('crm-fields')}
                  canRemove={!sections.find(s => s.id === 'crm-fields')?.required}
                  errors={validationErrors}
                />
              </div>
            )}

            {/* High-Value Signals */}
            {sections.find(s => s.id === 'signals')?.visible && (
              <div ref={el => { sectionRefs.current['signals'] = el; }}>
                <HighValueSignalsSection
                  template={editedTemplate}
                  onUpdate={updateTemplate}
                  disabled={isLoading || isSaving}
                  onRemove={() => toggleSection('signals')}
                  canRemove={!sections.find(s => s.id === 'signals')?.required}
                  errors={validationErrors}
                />
              </div>
            )}

            {/* Fluff Patterns */}
            {sections.find(s => s.id === 'fluff')?.visible && (
              <div ref={el => { sectionRefs.current['fluff'] = el; }}>
                <FluffPatternsSection
                  template={editedTemplate}
                  onUpdate={updateTemplate}
                  disabled={isLoading || isSaving}
                  onRemove={() => toggleSection('fluff')}
                  canRemove={!sections.find(s => s.id === 'fluff')?.required}
                  errors={validationErrors}
                />
              </div>
            )}

            {/* Scoring Rules */}
            {sections.find(s => s.id === 'scoring')?.visible && (
              <div ref={el => { sectionRefs.current['scoring'] = el; }}>
                <ScoringRulesSection
                  template={editedTemplate}
                  onUpdate={updateTemplate}
                  disabled={isLoading || isSaving}
                  onRemove={() => toggleSection('scoring')}
                  canRemove={!sections.find(s => s.id === 'scoring')?.required}
                  errors={validationErrors}
                />
              </div>
            )}

            {/* Core Identity (AI) */}
            {sections.find(s => s.id === 'core-identity')?.visible && (
              <div ref={el => { sectionRefs.current['core-identity'] = el; }}>
                <CoreIdentitySection
                  template={editedTemplate}
                  onUpdate={updateTemplate}
                  disabled={isLoading || isSaving}
                  onRemove={() => toggleSection('core-identity')}
                  canRemove={!sections.find(s => s.id === 'core-identity')?.required}
                  errors={validationErrors}
                />
              </div>
            )}

            {/* Cognitive Logic */}
            {sections.find(s => s.id === 'cognitive')?.visible && (
              <div ref={el => { sectionRefs.current['cognitive'] = el; }}>
                <CognitiveLogicSection
                  template={editedTemplate}
                  onUpdate={updateTemplate}
                  disabled={isLoading || isSaving}
                  onRemove={() => toggleSection('cognitive')}
                  canRemove={!sections.find(s => s.id === 'cognitive')?.required}
                  errors={validationErrors}
                />
              </div>
            )}

            {/* Knowledge Base (RAG) */}
            {sections.find(s => s.id === 'knowledge')?.visible && (
              <div ref={el => { sectionRefs.current['knowledge'] = el; }}>
                <KnowledgeRAGSection
                  template={editedTemplate}
                  onUpdate={updateTemplate}
                  disabled={isLoading || isSaving}
                  onRemove={() => toggleSection('knowledge')}
                  canRemove={!sections.find(s => s.id === 'knowledge')?.required}
                  errors={validationErrors}
                />
              </div>
            )}

            {/* Learning Loops */}
            {sections.find(s => s.id === 'learning')?.visible && (
              <div ref={el => { sectionRefs.current['learning'] = el; }}>
                <LearningLoopsSection
                  template={editedTemplate}
                  onUpdate={updateTemplate}
                  disabled={isLoading || isSaving}
                  onRemove={() => toggleSection('learning')}
                  canRemove={!sections.find(s => s.id === 'learning')?.required}
                  errors={validationErrors}
                />
              </div>
            )}

            {/* Tactical Execution */}
            {sections.find(s => s.id === 'tactical')?.visible && (
              <div ref={el => { sectionRefs.current['tactical'] = el; }}>
                <TacticalExecutionSection
                  template={editedTemplate}
                  onUpdate={updateTemplate}
                  disabled={isLoading || isSaving}
                  onRemove={() => toggleSection('tactical')}
                  canRemove={!sections.find(s => s.id === 'tactical')?.required}
                  errors={validationErrors}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Section Dialog */}
      <AddSectionDialog
        open={showAddSection}
        onClose={() => setShowAddSection(false)}
        sections={sections}
        onAddSection={addSection}
      />
    </div>
  );
}
