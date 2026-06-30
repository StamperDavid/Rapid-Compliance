/**
 * Visual Page Builder - Main Editor
 * Three-panel layout: Left Panel | Canvas | Properties
 *
 * Loads and saves the REAL page via /api/website/pages (canonical store
 * `website/pages/items`) — the same store the live `/sites/<slug>` site reads.
 * Branding/theme is loaded/saved separately to the `website-config` doc.
 */

'use client';


import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuthFetch } from '@/hooks/useAuthFetch';
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

// ============================================================================
// Canonical Page <- API response coercion
// ============================================================================

interface RawApiPage {
  id?: unknown;
  slug?: unknown;
  title?: unknown;
  content?: unknown;
  seo?: unknown;
  status?: unknown;
  version?: unknown;
}

function normalizeStatus(value: unknown): Page['status'] {
  if (value === 'published') {return 'published';}
  if (value === 'scheduled') {return 'scheduled';}
  return 'draft';
}

/** Coerce a raw `/api/website/pages` page object into the canonical Page type. */
function apiPageToPage(raw: unknown): Page | null {
  if (raw === null || typeof raw !== 'object') {return null;}
  const r = raw as RawApiPage;
  if (typeof r.id !== 'string') {return null;}
  const now = new Date().toISOString();
  return {
    id: r.id,
    slug: typeof r.slug === 'string' ? r.slug : '',
    title: typeof r.title === 'string' ? r.title : 'Untitled',
    content: Array.isArray(r.content) ? (r.content as PageSection[]) : [],
    seo: r.seo !== null && typeof r.seo === 'object' ? (r.seo as Page['seo']) : {},
    status: normalizeStatus(r.status),
    version: typeof r.version === 'number' ? r.version : 1,
    createdAt: now,
    updatedAt: now,
    createdBy: '',
    lastEditedBy: '',
  };
}

/** Build a lightweight EditorPage list entry (for the Pages panel) from a raw page. */
function apiPageToListEntry(raw: unknown): EditorPage | null {
  if (raw === null || typeof raw !== 'object') {return null;}
  const r = raw as RawApiPage;
  if (typeof r.id !== 'string') {return null;}
  return {
    id: r.id,
    name: typeof r.title === 'string' ? r.title : 'Untitled',
    slug: typeof r.slug === 'string' ? r.slug : '',
    sections: [],
    isPublished: r.status === 'published',
    isInNav: false,
    navOrder: 0,
  };
}

function extractPage(json: unknown): unknown {
  if (json !== null && typeof json === 'object' && 'page' in json) {
    return (json as { page: unknown }).page;
  }
  return null;
}

function extractPages(json: unknown): unknown[] {
  if (json !== null && typeof json === 'object' && 'pages' in json) {
    const pages = (json as { pages: unknown }).pages;
    return Array.isArray(pages) ? pages : [];
  }
  return [];
}

/** A blank, never-saved page used when there is no home page yet. */
function blankPage(): Page {
  const now = new Date().toISOString();
  return {
    id: `page_${Date.now()}`,
    slug: 'home',
    title: 'Home',
    content: [],
    seo: { metaTitle: '', metaDescription: '' },
    status: 'draft',
    version: 1,
    createdAt: now,
    updatedAt: now,
    createdBy: '',
    lastEditedBy: '',
  };
}

// ============================================================================
// MAIN EDITOR COMPONENT
// ============================================================================

