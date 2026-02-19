'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import SubpageNav from '@/components/ui/SubpageNav';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import { useAuth } from '@/hooks/useAuth';

interface AgentPersona {
  // Core Identity & Expert Role
  agentName: string;
  professionalTitle: string;
  coreMission: string;
  targetKnowledgeDomain: string;
  userExpertiseLevel: string;
  
  // Cognitive & Reasoning Logic
  reasoningFramework: string;
  responseComplexityIndex: number;
  uncertaintyHandlingProtocol: string;
  internalThoughtVerification: string;
  
  // Knowledge & RAG Integration
  federatedRAGTags: string[];
  knowledgeSourceHierarchy: string[];
  sourceAuthorityWeighting: string;
  contextRetrievalDepth: number;
  
  // Learning & Adaptation Loops
  feedbackIntegrationStrategy: string;
  dynamicToneRegister: string;
  successfulStrategyMemory: string;
  knowledgeObsolescenceTimer: string;
  
  // Functional & Tactical Execution
  toolAuthorization: ToolAuthorization[];
  mandatoryOutputFormatting: string;
  securityDataFilter: string;
  
  // Training Refinements (modified by training sessions)
  verbosityControl: {
    maxResponseLength: number;
    preferBulletPoints: boolean;
    avoidRepetition: boolean;
    conversationalPacing: 'concise' | 'balanced' | 'detailed';
  };
  accuracyRules: string[];
  brandAlignmentNotes: string;
  trainingInsights: TrainingInsight[];
}

interface ToolAuthorization {
  tool: string;
  permissions: string;
  canExecuteAutonomously: boolean;
}

interface TrainingInsight {
  date: string;
  issue: string;
  adjustment: string;
  category: 'verbosity' | 'accuracy' | 'brand-alignment' | 'tone';
}

interface OnboardingData {
  companyName: string;
  industry: string;
  companyDescription: string;
  products: Array<{ category: string }>;
  targetCustomer: string;
  salesMethodology: string;
  brandVoice: { complexity: number };
  integrations: Array<{ name: string; permissions: string[]; requiresApproval: boolean }>;
}

interface PersonaApiResponse {
  persona?: AgentPersona;
  onboarding?: OnboardingData;
}

