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
import ChromeEditor from '@/components/website-builder/ChromeEditor';
import EditorToolbar from '@/components/website-builder/EditorToolbar';
import { LayersPanel, type LayerTarget, type LayerReorder } from '@/components/website-builder/LayersPanel';
import type { Page, PageSection, Widget } from '@/types/website';
import {
  findWidget,
  findWidgetSectionId,
  moveWidget,
  moveSection,
  duplicateWidget,
  duplicateSection,
  setWidgetHidden,
  setColumnLayout,
  setColumnWidths,
  buildSection,
  insertSection,
  insertWidget,
  updateWidget as updateWidgetOp,
  deleteWidget as deleteWidgetOp,
  deleteSection as deleteSectionOp,
  type WidgetDestination,
} from '@/lib/website-builder/page-tree-ops';
import { isContainerType } from '@/lib/website-builder/widget-definitions';
import { DEFAULT_SITE_CHROME, type SiteChrome, type ChromeRegion } from '@/lib/website-builder/site-chrome-types';
import { loadSiteChrome, SITE_CHROME_API_PATH } from '@/lib/website-builder/site-chrome-service';
import type { WebsiteConfig, EditorPage, EditorPageSection, WidgetElement } from '@/types/website-editor';
import { DEFAULT_CONFIG } from '@/lib/website-builder/default-config';
import { useEditorHistory } from '@/hooks/useEditorHistory';
import { logger } from '@/lib/logger/logger';
import { BlockLibrary } from '@/components/website-builder/BlockLibrary';
import { loadBlocks, saveBlock } from '@/lib/website-builder/block-library-service';
import { BLOCK_CATEGORY_LABELS, type SectionBlock, type BlockCategory } from '@/lib/website-builder/section-blocks';
import { FontLoader } from '@/components/website-builder/FontLoader';
import { collectUsedFonts } from '@/lib/website-builder/font-catalog';

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
//
// Site-chrome persistence (banner / header / footer):
//   - `loadSiteChrome()` reads the saved DRAFT from `SITE_CHROME_API_PATH`
//     (`/api/website-builder/chrome`); it falls back to DEFAULT_SITE_CHROME when
//     nothing is saved, so the editor looks identical to the live site at first.
//   - Edits are saved back to that SAME draft store via a debounced PUT
//     (`persistChrome` below).
//   - This is EDITOR-SIDE ONLY: `PublicLayout` / `EarlyAccessBanner` render the
//     live chrome and do NOT read this draft doc, so editing here can never
//     change the public site. Applying a draft to the live site is a separate
//     deliberate step (not built here).

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
  // Debounce timer for saving chrome edits to the draft store.
  const chromeSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // In-memory clipboard for Ctrl/Cmd+C / +V of a widget.
  const widgetClipboard = useRef<Widget | null>(null);

  // Editor state (operates on the canonical Page shape directly)
  const [page, setPage] = useState<Page | null>(null);
  const [selectedElement, setSelectedElement] = useState<{
    type: 'section' | 'widget';
    sectionId: string;
    widgetId?: string;
  } | null>(null);
  const [breakpoint, setBreakpoint] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [showNavigator, setShowNavigator] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [blocks, setBlocks] = useState<{ premade: SectionBlock[]; saved: SectionBlock[] }>({ premade: [], saved: [] });
  const [blocksLoading, setBlocksLoading] = useState(true);
  const [saveBlockFor, setSaveBlockFor] = useState<string | null>(null);
  const [saveBlockName, setSaveBlockName] = useState('');
  const [saveBlockCategory, setSaveBlockCategory] = useState<BlockCategory>('content');

  // Site chrome (banner / header / footer) + which region is selected for editing.
  // Chrome edits are mutually exclusive with body widget/section selection.
  const [chrome, setChrome] = useState<SiteChrome | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<ChromeRegion | null>(null);

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

      // Site chrome: load the saved draft (or defaults) from the draft store the
      // service reads. Never touches the live site (PublicLayout reads its own).
      try {
        setChrome(await loadSiteChrome());
      } catch (chromeError) {
        logger.warn('[Editor] Could not load site chrome — using defaults', { error: String(chromeError) });
        setChrome(DEFAULT_SITE_CHROME);
      }
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
      setChrome(DEFAULT_SITE_CHROME);
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

  // Clear any pending chrome-save debounce on unmount.
  useEffect(() => {
    return () => {
      if (chromeSaveTimer.current) {
        clearTimeout(chromeSaveTimer.current);
      }
    };
  }, []);

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
  // Element shortcuts — copy / paste / duplicate / delete for the selected
  // widget or section. Guarded so they never fire while typing in a field.
  // ============================================================================

  useEffect(() => {
    const isTyping = (): boolean => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) {return false;}
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    };

    const apply = (next: Page): void => {
      setPage(next);
      pushState(next);
      setHasUnsavedChanges(true);
    };

    const freshId = (type: string): string =>
      `${type}-paste-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const handler = (e: KeyboardEvent): void => {
      if (!page || !selectedElement || isTyping()) {return;}
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Copy the selected widget to the in-memory clipboard.
      if (mod && key === 'c') {
        if (selectedElement.type === 'widget' && selectedElement.widgetId) {
          const loc = findWidget(page, selectedElement.widgetId);
          if (loc) {widgetClipboard.current = JSON.parse(JSON.stringify(loc.widget)) as Widget;}
        }
        return;
      }

      // Paste the clipboard widget after the selection (as a fresh duplicate).
      if (mod && key === 'v') {
        const clip = widgetClipboard.current;
        if (!clip) {return;}
        e.preventDefault();
        const cloned: Widget = { ...(JSON.parse(JSON.stringify(clip)) as Widget), id: freshId(clip.type) };
        if (selectedElement.type === 'widget' && selectedElement.widgetId) {
          const loc = findWidget(page, selectedElement.widgetId);
          if (loc) {
            // Paste into the SAME parent (column or container), right after the
            // currently-selected widget.
            apply(insertWidget(page, loc.parent, cloned, loc.index + 1));
            setSelectedElement({ type: 'widget', sectionId: selectedElement.sectionId, widgetId: cloned.id });
          }
          return;
        }
        apply(insertWidget(page, { kind: 'column', sectionId: selectedElement.sectionId, columnIndex: 0 }, cloned));
        setSelectedElement({ type: 'widget', sectionId: selectedElement.sectionId, widgetId: cloned.id });
        return;
      }

      // Duplicate the selected widget or section in place.
      if (mod && key === 'd') {
        e.preventDefault();
        if (selectedElement.type === 'widget' && selectedElement.widgetId) {
          const { page: next, newWidgetId } = duplicateWidget(page, selectedElement.widgetId);
          apply(next);
          const secId = findWidgetSectionId(next, newWidgetId);
          if (secId) {setSelectedElement({ type: 'widget', sectionId: secId, widgetId: newWidgetId });}
        } else {
          const { page: next, newSectionId } = duplicateSection(page, selectedElement.sectionId);
          apply(next);
          if (newSectionId) {setSelectedElement({ type: 'section', sectionId: newSectionId });}
        }
        return;
      }

      // Delete the selected element (undoable).
      if (key === 'delete' || key === 'backspace') {
        e.preventDefault();
        if (selectedElement.type === 'widget' && selectedElement.widgetId) {
          apply(deleteWidgetOp(page, selectedElement.widgetId));
        } else {
          apply(deleteSectionOp(page, selectedElement.sectionId));
        }
        setSelectedElement(null);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [page, selectedElement, pushState]);

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

  // Recursive: edits the widget wherever it lives (column child OR nested inside
  // a container). `sectionId` is ignored — the widget id is globally unique.
  function updateWidget(_sectionId: string, widgetId: string, updates: Partial<Widget>): void {
    if (!page) {return;}
    updatePage({ content: updateWidgetOp(page, widgetId, updates).content });
  }

  // Recursive delete (column child OR nested container child).
  function deleteWidget(_sectionId: string, widgetId: string): void {
    if (!page) {return;}
    updatePage({ content: deleteWidgetOp(page, widgetId).content });
    if (selectedElement?.widgetId === widgetId) {setSelectedElement(null);}
  }

  // Insert a widget INTO a container widget's children (true nesting), then
  // select the new child so its properties open immediately.
  function addWidgetToContainer(containerId: string, widget: Widget, index?: number): void {
    if (!page) {return;}
    const sectionId = findWidgetSectionId(page, containerId) ?? '';
    commitPage(insertWidget(page, { kind: 'container', containerId }, widget, index));
    setSelectedElement({ type: 'widget', sectionId, widgetId: widget.id });
  }

  // ============================================================================
  // Layout engine — structural ops via pure page-tree-ops (drag, duplicate,
  // hide, column structure). Each applies a NEW Page, records undo history,
  // marks dirty (the existing auto-save then persists, editor-side only).
  // ============================================================================

  function commitPage(next: Page): void {
    setPage(next);
    pushState(next);
    setHasUnsavedChanges(true);
  }

  function onMoveWidget(widgetId: string, dest: WidgetDestination): void {
    if (!page) {return;}
    commitPage(moveWidget(page, widgetId, dest));
  }

  function onMoveSection(sectionId: string, toIndex: number): void {
    if (!page) {return;}
    commitPage(moveSection(page, sectionId, toIndex));
  }

  function onDuplicateWidget(widgetId: string): void {
    if (!page) {return;}
    const { page: next, newWidgetId } = duplicateWidget(page, widgetId);
    commitPage(next);
    const secId = findWidgetSectionId(next, newWidgetId);
    if (secId) {setSelectedElement({ type: 'widget', sectionId: secId, widgetId: newWidgetId });}
  }

  function onDuplicateSection(sectionId: string): void {
    if (!page) {return;}
    const { page: next, newSectionId } = duplicateSection(page, sectionId);
    commitPage(next);
    if (newSectionId) {setSelectedElement({ type: 'section', sectionId: newSectionId });}
  }

  function onToggleWidgetHidden(widgetId: string): void {
    if (!page) {return;}
    const loc = findWidget(page, widgetId);
    commitPage(setWidgetHidden(page, widgetId, !(loc?.widget.hidden ?? false)));
  }

  function onSetColumnLayout(sectionId: string, count: number, widths?: number[]): void {
    if (!page) {return;}
    commitPage(setColumnLayout(page, sectionId, count, widths));
  }

  function onSetColumnWidths(sectionId: string, widths: number[]): void {
    if (!page) {return;}
    commitPage(setColumnWidths(page, sectionId, widths));
  }

  // Insert a fully-formed section (e.g. a saved block) with fresh collision-safe
  // ids, then select it. The primitive the block library reuses.
  function onInsertSection(section: PageSection, atIndex?: number): void {
    if (!page) {return;}
    const next = insertSection(page, section, atIndex);
    commitPage(next);
    const insertAt =
      atIndex === undefined ? page.content.length : Math.max(0, Math.min(atIndex, page.content.length));
    const inserted = next.content[insertAt];
    if (inserted) {setSelectedElement({ type: 'section', sectionId: inserted.id });}
  }

  // Build a fresh section with the chosen structure (1..6 columns, optional
  // asymmetric widths) and insert + select it via onInsertSection.
  function onAddSectionWithStructure(columnCount: number, widths?: number[], atIndex?: number): void {
    onInsertSection(buildSection(columnCount, widths), atIndex);
  }

  // ============================================================================
  // Block library — insert premade/saved sections + save a section as a block
  // ============================================================================

  // Open the "save as block" dialog for a section (name + category prompt).
  function onSaveSectionAsBlock(sectionId: string): void {
    setSaveBlockName('');
    setSaveBlockCategory('content');
    setSaveBlockFor(sectionId);
  }

  async function confirmSaveBlock(): Promise<void> {
    if (!page || saveBlockFor === null) { return; }
    const sec = page.content.find((s) => s.id === saveBlockFor);
    if (!sec) { setSaveBlockFor(null); return; }
    const trimmedName = saveBlockName.trim();
    const name = trimmedName !== '' ? trimmedName : (sec.name ?? 'Saved section');
    const saved = await saveBlock({ name, category: saveBlockCategory, section: sec }, authFetch);
    if (saved) {
      setBlocks((b) => ({ ...b, saved: [saved, ...b.saved] }));
      setNotification({ message: `Saved "${name}" to your blocks`, type: 'success' });
    } else {
      setNotification({ message: 'Could not save block. Please try again.', type: 'error' });
    }
    setSaveBlockFor(null);
  }

  // Load the block catalog (premade + the org's saved blocks) once on mount.
  useEffect(() => {
    let cancelled = false;
    setBlocksLoading(true);
    loadBlocks(authFetch)
      .then((b) => { if (!cancelled) { setBlocks(b); } })
      .catch((e) => { logger.error('Failed to load blocks', e instanceof Error ? e : new Error(String(e)), { file: 'editor/page.tsx' }); })
      .finally(() => { if (!cancelled) { setBlocksLoading(false); } });
    return () => { cancelled = true; };
  }, [authFetch]);

  // ============================================================================
  // Navigator (Layers) panel — maps the tree's events onto the existing handlers
  // ============================================================================

  // Highlight the row matching the live selection (widget id wins, else section).
  const selectedLayerId = selectedElement?.widgetId ?? selectedElement?.sectionId ?? null;

  function handleLayerSelect(target: LayerTarget): void {
    if (target.kind === 'widget') {
      selectElement({ type: 'widget', sectionId: target.sectionId, widgetId: target.widgetId });
    } else {
      // section or column → select the owning section (columns aren't a
      // separately-selectable element in the current model).
      selectElement({ type: 'section', sectionId: target.sectionId });
    }
  }

  function handleLayerToggleHidden(target: LayerTarget): void {
    if (target.kind === 'widget') { onToggleWidgetHidden(target.widgetId); }
  }

  function handleLayerDuplicate(target: LayerTarget): void {
    if (target.kind === 'widget') { onDuplicateWidget(target.widgetId); }
    else if (target.kind === 'section') { onDuplicateSection(target.sectionId); }
  }

  function handleLayerDelete(target: LayerTarget): void {
    if (target.kind === 'widget') {
      deleteWidget(target.sectionId, target.widgetId);
    } else if (target.kind === 'section') {
      deleteSection(target.sectionId);
    } else if (target.kind === 'column' && page) {
      // Deleting a column folds its widgets into the previous column by
      // reducing the section's column count (never drops widgets).
      const sec = page.content.find((s) => s.id === target.sectionId);
      if (sec && sec.columns.length > 1) { onSetColumnLayout(target.sectionId, sec.columns.length - 1); }
    }
  }

  function handleLayerReorder(move: LayerReorder): void {
    if (move.kind === 'section') { onMoveSection(move.sectionId, move.toIndex); }
    else { onMoveWidget(move.widgetId, move.to); }
  }

  // ============================================================================
  // Site chrome (banner / header / footer) — editor-side draft only
  // ============================================================================

  // Selecting a chrome region and a body widget/section are mutually exclusive.
  function selectRegion(region: ChromeRegion): void {
    setSelectedRegion(region);
    setSelectedElement(null);
  }

  function selectElement(element: { type: 'section' | 'widget'; sectionId: string; widgetId?: string }): void {
    setSelectedElement(element);
    setSelectedRegion(null);
  }

  // Save the chrome draft to the store the service reads. Debounced so typing in
  // the ChromeEditor doesn't fire a request per keystroke. EDITOR-SIDE ONLY.
  const persistChrome = React.useCallback(async (next: SiteChrome): Promise<void> => {
    try {
      const res = await authFetch(SITE_CHROME_API_PATH, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chrome: next }),
      });
      if (!res.ok) {
        throw new Error(`Chrome save failed (${res.status})`);
      }
    } catch (error) {
      logger.error('[Editor] Chrome save error:', error instanceof Error ? error : new Error(String(error)));
      setNotification({ message: 'Could not save banner/header/footer changes', type: 'error' });
    }
  }, [authFetch]);

  // Apply a chrome edit to in-memory state immediately, then persist (debounced)
  // to the draft store. This never writes to the live public site.
  function handleChromeChange(next: SiteChrome): void {
    setChrome(next);
    if (chromeSaveTimer.current) {
      clearTimeout(chromeSaveTimer.current);
    }
    chromeSaveTimer.current = setTimeout(() => {
      void persistChrome(next);
    }, 700);
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
      {/* On-demand Google Fonts: load only the families actually used on the page */}
      {page && <FontLoader families={collectUsedFonts(page)} />}
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
            // If a container widget is selected, add the new widget INSIDE it.
            if (selectedElement?.type === 'widget' && selectedElement.widgetId) {
              const loc = findWidget(page, selectedElement.widgetId);
              if (loc && isContainerType(loc.widget.type)) {
                addWidgetToContainer(loc.widget.id, widget);
                return;
              }
            }
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
          onSelectElement={selectElement}
          onAddSection={addSection}
          onAddSectionWithStructure={onAddSectionWithStructure}
          onUpdateSection={updateSection}
          onDeleteSection={deleteSection}
          onAddWidget={addWidget}
          onAddWidgetToContainer={addWidgetToContainer}
          onUpdateWidget={updateWidget}
          onDeleteWidget={deleteWidget}
          onMoveWidget={onMoveWidget}
          onMoveSection={onMoveSection}
          onDuplicateWidget={onDuplicateWidget}
          onDuplicateSection={onDuplicateSection}
          onToggleWidgetHidden={onToggleWidgetHidden}
          onSaveSectionAsBlock={onSaveSectionAsBlock}
          chrome={chrome}
          editable
          selectedRegion={selectedRegion}
          onSelectRegion={selectRegion}
        />

        {/* Right Panel: Chrome editor when a banner/header/footer region is
            selected; otherwise the normal widget/section Properties panel. */}
        {selectedRegion !== null && chrome !== null ? (
          <ChromeEditor
            chrome={chrome}
            region={selectedRegion}
            onChange={handleChromeChange}
            onClose={() => setSelectedRegion(null)}
          />
        ) : (
          <PropertiesPanel
            selectedElement={selectedElement}
            page={page}
            breakpoint={breakpoint}
            onUpdatePage={updatePage}
            onUpdateSection={updateSection}
            onUpdateWidget={updateWidget}
            onSetColumnLayout={onSetColumnLayout}
            onSetColumnWidths={onSetColumnWidths}
            onDuplicateSection={onDuplicateSection}
            onSaveSectionAsBlock={onSaveSectionAsBlock}
            onDeleteSection={deleteSection}
            onDuplicateWidget={onDuplicateWidget}
            onDeleteWidget={(widgetId) => {
              deleteWidget(findWidgetSectionId(page, widgetId) ?? '', widgetId);
            }}
          />
        )}
      </div>

      {/* Editor docks — Navigator (page structure) + Block library (insert premade/saved sections) */}
      <div className="fixed bottom-4 left-4 z-[60] flex items-center gap-2">
        <button
          type="button"
          onClick={() => { setShowNavigator((v) => !v); setShowLibrary(false); }}
          className="flex items-center gap-2 rounded-lg bg-[#1a1a2e] text-white/80 hover:text-white border border-white/10 px-3 py-2 text-sm shadow-lg cursor-pointer"
          title="Toggle the page structure navigator"
        >
          <span aria-hidden>▤</span> {showNavigator ? 'Hide Navigator' : 'Navigator'}
        </button>
        <button
          type="button"
          onClick={() => { setShowLibrary((v) => !v); setShowNavigator(false); }}
          className="flex items-center gap-2 rounded-lg bg-[#1a1a2e] text-white/80 hover:text-white border border-white/10 px-3 py-2 text-sm shadow-lg cursor-pointer"
          title="Insert a premade or saved section block"
        >
          <span aria-hidden>▦</span> {showLibrary ? 'Hide Library' : 'Block Library'}
        </button>
      </div>
      {showNavigator && page && (
        <div className="fixed bottom-16 left-4 z-[60] w-72 max-h-[70vh] overflow-auto rounded-xl border border-white/10 bg-[#16162a] shadow-2xl">
          <LayersPanel
            page={page}
            selectedId={selectedLayerId}
            onSelect={handleLayerSelect}
            onToggleHidden={handleLayerToggleHidden}
            onDuplicate={handleLayerDuplicate}
            onDelete={handleLayerDelete}
            onReorder={handleLayerReorder}
            onClose={() => setShowNavigator(false)}
          />
        </div>
      )}
      {showLibrary && (
        <div className="fixed bottom-16 left-4 z-[60] w-[26rem] max-h-[72vh] overflow-auto rounded-xl border border-white/10 bg-[#16162a] shadow-2xl">
          <BlockLibrary
            premade={blocks.premade}
            saved={blocks.saved}
            loading={blocksLoading}
            onInsert={(section) => { onInsertSection(section); setNotification({ message: 'Section added from the library', type: 'success' }); }}
            onClose={() => setShowLibrary(false)}
          />
        </div>
      )}
      {/* Save-as-block dialog (name + category) */}
      {saveBlockFor !== null && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70">
          <div className="bg-[#1a1a2e] rounded-xl p-6 w-full max-w-sm mx-4 shadow-2xl border border-white/10">
            <p className="text-white mb-3 text-base font-medium">Save section as a block</p>
            <label className="block text-white/60 text-xs mb-1">Name</label>
            <input
              autoFocus
              value={saveBlockName}
              onChange={(e) => setSaveBlockName(e.target.value)}
              placeholder="e.g. Hero with gradient headline"
              className="w-full mb-3 px-3 py-2 rounded-lg bg-white/10 text-white border border-white/10 text-sm outline-none focus:border-white/30"
            />
            <label className="block text-white/60 text-xs mb-1">Category</label>
            <select
              value={saveBlockCategory}
              onChange={(e) => setSaveBlockCategory(e.target.value as BlockCategory)}
              className="w-full mb-4 px-3 py-2 rounded-lg bg-white/10 text-white border border-white/10 text-sm outline-none"
            >
              {Object.entries(BLOCK_CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value} className="bg-[#1a1a2e]">{label}</option>
              ))}
            </select>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setSaveBlockFor(null)} className="px-4 py-2 rounded-lg text-white/60 bg-white/10 border-none cursor-pointer">Cancel</button>
              <button type="button" onClick={() => void confirmSaveBlock()} className="px-4 py-2 rounded-lg bg-violet-500 text-white border-none cursor-pointer">Save block</button>
            </div>
          </div>
        </div>
      )}

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
