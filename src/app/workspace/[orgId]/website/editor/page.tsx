/**
 * Visual Page Builder - Main Editor
 * Three-panel layout: Widgets | Canvas | Properties
 * CRITICAL: Multi-tenant - all pages scoped to organizationId
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import AdminBar from '@/components/AdminBar';
import WidgetsPanel from '@/components/website-builder/WidgetsPanel';
import EditorCanvas from '@/components/website-builder/EditorCanvas';
import PropertiesPanel from '@/components/website-builder/PropertiesPanel';
import EditorToolbar from '@/components/website-builder/EditorToolbar';
import VersionHistory from '@/components/website-builder/VersionHistory';
import SchedulePublishModal from '@/components/website-builder/SchedulePublishModal';
import type { Page, PageSection, Widget } from '@/types/website';
import { useEditorHistory } from '@/hooks/useEditorHistory';

export default function PageEditorPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const orgId = params.orgId as string;
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
    currentState, 
    canUndo, 
    canRedo, 
    pushState, 
    undo, 
    redo 
  } = useEditorHistory<Page>();

  useEffect(() => {
    if (pageId) {
      loadPage(pageId);
    } else {
      // Create new blank page
      createBlankPage();
    }
  }, [pageId]);

  // Auto-save every 30 seconds
  useEffect(() => {
    if (!autoSaveEnabled || !page) {return;}
    
    const interval = setInterval(() => {
      savePage(true); // Auto-save flag
    }, 30000);

    return () => clearInterval(interval);
  }, [page, autoSaveEnabled]);

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
        savePage(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo, page]);

  async function loadPage(id: string) {
    try {
      setLoading(true);
      const response = await fetch(`/api/website/pages/${id}?organizationId=${orgId}`);
      
      if (!response.ok) {throw new Error('Failed to load page');}
      
      const data = await response.json();
      setPage(data.page);
      pushState(data.page); // Initialize history
    } catch (error) {
      console.error('[Editor] Load error:', error);
      alert('Failed to load page');
    } finally {
      setLoading(false);
    }
  }

  function createBlankPage() {
    const newPage: Page = {
      id: `page_${Date.now()}`,
      organizationId: orgId,
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
  }

  async function savePage(isAutoSave: boolean = false) {
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
        alert('Page saved successfully!');
      }
    } catch (error) {
      console.error('[Editor] Save error:', error);
      if (!isAutoSave) {
        alert('Failed to save page');
      }
    } finally {
      setSaving(false);
    }
  }

  async function saveAsTemplate() {
    if (!page) {return;}

    const templateName = prompt('Enter a name for this template:', page.title);
    if (!templateName) {return;}

    const templateDescription = prompt('Enter a description (optional):', '');

    try {
      const response = await fetch('/api/website/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: orgId,
          template: {
            name: templateName,
            description: templateDescription || `Custom template based on ${page.title}`,
            category: 'other',
            thumbnail: `https://via.placeholder.com/400x300/6c757d/ffffff?text=${  encodeURIComponent(templateName)}`,
            content: page.content,
            isPublic: false,
            createdBy: (user?.email !== '' && user?.email != null) ? user.email : ((user?.displayName !== '' && user?.displayName != null) ? user.displayName : 'anonymous'),
          },
        }),
      });

      if (!response.ok) {throw new Error('Failed to save template');}

      alert('Template saved successfully! You can find it in the Templates page.');
    } catch (error) {
      console.error('[Editor] Save as template error:', error);
      alert('Failed to save template');
    }
  }

  async function publishPage(scheduledFor?: string) {
    if (!page || !pageId) {
      alert('Please save the page first before publishing.');
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
        const error = await response.json();
        throw new Error(error.error || 'Failed to publish page');
      }

      const result = await response.json();
      
      // Update local page state
      if (scheduledFor) {
        setPage({ ...page, status: 'scheduled', scheduledFor });
        alert(`Page scheduled for ${new Date(scheduledFor).toLocaleString()}! 📅`);
      } else {
        setPage({ ...page, status: 'published', publishedAt: result.publishedAt });
        alert('Page published successfully! 🚀');
      }
    } catch (error) {
      console.error('[Editor] Publish error:', error);
      alert(`Failed to publish page: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setPublishing(false);
    }
  }

  function handleSchedulePublish() {
    setShowScheduleModal(true);
  }

  function handleScheduleConfirm(scheduledDate: string) {
    setShowScheduleModal(false);
    publishPage(scheduledDate);
  }

  function handleRestoreVersion(version: any) {
    if (!page) {return;}

    // Restore the version content
    const restoredPage: Page = {
      ...page,
      content: version.content,
      seo: version.seo,
      title: version.title,
      slug: version.slug,
      status: 'draft' as const, // Restored pages become drafts
      updatedAt: new Date().toISOString(),
    };

    setPage(restoredPage);
    pushState(restoredPage);
    
    alert(`Restored to Version ${version.version}. Don't forget to save your changes!`);
  }

  async function unpublishPage() {
    if (!page || !pageId) {return;}

    if (!confirm('Unpublish this page? It will revert to draft status.')) {return;}

    try {
      setPublishing(true);
      
      const response = await fetch(`/api/website/pages/${pageId}/publish?organizationId=${orgId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to unpublish page');
      }

      // Update local page state
      setPage({ ...page, status: 'draft' });
      
      alert('Page unpublished successfully.');
    } catch (error) {
      console.error('[Editor] Unpublish error:', error);
      alert(`Failed to unpublish page: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setPublishing(false);
    }
  }

  async function generatePreview() {
    if (!page || !pageId) {
      alert('Please save the page first before generating a preview.');
      return;
    }

    try {
      const response = await fetch(`/api/website/pages/${pageId}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate preview');
      }

      const result = await response.json();
      
      // Open preview in new tab
      const previewUrl = result.previewUrl;
      window.open(previewUrl, '_blank');
      
      // Also show the URL so user can copy it
      prompt('Preview link (valid for 24 hours):', previewUrl);
    } catch (error) {
      console.error('[Editor] Preview error:', error);
      alert(`Failed to generate preview: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  function updatePage(updates: Partial<Page>) {
    if (!page) {return;}
    
    const updatedPage = { ...page, ...updates };
    setPage(updatedPage);
    pushState(updatedPage); // Save to history
  }

  function addSection(sectionData?: Partial<PageSection>) {
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

  function updateSection(sectionId: string, updates: Partial<PageSection>) {
    if (!page) {return;}

    const updatedContent = page.content.map(section =>
      section.id === sectionId ? { ...section, ...updates } : section
    );

    updatePage({ content: updatedContent });
  }

  function deleteSection(sectionId: string) {
    if (!page) {return;}
    if (!confirm('Delete this section?')) {return;}

    updatePage({
      content: page.content.filter(s => s.id !== sectionId),
    });

    // Clear selection if deleting selected element
    if (selectedElement?.sectionId === sectionId) {
      setSelectedElement(null);
    }
  }

  function addWidget(sectionId: string, widget: Widget, columnIndex: number = 0) {
    if (!page) {return;}

    const updatedContent = page.content.map(section => {
      if (section.id === sectionId) {
        const updatedColumns = [...section.columns];
        updatedColumns[columnIndex] = {
          ...updatedColumns[columnIndex],
          widgets: [...updatedColumns[columnIndex].widgets, widget],
        };
        return { ...section, columns: updatedColumns };
      }
      return section;
    });

    updatePage({ content: updatedContent });
  }

  function updateWidget(sectionId: string, widgetId: string, updates: Partial<Widget>) {
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

  function deleteWidget(sectionId: string, widgetId: string) {
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
        <AdminBar />
        <div>Loading editor...</div>
      </div>
    );
  }

  if (!page) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
        <AdminBar />
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
      <AdminBar />

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
        onSave={() => void savePage(false)}
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

