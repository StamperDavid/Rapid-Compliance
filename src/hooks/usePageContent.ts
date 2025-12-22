'use client';

import { useState, useEffect } from 'react';

interface WidgetElement {
  id: string;
  type: string;
  content?: any;
  children?: WidgetElement[];
  styles?: {
    desktop?: Record<string, string>;
    tablet?: Record<string, string>;
    mobile?: Record<string, string>;
  };
  settings?: Record<string, any>;
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
        
        if (config?.pages) {
          const foundPage = config.pages.find((p: PageContent) => p.id === pageId);
          if (foundPage) {
            setPage(foundPage);
          }
        }
      } catch (error) {
        console.error('Failed to load page content:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPage();
  }, [pageId]);

  return { page, loading };
}






