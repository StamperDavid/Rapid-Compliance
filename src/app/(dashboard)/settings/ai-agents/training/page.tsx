'use client';

import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useOrgTheme } from '@/hooks/useOrgTheme'
import { logger } from '@/lib/logger/logger';;

// Type definitions
interface BaseModel {
  id: string;
  DEFAULT_ORG_ID: string;
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
  DEFAULT_ORG_ID: string;
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
  DEFAULT_ORG_ID?: string;
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

export default function AgentTrainingPage() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const { theme } = useOrgTheme();
  const [activeTab, setActiveTab] = useState<'chat' | 'materials' | 'history' | 'golden'>('chat');

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
          model: 'claude-3-5-sonnet',
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
        loadDemoData();
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
        `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}/trainingMaterials`,
        [orderBy('uploadedAt', 'desc')],
        100 // Load more materials at once for training
      );
      setUploadedMaterials((materialsResult.data as TrainingMaterial[]) || []);

      // Load training history (paginated - first 50 sessions)
      const historyResult = await FirestoreService.getAllPaginated(
        `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}/trainingSessions`,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadDemoData is stable and only depends on DEFAULT_ORG_ID
  }, [DEFAULT_ORG_ID]);

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
      // eslint-disable-next-line no-alert -- User feedback
      alert('Failed to get agent response. Please try again.');
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
      // eslint-disable-next-line no-alert -- User feedback
      alert(`Please explain WHY this response is ${feedbackType}`);
      return;
    }

    if (feedbackType !== 'correct' && !betterResponse.trim()) {
      // eslint-disable-next-line no-alert -- User feedback
      alert('Please provide a better response or guidance on how to improve.');
      return;
    }

    try {
      // Save feedback to Firestore
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');

      const feedbackData = {
        DEFAULT_ORG_ID,
        baseModelId: baseModel?.id ?? '',
        messageId: selectedMessageId,
        topic: trainingTopic,
        feedbackType,
        why: feedbackWhy,
        betterResponse: betterResponse || null,
        timestamp: new Date().toISOString(),
      };

      await FirestoreService.set(
        `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}/trainingFeedback`,
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

      // eslint-disable-next-line no-alert -- User feedback
      alert('✅ Feedback saved! This will help improve your AI agent.');

      // Reset feedback mode
      setFeedbackMode(false);
      setSelectedMessageId(null);
      setFeedbackWhy('');
      setBetterResponse('');

    } catch (error) {
      logger.error('Error saving feedback:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      // eslint-disable-next-line no-alert -- User feedback
      alert('Failed to save feedback. Please try again.');
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
      // eslint-disable-next-line no-alert -- User feedback
      alert('Please select or enter a training topic first.');
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

      // eslint-disable-next-line no-alert -- User feedback
      alert(`⚠️ Please explain low scores (< 7/10):\n\n${missingExplanations.map(key => `• ${labels[key]}: ${salesCriteria[key]}/10`).join('\n')}\n\nThe AI needs this context to learn and improve!`);
      return;
    }

    // Calculate overall score from criteria (0-100 scale)
    const criteriaScores = Object.values(salesCriteria);
    const avgScore = Math.round((criteriaScores.reduce((sum, score) => sum + score, 0) / criteriaScores.length) * 10);

    try {
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');

      const sessionRecord = {
        DEFAULT_ORG_ID,
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
        `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}/trainingSessions`,
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

      // eslint-disable-next-line no-alert -- User feedback
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

    } catch (error) {
      logger.error('Error saving sales criteria scoring:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      // eslint-disable-next-line no-alert -- User feedback
      alert('Failed to save session score. Please try again.');
    }
  };

  const saveTrainingSession = async () => {
    try {
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');

      const sessionData = {
        DEFAULT_ORG_ID,
        baseModelId: baseModel?.id ?? '',
        topic: trainingTopic || 'General',
        messages: chatMessages,
        timestamp: new Date().toISOString(),
        messageCount: chatMessages.length,
      };

      await FirestoreService.set(
        `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}/trainingSessions`,
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
          DEFAULT_ORG_ID,
          filename: file.name,
          type: file.type,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          extractedContent,
          processedAt: new Date().toISOString(),
        };

        await FirestoreService.set(
          `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}/trainingMaterials`,
          `material_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          materialData,
          false
        );

        setUploadedMaterials(prev => [...prev, materialData]);

        // Add to Base Model knowledge base
        // This will be automatically included in future training sessions
      }

      // eslint-disable-next-line no-alert -- User feedback
      alert(`✅ ${files.length} training material(s) uploaded successfully!\n\nThe content has been processed and will be used to train your AI agent.`);

    } catch (error) {
      logger.error('Error uploading training materials:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      // eslint-disable-next-line no-alert -- User feedback
      alert('Failed to upload training materials. Please try again.');
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
      // eslint-disable-next-line no-alert -- User feedback
      alert(`⚠️ Base Model is not ready yet!\n\nCurrent status: ${baseModel.status}\nTraining score: ${overallScore}%\n\nContinue training until you reach 80%+ score across multiple scenarios.`);
      return;
    }

    if (overallScore < 80) {
      // eslint-disable-next-line no-alert -- User feedback
      alert(`⚠️ Training score too low!\n\nCurrent score: ${overallScore}%\nRequired: 80%+\n\nContinue training your agent with more scenarios and feedback until the score improves.`);
      return;
    }

    // eslint-disable-next-line no-alert -- User feedback
    const notes = prompt('Optional: Add notes about this Golden Master version\n\nWhat changes or improvements were made?');

    try {
      const { createGoldenMaster } = await import('@/lib/agent/golden-master-builder');

      const userId = user?.id;
      const newGoldenMaster = await createGoldenMaster(baseModel.id, (userId !== '' && userId !== undefined) ? userId : 'system', notes ?? undefined) as { version: string | number };

      // eslint-disable-next-line no-alert -- User feedback
      alert(`✅ Golden Master ${newGoldenMaster.version} Created!\n\nYour trained AI agent has been saved as a production-ready version.\n\nNext steps:\n1. Review the Golden Master in the "Golden Master" tab\n2. Deploy it to production when ready\n3. Continue training your Base Model for future improvements`);

      // Reload data
      await loadTrainingData();
      setActiveTab('golden');

    } catch (error) {
      logger.error('Error saving Golden Master:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      // eslint-disable-next-line no-alert -- User feedback
      alert('Failed to save Golden Master. Please try again.');
    }
  };

  const loadDemoData = useCallback(() => {
    // Create demo Base Model
    setBaseModel({
      id: 'demo-base-model',
      DEFAULT_ORG_ID: DEFAULT_ORG_ID,
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
        DEFAULT_ORG_ID: DEFAULT_ORG_ID,
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
        DEFAULT_ORG_ID: DEFAULT_ORG_ID,
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
        DEFAULT_ORG_ID: DEFAULT_ORG_ID,
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
        DEFAULT_ORG_ID: DEFAULT_ORG_ID,
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

  const handleDeployGoldenMaster = async (gmId: string, version: string | number) => {
    // eslint-disable-next-line no-alert -- User feedback
    if (!confirm(`Deploy Golden Master ${version} to production?\n\nThis will make it the active version used by all customers.`)) {
      return;
    }

    try {
      const { deployGoldenMaster } = await import('@/lib/agent/golden-master-builder');

      await deployGoldenMaster(gmId);

      // eslint-disable-next-line no-alert -- User feedback
      alert(`✅ Golden Master ${version} is now LIVE!\n\nAll customer conversations will now use this version of your AI agent.`);

      await loadTrainingData();

    } catch (error) {
      logger.error('Error deploying Golden Master:', error instanceof Error ? error : undefined, { file: 'page.tsx' });
      // eslint-disable-next-line no-alert -- User feedback
      alert('Failed to deploy Golden Master. Please try again.');
    }
  };

  const primaryColor = theme?.colors?.primary?.main || '#6366f1';

  // Loading state
  if (loading || firebaseConfigured === null) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem' }}>
          <p style={{ color: '#999' }}>Loading training center...</p>
        </div>
    );
  }

  // Firebase not configured state
  if (firebaseConfigured === false) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem' }}>
          <div style={{ textAlign: 'center', maxWidth: '700px', padding: '2rem' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🔥</div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#fff' }}>
              Firebase Not Configured
            </h1>
            <p style={{ color: '#999', marginBottom: '1rem', lineHeight: '1.6' }}>
              The AI Agent Training Center requires Firebase to store your training data, conversations, and agent configurations.
            </p>
            <p style={{ color: '#999', marginBottom: '2rem', lineHeight: '1.6' }}>
              Please set up Firebase to use this feature. This takes about 5 minutes.
            </p>
            <div style={{ padding: '1.5rem', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '0.5rem', textAlign: 'left', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fff', marginBottom: '1rem' }}>Quick Setup Steps:</h2>
              <ol style={{ color: '#999', marginLeft: '1.5rem', lineHeight: '1.8' }}>
                <li>Create a Firebase project at <a href="https://console.firebase.google.com" target="_blank" style={{ color: primaryColor }}>console.firebase.google.com</a></li>
                <li>Enable Firestore Database and Authentication</li>
                <li>Copy your Firebase config from Project Settings</li>
                <li>Create a <code style={{ backgroundColor: '#0a0a0a', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>.env.local</code> file in your project root</li>
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
                  color: '#fff',
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
                  backgroundColor: '#1a1a1a',
                  color: '#fff',
                  borderRadius: '0.5rem',
                  textDecoration: 'none',
                  fontWeight: '600',
                  border: '1px solid #333',
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
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#fff' }}>
              No Base Model Found
            </h1>
            <p style={{ color: '#999', marginBottom: '2rem' }}>
              Please complete onboarding first to create your Base Model, then you can start training your AI agent.
            </p>
            <a
              href={`/onboarding`}
              style={{
                display: 'inline-block',
                padding: '0.75rem 1.5rem',
                backgroundColor: primaryColor,
                color: '#fff',
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '2rem', borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem', color: '#fff' }}>
            🎓 AI Agent Training Center
          </h1>
          <p style={{ color: '#999', marginBottom: '1.5rem' }}>
            Train your Base Model through conversations, upload training materials, and save Golden Masters when ready
          </p>
          
          {/* Status Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
            <div style={{ padding: '1rem', backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '0.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#666', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Base Model Status</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: baseModel.status === 'ready' ? '#10b981' : '#fbbf24' }}>
                {baseModel.status === 'draft' ? '📝 Draft' : baseModel.status === 'training' ? '🔄 Training' : '✅ Ready'}
              </div>
            </div>
            
            <div style={{ padding: '1rem', backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '0.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#666', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Overall Training Score</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: overallScore >= 80 ? '#10b981' : overallScore >= 60 ? '#fbbf24' : '#ef4444' }}>
                {overallScore}%
              </div>
            </div>
            
            <div style={{ padding: '1rem', backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '0.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#666', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Training Sessions</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff' }}>
                {baseModel.trainingScenarios?.length ?? 0}
              </div>
            </div>
            
            <div style={{ padding: '1rem', backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '0.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#666', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Golden Masters</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff' }}>
                {goldenMasters.length}
                {activeGoldenMaster && (
                  <span style={{ fontSize: '0.875rem', marginLeft: '0.5rem', color: '#10b981' }}>
                    ({activeGoldenMaster.version} active)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid #1a1a1a', backgroundColor: '#0a0a0a' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 2rem', display: 'flex', gap: '2rem' }}>
          {(['chat', 'materials', 'history', 'golden'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '1rem 0',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab ? `2px solid ${primaryColor}` : '2px solid transparent',
                color: activeTab === tab ? '#fff' : '#999',
                fontWeight: activeTab === tab ? '600' : '400',
                cursor: 'pointer',
                fontSize: '0.875rem',
                textTransform: 'capitalize',
              }}
            >
              {tab === 'chat' ? '💬 Training Chat' : tab === 'materials' ? '📚 Training Materials' : tab === 'history' ? '📊 History' : '⭐ Golden Masters'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          
          {activeTab === 'chat' && (
            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 320px', gap: '2rem' }}>
              {/* Column 1: Training Topics Sidebar */}
              <div>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#999', fontSize: '0.875rem', fontWeight: '600' }}>
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
                      backgroundColor: '#1a1a1a',
                      border: '1px solid #333',
                      borderRadius: '0.5rem',
                      color: '#fff',
                      fontSize: '1rem',
                    }}
                  />
                </div>
                
                <div>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#999', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
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
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #333',
                        borderRadius: '0.5rem',
                        color: '#fff',
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
                    border: '1px solid #333',
                    borderRadius: '0.5rem',
                    color: '#999',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                  }}
                >
                  🔄 New Session
                </button>
              </div>

              {/* Chat Area */}
              <div style={{ display: 'flex', flexDirection: 'column', height: '600px', backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '0.5rem' }}>
                {/* Messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
                  {chatMessages.length === 0 && (
                    <div style={{ textAlign: 'center', paddingTop: '3rem' }}>
                      <p style={{ color: '#666', marginBottom: '1rem' }}>
                        {trainingTopic ? `Start training on: ${trainingTopic}` : 'Select a topic or enter a custom topic to begin training'}
                      </p>
                      <p style={{ fontSize: '0.875rem', color: '#666' }}>
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
                          backgroundColor: msg.role === 'user' ? primaryColor : '#1a1a1a',
                          color: '#fff',
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
                              backgroundColor: msg.hasFeedback ? '#0a0a0a' : '#1a1a1a',
                              border: '1px solid #333',
                              borderRadius: '0.25rem',
                              color: msg.hasFeedback ? '#666' : '#999',
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
                      <div style={{ padding: '0.75rem 1rem', backgroundColor: '#1a1a1a', borderRadius: '0.75rem' }}>
                        <span style={{ color: '#999' }}>Typing...</span>
                      </div>
                    </div>
                  )}
                  
                  <div ref={chatEndRef} />
                </div>

                {/* Input */}
                <div style={{ padding: '1rem', borderTop: '1px solid #1a1a1a' }}>
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
                      placeholder="Type your message as a customer..."
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #333',
                        borderRadius: '0.5rem',
                        color: '#fff',
                        fontSize: '0.875rem',
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
                backgroundColor: '#0a0a0a',
                border: '1px solid #1a1a1a',
                borderRadius: '0.75rem',
                padding: '1.5rem',
                height: 'fit-content',
                position: 'sticky',
                top: '2rem'
              }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fff' }}>
                      📊 Sales Criteria Scoring
                    </h3>
                    <button
                      onClick={() => setShowCriteriaEditor(!showCriteriaEditor)}
                      style={{
                        padding: '0.25rem 0.5rem',
                        backgroundColor: 'transparent',
                        border: '1px solid #333',
                        borderRadius: '0.375rem',
                        color: '#999',
                        fontSize: '0.75rem',
                        cursor: 'pointer'
                      }}
                    >
                      ⚙️ Customize
                    </button>
                  </div>
                  
                  <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                    Rate each criterion AND explain why. The AI learns from your explanations, not just numbers.
                  </p>

                  {/* Criteria Customization Panel - Hidden until fully implemented */}
                  {/* Removed "coming soon" custom criteria editor to avoid confusion in production */}
                  {/* The default 6 criteria are sufficient for now */}
                  {/* Can be added back when custom criteria functionality is fully implemented */}

                  {/* Score Sliders */}
                  <div style={{ marginBottom: '1.5rem', maxHeight: '500px', overflowY: 'auto' }}>
                    {customCriteria.map(({ key, label, icon }) => (
                      <div key={key} style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#1a1a1a', borderRadius: '0.5rem', border: '1px solid #333' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <label style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff' }}>
                            {icon} {label}
                          </label>
                          <span style={{ 
                            fontSize: '0.875rem', 
                            fontWeight: 'bold',
                            color: salesCriteria[key as keyof typeof salesCriteria] >= 8 ? '#10b981' : 
                                   salesCriteria[key as keyof typeof salesCriteria] >= 6 ? '#fbbf24' : '#ef4444'
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
                            background: `linear-gradient(to right, ${primaryColor} 0%, ${primaryColor} ${salesCriteria[key as keyof typeof salesCriteria] * 10}%, #1a1a1a ${salesCriteria[key as keyof typeof salesCriteria] * 10}%, #1a1a1a 100%)`,
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
                            backgroundColor: '#0a0a0a',
                            border: '1px solid #333',
                            borderRadius: '0.375rem',
                            color: '#fff',
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
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '0.5rem',
                    marginBottom: '1.5rem'
                  }}>
                    <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem', textTransform: 'uppercase' }}>
                      Overall Session Score
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981' }}>
                      {Math.round((Object.values(salesCriteria).reduce((sum, score) => sum + score, 0) / customCriteria.length) * 10)}/100
                    </div>
                  </div>

                  {/* Session Notes */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: '#999' }}>
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
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #333',
                        borderRadius: '0.5rem',
                        color: '#fff',
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
                      color: '#fff',
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
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem', color: '#fff' }}>
                    Training Materials
                  </h2>
                  <p style={{ color: '#999', fontSize: '0.875rem' }}>
                    Upload sales training documents (PDFs, Word docs, text files) to enhance your agent&apos;s knowledge
                  </p>
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
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: '#666' }}>
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
                      backgroundColor: '#0a0a0a',
                      border: '1px solid #1a1a1a',
                      borderRadius: '0.5rem',
                    }}
                  >
                    <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📄</div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.5rem', color: '#fff' }}>
                      {material.filename}
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.5rem' }}>
                      Uploaded: {new Date(material.uploadedAt).toLocaleDateString()}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: '#666' }}>
                      Size: {typeof material.size === 'number' ? Math.round(material.size / 1024) : material.size} {typeof material.size === 'number' ? 'KB' : ''}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#fff' }}>
                Training History
              </h2>
              
              {trainingHistory.length === 0 && (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
                  No training sessions yet. Start a conversation in the Training Chat tab.
                </div>
              )}
              
              <div style={{ display: 'grid', gap: '1rem' }}>
                {trainingHistory.map((session, idx: number) => (
                  <div
                    key={session.id ?? idx}
                    style={{
                      padding: '1.5rem',
                      backgroundColor: '#0a0a0a',
                      border: '1px solid #1a1a1a',
                      borderRadius: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fff' }}>
                        {session.topic}
                      </h3>
                      <span style={{ fontSize: '0.75rem', color: '#666' }}>
                        {new Date(session.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.875rem', color: '#999' }}>
                      {session.messageCount ?? session.messagesCount ?? 0} messages exchanged
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'golden' && (
            <div>
              <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem', color: '#fff' }}>
                    Golden Masters
                  </h2>
                  <p style={{ color: '#999', fontSize: '0.875rem' }}>
                    Production-ready snapshots of your trained AI agent
                  </p>
                </div>
                
                <button
                  onClick={() => void handleSaveGoldenMaster()}
                  disabled={baseModel?.status !== 'ready' || overallScore < 80}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: (baseModel?.status === 'ready' && overallScore >= 80) ? '#10b981' : '#333',
                    color: '#fff',
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
                <div style={{ padding: '1rem', backgroundColor: '#1a1a0a', border: '1px solid #3a3a0a', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
                  <p style={{ fontSize: '0.875rem', color: '#fbbf24' }}>
                    ⚠️ Base Model is not ready yet. Status: <strong>{baseModel.status}</strong>. Continue training to reach &quot;ready&quot; status.
                  </p>
                </div>
              )}
              
              {overallScore < 80 && (
                <div style={{ padding: '1rem', backgroundColor: '#1a1a0a', border: '1px solid #3a3a0a', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
                  <p style={{ fontSize: '0.875rem', color: '#fbbf24' }}>
                    ⚠️ Training score is below 80%. Current score: <strong>{overallScore}%</strong>. Continue training to improve.
                  </p>
                </div>
              )}
              
              <div style={{ display: 'grid', gap: '1rem' }}>
                {goldenMasters.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
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
                      backgroundColor: '#0a0a0a',
                      border: gm.isActive ? `2px solid ${primaryColor}` : '1px solid #1a1a1a',
                      borderRadius: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                      <div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
                          {gm.version}
                          {gm.isActive && <span style={{ marginLeft: '0.75rem', fontSize: '0.75rem', color: '#10b981', backgroundColor: '#0a2a1a', padding: '0.25rem 0.75rem', borderRadius: '1rem' }}>LIVE</span>}
                        </h3>
                        {gm.createdAt && (
                          <p style={{ fontSize: '0.875rem', color: '#999' }}>
                            Created: {new Date(gm.createdAt).toLocaleString()}
                          </p>
                        )}
                        {gm.deployedAt && (
                          <p style={{ fontSize: '0.875rem', color: '#999' }}>
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
                              color: '#fff',
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
                        <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Training Score</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#10b981' }}>{gm.trainingScore}%</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Scenarios Trained</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff' }}>{gm.trainedScenarios?.length ?? 0}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Base Model</div>
                        <div style={{ fontSize: '0.875rem', color: '#999' }}>{gm.baseModelId.substring(0, 12)}...</div>
                      </div>
                    </div>

                    {gm.notes && (
                      <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#1a1a1a', borderRadius: '0.25rem' }}>
                        <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Notes</div>
                        <p style={{ fontSize: '0.875rem', color: '#fff' }}>{gm.notes}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
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
              backgroundColor: '#0a0a0a',
              border: '1px solid #333',
              borderRadius: '0.75rem',
              padding: '2rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#fff' }}>
              Provide Feedback on Agent Response
            </h2>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#999', fontSize: '0.875rem', fontWeight: '600' }}>
                How was this response?
              </label>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {([
                  { value: 'correct' as const, label: '✅ Correct', color: '#10b981' },
                  { value: 'could-improve' as const, label: '⚠️ Could Improve', color: '#fbbf24' },
                  { value: 'incorrect' as const, label: '❌ Incorrect', color: '#ef4444' },
                ]).map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setFeedbackType(option.value)}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      backgroundColor: feedbackType === option.value ? option.color : '#1a1a1a',
                      border: feedbackType === option.value ? `2px solid ${option.color}` : '1px solid #333',
                      borderRadius: '0.5rem',
                      color: '#fff',
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
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#999', fontSize: '0.875rem', fontWeight: '600' }}>
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
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '0.5rem',
                  color: '#fff',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>
            
            {feedbackType !== 'correct' && (
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#999', fontSize: '0.875rem', fontWeight: '600' }}>
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
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '0.5rem',
                    color: '#fff',
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
                  border: '1px solid #333',
                  borderRadius: '0.5rem',
                  color: '#999',
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
                  color: '#fff',
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
