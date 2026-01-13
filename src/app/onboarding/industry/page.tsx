'use client';

/**
 * Industry Selection Page (Refactored)
 *
 * First step of the onboarding flow - collects user info and industry selection
 * via a searchable combobox dropdown with glassmorphism styling.
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useOnboardingStore,
  INDUSTRIES,
  type IndustryOption,
} from '@/lib/stores/onboarding-store';
import { Search, ChevronDown, Check, User, Mail, Phone, FileText } from 'lucide-react';

export default function IndustrySelectionPage() {
  const router = useRouter();
  const {
    selectedIndustry,
    setIndustry,
    setCustomIndustry,
    setContactInfo,
    setStep,
    fullName: storedFullName,
    email: storedEmail,
    phoneNumber: storedPhoneNumber,
    nicheDescription: storedNicheDescription,
  } = useOnboardingStore();

  // Form state
  const [fullName, setFullName] = useState(storedFullName || '');
  const [email, setEmail] = useState(storedEmail || '');
  const [phoneNumber, setPhoneNumber] = useState(storedPhoneNumber || '');
  const [nicheDescription, setNicheDescription] = useState(storedNicheDescription || '');

  // Combobox state
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [customIndustryInput, setCustomIndustryInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Refs
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter industries based on search
  const filteredIndustries = useMemo(() => {
    if (!searchQuery.trim()) return INDUSTRIES;
    const query = searchQuery.toLowerCase();
    return INDUSTRIES.filter(
      (industry) =>
        industry.name.toLowerCase().includes(query) ||
        industry.description.toLowerCase().includes(query)
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

  const handleSelectIndustry = (industry: IndustryOption) => {
    if (industry.id === 'other') {
      setShowCustomInput(true);
      setIndustry(industry);
    } else {
      setIndustry(industry);
      setShowCustomInput(false);
      setCustomIndustryInput('');
    }
    setIsOpen(false);
    setSearchQuery('');
  };

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const isFormValid = () => {
    return (
      fullName.trim() !== '' &&
      email.trim() !== '' &&
      validateEmail(email) &&
      selectedIndustry !== null &&
      (selectedIndustry.id !== 'other' || customIndustryInput.trim() !== '')
    );
  };

  const handleContinue = () => {
    if (!isFormValid()) return;

    // Save contact info to store
    setContactInfo({
      fullName: fullName.trim(),
      email: email.trim(),
      phoneNumber: phoneNumber.trim(),
      nicheDescription: nicheDescription.trim(),
    });

    // Save custom industry if applicable
    if (selectedIndustry?.id === 'other' && customIndustryInput.trim()) {
      setCustomIndustry(customIndustryInput.trim());
    }

    // Navigate to next step
    setStep('account');
    router.push('/onboarding/account');
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/30 via-black to-purple-950/20" />

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-5" />

      {/* Content */}
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
              Let&apos;s get started
            </h1>
            <p className="text-lg text-gray-400 max-w-md mx-auto">
              Tell us about yourself so we can tailor your AI sales experience.
            </p>
          </motion.div>

          {/* Progress indicator */}
          <div className="flex items-center justify-center gap-2 mt-6">
            <div className="w-10 h-1.5 rounded-full bg-indigo-500" />
            <div className="w-10 h-1.5 rounded-full bg-white/10" />
            <div className="w-10 h-1.5 rounded-full bg-white/10" />
          </div>
        </div>

        {/* Main Form Card - Glassmorphism */}
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

            {/* Industry Combobox */}
            <div ref={dropdownRef}>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Industry <span className="text-red-400">*</span>
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
                  <span className={selectedIndustry ? 'text-white' : 'text-gray-500'}>
                    {selectedIndustry ? (
                      <span className="flex items-center gap-2">
                        <span>{selectedIndustry.icon}</span>
                        <span>{selectedIndustry.name}</span>
                      </span>
                    ) : (
                      'Select your industry...'
                    )}
                  </span>
                  <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.15 }}
                      className="absolute z-50 w-full mt-2 backdrop-blur-xl bg-gray-900/95 border border-white/10 rounded-xl shadow-2xl overflow-hidden"
                    >
                      {/* Search Input */}
                      <div className="p-3 border-b border-white/10">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            ref={searchInputRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search industries..."
                            className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                          />
                        </div>
                      </div>

                      {/* Options List */}
                      <div className="max-h-64 overflow-y-auto">
                        {filteredIndustries.length > 0 ? (
                          filteredIndustries.map((industry) => (
                            <button
                              key={industry.id}
                              type="button"
                              onClick={() => handleSelectIndustry(industry)}
                              className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors ${
                                selectedIndustry?.id === industry.id ? 'bg-indigo-500/20' : ''
                              }`}
                            >
                              <span className="text-xl">{industry.icon}</span>
                              <div className="flex-1 text-left">
                                <div className="text-white text-sm font-medium">{industry.name}</div>
                                <div className="text-gray-400 text-xs">{industry.description}</div>
                              </div>
                              {selectedIndustry?.id === industry.id && (
                                <Check className="w-4 h-4 text-indigo-400" />
                              )}
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-6 text-center text-gray-400 text-sm">
                            No industries found. Try &quot;Other Industry&quot;.
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Custom Industry Input (shown when "Other" selected) */}
            <AnimatePresence>
              {showCustomInput && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Describe your industry <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={customIndustryInput}
                    onChange={(e) => setCustomIndustryInput(e.target.value)}
                    placeholder="e.g., Pet grooming services"
                    className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                    autoFocus
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Niche Description */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Tell us more about your niche <span className="text-gray-500">(optional)</span>
              </label>
              <div className="relative">
                <FileText className="absolute left-4 top-4 w-5 h-5 text-gray-500" />
                <textarea
                  value={nicheDescription}
                  onChange={(e) => setNicheDescription(e.target.value)}
                  placeholder="What makes your business unique? Who are your ideal customers?"
                  rows={3}
                  className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all resize-none"
                />
              </div>
            </div>

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

        {/* Benefits Section */}
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

        {/* Footer */}
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
