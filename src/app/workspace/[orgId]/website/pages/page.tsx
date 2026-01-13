/**
 * Pages Management
 * List and manage all website pages
 * CRITICAL: Multi-tenant - scoped to organizationId
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Page } from '@/types/website';

export default function PagesManagementPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;

  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'draft' | 'published'>('all');

  useEffect(() => {
    loadPages();
  }, [orgId, filter]);

  async function loadPages() {
    try {
      setLoading(true);
      const url = filter === 'all' 
        ? `/api/website/pages?organizationId=${orgId}`
        : `/api/website/pages?organizationId=${orgId}&status=${filter}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {throw new Error('Failed to load pages');}
      
      const data = await response.json();
      setPages(data.pages ?? []);
    } catch (error) {
      console.error('[Pages] Load error:', error);
      alert('Failed to load pages');
    } finally {
      setLoading(false);
    }
  }

  async function deletePage(pageId: string) {
    if (!confirm('Are you sure you want to delete this page?')) {return;}

    try {
      const response = await fetch(
        `/api/website/pages/${pageId}?organizationId=${orgId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {throw new Error('Failed to delete page');}

      alert('Page deleted successfully');
      loadPages();
    } catch (error) {
      console.error('[Pages] Delete error:', error);
      alert('Failed to delete page');
    }
  }

  async function duplicatePage(page: Page) {
    try {
      const duplicatedPage = {
        ...page,
        id: undefined,
        title: `${page.title} (Copy)`,
        slug: `${page.slug}-copy-${Date.now()}`,
        status: 'draft' as const,
      };

      const response = await fetch('/api/website/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: orgId,
          page: duplicatedPage,
        }),
      });

      if (!response.ok) {throw new Error('Failed to duplicate page');}

      alert('Page duplicated successfully');
      loadPages();
    } catch (error) {
      console.error('[Pages] Duplicate error:', error);
      alert('Failed to duplicate page');
    }
  }

  function createNewPage() {
    router.push(`/workspace/${orgId}/website/editor`);
  }

  function editPage(pageId: string) {
    router.push(`/workspace/${orgId}/website/editor?pageId=${pageId}`);
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
        <div>Loading pages...</div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui', minHeight: '100vh', background: '#f5f5f5' }}>

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
        }}>
          <div>
            <h1 style={{ fontSize: '2rem', margin: '0 0 0.5rem', color: '#111' }}>
              Pages
            </h1>
            <p style={{ margin: 0, color: '#666' }}>
              Manage your website pages
            </p>
          </div>

          <button
            onClick={createNewPage}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#007bff',
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
              background: filter === 'all' ? '#007bff' : 'white',
              color: filter === 'all' ? 'white' : '#495057',
              border: '1px solid #dee2e6',
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
              background: filter === 'draft' ? '#007bff' : 'white',
              color: filter === 'draft' ? 'white' : '#495057',
              border: '1px solid #dee2e6',
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
              background: filter === 'published' ? '#007bff' : 'white',
              color: filter === 'published' ? 'white' : '#495057',
              border: '1px solid #dee2e6',
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
            background: 'white',
            borderRadius: '8px',
            padding: '4rem 2rem',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📄</div>
            <h3 style={{ fontSize: '1.25rem', margin: '0 0 0.5rem', color: '#495057' }}>
              No pages yet
            </h3>
            <p style={{ margin: '0 0 1.5rem', color: '#6c757d' }}>
              Create your first page to get started
            </p>
            <button
              onClick={createNewPage}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#007bff',
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
                  background: 'white',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.125rem', color: '#212529' }}>
                      {page.title}
                    </h3>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      background: page.status === 'published' ? '#28a745' : '#ffc107',
                      color: page.status === 'published' ? 'white' : '#000',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                    }}>
                      {page.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>
                    /{page.slug}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#adb5bd', marginTop: '0.5rem' }}>
                    Last updated: {new Date(page.updatedAt).toLocaleDateString()}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => editPage(page.id)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#007bff',
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
                    onClick={() => duplicatePage(page)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#6c757d',
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
                      background: '#dc3545',
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


