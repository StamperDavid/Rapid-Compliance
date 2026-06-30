'use client';

import { useState, useEffect } from 'react'
import { logger } from '@/lib/logger/logger';

interface WidgetElement {
  id: string;
  type: string;
  content?: Record<string, unknown>;
  children?: WidgetElement[];
  styles?: {
    desktop?: Record<string, string>;
    tablet?: Record<string, string>;
    mobile?: Record<string, string>;
  };
  settings?: Record<string, unknown>;
}

interface PageSection {
  id: string;
  type: 'section';
  name: string;
  children: WidgetElement[];
  styles?: {
    desktop?: Record<string, string>;
    tablet?: Record<string, string>;
    mobile?: Record<string, string>;
  };
  visible: boolean;
}

export interface PageContent {
  id: string;
  name: string;
  slug: string;
  sections: PageSection[];
  metaTitle?: string;
  metaDescription?: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

/**
 * Convert a PUBLISHED editor page (canonical `Page`: content → columns → widgets)
 * into the `PageContent` shape the public pages + PageRenderer already consume
 * (sections → children). Each section's column widgets are flattened into
 * `children`, and each widget's `data` becomes the element `content`.
 */
function toPageContent(raw: Record<string, unknown>): PageContent {
  const content = Array.isArray(raw.content) ? raw.content : [];
  const sections: PageSection[] = content.map((s) => {
    const sec = asRecord(s) ?? {};
    const columns = Array.isArray(sec.columns) ? sec.columns : [];
    const children: WidgetElement[] = [];
    for (const c of columns) {
      const col = asRecord(c) ?? {};
      const widgets = Array.isArray(col.widgets) ? col.widgets : [];
      for (const w of widgets) {
        const widget = asRecord(w);
        if (!widget) { continue; }
        children.push({
          id: typeof widget.id === 'string' ? widget.id : '',
          type: typeof widget.type === 'string' ? widget.type : '',
          content: asRecord(widget.data) ?? {},
        });
      }
    }
    return {
      id: typeof sec.id === 'string' ? sec.id : '',
      type: 'section',
      name: typeof sec.name === 'string' ? sec.name : 'Section',
      children,
      visible: sec.visible !== false,
    };
  });

  const seo = asRecord(raw.seo) ?? {};
  return {
    id: typeof raw.id === 'string' ? raw.id : '',
    name: typeof raw.title === 'string' ? raw.title : '',
    slug: typeof raw.slug === 'string' ? raw.slug : '',
    sections,
    metaTitle: typeof seo.metaTitle === 'string' ? seo.metaTitle : undefined,
    metaDescription: typeof seo.metaDescription === 'string' ? seo.metaDescription : undefined,
  };
}

/**
 * Loads the operator's PUBLISHED editor page for this slug (the same store the
 * visual editor saves to), so editing + publishing a page updates the real URL.
 * Returns `null` when there is no published page (or on any error), so the page
 * falls back to its existing built-in content — meaning a live page is unchanged
 * until the operator publishes an edit for it. Drafts never appear (the endpoint
 * is published-only).
 */
export function usePageContent(pageId: string) {
  const [page, setPage] = useState<PageContent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadPage = async () => {
      try {
        const res = await fetch(`/api/public/website-page?slug=${encodeURIComponent(pageId)}`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          if (!cancelled) { setPage(null); }
          return;
        }
        const json = (await res.json()) as { page?: unknown };
        const rawPage = asRecord(json.page);
        const converted = rawPage ? toPageContent(rawPage) : null;
        // Only use a published page that actually has content; otherwise fall
        // back to the page's built-in version.
        if (!cancelled) {
          setPage(converted?.sections.some((s) => s.children.length > 0) ? converted : null);
        }
      } catch (error) {
        logger.error('Failed to load page content:', error instanceof Error ? error : new Error(String(error)), { file: 'usePageContent.ts' });
        if (!cancelled) { setPage(null); }
      } finally {
        if (!cancelled) { setLoading(false); }
      }
    };

    void loadPage();
    return () => { cancelled = true; };
  }, [pageId]);

  return { page, loading };
}
