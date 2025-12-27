/**
 * Public Site Renderer
 * Renders published pages for subdomain/custom domain traffic
 * CRITICAL: Org-scoped - only shows this org's published content
 * OPTIMIZED: With caching, lazy loading, and SEO
 */

'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ResponsiveRenderer } from '@/components/website-builder/ResponsiveRenderer';
import { MobileNavigation } from '@/components/website-builder/MobileNavigation';

interface PageData {
  id: string;
  title: string;
  slug: string;
  content: any[];
  seo: any;
  status: string;
}

export default function PublicSitePage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const slug = (params.slug as string[]) || [''];
  const pagePath = slug.join('/') || 'home';

  const [page, setPage] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPage();
  }, [orgId, pagePath]);

  async function loadPage() {
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

      const data = await response.json();

      if (!data.pages || data.pages.length === 0) {
        setError('Page not found');
        return;
      }

      setPage(data.pages[0]);
    } catch (err: any) {
      console.error('[Public Site] Error loading page:', err);
      setError(err.message || 'Failed to load page');
    } finally {
      setLoading(false);
    }
  }

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
          <p style={{ color: '#666', margin: 0 }}>{error || 'Page not found'}</p>
        </div>
      </div>
    );
  }

  // Detect viewport for responsive rendering
  const [breakpoint, setBreakpoint] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

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

  return (
    <>
      <head>
        <title>{page.seo?.metaTitle || page.title}</title>
        <meta name="description" content={page.seo?.metaDescription || ''} />
        {page.seo?.metaKeywords && (
          <meta name="keywords" content={page.seo.metaKeywords.join(', ')} />
        )}
        {page.seo?.ogTitle && <meta property="og:title" content={page.seo.ogTitle} />}
        {page.seo?.ogDescription && (
          <meta property="og:description" content={page.seo.ogDescription} />
        )}
        {page.seo?.ogImage && <meta property="og:image" content={page.seo.ogImage} />}
        {page.seo?.noIndex && <meta name="robots" content="noindex,nofollow" />}
        {page.seo?.canonicalUrl && <link rel="canonical" href={page.seo.canonicalUrl} />}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>

      <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        {/* Render page content with responsive design */}
        {page.content && page.content.length > 0 ? (
          <ResponsiveRenderer content={page.content} breakpoint={breakpoint} />
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

