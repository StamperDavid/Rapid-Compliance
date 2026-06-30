'use client';

/**
 * Social Queue — category-based content queues.
 *
 * Organize evergreen queued posts into themed categories (Tips, Promotions,
 * News, Engagement…) and view the queue grouped by category. The cron drips
 * the queue with category round-robin variety when the operator opts in
 * (Autopilot toggle on the Campaigns page) — this page just organizes WHAT is
 * in the queue, it never changes how often posts go out.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useToast } from '@/hooks/useToast';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '@/types/social';
import { PLATFORM_META } from '@/lib/social/platform-config';
import { PageTitle, SectionTitle, SectionDescription, Caption } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const UNCATEGORIZED_LABEL = 'Uncategorized';

interface QueuedItem {
  id: string;
  platform: string;
  content: string;
  status: string;
  queuePosition: number;
  contentCategory: string | null;
  createdAt: string;
}

interface QueueResponse {
  success: boolean;
  queue?: QueuedItem[];
}

interface CategoriesResponse {
  success: boolean;
  categories?: string[];
  error?: string;
}

interface MutationResponse {
  success: boolean;
  error?: string;
}

const PLATFORMS: SocialPlatform[] = [...SOCIAL_PLATFORMS];

function platformBadgeColor(platform: string): string {
  return PLATFORM_META[platform as SocialPlatform]?.color ?? '#666';
}

export default function SocialQueuePage() {
  const { user } = useAuth();
  const authFetch = useAuthFetch();
  const toast = useToast();

  const [queue, setQueue] = useState<QueuedItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Add-to-queue form
  const [formContent, setFormContent] = useState('');
  const [formPlatform, setFormPlatform] = useState<SocialPlatform>('linkedin');
  const [formCategory, setFormCategory] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Category manager
  const [newCategory, setNewCategory] = useState('');
  const [renaming, setRenaming] = useState<{ label: string; value: string } | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [queueRes, catRes] = await Promise.all([
        authFetch('/api/social/queue'),
        authFetch('/api/social/queue/categories'),
      ]);
      const queueData = (await queueRes.json()) as QueueResponse;
      const catData = (await catRes.json()) as CategoriesResponse;
      if (queueData.success && queueData.queue) {
        setQueue(queueData.queue);
      }
      if (catData.success && catData.categories) {
        setCategories(catData.categories);
      }
    } catch {
      toast.error('Failed to load the queue');
    } finally {
      setLoading(false);
    }
  }, [authFetch, toast]);

  useEffect(() => {
    if (user) {
      void loadData();
    }
  }, [user, loadData]);

  // ── Add to queue ──────────────────────────────────────────────────────────
  const handleAddToQueue = async () => {
    if (!formContent.trim()) {
      toast.error('Write some post content first');
      return;
    }
    try {
      setSubmitting(true);
      const res = await authFetch('/api/social/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: formContent.trim(),
          platforms: [formPlatform],
          contentCategory: formCategory || undefined,
        }),
      });
      const data = (await res.json()) as MutationResponse;
      if (data.success) {
        toast.success('Added to the queue');
        setFormContent('');
        setFormCategory('');
        await loadData();
      } else {
        toast.error(data.error ?? 'Could not add to the queue');
      }
    } catch {
      toast.error('Could not add to the queue');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Assign a category to a queued post ────────────────────────────────────
  const handleAssignCategory = async (postId: string, category: string) => {
    try {
      const res = await authFetch('/api/social/queue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId,
          contentCategory: category === '' ? null : category,
        }),
      });
      const data = (await res.json()) as MutationResponse;
      if (data.success) {
        setQueue((prev) =>
          prev.map((p) =>
            p.id === postId ? { ...p, contentCategory: category === '' ? null : category } : p
          )
        );
      } else {
        toast.error(data.error ?? 'Could not update the category');
      }
    } catch {
      toast.error('Could not update the category');
    }
  };

  // ── Remove a queued post ──────────────────────────────────────────────────
  const handleRemovePost = async (postId: string) => {
    try {
      const res = await authFetch('/api/social/queue', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      });
      const data = (await res.json()) as MutationResponse;
      if (data.success) {
        toast.success('Removed from the queue');
        setQueue((prev) => prev.filter((p) => p.id !== postId));
      } else {
        toast.error(data.error ?? 'Could not remove the post');
      }
    } catch {
      toast.error('Could not remove the post');
    }
  };

  // ── Category management ───────────────────────────────────────────────────
  const handleAddCategory = async () => {
    if (!newCategory.trim()) { return; }
    try {
      const res = await authFetch('/api/social/queue/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newCategory.trim() }),
      });
      const data = (await res.json()) as CategoriesResponse;
      if (data.success && data.categories) {
        setCategories(data.categories);
        setNewCategory('');
        toast.success('Category added');
      } else {
        toast.error(data.error ?? 'Could not add the category');
      }
    } catch {
      toast.error('Could not add the category');
    }
  };

  const handleRenameCategory = async () => {
    if (!renaming?.value.trim()) { return; }
    try {
      const res = await authFetch('/api/social/queue/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldLabel: renaming.label, newLabel: renaming.value.trim() }),
      });
      const data = (await res.json()) as CategoriesResponse;
      if (data.success && data.categories) {
        setCategories(data.categories);
        setRenaming(null);
        toast.success('Category renamed');
        await loadData();
      } else {
        toast.error(data.error ?? 'Could not rename the category');
      }
    } catch {
      toast.error('Could not rename the category');
    }
  };

  const handleRemoveCategory = async (label: string) => {
    try {
      const res = await authFetch('/api/social/queue/categories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      });
      const data = (await res.json()) as CategoriesResponse;
      if (data.success && data.categories) {
        setCategories(data.categories);
        toast.success(`Removed "${label}" — its posts are now uncategorized`);
        await loadData();
      } else {
        toast.error(data.error ?? 'Could not remove the category');
      }
    } catch {
      toast.error('Could not remove the category');
    }
  };

  // ── Grouping ──────────────────────────────────────────────────────────────
  // Display order: configured categories first, then any extra categories that
  // appear on posts but are not in the list, then Uncategorized last.
  const groupKeys: string[] = (() => {
    const present = new Set(
      queue.map((p) => (p.contentCategory?.trim() ? p.contentCategory : UNCATEGORIZED_LABEL))
    );
    const keys: string[] = [...categories];
    for (const k of present) {
      if (k !== UNCATEGORIZED_LABEL && !keys.includes(k)) { keys.push(k); }
    }
    keys.push(UNCATEGORIZED_LABEL);
    return keys;
  })();

  const postsForGroup = (key: string): QueuedItem[] =>
    queue
      .filter((p) => {
        const cat = p.contentCategory?.trim() ? p.contentCategory : UNCATEGORIZED_LABEL;
        return cat === key;
      })
      .sort((a, b) => a.queuePosition - b.queuePosition);

  return (
    <div className="p-8 space-y-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <PageTitle>Content Queue</PageTitle>
          <SectionDescription className="mt-1">
            Organize your evergreen posts into themed categories. When Autopilot is on, posts drip
            out one at a time and rotate across your categories for variety — so your audience never
            sees three promos in a row.
          </SectionDescription>
        </div>

        {/* ── Add to queue ──────────────────────────────────────────────── */}
        <div className="bg-card border border-border-strong rounded-2xl p-6 space-y-4">
          <SectionTitle>Add a post to the queue</SectionTitle>
          <textarea
            placeholder="Write your post..."
            value={formContent}
            onChange={(e) => setFormContent(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 bg-surface-elevated border border-border-light rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Caption className="mb-1 block">Platform</Caption>
              <select
                value={formPlatform}
                onChange={(e) => setFormPlatform(e.target.value as SocialPlatform)}
                className="w-full px-3 py-2 bg-surface-elevated border border-border-light rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {PLATFORM_META[p]?.emoji ?? '🌐'} {PLATFORM_META[p]?.label ?? p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Caption className="mb-1 block">Category</Caption>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="w-full px-3 py-2 bg-surface-elevated border border-border-light rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => void handleAddToQueue()}
                disabled={submitting || !formContent.trim()}
                className="w-full"
              >
                {submitting ? 'Adding...' : 'Add to queue'}
              </Button>
            </div>
          </div>
        </div>

        {/* ── Manage categories ─────────────────────────────────────────── */}
        <div className="bg-card border border-border-strong rounded-2xl p-6 space-y-4">
          <SectionTitle>Categories</SectionTitle>
          <SectionDescription>
            Add, rename, or remove the themed buckets your queue rotates through.
          </SectionDescription>
          <div className="flex flex-wrap gap-2">
            {categories.length === 0 && (
              <Caption>No categories yet — add one below.</Caption>
            )}
            {categories.map((c) => (
              <div
                key={c}
                className="flex items-center gap-2 bg-surface-elevated border border-border-light rounded-lg px-3 py-1.5"
              >
                {renaming?.label === c ? (
                  <>
                    <Input
                      value={renaming.value}
                      onChange={(e) => setRenaming({ label: c, value: e.target.value })}
                      className="h-7 w-32 text-sm"
                    />
                    <Button size="sm" onClick={() => void handleRenameCategory()}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setRenaming(null)}>Cancel</Button>
                  </>
                ) : (
                  <>
                    <span className="text-sm text-foreground font-medium">{c}</span>
                    <span className="text-xs text-muted-foreground">
                      {postsForGroup(c).length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setRenaming({ label: c, value: c })}
                      className="text-xs text-primary hover:underline"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRemoveCategory(c)}
                      className="text-xs text-error hover:underline"
                    >
                      Remove
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2 max-w-sm">
            <Input
              placeholder="New category (e.g. Behind the scenes)"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { void handleAddCategory(); } }}
            />
            <Button variant="outline" onClick={() => void handleAddCategory()} disabled={!newCategory.trim()}>
              Add
            </Button>
          </div>
        </div>

        {/* ── Queue grouped by category ─────────────────────────────────── */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading the queue...</div>
        ) : queue.length === 0 ? (
          <div className="rounded-2xl bg-card border border-border-strong p-12 text-center">
            <SectionTitle>Your queue is empty</SectionTitle>
            <SectionDescription className="mt-2">
              Add evergreen posts above and tag them with a category. They will drip out in
              rotation once Autopilot is turned on.
            </SectionDescription>
          </div>
        ) : (
          <div className="space-y-6">
            {groupKeys.map((key) => {
              const groupPosts = postsForGroup(key);
              if (groupPosts.length === 0) { return null; }
              return (
                <div key={key}>
                  <div className="flex items-center gap-2 mb-3">
                    <SectionTitle>{key}</SectionTitle>
                    <span className="text-xs text-muted-foreground bg-surface-elevated border border-border-light rounded-full px-2 py-0.5">
                      {groupPosts.length} {groupPosts.length === 1 ? 'post' : 'posts'}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {groupPosts.map((item) => (
                      <div key={item.id} className="bg-card border border-border-light rounded-xl p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <span
                              className="text-[10px] font-bold uppercase px-2 py-0.5 rounded text-white shrink-0 mt-0.5"
                              style={{ backgroundColor: platformBadgeColor(item.platform) }}
                            >
                              {item.platform}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm text-foreground leading-relaxed">{item.content}</p>
                              <Caption className="mt-1">Queue position #{item.queuePosition}</Caption>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <select
                              value={item.contentCategory ?? ''}
                              onChange={(e) => void handleAssignCategory(item.id, e.target.value)}
                              className="px-2 py-1 bg-surface-elevated border border-border-light rounded-lg text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                              aria-label="Assign category"
                            >
                              <option value="">No category</option>
                              {categories.map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                              {item.contentCategory && !categories.includes(item.contentCategory) && (
                                <option value={item.contentCategory}>{item.contentCategory}</option>
                              )}
                            </select>
                            <button
                              type="button"
                              onClick={() => void handleRemovePost(item.id)}
                              className="text-xs text-error hover:underline"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
