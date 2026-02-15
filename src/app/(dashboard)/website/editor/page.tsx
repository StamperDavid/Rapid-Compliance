/**
 * Visual Page Builder - Main Editor
 * Three-panel layout: Left Panel | Canvas | Properties
 *
 * Saves to FirestoreService('platform', 'website-editor-config') — the same path
 * that usePageContent() reads from on public pages.
 */

'use client';


import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import WidgetsPanel from '@/components/website-builder/WidgetsPanel';
import EditorCanvas from '@/components/website-builder/EditorCanvas';
import PropertiesPanel from '@/components/website-builder/PropertiesPanel';
import EditorToolbar from '@/components/website-builder/EditorToolbar';
import type { Page, PageSection, Widget } from '@/types/website';
import type { WebsiteConfig, EditorPage, EditorPageSection, WidgetElement } from '@/types/website-editor';
import { DEFAULT_CONFIG } from '@/lib/website-builder/default-config';
import { useEditorHistory } from '@/hooks/useEditorHistory';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// Conversion helpers: EditorPage <-> Page (existing widget system)
// ============================================================================

/** Convert an EditorPageSection (responsive styles) to a PageSection (current widget system) */
function editorSectionToPageSection(section: EditorPageSection): PageSection {
  return {
    id: section.id,
    type: 'section',
    name: section.name,
    columns: [{
      id: `col_${section.id}`,
      width: 100,
      widgets: section.children.map(child => editorWidgetToWidget(child)),
    }],
    backgroundColor: section.styles.desktop.backgroundColor,
    padding: {
      top: section.styles.desktop.paddingTop ?? section.styles.desktop.padding?.split(' ')[0],
      right: section.styles.desktop.paddingRight ?? section.styles.desktop.padding?.split(' ')[1],
      bottom: section.styles.desktop.paddingBottom ?? section.styles.desktop.padding?.split(' ')[2],
      left: section.styles.desktop.paddingLeft ?? section.styles.desktop.padding?.split(' ')[3],
    },
  };
}

/** Convert a WidgetElement to the current Widget type */
function editorWidgetToWidget(element: WidgetElement): Widget {
  const ds = element.styles.desktop;
  return {
    id: element.id,
    type: element.type as Widget['type'],
    data: typeof element.content === 'object' && element.content !== null
      ? element.content as Record<string, unknown>
      : typeof element.content === 'string'
        ? { text: element.content, content: element.content }
        : {},
    style: {
      fontSize: ds.fontSize,
      fontWeight: ds.fontWeight,
      fontFamily: ds.fontFamily,
      lineHeight: ds.lineHeight,
      letterSpacing: ds.letterSpacing,
      textAlign: ds.textAlign as 'left' | 'center' | 'right' | 'justify' | undefined,
      textTransform: ds.textTransform as 'none' | 'uppercase' | 'lowercase' | 'capitalize' | undefined,
      color: ds.color,
      backgroundColor: ds.backgroundColor,
      border: ds.border,
      borderRadius: ds.borderRadius,
      borderWidth: ds.borderWidth,
      borderColor: ds.borderColor,
      borderStyle: ds.borderStyle as 'solid' | 'dashed' | 'dotted' | undefined,
      boxShadow: ds.boxShadow,
      opacity: ds.opacity ? parseFloat(ds.opacity) : undefined,
      transform: ds.transform,
      transition: ds.transition,
      backgroundImage: ds.backgroundImage,
      backgroundSize: ds.backgroundSize as 'cover' | 'contain' | 'auto' | undefined,
      backgroundPosition: ds.backgroundPosition,
      width: ds.width,
      height: ds.height,
      maxWidth: ds.maxWidth,
      minHeight: ds.minHeight,
      display: ds.display as 'block' | 'inline-block' | 'flex' | 'grid' | undefined,
      flexDirection: ds.flexDirection as 'row' | 'column' | undefined,
      alignItems: ds.alignItems as 'flex-start' | 'center' | 'flex-end' | 'stretch' | undefined,
      justifyContent: ds.justifyContent as 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | undefined,
      padding: ds.padding ? parsePaddingString(ds.padding) : undefined,
      margin: ds.margin ? parsePaddingString(ds.margin) : (ds.marginBottom ? { bottom: ds.marginBottom } : undefined),
    },
  };
}

