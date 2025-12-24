'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FirestoreService } from '@/lib/db/firestore-service';
import { Timestamp } from 'firebase/firestore'
import { logger } from '@/lib/logger/logger';;

export default function NewABTestPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const [test, setTest] = useState({ name: '', description: '', variants: [{ name: 'A', config: {} }, { name: 'B', config: {} }] });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      const testId = `abtest-${Date.now()}`;
      await FirestoreService.set(`organizations/${orgId}/abTests`, testId, { ...test, id: testId, status: 'draft', createdAt: Timestamp.now() }, false);
      router.push(`/workspace/${orgId}/ab-tests`);
    } catch (error) {
      logger.error('Error saving test:', error, { file: 'page.tsx' });
      alert('Failed to save test');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Create A/B Test</h1>
        <div className="bg-gray-900 rounded-lg p-6 mb-4">
          <div className="space-y-4">
            <div><label className="block text-sm font-medium mb-2">Test Name *</label><input type="text" value={test.name} onChange={(e) => setTest({...test, name: e.target.value})} required className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" /></div>
            <div><label className="block text-sm font-medium mb-2">Description</label><textarea value={test.description} onChange={(e) => setTest({...test, description: e.target.value})} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" rows={3} /></div>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => router.back()} className="px-6 py-3 bg-gray-800 rounded-lg hover:bg-gray-700">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{saving ? 'Creating...' : 'Create Test'}</button>
        </div>
      </div>
    </div>
  );
}

