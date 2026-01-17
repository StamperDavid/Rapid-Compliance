'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import { logger } from '@/lib/logger/logger';
import type { BrandDNA } from '@/types/organization';
import type { TTSEngineType, TTSVoice } from '@/lib/voice/tts/types';
import { TTS_PROVIDER_INFO, DEFAULT_TTS_CONFIGS } from '@/lib/voice/tts/types';

// Workforce Identity Configuration
interface WorkforceIdentity {
  // Core Identity
  workforceName: string;
  tagline: string;
  personalityArchetype: 'professional' | 'friendly' | 'consultative' | 'energetic' | 'calm';

  // Brand DNA
  brandDNA: BrandDNA;

  // Voice Configuration
  voiceEngine: TTSEngineType;
  voiceId: string;
  voiceName: string;

  // Agent Appearance (future: avatars)
  avatarStyle: 'abstract' | 'human' | 'icon' | 'custom';
  primaryColor: string;

  // Behavior Settings
  responseStyle: 'concise' | 'balanced' | 'detailed';
  proactivityLevel: number;
  empathyLevel: number;
}

const PERSONALITY_ARCHETYPES = [
  {
    id: 'professional',
    name: 'Professional',
    description: 'Polished, formal, business-focused',
    emoji: '👔',
    tone: 'Authoritative yet approachable'
  },
  {
    id: 'friendly',
    name: 'Friendly',
    description: 'Warm, welcoming, personable',
    emoji: '😊',
    tone: 'Casual and conversational'
  },
  {
    id: 'consultative',
    name: 'Consultative',
    description: 'Expert advisor, solution-focused',
    emoji: '🎯',
    tone: 'Thoughtful and analytical'
  },
  {
    id: 'energetic',
    name: 'Energetic',
    description: 'Enthusiastic, dynamic, motivating',
    emoji: '⚡',
    tone: 'Upbeat and inspiring'
  },
  {
    id: 'calm',
    name: 'Calm',
    description: 'Patient, reassuring, steady',
    emoji: '🌊',
    tone: 'Soothing and supportive'
  },
];

const AVATAR_STYLES = [
  { id: 'abstract', name: 'Abstract', preview: '◈' },
  { id: 'human', name: 'Human', preview: '👤' },
  { id: 'icon', name: 'Icon', preview: '🤖' },
  { id: 'custom', name: 'Custom Logo', preview: '✨' },
];