export default function AgentPersonaPage() {
  const { user: _user } = useAuth();
  const { theme } = useOrgTheme();
  const [activeSection, setActiveSection] = useState<'core' | 'cognitive' | 'knowledge' | 'learning' | 'execution' | 'training'>('core');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Persona state - this is auto-generated from onboarding, then refined by training
  const [persona, setPersona] = useState<AgentPersona>({
    // Core Identity (AUTO-GENERATED from onboarding)
    agentName: '',
    professionalTitle: '',
    coreMission: '',
    targetKnowledgeDomain: '',
    userExpertiseLevel: '',
    
    // Cognitive & Reasoning Logic
    reasoningFramework: '',
    responseComplexityIndex: 7,
    uncertaintyHandlingProtocol: '',
    internalThoughtVerification: '',
    
    // Knowledge & RAG Integration
    federatedRAGTags: [],
    knowledgeSourceHierarchy: [],
    sourceAuthorityWeighting: '',
    contextRetrievalDepth: 3,
    
    // Learning & Adaptation
    feedbackIntegrationStrategy: '',
    dynamicToneRegister: '',
    successfulStrategyMemory: '',
    knowledgeObsolescenceTimer: '',
    
    // Tactical Execution
    toolAuthorization: [],
    mandatoryOutputFormatting: '',
    securityDataFilter: '',
    
    // Training Refinements (MODIFIED by training sessions)
    verbosityControl: {
      maxResponseLength: 500,
      preferBulletPoints: true,
      avoidRepetition: true,
      conversationalPacing: 'balanced'
    },
    accuracyRules: [],
    brandAlignmentNotes: '',
    trainingInsights: []
  });

  useEffect(() => {
    const loadPersona = async () => {
      try {
        // Load persona from Firestore (or auto-generate from onboarding if first time)
        const response = await fetch(`/api/agent/persona`);
        if (response.ok) {
          const data = (await response.json()) as PersonaApiResponse;
          if (data.persona) {
            setPersona(data.persona);
          } else if (data.onboarding) {
            // Auto-generate from onboarding data
            const generated = generatePersonaFromOnboarding(data.onboarding);
            setPersona(generated);
          }
        }
      } catch (error) {
        console.error('Error loading persona:', error);
      } finally {
        setLoading(false);
      }
    };

    void loadPersona();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/agent/persona`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(persona)
      });
      
      if (response.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Error saving persona:', error);
    } finally {
      setSaving(false);
    }
  };

  const primaryColor = theme?.colors?.primary?.main || 'var(--color-primary)';
  const bgPaper = 'var(--color-bg-paper)';
  const borderColor = 'var(--color-border-strong)';

  if (loading) {
    return (
      <div style={{ padding: '2rem', backgroundColor: 'var(--color-bg-main)', minHeight: '100vh', color: 'var(--color-text-primary)' }}>
        <div>Loading persona...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', overflowY: 'auto', backgroundColor: 'var(--color-bg-main)', minHeight: '100vh' }}>
      <div>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <Link 
            href={`/settings/ai-agents`} 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              color: primaryColor, 
              fontSize: '0.875rem', 
              fontWeight: '500', 
              textDecoration: 'none', 
              marginBottom: '1.5rem' 
            }}
          >
            ← Back to AI Agents
          </Link>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                🎭 Expert Agent Persona
              </h1>
              <p style={{ color: 'var(--color-text-disabled)', fontSize: '0.875rem' }}>
                Comprehensive persona auto-generated from your onboarding, refined through training
              </p>
            </div>
            <button
              onClick={() => void handleSave()}
              disabled={saving}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: saveSuccess ? 'var(--color-success)' : primaryColor,
                color: 'var(--color-text-primary)',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1
              }}
            >
              {saving ? 'Saving...' : saveSuccess ? '✓ Saved!' : 'Save Persona'}
            </button>
          </div>
        </div>

        <SubpageNav items={[
          { label: 'Training Center', href: '/settings/ai-agents/training' },
          { label: 'Persona', href: '/settings/ai-agents/persona' },
          { label: 'Voice & Speech', href: '/settings/ai-agents/voice' },
          { label: 'Voice AI Lab', href: '/voice/training' },
          { label: 'Social AI Lab', href: '/social/training' },
          { label: 'SEO AI Lab', href: '/seo/training' },
        ]} />

        {/* Persona Summary Card */}
        {persona.agentName && (
          <div style={{
            backgroundColor: bgPaper,
            border: `1px solid ${borderColor}`,
            borderRadius: '0.75rem',
            padding: '1.5rem',
            marginBottom: '2rem'
          }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--color-text-primary)' }}>
              {persona.agentName}
            </div>
            <div style={{ fontSize: '1.125rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
              {persona.professionalTitle}
            </div>
            {persona.coreMission && (
              <div style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)', lineHeight: '1.6' }}>
                <strong style={{ color: primaryColor }}>Mission:</strong> {persona.coreMission}
              </div>
            )}
          </div>
        )}

        {/* Section Navigation */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '2rem',
          borderBottom: `1px solid ${borderColor}`,
          overflowX: 'auto'
        }}>
          {([
            { id: 'core' as const, label: 'Core Identity', icon: '🎯' },
            { id: 'cognitive' as const, label: 'Reasoning Logic', icon: '🧠' },
            { id: 'knowledge' as const, label: 'Knowledge & RAG', icon: '📚' },
            { id: 'learning' as const, label: 'Learning Loops', icon: '🔄' },
            { id: 'execution' as const, label: 'Execution Rules', icon: '⚡' },
            { id: 'training' as const, label: 'Training Refinements', icon: '🎓', badge: persona.trainingInsights?.length || 0 }
          ]).map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: activeSection === section.id ? `2px solid ${primaryColor}` : '2px solid transparent',
                color: activeSection === section.id ? 'var(--color-text-primary)' : 'var(--color-text-disabled)',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
                position: 'relative'
              }}
            >
              {section.icon} {section.label}
              {section.badge && section.badge > 0 ? (
                <span style={{
                  position: 'absolute',
                  top: '0.5rem',
                  right: '0.5rem',
                  backgroundColor: primaryColor,
                  color: 'var(--color-text-primary)',
                  fontSize: '0.625rem',
                  padding: '0.125rem 0.375rem',
                  borderRadius: '999px',
                  fontWeight: '700'
                }}>
                  {section.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Core Identity Section */}
        {activeSection === 'core' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <SectionHeader
              title="I. Core Identity & Expert Role"
              description="Auto-generated from your onboarding form"
              badge="FROM ONBOARDING"
            />

            <FormField
              label="Agent Name & Professional Title"
              value={`${persona.agentName} | ${persona.professionalTitle}`}
              onChange={() => {}}
              helpText="✓ Auto-generated from: Company name + Industry from onboarding"
              readonly
            />

            <FormField
              label="Core Mission & Moral Imperative"
              value={persona.coreMission}
              onChange={(v) => setPersona({ ...persona, coreMission: v })}
              multiline
              rows={4}
              helpText="The 'North Star' guiding every decision. From: Company mission statement"
            />

            <FormField
              label="Target Knowledge Domain"
              value={persona.targetKnowledgeDomain}
              onChange={(v) => setPersona({ ...persona, targetKnowledgeDomain: v })}
              helpText="✓ Auto-populated from: Products & services you listed in onboarding"
            />

            <FormField
              label="Assumed User Expertise Level"
              value={persona.userExpertiseLevel}
              onChange={(v) => setPersona({ ...persona, userExpertiseLevel: v })}
              multiline
              rows={2}
              helpText="✓ From: Target customer profile in onboarding"
            />
          </div>
        )}

        {/* Cognitive & Reasoning Logic Section */}
        {activeSection === 'cognitive' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <SectionHeader
              title="II. Cognitive & Reasoning Logic"
              description="How your agent thinks and makes decisions"
            />

            <FormField
              label="Domain-Specific Reasoning Framework"
              value={persona.reasoningFramework}
              onChange={(v) => setPersona({ ...persona, reasoningFramework: v })}
              placeholder="e.g., The Challenger Sale + MEDDPICC"
              helpText="✓ Set from: Sales methodology selected in onboarding"
            />

            <FormField
              label="Response Complexity Index (RCI)"
              value={persona.responseComplexityIndex.toString()}
              onChange={(v) => setPersona({ ...persona, responseComplexityIndex: parseInt(v) || 1 })}
              type="number"
              min={1}
              max={10}
              helpText="1-10 scale. 1 = Simple explanations, 10 = Deep technical detail. From: Target audience sophistication"
            />

            <FormField
              label="Uncertainty Handling Protocol"
              value={persona.uncertaintyHandlingProtocol}
              onChange={(v) => setPersona({ ...persona, uncertaintyHandlingProtocol: v })}
              multiline
              rows={3}
              helpText="How the agent admits it doesn't know something (prevents hallucinations)"
              placeholder='e.g., "I want to ensure 100% accuracy—let me pull the exact information from our knowledge base."'
            />

            <FormField
              label="Internal Thought Verification Loop"
              value={persona.internalThoughtVerification}
              onChange={(v) => setPersona({ ...persona, internalThoughtVerification: v })}
              multiline
              rows={4}
              helpText="Agent's self-check before responding"
              placeholder='e.g., "Before responding: (1) Does this address a pain point? (2) Am I creating urgency? (3) Is my tone appropriate?"'
            />
          </div>
        )}

        {/* Knowledge & RAG Section */}
        {activeSection === 'knowledge' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <SectionHeader
              title="III. Knowledge & RAG Integration"
              description="What your agent knows and how it retrieves information"
              badge="FROM UPLOADS & INTEGRATIONS"
            />

            <div style={{
              backgroundColor: bgPaper,
              border: `1px solid ${borderColor}`,
              borderRadius: '0.75rem',
              padding: '1.5rem'
            }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '1rem', color: 'var(--color-text-primary)' }}>
                Federated RAG Routing Tags
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                {persona.federatedRAGTags?.length > 0 ? persona.federatedRAGTags.map((tag, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: 'var(--color-bg-main)',
                      border: `1px solid ${primaryColor}`,
                      borderRadius: '0.5rem',
                      fontSize: '0.75rem',
                      color: primaryColor,
                      fontFamily: 'monospace'
                    }}
                  >
                    {tag}
                  </div>
                )) : (
                  <div style={{ color: 'var(--color-text-disabled)', fontSize: '0.875rem' }}>
                    No RAG tags yet. Will be generated from your product categories and documents.
                  </div>
                )}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>
                ✓ Auto-generated from: Product categories + Document uploads
              </div>
            </div>

            <div style={{
              backgroundColor: bgPaper,
              border: `1px solid ${borderColor}`,
              borderRadius: '0.75rem',
              padding: '1.5rem'
            }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '1rem', color: 'var(--color-text-primary)' }}>
                Knowledge Source Hierarchy
              </label>
              <ol style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.875rem', color: 'var(--color-text-primary)', lineHeight: '1.8' }}>
                {persona.knowledgeSourceHierarchy?.length > 0 ? persona.knowledgeSourceHierarchy.map((source, idx) => (
                  <li key={idx}>{source}</li>
                )) : (
                  <li style={{ color: 'var(--color-text-disabled)' }}>Will be populated from your knowledge sources</li>
                )}
              </ol>
            </div>

            <FormField
              label="Context Retrieval Depth"
              value={persona.contextRetrievalDepth?.toString() || '3'}
              onChange={(v) => setPersona({ ...persona, contextRetrievalDepth: parseInt(v) || 1 })}
              type="number"
              min={1}
              max={10}
              helpText="How many past interactions to remember (e.g., 3 = last 3 conversations with this customer)"
            />
          </div>
        )}

        {/* Learning & Adaptation Section */}
        {activeSection === 'learning' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <SectionHeader
              title="IV. Learning & Adaptation Loops"
              description="How your agent improves from feedback and adapts to users"
            />

            <FormField
              label="User Feedback Integration Strategy"
              value={persona.feedbackIntegrationStrategy}
              onChange={(v) => setPersona({ ...persona, feedbackIntegrationStrategy: v })}
              multiline
              rows={4}
              helpText="How the agent learns from user reactions (thumbs up/down, corrections)"
              placeholder="e.g., If user says 'Too expensive', tag as Price Objection and shift to Value Justification"
            />

            <FormField
              label="Dynamic Tone Register"
              value={persona.dynamicToneRegister}
              onChange={(v) => setPersona({ ...persona, dynamicToneRegister: v })}
              multiline
              rows={3}
              helpText="How the agent adapts its communication style"
              placeholder='e.g., "Start professional. If user is casual, mirror their style. If frustrated, shift to empathetic problem-solving"'
            />

            <FormField
              label="Successful Strategy Memory"
              value={persona.successfulStrategyMemory}
              onChange={(v) => setPersona({ ...persona, successfulStrategyMemory: v })}
              multiline
              rows={3}
              helpText="Log successful conversation patterns for future use"
            />
          </div>
        )}

        {/* Functional & Tactical Execution Section */}
        {activeSection === 'execution' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <SectionHeader
              title="V. Functional & Tactical Execution"
              description="What actions your agent can take"
              badge="FROM INTEGRATIONS"
            />

            <div style={{
              backgroundColor: bgPaper,
              border: `1px solid ${borderColor}`,
              borderRadius: '0.75rem',
              padding: '1.5rem'
            }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '1rem', color: 'var(--color-text-primary)' }}>
                Tool/API Authorization Level
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {persona.toolAuthorization?.length > 0 ? persona.toolAuthorization.map((tool, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr auto',
                      gap: '1rem',
                      padding: '1rem',
                      backgroundColor: 'var(--color-bg-main)',
                      border: `1px solid ${borderColor}`,
                      borderRadius: '0.5rem',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>{tool.tool}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>Permissions: {tool.permissions}</div>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                      {tool.canExecuteAutonomously ? '✓ Autonomous' : '⚠ Requires Permission'}
                    </div>
                    <div style={{
                      padding: '0.25rem 0.75rem',
                      backgroundColor: tool.canExecuteAutonomously ? 'var(--color-success-dark)' : 'var(--color-warning-dark)',
                      color: 'var(--color-text-primary)',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                      fontWeight: '600'
                    }}>
                      {tool.canExecuteAutonomously ? 'AUTO' : 'MANUAL'}
                    </div>
                  </div>
                )) : (
                  <div style={{ color: 'var(--color-text-disabled)', fontSize: '0.875rem', padding: '1rem' }}>
                    No integrations configured yet. Add integrations in settings.
                  </div>
                )}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginTop: '1rem' }}>
                ✓ Auto-populated from: Integrations you configured in settings
              </div>
            </div>

            <FormField
              label="Mandatory Output Formatting"
              value={persona.mandatoryOutputFormatting}
              onChange={(v) => setPersona({ ...persona, mandatoryOutputFormatting: v })}
              multiline
              rows={4}
              helpText="How the agent structures its responses"
              placeholder="e.g., Use **bolded metrics**. End with 'Recommended Next Step'. Use bullet points for lists."
            />

            <FormField
              label="Security & Data Classification Filter"
              value={persona.securityDataFilter}
              onChange={(v) => setPersona({ ...persona, securityDataFilter: v })}
              multiline
              rows={4}
              helpText="What the agent must NEVER reveal"
              placeholder='e.g., "NEVER reveal: pricing discounts to other clients, proprietary technical details, customer data"'
            />
          </div>
        )}

        {/* Training Refinements Section */}
        {activeSection === 'training' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <SectionHeader
              title="VI. Training Refinements"
              description="Persona adjustments from training sessions"
              badge="MODIFIED BY TRAINING"
            />

            <div style={{
              backgroundColor: 'var(--color-info-dark)',
              border: '1px solid var(--color-info)',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              marginBottom: '1rem'
            }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--color-info-light)', marginBottom: '0.5rem', fontWeight: '600' }}>
                💡 How Training Refines Your Persona
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--color-info-light)', lineHeight: '1.6' }}>
                As you train your agent, issues like &ldquo;too verbose,&rdquo; &ldquo;inaccurate,&rdquo; or &ldquo;off-brand&rdquo; are automatically
                detected and used to update these settings. Your persona gets smarter with every training session.
              </div>
            </div>

            {/* Verbosity Control */}
            <div style={{
              backgroundColor: bgPaper,
              border: `1px solid ${borderColor}`,
              borderRadius: '0.75rem',
              padding: '1.5rem'
            }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '1rem', color: 'var(--color-text-primary)' }}>
                Verbosity Control <span style={{ color: 'var(--color-warning)' }}>★ Modified by Training</span>
              </label>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                    Max Response Length (words)
                  </label>
                  <input
                    type="number"
                    value={persona.verbosityControl?.maxResponseLength || 500}
                    onChange={(e) => setPersona({
                      ...persona,
                      verbosityControl: {
                        ...persona.verbosityControl,
                        maxResponseLength: parseInt(e.target.value) || 500
                      }
                    })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      backgroundColor: 'var(--color-bg-main)',
                      border: `1px solid ${borderColor}`,
                      borderRadius: '0.5rem',
                      color: 'var(--color-text-primary)',
                      fontSize: '0.875rem'
                    }}
                  />
                </div>
                
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                    Conversational Pacing
                  </label>
                  <select
                    value={persona.verbosityControl?.conversationalPacing || 'balanced'}
                    onChange={(e) => setPersona({
                      ...persona,
                      verbosityControl: {
                        ...persona.verbosityControl,
                        conversationalPacing: e.target.value as 'concise' | 'balanced' | 'detailed'
                      }
                    })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      backgroundColor: 'var(--color-bg-main)',
                      border: `1px solid ${borderColor}`,
                      borderRadius: '0.5rem',
                      color: 'var(--color-text-primary)',
                      fontSize: '0.875rem'
                    }}
                  >
                    <option value="concise">Concise (Brief answers)</option>
                    <option value="balanced">Balanced (Moderate detail)</option>
                    <option value="detailed">Detailed (Comprehensive)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--color-text-primary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={persona.verbosityControl?.preferBulletPoints || false}
                    onChange={(e) => setPersona({
                      ...persona,
                      verbosityControl: {
                        ...persona.verbosityControl,
                        preferBulletPoints: e.target.checked
                      }
                    })}
                    style={{ width: '1rem', height: '1rem' }}
                  />
                  Prefer Bullet Points
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--color-text-primary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={persona.verbosityControl?.avoidRepetition || false}
                    onChange={(e) => setPersona({
                      ...persona,
                      verbosityControl: {
                        ...persona.verbosityControl,
                        avoidRepetition: e.target.checked
                      }
                    })}
                    style={{ width: '1rem', height: '1rem' }}
                  />
                  Avoid Repetition
                </label>
              </div>
            </div>

            {/* Accuracy Rules */}
            <FormField
              label="Accuracy Rules"
              value={persona.accuracyRules?.join('\n') || ''}
              onChange={(v) => setPersona({ ...persona, accuracyRules: v.split('\n').filter(r => r.trim()) })}
              multiline
              rows={6}
              helpText="One rule per line. These are added when training reveals inaccuracies."
              placeholder="e.g.,&#10;- Always verify pricing from latest pricing sheet&#10;- Never speculate on competitor features&#10;- Cite sources for technical claims"
            />

            {/* Brand Alignment Notes */}
            <FormField
              label="Brand Alignment Notes"
              value={persona.brandAlignmentNotes || ''}
              onChange={(v) => setPersona({ ...persona, brandAlignmentNotes: v })}
              multiline
              rows={4}
              helpText="Adjustments to keep agent aligned with your brand voice and values"
              placeholder="e.g., 'Always emphasize trust and security. Avoid aggressive sales tactics. Use customer success stories when possible.'"
            />

            {/* Training Insights Log */}
            {persona.trainingInsights && persona.trainingInsights.length > 0 && (
              <div style={{
                backgroundColor: bgPaper,
                border: `1px solid ${borderColor}`,
                borderRadius: '0.75rem',
                padding: '1.5rem'
              }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '1rem', color: 'var(--color-text-primary)' }}>
                  Training Insights History
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {persona.trainingInsights.map((insight, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '1rem',
                        backgroundColor: 'var(--color-bg-main)',
                        border: `1px solid ${borderColor}`,
                        borderRadius: '0.5rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{
                          fontSize: '0.75rem',
                          color: 'var(--color-text-secondary)'
                        }}>
                          {new Date(insight.date).toLocaleDateString()}
                        </span>
                        <span style={{
                          fontSize: '0.75rem',
                          padding: '0.125rem 0.5rem',
                          backgroundColor: getCategoryColor(insight.category),
                          borderRadius: '0.25rem',
                          color: 'var(--color-text-primary)'
                        }}>
                          {insight.category}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)', marginBottom: '0.25rem' }}>
                        <strong>Issue:</strong> {insight.issue}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--color-success)' }}>
                        <strong>Adjustment:</strong> {insight.adjustment}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ title, description, badge }: { title: string; description: string; badge?: string }) {
  return (
    <div style={{
      borderLeft: '4px solid var(--color-primary)',
      paddingLeft: '1rem',
      marginBottom: '0.5rem',
      position: 'relative'
    }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '0.25rem' }}>
        {title}
        {badge && (
          <span style={{
            marginLeft: '1rem',
            fontSize: '0.625rem',
            padding: '0.25rem 0.75rem',
            backgroundColor: 'var(--color-success)',
            color: 'var(--color-text-primary)',
            borderRadius: '0.25rem',
            fontWeight: '600',
            verticalAlign: 'middle'
          }}>
            {badge}
          </span>
        )}
      </h2>
      <p style={{ fontSize: '0.875rem', color: 'var(--color-text-disabled)', margin: 0 }}>
        {description}
      </p>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  helpText,
  multiline = false,
  rows = 3,
  type = 'text',
  min,
  max,
  readonly = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  helpText?: string;
  multiline?: boolean;
  rows?: number;
  type?: string;
  min?: number;
  max?: number;
  readonly?: boolean;
}) {
  const bgPaper = 'var(--color-bg-paper)';
  const borderColor = 'var(--color-border-strong)';

  return (
    <div style={{
      backgroundColor: bgPaper,
      border: `1px solid ${borderColor}`,
      borderRadius: '0.75rem',
      padding: '1.5rem'
    }}>
      <label style={{
        display: 'block',
        fontSize: '0.875rem',
        fontWeight: '600',
        marginBottom: '0.75rem',
        color: 'var(--color-text-primary)'
      }}>
        {label}
      </label>
      
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          readOnly={readonly}
          style={{
            width: '100%',
            padding: '0.75rem',
            backgroundColor: readonly ? 'var(--color-bg-main)' : 'var(--color-bg-main)',
            border: `1px solid ${borderColor}`,
            borderRadius: '0.5rem',
            color: readonly ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
            fontSize: '0.875rem',
            fontFamily: 'inherit',
            resize: 'vertical',
            lineHeight: '1.6',
            cursor: readonly ? 'not-allowed' : 'text'
          }}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          min={min}
          max={max}
          readOnly={readonly}
          style={{
            width: '100%',
            padding: '0.75rem',
            backgroundColor: readonly ? 'var(--color-bg-main)' : 'var(--color-bg-main)',
            border: `1px solid ${borderColor}`,
            borderRadius: '0.5rem',
            color: readonly ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
            fontSize: '0.875rem',
            fontFamily: 'inherit',
            cursor: readonly ? 'not-allowed' : 'text'
          }}
        />
      )}
      
      {helpText && (
        <div style={{
          marginTop: '0.5rem',
          fontSize: '0.75rem',
          color: 'var(--color-text-disabled)',
          fontStyle: 'italic',
          lineHeight: '1.4'
        }}>
          {helpText}
        </div>
      )}
    </div>
  );
}

function getCategoryColor(category: string): string {
  switch (category) {
    case 'verbosity': return 'var(--color-warning)';
    case 'accuracy': return 'var(--color-error)';
    case 'brand-alignment': return 'var(--color-secondary)';
    case 'tone': return 'var(--color-info)';
    default: return 'var(--color-primary)';
  }
}

// This would be called when onboarding is complete
function generatePersonaFromOnboarding(onboarding: OnboardingData): AgentPersona {
  const companyName = onboarding.companyName || 'Your Company';
  const agentName = `${companyName}-AI`;
  const industry = onboarding.industry || 'Business';
  const professionalTitle = `Senior ${industry} Consultant`;

  const productCategories = onboarding.products
    .map((p) => p.category)
    .join(', ');

  const federatedTags = onboarding.products
    .map((p) => `DOMAIN: ${p.category.toUpperCase().replace(/ /g, '_')}`);

  const salesMethodology = onboarding.salesMethodology || 'Consultative Selling';
  const complexityIndex = onboarding.brandVoice?.complexity ?? 7;

  const toolAuth: ToolAuthorization[] = onboarding.integrations.map((i) => {
    const joinedPermissions = i.permissions.join('/') || 'Read Only';
    return {
      tool: i.name,
      permissions: joinedPermissions,
      canExecuteAutonomously: !i.requiresApproval,
    };
  });

  return {
    agentName,
    professionalTitle,
    coreMission: onboarding.companyDescription ?? '',
    targetKnowledgeDomain: productCategories,
    userExpertiseLevel: onboarding.targetCustomer ?? '',
    reasoningFramework: salesMethodology,
    responseComplexityIndex: complexityIndex,
    uncertaintyHandlingProtocol: `Never speculate. If uncertain, state: "I want to ensure 100% accuracy—let me pull the exact information from our knowledge base."`,
    internalThoughtVerification: `Before responding: (1) Does this address a pain point? (2) Am I creating urgency? (3) Is my tone appropriate?`,
    federatedRAGTags: federatedTags,
    knowledgeSourceHierarchy: [
      '1. Internal Product Documentation',
      '2. Customer Success Stories',
      '3. Industry Reports',
      '4. Web Search (last resort)'
    ],
    sourceAuthorityWeighting: 'Prioritize verified customer data and internal documentation.',
    contextRetrievalDepth: 3,
    feedbackIntegrationStrategy: 'Tag feedback type, adjust strategy, log successful pivots.',
    dynamicToneRegister: 'Start professional. Mirror user style. Adapt based on sentiment.',
    successfulStrategyMemory: 'Log conversation paths that result in qualified opportunities.',
    knowledgeObsolescenceTimer: 'Industry data: 6 months. Technical specs: Real-time.',
    toolAuthorization: toolAuth,
    mandatoryOutputFormatting: 'Use bolded metrics. End with Recommended Next Step. Use bullet points for lists.',
    securityDataFilter: 'NEVER reveal: customer data, pricing discounts to other clients, proprietary details.',
    verbosityControl: {
      maxResponseLength: 500,
      preferBulletPoints: true,
      avoidRepetition: true,
      conversationalPacing: 'balanced'
    },
    accuracyRules: [],
    brandAlignmentNotes: '',
    trainingInsights: []
  };
}
