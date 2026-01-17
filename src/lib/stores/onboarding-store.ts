/**
 * Onboarding State Store
 *
 * Manages temporary onboarding state before account creation.
 * Uses Zustand with localStorage persistence for cross-page state.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Industry definitions with metadata
export interface IndustryOption {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
  defaultPersona?: {
    tone: string;
    objectives: string[];
  };
}

export const INDUSTRIES: IndustryOption[] = [
  {
    id: 'social_media_influencer',
    name: 'Social Media Influencer',
    icon: '📱',
    description: 'Content creators, streamers, and digital personalities',
    color: '#EC4899',
    defaultPersona: {
      tone: 'casual_friendly',
      objectives: ['Build authentic connections', 'Drive engagement', 'Convert followers to customers'],
    },
  },
  {
    id: 'ecommerce_retail',
    name: 'E-commerce & Retail',
    icon: '🛒',
    description: 'Online stores, D2C brands, and retail businesses',
    color: '#8B5CF6',
    defaultPersona: {
      tone: 'professional_friendly',
      objectives: ['Convert visitors to buyers', 'Reduce cart abandonment', 'Increase AOV'],
    },
  },
  {
    id: 'saas_technology',
    name: 'SaaS & Technology',
    icon: '💻',
    description: 'Software companies, tech startups, and digital services',
    color: '#3B82F6',
    defaultPersona: {
      tone: 'professional',
      objectives: ['Qualify leads', 'Book demos', 'Reduce churn'],
    },
  },
  {
    id: 'real_estate',
    name: 'Real Estate',
    icon: '🏠',
    description: 'Agents, brokers, and property management',
    color: '#10B981',
    defaultPersona: {
      tone: 'professional_friendly',
      objectives: ['Qualify buyers/sellers', 'Schedule viewings', 'Build trust'],
    },
  },
  {
    id: 'healthcare_wellness',
    name: 'Healthcare & Wellness',
    icon: '🏥',
    description: 'Medical practices, wellness centers, and health services',
    color: '#06B6D4',
    defaultPersona: {
      tone: 'empathetic_professional',
      objectives: ['Schedule appointments', 'Answer FAQs', 'Provide care information'],
    },
  },
  {
    id: 'professional_services',
    name: 'Professional Services',
    icon: '💼',
    description: 'Consulting, legal, accounting, and B2B services',
    color: '#6366F1',
    defaultPersona: {
      tone: 'professional',
      objectives: ['Qualify prospects', 'Schedule consultations', 'Showcase expertise'],
    },
  },
  {
    id: 'education_coaching',
    name: 'Education & Coaching',
    icon: '📚',
    description: 'Online courses, coaching programs, and educational content',
    color: '#F59E0B',
    defaultPersona: {
      tone: 'encouraging_professional',
      objectives: ['Enroll students', 'Answer program questions', 'Build community'],
    },
  },
  {
    id: 'fitness_sports',
    name: 'Fitness & Sports',
    icon: '🏋️',
    description: 'Gyms, personal trainers, and sports businesses',
    color: '#EF4444',
    defaultPersona: {
      tone: 'motivational_friendly',
      objectives: ['Sign up members', 'Book sessions', 'Motivate prospects'],
    },
  },
  {
    id: 'hospitality_travel',
    name: 'Hospitality & Travel',
    icon: '✈️',
    description: 'Hotels, restaurants, travel agencies, and tourism',
    color: '#14B8A6',
    defaultPersona: {
      tone: 'warm_professional',
      objectives: ['Book reservations', 'Answer inquiries', 'Upsell experiences'],
    },
  },
  {
    id: 'financial_services',
    name: 'Financial Services',
    icon: '🏦',
    description: 'Insurance, banking, investments, and financial planning',
    color: '#0EA5E9',
    defaultPersona: {
      tone: 'trustworthy_professional',
      objectives: ['Qualify leads', 'Schedule consultations', 'Build trust'],
    },
  },
  {
    id: 'home_services',
    name: 'Home Services',
    icon: '🔧',
    description: 'Contractors, cleaning, landscaping, and home improvement',
    color: '#84CC16',
    defaultPersona: {
      tone: 'friendly_professional',
      objectives: ['Book appointments', 'Provide quotes', 'Schedule follow-ups'],
    },
  },
  {
    id: 'automotive',
    name: 'Automotive',
    icon: '🚗',
    description: 'Dealerships, auto services, and vehicle sales',
    color: '#64748B',
    defaultPersona: {
      tone: 'professional_friendly',
      objectives: ['Schedule test drives', 'Qualify buyers', 'Book service appointments'],
    },
  },
  {
    id: 'agency_marketing',
    name: 'Agency & Marketing',
    icon: '📊',
    description: 'Marketing agencies, creative studios, and PR firms',
    color: '#A855F7',
    defaultPersona: {
      tone: 'creative_professional',
      objectives: ['Qualify leads', 'Showcase portfolio', 'Book discovery calls'],
    },
  },
  {
    id: 'nonprofit',
    name: 'Nonprofit & Charity',
    icon: '❤️',
    description: 'Charitable organizations, NGOs, and community groups',
    color: '#F43F5E',
    defaultPersona: {
      tone: 'warm_passionate',
      objectives: ['Engage donors', 'Share impact stories', 'Recruit volunteers'],
    },
  },
  {
    id: 'other',
    name: 'Other Industry',
    icon: '🌐',
    description: 'Something else? We\'ve got you covered',
    color: '#6B7280',
    defaultPersona: {
      tone: 'professional_friendly',
      objectives: ['Engage visitors', 'Answer questions', 'Convert leads'],
    },
  },
];

// Onboarding state interface
export interface OnboardingState {
  // Step tracking
  currentStep: 'industry' | 'account' | 'business' | 'complete';

  // Industry selection
  selectedIndustry: IndustryOption | null;
  customIndustry?: string;

  // Contact info (collected in step 1)
  fullName: string;
  email: string;
  phoneNumber: string;
  nicheDescription: string;
  companyName: string;

  // Default trial plan (hidden from user)
  planId: string;
  trialRecords: number;

  // Timestamps
  startedAt: string | null;
  completedAt: string | null;

  // Actions
  setIndustry: (industry: IndustryOption) => void;
  setCustomIndustry: (name: string) => void;
  setContactInfo: (info: { fullName: string; email: string; phoneNumber: string; nicheDescription: string }) => void;
  setAccountInfo: (email: string, companyName: string) => void;
  setStep: (step: OnboardingState['currentStep']) => void;
  reset: () => void;
  getIndustryDefaults: () => { tone: string; objectives: string[] } | undefined;
}

const initialState = {
  currentStep: 'industry' as const,
  selectedIndustry: null,
  customIndustry: undefined,
  fullName: '',
  email: '',
  phoneNumber: '',
  nicheDescription: '',
  companyName: '',
  planId: 'trial', // Default trial plan - 1000 records
  trialRecords: 1000,
  startedAt: null,
  completedAt: null,
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setIndustry: (industry) => set({
        selectedIndustry: industry,
        startedAt: get().startedAt ?? new Date().toISOString(),
      }),

      setCustomIndustry: (name) => set({
        customIndustry: name,
      }),

      setContactInfo: (info) => set({
        fullName: info.fullName,
        email: info.email,
        phoneNumber: info.phoneNumber,
        nicheDescription: info.nicheDescription,
      }),

      setAccountInfo: (email, companyName) => set({
        email,
        companyName,
      }),

      setStep: (step) => set({
        currentStep: step,
        ...(step === 'complete' ? { completedAt: new Date().toISOString() } : {}),
      }),

      reset: () => set(initialState),

      getIndustryDefaults: () => {
        const { selectedIndustry } = get();
        return selectedIndustry?.defaultPersona;
      },
    }),
    {
      name: 'onboarding-state',
      storage: createJSONStorage(() => localStorage),
      // Only persist these fields
      partialize: (state) => ({
        currentStep: state.currentStep,
        selectedIndustry: state.selectedIndustry,
        customIndustry: state.customIndustry,
        fullName: state.fullName,
        email: state.email,
        phoneNumber: state.phoneNumber,
        nicheDescription: state.nicheDescription,
        companyName: state.companyName,
        planId: state.planId,
        trialRecords: state.trialRecords,
        startedAt: state.startedAt,
      }),
    }
  )
);

// Helper to get industry by ID
export const getIndustryById = (id: string): IndustryOption | undefined => {
  return INDUSTRIES.find(ind => ind.id === id);
};
