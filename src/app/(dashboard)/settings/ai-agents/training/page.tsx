'use client';

import { PLATFORM_ID } from '@/lib/constants/platform';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import SubpageNav from '@/components/ui/SubpageNav';
import { AI_WORKFORCE_TABS } from '@/lib/constants/subpage-nav';
import { useAuth } from '@/hooks/useAuth';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import { PageTitle, SectionDescription } from '@/components/ui/typography';
import { logger } from '@/lib/logger/logger';
import { useToast } from '@/hooks/useToast';
import { useConfirm, usePrompt } from '@/hooks/useConfirm';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import type { AgentDomain } from '@/types/training';

// Type definitions
interface BaseModel {
  id: string;
  PLATFORM_ID: string;
  name: string;
  businessName: string;
  industry: string;
  objectives: string[];
  products: Array<{
    name: string;
    price: string;
    description: string;
  }>;
  uniqueValue: string;
  typicalSalesFlow: string;
  status: string;
  systemPrompt?: string;
  trainingScore?: number;
  trainingScenarios?: Array<{ id: string; score: number }>;
  createdAt: Date;
  updatedAt: Date;
}

interface GoldenMaster {
  id: string;
  version: string | number;
  name: string;
  trainingScore: number;
  status: string;
  isActive?: boolean;
  deployedAt?: Date | string;
  createdAt?: Date | string;
  trainedScenarios?: Array<{ id: string; score: number }>;
  baseModelId: string;
  notes?: string;
  scenarios?: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'agent' | 'model';
  content: string;
  timestamp: string;
  canGiveFeedback?: boolean;
  hasFeedback?: boolean;
  feedbackType?: 'correct' | 'incorrect' | 'could-improve';
  parts?: Array<{ text: string }>;
}

interface TrainingMaterial {
  id?: string;
  PLATFORM_ID: string;
  filename: string;
  name?: string;
  type: string;
  size: number | string;
  uploadedAt: Date | string;
  extractedContent?: string;
  processedAt?: string;
  status?: string;
  keyPoints?: string[];
}

interface TrainingSession {
  id: string;
  PLATFORM_ID?: string;
  baseModelId?: string;
  topic: string;
  messagesCount?: number;
  messageCount?: number;
  score?: number;
  overallScore?: number;
  criteriaScores?: Record<string, number>;
  criteriaExplanations?: Record<string, string>;
  sessionNotes?: string;
  notes?: string;
  feedback?: string;
  timestamp: Date | string;
  messages?: ChatMessage[];
}

interface AIResponse {
  text: string;
  content?: string;
}

/** Human-readable display labels for each AgentDomain value. */
const AGENT_TYPE_LABELS: Record<AgentDomain, string> = {
  chat: 'Chat',
  content: 'Content',
  voice: 'Voice',
  email: 'Email',
  social: 'Social',
  seo: 'SEO',
  video: 'Video',
  orchestrator: 'Jasper (Orchestrator)',
  sales_chat: 'Alex (Sales Chat)',
};

/** Ordered list of agent domains shown in the Training Center selector. */
const SELECTABLE_AGENT_DOMAINS: AgentDomain[] = [
  'chat',
  'content',
  'voice',
  'email',
  'social',
  'seo',
  'sales_chat',
  'orchestrator',
];

