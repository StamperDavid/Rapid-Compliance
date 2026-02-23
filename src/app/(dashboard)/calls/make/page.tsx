'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { logger } from '@/lib/logger/logger';
import { showErrorToast, showSuccessToast } from '@/components/ErrorToast';
import { useAuthFetch } from '@/hooks/useAuthFetch';

export default function MakeCallPage() {
  const router = useRouter();
  const authFetch = useAuthFetch();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [calling, setCalling] = useState(false);

  const handleCall = async () => {
    if (!phoneNumber) {
      return;
    }
    try {
      setCalling(true);
      // Call Twilio voice API
      const response = await authFetch('/api/voice/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: phoneNumber }),
      });
      if (!response.ok) {
        throw new Error('Call failed');
      }
      showSuccessToast('Call initiated!');
      router.push(`/calls`);
    } catch (error: unknown) {
      logger.error('Error making call:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      showErrorToast(error, 'Failed to make call');
    } finally {
      setCalling(false);
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold mb-6">Make Call</h1>
        <div className="bg-surface-paper rounded-lg p-6">
          <label className="block text-sm font-medium mb-2">Phone Number</label>
          <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+1 (555) 123-4567" className="w-full px-4 py-3 bg-surface-elevated border border-border-light rounded-lg mb-4 text-lg" />
          <button onClick={() => { void handleCall(); }} disabled={calling || !phoneNumber} className="w-full px-6 py-4 bg-success text-white rounded-lg hover:from-primary-light hover:to-secondary-light disabled:opacity-50 text-lg font-semibold">{calling ? 'Calling...' : '📞 Call Now'}</button>
        </div>
      </div>
    </div>
  );
}




