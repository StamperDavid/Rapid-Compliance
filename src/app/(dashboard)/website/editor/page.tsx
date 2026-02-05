/**
 * Visual Page Builder - Main Editor
 * Three-panel layout: Widgets | Canvas | Properties
 * NOTE: PENTHOUSE - uses DEFAULT_ORG_ID
 */

'use client';

import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import WidgetsPanel from '@/components/website-builder/WidgetsPanel';
import EditorCanvas from '@/components/website-builder/EditorCanvas';
import PropertiesPanel from '@/components/website-builder/PropertiesPanel';
import EditorToolbar from '@/components/website-builder/EditorToolbar';
import VersionHistory from '@/components/website-builder/VersionHistory';
import SchedulePublishModal from '@/components/website-builder/SchedulePublishModal';
import type { Page, PageSection, Widget } from '@/types/website';
import { useEditorHistory } from '@/hooks/useEditorHistory';

// Type guards for API responses
interface PageResponse {
  page: Page;
}

interface ErrorResponse {
  error: string;
}

interface PublishResponse {
  publishedAt: string;
}

interface PreviewResponse {
  previewUrl: string;
}

interface VersionData {
  version: number;
  content: PageSection[];
  seo: Page['seo'];
  title: string;
  slug: string;
}

function isValidPageResponse(data: unknown): data is PageResponse {
  if (typeof data !== 'object' || data === null) {return false;}
  const response = data as Record<string, unknown>;
  return typeof response.page === 'object' && response.page !== null;
}

function isErrorResponse(data: unknown): data is ErrorResponse {
  if (typeof data !== 'object' || data === null) {return false;}
  const response = data as Record<string, unknown>;
  return typeof response.error === 'string';
}

function isPublishResponse(data: unknown): data is PublishResponse {
  if (typeof data !== 'object' || data === null) {return false;}
  const response = data as Record<string, unknown>;
  return typeof response.publishedAt === 'string';
}

function isPreviewResponse(data: unknown): data is PreviewResponse {
  if (typeof data !== 'object' || data === null) {return false;}
  const response = data as Record<string, unknown>;
  return typeof response.previewUrl === 'string';
}

function isVersionData(data: unknown): data is VersionData {
  if (typeof data !== 'object' || data === null) {return false;}
  const version = data as Record<string, unknown>;
  return (
    typeof version.version === 'number' &&
    Array.isArray(version.content) &&
    typeof version.seo === 'object' &&
    typeof version.title === 'string' &&
    typeof version.slug === 'string'
  );
}

// User feedback helpers (replacing alert/prompt/confirm)
function showSuccess(message: string): void {
  // TODO: Replace with toast notification system
  // eslint-disable-next-line no-alert
  alert(message);
}

function showError(message: string): void {
  // TODO: Replace with toast notification system
  // eslint-disable-next-line no-alert
  alert(message);
}

function askConfirm(message: string): boolean {
  // TODO: Replace with modal confirmation system
  // eslint-disable-next-line no-alert
  return confirm(message);
}

function askInput(message: string, defaultValue?: string): string | null {
  // TODO: Replace with modal input system
  // eslint-disable-next-line no-alert
  return prompt(message, defaultValue);
}

