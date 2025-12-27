'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import Link from 'next/link'
import { logger } from '@/lib/logger/logger';;

interface UserDetails {
  id: string;
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  status: string;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  organizationId: string;
  organizationName: string;
}

export default function UserDetailPage() {
  const params = useParams();
  const { hasPermission } = useAdminAuth();
  const [user, setUser] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const userId = params.id as string;

  useEffect(() => {
    async function loadUser() {
      try {
        setLoading(true);
        const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
        
        // Try to load user from Firestore
        const userData = await FirestoreService.get(COLLECTIONS.USERS, userId) as any;
        
        if (userData) {
          // Get organization info
          let orgName = 'Unknown';
          if (userData.organizationId) {
            const org = await FirestoreService.get(COLLECTIONS.ORGANIZATIONS, userData.organizationId) as any;
            orgName = org?.name || 'Unknown';
          }
          
          setUser({
            id: userId,
            email: userData.email || '',
            displayName: userData.profile?.displayName || userData.displayName || 'Unknown',
            firstName: userData.profile?.firstName || '',
            lastName: userData.profile?.lastName || '',
            status: userData.status || 'active',
            emailVerified: userData.emailVerified || false,
            createdAt: userData.createdAt?.toDate?.()?.toISOString() || userData.createdAt || '',
            lastLoginAt: userData.lastLoginAt?.toDate?.()?.toISOString() || userData.lastLoginAt || null,
            organizationId: userData.organizationId || '',
            organizationName: orgName,
          });
        }
        setLoading(false);
      } catch (error) {
        logger.error('Failed to load user:', error, { file: 'page.tsx' });
        setLoading(false);
      }
    }
    
    loadUser();
  }, [userId]);

  const bgPaper = '#1a1a1a';
  const borderColor = '#333';
  const primaryColor = '#6366f1';

  if (loading) {
    return (
      <div style={{ padding: '2rem', color: '#fff' }}>
        <div style={{ textAlign: 'center', padding: '4rem', color: '#666' }}>
          Loading user...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ padding: '2rem', color: '#fff' }}>
        <div style={{ textAlign: 'center', padding: '4rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            User Not Found
          </h2>
          <p style={{ color: '#666', marginBottom: '2rem' }}>
            The user you're looking for doesn't exist or couldn't be loaded.
          </p>
          <Link
            href="/admin/users"
            style={{
              display: 'inline-block',
              padding: '0.75rem 1.5rem',
              backgroundColor: primaryColor,
              color: '#fff',
              textDecoration: 'none',
              borderRadius: '0.5rem',
              fontWeight: '500'
            }}
          >
            Back to Users
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', color: '#fff' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <Link
          href="/admin/users"
          style={{
            color: '#666',
            textDecoration: 'none',
            fontSize: '0.875rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '1rem'
          }}
        >
          ← Back to Users
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              {user.displayName}
            </h1>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <span style={{ color: '#666', fontSize: '0.875rem' }}>{user.email}</span>
              <span style={{
                padding: '0.25rem 0.75rem',
                borderRadius: '0.25rem',
                fontSize: '0.75rem',
                fontWeight: '600',
                backgroundColor: user.status === 'active' ? '#065f46' : '#7f1d1d',
                color: user.status === 'active' ? '#10b981' : '#ef4444',
                textTransform: 'uppercase'
              }}>
                {user.status}
              </span>
              {user.emailVerified && (
                <span style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '0.25rem',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  backgroundColor: '#065f46',
                  color: '#10b981'
                }}>
                  ✓ Email Verified
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {hasPermission('canImpersonateUsers') && (
              <Link
                href={`/admin/support/impersonate?userId=${user.id}`}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: primaryColor,
                  color: '#fff',
                  textDecoration: 'none',
                  borderRadius: '0.5rem',
                  fontWeight: '500'
                }}
              >
                Impersonate User
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* User Details */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
        <div style={{
          backgroundColor: bgPaper,
          border: `1px solid ${borderColor}`,
          borderRadius: '0.75rem',
          padding: '1.5rem'
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: '#fff' }}>
            User Information
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <InfoRow label="User ID" value={user.id} />
            <InfoRow label="Email" value={user.email} />
            <InfoRow label="First Name" value={user.firstName || 'Not set'} />
            <InfoRow label="Last Name" value={user.lastName || 'Not set'} />
            <InfoRow label="Display Name" value={user.displayName} />
          </div>
        </div>

        <div style={{
          backgroundColor: bgPaper,
          border: `1px solid ${borderColor}`,
          borderRadius: '0.75rem',
          padding: '1.5rem'
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: '#fff' }}>
            Organization
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <InfoRow label="Organization" value={user.organizationName} />
            <InfoRow label="Organization ID" value={user.organizationId || 'None'} />
            {user.organizationId && (
              <Link
                href={`/admin/organizations/${user.organizationId}`}
                style={{
                  marginTop: '0.5rem',
                  color: primaryColor,
                  fontSize: '0.875rem',
                  textDecoration: 'none'
                }}
              >
                View Organization →
              </Link>
            )}
          </div>
        </div>

        <div style={{
          backgroundColor: bgPaper,
          border: `1px solid ${borderColor}`,
          borderRadius: '0.75rem',
          padding: '1.5rem'
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: '#fff' }}>
            Activity
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <InfoRow 
              label="Created" 
              value={user.createdAt ? new Date(user.createdAt).toLocaleString() : 'Unknown'} 
            />
            <InfoRow 
              label="Last Login" 
              value={user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'} 
            />
          </div>
        </div>

        <div style={{
          backgroundColor: bgPaper,
          border: `1px solid ${borderColor}`,
          borderRadius: '0.75rem',
          padding: '1.5rem'
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: '#fff' }}>
            Actions
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              onClick={() => alert('Password reset email would be sent')}
              style={{
                padding: '0.625rem 1rem',
                backgroundColor: 'transparent',
                border: `1px solid ${borderColor}`,
                borderRadius: '0.5rem',
                color: '#fff',
                fontSize: '0.875rem',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              Send Password Reset Email
            </button>
            <button
              onClick={() => alert('User status would be toggled')}
              style={{
                padding: '0.625rem 1rem',
                backgroundColor: user.status === 'active' ? '#7f1d1d' : '#065f46',
                border: 'none',
                borderRadius: '0.5rem',
                color: user.status === 'active' ? '#ef4444' : '#10b981',
                fontSize: '0.875rem',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              {user.status === 'active' ? 'Suspend User' : 'Activate User'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '0.875rem', color: '#666' }}>{label}</span>
      <span style={{ fontSize: '0.875rem', color: '#fff', fontWeight: '500' }}>{value}</span>
    </div>
  );
}










