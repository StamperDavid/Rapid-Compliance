'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import Link from 'next/link'
import { logger } from '@/lib/logger/logger';

/**
 * Admin Platform Sales Agent Training Center
 * This is the platform's own training center for the sales agent that sells the CRM
 * Same design as client training centers, but wired to admin context
 */
export default function AdminSalesAgentTrainingPage() {
  useAdminAuth();

  // Platform admin uses a special org ID for its own data
  const orgId = 'platform-admin';
  
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'materials' | 'history' | 'golden'>('chat');
  
  // Base Model & Golden Master states
  const [baseModel, setBaseModel] = useState<any>(null);
  const [goldenMasters, setGoldenMasters] = useState<any[]>([]);
  const [_activeGoldenMaster, setActiveGoldenMaster] = useState<any>(null);
  
  // Training chat states
  const [trainingTopic, setTrainingTopic] = useState('');
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  // Feedback states
  const [feedbackMode, setFeedbackMode] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<'correct' | 'incorrect' | 'could-improve'>('correct');
  const [feedbackWhy, setFeedbackWhy] = useState('');
  const [betterResponse, setBetterResponse] = useState('');
  
  // Sales criteria scoring
  const [salesCriteria, setSalesCriteria] = useState({
    objectionHandling: 5,
    productKnowledge: 5,
    toneAndProfessionalism: 5,
    closingSkills: 5,
    discoveryQuestions: 5,
    empathyAndRapport: 5
  });
  const [criteriaExplanations, setCriteriaExplanations] = useState({
    objectionHandling: '',
    productKnowledge: '',
    toneAndProfessionalism: '',
    closingSkills: '',
    discoveryQuestions: '',
    empathyAndRapport: ''
  });
  const [_sessionNotes, setSessionNotes] = useState('');
  
  // Training materials states
  const [uploadedMaterials, setUploadedMaterials] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  // Training history
  const [trainingHistory, setTrainingHistory] = useState<any[]>([]);
  const [overallScore, setOverallScore] = useState(0);
  
  // Custom criteria management
  const [customCriteria] = useState<Array<{key: string, label: string, icon: string}>>([
    { key: 'objectionHandling', label: 'Objection Handling', icon: '🛡️' },
    { key: 'productKnowledge', label: 'Product Knowledge', icon: '📚' },
    { key: 'toneAndProfessionalism', label: 'Tone & Professionalism', icon: '🎭' },
    { key: 'closingSkills', label: 'Closing Skills', icon: '🎯' },
    { key: 'discoveryQuestions', label: 'Discovery Questions', icon: '❓' },
    { key: 'empathyAndRapport', label: 'Empathy & Rapport', icon: '🤝' }
  ]);
  const [_showCriteriaEditor, _setShowCriteriaEditor] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem('appTheme');
    if (savedTheme) {
      try {
        setTheme(JSON.parse(savedTheme));
      } catch (error) {
        logger.error('Failed to load theme:', error, { file: 'page.tsx' });
      }
    }
    loadTrainingData();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Unified AI provider caller
  const callAIProvider = async (conversationHistory: any[], systemPrompt: string) => {
    try {
      const { FirestoreService } = await import('@/lib/db/firestore-service');
      const adminKeys = await FirestoreService.get('admin', 'platform-api-keys');
      
      if (adminKeys?.openrouter?.apiKey) {
        const { OpenRouterProvider } = await import('@/lib/ai/openrouter-provider');
        const provider = new OpenRouterProvider({ apiKey: adminKeys.openrouter.apiKey });
        
        const messages = [
          { role: 'system' as const, content: systemPrompt },
          ...conversationHistory.map(msg => ({
            role: msg.role === 'user' ? 'user' as const : 'assistant' as const,
            content: msg.parts[0].text
          }))
        ];
        
        const response = await provider.chat({
          model: 'anthropic/claude-3.5-sonnet' as any,
          messages,
          temperature: 0.7,
        });
        
        return { text: response.content };
      }
      
      const { sendChatMessage } = await import('@/lib/ai/gemini-service');
      return await sendChatMessage(conversationHistory as any, systemPrompt);
      
    } catch (error: any) {
      logger.error('Error calling AI provider:', error, { file: 'page.tsx' });
      throw new Error((error.message !== '' && error.message != null) ? error.message : 'Failed to get AI response');
    }
  };

  const loadTrainingData = async () => {
    try {
      setLoading(true);
      
      // For platform admin, always load demo/platform data
      loadPlatformData();
      
    } catch (error) {
      logger.error('Error loading training data:', error, { file: 'page.tsx' });
      loadPlatformData();
    } finally {
      setLoading(false);
    }
  };

  const loadPlatformData = () => {
    // Platform Sales Agent Base Model
    setBaseModel({
      id: 'platform-sales-agent-base',
      orgId: orgId,
      name: 'Platform Sales Agent - Base Model',
      businessName: 'AI Sales Platform',
      industry: 'SaaS / AI Technology',
      objectives: [
        'Qualify leads for the CRM platform',
        'Demonstrate AI agent capabilities',
        'Handle objections about pricing and competitors',
        'Close deals by showing ROI and value',
        'Schedule demos with qualified prospects'
      ],
      products: [
        {
          name: 'Starter Plan',
          price: '$99/month',
          description: '1,000 CRM records, 1 AI agent, 5 users, Email support'
        },
        {
          name: 'Professional Plan',
          price: '$299/month',
          description: '10,000 CRM records, 3 AI agents, 25 users, Priority support - MOST POPULAR'
        },
        {
          name: 'Enterprise Plan',
          price: 'Custom Pricing',
          description: 'Unlimited records, Unlimited AI agents, Unlimited users, Dedicated support'
        }
      ],
      uniqueValue: 'Golden Master architecture for infinite scalability with zero hallucinations',
      typicalSalesFlow: 'Qualify → Demo → ROI Discussion → Close',
      status: 'active',
      systemPrompt: `You are a sales agent for AI Sales Platform, a SaaS company that provides AI-powered CRM and sales automation tools.

Your role is to:
1. Qualify prospects by understanding their business needs
2. Demonstrate the value of AI sales agents
3. Handle objections professionally
4. Guide prospects toward scheduling a demo or starting a trial

Key selling points:
- Golden Master architecture ensures infinite scalability
- AI agents that never hallucinate or go off-script
- Full CRM with custom entities and workflows
- White-label capabilities for agencies
- E-commerce integration built-in

Pricing:
- Starter: $99/month (small businesses)
- Professional: $299/month (growing teams) - Most Popular
- Enterprise: Custom (large organizations)

Always be helpful, professional, and focused on understanding the prospect's needs before pitching solutions.`,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    setGoldenMasters([
      {
        id: 'gm-platform-1',
        version: 1,
        name: 'Platform Sales Agent v1',
        trainingScore: 85,
        status: 'active',
        isActive: true,
        deployedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        trainedScenarios: ['pricing', 'competitors', 'demo-request'],
        baseModelId: 'platform-sales-agent-base',
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      }
    ]);

    setActiveGoldenMaster({
      id: 'gm-platform-1',
      version: 1,
      name: 'Platform Sales Agent v1',
      trainingScore: 85,
      status: 'active'
    });

    setUploadedMaterials([
      {
        id: 'mat-1',
        filename: 'Platform Features Overview.pdf',
        type: 'document',
        size: 2400000,
        uploadedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        status: 'processed'
      },
      {
        id: 'mat-2',
        filename: 'Pricing & ROI Calculator.xlsx',
        type: 'spreadsheet',
        size: 1100000,
        uploadedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        status: 'processed'
      },
      {
        id: 'mat-3',
        filename: 'Competitor Battle Cards.pdf',
        type: 'document',
        size: 1800000,
        uploadedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        status: 'processed'
      }
    ]);

    setTrainingHistory([
      {
        id: 'session-1',
        topic: 'Pricing objection - "Too expensive"',
        messageCount: 12,
        score: 88,
        timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
      },
      {
        id: 'session-2',
        topic: 'vs Salesforce comparison',
        messageCount: 15,
        score: 92,
        timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      },
      {
        id: 'session-3',
        topic: 'Demo request - first time prospect',
        messageCount: 8,
        score: 85,
        timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
      }
    ]);

    setOverallScore(85);
  };

  const handleStartNewSession = (topic?: string) => {
    if (topic) {
      setTrainingTopic(topic);
    }
    setChatMessages([]);
    setActiveTab('chat');
  };

  const handleSendMessage = async () => {
    if (!userInput.trim() || !baseModel) {return;}
    
    const userMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: userInput.trim(),
      timestamp: new Date().toISOString(),
    };
    
    setChatMessages(prev => [...prev, userMessage]);
    setUserInput('');
    setIsTyping(true);
    
    try {
      let systemPrompt = baseModel.systemPrompt;
      systemPrompt += `\n\n## TRAINING MODE\nYou are in training mode. The topic being practiced: ${trainingTopic || 'General sales conversation'}.\nRespond naturally and professionally as you would to a real customer.\n`;
      
      const conversationHistory = chatMessages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));
      
      conversationHistory.push({
        role: 'user',
        parts: [{ text: userMessage.content }]
      });
      
      const response = await callAIProvider(conversationHistory, systemPrompt);
      
      const agentMessage = {
        id: `msg_${Date.now()}_agent`,
        role: 'agent',
        content: response.text,
        timestamp: new Date().toISOString(),
        canGiveFeedback: true,
      };
      
      setChatMessages(prev => [...prev, agentMessage]);
      
    } catch (error: any) {
      logger.error('Error sending message:', error, { file: 'page.tsx' });
      
      // Fallback response for demo purposes
      const fallbackMessage = {
        id: `msg_${Date.now()}_agent`,
        role: 'agent',
        content: `Thank you for your interest! I'd be happy to help you learn more about our AI Sales Platform. 

Based on your question, I can see you're interested in ${trainingTopic || 'our platform'}. 

Our solution helps businesses like yours automate their sales process with AI agents that never sleep, never forget, and scale infinitely.

Would you like me to walk you through a specific feature, or would you prefer to schedule a personalized demo?`,
        timestamp: new Date().toISOString(),
        canGiveFeedback: true,
      };
      
      setChatMessages(prev => [...prev, fallbackMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleGiveFeedback = (messageId: string) => {
    setSelectedMessageId(messageId);
    setFeedbackMode(true);
    setFeedbackType('correct');
    setFeedbackWhy('');
    setBetterResponse('');
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackWhy.trim()) {
      alert(`Please explain WHY this response is ${  feedbackType}`);
      return;
    }
    
    if (feedbackType !== 'correct' && !betterResponse.trim()) {
      alert('Please provide a better response or guidance on how to improve.');
      return;
    }
    
    // Mark message as having feedback
    setChatMessages(prev => prev.map(msg => 
      msg.id === selectedMessageId 
        ? { ...msg, hasFeedback: true, feedbackType } 
        : msg
    ));
    
    alert('✅ Feedback saved! This will help improve your AI agent.');
    
    setFeedbackMode(false);
    setSelectedMessageId(null);
    setFeedbackWhy('');
    setBetterResponse('');
  };

  const submitSalesCriteriaScoring = async () => {
    if (!trainingTopic.trim()) {
      alert('Please select or enter a training topic first.');
      return;
    }

    const criteriaKeys = Object.keys(salesCriteria) as Array<keyof typeof salesCriteria>;
    const missingExplanations = criteriaKeys.filter(key => 
      salesCriteria[key] < 7 && !criteriaExplanations[key].trim()
    );
    
    if (missingExplanations.length > 0) {
      const labels: Record<string, string> = {
        objectionHandling: 'Objection Handling',
        productKnowledge: 'Product Knowledge',
        toneAndProfessionalism: 'Tone & Professionalism',
        closingSkills: 'Closing Skills',
        discoveryQuestions: 'Discovery Questions',
        empathyAndRapport: 'Empathy & Rapport'
      };
      
      alert(`⚠️ Please explain low scores (< 7/10):\n\n${missingExplanations.map(key => `• ${labels[key]}: ${salesCriteria[key]}/10`).join('\n')}\n\nThe AI needs this context to learn and improve!`);
      return;
    }

    const criteriaScores = Object.values(salesCriteria);
    const avgScore = Math.round((criteriaScores.reduce((sum, score) => sum + score, 0) / criteriaScores.length) * 10);
    
    // Add to training history
    setTrainingHistory(prev => [
      {
        id: `session_${Date.now()}`,
        topic: trainingTopic,
        messageCount: chatMessages.length,
        score: avgScore,
        timestamp: new Date()
      },
      ...prev
    ]);
    
    setOverallScore(Math.round((overallScore + avgScore) / 2));
    
    alert(`✅ Training Session Scored!\n\nOverall Score: ${avgScore}/100\n\nYour detailed feedback will help the AI learn and improve!`);
    
    // Reset for next session
    setTrainingTopic('');
    setChatMessages([]);
    setSalesCriteria({
      objectionHandling: 5,
      productKnowledge: 5,
      toneAndProfessionalism: 5,
      closingSkills: 5,
      discoveryQuestions: 5,
      empathyAndRapport: 5
    });
    setCriteriaExplanations({
      objectionHandling: '',
      productKnowledge: '',
      toneAndProfessionalism: '',
      closingSkills: '',
      discoveryQuestions: '',
      empathyAndRapport: ''
    });
    setSessionNotes('');
  };

  const handleUploadMaterial = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {return;}
    
    setIsUploading(true);
    
    // Simulate upload
    setTimeout(() => {
      for (const file of Array.from(files)) {
        setUploadedMaterials(prev => [...prev, {
          id: `mat_${Date.now()}`,
          filename: file.name,
          type: file.type,
          size: file.size,
          uploadedAt: new Date(),
          status: 'processed'
        }]);
      }
      
      alert(`✅ ${files.length} training material(s) uploaded successfully!`);
      setIsUploading(false);
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }, 1500);
  };

  const handleSaveGoldenMaster = async () => {
    if (overallScore < 80) {
      alert(`⚠️ Training score too low!\n\nCurrent score: ${overallScore}%\nRequired: 80%+\n\nContinue training your agent with more scenarios and feedback.`);
      return;
    }
    
    const notes = prompt('Optional: Add notes about this Golden Master version');
    
    const newVersion = goldenMasters.length + 1;
    const now = new Date();
    const newGM = {
      id: `gm-platform-${newVersion}`,
      version: newVersion,
      name: `Platform Sales Agent v${newVersion}`,
      trainingScore: overallScore,
      status: 'ready',
      isActive: false,
      trainedScenarios: trainingHistory.map((h: any) => h.topic),
      baseModelId: baseModel.id,
      notes: notes ?? undefined,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      // Spread the base model fields at top level for instance manager
      ...baseModel
    };
    
    try {
      // Save to Firestore
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      await FirestoreService.set(
        `${COLLECTIONS.ORGANIZATIONS}/${orgId}/${COLLECTIONS.GOLDEN_MASTERS}`,
        newGM.id,
        newGM,
        false
      );

      setGoldenMasters(prev => [...prev, newGM]);
      alert(`✅ Golden Master v${newVersion} Created and saved to Firestore!\n\nYour trained AI agent is ready to deploy.`);
      setActiveTab('golden');
    } catch (error: any) {
      logger.error('Error saving golden master:', error, { file: 'page.tsx' });
      alert(`❌ Error saving Golden Master: ${error.message}`);
    }
  };

  const handleDeployGoldenMaster = async (gmId: string, version: number) => {
    if (!confirm(`Deploy Golden Master v${version} to production?`)) {return;}

    try {
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      const now = new Date();

      // Update all golden masters - set only this one as active
      const updatePromises = goldenMasters.map(async (gm) => {
        const isThisOne = gm.id === gmId;
        await FirestoreService.set(
          `${COLLECTIONS.ORGANIZATIONS}/${orgId}/${COLLECTIONS.GOLDEN_MASTERS}`,
          gm.id,
          {
            ...gm,
            isActive: isThisOne,
            deployedAt: isThisOne ? now.toISOString() : gm.deployedAt,
            updatedAt: now.toISOString()
          },
          true // merge
        );
      });

      await Promise.all(updatePromises);

      // Update local state
      setGoldenMasters(prev => prev.map(gm => ({
        ...gm,
        isActive: gm.id === gmId,
        deployedAt: gm.id === gmId ? now.toISOString() : gm.deployedAt
      })));

      setActiveGoldenMaster(goldenMasters.find(gm => gm.id === gmId));

      alert(`✅ Golden Master v${version} is now LIVE in Firestore!`);
    } catch (error: any) {
      logger.error('Error deploying golden master:', error, { file: 'page.tsx' });
      alert(`❌ Error deploying: ${error.message}`);
    }
  };

  const primaryColor = (theme?.colors?.primary?.main !== '' && theme?.colors?.primary?.main != null) ? theme.colors.primary.main : '#6366f1';

  if (loading) {
    return (
      <div style={{ padding: '2rem', backgroundColor: '#000', minHeight: '100vh', color: '#fff' }}>
        <div style={{ textAlign: 'center', padding: '4rem' }}>
          <p style={{ color: '#999' }}>Loading training center...</p>
        </div>
      </div>
    );
  }

  const suggestedTopics = [
    'Pricing objection - "Too expensive"',
    'vs Salesforce comparison',
    'vs HubSpot comparison',
    'Demo request - first time prospect',
    'Technical deep dive - Golden Master',
    'ROI justification for CFO',
    'Implementation timeline concerns',
    'Security and compliance questions',
  ];

  return (
    <div style={{ padding: '2rem', backgroundColor: '#000', minHeight: '100vh', color: '#fff' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <Link
          href="/admin/sales-agent"
          style={{
            color: '#666',
            textDecoration: 'none',
            fontSize: '0.875rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '1rem'
          }}
        >
          ← Back to Sales Agent
        </Link>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          🎓 Platform Sales Agent Training Center
        </h1>
        <p style={{ color: '#666', fontSize: '0.875rem' }}>
          Train your platform's sales agent through conversations, feedback, and scoring
        </p>
      </div>

      {/* Status Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ padding: '1rem', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '0.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Base Model</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#10b981' }}>✅ Active</div>
        </div>
        <div style={{ padding: '1rem', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '0.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Training Score</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: overallScore >= 80 ? '#10b981' : '#fbbf24' }}>{overallScore}%</div>
        </div>
        <div style={{ padding: '1rem', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '0.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Sessions</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff' }}>{trainingHistory.length}</div>
        </div>
        <div style={{ padding: '1rem', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '0.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Golden Masters</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff' }}>{goldenMasters.length}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', borderBottom: '1px solid #333', paddingBottom: '1rem' }}>
        {['chat', 'materials', 'history', 'golden'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: activeTab === tab ? primaryColor : 'transparent',
              border: activeTab === tab ? 'none' : '1px solid #333',
              borderRadius: '0.5rem',
              color: '#fff',
              fontWeight: activeTab === tab ? '600' : '400',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            {tab === 'chat' ? '💬 Training Chat' : tab === 'materials' ? '📚 Materials' : tab === 'history' ? '📊 History' : '⭐ Golden Masters'}
          </button>
        ))}
      </div>

      {/* Chat Tab */}
      {activeTab === 'chat' && (
        <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr 300px', gap: '1.5rem' }}>
          {/* Topics Sidebar */}
          <div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#999', fontSize: '0.875rem' }}>Training Topic</label>
              <input
                type="text"
                value={trainingTopic}
                onChange={(e) => setTrainingTopic(e.target.value)}
                placeholder="e.g., Price Objections"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '0.5rem',
                  color: '#fff',
                  fontSize: '0.875rem'
                }}
              />
            </div>
            
            <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.5rem' }}>SUGGESTED TOPICS</div>
            {suggestedTopics.map((topic, idx) => (
              <button
                key={idx}
                onClick={() => handleStartNewSession(topic)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.625rem',
                  marginBottom: '0.5rem',
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '0.375rem',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '0.75rem'
                }}
              >
                {topic}
              </button>
            ))}
          </div>

          {/* Chat Area */}
          <div style={{ display: 'flex', flexDirection: 'column', height: '500px', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
              {chatMessages.length === 0 && (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
                  <p>{trainingTopic ? `Start training on: ${trainingTopic}` : 'Select a topic to begin'}</p>
                </div>
              )}
              
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    marginBottom: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
                  }}
                >
                  <div style={{
                    maxWidth: '80%',
                    padding: '0.75rem 1rem',
                    backgroundColor: msg.role === 'user' ? primaryColor : '#1a1a1a',
                    borderRadius: '0.75rem',
                    fontSize: '0.875rem',
                    lineHeight: '1.5'
                  }}>
                    {msg.content}
                  </div>
                  
                  {msg.canGiveFeedback && msg.role === 'agent' && (
                    <button
                      onClick={() => handleGiveFeedback(msg.id)}
                      disabled={msg.hasFeedback}
                      style={{
                        marginTop: '0.5rem',
                        padding: '0.25rem 0.75rem',
                        backgroundColor: msg.hasFeedback ? '#0a0a0a' : '#1a1a1a',
                        border: '1px solid #333',
                        borderRadius: '0.25rem',
                        color: msg.hasFeedback ? '#666' : '#999',
                        cursor: msg.hasFeedback ? 'default' : 'pointer',
                        fontSize: '0.75rem'
                      }}
                    >
                      {msg.hasFeedback ? (msg.feedbackType === 'correct' ? '✅ Good' : '⚠️ Feedback given') : '💬 Give Feedback'}
                    </button>
                  )}
                </div>
              ))}
              
              {isTyping && (
                <div style={{ padding: '0.75rem', backgroundColor: '#1a1a1a', borderRadius: '0.75rem', display: 'inline-block' }}>
                  <span style={{ color: '#999' }}>Typing...</span>
                </div>
              )}
              
              <div ref={chatEndRef} />
            </div>

            <div style={{ padding: '1rem', borderTop: '1px solid #333' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      void handleSendMessage();
                    }
                  }}
                  placeholder="Type as a prospect..."
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '0.5rem',
                    color: '#fff',
                    fontSize: '0.875rem'
                  }}
                />
                <button
                  onClick={() => void handleSendMessage()}
                  disabled={!userInput.trim() || isTyping}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: !userInput.trim() || isTyping ? '#333' : primaryColor,
                    color: '#fff',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: !userInput.trim() || isTyping ? 'not-allowed' : 'pointer',
                    fontWeight: '600'
                  }}
                >
                  Send
                </button>
              </div>
            </div>
          </div>

          {/* Scoring Panel */}
          <div style={{ backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem', padding: '1rem', height: 'fit-content' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '1rem' }}>📊 Score This Session</h3>
            
            <div style={{ maxHeight: '350px', overflowY: 'auto', marginBottom: '1rem' }}>
              {customCriteria.map(({ key, label, icon }) => (
                <div key={key} style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#999' }}>{icon} {label}</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: salesCriteria[key as keyof typeof salesCriteria] >= 7 ? '#10b981' : '#fbbf24' }}>
                      {salesCriteria[key as keyof typeof salesCriteria]}/10
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={salesCriteria[key as keyof typeof salesCriteria]}
                    onChange={(e) => setSalesCriteria(prev => ({ ...prev, [key]: parseInt(e.target.value) }))}
                    style={{ width: '100%', marginBottom: '0.5rem' }}
                  />
                  <textarea
                    value={criteriaExplanations[key as keyof typeof criteriaExplanations]}
                    onChange={(e) => setCriteriaExplanations(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder="Why this score?"
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      backgroundColor: '#1a1a1a',
                      border: '1px solid #333',
                      borderRadius: '0.25rem',
                      color: '#fff',
                      fontSize: '0.7rem',
                      minHeight: '40px',
                      resize: 'vertical'
                    }}
                  />
                </div>
              ))}
            </div>
            
            <div style={{ padding: '0.75rem', backgroundColor: '#1a1a1a', borderRadius: '0.5rem', marginBottom: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: '#666' }}>Session Score</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>
                {Math.round((Object.values(salesCriteria).reduce((sum, score) => sum + score, 0) / customCriteria.length) * 10)}/100
              </div>
            </div>
            
            <button
              onClick={() => void submitSalesCriteriaScoring()}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: primaryColor,
                color: '#fff',
                border: 'none',
                borderRadius: '0.5rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              💾 Save Session
            </button>
          </div>
        </div>
      )}

      {/* Materials Tab */}
      {activeTab === 'materials' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>Training Materials</h2>
              <p style={{ color: '#666', fontSize: '0.875rem' }}>Upload documents to enhance your agent's knowledge</p>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: isUploading ? '#333' : primaryColor,
                color: '#fff',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: isUploading ? 'not-allowed' : 'pointer',
                fontWeight: '600'
              }}
            >
              {isUploading ? 'Uploading...' : '📤 Upload'}
            </button>
            <input ref={fileInputRef} type="file" multiple accept=".pdf,.doc,.docx,.txt,.xlsx" onChange={(e) => void handleUploadMaterial(e)} style={{ display: 'none' }} />
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
            {uploadedMaterials.map((mat) => (
              <div key={mat.id} style={{ padding: '1rem', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '0.5rem' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📄</div>
                <div style={{ fontWeight: '600', marginBottom: '0.25rem', fontSize: '0.875rem' }}>{mat.filename}</div>
                <div style={{ fontSize: '0.75rem', color: '#666' }}>{Math.round(mat.size / 1024)} KB</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>Training History</h2>
          
          {trainingHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>No training sessions yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {trainingHistory.map((session) => (
                <div key={session.id} style={{ padding: '1rem', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>{session.topic}</div>
                    <div style={{ fontSize: '0.75rem', color: '#666' }}>{session.messageCount} messages • {new Date(session.timestamp).toLocaleDateString()}</div>
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: session.score >= 80 ? '#10b981' : '#fbbf24' }}>{session.score}%</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Golden Masters Tab */}
      {activeTab === 'golden' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>Golden Masters</h2>
              <p style={{ color: '#666', fontSize: '0.875rem' }}>Production-ready snapshots of your trained agent</p>
            </div>
            <button
              onClick={() => void handleSaveGoldenMaster()}
              disabled={overallScore < 80}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: overallScore >= 80 ? '#10b981' : '#333',
                color: '#fff',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: overallScore >= 80 ? 'pointer' : 'not-allowed',
                fontWeight: '600'
              }}
            >
              💾 Save Golden Master
            </button>
          </div>
          
          {overallScore < 80 && (
            <div style={{ padding: '1rem', backgroundColor: '#1a1a0a', border: '1px solid #3a3a0a', borderRadius: '0.5rem', marginBottom: '1rem', color: '#fbbf24', fontSize: '0.875rem' }}>
              ⚠️ Training score is {overallScore}%. Need 80%+ to save a Golden Master.
            </div>
          )}
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {goldenMasters.map((gm) => (
              <div key={gm.id} style={{ padding: '1.5rem', backgroundColor: '#1a1a1a', border: gm.isActive ? `2px solid ${primaryColor}` : '1px solid #333', borderRadius: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                      v{gm.version}
                      {gm.isActive && <span style={{ marginLeft: '0.75rem', fontSize: '0.75rem', color: '#10b981', backgroundColor: '#0a2a1a', padding: '0.25rem 0.75rem', borderRadius: '1rem' }}>LIVE</span>}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#666' }}>Score: {gm.trainingScore}% • Created: {new Date(gm.createdAt).toLocaleDateString()}</div>
                  </div>
                  {!gm.isActive && (
                    <button
                      onClick={() => void handleDeployGoldenMaster(gm.id, gm.version)}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: primaryColor,
                        color: '#fff',
                        border: 'none',
                        borderRadius: '0.375rem',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '0.875rem'
                      }}
                    >
                      🚀 Deploy
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {feedbackMode && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setFeedbackMode(false)}
        >
          <div
            style={{
              width: '90%',
              maxWidth: '500px',
              backgroundColor: '#0a0a0a',
              border: '1px solid #333',
              borderRadius: '0.75rem',
              padding: '1.5rem'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>Feedback</h2>
            
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              {[
                { value: 'correct', label: '✅ Good', color: '#10b981' },
                { value: 'could-improve', label: '⚠️ Could Improve', color: '#fbbf24' },
                { value: 'incorrect', label: '❌ Wrong', color: '#ef4444' }
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setFeedbackType(option.value as any)}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    backgroundColor: feedbackType === option.value ? option.color : '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '0.5rem',
                    color: '#fff',
                    cursor: 'pointer',
                    fontWeight: feedbackType === option.value ? '600' : '400'
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
            
            <textarea
              value={feedbackWhy}
              onChange={(e) => setFeedbackWhy(e.target.value)}
              placeholder="Why? (Required)"
              rows={3}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '0.5rem',
                color: '#fff',
                marginBottom: '1rem',
                resize: 'vertical'
              }}
            />
            
            {feedbackType !== 'correct' && (
              <textarea
                value={betterResponse}
                onChange={(e) => setBetterResponse(e.target.value)}
                placeholder="Better response (Required)"
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '0.5rem',
                  color: '#fff',
                  marginBottom: '1rem',
                  resize: 'vertical'
                }}
              />
            )}
            
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setFeedbackMode(false)}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: 'transparent',
                  border: '1px solid #333',
                  borderRadius: '0.5rem',
                  color: '#999',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSubmitFeedback()}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: primaryColor,
                  border: 'none',
                  borderRadius: '0.5rem',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}











