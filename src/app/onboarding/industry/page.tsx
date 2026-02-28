'use client';

/**
 * Industry Selection Page — Step 1 of 4
 *
 * Collects contact info + industry CATEGORY selection (15 categories).
 * Uses a searchable combobox dropdown with glassmorphism styling.
 *
 * After category selection:
 *  - If 0 templates → show "Describe your niche" inline
 *  - If 1 template  → show the injection question inline
 *  - If 2+ templates → continue to /onboarding/niche
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnboardingStore } from '@/lib/stores/onboarding-store';
import {
  ONBOARDING_CATEGORIES,
  type OnboardingCategory,
  categoryHasDrillDown,
  categorySingleTemplateId,
} from '@/lib/persona/category-template-map';
import {
  getIndustryInjectionQuestion,
  type IndustryInjectionQuestion,
} from '@/lib/persona/industry-injection-questions';
import { Search, ChevronDown, Check, User, Mail, Phone } from 'lucide-react';

export default function IndustrySelectionPage() {
  const router = useRouter();
  const {
    selectedCategory,
    setCategory,
    setTemplate,
    setInjectionAnswer,
    setCustomNiche,
    setContactInfo,
    setStep,
    fullName: storedFullName,
    email: storedEmail,
    phoneNumber: storedPhoneNumber,
  } = useOnboardingStore();

  // Form state
  const [fullName, setFullName] = useState(storedFullName || '');
  const [email, setEmail] = useState(storedEmail || '');
  const [phoneNumber, setPhoneNumber] = useState(storedPhoneNumber || '');

  // Combobox state
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Inline fields for 0-template and 1-template categories
  const [customNicheInput, setCustomNicheInput] = useState('');
  const [inlineInjection, setInlineInjection] = useState<IndustryInjectionQuestion | null>(null);
  const [inlineAnswer, setInlineAnswer] = useState<string | string[]>('');

  // Refs
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter categories based on search
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) { return ONBOARDING_CATEGORIES; }
    const query = searchQuery.toLowerCase();
    return ONBOARDING_CATEGORIES.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.description.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelectCategory = useCallback((category: OnboardingCategory) => {
    setCategory(category);
    setIsOpen(false);
    setSearchQuery('');

    // Reset inline fields
    setCustomNicheInput('');
    setInlineAnswer('');

    // Check if 1-template category — load injection question inline
    const singleId = categorySingleTemplateId(category.id);
    if (singleId) {
      const q = getIndustryInjectionQuestion(singleId);
      setInlineInjection(q);
      // Also set the template in store immediately
      setTemplate({ id: singleId, name: category.name, description: category.description });
    } else {
      setInlineInjection(null);
      setTemplate(null);
    }
  }, [setCategory, setTemplate]);

  const validateEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

  const isFormValid = () => {
    if (!fullName.trim() || !email.trim() || !validateEmail(email) || !selectedCategory) {
      return false;
    }
    // For 0-template categories, require custom niche
    if (selectedCategory.templateIds.length === 0 && !customNicheInput.trim()) {
      return false;
    }
    return true;
  };

  const handleContinue = () => {
    if (!isFormValid() || !selectedCategory) { return; }

    // Save contact info
    setContactInfo({
      fullName: fullName.trim(),
      email: email.trim(),
      phoneNumber: phoneNumber.trim(),
      nicheDescription: '', // No longer used — replaced by customNiche / injection
    });

    // Save inline answers if applicable
    if (selectedCategory.templateIds.length === 0) {
      setCustomNiche(customNicheInput.trim());
    }

    if (inlineInjection && inlineAnswer) {
      setInjectionAnswer(inlineAnswer, inlineInjection.variable);
    }

    // Route decision
    if (categoryHasDrillDown(selectedCategory.id)) {
      setStep('niche');
      router.push('/onboarding/niche');
    } else {
      setStep('account');
      router.push('/onboarding/account');
    }
  };

  // Determine if we need inline fields
  const showCustomNicheField = selectedCategory?.templateIds.length === 0;
  const showInlineInjection = selectedCategory && inlineInjection;

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
              Tell us about you
            </h1>
            <p className="text-lg text-gray-400 max-w-md mx-auto">
              We&apos;ll tailor your AI sales agent to your industry.
            </p>
          </motion.div>

          {/* Progress indicator — 4 dots */}
          <div className="flex items-center justify-center gap-2 mt-6">
            <div className="w-10 h-1.5 rounded-full bg-indigo-500" />
            <div className="w-10 h-1.5 rounded-full bg-white/10" />
            <div className="w-10 h-1.5 rounded-full bg-white/10" />
            <div className="w-10 h-1.5 rounded-full bg-white/10" />
          </div>
        </div>

        {/* Main Form Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-8"
        >
          <div className="space-y-6">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Full Name <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Smith"
                  className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                />
              </div>
            </div>

            {/* Business Email */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Business Email <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@company.com"
                  className={`w-full pl-12 pr-4 py-3.5 bg-white/5 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all ${
                    email && !validateEmail(email)
                      ? 'border-red-500/50 focus:border-red-500/50'
                      : 'border-white/10 focus:border-indigo-500/50'
                  }`}
                />
              </div>
              {email && !validateEmail(email) && (
                <p className="mt-1.5 text-sm text-red-400">Please enter a valid email address</p>
              )}
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Phone Number <span className="text-gray-500">(optional)</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                />
              </div>
            </div>

            {/* Category Combobox */}
            <div ref={dropdownRef}>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Industry Category <span className="text-red-400">*</span>
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
                  <span className={selectedCategory ? 'text-white' : 'text-gray-500'}>
                    {selectedCategory ? (
                      <span className="flex items-center gap-2">
                        <span>{selectedCategory.icon}</span>
                        <span>{selectedCategory.name}</span>
                      </span>
                    ) : (
                      'Select your industry...'
                    )}
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
                            placeholder="Search categories..."
                            className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                          />
                        </div>
                      </div>

                      <div className="max-h-64 overflow-y-auto">
                        {filteredCategories.length > 0 ? (
                          filteredCategories.map((cat) => (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => handleSelectCategory(cat)}
                              className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors ${
                                selectedCategory?.id === cat.id ? 'bg-indigo-500/20' : ''
                              }`}
                            >
                              <span className="text-xl">{cat.icon}</span>
                              <div className="flex-1 text-left">
                                <div className="text-white text-sm font-medium">{cat.name}</div>
                                <div className="text-gray-400 text-xs">{cat.description}</div>
                              </div>
                              {selectedCategory?.id === cat.id && (
                                <Check className="w-4 h-4 text-indigo-400" />
                              )}
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-6 text-center text-gray-400 text-sm">
                            No categories found.
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Inline: custom niche for 0-template categories */}
            <AnimatePresence>
              {showCustomNicheField && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Describe your niche <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={customNicheInput}
                    onChange={(e) => setCustomNicheInput(e.target.value)}
                    placeholder="What does your business do? Who are your ideal customers?"
                    rows={3}
                    className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all resize-none"
                    autoFocus
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Inline injection question for 1-template categories */}
            <AnimatePresence>
              {showInlineInjection && inlineInjection && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <InjectionQuestionField
                    question={inlineInjection}
                    value={inlineAnswer}
                    onChange={setInlineAnswer}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Continue Button */}
            <button
              onClick={handleContinue}
              disabled={!isFormValid()}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
            >
              Continue
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </div>
        </motion.div>

        {/* Benefits */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-10 grid grid-cols-3 gap-4"
        >
          <div className="text-center p-4">
            <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <p className="text-gray-400 text-sm">Industry-Trained AI</p>
          </div>
          <div className="text-center p-4">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-gray-400 text-sm">Ready in Minutes</p>
          </div>
          <div className="text-center p-4">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <p className="text-gray-400 text-sm">1,000 Free Records</p>
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

// ─── Injection question renderer ───
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
