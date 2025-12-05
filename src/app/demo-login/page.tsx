'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth } from '@/lib/firebase/config';
import { signInWithCustomToken } from 'firebase/auth';

export default function DemoLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('Logging in...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleLogin = async () => {
      try {
        const token = searchParams.get('token');
        
        if (!token) {
          setError('No login token provided');
          return;
        }

        if (!auth) {
          setError('Firebase authentication not initialized. Please check your Firebase configuration.');
          return;
        }

        setStatus('Authenticating with Firebase...');

        // Sign in with the custom token
        await signInWithCustomToken(auth, token);

        setStatus('Login successful! Redirecting...');

        // Wait a moment then redirect to dashboard
        setTimeout(() => {
          router.push('/dashboard');
        }, 500);

      } catch (err) {
        console.error('Demo login error:', err);
        setError(err instanceof Error ? err.message : 'Failed to login');
      }
    };

    handleLogin();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
        {error ? (
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-medium text-gray-900">Login Failed</h3>
            <p className="mt-2 text-sm text-gray-600">{error}</p>
            <button
              onClick={() => router.push('/admin/demo-accounts')}
              className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Back to Demo Accounts
            </button>
          </div>
        ) : (
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100">
              <svg className="animate-spin h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-medium text-gray-900">{status}</h3>
            <p className="mt-2 text-sm text-gray-600">Please wait while we log you into the demo account...</p>
          </div>
        )}
      </div>
    </div>
  );
}

