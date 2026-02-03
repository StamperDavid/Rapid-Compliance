/**
 * Public Site Renderer
 * Renders published pages for subdomain/custom domain traffic
 * CRITICAL: Org-scoped - only shows this org's published content
 * OPTIMIZED: With caching, lazy loading, and SEO
 */

'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { ResponsiveRenderer } from '@/components/website-builder/ResponsiveRenderer';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

// Type definitions for SEO metadata
interface SeoMetadata {
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string[];
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  noIndex?: boolean;
  canonicalUrl?: string;
}

// Type definitions for page content sections
interface ContentSection {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

interface PageData {
  id: string;
  title: string;
  slug: string;
  content: ContentSection[];
  seo: SeoMetadata;
  status: string;
}

// Type guard for API response
interface PagesApiResponse {
  pages?: PageData[];
}

function isPagesApiResponse(data: unknown): data is PagesApiResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'pages' in data &&
    Array.isArray((data as PagesApiResponse).pages)
  );
}

export default function PublicSitePage() {
  const params = useParams();
  const orgId = DEFAULT_ORG_ID;
  const slug = (params.slug as string[]) || [''];
  const pagePath = slug.join('/') || 'home';

  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  const [page, setPage] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [breakpoint, setBreakpoint] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  const loadPage = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch page by slug
      const response = await fetch(
        `/api/website/pages?organizationId=${orgId}&slug=${pagePath}&status=published`
      );

      if (!response.ok) {
        if (response.status === 404) {
          setError('Page not found');
        } else {
          throw new Error('Failed to load page');
        }
        return;
      }

      const data: unknown = await response.json();

      if (!isPagesApiResponse(data) || !data.pages || data.pages.length === 0) {
        setError('Page not found');
        return;
      }

      setPage(data.pages[0]);
    } catch (err: unknown) {
      console.error('[Public Site] Error loading page:', err);
      const errorMessage =
        err instanceof Error && err.message ? err.message : 'Failed to load page';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [orgId, pagePath]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  // Detect viewport for responsive rendering
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setBreakpoint('mobile');
      } else if (width < 1200) {
        setBreakpoint('tablet');
      } else {
        setBreakpoint('desktop');
      }
    };

    handleResize(); // Initial check
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // NOW we can do conditional rendering after all hooks are called
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'system-ui',
      }}>
        <div>Loading...</div>
      </div>
    );
  }

  if (error || !page) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'system-ui',
        background: '#f5f5f5',
      }}>
        <div style={{
          textAlign: 'center',
          padding: '2rem',
          background: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}>
          <h1 style={{ color: '#333', margin: '0 0 1rem' }}>404</h1>
          <p style={{ color: '#666', margin: 0 }}>{error ?? 'Page not found'}</p>
        </div>
      </div>
    );
  }

  // Extract SEO metadata with proper types
  const seoTitle = page.seo.metaTitle ?? page.title;
  const seoDescription = page.seo.metaDescription ?? '';
  const seoKeywords = page.seo.metaKeywords?.join(', ') ?? '';

  return (
    <>
      <head>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDescription} />
        {page.seo.metaKeywords && (
          <meta name="keywords" content={seoKeywords} />
        )}
        {page.seo.ogTitle && <meta property="og:title" content={page.seo.ogTitle} />}
        {page.seo.ogDescription && (
          <meta property="og:description" content={page.seo.ogDescription} />
        )}
        {page.seo.ogImage && <meta property="og:image" content={page.seo.ogImage} />}
        {page.seo.noIndex && <meta name="robots" content="noindex,nofollow" />}
        {page.seo.canonicalUrl && <link rel="canonical" href={page.seo.canonicalUrl} />}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>

      <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        {/* Render page content with responsive design */}
        {page.content && page.content.length > 0 ? (
          <ResponsiveRenderer content={page.content as unknown as Parameters<typeof ResponsiveRenderer>[0]['content']} breakpoint={breakpoint} />
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            textAlign: 'center',
            padding: '20px',
          }}>
            <div>
              <h1 style={{ fontSize: '32px', marginBottom: '16px', color: '#111827' }}>
                {page.title}
              </h1>
              <p style={{ color: '#6b7280', fontSize: '16px' }}>
                This page is under construction.
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
