'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth'
import { logger } from '@/lib/logger/logger';
import type { PrefillResult, FieldConfidence } from '@/lib/onboarding/types';
import {
  PrefillStatusBanner,
  PrefillLoadingState,
  PrefilledFieldWrapper
} from '@/components/onboarding/PrefillIndicator';
import { useToast } from '@/hooks/useToast';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface FormDataBase {
  [key: string]: string | number | boolean | File[] | unknown[];
}

type FormData = FormDataBase;

interface TextInputFieldProps {
  label: string;
  field: string;
  placeholder: string;
  required?: boolean;
  formData: FormData;
  updateField: (field: string, value: unknown) => void;
}

interface TextAreaFieldProps {
  label: string;
  field: string;
  placeholder: string;
  rows?: number;
  helper?: string;
  required?: boolean;
  formData: FormData;
  updateField: (field: string, value: unknown) => void;
}

// ============================================================================
// COMPONENTS
// ============================================================================

// Move components OUTSIDE to prevent re-creation on every render
function TextInputField({ label, field, placeholder, required, formData, updateField }: TextInputFieldProps) {
  const value = formData[field];
  const stringValue = typeof value === 'string' ? value : '';

  return (
    <div>
      <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
        {label} {required && '*'}
      </label>
      <input
        type="text"
        value={stringValue}
        onChange={(e) => updateField(field, e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '0.75rem',
          backgroundColor: '#0a0a0a',
          border: '1px solid #333',
          borderRadius: '0.5rem',
          color: '#fff',
          fontSize: '1rem'
        }}
      />
    </div>
  );
}

function TextAreaField({ label, field, placeholder, rows = 4, helper, required, formData, updateField }: TextAreaFieldProps) {
  const value = formData[field];
  const stringValue = typeof value === 'string' ? value : '';

  return (
    <div>
      <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
        {label} {required && '*'}
      </label>
      <textarea
        value={stringValue}
        onChange={(e) => updateField(field, e.target.value)}
        placeholder={placeholder}
        rows={rows}
        style={{
          width: '100%',
          padding: '0.75rem',
          backgroundColor: '#0a0a0a',
          border: '1px solid #333',
          borderRadius: '0.5rem',
          color: '#fff',
          fontSize: '1rem',
          resize: 'vertical',
          fontFamily: 'inherit'
        }}
      />
      {helper && (
        <div style={{ color: '#666', fontSize: '0.75rem', marginTop: '0.5rem' }}>
          {helper}
        </div>
      )}
    </div>
  );
}

