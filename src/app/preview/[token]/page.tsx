/**
 * Preview Page
 * Display preview of unpublished pages via shareable token
 * Shows draft content before publishing
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

interface PageData {
  id: string;
  organizationId: string;
  title: string;
  slug: string;
  content: any[];
  seo: any;
  status: string;
  updatedAt: string;
}

export default function PreviewPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = params.token as string;
  const breakpoint =(searchParams.get('breakpoint') !== '' && searchParams.get('breakpoint') != null) ? searchParams.get('breakpoint') : 'desktop';

  const [page, setPage] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPreview();
  }, [token]);

  const fetchPreview = async () => {
    try {
      setLoading(true);
      setError(null);

      // First, validate the token and get page info
      const tokenResponse = await fetch(`/api/website/preview/validate?token=${token}`);
      
      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        throw new Error((errorData.error !== '' && errorData.error != null) ? errorData.error : 'Invalid preview token');
      }

      const tokenData = await tokenResponse.json();
      const { pageId, organizationId } = tokenData;

      // Fetch the page data
      const pageResponse = await fetch(
        `/api/website/pages/${pageId}/preview?organizationId=${organizationId}&token=${token}`
      );

      if (!pageResponse.ok) {
        const errorData = await pageResponse.json();
        throw new Error((errorData.error !== '' && errorData.error != null) ? errorData.error : 'Failed to load preview');
      }

      const pageData = await pageResponse.json();
      setPage(pageData.page);
    } catch (err: any) {
      console.error('[Preview] Error:', err);
      setError((err.message !== '' && err.message != null) ? err.message : 'Failed to load preview');
    } finally {
      setLoading(false);
    }
  };

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
  const getBreakpointWidth = () => {
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
        {['desktop', 'tablet', 'mobile'].map(bp => (
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
              page.content.map((section: any, idx: number) => (
                <div
                  key={section.id ?? idx}
                  style={{
                    marginBottom: '32px',
                    padding: (() => { const v = section.padding?.top; return (v !== '' && v != null) ? v : '20px'; })(),
                    backgroundColor: (section.backgroundColor !== '' && section.backgroundColor != null) ? section.backgroundColor : 'transparent',
                  }}
                >
                  {section.columns?.map((column: any, colIdx: number) => (
                    <div key={column.id ?? colIdx}>
                      {column.widgets?.map((widget: any, widgetIdx: number) => (
                        <div
                          key={widget.id ?? widgetIdx}
                          style={{
                            marginBottom: '16px',
                            ...widget.style,
                          }}
                        >
                          {renderWidget(widget)}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))
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

function renderWidget(widget: any) {
  switch (widget.type) {
    case 'heading':
      return (
        <div
          style={{
            fontSize: widget.data.level === 1 ? '36px' : '24px',
            fontWeight: 'bold',
            color: '#111827',
          }}
        >
          {(widget.data.text !== '' && widget.data.text != null) ? widget.data.text : 'Heading'}
        </div>
      );
    
    case 'text':
      return (
        <p style={{ color: '#374151', lineHeight: '1.6' }}>
          {(widget.data.content !== '' && widget.data.content != null) ? widget.data.content : 'Text content'}
        </p>
      );
    
    case 'button':
      return (
        <button
          style={{
            padding: '12px 24px',
            backgroundColor:(widget.data.color !== '' && widget.data.color != null) ? widget.data.color : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '16px',
            fontWeight: '500',
            cursor: 'pointer',
          }}
        >
          {(widget.data.text !== '' && widget.data.text != null) ? widget.data.text : 'Button'}
        </button>
      );
    
    case 'image':
      return (
        <img
          src={(widget.data.src !== '' && widget.data.src != null) ? widget.data.src : 'https://via.placeholder.com/800x400'}
          alt={(widget.data.alt !== '' && widget.data.alt != null) ? widget.data.alt : 'Image'}
          style={{
            width: '100%',
            height: 'auto',
            borderRadius: '8px',
          }}
        />
      );
    
    default:
      return (
        <div
          style={{
            padding: '16px',
            backgroundColor: '#f3f4f6',
            borderRadius: '6px',
            color: '#6b7280',
          }}
        >
          {widget.type} widget
        </div>
      );
  }
}


