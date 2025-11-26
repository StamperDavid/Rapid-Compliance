'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import AdminBar from '@/components/AdminBar';
import { useAuth } from '@/hooks/useAuth';
import { STANDARD_SCHEMAS } from '@/lib/schema/standard-schemas';

export default function ConversationsPage() {
  const { user } = useAuth();
  const params = useParams();
  const orgId = params.orgId as string;
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);

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

  // Mock live conversations
  const [liveConversations, setLiveConversations] = useState([
    { 
      id: '1', 
      customerName: 'John Smith',
      customerEmail: 'john@example.com',
      startedAt: '2 min ago', 
      messages: 8,
      sentiment: 'positive',
      status: 'active',
      lastMessage: 'That sounds perfect! How do I complete the purchase?',
      alert: false
    },
    { 
      id: '2', 
      customerName: 'Sarah Johnson',
      customerEmail: 'sarah@example.com',
      startedAt: '5 min ago', 
      messages: 12,
      sentiment: 'neutral',
      status: 'active',
      lastMessage: 'Can you tell me more about the warranty?',
      alert: false
    },
    { 
      id: '3', 
      customerName: 'Mike Davis',
      customerEmail: 'mike@example.com',
      startedAt: '1 min ago', 
      messages: 3,
      sentiment: 'frustrated',
      status: 'needs_help',
      lastMessage: 'This is not what I asked for. Can I speak to a person?',
      alert: true
    }
  ]);

  // Mock completed conversations
  const [completedConversations, setCompletedConversations] = useState([
    {
      id: '101',
      customerName: 'Alice Brown',
      customerEmail: 'alice@example.com',
      date: '2024-11-24 3:45 PM',
      duration: '8 min',
      messages: 15,
      outcome: 'sale',
      sentiment: 'positive',
      flagged: false,
      rating: 5
    },
    {
      id: '102',
      customerName: 'Robert Wilson',
      customerEmail: 'robert@example.com',
      date: '2024-11-24 2:30 PM',
      duration: '15 min',
      messages: 22,
      outcome: 'human_requested',
      sentiment: 'frustrated',
      flagged: true,
      issue: 'Customer requested human - agent couldn\'t handle return policy question',
      rating: 1
    },
    {
      id: '103',
      customerName: 'Emily Chen',
      customerEmail: 'emily@example.com',
      date: '2024-11-24 1:15 PM',
      duration: '5 min',
      messages: 8,
      outcome: 'no_sale',
      sentiment: 'neutral',
      flagged: false,
      rating: 3
    },
    {
      id: '104',
      customerName: 'David Martinez',
      customerEmail: 'david@example.com',
      date: '2024-11-24 11:20 AM',
      duration: '12 min',
      messages: 18,
      outcome: 'abandoned',
      sentiment: 'frustrated',
      flagged: true,
      issue: 'Customer left frustrated - pricing confusion on bulk orders',
      rating: 2
    }
  ]);

  const mockChatMessages = [
    { role: 'agent', message: 'Hello! How can I help you today?', timestamp: '10:30:00 AM' },
    { role: 'customer', message: 'I need to return a product I bought last week', timestamp: '10:30:15 AM' },
    { role: 'agent', message: 'I\'d be happy to help with that! Could you provide your order number?', timestamp: '10:30:20 AM' },
    { role: 'customer', message: 'This is not what I asked for. Can I speak to a person?', timestamp: '10:30:45 AM' }
  ];

  const handleTakeOver = (conversationId: string) => {
    alert(`Taking over conversation ${conversationId}. You would now be connected to the customer chat.`);
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
            <Link href={`/workspace/${orgId}/conversations`} style={{ width: '100%', padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: '#1a1a1a', color: '#fff', borderLeft: `3px solid ${primaryColor}`, fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none', position: 'relative' }}>
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

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: '2rem', borderBottom: '1px solid #333' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>Live Conversations</h1>
            <p style={{ color: '#666', fontSize: '0.875rem' }}>Monitor active customer sessions and review past conversations</p>
          </div>

          {/* Status Bar */}
          <div style={{ 
            padding: '1rem 2rem',
            backgroundColor: '#1a1a1a',
            borderBottom: '1px solid #333',
            display: 'flex',
            alignItems: 'center',
            gap: '2rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ 
                width: '12px', 
                height: '12px', 
                backgroundColor: '#4ade80', 
                borderRadius: '50%',
                boxShadow: '0 0 10px #4ade80'
              }} />
              <span style={{ color: '#ccc', fontSize: '0.875rem', fontWeight: '500' }}>
                {liveConversations.filter(c => c.status === 'active').length} Active
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ 
                width: '12px', 
                height: '12px', 
                backgroundColor: '#ef4444', 
                borderRadius: '50%',
                boxShadow: '0 0 10px #ef4444'
              }} />
              <span style={{ color: '#ccc', fontSize: '0.875rem', fontWeight: '500' }}>
                {liveConversations.filter(c => c.alert).length} Need Attention
              </span>
            </div>
            <div style={{ marginLeft: 'auto', color: '#666', fontSize: '0.875rem' }}>
              Auto-refresh: ON
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '1rem', padding: '0 2rem', borderBottom: '1px solid #333' }}>
            {[
              { id: 'active', label: 'Active Conversations', badge: liveConversations.filter(c => c.alert).length },
              { id: 'history', label: 'Conversation History', badge: completedConversations.filter(c => c.flagged).length }
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
                <span>{tab.label}</span>
                {tab.badge > 0 && (
                  <span style={{
                    padding: '0.125rem 0.5rem',
                    backgroundColor: '#ef4444',
                    color: '#fff',
                    borderRadius: '9999px',
                    fontSize: '0.625rem',
                    fontWeight: '700',
                    minWidth: '20px',
                    textAlign: 'center'
                  }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
            {/* Active Conversations Tab */}
            {activeTab === 'active' && (
              <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                {liveConversations.length === 0 ? (
                  <div style={{
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '1rem',
                    padding: '4rem',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>💬</div>
                    <div style={{ color: '#666', fontSize: '1rem' }}>No active conversations right now</div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: selectedConversation ? '400px 1fr' : '1fr', gap: '1.5rem' }}>
                    {/* Conversation List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {liveConversations.map((conv) => (
                        <div 
                          key={conv.id} 
                          onClick={() => setSelectedConversation(conv.id)}
                          style={{
                            backgroundColor: selectedConversation === conv.id ? '#222' : '#1a1a1a',
                            border: `2px solid ${conv.alert ? '#ef4444' : selectedConversation === conv.id ? primaryColor : '#333'}`,
                            borderRadius: '1rem',
                            padding: '1.5rem',
                            cursor: 'pointer',
                            position: 'relative',
                            transition: 'all 0.2s'
                          }}
                        >
                          {conv.alert && (
                            <div style={{
                              position: 'absolute',
                              top: '-12px',
                              right: '20px',
                              padding: '0.25rem 0.75rem',
                              backgroundColor: '#ef4444',
                              color: '#fff',
                              borderRadius: '0.25rem',
                              fontSize: '0.75rem',
                              fontWeight: '700',
                              animation: 'pulse 2s infinite'
                            }}>
                              ⚠️ NEEDS ATTENTION
                            </div>
                          )}

                          <div style={{ marginBottom: '1rem' }}>
                            <div style={{ color: '#fff', fontWeight: '600', fontSize: '1rem', marginBottom: '0.25rem' }}>
                              {conv.customerName}
                            </div>
                            <div style={{ color: '#666', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                              {conv.customerEmail} • Started {conv.startedAt}
                            </div>
                          </div>

                          <div style={{ 
                            backgroundColor: '#0a0a0a',
                            padding: '0.75rem',
                            borderRadius: '0.5rem',
                            marginBottom: '1rem',
                            fontSize: '0.875rem',
                            color: '#ccc',
                            fontStyle: 'italic',
                            borderLeft: '3px solid #333'
                          }}>
                            {conv.lastMessage}
                          </div>

                          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
                            <div>
                              <div style={{ fontSize: '0.75rem', color: '#666' }}>Messages</div>
                              <div style={{ fontSize: '0.875rem', color: '#fff', fontWeight: '600' }}>{conv.messages}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: '0.75rem', color: '#666' }}>Sentiment</div>
                              <div style={{ 
                                fontSize: '0.75rem', 
                                fontWeight: '600',
                                color: conv.sentiment === 'positive' ? '#4ade80' : conv.sentiment === 'frustrated' ? '#ef4444' : '#fbbf24'
                              }}>
                                {conv.sentiment.toUpperCase()}
                              </div>
                            </div>
                          </div>

                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTakeOver(conv.id);
                            }}
                            style={{
                              width: '100%',
                              padding: '0.75rem',
                              backgroundColor: conv.alert ? '#ef4444' : '#222',
                              color: '#fff',
                              border: `1px solid ${conv.alert ? '#ef4444' : '#333'}`,
                              borderRadius: '0.5rem',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              fontWeight: '700'
                            }}
                          >
                            {conv.alert ? '🚨 Take Over Now' : 'Take Over Conversation'}
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Conversation Detail View */}
                    {selectedConversation && (
                      <div style={{
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #333',
                        borderRadius: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        height: '700px'
                      }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.25rem' }}>
                              {liveConversations.find(c => c.id === selectedConversation)?.customerName}
                            </h3>
                            <div style={{ fontSize: '0.75rem', color: '#666' }}>
                              {liveConversations.find(c => c.id === selectedConversation)?.customerEmail}
                            </div>
                          </div>
                          <button onClick={() => setSelectedConversation(null)} style={{
                            padding: '0.5rem 1rem',
                            backgroundColor: '#222',
                            color: '#fff',
                            border: '1px solid #333',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            fontSize: '0.75rem'
                          }}>
                            Close
                          </button>
                        </div>

                        <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          {mockChatMessages.map((msg, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: msg.role === 'customer' ? 'flex-end' : 'flex-start' }}>
                              <div style={{
                                maxWidth: '75%',
                                padding: '0.75rem 1rem',
                                borderRadius: '0.75rem',
                                backgroundColor: msg.role === 'customer' ? primaryColor : '#0a0a0a',
                                color: msg.role === 'customer' ? '#fff' : '#ccc',
                                border: msg.role === 'agent' ? '1px solid #222' : 'none'
                              }}>
                                <div style={{ fontSize: '0.75rem', color: msg.role === 'customer' ? '#fff9' : '#666', marginBottom: '0.25rem' }}>
                                  {msg.role === 'customer' ? 'Customer' : 'AI Agent'} • {msg.timestamp}
                                </div>
                                <div style={{ fontSize: '0.875rem' }}>{msg.message}</div>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div style={{ padding: '1.5rem', borderTop: '1px solid #333' }}>
                          <button
                            onClick={() => handleTakeOver(selectedConversation)}
                            style={{
                              width: '100%',
                              padding: '1rem',
                              backgroundColor: '#ef4444',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '0.5rem',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              fontWeight: '700'
                            }}
                          >
                            🚨 Take Over This Conversation
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Conversation History Tab */}
            {activeTab === 'history' && (
              <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                <div style={{ 
                  marginBottom: '1.5rem',
                  padding: '1rem 1.5rem',
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ color: '#fff', fontWeight: '600', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                      {completedConversations.filter(c => c.flagged).length} Conversations Flagged for Review
                    </div>
                    <div style={{ color: '#666', fontSize: '0.75rem' }}>
                      Review failed interactions and send to Training Center for improvement
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <select style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#222',
                      color: '#fff',
                      border: '1px solid #333',
                      borderRadius: '0.5rem',
                      fontSize: '0.75rem',
                      fontWeight: '600'
                    }}>
                      <option>All Conversations</option>
                      <option>Flagged Only</option>
                      <option>Sales</option>
                      <option>No Sale</option>
                      <option>Abandoned</option>
                      <option>Human Requested</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {completedConversations.map((conv) => (
                    <div key={conv.id} style={{
                      backgroundColor: '#1a1a1a',
                      border: `2px solid ${conv.flagged ? '#ef4444' : '#333'}`,
                      borderRadius: '1rem',
                      padding: '1.5rem',
                      position: 'relative'
                    }}>
                      {conv.flagged && (
                        <div style={{
                          position: 'absolute',
                          top: '-12px',
                          right: '20px',
                          padding: '0.25rem 0.75rem',
                          backgroundColor: '#ef4444',
                          color: '#fff',
                          borderRadius: '0.25rem',
                          fontSize: '0.75rem',
                          fontWeight: '700'
                        }}>
                          🚩 FLAGGED FOR RETRAINING
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: '1.5rem', marginBottom: conv.issue ? '1rem' : 0 }}>
                        <div>
                          <div style={{ color: '#fff', fontWeight: '600', fontSize: '1rem', marginBottom: '0.25rem' }}>
                            {conv.customerName}
                          </div>
                          <div style={{ color: '#666', fontSize: '0.75rem' }}>{conv.date}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Duration</div>
                          <div style={{ fontSize: '0.875rem', color: '#fff', fontWeight: '500' }}>{conv.duration}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Messages</div>
                          <div style={{ fontSize: '0.875rem', color: '#fff', fontWeight: '500' }}>{conv.messages}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Outcome</div>
                          <div style={{
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            color: conv.outcome === 'sale' ? '#4ade80' : conv.outcome === 'human_requested' ? '#ef4444' : '#fbbf24'
                          }}>
                            {conv.outcome.replace('_', ' ').toUpperCase()}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Sentiment</div>
                          <div style={{
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            color: conv.sentiment === 'positive' ? '#4ade80' : conv.sentiment === 'frustrated' ? '#ef4444' : '#fbbf24'
                          }}>
                            {conv.sentiment.toUpperCase()}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Rating</div>
                          <div style={{ fontSize: '0.875rem', color: '#fbbf24', fontWeight: '600' }}>
                            {'⭐'.repeat(conv.rating)}
                          </div>
                        </div>
                      </div>

                      {conv.issue && (
                        <div style={{
                          marginTop: '1rem',
                          padding: '1rem',
                          backgroundColor: '#0a0a0a',
                          border: '1px solid #ef4444',
                          borderRadius: '0.5rem',
                          display: 'flex',
                          alignItems: 'start',
                          gap: '1rem'
                        }}>
                          <div style={{ fontSize: '1.25rem' }}>⚠️</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ color: '#ef4444', fontWeight: '600', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                              ISSUE DETECTED
                            </div>
                            <div style={{ color: '#ccc', fontSize: '0.875rem', marginBottom: '1rem' }}>{conv.issue}</div>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                              <button 
                                onClick={() => handleSendToTraining(conv.id)}
                                style={{
                                  padding: '0.75rem 1.5rem',
                                  backgroundColor: primaryColor,
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: '0.5rem',
                                  cursor: 'pointer',
                                  fontSize: '0.75rem',
                                  fontWeight: '700',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                📤 Send to Training
                              </button>
                              <button style={{
                                padding: '0.75rem 1.5rem',
                                backgroundColor: '#222',
                                color: '#fff',
                                border: '1px solid #333',
                                borderRadius: '0.5rem',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                fontWeight: '600'
                              }}>
                                View Full Chat
                              </button>
                              <button style={{
                                padding: '0.75rem 1.5rem',
                                backgroundColor: '#222',
                                color: '#4ade80',
                                border: '1px solid #333',
                                borderRadius: '0.5rem',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                fontWeight: '600'
                              }}>
                                Mark Resolved
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  function handleSendToTraining(conversationId: string) {
    alert(`Conversation ${conversationId} sent to Training Center as a training scenario.`);
  }
}

