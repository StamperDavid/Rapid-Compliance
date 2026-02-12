'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

type UnsubscribeStatus = 'loading' | 'confirm' | 'processing' | 'success' | 'error';

export default function UnsubscribePage() {
  const searchParams = useSearchParams();
  const contactId = searchParams.get('contact');
  const emailId = searchParams.get('email');
  const org = searchParams.get('org');

  const [status, setStatus] = useState<UnsubscribeStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!contactId || !org) {
      setStatus('error');
      setErrorMessage('Invalid unsubscribe link. Required parameters are missing.');
    } else {
      setStatus('confirm');
    }
  }, [contactId, org]);

  const handleUnsubscribe = useCallback(async () => {
    if (!contactId || !org) {
      return;
    }
    setStatus('processing');

    try {
      const res = await fetch('/api/public/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId, emailId, org }),
      });

      if (res.ok) {
        setStatus('success');
      } else {
        const data: unknown = await res.json().catch(() => null);
        const msg = (data && typeof data === 'object' && 'error' in data)
          ? String((data as { error: string }).error)
          : 'Failed to process your request.';
        setErrorMessage(msg);
        setStatus('error');
      }
    } catch {
      setErrorMessage('Network error. Please try again later.');
      setStatus('error');
    }
  }, [contactId, emailId, org]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-gray-900 rounded-lg border border-gray-800 p-8 text-center">
        <h1 className="text-2xl font-bold text-white mb-2">Email Preferences</h1>

        {status === 'loading' && (
          <p className="text-gray-400 mt-4">Loading...</p>
        )}

        {status === 'confirm' && (
          <>
            <p className="text-gray-400 mt-4 mb-6">
              Click the button below to unsubscribe from future marketing emails.
              You will still receive transactional emails related to your account.
            </p>
            <button
              onClick={() => void handleUnsubscribe()}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              Unsubscribe
            </button>
          </>
        )}

        {status === 'processing' && (
          <p className="text-gray-400 mt-4">Processing your request...</p>
        )}

        {status === 'success' && (
          <>
            <div className="mt-4 mb-4 text-green-400 text-4xl">&#10003;</div>
            <p className="text-gray-300 mb-2">
              You have been successfully unsubscribed.
            </p>
            <p className="text-gray-500 text-sm">
              You will no longer receive marketing emails from us.
              This may take up to 24 hours to fully process.
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mt-4 mb-4 text-red-400 text-4xl">&#10007;</div>
            <p className="text-gray-300">{errorMessage}</p>
            {contactId && org && (
              <button
                onClick={() => void handleUnsubscribe()}
                className="mt-4 text-blue-400 hover:text-blue-300 underline text-sm"
              >
                Try again
              </button>
            )}
          </>
        )}

        <p className="text-gray-600 text-xs mt-8">
          SalesVelocity.ai
        </p>
      </div>
    </div>
  );
}
