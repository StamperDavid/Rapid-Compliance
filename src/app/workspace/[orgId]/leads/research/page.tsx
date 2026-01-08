'use client';

/**
 * Lead Research Teaching Interface
 * This is the "magic" - users can chat to find leads and teach the system what they want
 */

import React, { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import AdminBar from '@/components/AdminBar'
import { logger } from '@/lib/logger/logger';;

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  leads?: LeadResult[];
  cost?: number;
}

interface LeadResult {
  name: string;
  website: string;
  domain: string;
  industry: string;
  size: string;
  description: string;
  confidence: number;
  isGoodLead?: boolean; // User feedback
}

export default function LeadResearchPage() {
  const { user } = useAuth();
  const params = useParams();
  const orgId = params.orgId as string;
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm your lead research assistant. Tell me what kind of companies you're looking for, and I'll find them for you.\n\nTry something like:\n• \"Find me HVAC companies in Texas with 20-50 employees\"\n• \"Show me SaaS companies that use Stripe\"\n• \"Find companies like acme.com but in the finance industry\"",
      timestamp: new Date(),
    },
  ]);
  
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading) {return;}
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    
    try {
      // Call the research API
      const response = await fetch(`/api/leads/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: input,
          organizationId: orgId,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content:(data.message !== '' && data.message != null) ? data.message : `I found ${data.leads.length} companies matching your criteria:`,
          timestamp: new Date(),
          leads: data.leads,
          cost: data.cost,
        };
        
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `Sorry, I couldn't complete that search: ${data.error}`,
          timestamp: new Date(),
        };
        
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error: any) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Sorry, there was an error: ${error.message}`,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleLeadFeedback = async (messageId: string, leadDomain: string, isGood: boolean) => {
    // Update UI immediately
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId && msg.leads) {
        return {
          ...msg,
          leads: msg.leads.map(lead => 
            lead.domain === leadDomain ? { ...lead, isGoodLead: isGood } : lead
          ),
        };
      }
      return msg;
    }));
    
    // Send feedback to API (for learning)
    try {
      await fetch(`/api/leads/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: orgId,
          leadDomain,
          isGoodLead: isGood,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      logger.error('Failed to save feedback:', error, { file: 'page.tsx' });
    }
  };
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#000' }}>
      <AdminBar />
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: '1200px', width: '100%', margin: '0 auto', padding: '2rem' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
            🔍 Lead Research Assistant
          </h1>
          <p style={{ color: '#999' }}>
            Chat-based lead generation. Find companies, enrich data, and teach the system what you're looking for.
          </p>
        </div>
        
        {/* Messages */}
        <div style={{ 
          flex: 1, 
          overflowY: 'auto', 
          backgroundColor: '#0a0a0a', 
          borderRadius: '1rem', 
          padding: '1.5rem',
          marginBottom: '1.5rem',
          border: '1px solid #1a1a1a',
        }}>
          {messages.map((message) => (
            <div
              key={message.id}
              style={{
                marginBottom: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: message.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div style={{
                maxWidth: '80%',
                padding: '1rem 1.25rem',
                borderRadius: '1rem',
                backgroundColor: message.role === 'user' ? '#6366f1' : '#1a1a1a',
                color: '#fff',
              }}>
                <div style={{ fontSize: '0.75rem', color: message.role === 'user' ? '#e0e7ff' : '#999', marginBottom: '0.5rem' }}>
                  {message.role === 'user' ? 'You' : 'AI Assistant'}
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>
                  {message.content}
                </div>
                
                {/* Show cost if available */}
                {message.cost !== undefined && (
                  <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.5rem' }}>
                    Cost: ${message.cost.toFixed(4)} • Saved vs Clearbit: ${(0.75 - message.cost).toFixed(4)}
                  </div>
                )}
              </div>
              
              {/* Lead Results */}
              {message.leads && message.leads.length > 0 && (
                <div style={{ width: '100%', marginTop: '1rem' }}>
                  {message.leads.map((lead, idx) => (
                    <div
                      key={idx}
                      style={{
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #333',
                        borderRadius: '0.75rem',
                        padding: '1rem',
                        marginBottom: '0.75rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
                        <div>
                          <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#fff', marginBottom: '0.25rem' }}>
                            {lead.name}
                          </h3>
                          <a
                            href={lead.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: '0.875rem', color: '#6366f1', textDecoration: 'none' }}
                          >
                            {lead.domain}
                          </a>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#999', textAlign: 'right' }}>
                          Confidence: {lead.confidence}%
                        </div>
                      </div>
                      
                      <p style={{ fontSize: '0.875rem', color: '#ccc', marginBottom: '0.75rem' }}>
                        {lead.description}
                      </p>
                      
                      <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem' }}>
                        <div style={{ fontSize: '0.875rem' }}>
                          <span style={{ color: '#999' }}>Industry: </span>
                          <span style={{ color: '#fff' }}>{lead.industry}</span>
                        </div>
                        <div style={{ fontSize: '0.875rem' }}>
                          <span style={{ color: '#999' }}>Size: </span>
                          <span style={{ color: '#fff' }}>{lead.size}</span>
                        </div>
                      </div>
                      
                      {/* Feedback Buttons */}
                      <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #333' }}>
                        <button
                          onClick={() => handleLeadFeedback(message.id, lead.domain, true)}
                          style={{
                            flex: 1,
                            padding: '0.5rem',
                            backgroundColor: lead.isGoodLead === true ? '#10b981' : '#1a1a1a',
                            border: `1px solid ${  lead.isGoodLead === true ? '#10b981' : '#333'}`,
                            borderRadius: '0.5rem',
                            color: lead.isGoodLead === true ? '#fff' : '#999',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                          }}
                        >
                          👍 Good Lead
                        </button>
                        <button
                          onClick={() => handleLeadFeedback(message.id, lead.domain, false)}
                          style={{
                            flex: 1,
                            padding: '0.5rem',
                            backgroundColor: lead.isGoodLead === false ? '#ef4444' : '#1a1a1a',
                            border: `1px solid ${  lead.isGoodLead === false ? '#ef4444' : '#333'}`,
                            borderRadius: '0.5rem',
                            color: lead.isGoodLead === false ? '#fff' : '#999',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                          }}
                        >
                          👎 Not Relevant
                        </button>
                        <button
                          style={{
                            padding: '0.5rem 1rem',
                            backgroundColor: '#6366f1',
                            border: 'none',
                            borderRadius: '0.5rem',
                            color: '#fff',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                          }}
                        >
                          Add to CRM
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          
          {isLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#999' }}>
              <div className="spinner" />
              <span>Researching leads...</span>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
        
        {/* Input */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '1rem' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe the companies you're looking for..."
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '1rem 1.5rem',
              backgroundColor: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '0.75rem',
              color: '#fff',
              fontSize: '1rem',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            style={{
              padding: '1rem 2rem',
              backgroundColor: isLoading || !input.trim() ? '#333' : '#6366f1',
              color: '#fff',
              border: 'none',
              borderRadius: '0.75rem',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {isLoading ? 'Searching...' : 'Search'}
          </button>
        </form>
        
        {/* Examples */}
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[
            'Find SaaS companies in Austin with 50-200 employees',
            'Show me e-commerce stores using Shopify',
            'Find companies like stripe.com in the fintech space',
          ].map((example, idx) => (
            <button
              key={idx}
              onClick={() => setInput(example)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '0.5rem',
                color: '#999',
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              {example}
            </button>
          ))}
        </div>
      </div>
      
      <style jsx>{`
        .spinner {
          width: 1rem;
          height: 1rem;
          border: 2px solid #333;
          border-top-color: #6366f1;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}




