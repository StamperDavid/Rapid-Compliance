'use client';

/**
 * My Profile Page
 *
 * Full user profile management modeled after HubSpot/Pipedrive patterns:
 * - Profile info (avatar, name, email, phone, title) — inline editable
 * - Sign out + Change password at top
 * - Preferences (timezone, date format)
 * - Danger zone (delete account)
 * - Transfer ownership (owner only, last on page)
 */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useToast } from '@/hooks/useToast';
import { signOutUser } from '@/lib/auth/auth-service';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// TYPES
// ============================================================================

interface ProfileData {
  displayName: string;
  email: string;
  phone: string;
  title: string;
  timezone: string;
  dateFormat: string;
}

interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface DeleteForm {
  password: string;
  confirmation: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Australia/Sydney',
  'Pacific/Auckland',
  'UTC',
];

const DATE_FORMATS = [
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (US)' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (EU)' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (ISO)' },
];

const DEFAULT_PASSWORD: PasswordForm = { currentPassword: '', newPassword: '', confirmPassword: '' };
const DEFAULT_DELETE: DeleteForm = { password: '', confirmation: '' };

// ============================================================================
// HELPERS
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

function getRoleBadge(role: string): { bg: string; color: string; border: string } {
  switch (role) {
    case 'owner': return { bg: 'rgba(168,85,247,0.15)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.3)' };
    case 'admin': return { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)' };
    case 'manager': return { bg: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' };
    default: return { bg: 'rgba(156,163,175,0.15)', color: '#9ca3af', border: '1px solid rgba(156,163,175,0.3)' };
  }
}

// ============================================================================
// PAGE
// ============================================================================

export default function MyProfilePage() {
  const { user } = useAuth();
  const authFetch = useAuthFetch();
  const toast = useToast();
  const router = useRouter();

  // Profile state
  const [profile, setProfile] = useState<ProfileData>({
    displayName: '',
    email: '',
    phone: '',
    title: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    dateFormat: 'MM/DD/YYYY',
  });
  const [editingField, setEditingField] = useState<keyof ProfileData | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Password state
  const [passwordForm, setPasswordForm] = useState<PasswordForm>(DEFAULT_PASSWORD);
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [showPasswordSection, setShowPasswordSection] = useState(false);

  // Delete state
  const [deleteForm, setDeleteForm] = useState<DeleteForm>(DEFAULT_DELETE);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showDeleteSection, setShowDeleteSection] = useState(false);

  // Sign out
  const [signingOut, setSigningOut] = useState(false);

  // Derived
  const isOwner = user?.role === 'owner';
  const displayName = profile.displayName ?? user?.email?.split('@')[0] ?? 'User';
  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const roleBadge = getRoleBadge(user?.role ?? 'member');
  const passwordStrength = getPasswordStrength(passwordForm.newPassword);
  const passwordValid = passwordForm.currentPassword.length > 0 && passwordForm.newPassword.length >= 8 && passwordForm.confirmPassword.length > 0;

  // ── Load profile from Firestore ───────────────────────────────────────
  const loadProfile = useCallback(async () => {
    if (!user) { return; }
    try {
      const res = await authFetch(`/api/admin/users?limit=1`);
      if (!res.ok) { return; }
      const body = await res.json() as { users?: Array<Record<string, unknown>> };
      const me = body.users?.find(u => u.id === user.id);
      if (me) {
        setProfile({
          displayName: (me.name as string) ?? (me.displayName as string) ?? '',
          email: (me.email as string) ?? user.email ?? '',
          phone: (me.phone as string) ?? '',
          title: (me.title as string) ?? '',
          timezone: (me.timezone as string) ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
          dateFormat: (me.dateFormat as string) ?? 'MM/DD/YYYY',
        });
      } else {
        setProfile(prev => ({
          ...prev,
          displayName: user.displayName ?? '',
          email: user.email ?? '',
        }));
      }
      setProfileLoaded(true);
    } catch (err: unknown) {
      logger.error('[Profile] Failed to load', err instanceof Error ? err : new Error(String(err)));
      setProfile(prev => ({
        ...prev,
        displayName: user.displayName ?? '',
        email: user.email ?? '',
      }));
      setProfileLoaded(true);
    }
  }, [user, authFetch]);

  useEffect(() => {
    if (user && !profileLoaded) {
      void loadProfile();
    }
  }, [user, profileLoaded, loadProfile]);

  // ── Save a profile field ──────────────────────────────────────────────
  const saveField = async (field: keyof ProfileData, value: string) => {
    if (!user) { return; }
    setSavingProfile(true);
    try {
      const updatePayload: Record<string, string> = { userId: user.id };

      // Map profile fields to API fields
      if (field === 'displayName') {
        updatePayload.name = value;
      } else {
        updatePayload[field] = value;
      }

      const res = await authFetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Failed' })) as { error?: string };
        throw new Error(body.error ?? 'Failed to save');
      }

      setProfile(prev => ({ ...prev, [field]: value }));
      setEditingField(null);
      toast.success('Saved');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSavingProfile(false);
    }
  };

  // ── Start editing a field ─────────────────────────────────────────────
  const startEdit = (field: keyof ProfileData) => {
    setEditValue(profile[field]);
    setEditingField(field);
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  // ── Sign out ──────────────────────────────────────────────────────────
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

  // ── Password change ───────────────────────────────────────────────────
  const handlePasswordChange = async () => {
    if (!user) { return; }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) { toast.error('Passwords do not match'); return; }
    if (passwordForm.newPassword.length < 8) { toast.error('Must be at least 8 characters'); return; }
    setChangingPassword(true);
    try {
      const res = await authFetch('/api/user/password-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword }),
      });
      const data = await res.json() as { success: boolean; error?: string };
      if (!res.ok || !data.success) { toast.error(data.error ?? 'Failed'); return; }
      toast.success('Password changed');
      setPasswordForm(DEFAULT_PASSWORD);
      setShowPasswordSection(false);
    } catch { toast.error('Failed to change password'); }
    finally { setChangingPassword(false); }
  };

  // ── Delete account ────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!user || deleteForm.confirmation !== 'DELETE MY ACCOUNT') { toast.error('Type DELETE MY ACCOUNT to confirm'); return; }
    setDeletingAccount(true);
    try {
      const res = await authFetch('/api/user/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deleteForm.password, confirmation: deleteForm.confirmation }),
      });
      const data = await res.json() as { success: boolean; error?: string };
      if (!res.ok || !data.success) { toast.error(data.error ?? 'Failed'); return; }
      await signOutUser();
      window.location.href = '/';
    } catch { toast.error('Failed to delete account'); }
    finally { setDeletingAccount(false); }
  };

  // ── Styles ────────────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    backgroundColor: 'var(--color-bg-card)',
    border: '1px solid var(--color-bg-elevated)',
    borderRadius: '0.75rem',
    padding: '1.5rem',
  };
  const input: React.CSSProperties = {
    width: '100%', padding: '0.625rem 0.75rem', backgroundColor: 'var(--color-bg-main)',
    border: '1px solid var(--color-bg-elevated)', borderRadius: '0.375rem',
    color: 'var(--color-text-primary)', fontSize: '0.875rem', boxSizing: 'border-box' as const,
  };
  const btnPrimary: React.CSSProperties = {
    padding: '0.5rem 1rem', backgroundColor: 'var(--color-primary)', color: '#fff',
    border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600,
  };
  const btnGhost: React.CSSProperties = {
    padding: '0.5rem 1rem', backgroundColor: 'transparent', color: 'var(--color-text-secondary)',
    border: '1px solid var(--color-bg-elevated)', borderRadius: '0.375rem', cursor: 'pointer',
    fontSize: '0.8125rem', fontWeight: 500,
  };
  const labelStyle: React.CSSProperties = {
    fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-disabled)',
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem',
  };

  // ── Editable field component ──────────────────────────────────────────
  const ProfileField = ({ field, label, value, type = 'text' }: { field: keyof ProfileData; label: string; value: string; type?: string }) => (
    <div style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--color-bg-elevated)' }}>
      <div style={labelStyle}>{label}</div>
      {editingField === field ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
          <input
            type={type}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            autoFocus
            style={{ ...input, flex: 1 }}
            onKeyDown={(e) => { if (e.key === 'Enter') { void saveField(field, editValue); } if (e.key === 'Escape') { cancelEdit(); } }}
          />
          <button onClick={() => void saveField(field, editValue)} disabled={savingProfile} style={{ ...btnPrimary, opacity: savingProfile ? 0.5 : 1 }}>
            {savingProfile ? '...' : 'Save'}
          </button>
          <button onClick={cancelEdit} style={btnGhost}>Cancel</button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.25rem' }}>
          <span style={{ fontSize: '0.9375rem', color: value ? 'var(--color-text-primary)' : 'var(--color-text-disabled)' }}>
            {value || 'Not set'}
          </span>
          <button onClick={() => startEdit(field)} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 500, padding: '0.25rem 0.5rem' }}>
            Edit
          </button>
        </div>
      )}
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg-main)', color: 'var(--color-text-primary)' }}>
      {/* Header */}
      <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--color-bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/settings" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '0.875rem' }}>Settings</Link>
          <span style={{ color: 'var(--color-text-muted)' }}>/</span>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>My Profile</h1>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => setShowPasswordSection(!showPasswordSection)} style={btnGhost}>
            Change Password
          </button>
          <button
            onClick={() => void handleSignOut()}
            disabled={signingOut}
            style={{ ...btnGhost, color: 'var(--color-error)', borderColor: 'rgba(239,68,68,0.3)', opacity: signingOut ? 0.5 : 1 }}
          >
            {signingOut ? 'Signing out...' : 'Sign Out'}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '2rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* ── Profile Card ─────────────────────────────────────────── */}
          <div style={card}>
            {/* Avatar + Name header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--color-bg-elevated)' }}>
              <div style={{
                width: 72, height: 72, borderRadius: '1rem', background: 'var(--gradient-brand)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, color: '#fff', fontSize: '1.5rem', flexShrink: 0,
              }}>
                {initials}
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.25rem 0' }}>{displayName}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{
                    display: 'inline-block', padding: '0.2rem 0.625rem', borderRadius: '9999px',
                    fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
                    backgroundColor: roleBadge.bg, color: roleBadge.color, border: roleBadge.border,
                  }}>
                    {user?.role ?? 'member'}
                  </span>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-disabled)' }}>
                    {user?.email ?? ''}
                  </span>
                </div>
              </div>
            </div>

            {/* Editable fields */}
            <ProfileField field="displayName" label="Full Name" value={profile.displayName} />
            <ProfileField field="email" label="Email Address" value={profile.email} type="email" />
            <ProfileField field="phone" label="Phone Number" value={profile.phone} type="tel" />
            <ProfileField field="title" label="Job Title" value={profile.title} />
          </div>

          {/* ── Preferences ──────────────────────────────────────────── */}
          <div style={card}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem 0' }}>Preferences</h3>

            {/* Timezone */}
            <div style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--color-bg-elevated)' }}>
              <div style={labelStyle}>Timezone</div>
              <select
                value={profile.timezone}
                onChange={(e) => void saveField('timezone', e.target.value)}
                style={{ ...input, cursor: 'pointer', marginTop: '0.25rem' }}
              >
                {TIMEZONES.map(tz => (
                  <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>

            {/* Date Format */}
            <div style={{ padding: '0.75rem 0' }}>
              <div style={labelStyle}>Date Format</div>
              <select
                value={profile.dateFormat}
                onChange={(e) => void saveField('dateFormat', e.target.value)}
                style={{ ...input, cursor: 'pointer', marginTop: '0.25rem' }}
              >
                {DATE_FORMATS.map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Change Password (expandable) ─────────────────────────── */}
          {showPasswordSection && (
            <div style={card}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.25rem 0' }}>Change Password</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', margin: '0 0 1.5rem 0' }}>
                Enter your current password and choose a new one.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>Current Password</label>
                  <input type={showPasswords ? 'text' : 'password'} value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm(p => ({ ...p, currentPassword: e.target.value }))}
                    placeholder="Enter current password" autoComplete="current-password" style={input} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>New Password</label>
                  <input type={showPasswords ? 'text' : 'password'} value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm(p => ({ ...p, newPassword: e.target.value }))}
                    placeholder="At least 8 characters" autoComplete="new-password" style={input} />
                  {passwordForm.newPassword.length > 0 && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <div style={{ height: '4px', borderRadius: '2px', backgroundColor: 'var(--color-bg-elevated)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: passwordStrength.width, backgroundColor: passwordStrength.color, transition: 'width 0.2s' }} />
                      </div>
                      <span style={{ fontSize: '0.75rem', color: passwordStrength.color, marginTop: '0.25rem', display: 'block' }}>{passwordStrength.label}</span>
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>Confirm New Password</label>
                  <input type={showPasswords ? 'text' : 'password'} value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm(p => ({ ...p, confirmPassword: e.target.value }))}
                    placeholder="Re-enter new password" autoComplete="new-password"
                    style={{ ...input, color: passwordForm.confirmPassword.length > 0 && passwordForm.confirmPassword !== passwordForm.newPassword ? 'var(--color-error)' : 'var(--color-text-primary)' }} />
                  {passwordForm.confirmPassword.length > 0 && passwordForm.confirmPassword !== passwordForm.newPassword && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-error)', marginTop: '0.25rem', display: 'block' }}>Passwords do not match</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={showPasswords} onChange={(e) => setShowPasswords(e.target.checked)} /> Show passwords
                  </label>
                  <button onClick={() => void handlePasswordChange()} disabled={changingPassword || !passwordValid}
                    style={{ ...btnPrimary, opacity: changingPassword || !passwordValid ? 0.5 : 1, cursor: changingPassword || !passwordValid ? 'not-allowed' : 'pointer' }}>
                    {changingPassword ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Danger Zone ───────────────────────────────────────────── */}
          <div style={{ ...card, border: '1px solid rgba(239,68,68,0.3)', overflow: 'hidden', padding: 0 }}>
            <div style={{ padding: '1rem 1.5rem', backgroundColor: 'rgba(239,68,68,0.06)', borderBottom: '1px solid rgba(239,68,68,0.2)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.25rem 0', color: 'var(--color-error)' }}>Danger Zone</h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: 0 }}>Irreversible actions</p>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ maxWidth: '480px' }}>
                  <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, margin: '0 0 0.375rem 0' }}>Delete My Account</h4>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
                    Permanently deletes your profile and personal data. Cannot be undone.
                  </p>
                  {isOwner && (
                    <p style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '0.375rem', fontSize: '0.8125rem', color: 'var(--color-error)' }}>
                      Owners cannot self-delete. Transfer ownership first.
                    </p>
                  )}
                </div>
                {!isOwner && (
                  <button onClick={() => setShowDeleteSection(!showDeleteSection)}
                    style={{ ...btnGhost, color: 'var(--color-error)', borderColor: 'rgba(239,68,68,0.5)', whiteSpace: 'nowrap', flexShrink: 0, marginLeft: '1.5rem' }}>
                    {showDeleteSection ? 'Cancel' : 'Delete Account'}
                  </button>
                )}
              </div>
              {showDeleteSection && !isOwner && (
                <div style={{ marginTop: '1.5rem', padding: '1.25rem', backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                    Type <strong style={{ color: 'var(--color-error)', fontFamily: 'monospace' }}>DELETE MY ACCOUNT</strong> to confirm.
                  </p>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>Password</label>
                    <input type="password" value={deleteForm.password} onChange={(e) => setDeleteForm(p => ({ ...p, password: e.target.value }))}
                      placeholder="Your password" autoComplete="current-password" style={{ ...input, border: '1px solid rgba(239,68,68,0.3)' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>Confirmation</label>
                    <input type="text" value={deleteForm.confirmation} onChange={(e) => setDeleteForm(p => ({ ...p, confirmation: e.target.value }))}
                      placeholder="DELETE MY ACCOUNT" autoComplete="off" style={{ ...input, border: '1px solid rgba(239,68,68,0.3)', fontFamily: 'monospace' }} />
                  </div>
                  <button onClick={() => void handleDelete()}
                    disabled={deletingAccount || deleteForm.password.length === 0 || deleteForm.confirmation !== 'DELETE MY ACCOUNT'}
                    style={{ padding: '0.625rem 1.25rem', backgroundColor: deletingAccount ? 'rgba(239,68,68,0.5)' : 'var(--color-error)', color: '#fff', border: 'none', borderRadius: '0.375rem',
                      cursor: deletingAccount || deleteForm.password.length === 0 || deleteForm.confirmation !== 'DELETE MY ACCOUNT' ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem', fontWeight: 600, opacity: deleteForm.password.length === 0 || deleteForm.confirmation !== 'DELETE MY ACCOUNT' ? 0.4 : 1, alignSelf: 'flex-end' }}>
                    {deletingAccount ? 'Deleting...' : 'Permanently Delete My Account'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── Transfer Ownership (owner only, LAST on page) ─────────── */}
          {isOwner && (
            <div style={{ ...card, border: '1px solid rgba(168,85,247,0.3)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.25rem 0', color: '#a855f7' }}>Transfer Ownership</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', margin: '0 0 1rem 0' }}>
                Transfer the owner role to another team member. You will be demoted to admin. This cannot be undone without the new owner&apos;s consent.
              </p>
              <Link href="/settings/users" style={{ ...btnGhost, display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', borderColor: 'rgba(168,85,247,0.3)', color: '#a855f7' }}>
                Go to Team Members
              </Link>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
