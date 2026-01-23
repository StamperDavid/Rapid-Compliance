'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FirestoreService } from '@/lib/db/firestore-service';
import { Timestamp } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';
import { showErrorToast } from '@/components/ErrorToast';

export default function NewFineTuningPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const [job, setJob] = useState({ modelName: '', baseModel: 'gpt-3.5-turbo', datasetId: '' });
  const [creating, setCreating] = useState(false);

  const handleSubmit = async () => {
    try {
      setCreating(true);
      const jobId = `finetune-${Date.now()}`;
      await FirestoreService.set(`organizations/${orgId}/fineTuningJobs`, jobId, { ...job, id: jobId, status: 'pending', createdAt: Timestamp.now() }, false);
      router.push(`/workspace/${orgId}/ai/fine-tuning`);
    } catch (error: unknown) {
      logger.error('Error creating job:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      showErrorToast(error, 'Failed to create fine-tuning job');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Start Fine-Tuning</h1>
        <div className="bg-gray-900 rounded-lg p-6 mb-4">
          <div className="space-y-4">
            <div><label className="block text-sm font-medium mb-2">Model Name *</label><input type="text" value={job.modelName} onChange={(e) => setJob({...job, modelName: e.target.value})} required className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" /></div>
            <div><label className="block text-sm font-medium mb-2">Base Model</label><select value={job.baseModel} onChange={(e) => setJob({...job, baseModel: e.target.value})} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg"><option value="gpt-3.5-turbo">GPT-3.5 Turbo</option><option value="gpt-4">GPT-4</option><option value="claude-3-opus">Claude 3 Opus</option></select></div>
            <div><label className="block text-sm font-medium mb-2">Dataset</label><input type="text" value={job.datasetId} onChange={(e) => setJob({...job, datasetId: e.target.value})} placeholder="Dataset ID" className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" /></div>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => router.back()} className="px-6 py-3 bg-gray-800 rounded-lg hover:bg-gray-700">Cancel</button>
          <button onClick={() => void handleSubmit()} disabled={creating} className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{creating ? 'Starting...' : 'Start Fine-Tuning'}</button>
        </div>
      </div>
    </div>
  );
}




