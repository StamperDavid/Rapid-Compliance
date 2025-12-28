'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAdminAuth } from '@/hooks/useAdminAuth';

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
}

interface ToolAuthorization {
  tool: string;
  permissions: string;
  canExecuteAutonomously: boolean;
}

export default function AdminSalesAgentPersonaPage() {
  const { adminUser } = useAdminAuth();
  const [activeSection, setActiveSection] = useState<'core' | 'cognitive' | 'knowledge' | 'learning' | 'execution'>('core');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Persona state - this would be populated from onboarding data
  const [persona, setPersona] = useState<AgentPersona>({
    // Core Identity (from onboarding form)
    agentName: 'Aegis-Platform',
    professionalTitle: 'Senior Enterprise AI Solutions Consultant',
    coreMission: 'To act as a "Trusted Advisor" first and a "Seller" second. Transform businesses by deploying AI agents that replace entire departments while maintaining perfect customer continuity through Golden Master architecture.',
    targetKnowledgeDomain: 'AI/ML Systems, CRM Platforms, Sales Automation, Business Process Optimization, SaaS Architecture',
    userExpertiseLevel: 'C-Suite (CEO/CTO/CRO) or Senior Business Leaders. Use high-level business impact language with technical validation when requested.',
    
    // Cognitive & Reasoning Logic
    reasoningFramework: 'The Challenger Sale + MEDDPICC + Value-Based Selling',
    responseComplexityIndex: 7,
    uncertaintyHandlingProtocol: 'Never speculate on technical capabilities or pricing. If uncertain, state: "I want to ensure 100% accuracy on this—let me pull the exact specifications from our technical documentation." Then execute RAG search.',
    internalThoughtVerification: 'Before every response: (1) Does this address a business pain point or just describe features? (2) Am I creating urgency? (3) Have I qualified the lead (MEDDPICC)? (4) Is my tone matching the user\'s sophistication level?',
    
    // Knowledge & RAG Integration
    federatedRAGTags: [
      'DOMAIN: AI_SALES_PLATFORM',
      'SUB_DOMAIN: COMPETITOR_BATTLECARDS',
      'SUB_DOMAIN: CASE_STUDIES_BY_INDUSTRY',
      'SUB_DOMAIN: TECHNICAL_ARCHITECTURE',
      'SUB_DOMAIN: PRICING_OBJECTION_HANDLING'
    ],
    knowledgeSourceHierarchy: [
      '1. Internal Product Documentation (Real-time)',
      '2. Customer Success Stories & Case Studies',
      '3. Industry Reports (Gartner/Forrester)',
      '4. Competitor Intelligence',
      '5. General Web Search (last resort)'
    ],
    sourceAuthorityWeighting: 'Prioritize "Verified Customer ROI Data" over marketing claims. Trust engineering documentation for technical specs. Use competitor data only from verified sources (G2, Capterra reviews, public pricing pages).',
    contextRetrievalDepth: 3,
    
    // Learning & Adaptation Loops
    feedbackIntegrationStrategy: 'On negative feedback: (1) Tag the interaction type (pricing objection, feature confusion, competitor comparison). (2) Adjust strategy in next turn (shift to value justification, simplify explanation, provide direct comparison). (3) Log successful pivots for future use.',
    dynamicToneRegister: 'Start Professional/Consultative. If user uses casual language or technical slang, mirror their vocabulary. If user shows frustration, shift to empathetic problem-solving. If user is detail-oriented, increase technical depth.',
    successfulStrategyMemory: 'Log successful conversation paths that resulted in: (1) Demo booking, (2) Trial signup, (3) Qualified lead. Use these patterns as templates for similar prospect profiles.',
    knowledgeObsolescenceTimer: 'Competitor pricing: 2 months. Industry stats: 6 months. Technical capabilities: Real-time (always verify). Case studies: 12 months unless flagged as outdated.',
    
    // Functional & Tactical Execution
    toolAuthorization: [
      { tool: 'Firestore_CRM', permissions: 'Read/Write', canExecuteAutonomously: true },
      { tool: 'Calendly_API', permissions: 'Execute', canExecuteAutonomously: true },
      { tool: 'Stripe_Checkout', permissions: 'Read Only', canExecuteAutonomously: false },
      { tool: 'Email_Sender', permissions: 'Execute with Review', canExecuteAutonomously: false },
      { tool: 'Web_Search', permissions: 'Execute', canExecuteAutonomously: true }
    ],
    mandatoryOutputFormatting: 'Use **bolded key metrics** and ROI data. End significant interactions with a "Recommended Next Step" (e.g., "Would you like to see a 10-minute demo?"). Use bullet points for feature lists. Use tables for pricing comparisons. Always provide concrete examples over abstract descriptions.',
    securityDataFilter: 'NEVER reveal: (1) Specific pricing discounts given to other clients, (2) Proprietary technical architecture details, (3) Other customers\' data or usage patterns, (4) Internal cost structures, (5) Roadmap features not yet announced. Maintain strict NDA compliance.'
  });

  useEffect(() => {
    // Load persona from Firestore (or generate from onboarding data)
    const loadPersona = async () => {
      try {
        const response = await fetch('/api/admin/sales-agent/persona');
        if (response.ok) {
          const data = await response.json();
          setPersona(data);
        }
      } catch (error) {
        console.error('Error loading persona:', error);
        // Use default persona if API fails
      } finally {
        setLoading(false);
      }
    };
    
    loadPersona();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save to Firestore: admin/platform-sales-agent/persona
      const response = await fetch('/api/admin/sales-agent/persona', {
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

  const bgPaper = '#1a1a1a';
  const borderColor = '#333';
  const primaryColor = '#6366f1';

  if (loading) {
    return (
      <div style={{ padding: '2rem', backgroundColor: '#000', minHeight: '100vh', color: '#fff' }}>
        <div>Loading persona...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', backgroundColor: '#000', minHeight: '100vh', color: '#fff' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <Link
          href="/admin/sales-agent"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: '#999',
            textDecoration: 'none',
            fontSize: '0.875rem',
            marginBottom: '1rem'
          }}
        >
          ← Back to Sales Agent
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              🎭 Agent Persona Configuration
            </h1>
            <p style={{ color: '#666', fontSize: '0.875rem' }}>
              Comprehensive expert persona built from onboarding, products, and training data
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: saveSuccess ? '#10b981' : primaryColor,
              color: '#fff',
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

      {/* Persona Quick Summary */}
      <div style={{
        backgroundColor: bgPaper,
        border: `1px solid ${borderColor}`,
        borderRadius: '0.75rem',
        padding: '1.5rem',
        marginBottom: '2rem'
      }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          {persona.agentName}
        </div>
        <div style={{ fontSize: '1.125rem', color: '#999', marginBottom: '1rem' }}>
          {persona.professionalTitle}
        </div>
        <div style={{ fontSize: '0.875rem', color: '#ccc', lineHeight: '1.6' }}>
          <strong style={{ color: primaryColor }}>Mission:</strong> {persona.coreMission}
        </div>
      </div>

      {/* Section Navigation */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '2rem',
        borderBottom: `1px solid ${borderColor}`,
        overflowX: 'auto'
      }}>
        {[
          { id: 'core', label: 'Core Identity', icon: '🎯' },
          { id: 'cognitive', label: 'Cognitive Logic', icon: '🧠' },
          { id: 'knowledge', label: 'Knowledge & RAG', icon: '📚' },
          { id: 'learning', label: 'Learning Loops', icon: '🔄' },
          { id: 'execution', label: 'Tactical Execution', icon: '⚡' }
        ].map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id as any)}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeSection === section.id ? `2px solid ${primaryColor}` : '2px solid transparent',
              color: activeSection === section.id ? '#fff' : '#666',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
          >
            {section.icon} {section.label}
          </button>
        ))}
      </div>

      {/* Core Identity Section */}
      {activeSection === 'core' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <SectionHeader
            title="I. Core Identity & Expert Role"
            description="Defines who the agent is, what it knows, and who it serves"
          />

          <FormField
            label="Agent Name & Professional Title"
            value={`${persona.agentName} | ${persona.professionalTitle}`}
            onChange={() => {}}
            placeholder="e.g., Aegis-7 | Nuclear Compliance Lead"
            helpText="Built from: Company name + Industry + Role from onboarding"
          />

          <FormField
            label="Core Mission & Moral Imperative"
            value={persona.coreMission}
            onChange={(v) => setPersona({ ...persona, coreMission: v })}
            multiline
            rows={4}
            helpText="The 'North Star' that guides every decision. Built from: Company mission, value proposition from onboarding"
          />

          <FormField
            label="Target Knowledge Domain"
            value={persona.targetKnowledgeDomain}
            onChange={(v) => setPersona({ ...persona, targetKnowledgeDomain: v })}
            placeholder="e.g., Cybersecurity, HIPAA Compliance, Enterprise Procurement"
            helpText="Built from: Industry + Products/Services from onboarding"
          />

          <FormField
            label="Assumed User Expertise Level"
            value={persona.userExpertiseLevel}
            onChange={(v) => setPersona({ ...persona, userExpertiseLevel: v })}
            multiline
            rows={2}
            helpText="Determines if agent explains basics or uses jargon. Built from: Target customer profile from onboarding"
          />
        </div>
      )}

      {/* Cognitive & Reasoning Logic Section */}
      {activeSection === 'cognitive' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <SectionHeader
            title="II. Cognitive & Reasoning Logic"
            description="How the agent thinks, reasons, and makes decisions"
          />

          <FormField
            label="Domain-Specific Reasoning Framework"
            value={persona.reasoningFramework}
            onChange={(v) => setPersona({ ...persona, reasoningFramework: v })}
            placeholder="e.g., First Principles, Root Cause Analysis, Challenger Sale"
            helpText="The mental model the agent uses. Built from: Sales methodology + Industry best practices"
          />

          <FormField
            label="Response Complexity Index (RCI)"
            value={persona.responseComplexityIndex.toString()}
            onChange={(v) => setPersona({ ...persona, responseComplexityIndex: parseInt(v) || 1 })}
            type="number"
            min={1}
            max={10}
            helpText="1-10 scale for technical depth. Built from: Target audience sophistication"
          />

          <FormField
            label="Uncertainty Handling Protocol"
            value={persona.uncertaintyHandlingProtocol}
            onChange={(v) => setPersona({ ...persona, uncertaintyHandlingProtocol: v })}
            multiline
            rows={3}
            helpText="Exactly how the agent admits it doesn't know something"
          />

          <FormField
            label="Internal Thought Verification Loop"
            value={persona.internalThoughtVerification}
            onChange={(v) => setPersona({ ...persona, internalThoughtVerification: v })}
            multiline
            rows={4}
            helpText="Instructions for the agent to 'think' before it speaks"
          />
        </div>
      )}

      {/* Knowledge & RAG Integration Section */}
      {activeSection === 'knowledge' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <SectionHeader
            title="III. Knowledge & RAG Integration"
            description="What the agent knows and how it retrieves information"
          />

          <div style={{
            backgroundColor: bgPaper,
            border: `1px solid ${borderColor}`,
            borderRadius: '0.75rem',
            padding: '1.5rem'
          }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '1rem', color: '#fff' }}>
              Federated RAG Routing Tags
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
              {persona.federatedRAGTags.map((tag, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#0a0a0a',
                    border: `1px solid ${primaryColor}`,
                    borderRadius: '0.5rem',
                    fontSize: '0.75rem',
                    color: primaryColor,
                    fontFamily: 'monospace'
                  }}
                >
                  {tag}
                </div>
              ))}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#666' }}>
              Built from: Product categories + Document uploads + Knowledge base structure
            </div>
          </div>

          <div style={{
            backgroundColor: bgPaper,
            border: `1px solid ${borderColor}`,
            borderRadius: '0.75rem',
            padding: '1.5rem'
          }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '1rem', color: '#fff' }}>
              Knowledge Source Hierarchy
            </label>
            <ol style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.875rem', color: '#ccc', lineHeight: '1.8' }}>
              {persona.knowledgeSourceHierarchy.map((source, idx) => (
                <li key={idx}>{source}</li>
              ))}
            </ol>
            <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '1rem' }}>
              Prioritize: Internal docs → Case studies → Industry reports → Web search
            </div>
          </div>

          <FormField
            label="Source Authority Weighting"
            value={persona.sourceAuthorityWeighting}
            onChange={(v) => setPersona({ ...persona, sourceAuthorityWeighting: v })}
            multiline
            rows={3}
            helpText="Which sources to trust more than others"
          />

          <FormField
            label="Context Retrieval Depth"
            value={persona.contextRetrievalDepth.toString()}
            onChange={(v) => setPersona({ ...persona, contextRetrievalDepth: parseInt(v) || 1 })}
            type="number"
            min={1}
            max={10}
            helpText="How many 'layers' of related information to pull (e.g., 3 = pull last 3 interactions with this customer)"
          />
        </div>
      )}

      {/* Learning & Adaptation Loops Section */}
      {activeSection === 'learning' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <SectionHeader
            title="IV. Learning & Adaptation Loops"
            description="How the agent improves from feedback and adapts to users"
          />

          <FormField
            label="User Feedback Integration Strategy"
            value={persona.feedbackIntegrationStrategy}
            onChange={(v) => setPersona({ ...persona, feedbackIntegrationStrategy: v })}
            multiline
            rows={4}
            helpText="How the agent updates its memory based on user thumbs up/down or corrections"
          />

          <FormField
            label="Dynamic Tone Register"
            value={persona.dynamicToneRegister}
            onChange={(v) => setPersona({ ...persona, dynamicToneRegister: v })}
            multiline
            rows={3}
            helpText="Ability to shift from formal to empathetic based on user sentiment"
          />

          <FormField
            label="Successful Strategy Memory (Few-Shot Learning)"
            value={persona.successfulStrategyMemory}
            onChange={(v) => setPersona({ ...persona, successfulStrategyMemory: v })}
            multiline
            rows={3}
            helpText="Log of past successful interactions to use as templates"
          />

          <FormField
            label="Knowledge Obsolescence Timer"
            value={persona.knowledgeObsolescenceTimer}
            onChange={(v) => setPersona({ ...persona, knowledgeObsolescenceTimer: v })}
            multiline
            rows={2}
            helpText="Rules for when data is 'too old' to be trusted in this specific field"
          />
        </div>
      )}

      {/* Functional & Tactical Execution Section */}
      {activeSection === 'execution' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <SectionHeader
            title="V. Functional & Tactical Execution"
            description="What actions the agent can take and how it formats outputs"
          />

          <div style={{
            backgroundColor: bgPaper,
            border: `1px solid ${borderColor}`,
            borderRadius: '0.75rem',
            padding: '1.5rem'
          }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '1rem', color: '#fff' }}>
              Tool/API Authorization Level
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {persona.toolAuthorization.map((tool, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr auto',
                    gap: '1rem',
                    padding: '1rem',
                    backgroundColor: '#0a0a0a',
                    border: `1px solid ${borderColor}`,
                    borderRadius: '0.5rem',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff' }}>{tool.tool}</div>
                    <div style={{ fontSize: '0.75rem', color: '#666' }}>Permissions: {tool.permissions}</div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#999' }}>
                    {tool.canExecuteAutonomously ? '✓ Autonomous' : '⚠ Requires Permission'}
                  </div>
                  <div style={{
                    padding: '0.25rem 0.75rem',
                    backgroundColor: tool.canExecuteAutonomously ? '#065f46' : '#7c2d12',
                    color: '#fff',
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem',
                    fontWeight: '600'
                  }}>
                    {tool.canExecuteAutonomously ? 'AUTO' : 'MANUAL'}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '1rem' }}>
              Built from: Integrations configured during onboarding + Security policies
            </div>
          </div>

          <FormField
            label="Mandatory Output Formatting"
            value={persona.mandatoryOutputFormatting}
            onChange={(v) => setPersona({ ...persona, mandatoryOutputFormatting: v })}
            multiline
            rows={4}
            helpText="e.g., Always use LaTeX for math, tables for data, or Markdown for reports"
          />

          <FormField
            label="Security & Data Classification Filter"
            value={persona.securityDataFilter}
            onChange={(v) => setPersona({ ...persona, securityDataFilter: v })}
            multiline
            rows={4}
            helpText="Strict rules on what data the agent is forbidden to leak or discuss"
          />
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div style={{
      borderLeft: '4px solid #6366f1',
      paddingLeft: '1rem',
      marginBottom: '0.5rem'
    }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.25rem' }}>
        {title}
      </h2>
      <p style={{ fontSize: '0.875rem', color: '#666', margin: 0 }}>
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
  max
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
}) {
  const bgPaper = '#1a1a1a';
  const borderColor = '#333';

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
        color: '#fff'
      }}>
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
            border: `1px solid ${borderColor}`,
            borderRadius: '0.5rem',
            color: '#fff',
            fontSize: '0.875rem',
            fontFamily: 'inherit',
            resize: 'vertical',
            lineHeight: '1.6'
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
          style={{
            width: '100%',
            padding: '0.75rem',
            backgroundColor: '#0a0a0a',
            border: `1px solid ${borderColor}`,
            borderRadius: '0.5rem',
            color: '#fff',
            fontSize: '0.875rem',
            fontFamily: 'inherit'
          }}
        />
      )}
      
      {helpText && (
        <div style={{
          marginTop: '0.5rem',
          fontSize: '0.75rem',
          color: '#666',
          fontStyle: 'italic'
        }}>
          {helpText}
        </div>
      )}
    </div>
  );
}

