'use client';

/**
 * Account Settings Page
 *
 * Lets authenticated users:
 * - Change their password (current password + new password confirmation).
 * - Permanently delete their own account (GDPR self-service).
 *
 * Uses the same inline-style / CSS-variable pattern as the rest of the
 * settings section (see settings/security/page.tsx for reference).
 */

import React, { useState } from 'react';
import Link from 'next/link';
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
// PASSWORD STRENGTH INDICATOR
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
// PAGE COMPONENT
// ============================================================================

export default function AccountSettingsPage() {
  const { user } = useAuth();
  const authFetch = useAuthFetch();
  const toast = useToast();

  // Password change state
  const [passwordForm, setPasswordForm] = useState<PasswordChangeForm>(DEFAULT_PASSWORD_FORM);
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  // Account deletion state
  const [deleteForm, setDeleteForm] = useState<DeleteAccountForm>(DEFAULT_DELETE_FORM);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showDeleteSection, setShowDeleteSection] = useState(false);

  // ── Password change ──────────────────────────────────────────────────────

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

      const data: unknown = await response.json();
      const result = data as { success: boolean; error?: string };

      if (!response.ok || !result.success) {
        toast.error(result.error ?? 'Failed to change password');
        return;
      }

      toast.success('Password changed successfully');
      setPasswordForm(DEFAULT_PASSWORD_FORM);
    } catch {
      toast.error('Failed to change password. Please check your connection and try again.');
    } finally {
      setChangingPassword(false);
    }
  };

  // ── Account deletion ─────────────────────────────────────────────────────

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
        body: JSON.stringify({
          password: deleteForm.password,
          confirmation: deleteForm.confirmation,
        }),
      });

      const data: unknown = await response.json();
      const result = data as { success: boolean; error?: string };

      if (!response.ok || !result.success) {
        toast.error(result.error ?? 'Failed to delete account');
        return;
      }

      toast.success('Account deleted. Signing out…');
      await signOutUser();
      // Redirect to the sign-in page after deletion
      window.location.href = '/';
    } catch {
      toast.error('Failed to delete account. Please check your connection and try again.');
    } finally {
      setDeletingAccount(false);
    }
  };

  // ── Derived values ───────────────────────────────────────────────────────

  const passwordStrength = getPasswordStrength(passwordForm.newPassword);
  const isOwner = user?.role === 'owner';
  const passwordFormIsValid =
    passwordForm.currentPassword.length > 0 &&
    passwordForm.newPassword.length >= 8 &&
    passwordForm.confirmPassword.length > 0;

  // ── Render ───────────────────────────────────────────────────────────────

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
          <Link
            href="/settings"
            style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '0.875rem' }}
          >
            Settings
          </Link>
          <span style={{ color: 'var(--color-text-muted)' }}>/</span>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Account</h1>
        </div>
      </div>

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '2rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* ── Change Password ────────────────────────────────────────── */}
          <div style={{
            backgroundColor: 'var(--color-bg-card)',
            border: '1px solid var(--color-bg-elevated)',
            borderRadius: '0.75rem',
            padding: '1.5rem',
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.25rem 0' }}>
              Change Password
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', margin: '0 0 1.5rem 0' }}>
              Update your password. You will need to enter your current password to confirm.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Current password */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                  Current Password
                </label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                  placeholder="Enter your current password"
                  autoComplete="current-password"
                  style={{
                    width: '100%',
                    padding: '0.625rem 0.75rem',
                    backgroundColor: 'var(--color-bg-main)',
                    border: '1px solid var(--color-bg-elevated)',
                    borderRadius: '0.375rem',
                    color: 'var(--color-text-primary)',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* New password */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                  New Password
                </label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                  placeholder="At least 8 characters, upper, lower, and a number"
                  autoComplete="new-password"
                  style={{
                    width: '100%',
                    padding: '0.625rem 0.75rem',
                    backgroundColor: 'var(--color-bg-main)',
                    border: '1px solid var(--color-bg-elevated)',
                    borderRadius: '0.375rem',
                    color: 'var(--color-text-primary)',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box',
                  }}
                />
                {/* Strength bar */}
                {passwordForm.newPassword.length > 0 && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <div style={{
                      height: '4px',
                      borderRadius: '2px',
                      backgroundColor: 'var(--color-bg-elevated)',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%',
                        width: passwordStrength.width,
                        backgroundColor: passwordStrength.color,
                        transition: 'width 0.2s, background-color 0.2s',
                      }} />
                    </div>
                    <span style={{ fontSize: '0.75rem', color: passwordStrength.color, marginTop: '0.25rem', display: 'block' }}>
                      {passwordStrength.label}
                    </span>
                  </div>
                )}
              </div>

              {/* Confirm new password */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                  Confirm New Password
                </label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Re-enter your new password"
                  autoComplete="new-password"
                  style={{
                    width: '100%',
                    padding: '0.625rem 0.75rem',
                    backgroundColor: 'var(--color-bg-main)',
                    border: '1px solid var(--color-bg-elevated)',
                    borderRadius: '0.375rem',
                    color: passwordForm.confirmPassword.length > 0 && passwordForm.confirmPassword !== passwordForm.newPassword
                      ? 'var(--color-error)'
                      : 'var(--color-text-primary)',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box',
                  }}
                />
                {passwordForm.confirmPassword.length > 0 && passwordForm.confirmPassword !== passwordForm.newPassword && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-error)', marginTop: '0.25rem', display: 'block' }}>
                    Passwords do not match
                  </span>
                )}
              </div>

              {/* Show / hide toggle + submit */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={showPasswords}
                    onChange={(e) => setShowPasswords(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  Show passwords
                </label>

                <button
                  onClick={() => void handlePasswordChange()}
                  disabled={changingPassword || !passwordFormIsValid}
                  style={{
                    padding: '0.5rem 1.25rem',
                    backgroundColor: 'var(--color-primary)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '0.375rem',
                    cursor: changingPassword || !passwordFormIsValid ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    opacity: changingPassword || !passwordFormIsValid ? 0.5 : 1,
                  }}
                >
                  {changingPassword ? 'Updating…' : 'Update Password'}
                </button>
              </div>
            </div>
          </div>

          {/* ── Danger Zone ────────────────────────────────────────────── */}
          <div style={{
            backgroundColor: 'var(--color-bg-card)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '0.75rem',
            overflow: 'hidden',
          }}>
            {/* Danger zone header */}
            <div style={{
              padding: '1rem 1.5rem',
              borderBottom: '1px solid rgba(239, 68, 68, 0.2)',
              backgroundColor: 'rgba(239, 68, 68, 0.06)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.25rem 0', color: 'var(--color-error)' }}>
                  Danger Zone
                </h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                  Irreversible actions. Proceed with caution.
                </p>
              </div>
            </div>

            <div style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ maxWidth: '480px' }}>
                  <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, margin: '0 0 0.375rem 0' }}>
                    Delete My Account
                  </h4>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: 0, lineHeight: '1.5' }}>
                    Permanently deletes your profile, settings, and all personal data. This
                    action cannot be undone. Your organisation&apos;s data (leads, deals, etc.) will
                    remain intact.
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
                      Account owners cannot self-delete. Transfer ownership to another member
                      first via Settings &gt; Users.
                    </p>
                  )}
                </div>
                {!isOwner && (
                  <button
                    onClick={() => setShowDeleteSection((prev) => !prev)}
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

              {/* Expanded deletion form */}
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
                    <strong style={{ color: 'var(--color-error)', fontFamily: 'monospace' }}>DELETE MY ACCOUNT</strong>{' '}
                    in the field below.
                  </p>

                  {/* Password field */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                      Your Password
                    </label>
                    <input
                      type="password"
                      value={deleteForm.password}
                      onChange={(e) => setDeleteForm((prev) => ({ ...prev, password: e.target.value }))}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      style={{
                        width: '100%',
                        padding: '0.625rem 0.75rem',
                        backgroundColor: 'var(--color-bg-main)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '0.375rem',
                        color: 'var(--color-text-primary)',
                        fontSize: '0.875rem',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* Confirmation phrase */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                      Confirmation Phrase
                    </label>
                    <input
                      type="text"
                      value={deleteForm.confirmation}
                      onChange={(e) => setDeleteForm((prev) => ({ ...prev, confirmation: e.target.value }))}
                      placeholder="Type: DELETE MY ACCOUNT"
                      autoComplete="off"
                      style={{
                        width: '100%',
                        padding: '0.625rem 0.75rem',
                        backgroundColor: 'var(--color-bg-main)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '0.375rem',
                        color: 'var(--color-text-primary)',
                        fontSize: '0.875rem',
                        fontFamily: 'monospace',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* Confirm deletion button */}
                  <button
                    onClick={() => void handleDeleteAccount()}
                    disabled={
                      deletingAccount ||
                      deleteForm.password.length === 0 ||
                      deleteForm.confirmation !== 'DELETE MY ACCOUNT'
                    }
                    style={{
                      padding: '0.625rem 1.25rem',
                      backgroundColor: deletingAccount ? 'rgba(239,68,68,0.5)' : 'var(--color-error)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '0.375rem',
                      cursor:
                        deletingAccount ||
                        deleteForm.password.length === 0 ||
                        deleteForm.confirmation !== 'DELETE MY ACCOUNT'
                          ? 'not-allowed'
                          : 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      opacity:
                        deleteForm.password.length === 0 ||
                        deleteForm.confirmation !== 'DELETE MY ACCOUNT'
                          ? 0.4
                          : 1,
                      alignSelf: 'flex-end',
                    }}
                  >
                    {deletingAccount ? 'Deleting…' : 'Permanently Delete My Account'}
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
