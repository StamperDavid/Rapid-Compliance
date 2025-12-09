'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import AdminBar from '@/components/AdminBar';
import { useAuth } from '@/hooks/useAuth';
import { STANDARD_SCHEMAS } from '@/lib/schema/standard-schemas';
import { ChatSessionService, ChatSession, ChatMessage } from '@/lib/agent/chat-session-service';

export default function ConversationsPage() {
  const { user } = useAuth();
  const params = useParams();
  const orgId = params.orgId as string;
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  
  // Real data states
  const [liveConversations, setLiveConversations] = useState<ChatSession[]>([]);
  const [completedConversations, setCompletedConversations] = useState<ChatSession[]>([]);
  const [selectedMessages, setSelectedMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem('appTheme');
    if (savedTheme) {
      try {
        setTheme(JSON.parse(savedTheme));
      } catch (error) {
        console.error('Failed to load theme:', error);
      }
    }
  }, []);

  // Subscribe to real-time active sessions
  useEffect(() => {
    if (!orgId) return;

    setLoading(true);
    setError(null);

    // Subscribe to active sessions
    const unsubscribe = ChatSessionService.subscribeToActiveSessions(
      orgId,
      (sessions) => {
        setLiveConversations(sessions);
        setLoading(false);
      }
    );

    // Load history
    ChatSessionService.getSessionHistory(orgId, 50)
      .then(setCompletedConversations)
      .catch((err) => {
        console.error('Failed to load history:', err);
      });

    return () => unsubscribe();
  }, [orgId]);

  // Load messages when conversation is selected
  useEffect(() => {
    if (!selectedConversation || !orgId) {
      setSelectedMessages([]);
      return;
    }

    const unsubscribe = ChatSessionService.subscribeToSessionMessages(
      orgId,
      selectedConversation,
      setSelectedMessages
    );

    return () => unsubscribe();
  }, [selectedConversation, orgId]);

  const primaryColor = theme?.colors?.primary?.main || '#6366f1';

  const formatTimeAgo = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
    return date.toLocaleDateString();
  };

  const handleTakeOver = async (conversationId: string) => {
    try {
      if (!user?.id) {
        alert('You must be logged in to take over a conversation.');
        return;
      }
      await ChatSessionService.requestTakeover(orgId, conversationId, user.id, 'Manual takeover');
      alert(`Taking over conversation. You are now connected to the customer chat.`);
    } catch (err) {
      console.error('Failed to take over:', err);
      alert('Failed to take over conversation. Please try again.');
    }
  };

  const handleSendToTraining = async (conversationId: string, issue: string) => {
    try {
      await ChatSessionService.flagForTraining(orgId, conversationId, issue);
      
      // Update local state
      setCompletedConversations(prev =>
        prev.map(c => c.id === conversationId ? { ...c, flaggedForTraining: true, trainingIssue: issue } as any : c)
      );
      
      alert(`Conversation sent to Training Center for improvement.`);
    } catch (err) {
      console.error('Failed to flag for training:', err);
      alert('Failed to send to training. Please try again.');
    }
  };

  const needsAttentionCount = liveConversations.filter(c => c.status === 'needs_help').length;
  const flaggedCount = completedConversations.filter((c: any) => c.flaggedForTraining).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#000000' }}>
      <AdminBar />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div style={{ width: sidebarOpen ? '260px' : '70px', backgroundColor: '#0a0a0a', borderRight: '1px solid #1a1a1a', transition: 'width 0.3s', display: 'flex', flexDirection: 'column' }}>
          <nav style={{ flex: 1, padding: '1rem 0', overflowY: 'auto' }}>
            <Link href={`/workspace/${orgId}/dashboard`} style={{ width: '100%', padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: 'transparent', color: '#999', borderLeft: '3px solid transparent', fontSize: '0.875rem', fontWeight: '400', textDecoration: 'none' }}>
              <span style={{ fontSize: '1.25rem' }}>🏠</span>
              {sidebarOpen && <span>Dashboard</span>}
            </Link>
            <Link href={`/workspace/${orgId}/conversations`} style={{ width: '100%', padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: '#1a1a1a', color: '#fff', borderLeft: `3px solid ${primaryColor}`, fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none', position: 'relative' }}>
              <span style={{ fontSize: '1.25rem' }}>💬</span>
              {sidebarOpen && <span>Conversations</span>}
              {needsAttentionCount > 0 && (
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
              )}
            </Link>
            {Object.entries(STANDARD_SCHEMAS).slice(0, 5).map(([key, schema]) => (
              <Link key={key} href={`/workspace/${orgId}/entities/${key}`} style={{ width: '100%', padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: 'transparent', color: '#999', borderLeft: '3px solid transparent', fontSize: '0.875rem', fontWeight: '400', textDecoration: 'none' }}>
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
                {needsAttentionCount} Need Attention
              </span>
            </div>
            <div style={{ marginLeft: 'auto', color: '#666', fontSize: '0.875rem' }}>
              🔄 Real-time updates
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '1rem', padding: '0 2rem', borderBottom: '1px solid #333' }}>
            {[
              { id: 'active', label: 'Active Conversations', badge: needsAttentionCount },
              { id: 'history', label: 'Conversation History', badge: flaggedCount }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setSelectedConversation(null);
                }}
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
            {loading ? (
              <div style={{ textAlign: 'center', padding: '4rem', color: '#666' }}>
                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
                <p>Loading conversations...</p>
              </div>
            ) : error ? (
              <div style={{ textAlign: 'center', padding: '4rem', color: '#ef4444' }}>
                <p>{error}</p>
              </div>
            ) : (
              <>
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
                        <div style={{ color: '#fff', fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>No active conversations</div>
                        <div style={{ color: '#666', fontSize: '0.875rem' }}>Conversations will appear here when customers start chatting with your AI agent</div>
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
                                border: `2px solid ${conv.status === 'needs_help' ? '#ef4444' : selectedConversation === conv.id ? primaryColor : '#333'}`,
                                borderRadius: '1rem',
                                padding: '1.5rem',
                                cursor: 'pointer',
                                position: 'relative',
                                transition: 'all 0.2s'
                              }}
                            >
                              {conv.status === 'needs_help' && (
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
                                  {conv.customerName || 'Anonymous Customer'}
                                </div>
                                <div style={{ color: '#666', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                                  {conv.customerEmail || conv.customerId} • Started {formatTimeAgo(conv.startedAt)}
                                </div>
                              </div>

                              {conv.lastMessage && (
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
                              )}

                              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
                                <div>
                                  <div style={{ fontSize: '0.75rem', color: '#666' }}>Messages</div>
                                  <div style={{ fontSize: '0.875rem', color: '#fff', fontWeight: '600' }}>{conv.messageCount}</div>
                                </div>
                                <div>
                                  <div style={{ fontSize: '0.75rem', color: '#666' }}>Sentiment</div>
                                  <div style={{ 
                                    fontSize: '0.75rem', 
                                    fontWeight: '600',
                                    color: conv.sentiment === 'positive' ? '#4ade80' : conv.sentiment === 'frustrated' ? '#ef4444' : '#fbbf24'
                                  }}>
                                    {conv.sentiment?.toUpperCase() || 'NEUTRAL'}
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
                                  backgroundColor: conv.status === 'needs_help' ? '#ef4444' : '#222',
                                  color: '#fff',
                                  border: `1px solid ${conv.status === 'needs_help' ? '#ef4444' : '#333'}`,
                                  borderRadius: '0.5rem',
                                  cursor: 'pointer',
                                  fontSize: '0.875rem',
                                  fontWeight: '700'
                                }}
                              >
                                {conv.status === 'needs_help' ? '🚨 Take Over Now' : 'Take Over Conversation'}
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
                                  {liveConversations.find(c => c.id === selectedConversation)?.customerName || 'Anonymous'}
                                </h3>
                                <div style={{ fontSize: '0.75rem', color: '#666' }}>
                                  {liveConversations.find(c => c.id === selectedConversation)?.customerEmail || 'No email provided'}
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
                              {selectedMessages.length === 0 ? (
                                <div style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>
                                  No messages yet
                                </div>
                              ) : (
                                selectedMessages.map((msg) => (
                                  <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                                    <div style={{
                                      maxWidth: '75%',
                                      padding: '0.75rem 1rem',
                                      borderRadius: '0.75rem',
                                      backgroundColor: msg.role === 'user' ? primaryColor : '#0a0a0a',
                                      color: msg.role === 'user' ? '#fff' : '#ccc',
                                      border: msg.role === 'assistant' ? '1px solid #222' : 'none'
                                    }}>
                                      <div style={{ fontSize: '0.75rem', color: msg.role === 'user' ? '#fff9' : '#666', marginBottom: '0.25rem' }}>
                                        {msg.role === 'user' ? 'Customer' : msg.role === 'assistant' ? 'AI Agent' : msg.role === 'agent' ? 'Human Agent' : 'System'} • {new Date(msg.timestamp).toLocaleTimeString()}
                                      </div>
                                      <div style={{ fontSize: '0.875rem' }}>{msg.content}</div>
                                    </div>
                                  </div>
                                ))
                              )}
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
                    {completedConversations.length === 0 ? (
                      <div style={{
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #333',
                        borderRadius: '1rem',
                        padding: '4rem',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📜</div>
                        <div style={{ color: '#fff', fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>No conversation history</div>
                        <div style={{ color: '#666', fontSize: '0.875rem' }}>Completed conversations will appear here</div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {completedConversations.map((conv: any) => (
                          <div key={conv.id} style={{
                            backgroundColor: '#1a1a1a',
                            border: `2px solid ${conv.flaggedForTraining ? '#ef4444' : '#333'}`,
                            borderRadius: '1rem',
                            padding: '1.5rem',
                            position: 'relative'
                          }}>
                            {conv.flaggedForTraining && (
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

                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '1.5rem', marginBottom: conv.trainingIssue ? '1rem' : 0 }}>
                              <div>
                                <div style={{ color: '#fff', fontWeight: '600', fontSize: '1rem', marginBottom: '0.25rem' }}>
                                  {conv.customerName || 'Anonymous'}
                                </div>
                                <div style={{ color: '#666', fontSize: '0.75rem' }}>
                                  {conv.completedAt ? new Date(conv.completedAt).toLocaleString() : 'Unknown'}
                                </div>
                              </div>
                              <div>
                                <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Messages</div>
                                <div style={{ fontSize: '0.875rem', color: '#fff', fontWeight: '500' }}>{conv.messageCount}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Status</div>
                                <div style={{
                                  fontSize: '0.75rem',
                                  fontWeight: '600',
                                  color: conv.status === 'completed' ? '#4ade80' : '#fbbf24'
                                }}>
                                  {conv.status?.toUpperCase() || 'COMPLETED'}
                                </div>
                              </div>
                              <div>
                                <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Sentiment</div>
                                <div style={{
                                  fontSize: '0.75rem',
                                  fontWeight: '600',
                                  color: conv.sentiment === 'positive' ? '#4ade80' : conv.sentiment === 'frustrated' ? '#ef4444' : '#fbbf24'
                                }}>
                                  {conv.sentiment?.toUpperCase() || 'NEUTRAL'}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button 
                                  onClick={() => {
                                    setSelectedConversation(conv.id);
                                    ChatSessionService.getSessionMessages(orgId, conv.id).then(setSelectedMessages);
                                  }}
                                  style={{
                                    padding: '0.5rem 1rem',
                                    backgroundColor: '#222',
                                    color: '#fff',
                                    border: '1px solid #333',
                                    borderRadius: '0.5rem',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem',
                                    fontWeight: '600'
                                  }}
                                >
                                  View
                                </button>
                                {!conv.flaggedForTraining && (
                                  <button 
                                    onClick={() => handleSendToTraining(conv.id, 'Manual review')}
                                    style={{
                                      padding: '0.5rem 1rem',
                                      backgroundColor: primaryColor,
                                      color: '#fff',
                                      border: 'none',
                                      borderRadius: '0.5rem',
                                      cursor: 'pointer',
                                      fontSize: '0.75rem',
                                      fontWeight: '600'
                                    }}
                                  >
                                    📤 Train
                                  </button>
                                )}
                              </div>
                            </div>

                            {conv.trainingIssue && (
                              <div style={{
                                marginTop: '1rem',
                                padding: '1rem',
                                backgroundColor: '#0a0a0a',
                                border: '1px solid #ef4444',
                                borderRadius: '0.5rem',
                              }}>
                                <div style={{ color: '#ef4444', fontWeight: '600', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                                  ⚠️ ISSUE: {conv.trainingIssue}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
