'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import AdminBar from '@/components/AdminBar';
import { useAuth } from '@/hooks/useAuth';
import { STANDARD_SCHEMAS } from '@/lib/schema/standard-schemas';

export default function AgentPersonaPage() {
  const { user } = useAuth();
  const params = useParams();
  const orgId = params.orgId as string;
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'knowledge' | 'personality' | 'capabilities' | 'model'>('knowledge');
  
  // Ensemble mode state
  const [aiMode, setAiMode] = useState<'ensemble' | 'smart' | 'single'>('ensemble');
  const [ensembleMode, setEnsembleMode] = useState<'best' | 'consensus' | 'synthesize'>('best');
  const [selectedModel, setSelectedModel] = useState('gemini-2.0-flash-exp'); // For single mode
  const [modelConfig, setModelConfig] = useState({
    temperature: 0.7,
    maxTokens: 2048,
    topP: 0.9,
  });
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load configuration from Firestore
  React.useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch(`/api/agent/config?orgId=${orgId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.aiMode) {
            setAiMode(data.aiMode);
          }
          if (data.ensembleMode) {
            setEnsembleMode(data.ensembleMode);
          }
          if (data.model) {
            setSelectedModel(data.model);
          }
          if (data.modelConfig) {
            setModelConfig(data.modelConfig);
          }
        }
      } catch (error) {
        console.error('Failed to load config:', error);
      }
    };
    loadConfig();
  }, [orgId]);

  // Save model configuration
  const handleSaveModelSettings = async () => {
    setSaveLoading(true);
    setSaveSuccess(false);
    try {
      const response = await fetch(`/api/agent/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orgId,
          aiMode,
          ensembleMode,
          model: selectedModel,
          modelConfig,
          useEnsemble: aiMode === 'ensemble',
        }),
      });

      if (response.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        alert('Failed to save AI settings');
      }
    } catch (error) {
      console.error('Error saving AI settings:', error);
      alert('Error saving AI settings');
    } finally {
      setSaveLoading(false);
    }
  };

  React.useEffect(() => {
    const savedTheme = localStorage.getItem('appTheme');
    if (savedTheme) {
      try {
        setTheme(JSON.parse(savedTheme));
      } catch (error) {
        console.error('Failed to load theme:', error);
      }
    }
  }, []);

  const primaryColor = theme?.colors?.primary?.main || '#6366f1';

  // Mock data - will be replaced with real data from Firestore
  const [documents, setDocuments] = useState([
    { id: '1', name: 'Product Catalog 2024.pdf', type: 'document', uploadedAt: '2024-11-20', status: 'processed' },
    { id: '2', name: 'Pricing Guide.xlsx', type: 'document', uploadedAt: '2024-11-18', status: 'processed' }
  ]);

  const [urls, setUrls] = useState([
    { id: '1', url: 'https://example.com/company-info', title: 'Company Overview', lastScraped: '2024-11-20' },
    { id: '2', url: 'https://example.com/faq', title: 'FAQ Page', lastScraped: '2024-11-19' }
  ]);

  const [customInstructions, setCustomInstructions] = useState(
    'You are a professional sales and customer service agent. Always be helpful, courteous, and aim to close sales while providing excellent support.'
  );

  const [personality, setPersonality] = useState({
    tone: 'professional',
    verbosity: 'balanced',
    formality: 'professional',
    useEmojis: false,
    useBulletPoints: true
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#000000' }}>
      <AdminBar />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div style={{ width: sidebarOpen ? '260px' : '70px', backgroundColor: '#0a0a0a', borderRight: '1px solid #1a1a1a', transition: 'width 0.3s', display: 'flex', flexDirection: 'column' }}>
          <nav style={{ flex: 1, padding: '1rem 0', overflowY: 'auto' }}>
            <Link href="/crm" style={{ width: '100%', padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: 'transparent', color: '#999', borderLeft: '3px solid transparent', fontSize: '0.875rem', fontWeight: '400', textDecoration: 'none' }}>
              <span style={{ fontSize: '1.25rem' }}>🏠</span>
              {sidebarOpen && <span>CRM</span>}
            </Link>
            <Link href={`/workspace/${orgId}/conversations`} style={{ width: '100%', padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: 'transparent', color: '#999', borderLeft: '3px solid transparent', fontSize: '0.875rem', fontWeight: '400', textDecoration: 'none', position: 'relative' }}>
              <span style={{ fontSize: '1.25rem' }}>💬</span>
              {sidebarOpen && <span>Conversations</span>}
              {/* Alert badge */}
              <span style={{
                position: 'absolute',
                top: '0.75rem',
                right: sidebarOpen ? '1rem' : '0.5rem',
                width: '8px',
                height: '8px',
                backgroundColor: '#ef4444',
                borderRadius: '50%',
                boxShadow: '0 0 8px #ef4444'
              }} />
            </Link>
            {Object.entries(STANDARD_SCHEMAS).map(([key, schema]) => (
              <Link key={key} href={`/crm?view=${key}`} style={{ width: '100%', padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: 'transparent', color: '#999', borderLeft: '3px solid transparent', fontSize: '0.875rem', fontWeight: '400', textDecoration: 'none' }}>
                <span style={{ fontSize: '1.25rem' }}>{schema.icon}</span>
                {sidebarOpen && <span>{schema.pluralName}</span>}
              </Link>
            ))}
          </nav>
          <div style={{ padding: '1rem', borderTop: '1px solid #1a1a1a' }}>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ width: '100%', padding: '0.5rem', backgroundColor: '#1a1a1a', color: '#999', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}>
              {sidebarOpen ? '← Collapse' : '→'}
            </button>
          </div>
        </div>

        <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ marginBottom: '2rem' }}>
              <Link href={`/workspace/${orgId}/settings/ai-agents`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: primaryColor, fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none', marginBottom: '1.5rem' }}>
                ← Back to AI Agent
              </Link>
              <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem', marginTop: '1rem' }}>Agent Persona</h1>
              <p style={{ color: '#666', fontSize: '0.875rem' }}>Configure your AI agent's knowledge base and personality</p>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid #333' }}>
              {[
                { id: 'model', label: 'AI Model', icon: '🤖' },
                { id: 'knowledge', label: 'Knowledge Base', icon: '📚' },
                { id: 'personality', label: 'Personality', icon: '🎭' },
                { id: 'capabilities', label: 'Capabilities', icon: '⚡' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  style={{
                    padding: '1rem 1.5rem',
                    backgroundColor: 'transparent',
                    color: activeTab === tab.id ? primaryColor : '#999',
                    border: 'none',
                    borderBottom: `3px solid ${activeTab === tab.id ? primaryColor : 'transparent'}`,
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.2s'
                  }}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* AI Model Tab */}
            {activeTab === 'model' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Hero Section */}
                <div style={{ backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: '1px solid #667eea', borderRadius: '1rem', padding: '2rem', background: `linear-gradient(135deg, ${primaryColor}22 0%, ${primaryColor}11 100%)` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '2.5rem' }}>🎯</span>
                    <div>
                      <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.25rem' }}>Industry-Leading AI Quality</h2>
                      <p style={{ fontSize: '0.875rem', color: '#999' }}>Our secret weapon: Query multiple AI models and pick the best answer</p>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
                    <div style={{ backgroundColor: '#0a0a0a66', borderRadius: '0.5rem', padding: '1rem', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: primaryColor }}>3-5</div>
                      <div style={{ fontSize: '0.75rem', color: '#999' }}>Models Queried</div>
                    </div>
                    <div style={{ backgroundColor: '#0a0a0a66', borderRadius: '0.5rem', padding: '1rem', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: primaryColor }}>95+</div>
                      <div style={{ fontSize: '0.75rem', color: '#999' }}>Quality Score</div>
                    </div>
                    <div style={{ backgroundColor: '#0a0a0a66', borderRadius: '0.5rem', padding: '1rem', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: primaryColor }}>&lt;2s</div>
                      <div style={{ fontSize: '0.75rem', color: '#999' }}>Response Time</div>
                    </div>
                  </div>
                </div>

                {/* AI Mode Selection */}
                <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '2rem' }}>
                  <div style={{ marginBottom: '2rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>AI Mode</h2>
                    <p style={{ fontSize: '0.875rem', color: '#666' }}>Choose how your AI agent selects its response</p>
                  </div>

                  {/* Mode Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                    {/* Ensemble Mode */}
                    <div 
                      onClick={() => setAiMode('ensemble')}
                      style={{ 
                        backgroundColor: '#0a0a0a', 
                        border: `2px solid ${aiMode === 'ensemble' ? primaryColor : '#222'}`, 
                        borderRadius: '0.75rem', 
                        padding: '1.5rem', 
                        cursor: 'pointer', 
                        transition: 'all 0.2s',
                        position: 'relative'
                      }}
                    >
                      {aiMode === 'ensemble' && (
                        <div style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', color: primaryColor, fontSize: '1.25rem' }}>✓</div>
                      )}
                      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎯</div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
                        Ensemble Mode ⭐
                      </h3>
                      <p style={{ fontSize: '0.75rem', color: '#999', marginBottom: '1rem', lineHeight: '1.4' }}>
                        Query 3-5 models in parallel, score each response, return the best answer. Highest quality, industry-leading.
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ fontSize: '0.7rem', color: '#666' }}>✓ Best quality guaranteed</div>
                        <div style={{ fontSize: '0.7rem', color: '#666' }}>✓ Auto-selects best model</div>
                        <div style={{ fontSize: '0.7rem', color: '#666' }}>✓ No competitor has this</div>
                      </div>
                    </div>

                    {/* Smart Mode */}
                    <div 
                      onClick={() => setAiMode('smart')}
                      style={{ 
                        backgroundColor: '#0a0a0a', 
                        border: `2px solid ${aiMode === 'smart' ? primaryColor : '#222'}`, 
                        borderRadius: '0.75rem', 
                        padding: '1.5rem', 
                        cursor: 'pointer', 
                        transition: 'all 0.2s',
                        position: 'relative'
                      }}
                    >
                      {aiMode === 'smart' && (
                        <div style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', color: primaryColor, fontSize: '1.25rem' }}>✓</div>
                      )}
                      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🧠</div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
                        Smart Auto-Select
                      </h3>
                      <p style={{ fontSize: '0.75rem', color: '#999', marginBottom: '1rem', lineHeight: '1.4' }}>
                        AI automatically picks the best single model for each conversation based on context and complexity.
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ fontSize: '0.7rem', color: '#666' }}>✓ Balanced quality & cost</div>
                        <div style={{ fontSize: '0.7rem', color: '#666' }}>✓ Context-aware selection</div>
                        <div style={{ fontSize: '0.7rem', color: '#666' }}>✓ Faster than ensemble</div>
                      </div>
                    </div>

                    {/* Single Model Mode */}
                    <div 
                      onClick={() => setAiMode('single')}
                      style={{ 
                        backgroundColor: '#0a0a0a', 
                        border: `2px solid ${aiMode === 'single' ? primaryColor : '#222'}`, 
                        borderRadius: '0.75rem', 
                        padding: '1.5rem', 
                        cursor: 'pointer', 
                        transition: 'all 0.2s',
                        position: 'relative',
                        opacity: 0.7
                      }}
                    >
                      {aiMode === 'single' && (
                        <div style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', color: primaryColor, fontSize: '1.25rem' }}>✓</div>
                      )}
                      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚙️</div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
                        Single Model
                      </h3>
                      <p style={{ fontSize: '0.75rem', color: '#999', marginBottom: '1rem', lineHeight: '1.4' }}>
                        Choose one specific model. More predictable cost, but quality varies by conversation.
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ fontSize: '0.7rem', color: '#666' }}>✓ Fixed cost per conversation</div>
                        <div style={{ fontSize: '0.7rem', color: '#666' }}>✓ Full control</div>
                        <div style={{ fontSize: '0.7rem', color: '#666' }}>⚠️ Quality varies</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ensemble Settings (if ensemble mode selected) */}
                {aiMode === 'ensemble' && (
                  <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '2rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '1.5rem' }}>Ensemble Strategy</h2>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {/* Best Response */}
                      <div 
                        onClick={() => setEnsembleMode('best')}
                        style={{ 
                          backgroundColor: ensembleMode === 'best' ? '#0a0a0a' : 'transparent',
                          border: `1px solid ${ensembleMode === 'best' ? primaryColor : '#222'}`,
                          borderRadius: '0.5rem',
                          padding: '1rem',
                          cursor: 'pointer',
                          display: 'flex',
                          gap: '1rem',
                          alignItems: 'flex-start'
                        }}
                      >
                        <input 
                          type="radio" 
                          checked={ensembleMode === 'best'}
                          onChange={() => setEnsembleMode('best')}
                          style={{ marginTop: '0.25rem' }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '600', color: '#fff', marginBottom: '0.25rem' }}>Best Response (Recommended)</div>
                          <div style={{ fontSize: '0.8rem', color: '#999' }}>Score each model's response on coherence, relevance, specificity, and confidence. Return the highest-scoring answer.</div>
                        </div>
                      </div>

                      {/* Consensus */}
                      <div 
                        onClick={() => setEnsembleMode('consensus')}
                        style={{ 
                          backgroundColor: ensembleMode === 'consensus' ? '#0a0a0a' : 'transparent',
                          border: `1px solid ${ensembleMode === 'consensus' ? primaryColor : '#222'}`,
                          borderRadius: '0.5rem',
                          padding: '1rem',
                          cursor: 'pointer',
                          display: 'flex',
                          gap: '1rem',
                          alignItems: 'flex-start'
                        }}
                      >
                        <input 
                          type="radio" 
                          checked={ensembleMode === 'consensus'}
                          onChange={() => setEnsembleMode('consensus')}
                          style={{ marginTop: '0.25rem' }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '600', color: '#fff', marginBottom: '0.25rem' }}>Consensus</div>
                          <div style={{ fontSize: '0.8rem', color: '#999' }}>Find common themes across all models. Best for factual accuracy and reducing hallucinations.</div>
                        </div>
                      </div>

                      {/* Synthesize */}
                      <div 
                        onClick={() => setEnsembleMode('synthesize')}
                        style={{ 
                          backgroundColor: ensembleMode === 'synthesize' ? '#0a0a0a' : 'transparent',
                          border: `1px solid ${ensembleMode === 'synthesize' ? primaryColor : '#222'}`,
                          borderRadius: '0.5rem',
                          padding: '1rem',
                          cursor: 'pointer',
                          display: 'flex',
                          gap: '1rem',
                          alignItems: 'flex-start'
                        }}
                      >
                        <input 
                          type="radio" 
                          checked={ensembleMode === 'synthesize'}
                          onChange={() => setEnsembleMode('synthesize')}
                          style={{ marginTop: '0.25rem' }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '600', color: '#fff', marginBottom: '0.25rem' }}>Synthesize</div>
                          <div style={{ fontSize: '0.8rem', color: '#999' }}>Combine the best parts of multiple responses into one superior answer. Most comprehensive.</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Single Model Selection (if single mode selected) */}
                {aiMode === 'single' && (
                  <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '2rem' }}>
                    <div style={{ marginBottom: '2rem' }}>
                      <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>Choose AI Model</h2>
                      <p style={{ fontSize: '0.875rem', color: '#666' }}>Select the AI model that best fits your needs for quality, speed, and cost.</p>
                    </div>

                  {/* Model Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                    {/* Google Gemini */}
                    <div style={{ backgroundColor: '#0a0a0a', border: `2px solid ${selectedModel.startsWith('gemini') ? primaryColor : '#222'}`, borderRadius: '0.75rem', padding: '1.5rem', cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => setSelectedModel('gemini-2.0-flash-exp')}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontSize: '1.5rem' }}>🌟</span>
                          <div>
                            <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fff' }}>Gemini Flash</h3>
                            <p style={{ fontSize: '0.75rem', color: '#666' }}>Fast & Affordable</p>
                          </div>
                        </div>
                        {selectedModel === 'gemini-2.0-flash-exp' && <span style={{ color: primaryColor, fontSize: '1.25rem' }}>✓</span>}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                          <span style={{ color: '#999' }}>Speed:</span>
                          <div style={{ display: 'flex', gap: '2px' }}>
                            {[1,2,3,4,5].map(i => <div key={i} style={{ width: '8px', height: '8px', backgroundColor: i <= 5 ? '#10b981' : '#333', borderRadius: '2px' }} />)}
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                          <span style={{ color: '#999' }}>Quality:</span>
                          <div style={{ display: 'flex', gap: '2px' }}>
                            {[1,2,3,4,5].map(i => <div key={i} style={{ width: '8px', height: '8px', backgroundColor: i <= 4 ? '#3b82f6' : '#333', borderRadius: '2px' }} />)}
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                          <span style={{ color: '#999' }}>Cost:</span>
                          <span style={{ color: '#10b981', fontWeight: '600' }}>$0.0001/1K tokens</span>
                        </div>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: '#999', lineHeight: '1.4' }}>Best for high-volume conversations where speed matters. Latest model from Google.</p>
                    </div>

                    {/* GPT-4 */}
                    <div style={{ backgroundColor: '#0a0a0a', border: `2px solid ${selectedModel === 'gpt-4' ? primaryColor : '#222'}`, borderRadius: '0.75rem', padding: '1.5rem', cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => setSelectedModel('gpt-4')}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontSize: '1.5rem' }}>🚀</span>
                          <div>
                            <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fff' }}>GPT-4</h3>
                            <p style={{ fontSize: '0.75rem', color: '#666' }}>Best Quality</p>
                          </div>
                        </div>
                        {selectedModel === 'gpt-4' && <span style={{ color: primaryColor, fontSize: '1.25rem' }}>✓</span>}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                          <span style={{ color: '#999' }}>Speed:</span>
                          <div style={{ display: 'flex', gap: '2px' }}>
                            {[1,2,3,4,5].map(i => <div key={i} style={{ width: '8px', height: '8px', backgroundColor: i <= 3 ? '#10b981' : '#333', borderRadius: '2px' }} />)}
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                          <span style={{ color: '#999' }}>Quality:</span>
                          <div style={{ display: 'flex', gap: '2px' }}>
                            {[1,2,3,4,5].map(i => <div key={i} style={{ width: '8px', height: '8px', backgroundColor: i <= 5 ? '#3b82f6' : '#333', borderRadius: '2px' }} />)}
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                          <span style={{ color: '#999' }}>Cost:</span>
                          <span style={{ color: '#f59e0b', fontWeight: '600' }}>$0.03/1K tokens</span>
                        </div>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: '#999', lineHeight: '1.4' }}>OpenAI's most capable model. Best for complex reasoning and high-stakes conversations.</p>
                    </div>

                    {/* Claude 3.5 Sonnet */}
                    <div style={{ backgroundColor: '#0a0a0a', border: `2px solid ${selectedModel === 'claude-3.5-sonnet' ? primaryColor : '#222'}`, borderRadius: '0.75rem', padding: '1.5rem', cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => setSelectedModel('claude-3.5-sonnet')}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontSize: '1.5rem' }}>🎨</span>
                          <div>
                            <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fff' }}>Claude 3.5</h3>
                            <p style={{ fontSize: '0.75rem', color: '#666' }}>Creative & Balanced</p>
                          </div>
                        </div>
                        {selectedModel === 'claude-3.5-sonnet' && <span style={{ color: primaryColor, fontSize: '1.25rem' }}>✓</span>}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                          <span style={{ color: '#999' }}>Speed:</span>
                          <div style={{ display: 'flex', gap: '2px' }}>
                            {[1,2,3,4,5].map(i => <div key={i} style={{ width: '8px', height: '8px', backgroundColor: i <= 4 ? '#10b981' : '#333', borderRadius: '2px' }} />)}
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                          <span style={{ color: '#999' }}>Quality:</span>
                          <div style={{ display: 'flex', gap: '2px' }}>
                            {[1,2,3,4,5].map(i => <div key={i} style={{ width: '8px', height: '8px', backgroundColor: i <= 5 ? '#3b82f6' : '#333', borderRadius: '2px' }} />)}
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                          <span style={{ color: '#999' }}>Cost:</span>
                          <span style={{ color: '#f59e0b', fontWeight: '600' }}>$0.003/1K tokens</span>
                        </div>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: '#999', lineHeight: '1.4' }}>Anthropic's latest model. Excellent for creative writing and nuanced conversations.</p>
                    </div>
                  </div>

                  {/* Show all models dropdown */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#fff', marginBottom: '0.5rem' }}>
                      Or choose from all available models:
                    </label>
                    <select 
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      style={{ 
                        width: '100%', 
                        padding: '0.75rem', 
                        backgroundColor: '#0a0a0a', 
                        border: '1px solid #333', 
                        borderRadius: '0.5rem', 
                        color: '#fff',
                        fontSize: '0.875rem',
                        cursor: 'pointer'
                      }}
                    >
                      <optgroup label="Google Gemini">
                        <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash (Fastest, Cheapest)</option>
                        <option value="gemini-pro">Gemini Pro (Balanced)</option>
                      </optgroup>
                      <optgroup label="OpenAI">
                        <option value="gpt-4">GPT-4 (Best Quality)</option>
                        <option value="gpt-4-turbo">GPT-4 Turbo (Fast + Quality)</option>
                        <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Affordable)</option>
                      </optgroup>
                      <optgroup label="Anthropic">
                        <option value="claude-3.5-sonnet">Claude 3.5 Sonnet (Latest)</option>
                        <option value="claude-3-opus">Claude 3 Opus (Best Reasoning)</option>
                      </optgroup>
                    </select>
                  </div>
                </div>

                {/* Advanced Model Configuration */}
                <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '2rem' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '1.5rem' }}>Advanced Configuration</h2>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Temperature */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <label style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff' }}>Temperature</label>
                        <span style={{ fontSize: '0.875rem', color: primaryColor, fontWeight: '600' }}>{modelConfig.temperature}</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="2" 
                        step="0.1" 
                        value={modelConfig.temperature}
                        onChange={(e) => setModelConfig({...modelConfig, temperature: parseFloat(e.target.value)})}
                        style={{ width: '100%' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#666', marginTop: '0.5rem' }}>
                        <span>Precise (0.0)</span>
                        <span>Creative (2.0)</span>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.5rem' }}>Higher values make output more random and creative. Lower values make it more focused and deterministic.</p>
                    </div>

                    {/* Max Tokens */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <label style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff' }}>Max Response Length</label>
                        <span style={{ fontSize: '0.875rem', color: primaryColor, fontWeight: '600' }}>{modelConfig.maxTokens} tokens</span>
                      </div>
                      <input 
                        type="range" 
                        min="256" 
                        max="4096" 
                        step="256" 
                        value={modelConfig.maxTokens}
                        onChange={(e) => setModelConfig({...modelConfig, maxTokens: parseInt(e.target.value)})}
                        style={{ width: '100%' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#666', marginTop: '0.5rem' }}>
                        <span>Short (256)</span>
                        <span>Long (4096)</span>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.5rem' }}>Maximum length of the AI's response. ~4 tokens = 3 words.</p>
                    </div>

                    {/* Top P */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <label style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff' }}>Top P (Nucleus Sampling)</label>
                        <span style={{ fontSize: '0.875rem', color: primaryColor, fontWeight: '600' }}>{modelConfig.topP}</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.05" 
                        value={modelConfig.topP}
                        onChange={(e) => setModelConfig({...modelConfig, topP: parseFloat(e.target.value)})}
                        style={{ width: '100%' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#666', marginTop: '0.5rem' }}>
                        <span>Focused (0.0)</span>
                        <span>Diverse (1.0)</span>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.5rem' }}>Controls diversity via nucleus sampling. Alternative to temperature.</p>
                    </div>
                  </div>
                </div>

                {/* Save Button */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', alignItems: 'center' }}>
                  {saveSuccess && (
                    <span style={{ color: '#10b981', fontSize: '0.875rem', fontWeight: '600' }}>
                      ✓ Saved successfully!
                    </span>
                  )}
                  <button style={{ padding: '0.75rem 2rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600' }}>
                    Test Configuration
                  </button>
                  <button 
                    onClick={handleSaveModelSettings}
                    disabled={saveLoading}
                    style={{ 
                      padding: '0.75rem 2rem', 
                      backgroundColor: saveLoading ? '#666' : primaryColor, 
                      color: '#fff', 
                      border: 'none', 
                      borderRadius: '0.5rem', 
                      cursor: saveLoading ? 'not-allowed' : 'pointer', 
                      fontSize: '0.875rem', 
                      fontWeight: '600' 
                    }}
                  >
                    {saveLoading ? 'Saving...' : 'Save Model Settings'}
                  </button>
                </div>
              </div>
            )}

            {/* Knowledge Base Tab */}
            {activeTab === 'knowledge' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Documents Section */}
                <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div>
                      <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.25rem' }}>Documents</h2>
                      <p style={{ fontSize: '0.875rem', color: '#666' }}>Upload product catalogs, pricing sheets, manuals, etc.</p>
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
                      + Upload Document
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {documents.map((doc) => (
                      <div key={doc.id} style={{ 
                        backgroundColor: '#0a0a0a', 
                        border: '1px solid #222', 
                        borderRadius: '0.5rem', 
                        padding: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div style={{ fontSize: '1.5rem' }}>📄</div>
                          <div>
                            <div style={{ color: '#fff', fontWeight: '500', fontSize: '0.875rem' }}>{doc.name}</div>
                            <div style={{ color: '#666', fontSize: '0.75rem' }}>Uploaded {doc.uploadedAt}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <span style={{ 
                            padding: '0.25rem 0.75rem', 
                            backgroundColor: '#0f4c0f', 
                            color: '#4ade80', 
                            borderRadius: '9999px', 
                            fontSize: '0.75rem',
                            fontWeight: '600'
                          }}>
                            {doc.status}
                          </span>
                          <button style={{ color: '#ef4444', fontSize: '0.875rem', background: 'none', border: 'none', cursor: 'pointer' }}>
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* URLs Section */}
                <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div>
                      <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.25rem' }}>URLs</h2>
                      <p style={{ fontSize: '0.875rem', color: '#666' }}>Add web pages for the agent to learn from</p>
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
                      + Add URL
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {urls.map((url) => (
                      <div key={url.id} style={{ 
                        backgroundColor: '#0a0a0a', 
                        border: '1px solid #222', 
                        borderRadius: '0.5rem', 
                        padding: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div style={{ fontSize: '1.5rem' }}>🔗</div>
                          <div>
                            <div style={{ color: '#fff', fontWeight: '500', fontSize: '0.875rem' }}>{url.title}</div>
                            <div style={{ color: '#666', fontSize: '0.75rem' }}>{url.url}</div>
                            <div style={{ color: '#666', fontSize: '0.75rem' }}>Last scraped {url.lastScraped}</div>
                          </div>
                        </div>
                        <button style={{ color: '#ef4444', fontSize: '0.875rem', background: 'none', border: 'none', cursor: 'pointer' }}>
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Custom Instructions */}
                <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '2rem' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>Custom Instructions</h2>
                  <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '1.5rem' }}>
                    Additional instructions and context for your AI agent
                  </p>
                  <textarea
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    placeholder="Enter custom instructions for your agent..."
                    rows={8}
                    style={{
                      width: '100%',
                      padding: '1rem',
                      backgroundColor: '#0a0a0a',
                      border: '1px solid #333',
                      borderRadius: '0.5rem',
                      color: '#fff',
                      fontSize: '0.875rem',
                      resize: 'vertical',
                      fontFamily: 'monospace'
                    }}
                  />
                  <button style={{ 
                    marginTop: '1rem',
                    padding: '0.75rem 1.5rem', 
                    backgroundColor: primaryColor, 
                    color: '#fff', 
                    border: 'none', 
                    borderRadius: '0.5rem', 
                    cursor: 'pointer', 
                    fontSize: '0.875rem', 
                    fontWeight: '600' 
                  }}>
                    Save Instructions
                  </button>
                </div>

                {/* CRM Data Sources */}
                <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '2rem' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>CRM Data Sources</h2>
                  <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '1.5rem' }}>
                    Select which CRM objects the agent can access for information
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {Object.entries(STANDARD_SCHEMAS).slice(0, 4).map(([key, schema]) => (
                      <label key={key} style={{ 
                        backgroundColor: '#0a0a0a', 
                        border: '1px solid #222', 
                        borderRadius: '0.5rem', 
                        padding: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        cursor: 'pointer'
                      }}>
                        <input type="checkbox" defaultChecked style={{ width: '20px', height: '20px' }} />
                        <span style={{ fontSize: '1.25rem' }}>{schema.icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: '#fff', fontWeight: '500', fontSize: '0.875rem' }}>{schema.pluralName}</div>
                          <div style={{ color: '#666', fontSize: '0.75rem' }}>Allow agent to access {schema.pluralName.toLowerCase()} data</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Personality Tab */}
            {activeTab === 'personality' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '2rem' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '1.5rem' }}>Personality Settings</h2>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                    {/* Tone */}
                    <div>
                      <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                        Tone
                      </label>
                      <select
                        value={personality.tone}
                        onChange={(e) => setPersonality({ ...personality, tone: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          backgroundColor: '#0a0a0a',
                          border: '1px solid #333',
                          borderRadius: '0.5rem',
                          color: '#fff',
                          fontSize: '0.875rem'
                        }}
                      >
                        <option value="professional">Professional</option>
                        <option value="friendly">Friendly</option>
                        <option value="enthusiastic">Enthusiastic</option>
                        <option value="empathetic">Empathetic</option>
                        <option value="technical">Technical</option>
                      </select>
                    </div>

                    {/* Verbosity */}
                    <div>
                      <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                        Verbosity
                      </label>
                      <select
                        value={personality.verbosity}
                        onChange={(e) => setPersonality({ ...personality, verbosity: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          backgroundColor: '#0a0a0a',
                          border: '1px solid #333',
                          borderRadius: '0.5rem',
                          color: '#fff',
                          fontSize: '0.875rem'
                        }}
                      >
                        <option value="concise">Concise</option>
                        <option value="balanced">Balanced</option>
                        <option value="detailed">Detailed</option>
                      </select>
                    </div>

                    {/* Formality */}
                    <div>
                      <label style={{ display: 'block', color: '#ccc', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                        Formality
                      </label>
                      <select
                        value={personality.formality}
                        onChange={(e) => setPersonality({ ...personality, formality: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          backgroundColor: '#0a0a0a',
                          border: '1px solid #333',
                          borderRadius: '0.5rem',
                          color: '#fff',
                          fontSize: '0.875rem'
                        }}
                      >
                        <option value="casual">Casual</option>
                        <option value="professional">Professional</option>
                        <option value="formal">Formal</option>
                      </select>
                    </div>
                  </div>

                  {/* Response Style Options */}
                  <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #333' }}>
                    <h3 style={{ color: '#ccc', fontSize: '1rem', fontWeight: '600', marginBottom: '1rem' }}>Response Style</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={personality.useEmojis}
                          onChange={(e) => setPersonality({ ...personality, useEmojis: e.target.checked })}
                          style={{ width: '20px', height: '20px' }}
                        />
                        <span style={{ color: '#ccc', fontSize: '0.875rem' }}>Use emojis in responses</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={personality.useBulletPoints}
                          onChange={(e) => setPersonality({ ...personality, useBulletPoints: e.target.checked })}
                          style={{ width: '20px', height: '20px' }}
                        />
                        <span style={{ color: '#ccc', fontSize: '0.875rem' }}>Use bullet points for clarity</span>
                      </label>
                    </div>
                  </div>

                  <button style={{ 
                    marginTop: '2rem',
                    width: '100%',
                    padding: '1rem', 
                    backgroundColor: primaryColor, 
                    color: '#fff', 
                    border: 'none', 
                    borderRadius: '0.5rem', 
                    cursor: 'pointer', 
                    fontSize: '0.875rem', 
                    fontWeight: '600' 
                  }}>
                    Save Personality Settings
                  </button>
                </div>
              </div>
            )}

            {/* Capabilities Tab */}
            {activeTab === 'capabilities' && (
              <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '2rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '1.5rem' }}>Agent Capabilities</h2>
                <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '2rem' }}>
                  Control what your agent can do
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {[
                    { id: 'googleSearch', label: 'Google Search', description: 'Use Google Search for information not in knowledge base', icon: '🔍' },
                    { id: 'vectorSearch', label: 'Knowledge Base Search', description: 'Search uploaded documents and URLs', icon: '📚' },
                    { id: 'entityCRUD', label: 'CRM Operations', description: 'Read and create CRM records (e.g., create leads)', icon: '💼' },
                    { id: 'sendEmail', label: 'Send Emails', description: 'Send emails to customers', icon: '📧' },
                    { id: 'triggerWorkflows', label: 'Trigger Workflows', description: 'Activate automated workflows', icon: '⚡' }
                  ].map((capability) => (
                    <label key={capability.id} style={{ 
                      backgroundColor: '#0a0a0a', 
                      border: '1px solid #222', 
                      borderRadius: '0.75rem', 
                      padding: '1.5rem',
                      display: 'flex',
                      alignItems: 'start',
                      gap: '1rem',
                      cursor: 'pointer'
                    }}>
                      <input type="checkbox" defaultChecked={capability.id === 'googleSearch' || capability.id === 'vectorSearch'} style={{ width: '20px', height: '20px', marginTop: '0.25rem' }} />
                      <div style={{ fontSize: '1.5rem' }}>{capability.icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: '#fff', fontWeight: '600', fontSize: '0.875rem', marginBottom: '0.25rem' }}>{capability.label}</div>
                        <div style={{ color: '#666', fontSize: '0.75rem' }}>{capability.description}</div>
                      </div>
                    </label>
                  ))}
                </div>

                <button style={{ 
                  marginTop: '2rem',
                  width: '100%',
                  padding: '1rem', 
                  backgroundColor: primaryColor, 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: '0.5rem', 
                  cursor: 'pointer', 
                  fontSize: '0.875rem', 
                  fontWeight: '600' 
                }}>
                  Save Capabilities
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

