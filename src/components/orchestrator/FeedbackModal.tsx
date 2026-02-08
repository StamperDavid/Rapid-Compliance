'use client';

/**
 * Feedback Modal - Dual-Path Support & Feature Request Engine
 *
 * Provides a categorized intake system for:
 * - Path A: Support Tickets (Title, Severity, Description)
 * - Path B: Feature Requests (Feature Name, Business Impact)
 *
 * Data is routed to Firestore for Admin Orchestrator visibility.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useOrchestratorStore,
  type FeedbackPath,
} from '@/lib/stores/orchestrator-store';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import {
  X,
  HelpCircle,
  Lightbulb,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Send,
  ArrowLeft,
} from 'lucide-react';
import { PLATFORM_ID } from '@/lib/constants/platform';

interface FeedbackModalProps {
  userId?: string;
  userEmail?: string;
}

const SEVERITY_OPTIONS = [
  { value: 'low', label: 'Low', icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/20', description: 'Minor issue, workaround available' },
  { value: 'high', label: 'High', icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/20', description: 'Significant impact on workflow' },
  { value: 'critical', label: 'Critical', icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/20', description: 'Blocking issue, needs immediate attention' },
] as const;

export function FeedbackModal({ userId, userEmail }: FeedbackModalProps) {
  const {
    feedbackModalOpen,
    feedbackPath,
    pendingSupportTicket,
    pendingFeatureRequest,
    closeFeedbackModal,
    setFeedbackPath,
    updateSupportTicket,
    updateFeatureRequest,
    resetFeedbackForms,
  } = useOrchestratorStore();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmitSupport = async () => {
    if (!pendingSupportTicket.title || !pendingSupportTicket.severity || !pendingSupportTicket.description) {
      setError('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (!db) {
        throw new Error('Database not initialized');
      }
      const ticketId = `ticket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await setDoc(doc(db, 'organizations', PLATFORM_ID, 'support_tickets', ticketId), {
        ...pendingSupportTicket,
        status: 'open',
        userId: userId ?? null,
        userEmail: userEmail ?? null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setSubmitSuccess(true);
      setTimeout(() => {
        resetFeedbackForms();
        closeFeedbackModal();
        setSubmitSuccess(false);
      }, 2000);
    } catch (err) {
      console.error('Error submitting support ticket:', err);
      setError('Failed to submit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitFeature = async () => {
    if (!pendingFeatureRequest.featureName || !pendingFeatureRequest.businessImpact) {
      setError('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (!db) {
        throw new Error('Database not initialized');
      }
      const requestId = `feature_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await setDoc(doc(db, 'organizations', PLATFORM_ID, 'feature_requests', requestId), {
        ...pendingFeatureRequest,
        status: 'pending',
        votes: 0,
        userId: userId ?? null,
        userEmail: userEmail ?? null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setSubmitSuccess(true);
      setTimeout(() => {
        resetFeedbackForms();
        closeFeedbackModal();
        setSubmitSuccess(false);
      }, 2000);
    } catch (err) {
      console.error('Error submitting feature request:', err);
      setError('Failed to submit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    setFeedbackPath(null as unknown as FeedbackPath);
    setError(null);
  };

  if (!feedbackModalOpen) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeFeedbackModal}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg backdrop-blur-xl bg-black/40 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-indigo-600/10 to-purple-600/10">
            <div className="flex items-center gap-3">
              {feedbackPath && (
                <button
                  onClick={handleBack}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 text-gray-400" />
                </button>
              )}
              <h2 className="text-lg font-semibold text-white">
                {!feedbackPath && 'How can we help?'}
                {feedbackPath === 'support' && 'Submit Support Ticket'}
                {feedbackPath === 'feature' && 'Request a Feature'}
              </h2>
            </div>
            <button
              onClick={closeFeedbackModal}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Success State */}
            {submitSuccess && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center py-8"
              >
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Thank you!</h3>
                <p className="text-gray-400 text-center">
                  {feedbackPath === 'support'
                    ? 'Your support ticket has been submitted. We\'ll get back to you soon.'
                    : 'Your feature request has been recorded. We appreciate your feedback!'}
                </p>
              </motion.div>
            )}

            {/* Path Selection */}
            {!feedbackPath && !submitSuccess && (
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setFeedbackPath('support')}
                  className="group p-6 rounded-xl bg-white/5 border border-white/10 hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all text-left"
                >
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <HelpCircle className="w-6 h-6 text-indigo-400" />
                  </div>
                  <h3 className="text-white font-semibold mb-2">Support Ticket</h3>
                  <p className="text-gray-400 text-sm">
                    Report an issue or get help with a problem you&apos;re experiencing.
                  </p>
                </button>

                <button
                  onClick={() => setFeedbackPath('feature')}
                  className="group p-6 rounded-xl bg-white/5 border border-white/10 hover:border-purple-500/50 hover:bg-purple-500/10 transition-all text-left"
                >
                  <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Lightbulb className="w-6 h-6 text-purple-400" />
                  </div>
                  <h3 className="text-white font-semibold mb-2">Feature Request</h3>
                  <p className="text-gray-400 text-sm">
                    Suggest a new feature or improvement to help us build better.
                  </p>
                </button>
              </div>
            )}

            {/* Support Ticket Form */}
            {feedbackPath === 'support' && !submitSuccess && (
              <div className="space-y-5">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Title <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={pendingSupportTicket.title ?? ''}
                    onChange={(e) => updateSupportTicket({ title: e.target.value })}
                    placeholder="Brief description of the issue"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                  />
                </div>

                {/* Severity */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Severity <span className="text-red-400">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {SEVERITY_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateSupportTicket({ severity: option.value })}
                        className={`p-3 rounded-xl border transition-all ${
                          pendingSupportTicket.severity === option.value
                            ? `${option.bg} border-current ${option.color}`
                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <option.icon className={`w-5 h-5 mx-auto mb-1 ${pendingSupportTicket.severity === option.value ? option.color : 'text-gray-400'}`} />
                        <span className={`text-sm font-medium ${pendingSupportTicket.severity === option.value ? 'text-white' : 'text-gray-300'}`}>
                          {option.label}
                        </span>
                      </button>
                    ))}
                  </div>
                  {pendingSupportTicket.severity && (
                    <p className="mt-2 text-xs text-gray-500">
                      {SEVERITY_OPTIONS.find((o) => o.value === pendingSupportTicket.severity)?.description}
                    </p>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={pendingSupportTicket.description ?? ''}
                    onChange={(e) => updateSupportTicket({ description: e.target.value })}
                    placeholder="Describe the issue in detail. Include steps to reproduce if applicable."
                    rows={4}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 resize-none"
                  />
                </div>

                {/* Error */}
                {error && (
                  <p className="text-sm text-red-400">{error}</p>
                )}

                {/* Submit */}
                <button
                  onClick={() => void handleSubmitSupport()}
                  disabled={isSubmitting}
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Submit Ticket
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Feature Request Form */}
            {feedbackPath === 'feature' && !submitSuccess && (
              <div className="space-y-5">
                {/* Feature Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Feature Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={pendingFeatureRequest.featureName ?? ''}
                    onChange={(e) => updateFeatureRequest({ featureName: e.target.value })}
                    placeholder="What feature would you like to see?"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50"
                  />
                </div>

                {/* Business Impact */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Business Impact <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={pendingFeatureRequest.businessImpact ?? ''}
                    onChange={(e) => updateFeatureRequest({ businessImpact: e.target.value })}
                    placeholder="How would this feature help your business? What problem does it solve?"
                    rows={4}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 resize-none"
                  />
                </div>

                {/* Error */}
                {error && (
                  <p className="text-sm text-red-400">{error}</p>
                )}

                {/* Submit */}
                <button
                  onClick={() => void handleSubmitFeature()}
                  disabled={isSubmitting}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Lightbulb className="w-4 h-4" />
                      Submit Request
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default FeedbackModal;