export default function IdentityRefinementPage() {
  const router = useRouter();
  const params = useParams();
  const orgId = params.orgId as string;
  const { user } = useAuth();
  const { theme } = useOrgTheme();

  // Step state
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;

  // Loading states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingVoice, setTestingVoice] = useState(false);

  // Voice state
  const [voices, setVoices] = useState<TTSVoice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Identity state
  const [identity, setIdentity] = useState<WorkforceIdentity>({
    workforceName: '',
    tagline: '',
    personalityArchetype: 'professional',
    brandDNA: {
      companyDescription: '',
      uniqueValue: '',
      targetAudience: '',
      toneOfVoice: 'professional',
      communicationStyle: '',
      keyPhrases: [],
      avoidPhrases: [],
      industry: '',
      competitors: [],
    },
    voiceEngine: 'native',
    voiceId: '',
    voiceName: '',
    avatarStyle: 'abstract',
    primaryColor: '#6366f1',
    responseStyle: 'balanced',
    proactivityLevel: 5,
    empathyLevel: 7,
  });

  // New phrase inputs
  const [newKeyPhrase, setNewKeyPhrase] = useState('');
  const [newAvoidPhrase, setNewAvoidPhrase] = useState('');

  const primaryColor = theme?.colors?.primary?.main || '#6366f1';

  // Load existing data
  useEffect(() => {
    loadExistingIdentity();
  }, [orgId]);

  // Load voices when engine changes
  useEffect(() => {
    loadVoices(identity.voiceEngine);
  }, [identity.voiceEngine, orgId]);

  const loadExistingIdentity = async () => {
    try {
      setLoading(true);

      const { isFirebaseConfigured } = await import('@/lib/firebase/config');
      if (!isFirebaseConfigured) {
        logger.warn('Firebase not configured, using defaults', { file: 'identity-refine-page.tsx' });
        setLoading(false);
        return;
      }

      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');

      // Load organization data (includes brandDNA)
      const orgData = await FirestoreService.get(COLLECTIONS.ORGANIZATIONS, orgId);

      // Load onboarding data for pre-population
      const onboardingData = await FirestoreService.get(
        `${COLLECTIONS.ORGANIZATIONS}/${orgId}/onboarding`,
        'current'
      );

      // Load existing workforce identity if exists
      const workforceIdentity = await FirestoreService.get(
        `${COLLECTIONS.ORGANIZATIONS}/${orgId}/settings`,
        'workforceIdentity'
      );

      if (workforceIdentity) {
        setIdentity(workforceIdentity as WorkforceIdentity);
      } else if (onboardingData) {
        // Pre-populate from onboarding
        setIdentity(prev => ({
          ...prev,
          workforceName: onboardingData.agentName || `${onboardingData.businessName} AI`,
          tagline: onboardingData.uniqueValue?.substring(0, 100) || '',
          brandDNA: {
            ...prev.brandDNA,
            companyDescription: onboardingData.problemSolved || '',
            uniqueValue: onboardingData.uniqueValue || '',
            targetAudience: onboardingData.targetCustomer || '',
            toneOfVoice: onboardingData.tone || 'professional',
            industry: onboardingData.industry || '',
          },
          personalityArchetype: mapToneToArchetype(onboardingData.tone),
        }));
      }

      if (orgData?.brandDNA) {
        setIdentity(prev => ({
          ...prev,
          brandDNA: { ...prev.brandDNA, ...orgData.brandDNA },
        }));
      }

    } catch (error: unknown) {
      logger.error('Error loading identity data:', error instanceof Error ? error : new Error(String(error)), { file: 'identity-refine-page.tsx' });
    } finally {
      setLoading(false);
    }
  };

  const mapToneToArchetype = (tone: string): WorkforceIdentity['personalityArchetype'] => {
    const mapping: Record<string, WorkforceIdentity['personalityArchetype']> = {
      'warm': 'friendly',
      'professional': 'professional',
      'direct': 'consultative',
      'friendly': 'friendly',
      'formal': 'professional',
      'casual': 'friendly',
      'enthusiastic-professional': 'energetic',
    };
    return mapping[tone] || 'professional';
  };

  const loadVoices = async (engine: TTSEngineType) => {
    setLoadingVoices(true);
    try {
      const response = await fetch(`/api/voice/tts?orgId=${orgId}&engine=${engine}`);
      const data = await response.json();
      if (data.success && data.voices) {
        setVoices(data.voices);
        // Auto-select first voice if none selected
        if (!identity.voiceId && data.voices.length > 0) {
          setIdentity(prev => ({
            ...prev,
            voiceId: data.voices[0].id,
            voiceName: data.voices[0].name,
          }));
        }
      }
    } catch (error: unknown) {
      logger.error('Error loading voices:', error instanceof Error ? error : new Error(String(error)), { file: 'identity-refine-page.tsx' });
    } finally {
      setLoadingVoices(false);
    }
  };

  const handleTestVoice = async () => {
    setTestingVoice(true);
    try {
      const testText = `Hi there! I'm ${identity.workforceName || 'your AI assistant'}. ${identity.tagline || 'How can I help you today?'}`;

      const response = await fetch('/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: testText,
          organizationId: orgId,
          engine: identity.voiceEngine,
          voiceId: identity.voiceId,
        }),
      });

      const data = await response.json();
      if (data.success && data.audio) {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        const audio = new Audio(data.audio);
        audioRef.current = audio;
        await audio.play();
      } else {
        alert(data.error || 'Failed to generate audio');
      }
    } catch (error: unknown) {
      logger.error('Error testing voice:', error instanceof Error ? error : new Error(String(error)), { file: 'identity-refine-page.tsx' });
      alert('Failed to test voice');
    } finally {
      setTestingVoice(false);
    }
  };

  const handleAddKeyPhrase = () => {
    if (newKeyPhrase.trim()) {
      setIdentity(prev => ({
        ...prev,
        brandDNA: {
          ...prev.brandDNA,
          keyPhrases: [...prev.brandDNA.keyPhrases, newKeyPhrase.trim()],
        },
      }));
      setNewKeyPhrase('');
    }
  };

  const handleRemoveKeyPhrase = (phrase: string) => {
    setIdentity(prev => ({
      ...prev,
      brandDNA: {
        ...prev.brandDNA,
        keyPhrases: prev.brandDNA.keyPhrases.filter(p => p !== phrase),
      },
    }));
  };

  const handleAddAvoidPhrase = () => {
    if (newAvoidPhrase.trim()) {
      setIdentity(prev => ({
        ...prev,
        brandDNA: {
          ...prev.brandDNA,
          avoidPhrases: [...prev.brandDNA.avoidPhrases, newAvoidPhrase.trim()],
        },
      }));
      setNewAvoidPhrase('');
    }
  };

  const handleRemoveAvoidPhrase = (phrase: string) => {
    setIdentity(prev => ({
      ...prev,
      brandDNA: {
        ...prev.brandDNA,
        avoidPhrases: prev.brandDNA.avoidPhrases.filter(p => p !== phrase),
      },
    }));
  };

  const handleSaveAndContinue = async () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
      window.scrollTo(0, 0);
      return;
    }

    // Final step - save everything
    setSaving(true);
    try {
      const { isFirebaseConfigured } = await import('@/lib/firebase/config');
      if (!isFirebaseConfigured) {
        alert('Saved (demo mode)');
        router.push(`/workspace/${orgId}/dashboard`);
        return;
      }

      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');

      // Save workforce identity
      await FirestoreService.set(
        `${COLLECTIONS.ORGANIZATIONS}/${orgId}/settings`,
        'workforceIdentity',
        {
          ...identity,
          updatedAt: new Date().toISOString(),
          updatedBy: user?.id || 'unknown',
          status: 'active',
        },
        true
      );

      // Update organization Brand DNA
      await FirestoreService.update(COLLECTIONS.ORGANIZATIONS, orgId, {
        brandDNA: identity.brandDNA,
        updatedAt: new Date(),
      });

      // Mark identity refinement as complete
      await FirestoreService.set(
        `${COLLECTIONS.ORGANIZATIONS}/${orgId}/settings`,
        'onboardingProgress',
        {
          identityRefinementCompleted: true,
          completedAt: new Date().toISOString(),
        },
        true
      );

      // Navigate to dashboard
      router.push(`/workspace/${orgId}/dashboard`);

    } catch (error: unknown) {
      logger.error('Error saving identity:', error instanceof Error ? error : new Error(String(error)), { file: 'identity-refine-page.tsx' });
      alert('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo(0, 0);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4rem',
        backgroundColor: '#000',
        minHeight: '100vh',
        color: '#fff'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '3px solid #333',
          borderTopColor: primaryColor,
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <p style={{ marginTop: '1rem', color: '#999' }}>Loading your identity configuration...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#000', minHeight: '100vh', color: '#fff' }}>
      {/* Hero Header */}
      <div style={{
        background: `linear-gradient(135deg, ${primaryColor}22 0%, #000 50%)`,
        borderBottom: '1px solid #1a1a1a',
        padding: '3rem 2rem 2rem'
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            display: 'inline-block',
            padding: '0.5rem 1rem',
            backgroundColor: `${primaryColor}22`,
            border: `1px solid ${primaryColor}44`,
            borderRadius: '9999px',
            marginBottom: '1rem'
          }}>
            <span style={{ color: primaryColor, fontSize: '0.875rem', fontWeight: '600' }}>
              Welcome to Your AI Workforce
            </span>
          </div>

          <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            Define Your Workforce Identity
          </h1>
          <p style={{ color: '#999', fontSize: '1.125rem', maxWidth: '600px', margin: '0 auto' }}>
            Customize how your AI team presents itself to customers. This identity will be consistent across all channels.
          </p>

          {/* Progress Steps */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '0.5rem',
            marginTop: '2rem',
            alignItems: 'center'
          }}>
            {['Name & Personality', 'Brand Voice', 'Voice Engine', 'Review'].map((step, index) => (
              <React.Fragment key={step}>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: currentStep > index + 1 ? primaryColor : currentStep === index + 1 ? primaryColor : '#1a1a1a',
                    border: `2px solid ${currentStep >= index + 1 ? primaryColor : '#333'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: currentStep >= index + 1 ? '#fff' : '#666',
                    fontWeight: '600',
                    fontSize: '0.875rem',
                  }}>
                    {currentStep > index + 1 ? '✓' : index + 1}
                  </div>
                  <span style={{
                    fontSize: '0.75rem',
                    color: currentStep >= index + 1 ? '#fff' : '#666',
                    whiteSpace: 'nowrap'
                  }}>
                    {step}
                  </span>
                </div>
                {index < 3 && (
                  <div style={{
                    width: '60px',
                    height: '2px',
                    backgroundColor: currentStep > index + 1 ? primaryColor : '#333',
                    marginBottom: '1.5rem'
                  }} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>

        {/* Step 1: Name & Personality */}
        {currentStep === 1 && (
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Name Your AI Workforce
            </h2>
            <p style={{ color: '#666', marginBottom: '2rem' }}>
              Give your AI team a memorable identity that reflects your brand.
            </p>

            {/* Workforce Name */}
            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                Workforce Name *
              </label>
              <input
                type="text"
                value={identity.workforceName}
                onChange={(e) => setIdentity(prev => ({ ...prev, workforceName: e.target.value }))}
                placeholder="e.g., Acme AI Team, Sales Genius, Support Squad"
                style={{
                  width: '100%',
                  padding: '1rem',
                  backgroundColor: '#0a0a0a',
                  border: '1px solid #333',
                  borderRadius: '0.5rem',
                  color: '#fff',
                  fontSize: '1.125rem',
                }}
              />
              <p style={{ color: '#666', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                This is how your AI will introduce itself to customers
              </p>
            </div>

            {/* Tagline */}
            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                Tagline
              </label>
              <input
                type="text"
                value={identity.tagline}
                onChange={(e) => setIdentity(prev => ({ ...prev, tagline: e.target.value }))}
                placeholder="e.g., Here to help you succeed"
                maxLength={100}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: '#0a0a0a',
                  border: '1px solid #333',
                  borderRadius: '0.5rem',
                  color: '#fff',
                  fontSize: '1rem',
                }}
              />
            </div>

            {/* Personality Archetype */}
            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '1rem' }}>
                Personality Archetype *
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                {PERSONALITY_ARCHETYPES.map((archetype) => {
                  const isSelected = identity.personalityArchetype === archetype.id;
                  return (
                    <button
                      key={archetype.id}
                      onClick={() => setIdentity(prev => ({
                        ...prev,
                        personalityArchetype: archetype.id as WorkforceIdentity['personalityArchetype'],
                        brandDNA: {
                          ...prev.brandDNA,
                          toneOfVoice: archetype.id === 'friendly' ? 'friendly' :
                                       archetype.id === 'energetic' ? 'casual' :
                                       archetype.id === 'calm' ? 'warm' : 'professional'
                        }
                      }))}
                      style={{
                        padding: '1.25rem',
                        backgroundColor: isSelected ? `${primaryColor}22` : '#0a0a0a',
                        border: isSelected ? `2px solid ${primaryColor}` : '2px solid #333',
                        borderRadius: '0.75rem',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.2s',
                      }}
                    >
                      <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{archetype.emoji}</div>
                      <div style={{ color: isSelected ? primaryColor : '#fff', fontWeight: '600', marginBottom: '0.25rem' }}>
                        {archetype.name}
                      </div>
                      <div style={{ color: '#666', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                        {archetype.description}
                      </div>
                      <div style={{ color: '#999', fontSize: '0.625rem', fontStyle: 'italic' }}>
                        {archetype.tone}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Avatar Style */}
            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '1rem' }}>
                Avatar Style
              </label>
              <div style={{ display: 'flex', gap: '1rem' }}>
                {AVATAR_STYLES.map((style) => {
                  const isSelected = identity.avatarStyle === style.id;
                  return (
                    <button
                      key={style.id}
                      onClick={() => setIdentity(prev => ({ ...prev, avatarStyle: style.id as WorkforceIdentity['avatarStyle'] }))}
                      style={{
                        width: '80px',
                        height: '80px',
                        backgroundColor: isSelected ? `${primaryColor}22` : '#0a0a0a',
                        border: isSelected ? `2px solid ${primaryColor}` : '2px solid #333',
                        borderRadius: '0.75rem',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      <span style={{ fontSize: '1.5rem' }}>{style.preview}</span>
                      <span style={{ fontSize: '0.625rem', color: '#999' }}>{style.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Primary Color */}
            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                Brand Color
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <input
                  type="color"
                  value={identity.primaryColor}
                  onChange={(e) => setIdentity(prev => ({ ...prev, primaryColor: e.target.value }))}
                  style={{
                    width: '60px',
                    height: '40px',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                  }}
                />
                <input
                  type="text"
                  value={identity.primaryColor}
                  onChange={(e) => setIdentity(prev => ({ ...prev, primaryColor: e.target.value }))}
                  style={{
                    padding: '0.5rem',
                    backgroundColor: '#0a0a0a',
                    border: '1px solid #333',
                    borderRadius: '0.25rem',
                    color: '#fff',
                    fontSize: '0.875rem',
                    width: '100px',
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Brand Voice */}
        {currentStep === 2 && (
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Define Your Brand Voice
            </h2>
            <p style={{ color: '#666', marginBottom: '2rem' }}>
              Set the communication guidelines that shape how your AI speaks.
            </p>

            {/* Company Description */}
            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                Company Description
              </label>
              <textarea
                value={identity.brandDNA.companyDescription}
                onChange={(e) => setIdentity(prev => ({
                  ...prev,
                  brandDNA: { ...prev.brandDNA, companyDescription: e.target.value }
                }))}
                placeholder="Describe what your company does and who you serve..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: '#0a0a0a',
                  border: '1px solid #333',
                  borderRadius: '0.5rem',
                  color: '#fff',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Unique Value */}
            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                What Makes You Unique
              </label>
              <textarea
                value={identity.brandDNA.uniqueValue}
                onChange={(e) => setIdentity(prev => ({
                  ...prev,
                  brandDNA: { ...prev.brandDNA, uniqueValue: e.target.value }
                }))}
                placeholder="What sets you apart from competitors..."
                rows={2}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: '#0a0a0a',
                  border: '1px solid #333',
                  borderRadius: '0.5rem',
                  color: '#fff',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Target Audience */}
            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                Target Audience
              </label>
              <input
                type="text"
                value={identity.brandDNA.targetAudience}
                onChange={(e) => setIdentity(prev => ({
                  ...prev,
                  brandDNA: { ...prev.brandDNA, targetAudience: e.target.value }
                }))}
                placeholder="e.g., Small business owners, enterprise sales teams..."
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: '#0a0a0a',
                  border: '1px solid #333',
                  borderRadius: '0.5rem',
                  color: '#fff',
                  fontSize: '1rem',
                }}
              />
            </div>

            {/* Communication Style */}
            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                Communication Style
              </label>
              <input
                type="text"
                value={identity.brandDNA.communicationStyle}
                onChange={(e) => setIdentity(prev => ({
                  ...prev,
                  brandDNA: { ...prev.brandDNA, communicationStyle: e.target.value }
                }))}
                placeholder="e.g., Consultative and empathetic, Direct and efficient..."
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: '#0a0a0a',
                  border: '1px solid #333',
                  borderRadius: '0.5rem',
                  color: '#fff',
                  fontSize: '1rem',
                }}
              />
            </div>

            {/* Key Phrases */}
            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                Key Phrases to Use
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <input
                  type="text"
                  value={newKeyPhrase}
                  onChange={(e) => setNewKeyPhrase(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddKeyPhrase()}
                  placeholder="Add a key phrase..."
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    backgroundColor: '#0a0a0a',
                    border: '1px solid #333',
                    borderRadius: '0.25rem',
                    color: '#fff',
                    fontSize: '0.875rem',
                  }}
                />
                <button
                  onClick={handleAddKeyPhrase}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#333',
                    border: 'none',
                    borderRadius: '0.25rem',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  Add
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {identity.brandDNA.keyPhrases.map((phrase) => (
                  <span
                    key={phrase}
                    style={{
                      padding: '0.25rem 0.75rem',
                      backgroundColor: `${primaryColor}22`,
                      border: `1px solid ${primaryColor}44`,
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      color: primaryColor,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    {phrase}
                    <button
                      onClick={() => handleRemoveKeyPhrase(phrase)}
                      style={{ background: 'none', border: 'none', color: primaryColor, cursor: 'pointer', fontSize: '0.875rem' }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Avoid Phrases */}
            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                Phrases to Avoid
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <input
                  type="text"
                  value={newAvoidPhrase}
                  onChange={(e) => setNewAvoidPhrase(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddAvoidPhrase()}
                  placeholder="Add a phrase to avoid..."
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    backgroundColor: '#0a0a0a',
                    border: '1px solid #333',
                    borderRadius: '0.25rem',
                    color: '#fff',
                    fontSize: '0.875rem',
                  }}
                />
                <button
                  onClick={handleAddAvoidPhrase}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#333',
                    border: 'none',
                    borderRadius: '0.25rem',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  Add
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {identity.brandDNA.avoidPhrases.map((phrase) => (
                  <span
                    key={phrase}
                    style={{
                      padding: '0.25rem 0.75rem',
                      backgroundColor: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      color: '#ef4444',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    {phrase}
                    <button
                      onClick={() => handleRemoveAvoidPhrase(phrase)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.875rem' }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Industry */}
            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                Industry
              </label>
              <input
                type="text"
                value={identity.brandDNA.industry}
                onChange={(e) => setIdentity(prev => ({
                  ...prev,
                  brandDNA: { ...prev.brandDNA, industry: e.target.value }
                }))}
                placeholder="e.g., SaaS, E-commerce, Healthcare..."
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: '#0a0a0a',
                  border: '1px solid #333',
                  borderRadius: '0.5rem',
                  color: '#fff',
                  fontSize: '1rem',
                }}
              />
            </div>
          </div>
        )}

        {/* Step 3: Voice Engine */}
        {currentStep === 3 && (
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Choose Your Voice
            </h2>
            <p style={{ color: '#666', marginBottom: '2rem' }}>
              Select the text-to-speech engine and voice for your AI workforce.
            </p>

            {/* Voice Engine Selection */}
            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '1rem' }}>
                Voice Engine
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                {(Object.keys(TTS_PROVIDER_INFO) as TTSEngineType[]).map((engine) => {
                  const info = TTS_PROVIDER_INFO[engine];
                  const isSelected = identity.voiceEngine === engine;
                  return (
                    <button
                      key={engine}
                      onClick={() => setIdentity(prev => ({
                        ...prev,
                        voiceEngine: engine,
                        voiceId: '',
                        voiceName: ''
                      }))}
                      style={{
                        padding: '1rem',
                        backgroundColor: isSelected ? `${primaryColor}15` : '#0a0a0a',
                        border: isSelected ? `2px solid ${primaryColor}` : '2px solid #333',
                        borderRadius: '0.75rem',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.2s',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                        <span style={{ fontWeight: '600', color: isSelected ? primaryColor : '#fff', fontSize: '0.875rem' }}>
                          {info.name}
                        </span>
                        <span style={{
                          padding: '0.125rem 0.5rem',
                          backgroundColor: info.quality === 'ultra' ? 'rgba(168, 85, 247, 0.2)' :
                                          info.quality === 'premium' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                          color: info.quality === 'ultra' ? '#a855f7' :
                                info.quality === 'premium' ? '#10b981' : '#f59e0b',
                          borderRadius: '9999px',
                          fontSize: '0.625rem',
                          fontWeight: '600',
                          textTransform: 'uppercase',
                        }}>
                          {info.quality}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.5rem', lineHeight: '1.4' }}>
                        {info.description.substring(0, 60)}...
                      </p>
                      <div style={{ fontSize: '0.625rem', color: '#999' }}>
                        ${(info.pricing.costPer1kChars / 100).toFixed(3)}/1k chars
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Voice Selection */}
            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                Select Voice
              </label>
              <select
                value={identity.voiceId}
                onChange={(e) => {
                  const voice = voices.find(v => v.id === e.target.value);
                  setIdentity(prev => ({
                    ...prev,
                    voiceId: e.target.value,
                    voiceName: voice?.name || ''
                  }));
                }}
                disabled={loadingVoices}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: '#0a0a0a',
                  border: '1px solid #333',
                  borderRadius: '0.5rem',
                  color: '#fff',
                  fontSize: '1rem',
                }}
              >
                {loadingVoices ? (
                  <option>Loading voices...</option>
                ) : (
                  voices.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.name} {voice.gender ? `(${voice.gender})` : ''} {voice.language ? `- ${voice.language}` : ''}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Test Voice Button */}
            <button
              onClick={handleTestVoice}
              disabled={testingVoice || !identity.voiceId}
              style={{
                width: '100%',
                padding: '1rem',
                backgroundColor: testingVoice ? '#333' : '#10b981',
                color: '#fff',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: testingVoice || !identity.voiceId ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
                fontWeight: '600',
                marginBottom: '2rem',
              }}
            >
              {testingVoice ? 'Generating Audio...' : 'Test Voice'}
            </button>

            {/* Behavior Settings */}
            <div style={{
              padding: '1.5rem',
              backgroundColor: '#0a0a0a',
              border: '1px solid #1a1a1a',
              borderRadius: '0.75rem',
              marginBottom: '2rem'
            }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1.5rem' }}>Behavior Settings</h3>

              {/* Response Style */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                  Response Style
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {['concise', 'balanced', 'detailed'].map((style) => (
                    <button
                      key={style}
                      onClick={() => setIdentity(prev => ({ ...prev, responseStyle: style as WorkforceIdentity['responseStyle'] }))}
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        backgroundColor: identity.responseStyle === style ? `${primaryColor}22` : '#1a1a1a',
                        border: identity.responseStyle === style ? `1px solid ${primaryColor}` : '1px solid #333',
                        borderRadius: '0.5rem',
                        color: identity.responseStyle === style ? primaryColor : '#999',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: identity.responseStyle === style ? '600' : '400',
                        textTransform: 'capitalize',
                      }}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>

              {/* Proactivity Level */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                  Proactivity Level: {identity.proactivityLevel}/10
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={identity.proactivityLevel}
                  onChange={(e) => setIdentity(prev => ({ ...prev, proactivityLevel: parseInt(e.target.value) }))}
                  style={{ width: '100%', accentColor: primaryColor }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.625rem', color: '#666' }}>
                  <span>Reactive</span>
                  <span>Proactive</span>
                </div>
              </div>

              {/* Empathy Level */}
              <div>
                <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                  Empathy Level: {identity.empathyLevel}/10
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={identity.empathyLevel}
                  onChange={(e) => setIdentity(prev => ({ ...prev, empathyLevel: parseInt(e.target.value) }))}
                  style={{ width: '100%', accentColor: primaryColor }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.625rem', color: '#666' }}>
                  <span>Direct</span>
                  <span>Empathetic</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {currentStep === 4 && (
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Review Your Workforce Identity
            </h2>
            <p style={{ color: '#666', marginBottom: '2rem' }}>
              Confirm your AI workforce configuration before launching.
            </p>

            {/* Identity Summary Card */}
            <div style={{
              padding: '2rem',
              backgroundColor: '#0a0a0a',
              border: '1px solid #1a1a1a',
              borderRadius: '1rem',
              marginBottom: '2rem'
            }}>
              {/* Header with Avatar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '1rem',
                  backgroundColor: identity.primaryColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2rem',
                  color: '#fff',
                }}>
                  {AVATAR_STYLES.find(s => s.id === identity.avatarStyle)?.preview || '🤖'}
                </div>
                <div>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.25rem' }}>
                    {identity.workforceName || 'Your AI Workforce'}
                  </h3>
                  <p style={{ color: '#999', fontSize: '0.875rem' }}>
                    {identity.tagline || 'Ready to help your customers'}
                  </p>
                  <div style={{
                    display: 'inline-block',
                    marginTop: '0.5rem',
                    padding: '0.25rem 0.75rem',
                    backgroundColor: `${identity.primaryColor}22`,
                    border: `1px solid ${identity.primaryColor}44`,
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    color: identity.primaryColor,
                    fontWeight: '600',
                  }}>
                    {PERSONALITY_ARCHETYPES.find(a => a.id === identity.personalityArchetype)?.name || 'Professional'} Personality
                  </div>
                </div>
              </div>

              {/* Details Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Voice Engine
                  </div>
                  <div style={{ color: '#fff', fontWeight: '600' }}>
                    {TTS_PROVIDER_INFO[identity.voiceEngine]?.name || 'Native'} - {identity.voiceName || 'Default'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Response Style
                  </div>
                  <div style={{ color: '#fff', fontWeight: '600', textTransform: 'capitalize' }}>
                    {identity.responseStyle}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Industry
                  </div>
                  <div style={{ color: '#fff', fontWeight: '600' }}>
                    {identity.brandDNA.industry || 'Not specified'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Target Audience
                  </div>
                  <div style={{ color: '#fff', fontWeight: '600' }}>
                    {identity.brandDNA.targetAudience || 'Not specified'}
                  </div>
                </div>
              </div>

              {/* Key Phrases Preview */}
              {identity.brandDNA.keyPhrases.length > 0 && (
                <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #1a1a1a' }}>
                  <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Key Phrases
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {identity.brandDNA.keyPhrases.slice(0, 5).map((phrase) => (
                      <span
                        key={phrase}
                        style={{
                          padding: '0.25rem 0.5rem',
                          backgroundColor: '#1a1a1a',
                          borderRadius: '0.25rem',
                          fontSize: '0.75rem',
                          color: '#999',
                        }}
                      >
                        {phrase}
                      </span>
                    ))}
                    {identity.brandDNA.keyPhrases.length > 5 && (
                      <span style={{ fontSize: '0.75rem', color: '#666' }}>
                        +{identity.brandDNA.keyPhrases.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* What's Next Card */}
            <div style={{
              padding: '1.5rem',
              backgroundColor: `${primaryColor}11`,
              border: `1px solid ${primaryColor}33`,
              borderRadius: '0.75rem',
            }}>
              <h4 style={{ color: primaryColor, fontWeight: '600', marginBottom: '0.75rem' }}>
                What happens next?
              </h4>
              <ul style={{ color: '#999', fontSize: '0.875rem', marginLeft: '1.5rem', lineHeight: '1.8' }}>
                <li>Your AI workforce identity will be saved and applied across all channels</li>
                <li>You can further customize individual tools in the Training Labs</li>
                <li>Visit the Voice Training Lab to configure phone-specific settings</li>
                <li>Your AI is ready to start conversations with customers!</li>
              </ul>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '2rem',
          paddingTop: '2rem',
          borderTop: '1px solid #1a1a1a'
        }}>
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'transparent',
              border: '1px solid #333',
              borderRadius: '0.5rem',
              color: currentStep === 1 ? '#666' : '#fff',
              cursor: currentStep === 1 ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: '600',
            }}
          >
            Back
          </button>

          <button
            onClick={handleSaveAndContinue}
            disabled={saving}
            style={{
              padding: '0.75rem 2rem',
              backgroundColor: saving ? '#333' : primaryColor,
              border: 'none',
              borderRadius: '0.5rem',
              color: '#fff',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: '600',
            }}
          >
            {saving ? 'Saving...' : currentStep === totalSteps ? 'Launch Workforce' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
