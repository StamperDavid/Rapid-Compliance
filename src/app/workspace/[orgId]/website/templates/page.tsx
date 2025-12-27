/**
 * Template Browser
 * Browse and apply page templates
 * CRITICAL: Multi-tenant - templates can be org-specific or platform-wide
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import { useAuth } from '@/hooks/useAuth';
import AdminBar from '@/components/AdminBar';
import { PageTemplate } from '@/types/website';
import { allTemplates } from '@/lib/website-builder/page-templates';

export default function TemplateBrowserPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const orgId = params.orgId as string;

  const [templates, setTemplates] = useState<PageTemplate[]>([]);
  const [customTemplates, setCustomTemplates] = useState<PageTemplate[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<PageTemplate | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(true);

  const categories = [
    { id: 'all', label: 'All Templates' },
    { id: 'business', label: 'Business' },
    { id: 'saas', label: 'SaaS' },
    { id: 'ecommerce', label: 'E-commerce' },
    { id: 'portfolio', label: 'Portfolio' },
    { id: 'agency', label: 'Agency' },
    { id: 'blog', label: 'Blog' },
    { id: 'other', label: 'Other' },
  ];

  useEffect(() => {
    loadTemplates();
  }, [orgId]);

  async function loadTemplates() {
    try {
      setLoading(true);
      
      // Load platform templates
      setTemplates(allTemplates);

      // Load custom templates for this org
      const response = await fetch(`/api/website/templates?organizationId=${orgId}`);
      if (response.ok) {
        const data = await response.json();
        setCustomTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('[Templates] Load error:', error);
    } finally {
      setLoading(false);
    }
  }

  function getFilteredTemplates(): PageTemplate[] {
    const allAvailableTemplates = [...templates, ...customTemplates];
    
    if (selectedCategory === 'all') {
      return allAvailableTemplates;
    }
    
    return allAvailableTemplates.filter(t => t.category === selectedCategory);
  }

  async function applyTemplate(template: PageTemplate) {
    if (!confirm(`Create a new page from "${template.name}"?`)) return;

    try {
      // Create new page from template
      const response = await fetch('/api/website/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: orgId,
          page: {
            slug: `${template.id}-${Date.now()}`,
            title: template.name,
            content: template.content,
            seo: {
              metaTitle: template.name,
              metaDescription: template.description,
            },
            status: 'draft',
            version: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: user?.email || user?.displayName || 'anonymous',
            lastEditedBy: user?.email || user?.displayName || 'anonymous',
          },
        }),
      });

      if (!response.ok) throw new Error('Failed to create page from template');

      const data = await response.json();
      
      alert('Page created successfully!');
      
      // Redirect to editor
      router.push(`/workspace/${orgId}/website/editor?pageId=${data.page.id}`);
    } catch (error) {
      console.error('[Templates] Apply error:', error);
      alert('Failed to create page from template');
    }
  }

  function previewTemplate(template: PageTemplate) {
    setSelectedTemplate(template);
    setShowPreview(true);
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
        <AdminBar />
        <div>Loading templates...</div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui', minHeight: '100vh', background: '#f5f5f5' }}>
      <AdminBar />

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
              Page Templates
            </h1>
            <p style={{ margin: 0, color: '#666' }}>
              Choose a template to start building your page
            </p>
          </div>

          <button
            onClick={() => router.push(`/workspace/${orgId}/website/editor`)}
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
            Start from Scratch
          </button>
        </div>

        {/* Category Filters */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '2rem',
          flexWrap: 'wrap',
        }}>
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              style={{
                padding: '0.5rem 1rem',
                background: selectedCategory === category.id ? '#007bff' : 'white',
                color: selectedCategory === category.id ? 'white' : '#495057',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: selectedCategory === category.id ? '600' : '400',
              }}
            >
              {category.label}
            </button>
          ))}
        </div>

        {/* Templates Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '1.5rem',
        }}>
          {getFilteredTemplates().map((template) => (
            <div
              key={template.id}
              style={{
                background: 'white',
                borderRadius: '8px',
                overflow: 'hidden',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
              }}
            >
              {/* Thumbnail */}
              <div style={{
                height: '200px',
                background: `url(${template.thumbnail}) center/cover`,
                position: 'relative',
              }}>
                {template.isPremium && (
                  <div style={{
                    position: 'absolute',
                    top: '0.75rem',
                    right: '0.75rem',
                    padding: '0.25rem 0.5rem',
                    background: '#ffc107',
                    color: '#000',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                  }}>
                    PREMIUM
                  </div>
                )}
                {template.organizationId && (
                  <div style={{
                    position: 'absolute',
                    top: '0.75rem',
                    left: '0.75rem',
                    padding: '0.25rem 0.5rem',
                    background: '#17a2b8',
                    color: '#fff',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                  }}>
                    CUSTOM
                  </div>
                )}
              </div>

              {/* Content */}
              <div style={{ padding: '1.5rem' }}>
                <h3 style={{
                  fontSize: '1.125rem',
                  fontWeight: '600',
                  color: '#212529',
                  margin: '0 0 0.5rem',
                }}>
                  {template.name}
                </h3>
                <p style={{
                  fontSize: '0.875rem',
                  color: '#6c757d',
                  margin: '0 0 1rem',
                  lineHeight: '1.5',
                }}>
                  {template.description}
                </p>

                <div style={{
                  display: 'inline-block',
                  padding: '0.25rem 0.5rem',
                  background: '#e9ecef',
                  color: '#495057',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  textTransform: 'capitalize',
                  marginBottom: '1rem',
                }}>
                  {template.category}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => previewTemplate(template)}
                    style={{
                      flex: 1,
                      padding: '0.5rem 1rem',
                      background: '#ffffff',
                      color: '#007bff',
                      border: '1px solid #007bff',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                    }}
                  >
                    Preview
                  </button>
                  <button
                    onClick={() => applyTemplate(template)}
                    style={{
                      flex: 1,
                      padding: '0.5rem 1rem',
                      background: '#007bff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                    }}
                  >
                    Use Template
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {getFilteredTemplates().length === 0 && (
          <div style={{
            background: 'white',
            borderRadius: '8px',
            padding: '4rem 2rem',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📄</div>
            <h3 style={{ fontSize: '1.25rem', margin: '0 0 0.5rem', color: '#495057' }}>
              No templates found
            </h3>
            <p style={{ margin: 0, color: '#6c757d' }}>
              Try selecting a different category
            </p>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {showPreview && selectedTemplate && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
        }}>
          <div style={{
            background: 'white',
            borderRadius: '8px',
            maxWidth: '1200px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.5rem',
              borderBottom: '1px solid #dee2e6',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', margin: '0 0 0.25rem', color: '#212529' }}>
                  {selectedTemplate.name}
                </h2>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#6c757d' }}>
                  {selectedTemplate.description}
                </p>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'transparent',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#6c757d',
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body - Preview */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '2rem',
              background: '#f8f9fa',
            }}>
              <div style={{
                background: 'white',
                borderRadius: '4px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}>
                <img 
                  src={selectedTemplate.thumbnail} 
                  alt={selectedTemplate.name}
                  style={{
                    width: '100%',
                    height: 'auto',
                    display: 'block',
                    borderRadius: '4px',
                  }}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '1.5rem',
              borderTop: '1px solid #dee2e6',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.5rem',
            }}>
              <button
                onClick={() => setShowPreview(false)}
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
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowPreview(false);
                  applyTemplate(selectedTemplate);
                }}
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
                Use This Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

