'use client';

/**
 * Signup Page
 *
 * Two modes:
 *   1. Normal signup  → redirect to /onboarding/industry
 *   2. Invite accept  → validate token, show inline account creation form
 *
 * The invite flow bypasses the full onboarding (industry/niche selection)
 * because the user is joining an existing team.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createUserWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { Lock, Eye, EyeOff, Building2, UserPlus, AlertCircle } from 'lucide-react';
import type { AccountRole } from '@/types/unified-rbac';

// ============================================================================
// Types
// ============================================================================

interface InviteData {
  id: string;
  email: string;
  role: AccountRole;
  invitedByEmail: string | null;
  expiresAt: string;
}

type InviteState =
  | { status: 'loading' }
  | { status: 'valid'; invite: InviteData }
  | { status: 'error'; message: string };

// ============================================================================
// Component
// ============================================================================

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('invite');

  // If no invite token, redirect to normal onboarding
  useEffect(() => {
    if (!inviteToken) {
      router.replace('/onboarding/industry');
    }
  }, [inviteToken, router]);

  // ---- Invite-specific state ----
  const [inviteState, setInviteState] = useState<InviteState>({ status: 'loading' });
  const [formData, setFormData] = useState({
    displayName: '',
    password: '',
    confirmPassword: '',
    companyName: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // ---- Validate invite token on mount ----
  const validateInvite = useCallback(async (token: string) => {
    try {
      const res = await fetch(`/api/users/invite/${encodeURIComponent(token)}`);
      const json = await res.json() as { success: boolean; invite?: InviteData; error?: string };

      if (!res.ok || !json.success) {
        setInviteState({ status: 'error', message: json.error ?? 'Invalid invitation.' });
        return;
      }

      if (json.invite) {
        setInviteState({ status: 'valid', invite: json.invite });
      }
    } catch {
      setInviteState({ status: 'error', message: 'Failed to validate invitation. Please try again.' });
    }
  }, []);

  useEffect(() => {
    if (inviteToken) {
      void validateInvite(inviteToken);
    }
  }, [inviteToken, validateInvite]);

  // ---- Form validation ----
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.displayName.trim()) {
      newErrors.displayName = 'Your name is required';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!formData.companyName.trim()) {
      newErrors.companyName = 'Company name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ---- Submit: create Firebase Auth account, then call accept endpoint ----
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) { return; }
    if (inviteState.status !== 'valid') { return; }

    setIsLoading(true);
    setErrors({});

    const { invite } = inviteState;
    let firebaseUser: { uid: string; delete: () => Promise<void> } | null = null;

    try {
      if (!auth) {
        throw new Error('Firebase is not initialized');
      }

      // Step 1: Create Firebase Auth account
      const cred = await createUserWithEmailAndPassword(auth, invite.email, formData.password);
      firebaseUser = { uid: cred.user.uid, delete: () => deleteUser(cred.user) };

      // Step 2: Call the accept endpoint (creates Firestore profile + sets claims)
      const acceptRes = await fetch(`/api/users/invite/${encodeURIComponent(invite.id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: cred.user.uid,
          displayName: formData.displayName.trim(),
          companyName: formData.companyName.trim(),
        }),
      });

      const acceptJson = await acceptRes.json() as { success: boolean; error?: string };

      if (!acceptRes.ok || !acceptJson.success) {
        // Roll back the Firebase Auth account
        await firebaseUser.delete();
        setErrors({ submit: acceptJson.error ?? 'Failed to accept invitation.' });
        return;
      }

      // Step 3: Force token refresh so new claims are picked up
      await cred.user.getIdToken(true);

      // Step 4: Redirect to dashboard
      router.push('/');
    } catch (error: unknown) {
      // Roll back Firebase Auth user if it was created
      if (firebaseUser) {
        try { await firebaseUser.delete(); } catch { /* best effort */ }
      }

      if (error instanceof Error && 'code' in error) {
        const fbErr = error as { code: string };
        if (fbErr.code === 'auth/email-already-in-use') {
          setErrors({ submit: 'This email is already registered. Try signing in instead.' });
        } else if (fbErr.code === 'auth/weak-password') {
          setErrors({ submit: 'Password is too weak. Please use a stronger password.' });
        } else {
          setErrors({ submit: 'Failed to create account. Please try again.' });
        }
      } else {
        setErrors({ submit: 'Failed to create account. Please try again.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ---- Non-invite: show loading spinner while redirecting ----
  if (!inviteToken) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4" />
          <p className="text-slate-400">Redirecting to onboarding...</p>
        </div>
      </div>
    );
  }

  // ---- Invite loading ----
  if (inviteState.status === 'loading') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4" />
          <p className="text-slate-400">Validating your invitation...</p>
        </div>
      </div>
    );
  }

  // ---- Invite error (expired, already used, not found) ----
  if (inviteState.status === 'error') {
    return (
      <div className="min-h-screen bg-black">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/30 via-black to-purple-950/20" />
        <div className="relative z-10 max-w-md mx-auto px-4 py-24 text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Invitation Invalid</h1>
          <p className="text-gray-400 mb-8">{inviteState.message}</p>
          <div className="flex flex-col gap-3">
            <Link
              href="/login"
              className="inline-block px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors"
            >
              Sign In Instead
            </Link>
            <Link
              href="/onboarding/industry"
              className="inline-block px-6 py-3 bg-white/5 hover:bg-white/10 text-gray-300 font-medium rounded-xl border border-white/10 transition-colors"
            >
              Create a New Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ---- Valid invite: show acceptance form ----
  const { invite } = inviteState;

  const roleBadgeColors: Record<AccountRole, string> = {
    owner: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    admin: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
    manager: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    member: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  };

  return (
    <div className="min-h-screen bg-black">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/30 via-black to-purple-950/20" />
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-5" />

      <div className="relative z-10 max-w-xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block mb-8">
            <span className="text-2xl font-bold text-white">
              Sales<span className="text-indigo-400">Velocity</span>
            </span>
          </Link>

          <div className="w-14 h-14 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-5">
            <UserPlus className="w-7 h-7 text-indigo-400" />
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
            You&apos;ve been invited
          </h1>

          <p className="text-gray-400 max-w-md mx-auto">
            {invite.invitedByEmail ? (
              <>
                <span className="text-white font-medium">{invite.invitedByEmail}</span> invited you to join as
              </>
            ) : (
              <>You&apos;ve been invited to join as</>
            )}
            {' '}
            <span className={`inline-block px-2.5 py-0.5 text-xs font-bold uppercase rounded-full border ${roleBadgeColors[invite.role]}`}>
              {invite.role}
            </span>
          </p>
        </div>

        {/* Form Card */}
        <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-8">
          {/* Pre-filled email (read-only) */}
          <div className="mb-6 p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-xl">
            <p className="text-xs font-medium text-gray-400 mb-1">Email address</p>
            <p className="text-white font-medium">{invite.email}</p>
          </div>

          <form
            onSubmit={(e) => { void handleSubmit(e); }}
            className="space-y-5"
          >
            {/* Display Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Your Full Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                placeholder="Jane Smith"
                className={`w-full px-4 py-3.5 bg-white/5 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all ${
                  errors.displayName ? 'border-red-500/50' : 'border-white/10 focus:border-indigo-500/50'
                }`}
              />
              {errors.displayName && <p className="mt-1.5 text-sm text-red-400">{errors.displayName}</p>}
            </div>

            {/* Company Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Company / Brand Name <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  placeholder="Acme Inc."
                  className={`w-full pl-12 pr-4 py-3.5 bg-white/5 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all ${
                    errors.companyName ? 'border-red-500/50' : 'border-white/10 focus:border-indigo-500/50'
                  }`}
                />
              </div>
              {errors.companyName && <p className="mt-1.5 text-sm text-red-400">{errors.companyName}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Password <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Min 8 characters"
                  className={`w-full pl-12 pr-12 py-3.5 bg-white/5 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all ${
                    errors.password ? 'border-red-500/50' : 'border-white/10 focus:border-indigo-500/50'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && <p className="mt-1.5 text-sm text-red-400">{errors.password}</p>}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Confirm Password <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  placeholder="Confirm your password"
                  className={`w-full pl-12 pr-4 py-3.5 bg-white/5 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all ${
                    errors.confirmPassword ? 'border-red-500/50' : 'border-white/10 focus:border-indigo-500/50'
                  }`}
                />
              </div>
              {errors.confirmPassword && <p className="mt-1.5 text-sm text-red-400">{errors.confirmPassword}</p>}
            </div>

            {/* Submit Error */}
            {errors.submit && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-sm text-red-400">{errors.submit}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Joining the team...
                </>
              ) : (
                <>
                  Accept Invitation & Join
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-gray-500 text-sm">
            By joining, you agree to our{' '}
            <Link href="/terms" className="text-indigo-400 hover:text-indigo-300 transition-colors">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-indigo-400 hover:text-indigo-300 transition-colors">
              Privacy Policy
            </Link>
          </p>
        </div>

        <div className="mt-8 text-center text-gray-500 text-sm">
          Already have an account?{' '}
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300 transition-colors">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