/** Parse a CSS padding/margin string like "120px 20px 80px" into Spacing */
function parsePaddingString(value: string): { top?: string; right?: string; bottom?: string; left?: string } {
  const parts = value.split(' ').filter(Boolean);
  if (parts.length === 1) {return { top: parts[0], right: parts[0], bottom: parts[0], left: parts[0] };}
  if (parts.length === 2) {return { top: parts[0], right: parts[1], bottom: parts[0], left: parts[1] };}
  if (parts.length === 3) {return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[1] };}
  return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[3] };
}

/** Convert an EditorPage to the existing Page type for the canvas */
function editorPageToPage(editorPage: EditorPage): Page {
  return {
    id: editorPage.id,
    slug: editorPage.slug,
    title: editorPage.name,
    content: editorPage.sections.map(editorSectionToPageSection),
    seo: {
      metaTitle: editorPage.metaTitle ?? '',
      metaDescription: editorPage.metaDescription ?? '',
    },
    status: editorPage.isPublished ? 'published' : 'draft',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: '',
    lastEditedBy: '',
  };
}

/** Convert the current Page back to EditorPage format for saving */
function pageToEditorPage(page: Page, original: EditorPage): EditorPage {
  return {
    ...original,
    name: page.title,
    slug: page.slug,
    isPublished: page.status === 'published',
    metaTitle: page.seo.metaTitle,
    metaDescription: page.seo.metaDescription,
    sections: page.content.map(section => pageSectionToEditorSection(section)),
  };
}

function pageSectionToEditorSection(section: PageSection): EditorPageSection {
  const allWidgets = section.columns.flatMap(col => col.widgets);
  const paddingStr = section.padding
    ? `${section.padding.top ?? '0'} ${section.padding.right ?? '0'} ${section.padding.bottom ?? '0'} ${section.padding.left ?? '0'}`
    : undefined;
  return {
    id: section.id,
    type: 'section',
    name: section.name ?? 'Section',
    visible: true,
    styles: {
      desktop: {
        backgroundColor: section.backgroundColor,
        padding: paddingStr,
      },
    },
    children: allWidgets.map(w => widgetToEditorWidget(w)),
  };
}

