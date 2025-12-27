/**
 * Blog Categories Management
 * Create and manage blog categories
 * CRITICAL: Multi-tenant - scoped to organizationId
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AdminBar from '@/components/AdminBar';

export default function CategoriesManagementPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;

  const [categories, setCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCategories();
  }, [orgId]);

  async function loadCategories() {
    try {
      setLoading(true);
      const response = await fetch(`/api/website/blog/categories?organizationId=${orgId}`);
      
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('[Categories] Load error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function saveCategories() {
    try {
      setSaving(true);

      const response = await fetch('/api/website/blog/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: orgId,
          categories,
        }),
      });

      if (!response.ok) throw new Error('Failed to save categories');

      alert('Categories saved successfully!');
    } catch (error) {
      console.error('[Categories] Save error:', error);
      alert('Failed to save categories');
    } finally {
      setSaving(false);
    }
  }

  function addCategory() {
    if (!newCategory.trim()) {
      alert('Please enter a category name');
      return;
    }

    if (categories.includes(newCategory.trim())) {
      alert('Category already exists');
      return;
    }

    setCategories([...categories, newCategory.trim()]);
    setNewCategory('');
  }

  function removeCategory(category: string) {
    if (!confirm(`Delete category "${category}"?`)) return;
    setCategories(categories.filter(c => c !== category));
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
        <AdminBar />
        <div>Loading categories...</div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui', minHeight: '100vh', background: '#f5f5f5' }}>
      <AdminBar />

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
        }}>
          <div>
            <h1 style={{ fontSize: '2rem', margin: '0 0 0.5rem', color: '#111' }}>
              Blog Categories
            </h1>
            <p style={{ margin: 0, color: '#666' }}>
              Organize your blog posts with categories
            </p>
          </div>

          <button
            onClick={() => router.push(`/workspace/${orgId}/website/blog`)}
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
            ← Back to Posts
          </button>
        </div>

        {/* Add Category */}
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '2rem',
          marginBottom: '2rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <h2 style={{ fontSize: '1.25rem', margin: '0 0 1rem', color: '#212529' }}>
            Add New Category
          </h2>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addCategory()}
              placeholder="Category name"
              style={{
                flex: 1,
                padding: '0.75rem',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '1rem',
              }}
            />
            <button
              onClick={addCategory}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '500',
              }}
            >
              Add Category
            </button>
          </div>
        </div>

        {/* Categories List */}
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '2rem',
          marginBottom: '2rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <h2 style={{ fontSize: '1.25rem', margin: '0 0 1.5rem', color: '#212529' }}>
            Categories ({categories.length})
          </h2>

          {categories.length === 0 ? (
            <div style={{
              padding: '2rem',
              textAlign: 'center',
              color: '#6c757d',
              background: '#f8f9fa',
              borderRadius: '4px',
            }}>
              <p style={{ margin: 0 }}>No categories yet. Add your first category above!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {categories.map((category) => (
                <div
                  key={category}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1rem',
                    background: '#f8f9fa',
                    borderRadius: '4px',
                  }}
                >
                  <div style={{
                    fontSize: '1rem',
                    fontWeight: '500',
                    color: '#212529',
                  }}>
                    {category}
                  </div>
                  <button
                    onClick={() => removeCategory(category)}
                    style={{
                      padding: '0.5rem 0.75rem',
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
              ))}
            </div>
          )}
        </div>

        {/* Save Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={saveCategories}
            disabled={saving}
            style={{
              padding: '0.75rem 2rem',
              background: saving ? '#95a5a6' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: '600',
            }}
          >
            {saving ? 'Saving...' : 'Save Categories'}
          </button>
        </div>
      </div>
    </div>
  );
}

