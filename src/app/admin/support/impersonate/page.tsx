'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { logger } from '@/lib/logger/logger';

export default function ImpersonatePage() {
  const { adminUser, hasPermission } = useAdminAuth();
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  if (!hasPermission('canImpersonateUsers')) {
    return (
      <div style={{ padding: '2rem', color: '#fff' }}>
        <div style={{ padding: '1.5rem', backgroundColor: '#7f1d1d', border: '1px solid #991b1b', borderRadius: '0.5rem', color: '#fff' }}>
          <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Access Denied</div>
          <div style={{ fontSize: '0.875rem' }}>You don't have permission to impersonate users.</div>
        </div>
      </div>
    );
  }

  const handleImpersonate = async () => {
    if (!userId && !userEmail) {
      alert('Please enter either User ID or Email');
      return;
    }

    setLoading(true);
    // In production, this would call an API to start impersonation session
    // For now, we'll just set a flag and redirect
    try {
      // Store impersonation session in Firestore for audit trail
      const session = {
        adminId: adminUser?.id,
        adminEmail: adminUser?.email,
        targetUserId: userId || 'lookup-by-email',
        targetUserEmail: userEmail,
        reason: reason || 'Support access',
        startedAt: new Date().toISOString(),
        status: 'active',
      };
      
      try {
        const { FirestoreService } = await import('@/lib/db/firestore-service');
        const sessionId = `impersonation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await FirestoreService.set(
          'admin/impersonationSessions',
          sessionId,
          session,
          false
        );
      } catch (error) {
        logger.error('Failed to save impersonation session:', error, { file: 'page.tsx' });
        // Continue even if save fails
      }
      
      // Redirect to user's organization
      // In production, this would fetch the user's org and redirect properly
      router.push(`/workspace/demo-org/dashboard`);
    } catch (error) {
      logger.error('Impersonation failed:', error, { file: 'page.tsx' });
      alert('Failed to start impersonation session');
    } finally {
      setLoading(false);
    }
  };

  const bgPaper = '#1a1a1a';
  const borderColor = '#333';
  const primaryColor = '#6366f1';

  return (
    <div style={{ padding: '2rem', color: '#fff' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          Impersonate User
        </h1>
        <p style={{ color: '#666', fontSize: '0.875rem' }}>
          Access a user's account for support purposes. All actions will be logged.
        </p>
      </div>

      {/* Warning */}
      <div style={{
        padding: '1rem',
        backgroundColor: '#78350f',
        border: '1px solid #92400e',
        borderRadius: '0.5rem',
        marginBottom: '2rem',
        display: 'flex',
        alignItems: 'start',
        gap: '1rem'
      }}>
        <span style={{ fontSize: '1.5rem' }}>⚠️</span>
        <div>
          <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>Important</div>
          <div style={{ fontSize: '0.875rem' }}>
            Impersonation sessions are logged and audited. Only use this feature for legitimate support purposes.
            You will have full access to the user's account and data.
          </div>
        </div>
      </div>

      {/* Form */}
      <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem', maxWidth: '600px' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
            User ID
          </label>
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="Enter user ID"
            style={{
              width: '100%',
              padding: '0.625rem 1rem',
              backgroundColor: '#0a0a0a',
              border: `1px solid ${borderColor}`,
              borderRadius: '0.5rem',
              color: '#fff',
              fontSize: '0.875rem'
            }}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
            OR User Email
          </label>
          <input
            type="email"
            value={userEmail}
            onChange={(e) => setUserEmail(e.target.value)}
            placeholder="Enter user email"
            style={{
              width: '100%',
              padding: '0.625rem 1rem',
              backgroundColor: '#0a0a0a',
              border: `1px solid ${borderColor}`,
              borderRadius: '0.5rem',
              color: '#fff',
              fontSize: '0.875rem'
            }}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
            Reason (Optional)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are you impersonating this user?"
            rows={4}
            style={{
              width: '100%',
              padding: '0.625rem 1rem',
              backgroundColor: '#0a0a0a',
              border: `1px solid ${borderColor}`,
              borderRadius: '0.5rem',
              color: '#fff',
              fontSize: '0.875rem',
              resize: 'vertical'
            }}
          />
        </div>

        <button
          onClick={handleImpersonate}
          disabled={loading || (!userId && !userEmail)}
          style={{
            width: '100%',
            padding: '0.75rem 1.5rem',
            backgroundColor: loading || (!userId && !userEmail) ? '#4b5563' : primaryColor,
            color: '#fff',
            border: 'none',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: '600',
            cursor: loading || (!userId && !userEmail) ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Starting Session...' : 'Start Impersonation Session'}
        </button>
      </div>

      {/* Active Sessions */}
      <div style={{ marginTop: '2rem', backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>Active Impersonation Sessions</h2>
        <div style={{ fontSize: '0.875rem', color: '#666' }}>
          No active sessions. Start a session above to impersonate a user.
        </div>
      </div>
    </div>
  );
}