function widgetToEditorWidget(widget: Widget): WidgetElement {
  const style = widget.style ?? {};
  const desktop: Record<string, string | undefined> = {};

  // Map all style properties
  if (style.fontSize) {desktop.fontSize = style.fontSize;}
  if (style.fontWeight) {desktop.fontWeight = String(style.fontWeight);}
  if (style.fontFamily) {desktop.fontFamily = style.fontFamily;}
  if (style.lineHeight) {desktop.lineHeight = style.lineHeight;}
  if (style.letterSpacing) {desktop.letterSpacing = style.letterSpacing;}
  if (style.textAlign) {desktop.textAlign = style.textAlign;}
  if (style.textTransform) {desktop.textTransform = style.textTransform;}
  if (style.color) {desktop.color = style.color;}
  if (style.backgroundColor) {desktop.backgroundColor = style.backgroundColor;}
  if (style.border) {desktop.border = style.border;}
  if (style.borderRadius) {desktop.borderRadius = style.borderRadius;}
  if (style.borderWidth) {desktop.borderWidth = style.borderWidth;}
  if (style.borderColor) {desktop.borderColor = style.borderColor;}
  if (style.borderStyle) {desktop.borderStyle = style.borderStyle;}
  if (style.boxShadow) {desktop.boxShadow = style.boxShadow;}
  if (style.opacity !== undefined) {desktop.opacity = String(style.opacity);}
  if (style.transform) {desktop.transform = style.transform;}
  if (style.transition) {desktop.transition = style.transition;}
  if (style.backgroundImage) {desktop.backgroundImage = style.backgroundImage;}
  if (style.backgroundSize) {desktop.backgroundSize = style.backgroundSize;}
  if (style.backgroundPosition) {desktop.backgroundPosition = style.backgroundPosition;}
  if (style.width) {desktop.width = style.width;}
  if (style.height) {desktop.height = style.height;}
  if (style.maxWidth) {desktop.maxWidth = style.maxWidth;}
  if (style.minHeight) {desktop.minHeight = style.minHeight;}
  if (style.display) {desktop.display = style.display;}
  if (style.flexDirection) {desktop.flexDirection = style.flexDirection;}
  if (style.alignItems) {desktop.alignItems = style.alignItems;}
  if (style.justifyContent) {desktop.justifyContent = style.justifyContent;}
  if (style.margin) {
    const m = style.margin;
    if (m.bottom) {desktop.marginBottom = m.bottom;}
    if (m.top) {desktop.marginTop = m.top;}
  }
  if (style.padding) {
    const p = style.padding;
    desktop.padding = `${p.top ?? '0'} ${p.right ?? '0'} ${p.bottom ?? '0'} ${p.left ?? '0'}`;
  }

  // Determine content: if widget.data has text/content fields, use those as string
  let content: unknown = widget.data;
  if (widget.data.text && typeof widget.data.text === 'string' && Object.keys(widget.data).length <= 3) {
    content = widget.data.text;
  } else if (widget.data.content && typeof widget.data.content === 'string' && Object.keys(widget.data).length <= 2) {
    content = widget.data.content;
  }

  return {
    id: widget.id,
    type: widget.type,
    content,
    styles: { desktop: desktop as Record<string, string> },
    settings: widget.data.tag ? { tag: widget.data.tag as string, ...((widget.data.href ? { href: widget.data.href as string } : {})) } : undefined,
  };
}

// ============================================================================
// MAIN EDITOR COMPONENT
// ============================================================================