export default function OnboardingWizard() {
  const router = useRouter();
  const { user: _user } = useAuth();
  const toast = useToast();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    // Step 1: Business Basics
    businessName: '',
    industry: '',
    website: '',
    faqPageUrl: '',
    socialMediaUrls: [] as string[],
    companySize: '',
    
    // Step 2: Business Understanding
    problemSolved: '',
    uniqueValue: '',
    whyBuy: '',
    whyNotBuy: '',
    
    // Step 3: Products/Services Overview
    primaryOffering: '',
    priceRange: '',
    targetCustomer: '',
    customerDemographics: '',
    
    // Step 4: Product/Service Details
    topProducts: '',
    productComparison: '',
    seasonalOfferings: '',
    whoShouldNotBuy: '',
    
    // Step 5: Pricing & Sales Strategy
    pricingStrategy: '',
    discountPolicy: '',
    volumeDiscounts: '',
    firstTimeBuyerIncentive: '',
    financingOptions: '',
    
    // Step 6: Operations & Fulfillment
    geographicCoverage: '',
    deliveryTimeframes: '',
    inventoryConstraints: '',
    capacityLimitations: '',
    
    // Step 7: Policies & Guarantees
    returnPolicy: '',
    warrantyTerms: '',
    cancellationPolicy: '',
    satisfactionGuarantee: '',
    
    // Step 8: Agent Goals & Objectives
    primaryObjective: 'sales',
    secondaryObjectives: [] as string[],
    successMetrics: '',
    escalationRules: '',
    
    // Step 9: Sales Process & Flow
    typicalSalesFlow: '',
    qualificationCriteria: '',
    discoveryQuestions: '',
    closingStrategy: '',
    
    // Step 10: Objection Handling
    commonObjections: '',
    priceObjections: '',
    timeObjections: '',
    competitorObjections: '',
    
    // Step 11: Customer Service
    supportScope: '',
    technicalSupport: '',
    orderTracking: '',
    complaintResolution: '',
    
    // Step 12: Agent Personality & Identity
    tone: 'professional',
    agentName: '',
    ownerName: '', // Business owner's name for personalized greetings
    greeting: '',
    closingMessage: '',
    
    // Step 13: Behavioral Controls
    closingAggressiveness: 5,
    questionFrequency: 3,
    responseLength: 'balanced',
    proactiveLevel: 5,
    
    // Step 14: Knowledge Base Upload
    uploadedDocs: [] as File[],
    urls: [] as string[],
    faqs: '',
    competitorUrls: [] as string[],
    
    // Step 15: Compliance & Legal
    requiredDisclosures: '',
    privacyCompliance: false,
    industryRegulations: '',
    prohibitedTopics: '',
    
    // Step 16: Advanced Configuration (Optional)
    enableAdvanced: false,
    customFunctions: [] as unknown[],
    conversationFlowLogic: '',
    responseLengthLimit: 0,
    industryTemplate: '',
    knowledgePriority: [] as unknown[],
    
    // Step 17: Idle Timeout (Organization Level)
    idleTimeoutMinutes: 30,
    
    // Step 18: Objection Handling Strategies
    priceObjectionStrategy: '',
    competitorObjectionStrategy: '',
    timingObjectionStrategy: '',
    authorityObjectionStrategy: '',
    needObjectionStrategy: '',
    
    // Step 19: Customer Sentiment Handling
    angryCustomerApproach: '',
    confusedCustomerApproach: '',
    readyToBuySignals: '',
    disengagementSignals: '',
    frustratedCustomerApproach: '',
    
    // Step 20: Discovery Question Frameworks
    budgetQualificationQuestions: '',
    timelineQuestions: '',
    authorityQuestions: '',
    needIdentificationQuestions: '',
    painPointQuestions: '',
    
    // Step 21: Closing Techniques
    assumptiveCloseConditions: '',
    urgencyCreationTactics: '',
    trialCloseTriggers: '',
    softCloseApproaches: '',
    
    // Step 22: Rules & Restrictions
    prohibitedBehaviors: '',
    behavioralBoundaries: '',
    mustAlwaysMention: '',
    neverMention: '',
    
    // Step 23: Training Metrics Selection
    selectedTrainingMetrics: [] as string[],
    
    // Step 24: Sales Materials Upload
    uploadedSalesMaterials: [] as File[],
  });

  const totalSteps = 24;

  const updateField = useCallback((field: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // Type guard to check if a field can accept string values from prefill
  const isStringField = (field: string): boolean => {
    const stringFields = [
      'businessName', 'industry', 'website', 'faqPageUrl', 'companySize',
      'businessLocation', 'contactEmail', 'contactPhone',
      'problemSolved', 'uniqueValue', 'whyBuy', 'whyNotBuy',
      'primaryOffering', 'priceRange', 'targetCustomer', 'customerDemographics',
      'topProducts', 'productComparison', 'seasonalOfferings', 'whoShouldNotBuy',
      'pricingStrategy', 'discountPolicy', 'volumeDiscounts', 'firstTimeBuyerIncentive', 'financingOptions',
      'geographicCoverage', 'deliveryTimeframes', 'inventoryConstraints', 'capacityLimitations',
      'returnPolicy', 'warrantyTerms', 'cancellationPolicy', 'satisfactionGuarantee',
      'successMetrics', 'escalationRules',
      'typicalSalesFlow', 'qualificationCriteria', 'discoveryQuestions', 'closingStrategy',
      'commonObjections', 'priceObjections', 'timeObjections', 'competitorObjections',
      'supportScope', 'technicalSupport', 'orderTracking', 'complaintResolution',
      'tone', 'agentName', 'ownerName', 'greeting', 'closingMessage', 'responseLength',
      'faqs', 'requiredDisclosures', 'industryRegulations', 'prohibitedTopics',
      'conversationFlowLogic', 'industryTemplate',
      'priceObjectionStrategy', 'competitorObjectionStrategy', 'timingObjectionStrategy',
      'authorityObjectionStrategy', 'needObjectionStrategy',
      'angryCustomerApproach', 'confusedCustomerApproach', 'readyToBuySignals',
      'disengagementSignals', 'frustratedCustomerApproach',
      'budgetQualificationQuestions', 'timelineQuestions', 'authorityQuestions',
      'needIdentificationQuestions', 'painPointQuestions',
      'assumptiveCloseConditions', 'urgencyCreationTactics', 'trialCloseTriggers', 'softCloseApproaches',
      'prohibitedBehaviors', 'behavioralBoundaries', 'mustAlwaysMention', 'neverMention',
      'technicalCapabilities',
    ];
    return stringFields.includes(field);
  };

  // Type guard to check if a field can accept string array values from prefill
  const isStringArrayField = (field: string): boolean => {
    const stringArrayFields = [
      'socialMediaUrls', 'secondaryObjectives', 'urls', 'competitorUrls', 'selectedTrainingMetrics'
    ];
    return stringArrayFields.includes(field);
  };

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
      window.scrollTo(0, 0);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo(0, 0);
    }
  };

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState('');
  
  // Prefill state
  const [isPrefilling, setIsPrefilling] = useState(false);
  const [prefillResult, setPrefillResult] = useState<PrefillResult | null>(null);
  const [confirmedFields, setConfirmedFields] = useState<Set<string>>(new Set());
  const [rejectedFields, setRejectedFields] = useState<Set<string>>(new Set());

  // Prefill onboarding data from website
  const handlePrefill = async () => {
    if (!formData.website) {
      toast.warning('Please enter your website URL first');
      return;
    }

    setIsPrefilling(true);
    try {
      const response = await fetch('/api/onboarding/prefill', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          websiteUrl: formData.website,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to prefill data');
      }

      const result = await response.json() as PrefillResult;
      setPrefillResult(result);

      // Auto-apply high-confidence fields (type-safe)
      setFormData(prev => {
        const updatedFormData = { ...prev };
        for (const [fieldName, fieldConfidence] of Object.entries(result.fieldConfidences)) {
          if (fieldConfidence.suggestedAction === 'auto-fill' && fieldConfidence.value) {
            const value = fieldConfidence.value;

            // Type-safe assignment: only assign to compatible fields
            if (Array.isArray(value) && isStringArrayField(fieldName)) {
              // Assign string array to string array fields
              (updatedFormData as Record<string, unknown>)[fieldName] = value;
            } else if (typeof value === 'string' && isStringField(fieldName)) {
              // Assign string to string fields
              (updatedFormData as Record<string, unknown>)[fieldName] = value;
            } else {
              // Log warning for incompatible field types (shouldn't happen with proper prefill engine)
              logger.warn('Prefill field type mismatch', {
                fieldName,
                valueType: Array.isArray(value) ? 'array' : typeof value,
                expectedType: 'string or string[]',
              });
            }
          }
        }
        return updatedFormData;
      });

      logger.info('Prefill complete', {
        overallConfidence: result.overallConfidence,
        fieldsPrefilledCount: Object.keys(result.fieldConfidences).length,
      });
    } catch (error) {
      logger.error('Prefill failed', error instanceof Error ? error : undefined);
      toast.error('Failed to analyze website. You can still continue with manual entry.');
    } finally {
      setIsPrefilling(false);
    }
  };

  const handleConfirmField = (fieldName: string) => {
    setConfirmedFields(prev => new Set([...prev, fieldName]));
  };

  const handleRejectField = (fieldName: string) => {
    setRejectedFields(prev => new Set([...prev, fieldName]));
  };

  const handleStartFresh = () => {
    setPrefillResult(null);
    setConfirmedFields(new Set());
    setRejectedFields(new Set());
    // Reset form to initial state
    setFormData({
      businessName: '',
      industry: '',
      website: formData.website, // Keep the website URL
      faqPageUrl: '',
      socialMediaUrls: [],
      companySize: '',
      problemSolved: '',
      uniqueValue: '',
      whyBuy: '',
      whyNotBuy: '',
      primaryOffering: '',
      priceRange: '',
      targetCustomer: '',
      customerDemographics: '',
      topProducts: '',
      productComparison: '',
      seasonalOfferings: '',
      whoShouldNotBuy: '',
      pricingStrategy: '',
      discountPolicy: '',
      volumeDiscounts: '',
      firstTimeBuyerIncentive: '',
      financingOptions: '',
      geographicCoverage: '',
      deliveryTimeframes: '',
      inventoryConstraints: '',
      capacityLimitations: '',
      returnPolicy: '',
      warrantyTerms: '',
      cancellationPolicy: '',
      satisfactionGuarantee: '',
      primaryObjective: 'sales',
      secondaryObjectives: [],
      successMetrics: '',
      escalationRules: '',
      typicalSalesFlow: '',
      qualificationCriteria: '',
      discoveryQuestions: '',
      closingStrategy: '',
      commonObjections: '',
      priceObjections: '',
      timeObjections: '',
      competitorObjections: '',
      supportScope: '',
      technicalSupport: '',
      orderTracking: '',
      complaintResolution: '',
      tone: 'professional',
      agentName: '',
      ownerName: '',
      greeting: '',
      closingMessage: '',
      closingAggressiveness: 5,
      questionFrequency: 3,
      responseLength: 'balanced',
      proactiveLevel: 5,
      uploadedDocs: [],
      urls: [],
      faqs: '',
      competitorUrls: [],
      requiredDisclosures: '',
      privacyCompliance: false,
      industryRegulations: '',
      prohibitedTopics: '',
      enableAdvanced: false,
      customFunctions: [],
      conversationFlowLogic: '',
      responseLengthLimit: 0,
      industryTemplate: '',
      knowledgePriority: [],
      idleTimeoutMinutes: 30,
      priceObjectionStrategy: '',
      competitorObjectionStrategy: '',
      timingObjectionStrategy: '',
      authorityObjectionStrategy: '',
      needObjectionStrategy: '',
      angryCustomerApproach: '',
      confusedCustomerApproach: '',
      readyToBuySignals: '',
      disengagementSignals: '',
      frustratedCustomerApproach: '',
      budgetQualificationQuestions: '',
      timelineQuestions: '',
      authorityQuestions: '',
      needIdentificationQuestions: '',
      painPointQuestions: '',
      assumptiveCloseConditions: '',
      urgencyCreationTactics: '',
      trialCloseTriggers: '',
      softCloseApproaches: '',
      prohibitedBehaviors: '',
      behavioralBoundaries: '',
      mustAlwaysMention: '',
      neverMention: '',
      selectedTrainingMetrics: [],
      uploadedSalesMaterials: [],
    });
  };

  const getFieldConfidence = (fieldName: string): FieldConfidence | null => {
    return prefillResult?.fieldConfidences?.[fieldName] ?? null;
  };

  const completeOnboarding = async () => {
    setIsAnalyzing(true);
    setAnalysisProgress('Saving onboarding data...');
    
    // Save onboarding data
    const onboardingData = {
      ...formData,
      completedAt: new Date(),
    };

    try {
      // Get Firebase auth token
      const { getCurrentUser } = await import('@/lib/auth/auth-service');
      const currentUser = getCurrentUser();
      
      if (!currentUser) {
        throw new Error('You must be logged in to complete onboarding');
      }
      
      const token = await currentUser.getIdToken();
      
      // Process onboarding via API (server will save everything using Admin SDK)
      setAnalysisProgress('Building AI agent persona...');
      
      setAnalysisProgress('Processing knowledge base...');
      const response = await fetch('/api/agent/process-onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          onboardingData,
        }),
      });

      const result = await response.json() as { success: boolean; error?: string };

      if (result.success) {
        setAnalysisProgress('✅ Complete! Your AI agent is ready for training.');
        setTimeout(() => {
          setIsAnalyzing(false);
          toast.success('Onboarding complete! Your AI agent persona has been created and is ready for training. You can now go to the Training Center to train your agent.', 6000);
          router.push(`/settings/ai-agents/training`);
        }, 2000);
      } else {
        throw new Error((result.error !== '' && result.error != null) ? result.error : 'Failed to process onboarding');
      }
    } catch (error) {
      const errorMessage = error instanceof Error && error.message ? error.message : 'Failed to complete onboarding. Please try again.';
      logger.error('Failed to complete onboarding:', error instanceof Error ? error : undefined, { file: 'page.tsx' });
      setIsAnalyzing(false);
      toast.error(`Error: ${errorMessage}`, 6000);
    }
  };

  const primaryColor = '#6366f1';

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#000', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '2rem'
    }}>
      <div style={{ maxWidth: '900px', width: '100%' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
            Build Your AI Sales Team
          </h1>
          <p style={{ color: '#666', fontSize: '1rem' }}>
            The more detail you provide, the smarter your agent will be
          </p>
        </div>

        {/* Progress Bar */}
        <div style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span style={{ color: '#999', fontSize: '0.875rem' }}>Step {currentStep} of {totalSteps}</span>
            <span style={{ color: '#999', fontSize: '0.875rem' }}>{Math.round((currentStep / totalSteps) * 100)}% Complete</span>
          </div>
          <div style={{ 
            height: '8px', 
            backgroundColor: '#1a1a1a', 
            borderRadius: '9999px',
            overflow: 'hidden'
          }}>
            <div style={{ 
              height: '100%', 
              width: `${(currentStep / totalSteps) * 100}%`,
              backgroundColor: primaryColor,
              transition: 'width 0.3s'
            }} />
          </div>
        </div>

        {/* Step Content */}
        <div style={{ 
          backgroundColor: '#1a1a1a', 
          border: '1px solid #333', 
          borderRadius: '1rem', 
          padding: '3rem',
          marginBottom: '2rem',
          minHeight: '500px'
        }}>
          {/* Step 1: Business Basics */}
          {currentStep === 1 && (
            <div>
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
                  Tell us about your business
                </div>
                <div style={{ color: '#666', fontSize: '0.875rem' }}>
                  Basic information to get started
                </div>
              </div>

              {/* Prefill Loading State */}
              {isPrefilling && <PrefillLoadingState />}

              {/* Prefill Status Banner */}
              {prefillResult && !isPrefilling && (
                <PrefillStatusBanner
                  overallConfidence={prefillResult.overallConfidence}
                  fieldsPrefilledCount={Object.keys(prefillResult.fieldConfidences).length}
                  totalFieldsCount={6}
                  fromCache={prefillResult.discoveryMetadata.fromCache}
                  onStartFresh={handleStartFresh}
                />
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Website URL - First field to enter */}
                <div>
                  <TextInputField label="Website URL" field="website" placeholder="https://yourwebsite.com" formData={formData} updateField={updateField} />
                  <div style={{ color: '#666', fontSize: '0.75rem', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                    We&apos;ll automatically analyze your website to learn about your company, products, and services
                  </div>
                  
                  {/* Auto-fill Button */}
                  {formData.website && !prefillResult && (
                    <button
                      onClick={() => void handlePrefill()}
                      disabled={isPrefilling}
                      style={{
                        marginTop: '0.75rem',
                        padding: '0.75rem 1.5rem',
                        backgroundColor: '#6366f1',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        cursor: isPrefilling ? 'not-allowed' : 'pointer',
                        opacity: isPrefilling ? 0.6 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <span>🪄</span>
                      <span>{isPrefilling ? 'Analyzing...' : 'Auto-fill from website'}</span>
                    </button>
                  )}
                </div>

                {/* Business Name with Prefill */}
                {(() => {
                  const fieldConfidence = getFieldConfidence('businessName');
                  return fieldConfidence ? (
                    <PrefilledFieldWrapper
                      fieldConfidence={fieldConfidence}
                      onConfirm={() => handleConfirmField('businessName')}
                      onReject={() => handleRejectField('businessName')}
                      isConfirmed={confirmedFields.has('businessName')}
                      isRejected={rejectedFields.has('businessName')}
                    >
                      <TextInputField formData={formData} updateField={updateField} label="Business Name" field="businessName" placeholder="e.g., Acme Outdoor Gear" required />
                    </PrefilledFieldWrapper>
                  ) : (
                    <TextInputField formData={formData} updateField={updateField} label="Business Name" field="businessName" placeholder="e.g., Acme Outdoor Gear" required />
                  );
                })()}

                {/* Industry with Prefill */}
                <div>
                  {(() => {
                    const fieldConfidence = getFieldConfidence('industry');
                    return fieldConfidence ? (
                      <PrefilledFieldWrapper
                        fieldConfidence={fieldConfidence}
                        onConfirm={() => handleConfirmField('industry')}
                        onReject={() => handleRejectField('industry')}
                        isConfirmed={confirmedFields.has('industry')}
                        isRejected={rejectedFields.has('industry')}
                      >
                      <div>
                        <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                          Industry *
                        </label>
                        <select
                          value={formData.industry}
                          onChange={(e) => updateField('industry', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            backgroundColor: '#0a0a0a',
                            border: '1px solid #333',
                            borderRadius: '0.5rem',
                            color: '#fff',
                            fontSize: '1rem'
                          }}
                        >
                          <option value="">Select your industry...</option>
                          <option value="retail">Retail / E-commerce</option>
                          <option value="services">Professional Services</option>
                          <option value="manufacturing">Manufacturing / Wholesale</option>
                          <option value="realestate">Real Estate</option>
                          <option value="hospitality">Hospitality / Tourism</option>
                          <option value="automotive">Automotive</option>
                          <option value="finance">Financial Services / Insurance</option>
                          <option value="education">Education / Training</option>
                          <option value="construction">Construction / Contracting</option>
                          <option value="legal">Legal Services</option>
                          <option value="fitness">Fitness / Wellness</option>
                          <option value="home_services">Home Services</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </PrefilledFieldWrapper>
                    ) : null;
                  })()}
                  {!getFieldConfidence('industry') && (
                    <div>
                      <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                        Industry *
                      </label>
                      <select
                        value={formData.industry}
                        onChange={(e) => updateField('industry', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          backgroundColor: '#0a0a0a',
                          border: '1px solid #333',
                          borderRadius: '0.5rem',
                          color: '#fff',
                          fontSize: '1rem'
                        }}
                      >
                        <option value="">Select your industry...</option>
                        <option value="retail">Retail / E-commerce</option>
                        <option value="services">Professional Services</option>
                        <option value="manufacturing">Manufacturing / Wholesale</option>
                        <option value="realestate">Real Estate</option>
                        <option value="hospitality">Hospitality / Tourism</option>
                        <option value="automotive">Automotive</option>
                        <option value="finance">Financial Services / Insurance</option>
                        <option value="education">Education / Training</option>
                        <option value="construction">Construction / Contracting</option>
                        <option value="legal">Legal Services</option>
                        <option value="fitness">Fitness / Wellness</option>
                        <option value="home_services">Home Services</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  )}
                </div>

                <TextInputField label="FAQ Page URL (optional)" field="faqPageUrl" placeholder="https://yourwebsite.com/faq" formData={formData} updateField={updateField} />
                <div style={{ color: '#666', fontSize: '0.75rem', marginTop: '-1rem', marginBottom: '0.5rem' }}>
                  Help your agent learn common questions and answers
                </div>

                <div>
                  <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                    Social Media URLs (optional)
                  </label>
                  <div style={{ color: '#666', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                    Help your agent understand your brand voice and customer interactions
                  </div>
                  {formData.socialMediaUrls.map((url, index) => (
                    <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <input
                        type="url"
                        value={url}
                        onChange={(e) => {
                          const updated = [...formData.socialMediaUrls];
                          updated[index] = e.target.value;
                          updateField('socialMediaUrls', updated);
                        }}
                        placeholder="https://facebook.com/yourpage or https://instagram.com/yourpage"
                        style={{
                          flex: 1,
                          padding: '0.75rem',
                          backgroundColor: '#0a0a0a',
                          border: '1px solid #333',
                          borderRadius: '0.5rem',
                          color: '#fff',
                          fontSize: '0.875rem'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = formData.socialMediaUrls.filter((_, i) => i !== index);
                          updateField('socialMediaUrls', updated);
                        }}
                        style={{
                          padding: '0.75rem 1rem',
                          backgroundColor: '#4c0f0f',
                          color: '#f87171',
                          border: 'none',
                          borderRadius: '0.5rem',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                          fontWeight: '600'
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => updateField('socialMediaUrls', [...formData.socialMediaUrls, ''])}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#222',
                      color: primaryColor,
                      border: '1px solid #333',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '600'
                    }}
                  >
                    + Add Social Media URL
                  </button>
                </div>

                <div>
                  <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                    Company Size *
                  </label>
                  <select
                    value={formData.companySize}
                    onChange={(e) => updateField('companySize', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      backgroundColor: '#0a0a0a',
                      border: '1px solid #333',
                      borderRadius: '0.5rem',
                      color: '#fff',
                      fontSize: '1rem'
                    }}
                  >
                    <option value="">Select...</option>
                    <option value="solo">Just me</option>
                    <option value="small">2-10 employees</option>
                    <option value="medium">11-50 employees</option>
                    <option value="large">51+ employees</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Business Understanding */}
          {currentStep === 2 && (
            <div>
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
                  What makes your business unique?
                </div>
                <div style={{ color: '#666', fontSize: '0.875rem' }}>
                  These answers will shape how your agent sells
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <TextAreaField formData={formData} updateField={updateField} 
                  label="What problem does your business solve for customers?" 
                  field="problemSolved" 
                  placeholder="e.g., We help outdoor enthusiasts find reliable, affordable gear so they can enjoy nature without breaking the bank"
                  helper="Be specific - this helps your agent understand your value proposition"
                  required
                />

                <TextAreaField formData={formData} updateField={updateField} 
                  label="What makes you different from competitors?" 
                  field="uniqueValue" 
                  placeholder="e.g., We offer lifetime warranties, free repairs, and expert guides with every purchase. Our gear is tested in extreme conditions."
                  helper="Your unique selling points - what competitors don&apos;t offer"
                  required
                />

                <TextAreaField formData={formData} updateField={updateField} 
                  label="Why do customers choose to buy from you?" 
                  field="whyBuy" 
                  placeholder="e.g., Quality products, expert advice, excellent customer service, fast shipping, satisfaction guarantee"
                  rows={3}
                  required
                />

                <TextAreaField formData={formData} updateField={updateField} 
                  label="What are common reasons customers DON'T buy?" 
                  field="whyNotBuy" 
                  placeholder="e.g., Price concerns, shipping time, not sure which product is right for them, prefer to see in-store first"
                  rows={3}
                  helper="Your agent will learn how to overcome these objections"
                  required
                />
              </div>
            </div>
          )}

          {/* Step 3: Products/Services Overview */}
          {currentStep === 3 && (
            <div>
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
                  What do you sell?
                </div>
                <div style={{ color: '#666', fontSize: '0.875rem' }}>
                  Overview of your offerings and target customers
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                    What do you primarily sell? *
                  </label>
                  <select
                    value={formData.primaryOffering}
                    onChange={(e) => updateField('primaryOffering', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      backgroundColor: '#0a0a0a',
                      border: '1px solid #333',
                      borderRadius: '0.5rem',
                      color: '#fff',
                      fontSize: '1rem'
                    }}
                  >
                    <option value="">Select...</option>
                    <option value="physical">Physical Products</option>
                    <option value="digital">Digital Products / Downloads</option>
                    <option value="services">Services / Consulting</option>
                    <option value="subscriptions">Subscriptions / Memberships</option>
                    <option value="appointments">Appointments / Bookings</option>
                    <option value="mixed">Mix of Products & Services</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                    Typical price range *
                  </label>
                  <select
                    value={formData.priceRange}
                    onChange={(e) => updateField('priceRange', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      backgroundColor: '#0a0a0a',
                      border: '1px solid #333',
                      borderRadius: '0.5rem',
                      color: '#fff',
                      fontSize: '1rem'
                    }}
                  >
                    <option value="">Select...</option>
                    <option value="under50">Under $50</option>
                    <option value="50-200">$50 - $200</option>
                    <option value="200-500">$200 - $500</option>
                    <option value="500-1000">$500 - $1,000</option>
                    <option value="1000-5000">$1,000 - $5,000</option>
                    <option value="5000-20000">$5,000 - $20,000</option>
                    <option value="20000plus">$20,000+</option>
                    <option value="varies">Varies significantly</option>
                  </select>
                </div>

                <TextAreaField formData={formData} updateField={updateField} 
                  label="Who is your ideal customer?" 
                  field="targetCustomer" 
                  placeholder="e.g., Outdoor enthusiasts aged 25-45, active lifestyle, values quality over price, environmentally conscious"
                  helper="Describe their demographics, psychographics, and buying behavior"
                  required
                />

                <TextAreaField formData={formData} updateField={updateField} 
                  label="Customer demographics & buying patterns" 
                  field="customerDemographics" 
                  placeholder="e.g., 60% male, 40% female. Most purchase during fall/spring. Average order $250. Repeat customer rate 45%."
                  rows={3}
                  helper="Any patterns your agent should know about your customers"
                />
              </div>
            </div>
          )}

          {/* Step 4: Product/Service Details */}
          {currentStep === 4 && (
            <div>
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
                  Product/Service Details
                </div>
                <div style={{ color: '#666', fontSize: '0.875rem' }}>
                  Help your agent understand what you offer in detail
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <TextAreaField formData={formData} updateField={updateField} 
                  label="Your top products/services (list 3-5)" 
                  field="topProducts" 
                  placeholder="1. Premium Backpack ($199) - 50L capacity, waterproof, lifetime warranty&#10;2. Camping Tent ($349) - 4-person, easy setup, all-weather&#10;3. Hiking Boots ($159) - Gore-Tex, ankle support, trail-tested"
                  rows={6}
                  helper="Include key features, benefits, and pricing"
                  required
                />

                <TextAreaField formData={formData} updateField={updateField} 
                  label="How do your products/services compare to competitors?" 
                  field="productComparison" 
                  placeholder="e.g., Our backpacks cost 20% more than budget brands but last 3x longer. Compared to premium brands, we're 30% cheaper with same quality. We're the only brand offering lifetime repairs."
                  rows={4}
                  helper="Competitive advantages your agent can use in conversations"
                />

                <TextAreaField formData={formData} updateField={updateField} 
                  label="Seasonal offerings or promotions" 
                  field="seasonalOfferings" 
                  placeholder="e.g., Winter sale (Nov-Jan) - 25% off winter gear. Summer clearance (Aug-Sep) - Last season models 40% off. Black Friday - Sitewide 30% off."
                  rows={3}
                  helper="Help your agent know when to mention special offers"
                />

                <TextAreaField formData={formData} updateField={updateField} 
                  label="Who should NOT buy from you? (Qualification criteria)" 
                  field="whoShouldNotBuy" 
                  placeholder="e.g., Casual users looking for cheapest option, people needing immediate delivery (same-day), international customers (we only ship USA), resellers (B2C only)"
                  rows={4}
                  helper="Help your agent qualify leads and set proper expectations"
                />
              </div>
            </div>
          )}

          {/* Step 5: Pricing & Sales Strategy */}
          {currentStep === 5 && (
            <div>
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
                  Pricing & Sales Strategy
                </div>
                <div style={{ color: '#666', fontSize: '0.875rem' }}>
                  How your agent should handle pricing and discounts
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                    Pricing strategy *
                  </label>
                  <select
                    value={formData.pricingStrategy}
                    onChange={(e) => updateField('pricingStrategy', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      backgroundColor: '#0a0a0a',
                      border: '1px solid #333',
                      borderRadius: '0.5rem',
                      color: '#fff',
                      fontSize: '1rem'
                    }}
                  >
                    <option value="">Select...</option>
                    <option value="fixed">Fixed pricing - no negotiation</option>
                    <option value="tiered">Tiered pricing - volume based</option>
                    <option value="custom">Custom quotes - varies by customer</option>
                    <option value="negotiable">Negotiable - some flexibility</option>
                    <option value="mixed">Mixed - depends on product/service</option>
                  </select>
                </div>

                <TextAreaField formData={formData} updateField={updateField} 
                  label="Discount policy - when can agent offer discounts?" 
                  field="discountPolicy" 
                  placeholder="e.g., First-time buyers: 10% off. Orders over $500: 15% off. Abandoned cart: Send 20% coupon after 24hrs. Never discount below 30% margin."
                  rows={4}
                  helper="Be specific about when and how much discount is allowed"
                  required
                />

                <TextAreaField formData={formData} updateField={updateField} 
                  label="Volume/bulk discount structure" 
                  field="volumeDiscounts" 
                  placeholder="e.g., 10-25 units: 10% off. 26-50 units: 15% off. 51+ units: 20% off + free shipping. Wholesale inquiries: escalate to sales manager."
                  rows={4}
                  helper="If applicable - how pricing changes with quantity"
                />

                <TextAreaField formData={formData} updateField={updateField} 
                  label="First-time buyer incentive" 
                  field="firstTimeBuyerIncentive" 
                  placeholder="e.g., 15% off first purchase with code WELCOME15. Free shipping on first order. Free gear guide ebook with first purchase."
                  rows={3}
                  helper="Special offers for new customers"
                />

                <TextAreaField formData={formData} updateField={updateField} 
                  label="Financing or payment plan options" 
                  field="financingOptions" 
                  placeholder="e.g., Affirm available for orders $200+. Pay in 4 with Klarna. Net 30 for approved business accounts. No credit check financing through Bread."
                  rows={3}
                  helper="Payment options besides upfront payment"
                />
              </div>
            </div>
          )}

          {/* Step 6: Operations & Fulfillment */}
          {currentStep === 6 && (
            <div>
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
                  Operations & Fulfillment
                </div>
                <div style={{ color: '#666', fontSize: '0.875rem' }}>
                  Delivery, coverage, and capacity details
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <TextAreaField formData={formData} updateField={updateField} 
                  label="Geographic coverage - where do you serve/ship?" 
                  field="geographicCoverage" 
                  placeholder="e.g., Shipping: All 50 US states. Free shipping over $100. International: Canada only ($25 flat rate). AK/HI: Additional $15 shipping."
                  rows={4}
                  helper="Your agent needs to know service areas and limitations"
                  required
                />

                <TextAreaField formData={formData} updateField={updateField} 
                  label="Delivery/service timeframes" 
                  field="deliveryTimeframes" 
                  placeholder="e.g., Standard shipping: 5-7 business days. Expedited: 2-3 business days. Services: First available appointment within 2 weeks. Custom orders: 3-4 week lead time."
                  rows={4}
                  helper="Set proper expectations with customers"
                  required
                />

                <TextAreaField formData={formData} updateField={updateField} 
                  label="Inventory constraints or stock issues" 
                  field="inventoryConstraints" 
                  placeholder="e.g., Popular items may backorder during peak season. Check real-time stock before promising availability. Made-to-order items non-refundable."
                  rows={3}
                  helper="Help your agent manage customer expectations"
                />

                <TextAreaField formData={formData} updateField={updateField} 
                  label="Capacity limitations (for service businesses)" 
                  field="capacityLimitations" 
                  placeholder="e.g., Book 2 weeks in advance. Max 4 projects simultaneously. Emergency service: 24hr response, 2x rate. Weekend work by request only."
                  rows={3}
                  helper="If applicable - scheduling and capacity constraints"
                />
              </div>
            </div>
          )}

          {/* Step 7: Policies & Guarantees */}
          {currentStep === 7 && (
            <div>
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
                  Policies & Guarantees
                </div>
                <div style={{ color: '#666', fontSize: '0.875rem' }}>
                  Returns, warranties, and customer protections
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <TextAreaField formData={formData} updateField={updateField} 
                  label="Return/refund policy" 
                  field="returnPolicy" 
                  placeholder="e.g., 30-day money-back guarantee. Items must be unused with tags. Free return shipping. Refund within 5-7 business days. Custom/clearance items final sale."
                  rows={4}
                  helper="Your agent needs to explain this clearly to build trust"
                  required
                />

                <TextAreaField formData={formData} updateField={updateField} 
                  label="Warranty terms" 
                  field="warrantyTerms" 
                  placeholder="e.g., Lifetime warranty on manufacturing defects. Normal wear excluded. Free repairs for life. Warranty transferable to new owner. Submit claim through website."
                  rows={4}
                  helper="Product guarantees and coverage details"
                />

                <TextAreaField formData={formData} updateField={updateField} 
                  label="Cancellation policy" 
                  field="cancellationPolicy" 
                  placeholder="e.g., Cancel before shipping: Full refund. After shipping: Subject to return policy. Services: Cancel 48hrs before appointment for full refund. Same-day cancellation: 50% fee."
                  rows={4}
                  helper="Order or appointment cancellation terms"
                />

                <TextAreaField formData={formData} updateField={updateField} 
                  label="Satisfaction guarantee" 
                  field="satisfactionGuarantee" 
                  placeholder="e.g., 100% satisfaction guaranteed or money back. If not happy, we'll make it right - exchange, credit, or refund. No questions asked within 30 days."
                  rows={3}
                  helper="Any additional guarantees or promises you make"
                />
              </div>
            </div>
          )}

          {/* Step 8: Agent Goals & Objectives */}
          {currentStep === 8 && (
            <div>
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
                  What should your agent accomplish?
                </div>
                <div style={{ color: '#666', fontSize: '0.875rem' }}>
                  Define success for your AI agent
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                    Primary Objective *
                  </label>
                  <select
                    value={formData.primaryObjective}
                    onChange={(e) => updateField('primaryObjective', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      backgroundColor: '#0a0a0a',
                      border: '1px solid #333',
                      borderRadius: '0.5rem',
                      color: '#fff',
                      fontSize: '1rem'
                    }}
                  >
                    <option value="sales">Close Sales (e-commerce, direct sales)</option>
                    <option value="leads">Generate Qualified Leads</option>
                    <option value="appointments">Book Appointments / Consultations</option>
                    <option value="support">Customer Support & Service</option>
                    <option value="mixed">Mixed (Sales + Support)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '1rem' }}>
                    Secondary Objectives (check all that apply)
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {[
                      { value: 'upsell', label: 'Upsell / Cross-sell Products' },
                      { value: 'collect_info', label: 'Collect Customer Information' },
                      { value: 'answer_questions', label: 'Answer Product Questions' },
                      { value: 'handle_returns', label: 'Handle Returns / Exchanges' },
                      { value: 'track_orders', label: 'Track Orders / Shipping' },
                      { value: 'provide_quotes', label: 'Provide Custom Quotes' },
                      { value: 'schedule_followup', label: 'Schedule Follow-up Contacts' },
                      { value: 'gather_feedback', label: 'Gather Customer Feedback' }
                    ].map((obj) => (
                      <label key={obj.value} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={formData.secondaryObjectives.includes(obj.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              updateField('secondaryObjectives', [...formData.secondaryObjectives, obj.value]);
                            } else {
                              updateField('secondaryObjectives', formData.secondaryObjectives.filter(v => v !== obj.value));
                            }
                          }}
                          style={{ width: '20px', height: '20px' }}
                        />
                        <span style={{ color: '#ccc', fontSize: '0.875rem' }}>{obj.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <TextAreaField formData={formData} updateField={updateField} 
                  label="Success metrics - how do you measure agent performance?" 
                  field="successMetrics" 
                  placeholder="e.g., Conversion rate >3%, Average order value >$200, Customer satisfaction >4.5/5, Response time <30 seconds, Escalation rate <10%"
                  rows={3}
                  helper="How will you know if your agent is successful?"
                />

                <TextAreaField formData={formData} updateField={updateField} 
                  label="When should the agent hand off to a human?" 
                  field="escalationRules" 
                  placeholder="e.g., Custom orders over $5,000, Technical issues requiring diagnostics, Angry/abusive customers, Refund requests over $500, Legal questions, Wholesale inquiries"
                  rows={4}
                  helper="Clear escalation criteria to prevent issues"
                  required
                />
              </div>
            </div>
          )}

          {/* Step 9: Sales Process & Flow */}
          {currentStep === 9 && (
            <div>
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
                  Your Sales Process
                </div>
                <div style={{ color: '#666', fontSize: '0.875rem' }}>
                  Teach your agent how you sell
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <TextAreaField formData={formData} updateField={updateField} 
                  label="Describe your typical sales flow (step-by-step)" 
                  field="typicalSalesFlow" 
                  placeholder="e.g., 1) Greet and identify need 2) Ask qualification questions 3) Recommend 2-3 products 4) Answer questions about features/shipping 5) Handle price objections 6) Explain warranty 7) Create urgency with limited stock 8) Close with discount code for first-time buyers"
                  rows={6}
                  helper="The exact process your agent should follow"
                  required
                />

                <TextAreaField formData={formData} updateField={updateField} 
                  label="Lead qualification criteria - how do you know they're a good fit?" 
                  field="qualificationCriteria" 
                  placeholder="e.g., Budget: $200+ for outdoor gear. Timeline: Ready to buy within 30 days. Use case: Active outdoor activities. Geography: USA only. Decision maker: Yes."
                  rows={4}
                  helper="What makes someone a qualified lead vs tire-kicker?"
                />

                <TextAreaField formData={formData} updateField={updateField} 
                  label="Discovery questions your agent should ask" 
                  field="discoveryQuestions" 
                  placeholder="e.g., What activities will you use this for? How often do you [activity]? What's your experience level? What's your budget range? When do you need this by? Have you used similar products before?"
                  rows={5}
                  helper="Questions to understand customer needs and qualify them"
                  required
                />

                <TextAreaField formData={formData} updateField={updateField} 
                  label="Your closing strategy - how do you ask for the sale?" 
                  field="closingStrategy" 
                  placeholder="e.g., Always ask for the sale after answering questions. Use assumptive close: 'Shall I add this to your cart?' Create urgency with stock levels. Offer first-time discount. Provide clear next steps. Follow up abandoned carts in 24hrs."
                  rows={5}
                  helper="Specific techniques your agent should use to close"
                  required
                />
              </div>
            </div>
          )}

          {/* Step 10: Objection Handling */}
          {currentStep === 10 && (
            <div>
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
                  Objection Handling
                </div>
                <div style={{ color: '#666', fontSize: '0.875rem' }}>
                  Teach your agent how to overcome common objections
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <TextAreaField formData={formData} updateField={updateField} 
                  label="Common customer objections and how to handle them" 
                  field="commonObjections" 
                  placeholder="e.g., 'I need to think about it' → Ask what specific concerns they have. 'I'll shop around' → Explain our price match guarantee. 'Not sure this will work' → Offer 30-day trial with free returns."
                  rows={6}
                  helper="List objections and your proven responses"
                  required
                />

                <TextAreaField formData={formData} updateField={updateField} 
                  label="Price objections - 'It's too expensive'" 
                  field="priceObjections" 
                  placeholder="e.g., Explain value vs cost (lasts 10 years). Compare to daily coffee cost. Highlight lifetime warranty saves money long-term. Offer payment plan. Show budget option. Emphasize we're 30% cheaper than premium brands with same quality."
                  rows={5}
                  helper="Specific strategies for price resistance"
                  required
                />

                <TextAreaField formData={formData} updateField={updateField} 
                  label="Time/urgency objections - 'I'll come back later'" 
                  field="timeObjections" 
                  placeholder="e.g., Mention current sale ends Friday. Low stock on popular items. Price going up next month. Hold item for 24hrs. Send follow-up email with additional 10% off."
                  rows={4}
                  helper="How to create urgency without being pushy"
                />

                <TextAreaField formData={formData} updateField={updateField} 
                  label="Competitor objections - 'I found it cheaper elsewhere'" 
                  field="competitorObjections" 
                  placeholder="e.g., Price match guarantee - we'll beat any verified price by 5%. Explain total cost of ownership (our warranty vs theirs). Show hidden fees competitors charge. Emphasize our customer service and free lifetime repairs."
                  rows={5}
                  helper="How to compete against other options"
                />
              </div>
            </div>
          )}

          {/* Step 11: Customer Service */}
          {currentStep === 11 && (
            <div>
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
                  Customer Service & Support
                </div>
                <div style={{ color: '#666', fontSize: '0.875rem' }}>
                  How your agent should handle support issues
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <TextAreaField formData={formData} updateField={updateField} 
                  label="What support issues can your agent handle?" 
                  field="supportScope" 
                  placeholder="e.g., Order status/tracking, Product questions, Returns/exchanges, Size/fit guidance, Account issues, Shipping changes, Payment questions, Product care instructions"
                  rows={4}
                  helper="What customer service topics your agent can address"
                  required
                />

                <TextAreaField formData={formData} updateField={updateField} 
                  label="Technical support capabilities" 
                  field="technicalSupport" 
                  placeholder="e.g., Basic troubleshooting from manual. Setup instructions. Common issues and fixes. Escalate hardware failures. Can walk through product assembly. Cannot diagnose complex technical problems."
                  rows={4}
                  helper="What technical help can your agent provide?"
                />

                <TextAreaField formData={formData} updateField={updateField} 
                  label="Order tracking and status updates" 
                  field="orderTracking" 
                  placeholder="e.g., Check order status in real-time. Provide tracking numbers. Explain shipping delays. Update shipping address before shipment. Cannot cancel after processing (escalate to support)."
                  rows={4}
                  helper="How agent handles order inquiries"
                />

                <TextAreaField formData={formData} updateField={updateField} 
                  label="Complaint resolution process" 
                  field="complaintResolution" 
                  placeholder="e.g., Listen empathetically. Apologize for issue. Offer immediate solution (refund/replacement/discount). Escalate if >$200 issue or customer very angry. Log complaint for review. Follow up in 48hrs."
                  rows={5}
                  helper="How to handle unhappy customers"
                  required
                />
              </div>
            </div>
          )}

          {/* Step 12: Agent Personality & Identity */}
          {currentStep === 12 && (
            <div>
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
                  Your AI Assistant Identity
                </div>
                <div style={{ color: '#666', fontSize: '0.875rem' }}>
                  Name and personalize your AI business partner
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* AI Assistant Name - Primary Focus */}
                <div style={{
                  padding: '1.5rem',
                  backgroundColor: 'rgba(99, 102, 241, 0.1)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  borderRadius: '0.75rem'
                }}>
                  <div style={{ marginBottom: '1rem' }}>
                    <span style={{ fontSize: '1.25rem', marginRight: '0.5rem' }}>🤖</span>
                    <span style={{ color: '#a5b4fc', fontWeight: '600', fontSize: '1rem' }}>What is the name of your AI Assistant?</span>
                  </div>
                  <TextInputField
                    formData={formData}
                    updateField={updateField}
                    label="AI Assistant Name *"
                    field="agentName"
                    placeholder="e.g., Alex, Maya, Jordan, Riley..."
                    required
                  />
                  <div style={{ color: '#818cf8', fontSize: '0.8rem', marginTop: '0.75rem' }}>
                    Your AI assistant will introduce itself using this name and serve as your dedicated business partner
                  </div>
                </div>

                {/* Owner Name for Personalization */}
                <TextInputField
                  formData={formData}
                  updateField={updateField}
                  label="Your Name (Business Owner)"
                  field="ownerName"
                  placeholder="e.g., John, Sarah, David..."
                />
                <div style={{ color: '#666', fontSize: '0.75rem', marginTop: '-1rem' }}>
                  Your AI assistant will greet you by name: &quot;Hello [Your Name], I am [Assistant Name]...&quot;
                </div>

                <div>
                  <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                    Tone *
                  </label>
                  <select
                    value={formData.tone}
                    onChange={(e) => updateField('tone', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      backgroundColor: '#0a0a0a',
                      border: '1px solid #333',
                      borderRadius: '0.5rem',
                      color: '#fff',
                      fontSize: '1rem'
                    }}
                  >
                    <option value="professional">Professional & Polished</option>
                    <option value="friendly">Friendly & Conversational</option>
                    <option value="enthusiastic">Enthusiastic & Energetic</option>
                    <option value="empathetic">Empathetic & Understanding</option>
                    <option value="technical">Technical & Expert</option>
                    <option value="consultative">Consultative & Advisory</option>
                  </select>
                </div>

                <TextAreaField formData={formData} updateField={updateField} 
                  label="Opening greeting" 
                  field="greeting" 
                  placeholder="e.g., Hi! I'm here to help you find the perfect outdoor gear. What are you looking for today?"
                  rows={2}
                  helper="First message customers see - make it welcoming"
                  required
                />

                <TextAreaField formData={formData} updateField={updateField} 
                  label="Closing message (after sale or end of conversation)" 
                  field="closingMessage" 
                  placeholder="e.g., Thanks for choosing us! You'll get a confirmation email shortly. Feel free to reach out if you have any questions. Happy adventuring!"
                  rows={3}
                  helper="How to wrap up conversations professionally"
                />
              </div>
            </div>
          )}

          {/* Step 13: Behavioral Controls */}
          {currentStep === 13 && (
            <div>
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
                  Behavioral Controls
                </div>
                <div style={{ color: '#666', fontSize: '0.875rem' }}>
                  Fine-tune how your agent behaves
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.75rem' }}>
                    Closing Aggressiveness: {formData.closingAggressiveness}/10
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={formData.closingAggressiveness}
                    onChange={(e) => updateField('closingAggressiveness', parseInt(e.target.value))}
                    style={{ width: '100%' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                    <span>Passive (1-3): Helpful, doesn&apos;t push</span>
                    <span>Balanced (4-7): Guides to purchase</span>
                    <span>Aggressive (8-10): Always closing</span>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.75rem' }}>
                    Question Frequency: Ask {formData.questionFrequency} questions before recommending
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="7"
                    value={formData.questionFrequency}
                    onChange={(e) => updateField('questionFrequency', parseInt(e.target.value))}
                    style={{ width: '100%' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                    <span>Quick (1-2): Fast recommendations</span>
                    <span>Balanced (3-4): Standard discovery</span>
                    <span>Thorough (5-7): Deep understanding</span>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                    Response Length Preference
                  </label>
                  <select
                    value={formData.responseLength}
                    onChange={(e) => updateField('responseLength', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      backgroundColor: '#0a0a0a',
                      border: '1px solid #333',
                      borderRadius: '0.5rem',
                      color: '#fff',
                      fontSize: '1rem'
                    }}
                  >
                    <option value="concise">Concise (1-2 sentences, quick responses)</option>
                    <option value="balanced">Balanced (3-4 sentences, detailed but brief)</option>
                    <option value="detailed">Detailed (5+ sentences, thorough explanations)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.75rem' }}>
                    Proactive vs Reactive: {formData.proactiveLevel}/10
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={formData.proactiveLevel}
                    onChange={(e) => updateField('proactiveLevel', parseInt(e.target.value))}
                    style={{ width: '100%' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                    <span>Reactive (1-3): Only answers questions</span>
                    <span>Balanced (4-7): Suggests & answers</span>
                    <span>Proactive (8-10): Volunteers info</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 14: Knowledge Base Upload */}
          {currentStep === 14 && (
            <div>
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
                  Upload Your Knowledge Base
                </div>
                <div style={{ color: '#666', fontSize: '0.875rem' }}>
                  The more you provide, the smarter your agent
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                    Upload Documents
                  </label>
                  <div style={{
                    border: '2px dashed #333',
                    borderRadius: '0.75rem',
                    padding: '3rem 2rem',
                    textAlign: 'center',
                    backgroundColor: '#0a0a0a',
                    cursor: 'pointer'
                  }}>
                    <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📄</div>
                    <div style={{ color: '#ccc', fontSize: '1rem', marginBottom: '0.5rem', fontWeight: '600' }}>
                      Drag & drop files or click to browse
                    </div>
                    <div style={{ color: '#666', fontSize: '0.875rem', marginBottom: '1rem' }}>
                      PDFs, Excel, Word, images - Product catalogs, price lists, manuals, policies
                    </div>
                    <button style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: primaryColor,
                      color: '#fff',
                      border: 'none',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '600'
                    }}>
                      Choose Files
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                    Website URLs (we&apos;ll extract the content)
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <input
                      type="url"
                      placeholder="https://yoursite.com/products"
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        backgroundColor: '#0a0a0a',
                        border: '1px solid #333',
                        borderRadius: '0.5rem',
                        color: '#fff',
                        fontSize: '1rem'
                      }}
                    />
                    <button style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: '#222',
                      color: primaryColor,
                      border: '1px solid #333',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '600'
                    }}>
                      + Add
                    </button>
                  </div>
                  <div style={{ color: '#666', fontSize: '0.75rem' }}>
                    We&apos;ll analyze these pages for products, pricing, FAQs, and policies
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                    Competitor Websites (optional - for competitive intelligence)
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <input
                      type="url"
                      placeholder="https://competitor.com"
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        backgroundColor: '#0a0a0a',
                        border: '1px solid #333',
                        borderRadius: '0.5rem',
                        color: '#fff',
                        fontSize: '1rem'
                      }}
                    />
                    <button style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: '#222',
                      color: primaryColor,
                      border: '1px solid #333',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '600'
                    }}>
                      + Add
                    </button>
                  </div>
                  <div style={{ color: '#666', fontSize: '0.75rem' }}>
                    Your agent will learn how you compare to competitors
                  </div>
                </div>

                <TextAreaField formData={formData} updateField={updateField} 
                  label="FAQs or additional knowledge (paste here)" 
                  field="faqs" 
                  placeholder="Paste frequently asked questions, policies, or any other information your agent should know..."
                  rows={8}
                  helper="This will be added to your agent's knowledge base"
                />
              </div>
            </div>
          )}

          {/* Step 15: Compliance & Legal */}
          {currentStep === 15 && (
            <div>
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
                  Compliance & Legal
                </div>
                <div style={{ color: '#666', fontSize: '0.875rem' }}>
                  Important disclosures and restrictions
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <TextAreaField formData={formData} updateField={updateField} 
                  label="Required disclosures (legal/regulatory)" 
                  field="requiredDisclosures" 
                  placeholder="e.g., 'I am an AI assistant, not a human representative' OR 'These statements have not been evaluated by the FDA' OR 'Past performance does not guarantee future results'"
                  rows={4}
                  helper="Legally required statements your agent must include"
                />

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.privacyCompliance}
                      onChange={(e) => updateField('privacyCompliance', e.target.checked)}
                      style={{ width: '20px', height: '20px' }}
                    />
                    <div>
                      <div style={{ color: '#ccc', fontSize: '0.875rem', fontWeight: '600' }}>
                        Enable Privacy & Data Protection Compliance (GDPR/CCPA)
                      </div>
                      <div style={{ color: '#666', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                        Includes data collection notices and opt-out options
                      </div>
                    </div>
                  </label>
                </div>

                <TextAreaField formData={formData} updateField={updateField} 
                  label="Industry-specific regulations" 
                  field="industryRegulations" 
                  placeholder="e.g., SEC regulations (financial), FTC guidelines (advertising), PCI DSS (payments), Industry certifications required"
                  rows={4}
                  helper="Any special compliance requirements for your industry"
                />

                <TextAreaField formData={formData} updateField={updateField} 
                  label="Prohibited topics (what agent should NOT discuss)" 
                  field="prohibitedTopics" 
                  placeholder="e.g., Medical advice, Legal advice, Political opinions, Personal opinions on competitors, Guarantees we can&apos;t fulfill, Off-label use of products"
                  rows={5}
                  helper="Topics your agent must avoid to prevent liability"
                  required
                />

                <div style={{
                  padding: '1.5rem',
                  backgroundColor: '#0a0a0a',
                  border: '1px solid #f59e0b',
                  borderRadius: '0.75rem',
                  marginTop: '1rem'
                }}>
                  <div style={{ color: '#f59e0b', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                    ⚠️ Important: Review Before Launch
                  </div>
                  <div style={{ color: '#ccc', fontSize: '0.875rem' }}>
                    You&apos;ll have a chance to train and test your agent before it goes live. Make sure all information is accurate and compliant with your industry regulations.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 16: Advanced Configuration */}
          {currentStep === 16 && (
            <div>
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
                  Advanced Configuration (Optional)
                </div>
                <div style={{ color: '#666', fontSize: '0.875rem' }}>
                  For power users who want more control
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Industry Template Selection */}
                <div>
                  <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                    Start with an Industry Template (Optional)
                  </label>
                  <select
                    value={formData.industryTemplate}
                    onChange={(e) => updateField('industryTemplate', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      backgroundColor: '#0a0a0a',
                      border: '1px solid #333',
                      borderRadius: '0.5rem',
                      color: '#fff',
                      fontSize: '1rem'
                    }}
                  >
                    <option value="">None - Use my custom configuration</option>
                    <option value="b2b_highticket">High-Ticket B2B Sales</option>
                    <option value="ecommerce_complex">E-commerce with Complex Shipping Rules</option>
                    <option value="appointments">Appointment-Based Service Business</option>
                    <option value="retail_inventory">Retail with Inventory Management</option>
                  </select>
                  <div style={{ color: '#666', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                    Templates provide pre-configured settings you can customize
                  </div>
                </div>

                {/* Custom Function Definitions */}
                <div>
                  <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.75rem' }}>
                    Custom Function Definitions
                  </label>
                  <div style={{
                    backgroundColor: '#0a0a0a',
                    border: '1px solid #333',
                    borderRadius: '0.75rem',
                    padding: '1.5rem'
                  }}>
                    <div style={{ color: '#ccc', fontSize: '0.875rem', marginBottom: '1rem' }}>
                      Define custom actions your agent can perform (e.g., check inventory, calculate shipping, verify credit)
                    </div>
                    <button style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: '#222',
                      color: primaryColor,
                      border: '1px solid #333',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '600'
                    }}>
                      + Add Custom Function
                    </button>
                    {formData.customFunctions.length > 0 && (
                      <div style={{ marginTop: '1rem', color: '#666', fontSize: '0.875rem' }}>
                        {formData.customFunctions.length} custom function(s) defined
                      </div>
                    )}
                  </div>
                </div>

                {/* Advanced Behavioral Controls */}
                <div>
                  <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.75rem' }}>
                    Advanced Behavioral Controls
                  </label>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <TextAreaField formData={formData} updateField={updateField} 
                      label="Conversation Flow Logic" 
                      field="conversationFlowLogic" 
                      placeholder="e.g., First ask about budget, then use case, then timeline. If budget > $1000, mention premium line first. If timeline urgent, skip detailed discovery and recommend top 3 products immediately."
                      rows={5}
                      helper="Define the exact order and conditions for conversation flow"
                    />

                    <div>
                      <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                        Strict Response Length Limit (characters)
                      </label>
                      <input
                        type="number"
                        value={formData.responseLengthLimit || ''}
                        onChange={(e) => updateField('responseLengthLimit', parseInt(e.target.value) || 0)}
                        placeholder="0 = no limit"
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          backgroundColor: '#0a0a0a',
                          border: '1px solid #333',
                          borderRadius: '0.5rem',
                          color: '#fff',
                          fontSize: '1rem'
                        }}
                      />
                      <div style={{ color: '#666', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                        Force responses to be under this character count (useful for SMS/chat widgets)
                      </div>
                    </div>
                  </div>
                </div>

                {/* Compliance & Legal Advanced */}
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.privacyCompliance}
                      onChange={(e) => updateField('privacyCompliance', e.target.checked)}
                      style={{ width: '20px', height: '20px' }}
                    />
                    <div>
                      <div style={{ color: '#ccc', fontSize: '0.875rem', fontWeight: '600' }}>
                        Enable Enhanced Privacy & Compliance Mode
                      </div>
                      <div style={{ color: '#666', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                        GDPR, CCPA, SOC 2 compliance with data collection notices and opt-outs
                      </div>
                    </div>
                  </label>
                </div>

                {/* Knowledge Priority */}
                <div>
                  <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.75rem' }}>
                    Knowledge Source Priority
                  </label>
                  <div style={{
                    backgroundColor: '#0a0a0a',
                    border: '1px solid #333',
                    borderRadius: '0.75rem',
                    padding: '1.5rem'
                  }}>
                    <div style={{ color: '#ccc', fontSize: '0.875rem', marginBottom: '1rem' }}>
                      Set priority levels for different knowledge sources when answering questions
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', color: '#999', fontSize: '0.875rem' }}>
                      <div>1. Product Catalog (always highest priority)</div>
                      <div>2. Official Documentation (uploaded PDFs)</div>
                      <div>3. Website Content (scraped URLs)</div>
                      <div>4. FAQs & Custom Instructions</div>
                      <div>5. General Training Data</div>
                    </div>
                  </div>
                </div>

                {/* Skip/Continue Option */}
                <div style={{
                  padding: '1.5rem',
                  backgroundColor: '#0a0a0a',
                  border: `1px solid ${  primaryColor}`,
                  borderRadius: '0.75rem',
                  marginTop: '1rem',
                  textAlign: 'center'
                }}>
                  <div style={{ color: primaryColor, fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                    💡 Most Users Skip This Step
                  </div>
                  <div style={{ color: '#ccc', fontSize: '0.875rem' }}>
                    The configurations from Steps 1-15 are sufficient for 95% of users. You can always come back and configure advanced settings later from the Agent Persona page.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 17: Idle Timeout */}
          {currentStep === 17 && (
            <div>
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
                  Idle Timeout Settings
                </div>
                <div style={{ color: '#666', fontSize: '0.875rem' }}>
                  Organization-wide setting for all agents
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                    Idle Timeout (Minutes)
                  </label>
                  <input
                    type="number"
                    value={formData.idleTimeoutMinutes}
                    onChange={(e) => updateField('idleTimeoutMinutes', parseInt(e.target.value) || 30)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      backgroundColor: '#0a0a0a',
                      border: '1px solid #333',
                      borderRadius: '0.5rem',
                      color: '#fff',
                      fontSize: '1rem'
                    }}
                  />
                  <div style={{ color: '#666', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                    How long to wait before ending an inactive conversation (default: 30 minutes)
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 18: Objection Handling Strategies */}
          {currentStep === 18 && (
            <div>
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
                  🛡️ Objection Handling Strategies
                </div>
                <div style={{ color: '#666', fontSize: '0.875rem' }}>
                  Define how your agent should handle common objections
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <TextAreaField formData={formData} updateField={updateField} 
                  label="Price Objection Strategy" 
                  field="priceObjectionStrategy" 
                  placeholder='e.g., "When customer says too expensive, emphasize ROI and break down cost per use. Offer payment plans if applicable. Compare to competitor pricing showing value gap."'
                  rows={3}
                  helper="How should the agent respond when customers say it's too expensive?"
                />
                
                <TextAreaField formData={formData} updateField={updateField} 
                  label="Competitor Objection Strategy" 
                  field="competitorObjectionStrategy" 
                  placeholder='e.g., "Acknowledge competitor strengths, then highlight our unique differentiators: 24/7 support, lifetime warranty, and free installation."'
                  rows={3}
                  helper="How to respond when customers mention competitors?"
                />
                
                <TextAreaField formData={formData} updateField={updateField} 
                  label="Timing Objection Strategy" 
                  field="timingObjectionStrategy" 
                  placeholder='e.g., "Respect their timeline but create soft urgency around limited inventory or upcoming price increases. Offer to follow up at their preferred time."'
                  rows={3}
                  helper="How to handle 'not ready to buy now' objections?"
                />
                
                <TextAreaField formData={formData} updateField={updateField} 
                  label="Authority Objection Strategy" 
                  field="authorityObjectionStrategy" 
                  placeholder='e.g., "Ask who the decision maker is and what criteria they care about. Offer to send materials they can share. Request permission to follow up."'
                  rows={3}
                  helper="How to respond when they need approval from someone else?"
                />
                
                <TextAreaField formData={formData} updateField={updateField} 
                  label="Need Objection Strategy" 
                  field="needObjectionStrategy" 
                  placeholder='e.g., "Ask deeper questions to uncover hidden needs. Share case studies of similar customers who didn&apos;t think they needed it but saw great results."'
                  rows={3}
                  helper="What to do when customer doesn&apos;t see the need?"
                />
              </div>
            </div>
          )}

          {/* Step 19: Customer Sentiment Handling */}
          {currentStep === 19 && (
            <div>
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
                  🤝 Customer Sentiment Handling
                </div>
                <div style={{ color: '#666', fontSize: '0.875rem' }}>
                  Define how your agent should adapt to different customer emotions
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <TextAreaField formData={formData} updateField={updateField} 
                  label="Angry Customer Approach" 
                  field="angryCustomerApproach" 
                  placeholder='e.g., "Apologize first, empathize with frustration, take ownership of the issue, and immediately offer 2-3 concrete solutions. Escalate if anger persists."'
                  rows={3}
                  helper="How should the agent handle frustrated or angry customers?"
                />
                
                <TextAreaField formData={formData} updateField={updateField} 
                  label="Confused Customer Approach" 
                  field="confusedCustomerApproach" 
                  placeholder='e.g., "Simplify language, use analogies, break complex concepts into steps. Ask if they want a quick overview or detailed explanation."'
                  rows={3}
                  helper="How to help customers who don&apos;t understand?"
                />
                
                <TextAreaField formData={formData} updateField={updateField} 
                  label="Ready-to-Buy Signals" 
                  field="readyToBuySignals" 
                  placeholder='e.g., "Asks about payment options, shipping timeline, availability. Uses present tense (when I get this, not if). Asks detailed post-purchase questions."'
                  rows={3}
                  helper="What signals indicate the customer is ready to purchase?"
                />
                
                <TextAreaField formData={formData} updateField={updateField} 
                  label="Disengagement Signals" 
                  field="disengagementSignals" 
                  placeholder='e.g., "One-word responses, long delays, stops asking questions, says need to think about it without follow-up questions."'
                  rows={3}
                  helper="What signals show the customer is losing interest?"
                />
                
                <TextAreaField formData={formData} updateField={updateField} 
                  label="Frustrated Customer Approach" 
                  field="frustratedCustomerApproach" 
                  placeholder='e.g., "Acknowledge their frustration, validate their feelings, offer to simplify or speed up the process. Provide direct answers without fluff."'
                  rows={3}
                  helper="How to handle mildly frustrated customers (before they become angry)?"
                />
              </div>
            </div>
          )}

          {/* Step 20: Discovery Question Frameworks */}
          {currentStep === 20 && (
            <div>
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
                  ❓ Discovery Question Frameworks
                </div>
                <div style={{ color: '#666', fontSize: '0.875rem' }}>
                  Define the strategic questions your agent should ask to understand customer needs
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <TextAreaField formData={formData} updateField={updateField} 
                  label="Budget Qualification Questions" 
                  field="budgetQualificationQuestions" 
                  placeholder='e.g., "What budget range are you working with? Are you looking for premium or value options? Is this a personal purchase or business expense?"'
                  rows={3}
                  helper="Questions to understand their budget without being pushy"
                />
                
                <TextAreaField formData={formData} updateField={updateField} 
                  label="Timeline Questions" 
                  field="timelineQuestions" 
                  placeholder='e.g., "When do you need this by? Is this urgent or are you planning ahead? What happens if we miss that deadline?"'
                  rows={3}
                  helper="Questions to understand their urgency and timing"
                />
                
                <TextAreaField formData={formData} updateField={updateField} 
                  label="Authority Questions" 
                  field="authorityQuestions" 
                  placeholder='e.g., "Are you the decision maker or will others be involved? What factors will they care about most? Who has final approval?"'
                  rows={3}
                  helper="Questions to identify if they can make the purchase decision"
                />
                
                <TextAreaField formData={formData} updateField={updateField} 
                  label="Need Identification Questions" 
                  field="needIdentificationQuestions" 
                  placeholder='e.g., "What problem are you trying to solve? What have you tried before? What would the ideal solution look like for you?"'
                  rows={3}
                  helper="Questions to uncover their true needs and pain points"
                />
                
                <TextAreaField formData={formData} updateField={updateField} 
                  label="Pain Point Questions" 
                  field="painPointQuestions" 
                  placeholder='e.g., "What&apos;s the biggest challenge you&apos;re facing right now? What happens if this problem isn&apos;t solved? How much is this costing you?"'
                  rows={3}
                  helper="Questions to understand the severity and impact of their problem"
                />
              </div>
            </div>
          )}

          {/* Step 21: Closing Techniques */}
          {currentStep === 21 && (
            <div>
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
                  🎯 Closing Techniques
                </div>
                <div style={{ color: '#666', fontSize: '0.875rem' }}>
                  Define when and how your agent should move toward closing the sale
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <TextAreaField formData={formData} updateField={updateField} 
                  label="Assumptive Close Conditions" 
                  field="assumptiveCloseConditions" 
                  placeholder='e.g., "Use assumptive close when customer asks about shipping timeline, payment options, or availability. Phrases: Would you like this shipped to your business or home address? Let me get this ordered for you today."'
                  rows={3}
                  helper="When and how to use assumptive closing language"
                />
                
                <TextAreaField formData={formData} updateField={updateField} 
                  label="Urgency Creation Tactics" 
                  field="urgencyCreationTactics" 
                  placeholder='e.g., "Mention limited inventory (if true), upcoming price increases, seasonal demand, or time-sensitive promotions. Always be honest - never fabricate urgency."'
                  rows={3}
                  helper="How to create genuine urgency without being pushy"
                />
                
                <TextAreaField formData={formData} updateField={updateField} 
                  label="Trial Close Triggers" 
                  field="trialCloseTriggers" 
                  placeholder='e.g., "After answering 3+ questions positively, ask: How does that sound so far? or On a scale of 1-10, how close is this to what you need?"'
                  rows={3}
                  helper="When to test readiness to buy with trial closes"
                />
                
                <TextAreaField formData={formData} updateField={updateField} 
                  label="Soft Close Approaches" 
                  field="softCloseApproaches" 
                  placeholder='e.g., "For hesitant customers: Would you like me to reserve one while you think it over? or What would need to happen for this to be a yes?"'
                  rows={3}
                  helper="Gentle closing techniques for uncertain customers"
                />
              </div>
            </div>
          )}

          {/* Step 22: Rules & Restrictions */}
          {currentStep === 22 && (
            <div>
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
                  ⚖️ Agent Rules & Restrictions
                </div>
                <div style={{ color: '#666', fontSize: '0.875rem' }}>
                  Define clear behavioral boundaries for your agent
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <TextAreaField formData={formData} updateField={updateField} 
                  label="Prohibited Behaviors" 
                  field="prohibitedBehaviors" 
                  placeholder='e.g., "Never discuss sports, politics, or religion. Don&apos;t make medical claims. Don&apos;t negotiate below minimum price. Don&apos;t share competitor pricing specifics."'
                  rows={3}
                  helper="Things the agent should NEVER do or discuss"
                />
                
                <TextAreaField formData={formData} updateField={updateField} 
                  label="Behavioral Boundaries" 
                  field="behavioralBoundaries" 
                  placeholder='e.g., "Remain professional at all times. Don&apos;t use slang or emojis excessively. Don&apos;t be overly familiar with first-time customers. Escalate sensitive topics immediately."'
                  rows={3}
                  helper="General guidelines for appropriate behavior"
                />
                
                <TextAreaField formData={formData} updateField={updateField} 
                  label="Must Always Mention" 
                  field="mustAlwaysMention" 
                  placeholder='e.g., "Free shipping on orders over $50. 30-day money-back guarantee. 24/7 customer support available."'
                  rows={3}
                  helper="Key points the agent should consistently bring up"
                />
                
                <TextAreaField formData={formData} updateField={updateField} 
                  label="Never Mention" 
                  field="neverMention" 
                  placeholder='e.g., "Past product recalls. Discontinued product lines. Internal company issues. Specific competitor weaknesses."'
                  rows={3}
                  helper="Topics the agent should avoid bringing up"
                />
              </div>
            </div>
          )}

          {/* Step 23: Training Metrics Selection */}
          {currentStep === 23 && (
            <div>
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
                  📊 Training Metrics Selection
                </div>
                <div style={{ color: '#666', fontSize: '0.875rem' }}>
                  Choose 5-6 metrics you want to focus on when training your agent
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#0a2a1a', border: '1px solid #0a4a2a', borderRadius: '0.5rem' }}>
                <div style={{ color: '#10b981', fontSize: '0.875rem' }}>
                  💡 These metrics will appear in your Training Center. Focus on what matters most to your sales process.
                </div>
              </div>

              {/* Training Metrics by Category */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Core Sales Skills */}
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fff', marginBottom: '1rem' }}>
                    Core Sales Skills
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                    {[
                      { id: 'objection-handling', label: 'Objection Handling', icon: '🛡️' },
                      { id: 'product-knowledge', label: 'Product Knowledge', icon: '📚' },
                      { id: 'tone-professionalism', label: 'Tone & Professionalism', icon: '🎭' },
                      { id: 'closing-skills', label: 'Closing Skills', icon: '🎯' },
                      { id: 'discovery-questions', label: 'Discovery Questions', icon: '❓' },
                      { id: 'empathy-rapport', label: 'Empathy & Rapport', icon: '🤝' },
                    ].map((metric) => (
                      <label
                        key={metric.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          padding: '1rem',
                          backgroundColor: formData.selectedTrainingMetrics.includes(metric.id) ? '#1a1a3a' : '#0a0a0a',
                          border: formData.selectedTrainingMetrics.includes(metric.id) ? `2px solid ${primaryColor}` : '1px solid #333',
                          borderRadius: '0.5rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={formData.selectedTrainingMetrics.includes(metric.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              updateField('selectedTrainingMetrics', [...formData.selectedTrainingMetrics, metric.id]);
                            } else {
                              updateField('selectedTrainingMetrics', formData.selectedTrainingMetrics.filter((m: string) => m !== metric.id));
                            }
                          }}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '1.25rem' }}>{metric.icon}</span>
                        <span style={{ color: '#fff', fontSize: '0.875rem', fontWeight: '500' }}>{metric.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Advanced Techniques */}
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fff', marginBottom: '1rem' }}>
                    Advanced Techniques
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                    {[
                      { id: 'response-speed', label: 'Response Speed', icon: '⚡' },
                      { id: 'active-listening', label: 'Active Listening', icon: '🧠' },
                      { id: 'value-communication', label: 'Value Communication', icon: '💰' },
                      { id: 'urgency-creation', label: 'Urgency Creation', icon: '🔥' },
                      { id: 'storytelling', label: 'Storytelling', icon: '🎪' },
                      { id: 'problem-identification', label: 'Problem Identification', icon: '🤔' },
                    ].map((metric) => (
                      <label
                        key={metric.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          padding: '1rem',
                          backgroundColor: formData.selectedTrainingMetrics.includes(metric.id) ? '#1a1a3a' : '#0a0a0a',
                          border: formData.selectedTrainingMetrics.includes(metric.id) ? `2px solid ${primaryColor}` : '1px solid #333',
                          borderRadius: '0.5rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={formData.selectedTrainingMetrics.includes(metric.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              updateField('selectedTrainingMetrics', [...formData.selectedTrainingMetrics, metric.id]);
                            } else {
                              updateField('selectedTrainingMetrics', formData.selectedTrainingMetrics.filter((m: string) => m !== metric.id));
                            }
                          }}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '1.25rem' }}>{metric.icon}</span>
                        <span style={{ color: '#fff', fontSize: '0.875rem', fontWeight: '500' }}>{metric.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Customer Management */}
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fff', marginBottom: '1rem' }}>
                    Customer Management
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                    {[
                      { id: 'difficult-customer-handling', label: 'Difficult Customer Handling', icon: '😡' },
                      { id: 'needs-assessment', label: 'Needs Assessment', icon: '📊' },
                      { id: 'qualification-accuracy', label: 'Qualification Accuracy', icon: '🔍' },
                      { id: 'follow-up-effectiveness', label: 'Follow-Up Effectiveness', icon: '🚀' },
                      { id: 'customer-satisfaction', label: 'Customer Satisfaction', icon: '😊' },
                      { id: 'solution-matching', label: 'Solution Matching', icon: '🧩' },
                    ].map((metric) => (
                      <label
                        key={metric.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          padding: '1rem',
                          backgroundColor: formData.selectedTrainingMetrics.includes(metric.id) ? '#1a1a3a' : '#0a0a0a',
                          border: formData.selectedTrainingMetrics.includes(metric.id) ? `2px solid ${primaryColor}` : '1px solid #333',
                          borderRadius: '0.5rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={formData.selectedTrainingMetrics.includes(metric.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              updateField('selectedTrainingMetrics', [...formData.selectedTrainingMetrics, metric.id]);
                            } else {
                              updateField('selectedTrainingMetrics', formData.selectedTrainingMetrics.filter((m: string) => m !== metric.id));
                            }
                          }}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '1.25rem' }}>{metric.icon}</span>
                        <span style={{ color: '#fff', fontSize: '0.875rem', fontWeight: '500' }}>{metric.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Strategic */}
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fff', marginBottom: '1rem' }}>
                    Strategic
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                    {[
                      { id: 'competitive-positioning', label: 'Competitive Positioning', icon: '🏆' },
                      { id: 'upsell-crosssell', label: 'Upsell/Cross-sell', icon: '📈' },
                    ].map((metric) => (
                      <label
                        key={metric.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          padding: '1rem',
                          backgroundColor: formData.selectedTrainingMetrics.includes(metric.id) ? '#1a1a3a' : '#0a0a0a',
                          border: formData.selectedTrainingMetrics.includes(metric.id) ? `2px solid ${primaryColor}` : '1px solid #333',
                          borderRadius: '0.5rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={formData.selectedTrainingMetrics.includes(metric.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              updateField('selectedTrainingMetrics', [...formData.selectedTrainingMetrics, metric.id]);
                            } else {
                              updateField('selectedTrainingMetrics', formData.selectedTrainingMetrics.filter((m: string) => m !== metric.id));
                            }
                          }}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '1.25rem' }}>{metric.icon}</span>
                        <span style={{ color: '#fff', fontSize: '0.875rem', fontWeight: '500' }}>{metric.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Selection Counter */}
                <div style={{ 
                  padding: '1rem', 
                  backgroundColor: formData.selectedTrainingMetrics.length >= 5 && formData.selectedTrainingMetrics.length <= 6 ? '#0a2a1a' : '#2a2a0a',
                  border: `1px solid ${formData.selectedTrainingMetrics.length >= 5 && formData.selectedTrainingMetrics.length <= 6 ? '#0a4a2a' : '#4a4a0a'}`,
                  borderRadius: '0.5rem',
                  textAlign: 'center'
                }}>
                  <div style={{ 
                    color: formData.selectedTrainingMetrics.length >= 5 && formData.selectedTrainingMetrics.length <= 6 ? '#10b981' : '#fbbf24',
                    fontSize: '0.875rem',
                    fontWeight: '600'
                  }}>
                    {formData.selectedTrainingMetrics.length} / 5-6 metrics selected
                    {formData.selectedTrainingMetrics.length < 5 && ' (Select at least 5)'}
                    {formData.selectedTrainingMetrics.length > 6 && ' (We recommend focusing on 5-6)'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 24: Sales Materials Upload */}
          {currentStep === 24 && (
            <div>
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
                  📚 Sales Materials Upload (Optional)
                </div>
                <div style={{ color: '#666', fontSize: '0.875rem' }}>
                  Upload sales training books, playbooks, or methodologies for AI to extract techniques
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div style={{ padding: '1.5rem', backgroundColor: '#0a2a1a', border: '1px solid #0a4a2a', borderRadius: '0.75rem' }}>
                  <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#10b981', marginBottom: '0.75rem' }}>
                    🚀 Pro Tip: Upload Proven Sales Methodologies
                  </div>
                  <div style={{ color: '#10b981', fontSize: '0.875rem', marginBottom: '1rem', lineHeight: '1.6' }}>
                    Upload books like:
                    <ul style={{ marginTop: '0.5rem', marginLeft: '1.5rem' }}>
                      <li>NEPQ Black Book of Questions by Jeremy Miner</li>
                      <li>SPIN Selling by Neil Rackham</li>
                      <li>The Challenger Sale by Matthew Dixon</li>
                      <li>Your internal sales playbooks and scripts</li>
                    </ul>
                  </div>
                  <div style={{ color: '#10b981', fontSize: '0.75rem', fontStyle: 'italic' }}>
                    Our AI will extract proven strategies and automatically apply them to your agent&apos;s persona.
                  </div>
                </div>

                {/* File Upload Area */}
                <div>
                  <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.75rem' }}>
                    Upload Sales Materials (PDF, DOCX)
                  </label>
                  <div style={{
                    border: '2px dashed #333',
                    borderRadius: '0.75rem',
                    padding: '2rem',
                    textAlign: 'center',
                    backgroundColor: '#0a0a0a',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? []);
                        updateField('uploadedSalesMaterials', [...formData.uploadedSalesMaterials, ...files]);
                      }}
                      style={{ display: 'none' }}
                      id="sales-materials-upload"
                    />
                    <label htmlFor="sales-materials-upload" style={{ cursor: 'pointer' }}>
                      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📤</div>
                      <div style={{ color: '#fff', fontWeight: '600', marginBottom: '0.5rem' }}>
                        Click to upload or drag and drop
                      </div>
                      <div style={{ color: '#666', fontSize: '0.875rem' }}>
                        PDF, DOC, DOCX up to 50MB each
                      </div>
                    </label>
                  </div>

                  {/* Uploaded Files List */}
                  {formData.uploadedSalesMaterials.length > 0 && (
                    <div style={{ marginTop: '1rem' }}>
                      <div style={{ color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                        Uploaded Files ({formData.uploadedSalesMaterials.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {formData.uploadedSalesMaterials.map((file: File, idx: number) => (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.75rem',
                              backgroundColor: '#1a1a1a',
                              border: '1px solid #333',
                              borderRadius: '0.5rem'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <span style={{ fontSize: '1.5rem' }}>📄</span>
                              <div>
                                <div style={{ color: '#fff', fontSize: '0.875rem', fontWeight: '500' }}>
                                  {file.name}
                                </div>
                                <div style={{ color: '#666', fontSize: '0.75rem' }}>
                                  {(file.size / 1024 / 1024).toFixed(2)} MB
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                updateField('uploadedSalesMaterials', formData.uploadedSalesMaterials.filter((_file, i) => i !== idx));
                              }}
                              style={{
                                padding: '0.5rem',
                                backgroundColor: 'transparent',
                                border: 'none',
                                color: '#ef4444',
                                cursor: 'pointer',
                                fontSize: '1.25rem'
                              }}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Skip Option */}
                <div style={{ padding: '1rem', backgroundColor: '#1a1a0a', border: '1px solid #3a3a0a', borderRadius: '0.5rem', textAlign: 'center' }}>
                  <div style={{ color: '#999', fontSize: '0.875rem' }}>
                    Don&apos;t have materials to upload? No problem! Your agent will still work great with the information you&apos;ve already provided. You can always add materials later.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: currentStep === 1 ? '#1a1a1a' : '#222',
              color: currentStep === 1 ? '#666' : '#fff',
              border: '1px solid #333',
              borderRadius: '0.5rem',
              cursor: currentStep === 1 ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: '600'
            }}
          >
            ← Previous
          </button>

          <div style={{ color: '#666', fontSize: '0.875rem' }}>
            Step {currentStep} of {totalSteps}
          </div>

          {currentStep < totalSteps ? (
            <button
              onClick={nextStep}
              style={{
                padding: '0.75rem 2rem',
                backgroundColor: primaryColor,
                color: '#fff',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '600'
              }}
            >
              Continue →
            </button>
          ) : (
            <>
              {isAnalyzing ? (
                <div style={{
                  padding: '2rem',
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '0.75rem',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
                  <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#fff', marginBottom: '0.5rem' }}>
                    Analyzing Your Company...
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '1.5rem' }}>
                    {analysisProgress || 'Processing...'}
                  </div>
                  <div style={{
                    width: '100%',
                    height: '4px',
                    backgroundColor: '#333',
                    borderRadius: '2px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: '100%',
                      height: '100%',
                      backgroundColor: primaryColor,
                      animation: 'pulse 2s ease-in-out infinite'
                    }} />
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '1rem' }}>
                    This may take a few minutes. Your agent is learning about your company, products, and services...
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => void completeOnboarding()}
                  style={{
                    padding: '1rem 2.5rem',
                    background: `linear-gradient(135deg, ${primaryColor}, #8b5cf6)`,
                    color: '#fff',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                letterSpacing: '0.05em',
                boxShadow: `0 10px 40px ${primaryColor}33`
              }}
            >
              🚀 Start Training Your AI Agent
            </button>
          )}
            </>
          )}
        </div>

        {/* Progress Indicator Dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '2rem' }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              style={{
                width: i + 1 === currentStep ? '24px' : '8px',
                height: '8px',
                borderRadius: '9999px',
                backgroundColor: i + 1 <= currentStep ? primaryColor : '#333',
                transition: 'all 0.3s'
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
