/**
 * Blog Posts Management
 * List and manage all blog posts
 */

'use client';


import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useToast } from '@/hooks/useToast';
import type { BlogPost } from '@/types/website';
import { logger } from '@/lib/logger/logger';

export default function BlogManagementPage() {
  const router = useRouter();
  const toast = useToast();
  const authFetch = useAuthFetch();

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'draft' | 'published'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadPosts = useCallback(async () => {
    try {
      setLoading(true);
      let url = '/api/website/blog/posts';
      const params: string[] = [];

      if (filter !== 'all') {
        params.push(`status=${filter}`);
      }

      if (categoryFilter !== 'all') {
        params.push(`category=${encodeURIComponent(categoryFilter)}`);
      }

      if (params.length > 0) {
        url += `?${params.join('&')}`;
      }

      const response = await authFetch(url);

      if (!response.ok) {throw new Error('Failed to load posts');}

      const data = await response.json() as { posts?: BlogPost[] };
      setPosts(data.posts ?? []);
    } catch (error) {
      logger.error('[Blog] Load error', error instanceof Error ? error : new Error(String(error)));
      toast.error('Failed to load blog posts');
    } finally {
      setLoading(false);
    }
  }, [filter, categoryFilter, toast, authFetch]);

  const loadCategories = useCallback(async () => {
    try {
      const response = await authFetch('/api/website/blog/categories');

      if (response.ok) {
        const data = await response.json() as { categories?: string[] };
        setCategories(data.categories ?? []);
      }
    } catch (error) {
      logger.error('[Blog] Load categories error', error instanceof Error ? error : new Error(String(error)));
    }
  }, [authFetch]);

  useEffect(() => {
    void loadPosts();
    void loadCategories();
  }, [loadPosts, loadCategories]);

  async function handleDeletePost(postId: string) {
    try {
      const response = await authFetch(
        `/api/website/blog/posts/${postId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {throw new Error('Failed to delete post');}

      toast.success('Post deleted successfully');
      await loadPosts();
    } catch (error) {
      logger.error('[Blog] Delete error', error instanceof Error ? error : new Error(String(error)));
      toast.error('Failed to delete post');
    } finally {
      setDeleteConfirm(null);
    }
  }

  async function toggleFeatured(post: BlogPost) {
    try {
      const response = await authFetch(`/api/website/blog/posts/${post.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post: {
            ...post,
            featured: !post.featured,
          },
        }),
      });

      if (!response.ok) {throw new Error('Failed to update post');}

      await loadPosts();
    } catch (error) {
      logger.error('[Blog] Toggle featured error', error instanceof Error ? error : new Error(String(error)));
      toast.error('Failed to update post');
    }
  }

  async function quickPublish(post: BlogPost) {
    try {
      const response = await authFetch(`/api/website/blog/posts/${post.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await response.json() as { success?: boolean; error?: string };
      if (!response.ok || json.success !== true) {
        throw new Error(json.error ?? `HTTP ${response.status}`);
      }
      toast.success('Post published');
      await loadPosts();
    } catch (error) {
      logger.error('[Blog] Quick publish error', error instanceof Error ? error : new Error(String(error)));
      toast.error(error instanceof Error ? `Publish failed: ${error.message}` : 'Publish failed');
    }
  }

  async function quickUnpublish(post: BlogPost) {
    try {
      const response = await authFetch(`/api/website/blog/posts/${post.id}/publish`, {
        method: 'DELETE',
      });
      const json = await response.json() as { success?: boolean; error?: string };
      if (!response.ok || json.success !== true) {
        throw new Error(json.error ?? `HTTP ${response.status}`);
      }
      toast.success('Post moved back to draft');
      await loadPosts();
    } catch (error) {
      logger.error('[Blog] Quick unpublish error', error instanceof Error ? error : new Error(String(error)));
      toast.error(error instanceof Error ? `Unpublish failed: ${error.message}` : 'Unpublish failed');
    }
  }

  function handleDeleteClick(postId: string) {
    setDeleteConfirm(postId);
  }

  function confirmDelete() {
    if (deleteConfirm) {
      void handleDeletePost(deleteConfirm);
    }
  }

  function cancelDelete() {
    setDeleteConfirm(null);
  }

  function createNewPost() {
    router.push(`/website/blog/editor`);
  }

  function editPost(postId: string) {
    router.push(`/website/blog/editor?postId=${postId}`);
  }

  function manageCategories() {
    router.push(`/website/blog/categories`);
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-muted-foreground">Loading blog posts...</div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-1">Blog Posts</h1>
          <p className="text-muted-foreground">Create and manage your blog content</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={manageCategories}
            className="px-6 py-3 bg-muted text-white rounded cursor-pointer border-none text-base font-medium"
          >
            Categories
          </button>
          <button
            onClick={createNewPost}
            className="px-6 py-3 bg-info text-white rounded cursor-pointer border-none text-base font-semibold"
          >
            + New Post
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        {/* Status Filters */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded border text-sm cursor-pointer ${filter === 'all' ? 'bg-info text-white border-info' : 'bg-card text-muted-foreground border-border'}`}
          >
            All ({posts.length})
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

        {/* Category Filter */}
        {categories.length > 0 && (
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 border border-border rounded text-sm cursor-pointer bg-card text-foreground"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Posts List */}
      {posts.length === 0 ? (
        <div className="bg-card rounded-lg px-8 py-16 text-center">
          <div className="text-5xl mb-4">📝</div>
          <h3 className="text-xl font-medium text-muted-foreground mb-1">No blog posts yet</h3>
          <p className="text-muted-foreground mb-6">Create your first blog post to get started</p>
          <button
            onClick={createNewPost}
            className="px-6 py-3 bg-info text-white rounded cursor-pointer border-none text-base font-medium"
          >
            Create Post
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {posts.map((post) => (
            <div
              key={post.id}
              className="bg-card rounded-lg p-6 flex gap-6 shadow-sm"
            >
              {/* Featured Image */}
              {post.featuredImage && (
                <div className="w-[200px] h-[150px] flex-shrink-0 rounded overflow-hidden relative">
                  <Image
                    src={post.featuredImage}
                    alt={post.title}
                    fill
                    className="object-cover"
                  />
                </div>
              )}

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-3 mb-1">
                  <h3 className="text-xl font-medium text-foreground flex-1 m-0">{post.title}</h3>
                  <div className="flex gap-2 flex-shrink-0">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${post.status === 'published' ? 'bg-success text-white' : 'bg-warning text-foreground'}`}>
                      {post.status}
                    </span>
                    {post.featured && (
                      <span className="px-2 py-0.5 bg-warning text-white rounded text-xs font-semibold uppercase">
                        FEATURED
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{post.excerpt}</p>

                <div className="flex gap-4 text-xs text-muted-foreground mb-4">
                  <span>By {(post.authorName !== '' && post.authorName != null) ? post.authorName : 'Unknown'}</span>
                  <span>•</span>
                  <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                  {(post.categories ?? []).length > 0 && (
                    <>
                      <span>•</span>
                      <span>{(post.categories ?? []).join(', ')}</span>
                    </>
                  )}
                  {post.readTime && (
                    <>
                      <span>•</span>
                      <span>{post.readTime} min read</span>
                    </>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => editPost(post.id)}
                    className="px-4 py-2 bg-info text-white rounded cursor-pointer border-none text-sm"
                  >
                    Edit
                  </button>
                  {post.status === 'published' ? (
                    <button
                      onClick={() => void quickUnpublish(post)}
                      className="px-4 py-2 bg-warning text-white rounded cursor-pointer border-none text-sm"
                    >
                      Unpublish
                    </button>
                  ) : (
                    <button
                      onClick={() => void quickPublish(post)}
                      className="px-4 py-2 bg-success text-white rounded cursor-pointer border-none text-sm"
                    >
                      Publish
                    </button>
                  )}
                  <button
                    onClick={() => void toggleFeatured(post)}
                    className={`px-4 py-2 text-white rounded cursor-pointer border-none text-sm ${post.featured ? 'bg-muted' : 'bg-warning'}`}
                  >
                    {post.featured ? 'Unfeature' : 'Feature'}
                  </button>
                  <button
                    onClick={() => handleDeleteClick(post.id)}
                    className="px-4 py-2 bg-destructive text-white rounded cursor-pointer border-none text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]">
          <div className="bg-card rounded-lg p-8 max-w-sm w-[90%] shadow-md">
            <h3 className="text-xl font-semibold text-foreground mb-4">Delete Post</h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to delete this post? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 bg-muted text-white rounded cursor-pointer border-none text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-destructive text-white rounded cursor-pointer border-none text-sm font-semibold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


