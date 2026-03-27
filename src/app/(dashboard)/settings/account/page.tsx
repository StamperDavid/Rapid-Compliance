'use client';

/**
 * Account Settings Page
 *
 * Full user profile management:
 * - View profile (avatar, name, email, role)
 * - Edit display name
 * - Sign out
 * - Change password
 * - Transfer ownership (owner only)
 * - Delete account (non-owner only)
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useToast } from '@/hooks/useToast';
import { signOutUser } from '@/lib/auth/auth-service';

// ============================================================================
// TYPES
// ============================================================================

interface PasswordChangeForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface DeleteAccountForm {
  password: string;
  confirmation: string;
}

const DEFAULT_PASSWORD_FORM: PasswordChangeForm = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

const DEFAULT_DELETE_FORM: DeleteAccountForm = {
  password: '',
  confirmation: '',
};

// ============================================================================
// PASSWORD STRENGTH
// ============================================================================

function getPasswordStrength(password: string): { label: string; color: string; width: string } {
  if (password.length === 0) {
    return { label: '', color: 'transparent', width: '0%' };
  }

  let score = 0;
  if (password.length >= 8) { score++; }
  if (password.length >= 12) { score++; }
  if (/[A-Z]/.test(password)) { score++; }
  if (/[a-z]/.test(password)) { score++; }
  if (/[0-9]/.test(password)) { score++; }
  if (/[^A-Za-z0-9]/.test(password)) { score++; }

  if (score <= 2) { return { label: 'Weak', color: 'var(--color-error)', width: '25%' }; }
  if (score <= 4) { return { label: 'Fair', color: '#f59e0b', width: '60%' }; }
  return { label: 'Strong', color: 'var(--color-success)', width: '100%' };
}

// ============================================================================
// ROLE COLORS
// ============================================================================

function getRoleBadgeStyle(role: string): React.CSSProperties {
  switch (role) {
    case 'owner':
      return { backgroundColor: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', border: '1px solid rgba(168, 85, 247, 0.3)' };
    case 'admin':
      return { backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)' };
    case 'manager':
      return { backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.3)' };
    default:
      return { backgroundColor: 'rgba(156, 163, 175, 0.15)', color: '#9ca3af', border: '1px solid rgba(156, 163, 175, 0.3)' };
  }
}

// ============================================================================
// PAGE
// ============================================================================

export default function AccountSettingsPage() {
  const { user } = useAuth();
  const authFetch = useAuthFetch();
  const toast = useToast();
  const router = useRouter();

  // Profile edit state
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Password change state
  const [passwordForm, setPasswordForm] = useState<PasswordChangeForm>(DEFAULT_PASSWORD_FORM);
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [showPasswordSection, setShowPasswordSection] = useState(false);

  // Account deletion state
  const [deleteForm, setDeleteForm] = useState<DeleteAccountForm>(DEFAULT_DELETE_FORM);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showDeleteSection, setShowDeleteSection] = useState(false);

  // Sign out state
  const [signingOut, setSigningOut] = useState(false);

  // ── Derived values ──────────────────────────────────────────────────────
  const displayName = user?.displayName ?? user?.email?.split('@')[0] ?? 'User';
  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const isOwner = user?.role === 'owner';
  const passwordStrength = getPasswordStrength(passwordForm.newPassword);
  const passwordFormIsValid =
    passwordForm.currentPassword.length > 0 &&
    passwordForm.newPassword.length >= 8 &&
    passwordForm.confirmPassword.length > 0;

  // ── Sign out ────────────────────────────────────────────────────────────
  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOutUser();
      router.push('/login');
    } catch {
      toast.error('Failed to sign out');
      setSigningOut(false);
    }
  };

  // ── Update display name ─────────────────────────────────────────────────
  const handleSaveName = async () => {
    if (!newName.trim() || !user) { return; }
    setSavingName(true);
    try {
      const res = await authFetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, name: newName.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Failed' })) as { error?: string };
        throw new Error(body.error ?? 'Failed to update name');
      }
      toast.success('Name updated');
      setEditingName(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update name');
    } finally {
      setSavingName(false);
    }
  };

  // ── Password change ─────────────────────────────────────────────────────
  const handlePasswordChange = async () => {
    if (!user) { return; }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    setChangingPassword(true);
    try {
      const response = await authFetch('/api/user/password-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      const data = await response.json() as { success: boolean; error?: string };
      if (!response.ok || !data.success) {
        toast.error(data.error ?? 'Failed to change password');
        return;
      }
      toast.success('Password changed successfully');
      setPasswordForm(DEFAULT_PASSWORD_FORM);
      setShowPasswordSection(false);
    } catch {
      toast.error('Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  // ── Account deletion ────────────────────────────────────────────────────
  const handleDeleteAccount = async () => {
    if (!user) { return; }
    if (deleteForm.confirmation !== 'DELETE MY ACCOUNT') {
      toast.error('You must type DELETE MY ACCOUNT exactly to confirm');
      return;
    }
    setDeletingAccount(true);
    try {
      const response = await authFetch('/api/user/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deleteForm.password, confirmation: deleteForm.confirmation }),
      });
      const data = await response.json() as { success: boolean; error?: string };
      if (!response.ok || !data.success) {
        toast.error(data.error ?? 'Failed to delete account');
        return;
      }
      toast.success('Account deleted. Signing out...');
      await signOutUser();
      window.location.href = '/';
    } catch {
      toast.error('Failed to delete account');
    } finally {
      setDeletingAccount(false);
    }
  };

  // ── Styles ──────────────────────────────────────────────────────────────
  const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-bg-card)',
    border: '1px solid var(--color-bg-elevated)',
    borderRadius: '0.75rem',
    padding: '1.5rem',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.625rem 0.75rem',
    backgroundColor: 'var(--color-bg-main)',
    border: '1px solid var(--color-bg-elevated)',
    borderRadius: '0.375rem',
    color: 'var(--color-text-primary)',
    fontSize: '0.875rem',
    boxSizing: 'border-box' as const,
  };

  const btnPrimary: React.CSSProperties = {
    padding: '0.625rem 1.25rem',
    backgroundColor: 'var(--color-primary)',
    color: '#fff',
    border: 'none',
    borderRadius: '0.375rem',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: 600,
  };

  const btnOutline: React.CSSProperties = {
    padding: '0.625rem 1.25rem',
    backgroundColor: 'transparent',
    color: 'var(--color-text-secondary)',
    border: '1px solid var(--color-bg-elevated)',
    borderRadius: '0.375rem',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: 500,
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg-main)', color: 'var(--color-text-primary)' }}>
      {/* Header */}
      <div style={{
        padding: '1.5rem 2rem',
        borderBottom: '1px solid var(--color-bg-elevated)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/settings" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '0.875rem' }}>
            Settings
          </Link>
          <span style={{ color: 'var(--color-text-muted)' }}>/</span>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>My Account</h1>
        </div>
      </div>

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '2rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* ── Profile Card ──────────────────────────────────────────── */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.5rem' }}>
              {/* Avatar */}
              <div style={{
                width: 72,
                height: 72,
                borderRadius: '1rem',
                background: 'var(--gradient-brand)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                color: '#fff',
                fontSize: '1.5rem',
                flexShrink: 0,
              }}>
                {initials}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {editingName ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Enter your name"
                      autoFocus
                      style={{ ...inputStyle, width: 'auto', flex: 1 }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { void handleSaveName(); } if (e.key === 'Escape') { setEditingName(false); } }}
                    />
                    <button onClick={() => void handleSaveName()} disabled={savingName || !newName.trim()} style={{ ...btnPrimary, padding: '0.5rem 1rem', opacity: savingName || !newName.trim() ? 0.5 : 1 }}>
                      {savingName ? 'Saving...' : 'Save'}
                    </button>
                    <button onClick={() => setEditingName(false)} style={{ ...btnOutline, padding: '0.5rem 1rem' }}>Cancel</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>{displayName}</h2>
                    <button
                      onClick={() => { setNewName(displayName); setEditingName(true); }}
                      style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 500 }}
                    >
                      Edit
                    </button>
                  </div>
                )}
                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                  {user?.email ?? ''}
                </div>
                <span style={{
                  display: 'inline-block',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  ...getRoleBadgeStyle(user?.role ?? 'member'),
                }}>
                  {user?.role ?? 'member'}
                </span>
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1px solid var(--color-bg-elevated)', paddingTop: '1.25rem' }}>
              <button
                onClick={() => void handleSignOut()}
                disabled={signingOut}
                style={{
                  ...btnOutline,
                  color: 'var(--color-error)',
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                  opacity: signingOut ? 0.5 : 1,
                  cursor: signingOut ? 'not-allowed' : 'pointer',
                }}
              >
                {signingOut ? 'Signing out...' : 'Sign Out'}
              </button>
              <button
                onClick={() => setShowPasswordSection(!showPasswordSection)}
                style={btnOutline}
              >
                Change Password
              </button>
            </div>
          </div>

          {/* ── Change Password (expandable) ──────────────────────────── */}
          {showPasswordSection && (
            <div style={cardStyle}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.25rem 0' }}>Change Password</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', margin: '0 0 1.5rem 0' }}>
                Enter your current password and choose a new one.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>Current Password</label>
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                    placeholder="Enter your current password"
                    autoComplete="current-password"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>New Password</label>
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    style={inputStyle}
                  />
                  {passwordForm.newPassword.length > 0 && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <div style={{ height: '4px', borderRadius: '2px', backgroundColor: 'var(--color-bg-elevated)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: passwordStrength.width, backgroundColor: passwordStrength.color, transition: 'width 0.2s, background-color 0.2s' }} />
                      </div>
                      <span style={{ fontSize: '0.75rem', color: passwordStrength.color, marginTop: '0.25rem', display: 'block' }}>{passwordStrength.label}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>Confirm New Password</label>
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="Re-enter your new password"
                    autoComplete="new-password"
                    style={{
                      ...inputStyle,
                      color: passwordForm.confirmPassword.length > 0 && passwordForm.confirmPassword !== passwordForm.newPassword ? 'var(--color-error)' : 'var(--color-text-primary)',
                    }}
                  />
                  {passwordForm.confirmPassword.length > 0 && passwordForm.confirmPassword !== passwordForm.newPassword && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-error)', marginTop: '0.25rem', display: 'block' }}>Passwords do not match</span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={showPasswords} onChange={(e) => setShowPasswords(e.target.checked)} style={{ cursor: 'pointer' }} />
                    Show passwords
                  </label>
                  <button
                    onClick={() => void handlePasswordChange()}
                    disabled={changingPassword || !passwordFormIsValid}
                    style={{ ...btnPrimary, opacity: changingPassword || !passwordFormIsValid ? 0.5 : 1, cursor: changingPassword || !passwordFormIsValid ? 'not-allowed' : 'pointer' }}
                  >
                    {changingPassword ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Transfer Ownership (owner only) ──────────────────────── */}
          {isOwner && (
            <div style={cardStyle}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.25rem 0' }}>Transfer Ownership</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', margin: '0 0 1rem 0' }}>
                Transfer the owner role to another team member. You will be demoted to admin.
              </p>
              <Link
                href="/settings/users"
                style={{
                  ...btnOutline,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  textDecoration: 'none',
                }}
              >
                Manage Team Members
              </Link>
            </div>
          )}

          {/* ── Danger Zone ───────────────────────────────────────────── */}
          <div style={{
            backgroundColor: 'var(--color-bg-card)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '0.75rem',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '1rem 1.5rem',
              borderBottom: '1px solid rgba(239, 68, 68, 0.2)',
              backgroundColor: 'rgba(239, 68, 68, 0.06)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.25rem 0', color: 'var(--color-error)' }}>Danger Zone</h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: 0 }}>Irreversible actions. Proceed with caution.</p>
              </div>
            </div>

            <div style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ maxWidth: '480px' }}>
                  <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, margin: '0 0 0.375rem 0' }}>Delete My Account</h4>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: 0, lineHeight: '1.5' }}>
                    Permanently deletes your profile, settings, and all personal data. This action cannot be undone.
                  </p>
                  {isOwner && (
                    <p style={{
                      marginTop: '0.75rem',
                      padding: '0.5rem 0.75rem',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      borderRadius: '0.375rem',
                      fontSize: '0.8125rem',
                      color: 'var(--color-error)',
                    }}>
                      Account owners cannot self-delete. Transfer ownership first.
                    </p>
                  )}
                </div>
                {!isOwner && (
                  <button
                    onClick={() => setShowDeleteSection(!showDeleteSection)}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: 'transparent',
                      color: 'var(--color-error)',
                      border: '1px solid rgba(239, 68, 68, 0.5)',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      marginLeft: '1.5rem',
                    }}
                  >
                    {showDeleteSection ? 'Cancel' : 'Delete Account'}
                  </button>
                )}
              </div>

              {showDeleteSection && !isOwner && (
                <div style={{
                  marginTop: '1.5rem',
                  padding: '1.25rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.06)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '0.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                }}>
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                    To confirm, enter your password and type{' '}
                    <strong style={{ color: 'var(--color-error)', fontFamily: 'monospace' }}>DELETE MY ACCOUNT</strong>.
                  </p>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>Your Password</label>
                    <input
                      type="password"
                      value={deleteForm.password}
                      onChange={(e) => setDeleteForm((prev) => ({ ...prev, password: e.target.value }))}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      style={{ ...inputStyle, border: '1px solid rgba(239, 68, 68, 0.3)' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>Confirmation Phrase</label>
                    <input
                      type="text"
                      value={deleteForm.confirmation}
                      onChange={(e) => setDeleteForm((prev) => ({ ...prev, confirmation: e.target.value }))}
                      placeholder="Type: DELETE MY ACCOUNT"
                      autoComplete="off"
                      style={{ ...inputStyle, border: '1px solid rgba(239, 68, 68, 0.3)', fontFamily: 'monospace' }}
                    />
                  </div>
                  <button
                    onClick={() => void handleDeleteAccount()}
                    disabled={deletingAccount || deleteForm.password.length === 0 || deleteForm.confirmation !== 'DELETE MY ACCOUNT'}
                    style={{
                      padding: '0.625rem 1.25rem',
                      backgroundColor: deletingAccount ? 'rgba(239,68,68,0.5)' : 'var(--color-error)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '0.375rem',
                      cursor: deletingAccount || deleteForm.password.length === 0 || deleteForm.confirmation !== 'DELETE MY ACCOUNT' ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      opacity: deleteForm.password.length === 0 || deleteForm.confirmation !== 'DELETE MY ACCOUNT' ? 0.4 : 1,
                      alignSelf: 'flex-end',
                    }}
                  >
                    {deletingAccount ? 'Deleting...' : 'Permanently Delete My Account'}
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
