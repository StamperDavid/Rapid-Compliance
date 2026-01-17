'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation'
import { logger } from '@/lib/logger/logger';;

export default function MakeCallPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const [phoneNumber, setPhoneNumber] = useState('');
  const [calling, setCalling] = useState(false);

  const handleCall = async () => {
    if (!phoneNumber) {return;}
    try {
      setCalling(true);
      // Call Twilio voice API
      const response = await fetch('/api/voice/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: phoneNumber, organizationId: orgId }),
      });
      if (!response.ok) {throw new Error('Call failed');}
      alert('Call initiated!');
      router.push(`/workspace/${orgId}/calls`);
    } catch (error: unknown) {
      logger.error('Error making call:', error instanceof Error ? error : undefined, { file: 'page.tsx' });
      alert('Failed to make call');
    } finally {
      setCalling(false);
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold mb-6">Make Call</h1>
        <div className="bg-gray-900 rounded-lg p-6">
          <label className="block text-sm font-medium mb-2">Phone Number</label>
          <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+1 (555) 123-4567" className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg mb-4 text-lg" />
          <button onClick={handleCall} disabled={calling || !phoneNumber} className="w-full px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-lg font-semibold">{calling ? 'Calling...' : '📞 Call Now'}</button>
        </div>
      </div>
    </div>
  );
}




