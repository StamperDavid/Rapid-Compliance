'use client';


/**
 * Email Campaigns List
 * Admin page for viewing and managing email campaigns
 */

import { useEffect, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Mail, Plus, Send, Eye, Trash2, Calendar, TrendingUp } from 'lucide-react';
import { getCampaigns, deleteCampaign, type EmailCampaign } from '@/lib/email/campaign-service';
import { usePagination } from '@/hooks/usePagination';
import { logger } from '@/lib/logger/logger';
import type { QueryDocumentSnapshot } from 'firebase/firestore';

export default function EmailCampaignsPage() {
  const router = useRouter();
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);

  // Fetch function with pagination using service layer
  const fetchCampaigns = useCallback(async (lastDoc?: QueryDocumentSnapshot) => {
    return getCampaigns(
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
  } = usePagination<EmailCampaign, QueryDocumentSnapshot>({ fetchFn: fetchCampaigns });

  // Initial load
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleDelete = (campaignId: string) => {
    setConfirmDialog({
      message: 'Delete this campaign?',
      onConfirm: () => {
        void (async () => {
          try {
            await deleteCampaign(campaignId);
            await refresh();
            setConfirmDialog(null);
            setNotification({ message: 'Campaign deleted successfully', type: 'success' });
          } catch (err: unknown) {
            logger.error('Error deleting campaign:', err instanceof Error ? err : new Error(String(err)), { file: 'page.tsx' });
            setConfirmDialog(null);
            setNotification({ message: 'Failed to delete campaign', type: 'error' });
          }
        })();
      },
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      sent: {
        gradient: 'bg-gradient-to-r from-emerald-500/20 to-green-500/20',
        border: 'border-emerald-500/30',
        text: 'text-emerald-300',
        icon: Send
      },
      scheduled: {
        gradient: 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20',
        border: 'border-blue-500/30',
        text: 'text-blue-300',
        icon: Calendar
      },
      draft: {
        gradient: 'bg-gradient-to-r from-gray-500/20 to-slate-500/20',
        border: 'border-gray-500/30',
        text: 'text-gray-300',
        icon: Mail
      }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    const Icon = config.icon;

    return (
      <div className={`px-3 py-1.5 rounded-lg border ${config.gradient} ${config.border} ${config.text} text-xs font-semibold flex items-center gap-1.5`}>
        <Icon className="w-3 h-3" />
        {status}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-black p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-8"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-lg shadow-pink-500/25">
            <Mail className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Email Campaigns</h1>
            <p className="text-gray-400 text-sm mt-1">Create and manage your email marketing campaigns</p>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => router.push(`/email/campaigns/new`)}
          className="px-6 py-3 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-semibold rounded-xl shadow-lg shadow-pink-500/25 flex items-center gap-2 transition-all"
        >
          <Plus className="w-5 h-5" />
          Create Campaign
        </motion.button>
      </motion.div>

      {/* Notification */}
      {notification && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-6 p-3 rounded-lg text-sm ${notification.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}
        >
          <div className="flex items-center justify-between">
            <span>{notification.message}</span>
            <button onClick={() => setNotification(null)} className="ml-2 text-current opacity-60 hover:opacity-100">&times;</button>
          </div>
        </motion.div>
      )}

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6 p-4 bg-red-500/20 backdrop-blur-xl border border-red-500/30 rounded-xl text-red-300"
        >
          {error}
        </motion.div>
      )}

      {/* Empty State */}
      {campaigns.length === 0 && !loading ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-16 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl"
        >
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-pink-500/20 to-rose-500/20 border border-pink-500/30 flex items-center justify-center mx-auto mb-6">
            <Mail className="w-10 h-10 text-pink-400" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No campaigns yet</h3>
          <p className="text-gray-400 mb-6">Create your first email campaign to get started!</p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push(`/email/campaigns/new`)}
            className="px-6 py-3 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-semibold rounded-xl shadow-lg shadow-pink-500/25 inline-flex items-center gap-2 transition-all"
          >
            <Plus className="w-5 h-5" />
            Create Campaign
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
                transition={{ delay: index * 0.05 }}
                whileHover={{ scale: 1.01 }}
                className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Title and Status */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500/20 to-rose-500/20 border border-pink-500/30 flex items-center justify-center group-hover:from-pink-500/30 group-hover:to-rose-500/30 transition-all">
                        <Mail className="w-5 h-5 text-pink-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-white">{campaign.name}</h3>
                      </div>
                      {getStatusBadge(campaign.status)}
                    </div>

                    {/* Subject */}
                    <p className="text-gray-400 mb-4 ml-13">{campaign.subject}</p>

                    {/* Stats */}
                    {campaign.stats && (
                      <div className="flex items-center gap-6 text-sm ml-13">
                        <div className="flex items-center gap-2">
                          <Send className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-400">Sent:</span>
                          <span className="text-white font-semibold">{campaign.stats.sent || 0}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Eye className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-400">Opened:</span>
                          <span className="text-white font-semibold">{campaign.stats.opened || 0}</span>
                          <span className="text-emerald-400 text-xs">({campaign.stats.openRate || 0}%)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-400">Clicked:</span>
                          <span className="text-white font-semibold">{campaign.stats.clicked || 0}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 ml-4">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => router.push(`/email/campaigns/${campaign.id}`)}
                      className="px-4 py-2 bg-blue-500/20 border border-blue-500/30 text-blue-300 rounded-xl hover:bg-blue-500/30 text-sm font-semibold flex items-center gap-2 transition-all"
                    >
                      <Eye className="w-4 h-4" />
                      View
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => void handleDelete(campaign.id)}
                      className="px-4 py-2 bg-red-500/20 border border-red-500/30 text-red-300 rounded-xl hover:bg-red-500/30 text-sm font-semibold flex items-center gap-2 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Pagination */}
          {(hasMore || loading) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-6 flex justify-center"
            >
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => void loadMore()}
                disabled={loading || !hasMore}
                className="px-8 py-3 bg-black/40 backdrop-blur-xl border border-white/10 text-white rounded-xl hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold"
              >
                {loading ? 'Loading...' : hasMore ? `Load More (Showing ${campaigns.length})` : 'All loaded'}
              </motion.button>
            </motion.div>
          )}
        </>
      )}

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface-paper rounded-xl p-6 max-w-md mx-4 border border-border-light shadow-xl">
            <p className="text-text-primary mb-4">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDialog(null)} className="px-4 py-2 rounded-lg text-text-secondary hover:bg-surface-elevated">Cancel</button>
              <button onClick={confirmDialog.onConfirm} className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
