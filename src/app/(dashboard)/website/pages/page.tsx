/**
 * Pages Management
 * List and manage all website pages
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';
import { auth } from '@/lib/firebase/config';
import type { Page, PageSection, PageSEO } from '@/types/website';
import { logger } from '@/lib/logger/logger';

interface PagesResponse {
  pages: Page[];
}

interface AIGenerateResponse {
  success: boolean;
  title: string;
  slug: string;
  sections: PageSection[];
  seo: PageSEO;
  error?: string;
}

interface CreatePageResponse {
  success: boolean;
  page: Page;
}

interface CloneWebsiteResponse {
  success: boolean;
  status: 'COMPLETED' | 'PARTIAL' | 'FAILED';
  sourceUrl: string;
  totalPages: number;
  successCount: number;
  failedCount: number;
  pages: Array<{ url: string; status: string; slug?: string }>;
  brand: { name?: string; colors?: string[]; fonts?: string[]; logo?: string };
  editorLink: string;
  message: string;
}

type CloneStatus = 'idle' | 'cloning' | 'success' | 'error';

export default function PagesManagementPage() {
  const router = useRouter();
  const toast = useToast();
  const { loading: authLoading } = useAuth();

  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'draft' | 'published'>('all');
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiPageType, setAiPageType] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);

  // Clone Website state
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneSourceUrl, setCloneSourceUrl] = useState('');
  const [cloneMaxPages, setCloneMaxPages] = useState(10);
  const [cloneIncludeImages, setCloneIncludeImages] = useState(true);
  const [cloneStatus, setCloneStatus] = useState<CloneStatus>('idle');
  const [cloneResult, setCloneResult] = useState<CloneWebsiteResponse | null>(null);
  const [cloneError, setCloneError] = useState('');

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
      logger.error('[Pages] Load error', error instanceof Error ? error : new Error(String(error)));
      toastRef.current.error('Failed to load pages');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    // Wait for Firebase auth to restore session before making API calls
    if (authLoading) {return;}
    void loadPages();
  }, [loadPages, authLoading]);

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
        logger.error('[Pages] Delete error', error instanceof Error ? error : new Error(String(error)));
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
      logger.error('[Pages] Duplicate error', error instanceof Error ? error : new Error(String(error)));
      toast.error('Failed to duplicate page');
    }
  }

  function createNewPage() {
    router.push(`/website/editor`);
  }

  async function generateWithAI(): Promise<void> {
    if (!aiPrompt.trim()) {
      toast.error('Please describe the page you want to generate');
      return;
    }

    try {
      setAiGenerating(true);
      const token = await auth?.currentUser?.getIdToken();

      // Step 1: Generate page content with AI
      const aiResponse = await fetch('/api/website/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          prompt: aiPrompt.trim(),
          ...(aiPageType ? { pageType: aiPageType } : {}),
        }),
      });

      if (!aiResponse.ok) {
        throw new Error('AI generation failed');
      }

      const aiData = await aiResponse.json() as AIGenerateResponse;
      if (!aiData.success) {
        throw new Error(aiData.error ?? 'AI generation failed');
      }

      // Step 2: Create the page with generated content
      const createResponse = await fetch('/api/website/pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          page: {
            title: aiData.title,
            slug: aiData.slug,
            content: aiData.sections,
            seo: aiData.seo,
            status: 'draft',
          },
        }),
      });

      if (!createResponse.ok) {
        throw new Error('Failed to create page');
      }

      const createData = await createResponse.json() as CreatePageResponse;

      toast.success('Page generated successfully!');
      setShowAIModal(false);
      setAiPrompt('');
      setAiPageType('');

      // Redirect to editor with the new page
      router.push(`/website/editor?pageId=${createData.page.id}`);
    } catch (error: unknown) {
      logger.error('[Pages] AI generate error', error instanceof Error ? error : new Error(String(error)));
      toast.error('Failed to generate page with AI');
    } finally {
      setAiGenerating(false);
    }
  }

  function editPage(pageId: string) {
    router.push(`/website/editor?pageId=${pageId}`);
  }

  async function cloneWebsite(): Promise<void> {
    try {
      new URL(cloneSourceUrl.trim());
    } catch {
      setCloneError('Please enter a valid URL (e.g. https://example.com)');
      return;
    }

    try {
      setCloneStatus('cloning');
      setCloneError('');
      setCloneResult(null);

      const token = await auth?.currentUser?.getIdToken();
      const response = await fetch('/api/website/migrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          sourceUrl: cloneSourceUrl.trim(),
          maxPages: cloneMaxPages,
          includeImages: cloneIncludeImages,
        }),
      });

      const data = await response.json() as CloneWebsiteResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? 'Clone failed');
      }

      setCloneResult(data);
      setCloneStatus('success');
      void loadPages();
    } catch (error: unknown) {
      logger.error('[Pages] Clone error', error instanceof Error ? error : new Error(String(error)));
      setCloneError(error instanceof Error ? error.message : 'Clone failed');
      setCloneStatus('error');
    }
  }

  function resetCloneModal(): void {
    setShowCloneModal(false);
    setCloneSourceUrl('');
    setCloneMaxPages(10);
    setCloneIncludeImages(true);
    setCloneStatus('idle');
    setCloneResult(null);
    setCloneError('');
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

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => setShowCloneModal(true)}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'linear-gradient(135deg, #0ea5e9, #2563eb)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '600',
              }}
            >
              Clone Website
            </button>
            <button
              onClick={() => setShowAIModal(true)}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '600',
              }}
            >
              Generate with AI
            </button>
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

      {/* AI Generation Modal */}
      {showAIModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => !aiGenerating && setShowAIModal(false)}
        >
          <div
            style={{
              background: 'var(--color-bg-paper)',
              borderRadius: '12px',
              padding: '2rem',
              width: '100%',
              maxWidth: '540px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.5rem', color: 'var(--color-text-primary)' }}>
              Generate Page with AI
            </h2>
            <p style={{ margin: '0 0 1.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
              Describe the page you want and AI will generate the layout and content.
            </p>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>
                Page Description
              </label>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g., A landing page for a SaaS product with hero section, features grid, pricing table, testimonials, and a call-to-action"
                rows={4}
                disabled={aiGenerating}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  background: 'var(--color-bg-elevated)',
                  color: 'var(--color-text-primary)',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>
                Page Type (optional)
              </label>
              <select
                value={aiPageType}
                onChange={(e) => setAiPageType(e.target.value)}
                disabled={aiGenerating}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit',
                  background: 'var(--color-bg-elevated)',
                  color: 'var(--color-text-primary)',
                  boxSizing: 'border-box',
                }}
              >
                <option value="">Auto-detect</option>
                <option value="landing">Landing Page</option>
                <option value="about">About Page</option>
                <option value="services">Services Page</option>
                <option value="pricing">Pricing Page</option>
                <option value="contact">Contact Page</option>
                <option value="faq">FAQ Page</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowAIModal(false); setAiPrompt(''); setAiPageType(''); }}
                disabled={aiGenerating}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'transparent',
                  color: 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '6px',
                  cursor: aiGenerating ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => void generateWithAI()}
                disabled={aiGenerating || !aiPrompt.trim()}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: aiGenerating || !aiPrompt.trim()
                    ? 'var(--color-text-disabled)'
                    : 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: aiGenerating || !aiPrompt.trim() ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                }}
              >
                {aiGenerating ? 'Generating...' : 'Generate Page'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clone Website Modal */}
      {showCloneModal && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => cloneStatus !== 'cloning' && resetCloneModal()}
        >
          <div
            style={{
              background: 'var(--color-bg-paper)',
              borderRadius: '12px', padding: '2rem',
              width: '100%', maxWidth: '540px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.5rem', color: 'var(--color-text-primary)' }}>
              Clone Website
            </h2>
            <p style={{ margin: '0 0 1.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
              Import pages from an existing website into your website builder.
            </p>

            {cloneStatus === 'cloning' && (
              <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                <div style={{ fontSize: '2rem', marginBottom: '1rem', animation: 'spin 1s linear infinite' }}>&#9881;</div>
                <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>Cloning in progress... This may take a minute.</p>
              </div>
            )}

            {cloneStatus === 'success' && cloneResult && (
              <div>
                <div style={{
                  background: 'var(--color-bg-elevated)', borderRadius: '8px',
                  padding: '1.25rem', marginBottom: '1.5rem',
                  border: '1px solid var(--color-border-light)',
                }}>
                  <p style={{ margin: '0 0 0.5rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>
                    Clone complete
                  </p>
                  <p style={{ margin: '0 0 0.25rem', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                    Pages cloned: {cloneResult.successCount} / {cloneResult.totalPages}
                  </p>
                  {cloneResult.brand?.name && (
                    <p style={{ margin: '0 0 0.25rem', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                      Brand extracted: {cloneResult.brand.name}
                    </p>
                  )}
                  {cloneResult.failedCount > 0 && (
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--color-warning)' }}>
                      {cloneResult.failedCount} page(s) could not be cloned.
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button onClick={resetCloneModal} style={{ padding: '0.75rem 1.5rem', background: 'transparent', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-light)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500' }}>
                    Close
                  </button>
                  <button onClick={() => { resetCloneModal(); void loadPages(); }} style={{ padding: '0.75rem 1.5rem', background: 'linear-gradient(135deg, #0ea5e9, #2563eb)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600' }}>
                    View Pages
                  </button>
                </div>
              </div>
            )}

            {(cloneStatus === 'idle' || cloneStatus === 'error') && (
              <div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>
                    Source URL
                  </label>
                  <input
                    type="url" value={cloneSourceUrl} onChange={e => setCloneSourceUrl(e.target.value)}
                    placeholder="https://example.com"
                    style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--color-border-light)', borderRadius: '6px', fontSize: '0.875rem', fontFamily: 'inherit', background: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>
                    Max pages (1-20)
                  </label>
                  <input
                    type="number" min={1} max={20} value={cloneMaxPages}
                    onChange={e => setCloneMaxPages(Math.min(20, Math.max(1, Number(e.target.value))))}
                    style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--color-border-light)', borderRadius: '6px', fontSize: '0.875rem', fontFamily: 'inherit', background: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input id="clone-include-images" type="checkbox" checked={cloneIncludeImages} onChange={e => setCloneIncludeImages(e.target.checked)} style={{ width: '1rem', height: '1rem', cursor: 'pointer' }} />
                  <label htmlFor="clone-include-images" style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)', cursor: 'pointer' }}>Include images</label>
                </div>
                {cloneStatus === 'error' && cloneError && (
                  <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--color-error)' }}>{cloneError}</p>
                )}
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button onClick={resetCloneModal} style={{ padding: '0.75rem 1.5rem', background: 'transparent', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-light)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500' }}>
                    Cancel
                  </button>
                  <button
                    onClick={() => void cloneWebsite()} disabled={!cloneSourceUrl.trim()}
                    style={{ padding: '0.75rem 1.5rem', background: cloneSourceUrl.trim() ? 'linear-gradient(135deg, #0ea5e9, #2563eb)' : 'var(--color-text-disabled)', color: 'white', border: 'none', borderRadius: '6px', cursor: cloneSourceUrl.trim() ? 'pointer' : 'not-allowed', fontSize: '0.875rem', fontWeight: '600' }}
                  >
                    Start Cloning
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
