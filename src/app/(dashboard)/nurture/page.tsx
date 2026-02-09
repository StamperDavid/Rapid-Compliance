'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Heart,
  Plus,
  TrendingUp,
  Users,
  AlertCircle,
  BarChart3,
  Edit3,
  Layers
} from 'lucide-react';
import { getNurtureCampaigns, type NurtureCampaign } from '@/lib/outbound/nurture-service';
import { usePagination } from '@/hooks/usePagination';
import type { QueryDocumentSnapshot } from 'firebase/firestore';

export default function NurtureCampaignsPage() {
  const router = useRouter();

  // Fetch function with pagination using service layer
  const fetchCampaigns = useCallback(async (lastDoc?: QueryDocumentSnapshot) => {
    return getNurtureCampaigns(
      undefined,
      { pageSize: 50, lastDoc }
    );
  }, []);

  const {
    data: campaigns,
    loading,
    error,
    hasMore,
    loadMore,
    refresh
  } = usePagination<NurtureCampaign, QueryDocumentSnapshot>({ fetchFn: fetchCampaigns });

  // Initial load
  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="min-h-screen bg-surface-main p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex justify-between items-center mb-8"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/25">
            <Heart className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Lead Nurture Campaigns</h1>
            <p className="text-[var(--color-text-secondary)] text-sm mt-1">Automate your lead engagement sequences</p>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => router.push(`/nurture/new`)}
          className="px-6 py-3 bg-gradient-to-r from-primary to-secondary hover:from-primary-light hover:to-secondary-light text-white font-semibold rounded-xl shadow-lg shadow-primary/25 flex items-center gap-2 transition-all duration-200"
        >
          <Plus className="w-5 h-5" />
          Create Campaign
        </motion.button>
      </motion.div>

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 backdrop-blur-xl border rounded-xl flex items-start gap-3"
          style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
        >
          <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
          <p className="text-error">{error}</p>
        </motion.div>
      )}

      {/* Empty State */}
      {campaigns.length === 0 && !loading ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center py-20 bg-surface-paper backdrop-blur-xl border border-border-light rounded-2xl"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center border border-primary/30">
            <Heart className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">No Nurture Campaigns Yet</h3>
          <p className="text-[var(--color-text-secondary)] mb-8 max-w-md mx-auto">
            Create your first automated nurture sequence to engage and convert your leads over time.
          </p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push(`/nurture/new`)}
            className="px-8 py-3 bg-gradient-to-r from-primary to-secondary hover:from-primary-light hover:to-secondary-light text-white font-semibold rounded-xl shadow-lg shadow-primary/25 inline-flex items-center gap-2 transition-all duration-200"
          >
            <Plus className="w-5 h-5" />
            Create Your First Campaign
          </motion.button>
        </motion.div>
      ) : (
        <>
          {/* Campaigns Grid */}
          <div className="grid gap-4">
            {campaigns.map((campaign, index) => (
              <motion.div
                key={campaign.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                whileHover={{ scale: 1.01 }}
                className="bg-surface-paper backdrop-blur-xl border border-border-light rounded-2xl p-6 hover:border-border-strong transition-all duration-300"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Campaign Header */}
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-xl font-semibold text-[var(--color-text-primary)]">{campaign.name}</h3>
                      <span
                        className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                          campaign.status === 'active'
                            ? 'bg-gradient-to-r from-emerald-500/20 to-green-500/20 text-emerald-300 border border-emerald-500/30'
                            : campaign.status === 'paused'
                            ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-gradient-to-r from-gray-500/20 to-slate-500/20 text-gray-300 border border-gray-500/30'
                        }`}
                      >
                        {campaign.status}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-[var(--color-text-secondary)] mb-4 leading-relaxed">{campaign.description}</p>

                    {/* Stats */}
                    <div className="flex flex-wrap gap-6 text-sm">
                      <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                          <Layers className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <span className="font-semibold text-[var(--color-text-primary)]">{campaign.steps?.length || 0}</span>
                          <span className="text-[var(--color-text-secondary)] ml-1">steps</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                        <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center border border-secondary/20">
                          <Users className="w-4 h-4 text-secondary" />
                        </div>
                        <div>
                          <span className="font-semibold text-[var(--color-text-primary)]">{campaign.enrolled ?? 0}</span>
                          <span className="text-[var(--color-text-secondary)] ml-1">leads enrolled</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 ml-4">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => router.push(`/nurture/${campaign.id}`)}
                      className="px-4 py-2 bg-gradient-to-r from-primary to-secondary hover:from-primary-light hover:to-secondary-light text-white font-semibold rounded-xl shadow-lg shadow-primary/25 flex items-center gap-2 transition-all duration-200"
                    >
                      <Edit3 className="w-4 h-4" />
                      Edit
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => router.push(`/nurture/${campaign.id}/stats`)}
                      className="px-4 py-2 bg-surface-elevated hover:bg-surface-elevated border border-border-light text-[var(--color-text-primary)] font-semibold rounded-xl flex items-center gap-2 transition-all duration-200"
                    >
                      <BarChart3 className="w-4 h-4" />
                      Stats
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Load More Button */}
          {(hasMore || loading) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-8 flex justify-center"
            >
              <motion.button
                whileHover={{ scale: loading || !hasMore ? 1 : 1.02 }}
                whileTap={{ scale: loading || !hasMore ? 1 : 0.98 }}
                onClick={() => void loadMore()}
                disabled={loading || !hasMore}
                className="px-8 py-3 bg-surface-elevated hover:bg-surface-elevated border border-border-light text-[var(--color-text-primary)] font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-[var(--color-text-secondary)] border-t-[var(--color-text-primary)] rounded-full animate-spin" />
                    Loading...
                  </>
                ) : hasMore ? (
                  <>
                    <TrendingUp className="w-5 h-5" />
                    Load More ({campaigns.length} shown)
                  </>
                ) : (
                  'All Campaigns Loaded'
                )}
              </motion.button>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
