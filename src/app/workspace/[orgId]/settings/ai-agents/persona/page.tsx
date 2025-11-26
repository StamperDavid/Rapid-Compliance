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
  const [activeTab, setActiveTab] = useState<'knowledge' | 'personality' | 'capabilities'>('knowledge');

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