function PageEditorInner() {
  const { user: _user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const authFetch = useAuthFetch();

  // Branding/theme + page list for the left panel (NOT the page content store)
  const [config, setConfig] = useState<WebsiteConfig | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string>('home');

  // Whether the current page already exists in the canonical store (PUT) or is
  // a brand-new page that still needs to be created (POST).
  const [pagePersisted, setPagePersisted] = useState(false);
  const didLoadRef = useRef(false);

  // Editor state (operates on the canonical Page shape directly)
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

      // 1. Branding/theme + page list for the left panel (separate store).
      const { FirestoreService } = await import('@/lib/db/firestore-service');
      const brandingDoc = await FirestoreService.get('platform', 'website-config');

      let branding = DEFAULT_CONFIG.branding;
      let navigation = DEFAULT_CONFIG.navigation;
      let footer = DEFAULT_CONFIG.footer;
      if (brandingDoc && typeof brandingDoc === 'object') {
        const bd = brandingDoc as Partial<WebsiteConfig>;
        if (bd.branding) {branding = bd.branding;}
        if (bd.navigation) {navigation = bd.navigation;}
        if (bd.footer) {footer = bd.footer;}
      }

      // 2. Canonical page list (for the Pages tab).
      let listEntries: EditorPage[] = [];
      try {
        const listRes = await authFetch('/api/website/pages');
        if (listRes.ok) {
          const listJson: unknown = await listRes.json();
          listEntries = extractPages(listJson)
            .map(apiPageToListEntry)
            .filter((p): p is EditorPage => p !== null);
        }
      } catch (listError) {
        logger.warn('[Editor] Could not load page list', { error: String(listError) });
      }

      // 3. Resolve the page to edit: ?pageId → that page; else the `home` page; else blank.
      const pageIdParam = searchParams.get('pageId');
      let resolvedPage: Page | null = null;
      let persisted = false;

      if (pageIdParam) {
        const res = await authFetch(`/api/website/pages/${encodeURIComponent(pageIdParam)}`);
        if (res.ok) {
          const json: unknown = await res.json();
          resolvedPage = apiPageToPage(extractPage(json));
          persisted = resolvedPage !== null;
        }
      }

      if (!resolvedPage) {
        const res = await authFetch('/api/website/pages?slug=home');
        if (res.ok) {
          const json: unknown = await res.json();
          const first = extractPages(json)[0];
          resolvedPage = apiPageToPage(first);
          persisted = resolvedPage !== null;
        }
      }

      if (!resolvedPage) {
        resolvedPage = blankPage();
        persisted = false;
        logger.info('[Editor] No saved page found — starting a blank Home page');
      }

      setConfig({ branding, pages: listEntries, navigation, footer });
      setPagePersisted(persisted);
      setSelectedPageId(resolvedPage.id);
      setPage(resolvedPage);
      pushState(resolvedPage);
      setHasUnsavedChanges(false);
    } catch (error) {
      logger.error('[Editor] Load error:', error instanceof Error ? error : new Error(String(error)));
      const fallback = blankPage();
      setConfig({
        branding: DEFAULT_CONFIG.branding,
        pages: [],
        navigation: DEFAULT_CONFIG.navigation,
        footer: DEFAULT_CONFIG.footer,
      });
      setPagePersisted(false);
      setSelectedPageId(fallback.id);
      setPage(fallback);
      pushState(fallback);
    } finally {
      setLoading(false);
    }
  }, [searchParams, pushState, authFetch]);

  useEffect(() => {
    if (authLoading) {return;}
    if (didLoadRef.current) {return;}
    didLoadRef.current = true;
    void loadConfig();
  }, [authLoading, loadConfig]);

  // ============================================================================
  // Switch page (fetch the chosen page directly; update the URL without reload)
  // ============================================================================

  const switchPage = React.useCallback(async (pageId: string) => {
    try {
      const res = await authFetch(`/api/website/pages/${encodeURIComponent(pageId)}`);
      if (!res.ok) {
        setNotification({ message: 'Could not open that page', type: 'error' });
        return;
      }
      const json: unknown = await res.json();
      const loaded = apiPageToPage(extractPage(json));
      if (!loaded) {
        setNotification({ message: 'Could not open that page', type: 'error' });
        return;
      }
      setSelectedPageId(loaded.id);
      setPage(loaded);
      setPagePersisted(true);
      pushState(loaded);
      setSelectedElement(null);
      setHasUnsavedChanges(false);
      window.history.replaceState(null, '', `/website/editor?pageId=${encodeURIComponent(loaded.id)}`);
    } catch (error) {
      logger.error('[Editor] Switch page error:', error instanceof Error ? error : new Error(String(error)));
      setNotification({ message: 'Could not open that page', type: 'error' });
    }
  }, [pushState, authFetch]);

  // ============================================================================
  // Save config to Firestore
  // ============================================================================

  /**
   * Persist the current page to the canonical store (`website/pages/items`)
   * via the pages API. Returns the saved page id, or null on failure.
   * Also writes branding/nav/footer to the separate `website-config` doc.
   */
  const persistPage = React.useCallback(async (): Promise<string | null> => {
    if (!page) {return null;}

    const body = {
      page: {
        title: page.title,
        slug: page.slug,
        status: page.status ?? 'draft',
        content: page.content,
        seo: page.seo,
      },
    };

    let savedId: string | null = null;

    if (pagePersisted) {
      // Existing page → update in place.
      const res = await authFetch(`/api/website/pages/${encodeURIComponent(page.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(`Save failed (${res.status})`);
      }
      savedId = page.id;
    } else {
      // New page → create it.
      const res = await authFetch('/api/website/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errJson: unknown = await res.json().catch(() => null);
        const detail =
          errJson !== null && typeof errJson === 'object' && 'error' in errJson
            ? String((errJson as { error: unknown }).error)
            : `Save failed (${res.status})`;
        throw new Error(detail);
      }
      const json: unknown = await res.json();
      const created = apiPageToPage(extractPage(json));
      savedId = created?.id ?? null;

      if (savedId) {
        // Adopt the persisted id so subsequent saves update instead of recreating.
        setPage(prev => (prev ? { ...prev, id: savedId as string } : prev));
        setSelectedPageId(savedId);
        setPagePersisted(true);
        window.history.replaceState(null, '', `/website/editor?pageId=${encodeURIComponent(savedId)}`);
      }
    }

    // Persist branding/nav/footer separately (used by the public site theme).
    if (config) {
      const { FirestoreService } = await import('@/lib/db/firestore-service');
      await FirestoreService.set('platform', 'website-config', {
        branding: config.branding,
        navigation: config.navigation,
        footer: config.footer,
      } as Record<string, unknown>);
    }

    return savedId;
  }, [page, config, pagePersisted, authFetch]);

  const saveConfig = React.useCallback(async (isAutoSave: boolean = false): Promise<string | null> => {
    if (!page) {return null;}
    try {
      setSaving(true);
      const savedId = await persistPage();
      setHasUnsavedChanges(false);
      if (!isAutoSave) {
        setNotification({ message: 'Saved successfully!', type: 'success' });
      }
      return savedId;
    } catch (error) {
      logger.error('[Editor] Save error:', error instanceof Error ? error : new Error(String(error)));
      if (!isAutoSave) {
        const message = error instanceof Error ? error.message : 'Failed to save';
        setNotification({ message, type: 'error' });
      }
      return null;
    } finally {
      setSaving(false);
    }
  }, [page, persistPage]);

  // ============================================================================
  // Publish — save the latest content, then flip the page live
  // ============================================================================

  const publishPage = React.useCallback(async (): Promise<void> => {
    if (!page) {return;}
    try {
      setPublishing(true);

      // Save current edits first so the live page matches the editor.
      const savedId = await persistPage();
      if (!savedId) {
        setNotification({ message: 'Could not save the page before publishing', type: 'error' });
        return;
      }

      const res = await authFetch(`/api/website/pages/${encodeURIComponent(savedId)}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        throw new Error(`Publish failed (${res.status})`);
      }

      setPage(prev => (prev ? { ...prev, status: 'published' } : prev));
      setConfig(prev =>
        prev
          ? { ...prev, pages: prev.pages.map(p => (p.id === savedId ? { ...p, isPublished: true } : p)) }
          : prev
      );
      setHasUnsavedChanges(false);
      setNotification({ message: 'Your page is now live!', type: 'success' });
    } catch (error) {
      logger.error('[Editor] Publish error:', error instanceof Error ? error : new Error(String(error)));
      setNotification({ message: 'Failed to publish', type: 'error' });
    } finally {
      setPublishing(false);
    }
  }, [page, persistPage, authFetch]);

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
    if (!page) {return;}
    const defaultPage =
      DEFAULT_CONFIG.pages.find(p => p.id === selectedPageId) ??
      DEFAULT_CONFIG.pages.find(p => p.slug === page.slug);
    if (!defaultPage) {
      setNotification({ message: 'No default content exists for this page', type: 'error' });
      return;
    }

    setConfirmDialog({
      message: `Reset "${defaultPage.name}" to its default content? This cannot be undone.`,
      onConfirm: () => {
        const converted = editorPageToPage(defaultPage);
        // Keep this page's identity/slug so the reset still saves to the same record.
        const reset: Page = { ...converted, id: page.id, slug: page.slug, status: page.status };
        setPage(reset);
        pushState(reset);
        setHasUnsavedChanges(true);
        setConfirmDialog(null);
        setNotification({ message: 'Page reset to default. Don\'t forget to save!', type: 'success' });
      },
    });
  }, [selectedPageId, page, pushState]);

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
      <div className="p-8 bg-black text-white h-screen flex items-center justify-center">
        <div>Loading editor...</div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="p-8 bg-black text-white h-screen flex items-center justify-center">
        <div>Failed to load page</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden font-sans">
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
        onPublish={() => void publishPage()}
        saving={saving}
        publishing={publishing}
        autoSaveEnabled={autoSaveEnabled}
        onToggleAutoSave={() => setAutoSaveEnabled(!autoSaveEnabled)}
        hasUnsavedChanges={hasUnsavedChanges}
      />

      {/* Three-Panel Layout */}
      <div className="flex flex-1 overflow-hidden">
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
          onSwitchPage={(id) => void switchPage(id)}
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
        <div className="fixed top-4 right-4 z-[9999] max-w-sm">
          <div className={`px-4 py-3 rounded-lg text-sm shadow-lg text-white flex items-center justify-between gap-2 ${notification.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
            <span>{notification.message}</span>
            <button onClick={() => setNotification(null)} className="opacity-80 hover:opacity-100 cursor-pointer bg-transparent border-none text-white text-xl leading-none">&times;</button>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70">
          <div className="bg-[#1a1a2e] rounded-xl p-6 max-w-sm mx-4 shadow-2xl border border-white/10">
            <p className="text-white mb-4 text-base">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDialog(null)} className="px-4 py-2 rounded-lg text-white/60 bg-white/10 border-none cursor-pointer">Cancel</button>
              <button onClick={confirmDialog.onConfirm} className="px-4 py-2 rounded-lg bg-red-500 text-white border-none cursor-pointer">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Suspense wrapper (required because PageEditorInner uses useSearchParams)
// ============================================================================

export default function PageEditorPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 bg-black text-white h-screen flex items-center justify-center">
          <div>Loading editor...</div>
        </div>
      }
    >
      <PageEditorInner />
    </Suspense>
  );
}
