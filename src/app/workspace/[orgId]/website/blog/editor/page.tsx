/**
 * Blog Post Editor
 * Create and edit blog posts using the visual editor
 * CRITICAL: Multi-tenant - scoped to organizationId
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import EditorCanvas from '@/components/website-builder/EditorCanvas';
import PropertiesPanel from '@/components/website-builder/PropertiesPanel';
import type { BlogPost, PageSection } from '@/types/website';

export default function BlogPostEditorPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const orgId = params.orgId as string;
  const postId = searchParams.get('postId');

  const [post, setPost] = useState<BlogPost | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedElement, setSelectedElement] = useState<any>(null);

  useEffect(() => {
    loadCategories();
    if (postId) {
      loadPost(postId);
    } else {
      createBlankPost();
    }
  }, [postId]);

  async function loadCategories() {
    try {
      const response = await fetch(`/api/website/blog/categories?organizationId=${orgId}`);
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories ?? []);
      }
    } catch (error) {
      console.error('[Blog Editor] Load categories error:', error);
    }
  }

  async function loadPost(id: string) {
    try {
      setLoading(true);
      const response = await fetch(`/api/website/blog/posts/${id}?organizationId=${orgId}`);
      
      if (!response.ok) {throw new Error('Failed to load post');}
      
      const data = await response.json();
      setPost(data.post);
      setTags(data.post.tags ?? []);
    } catch (error) {
      console.error('[Blog Editor] Load error:', error);
      alert('Failed to load post');
    } finally {
      setLoading(false);
    }
  }

  function createBlankPost() {
    const newPost: BlogPost = {
      id: `post_${Date.now()}`,
      organizationId: orgId,
      slug: 'new-post',
      title: 'Untitled Post',
      excerpt: '',
      content: [],
      categories: [],
      tags: [],
      featured: false,
      seo: {
        metaTitle: '',
        metaDescription: '',
      },
      status: 'draft',
      views: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: (user?.email !== '' && user?.email != null) ? user.email : ((user?.displayName !== '' && user?.displayName != null) ? user.displayName : 'anonymous'),
      lastEditedBy: 'current-user',
      author: 'current-user',
      authorName: 'Current User',
    };

    setPost(newPost);
    setLoading(false);
  }

  async function savePost() {
    if (!post) {return;}

    try {
      setSaving(true);
      
      const endpoint = postId 
        ? `/api/website/blog/posts/${postId}`
        : '/api/website/blog/posts';
      
      const method = postId ? 'PUT' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: orgId,
          post: {
            ...post,
            tags,
            updatedAt: new Date().toISOString(),
            lastEditedBy: (user?.email !== '' && user?.email != null) ? user.email : ((user?.displayName !== '' && user?.displayName != null) ? user.displayName : 'anonymous'),
          },
        }),
      });

      if (!response.ok) {throw new Error('Failed to save post');}

      const data = await response.json();
      alert('Post saved successfully!');
      
      // Redirect to posts list
      router.push(`/workspace/${orgId}/website/blog`);
    } catch (error) {
      console.error('[Blog Editor] Save error:', error);
      alert('Failed to save post');
    } finally {
      setSaving(false);
    }
  }

  function updatePost(updates: Partial<BlogPost>) {
    if (!post) {return;}
    setPost({ ...post, ...updates });
  }

  function addSection(sectionData?: Partial<PageSection>) {
    if (!post) {return;}

    const newSection: PageSection = {
      id: `section_${Date.now()}`,
      type: 'section',
      columns: [
        {
          id: `col_${Date.now()}`,
          width: 100,
          widgets: [],
        },
      ],
      padding: { top: '2rem', bottom: '2rem' },
      ...sectionData,
    };

    updatePost({
      content: [...post.content, newSection],
    });
  }

  function updateSection(sectionId: string, updates: Partial<PageSection>) {
    if (!post) {return;}

    const updatedContent = post.content.map(section =>
      section.id === sectionId ? { ...section, ...updates } : section
    );

    updatePost({ content: updatedContent });
  }

  function deleteSection(sectionId: string) {
    if (!post) {return;}
    updatePost({
      content: post.content.filter(s => s.id !== sectionId),
    });
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
        <div>Loading post editor...</div>
      </div>
    );
  }

  if (!post) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
        <div>Failed to load post</div>
      </div>
    );
  }

  return (
    <div style={{
      fontFamily: 'system-ui',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Editor Toolbar */}
      <div style={{
        height: '60px',
        background: '#2c3e50',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.5rem',
        borderBottom: '1px solid #34495e',
      }}>
        <div>
          <div style={{ fontSize: '0.875rem', fontWeight: '600' }}>
            Blog Post: {post.title}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#95a5a6' }}>
            /{post.slug}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={() => router.push(`/workspace/${orgId}/website/blog`)}
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
            Cancel
          </button>
          <button
            onClick={savePost}
            disabled={saving}
            style={{
              padding: '0.5rem 1.5rem',
              background: saving ? '#95a5a6' : '#27ae60',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: '600',
            }}
          >
            {saving ? 'Saving...' : 'Save Post'}
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <div style={{ 
        display: 'flex', 
        flex: 1,
        overflow: 'hidden',
      }}>
        {/* Left Panel: Post Metadata */}
        <div style={{
          width: '300px',
          background: '#f8f9fa',
          borderRight: '1px solid #dee2e6',
          overflowY: 'auto',
          padding: '1.5rem',
        }}>
          <h3 style={{ fontSize: '1.125rem', margin: '0 0 1.5rem', color: '#212529' }}>
            Post Settings
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#495057',
              }}>
                Title:
              </label>
              <input
                type="text"
                value={post.title}
                onChange={(e) => updatePost({ title: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#495057',
              }}>
                Slug:
              </label>
              <input
                type="text"
                value={post.slug}
                onChange={(e) => updatePost({ slug: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#495057',
              }}>
                Excerpt:
              </label>
              <textarea
                value={post.excerpt}
                onChange={(e) => updatePost({ excerpt: e.target.value })}
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#495057',
              }}>
                Featured Image URL:
              </label>
              <input
                type="text"
                value={post.featuredImage ?? ''}
                onChange={(e) => updatePost({ featuredImage: e.target.value })}
                placeholder="https://..."
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#495057',
              }}>
                Categories:
              </label>
              <select
                multiple
                value={post.categories}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, option => option.value);
                  updatePost({ categories: selected });
                }}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  minHeight: '100px',
                }}
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <small style={{ display: 'block', marginTop: '0.25rem', color: '#6c757d' }}>
                Hold Ctrl/Cmd to select multiple
              </small>
            </div>

            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#495057',
              }}>
                Tags (comma-separated):
              </label>
              <input
                type="text"
                value={tags.join(', ')}
                onChange={(e) => setTags(e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                placeholder="tag1, tag2, tag3"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#495057',
              }}>
                Status:
              </label>
              <select
                value={post.status}
                onChange={(e) => updatePost({ status: e.target.value as any })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                }}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="scheduled">Scheduled</option>
              </select>
            </div>

            <div>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#495057',
                cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={post.featured}
                  onChange={(e) => updatePost({ featured: e.target.checked })}
                  style={{ width: '16px', height: '16px' }}
                />
                Featured Post
              </label>
            </div>
          </div>
        </div>

        {/* Center Panel: Content Editor */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <EditorCanvas
            page={{ ...post, content: post.content } as any}
            breakpoint="desktop"
            selectedElement={selectedElement}
            onSelectElement={setSelectedElement}
            onAddSection={addSection}
            onUpdateSection={updateSection}
            onDeleteSection={deleteSection}
            onAddWidget={() => {}}
            onUpdateWidget={() => {}}
            onDeleteWidget={() => {}}
          />
        </div>
      </div>
    </div>
  );
}

