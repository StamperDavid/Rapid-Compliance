'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger/logger';

interface OnboardingSection {
  [key: string]: string;
}

interface OnboardingData {
  businessBasics: OnboardingSection;
  businessUnderstanding: OnboardingSection;
  productsServices: OnboardingSection;
  productDetails: OnboardingSection;
  pricingSales: OnboardingSection;
  agentGoals: OnboardingSection;
  agentPersonality: OnboardingSection;
}

export default function BusinessSetupPage() {
  const _auth = useAuth();
  const params = useParams();
  const orgId = params.orgId as string;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('business-basics');
  const [onboardingData, setOnboardingData] = useState<OnboardingData | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Load organization onboarding data
  useEffect(() => {
    async function loadOnboardingData() {
      try {
        setLoading(true);
        const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
        const org = await FirestoreService.get(COLLECTIONS.ORGANIZATIONS, orgId);
        
        if (org?.onboardingData) {
          setOnboardingData(org.onboardingData as OnboardingData);
        } else {
          // Initialize empty structure
          setOnboardingData({
            businessBasics: {},
            businessUnderstanding: {},
            productsServices: {},
            productDetails: {},
            pricingSales: {},
            agentGoals: {},
            agentPersonality: {}
          });
        }
        setLoading(false);
      } catch (error) {
        logger.error('Failed to load onboarding data:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
        setLoading(false);
      }
    }

    void loadOnboardingData();
  }, [orgId]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      
      await FirestoreService.update(COLLECTIONS.ORGANIZATIONS, orgId, {
        onboardingData,
        updatedAt: new Date()
      });

      setHasChanges(false);
      // eslint-disable-next-line no-alert -- User feedback for save operation
      alert('Business setup saved successfully!');
      setSaving(false);
    } catch (error) {
      logger.error('Failed to save:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      // eslint-disable-next-line no-alert -- User feedback for error handling
      alert('Failed to save changes. Please try again.');
      setSaving(false);
    }
  };

  const updateField = (section: keyof OnboardingData, field: string, value: string) => {
    setOnboardingData((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        [section]: {
          ...prev[section],
          [field]: value
        }
      };
    });
    setHasChanges(true);
  };

  const sections = [
    { id: 'business-basics', label: 'Business Basics', icon: '🏢' },
    { id: 'business-understanding', label: 'Business Understanding', icon: '💡' },
    { id: 'products-services', label: 'Products & Services', icon: '📦' },
    { id: 'pricing-sales', label: 'Pricing & Sales', icon: '💰' },
    { id: 'agent-goals', label: 'Agent Goals', icon: '🎯' },
    { id: 'agent-personality', label: 'Agent Personality', icon: '🎭' }
  ];

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#666' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
          <div>Loading business setup...</div>
        </div>
      </div>
    );
  }

  const primaryColor = '#6366f1';

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#000', color: '#fff' }}>
      <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <Link 
            href={`/workspace/${orgId}/settings/ai-agents`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: primaryColor, fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none', marginBottom: '1.5rem' }}
          >
            ← Back to AI Agent
          </Link>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                Business Setup
              </h1>
              <p style={{ color: '#666', fontSize: '0.875rem' }}>
                View and edit your business information that powers your AI agent
              </p>
            </div>
            {hasChanges && (
              <button
                onClick={() => void handleSave()}
                disabled={saving}
                style={{
                  padding: '0.75rem 2rem',
                  backgroundColor: primaryColor,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontWeight: '600',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.5 : 1
                }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '2rem' }}>
          {/* Sidebar Navigation */}
          <div style={{ position: 'sticky', top: '2rem', height: 'fit-content' }}>
            <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '0.75rem', padding: '1rem' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#666', marginBottom: '1rem', paddingLeft: '0.5rem' }}>
                SECTIONS
              </div>
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    marginBottom: '0.25rem',
                    backgroundColor: activeSection === section.id ? `${primaryColor  }22` : 'transparent',
                    color: activeSection === section.id ? primaryColor : '#999',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    fontSize: '0.875rem',
                    fontWeight: activeSection === section.id ? '600' : '400',
                    borderLeft: activeSection === section.id ? `3px solid ${primaryColor}` : '3px solid transparent',
                    transition: 'all 0.2s'
                  }}
                >
                  <span>{section.icon}</span>
                  <span>{section.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Content Area */}
          <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '0.75rem', padding: '2rem' }}>
            {/* Business Basics Section */}
            {activeSection === 'business-basics' && (
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
                  Business Basics
                </h2>
                
                <FormField
                  label="Business Name"
                  value={onboardingData?.businessBasics?.businessName ?? ''}
                  onChange={(value) => updateField('businessBasics', 'businessName', value)}
                  placeholder="e.g., Acme Corporation"
                />

                <FormField
                  label="Industry"
                  value={onboardingData?.businessBasics?.industry ?? ''}
                  onChange={(value) => updateField('businessBasics', 'industry', value)}
                  placeholder="e.g., B2B SaaS, E-commerce, Professional Services"
                />

                <FormField
                  label="Website"
                  value={onboardingData?.businessBasics?.website ?? ''}
                  onChange={(value) => updateField('businessBasics', 'website', value)}
                  placeholder="https://www.example.com"
                />

                <FormField
                  label="FAQ Page URL"
                  value={onboardingData?.businessBasics?.faqPageUrl ?? ''}
                  onChange={(value) => updateField('businessBasics', 'faqPageUrl', value)}
                  placeholder="https://www.example.com/faq"
                />

                <FormField
                  label="Company Size"
                  value={onboardingData?.businessBasics?.companySize ?? ''}
                  onChange={(value) => updateField('businessBasics', 'companySize', value)}
                  placeholder="e.g., 10-50 employees"
                />
              </div>
            )}

            {/* Business Understanding Section */}
            {activeSection === 'business-understanding' && (
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
                  Business Understanding
                </h2>
                
                <FormField
                  label="What problem does your business solve?"
                  value={onboardingData?.businessUnderstanding?.problemSolved ?? ''}
                  onChange={(value) => updateField('businessUnderstanding', 'problemSolved', value)}
                  placeholder="Describe the main problem your business solves..."
                  multiline
                />

                <FormField
                  label="What makes you unique?"
                  value={onboardingData?.businessUnderstanding?.uniqueValue ?? ''}
                  onChange={(value) => updateField('businessUnderstanding', 'uniqueValue', value)}
                  placeholder="What sets you apart from competitors..."
                  multiline
                />

                <FormField
                  label="Why should customers buy from you?"
                  value={onboardingData?.businessUnderstanding?.whyBuy ?? ''}
                  onChange={(value) => updateField('businessUnderstanding', 'whyBuy', value)}
                  placeholder="Key reasons customers choose you..."
                  multiline
                />

                <FormField
                  label="Why might someone NOT buy from you?"
                  value={onboardingData?.businessUnderstanding?.whyNotBuy ?? ''}
                  onChange={(value) => updateField('businessUnderstanding', 'whyNotBuy', value)}
                  placeholder="Common reasons for not choosing you..."
                  multiline
                />
              </div>
            )}

            {/* Products & Services Section */}
            {activeSection === 'products-services' && (
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
                  Products & Services
                </h2>
                
                <FormField
                  label="Primary Offering"
                  value={onboardingData?.productsServices?.primaryOffering ?? ''}
                  onChange={(value) => updateField('productsServices', 'primaryOffering', value)}
                  placeholder="What is your main product or service?"
                />

                <FormField
                  label="Price Range"
                  value={onboardingData?.productsServices?.priceRange ?? ''}
                  onChange={(value) => updateField('productsServices', 'priceRange', value)}
                  placeholder="e.g., $50 - $500, $10/month - $100/month"
                />

                <FormField
                  label="Target Customer"
                  value={onboardingData?.productsServices?.targetCustomer ?? ''}
                  onChange={(value) => updateField('productsServices', 'targetCustomer', value)}
                  placeholder="Who is your ideal customer?"
                  multiline
                />

                <FormField
                  label="Customer Demographics"
                  value={onboardingData?.productsServices?.customerDemographics ?? ''}
                  onChange={(value) => updateField('productsServices', 'customerDemographics', value)}
                  placeholder="Age, location, income, industry, etc."
                  multiline
                />

                <FormField
                  label="Top Products/Services"
                  value={onboardingData?.productDetails?.topProducts ?? ''}
                  onChange={(value) => updateField('productDetails', 'topProducts', value)}
                  placeholder="List your top 3-5 products or services with brief descriptions..."
                  multiline
                  rows={6}
                />
              </div>
            )}

            {/* Pricing & Sales Section */}
            {activeSection === 'pricing-sales' && (
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
                  Pricing & Sales Strategy
                </h2>
                
                <FormField
                  label="Pricing Strategy"
                  value={onboardingData?.pricingSales?.pricingStrategy ?? ''}
                  onChange={(value) => updateField('pricingSales', 'pricingStrategy', value)}
                  placeholder="How do you price your products/services?"
                  multiline
                />

                <FormField
                  label="Discount Policy"
                  value={onboardingData?.pricingSales?.discountPolicy ?? ''}
                  onChange={(value) => updateField('pricingSales', 'discountPolicy', value)}
                  placeholder="What discounts do you offer?"
                  multiline
                />

                <FormField
                  label="First-Time Buyer Incentive"
                  value={onboardingData?.pricingSales?.firstTimeBuyerIncentive ?? ''}
                  onChange={(value) => updateField('pricingSales', 'firstTimeBuyerIncentive', value)}
                  placeholder="Special offers for first-time customers"
                />
              </div>
            )}

            {/* Agent Goals Section */}
            {activeSection === 'agent-goals' && (
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
                  Agent Goals & Objectives
                </h2>
                
                <FormField
                  label="Primary Objective"
                  value={onboardingData?.agentGoals?.primaryObjective ?? ''}
                  onChange={(value) => updateField('agentGoals', 'primaryObjective', value)}
                  placeholder="What is the main goal for your AI agent? (e.g., sales, lead generation, support)"
                />

                <FormField
                  label="Success Metrics"
                  value={onboardingData?.agentGoals?.successMetrics ?? ''}
                  onChange={(value) => updateField('agentGoals', 'successMetrics', value)}
                  placeholder="How do you measure success?"
                  multiline
                />

                <FormField
                  label="Escalation Rules"
                  value={onboardingData?.agentGoals?.escalationRules ?? ''}
                  onChange={(value) => updateField('agentGoals', 'escalationRules', value)}
                  placeholder="When should the agent escalate to a human?"
                  multiline
                />
              </div>
            )}

            {/* Agent Personality Section */}
            {activeSection === 'agent-personality' && (
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
                  Agent Personality
                </h2>
                
                <FormField
                  label="Tone & Style"
                  value={onboardingData?.agentPersonality?.tone ?? ''}
                  onChange={(value) => updateField('agentPersonality', 'tone', value)}
                  placeholder="e.g., Professional, Friendly, Casual, Enthusiastic"
                />

                <FormField
                  label="Formality Level"
                  value={onboardingData?.agentPersonality?.formalityLevel ?? ''}
                  onChange={(value) => updateField('agentPersonality', 'formalityLevel', value)}
                  placeholder="e.g., High (formal language), Low (casual), Moderate"
                />

                <FormField
                  label="Use of Humor"
                  value={onboardingData?.agentPersonality?.useOfHumor ?? ''}
                  onChange={(value) => updateField('agentPersonality', 'useOfHumor', value)}
                  placeholder="e.g., High, Low, None, Moderate"
                />

                <FormField
                  label="Empathy Level"
                  value={onboardingData?.agentPersonality?.empathyLevel ?? ''}
                  onChange={(value) => updateField('agentPersonality', 'empathyLevel', value)}
                  placeholder="e.g., High (very empathetic), Low (focus on facts), Moderate"
                />
              </div>
            )}

            {/* Save Button at Bottom */}
            {hasChanges && (
              <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #333' }}>
                <button
                  onClick={() => void handleSave()}
                  disabled={saving}
                  style={{
                    padding: '0.875rem 2.5rem',
                    backgroundColor: primaryColor,
                    color: '#fff',
                    border: 'none',
                    borderRadius: '0.5rem',
                    fontWeight: '600',
                    fontSize: '1rem',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.5 : 1
                  }}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => window.location.reload()}
                  style={{
                    padding: '0.875rem 2rem',
                    backgroundColor: 'transparent',
                    color: '#999',
                    border: '1px solid #333',
                    borderRadius: '0.5rem',
                    fontWeight: '600',
                    fontSize: '1rem',
                    cursor: 'pointer',
                    marginLeft: '1rem'
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  rows = 3
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
}) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#fff', marginBottom: '0.5rem' }}>
        {label}
      </label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          style={{
            width: '100%',
            padding: '0.75rem',
            backgroundColor: '#0a0a0a',
            border: '1px solid #333',
            borderRadius: '0.5rem',
            color: '#fff',
            fontSize: '0.875rem',
            resize: 'vertical',
            fontFamily: 'inherit'
          }}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            width: '100%',
            padding: '0.75rem',
            backgroundColor: '#0a0a0a',
            border: '1px solid #333',
            borderRadius: '0.5rem',
            color: '#fff',
            fontSize: '0.875rem'
          }}
        />
      )}
    </div>
  );
}













