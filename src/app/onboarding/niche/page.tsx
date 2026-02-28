'use client';

/**
 * Niche Selection Page — Step 2 of 4
 *
 * Shown only when the selected category has 2+ templates.
 * Presents a searchable dropdown of niche templates, then the
 * industry-specific injection question for that niche.
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnboardingStore, type SelectedTemplate } from '@/lib/stores/onboarding-store';
import { getTemplatesForCategory } from '@/lib/persona/category-template-map';
import {
  getIndustryInjectionQuestion,
  type IndustryInjectionQuestion,
} from '@/lib/persona/industry-injection-questions';
import { Search, ChevronDown, Check, ArrowLeft, Loader2 } from 'lucide-react';

interface TemplateOption {
  id: string;
  name: string;
  description: string;
}

export default function NicheSelectionPage() {
  const router = useRouter();
  const {
    selectedCategory,
    selectedTemplate,
    setTemplate,
    setInjectionAnswer,
    setStep,
  } = useOnboardingStore();

  // Guard: must have a category
  useEffect(() => {
    if (!selectedCategory) {
      router.push('/onboarding/industry');
    }
  }, [selectedCategory, router]);

  // Template loading
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);

  useEffect(() => {
    if (!selectedCategory) { return; }
    let cancelled = false;
    setIsLoadingTemplates(true);
    void getTemplatesForCategory(selectedCategory.id).then((result) => {
      if (!cancelled) {
        setTemplates(result);
        setIsLoadingTemplates(false);
      }
    });
    return () => { cancelled = true; };
  }, [selectedCategory]);

  // Combobox state
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Injection question state
  const [injectionQuestion, setInjectionQuestion] = useState<IndustryInjectionQuestion | null>(null);
  const [injectionValue, setInjectionValue] = useState<string | string[]>('');

  // Filter templates by search
  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) { return templates; }
    const query = searchQuery.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query)
    );
  }, [templates, searchQuery]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) { searchInputRef.current.focus(); }
  }, [isOpen]);

  const handleSelectTemplate = useCallback((template: TemplateOption) => {
    const selected: SelectedTemplate = {
      id: template.id,
      name: template.name,
      description: template.description,
    };
    setTemplate(selected);
    setIsOpen(false);
    setSearchQuery('');

    // Load injection question
    const q = getIndustryInjectionQuestion(template.id);
    setInjectionQuestion(q);
    setInjectionValue('');
  }, [setTemplate]);

  const handleContinue = () => {
    if (!selectedTemplate) { return; }

    // Save injection answer
    if (injectionQuestion && injectionValue) {
      setInjectionAnswer(injectionValue, injectionQuestion.variable);
    }

    setStep('account');
    router.push('/onboarding/account');
  };

  const handleBack = () => {
    setStep('industry');
    router.push('/onboarding/industry');
  };

  if (!selectedCategory) { return null; }

  return (
    <div className="min-h-screen bg-black">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/30 via-black to-purple-950/20" />
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-5" />

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-12">
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
              Your Niche
            </h1>
            <p className="text-lg text-gray-400 max-w-md mx-auto">
              Select your specific niche within{' '}
              <span className="text-white">{selectedCategory.icon} {selectedCategory.name}</span>
            </p>
          </motion.div>

          {/* Progress: 2/4 */}
          <div className="flex items-center justify-center gap-2 mt-6">
            <div className="w-10 h-1.5 rounded-full bg-indigo-500" />
            <div className="w-10 h-1.5 rounded-full bg-indigo-500" />
            <div className="w-10 h-1.5 rounded-full bg-white/10" />
            <div className="w-10 h-1.5 rounded-full bg-white/10" />
          </div>
        </div>

        {/* Form Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-8"
        >
          <div className="space-y-6">
            {/* Template Combobox */}
            {isLoadingTemplates ? (
              <div className="flex items-center justify-center gap-3 py-8">
                <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                <span className="text-gray-400">Loading specializations...</span>
              </div>
            ) : (
              <div ref={dropdownRef}>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Your Specialization <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className={`w-full px-4 py-3.5 bg-white/5 border rounded-xl text-left flex items-center justify-between transition-all ${
                      isOpen
                        ? 'border-indigo-500/50 ring-2 ring-indigo-500/50'
                        : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    <span className={selectedTemplate ? 'text-white' : 'text-gray-500'}>
                      {selectedTemplate?.name ?? 'Select your specialization...'}
                    </span>
                    <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.15 }}
                        className="absolute z-50 w-full mt-2 backdrop-blur-xl bg-gray-900/95 border border-white/10 rounded-xl shadow-2xl overflow-hidden"
                      >
                        <div className="p-3 border-b border-white/10">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              ref={searchInputRef}
                              type="text"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder="Search specializations..."
                              className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                            />
                          </div>
                        </div>

                        <div className="max-h-64 overflow-y-auto">
                          {filteredTemplates.length > 0 ? (
                            filteredTemplates.map((t) => (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => handleSelectTemplate(t)}
                                className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors ${
                                  selectedTemplate?.id === t.id ? 'bg-indigo-500/20' : ''
                                }`}
                              >
                                <div className="flex-1 text-left">
                                  <div className="text-white text-sm font-medium">{t.name}</div>
                                  <div className="text-gray-400 text-xs">{t.description}</div>
                                </div>
                                {selectedTemplate?.id === t.id && (
                                  <Check className="w-4 h-4 text-indigo-400" />
                                )}
                              </button>
                            ))
                          ) : (
                            <div className="px-4 py-6 text-center text-gray-400 text-sm">
                              No specializations found.
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Injection Question (after template selection) */}
            <AnimatePresence>
              {injectionQuestion && selectedTemplate && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <InjectionQuestionField
                    question={injectionQuestion}
                    value={injectionValue}
                    onChange={setInjectionValue}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation */}
            <div className="flex gap-3">
              <button
                onClick={handleBack}
                className="flex-1 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-5 h-5" />
                Back
              </button>
              <button
                onClick={handleContinue}
                disabled={!selectedTemplate}
                className="flex-[2] py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
              >
                Continue
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            </div>
          </div>
        </motion.div>

        <div className="mt-8 text-center text-gray-500 text-sm">
          Already have an account?{' '}
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300 transition-colors">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Injection question renderer (same pattern as industry page) ───
function InjectionQuestionField({
  question,
  value,
  onChange,
}: {
  question: IndustryInjectionQuestion;
  value: string | string[];
  onChange: (val: string | string[]) => void;
}) {
  const { fieldType, options } = question;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">
        {question.question}
      </label>
      {question.helpText && (
        <p className="text-xs text-gray-500 mb-2">{question.helpText}</p>
      )}

      {fieldType === 'text' && (
        <input
          type="text"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.placeholder}
          className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
        />
      )}

      {fieldType === 'textarea' && (
        <textarea
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.placeholder}
          rows={3}
          className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all resize-none"
        />
      )}

      {fieldType === 'select' && options && (
        <div className="space-y-2">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`w-full px-4 py-3 rounded-xl text-left text-sm transition-all ${
                value === opt
                  ? 'bg-indigo-500/20 border border-indigo-500/50 text-white'
                  : 'bg-white/5 border border-white/10 text-gray-300 hover:border-white/20'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {fieldType === 'multiselect' && options && (
        <div className="space-y-2">
          {options.map((opt) => {
            const selected = Array.isArray(value) && value.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  const arr = Array.isArray(value) ? value : [];
                  onChange(selected ? arr.filter((v) => v !== opt) : [...arr, opt]);
                }}
                className={`w-full px-4 py-3 rounded-xl text-left text-sm transition-all flex items-center gap-2 ${
                  selected
                    ? 'bg-indigo-500/20 border border-indigo-500/50 text-white'
                    : 'bg-white/5 border border-white/10 text-gray-300 hover:border-white/20'
                }`}
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                  selected ? 'bg-indigo-500 border-indigo-500' : 'border-gray-500'
                }`}>
                  {selected && <Check className="w-3 h-3 text-white" />}
                </div>
                {opt}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