export default function PageEditorPage() {
  const { user: _user, loading: authLoading } = useAuth();

  // Full website config from Firestore
  const [config, setConfig] = useState<WebsiteConfig | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string>('home');

  // Editor state (operates on a single page converted to Page type)
  const [page, setPage] = useState<Page | null>(null);
  const [selectedElement, setSelectedElement] = useState<{
    type: 'section' | 'widget';
    sectionId: string;
    widgetId?: string;
  } | null>(null);
  const [breakpoint, setBreakpoint] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);

  // Undo/Redo history
  const {
    canUndo,
    canRedo,
    pushState,
    undo,
    redo
  } = useEditorHistory<Page>();

  // ============================================================================
  // Load config from Firestore
  // ============================================================================

  const loadConfig = React.useCallback(async () => {
    try {
      setLoading(true);
      const { FirestoreService } = await import('@/lib/db/firestore-service');
      const data = await FirestoreService.get('platform', 'website-editor-config');

      let websiteConfig: WebsiteConfig;

      if (data && typeof data === 'object' && 'pages' in data) {
        websiteConfig = data as unknown as WebsiteConfig;
        // Merge with defaults to ensure all pages exist
        if (!websiteConfig.branding) {websiteConfig.branding = DEFAULT_CONFIG.branding;}
        if (!websiteConfig.navigation) {websiteConfig.navigation = DEFAULT_CONFIG.navigation;}
        if (!websiteConfig.footer) {websiteConfig.footer = DEFAULT_CONFIG.footer;}
      } else {
        // No config in Firestore — use defaults
        websiteConfig = { ...DEFAULT_CONFIG };
        logger.info('[Editor] No config in Firestore, using defaults');
      }

      setConfig(websiteConfig);

      // Load the selected page (default: home)
      const targetPage = websiteConfig.pages.find(p => p.id === selectedPageId) ?? websiteConfig.pages[0];
      if (targetPage) {
        const converted = editorPageToPage(targetPage);
        setPage(converted);
        pushState(converted);
      }
    } catch (error) {
      logger.error('[Editor] Load error:', error instanceof Error ? error : new Error(String(error)));
      // Fallback to defaults
      const websiteConfig = { ...DEFAULT_CONFIG };
      setConfig(websiteConfig);
      const homePage = editorPageToPage(websiteConfig.pages[0]);
      setPage(homePage);
      pushState(homePage);
    } finally {
      setLoading(false);
    }
  }, [selectedPageId, pushState]);

  useEffect(() => {
    if (authLoading) {return;}
    void loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  // ============================================================================
  // Switch page
  // ============================================================================

  const switchPage = React.useCallback((pageId: string) => {
    if (!config) {return;}
    const targetPage = config.pages.find(p => p.id === pageId);
    if (!targetPage) {return;}

    setSelectedPageId(pageId);
    const converted = editorPageToPage(targetPage);
    setPage(converted);
    pushState(converted);
    setSelectedElement(null);
    setHasUnsavedChanges(false);
  }, [config, pushState]);

  // ============================================================================
  // Save config to Firestore
  // ============================================================================

  const saveConfig = React.useCallback(async (isAutoSave: boolean = false): Promise<void> => {
    if (!page || !config) {return;}

    try {
      setSaving(true);

      // Update the current page in config
      const currentEditorPage = config.pages.find(p => p.id === selectedPageId);
      if (!currentEditorPage) {return;}

      const updatedEditorPage = pageToEditorPage(page, currentEditorPage);
      const updatedPages = config.pages.map(p =>
        p.id === selectedPageId ? updatedEditorPage : p
      );

      const updatedConfig: WebsiteConfig = {
        ...config,
        pages: updatedPages,
        updatedAt: new Date().toISOString(),
      };

      const { FirestoreService } = await import('@/lib/db/firestore-service');

      // Save to the same path usePageContent reads from
      await FirestoreService.set('platform', 'website-editor-config', updatedConfig as unknown as Record<string, unknown>, false);

      // Also save branding/nav/footer for useWebsiteTheme
      await FirestoreService.set('platform', 'website-config', {
        branding: updatedConfig.branding,
        navigation: updatedConfig.navigation,
        footer: updatedConfig.footer,
      } as Record<string, unknown>);

      setConfig(updatedConfig);
      setHasUnsavedChanges(false);

      if (!isAutoSave) {
        setNotification({ message: 'Saved successfully!', type: 'success' });
      }
    } catch (error) {
      logger.error('[Editor] Save error:', error instanceof Error ? error : new Error(String(error)));
      if (!isAutoSave) {
        setNotification({ message: 'Failed to save', type: 'error' });
      }
    } finally {
      setSaving(false);
    }
  }, [page, config, selectedPageId]);

  // Auto-save every 30 seconds
  useEffect(() => {
    if (!autoSaveEnabled || !page || !hasUnsavedChanges) {return;}

    const interval = setInterval(() => {
      void saveConfig(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [page, autoSaveEnabled, hasUnsavedChanges, saveConfig]);

  // ============================================================================
  // Reset page to default
  // ============================================================================

  const resetPage = React.useCallback(() => {
    const defaultPage = DEFAULT_CONFIG.pages.find(p => p.id === selectedPageId);
    if (!defaultPage || !config) {return;}

    setConfirmDialog({
      message: `Reset "${defaultPage.name}" to its default content? This cannot be undone.`,
      onConfirm: () => {
        const converted = editorPageToPage(defaultPage);
        setPage(converted);
        pushState(converted);
        setHasUnsavedChanges(true);

        // Also update in config
        const updatedPages = config.pages.map(p =>
          p.id === selectedPageId ? defaultPage : p
        );
        setConfig({ ...config, pages: updatedPages });
        setConfirmDialog(null);
        setNotification({ message: 'Page reset to default. Don\'t forget to save!', type: 'success' });
      },
    });
  }, [selectedPageId, config, pushState]);

  // ============================================================================
  // Keyboard shortcuts
  // ============================================================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) {
          const previousState = undo();
          if (previousState) { setPage(previousState); setHasUnsavedChanges(true); }
        }
      }
      if ((e.ctrlKey || e.metaKey) && ((e.shiftKey && e.key === 'z') || e.key === 'y')) {
        e.preventDefault();
        if (canRedo) {
          const nextState = redo();
          if (nextState) { setPage(nextState); setHasUnsavedChanges(true); }
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        void saveConfig(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo, undo, redo, saveConfig]);

  // ============================================================================
  // Page mutation helpers
  // ============================================================================

  function updatePage(updates: Partial<Page>): void {
    if (!page) {return;}
    const updatedPage = { ...page, ...updates };
    setPage(updatedPage);
    pushState(updatedPage);
    setHasUnsavedChanges(true);
  }

  function addSection(sectionData?: Partial<PageSection>): void {
    if (!page) {return;}
    const newSection: PageSection = {
      id: `section_${Date.now()}`,
      type: 'section',
      columns: [{
        id: `col_${Date.now()}`,
        width: 100,
        widgets: [],
      }],
      padding: { top: '2rem', bottom: '2rem' },
      ...sectionData,
    };
    updatePage({ content: [...page.content, newSection] });
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
        updatePage({ content: page.content.filter(s => s.id !== sectionId) });
        if (selectedElement?.sectionId === sectionId) {setSelectedElement(null);}
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
    if (selectedElement?.widgetId === widgetId) {setSelectedElement(null);}
  }

  // ============================================================================
  // Update branding
  // ============================================================================

  function updateBranding(updates: Partial<WebsiteConfig['branding']>): void {
    if (!config) {return;}
    setConfig({
      ...config,
      branding: { ...config.branding, ...updates },
    });
    setHasUnsavedChanges(true);
  }

  // ============================================================================
  // Render
  // ============================================================================

  if (loading) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'Inter, system-ui, sans-serif', background: '#000', color: '#fff', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>Loading editor...</div>
      </div>
    );
  }

  if (!page) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'Inter, system-ui, sans-serif', background: '#000', color: '#fff', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>Failed to load page</div>
      </div>
    );
  }

  return (
    <div style={{
      fontFamily: 'Inter, system-ui, sans-serif',
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
          if (prev) { setPage(prev); setHasUnsavedChanges(true); }
        }}
        onRedo={() => {
          const next = redo();
          if (next) { setPage(next); setHasUnsavedChanges(true); }
        }}
        onSave={() => void saveConfig(false)}
        onReset={resetPage}
        saving={saving}
        publishing={false}
        autoSaveEnabled={autoSaveEnabled}
        onToggleAutoSave={() => setAutoSaveEnabled(!autoSaveEnabled)}
        hasUnsavedChanges={hasUnsavedChanges}
      />

      {/* Three-Panel Layout */}
      <div style={{
        display: 'flex',
        flex: 1,
        overflow: 'hidden',
      }}>
        {/* Left Panel: Widgets / Pages / Branding */}
        <WidgetsPanel
          onAddWidget={(widget) => {
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
          config={config ?? undefined}
          selectedPageId={selectedPageId}
          onSwitchPage={switchPage}
          onUpdateBranding={updateBranding}
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

      {/* Notification */}
      {notification && (
        <div style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 9999, maxWidth: '400px' }}>
          <div style={{
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
            background: notification.type === 'success' ? '#10b981' : '#ef4444',
            color: 'white',
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
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.7)' }}>
          <div style={{ backgroundColor: '#1a1a2e', borderRadius: '12px', padding: '1.5rem', maxWidth: '400px', margin: '1rem', boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <p style={{ color: '#ffffff', marginBottom: '1rem', fontSize: '1rem' }}>{confirmDialog.message}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button onClick={() => setConfirmDialog(null)} style={{ padding: '0.5rem 1rem', borderRadius: '8px', color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmDialog.onConfirm} style={{ padding: '0.5rem 1rem', borderRadius: '8px', backgroundColor: '#ef4444', color: 'white', border: 'none', cursor: 'pointer' }}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
