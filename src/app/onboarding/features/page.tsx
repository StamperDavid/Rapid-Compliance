'use client';

/**
 * Feature Selection Page — Step 4 of 5
 *
 * The client explicitly tells us which tools they want on their dashboard.
 * Everything defaults to OFF — the client opts in to what they need.
 *
 * Behind the scenes, ALL features are fully configured based on their
 * industry/niche selection (Step 1-2). This page only controls VISIBILITY.
 * If they enable a feature later in Settings, it's already set up — they
 * just need to add any required API keys for that specific tool.
 *
 * On success → /onboarding/setup (API key step).
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useOnboardingStore } from '@/lib/stores/onboarding-store';
import { useAuth } from '@/hooks/useAuth';
import { PLATFORM_ID } from '@/lib/constants/platform';
import type { FeatureModuleId } from '@/types/feature-modules';
import {
  LayoutDashboard,
  ArrowRight,
  Info,
  Users,
  MessageSquare,
  TrendingUp,
  Mail,
  ClipboardList,
  Zap,
  Share2,
  Video,
  FileText,
  ShoppingCart,
  BarChart3,
  Globe,
} from 'lucide-react';

// ─── Feature Groups ──────────────────────────────────────────────────────────
// Organized by what the client cares about, not internal module names.

interface FeatureOption {
  id: FeatureModuleId;
  question: string;
  description: string;
  icon: React.ElementType;
}

interface FeatureGroup {
  title: string;
  subtitle: string;
  features: FeatureOption[];
}

const FEATURE_GROUPS: FeatureGroup[] = [
  {
    title: 'Sales & CRM',
    subtitle: 'Track your leads, deals, and customer relationships',
    features: [
      {
        id: 'crm_pipeline',
        question: 'I need to manage leads, contacts, and sales deals',
        description: 'Full CRM with pipeline tracking, lead scoring, and contact management',
        icon: Users,
      },
      {
        id: 'sales_automation',
        question: 'I want AI-powered sales coaching and playbooks',
        description: 'AI coaching, deal risk alerts, and automated sales playbooks',
        icon: TrendingUp,
      },
      {
        id: 'conversations',
        question: 'I want AI chat to qualify leads and handle inquiries',
        description: '24/7 AI-powered conversations that qualify and route leads',
        icon: MessageSquare,
      },
    ],
  },
  {
    title: 'Marketing & Outreach',
    subtitle: 'Reach your audience across channels',
    features: [
      {
        id: 'email_outreach',
        question: 'I plan to send email campaigns or sales sequences',
        description: 'Email campaigns, drip sequences, and outbound sales tools',
        icon: Mail,
      },
      {
        id: 'social_media',
        question: 'I want to manage and schedule social media posts',
        description: 'Multi-platform posting, scheduling, and social analytics',
        icon: Share2,
      },
      {
        id: 'video_production',
        question: 'I want to create AI-generated marketing videos',
        description: 'AI video creation with avatar cloning, auto-captions, and templates',
        icon: Video,
      },
    ],
  },
  {
    title: 'Commerce & Website',
    subtitle: 'Sell online and build your web presence',
    features: [
      {
        id: 'ecommerce',
        question: 'I will sell products or services through an online store',
        description: 'Product catalog, checkout, order management, and payment processing',
        icon: ShoppingCart,
      },
      {
        id: 'website_builder',
        question: 'I want to build or manage a website from this platform',
        description: 'Page editor, blog, custom domains, SEO, and AI content generation',
        icon: Globe,
      },
    ],
  },
  {
    title: 'Productivity & Automation',
    subtitle: 'Streamline your operations',
    features: [
      {
        id: 'workflows',
        question: 'I want to automate business processes with workflows',
        description: 'Visual workflow builder with triggers, conditions, and multi-step actions',
        icon: Zap,
      },
      {
        id: 'forms_surveys',
        question: 'I need lead capture forms or customer surveys',
        description: 'Form builder, survey creation, and automatic lead capture',
        icon: ClipboardList,
      },
      {
        id: 'proposals_docs',
        question: 'I need to create proposals or sales documents',
        description: 'AI-assisted proposal builder with templates and e-signatures',
        icon: FileText,
      },
      {
        id: 'advanced_analytics',
        question: 'I want detailed analytics and revenue reporting',
        description: 'Revenue dashboards, pipeline forecasting, and attribution reporting',
        icon: BarChart3,
      },
    ],
  },
];

// All module IDs for building the full config
const ALL_MODULE_IDS: FeatureModuleId[] = [
  'crm_pipeline', 'sales_automation', 'conversations', 'email_outreach',
  'social_media', 'video_production', 'ecommerce', 'website_builder',
  'workflows', 'forms_surveys', 'proposals_docs', 'advanced_analytics',
];

export default function FeatureSelectionPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { setStep } = useOnboardingStore();

  // Everything starts OFF — client opts in
  const [enabled, setEnabled] = useState<Record<FeatureModuleId, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const id of ALL_MODULE_IDS) {
      initial[id] = false;
    }
    return initial as Record<FeatureModuleId, boolean>;
  });
  const [saving, setSaving] = useState(false);

  // Guard: must be authenticated
  useEffect(() => {
    if (!user) {
      router.push('/onboarding/industry');
    }
  }, [user, router]);

  const toggle = useCallback((id: FeatureModuleId) => {
    setEnabled((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const enableAll = useCallback(() => {
    setEnabled((prev) => {
      const next = { ...prev };
      for (const id of ALL_MODULE_IDS) { next[id] = true; }
      return next;
    });
  }, []);

  const enabledCount = Object.values(enabled).filter(Boolean).length;

  const handleContinue = async () => {
    setSaving(true);
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase/config');
      if (!db) { throw new Error('Firestore not available'); }
      const configRef = doc(db, `organizations/${PLATFORM_ID}/settings`, 'feature_config');
      await setDoc(configRef, {
        modules: enabled,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.id ?? 'onboarding',
      });

      setStep('apikey');
      router.push('/onboarding/setup');
    } catch {
      // Non-critical — feature config can be adjusted later in Settings
      setStep('apikey');
      router.push('/onboarding/setup');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-indigo-950/30 to-gray-950 flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mb-4">
            <LayoutDashboard className="w-7 h-7 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            What tools do you need?
          </h1>
          <p className="text-gray-400 text-sm max-w-lg mx-auto">
            Tell us which features you want on your dashboard. We&apos;ll set everything up
            based on your industry — you&apos;re just choosing what to show.
            You can turn any feature on or off later in Settings.
          </p>

          {/* Progress: 4/5 */}
          <div className="flex items-center justify-center gap-2 mt-6">
            <div className="w-10 h-1.5 rounded-full bg-indigo-500" />
            <div className="w-10 h-1.5 rounded-full bg-indigo-500" />
            <div className="w-10 h-1.5 rounded-full bg-indigo-500" />
            <div className="w-10 h-1.5 rounded-full bg-indigo-500" />
            <div className="w-10 h-1.5 rounded-full bg-white/10" />
          </div>

          {/* Enable All shortcut */}
          <button
            onClick={enableAll}
            className="mt-4 text-xs text-indigo-400 hover:text-indigo-300 transition-colors underline underline-offset-2"
          >
            Enable all features
          </button>
        </motion.div>

        {/* Feature Groups */}
        <div className="space-y-6">
          {FEATURE_GROUPS.map((group, groupIndex) => (
            <motion.div
              key={group.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 * groupIndex }}
            >
              {/* Group Header */}
              <div className="mb-3 px-1">
                <h2 className="text-sm font-semibold text-white">{group.title}</h2>
                <p className="text-xs text-gray-500">{group.subtitle}</p>
              </div>

              {/* Feature Cards */}
              <div className="backdrop-blur-md bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden divide-y divide-white/5">
                {group.features.map((feature) => {
                  const isOn = enabled[feature.id];
                  const Icon = feature.icon;

                  return (
                    <button
                      key={feature.id}
                      onClick={() => toggle(feature.id)}
                      className={`w-full flex items-center gap-4 p-4 text-left transition-all ${
                        isOn
                          ? 'bg-indigo-500/[0.08]'
                          : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      {/* Icon */}
                      <div
                        className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                          isOn
                            ? 'bg-indigo-500/20 text-indigo-400'
                            : 'bg-white/5 text-gray-600'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium transition-colors ${isOn ? 'text-white' : 'text-gray-300'}`}>
                          {feature.question}
                        </p>
                        <p className="text-xs text-gray-600 mt-0.5">
                          {feature.description}
                        </p>
                      </div>

                      {/* Toggle */}
                      <div
                        className={`flex-shrink-0 w-11 h-6 rounded-full flex items-center px-0.5 transition-colors ${
                          isOn ? 'bg-indigo-500' : 'bg-white/10'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full transition-all flex items-center justify-center ${
                            isOn
                              ? 'translate-x-5 bg-white'
                              : 'translate-x-0 bg-gray-600'
                          }`}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Info banner */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex items-start gap-2.5 mt-5 px-1"
        >
          <Info className="w-4 h-4 text-indigo-400/60 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-gray-500 leading-relaxed">
            <span className="text-gray-400 font-medium">{enabledCount} of {ALL_MODULE_IDS.length} features enabled.</span>{' '}
            Features you don&apos;t select are hidden from your dashboard but still fully
            configured. Turn them on anytime from <span className="text-indigo-400">Settings</span> —
            you&apos;ll just need to add the API key for that tool.
          </p>
        </motion.div>

        {/* Continue */}
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
                Saving preferences...
              </>
            ) : (
              <>
                {enabledCount === 0 ? 'Skip for now' : 'Continue to Setup'}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
          {enabledCount === 0 && (
            <p className="text-center text-xs text-gray-600 mt-2">
              You can enable features later from your dashboard settings.
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
