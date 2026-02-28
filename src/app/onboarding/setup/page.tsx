'use client';

/**
 * API Key Setup Page — Step 4 of 4
 *
 * Requires an OpenRouter API key, validates it, saves it,
 * then fires processOnboarding() to build persona + base model.
 * Redirects to /dashboard when complete.
 */

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useOnboardingStore } from '@/lib/stores/onboarding-store';
import { useAuth } from '@/hooks/useAuth';
import { Key, ExternalLink, CheckCircle2, XCircle, Loader2, Eye, EyeOff, Zap } from 'lucide-react';

type SetupPhase = 'input' | 'processing' | 'complete' | 'error';

const PROCESSING_STEPS = [
  'Validating API key...',
  'Saving configuration...',
  'Building your AI persona...',
  'Configuring knowledge base...',
  'Activating your agents...',
];

export default function SetupPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const {
    selectedCategory,
    selectedTemplate,
    injectionAnswer,
    injectionVariable,
    customNiche,
    fullName,
    companyName,
    setApiKeyConfigured,
    setStep,
  } = useOnboardingStore();

  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [phase, setPhase] = useState<SetupPhase>('input');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'valid' | 'invalid'>('idle');
  const [testError, setTestError] = useState('');
  const [processingStep, setProcessingStep] = useState(0);
  const [submitError, setSubmitError] = useState('');

  const processingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Guard: must be authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/onboarding/industry');
    }
  }, [user, authLoading, router]);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (processingTimerRef.current) { clearInterval(processingTimerRef.current); }
    };
  }, []);

  const handleTestConnection = async () => {
    if (!apiKey.trim()) { return; }

    setTestStatus('testing');
    setTestError('');

    try {
      const response = await fetch(`/api/settings/api-keys/test?service=openrouter&key=${encodeURIComponent(apiKey.trim())}`);
      const data: unknown = await response.json();
      const result = data as { success?: boolean; error?: string };

      if (result.success) {
        setTestStatus('valid');
      } else {
        setTestStatus('invalid');
        setTestError(result.error ?? 'Invalid API key');
      }
    } catch {
      setTestStatus('invalid');
      setTestError('Failed to test connection. Please try again.');
    }
  };

  const handleSubmit = async () => {
    if (testStatus !== 'valid' || !apiKey.trim()) { return; }

    setPhase('processing');
    setSubmitError('');
    setProcessingStep(0);

    // Animate through processing steps
    let step = 0;
    processingTimerRef.current = setInterval(() => {
      step++;
      if (step < PROCESSING_STEPS.length) {
        setProcessingStep(step);
      }
    }, 1500);

    try {
      // Step 1: Save API key
      const saveResponse = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: 'openrouter', key: apiKey.trim() }),
      });

      if (!saveResponse.ok) {
        throw new Error('Failed to save API key');
      }

      // Step 2: Fire processOnboarding with full onboarding data
      const onboardingData = {
        businessName: companyName || 'My Business',
        industry: selectedCategory?.id ?? 'other',
        industryCategory: selectedCategory?.id ?? undefined,
        industryCategoryName: selectedCategory?.name ?? undefined,
        industryTemplateId: selectedTemplate?.id ?? undefined,
        industryTemplateName: selectedTemplate?.name ?? undefined,
        injectionAnswer: injectionAnswer ?? undefined,
        injectionVariable: injectionVariable ?? undefined,
        customNiche: customNiche || undefined,
        ownerName: fullName || undefined,
        problemSolved: '',
        uniqueValue: '',
        targetCustomer: '',
        topProducts: '',
      };

      const processResponse = await fetch('/api/agent/process-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboardingData }),
      });

      if (!processResponse.ok) {
        const errorData: unknown = await processResponse.json();
        const err = errorData as { error?: string };
        throw new Error(err.error ?? 'Failed to process onboarding');
      }

      // Success
      if (processingTimerRef.current) { clearInterval(processingTimerRef.current); }
      setProcessingStep(PROCESSING_STEPS.length - 1);
      setPhase('complete');
      setApiKeyConfigured(true);
      setStep('complete');

      // Brief delay then redirect
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
    } catch (error: unknown) {
      if (processingTimerRef.current) { clearInterval(processingTimerRef.current); }
      setPhase('error');
      setSubmitError(error instanceof Error ? error.message : 'Something went wrong');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/30 via-black to-purple-950/20" />
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-5" />

      <div className="relative z-10 max-w-xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-10">
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
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
              {phase === 'processing' ? 'Setting up your AI...' :
               phase === 'complete' ? 'You\'re all set!' :
               'Power up your AI'}
            </h1>
            {phase === 'input' && (
              <p className="text-lg text-gray-400 max-w-md mx-auto">
                Your AI agents need an LLM key to work. Connect your OpenRouter account to get started.
              </p>
            )}
          </motion.div>

          {/* Progress: 4/4 */}
          <div className="flex items-center justify-center gap-2 mt-6">
            <div className="w-10 h-1.5 rounded-full bg-indigo-500" />
            <div className="w-10 h-1.5 rounded-full bg-indigo-500" />
            <div className="w-10 h-1.5 rounded-full bg-indigo-500" />
            <div className={`w-10 h-1.5 rounded-full ${phase === 'complete' ? 'bg-indigo-500' : 'bg-indigo-500/50'}`} />
          </div>
        </div>

        {/* Processing Animation */}
        {(phase === 'processing' || phase === 'complete') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-8"
          >
            <div className="space-y-4">
              {PROCESSING_STEPS.map((stepText, i) => (
                <div key={stepText} className="flex items-center gap-3">
                  {i < processingStep ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  ) : i === processingStep ? (
                    phase === 'complete' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <Loader2 className="w-5 h-5 text-indigo-400 animate-spin flex-shrink-0" />
                    )
                  ) : (
                    <div className="w-5 h-5 rounded-full border border-gray-600 flex-shrink-0" />
                  )}
                  <span className={`text-sm ${
                    i <= processingStep ? 'text-white' : 'text-gray-500'
                  }`}>
                    {stepText}
                  </span>
                </div>
              ))}
            </div>

            {phase === 'complete' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-6 text-center"
              >
                <p className="text-emerald-400 font-medium">Redirecting to your dashboard...</p>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Error state */}
        {phase === 'error' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-8"
          >
            <div className="text-center">
              <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <p className="text-white font-medium mb-2">Setup failed</p>
              <p className="text-gray-400 text-sm mb-6">{submitError}</p>
              <button
                onClick={() => setPhase('input')}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all"
              >
                Try Again
              </button>
            </div>
          </motion.div>
        )}

        {/* Input Form */}
        {phase === 'input' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-8"
          >
            <div className="space-y-6">
              {/* Why you need this */}
              <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                <div className="flex items-start gap-3">
                  <Zap className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-indigo-300 font-medium text-sm">Why do I need this?</p>
                    <p className="text-gray-400 text-sm mt-1">
                      Your AI sales agents use large language models to have intelligent conversations.
                      OpenRouter gives you access to the best models (GPT-4o, Claude, Llama) through a single API key.
                    </p>
                  </div>
                </div>
              </div>

              {/* API Key Input */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  OpenRouter API Key <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      if (testStatus !== 'idle') { setTestStatus('idle'); }
                    }}
                    placeholder="sk-or-v1-..."
                    className={`w-full pl-12 pr-12 py-3.5 bg-white/5 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all ${
                      testStatus === 'valid' ? 'border-emerald-500/50' :
                      testStatus === 'invalid' ? 'border-red-500/50' :
                      'border-white/10 focus:border-indigo-500/50'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                  >
                    {showKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>

                {/* Test feedback */}
                {testStatus === 'valid' && (
                  <div className="mt-2 flex items-center gap-2 text-emerald-400 text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    API key is valid
                  </div>
                )}
                {testStatus === 'invalid' && (
                  <div className="mt-2 flex items-center gap-2 text-red-400 text-sm">
                    <XCircle className="w-4 h-4" />
                    {testError}
                  </div>
                )}
              </div>

              {/* Get a key link */}
              <div className="flex items-center gap-2">
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 hover:text-indigo-300 text-sm transition-colors flex items-center gap-1"
                >
                  Don&apos;t have one? Get your free OpenRouter key
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Test Connection */}
              <button
                onClick={() => void handleTestConnection()}
                disabled={!apiKey.trim() || testStatus === 'testing'}
                className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testStatus === 'testing' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Testing connection...
                  </>
                ) : (
                  'Test Connection'
                )}
              </button>

              {/* Submit */}
              <button
                onClick={() => void handleSubmit()}
                disabled={testStatus !== 'valid'}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
              >
                Complete Setup
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            </div>
          </motion.div>
        )}

        {phase === 'input' && (
          <div className="mt-8 text-center text-gray-500 text-sm">
            Need help?{' '}
            <a
              href="https://openrouter.ai/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              OpenRouter Documentation
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
