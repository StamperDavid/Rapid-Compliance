'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { ABTest, ABTestResults } from '@/lib/email/email-builder';

export default function ABTestsPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const [tests, setTests] = useState<(ABTest & { results?: ABTestResults })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTests();
  }, []);

  const loadTests = async () => {
    try {
      const response = await fetch('/api/email/ab-tests');
      const data = await response.json();
      if (data.success) {
        setTests(data.data);
      }
    } catch (error) {
      console.error('Error loading A/B tests:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPercentage = (value: number) => `${value.toFixed(1)  }%`;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">A/B Tests</h1>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          + New A/B Test
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {tests.map(test => (
            <div key={test.id} className="bg-gray-900 rounded-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold mb-1">{test.name}</h3>
                  <div className="text-sm text-gray-400">
                    Testing: {test.testType.replace('_', ' ')} • 
                    Metric: {test.winnerMetric.replace('_', ' ')}
                  </div>
                </div>
                <span className={`px-3 py-1 rounded text-sm font-medium ${
                  test.status === 'running' ? 'bg-green-900 text-green-300' :
                  test.status === 'completed' ? 'bg-blue-900 text-blue-300' :
                  'bg-gray-700 text-gray-300'
                }`}>
                  {test.status}
                </span>
              </div>

              {test.results && (
                <div className="grid grid-cols-2 gap-6">
                  {/* Variant A */}
                  <div className={`bg-gray-800 rounded-lg p-4 ${test.results.winner === 'A' ? 'border-2 border-green-500' : ''}`}>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold">Variant A: {test.variantA.name}</h4>
                      {test.results.winner === 'A' && <span className="text-green-400 font-bold">🏆 WINNER</span>}
                    </div>
                    {test.testType === 'subject' && (
                      <div className="text-sm mb-3 p-2 bg-gray-900 rounded">
                        Subject: {test.variantA.subject}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-gray-400">Sent</div>
                        <div className="text-xl font-bold">{test.results.variantA.sent}</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Opens</div>
                        <div className="text-xl font-bold">{formatPercentage(test.results.variantA.openRate)}</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Clicks</div>
                        <div className="text-xl font-bold">{formatPercentage(test.results.variantA.clickRate)}</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Replies</div>
                        <div className="text-xl font-bold">{formatPercentage(test.results.variantA.replyRate)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Variant B */}
                  <div className={`bg-gray-800 rounded-lg p-4 ${test.results.winner === 'B' ? 'border-2 border-green-500' : ''}`}>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold">Variant B: {test.variantB.name}</h4>
                      {test.results.winner === 'B' && <span className="text-green-400 font-bold">🏆 WINNER</span>}
                    </div>
                    {test.testType === 'subject' && (
                      <div className="text-sm mb-3 p-2 bg-gray-900 rounded">
                        Subject: {test.variantB.subject}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-gray-400">Sent</div>
                        <div className="text-xl font-bold">{test.results.variantB.sent}</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Opens</div>
                        <div className="text-xl font-bold">{formatPercentage(test.results.variantB.openRate)}</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Clicks</div>
                        <div className="text-xl font-bold">{formatPercentage(test.results.variantB.clickRate)}</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Replies</div>
                        <div className="text-xl font-bold">{formatPercentage(test.results.variantB.replyRate)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {test.results && (
                <div className="mt-4 p-4 bg-blue-900/20 border border-blue-600 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">📊 {test.results.recommendation}</div>
                      <div className="text-sm text-gray-400 mt-1">
                        Statistical confidence: {test.results.confidence}%
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {tests.length === 0 && !loading && (
            <div className="text-center py-12 text-gray-400">
              No A/B tests yet. Create one to optimize your email performance.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

