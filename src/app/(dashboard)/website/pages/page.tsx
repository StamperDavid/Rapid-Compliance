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
      <div className="p-8">
        <div className="text-muted-foreground">Loading pages...</div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-1">Pages</h1>
          <p className="text-muted-foreground">Manage your website pages</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setShowCloneModal(true)}
            className="px-6 py-3 bg-gradient-to-br from-sky-500 to-blue-600 text-white rounded font-semibold cursor-pointer border-none text-base"
          >
            Clone Website
          </button>
          <button
            onClick={() => setShowAIModal(true)}
            className="px-6 py-3 bg-gradient-to-br from-violet-500 to-indigo-500 text-white rounded font-semibold cursor-pointer border-none text-base"
          >
            Generate with AI
          </button>
          <button
            onClick={createNewPage}
            className="px-6 py-3 bg-info text-white rounded font-semibold cursor-pointer border-none text-base"
          >
            + New Page
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded border text-sm cursor-pointer ${filter === 'all' ? 'bg-info text-white border-info' : 'bg-card text-muted-foreground border-border'}`}
        >
          All ({pages.length})
        </button>
        <button
          onClick={() => setFilter('draft')}
          className={`px-4 py-2 rounded border text-sm cursor-pointer ${filter === 'draft' ? 'bg-info text-white border-info' : 'bg-card text-muted-foreground border-border'}`}
        >
          Drafts
        </button>
        <button
          onClick={() => setFilter('published')}
          className={`px-4 py-2 rounded border text-sm cursor-pointer ${filter === 'published' ? 'bg-info text-white border-info' : 'bg-card text-muted-foreground border-border'}`}
        >
          Published
        </button>
      </div>

      {/* Pages List */}
      {pages.length === 0 ? (
        <div className="bg-card rounded-lg px-8 py-16 text-center">
          <div className="text-5xl mb-4">📄</div>
          <h3 className="text-xl font-medium text-muted-foreground mb-1">No pages yet</h3>
          <p className="text-muted-foreground mb-6">Create your first page to get started</p>
          <button
            onClick={createNewPage}
            className="px-6 py-3 bg-info text-white rounded cursor-pointer border-none text-base font-medium"
          >
            Create Page
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {pages.map((page) => (
            <div
              key={page.id}
              className="bg-card rounded-lg p-6 flex justify-between items-center shadow-sm"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-lg font-medium text-foreground m-0">{page.title}</h3>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${page.status === 'published' ? 'bg-success text-white' : 'bg-warning text-foreground'}`}>
                    {page.status}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">/{page.slug}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Last updated: {new Date(page.updatedAt).toLocaleDateString()}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => editPage(page.id)}
                  className="px-4 py-2 bg-info text-white rounded cursor-pointer border-none text-sm"
                >
                  Edit
                </button>
                <button
                  onClick={() => void duplicatePage(page)}
                  className="px-4 py-2 bg-muted text-white rounded cursor-pointer border-none text-sm"
                >
                  Duplicate
                </button>
                <button
                  onClick={() => deletePage(page.id)}
                  className="px-4 py-2 bg-destructive text-white rounded cursor-pointer border-none text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AI Generation Modal */}
      {showAIModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]"
          onClick={() => !aiGenerating && setShowAIModal(false)}
        >
          <div
            className="bg-card rounded-xl p-8 w-full max-w-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-foreground mb-1">Generate Page with AI</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Describe the page you want and AI will generate the layout and content.
            </p>

            <div className="mb-4">
              <label className="block mb-1.5 font-semibold text-sm text-foreground">
                Page Description
              </label>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g., A landing page for a SaaS product with hero section, features grid, pricing table, testimonials, and a call-to-action"
                rows={4}
                disabled={aiGenerating}
                className="w-full px-3 py-2 border border-border rounded-md text-sm resize-y font-inherit bg-surface-elevated text-foreground box-border"
              />
            </div>

            <div className="mb-6">
              <label className="block mb-1.5 font-semibold text-sm text-foreground">
                Page Type (optional)
              </label>
              <select
                value={aiPageType}
                onChange={(e) => setAiPageType(e.target.value)}
                disabled={aiGenerating}
                className="w-full px-3 py-2 border border-border rounded-md text-sm bg-surface-elevated text-foreground box-border"
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

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowAIModal(false); setAiPrompt(''); setAiPageType(''); }}
                disabled={aiGenerating}
                className="px-6 py-3 bg-transparent text-muted-foreground border border-border rounded-md cursor-pointer disabled:cursor-not-allowed text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => void generateWithAI()}
                disabled={aiGenerating || !aiPrompt.trim()}
                className="px-6 py-3 bg-gradient-to-br from-violet-500 to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white border-none rounded-md cursor-pointer text-sm font-semibold"
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
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]"
          onClick={() => cloneStatus !== 'cloning' && resetCloneModal()}
        >
          <div
            className="bg-card rounded-xl p-8 w-full max-w-lg shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-foreground mb-1">Clone Website</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Import pages from an existing website into your website builder.
            </p>

            {cloneStatus === 'cloning' && (
              <div className="text-center py-8">
                <div className="text-3xl mb-4 animate-spin inline-block">&#9881;</div>
                <p className="text-muted-foreground m-0">Cloning in progress... This may take a minute.</p>
              </div>
            )}

            {cloneStatus === 'success' && cloneResult && (
              <div>
                <div className="bg-surface-elevated rounded-lg p-5 mb-6 border border-border">
                  <p className="font-semibold text-foreground mb-1">Clone complete</p>
                  <p className="text-sm text-muted-foreground mb-0.5">
                    Pages cloned: {cloneResult.successCount} / {cloneResult.totalPages}
                  </p>
                  {cloneResult.brand?.name && (
                    <p className="text-sm text-muted-foreground mb-0.5">
                      Brand extracted: {cloneResult.brand.name}
                    </p>
                  )}
                  {cloneResult.failedCount > 0 && (
                    <p className="text-sm text-warning mt-1">
                      {cloneResult.failedCount} page(s) could not be cloned.
                    </p>
                  )}
                </div>
                <div className="flex gap-3 justify-end">
                  <button onClick={resetCloneModal} className="px-6 py-3 bg-transparent text-muted-foreground border border-border rounded-md cursor-pointer text-sm font-medium">
                    Close
                  </button>
                  <button onClick={() => { resetCloneModal(); void loadPages(); }} className="px-6 py-3 bg-gradient-to-br from-sky-500 to-blue-600 text-white border-none rounded-md cursor-pointer text-sm font-semibold">
                    View Pages
                  </button>
                </div>
              </div>
            )}

            {(cloneStatus === 'idle' || cloneStatus === 'error') && (
              <div>
                <div className="mb-4">
                  <label className="block mb-1.5 font-semibold text-sm text-foreground">
                    Source URL
                  </label>
                  <input
                    type="url" value={cloneSourceUrl} onChange={e => setCloneSourceUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full px-3 py-2 border border-border rounded-md text-sm bg-surface-elevated text-foreground box-border"
                  />
                </div>
                <div className="mb-4">
                  <label className="block mb-1.5 font-semibold text-sm text-foreground">
                    Max pages (1-20)
                  </label>
                  <input
                    type="number" min={1} max={20} value={cloneMaxPages}
                    onChange={e => setCloneMaxPages(Math.min(20, Math.max(1, Number(e.target.value))))}
                    className="w-full px-3 py-2 border border-border rounded-md text-sm bg-surface-elevated text-foreground box-border"
                  />
                </div>
                <div className="mb-6 flex items-center gap-2">
                  <input id="clone-include-images" type="checkbox" checked={cloneIncludeImages} onChange={e => setCloneIncludeImages(e.target.checked)} className="w-4 h-4 cursor-pointer" />
                  <label htmlFor="clone-include-images" className="text-sm text-foreground cursor-pointer">Include images</label>
                </div>
                {cloneStatus === 'error' && cloneError && (
                  <p className="text-sm text-destructive mb-4">{cloneError}</p>
                )}
                <div className="flex gap-3 justify-end">
                  <button onClick={resetCloneModal} className="px-6 py-3 bg-transparent text-muted-foreground border border-border rounded-md cursor-pointer text-sm font-medium">
                    Cancel
                  </button>
                  <button
                    onClick={() => void cloneWebsite()} disabled={!cloneSourceUrl.trim()}
                    className="px-6 py-3 bg-gradient-to-br from-sky-500 to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white border-none rounded-md cursor-pointer text-sm font-semibold"
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
