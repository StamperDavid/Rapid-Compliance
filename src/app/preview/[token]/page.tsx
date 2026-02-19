/**
 * Preview Page
 * Display preview of unpublished pages via shareable token
 * Shows draft content before publishing
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { logger } from '@/lib/logger/logger';

// Type definitions for page content structure
interface WidgetData {
  level?: number;
  text?: string;
  content?: string;
  color?: string;
  src?: string;
  alt?: string;
}

interface Widget {
  id?: string;
  type: string;
  data: WidgetData;
  style?: React.CSSProperties;
}

interface Column {
  id?: string;
  widgets?: Widget[];
}

interface Section {
  id?: string;
  padding?: {
    top?: string;
    bottom?: string;
    left?: string;
    right?: string;
  };
  backgroundColor?: string;
  columns?: Column[];
}

interface SeoData {
  title?: string;
  description?: string;
  keywords?: string[];
  ogImage?: string;
}

interface PageData {
  id: string;
  title: string;
  slug: string;
  content: Section[];
  seo: SeoData;
  status: string;
  updatedAt: string;
}

interface ErrorResponse {
  error?: string;
}

interface TokenValidationResponse {
  pageId: string;
}

interface PageDataResponse {
  page: PageData;
}

type Breakpoint = 'desktop' | 'tablet' | 'mobile';

function isErrorResponse(data: unknown): data is ErrorResponse {
  return typeof data === 'object' && data !== null && 'error' in data;
}

function isTokenValidationResponse(data: unknown): data is TokenValidationResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'pageId' in data &&
    typeof (data as TokenValidationResponse).pageId === 'string'
  );
}

function isPageDataResponse(data: unknown): data is PageDataResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'page' in data &&
    typeof (data as PageDataResponse).page === 'object'
  );
}

export default function PreviewPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = params.token as string;
  const breakpointParam = searchParams.get('breakpoint');
  const breakpoint: Breakpoint =
    breakpointParam === 'mobile' || breakpointParam === 'tablet' || breakpointParam === 'desktop'
      ? breakpointParam
      : 'desktop';

  const [page, setPage] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPreview = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // First, validate the token and get page info
      const tokenResponse = await fetch(`/api/website/preview/validate?token=${token}`);

      if (!tokenResponse.ok) {
        const errorData: unknown = await tokenResponse.json();
        const errorMessage =
          isErrorResponse(errorData) && errorData.error
            ? errorData.error
            : 'Invalid preview token';
        throw new Error(errorMessage);
      }

      const tokenData: unknown = await tokenResponse.json();

      if (!isTokenValidationResponse(tokenData)) {
        throw new Error('Invalid token validation response');
      }

      const { pageId } = tokenData;

      // Fetch the page data
      const pageResponse = await fetch(
        `/api/website/pages/${pageId}/preview?token=${token}`
      );

      if (!pageResponse.ok) {
        const errorData: unknown = await pageResponse.json();
        const errorMessage =
          isErrorResponse(errorData) && errorData.error
            ? errorData.error
            : 'Failed to load preview';
        throw new Error(errorMessage);
      }

      const pageData: unknown = await pageResponse.json();

      if (!isPageDataResponse(pageData)) {
        throw new Error('Invalid page data response');
      }

      setPage(pageData.page);
    } catch (err: unknown) {
      logger.error('[Preview] Error', err instanceof Error ? err : new Error(String(err)));
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Failed to load preview';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchPreview();
  }, [fetchPreview]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid #f3f4f6',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            margin: '0 auto 16px',
            animation: 'spin 1s linear infinite',
          }} />
          <p style={{ color: '#6b7280' }}>Loading preview...</p>
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '20px',
      }}>
        <div style={{
          maxWidth: '480px',
          textAlign: 'center',
          padding: '32px',
          backgroundColor: '#fef2f2',
          borderRadius: '8px',
          border: '1px solid #fecaca',
        }}>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#991b1b',
            marginBottom: '12px',
          }}>
            Preview Error
          </h1>
          <p style={{ color: '#7f1d1d', marginBottom: '24px' }}>
            {error}
          </p>
          <p style={{ fontSize: '14px', color: '#991b1b' }}>
            This preview link may have expired or been revoked.
          </p>
        </div>
      </div>
    );
  }

  if (!page) {
    return null;
  }

  // Get breakpoint dimensions
  const getBreakpointWidth = (): string => {
    switch (breakpoint) {
      case 'mobile':
        return '375px';
      case 'tablet':
        return '768px';
      case 'desktop':
      default:
        return '100%';
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f9fafb',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Preview Banner */}
      <div style={{
        backgroundColor: '#fbbf24',
        color: '#78350f',
        padding: '12px 20px',
        textAlign: 'center',
        fontWeight: '500',
        fontSize: '14px',
        borderBottom: '2px solid #f59e0b',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}>
          <span>👁️</span>
          <span>Preview Mode - {page.status.toUpperCase()}</span>
          <span>|</span>
          <span>Last updated: {new Date(page.updatedAt).toLocaleString()}</span>
        </div>
      </div>

      {/* Breakpoint Switcher */}
      <div style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #e5e7eb',
        padding: '12px 20px',
        display: 'flex',
        justifyContent: 'center',
        gap: '8px',
        position: 'sticky',
        top: '46px',
        zIndex: 999,
      }}>
        {(['desktop', 'tablet', 'mobile'] as const).map(bp => (
          <a
            key={bp}
            href={`/preview/${token}?breakpoint=${bp}`}
            style={{
              padding: '8px 16px',
              backgroundColor: breakpoint === bp ? '#3b82f6' : 'white',
              color: breakpoint === bp ? 'white' : '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: '500',
              textTransform: 'capitalize',
              transition: 'all 0.2s',
            }}
          >
            {bp === 'desktop' && '🖥️'} {bp === 'tablet' && '📱'} {bp === 'mobile' && '📱'}
            {' '}{bp}
          </a>
        ))}
      </div>

      {/* Preview Content */}
      <div style={{
        padding: breakpoint === 'desktop' ? '0' : '20px',
        minHeight: 'calc(100vh - 110px)',
        display: 'flex',
        justifyContent: 'center',
      }}>
        <div style={{
          width: getBreakpointWidth(),
          maxWidth: breakpoint === 'desktop' ? '100%' : getBreakpointWidth(),
          backgroundColor: 'white',
          boxShadow: breakpoint !== 'desktop' ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none',
          borderRadius: breakpoint !== 'desktop' ? '8px' : '0',
          overflow: 'hidden',
        }}>
          {/* Page Header */}
          <div style={{
            padding: '40px 20px',
            borderBottom: '1px solid #e5e7eb',
            backgroundColor: '#f9fafb',
          }}>
            <h1 style={{
              fontSize: '32px',
              fontWeight: 'bold',
              color: '#111827',
              marginBottom: '8px',
            }}>
              {page.title}
            </h1>
            <p style={{ color: '#6b7280', fontSize: '14px' }}>
              Preview of /{page.slug}
            </p>
          </div>

          {/* Page Content */}
          <div style={{ padding: '40px 20px' }}>
            {page.content && page.content.length > 0 ? (
              page.content.map((section: Section, idx: number) => {
                const sectionKey = section.id ?? `section-${idx}`;
                const paddingTop = section.padding?.top ?? '20px';
                const bgColor = section.backgroundColor ?? 'transparent';

                return (
                  <div
                    key={sectionKey}
                    style={{
                      marginBottom: '32px',
                      padding: paddingTop,
                      backgroundColor: bgColor,
                    }}
                  >
                    {section.columns?.map((column: Column, colIdx: number) => {
                      const columnKey = column.id ?? `column-${idx}-${colIdx}`;

                      return (
                        <div key={columnKey}>
                          {column.widgets?.map((widget: Widget, widgetIdx: number) => {
                            const widgetKey = widget.id ?? `widget-${idx}-${colIdx}-${widgetIdx}`;
                            const widgetStyle: React.CSSProperties = {
                              marginBottom: '16px',
                              ...(widget.style ?? {}),
                            };

                            return (
                              <div
                                key={widgetKey}
                                style={widgetStyle}
                              >
                                {renderWidget(widget)}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              })
            ) : (
              <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>
                This page has no content yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function renderWidget(widget: Widget): React.ReactNode {
  switch (widget.type) {
    case 'heading': {
      const level = widget.data.level ?? 1;
      const text = widget.data.text ?? 'Heading';

      return (
        <div
          style={{
            fontSize: level === 1 ? '36px' : '24px',
            fontWeight: 'bold',
            color: '#111827',
          }}
        >
          {text}
        </div>
      );
    }

    case 'text': {
      const content = widget.data.content ?? 'Text content';

      return (
        <p style={{ color: '#374151', lineHeight: '1.6' }}>
          {content}
        </p>
      );
    }

    case 'button': {
      const color = widget.data.color ?? '#3b82f6';
      const text = widget.data.text ?? 'Button';

      return (
        <button
          style={{
            padding: '12px 24px',
            backgroundColor: color,
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '16px',
            fontWeight: '500',
            cursor: 'pointer',
          }}
        >
          {text}
        </button>
      );
    }

    case 'image': {
      const src = widget.data.src ?? 'https://via.placeholder.com/800x400';
      const alt = widget.data.alt ?? 'Image';

      // Use Next.js Image component for optimization
      // For data URLs and external images, use unoptimized Image
      if (src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://')) {
        return (
          <Image
            src={src}
            alt={alt}
            width={800}
            height={400}
            unoptimized
            style={{
              width: '100%',
              height: 'auto',
              borderRadius: '8px',
            }}
          />
        );
      }

      return (
        <Image
          src={src}
          alt={alt}
          width={800}
          height={400}
          style={{
            width: '100%',
            height: 'auto',
            borderRadius: '8px',
          }}
        />
      );
    }

    default: {
      const widgetType = widget.type;

      return (
        <div
          style={{
            padding: '16px',
            backgroundColor: '#f3f4f6',
            borderRadius: '6px',
            color: '#6b7280',
          }}
        >
          {widgetType} widget
        </div>
      );
    }
  }
}
