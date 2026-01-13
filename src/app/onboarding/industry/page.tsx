'use client';

/**
 * Industry Selection Page
 *
 * First step of the onboarding flow - users select their industry
 * before creating an account. This provides context for AI agent training.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  useOnboardingStore,
  INDUSTRIES,
  type IndustryOption,
} from '@/lib/stores/onboarding-store';

export default function IndustrySelectionPage() {
  const router = useRouter();
  const { selectedIndustry, setIndustry, setCustomIndustry, setStep } = useOnboardingStore();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const handleSelectIndustry = (industry: IndustryOption) => {
    if (industry.id === 'other') {
      setShowCustomInput(true);
      setIndustry(industry);
    } else {
      setIndustry(industry);
      setShowCustomInput(false);
      // Auto-advance after selection
      setTimeout(() => {
        setStep('account');
        router.push('/onboarding/account');
      }, 300);
    }
  };

  const handleCustomContinue = () => {
    if (customInput.trim()) {
      setCustomIndustry(customInput.trim());
      setStep('account');
      router.push('/onboarding/account');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-5" />

      {/* Content */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <Link href="/" className="inline-block mb-8">
            <span className="text-2xl font-bold text-white">
              Sales<span className="text-indigo-400">Velocity</span>
            </span>
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              What's your industry?
            </h1>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Help us tailor your AI sales agent to speak the language of your business.
              This takes less than a minute.
            </p>
          </motion.div>

          {/* Progress indicator */}
          <div className="flex items-center justify-center gap-2 mt-8">
            <div className="w-8 h-2 rounded-full bg-indigo-500" />
            <div className="w-8 h-2 rounded-full bg-slate-700" />
            <div className="w-8 h-2 rounded-full bg-slate-700" />
          </div>
        </div>

        {/* Industry Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4"
        >
          {INDUSTRIES.map((industry, index) => (
            <motion.button
              key={industry.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: index * 0.03 }}
              onClick={() => handleSelectIndustry(industry)}
              onMouseEnter={() => setHoveredId(industry.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={`
                relative group p-6 rounded-2xl border-2 transition-all duration-300
                ${selectedIndustry?.id === industry.id
                  ? 'border-indigo-500 bg-indigo-500/20 scale-105'
                  : 'border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800'
                }
              `}
            >
              {/* Selection indicator */}
              {selectedIndustry?.id === industry.id && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center"
                >
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </motion.div>
              )}

              {/* Icon */}
              <div
                className="text-4xl mb-3 transition-transform duration-300 group-hover:scale-110"
                style={{
                  filter: hoveredId === industry.id ? `drop-shadow(0 0 8px ${industry.color}40)` : 'none',
                }}
              >
                {industry.icon}
              </div>

              {/* Name */}
              <h3 className="text-white font-semibold text-sm mb-1">
                {industry.name}
              </h3>

              {/* Description (visible on hover) */}
              <p className={`
                text-xs text-slate-400 transition-opacity duration-300
                ${hoveredId === industry.id ? 'opacity-100' : 'opacity-0 lg:opacity-70'}
              `}>
                {industry.description}
              </p>

              {/* Color accent bar */}
              <div
                className="absolute bottom-0 left-0 right-0 h-1 rounded-b-2xl transition-opacity duration-300"
                style={{
                  backgroundColor: industry.color,
                  opacity: hoveredId === industry.id || selectedIndustry?.id === industry.id ? 1 : 0.3,
                }}
              />
            </motion.button>
          ))}
        </motion.div>

        {/* Custom Industry Input */}
        {showCustomInput && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 max-w-md mx-auto"
          >
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Tell us about your industry
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="e.g., Pet grooming services"
                className="flex-1 px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCustomContinue()}
              />
              <button
                onClick={handleCustomContinue}
                disabled={!customInput.trim()}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
              >
                Continue
              </button>
            </div>
          </motion.div>
        )}

        {/* Benefits Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-16 grid md:grid-cols-3 gap-6 text-center"
        >
          <div className="p-6">
            <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-white font-semibold mb-2">Industry-Trained AI</h3>
            <p className="text-slate-400 text-sm">
              Your AI agent learns the terminology and best practices of your industry
            </p>
          </div>

          <div className="p-6">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-white font-semibold mb-2">Ready in Minutes</h3>
            <p className="text-slate-400 text-sm">
              Quick setup with smart defaults based on your industry type
            </p>
          </div>

          <div className="p-6">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-white font-semibold mb-2">1,000 Free Records</h3>
            <p className="text-slate-400 text-sm">
              Start with a generous free trial - no credit card required
            </p>
          </div>
        </motion.div>

        {/* Footer */}
        <div className="mt-12 text-center text-slate-500 text-sm">
          Already have an account?{' '}
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
