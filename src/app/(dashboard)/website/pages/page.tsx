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
            onClick={() => router.push('/website/clone-site')}
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

    </div>
  );
}
