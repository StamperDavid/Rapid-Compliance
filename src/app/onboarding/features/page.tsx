'use client';

/**
 * Feature Selection Page — Step 4 of 5
 *
 * Lets the client explicitly choose which platform features they want enabled.
 * Pre-filled from industry defaults. Disabled features are hidden from the
 * dashboard but can be re-enabled anytime in Settings > Features.
 *
 * On success → /onboarding/setup (API key step).
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useOnboardingStore } from '@/lib/stores/onboarding-store';
import { useAuth } from '@/hooks/useAuth';
import { PLATFORM_ID } from '@/lib/constants/platform';
import {
  FEATURE_MODULES,
  getIndustryFeatureConfig,
} from '@/lib/constants/feature-modules';
import type { FeatureModuleId } from '@/types/feature-modules';
import {
  Settings2,
  Check,
  ArrowRight,
  Info,
  Users,
  MessageSquare,
  GraduationCap,
  Send,
  ClipboardList,
  Workflow,
  Share2,
  Video,
  FileText,
  ShoppingCart,
  BarChart3,
  Globe,
} from 'lucide-react';

// Map icon names to components
const ICON_MAP: Record<string, React.ElementType> = {
  Users,
  MessageSquare,
  GraduationCap,
  Send,
  ClipboardList,
  Workflow,
  Share2,
  Video,
  FileText,
  ShoppingCart,
  BarChart3,
  Globe,
};

// Client-friendly questions per feature module
const FEATURE_QUESTIONS: Record<string, string> = {
  crm_pipeline: 'Do you need to track leads, contacts, and deals?',
  conversations: 'Do you want AI-powered chat for customer conversations?',
  sales_automation: 'Do you want AI coaching and sales playbooks for your team?',
  email_outreach: 'Do you plan to send email campaigns or sales sequences?',
  forms_surveys: 'Do you need lead capture forms or customer surveys?',
  workflows: 'Do you want to automate business processes with workflows?',
  social_media: 'Do you plan to manage social media from this platform?',
  video_production: 'Do you want to create AI-generated marketing videos?',
  proposals_docs: 'Do you need to create proposals or sales documents?',
  ecommerce: 'Will you sell products or services online through a storefront?',
  advanced_analytics: 'Do you want advanced analytics and revenue reporting?',
  website_builder: 'Do you plan to build or manage a website from this platform?',
};

export default function FeatureSelectionPage() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    selectedCategory,
    selectedIndustry,
    setStep,
  } = useOnboardingStore();

  const [modules, setModules] = useState<Record<FeatureModuleId, boolean>>(() => {
    // Pre-fill from industry defaults
    const categoryId = selectedCategory?.id ?? selectedIndustry?.id ?? '';
    const config = getIndustryFeatureConfig(categoryId);
    return config.modules;
  });
  const [saving, setSaving] = useState(false);

  // Guard: must be authenticated
  useEffect(() => {
    if (!user) {
      router.push('/onboarding/industry');
    }
  }, [user, router]);

  const toggleModule = useCallback((id: FeatureModuleId) => {
    setModules((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const enabledCount = Object.values(modules).filter(Boolean).length;

  const handleContinue = async () => {
    setSaving(true);
    try {
      // Save feature config to Firestore via the client SDK
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase/config');
      if (!db) { throw new Error('Firestore not available'); }
      const configRef = doc(db, `organizations/${PLATFORM_ID}/settings`, 'feature_config');
      await setDoc(configRef, {
        modules,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.id ?? 'onboarding',
      });

      setStep('apikey');
      router.push('/onboarding/setup');
    } catch {
      // Non-critical — feature config can be set later in settings
      setStep('apikey');
      router.push('/onboarding/setup');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-indigo-950/30 to-gray-950 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mb-4">
            <Settings2 className="w-7 h-7 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Choose Your Features
          </h1>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            Select the tools you plan to use. Disabled features are hidden from your
            dashboard to keep things clean — you can always enable them later in{' '}
            <span className="text-indigo-400">Settings &rarr; Features</span>.
          </p>

          {/* Progress: 4/5 */}
          <div className="flex items-center justify-center gap-2 mt-6">
            <div className="w-10 h-1.5 rounded-full bg-indigo-500" />
            <div className="w-10 h-1.5 rounded-full bg-indigo-500" />
            <div className="w-10 h-1.5 rounded-full bg-indigo-500" />
            <div className="w-10 h-1.5 rounded-full bg-indigo-500" />
            <div className="w-10 h-1.5 rounded-full bg-white/10" />
          </div>
        </motion.div>

        {/* Feature Toggles */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-6 space-y-1"
        >
          {FEATURE_MODULES.map((mod, index) => {
            const IconComponent = ICON_MAP[mod.icon] ?? Settings2;
            const isEnabled = modules[mod.id];
            const question = FEATURE_QUESTIONS[mod.id] ?? `Enable ${mod.label}?`;

            return (
              <motion.button
                key={mod.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.05 * index }}
                onClick={() => toggleModule(mod.id)}
                className={`w-full flex items-center gap-4 p-3.5 rounded-xl transition-all text-left group ${
                  isEnabled
                    ? 'bg-indigo-500/10 border border-indigo-500/20'
                    : 'bg-white/[0.02] border border-transparent hover:bg-white/[0.04]'
                }`}
              >
                {/* Icon */}
                <div
                  className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
                    isEnabled
                      ? 'bg-indigo-500/20 text-indigo-400'
                      : 'bg-white/5 text-gray-500'
                  }`}
                >
                  <IconComponent className="w-4.5 h-4.5" />
                </div>

                {/* Question */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium ${
                      isEnabled ? 'text-white' : 'text-gray-400'
                    }`}
                  >
                    {question}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5 truncate">
                    {mod.description}
                  </p>
                </div>

                {/* Toggle indicator */}
                <div
                  className={`flex-shrink-0 w-10 h-6 rounded-full flex items-center transition-colors ${
                    isEnabled ? 'bg-indigo-500 justify-end' : 'bg-white/10 justify-start'
                  }`}
                >
                  <div
                    className={`w-4.5 h-4.5 rounded-full mx-0.5 transition-colors flex items-center justify-center ${
                      isEnabled ? 'bg-white' : 'bg-gray-600'
                    }`}
                  >
                    {isEnabled && <Check className="w-3 h-3 text-indigo-600" />}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </motion.div>

        {/* Info banner */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex items-start gap-2 mt-4 px-2"
        >
          <Info className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-gray-500">
            {enabledCount} of {FEATURE_MODULES.length} features enabled.
            This only affects your dashboard layout — nothing is permanently removed.
            Re-enable any feature anytime from Settings.
          </p>
        </motion.div>

        {/* Continue button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mt-6"
        >
          <button
            onClick={() => { void handleContinue(); }}
            disabled={saving}
            className="w-full py-3.5 px-6 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                Continue to Setup
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </motion.div>
      </div>
    </div>
  );
}
