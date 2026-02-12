/**
 * Blog Post Editor
 * Create and edit blog posts using the visual editor
 */

'use client';


import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import EditorCanvas from '@/components/website-builder/EditorCanvas';
import WidgetsPanel from '@/components/website-builder/WidgetsPanel';
import PropertiesPanel from '@/components/website-builder/PropertiesPanel';
import type { BlogPost, Page, PageSection, Widget } from '@/types/website';

interface SelectedElement {
  type: 'section' | 'widget';
  sectionId: string;
  widgetId?: string;
}

export default function BlogPostEditorPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const postId = searchParams.get('postId');

  const [post, setPost] = useState<BlogPost | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [leftPanelTab, setLeftPanelTab] = useState<'widgets' | 'settings'>('widgets');

  const loadCategories = useCallback(async () => {
    try {
      const response = await fetch('/api/website/blog/categories');
      if (response.ok) {
        const data = await response.json() as { categories?: string[] };
        setCategories(data.categories ?? []);
      }
    } catch (error) {
      console.error('[Blog Editor] Load categories error:', error);
    }
  }, []);

  const loadPost = useCallback(async (id: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/website/blog/posts/${id}`);

      if (!response.ok) {throw new Error('Failed to load post');}

      const data = await response.json() as { post: BlogPost };
      setPost(data.post);
      setTags(data.post.tags ?? []);
    } catch (error) {
      console.error('[Blog Editor] Load error:', error);
      toast.error('Failed to load post');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const createBlankPost = useCallback(() => {
    const newPost: BlogPost = {
      id: `post_${Date.now()}`,
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
      lastEditedBy: user?.id ?? 'anonymous',
      author: user?.id ?? 'anonymous',
      authorName: user?.displayName ?? user?.email ?? 'Anonymous',
    };

    setPost(newPost);
    setLoading(false);
  }, [user?.email, user?.displayName, user?.id]);

  useEffect(() => {
    void loadCategories();
    if (postId) {
      void loadPost(postId);
    } else {
      createBlankPost();
    }
  }, [postId, loadCategories, loadPost, createBlankPost]);

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
          post: {
            ...post,
            tags,
            updatedAt: new Date().toISOString(),
            lastEditedBy: (user?.email !== '' && user?.email != null) ? user.email : ((user?.displayName !== '' && user?.displayName != null) ? user.displayName : 'anonymous'),
          },
        }),
      });

      if (!response.ok) {throw new Error('Failed to save post');}

      await response.json();
      toast.success('Post saved successfully!');

      // Redirect to posts list
      router.push(`/website/blog`);
    } catch (error) {
      console.error('[Blog Editor] Save error:', error);
      toast.error('Failed to save post');
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

  function addWidget(sectionId: string, widget: Widget, columnIndex: number = 0): void {
    if (!post) {return;}

    const updatedContent = post.content.map(section => {
      if (section.id === sectionId) {
        const updatedColumns = [...section.columns];
        const targetColumn = updatedColumns[columnIndex];
        if (targetColumn) {
          updatedColumns[columnIndex] = {
            ...targetColumn,
            widgets: [...targetColumn.widgets, widget],
          };
        }
        return { ...section, columns: updatedColumns };
      }
      return section;
    });

    updatePost({ content: updatedContent });
  }

  function updateWidget(sectionId: string, widgetId: string, updates: Partial<Widget>): void {
    if (!post) {return;}

    const updatedContent = post.content.map(section => {
      if (section.id === sectionId) {
        const updatedColumns = section.columns.map(col => ({
          ...col,
          widgets: col.widgets.map(widget =>
            widget.id === widgetId ? { ...widget, ...updates } : widget
          ),
        }));
        return { ...section, columns: updatedColumns };
      }
      return section;
    });

    updatePost({ content: updatedContent });
  }

  function deleteWidget(sectionId: string, widgetId: string): void {
    if (!post) {return;}

    const updatedContent = post.content.map(section => {
      if (section.id === sectionId) {
        const updatedColumns = section.columns.map(col => ({
          ...col,
          widgets: col.widgets.filter(w => w.id !== widgetId),
        }));
        return { ...section, columns: updatedColumns };
      }
      return section;
    });

    updatePost({ content: updatedContent });

    if (selectedElement?.widgetId === widgetId) {
      setSelectedElement(null);
    }
  }

  // Create a Page-compatible proxy for the shared editor components
  function getPageProxy(): Page {
    if (!post) {
      return { id: '', title: '', slug: '', content: [], seo: { metaTitle: '', metaDescription: '' }, createdAt: '', updatedAt: '', createdBy: '', lastEditedBy: '' };
    }
    return {
      id: post.id,
      title: post.title,
      slug: post.slug,
      content: post.content,
      seo: post.seo,
      customCSS: '',
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      createdBy: post.createdBy,
      lastEditedBy: post.lastEditedBy,
      isPublished: post.status === 'published',
    };
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
        background: 'var(--color-bg-paper)',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.5rem',
        borderBottom: '1px solid var(--color-border-strong)',
      }}>
        <div>
          <div style={{ fontSize: '0.875rem', fontWeight: '600' }}>
            Blog Post: {post.title}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>
            /{post.slug}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={() => router.push(`/website/blog`)}
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
            onClick={() => void savePost()}
            disabled={saving}
            style={{
              padding: '0.5rem 1.5rem',
              background: saving ? 'var(--color-text-disabled)' : 'var(--color-success)',
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

      {/* Three-Panel Layout */}
      <div style={{
        display: 'flex',
        flex: 1,
        overflow: 'hidden',
      }}>
        {/* Left Panel: Tabbed (Widgets / Post Settings) */}
        <div style={{
          width: '300px',
          background: 'var(--color-bg-elevated)',
          borderRight: '1px solid var(--color-border-light)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Tab Buttons */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--color-border-light)',
          }}>
            <button
              onClick={() => setLeftPanelTab('widgets')}
              style={{
                flex: 1,
                padding: '0.75rem',
                border: 'none',
                background: leftPanelTab === 'widgets' ? 'var(--color-bg-paper)' : 'transparent',
                borderBottom: leftPanelTab === 'widgets' ? '2px solid var(--color-info)' : '2px solid transparent',
                cursor: 'pointer',
                fontSize: '0.8125rem',
                fontWeight: '600',
                color: leftPanelTab === 'widgets' ? 'var(--color-text-primary)' : 'var(--color-text-disabled)',
              }}
            >
              Widgets
            </button>
            <button
              onClick={() => setLeftPanelTab('settings')}
              style={{
                flex: 1,
                padding: '0.75rem',
                border: 'none',
                background: leftPanelTab === 'settings' ? 'var(--color-bg-paper)' : 'transparent',
                borderBottom: leftPanelTab === 'settings' ? '2px solid var(--color-info)' : '2px solid transparent',
                cursor: 'pointer',
                fontSize: '0.8125rem',
                fontWeight: '600',
                color: leftPanelTab === 'settings' ? 'var(--color-text-primary)' : 'var(--color-text-disabled)',
              }}
            >
              Post Settings
            </button>
          </div>

          {/* Tab Content */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {leftPanelTab === 'widgets' ? (
              <WidgetsPanel
                onAddWidget={(widget) => {
                  if (post.content.length === 0) {
                    addSection({
                      columns: [{
                        id: `col_${Date.now()}`,
                        width: 100,
                        widgets: [widget],
                      }],
                    });
                  } else {
                    addWidget(post.content[0].id, widget, 0);
                  }
                }}
              />
            ) : (
              <div style={{ overflowY: 'auto', padding: '1.5rem', height: '100%' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: 'var(--color-text-disabled)',
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
                        border: '1px solid var(--color-border-light)',
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
                      color: 'var(--color-text-disabled)',
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
                        border: '1px solid var(--color-border-light)',
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
                      color: 'var(--color-text-disabled)',
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
                        border: '1px solid var(--color-border-light)',
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
                      color: 'var(--color-text-disabled)',
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
                        border: '1px solid var(--color-border-light)',
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
                      color: 'var(--color-text-disabled)',
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
                        border: '1px solid var(--color-border-light)',
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
                    <small style={{ display: 'block', marginTop: '0.25rem', color: 'var(--color-text-secondary)' }}>
                      Hold Ctrl/Cmd to select multiple
                    </small>
                  </div>

                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: 'var(--color-text-disabled)',
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
                        border: '1px solid var(--color-border-light)',
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
                      color: 'var(--color-text-disabled)',
                    }}>
                      Status:
                    </label>
                    <select
                      value={post.status}
                      onChange={(e) => updatePost({ status: e.target.value as 'draft' | 'published' | 'scheduled' })}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid var(--color-border-light)',
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
                      color: 'var(--color-text-disabled)',
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
            )}
          </div>
        </div>

        {/* Center Panel: Content Editor */}
        <EditorCanvas
          page={getPageProxy()}
          breakpoint="desktop"
          selectedElement={selectedElement}
          onSelectElement={setSelectedElement}
          onAddSection={addSection}
          onUpdateSection={updateSection}
          onDeleteSection={deleteSection}
          onAddWidget={addWidget}
          onUpdateWidget={updateWidget}
          onDeleteWidget={deleteWidget}
        />

        {/* Right Panel: Properties */}
        <PropertiesPanel
          selectedElement={selectedElement}
          page={getPageProxy()}
          breakpoint="desktop"
          onUpdatePage={(updates) => updatePost(updates as Partial<BlogPost>)}
          onUpdateSection={updateSection}
          onUpdateWidget={updateWidget}
        />
      </div>
    </div>
  );
}

