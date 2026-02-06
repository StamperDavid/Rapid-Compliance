'use client';

import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Phone, Plus, Play, Clock, Calendar, User, PhoneCall, Download } from 'lucide-react';
import { FirestoreService } from '@/lib/db/firestore-service';
import { usePagination } from '@/hooks/usePagination';
import { type QueryConstraint, type DocumentData, type QueryDocumentSnapshot, orderBy } from 'firebase/firestore';

interface Call {
  id: string;
  contactName?: string;
  phoneNumber?: string;
  duration?: number;
  status?: string;
  createdAt?: string | number | Date;
  recordingUrl?: string;
}

export default function CallLogPage() {
  const router = useRouter();

  // Fetch function with pagination
  const fetchCalls = useCallback(async (lastDoc?: QueryDocumentSnapshot<DocumentData>): Promise<{
    data: Call[];
    lastDoc: QueryDocumentSnapshot<DocumentData> | null;
    hasMore: boolean;
  }> => {
    const constraints: QueryConstraint[] = [
      orderBy('createdAt', 'desc')
    ];

    const result = await FirestoreService.getAllPaginated(
      `organizations/${DEFAULT_ORG_ID}/workspaces/default/calls`,
      constraints,
      50,
      lastDoc
    );
    return {
      data: result.data as Call[],
      lastDoc: result.lastDoc,
      hasMore: result.hasMore,
    };
  }, []);

  const {
    data: calls,
    loading,
    error,
    hasMore,
    loadMore,
    refresh
  } = usePagination<Call, QueryDocumentSnapshot<DocumentData>>({ fetchFn: fetchCalls });

  // Initial load
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const getStatusBadgeStyles = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 border border-green-500/30';
      case 'missed':
        return 'bg-gradient-to-r from-red-500/20 to-rose-500/20 text-red-400 border border-red-500/30';
      case 'in-progress':
        return 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-400 border border-blue-500/30';
      default:
        return 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 text-yellow-400 border border-yellow-500/30';
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) {
      return '-';
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (timestamp?: string | number | Date) => {
    if (!timestamp) {
      return '-';
    }
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="min-h-screen bg-black p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex justify-between items-center mb-8"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-green-500/25">
            <Phone className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Call Log</h1>
            <p className="text-gray-400 text-sm mt-1">View and manage your call history</p>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => router.push(`/calls/make`)}
          className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-semibold rounded-xl shadow-lg shadow-green-500/25 flex items-center gap-2 transition-all duration-200"
        >
          <Plus className="w-5 h-5" />
          Make Call
        </motion.button>
      </motion.div>

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 backdrop-blur-xl"
        >
          <p className="flex items-center gap-2">
            <span className="text-red-500">⚠</span>
            {error}
          </p>
        </motion.div>
      )}

      {/* Empty State */}
      {calls.length === 0 && !loading ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-12 text-center"
        >
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <PhoneCall className="w-10 h-10 text-green-400" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No calls yet</h3>
          <p className="text-gray-400">Start making calls to see your log here.</p>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden"
        >
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left p-4 text-gray-400 font-semibold text-sm uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Contact
                    </div>
                  </th>
                  <th className="text-left p-4 text-gray-400 font-semibold text-sm uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      Number
                    </div>
                  </th>
                  <th className="text-left p-4 text-gray-400 font-semibold text-sm uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Duration
                    </div>
                  </th>
                  <th className="text-left p-4 text-gray-400 font-semibold text-sm uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left p-4 text-gray-400 font-semibold text-sm uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Date
                    </div>
                  </th>
                  <th className="text-left p-4 text-gray-400 font-semibold text-sm uppercase tracking-wider">
                    Recording
                  </th>
                </tr>
              </thead>
              <tbody>
                {calls.map((call, index) => (
                  <motion.tr
                    key={call.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors duration-200"
                  >
                    <td className="p-4">
                      <span className="font-medium text-white">
                        {call.contactName ?? 'Unknown'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-gray-400 font-mono text-sm">
                        {call.phoneNumber ?? '-'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-gray-400 font-mono text-sm">
                        {formatDuration(call.duration)}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wide ${getStatusBadgeStyles(call.status ?? 'pending')}`}>
                        {call.status ?? 'pending'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-gray-400 text-sm">
                        {formatDate(call.createdAt)}
                      </span>
                    </td>
                    <td className="p-4">
                      {call.recordingUrl ? (
                        <motion.a
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          href={call.recordingUrl}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 hover:from-blue-500/30 hover:to-cyan-500/30 text-blue-400 rounded-lg border border-blue-500/30 transition-all duration-200 text-sm font-medium"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Play className="w-3.5 h-3.5" />
                          Listen
                        </motion.a>
                      ) : (
                        <span className="text-gray-500 text-sm">-</span>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {(hasMore || loading) && (
            <div className="p-6 border-t border-white/5 flex justify-center">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => { void loadMore(); }}
                disabled={loading || !hasMore}
                className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                    />
                    Loading...
                  </span>
                ) : hasMore ? (
                  <span className="flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    Load More ({calls.length} shown)
                  </span>
                ) : (
                  'All calls loaded'
                )}
              </motion.button>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
