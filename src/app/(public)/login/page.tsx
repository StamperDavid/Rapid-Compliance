'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/config'
import { logger } from '@/lib/logger/logger';

interface FirebaseError {
  code: string;
  message: string;
}

/**
 * User document structure from Firestore
 * Used for role-based login redirection
 */
interface UserDocument {
  role?: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState('');

  /**
   * UNIFIED LOGIN ARCHITECTURE: SMART ROLE REDIRECTION
   *
   * This handler implements role-based routing after authentication:
   * - admin users → /admin (Platform Admin Dashboard)
   * - All other users → /dashboard
   *
   * The redirecting state prevents FOUC (Flash of Unstyled Content) by
   * showing a clean loading indicator during the navigation transition.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!auth || !db) {
        throw new Error('Firebase not initialized');
      }

      // Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      const user = userCredential.user;
      logger.info('User signed in', { uid: user.uid, file: 'login/page.tsx' });

      // Get user document to find their organization and role
      const userDoc = await getDoc(doc(db, 'users', user.uid));

      if (!userDoc.exists()) {
        throw new Error('User profile not found. Please contact support.');
      }

      const userData = userDoc.data() as UserDocument;
      const userRole = userData.role;

      logger.info('User role detected', {
        uid: user.uid,
        role: userRole,
        file: 'login/page.tsx'
      });

      // SMART ROLE REDIRECTION
      // Admin role routes to /admin, all others to dashboard
      if (userRole === 'admin') {
        logger.info('Admin detected, redirecting to /dashboard', {
          uid: user.uid,
          file: 'login/page.tsx'
        });
        // Set redirecting state to show clean loading UI (prevents FOUC)
        setRedirecting(true);
        router.push('/dashboard');
        return;
      }

      // Set redirecting state for clean transition
      setRedirecting(true);

      router.push('/dashboard');
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Login error:', error, { file: 'login/page.tsx' });

      // User-friendly error messages
      const firebaseError = err as FirebaseError;
      const errorMessages: Record<string, string> = {
        'auth/user-not-found': 'No account found with this email.',
        'auth/wrong-password': 'Incorrect password.',
        'auth/invalid-email': 'Invalid email address.',
        'auth/invalid-credential': 'Invalid email or password.',
        'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
        'auth/network-request-failed': 'Network error. Please check your connection.',
      };

      setError(errorMessages[firebaseError.code] ?? firebaseError.message ?? 'Login failed');
      // Only reset loading on error (successful auth transitions to redirecting state)
      setLoading(false);
    }
  };

  // Show full-screen loading state during redirect to prevent FOUC
  if (redirecting) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin h-10 w-10 text-indigo-500" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <p className="text-white text-lg font-medium">Redirecting to your dashboard...</p>
          <p className="text-gray-500 text-sm">Please wait while we set things up</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
            <p className="text-gray-400">Sign in to your account</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-5">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition"
                placeholder="you@company.com"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Password</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition"
                placeholder="••••••••"
                required
                disabled={loading}
              />
            </div>

            {/* Forgot Password Link */}
            <div className="flex justify-end">
              <Link 
                href="/forgot-password" 
                className="text-sm text-indigo-400 hover:text-indigo-300 transition"
              >
                Forgot password?
              </Link>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-4 rounded-lg font-bold text-lg transition ${
                loading
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-500'
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Sign Up Link */}
          <p className="text-center text-gray-400 mt-8">
            Don&apos;t have an account?{' '}
            <Link href="/onboarding/industry" className="text-indigo-400 hover:text-indigo-300 font-medium transition">
              Sign up free
            </Link>
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-600 mt-6">
          Protected by enterprise-grade security
        </p>
      </div>
    </div>
  );
}










