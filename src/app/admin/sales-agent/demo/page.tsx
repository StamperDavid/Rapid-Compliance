'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

export default function LiveDemoPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const [prospectInfo, setProspectInfo] = useState({ name: '', company: '', email: '' });
  const [sessionStarted, setSessionStarted] = useState(false);
  const [conversationMetrics, setConversationMetrics] = useState({
    duration: 0,
    messagesExchanged: 0,
    featuresDiscussed: [] as string[],
    objections: [] as string[],
    sentiment: 'positive' as 'positive' | 'neutral' | 'negative'
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (sessionStarted && !timerRef.current) {
      timerRef.current = setInterval(() => {
        setConversationMetrics(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [sessionStarted]);

  const startDemo = () => {
    if (!prospectInfo.name) {
      alert('Please enter prospect name');
      return;
    }

    setSessionStarted(true);
    setMessages([
      {
        role: 'agent',
        content: `Hi ${prospectInfo.name}! ${prospectInfo.company ? `Welcome from ${prospectInfo.company}! ` : ''}Thanks for your interest in our AI Sales Platform. I'm here to show you how our platform can transform your sales process. What's the biggest challenge you're facing with sales right now?`,
        timestamp: new Date()
      }
    ]);
  };

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMsg = { role: 'user', content: inputMessage, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsAgentTyping(true);

    // Update metrics
    setConversationMetrics(prev => ({
      ...prev,
      messagesExchanged: prev.messagesExchanged + 1
    }));

    // Simulate AI response (in production, this calls Gemini with Golden Master)
    setTimeout(() => {
      const response = generateSmartResponse(inputMessage);
      setMessages(prev => [...prev, { role: 'agent', content: response, timestamp: new Date() }]);
      setIsAgentTyping(false);

      // Track features discussed
      trackFeatures(inputMessage, response);
    }, 1500);
  };

  const generateSmartResponse = (userInput: string): string => {
    const input = userInput.toLowerCase();

    // Pricing questions
    if (input.includes('price') || input.includes('cost') || input.includes('expensive')) {
      setConversationMetrics(prev => ({
        ...prev,
        objections: [...new Set([...prev.objections, 'Pricing'])]
      }));
      return "Great question! Our pricing is designed to deliver ROI within the first 3 months. We have three tiers:\n\n• Starter ($99/mo) - Perfect for small teams just getting started\n• Professional ($299/mo) - Our most popular plan for growing businesses\n• Enterprise (Custom) - For large organizations with complex needs\n\nMost of our clients see 480% ROI because our AI agents replace 3-5 sales reps at a fraction of the cost. Would you like me to show you a cost breakdown specific to your team size?";
    }

    // Feature comparisons
    if (input.includes('salesforce') || input.includes('hubspot') || input.includes('competitor')) {
      setConversationMetrics(prev => ({
        ...prev,
        objections: [...new Set([...prev.objections, 'Competitive Comparison'])]
      }));
      return "Excellent question! While Salesforce and HubSpot are great CRMs for managing data, we focus on AI-first automation:\n\n✅ **What makes us different:**\n• Our AI agents actually SELL for you 24/7\n• Golden Master architecture = no hallucinations\n• Infinite scalability with perfect customer memory\n• Complete training system included\n\nMany clients use Salesforce for data storage and our platform for AI automation. They work great together! What specific capabilities are most important to you?";
    }

    // Technical questions
    if (input.includes('how') || input.includes('work') || input.includes('architecture') || input.includes('technical')) {
      setConversationMetrics(prev => ({
        ...prev,
        featuresDiscussed: [...new Set([...prev.featuresDiscussed, 'Architecture'])]
      }));
      return "I'd love to explain our unique architecture!\n\n**Golden Master System:**\n• One trained 'master' agent can handle 1000s of conversations simultaneously\n• Each customer gets perfect continuity - never repeats themselves\n• No hallucinations because we use structured memory\n• Version control means you can always rollback\n\n**Training Process:**\n• Role-play scenarios with your team\n• Real-time feedback loops\n• Auto-learning from successful conversations\n• Industry templates to get started fast\n\nWould you like to see this in action with a quick demo of the training center?";
    }

    // Demo request
    if (input.includes('demo') || input.includes('show') || input.includes('see it')) {
      return "Absolutely! I can give you a personalized demo right now. We can set up a live AI agent for your business in about 15 minutes.\n\nWhat I'll show you:\n✅ How to create custom entities for your business\n✅ Training an AI agent with your sales process\n✅ Deploying it to handle real conversations\n✅ Reviewing analytics and performance\n\nWould you prefer a live walkthrough now, or should I schedule a full 30-minute session with our team?";
    }

    // Timeline questions
    if (input.includes('long') || input.includes('time') || input.includes('quick')) {
      setConversationMetrics(prev => ({
        ...prev,
        objections: [...new Set([...prev.objections, 'Implementation Time'])]
      }));
      return "Great news - implementation is incredibly fast!\n\n**Setup Timeline:**\n• Day 1: Guided onboarding (15-20 minutes)\n• Days 2-3: Train your agent with scenarios\n• Day 4-5: Test with your team\n• Week 2: Go live with real prospects!\n\nMost clients are fully operational within 2 weeks. Our fastest client went live in 3 days! We provide hands-on support throughout. Does that timeline work for you?";
    }

    // ROI questions
    if (input.includes('roi') || input.includes('return') || input.includes('worth')) {
      setConversationMetrics(prev => ({
        ...prev,
        featuresDiscussed: [...new Set([...prev.featuresDiscussed, 'ROI'])]
      }));
      return "ROI is where we really shine! Here's what our clients typically see:\n\n**Average Results (First 3 Months):**\n• 300% increase in qualified leads\n• 24/7 coverage (vs. 8 hours with human team)\n• 95% of routine questions handled automatically\n• 480% average ROI\n\n**Real Example:** TechStart Solutions had no sales team. After deploying our AI agent:\n• 12 deals closed in first month\n• $45K in revenue attributed to the AI\n• Founder freed up 20 hrs/week\n• ROI: 480%\n\nWould you like me to calculate projected ROI for your specific situation?";
    }

    // Default helpful response
    return "That's a great point! Let me share how our platform addresses that. Our AI-first approach means you get:\n\n• **Automated Lead Qualification** - Agent pre-qualifies before bothering your team\n• **24/7 Availability** - Never miss a lead, even at 2am\n• **Continuous Learning** - Gets smarter with every conversation\n• **Complete Control** - You train it, you own it, you improve it\n\nWhat aspect would you like me to dive deeper into?";
  };

  const trackFeatures = (userInput: string, agentResponse: string) => {
    const combined = (userInput + ' ' + agentResponse).toLowerCase();
    const features = [];

    if (combined.includes('train') || combined.includes('scenario')) features.push('Training');
    if (combined.includes('crm') || combined.includes('entity')) features.push('CRM');
    if (combined.includes('ai') || combined.includes('agent')) features.push('AI Agents');
    if (combined.includes('workflow') || combined.includes('automat')) features.push('Automation');
    if (combined.includes('analytic') || combined.includes('report')) features.push('Analytics');

    if (features.length > 0) {
      setConversationMetrics(prev => ({
        ...prev,
        featuresDiscussed: [...new Set([...prev.featuresDiscussed, ...features])]
      }));
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const endSession = () => {
    const summary = {
      prospect: prospectInfo,
      duration: conversationMetrics.duration,
      messages: conversationMetrics.messagesExchanged,
      features: conversationMetrics.featuresDiscussed,
      objections: conversationMetrics.objections,
      outcome: 'demo_completed'
    };

    console.log('Session Summary:', summary);
    alert(`Demo Session Complete!\n\nDuration: ${formatTime(conversationMetrics.duration)}\nMessages: ${conversationMetrics.messagesExchanged}\nFeatures Discussed: ${conversationMetrics.featuresDiscussed.join(', ') || 'None'}\nObjections Handled: ${conversationMetrics.objections.join(', ') || 'None'}`);

    // Reset
    setSessionStarted(false);
    setMessages([]);
    setConversationMetrics({
      duration: 0,
      messagesExchanged: 0,
      featuresDiscussed: [],
      objections: [],
      sentiment: 'positive'
    });
  };

  const bgPaper = '#1a1a1a';
  const borderColor = '#333';
  const primaryColor = '#6366f1';

  if (!sessionStarted) {
    return (
      <div style={{ padding: '2rem', backgroundColor: '#000', minHeight: '100vh', color: '#fff' }}>
        <Link
          href="/admin/sales-agent"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: '#999',
            textDecoration: 'none',
            fontSize: '0.875rem',
            marginBottom: '2rem'
          }}
        >
          ← Back to Sales Agent
        </Link>

        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
              🎭 Live Demo Mode
            </h1>
            <p style={{ fontSize: '1.125rem', color: '#666' }}>
              Use your trained AI sales agent to demo the platform to prospects
            </p>
          </div>

          <div style={{
            backgroundColor: bgPaper,
            border: `1px solid ${borderColor}`,
            borderRadius: '0.75rem',
            padding: '2rem'
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.5rem' }}>
              Prospect Information
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: '#999' }}>
                  Prospect Name *
                </label>
                <input
                  type="text"
                  value={prospectInfo.name}
                  onChange={(e) => setProspectInfo(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="John Smith"
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    backgroundColor: '#0a0a0a',
                    border: `1px solid ${borderColor}`,
                    borderRadius: '0.5rem',
                    color: '#fff',
                    fontSize: '0.875rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: '#999' }}>
                  Company (Optional)
                </label>
                <input
                  type="text"
                  value={prospectInfo.company}
                  onChange={(e) => setProspectInfo(prev => ({ ...prev, company: e.target.value }))}
                  placeholder="Acme Corp"
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    backgroundColor: '#0a0a0a',
                    border: `1px solid ${borderColor}`,
                    borderRadius: '0.5rem',
                    color: '#fff',
                    fontSize: '0.875rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: '#999' }}>
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={prospectInfo.email}
                  onChange={(e) => setProspectInfo(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="john@acme.com"
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    backgroundColor: '#0a0a0a',
                    border: `1px solid ${borderColor}`,
                    borderRadius: '0.5rem',
                    color: '#fff',
                    fontSize: '0.875rem'
                  }}
                />
              </div>

              <button
                onClick={startDemo}
                style={{
                  marginTop: '1rem',
                  width: '100%',
                  padding: '1rem',
                  backgroundColor: primaryColor,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Start Demo Session
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#000' }}>
      {/* Metrics Sidebar */}
      <div style={{
        width: '300px',
        backgroundColor: bgPaper,
        borderRight: `1px solid ${borderColor}`,
        padding: '1.5rem',
        overflowY: 'auto'
      }}>
        <Link
          href="#"
          onClick={(e) => { e.preventDefault(); endSession(); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: '#ef4444',
            textDecoration: 'none',
            fontSize: '0.875rem',
            marginBottom: '1.5rem',
            fontWeight: '600'
          }}
        >
          ⏹️ End Session
        </Link>

        <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#fff', marginBottom: '1.5rem' }}>
          Live Session Metrics
        </h3>

        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.5rem' }}>Prospect</div>
          <div style={{ fontSize: '0.875rem', color: '#fff', fontWeight: '600' }}>{prospectInfo.name}</div>
          {prospectInfo.company && (
            <div style={{ fontSize: '0.75rem', color: '#999' }}>{prospectInfo.company}</div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Duration</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#10b981' }}>
              {formatTime(conversationMetrics.duration)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Messages</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff' }}>
              {conversationMetrics.messagesExchanged}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.5rem' }}>Features Discussed</div>
          {conversationMetrics.featuresDiscussed.length === 0 ? (
            <div style={{ fontSize: '0.875rem', color: '#999', fontStyle: 'italic' }}>None yet</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {conversationMetrics.featuresDiscussed.map((feature, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '0.25rem 0.75rem',
                    backgroundColor: '#065f46',
                    color: '#10b981',
                    borderRadius: '1rem',
                    fontSize: '0.75rem',
                    fontWeight: '600'
                  }}
                >
                  {feature}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.5rem' }}>Objections Handled</div>
          {conversationMetrics.objections.length === 0 ? (
            <div style={{ fontSize: '0.875rem', color: '#999', fontStyle: 'italic' }}>None yet</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {conversationMetrics.objections.map((objection, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '0.25rem 0.75rem',
                    backgroundColor: '#7c2d12',
                    color: '#f59e0b',
                    borderRadius: '1rem',
                    fontSize: '0.75rem',
                    fontWeight: '600'
                  }}
                >
                  {objection}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chat Interface */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          {messages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                marginBottom: '1rem',
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
              }}
            >
              <div style={{
                maxWidth: '70%',
                padding: '1rem',
                backgroundColor: msg.role === 'user' ? primaryColor : bgPaper,
                border: msg.role === 'agent' ? `1px solid ${borderColor}` : 'none',
                borderRadius: '0.75rem',
                color: '#fff'
              }}>
                {msg.role === 'agent' && (
                  <div style={{ fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.5rem', color: '#10b981' }}>
                    AI SALES AGENT
                  </div>
                )}
                <div style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>{msg.content}</div>
              </div>
            </div>
          ))}

          {isAgentTyping && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '1rem' }}>
              <div style={{
                padding: '1rem',
                backgroundColor: bgPaper,
                border: `1px solid ${borderColor}`,
                borderRadius: '0.75rem',
                color: '#666',
                fontSize: '0.875rem'
              }}>
                Agent is typing...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: '1.5rem',
          borderTop: `1px solid ${borderColor}`,
          backgroundColor: bgPaper
        }}>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Ask the AI agent about features, pricing, etc..."
              style={{
                flex: 1,
                padding: '0.75rem 1rem',
                backgroundColor: '#0a0a0a',
                border: `1px solid ${borderColor}`,
                borderRadius: '0.5rem',
                color: '#fff',
                fontSize: '0.875rem'
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim()}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: !inputMessage.trim() ? '#4b5563' : primaryColor,
                color: '#fff',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: !inputMessage.trim() ? 'not-allowed' : 'pointer'
              }}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

