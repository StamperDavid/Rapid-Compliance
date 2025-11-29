'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useAuth, usePermission } from '@/hooks/useAuth';

export default function AdminBar() {
  const { user, loading } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [theme, setTheme] = useState<any>(null);
  
  const canAccessSettings = usePermission('canAccessSettings');
  
  useEffect(() => {
    const savedTheme = localStorage.getItem('appTheme');
    if (savedTheme) {
      try {
        setTheme(JSON.parse(savedTheme));
      } catch (error) {
        console.error('Failed to load theme:', error);
      }
    }
  }, []);
  
  // Don't show admin bar for employees
  if (!user || user.role === 'employee') {
    return null;
  }

  const brandName = theme?.branding?.companyName || 'CRM Platform';
  const logoUrl = theme?.branding?.logoUrl;
  const primaryColor = theme?.colors?.primary?.main || '#6366f1';

  // Settings button should show for admin, owner, or manager roles
  const shouldShowSettings = user.role === 'admin' || user.role === 'owner' || user.role === 'manager' || canAccessSettings;

  return (
    <div style={{ backgroundColor: '#1a1a1a', borderBottom: '1px solid #333', position: 'sticky', top: 0, zIndex: 100 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1.5rem' }}>
        {/* Left: Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Link href="/crm" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
            {logoUrl ? (
              <img src={logoUrl} alt={brandName} style={{ height: '32px', maxWidth: '150px', objectFit: 'contain' }} />
            ) : (
              <>
                <span style={{ fontSize: '1.25rem' }}>🚀</span>
                <span style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fff' }}>
                  {brandName}
                </span>
              </>
            )}
          </Link>
        </div>

        {/* Center: Admin Tools */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, justifyContent: 'center' }}>
          {shouldShowSettings && (
            <Link 
              href="/workspace/demo-org/settings"
              style={{ padding: '0.5rem 1rem', color: '#999', fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none', borderRadius: '0.375rem', transition: 'all 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#222'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              ⚙️ Settings
            </Link>
          )}
        </div>

        {/* Right: User Menu */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', backgroundColor: '#222', border: '1px solid #333', borderRadius: '0.5rem', color: '#fff', cursor: 'pointer', fontSize: '0.875rem' }}
          >
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: primaryColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 'bold' }}>
              {user?.displayName?.charAt(0) || 'A'}
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: '600' }}>{user?.displayName}</div>
              <div style={{ fontSize: '0.75rem', color: '#999', textTransform: 'capitalize' }}>{user?.role}</div>
            </div>
            <span style={{ color: '#666' }}>▼</span>
          </button>

          {showUserMenu && (
            <>
              <div 
                style={{ position: 'fixed', inset: 0, zIndex: 10 }}
                onClick={() => setShowUserMenu(false)}
              />
              <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '0.5rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem', minWidth: '200px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', zIndex: 20 }}>
                <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #222' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff' }}>{user?.email}</div>
                  <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>Organization: Demo</div>
                </div>

                <div style={{ padding: '0.5rem' }}>
                  <Link
                    href="/profile"
                    style={{ display: 'block', padding: '0.75rem 1rem', color: '#999', fontSize: '0.875rem', textDecoration: 'none', borderRadius: '0.375rem', transition: 'all 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#222'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    👤 Profile
                  </Link>

                  <button
                    onClick={async () => {
                      // Sign out from Firebase Auth
                      try {
                        const { signOut } = await import('@/lib/auth/auth-service');
                        await signOut();
                      } catch (error) {
                        console.error('Error signing out:', error);
                      }
                      window.location.href = '/';
                    }}
                    style={{ width: '100%', display: 'block', padding: '0.75rem 1rem', color: '#dc2626', fontSize: '0.875rem', backgroundColor: 'transparent', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#222'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    🚪 Logout
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
