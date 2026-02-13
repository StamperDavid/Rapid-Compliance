/**
 * Pages Management
 * List and manage all website pages
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/useToast';
import { auth } from '@/lib/firebase/config';
import type { Page } from '@/types/website';

interface PagesResponse {
  pages: Page[];
}

export default function PagesManagementPage() {
  const router = useRouter();
  const toast = useToast();

  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'draft' | 'published'>('all');

  // Use a ref for toast to avoid re-render loops in useCallback deps
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const loadPages = useCallback(async () => {
    try {
      setLoading(true);
      const url = filter === 'all'
        ? '/api/website/pages'
        : `/api/website/pages?status=${filter}`;

      const token = await auth?.currentUser?.getIdToken();
      const response = await fetch(url, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load pages');
      }

      const data = await response.json() as PagesResponse;
      setPages(data.pages ?? []);
    } catch (error: unknown) {
      console.error('[Pages] Load error:', error);
      toastRef.current.error('Failed to load pages');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void loadPages();
  }, [loadPages]);

  function deletePage(pageId: string) {
    toast.warning('Are you sure you want to delete this page?');

    void (async () => {
      try {
        const token = await auth?.currentUser?.getIdToken();
        const response = await fetch(
          `/api/website/pages/${pageId}`,
          {
            method: 'DELETE',
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to delete page');
        }

        toast.success('Page deleted successfully');
        void loadPages();
      } catch (error: unknown) {
        console.error('[Pages] Delete error:', error);
        toast.error('Failed to delete page');
      }
    })();
  }

  async function duplicatePage(page: Page): Promise<void> {
    try {
      const duplicatedPage = {
        ...page,
        id: undefined,
        title: `${page.title} (Copy)`,
        slug: `${page.slug}-copy-${Date.now()}`,
        status: 'draft' as const,
      };

      const token = await auth?.currentUser?.getIdToken();
      const response = await fetch('/api/website/pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          page: duplicatedPage,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to duplicate page');
      }

      toast.success('Page duplicated successfully');
      void loadPages();
    } catch (error: unknown) {
      console.error('[Pages] Duplicate error:', error);
      toast.error('Failed to duplicate page');
    }
  }

  function createNewPage() {
    router.push(`/website/editor`);
  }

  function editPage(pageId: string) {
    router.push(`/website/editor?pageId=${pageId}`);
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
        <div>Loading pages...</div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui', minHeight: '100vh', background: 'var(--color-bg-elevated)' }}>

      <div style={{ padding: '2rem' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
        }}>
          <div>
            <h1 style={{ fontSize: '2rem', margin: '0 0 0.5rem', color: 'var(--color-text-primary)' }}>
              Pages
            </h1>
            <p style={{ margin: 0, color: 'var(--color-text-disabled)' }}>
              Manage your website pages
            </p>
          </div>

          <button
            onClick={createNewPage}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'var(--color-info)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: '600',
            }}
          >
            + New Page
          </button>
        </div>

        {/* Filters */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '1.5rem',
        }}>
          <button
            onClick={() => setFilter('all')}
            style={{
              padding: '0.5rem 1rem',
              background: filter === 'all' ? 'var(--color-info)' : 'var(--color-bg-paper)',
              color: filter === 'all' ? 'white' : 'var(--color-text-disabled)',
              border: '1px solid var(--color-border-light)',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            All ({pages.length})
          </button>
          <button
            onClick={() => setFilter('draft')}
            style={{
              padding: '0.5rem 1rem',
              background: filter === 'draft' ? 'var(--color-info)' : 'var(--color-bg-paper)',
              color: filter === 'draft' ? 'white' : 'var(--color-text-disabled)',
              border: '1px solid var(--color-border-light)',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Drafts
          </button>
          <button
            onClick={() => setFilter('published')}
            style={{
              padding: '0.5rem 1rem',
              background: filter === 'published' ? 'var(--color-info)' : 'var(--color-bg-paper)',
              color: filter === 'published' ? 'white' : 'var(--color-text-disabled)',
              border: '1px solid var(--color-border-light)',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Published
          </button>
        </div>

        {/* Pages List */}
        {pages.length === 0 ? (
          <div style={{
            background: 'var(--color-bg-paper)',
            borderRadius: '8px',
            padding: '4rem 2rem',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📄</div>
            <h3 style={{ fontSize: '1.25rem', margin: '0 0 0.5rem', color: 'var(--color-text-disabled)' }}>
              No pages yet
            </h3>
            <p style={{ margin: '0 0 1.5rem', color: 'var(--color-text-secondary)' }}>
              Create your first page to get started
            </p>
            <button
              onClick={createNewPage}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'var(--color-info)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '500',
              }}
            >
              Create Page
            </button>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gap: '1rem',
          }}>
            {pages.map((page) => (
              <div
                key={page.id}
                style={{
                  background: 'var(--color-bg-paper)',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.125rem', color: 'var(--color-text-primary)' }}>
                      {page.title}
                    </h3>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      background: page.status === 'published' ? 'var(--color-success)' : 'var(--color-warning)',
                      color: page.status === 'published' ? 'white' : 'var(--color-text-primary)',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                    }}>
                      {page.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                    /{page.slug}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>
                    Last updated: {new Date(page.updatedAt).toLocaleDateString()}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => editPage(page.id)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: 'var(--color-info)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => void duplicatePage(page)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: 'var(--color-text-secondary)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                    }}
                  >
                    Duplicate
                  </button>
                  <button
                    onClick={() => deletePage(page.id)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: 'var(--color-error)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


