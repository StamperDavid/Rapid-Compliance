/**
 * Navigation Management
 * Build and manage site navigation (header menu, footer)
 */

'use client';

import { PLATFORM_ID } from '@/lib/constants/platform';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import type { Navigation, NavItem, Page } from '@/types/website';

interface NavigationResponse {
  navigation: Navigation;
}

interface PagesResponse {
  pages: Page[];
}

interface SettingsResponse {
  settings?: {
    homepage?: string;
  };
}

export default function NavigationManagementPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [navigation, setNavigation] = useState<Navigation | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [homepage, setHomepage] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Load navigation
      const navResponse = await fetch('/api/website/navigation');
      if (navResponse.ok) {
        const navData = await navResponse.json() as NavigationResponse;
        setNavigation(navData.navigation);
      } else {
        // Initialize default navigation
        setNavigation({
          id: 'nav',
          header: [],
          footer: {
            columns: [],
            copyright: `© ${new Date().getFullYear()} Your Company. All rights reserved.`,
            socialLinks: [],
            showLogo: true,
          },
          updatedAt: new Date().toISOString(),
          updatedBy: user?.id ?? 'anonymous',
        });
      }

      // Load pages
      const pagesResponse = await fetch('/api/website/pages');
      if (pagesResponse.ok) {
        const pagesData = await pagesResponse.json() as PagesResponse;
        setPages(pagesData.pages ?? []);
      }

      // Load site settings to get homepage
      const settingsResponse = await fetch('/api/website/settings');
      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json() as SettingsResponse;
        setHomepage(settingsData.settings?.homepage ?? '');
      }
    } catch (error: unknown) {
      console.error('[Navigation] Load error:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function saveNavigation(): Promise<void> {
    if (!navigation) {
      return;
    }

    try {
      setSaving(true);

      const response = await fetch('/api/website/navigation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          navigation: {
            ...navigation,
            updatedAt: new Date().toISOString(),
            updatedBy: (user?.email !== '' && user?.email != null) ? user.email : ((user?.displayName !== '' && user?.displayName != null) ? user.displayName : 'anonymous'),
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save navigation');
      }

      toast.success('Navigation saved successfully!');
    } catch (error: unknown) {
      console.error('[Navigation] Save error:', error);
      toast.error('Failed to save navigation');
    } finally {
      setSaving(false);
    }
  }

  async function saveHomepage(): Promise<void> {
    try {
      const response = await fetch('/api/website/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            homepage,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save homepage');
      }

      toast.success('Homepage updated successfully!');
    } catch (error: unknown) {
      console.error('[Navigation] Save homepage error:', error);
      toast.error('Failed to save homepage');
    }
  }

  function addHeaderLink() {
    if (!navigation) {
      return;
    }

    toast.info('Use the Add Link button to add menu items. Enter label and URL when prompted.');

    // For now, add a placeholder link that users can customize
    const newLink: NavItem = {
      id: `link_${Date.now()}`,
      label: 'New Link',
      url: '/',
      type: 'page',
      newTab: false,
    };

    setNavigation({
      ...navigation,
      header: [...navigation.header, newLink],
    });
  }

  function removeHeaderLink(linkId: string) {
    if (!navigation) {
      return;
    }

    setNavigation({
      ...navigation,
      header: navigation.header.filter(link => link.id !== linkId),
    });
  }

  function moveHeaderLink(index: number, direction: 'up' | 'down') {
    if (!navigation) {
      return;
    }

    const newHeader = [...navigation.header];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newHeader.length) {
      return;
    }

    [newHeader[index], newHeader[targetIndex]] = [newHeader[targetIndex], newHeader[index]];

    setNavigation({
      ...navigation,
      header: newHeader,
    });
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
        <div>Loading navigation...</div>
      </div>
    );
  }

  if (!navigation) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
        <div>Failed to load navigation</div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui', minHeight: '100vh', background: '#f5f5f5' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', margin: '0 0 0.5rem', color: '#111' }}>
            Navigation Management
          </h1>
          <p style={{ margin: 0, color: '#666' }}>
            Manage your site navigation and homepage
          </p>
        </div>

        {/* Homepage Settings */}
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '2rem',
          marginBottom: '2rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <h2 style={{ fontSize: '1.5rem', margin: '0 0 1.5rem', color: '#212529' }}>
            Homepage
          </h2>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#495057',
            }}>
              Homepage (leave empty for default landing):
            </label>
            <select
              value={homepage}
              onChange={(e) => setHomepage(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '1rem',
              }}
            >
              <option value="">-- Default Landing Page --</option>
              {pages.map((page) => (
                <option key={page.id} value={page.id}>
                  {page.title} (/{page.slug})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => void saveHomepage()}
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
            Save Homepage Setting
          </button>
        </div>

        {/* Header Navigation */}
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '2rem',
          marginBottom: '2rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem',
          }}>
            <h2 style={{ fontSize: '1.5rem', margin: 0, color: '#212529' }}>
              Header Menu
            </h2>
            <button
              onClick={addHeaderLink}
              style={{
                padding: '0.5rem 1rem',
                background: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
              }}
            >
              + Add Link
            </button>
          </div>

          {navigation.header.length === 0 ? (
            <div style={{
              padding: '2rem',
              textAlign: 'center',
              color: '#6c757d',
              background: '#f8f9fa',
              borderRadius: '4px',
            }}>
              <p style={{ margin: 0 }}>No menu items yet. Add your first link!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {navigation.header.map((link, index) => (
                <div
                  key={link.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '1rem',
                    background: '#f8f9fa',
                    borderRadius: '4px',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', color: '#212529', marginBottom: '0.25rem' }}>
                      {link.label}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>
                      {link.url}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => moveHeaderLink(index, 'up')}
                      disabled={index === 0}
                      style={{
                        padding: '0.5rem',
                        background: index === 0 ? '#e9ecef' : '#6c757d',
                        color: index === 0 ? '#adb5bd' : 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: index === 0 ? 'not-allowed' : 'pointer',
                        fontSize: '0.875rem',
                      }}
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveHeaderLink(index, 'down')}
                      disabled={index === navigation.header.length - 1}
                      style={{
                        padding: '0.5rem',
                        background: index === navigation.header.length - 1 ? '#e9ecef' : '#6c757d',
                        color: index === navigation.header.length - 1 ? '#adb5bd' : 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: index === navigation.header.length - 1 ? 'not-allowed' : 'pointer',
                        fontSize: '0.875rem',
                      }}
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => removeHeaderLink(link.id)}
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
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Settings */}
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '2rem',
          marginBottom: '2rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <h2 style={{ fontSize: '1.5rem', margin: '0 0 1.5rem', color: '#212529' }}>
            Footer
          </h2>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#495057',
            }}>
              Copyright Text:
            </label>
            <input
              type="text"
              value={navigation.footer.copyright}
              onChange={(e) => setNavigation({
                ...navigation,
                footer: {
                  ...navigation.footer,
                  copyright: e.target.value,
                },
              })}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '1rem',
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
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
                checked={navigation.footer.showLogo}
                onChange={(e) => setNavigation({
                  ...navigation,
                  footer: {
                    ...navigation.footer,
                    showLogo: e.target.checked,
                  },
                })}
                style={{ width: '16px', height: '16px' }}
              />
              Show Logo in Footer
            </label>
          </div>
        </div>

        {/* Save Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => void saveNavigation()}
            disabled={saving}
            style={{
              padding: '0.75rem 2rem',
              background: saving ? '#95a5a6' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: '600',
            }}
          >
            {saving ? 'Saving...' : 'Save Navigation'}
          </button>
        </div>
      </div>
    </div>
  );
}

