/**
 * Blog Posts Management
 * List and manage all blog posts
 */

'use client';


import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useToast } from '@/hooks/useToast';
import type { BlogPost } from '@/types/website';
import { logger } from '@/lib/logger/logger';

export default function BlogManagementPage() {
  const router = useRouter();
  const toast = useToast();

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

      const response = await fetch(url);

      if (!response.ok) {throw new Error('Failed to load posts');}

      const data = await response.json() as { posts?: BlogPost[] };
      setPosts(data.posts ?? []);
    } catch (error) {
      logger.error('[Blog] Load error', error instanceof Error ? error : new Error(String(error)));
      toast.error('Failed to load blog posts');
    } finally {
      setLoading(false);
    }
  }, [filter, categoryFilter, toast]);

  const loadCategories = useCallback(async () => {
    try {
      const response = await fetch('/api/website/blog/categories');

      if (response.ok) {
        const data = await response.json() as { categories?: string[] };
        setCategories(data.categories ?? []);
      }
    } catch (error) {
      logger.error('[Blog] Load categories error', error instanceof Error ? error : new Error(String(error)));
    }
  }, []);

  useEffect(() => {
    void loadPosts();
    void loadCategories();
  }, [loadPosts, loadCategories]);

  async function handleDeletePost(postId: string) {
    try {
      const response = await fetch(
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
      const response = await fetch(`/api/website/blog/posts/${post.id}`, {
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
      <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
        <div>Loading blog posts...</div>
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
              Blog Posts
            </h1>
            <p style={{ margin: 0, color: 'var(--color-text-disabled)' }}>
              Create and manage your blog content
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={manageCategories}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'var(--color-text-secondary)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '500',
              }}
            >
              📁 Categories
            </button>
            <button
              onClick={createNewPost}
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
              + New Post
            </button>
          </div>
        </div>

        {/* Filters */}
        <div style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '2rem',
          flexWrap: 'wrap',
        }}>
          {/* Status Filters */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
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
              All ({posts.length})
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

          {/* Category Filter */}
          {categories.length > 0 && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid var(--color-border-light)',
                borderRadius: '4px',
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
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
          <div style={{
            background: 'var(--color-bg-paper)',
            borderRadius: '8px',
            padding: '4rem 2rem',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📝</div>
            <h3 style={{ fontSize: '1.25rem', margin: '0 0 0.5rem', color: 'var(--color-text-disabled)' }}>
              No blog posts yet
            </h3>
            <p style={{ margin: '0 0 1.5rem', color: 'var(--color-text-secondary)' }}>
              Create your first blog post to get started
            </p>
            <button
              onClick={createNewPost}
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
              Create Post
            </button>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gap: '1rem',
          }}>
            {posts.map((post) => (
              <div
                key={post.id}
                style={{
                  background: 'var(--color-bg-paper)',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  display: 'flex',
                  gap: '1.5rem',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                }}
              >
                {/* Featured Image */}
                {post.featuredImage && (
                  <div style={{
                    width: '200px',
                    height: '150px',
                    flexShrink: 0,
                    borderRadius: '4px',
                    overflow: 'hidden',
                    position: 'relative',
                  }}>
                    <Image
                      src={post.featuredImage}
                      alt={post.title}
                      fill
                      style={{
                        objectFit: 'cover',
                      }}
                    />
                  </div>
                )}

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--color-text-primary)', flex: 1 }}>
                      {post.title}
                    </h3>
                    <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        background: post.status === 'published' ? 'var(--color-success)' : 'var(--color-warning)',
                        color: post.status === 'published' ? 'white' : 'var(--color-bg-main)',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                      }}>
                        {post.status}
                      </span>
                      {post.featured && (
                        <span style={{
                          padding: '0.25rem 0.5rem',
                          background: 'var(--color-warning)',
                          color: 'white',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          textTransform: 'uppercase',
                        }}>
                          ⭐ FEATURED
                        </span>
                      )}
                    </div>
                  </div>

                  <p style={{
                    fontSize: '0.875rem',
                    color: 'var(--color-text-secondary)',
                    margin: '0 0 0.75rem',
                    lineHeight: '1.5',
                  }}>
                    {post.excerpt}
                  </p>

                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
                    <span>By {(post.authorName !== '' && post.authorName != null) ? post.authorName : 'Unknown'}</span>
                    <span>•</span>
                    <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                    {post.categories.length > 0 && (
                      <>
                        <span>•</span>
                        <span>{post.categories.join(', ')}</span>
                      </>
                    )}
                    {post.readTime && (
                      <>
                        <span>•</span>
                        <span>{post.readTime} min read</span>
                      </>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => editPost(post.id)}
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
                      onClick={() => void toggleFeatured(post)}
                      style={{
                        padding: '0.5rem 1rem',
                        background: post.featured ? 'var(--color-text-secondary)' : 'var(--color-warning)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                      }}
                    >
                      {post.featured ? 'Unfeature' : 'Feature'}
                    </button>
                    <button
                      onClick={() => handleDeleteClick(post.id)}
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
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div style={{
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
        }}>
          <div style={{
            background: 'var(--color-bg-paper)',
            borderRadius: '8px',
            padding: '2rem',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.25rem', color: 'var(--color-text-primary)' }}>
              Delete Post
            </h3>
            <p style={{ margin: '0 0 1.5rem', color: 'var(--color-text-secondary)' }}>
              Are you sure you want to delete this post? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={cancelDelete}
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
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'var(--color-error)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                }}
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


