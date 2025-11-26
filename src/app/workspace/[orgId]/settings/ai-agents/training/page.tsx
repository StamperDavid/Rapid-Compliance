'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import AdminBar from '@/components/AdminBar';
import { useAuth } from '@/hooks/useAuth';
import { STANDARD_SCHEMAS } from '@/lib/schema/standard-schemas';

export default function AgentTrainingPage() {
  const { user } = useAuth();
  const params = useParams();
  const orgId = params.orgId as string;
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'training' | 'progress' | 'golden'>('training');
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [sessionTopic, setSessionTopic] = useState<string>('');

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

  const [goldenMasterVersion, setGoldenMasterVersion] = useState(3);
  const [goldenMasterScore, setGoldenMasterScore] = useState(95);

  // Foundation topics (mandatory before Golden Master)
  const foundationTopics = [
    { id: 'foundation-knowledge', title: 'Product/Service Knowledge', required: true },
    { id: 'foundation-pricing', title: 'Pricing & Policies', required: true },
    { id: 'foundation-escalation', title: 'When to Escalate', required: true }
  ];

  // Suggested training topics (ideas for what to practice)
  const suggestedTopics = [
    {
      id: 'sug1',
      title: 'First-Time Customer Introduction',
      description: 'Practice discovery questions and building rapport with curious but unsure customers.',
      customerPersona: 'First-time visitor, browsing, no clear intent yet'
    },
    {
      id: 'sug2',
      title: 'Price Objection',
      description: 'Practice value justification when customer thinks prices are too high.',
      customerPersona: 'Budget-conscious, comparing to competitors'
    },
    {
      id: 'sug3',
      title: 'Product Comparison Request',
      description: 'Practice consultative selling when customer asks to compare 2-3 products.',
      customerPersona: 'Informed shopper, knows what they want'
    },
    {
      id: 'sug4',
      title: 'Technical Specifications',
      description: 'Practice handling detailed technical questions with accuracy.',
      customerPersona: 'Technical buyer, detail-oriented'
    },
    {
      id: 'sug5',
      title: 'Return Policy & Guarantees',
      description: 'Practice explaining policies clearly to risk-averse customers.',
      customerPersona: 'Risk-averse, wants reassurance'
    },
    {
      id: 'sug6',
      title: 'Urgent Need / Time Pressure',
      description: 'Practice handling urgency and setting realistic expectations.',
      customerPersona: 'Time-sensitive buyer, needs fast shipping'
    },
    {
      id: 'sug7',
      title: 'Bulk Order Request',
      description: 'Practice handling large volume orders with custom pricing.',
      customerPersona: 'B2B buyer, looking for volume discounts'
    }
  ];

  // Training session history
  const [trainingHistory, setTrainingHistory] = useState([
    { id: 1, topic: 'Product/Service Knowledge', score: 92, date: '2024-11-25 14:30', messages: 12 },
    { id: 2, topic: 'Product/Service Knowledge', score: 88, date: '2024-11-25 15:45', messages: 15 },
    { id: 3, topic: 'Pricing & Policies', score: 85, date: '2024-11-25 16:20', messages: 8 },
    { id: 4, topic: 'Price Objection', score: 78, date: '2024-11-25 17:10', messages: 10 },
    { id: 5, topic: 'When to Escalate', score: 95, date: '2024-11-25 18:00', messages: 7 },
    { id: 6, topic: 'Product/Service Knowledge', score: 94, date: '2024-11-26 09:15', messages: 14 },
    { id: 7, topic: 'Pricing & Policies', score: 90, date: '2024-11-26 10:30', messages: 11 },
    { id: 8, topic: 'Price Objection', score: 82, date: '2024-11-26 11:45', messages: 13 }
  ]);

  // Calculate progress metrics
  const getTopicStats = (topicName: string) => {
    const sessions = trainingHistory.filter(s => s.topic === topicName);
    if (sessions.length === 0) return null;
    const avgScore = Math.round(sessions.reduce((sum, s) => sum + s.score, 0) / sessions.length);
    const lastScore = sessions[sessions.length - 1].score;
    return { sessions: sessions.length, avgScore, lastScore };
  };

  const foundationComplete = foundationTopics.every(topic => {
    const stats = getTopicStats(topic.title);
    return stats && stats.avgScore >= 85;
  });

  const overallAvg = trainingHistory.length > 0 
    ? Math.round(trainingHistory.reduce((sum, s) => sum + s.score, 0) / trainingHistory.length)
    : 0;

  const canDeployGoldenMaster = foundationComplete && overallAvg >= 90 && trainingHistory.length >= 8;

  // Training session
  const [trainingLog, setTrainingLog] = useState<any[]>([]);
  const [userInput, setUserInput] = useState('');
  const [sessionFeedback, setSessionFeedback] = useState('');
  const [sessionScore, setSessionScore] = useState(0);

  const handleSendMessage = () => {
    if (!userInput.trim()) return;
    setTrainingLog([...trainingLog, { role: 'user', message: userInput, timestamp: new Date().toLocaleTimeString() }]);
    setUserInput('');
    // Simulate agent response
    setTimeout(() => {
      setTrainingLog((prev: any[]) => [...prev, { 
        role: 'agent', 
        message: 'This is a simulated response. Connect to Gemini API for real responses.', 
        timestamp: new Date().toLocaleTimeString() 
      }]);
    }, 1000);
  };

  const handleEndSession = () => {
    if (!sessionTopic.trim()) {
      alert('Please enter what topic you were practicing for this session.');
      return;
    }
    
    // Save to history
    const newSession = {
      id: trainingHistory.length + 1,
      topic: sessionTopic,
      score: sessionScore,
      date: new Date().toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
      messages: trainingLog.length
    };
    setTrainingHistory([...trainingHistory, newSession]);
    
    if (sessionScore >= 80) {
      alert(`Great training session! Score: ${sessionScore}%\n\nSession saved to training history.`);
    } else {
      alert(`Training session saved. Score: ${sessionScore}%\n\nKeep practicing to improve!`);
    }
    
    // Reset
    setTrainingLog([]);
    setSessionFeedback('');
    setSessionScore(0);
    setSessionTopic('');
  };

  const handleDeployGoldenMaster = () => {
    if (!canDeployGoldenMaster) {
      alert('Not ready to deploy Golden Master:\n\n' +
        (!foundationComplete ? '❌ Foundation topics must average 85%+\n' : '') +
        (trainingHistory.length < 8 ? `❌ Need ${8 - trainingHistory.length} more training sessions\n` : '') +
        (overallAvg < 90 ? `❌ Overall average: ${overallAvg}% (need 90%+)\n` : '')
      );
      return;
    }
    
    alert(`⭐ Golden Master v${goldenMasterVersion + 1} deployed successfully!\n\nAll new customer sessions will use this improved version.`);
    setGoldenMasterVersion(goldenMasterVersion + 1);
    setGoldenMasterScore(overallAvg);
  };

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
          <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ marginBottom: '2rem' }}>
              <Link href={`/workspace/${orgId}/settings/ai-agents`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: primaryColor, fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none', marginBottom: '1.5rem' }}>
                ← Back to AI Agent
              </Link>
              <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem', marginTop: '1rem' }}>Training Center</h1>
              <p style={{ color: '#666', fontSize: '0.875rem' }}>Improve your agent with targeted training scenarios</p>
            </div>

            {/* Status Badge */}
            <div style={{ 
              marginBottom: '2rem',
              padding: '1rem 1.5rem',
              backgroundColor: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ fontSize: '2rem' }}>⭐</div>
                <div>
                  <div style={{ color: '#fff', fontWeight: '600', fontSize: '1rem' }}>Production Agent</div>
                  <div style={{ color: '#666', fontSize: '0.875rem' }}>Golden Master v{goldenMasterVersion} (Score: {goldenMasterScore}%)</div>
                </div>
              </div>
              <div style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#0f4c0f',
                color: '#4ade80',
                borderRadius: '9999px',
                fontSize: '0.875rem',
                fontWeight: '600'
              }}>
                DEPLOYED
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid #333' }}>
              {[
                { id: 'training', label: 'Training Environment' },
                { id: 'progress', label: 'Progress Dashboard', badge: `${overallAvg}%` },
                { id: 'golden', label: 'Golden Master' }
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
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span style={{
                      padding: '0.125rem 0.5rem',
                      backgroundColor: overallAvg >= 90 ? '#4ade80' : overallAvg >= 80 ? primaryColor : '#f59e0b',
                      color: overallAvg >= 90 || overallAvg >= 80 ? '#000' : '#000',
                      borderRadius: '9999px',
                      fontSize: '0.625rem',
                      fontWeight: '700'
                    }}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Training Environment Tab */}
            {activeTab === 'training' && (
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
                {/* Chat Interface */}
                <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', display: 'flex', flexDirection: 'column', height: '700px' }}>
                  <div style={{ padding: '1.5rem', borderBottom: '1px solid #333' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.25rem' }}>
                      Training Environment
                    </h2>
                    <p style={{ fontSize: '0.75rem', color: '#666' }}>
                      Role-play as a customer to train your agent. Give feedback after each session.
                    </p>
                  </div>

                  <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {trainingLog.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💬</div>
                        <div style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Start training your agent</div>
                        <div style={{ fontSize: '0.875rem' }}>Act as a customer and see how your agent responds</div>
                      </div>
                    )}
                    {trainingLog.map((msg: any, idx: number) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                        <div style={{
                          maxWidth: '75%',
                          padding: '0.75rem 1rem',
                          borderRadius: '0.75rem',
                          backgroundColor: msg.role === 'user' ? primaryColor : '#0a0a0a',
                          color: msg.role === 'user' ? '#fff' : '#ccc',
                          border: msg.role === 'agent' ? '1px solid #222' : 'none'
                        }}>
                          <div style={{ fontSize: '0.75rem', color: msg.role === 'user' ? '#fff9' : '#666', marginBottom: '0.25rem' }}>
                            {msg.role === 'user' ? 'You (Customer)' : 'Agent'} • {msg.timestamp}
                          </div>
                          <div style={{ fontSize: '0.875rem' }}>{msg.message}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ padding: '1.5rem', borderTop: '1px solid #333', display: 'flex', gap: '0.75rem' }}>
                    <input
                      type="text"
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Act as a customer to test the agent..."
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
                      onClick={handleSendMessage}
                      style={{
                        padding: '0.75rem 1.5rem',
                        backgroundColor: primaryColor,
                        color: '#fff',
                        border: 'none',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: '600'
                      }}
                    >
                      Send
                    </button>
                  </div>
                </div>

                {/* Right Sidebar - Feedback & Suggestions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* Session Feedback */}
                  <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>Session Feedback</h3>
                    <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '1rem' }}>
                      What did you practice?
                    </p>
                    
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.5rem' }}>Topic/Scenario</div>
                      <input
                        type="text"
                        value={sessionTopic}
                        onChange={(e) => setSessionTopic(e.target.value)}
                        placeholder="e.g., Price Objection, Product Knowledge"
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
                    </div>

                    <textarea
                      value={sessionFeedback}
                      onChange={(e) => setSessionFeedback(e.target.value)}
                      placeholder="e.g., 'Good product knowledge but too pushy on closing'"
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        backgroundColor: '#0a0a0a',
                        border: '1px solid #333',
                        borderRadius: '0.5rem',
                        color: '#fff',
                        fontSize: '0.875rem',
                        resize: 'vertical',
                        marginBottom: '1rem'
                      }}
                    />
                    
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.5rem' }}>Score (0-100%)</div>
                      <input
                        type="number"
                        value={sessionScore}
                        onChange={(e) => setSessionScore(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                        min="0"
                        max="100"
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          backgroundColor: '#0a0a0a',
                          border: '1px solid #333',
                          borderRadius: '0.5rem',
                          color: '#fff',
                          fontSize: '1.5rem',
                          fontWeight: 'bold',
                          textAlign: 'center'
                        }}
                      />
                    </div>

                    <button
                      onClick={handleEndSession}
                      disabled={trainingLog.length === 0}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        backgroundColor: trainingLog.length === 0 ? '#222' : primaryColor,
                        color: trainingLog.length === 0 ? '#666' : '#fff',
                        border: 'none',
                        borderRadius: '0.5rem',
                        cursor: trainingLog.length === 0 ? 'not-allowed' : 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        marginBottom: '0.75rem'
                      }}
                    >
                      Save Session
                    </button>

                    <button
                      onClick={handleDeployGoldenMaster}
                      disabled={!canDeployGoldenMaster}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        backgroundColor: canDeployGoldenMaster ? '#f59e0b' : '#222',
                        color: canDeployGoldenMaster ? '#000' : '#666',
                        border: canDeployGoldenMaster ? 'none' : '1px solid #333',
                        borderRadius: '0.5rem',
                        cursor: canDeployGoldenMaster ? 'pointer' : 'not-allowed',
                        fontSize: '0.875rem',
                        fontWeight: '700',
                        textTransform: 'uppercase'
                      }}
                    >
                      {canDeployGoldenMaster ? `⭐ Deploy Golden Master v${goldenMasterVersion + 1}` : `🔒 Not Ready (${overallAvg}%)`}
                    </button>
                    
                    {!canDeployGoldenMaster && (
                      <div style={{
                        marginTop: '0.75rem',
                        padding: '0.75rem',
                        backgroundColor: '#0a0a0a',
                        border: '1px solid #333',
                        borderRadius: '0.5rem',
                        fontSize: '0.75rem',
                        color: '#999'
                      }}>
                        {!foundationComplete && <div style={{ marginBottom: '0.25rem' }}>❌ Complete foundation topics (85%+ each)</div>}
                        {trainingHistory.length < 8 && <div style={{ marginBottom: '0.25rem' }}>❌ Need {8 - trainingHistory.length} more training sessions</div>}
                        {overallAvg < 90 && <div>❌ Overall avg: {overallAvg}% (need 90%+)</div>}
                      </div>
                    )}
                  </div>

                  {/* Suggested Training Topics */}
                  {showSuggestions && (
                    <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fff' }}>Suggested Topics</h3>
                        <button
                          onClick={() => setShowSuggestions(false)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            backgroundColor: 'transparent',
                            color: '#666',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '0.75rem'
                          }}
                        >
                          Hide
                        </button>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '1rem' }}>
                        Ideas for what to practice
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto' }}>
                        {suggestedTopics.map((topic) => (
                          <div 
                            key={topic.id}
                            style={{
                              padding: '0.75rem',
                              backgroundColor: '#0a0a0a',
                              border: '1px solid #222',
                              borderRadius: '0.5rem',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.borderColor = primaryColor}
                            onMouseLeave={(e) => e.currentTarget.style.borderColor = '#222'}
                          >
                            <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#fff', marginBottom: '0.25rem' }}>
                              {topic.title}
                            </div>
                            <div style={{ fontSize: '0.625rem', color: '#999', marginBottom: '0.5rem' }}>
                              {topic.description}
                            </div>
                            <div style={{ fontSize: '0.625rem', color: '#666', fontStyle: 'italic' }}>
                              {topic.customerPersona}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!showSuggestions && (
                    <button
                      onClick={() => setShowSuggestions(true)}
                      style={{
                        padding: '0.75rem',
                        backgroundColor: '#222',
                        color: primaryColor,
                        border: `1px solid ${primaryColor}`,
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: '600'
                      }}
                    >
                      Show Suggested Topics
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Progress Dashboard Tab */}
            {activeTab === 'progress' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Readiness Status */}
                <div style={{ 
                  backgroundColor: canDeployGoldenMaster ? '#0f4c0f' : '#1a1a1a', 
                  border: `2px solid ${canDeployGoldenMaster ? '#4ade80' : '#333'}`, 
                  borderRadius: '1rem', 
                  padding: '2rem' 
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <div>
                      <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
                        {canDeployGoldenMaster ? '🟢 Ready to Deploy' : `🟡 Training in Progress`}
                      </h2>
                      <p style={{ fontSize: '0.875rem', color: canDeployGoldenMaster ? '#4ade80' : '#999' }}>
                        {canDeployGoldenMaster 
                          ? 'Agent has reached Master level performance' 
                          : `Overall Average: ${overallAvg}% • ${trainingHistory.length} sessions completed`}
                      </p>
                    </div>
                    <div style={{ 
                      fontSize: '4rem', 
                      fontWeight: 'bold',
                      color: overallAvg >= 90 ? '#4ade80' : overallAvg >= 80 ? primaryColor : '#f59e0b'
                    }}>
                      {overallAvg}%
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                    <div style={{ backgroundColor: '#0a0a0a', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #222' }}>
                      <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Total Sessions</div>
                      <div style={{ fontSize: '1.5rem', color: '#fff', fontWeight: 'bold' }}>{trainingHistory.length}</div>
                      <div style={{ fontSize: '0.75rem', color: trainingHistory.length >= 8 ? '#4ade80' : '#f59e0b' }}>
                        {trainingHistory.length >= 8 ? '✓ Minimum met' : `Need ${8 - trainingHistory.length} more`}
                      </div>
                    </div>
                    <div style={{ backgroundColor: '#0a0a0a', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #222' }}>
                      <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Foundation Topics</div>
                      <div style={{ fontSize: '1.5rem', color: '#fff', fontWeight: 'bold' }}>
                        {foundationTopics.filter(t => {
                          const stats = getTopicStats(t.title);
                          return stats && stats.avgScore >= 85;
                        }).length}/{foundationTopics.length}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: foundationComplete ? '#4ade80' : '#f59e0b' }}>
                        {foundationComplete ? '✓ All complete' : 'Need 85%+ each'}
                      </div>
                    </div>
                    <div style={{ backgroundColor: '#0a0a0a', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #222' }}>
                      <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Overall Average</div>
                      <div style={{ fontSize: '1.5rem', color: '#fff', fontWeight: 'bold' }}>{overallAvg}%</div>
                      <div style={{ fontSize: '0.75rem', color: overallAvg >= 90 ? '#4ade80' : '#f59e0b' }}>
                        {overallAvg >= 90 ? '⭐ Master level' : 'Need 90%+'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Foundation Topics */}
                <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '2rem' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
                    Foundation Topics (Required)
                  </h2>
                  <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '1.5rem' }}>
                    Each topic must average 85%+ before deploying Golden Master
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {foundationTopics.map((topic) => {
                      const stats = getTopicStats(topic.title);
                      const isComplete = stats && stats.avgScore >= 85;
                      
                      return (
                        <div key={topic.id} style={{
                          backgroundColor: '#0a0a0a',
                          border: `1px solid ${isComplete ? '#4ade80' : '#333'}`,
                          borderRadius: '0.75rem',
                          padding: '1.25rem'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                <div style={{ fontSize: '1.5rem' }}>{isComplete ? '✅' : '⭕'}</div>
                                <div>
                                  <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff' }}>
                                    {topic.title}
                                  </div>
                                  {stats ? (
                                    <div style={{ fontSize: '0.75rem', color: '#999' }}>
                                      {stats.sessions} sessions • Avg: {stats.avgScore}% • Last: {stats.lastScore}%
                                    </div>
                                  ) : (
                                    <div style={{ fontSize: '0.75rem', color: '#666' }}>
                                      Not practiced yet
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: isComplete ? '#4ade80' : '#666' }}>
                              {stats ? `${stats.avgScore}%` : '--'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Training History */}
                <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '2rem' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
                    Training History
                  </h2>
                  <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '1.5rem' }}>
                    All completed training sessions
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {[...trainingHistory].reverse().map((session) => (
                      <div key={session.id} style={{
                        backgroundColor: '#0a0a0a',
                        border: '1px solid #222',
                        borderRadius: '0.5rem',
                        padding: '1rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff', marginBottom: '0.25rem' }}>
                            {session.topic}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#666' }}>
                            {session.date} • {session.messages} messages
                          </div>
                        </div>
                        <div style={{ 
                          fontSize: '1.5rem', 
                          fontWeight: 'bold',
                          color: session.score >= 90 ? '#4ade80' : session.score >= 80 ? primaryColor : '#f59e0b'
                        }}>
                          {session.score}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Golden Master Tab */}
            {activeTab === 'golden' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Current Golden Master */}
                <div style={{ backgroundColor: '#1a1a1a', border: '2px solid #f59e0b', borderRadius: '1rem', padding: '2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '3rem' }}>⭐</div>
                    <div>
                      <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.25rem' }}>
                        Golden Master v{goldenMasterVersion}
                      </h2>
                      <p style={{ fontSize: '0.875rem', color: '#f59e0b' }}>Currently Active in Production</p>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                    <div style={{ backgroundColor: '#0a0a0a', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #222' }}>
                      <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Training Score</div>
                      <div style={{ fontSize: '1.5rem', color: '#4ade80', fontWeight: 'bold' }}>{goldenMasterScore}%</div>
                    </div>
                    <div style={{ backgroundColor: '#0a0a0a', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #222' }}>
                      <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Deployed</div>
                      <div style={{ fontSize: '0.875rem', color: '#fff', fontWeight: '500' }}>Nov 23, 2024</div>
                    </div>
                    <div style={{ backgroundColor: '#0a0a0a', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #222' }}>
                      <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Total Uses</div>
                      <div style={{ fontSize: '1.5rem', color: '#fff', fontWeight: 'bold' }}>1,247</div>
                    </div>
                    <div style={{ backgroundColor: '#0a0a0a', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #222' }}>
                      <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Avg Rating</div>
                      <div style={{ fontSize: '1.5rem', color: '#fbbf24', fontWeight: 'bold' }}>4.2 ⭐</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button style={{
                      flex: 1,
                      padding: '0.75rem',
                      backgroundColor: '#222',
                      color: '#fff',
                      border: '1px solid #333',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '600'
                    }}>
                      View Analytics
                    </button>
                    <button style={{
                      flex: 1,
                      padding: '0.75rem',
                      backgroundColor: '#222',
                      color: '#ef4444',
                      border: '1px solid #ef4444',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '600'
                    }}>
                      Rollback Version
                    </button>
                  </div>
                </div>

                {/* Version History */}
                <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '2rem' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '1.5rem' }}>Version History</h2>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {[
                      { version: 3, score: 95, deployedAt: 'Nov 23, 2024', status: 'active', interactions: 1247, avgRating: 4.2 },
                      { version: 2, score: 88, deployedAt: 'Nov 15, 2024', status: 'superseded', interactions: 856, avgRating: 3.8 },
                      { version: 1, score: 82, deployedAt: 'Nov 10, 2024', status: 'superseded', interactions: 432, avgRating: 3.5 }
                    ].map((version) => (
                      <div key={version.version} style={{
                        backgroundColor: '#0a0a0a',
                        border: `1px solid ${version.status === 'active' ? '#f59e0b' : '#222'}`,
                        borderRadius: '0.75rem',
                        padding: '1.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div style={{ fontSize: '1.5rem' }}>{version.status === 'active' ? '⭐' : '📦'}</div>
                          <div>
                            <div style={{ color: '#fff', fontWeight: '600', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                              Version {version.version}
                              {version.status === 'active' && (
                                <span style={{
                                  marginLeft: '0.5rem',
                                  padding: '0.25rem 0.5rem',
                                  backgroundColor: '#f59e0b',
                                  color: '#000',
                                  borderRadius: '0.25rem',
                                  fontSize: '0.625rem',
                                  fontWeight: '700'
                                }}>
                                  ACTIVE
                                </span>
                              )}
                            </div>
                            <div style={{ color: '#666', fontSize: '0.75rem' }}>
                              Score: {version.score}% • {version.deployedAt} • {version.interactions} uses • {version.avgRating} ⭐ avg
                            </div>
                          </div>
                        </div>
                        {version.status !== 'active' && (
                          <button style={{
                            padding: '0.5rem 1rem',
                            backgroundColor: '#222',
                            color: primaryColor,
                            border: '1px solid #333',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: '600'
                          }}>
                            Restore
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
