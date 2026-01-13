/**
 * Blog Posts Management
 * List and manage all blog posts
 * CRITICAL: Multi-tenant - scoped to organizationId
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { BlogPost } from '@/types/website';

export default function BlogManagementPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'draft' | 'published'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    loadPosts();
    loadCategories();
  }, [orgId, filter, categoryFilter]);

  async function loadPosts() {
    try {
      setLoading(true);
      let url = `/api/website/blog/posts?organizationId=${orgId}`;
      
      if (filter !== 'all') {
        url += `&status=${filter}`;
      }
      
      if (categoryFilter !== 'all') {
        url += `&category=${encodeURIComponent(categoryFilter)}`;
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {throw new Error('Failed to load posts');}
      
      const data = await response.json();
      setPosts(data.posts ?? []);
    } catch (error) {
      console.error('[Blog] Load error:', error);
      alert('Failed to load blog posts');
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    try {
      const response = await fetch(`/api/website/blog/categories?organizationId=${orgId}`);
      
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories ?? []);
      }
    } catch (error) {
      console.error('[Blog] Load categories error:', error);
    }
  }

  async function deletePost(postId: string) {
    if (!confirm('Are you sure you want to delete this post?')) {return;}

    try {
      const response = await fetch(
        `/api/website/blog/posts/${postId}?organizationId=${orgId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {throw new Error('Failed to delete post');}

      alert('Post deleted successfully');
      loadPosts();
    } catch (error) {
      console.error('[Blog] Delete error:', error);
      alert('Failed to delete post');
    }
  }

  async function toggleFeatured(post: BlogPost) {
    try {
      const response = await fetch(`/api/website/blog/posts/${post.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: orgId,
          post: {
            ...post,
            featured: !post.featured,
          },
        }),
      });

      if (!response.ok) {throw new Error('Failed to update post');}

      loadPosts();
    } catch (error) {
      console.error('[Blog] Toggle featured error:', error);
      alert('Failed to update post');
    }
  }

  function createNewPost() {
    router.push(`/workspace/${orgId}/website/blog/editor`);
  }

  function editPost(postId: string) {
    router.push(`/workspace/${orgId}/website/blog/editor?postId=${postId}`);
  }

  function manageCategories() {
    router.push(`/workspace/${orgId}/website/blog/categories`);
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
        <div>Loading blog posts...</div>
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
              Blog Posts
            </h1>
            <p style={{ margin: 0, color: '#666' }}>
              Create and manage your blog content
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={manageCategories}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#6c757d',
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
                background: '#007bff',
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
                background: filter === 'all' ? '#007bff' : 'white',
                color: filter === 'all' ? 'white' : '#495057',
                border: '1px solid #dee2e6',
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

          {/* Category Filter */}
          {categories.length > 0 && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #dee2e6',
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
            background: 'white',
            borderRadius: '8px',
            padding: '4rem 2rem',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📝</div>
            <h3 style={{ fontSize: '1.25rem', margin: '0 0 0.5rem', color: '#495057' }}>
              No blog posts yet
            </h3>
            <p style={{ margin: '0 0 1.5rem', color: '#6c757d' }}>
              Create your first blog post to get started
            </p>
            <button
              onClick={createNewPost}
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
                  background: 'white',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  display: 'flex',
                  gap: '1.5rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
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
                  }}>
                    <img
                      src={post.featuredImage}
                      alt={post.title}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  </div>
                )}

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#212529', flex: 1 }}>
                      {post.title}
                    </h3>
                    <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        background: post.status === 'published' ? '#28a745' : '#ffc107',
                        color: post.status === 'published' ? 'white' : '#000',
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
                          background: '#fd7e14',
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
                    color: '#6c757d',
                    margin: '0 0 0.75rem',
                    lineHeight: '1.5',
                  }}>
                    {post.excerpt}
                  </p>

                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: '#adb5bd', marginBottom: '1rem' }}>
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
                      onClick={() => toggleFeatured(post)}
                      style={{
                        padding: '0.5rem 1rem',
                        background: post.featured ? '#6c757d' : '#fd7e14',
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
                      onClick={() => deletePost(post.id)}
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


