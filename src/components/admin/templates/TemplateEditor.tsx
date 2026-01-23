'use client';

/**
 * Template Editor Component
 * 
 * Multi-tab editor for industry templates
 * Tabs: Scraper & CRM, Intelligence & Signals, AI Agents
 */

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Save, X, AlertCircle, RotateCcw } from 'lucide-react';
import type { IndustryTemplate } from '@/lib/persona/templates/types';
import { ScraperCRMTab } from './editor-tabs/ScraperCRMTab';
import { IntelligenceSignalsTab } from './editor-tabs/IntelligenceSignalsTab';
import { AIAgentsTab } from './editor-tabs/AIAgentsTab';

interface TemplateEditorProps {
  template: IndustryTemplate;
  onSave: (template: IndustryTemplate) => Promise<void>;
  onCancel: () => void;
  onDelete: (templateId: string) => Promise<void>;
  isLoading: boolean;
}

export function TemplateEditor({
  template,
  onSave,
  onCancel,
  onDelete,
  isLoading,
}: TemplateEditorProps) {
  const [editedTemplate, setEditedTemplate] = useState<IndustryTemplate>(template);
  const [activeTab, setActiveTab] = useState('scraper');
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Track changes
  useEffect(() => {
    const changed = JSON.stringify(editedTemplate) !== JSON.stringify(template);
    setHasChanges(changed);
  }, [editedTemplate, template]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      await onSave(editedTemplate);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template');
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>{editedTemplate.name}</CardTitle>
              <CardDescription>
                {editedTemplate.category} • {editedTemplate.id}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
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
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="whitespace-pre-wrap">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Changes Indicator */}
      {hasChanges && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You have unsaved changes. Remember to save before leaving.
          </AlertDescription>
        </Alert>
      )}

      {/* Multi-Tab Editor */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="scraper">Scraper & CRM</TabsTrigger>
          <TabsTrigger value="intelligence">Intelligence & Signals</TabsTrigger>
          <TabsTrigger value="agents">AI Agents</TabsTrigger>
        </TabsList>

        <TabsContent value="scraper" className="mt-6">
          <ScraperCRMTab
            template={editedTemplate}
            onUpdate={updateTemplate}
            disabled={isLoading || isSaving}
          />
        </TabsContent>

        <TabsContent value="intelligence" className="mt-6">
          <IntelligenceSignalsTab
            template={editedTemplate}
            onUpdate={updateTemplate}
            disabled={isLoading || isSaving}
          />
        </TabsContent>

        <TabsContent value="agents" className="mt-6">
          <AIAgentsTab
            template={editedTemplate}
            onUpdate={updateTemplate}
            disabled={isLoading || isSaving}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
