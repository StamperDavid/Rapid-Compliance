'use client';

/**
 * Global Industry Template Manager
 * 
 * Admin UI for managing the 49 industry templates
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, AlertCircle } from 'lucide-react';
import { IndustryList } from '@/components/admin/templates/IndustryList';
import { ModularTemplateEditor } from '@/components/admin/templates/ModularTemplateEditor';
import type { IndustryTemplate } from '@/lib/persona/templates/types';
import { STANDARD_BASE_TEMPLATE } from '@/lib/templates/template-validation';

export default function TemplatesPage() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<IndustryTemplate | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Check admin access
  useEffect(() => {
    if (user) {
      const adminRoles = ['admin', 'super_admin', 'owner'];
      setIsAdmin(adminRoles.includes(user.role || ''));
    }
  }, [user]);

  // Load templates
  useEffect(() => {
    if (isAdmin) {
      loadTemplates();
    }
  }, [isAdmin]);

  const loadTemplates = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/admin/templates');
      
      if (!response.ok) {
        throw new Error('Failed to load templates');
      }

      const data = await response.json();
      
      if (data.success) {
        setTemplates(data.templates);
      } else {
        throw new Error((data.error !== '' && data.error != null) ? data.error : 'Failed to load templates');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectTemplate = async (templateId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/templates/${templateId}`);
      
      if (!response.ok) {
        throw new Error('Failed to load template');
      }

      const data = await response.json();
      
      if (data.success) {
        setSelectedTemplate(data.template);
        setIsEditing(true);
      } else {
        throw new Error((data.error !== '' && data.error != null) ? data.error : 'Failed to load template');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load template');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddNew = () => {
    // Create a mutable deep copy to avoid readonly type issues
    setSelectedTemplate(JSON.parse(JSON.stringify(STANDARD_BASE_TEMPLATE)) as IndustryTemplate);
    setIsEditing(true);
  };

  const handleSave = async (template: IndustryTemplate) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/admin/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template),
      });

      const data = await response.json();

      if (!data.success) {
        if (data.validationErrors) {
          throw new Error(
            `Validation errors:\n${  data.validationErrors.join('\n')}`
          );
        }
        throw new Error((data.error !== '' && data.error != null) ? data.error : 'Failed to save template');
      }

      // Reload templates
      await loadTemplates();
      
      // Close editor
      setIsEditing(false);
      setSelectedTemplate(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template');
      throw err; // Re-throw to let the editor handle it
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm('Are you sure you want to revert this template to its default? This will delete the Firestore override.')) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/templates?id=${templateId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error((data.error !== '' && data.error != null) ? data.error : 'Failed to delete template');
      }

      // Reload templates
      await loadTemplates();
      
      // Close editor if this was the selected template
      if (selectedTemplate?.id === templateId) {
        setIsEditing(false);
        setSelectedTemplate(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete template');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setSelectedTemplate(null);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please sign in to continue</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Admin access required</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You do not have permission to access this page.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Global Industry Template Manager</h1>
        <p className="text-muted-foreground">
          Manage the 49 industry templates. Changes saved here override code defaults.
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isEditing && selectedTemplate ? (
        <ModularTemplateEditor
          template={selectedTemplate}
          onSave={handleSave}
          onCancel={handleCancel}
          onDelete={handleDelete}
          isLoading={isLoading}
        />
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Industry Templates</h2>
              <p className="text-sm text-muted-foreground">
                {templates.length} templates • {templates.filter(t => t.hasOverride).length} customized
              </p>
            </div>
            <Button onClick={handleAddNew} disabled={isLoading}>
              <Plus className="h-4 w-4 mr-2" />
              Add New Industry
            </Button>
          </div>

          <IndustryList
            templates={templates}
            onSelect={handleSelectTemplate}
            isLoading={isLoading}
          />
        </div>
      )}
    </div>
  );
}