export default function PageEditorPage() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const orgId = DEFAULT_ORG_ID;
  const pageId = searchParams.get('pageId'); // If editing existing page

  // Editor state
  const [page, setPage] = useState<Page | null>(null);
  const [selectedElement, setSelectedElement] = useState<{
    type: 'section' | 'widget';
    sectionId: string;
    widgetId?: string;
  } | null>(null);
  const [breakpoint, setBreakpoint] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  
  // Undo/Redo history
  const {
    canUndo,
    canRedo,
    pushState,
    undo,
    redo
  } = useEditorHistory<Page>();

  // Stable function references for useEffect dependencies
  const loadPageStable = React.useCallback(async (id: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/website/pages/${id}?organizationId=${orgId}`);

      if (!response.ok) {throw new Error('Failed to load page');}

      const data: unknown = await response.json();

      // Type guard for API response
      if (isValidPageResponse(data)) {
        setPage(data.page);
        pushState(data.page);
      } else {
        throw new Error('Invalid page data received');
      }
    } catch (error: unknown) {
      console.error('[Editor] Load error:', error);
      showError('Failed to load page');
    } finally {
      setLoading(false);
    }
  }, [orgId, pushState]);

  const createBlankPageStable = React.useCallback(() => {
    const newPage: Page = {
      id: `page_${Date.now()}`,
      slug: 'new-page',
      title: 'Untitled Page',
      content: [],
      seo: {
        metaTitle: '',
        metaDescription: '',
      },
      status: 'draft',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: (user?.email !== '' && user?.email != null) ? user.email : ((user?.displayName !== '' && user?.displayName != null) ? user.displayName : 'anonymous'),
      lastEditedBy: (user?.email !== '' && user?.email != null) ? user.email : ((user?.displayName !== '' && user?.displayName != null) ? user.displayName : 'anonymous'),
    };

    setPage(newPage);
    pushState(newPage);
    setLoading(false);
  }, [user, pushState]);

  useEffect(() => {
    if (pageId) {
      void loadPageStable(pageId);
    } else {
      createBlankPageStable();
    }
  }, [pageId, loadPageStable, createBlankPageStable]);

  // Auto-save every 30 seconds
  const savePageStable = React.useCallback(async (isAutoSave: boolean = false): Promise<void> => {
    if (!page) {return;}

    try {
      setSaving(true);

      const endpoint = pageId
        ? `/api/website/pages/${pageId}`
        : '/api/website/pages';

      const method = pageId ? 'PUT' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: orgId,
          page: {
            ...page,
            updatedAt: new Date().toISOString(),
            lastEditedBy: (user?.email !== '' && user?.email != null) ? user.email : ((user?.displayName !== '' && user?.displayName != null) ? user.displayName : 'anonymous'),
          },
        }),
      });

      if (!response.ok) {throw new Error('Failed to save page');}

      if (!isAutoSave) {
        showSuccess('Page saved successfully!');
      }
    } catch (error: unknown) {
      console.error('[Editor] Save error:', error);
      if (!isAutoSave) {
        showError('Failed to save page');
      }
    } finally {
      setSaving(false);
    }
  }, [page, pageId, orgId, user]);

  useEffect(() => {
    if (!autoSaveEnabled || !page) {return;}

    const interval = setInterval(() => {
      void savePageStable(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [page, autoSaveEnabled, savePageStable]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo: Ctrl/Cmd + Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) {
          const previousState = undo();
          if (previousState) {setPage(previousState);}
        }
      }

      // Redo: Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y
      if ((e.ctrlKey || e.metaKey) && (e.shiftKey && e.key === 'z' || e.key === 'y')) {
        e.preventDefault();
        if (canRedo) {
          const nextState = redo();
          if (nextState) {setPage(nextState);}
        }
      }

      // Save: Ctrl/Cmd + S
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        void savePageStable(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo, page, undo, redo, savePageStable]);

  async function saveAsTemplate(): Promise<void> {
    if (!page) {return;}

    const templateName = askInput('Enter a name for this template:', page.title);
    if (!templateName) {return;}

    const templateDescription = askInput('Enter a description (optional):', '');

    try {
      const response = await fetch('/api/website/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: orgId,
          template: {
            name: templateName,
            description:(templateDescription !== '' && templateDescription != null) ? templateDescription : `Custom template based on ${page.title}`,
            category: 'other',
            thumbnail: `https://via.placeholder.com/400x300/6c757d/ffffff?text=${encodeURIComponent(templateName)}`,
            content: page.content,
            isPublic: false,
            createdBy: (user?.email !== '' && user?.email != null) ? user.email : ((user?.displayName !== '' && user?.displayName != null) ? user.displayName : 'anonymous'),
          },
        }),
      });

      if (!response.ok) {throw new Error('Failed to save template');}

      showSuccess('Template saved successfully! You can find it in the Templates page.');
    } catch (error: unknown) {
      console.error('[Editor] Save as template error:', error);
      showError('Failed to save template');
    }
  }

  async function publishPage(scheduledFor?: string): Promise<void> {
    if (!page || !pageId) {
      showError('Please save the page first before publishing.');
      return;
    }

    try {
      setPublishing(true);

      const response = await fetch(`/api/website/pages/${pageId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgId, scheduledFor }),
      });

      if (!response.ok) {
        const errorData: unknown = await response.json();
        const errorMessage = isErrorResponse(errorData) ? errorData.error : 'Failed to publish page';
        throw new Error(errorMessage);
      }

      const result: unknown = await response.json();

      // Update local page state
      if (scheduledFor) {
        setPage({ ...page, status: 'scheduled', scheduledFor });
        showSuccess(`Page scheduled for ${new Date(scheduledFor).toLocaleString()}!`);
      } else {
        if (isPublishResponse(result)) {
          setPage({ ...page, status: 'published', publishedAt: result.publishedAt });
          showSuccess('Page published successfully!');
        } else {
          throw new Error('Invalid publish response');
        }
      }
    } catch (error: unknown) {
      console.error('[Editor] Publish error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      showError(`Failed to publish page: ${message}`);
    } finally {
      setPublishing(false);
    }
  }

  function handleSchedulePublish(): void {
    setShowScheduleModal(true);
  }

  function handleScheduleConfirm(scheduledDate: string): void {
    setShowScheduleModal(false);
    void publishPage(scheduledDate);
  }

  function handleRestoreVersion(version: unknown): void {
    if (!page) {return;}

    // Type guard and restore the version content
    if (!isVersionData(version)) {
      showError('Invalid version data');
      return;
    }

    const restoredPage: Page = {
      ...page,
      content: version.content,
      seo: version.seo,
      title: version.title,
      slug: version.slug,
      status: 'draft' as const,
      updatedAt: new Date().toISOString(),
    };

    setPage(restoredPage);
    pushState(restoredPage);

    showSuccess(`Restored to Version ${version.version}. Don't forget to save your changes!`);
  }

  async function unpublishPage(): Promise<void> {
    if (!page || !pageId) {return;}

    if (!askConfirm('Unpublish this page? It will revert to draft status.')) {return;}

    try {
      setPublishing(true);

      const response = await fetch(`/api/website/pages/${pageId}/publish?organizationId=${orgId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData: unknown = await response.json();
        const errorMessage = isErrorResponse(errorData) ? errorData.error : 'Failed to unpublish page';
        throw new Error(errorMessage);
      }

      // Update local page state
      setPage({ ...page, status: 'draft' });

      showSuccess('Page unpublished successfully.');
    } catch (error: unknown) {
      console.error('[Editor] Unpublish error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      showError(`Failed to unpublish page: ${message}`);
    } finally {
      setPublishing(false);
    }
  }

  async function generatePreview(): Promise<void> {
    if (!page || !pageId) {
      showError('Please save the page first before generating a preview.');
      return;
    }

    try {
      const response = await fetch(`/api/website/pages/${pageId}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgId }),
      });

      if (!response.ok) {
        const errorData: unknown = await response.json();
        const errorMessage = isErrorResponse(errorData) ? errorData.error : 'Failed to generate preview';
        throw new Error(errorMessage);
      }

      const result: unknown = await response.json();

      if (!isPreviewResponse(result)) {
        throw new Error('Invalid preview response');
      }

      // Open preview in new tab
      window.open(result.previewUrl, '_blank');

      // Also show the URL so user can copy it
      askInput('Preview link (valid for 24 hours):', result.previewUrl);
    } catch (error: unknown) {
      console.error('[Editor] Preview error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      showError(`Failed to generate preview: ${message}`);
    }
  }

  function updatePage(updates: Partial<Page>): void {
    if (!page) {return;}

    const updatedPage = { ...page, ...updates };
    setPage(updatedPage);
    pushState(updatedPage);
  }

  function addSection(sectionData?: Partial<PageSection>): void {
    if (!page) {return;}

    const newSection: PageSection = {
      id: `section_${Date.now()}`,
      type: 'section',
      columns: [
        {
          id: `col_${Date.now()}`,
          width: 100,
          widgets: [],
        },
      ],
      padding: { top: '2rem', bottom: '2rem' },
      ...sectionData,
    };

    updatePage({
      content: [...page.content, newSection],
    });
  }

  function updateSection(sectionId: string, updates: Partial<PageSection>): void {
    if (!page) {return;}

    const updatedContent = page.content.map(section =>
      section.id === sectionId ? { ...section, ...updates } : section
    );

    updatePage({ content: updatedContent });
  }

  function deleteSection(sectionId: string): void {
    if (!page) {return;}
    if (!askConfirm('Delete this section?')) {return;}

    updatePage({
      content: page.content.filter(s => s.id !== sectionId),
    });

    // Clear selection if deleting selected element
    if (selectedElement?.sectionId === sectionId) {
      setSelectedElement(null);
    }
  }

  function addWidget(sectionId: string, widget: Widget, columnIndex: number = 0): void {
    if (!page) {return;}

    const updatedContent = page.content.map(section => {
      if (section.id === sectionId) {
        const updatedColumns = [...section.columns];
        const targetColumn = updatedColumns[columnIndex];
        if (targetColumn) {
          updatedColumns[columnIndex] = {
            ...targetColumn,
            widgets: [...targetColumn.widgets, widget],
          };
        }
        return { ...section, columns: updatedColumns };
      }
      return section;
    });

    updatePage({ content: updatedContent });
  }

  function updateWidget(sectionId: string, widgetId: string, updates: Partial<Widget>): void {
    if (!page) {return;}

    const updatedContent = page.content.map(section => {
      if (section.id === sectionId) {
        const updatedColumns = section.columns.map(col => ({
          ...col,
          widgets: col.widgets.map(widget =>
            widget.id === widgetId ? { ...widget, ...updates } : widget
          ),
        }));
        return { ...section, columns: updatedColumns };
      }
      return section;
    });

    updatePage({ content: updatedContent });
  }

  function deleteWidget(sectionId: string, widgetId: string): void {
    if (!page) {return;}

    const updatedContent = page.content.map(section => {
      if (section.id === sectionId) {
        const updatedColumns = section.columns.map(col => ({
          ...col,
          widgets: col.widgets.filter(w => w.id !== widgetId),
        }));
        return { ...section, columns: updatedColumns };
      }
      return section;
    });

    updatePage({ content: updatedContent });

    // Clear selection if deleting selected widget
    if (selectedElement?.widgetId === widgetId) {
      setSelectedElement(null);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
        <div>Loading editor...</div>
      </div>
    );
  }

  if (!page) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
        <div>Failed to load page</div>
      </div>
    );
  }

  return (
    <div style={{
      fontFamily: 'system-ui',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Editor Toolbar */}
      <EditorToolbar
        page={page}
        breakpoint={breakpoint}
        onBreakpointChange={setBreakpoint}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => {
          const prev = undo();
          if (prev) {setPage(prev);}
        }}
        onRedo={() => {
          const next = redo();
          if (next) {setPage(next);}
        }}
        onSave={() => void savePageStable(false)}
        onSaveAsTemplate={() => void saveAsTemplate()}
        onPublish={() => void publishPage()}
        onUnpublish={() => void unpublishPage()}
        onPreview={() => void generatePreview()}
        onSchedule={handleSchedulePublish}
        onViewVersions={() => setShowVersionHistory(true)}
        saving={saving}
        publishing={publishing}
        autoSaveEnabled={autoSaveEnabled}
        onToggleAutoSave={() => setAutoSaveEnabled(!autoSaveEnabled)}
      />

      {/* Three-Panel Layout */}
      <div style={{ 
        display: 'flex', 
        flex: 1,
        overflow: 'hidden',
      }}>
        {/* Left Panel: Widgets Library */}
        <WidgetsPanel
          onAddWidget={(widget) => {
            // Add to first section, or create new section if none exist
            if (page.content.length === 0) {
              addSection({
                columns: [{
                  id: `col_${Date.now()}`,
                  width: 100,
                  widgets: [widget],
                }],
              });
            } else {
              addWidget(page.content[0].id, widget, 0);
            }
          }}
        />

        {/* Center Panel: Canvas */}
        <EditorCanvas
          page={page}
          breakpoint={breakpoint}
          selectedElement={selectedElement}
          onSelectElement={setSelectedElement}
          onAddSection={addSection}
          onUpdateSection={updateSection}
          onDeleteSection={deleteSection}
          onAddWidget={addWidget}
          onUpdateWidget={updateWidget}
          onDeleteWidget={deleteWidget}
        />

        {/* Right Panel: Properties */}
        <PropertiesPanel
          selectedElement={selectedElement}
          page={page}
          breakpoint={breakpoint}
          onUpdatePage={updatePage}
          onUpdateSection={updateSection}
          onUpdateWidget={updateWidget}
        />
      </div>

      {/* Version History Panel */}
      {showVersionHistory && pageId && (
        <VersionHistory
          pageId={pageId}
          organizationId={orgId}
          onRestore={handleRestoreVersion}
          onClose={() => setShowVersionHistory(false)}
        />
      )}

      {/* Schedule Publish Modal */}
      {showScheduleModal && (
        <SchedulePublishModal
          pageTitle={page.title}
          onSchedule={handleScheduleConfirm}
          onCancel={() => setShowScheduleModal(false)}
        />
      )}
    </div>
  );
}