export default function AgentTrainingPage() {
  const { user } = useAuth();
  const toast = useToast();
  const confirmDialog = useConfirm();
  const promptDialog = usePrompt();

  const [loading, setLoading] = useState(true);
  const { theme } = useOrgTheme();
  const authFetch = useAuthFetch();
  const [activeTab, setActiveTab] = useState<'performance' | 'improvements' | 'review' | 'chat' | 'materials' | 'history' | 'golden'>('performance');
  const [selectedAgentType, setSelectedAgentType] = useState<AgentDomain>('chat');
  const [viewMode, setViewMode] = useState<'customer' | 'swarm'>('customer');
  const [selectedSpecialistId, setSelectedSpecialistId] = useState<string>('');
  const [swarmSpecialists, setSwarmSpecialists] = useState<Array<{ agentId: string; agentType: string }>>([]);

  // Base Model & Golden Master states
  const [baseModel, setBaseModel] = useState<BaseModel | null>(null);
  const [goldenMasters, setGoldenMasters] = useState<GoldenMaster[]>([]);
  const [activeGoldenMaster, setActiveGoldenMaster] = useState<GoldenMaster | null>(null);

  // Training chat states
  const [trainingTopic, setTrainingTopic] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Feedback states
  const [feedbackMode, setFeedbackMode] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<'correct' | 'incorrect' | 'could-improve'>('correct');
  const [feedbackWhy, setFeedbackWhy] = useState('');
  const [betterResponse, setBetterResponse] = useState('');

  // Sales criteria scoring - unused vars prefixed with underscore
  const [_showScoringPanel, _setShowScoringPanel] = useState(false);
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
  const [sessionNotes, setSessionNotes] = useState('');

  // Training materials states
  const [uploadedMaterials, setUploadedMaterials] = useState<TrainingMaterial[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Training history
  const [trainingHistory, setTrainingHistory] = useState<TrainingSession[]>([]);
  const [overallScore, setOverallScore] = useState(0);

  // Custom criteria management - unused setter prefixed with underscore
  const [customCriteria, _setCustomCriteria] = useState<Array<{key: string, label: string, icon: string}>>([
    { key: 'objectionHandling', label: 'Objection Handling', icon: '🛡️' },
    { key: 'productKnowledge', label: 'Product Knowledge', icon: '📚' },
    { key: 'toneAndProfessionalism', label: 'Tone & Professionalism', icon: '🎭' },
    { key: 'closingSkills', label: 'Closing Skills', icon: '🎯' },
    { key: 'discoveryQuestions', label: 'Discovery Questions', icon: '❓' },
    { key: 'empathyAndRapport', label: 'Empathy & Rapport', icon: '🤝' }
  ]);
  const [showCriteriaEditor, setShowCriteriaEditor] = useState(false);

  // Firebase check - MUST be at top level, not after conditional returns
  const [firebaseConfigured, setFirebaseConfigured] = useState<boolean | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadDemoDataRef = useRef<(() => void) | null>(null);

  // Unified AI provider caller - uses whatever API key is available
  const callAIProvider = useCallback(async (conversationHistory: ChatMessage[], systemPrompt: string): Promise<AIResponse> => {
    try {
      // Get API keys from Firestore
      const { FirestoreService } = await import('@/lib/db/firestore-service');
      const rawAdminKeys = await FirestoreService.get('admin', 'platform-api-keys');
      const adminKeys = rawAdminKeys as Record<string, { apiKey?: string } | undefined> | null | undefined;

      // Prefer OpenRouter (supports all models)
      if (adminKeys?.openrouter?.apiKey) {
        const { OpenRouterProvider } = await import('@/lib/ai/openrouter-provider');
        const provider = new OpenRouterProvider({ apiKey: adminKeys.openrouter.apiKey });

        // Convert history to OpenRouter format
        const messages = [
          { role: 'system' as const, content: systemPrompt },
          ...conversationHistory.map(msg => ({
            role: msg.role === 'user' ? 'user' as const : 'assistant' as const,
            content: msg.parts?.[0]?.text ?? msg.content
          }))
        ];

        const response = await provider.chat({
          model: 'claude-sonnet-4.6',
          messages,
          temperature: 0.7,
        });

        return { text: String(response.content) };
      }

      // Fall back to Gemini
      const { sendChatMessage } = await import('@/lib/ai/gemini-service');
      type GeminiRole = 'user' | 'model';
      const geminiHistory = conversationHistory.map(msg => ({
        role: (msg.role === 'user' ? 'user' : 'model') satisfies GeminiRole as GeminiRole,
        parts: [{ text: msg.content }]
      }));
      const geminiResponse = await sendChatMessage(geminiHistory, systemPrompt) as AIResponse;
      return geminiResponse;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get AI response';
      logger.error('Error calling AI provider:', error instanceof Error ? error : undefined, { file: 'page.tsx' });
      throw new Error(errorMessage || 'Failed to get AI response');
    }
  }, []);

  const loadTrainingData = useCallback(async () => {
    try {
      setLoading(true);

      // Check if Firebase is configured
      const { isFirebaseConfigured } = await import('@/lib/firebase/config');
      if (!isFirebaseConfigured) {
        logger.warn('Firebase not configured, loading demo data', { file: 'page.tsx' });
        loadDemoDataRef.current?.();
        setLoading(false);
        return;
      }

      // Load Base Model
      const { getBaseModel } = await import('@/lib/agent/base-model-builder');
      const model = await getBaseModel() as BaseModel | null;

      setBaseModel(model);

      // Load Golden Masters
      const { getAllGoldenMasters, getActiveGoldenMaster } = await import('@/lib/agent/golden-master-builder');
      const masters = await getAllGoldenMasters() as unknown as GoldenMaster[];
      setGoldenMasters(masters);

      const active = await getActiveGoldenMaster() as unknown as GoldenMaster | null;
      setActiveGoldenMaster(active);

      // Load training materials (paginated - first 100)
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      const { orderBy } = await import('firebase/firestore');

      const materialsResult = await FirestoreService.getAllPaginated(
        `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/trainingMaterials`,
        [orderBy('uploadedAt', 'desc')],
        100 // Load more materials at once for training
      );
      setUploadedMaterials((materialsResult.data as TrainingMaterial[]) || []);

      // Load training history (paginated - first 50 sessions)
      const historyResult = await FirestoreService.getAllPaginated(
        `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/trainingSessions`,
        [orderBy('timestamp', 'desc')],
        50
      );
      setTrainingHistory((historyResult.data as TrainingSession[]) || []);

      // Calculate overall score
      if (model?.trainingScore) {
        setOverallScore(model.trainingScore);
      }

    } catch (error) {
      logger.error('Error loading training data:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTrainingData();
  }, [loadTrainingData]);

  // Check Firebase configuration
  useEffect(() => {
    void (async () => {
      const { isFirebaseConfigured } = await import('@/lib/firebase/config');
      setFirebaseConfigured(isFirebaseConfigured);
    })();
  }, []);

  // Load swarm specialists when switching to swarm mode
  useEffect(() => {
    if (viewMode !== 'swarm') { return; }
    void (async () => {
      try {
        const res = await authFetch('/api/swarm/performance?period=30');
        if (res.ok) {
          const data = await res.json() as { success: boolean; specialists?: Array<{ agentId: string; agentType: string }> };
          if (data.success && data.specialists) {
            setSwarmSpecialists(data.specialists);
            if (!selectedSpecialistId && data.specialists.length > 0) {
              setSelectedSpecialistId(data.specialists[0].agentId);
            }
          }
        }
      } catch {
        // silently fail — will show empty state
      }
    })();
  }, [viewMode, authFetch, selectedSpecialistId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleStartNewSession = (topic?: string) => {
    if (topic) {
      setTrainingTopic(topic);
    }
    setChatMessages([]);
    setActiveTab('chat');
  };

  const handleSendMessage = async () => {
    if (!userInput.trim() || !baseModel) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: userInput.trim(),
      timestamp: new Date().toISOString(),
    };

    setChatMessages(prev => [...prev, userMessage]);
    setUserInput('');
    setIsTyping(true);

    try {
      // Build system prompt from Base Model
      const systemPrompt = `${baseModel.systemPrompt ?? ''}\n\n## TRAINING MODE\nYou are in training mode. The topic being practiced: ${trainingTopic || 'General sales conversation'}.\nRespond naturally and professionally as you would to a real customer.\n`;

      // Build conversation history
      const conversationHistory: ChatMessage[] = [
        ...chatMessages,
        userMessage
      ];

      // Call AI (using available provider - OpenRouter, Gemini, etc.)
      const response = await callAIProvider(conversationHistory, systemPrompt);

      const agentMessage: ChatMessage = {
        id: `msg_${Date.now()}_agent`,
        role: 'agent',
        content: response.text,
        timestamp: new Date().toISOString(),
        canGiveFeedback: true,
      };

      setChatMessages(prev => [...prev, agentMessage]);

      // Auto-save session
      await saveTrainingSession();

    } catch (error) {
      logger.error('Error sending message:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      toast.error('Failed to get agent response. Please try again.');
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
      toast.warning(`Please explain WHY this response is ${feedbackType}`);
      return;
    }

    if (feedbackType !== 'correct' && !betterResponse.trim()) {
      toast.warning('Please provide a better response or guidance on how to improve.');
      return;
    }

    try {
      // Save feedback to Firestore
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');

      const feedbackData = {
        PLATFORM_ID,
        baseModelId: baseModel?.id ?? '',
        messageId: selectedMessageId,
        topic: trainingTopic,
        feedbackType,
        why: feedbackWhy,
        betterResponse: betterResponse || null,
        timestamp: new Date().toISOString(),
      };

      await FirestoreService.set(
        `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/trainingFeedback`,
        `feedback_${Date.now()}`,
        feedbackData,
        false
      );

      // Mark message as having feedback
      setChatMessages(prev => prev.map(msg =>
        msg.id === selectedMessageId
          ? { ...msg, hasFeedback: true, feedbackType }
          : msg
      ));

      // Update Base Model's training score
      await updateTrainingScore(feedbackType === 'correct' ? 100 : feedbackType === 'could-improve' ? 70 : 40);

      toast.success('Feedback saved! This will help improve your AI agent.');

      // Reset feedback mode
      setFeedbackMode(false);
      setSelectedMessageId(null);
      setFeedbackWhy('');
      setBetterResponse('');

    } catch (error) {
      logger.error('Error saving feedback:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      toast.error('Failed to save feedback. Please try again.');
    }
  };

  const updateTrainingScore = async (sessionScore: number) => {
    try {
      const { addTrainingScenario } = await import('@/lib/agent/base-model-builder');

      const scenarioId = `scenario_${Date.now()}`;
      await addTrainingScenario(baseModel?.id ?? '', scenarioId, sessionScore);

      // Reload base model to get updated score
      const { getBaseModel } = await import('@/lib/agent/base-model-builder');
      const updated = await getBaseModel() as BaseModel | null;
      setBaseModel(updated);
      if (updated?.trainingScore) {
        setOverallScore(updated.trainingScore);
      }

    } catch (error) {
      logger.error('Error updating training score:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    }
  };

  const submitSalesCriteriaScoring = async () => {
    if (!trainingTopic.trim()) {
      toast.warning('Please select or enter a training topic first.');
      return;
    }

    // Validate that explanations are provided for low scores (< 7)
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

      toast.warning(`Please explain low scores (< 7/10): ${missingExplanations.map(key => `${labels[key]}: ${salesCriteria[key]}/10`).join(', ')}. The AI needs this context to learn and improve!`);
      return;
    }

    // Calculate overall score from criteria (0-100 scale)
    const criteriaScores = Object.values(salesCriteria);
    const avgScore = Math.round((criteriaScores.reduce((sum, score) => sum + score, 0) / criteriaScores.length) * 10);

    try {
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');

      const sessionRecord = {
        PLATFORM_ID,
        baseModelId: baseModel?.id ?? '',
        topic: trainingTopic,
        messagesCount: chatMessages.length,
        overallScore: avgScore,
        criteriaScores: salesCriteria,
        criteriaExplanations: criteriaExplanations, // Include explanations!
        sessionNotes: sessionNotes,
        timestamp: new Date().toISOString(),
      };

      await FirestoreService.set(
        `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/trainingSessions`,
        `session_${Date.now()}`,
        sessionRecord,
        false
      );

      // Update training score
      await updateTrainingScore(avgScore);

      // Add to training history
      setTrainingHistory(prev => [
        {
          id: `session_${Date.now()}`,
          topic: trainingTopic,
          score: avgScore,
          criteriaScores: salesCriteria,
          criteriaExplanations: criteriaExplanations,
          notes: sessionNotes,
          timestamp: new Date().toISOString(),
        },
        ...prev
      ]);

      toast.success(`Training Session Scored! Overall Score: ${avgScore}/100. Your detailed feedback will help the AI learn and improve!`);

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

    } catch (error) {
      logger.error('Error saving sales criteria scoring:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      toast.error('Failed to save session score. Please try again.');
    }
  };

  const saveTrainingSession = async () => {
    try {
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');

      const sessionData = {
        PLATFORM_ID,
        baseModelId: baseModel?.id ?? '',
        topic: trainingTopic || 'General',
        messages: chatMessages,
        timestamp: new Date().toISOString(),
        messageCount: chatMessages.length,
      };

      await FirestoreService.set(
        `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/trainingSessions`,
        `session_${Date.now()}`,
        sessionData,
        false
      );

    } catch (error) {
      logger.error('Error saving training session:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    }
  };

  const handleUploadMaterial = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    setIsUploading(true);

    try {
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      const { processDocumentContent } = await import('@/lib/agent/knowledge-processor');

      for (const file of Array.from(files)) {
        // Read file content
        const text = await readFileAsText(file);

        // Process content (extract knowledge)
        const extractedContent = processDocumentContent(text, file.type);

        // Save training material
        const materialData: TrainingMaterial = {
          PLATFORM_ID,
          filename: file.name,
          type: file.type,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          extractedContent,
          processedAt: new Date().toISOString(),
        };

        await FirestoreService.set(
          `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/trainingMaterials`,
          `material_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          materialData,
          false
        );

        setUploadedMaterials(prev => [...prev, materialData]);

        // Add to Base Model knowledge base
        // This will be automatically included in future training sessions
      }

      toast.success(`${files.length} training material(s) uploaded successfully! The content has been processed and will be used to train your AI agent.`);

    } catch (error) {
      logger.error('Error uploading training materials:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      toast.error('Failed to upload training materials. Please try again.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string || '');
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const handleSaveGoldenMaster = async () => {
    if (!baseModel) {
      return;
    }

    if (baseModel.status !== 'ready') {
      toast.warning(`Base Model is not ready yet! Current status: ${baseModel.status}, Training score: ${overallScore}%. Continue training until you reach 80%+ score across multiple scenarios.`);
      return;
    }

    if (overallScore < 80) {
      toast.warning(`Training score too low! Current score: ${overallScore}%, Required: 80%+. Continue training your agent with more scenarios and feedback until the score improves.`);
      return;
    }

    const notes = await promptDialog({
      title: 'Add Notes',
      description: 'Optional: Add notes about this Golden Master version. What changes or improvements were made?',
      placeholder: 'Enter notes...',
    });

    try {
      const { createGoldenMaster } = await import('@/lib/agent/golden-master-builder');

      const userId = user?.id;
      const newGoldenMaster = await createGoldenMaster(baseModel.id, (userId !== '' && userId !== undefined) ? userId : 'system', notes ?? undefined) as { version: string | number };

      toast.success(`Golden Master ${newGoldenMaster.version} Created! Your trained AI agent has been saved as a production-ready version. Next steps: Review the Golden Master in the "Golden Master" tab, Deploy it to production when ready, Continue training your Base Model for future improvements.`);

      // Reload data
      await loadTrainingData();
      setActiveTab('golden');

    } catch (error) {
      logger.error('Error saving Golden Master:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      toast.error('Failed to save Golden Master. Please try again.');
    }
  };

  const loadDemoData = useCallback(() => {
    // Create demo Base Model
    setBaseModel({
      id: 'demo-base-model',
      PLATFORM_ID: PLATFORM_ID,
      name: 'Demo Sales Agent',
      businessName: 'Demo Company',
      industry: 'General Business',
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
          description: 'Unlimited records, Unlimited AI agents, Unlimited users, Dedicated support, Custom development'
        }
      ],
      uniqueValue: 'Golden Master architecture for infinite scalability with zero hallucinations',
      typicalSalesFlow: 'Qualify → Demo → ROI Discussion → Close',
      status: 'active',
      trainingScore: 85.8,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Create demo Golden Masters
    setGoldenMasters([
      {
        id: 'gm-demo-1',
        version: 1,
        name: 'Platform Sales Agent v1',
        trainingScore: 85,
        status: 'active',
        baseModelId: 'demo-base-model',
        deployedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        scenarios: 5
      }
    ]);

    setActiveGoldenMaster({
      id: 'gm-demo-1',
      version: 1,
      name: 'Platform Sales Agent v1',
      trainingScore: 85,
      status: 'active',
      baseModelId: 'demo-base-model'
    });

    // Demo training materials
    setUploadedMaterials([
      {
        id: 'mat-1',
        PLATFORM_ID: PLATFORM_ID,
        filename: 'Platform Features Overview.pdf',
        name: 'Platform Features Overview.pdf',
        type: 'document',
        size: '2.3 MB',
        uploadedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        status: 'processed',
        keyPoints: [
          'Golden Master Architecture',
          'Custom CRM Builder',
          'AI Training Center',
          'Workflow Automation',
          'E-commerce Integration'
        ]
      },
      {
        id: 'mat-2',
        PLATFORM_ID: PLATFORM_ID,
        filename: 'Pricing & ROI Calculator',
        name: 'Pricing & ROI Calculator',
        type: 'spreadsheet',
        size: '1.1 MB',
        uploadedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        status: 'processed',
        keyPoints: [
          '480% average ROI',
          'Replaces 3-5 sales reps',
          'Break-even in 3 months',
          'Cost comparison vs Salesforce'
        ]
      },
      {
        id: 'mat-3',
        PLATFORM_ID: PLATFORM_ID,
        filename: 'Case Studies - TechStart & GrowthCo',
        name: 'Case Studies - TechStart & GrowthCo',
        type: 'document',
        size: '3.5 MB',
        uploadedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        status: 'processed',
        keyPoints: [
          'TechStart: 12 deals in first month',
          'GrowthCo: 620% ROI',
          'Both broke even in < 3 weeks'
        ]
      },
      {
        id: 'mat-4',
        PLATFORM_ID: PLATFORM_ID,
        filename: 'Competitor Battle Cards',
        name: 'Competitor Battle Cards',
        type: 'document',
        size: '1.8 MB',
        uploadedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        status: 'processed',
        keyPoints: [
          'vs Salesforce: AI-first vs data-first',
          'vs HubSpot: Real AI vs chatbots',
          'vs Pipedrive: Automation vs manual'
        ]
      }
    ]);

    // Demo training history
    setTrainingHistory([
      {
        id: 'session-1',
        topic: 'Pricing objection - "Too expensive"',
        messagesCount: 12,
        score: 88,
        feedback: 'Excellent ROI breakdown. Could mention case studies earlier.',
        timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
      },
      {
        id: 'session-2',
        topic: 'vs Salesforce comparison',
        messagesCount: 15,
        score: 92,
        feedback: 'Perfect competitive positioning. Great use of "complement not compete" angle.',
        timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      },
      {
        id: 'session-3',
        topic: 'Demo request - first time prospect',
        messagesCount: 8,
        score: 85,
        feedback: 'Good enthusiasm. Remember to qualify budget before demo.',
        timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
      },
      {
        id: 'session-4',
        topic: 'Technical deep dive - Golden Master architecture',
        messagesCount: 18,
        score: 78,
        feedback: 'Good technical accuracy. Simplify the explanation for non-technical buyers.',
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      },
      {
        id: 'session-5',
        topic: 'ROI justification for CFO',
        messagesCount: 14,
        score: 90,
        feedback: 'Excellent financial focus. Great use of specific numbers and payback period.',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      },
      {
        id: 'session-6',
        topic: 'Implementation timeline concerns',
        messagesCount: 10,
        score: 82,
        feedback: 'Good reassurance. Mention the 2-week average more prominently.',
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      }
    ]);

    setOverallScore(85.8);

    logger.info('✅ Demo data loaded for platform sales agent', { file: 'page.tsx' });
  }, []);

  // Keep loadDemoDataRef in sync so loadTrainingData can call it without a forward-reference dep
  useEffect(() => {
    loadDemoDataRef.current = loadDemoData;
  }, [loadDemoData]);

  const handleDeployGoldenMaster = async (gmId: string, version: string | number) => {
    const confirmed = await confirmDialog({
      title: 'Deploy Golden Master',
      description: `Deploy Golden Master ${version} to production? This will make it the active version used by all customers.`,
      variant: 'destructive',
    });

    if (!confirmed) {
      return;
    }

    try {
      const { deployGoldenMaster } = await import('@/lib/agent/golden-master-builder');

      await deployGoldenMaster(gmId);

      toast.success(`Golden Master ${version} is now LIVE! All customer conversations will now use this version of your AI agent.`);

      await loadTrainingData();

    } catch (error) {
      logger.error('Error deploying Golden Master:', error instanceof Error ? error : undefined, { file: 'page.tsx' });
      toast.error('Failed to deploy Golden Master. Please try again.');
    }
  };

  const primaryColor = theme?.colors?.primary?.main || 'var(--color-primary)';

  // Loading state
  if (loading || firebaseConfigured === null) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem' }}>
          <p style={{ color: 'var(--color-text-secondary)' }}>Loading training center...</p>
        </div>
    );
  }

  // Firebase not configured state
  if (firebaseConfigured === false) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem' }}>
          <div style={{ textAlign: 'center', maxWidth: '700px', padding: '2rem' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🔥</div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--color-text-primary)' }}>
              Firebase Not Configured
            </h1>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1rem', lineHeight: '1.6' }}>
              The AI Agent Training Center requires Firebase to store your training data, conversations, and agent configurations.
            </p>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '2rem', lineHeight: '1.6' }}>
              Please set up Firebase to use this feature. This takes about 5 minutes.
            </p>
            <div style={{ padding: '1.5rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', textAlign: 'left', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '1rem' }}>Quick Setup Steps:</h2>
              <ol style={{ color: 'var(--color-text-secondary)', marginLeft: '1.5rem', lineHeight: '1.8' }}>
                <li>Create a Firebase project at <a href="https://console.firebase.google.com" target="_blank" style={{ color: primaryColor }}>console.firebase.google.com</a></li>
                <li>Enable Firestore Database and Authentication</li>
                <li>Copy your Firebase config from Project Settings</li>
                <li>Create a <code style={{ backgroundColor: 'var(--color-bg-main)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>.env.local</code> file in your project root</li>
                <li>Add your Firebase credentials (see FIREBASE_SETUP.md)</li>
                <li>Restart the development server</li>
              </ol>
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <a
                href="https://console.firebase.google.com"
                target="_blank"
                style={{
                  display: 'inline-block',
                  padding: '0.75rem 1.5rem',
                  backgroundColor: primaryColor,
                  color: 'var(--color-text-primary)',
                  borderRadius: '0.5rem',
                  textDecoration: 'none',
                  fontWeight: '600',
                }}
              >
                Set Up Firebase
              </a>
              <a
                href="/FIREBASE_SETUP.md"
                target="_blank"
                style={{
                  display: 'inline-block',
                  padding: '0.75rem 1.5rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  color: 'var(--color-text-primary)',
                  borderRadius: '0.5rem',
                  textDecoration: 'none',
                  fontWeight: '600',
                  border: '1px solid var(--color-border-strong)',
                }}
              >
                View Setup Guide
              </a>
            </div>
          </div>
        </div>
    );
  }

  if (!baseModel) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem' }}>
          <div style={{ textAlign: 'center', maxWidth: '600px', padding: '2rem' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--color-text-primary)' }}>
              No Base Model Found
            </h1>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '2rem' }}>
              Please complete onboarding first to create your Base Model, then you can start training your AI agent.
            </p>
            <a
              href={`/onboarding`}
              style={{
                display: 'inline-block',
                padding: '0.75rem 1.5rem',
                backgroundColor: primaryColor,
                color: 'var(--color-text-primary)',
                borderRadius: '0.5rem',
                textDecoration: 'none',
                fontWeight: '600',
              }}
            >
              Go to Onboarding
            </a>
          </div>
        </div>
    );
  }

  const suggestedTopics = [
    'Product knowledge & recommendations',
    'Price objections & value justification',
    'Competitor comparisons',
    'Return policy & guarantees',
    'Technical specifications',
    'Bulk orders & volume pricing',
    'Urgent needs & timeframes',
    'Escalation scenarios',
  ];

  const trainingHubItems = [
    { label: 'Training Center', href: '/settings/ai-agents/training' },
    { label: 'Persona', href: '/settings/ai-agents/persona' },
    { label: 'Voice & Speech', href: '/settings/ai-agents/voice' },
    { label: 'Voice AI Lab', href: '/voice/training' },
    { label: 'Social AI Lab', href: '/social/training' },
    { label: 'SEO AI Lab', href: '/seo/training' },
  ];

  return (
    <div className="flex flex-col min-h-0 h-full">
      <SubpageNav items={AI_WORKFORCE_TABS} />
      {/* Header */}
      <div className="p-8 border-b border-border">
        <div>
          <PageTitle>🎓 AI Agent Training Center</PageTitle>
          <SectionDescription className="mt-1 mb-4">
            Monitor performance, review coaching insights, approve improvements, and train your AI agents
          </SectionDescription>
          <SubpageNav items={trainingHubItems} />

          {/* View Mode Toggle */}
          <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.5rem', marginBottom: '0.75rem', backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.5rem', padding: '0.25rem', width: 'fit-content', border: '1px solid var(--color-border-light)' }}>
            {([
              { key: 'customer' as const, label: 'Customer Agents' },
              { key: 'swarm' as const, label: 'Swarm Specialists' },
            ]).map(mode => (
              <button
                key={mode.key}
                onClick={() => { setViewMode(mode.key); setActiveTab('performance'); }}
                style={{
                  padding: '0.375rem 1rem',
                  borderRadius: '0.375rem',
                  border: 'none',
                  backgroundColor: viewMode === mode.key ? primaryColor : 'transparent',
                  color: viewMode === mode.key ? 'white' : 'var(--color-text-secondary)',
                  fontSize: '0.8125rem',
                  fontWeight: viewMode === mode.key ? '600' : '400',
                  cursor: 'pointer',
                }}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {/* Agent Type Selector (customer mode) */}
          {viewMode === 'customer' && (
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            {SELECTABLE_AGENT_DOMAINS.map(type => (
              <button
                key={type}
                onClick={() => setSelectedAgentType(type)}
                style={{
                  padding: '0.375rem 1rem',
                  borderRadius: '9999px',
                  border: selectedAgentType === type ? `2px solid ${primaryColor}` : '1px solid var(--color-border-strong)',
                  backgroundColor: selectedAgentType === type ? primaryColor : 'transparent',
                  color: selectedAgentType === type ? 'white' : 'var(--color-text-secondary)',
                  fontSize: '0.8125rem',
                  fontWeight: selectedAgentType === type ? '600' : '400',
                  cursor: 'pointer',
                }}
              >
                {AGENT_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
          )}

          {/* Specialist Selector (swarm mode) */}
          {viewMode === 'swarm' && (
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
            <label style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', fontWeight: '500' }}>Specialist:</label>
            <select
              value={selectedSpecialistId}
              onChange={(e) => setSelectedSpecialistId(e.target.value)}
              style={{
                padding: '0.375rem 0.75rem',
                borderRadius: '0.375rem',
                border: '1px solid var(--color-border-strong)',
                backgroundColor: 'var(--color-bg-main)',
                color: 'var(--color-text-primary)',
                fontSize: '0.8125rem',
                minWidth: '220px',
              }}
            >
              {swarmSpecialists.length === 0 && <option value="">No specialists found</option>}
              {swarmSpecialists.map(s => (
                <option key={s.agentId} value={s.agentId}>{s.agentId}</option>
              ))}
            </select>
          </div>
          )}
          
          {/* Status Cards (customer mode only) */}
          {viewMode === 'customer' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
            <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-light)', borderRadius: '0.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Base Model Status</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: baseModel.status === 'ready' ? 'var(--color-success)' : 'var(--color-warning-light)' }}>
                {baseModel.status === 'draft' ? '📝 Draft' : baseModel.status === 'training' ? '🔄 Training' : '✅ Ready'}
              </div>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-light)', borderRadius: '0.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Overall Training Score</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: overallScore >= 80 ? 'var(--color-success)' : overallScore >= 60 ? 'var(--color-warning-light)' : 'var(--color-error)' }}>
                {overallScore}%
              </div>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-light)', borderRadius: '0.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Training Sessions</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                {baseModel.trainingScenarios?.length ?? 0}
              </div>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-light)', borderRadius: '0.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Golden Masters</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                {goldenMasters.length}
                {activeGoldenMaster && (
                  <span style={{ fontSize: '0.875rem', marginLeft: '0.5rem', color: 'var(--color-success)' }}>
                    ({activeGoldenMaster.version} active)
                  </span>
                )}
              </div>
            </div>
          </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid var(--color-border-light)', backgroundColor: 'var(--color-bg-main)' }}>
        <div style={{ padding: '0 2rem', display: 'flex', gap: '1.5rem', overflowX: 'auto' }}>
          {(viewMode === 'customer'
            ? [
                { key: 'performance' as const, label: 'Performance' },
                { key: 'improvements' as const, label: 'Improvements' },
                { key: 'review' as const, label: 'Review Queue' },
                { key: 'chat' as const, label: 'Training Chat' },
                { key: 'materials' as const, label: 'Materials' },
                { key: 'history' as const, label: 'History' },
                { key: 'golden' as const, label: 'Golden Masters' },
              ]
            : [
                { key: 'performance' as const, label: 'Performance' },
                { key: 'improvements' as const, label: 'Improvements' },
                { key: 'golden' as const, label: 'GM Versions' },
              ]
          ).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '0.75rem 0',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.key ? `2px solid ${primaryColor}` : '2px solid transparent',
                color: activeTab === tab.key ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                fontWeight: activeTab === tab.key ? '600' : '400',
                cursor: 'pointer',
                fontSize: '0.8125rem',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        <div>

          {activeTab === 'performance' && viewMode === 'customer' && (
            <PerformanceTab agentType={selectedAgentType} authFetch={authFetch} />
          )}

          {activeTab === 'performance' && viewMode === 'swarm' && (
            <SwarmPerformanceTab specialistId={selectedSpecialistId} authFetch={authFetch} />
          )}

          {activeTab === 'improvements' && viewMode === 'customer' && (
            <ImprovementsTab agentType={selectedAgentType} authFetch={authFetch} />
          )}

          {activeTab === 'improvements' && viewMode === 'swarm' && (
            <SwarmImprovementsTab specialistId={selectedSpecialistId} authFetch={authFetch} />
          )}

          {activeTab === 'chat' && (
            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 320px', gap: '2rem' }}>
              {/* Column 1: Training Topics Sidebar */}
              <div>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                    Training Topic
                  </label>
                  <input
                    type="text"
                    value={trainingTopic}
                    onChange={(e) => setTrainingTopic(e.target.value)}
                    placeholder="e.g., Price Objections"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      backgroundColor: 'var(--color-bg-paper)',
                      border: '1px solid var(--color-border-strong)',
                      borderRadius: '0.5rem',
                      color: 'var(--color-text-primary)',
                      fontSize: '1rem',
                    }}
                  />
                </div>
                
                <div>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: 'bold', color: 'var(--color-text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
                    Suggested Topics
                  </h3>
                  {suggestedTopics.map((topic, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleStartNewSession(topic)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '0.75rem',
                        marginBottom: '0.5rem',
                        backgroundColor: 'var(--color-bg-paper)',
                        border: '1px solid var(--color-border-strong)',
                        borderRadius: '0.5rem',
                        color: 'var(--color-text-primary)',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                      }}
                    >
                      {topic}
                    </button>
                  ))}
                </div>
                
                <button
                  onClick={() => handleStartNewSession()}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    marginTop: '1rem',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--color-border-strong)',
                    borderRadius: '0.5rem',
                    color: 'var(--color-text-secondary)',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                  }}
                >
                  🔄 New Session
                </button>
              </div>

              {/* Chat Area */}
              <div style={{ display: 'flex', flexDirection: 'column', height: '600px', backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-light)', borderRadius: '0.5rem' }}>
                {/* Messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
                  {chatMessages.length === 0 && (
                    <div style={{ textAlign: 'center', paddingTop: '3rem' }}>
                      <p style={{ color: 'var(--color-text-disabled)', marginBottom: '1rem' }}>
                        {trainingTopic ? `Start training on: ${trainingTopic}` : 'Select a topic or enter a custom topic to begin training'}
                      </p>
                      <p style={{ fontSize: '0.875rem', color: 'var(--color-text-disabled)' }}>
                        Have a conversation with your AI agent, then provide feedback on its responses
                      </p>
                    </div>
                  )}
                  
                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      style={{
                        marginBottom: '1.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <div
                        style={{
                          maxWidth: '70%',
                          padding: '0.75rem 1rem',
                          backgroundColor: msg.role === 'user' ? primaryColor : 'var(--color-bg-paper)',
                          color: 'var(--color-text-primary)',
                          borderRadius: '0.75rem',
                          fontSize: '0.875rem',
                          lineHeight: '1.5',
                        }}
                      >
                        {msg.content}
                      </div>
                      
                      {msg.canGiveFeedback && msg.role === 'agent' && (
                        <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                          <button
                            onClick={() => handleGiveFeedback(msg.id)}
                            disabled={msg.hasFeedback}
                            style={{
                              padding: '0.25rem 0.75rem',
                              backgroundColor: msg.hasFeedback ? 'var(--color-bg-main)' : 'var(--color-bg-paper)',
                              border: '1px solid var(--color-border-strong)',
                              borderRadius: '0.25rem',
                              color: msg.hasFeedback ? 'var(--color-text-disabled)' : 'var(--color-text-secondary)',
                              cursor: msg.hasFeedback ? 'not-allowed' : 'pointer',
                              fontSize: '0.75rem',
                            }}
                          >
                            {msg.hasFeedback ? (
                              msg.feedbackType === 'correct' ? '✅ Good' : msg.feedbackType === 'could-improve' ? '⚠️ Could improve' : '❌ Incorrect'
                            ) : (
                              '💬 Give Feedback'
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {isTyping && (
                    <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start' }}>
                      <div style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.75rem' }}>
                        <span style={{ color: 'var(--color-text-secondary)' }}>Typing...</span>
                      </div>
                    </div>
                  )}
                  
                  <div ref={chatEndRef} />
                </div>

                {/* Input */}
                <div style={{ padding: '1rem', borderTop: '1px solid var(--color-border-light)' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          void handleSendMessage();
                        }
                      }}
                      placeholder="Type your message as a customer..."
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        backgroundColor: 'var(--color-bg-paper)',
                        border: '1px solid var(--color-border-strong)',
                        borderRadius: '0.5rem',
                        color: 'var(--color-text-primary)',
                        fontSize: '0.875rem',
                      }}
                    />
                    <button
                      onClick={() => void handleSendMessage()}
                      disabled={!userInput.trim() || isTyping}
                      style={{
                        padding: '0.75rem 1.5rem',
                        backgroundColor: !userInput.trim() || isTyping ? 'var(--color-border-strong)' : primaryColor,
                        color: 'var(--color-text-primary)',
                        border: 'none',
                        borderRadius: '0.5rem',
                        cursor: !userInput.trim() || isTyping ? 'not-allowed' : 'pointer',
                        fontWeight: '600',
                      }}
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Column 3: Sales Criteria Scoring Panel */}
              <div style={{
                backgroundColor: 'var(--color-bg-main)',
                border: '1px solid var(--color-border-light)',
                borderRadius: '0.75rem',
                padding: '1.5rem',
                height: 'fit-content',
                position: 'sticky',
                top: '2rem'
              }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                      📊 Sales Criteria Scoring
                    </h3>
                    <button
                      onClick={() => setShowCriteriaEditor(!showCriteriaEditor)}
                      style={{
                        padding: '0.25rem 0.5rem',
                        backgroundColor: 'transparent',
                        border: '1px solid var(--color-border-strong)',
                        borderRadius: '0.375rem',
                        color: 'var(--color-text-secondary)',
                        fontSize: '0.75rem',
                        cursor: 'pointer'
                      }}
                    >
                      ⚙️ Customize
                    </button>
                  </div>
                  
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-text-disabled)', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                    Rate each criterion AND explain why. The AI learns from your explanations, not just numbers.
                  </p>

                  {/* Criteria Customization Panel - Hidden until fully implemented */}
                  {/* Removed "coming soon" custom criteria editor to avoid confusion in production */}
                  {/* The default 6 criteria are sufficient for now */}
                  {/* Can be added back when custom criteria functionality is fully implemented */}

                  {/* Score Sliders */}
                  <div style={{ marginBottom: '1.5rem', maxHeight: '500px', overflowY: 'auto' }}>
                    {customCriteria.map(({ key, label, icon }) => (
                      <div key={key} style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.5rem', border: '1px solid var(--color-border-strong)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <label style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>
                            {icon} {label}
                          </label>
                          <span style={{ 
                            fontSize: '0.875rem', 
                            fontWeight: 'bold',
                            color: salesCriteria[key as keyof typeof salesCriteria] >= 8 ? 'var(--color-success)' : 
                                   salesCriteria[key as keyof typeof salesCriteria] >= 6 ? 'var(--color-warning-light)' : 'var(--color-error)'
                          }}>
                            {salesCriteria[key as keyof typeof salesCriteria]}/10
                          </span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="10"
                          value={salesCriteria[key as keyof typeof salesCriteria]}
                          onChange={(e) => setSalesCriteria(prev => ({ 
                            ...prev, 
                            [key]: parseInt(e.target.value) 
                          }))}
                          style={{
                            width: '100%',
                            height: '6px',
                            borderRadius: '3px',
                            background: `linear-gradient(to right, ${primaryColor} 0%, ${primaryColor} ${salesCriteria[key as keyof typeof salesCriteria] * 10}%, var(--color-bg-paper) ${salesCriteria[key as keyof typeof salesCriteria] * 10}%, var(--color-bg-paper) 100%)`,
                            outline: 'none',
                            cursor: 'pointer',
                            marginBottom: '0.75rem'
                          }}
                        />
                        <textarea
                          value={criteriaExplanations[key as keyof typeof criteriaExplanations]}
                          onChange={(e) => setCriteriaExplanations(prev => ({ 
                            ...prev, 
                            [key]: e.target.value 
                          }))}
                          placeholder={`Why this score? What did the agent do well or poorly? Be specific...`}
                          style={{
                            width: '100%',
                            minHeight: '60px',
                            padding: '0.5rem',
                            backgroundColor: 'var(--color-bg-main)',
                            border: '1px solid var(--color-border-strong)',
                            borderRadius: '0.375rem',
                            color: 'var(--color-text-primary)',
                            fontSize: '0.75rem',
                            resize: 'vertical',
                            fontFamily: 'inherit'
                          }}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Overall Score */}
                  <div style={{
                    padding: '1rem',
                    backgroundColor: 'var(--color-bg-paper)',
                    border: '1px solid var(--color-border-strong)',
                    borderRadius: '0.5rem',
                    marginBottom: '1.5rem'
                  }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginBottom: '0.25rem', textTransform: 'uppercase' }}>
                      Overall Session Score
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-success)' }}>
                      {Math.round((Object.values(salesCriteria).reduce((sum, score) => sum + score, 0) / customCriteria.length) * 10)}/100
                    </div>
                  </div>

                  {/* Session Notes */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--color-text-secondary)' }}>
                      Session Notes
                    </label>
                    <textarea
                      value={sessionNotes}
                      onChange={(e) => setSessionNotes(e.target.value)}
                      placeholder="What went well? What needs improvement?"
                      rows={4}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        backgroundColor: 'var(--color-bg-paper)',
                        border: '1px solid var(--color-border-strong)',
                        borderRadius: '0.5rem',
                        color: 'var(--color-text-primary)',
                        fontSize: '0.875rem',
                        resize: 'vertical',
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={() => void submitSalesCriteriaScoring()}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      backgroundColor: primaryColor,
                      color: 'var(--color-text-primary)',
                      border: 'none',
                      borderRadius: '0.5rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      fontSize: '0.875rem'
                    }}
                  >
                    💾 Save Session Score
                  </button>
              </div>
            </div>
          )}

          {activeTab === 'materials' && (
            <div>
              <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--color-text-primary)' }}>
                    Training Materials
                  </h2>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                    Upload sales training documents (PDFs, Word docs, text files) to enhance your agent&apos;s knowledge
                  </p>
                </div>
                
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: isUploading ? 'var(--color-border-strong)' : primaryColor,
                    color: 'var(--color-text-primary)',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: isUploading ? 'not-allowed' : 'pointer',
                    fontWeight: '600',
                  }}
                >
                  {isUploading ? 'Uploading...' : '📤 Upload Materials'}
                </button>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={(e) => void handleUploadMaterial(e)}
                  style={{ display: 'none' }}
                />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                {uploadedMaterials.length === 0 && (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--color-text-disabled)' }}>
                    <p>No training materials uploaded yet.</p>
                    <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                      Upload PDFs like the NEPQ Black Book of Sales, product guides, or sales scripts
                    </p>
                  </div>
                )}
                
                {uploadedMaterials.map((material, idx: number) => (
                  <div
                    key={material.id ?? idx}
                    style={{
                      padding: '1.5rem',
                      backgroundColor: 'var(--color-bg-main)',
                      border: '1px solid var(--color-border-light)',
                      borderRadius: '0.5rem',
                    }}
                  >
                    <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📄</div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--color-text-primary)' }}>
                      {material.filename}
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginBottom: '0.5rem' }}>
                      Uploaded: {new Date(material.uploadedAt).toLocaleDateString()}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>
                      Size: {typeof material.size === 'number' ? Math.round(material.size / 1024) : material.size} {typeof material.size === 'number' ? 'KB' : ''}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: 'var(--color-text-primary)' }}>
                Training History
              </h2>
              
              {trainingHistory.length === 0 && (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-disabled)' }}>
                  No training sessions yet. Start a conversation in the Training Chat tab.
                </div>
              )}
              
              <div style={{ display: 'grid', gap: '1rem' }}>
                {trainingHistory.map((session, idx: number) => (
                  <div
                    key={session.id ?? idx}
                    style={{
                      padding: '1.5rem',
                      backgroundColor: 'var(--color-bg-main)',
                      border: '1px solid var(--color-border-light)',
                      borderRadius: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                        {session.topic}
                      </h3>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>
                        {new Date(session.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                      {session.messageCount ?? session.messagesCount ?? 0} messages exchanged
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'golden' && viewMode === 'swarm' && (
            <SwarmGMVersionsTab specialistId={selectedSpecialistId} authFetch={authFetch} primaryColor={primaryColor} />
          )}

          {activeTab === 'golden' && viewMode === 'customer' && (
            <div>
              <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--color-text-primary)' }}>
                    Golden Masters
                  </h2>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                    Production-ready snapshots of your trained AI agent
                  </p>
                </div>
                
                <button
                  onClick={() => void handleSaveGoldenMaster()}
                  disabled={baseModel?.status !== 'ready' || overallScore < 80}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: (baseModel?.status === 'ready' && overallScore >= 80) ? 'var(--color-success)' : 'var(--color-border-strong)',
                    color: 'var(--color-text-primary)',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: (baseModel?.status === 'ready' && overallScore >= 80) ? 'pointer' : 'not-allowed',
                    fontWeight: '600',
                  }}
                >
                  💾 Save Golden Master
                </button>
              </div>

              {baseModel && baseModel.status !== 'ready' && (
                <div style={{ padding: '1rem', backgroundColor: 'var(--color-warning-dark)', border: '1px solid var(--color-warning-dark)', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-warning-light)' }}>
                    ⚠️ Base Model is not ready yet. Status: <strong>{baseModel.status}</strong>. Continue training to reach &quot;ready&quot; status.
                  </p>
                </div>
              )}
              
              {overallScore < 80 && (
                <div style={{ padding: '1rem', backgroundColor: 'var(--color-warning-dark)', border: '1px solid var(--color-warning-dark)', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-warning-light)' }}>
                    ⚠️ Training score is below 80%. Current score: <strong>{overallScore}%</strong>. Continue training to improve.
                  </p>
                </div>
              )}
              
              <div style={{ display: 'grid', gap: '1rem' }}>
                {goldenMasters.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-disabled)' }}>
                    <p>No Golden Masters saved yet.</p>
                    <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                      Train your Base Model to 80%+ score, then save your first Golden Master
                    </p>
                  </div>
                )}
                
                {goldenMasters.map((gm) => (
                  <div
                    key={gm.id}
                    style={{
                      padding: '1.5rem',
                      backgroundColor: 'var(--color-bg-main)',
                      border: gm.isActive ? `2px solid ${primaryColor}` : '1px solid var(--color-border-light)',
                      borderRadius: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                      <div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                          {gm.version}
                          {gm.isActive && <span style={{ marginLeft: '0.75rem', fontSize: '0.75rem', color: 'var(--color-success)', backgroundColor: 'var(--color-success-dark)', padding: '0.25rem 0.75rem', borderRadius: '1rem' }}>LIVE</span>}
                        </h3>
                        {gm.createdAt && (
                          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                            Created: {new Date(gm.createdAt).toLocaleString()}
                          </p>
                        )}
                        {gm.deployedAt && (
                          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                            Deployed: {new Date(gm.deployedAt).toLocaleString()}
                          </p>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {!gm.isActive && (
                          <button
                            onClick={() => void handleDeployGoldenMaster(gm.id, gm.version)}
                            style={{
                              padding: '0.5rem 1rem',
                              backgroundColor: primaryColor,
                              color: 'var(--color-text-primary)',
                              border: 'none',
                              borderRadius: '0.25rem',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              fontWeight: '600',
                            }}
                          >
                            🚀 Deploy
                          </button>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginTop: '1rem' }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginBottom: '0.25rem' }}>Training Score</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-success)' }}>{gm.trainingScore}%</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginBottom: '0.25rem' }}>Scenarios Trained</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>{gm.trainedScenarios?.length ?? 0}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginBottom: '0.25rem' }}>Base Model</div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>{gm.baseModelId.substring(0, 12)}...</div>
                      </div>
                    </div>

                    {gm.notes && (
                      <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.25rem' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginBottom: '0.25rem' }}>Notes</div>
                        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>{gm.notes}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'review' && (
            <ReviewQueueTab agentTypeFilter={selectedAgentType} />
          )}

        </div>
      </div>

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
            zIndex: 1000,
          }}
          onClick={() => setFeedbackMode(false)}
        >
          <div
            style={{
              width: '90%',
              maxWidth: '600px',
              backgroundColor: 'var(--color-bg-main)',
              border: '1px solid var(--color-border-strong)',
              borderRadius: '0.75rem',
              padding: '2rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: 'var(--color-text-primary)' }}>
              Provide Feedback on Agent Response
            </h2>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                How was this response?
              </label>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {([
                  { value: 'correct' as const, label: '✅ Correct', color: 'var(--color-success)' },
                  { value: 'could-improve' as const, label: '⚠️ Could Improve', color: 'var(--color-warning-light)' },
                  { value: 'incorrect' as const, label: '❌ Incorrect', color: 'var(--color-error)' },
                ]).map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setFeedbackType(option.value)}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      backgroundColor: feedbackType === option.value ? option.color : 'var(--color-bg-paper)',
                      border: feedbackType === option.value ? `2px solid ${option.color}` : '1px solid var(--color-border-strong)',
                      borderRadius: '0.5rem',
                      color: 'var(--color-text-primary)',
                      cursor: 'pointer',
                      fontWeight: feedbackType === option.value ? '600' : '400',
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                Why? (Required) *
              </label>
              <textarea
                value={feedbackWhy}
                onChange={(e) => setFeedbackWhy(e.target.value)}
                rows={4}
                placeholder="Explain why this response is correct/incorrect/could improve. This helps the AI learn the reasoning behind good sales techniques."
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>
            
            {feedbackType !== 'correct' && (
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: '600' }}>
                  Better Response or Guidance *
                </label>
                <textarea
                  value={betterResponse}
                  onChange={(e) => setBetterResponse(e.target.value)}
                  rows={4}
                  placeholder="Show a better way to respond, or explain what should be different..."
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    backgroundColor: 'var(--color-bg-paper)',
                    border: '1px solid var(--color-border-strong)',
                    borderRadius: '0.5rem',
                    color: 'var(--color-text-primary)',
                    fontSize: '0.875rem',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                  }}
                />
              </div>
            )}
            
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setFeedbackMode(false)}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  fontWeight: '600',
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
                  color: 'var(--color-text-primary)',
                  cursor: 'pointer',
                  fontWeight: '600',
                }}
              >
                Submit Feedback
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// PERFORMANCE TAB COMPONENT
// ============================================================================

interface AnalysisInsights {
  weaknessCount: number;
  recommendationCount: number;
  trainingCount: number;
  riskCount: number;
  confidenceScore: number;
  strengths?: Array<{
    category: string;
    title: string;
    description: string;
    metrics: Array<{ metric: string; value: number; benchmark: number }>;
    leverageStrategy: string;
    impact: string;
  }>;
  weaknesses?: Array<{
    category: string;
    title: string;
    description: string;
    metrics: Array<{ metric: string; value: number; benchmark: number; gap: number }>;
    rootCauses: string[];
    impact: string;
    urgency: string;
  }>;
  recommendations?: Array<{
    id: string;
    title: string;
    recommendation: string;
    category: string;
    rationale: string;
    actions: Array<{ action: string; timeline: string; owner: string }>;
    successCriteria: string[];
    expectedOutcomes: Array<{ metric: string; baseline: number; target: number; timeframe: string }>;
    priority: string;
    effort: string;
    confidence: number;
  }>;
  training?: Array<{
    title: string;
    description: string;
    category: string;
    type: string;
    resources: Array<{ name: string; type: string; url?: string; duration?: string }>;
    skillImprovement: Array<{ skill: string; currentLevel: number; targetLevel: number }>;
    priority: string;
  }>;
  risks?: Array<{
    title: string;
    description: string;
    category: string;
    severity: string;
    likelihood: string;
    indicators: string[];
    mitigationStrategies: string[];
  }>;
  performanceSummary?: {
    assessment: string;
    currentTier: string;
    trend: string;
    focusAreas: string[];
  };
}

interface AnalysisResult {
  success: boolean;
  agentId: string;
  agentType: string;
  performance: { overallScore: number; tier: string; period: string; trend: string };
  insights: AnalysisInsights;
  training: { improvementCount: number; updateRequestId: string | null; updateRequestStatus: string | null };
}

function PerformanceTab({ agentType, authFetch }: { agentType: AgentDomain; authFetch: (url: string, options?: RequestInit) => Promise<Response> }) {
  const [agentData, setAgentData] = useState<{
    agent: { agentId: string; agentType: string; agentName: string; goldenMasterId: string | null; thresholds: { flagForTrainingBelow: number; excellentAbove: number } };
    performance: { agentId: string; totalExecutions: number; successRate: number; averageQualityScore: number; qualityTrend: string } | null;
    flaggedSessionCount: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load agent data for the selected type
  useEffect(() => {
    void (async () => {
      setLoading(true);
      setAnalysis(null);
      try {
        const res = await authFetch('/api/agent-performance');
        const data = await res.json() as {
          success: boolean;
          agents?: Array<{
            agent: { agentId: string; agentType: string; agentName: string; goldenMasterId: string | null; thresholds: { flagForTrainingBelow: number; excellentAbove: number } };
            performance: { agentId: string; totalExecutions: number; successRate: number; averageQualityScore: number; qualityTrend: string } | null;
            flaggedSessionCount: number;
          }>;
        };
        if (data.success && data.agents) {
          const match = data.agents.find(a => a.agent.agentType === agentType);
          setAgentData(match ?? null);
        }
      } catch {
        setError('Failed to load agent data');
      } finally {
        setLoading(false);
      }
    })();
  }, [authFetch, agentType]);

  const runAnalysis = async () => {
    if (!agentData) { return; }
    setAnalyzing(true);
    setError(null);
    try {
      const res = await authFetch('/api/agent-performance/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: agentData.agent.agentId, period: 'last_30_days' }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Analysis failed' })) as { error?: string };
        setError(errData.error ?? `Analysis failed (${res.status})`);
        return;
      }
      const result = await res.json() as AnalysisResult;
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis request failed');
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
        <div style={{ width: '2rem', height: '2rem', border: '2px solid var(--color-border-strong)', borderTop: '2px solid var(--color-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (!agentData) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.75rem', border: '1px solid var(--color-border-main)' }}>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '1rem', marginBottom: '0.5rem' }}>
          No agent profile found for <strong style={{ textTransform: 'capitalize' }}>{agentType}</strong>.
        </p>
        <p style={{ color: 'var(--color-text-disabled)', fontSize: '0.875rem' }}>
          Run the migration script to create agent rep profiles.
        </p>
      </div>
    );
  }

  const perf = agentData.performance;
  const ins = analysis?.insights;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Error Banner */}
      {error && (
        <div style={{ padding: '0.75rem 1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: '0.875rem', color: '#f87171' }}>{error}</p>
          <button onClick={() => setError(null)} style={{ fontSize: '0.75rem', color: '#f87171', background: 'none', border: 'none', cursor: 'pointer' }}>Dismiss</button>
        </div>
      )}

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.5rem', border: '1px solid var(--color-border-light)' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', textTransform: 'uppercase' }}>Agent</p>
          <p style={{ fontSize: '1.125rem', fontWeight: '700', color: 'var(--color-text-primary)', marginTop: '0.25rem' }}>{agentData.agent.agentName}</p>
        </div>
        <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.5rem', border: '1px solid var(--color-border-light)' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', textTransform: 'uppercase' }}>Quality Score</p>
          <p style={{ fontSize: '1.5rem', fontWeight: '700', color: perf && perf.averageQualityScore >= 80 ? 'var(--color-success)' : perf && perf.averageQualityScore >= 60 ? 'var(--color-warning-light)' : 'var(--color-error)', marginTop: '0.25rem' }}>
            {perf ? perf.averageQualityScore.toFixed(0) : '--'}
          </p>
        </div>
        <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.5rem', border: '1px solid var(--color-border-light)' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', textTransform: 'uppercase' }}>Trend</p>
          <p style={{ fontSize: '1.25rem', fontWeight: '600', color: perf?.qualityTrend === 'improving' ? 'var(--color-success)' : perf?.qualityTrend === 'declining' ? 'var(--color-error)' : 'var(--color-text-secondary)', marginTop: '0.25rem', textTransform: 'capitalize' }}>
            {perf?.qualityTrend === 'improving' ? '^ ' : perf?.qualityTrend === 'declining' ? 'v ' : ''}{perf?.qualityTrend ?? '--'}
          </p>
        </div>
        <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.5rem', border: '1px solid var(--color-border-light)' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', textTransform: 'uppercase' }}>Executions</p>
          <p style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-text-primary)', marginTop: '0.25rem' }}>{perf?.totalExecutions ?? 0}</p>
        </div>
        <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.5rem', border: '1px solid var(--color-border-light)' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', textTransform: 'uppercase' }}>Flagged</p>
          <p style={{ fontSize: '1.5rem', fontWeight: '700', color: agentData.flaggedSessionCount > 0 ? 'var(--color-warning-light)' : 'var(--color-text-primary)', marginTop: '0.25rem' }}>{agentData.flaggedSessionCount}</p>
        </div>
      </div>

      {/* Run Analysis Button */}
      {!analysis && (
        <div style={{ padding: '2rem', backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.75rem', border: '1px solid var(--color-border-main)', textAlign: 'center' }}>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
            Run coaching analysis to identify strengths, weaknesses, and generate improvement recommendations.
          </p>
          <button
            onClick={() => void runAnalysis()}
            disabled={analyzing}
            style={{
              padding: '0.75rem 2rem',
              backgroundColor: 'var(--color-primary)',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: analyzing ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              fontSize: '0.9375rem',
              opacity: analyzing ? 0.6 : 1,
            }}
          >
            {analyzing ? 'Analyzing...' : 'Run Coaching Analysis'}
          </button>
        </div>
      )}

      {/* Full Coaching Insights */}
      {analysis && ins && (
        <>
          {/* Performance Summary */}
          {ins.performanceSummary && (
            <div style={{ padding: '1.25rem', backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.75rem', border: '1px solid var(--color-border-main)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '0.75rem' }}>Performance Summary</h3>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', lineHeight: '1.5' }}>{ins.performanceSummary.assessment}</p>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                  Tier: <strong style={{ textTransform: 'capitalize' }}>{analysis.performance.tier.replace('_', ' ')}</strong>
                </span>
                <span style={{ fontSize: '0.8125rem', color: analysis.performance.trend === 'improving' ? 'var(--color-success)' : analysis.performance.trend === 'declining' ? 'var(--color-error)' : 'var(--color-text-secondary)' }}>
                  Trend: <strong style={{ textTransform: 'capitalize' }}>{analysis.performance.trend}</strong>
                </span>
                {ins.performanceSummary.focusAreas.length > 0 && (
                  <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                    Focus: {ins.performanceSummary.focusAreas.join(', ')}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Strengths */}
          {ins.strengths && ins.strengths.length > 0 && (
            <div style={{ padding: '1.25rem', backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.75rem', border: '1px solid var(--color-border-main)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--color-success)', marginBottom: '0.75rem' }}>Strengths ({ins.strengths.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {ins.strengths.map((s, i) => (
                  <div key={i} style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-main)', borderRadius: '0.5rem', border: '1px solid var(--color-border-light)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>{s.title}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', textTransform: 'capitalize' }}>{s.category.replace('_', ' ')}</span>
                    </div>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: '1.4' }}>{s.description}</p>
                    {s.leverageStrategy && (
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginTop: '0.5rem' }}>
                        Leverage: {s.leverageStrategy}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weaknesses */}
          {ins.weaknesses && ins.weaknesses.length > 0 && (
            <div style={{ padding: '1.25rem', backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.75rem', border: '1px solid var(--color-border-main)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--color-error)', marginBottom: '0.75rem' }}>Weaknesses ({ins.weaknesses.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {ins.weaknesses.map((w, i) => (
                  <div key={i} style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-main)', borderRadius: '0.5rem', border: '1px solid var(--color-border-light)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>{w.title}</span>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.6875rem', padding: '0.125rem 0.5rem', borderRadius: '0.25rem', backgroundColor: w.urgency === 'immediate' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)', color: w.urgency === 'immediate' ? '#f87171' : '#fbbf24', textTransform: 'capitalize' }}>
                          {w.urgency.replace('_', ' ')}
                        </span>
                        <span style={{ fontSize: '0.6875rem', padding: '0.125rem 0.5rem', borderRadius: '0.25rem', backgroundColor: 'var(--color-bg-paper)', color: 'var(--color-text-disabled)', textTransform: 'capitalize' }}>
                          {w.impact} impact
                        </span>
                      </div>
                    </div>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: '1.4' }}>{w.description}</p>
                    {w.rootCauses.length > 0 && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>Root causes: </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{w.rootCauses.join('; ')}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {ins.recommendations && ins.recommendations.length > 0 && (
            <div style={{ padding: '1.25rem', backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.75rem', border: '1px solid var(--color-border-main)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '0.75rem' }}>Recommendations ({ins.recommendations.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {ins.recommendations.map((r, i) => (
                  <div key={i} style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-main)', borderRadius: '0.5rem', border: '1px solid var(--color-border-light)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>{r.title}</span>
                      <span style={{ fontSize: '0.6875rem', padding: '0.125rem 0.5rem', borderRadius: '0.25rem', backgroundColor: r.priority === 'critical' ? 'rgba(239,68,68,0.15)' : r.priority === 'high' ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)', color: r.priority === 'critical' ? '#f87171' : r.priority === 'high' ? '#fbbf24' : '#60a5fa', textTransform: 'uppercase', fontWeight: '600' }}>
                        {r.priority}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: '1.4' }}>{r.recommendation}</p>
                    {r.actions.length > 0 && (
                      <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem', listStyle: 'disc' }}>
                        {r.actions.map((a, j) => (
                          <li key={j} style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                            {a.action} <span style={{ color: 'var(--color-text-disabled)' }}>({a.timeline})</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {r.successCriteria.length > 0 && (
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginTop: '0.375rem' }}>
                        Success: {r.successCriteria.join('; ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Training Suggestions */}
          {ins.training && ins.training.length > 0 && (
            <div style={{ padding: '1.25rem', backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.75rem', border: '1px solid var(--color-border-main)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '0.75rem' }}>Training Suggestions ({ins.training.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {ins.training.map((t, i) => (
                  <div key={i} style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-main)', borderRadius: '0.5rem', border: '1px solid var(--color-border-light)' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>{t.title}</span>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem', lineHeight: '1.4' }}>{t.description}</p>
                    {t.skillImprovement.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                        {t.skillImprovement.map((s, j) => (
                          <span key={j} style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>
                            {s.skill}: {s.currentLevel} &rarr; {s.targetLevel}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Risks */}
          {ins.risks && ins.risks.length > 0 && (
            <div style={{ padding: '1.25rem', backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.75rem', border: '1px solid var(--color-border-main)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--color-warning-light)', marginBottom: '0.75rem' }}>Risks ({ins.risks.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {ins.risks.map((r, i) => (
                  <div key={i} style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-main)', borderRadius: '0.5rem', border: '1px solid var(--color-border-light)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>{r.title}</span>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.6875rem', padding: '0.125rem 0.5rem', borderRadius: '0.25rem', backgroundColor: r.severity === 'critical' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)', color: r.severity === 'critical' ? '#f87171' : '#fbbf24', textTransform: 'uppercase', fontWeight: '600' }}>
                          {r.severity}
                        </span>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-disabled)', textTransform: 'capitalize' }}>
                          {r.likelihood.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: '1.4' }}>{r.description}</p>
                    {r.mitigationStrategies.length > 0 && (
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginTop: '0.375rem' }}>
                        Mitigation: {r.mitigationStrategies.join('; ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Re-analyze button */}
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={() => void runAnalysis()}
              disabled={analyzing}
              style={{
                padding: '0.5rem 1.5rem',
                backgroundColor: 'transparent',
                border: '1px solid var(--color-border-strong)',
                borderRadius: '0.5rem',
                color: 'var(--color-text-secondary)',
                cursor: analyzing ? 'not-allowed' : 'pointer',
                fontSize: '0.8125rem',
                opacity: analyzing ? 0.6 : 1,
              }}
            >
              {analyzing ? 'Re-analyzing...' : 'Re-run Analysis'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// IMPROVEMENTS TAB COMPONENT
// ============================================================================

interface GMUpdateRequest {
  id: string;
  goldenMasterId: string;
  agentType?: string;
  sourceSessionIds: string[];
  improvements: Array<{
    id: string;
    type: string;
    area: string;
    currentBehavior: string;
    suggestedBehavior: string;
    priority: number;
    estimatedImpact: number;
    confidence: number;
  }>;
  impactAnalysis: {
    expectedScoreImprovement: number;
    areasImproved: string[];
    risks: string[];
    confidence: number;
  };
  status: 'pending_review' | 'approved' | 'rejected' | 'applied';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  createdAt: string;
  appliedAt?: string;
}

function ImprovementsTab({ agentType, authFetch }: { agentType: AgentDomain; authFetch: (url: string, options?: RequestInit) => Promise<Response> }) {
  const [updates, setUpdates] = useState<GMUpdateRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchUpdates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/training/golden-master-updates?agentType=${agentType}`);
      const data = await res.json() as { success: boolean; updates?: GMUpdateRequest[] };
      if (data.success && data.updates) {
        setUpdates(data.updates);
      }
    } catch {
      setError('Failed to load improvement requests');
    } finally {
      setLoading(false);
    }
  }, [authFetch, agentType]);

  useEffect(() => {
    void fetchUpdates();
  }, [fetchUpdates]);

  const handleAction = async (updateId: string, approved: boolean) => {
    setProcessing(updateId);
    setError(null);
    try {
      const res = await authFetch('/api/training/apply-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updateRequestId: updateId, approved }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Action failed' })) as { error?: string };
        setError(errData.error ?? 'Action failed');
        return;
      }
      // Refresh list
      await fetchUpdates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
        <div style={{ width: '2rem', height: '2rem', border: '2px solid var(--color-border-strong)', borderTop: '2px solid var(--color-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  const statusColor = (status: string) => {
    switch (status) {
      case 'pending_review': return { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24' };
      case 'approved': return { bg: 'rgba(34,197,94,0.15)', text: '#4ade80' };
      case 'rejected': return { bg: 'rgba(239,68,68,0.15)', text: '#f87171' };
      case 'applied': return { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa' };
      default: return { bg: 'var(--color-bg-main)', text: 'var(--color-text-disabled)' };
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--color-text-primary)' }}>
          Improvement Requests
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
          Golden Master update requests for <strong style={{ textTransform: 'capitalize' }}>{agentType}</strong> agent. Review, approve, or reject proposed changes.
        </p>
      </div>

      {error && (
        <div style={{ padding: '0.75rem 1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '0.5rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: '0.875rem', color: '#f87171' }}>{error}</p>
          <button onClick={() => setError(null)} style={{ fontSize: '0.75rem', color: '#f87171', background: 'none', border: 'none', cursor: 'pointer' }}>Dismiss</button>
        </div>
      )}

      {updates.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.75rem', border: '1px solid var(--color-border-main)' }}>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '1rem' }}>
            No improvement requests for this agent type.
          </p>
          <p style={{ color: 'var(--color-text-disabled)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            Run a coaching analysis on the Performance tab to generate improvement suggestions.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {updates.map((update) => {
            const sc = statusColor(update.status);
            return (
              <div
                key={update.id}
                style={{
                  padding: '1.25rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  borderRadius: '0.75rem',
                  border: '1px solid var(--color-border-main)',
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                      <span style={{ fontSize: '0.6875rem', padding: '0.125rem 0.5rem', borderRadius: '0.25rem', backgroundColor: sc.bg, color: sc.text, fontWeight: '600', textTransform: 'uppercase' }}>
                        {update.status.replace('_', ' ')}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>
                        {update.sourceSessionIds.length > 0
                          ? `From ${update.sourceSessionIds.length} session(s)`
                          : 'Coaching Analysis'}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>
                      Created: {new Date(update.createdAt).toLocaleString()}
                      {update.reviewedAt && ` | Reviewed: ${new Date(update.reviewedAt).toLocaleString()}`}
                    </p>
                  </div>
                  {update.status === 'pending_review' && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => void handleAction(update.id, true)}
                        disabled={processing === update.id}
                        style={{
                          padding: '0.375rem 1rem',
                          backgroundColor: 'var(--color-success)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.375rem',
                          cursor: processing === update.id ? 'not-allowed' : 'pointer',
                          fontSize: '0.8125rem',
                          fontWeight: '600',
                          opacity: processing === update.id ? 0.6 : 1,
                        }}
                      >
                        {processing === update.id ? '...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => void handleAction(update.id, false)}
                        disabled={processing === update.id}
                        style={{
                          padding: '0.375rem 1rem',
                          backgroundColor: 'transparent',
                          color: 'var(--color-error)',
                          border: '1px solid var(--color-error)',
                          borderRadius: '0.375rem',
                          cursor: processing === update.id ? 'not-allowed' : 'pointer',
                          fontSize: '0.8125rem',
                          fontWeight: '600',
                          opacity: processing === update.id ? 0.6 : 1,
                        }}
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>

                {/* Impact Analysis */}
                <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-main)', borderRadius: '0.5rem', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.8125rem' }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>
                      Expected improvement: <strong style={{ color: 'var(--color-success)' }}>+{update.impactAnalysis.expectedScoreImprovement.toFixed(1)} pts</strong>
                    </span>
                    <span style={{ color: 'var(--color-text-secondary)' }}>
                      Confidence: <strong>{(update.impactAnalysis.confidence * 100).toFixed(0)}%</strong>
                    </span>
                    {update.impactAnalysis.areasImproved.length > 0 && (
                      <span style={{ color: 'var(--color-text-disabled)' }}>
                        Areas: {update.impactAnalysis.areasImproved.join(', ')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Improvements List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {update.improvements.map((imp) => (
                    <div key={imp.id} style={{ padding: '0.625rem', borderLeft: '3px solid var(--color-primary)', backgroundColor: 'var(--color-bg-main)', borderRadius: '0 0.375rem 0.375rem 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.8125rem', fontWeight: '600', color: 'var(--color-text-primary)', textTransform: 'capitalize' }}>
                          {imp.area.replace(/_/g, ' ')}
                        </span>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-disabled)' }}>
                          Priority: {imp.priority}/10 | Impact: {imp.estimatedImpact}/10
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                        <span style={{ color: 'var(--color-error)' }}>Current:</span> {imp.currentBehavior}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '0.125rem' }}>
                        <span style={{ color: 'var(--color-success)' }}>Suggested:</span> {imp.suggestedBehavior}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Review Notes */}
                {update.reviewNotes && (
                  <div style={{ marginTop: '0.75rem', padding: '0.625rem', backgroundColor: 'var(--color-bg-main)', borderRadius: '0.375rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>Review notes: </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{update.reviewNotes}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// REVIEW QUEUE TAB COMPONENT
// ============================================================================

interface FlaggedSessionDisplay {
  id: string;
  sessionId: string;
  agentType: string;
  score: number;
  issues: string[];
  flaggedAt: string;
  processed: boolean;
}

function ReviewQueueTab({ agentTypeFilter }: { agentTypeFilter: AgentDomain }) {
  const authFetch = useAuthFetch();
  const [sessions, setSessions] = useState<FlaggedSessionDisplay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const res = await authFetch(`/api/agent-performance/flagged-sessions?agentType=${agentTypeFilter}`);
        const data = await res.json() as { success: boolean; sessions?: FlaggedSessionDisplay[] };
        if (data.success && data.sessions) {
          setSessions(data.sessions);
        }
      } catch {
        // Non-critical
      } finally {
        setLoading(false);
      }
    })();
  }, [authFetch, agentTypeFilter]);

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--color-text-primary)' }}>
          Flagged Sessions Review Queue
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
          Production sessions for <strong style={{ textTransform: 'capitalize' }}>{agentTypeFilter}</strong> agent that scored below training thresholds
        </p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <div style={{ width: '2rem', height: '2rem', border: '2px solid var(--color-border-strong)', borderTop: '2px solid var(--color-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        </div>
      ) : sessions.length === 0 ? (
        <div style={{
          padding: '3rem',
          textAlign: 'center',
          backgroundColor: 'var(--color-bg-paper)',
          borderRadius: '0.75rem',
          border: '1px solid var(--color-border-main)',
        }}>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '1rem' }}>
            No flagged sessions. All production sessions are performing above threshold.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {sessions.map((session) => (
            <div
              key={session.id}
              style={{
                padding: '1rem',
                backgroundColor: 'var(--color-bg-paper)',
                borderRadius: '0.75rem',
                border: '1px solid var(--color-border-main)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span style={{
                      padding: '0.125rem 0.5rem',
                      backgroundColor: 'var(--color-error)',
                      color: 'white',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                    }}>
                      Score: {session.score}
                    </span>
                    <span style={{
                      padding: '0.125rem 0.5rem',
                      backgroundColor: 'var(--color-bg-main)',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                      color: 'var(--color-text-secondary)',
                    }}>
                      {session.agentType}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)', fontWeight: '500' }}>
                    Session: {session.sessionId}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginTop: '0.25rem' }}>
                    Flagged: {new Date(session.flaggedAt).toLocaleString()}
                  </p>
                </div>
              </div>
              {session.issues.length > 0 && (
                <div style={{ marginTop: '0.75rem' }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem', fontWeight: '600' }}>Issues:</p>
                  <ul style={{ listStyle: 'disc', paddingLeft: '1.25rem', margin: 0 }}>
                    {session.issues.map((issue, i) => (
                      <li key={i} style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SWARM PERFORMANCE TAB
// ============================================================================

interface SwarmPerformanceTabProps {
  specialistId: string;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

function SwarmPerformanceTab({ specialistId, authFetch }: SwarmPerformanceTabProps) {
  const [metrics, setMetrics] = useState<{
    agentId: string;
    totalExecutions: number;
    successRate: number;
    averageQualityScore: number;
    retryRate: number;
    qualityTrend: string;
    commonFailureModes: Array<{ mode: string; count: number }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!specialistId) { setLoading(false); return; }
    setLoading(true);
    void (async () => {
      try {
        const res = await authFetch(`/api/swarm/performance?period=30`);
        if (res.ok) {
          const data = await res.json() as { success: boolean; specialists?: Array<Record<string, unknown>> };
          if (data.success && data.specialists) {
            const match = data.specialists.find(s => s.agentId === specialistId);
            if (match) {
              setMetrics(match as typeof metrics);
            }
          }
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, [specialistId, authFetch]);

  if (!specialistId) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-disabled)' }}>Select a specialist to view performance.</div>;
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>Loading performance data...</div>;
  }

  if (!metrics) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-disabled)' }}>No performance data available for {specialistId}.</div>;
  }

  const trendColor = metrics.qualityTrend === 'improving' ? 'var(--color-success)' : metrics.qualityTrend === 'declining' ? 'var(--color-error)' : 'var(--color-text-secondary)';

  return (
    <div>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '1.5rem' }}>
        {specialistId} Performance
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-light)', borderRadius: '0.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Executions</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>{metrics.totalExecutions}</div>
        </div>
        <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-light)', borderRadius: '0.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Success Rate</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: metrics.successRate >= 0.8 ? 'var(--color-success)' : 'var(--color-warning-light)' }}>{(metrics.successRate * 100).toFixed(1)}%</div>
        </div>
        <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-light)', borderRadius: '0.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Quality Score</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: metrics.averageQualityScore >= 80 ? 'var(--color-success)' : 'var(--color-warning-light)' }}>{metrics.averageQualityScore.toFixed(1)}</div>
        </div>
        <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-light)', borderRadius: '0.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Trend</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: trendColor, textTransform: 'capitalize' }}>{metrics.qualityTrend}</div>
        </div>
      </div>

      {metrics.commonFailureModes.length > 0 && (
        <div style={{ backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-light)', borderRadius: '0.5rem', padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '1rem' }}>Common Failure Modes</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {metrics.commonFailureModes.map((fm, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--color-border-light)' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>{fm.mode}</span>
                <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>{fm.count}x</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SWARM IMPROVEMENTS TAB
// ============================================================================

interface SwarmImprovementsTabProps {
  specialistId: string;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

function SwarmImprovementsTab({ specialistId, authFetch }: SwarmImprovementsTabProps) {
  const [requests, setRequests] = useState<Array<{
    id: string;
    specialistId: string;
    specialistName: string;
    proposedChanges: Array<{ field: string; currentValue: unknown; proposedValue: unknown; reason: string; confidence: number }>;
    impactAnalysis: { expectedImprovement: number; areasImproved: string[]; risks: string[]; confidence: number };
    status: string;
    createdAt: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/swarm/improvement-requests');
      if (res.ok) {
        const data = await res.json() as { success: boolean; requests: typeof requests };
        if (data.success) {
          setRequests(specialistId ? data.requests.filter(r => r.specialistId === specialistId) : data.requests);
        }
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [authFetch, specialistId]);

  useEffect(() => { void loadRequests(); }, [loadRequests]);

  const handleAction = async (requestId: string, method: 'PUT' | 'POST', body: Record<string, string>) => {
    setActionLoading(requestId);
    try {
      const res = await authFetch(`/api/swarm/improvement-requests/${requestId}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await loadRequests();
      }
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  };

  if (!specialistId) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-disabled)' }}>Select a specialist to view improvements.</div>;
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>Loading improvement requests...</div>;
  }

  if (requests.length === 0) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-disabled)' }}>No improvement requests for {specialistId}.</div>;
  }

  const statusColors: Record<string, string> = {
    pending_review: 'var(--color-warning-light)',
    approved: 'var(--color-info)',
    rejected: 'var(--color-error)',
    applied: 'var(--color-success)',
  };

  return (
    <div>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '1.5rem' }}>
        Improvement Requests ({requests.length})
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {requests.map(req => (
          <div key={req.id} style={{ padding: '1.25rem', backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-light)', borderRadius: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div>
                <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>{req.specialistName}</span>
                <span style={{ marginLeft: '0.75rem', fontSize: '0.75rem', padding: '0.125rem 0.5rem', borderRadius: '9999px', backgroundColor: statusColors[req.status] ?? 'var(--color-bg-paper)', color: 'white' }}>
                  {req.status.replace('_', ' ')}
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>{new Date(req.createdAt).toLocaleDateString()}</span>
            </div>

            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: '0.75rem' }}>
              {req.proposedChanges.length} changes &middot; +{req.impactAnalysis.expectedImprovement}% expected &middot; {Math.round(req.impactAnalysis.confidence * 100)}% confidence
            </p>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {req.status === 'pending_review' && (
                <>
                  <button onClick={() => void handleAction(req.id, 'PUT', { action: 'approve' })} disabled={actionLoading === req.id}
                    style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem', fontWeight: '600', borderRadius: '0.25rem', border: 'none', backgroundColor: 'var(--color-success)', color: 'white', cursor: 'pointer', opacity: actionLoading === req.id ? 0.5 : 1 }}>
                    Approve
                  </button>
                  <button onClick={() => void handleAction(req.id, 'PUT', { action: 'reject' })} disabled={actionLoading === req.id}
                    style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem', fontWeight: '600', borderRadius: '0.25rem', border: 'none', backgroundColor: 'var(--color-error)', color: 'white', cursor: 'pointer', opacity: actionLoading === req.id ? 0.5 : 1 }}>
                    Reject
                  </button>
                </>
              )}
              {req.status === 'approved' && (
                <button onClick={() => void handleAction(req.id, 'POST', { action: 'apply' })} disabled={actionLoading === req.id}
                  style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem', fontWeight: '600', borderRadius: '0.25rem', border: 'none', backgroundColor: 'var(--color-info)', color: 'white', cursor: 'pointer', opacity: actionLoading === req.id ? 0.5 : 1 }}>
                  {actionLoading === req.id ? 'Applying...' : 'Apply Changes'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// SWARM GM VERSIONS TAB
// ============================================================================

interface SwarmGMVersionsTabProps {
  specialistId: string;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  primaryColor: string;
}

function SwarmGMVersionsTab({ specialistId, authFetch, primaryColor }: SwarmGMVersionsTabProps) {
  const [versions, setVersions] = useState<Array<{
    id: string;
    specialistId: string;
    specialistName: string;
    version: number;
    isActive: boolean;
    deployedAt?: string;
    createdAt: string;
    createdBy: string;
    sourceImprovementRequestId: string | null;
    changesApplied: Array<{ field: string; reason: string }>;
    notes?: string;
    previousVersion?: number;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const loadVersions = useCallback(async () => {
    if (!specialistId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await authFetch(`/api/swarm/golden-masters?specialistId=${encodeURIComponent(specialistId)}`);
      if (res.ok) {
        const data = await res.json() as { success: boolean; versions: typeof versions };
        if (data.success) {
          setVersions(data.versions);
        }
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [authFetch, specialistId]);

  useEffect(() => { void loadVersions(); }, [loadVersions]);

  const handleDeploy = async (version: number) => {
    setActionLoading(version);
    try {
      const res = await authFetch('/api/swarm/golden-masters', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specialistId, version }),
      });
      if (res.ok) {
        await loadVersions();
      }
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  };

  const handleSeedV1 = async () => {
    setActionLoading(0);
    try {
      const res = await authFetch('/api/swarm/golden-masters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specialistId, specialistName: specialistId }),
      });
      if (res.ok) {
        await loadVersions();
      }
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  };

  if (!specialistId) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-disabled)' }}>Select a specialist to view GM versions.</div>;
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>Loading Golden Master versions...</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '0.25rem' }}>
            Golden Master Versions
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
            Versioned config snapshots for {specialistId}
          </p>
        </div>
        {versions.length === 0 && (
          <button
            onClick={() => void handleSeedV1()}
            disabled={actionLoading === 0}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: primaryColor,
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              fontSize: '0.8125rem',
              fontWeight: '600',
              cursor: 'pointer',
              opacity: actionLoading === 0 ? 0.5 : 1,
            }}
          >
            {actionLoading === 0 ? 'Seeding...' : 'Seed v1'}
          </button>
        )}
      </div>

      {versions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-disabled)' }}>
          <p>No Golden Master versions yet.</p>
          <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Click &quot;Seed v1&quot; to snapshot the current config, or apply an improvement request.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {versions.map(gm => (
            <div
              key={gm.id}
              style={{
                padding: '1.25rem',
                backgroundColor: 'var(--color-bg-main)',
                border: gm.isActive ? `2px solid ${primaryColor}` : '1px solid var(--color-border-light)',
                borderRadius: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.125rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>v{gm.version}</span>
                  {gm.isActive && (
                    <span style={{ fontSize: '0.6875rem', fontWeight: '600', padding: '0.125rem 0.5rem', borderRadius: '9999px', backgroundColor: 'var(--color-success)', color: 'white' }}>
                      ACTIVE
                    </span>
                  )}
                </div>
                {!gm.isActive && (
                  <button
                    onClick={() => void handleDeploy(gm.version)}
                    disabled={actionLoading === gm.version}
                    style={{
                      padding: '0.375rem 0.75rem',
                      backgroundColor: primaryColor,
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.25rem',
                      fontSize: '0.8125rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      opacity: actionLoading === gm.version ? 0.5 : 1,
                    }}
                  >
                    {actionLoading === gm.version ? 'Deploying...' : 'Deploy'}
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                <div>
                  <span style={{ fontWeight: '500' }}>Created: </span>
                  {new Date(gm.createdAt).toLocaleString()}
                </div>
                {gm.deployedAt && (
                  <div>
                    <span style={{ fontWeight: '500' }}>Deployed: </span>
                    {new Date(gm.deployedAt).toLocaleString()}
                  </div>
                )}
                <div>
                  <span style={{ fontWeight: '500' }}>Source: </span>
                  {gm.sourceImprovementRequestId ? `Request ${gm.sourceImprovementRequestId.substring(0, 12)}...` : 'Initial seed'}
                </div>
              </div>

              {gm.changesApplied.length > 0 && (
                <div style={{ marginTop: '0.75rem' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
                    Changes ({gm.changesApplied.length}):
                  </p>
                  <ul style={{ listStyle: 'disc', paddingLeft: '1.25rem', margin: 0 }}>
                    {gm.changesApplied.slice(0, 5).map((change, i) => (
                      <li key={i} style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                        <strong>{change.field}</strong>: {change.reason}
                      </li>
                    ))}
                    {gm.changesApplied.length > 5 && (
                      <li style={{ fontSize: '0.8125rem', color: 'var(--color-text-disabled)' }}>
                        ...and {gm.changesApplied.length - 5} more
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {gm.notes && (
                <div style={{ marginTop: '0.75rem', padding: '0.5rem', backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.25rem' }}>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>{gm.notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
