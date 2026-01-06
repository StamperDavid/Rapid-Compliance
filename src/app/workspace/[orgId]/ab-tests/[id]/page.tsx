'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FirestoreService } from '@/lib/db/firestore-service'
import { logger } from '@/lib/logger/logger';;

export default function ABTestResultsPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const testId = params.id as string;
  const [test, setTest] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTest();
  }, []);

  const loadTest = async () => {
    try {
      const data = await FirestoreService.get(`organizations/${orgId}/abTests`, testId);
      setTest(data);
    } catch (error) {
      logger.error('Error loading test:', error, { file: 'page.tsx' });
    } finally {
      setLoading(false);
    }
  };

  if (loading || !test) {return <div className="p-8">Loading...</div>;}

  return (
    <div className="p-8">
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-blue-400 hover:text-blue-300 mb-4">← Back</button>
        <h1 className="text-3xl font-bold mb-2">{test.name}</h1>
        <p className="text-gray-400">{test.description}</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {test.variants?.map((variant: any, idx: number) => (
          <div key={idx} className="bg-gray-900 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Variant {variant.name}</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Impressions</span><span className="font-semibold">{variant.impressions || 0}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Conversions</span><span className="font-semibold text-green-400">{variant.conversions || 0}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Conversion Rate</span><span className="font-semibold">{variant.impressions > 0 ? ((variant.conversions / variant.impressions) * 100).toFixed(2) : 0}%</span></div>
            </div>
          </div>
        ))}
      </div>
      {test.winner && <div className="mt-6 bg-green-900/20 border border-green-900 rounded-lg p-4 text-center"><div className="text-green-400 font-semibold">🏆 Winner: Variant {test.winner}</div></div>}
    </div>
  );
}




