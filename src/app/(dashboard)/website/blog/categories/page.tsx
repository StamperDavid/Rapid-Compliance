/**
 * Blog Categories Management
 * Create and manage blog categories
 * CRITICAL: Multi-tenant - scoped to organizationId
 */

'use client';

import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/useToast';

export default function CategoriesManagementPage() {
  const router = useRouter();
  const toast = useToast();
  const orgId = DEFAULT_ORG_ID;

  const [categories, setCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/website/blog/categories?organizationId=${orgId}`);

      if (response.ok) {
        const data = await response.json() as { categories?: string[] };
        setCategories(data.categories ?? []);
      }
    } catch (error) {
      console.error('[Categories] Load error:', error);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

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

      if (!response.ok) {throw new Error('Failed to save categories');}

      toast.success('Categories saved successfully!');
    } catch (error) {
      console.error('[Categories] Save error:', error);
      toast.error('Failed to save categories');
    } finally {
      setSaving(false);
    }
  }

  function addCategory() {
    if (!newCategory.trim()) {
      toast.warning('Please enter a category name');
      return;
    }

    if (categories.includes(newCategory.trim())) {
      toast.warning('Category already exists');
      return;
    }

    setCategories([...categories, newCategory.trim()]);
    setNewCategory('');
  }

  function handleDeleteClick(category: string) {
    setDeleteConfirm(category);
  }

  function confirmDelete() {
    if (deleteConfirm) {
      setCategories(categories.filter(c => c !== deleteConfirm));
      setDeleteConfirm(null);
    }
  }

  function cancelDelete() {
    setDeleteConfirm(null);
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
        <div>Loading categories...</div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui', minHeight: '100vh', background: '#f5f5f5' }}>

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
            onClick={() => router.push(`/website/blog`)}
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
                    onClick={() => handleDeleteClick(category)}
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
            onClick={() => void saveCategories()}
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
            background: 'white',
            borderRadius: '8px',
            padding: '2rem',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.25rem', color: '#212529' }}>
              Delete Category
            </h3>
            <p style={{ margin: '0 0 1.5rem', color: '#6c757d' }}>
              Are you sure you want to delete the category &quot;{deleteConfirm}&quot;?
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={cancelDelete}
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
                onClick={confirmDelete}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#dc3545',
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


