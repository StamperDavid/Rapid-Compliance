'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SocialPostEngagement {
  likes: number;
  comments: number;
  shares: number;
  views: number;
}

interface SocialPost {
  id: string;
  platform: 'linkedin' | 'twitter' | 'facebook' | 'instagram';
  content: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  scheduledFor?: string;
  publishedAt?: string;
  hashtags?: string[];
  engagement?: SocialPostEngagement;
  createdAt: string;
}

interface PostsResponse {
  success: boolean;
  posts?: SocialPost[];
  error?: string;
}

interface MutationResponse {
  success: boolean;
  error?: string;
}

interface QueuedItem {
  id: string;
  platform: string;
  content: string;
  status: string;
  queuePosition: number;
  createdAt: string;
}

interface ScheduledItem {
  id: string;
  platform: string;
  content: string;
  status: string;
  scheduledAt: string;
}

interface AgentStatusResponse {
  success: boolean;
  status?: {
    agentEnabled: boolean;
    queueDepth: number;
    scheduledCount: number;
    todayPublished: number;
    nextPostTime: string | null;
    recentPublished: Array<{
      id: string;
      platform: string;
      content: string;
      publishedAt: string;
      status: string;
    }>;
  };
}

interface QueueResponse {
  success: boolean;
  queue?: QueuedItem[];
}

interface ScheduleResponse {
  success: boolean;
  scheduled?: ScheduledItem[];
}

type StudioMode = 'autopilot' | 'manual';

type Platform = 'twitter' | 'linkedin' | 'facebook' | 'instagram';

const PLATFORMS: Platform[] = ['twitter', 'linkedin', 'facebook', 'instagram'];

const PLATFORM_BADGE_COLORS: Record<string, string> = {
  twitter: '#000000',
  linkedin: '#0A66C2',
  facebook: '#1877F2',
  instagram: '#E4405F',
};

