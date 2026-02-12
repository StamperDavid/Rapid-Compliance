/**
 * Visual Page Builder - Main Editor
 * Three-panel layout: Widgets | Canvas | Properties
 */

'use client';


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

interface PagesListItem {
  id: string;
  slug: string;
  status: string;
}

interface PagesListResponse {
  pages: PagesListItem[];
}

function isPagesListResponse(data: unknown): data is PagesListResponse {
  if (typeof data !== 'object' || data === null) {return false;}
  const response = data as Record<string, unknown>;
  return Array.isArray(response.pages);
}

// These helper functions are now replaced with state-based dialogs in the component

export default function PageEditorPage() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
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
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [promptDialog, setPromptDialog] = useState<{ message: string; defaultValue: string; onSubmit: (value: string) => void } | null>(null);
  const [promptValue, setPromptValue] = useState('');

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
      const response = await fetch(`/api/website/pages/${id}`);

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
      setNotification({ message: 'Failed to load page', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [pushState]);

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

  // Auto-load homepage when entering editor without a pageId
  const loadHomepageStable = React.useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/website/pages');

      if (!response.ok) {
        createBlankPageStable();
        return;
      }

      const data: unknown = await response.json();

      if (!isPagesListResponse(data) || data.pages.length === 0) {
        createBlankPageStable();
        return;
      }

      // Find homepage by slug, then first published page, then first page
      const homepage = data.pages.find(p => p.slug === '/' || p.slug === 'home' || p.slug === 'index')
        ?? data.pages.find(p => p.status === 'published')
        ?? data.pages[0];

      if (homepage) {
        await loadPageStable(homepage.id);
      } else {
        createBlankPageStable();
      }
    } catch (error: unknown) {
      console.error('[Editor] Failed to load homepage:', error);
      createBlankPageStable();
    }
  }, [createBlankPageStable, loadPageStable]);

  useEffect(() => {
    if (pageId) {
      void loadPageStable(pageId);
    } else {
      void loadHomepageStable();
    }
  }, [pageId, loadPageStable, loadHomepageStable]);

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
          page: {
            ...page,
            updatedAt: new Date().toISOString(),
            lastEditedBy: (user?.email !== '' && user?.email != null) ? user.email : ((user?.displayName !== '' && user?.displayName != null) ? user.displayName : 'anonymous'),
          },
        }),
      });

      if (!response.ok) {throw new Error('Failed to save page');}

      if (!isAutoSave) {
        setNotification({ message: 'Page saved successfully!', type: 'success' });
      }
    } catch (error: unknown) {
      console.error('[Editor] Save error:', error);
      if (!isAutoSave) {
        setNotification({ message: 'Failed to save page', type: 'error' });
      }
    } finally {
      setSaving(false);
    }
  }, [page, pageId, user]);

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

  function saveAsTemplate(): void {
    if (!page) {return;}

    setPromptDialog({
      message: 'Enter a name for this template:',
      defaultValue: page.title,
      onSubmit: (templateName: string) => {
        if (!templateName) {
          setPromptDialog(null);
          return;
        }

        setPromptDialog({
          message: 'Enter a description (optional):',
          defaultValue: '',
          onSubmit: (templateDescription: string) => {
            setPromptDialog(null);
            void (async () => {
              try {
                const response = await fetch('/api/website/templates', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
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

                setNotification({ message: 'Template saved successfully! You can find it in the Templates page.', type: 'success' });
              } catch (error: unknown) {
                console.error('[Editor] Save as template error:', error);
                setNotification({ message: 'Failed to save template', type: 'error' });
              }
            })();
          },
        });
        setPromptValue('');
      },
    });
    setPromptValue(page.title);
  }

  async function publishPage(scheduledFor?: string): Promise<void> {
    if (!page || !pageId) {
      setNotification({ message: 'Please save the page first before publishing.', type: 'error' });
      return;
    }

    try {
      setPublishing(true);

      const response = await fetch(`/api/website/pages/${pageId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledFor }),
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
        setNotification({ message: `Page scheduled for ${new Date(scheduledFor).toLocaleString()}!`, type: 'success' });
      } else {
        if (isPublishResponse(result)) {
          setPage({ ...page, status: 'published', publishedAt: result.publishedAt });
          setNotification({ message: 'Page published successfully!', type: 'success' });
        } else {
          throw new Error('Invalid publish response');
        }
      }
    } catch (error: unknown) {
      console.error('[Editor] Publish error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      setNotification({ message: `Failed to publish page: ${message}`, type: 'error' });
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
      setNotification({ message: 'Invalid version data', type: 'error' });
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

    setNotification({ message: `Restored to Version ${version.version}. Don't forget to save your changes!`, type: 'success' });
  }

  function unpublishPage(): void {
    if (!page || !pageId) {return;}

    setConfirmDialog({
      message: 'Unpublish this page? It will revert to draft status.',
      onConfirm: () => {
        void (async () => {
          try {
            setPublishing(true);

            const response = await fetch(`/api/website/pages/${pageId}/publish`, {
              method: 'DELETE',
            });

            if (!response.ok) {
              const errorData: unknown = await response.json();
              const errorMessage = isErrorResponse(errorData) ? errorData.error : 'Failed to unpublish page';
              throw new Error(errorMessage);
            }

            // Update local page state
            setPage({ ...page, status: 'draft' });
            setConfirmDialog(null);
            setNotification({ message: 'Page unpublished successfully.', type: 'success' });
          } catch (error: unknown) {
            console.error('[Editor] Unpublish error:', error);
            const message = error instanceof Error ? error.message : 'Unknown error';
            setConfirmDialog(null);
            setNotification({ message: `Failed to unpublish page: ${message}`, type: 'error' });
          } finally {
            setPublishing(false);
          }
        })();
      },
    });
  }

  async function generatePreview(): Promise<void> {
    if (!page || !pageId) {
      setNotification({ message: 'Please save the page first before generating a preview.', type: 'error' });
      return;
    }

    try {
      const response = await fetch(`/api/website/pages/${pageId}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
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

      // Show the URL so user can copy it
      setPromptDialog({
        message: 'Preview link (valid for 24 hours):',
        defaultValue: result.previewUrl,
        onSubmit: () => {
          setPromptDialog(null);
        },
      });
      setPromptValue(result.previewUrl);
    } catch (error: unknown) {
      console.error('[Editor] Preview error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      setNotification({ message: `Failed to generate preview: ${message}`, type: 'error' });
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

    setConfirmDialog({
      message: 'Delete this section?',
      onConfirm: () => {
        updatePage({
          content: page.content.filter(s => s.id !== sectionId),
        });

        // Clear selection if deleting selected element
        if (selectedElement?.sectionId === sectionId) {
          setSelectedElement(null);
        }
        setConfirmDialog(null);
      },
    });
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

      {/* Notification */}
      {notification && (
        <div style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 9999, maxWidth: '400px' }}>
          <div style={{
            padding: '0.75rem',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            background: notification.type === 'success' ? 'var(--color-success)' : 'var(--color-error)',
            color: 'white',
            opacity: 0.9
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{notification.message}</span>
              <button onClick={() => setNotification(null)} style={{ marginLeft: '0.5rem', color: 'white', opacity: 0.8, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem' }}>&times;</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div style={{ backgroundColor: 'var(--color-bg-paper)', borderRadius: '12px', padding: '1.5rem', maxWidth: '400px', margin: '1rem', boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)' }}>
            <p style={{ color: 'var(--color-text-primary)', marginBottom: '1rem', fontSize: '1rem' }}>{confirmDialog.message}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button onClick={() => setConfirmDialog(null)} style={{ padding: '0.5rem 1rem', borderRadius: '8px', color: 'var(--color-text-disabled)', background: 'var(--color-bg-elevated)', border: 'none', cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmDialog.onConfirm} style={{ padding: '0.5rem 1rem', borderRadius: '8px', backgroundColor: 'var(--color-error)', color: 'white', border: 'none', cursor: 'pointer' }}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Prompt Dialog */}
      {promptDialog && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div style={{ backgroundColor: 'var(--color-bg-paper)', borderRadius: '12px', padding: '1.5rem', maxWidth: '400px', width: '100%', margin: '1rem', boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)' }}>
            <p style={{ color: 'var(--color-text-primary)', marginBottom: '1rem', fontSize: '1rem' }}>{promptDialog.message}</p>
            <input
              type="text"
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--color-border-light)', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  promptDialog.onSubmit(promptValue);
                }
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button onClick={() => setPromptDialog(null)} style={{ padding: '0.5rem 1rem', borderRadius: '8px', color: 'var(--color-text-disabled)', background: 'var(--color-bg-elevated)', border: 'none', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => promptDialog.onSubmit(promptValue)} style={{ padding: '0.5rem 1rem', borderRadius: '8px', backgroundColor: 'var(--color-info)', color: 'white', border: 'none', cursor: 'pointer' }}>Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

