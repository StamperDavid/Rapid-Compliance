'use client';

import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FirestoreService } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';

interface ABTestVariant {
  name: string;
  config: Record<string, unknown>;
  impressions?: number;
  conversions?: number;
}

interface ABTest {
  id: string;
  name: string;
  description: string;
  status: string;
  variants?: ABTestVariant[];
  winner?: string;
  createdAt: unknown;
}

export default function ABTestResultsPage() {
  const params = useParams();
  const router = useRouter();
  const testId = params.id as string;
  const [test, setTest] = useState<ABTest | null>(null);
  const [loading, setLoading] = useState(true);

  const loadTest = useCallback(async () => {
    try {
      const data = await FirestoreService.get(`organizations/${DEFAULT_ORG_ID}/abTests`, testId);
      setTest(data as ABTest);
    } catch (error: unknown) {
      logger.error('Error loading test:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    } finally {
      setLoading(false);
    }
  }, [testId]);

  useEffect(() => {
    void loadTest();
  }, [loadTest]);

  if (loading || !test) {return <div className="p-8">Loading...</div>;}

  return (
    <div className="p-8">
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-primary hover:from-primary-light hover:to-secondary-light mb-4">← Back</button>
        <h1 className="text-3xl font-bold mb-2">{test.name}</h1>
        <p className="text-[var(--color-text-secondary)]">{test.description}</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {test.variants?.map((variant, idx: number) => {
          const impressions = variant.impressions ?? 0;
          const conversions = variant.conversions ?? 0;
          const conversionRate = impressions > 0 ? ((conversions / impressions) * 100).toFixed(2) : '0';

          return (
            <div key={idx} className="bg-surface-paper rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">Variant {variant.name}</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">Impressions</span><span className="font-semibold">{impressions}</span></div>
                <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">Conversions</span><span className="font-semibold text-success">{conversions}</span></div>
                <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">Conversion Rate</span><span className="font-semibold">{conversionRate}%</span></div>
              </div>
            </div>
          );
        })}
      </div>
      {test.winner && <div className="mt-6 border rounded-lg p-4 text-center" style={{ backgroundColor: 'rgba(var(--color-success-rgb), 0.1)', borderColor: 'rgba(var(--color-success-rgb), 0.2)' }}><div className="text-success font-semibold">🏆 Winner: Variant {test.winner}</div></div>}
    </div>
  );
}