export default function SocialMediaCampaignsPage() {
  const { user } = useAuth();
  const toast = useToast();

  // ─── Dual-mode state ─────────────────────────────────────────────
  const [studioMode, setStudioMode] = useState<StudioMode>('autopilot');
  const [agentStatus, setAgentStatus] = useState<AgentStatusResponse['status'] | null>(null);
  const [queuedPosts, setQueuedPosts] = useState<QueuedItem[]>([]);
  const [scheduledPosts2, setScheduledPosts2] = useState<ScheduledItem[]>([]);
  const [autopilotLoading, setAutopilotLoading] = useState(true);

  const loadAutopilotData = useCallback(async () => {
    try {
      setAutopilotLoading(true);
      const [statusRes, queueRes, scheduleRes] = await Promise.all([
        fetch('/api/social/agent-status'),
        fetch('/api/social/queue'),
        fetch('/api/social/schedule'),
      ]);

      const statusData = (await statusRes.json()) as AgentStatusResponse;
      const queueData = (await queueRes.json()) as QueueResponse;
      const scheduleData = (await scheduleRes.json()) as ScheduleResponse;

      if (statusData.success && statusData.status) {
        setAgentStatus(statusData.status);
      }
      if (queueData.success && queueData.queue) {
        setQueuedPosts(queueData.queue);
      }
      if (scheduleData.success && scheduleData.scheduled) {
        setScheduledPosts2(scheduleData.scheduled);
      }
    } catch {
      toast.error('Failed to load autopilot data');
    } finally {
      setAutopilotLoading(false);
    }
  }, [toast]);

  const [activeTab, setActiveTab] = useState<'posts' | 'analytics' | 'settings'>('posts');
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPlatform, setFilterPlatform] = useState<'all' | Platform>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingPost, setEditingPost] = useState<SocialPost | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Form state
  const [formPlatform, setFormPlatform] = useState<Platform>('linkedin');
  const [formContent, setFormContent] = useState('');
  const [formStatus, setFormStatus] = useState<'draft' | 'scheduled'>('draft');
  const [formScheduledFor, setFormScheduledFor] = useState('');

  const loadPosts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterPlatform !== 'all') {
        params.set('platform', filterPlatform);
      }
      if (filterStatus !== 'all') {
        params.set('status', filterStatus);
      }

      const url = `/api/social/posts${params.toString() ? `?${params}` : ''}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as PostsResponse;
        if (data.success && data.posts) {
          setPosts(data.posts);
        }
      }
    } catch {
      toast.error('Failed to load social posts');
    } finally {
      setLoading(false);
    }
  }, [filterPlatform, filterStatus, toast]);

  useEffect(() => {
    if (user) {
      void loadPosts();
      void loadAutopilotData();
    }
  }, [user, loadPosts, loadAutopilotData]);

  const resetForm = () => {
    setFormPlatform('linkedin');
    setFormContent('');
    setFormStatus('draft');
    setFormScheduledFor('');
  };

  const openCreateModal = () => {
    resetForm();
    setEditingPost(null);
    setShowModal(true);
  };

  const openEditModal = (post: SocialPost) => {
    setFormPlatform(post.platform);
    setFormContent(post.content);
    setFormStatus(post.status === 'published' ? 'draft' : (post.status as 'draft' | 'scheduled'));
    setFormScheduledFor(post.scheduledFor ? new Date(post.scheduledFor).toISOString().slice(0, 16) : '');
    setEditingPost(post);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formContent.trim()) {
      toast.error('Content is required');
      return;
    }

    try {
      if (editingPost) {
        const res = await fetch('/api/social/posts', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            postId: editingPost.id,
            platform: formPlatform,
            content: formContent,
            status: formStatus,
            scheduledFor: formScheduledFor || undefined,
          }),
        });
        const data = (await res.json()) as MutationResponse;
        if (data.success) {
          toast.success('Post updated');
        } else {
          toast.error(data.error ?? 'Failed to update');
          return;
        }
      } else {
        const res = await fetch('/api/social/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform: formPlatform,
            content: formContent,
            status: formStatus,
            scheduledFor: formScheduledFor || undefined,
          }),
        });
        const data = (await res.json()) as MutationResponse;
        if (data.success) {
          toast.success('Post created');
        } else {
          toast.error(data.error ?? 'Failed to create');
          return;
        }
      }

      setShowModal(false);
      resetForm();
      await loadPosts();
    } catch {
      toast.error('Failed to save post');
    }
  };

  const handleDelete = async (postId: string) => {
    try {
      const res = await fetch(`/api/social/posts?postId=${postId}`, { method: 'DELETE' });
      const data = (await res.json()) as MutationResponse;
      if (data.success) {
        toast.success('Post deleted');
        setDeleteConfirm(null);
        await loadPosts();
      } else {
        toast.error(data.error ?? 'Failed to delete');
      }
    } catch {
      toast.error('Failed to delete post');
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'linkedin': return '💼';
      case 'twitter': return '🐦';
      case 'facebook': return '👤';
      case 'instagram': return '📷';
      default: return '🌐';
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'published': return 'bg-success/20 text-success border-success/30';
      case 'scheduled': return 'bg-primary/20 text-primary border-primary/30';
      case 'draft': return 'bg-warning/20 text-warning border-warning/30';
      case 'failed': return 'bg-error/20 text-error border-error/30';
      default: return 'bg-surface-elevated text-[var(--color-text-disabled)] border-border-light';
    }
  };

  // Stats calculations
  const totalPosts = posts.length;
  const publishedPosts = posts.filter((p) => p.status === 'published').length;
  const scheduledPosts = posts.filter((p) => p.status === 'scheduled').length;
  const totalEngagement = posts.reduce(
    (sum, p) => sum + (p.engagement ? p.engagement.likes + p.engagement.comments + p.engagement.shares : 0),
    0
  );

  return (
    <div className="min-h-screen bg-surface-main p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-[var(--color-text-primary)] flex items-center gap-3">
              Content Studio
            </h1>
            <p className="text-[var(--color-text-secondary)] text-sm mt-1">
              AI-powered content creation with manual override
            </p>
          </div>
          <div className="flex items-center gap-3">
            {studioMode === 'manual' && (
              <button
                onClick={openCreateModal}
                className="px-4 py-2 bg-primary text-white font-semibold rounded-xl hover:bg-primary-light transition-all text-sm"
              >
                + New Post
              </button>
            )}
          </div>
        </div>

        {/* ── Mode Toggle ─────────────────────────────────────────── */}
        <div className="flex items-center gap-1 mb-6 p-1 bg-surface-elevated border border-border-light rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setStudioMode('autopilot')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              studioMode === 'autopilot'
                ? 'bg-primary text-white shadow-sm'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            Autopilot
          </button>
          <button
            type="button"
            onClick={() => setStudioMode('manual')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              studioMode === 'manual'
                ? 'bg-primary text-white shadow-sm'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            Manual
          </button>
        </div>

        {/* ── Autopilot Mode ─────────────────────────────────────── */}
        {studioMode === 'autopilot' && (
          <div>
            {/* Agent Status Banner */}
            {agentStatus && (
              <div
                className={`flex items-center justify-between p-4 rounded-2xl mb-6 border ${
                  agentStatus.agentEnabled
                    ? 'bg-success/5 border-success/20'
                    : 'bg-error/5 border-error/20'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full ${agentStatus.agentEnabled ? 'bg-success' : 'bg-error'}`}
                    style={{ boxShadow: agentStatus.agentEnabled ? '0 0 8px rgba(76,175,80,0.4)' : '0 0 8px rgba(244,67,54,0.4)' }}
                  />
                  <div>
                    <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {agentStatus.agentEnabled ? 'AI Agent is driving' : 'AI Agent is paused'}
                    </div>
                    <div className="text-xs text-[var(--color-text-secondary)]">
                      {agentStatus.todayPublished} posted today &middot; {agentStatus.queueDepth} in queue &middot; {agentStatus.scheduledCount} scheduled
                      {agentStatus.nextPostTime && (
                        <> &middot; Next post {new Date(agentStatus.nextPostTime) > new Date() ? `in ${Math.round((new Date(agentStatus.nextPostTime).getTime() - Date.now()) / 60000)} min` : 'overdue'}</>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {autopilotLoading ? (
              <div className="text-center py-12 text-[var(--color-text-secondary)]">Loading AI drafts...</div>
            ) : (
              <>
                {/* Queued Posts */}
                {queuedPosts.length > 0 && (
                  <div className="mb-6">
                    <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">
                      Queue ({queuedPosts.length} posts)
                    </h2>
                    <div className="space-y-2">
                      {queuedPosts.map((item) => (
                        <div key={item.id} className="bg-surface-paper border border-border-light rounded-xl p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <span
                                className="text-[10px] font-bold uppercase px-2 py-0.5 rounded text-white shrink-0 mt-0.5"
                                style={{ backgroundColor: PLATFORM_BADGE_COLORS[item.platform] ?? '#666' }}
                              >
                                {item.platform}
                              </span>
                              <div className="min-w-0">
                                <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">
                                  {item.content}
                                </p>
                                <div className="text-xs text-[var(--color-text-disabled)] mt-1">
                                  Queue position: #{item.queuePosition}
                                </div>
                              </div>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 font-semibold shrink-0 ml-2">
                              QUEUED
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Scheduled Posts */}
                {scheduledPosts2.length > 0 && (
                  <div className="mb-6">
                    <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">
                      Scheduled ({scheduledPosts2.length} posts)
                    </h2>
                    <div className="space-y-2">
                      {scheduledPosts2.map((item) => (
                        <div key={item.id} className="bg-surface-paper border border-border-light rounded-xl p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <span
                                className="text-[10px] font-bold uppercase px-2 py-0.5 rounded text-white shrink-0 mt-0.5"
                                style={{ backgroundColor: PLATFORM_BADGE_COLORS[item.platform] ?? '#666' }}
                              >
                                {item.platform}
                              </span>
                              <div className="min-w-0">
                                <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">
                                  {item.content}
                                </p>
                                <div className="text-xs text-[var(--color-text-disabled)] mt-1">
                                  Scheduled for {new Date(item.scheduledAt).toLocaleString()}
                                </div>
                              </div>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold shrink-0 ml-2">
                              SCHEDULED
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recently Published */}
                {agentStatus?.recentPublished && agentStatus.recentPublished.length > 0 && (
                  <div className="mb-6">
                    <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">
                      Recently Published
                    </h2>
                    <div className="space-y-2">
                      {agentStatus.recentPublished.map((item) => (
                        <div key={item.id} className="bg-surface-paper border border-border-light rounded-xl p-4 opacity-80">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <span
                                className="text-[10px] font-bold uppercase px-2 py-0.5 rounded text-white shrink-0 mt-0.5"
                                style={{ backgroundColor: PLATFORM_BADGE_COLORS[item.platform] ?? '#666' }}
                              >
                                {item.platform}
                              </span>
                              <div className="min-w-0">
                                <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">
                                  {item.content}
                                </p>
                                <div className="text-xs text-[var(--color-text-disabled)] mt-1">
                                  Published {new Date(item.publishedAt).toLocaleString()}
                                </div>
                              </div>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/10 text-success font-semibold shrink-0 ml-2">
                              LIVE
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {queuedPosts.length === 0 && scheduledPosts2.length === 0 && (
                  <div className="rounded-2xl bg-surface-paper border border-border-light p-12 text-center">
                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                      No AI Drafts Yet
                    </h3>
                    <p className="text-[var(--color-text-secondary)] text-sm mb-4">
                      The AI agent will generate content and queue it here. You can review, edit, and approve before it goes live.
                    </p>
                    <button
                      type="button"
                      onClick={() => setStudioMode('manual')}
                      className="px-4 py-2 bg-primary text-white font-semibold rounded-xl hover:bg-primary-light transition-all text-sm"
                    >
                      Switch to Manual Mode
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Manual Mode (existing UI below) ─────────────────────── */}
        {studioMode === 'manual' && (
          <>
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Posts', value: totalPosts.toString(), icon: '📝' },
            { label: 'Published', value: publishedPosts.toString(), icon: '✅' },
            { label: 'Scheduled', value: scheduledPosts.toString(), icon: '📅' },
            { label: 'Total Engagement', value: totalEngagement > 999 ? `${(totalEngagement / 1000).toFixed(1)}K` : totalEngagement.toString(), icon: '💬' },
          ].map((stat, i) => (
            <div key={i} className="bg-surface-paper border border-border-light rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{stat.icon}</span>
                <span className="text-xs text-[var(--color-text-secondary)]">{stat.label}</span>
              </div>
              <div className="text-xl font-bold text-[var(--color-text-primary)]">{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 border-b border-border-light pb-3">
          {[
            { id: 'posts', label: 'Posts', icon: '📝' },
            { id: 'analytics', label: 'Analytics', icon: '📈' },
            { id: 'settings', label: 'Settings', icon: '⚙️' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-all ${
                activeTab === tab.id
                  ? 'bg-primary/10 text-primary border border-primary/30'
                  : 'bg-surface-paper text-[var(--color-text-secondary)] border border-border-light hover:bg-surface-elevated'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Posts Tab */}
        {activeTab === 'posts' && (
          <>
            {/* Filters */}
            <div className="flex gap-3 mb-4">
              <select
                value={filterPlatform}
                onChange={(e) => setFilterPlatform(e.target.value as typeof filterPlatform)}
                className="px-3 py-2 bg-surface-paper border border-border-light rounded-xl text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">All Platforms</option>
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>{getPlatformIcon(p)} {p}</option>
                ))}
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 bg-surface-paper border border-border-light rounded-xl text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="scheduled">Scheduled</option>
                <option value="published">Published</option>
              </select>
            </div>

            {loading ? (
              <div className="text-center py-12 text-[var(--color-text-secondary)]">Loading posts...</div>
            ) : posts.length === 0 ? (
              <div className="rounded-2xl bg-surface-paper border border-border-light p-12 text-center">
                <div className="text-4xl mb-3">📱</div>
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">No Social Posts Yet</h3>
                <p className="text-[var(--color-text-secondary)] text-sm mb-4">
                  Create your first social media post to get started.
                </p>
                <button
                  onClick={openCreateModal}
                  className="px-4 py-2 bg-primary text-white font-semibold rounded-xl hover:bg-primary-light transition-all text-sm"
                >
                  + New Post
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {posts.map((post) => (
                  <div
                    key={post.id}
                    className="bg-surface-paper border border-border-light rounded-2xl p-5"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{getPlatformIcon(post.platform)}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusStyle(post.status)}`}>
                          {post.status}
                        </span>
                        {post.scheduledFor && (
                          <span className="text-xs text-[var(--color-text-secondary)]">
                            Scheduled: {new Date(post.scheduledFor).toLocaleString()}
                          </span>
                        )}
                        {post.publishedAt && (
                          <span className="text-xs text-[var(--color-text-secondary)]">
                            Published: {new Date(post.publishedAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openEditModal(post)}
                          className="px-2.5 py-1 text-xs bg-surface-elevated border border-border-light rounded-lg hover:bg-surface-main transition-all"
                        >
                          Edit
                        </button>
                        {deleteConfirm === post.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => void handleDelete(post.id)}
                              className="px-2 py-1 text-[10px] font-semibold bg-error text-white rounded"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="px-2 py-1 text-[10px] text-[var(--color-text-secondary)]"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(post.id)}
                            className="px-2.5 py-1 text-xs bg-error/10 text-error border border-error/20 rounded-lg hover:bg-error/20 transition-all"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-sm text-[var(--color-text-primary)] leading-relaxed mb-2">
                      {post.content}
                    </p>

                    {post.hashtags && post.hashtags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {post.hashtags.map((tag) => (
                          <span key={tag} className="text-xs text-primary">#{tag}</span>
                        ))}
                      </div>
                    )}

                    {post.engagement && (
                      <div className="flex gap-4 mt-3 px-3 py-2 bg-surface-elevated rounded-xl">
                        <div>
                          <span className="text-[10px] text-[var(--color-text-disabled)]">Likes</span>
                          <div className="text-sm font-semibold text-[var(--color-text-primary)]">{post.engagement.likes}</div>
                        </div>
                        <div>
                          <span className="text-[10px] text-[var(--color-text-disabled)]">Comments</span>
                          <div className="text-sm font-semibold text-[var(--color-text-primary)]">{post.engagement.comments}</div>
                        </div>
                        <div>
                          <span className="text-[10px] text-[var(--color-text-disabled)]">Shares</span>
                          <div className="text-sm font-semibold text-[var(--color-text-primary)]">{post.engagement.shares}</div>
                        </div>
                        <div>
                          <span className="text-[10px] text-[var(--color-text-disabled)]">Views</span>
                          <div className="text-sm font-semibold text-[var(--color-text-primary)]">{post.engagement.views.toLocaleString()}</div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="rounded-2xl bg-surface-paper border border-border-light p-8 text-center">
            <div className="text-4xl mb-3">📈</div>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">Social Analytics</h3>
            <p className="text-[var(--color-text-secondary)] text-sm mb-6">
              Engagement metrics from your published posts
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
              {[
                { label: 'Total Reach', value: posts.reduce((s, p) => s + (p.engagement?.views ?? 0), 0) },
                { label: 'Total Likes', value: posts.reduce((s, p) => s + (p.engagement?.likes ?? 0), 0) },
                { label: 'Total Comments', value: posts.reduce((s, p) => s + (p.engagement?.comments ?? 0), 0) },
                { label: 'Total Shares', value: posts.reduce((s, p) => s + (p.engagement?.shares ?? 0), 0) },
              ].map((stat, i) => (
                <div key={i} className="p-3 bg-surface-elevated rounded-xl">
                  <div className="text-xs text-[var(--color-text-disabled)] mb-1">{stat.label}</div>
                  <div className="text-lg font-bold text-[var(--color-text-primary)]">
                    {stat.value > 999 ? `${(stat.value / 1000).toFixed(1)}K` : stat.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Settings Tab (Manual Mode) */}
        {activeTab === 'settings' && (
          <div className="rounded-2xl bg-surface-paper border border-border-light p-6">
            <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-4">Connected Accounts</h3>
            <div className="space-y-3">
              {[
                { platform: 'LinkedIn', icon: '💼', connected: true, account: '@yourcompany' },
                { platform: 'Twitter / X', icon: '🐦', connected: true, account: '@yourcompany' },
                { platform: 'Facebook', icon: '👤', connected: false },
                { platform: 'Instagram', icon: '📷', connected: false },
              ].map((account, i) => (
                <div key={i} className="flex justify-between items-center p-3 bg-surface-elevated rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{account.icon}</span>
                    <div>
                      <div className="text-sm font-medium text-[var(--color-text-primary)]">{account.platform}</div>
                      {account.connected && (
                        <div className="text-xs text-[var(--color-text-secondary)]">{account.account}</div>
                      )}
                    </div>
                  </div>
                  <button
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      account.connected
                        ? 'bg-error/10 text-error border border-error/20 hover:bg-error/20'
                        : 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20'
                    }`}
                  >
                    {account.connected ? 'Disconnect' : 'Connect'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
          </>
        )}
      </div>

      {/* Create/Edit Post Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-surface-paper border border-border-light rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-4">
              {editingPost ? 'Edit Post' : 'New Social Post'}
            </h2>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Platform</label>
                <select
                  value={formPlatform}
                  onChange={(e) => setFormPlatform(e.target.value as Platform)}
                  className="w-full px-3 py-2 bg-surface-elevated border border-border-light rounded-lg text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {PLATFORMS.map((p) => (
                    <option key={p} value={p}>{getPlatformIcon(p)} {p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Content</label>
                <textarea
                  placeholder="Write your post content..."
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 bg-surface-elevated border border-border-light rounded-lg text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
                <div className="text-right text-[10px] text-[var(--color-text-disabled)] mt-1">
                  {formContent.length} characters
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as typeof formStatus)}
                    className="w-full px-3 py-2 bg-surface-elevated border border-border-light rounded-lg text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="draft">Draft</option>
                    <option value="scheduled">Scheduled</option>
                  </select>
                </div>
                {formStatus === 'scheduled' && (
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Schedule For</label>
                    <input
                      type="datetime-local"
                      value={formScheduledFor}
                      onChange={(e) => setFormScheduledFor(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-elevated border border-border-light rounded-lg text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={!formContent.trim()}
                className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-light transition-all disabled:opacity-50"
              >
                {editingPost ? 'Save Changes' : 'Create Post'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
