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

export function usePageContent(pageId: string) {
  const [page, setPage] = useState<PageContent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPage = async () => {
      try {
        const { FirestoreService } = await import('@/lib/db/firestore-service');
        const config = await FirestoreService.get('platform/website', 'editor-config');

        if (config && typeof config === 'object' && 'pages' in config && Array.isArray(config.pages)) {
          const foundPage = config.pages.find((p: PageContent) => p.id === pageId);
          if (foundPage) {
            setPage(foundPage);
          }
        }
      } catch (error) {
        logger.error('Failed to load page content:', error, { file: 'usePageContent.ts' });
      } finally {
        setLoading(false);
      }
    };

    void loadPage();
  }, [pageId]);

  return { page, loading };
}
