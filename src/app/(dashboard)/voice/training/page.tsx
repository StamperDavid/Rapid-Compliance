'use client';

import { PLATFORM_ID } from '@/lib/constants/platform';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import { useToast } from '@/hooks/useToast';
import { logger } from '@/lib/logger/logger';
import { TTS_PROVIDER_INFO, DEFAULT_TTS_CONFIGS, type TTSEngineType, type TTSVoice, type APIKeyMode } from '@/lib/voice/tts/types';
import type { ModelName } from '@/types/ai-models';

// Minimal type definitions for this component
interface VoiceTrainingSettings {
  greetingScript?: string;
  toneOfVoice?: string;
  callHandoffInstructions?: string;
  objectionHandling?: Record<string, string>;
  qualificationCriteria?: string[];
  [key: string]: unknown;
}

interface BrandDNA {
  companyDescription?: string;
  uniqueValue?: string;
  targetAudience?: string;
  toneOfVoice?: string;
  communicationStyle?: string;
  keyPhrases?: string[];
  avoidPhrases?: string[];
  industry?: string;
  competitors?: string[];
}

// Types
interface CallMessage {
  id: string;
  role: 'agent' | 'caller';
  content: string;
  timestamp: string;
}

interface ObjectionTemplate {
  key: string;
  response: string;
}

interface CallHistoryItem {
  id: string;
  duration: string;
  status: 'completed' | 'transferred' | 'dropped';
  timestamp: string;
  summary: string;
}

interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  type: 'script' | 'faq' | 'product' | 'policy';
  uploadedAt: string;
}

// API Response Types
interface TTSConfigResponse {
  success: boolean;
  config?: {
    engine?: TTSEngineType;
    keyMode?: APIKeyMode;
    voiceId?: string;
  };
  error?: string;
}

interface TTSVoicesResponse {
  success: boolean;
  voices?: TTSVoice[];
  error?: string;
}

interface TTSValidateResponse {
  success: boolean;
  valid: boolean;
  error?: string;
}

interface TTSGenerateResponse {
  success: boolean;
  audio?: string;
  error?: string;
}

interface TTSSaveResponse {
  success: boolean;
  error?: string;
}

interface FirestoreVoiceData {
  toolSettings?: unknown;
  inheritFromBrandDNA?: boolean;
}

interface FirestoreOrgData {
  brandDNA?: unknown;
}

interface FirestoreAdminKeys {
  openrouter?: {
    apiKey?: string;
  };
}

// Type guard functions
function isVoiceTrainingSettings(value: unknown): value is VoiceTrainingSettings {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const v = value as Record<string, unknown>;
  return (
    typeof v.greetingScript === 'string' &&
    typeof v.toneOfVoice === 'string' &&
    typeof v.callHandoffInstructions === 'string' &&
    typeof v.objectionResponses === 'object' &&
    Array.isArray(v.qualificationCriteria) &&
    Array.isArray(v.closingTechniques)
  );
}

function isBrandDNA(value: unknown): value is BrandDNA {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const v = value as Record<string, unknown>;
  return typeof v.companyDescription === 'string';
}

function isCallHistoryItemArray(value: unknown): value is CallHistoryItem[] {
  if (!Array.isArray(value)) {
    return false;
  }
  return value.every((item: unknown) => {
    if (!item || typeof item !== 'object') {
      return false;
    }
    const obj = item as Record<string, unknown>;
    return (
      typeof obj.id === 'string' &&
      typeof obj.duration === 'string' &&
      typeof obj.status === 'string' &&
      typeof obj.timestamp === 'string' &&
      typeof obj.summary === 'string'
    );
  });
}

function isKnowledgeItemArray(value: unknown): value is KnowledgeItem[] {
  if (!Array.isArray(value)) {
    return false;
  }
  return value.every((item: unknown) => {
    if (!item || typeof item !== 'object') {
      return false;
    }
    const obj = item as Record<string, unknown>;
    return (
      typeof obj.id === 'string' &&
      typeof obj.title === 'string' &&
      typeof obj.content === 'string' &&
      typeof obj.type === 'string' &&
      typeof obj.uploadedAt === 'string'
    );
  });
}

// Default settings
const defaultVoiceSettings: VoiceTrainingSettings = {
  greetingScript: '',
  toneOfVoice: 'professional',
  callHandoffInstructions: '',
  objectionResponses: {},
  qualificationCriteria: [],
  closingTechniques: [],
};

export default function VoiceAITrainingLabPage() {
  const { user } = useAuth();
  const { theme } = useOrgTheme();
  const toast = useToast();

  // Tab state
  const [activeTab, setActiveTab] = useState<'settings' | 'test-calls' | 'history' | 'knowledge'>('settings');

  // Loading states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Voice settings state
  const [voiceSettings, setVoiceSettings] = useState<VoiceTrainingSettings>(defaultVoiceSettings);

  // Brand DNA state
  const [brandDNA, setBrandDNA] = useState<BrandDNA | null>(null);
  const [overrideForVoice, setOverrideForVoice] = useState(false);

  // Objection templates state (for UI management)
  const [objectionTemplates, setObjectionTemplates] = useState<ObjectionTemplate[]>([]);
  const [newObjectionKey, setNewObjectionKey] = useState('');
  const [newObjectionResponse, setNewObjectionResponse] = useState('');

  // Qualification criteria state
  const [newCriteria, setNewCriteria] = useState('');

  // Testing sandbox state
  const [callMessages, setCallMessages] = useState<CallMessage[]>([]);
  const [callerInput, setCallerInput] = useState('');
  const [isCallActive, setIsCallActive] = useState(false);
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // History state
  const [callHistory, setCallHistory] = useState<CallHistoryItem[]>([]);

  // Knowledge base state
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [newKnowledgeTitle, setNewKnowledgeTitle] = useState('');
  const [newKnowledgeContent, setNewKnowledgeContent] = useState('');
  const [newKnowledgeType, setNewKnowledgeType] = useState<'script' | 'faq' | 'product' | 'policy'>('faq');

  // TTS Voice Engine state
  const [ttsEngine, setTtsEngine] = useState<TTSEngineType>('native');
  const [ttsKeyMode, setTtsKeyMode] = useState<APIKeyMode>('platform');
  const [ttsUserApiKey, setTtsUserApiKey] = useState('');
  const [ttsVoices, setTtsVoices] = useState<TTSVoice[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [testingVoice, setTestingVoice] = useState(false);
  const [validatingKey, setValidatingKey] = useState(false);
  const [apiKeyValid, setApiKeyValid] = useState<boolean | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Theme colors
  const primaryColor = theme?.colors?.primary?.main ?? '#6366f1';

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [callMessages]);

  // Load data on mount
  useEffect(() => {
    void loadVoiceTrainingData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Call timer
  useEffect(() => {
    if (isCallActive) {
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    }
    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, [isCallActive]);

  const loadVoiceTrainingData = async () => {
    try {
      setLoading(true);

      const { isFirebaseConfigured } = await import('@/lib/firebase/config');
      if (!isFirebaseConfigured) {
        logger.warn('Firebase not configured, using demo data', { file: 'voice-training-page.tsx' });
        loadDemoData();
        setLoading(false);
        return;
      }

      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');

      // Load voice training settings
      const voiceData = await FirestoreService.get(
        `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/toolTraining`,
        'voice'
      );
      const typedVoiceData = voiceData as FirestoreVoiceData | null;

      if (typedVoiceData?.toolSettings && isVoiceTrainingSettings(typedVoiceData.toolSettings)) {
        setVoiceSettings(typedVoiceData.toolSettings);
        // Convert objectionResponses to array format for UI
        const objectionResponses = typedVoiceData.toolSettings.objectionResponses;
        if (objectionResponses && typeof objectionResponses === 'object') {
          const templates = Object.entries(objectionResponses).map(
            ([key, response]) => ({ key, response: typeof response === 'string' ? response : String(response) })
          );
          setObjectionTemplates(templates);
        }
      }

      if (typedVoiceData?.inheritFromBrandDNA !== undefined) {
        setOverrideForVoice(!typedVoiceData.inheritFromBrandDNA);
      }

      // Load Brand DNA
      const orgData = await FirestoreService.get(COLLECTIONS.ORGANIZATIONS, PLATFORM_ID);
      const typedOrgData = orgData as FirestoreOrgData | null;
      if (typedOrgData?.brandDNA && isBrandDNA(typedOrgData.brandDNA)) {
        setBrandDNA(typedOrgData.brandDNA);
      }

      // Load call history
      const { orderBy } = await import('firebase/firestore');
      const historyResult = await FirestoreService.getAllPaginated(
        `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/voiceCallHistory`,
        [orderBy('timestamp', 'desc')],
        50
      );
      if (isCallHistoryItemArray(historyResult.data)) {
        setCallHistory(historyResult.data);
      }

      // Load knowledge base
      const knowledgeResult = await FirestoreService.getAllPaginated(
        `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/voiceKnowledge`,
        [orderBy('uploadedAt', 'desc')],
        100
      );
      if (isKnowledgeItemArray(knowledgeResult.data)) {
        setKnowledgeItems(knowledgeResult.data);
      }

    } catch (error: unknown) {
      logger.error('Error loading voice training data:', error instanceof Error ? error : new Error(String(error)), { file: 'voice-training-page.tsx' });
    } finally {
      setLoading(false);
    }
  };

  const loadDemoData = () => {
    setBrandDNA({
      companyDescription: 'AI-powered sales platform for modern teams',
      uniqueValue: 'Golden Master architecture for infinite scalability',
      targetAudience: 'Sales teams and business owners',
      toneOfVoice: 'professional',
      communicationStyle: 'Consultative and empathetic',
      keyPhrases: ['ROI-focused', 'Scale your sales', 'AI-powered'],
      avoidPhrases: ['cheap', 'discount', 'spam'],
      industry: 'SaaS',
      competitors: ['Salesforce', 'HubSpot'],
    });

    setVoiceSettings({
      greetingScript: 'Hi there! Thank you for calling. My name is Alex, how can I assist you today?',
      toneOfVoice: 'warm',
      callHandoffInstructions: 'If the caller requests to speak with a manager or the issue requires escalation, transfer to extension 100 with a brief summary.',
      objectionResponses: {
        'too expensive': 'I completely understand budget is important. Many of our clients felt the same way initially, but they found the ROI within the first 3 months more than covered the investment. Would you like me to share some specific examples?',
        'need to think about it': 'Of course, this is an important decision. What specific aspects would you like to think through? I would be happy to provide any additional information that might help.',
      },
      qualificationCriteria: [
        'Budget confirmed or decision-maker authority',
        'Timeline within 30 days',
        'Clear pain point identified',
        'Company size 10+ employees',
      ],
      closingTechniques: [
        'Summary close',
        'Assumptive close',
        'Choice close',
      ],
    });

    setObjectionTemplates([
      { key: 'too expensive', response: 'I completely understand budget is important. Many of our clients felt the same way initially, but they found the ROI within the first 3 months more than covered the investment. Would you like me to share some specific examples?' },
      { key: 'need to think about it', response: 'Of course, this is an important decision. What specific aspects would you like to think through? I would be happy to provide any additional information that might help.' },
    ]);

    setCallHistory([
      { id: '1', duration: '4:32', status: 'completed', timestamp: new Date(Date.now() - 3600000).toISOString(), summary: 'Qualified lead - scheduling demo' },
      { id: '2', duration: '2:15', status: 'transferred', timestamp: new Date(Date.now() - 7200000).toISOString(), summary: 'Escalated to manager per request' },
      { id: '3', duration: '6:48', status: 'completed', timestamp: new Date(Date.now() - 86400000).toISOString(), summary: 'Handled pricing objection successfully' },
    ]);

    setKnowledgeItems([
      { id: '1', title: 'Product Features Overview', content: 'Our platform includes AI agents, CRM, workflow automation...', type: 'product', uploadedAt: new Date().toISOString() },
      { id: '2', title: 'Pricing FAQ', content: 'Starter: $99/mo, Professional: $299/mo, Enterprise: Custom', type: 'faq', uploadedAt: new Date().toISOString() },
    ]);
  };

  // Load TTS config and voices
  const loadTTSConfig = async () => {
    try {
      const response = await fetch(`/api/voice/tts?action=config`);
      const data = await response.json() as TTSConfigResponse;
      if (data.success && data.config) {
        setTtsEngine(data.config.engine ?? 'native');
        setTtsKeyMode(data.config.keyMode ?? 'platform');
        setSelectedVoiceId(data.config.voiceId ?? '');
      }
    } catch (error: unknown) {
      logger.error('Error loading TTS config:', error instanceof Error ? error : new Error(String(error)), { file: 'voice-training-page.tsx' });
    }
  };

  const loadTTSVoices = async (engine: TTSEngineType) => {
    setLoadingVoices(true);
    try {
      const response = await fetch(`/api/voice/tts?engine=${engine}`);
      const data = await response.json() as TTSVoicesResponse;
      if (data.success && data.voices) {
        setTtsVoices(data.voices);
        // Set default voice if none selected
        if (!selectedVoiceId && data.voices.length > 0) {
          setSelectedVoiceId(data.voices[0].id);
        }
      }
    } catch (error: unknown) {
      logger.error('Error loading TTS voices:', error instanceof Error ? error : new Error(String(error)), { file: 'voice-training-page.tsx' });
    } finally {
      setLoadingVoices(false);
    }
  };

  // Load TTS config on mount
  useEffect(() => {
    void loadTTSConfig();
  }, []);

  // Load voices when engine changes
  useEffect(() => {
    void loadTTSVoices(ttsEngine);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ttsEngine]);

  const handleEngineChange = (engine: TTSEngineType) => {
    setTtsEngine(engine);
    setSelectedVoiceId('');
    setApiKeyValid(null);
    setTtsUserApiKey('');
    // Reset to platform keys for native
    if (engine === 'native') {
      setTtsKeyMode('platform');
    }
  };

  const handleValidateApiKey = async () => {
    if (!ttsUserApiKey.trim()) {
      return;
    }
    setValidatingKey(true);
    setApiKeyValid(null);
    try {
      const response = await fetch('/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'validate-key',
          engine: ttsEngine,
          apiKey: ttsUserApiKey,
        }),
      });
      const data = await response.json() as TTSValidateResponse;
      setApiKeyValid(data.valid);
    } catch (error: unknown) {
      logger.error('Error validating API key:', error instanceof Error ? error : new Error(String(error)), { file: 'voice-training-page.tsx' });
      setApiKeyValid(false);
    } finally {
      setValidatingKey(false);
    }
  };

  const handleTestVoice = async () => {
    setTestingVoice(true);
    try {
      const testText = voiceSettings.greetingScript ?? 'Hello, this is a test of your selected voice engine. The quality sounds great!';
      const response = await fetch('/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: testText,
          engine: ttsEngine,
          voiceId: selectedVoiceId,
        }),
      });
      const data = await response.json() as TTSGenerateResponse;
      if (data.success && data.audio) {
        // Play the audio
        if (audioRef.current) {
          audioRef.current.pause();
        }
        const audio = new Audio(data.audio);
        audioRef.current = audio;
        await audio.play();
      } else {
        toast.error(data.error ?? 'Failed to generate audio');
      }
    } catch (error: unknown) {
      logger.error('Error testing voice:', error instanceof Error ? error : new Error(String(error)), { file: 'voice-training-page.tsx' });
      toast.error('Failed to test voice. Please try again.');
    } finally {
      setTestingVoice(false);
    }
  };

  const handleSaveTTSConfig = async () => {
    try {
      const response = await fetch('/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save-config',
          userId: user?.id ?? 'unknown',
          config: {
            engine: ttsEngine,
            keyMode: ttsKeyMode,
            userApiKey: ttsKeyMode === 'user' ? ttsUserApiKey : undefined,
            voiceId: selectedVoiceId,
            settings: DEFAULT_TTS_CONFIGS[ttsEngine].settings,
          },
        }),
      });
      const data = await response.json() as TTSSaveResponse;
      if (!data.success) {
        throw new Error(data.error ?? 'Failed to save TTS config');
      }
    } catch (error: unknown) {
      logger.error('Error saving TTS config:', error instanceof Error ? error : new Error(String(error)), { file: 'voice-training-page.tsx' });
      throw error;
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);

      // Convert objection templates array back to object
      const objectionResponses: Record<string, string> = {};
      objectionTemplates.forEach(template => {
        objectionResponses[template.key] = template.response;
      });

      const updatedSettings: VoiceTrainingSettings = {
        ...voiceSettings,
        objectionResponses,
      };

      const { isFirebaseConfigured } = await import('@/lib/firebase/config');
      if (!isFirebaseConfigured) {
        setVoiceSettings(updatedSettings);
        toast.info('Settings saved (demo mode - not persisted)');
        setSaving(false);
        return;
      }

      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');

      await FirestoreService.set(
        `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/toolTraining`,
        'voice',
        {
          toolType: 'voice',
          inheritFromBrandDNA: !overrideForVoice,
          toolSettings: updatedSettings,
          updatedAt: new Date().toISOString(),
          updatedBy: user?.id ?? 'unknown',
        },
        true
      );

      setVoiceSettings(updatedSettings);

      // Also save TTS config
      await handleSaveTTSConfig();

      toast.success('Voice AI settings saved successfully!');

    } catch (error: unknown) {
      logger.error('Error saving voice settings:', error instanceof Error ? error : new Error(String(error)), { file: 'voice-training-page.tsx' });
      toast.error('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddObjection = () => {
    if (!newObjectionKey.trim() || !newObjectionResponse.trim()) {
      toast.warning('Please enter both the objection and the response.');
      return;
    }

    setObjectionTemplates(prev => [...prev, { key: newObjectionKey.trim(), response: newObjectionResponse.trim() }]);
    setNewObjectionKey('');
    setNewObjectionResponse('');
  };

  const handleRemoveObjection = (key: string) => {
    setObjectionTemplates(prev => prev.filter(t => t.key !== key));
  };

  const handleAddCriteria = () => {
    if (!newCriteria.trim()) {
      return;
    }
    setVoiceSettings(prev => ({
      ...prev,
      qualificationCriteria: [...(prev.qualificationCriteria ?? []), newCriteria.trim()],
    }));
    setNewCriteria('');
  };

  const handleRemoveCriteria = (index: number) => {
    setVoiceSettings(prev => ({
      ...prev,
      qualificationCriteria: (prev.qualificationCriteria ?? []).filter((_, i) => i !== index),
    }));
  };

  const handleStartCall = () => {
    setIsCallActive(true);
    setCallDuration(0);
    setCallMessages([]);

    // Add initial greeting
    const greetingMessage: CallMessage = {
      id: `msg_${Date.now()}`,
      role: 'agent',
      content: voiceSettings.greetingScript ?? 'Hello, thank you for calling. How may I assist you today?',
      timestamp: new Date().toISOString(),
    };
    setCallMessages([greetingMessage]);
  };

  const handleEndCall = async () => {
    setIsCallActive(false);

    // Save call to history
    const newCall: CallHistoryItem = {
      id: `call_${Date.now()}`,
      duration: formatDuration(callDuration),
      status: 'completed',
      timestamp: new Date().toISOString(),
      summary: `Test call - ${callMessages.length} messages exchanged`,
    };

    setCallHistory(prev => [newCall, ...prev]);

    // Save to Firestore if configured
    try {
      const { isFirebaseConfigured } = await import('@/lib/firebase/config');
      if (isFirebaseConfigured) {
        const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
        await FirestoreService.set(
          `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/voiceCallHistory`,
          newCall.id,
          { ...newCall, messages: callMessages },
          false
        );
      }
    } catch (error: unknown) {
      logger.error('Error saving call history:', error instanceof Error ? error : new Error(String(error)), { file: 'voice-training-page.tsx' });
    }
  };

  const handleSendCallerMessage = async () => {
    if (!callerInput.trim() || !isCallActive) {
      return;
    }

    const callerMessage: CallMessage = {
      id: `msg_${Date.now()}`,
      role: 'caller',
      content: callerInput.trim(),
      timestamp: new Date().toISOString(),
    };

    setCallMessages(prev => [...prev, callerMessage]);
    setCallerInput('');
    setIsAgentTyping(true);

    // Generate AI response
    try {
      const response = await generateAgentResponse(callerMessage.content);
      const agentMessage: CallMessage = {
        id: `msg_${Date.now()}_agent`,
        role: 'agent',
        content: response,
        timestamp: new Date().toISOString(),
      };
      setCallMessages(prev => [...prev, agentMessage]);
    } catch (error: unknown) {
      logger.error('Error generating agent response:', error instanceof Error ? error : new Error(String(error)), { file: 'voice-training-page.tsx' });
    } finally {
      setIsAgentTyping(false);
    }
  };

  const generateAgentResponse = async (callerMessage: string): Promise<string> => {
    // Check for objection matches
    const lowerMessage = callerMessage.toLowerCase();
    for (const template of objectionTemplates) {
      if (lowerMessage.includes(template.key.toLowerCase())) {
        return template.response;
      }
    }

    // Build system prompt from settings
    const systemPrompt = buildVoiceAgentPrompt();

    try {
      const { FirestoreService } = await import('@/lib/db/firestore-service');
      const adminKeys = await FirestoreService.get('admin', 'platform-api-keys') as FirestoreAdminKeys;

      if (adminKeys?.openrouter?.apiKey) {
        const { OpenRouterProvider } = await import('@/lib/ai/openrouter-provider');
        const provider = new OpenRouterProvider({ apiKey: adminKeys.openrouter.apiKey });

        const messages = [
          { role: 'system' as const, content: systemPrompt },
          ...callMessages.map(msg => ({
            role: msg.role === 'caller' ? 'user' as const : 'assistant' as const,
            content: msg.content,
          })),
          { role: 'user' as const, content: callerMessage },
        ];

        const modelName: ModelName = 'openrouter/anthropic/claude-3.5-sonnet' as const;
        const response = await provider.chat({
          model: modelName,
          messages,
          temperature: 0.7,
        });

        return response.content;
      }

      // Fallback to Gemini
      const { sendChatMessage } = await import('@/lib/ai/gemini-service');
      interface GeminiMessage {
        role: 'user' | 'model';
        parts: Array<{ text: string }>;
      }
      const conversationHistory: GeminiMessage[] = callMessages.map(msg => ({
        role: msg.role === 'caller' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      }));
      conversationHistory.push({ role: 'user', parts: [{ text: callerMessage }] });

      const result = await sendChatMessage(conversationHistory, systemPrompt);
      return result.text;

    } catch (error: unknown) {
      logger.error('Error calling AI provider:', error instanceof Error ? error : new Error(String(error)), { file: 'voice-training-page.tsx' });
      return 'I understand. Let me help you with that. Could you please provide more details?';
    }
  };

  const buildVoiceAgentPrompt = (): string => {
    const prompt = `You are a professional voice AI sales agent for a phone call.

## Tone of Voice
You should maintain a ${voiceSettings.toneOfVoice} tone throughout the conversation.

## Company Context
${brandDNA?.companyDescription ?? 'A professional sales organization'}

## Unique Value Proposition
${brandDNA?.uniqueValue ?? 'Quality service and solutions'}

## Key Phrases to Use
${brandDNA?.keyPhrases?.join(', ') ?? 'Professional, helpful, solution-focused'}

## Phrases to Avoid
${brandDNA?.avoidPhrases?.join(', ') ?? 'Avoid pushy or aggressive language'}

## Qualification Criteria
When speaking with prospects, try to qualify them based on:
${(voiceSettings.qualificationCriteria ?? []).map(c => `- ${c}`).join('\n')}

## Call Hand-off Instructions
${voiceSettings.callHandoffInstructions ?? 'Transfer to a manager if the caller requests escalation.'}

## Guidelines
- Keep responses conversational and natural for phone
- Be concise but thorough
- Ask clarifying questions when needed
- Guide toward a clear next step
- Be empathetic and understanding

Respond naturally as if you are on an actual phone call. Keep responses brief and conversational.`;

    return prompt;
  };

  const handleAddKnowledge = async () => {
    if (!newKnowledgeTitle.trim() || !newKnowledgeContent.trim()) {
      toast.warning('Please enter both title and content.');
      return;
    }

    const newItem: KnowledgeItem = {
      id: `knowledge_${Date.now()}`,
      title: newKnowledgeTitle.trim(),
      content: newKnowledgeContent.trim(),
      type: newKnowledgeType,
      uploadedAt: new Date().toISOString(),
    };

    setKnowledgeItems(prev => [newItem, ...prev]);

    // Save to Firestore
    try {
      const { isFirebaseConfigured } = await import('@/lib/firebase/config');
      if (isFirebaseConfigured) {
        const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
        await FirestoreService.set(
          `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/voiceKnowledge`,
          newItem.id,
          newItem,
          false
        );
      }
    } catch (error: unknown) {
      logger.error('Error saving knowledge item:', error instanceof Error ? error : new Error(String(error)), { file: 'voice-training-page.tsx' });
    }

    setNewKnowledgeTitle('');
    setNewKnowledgeContent('');
  };

  const handleRemoveKnowledge = async (id: string) => {
    setKnowledgeItems(prev => prev.filter(item => item.id !== id));

    try {
      const { isFirebaseConfigured } = await import('@/lib/firebase/config');
      if (isFirebaseConfigured) {
        const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
        await FirestoreService.delete(`${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/voiceKnowledge`, id);
      }
    } catch (error: unknown) {
      logger.error('Error deleting knowledge item:', error instanceof Error ? error : new Error(String(error)), { file: 'voice-training-page.tsx' });
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Loading state
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem', backgroundColor: '#000000', minHeight: '100vh' }}>
        <p style={{ color: '#999999' }}>Loading Voice AI Training Lab...</p>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#000000', minHeight: '100vh', color: '#ffffff' }}>
      {/* Header */}
      <div style={{ padding: '2rem', borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            Voice AI Training Lab
          </h1>
          <p style={{ color: '#999999', marginBottom: '1.5rem' }}>
            Configure and train your Voice AI agent for phone conversations
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid #1a1a1a', backgroundColor: '#0a0a0a' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 2rem', display: 'flex', gap: '2rem' }}>
          {([
            { id: 'settings' as const, label: 'Settings' },
            { id: 'test-calls' as const, label: 'Test Calls' },
            { id: 'history' as const, label: 'History' },
            { id: 'knowledge' as const, label: 'Knowledge' },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '1rem 0',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? `2px solid ${primaryColor}` : '2px solid transparent',
                color: activeTab === tab.id ? '#ffffff' : '#999999',
                fontWeight: activeTab === tab.id ? '600' : '400',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '2rem' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '2rem' }}>
              {/* Left: Settings Form */}
              <div>
                {/* Voice Engine Selection */}
                <div style={{ padding: '1.5rem', backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '0.75rem', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Voice Engine</h3>
                      <p style={{ fontSize: '0.875rem', color: '#666666' }}>
                        Choose the text-to-speech provider for your AI agent&apos;s voice
                      </p>
                    </div>
                  </div>

                  {/* Engine Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                    {(Object.keys(TTS_PROVIDER_INFO) as TTSEngineType[]).map((engine) => {
                      const info = TTS_PROVIDER_INFO[engine];
                      const isSelected = ttsEngine === engine;
                      return (
                        <button
                          key={engine}
                          onClick={() => handleEngineChange(engine)}
                          style={{
                            padding: '1rem',
                            backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.15)' : '#1a1a1a',
                            border: isSelected ? `2px solid ${primaryColor}` : '2px solid #333333',
                            borderRadius: '0.75rem',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.2s',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                            <span style={{ fontWeight: '600', color: isSelected ? primaryColor : '#ffffff', fontSize: '0.875rem' }}>
                              {info.name}
                            </span>
                            <span style={{
                              padding: '0.125rem 0.5rem',
                              backgroundColor: info.quality === 'ultra' ? 'rgba(168, 85, 247, 0.2)' : info.quality === 'premium' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                              color: info.quality === 'ultra' ? '#a855f7' : info.quality === 'premium' ? '#10b981' : '#f59e0b',
                              borderRadius: '9999px',
                              fontSize: '0.625rem',
                              fontWeight: '600',
                              textTransform: 'uppercase',
                            }}>
                              {info.quality}
                            </span>
                          </div>
                          <p style={{ fontSize: '0.75rem', color: '#999999', marginBottom: '0.75rem', lineHeight: '1.4' }}>
                            {info.description.substring(0, 80)}...
                          </p>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', color: '#666666' }}>
                              ${(info.pricing.costPer1kChars / 100).toFixed(3)}/1k chars
                            </span>
                            <span style={{
                              fontSize: '0.625rem',
                              padding: '0.125rem 0.375rem',
                              backgroundColor: info.latency === 'low' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                              color: info.latency === 'low' ? '#10b981' : '#f59e0b',
                              borderRadius: '0.25rem',
                            }}>
                              {info.latency} latency
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* API Key Mode (for Unreal and ElevenLabs) */}
                  {(ttsEngine === 'unreal' || ttsEngine === 'elevenlabs') && (
                    <div style={{ padding: '1rem', backgroundColor: '#1a1a1a', borderRadius: '0.5rem', marginBottom: '1rem' }}>
                      <div style={{ marginBottom: '1rem' }}>
                        <label style={{ fontSize: '0.875rem', fontWeight: '600', color: '#999999', marginBottom: '0.5rem', display: 'block' }}>
                          API Key Mode
                        </label>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                          <button
                            onClick={() => setTtsKeyMode('platform')}
                            style={{
                              flex: 1,
                              padding: '0.75rem',
                              backgroundColor: ttsKeyMode === 'platform' ? 'rgba(99, 102, 241, 0.2)' : '#0a0a0a',
                              border: ttsKeyMode === 'platform' ? `1px solid ${primaryColor}` : '1px solid #333333',
                              borderRadius: '0.5rem',
                              color: ttsKeyMode === 'platform' ? primaryColor : '#999999',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              fontWeight: ttsKeyMode === 'platform' ? '600' : '400',
                            }}
                          >
                            Use Platform Keys
                            <div style={{ fontSize: '0.75rem', color: '#666666', marginTop: '0.25rem' }}>
                              We bill you at usage rates
                            </div>
                          </button>
                          <button
                            onClick={() => setTtsKeyMode('user')}
                            style={{
                              flex: 1,
                              padding: '0.75rem',
                              backgroundColor: ttsKeyMode === 'user' ? 'rgba(99, 102, 241, 0.2)' : '#0a0a0a',
                              border: ttsKeyMode === 'user' ? `1px solid ${primaryColor}` : '1px solid #333333',
                              borderRadius: '0.5rem',
                              color: ttsKeyMode === 'user' ? primaryColor : '#999999',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              fontWeight: ttsKeyMode === 'user' ? '600' : '400',
                            }}
                          >
                            Use My Own Key
                            <div style={{ fontSize: '0.75rem', color: '#666666', marginTop: '0.25rem' }}>
                              Pay directly to provider
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* User API Key Input */}
                      {ttsKeyMode === 'user' && (
                        <div>
                          <label style={{ fontSize: '0.875rem', fontWeight: '600', color: '#999999', marginBottom: '0.5rem', display: 'block' }}>
                            Your {TTS_PROVIDER_INFO[ttsEngine].name} API Key
                          </label>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                              type="password"
                              value={ttsUserApiKey}
                              onChange={(e) => {
                                setTtsUserApiKey(e.target.value);
                                setApiKeyValid(null);
                              }}
                              placeholder={`Enter your ${TTS_PROVIDER_INFO[ttsEngine].name} API key...`}
                              style={{
                                flex: 1,
                                padding: '0.75rem',
                                backgroundColor: '#0a0a0a',
                                border: apiKeyValid === true ? '1px solid #10b981' : apiKeyValid === false ? '1px solid #ef4444' : '1px solid #333333',
                                borderRadius: '0.5rem',
                                color: '#ffffff',
                                fontSize: '0.875rem',
                              }}
                            />
                            <button
                              onClick={() => void handleValidateApiKey()}
                              disabled={validatingKey || !ttsUserApiKey.trim()}
                              style={{
                                padding: '0.75rem 1rem',
                                backgroundColor: validatingKey ? '#333333' : '#333333',
                                border: 'none',
                                borderRadius: '0.5rem',
                                color: '#ffffff',
                                cursor: validatingKey || !ttsUserApiKey.trim() ? 'not-allowed' : 'pointer',
                                fontSize: '0.875rem',
                                fontWeight: '600',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {validatingKey ? 'Validating...' : 'Validate'}
                            </button>
                          </div>
                          {apiKeyValid !== null && (
                            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: apiKeyValid ? '#10b981' : '#ef4444' }}>
                              {apiKeyValid ? 'API key is valid' : 'Invalid API key'}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Voice Selection */}
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: '600', color: '#999999', marginBottom: '0.5rem', display: 'block' }}>
                      Select Voice
                    </label>
                    <select
                      value={selectedVoiceId}
                      onChange={(e) => setSelectedVoiceId(e.target.value)}
                      disabled={loadingVoices}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #333333',
                        borderRadius: '0.5rem',
                        color: '#ffffff',
                        fontSize: '0.875rem',
                      }}
                    >
                      {loadingVoices ? (
                        <option>Loading voices...</option>
                      ) : (
                        ttsVoices.map((voice) => (
                          <option key={voice.id} value={voice.id}>
                            {voice.name} {voice.gender ? `(${voice.gender})` : ''} {voice.language ? `- ${voice.language}` : ''}
                          </option>
                        ))
                      )}
                    </select>
                    {ttsVoices.find(v => v.id === selectedVoiceId)?.description && (
                      <p style={{ fontSize: '0.75rem', color: '#666666', marginTop: '0.5rem' }}>
                        {ttsVoices.find(v => v.id === selectedVoiceId)?.description}
                      </p>
                    )}
                  </div>

                  {/* Test Voice Button */}
                  <button
                    onClick={() => void handleTestVoice()}
                    disabled={testingVoice || !selectedVoiceId}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      backgroundColor: testingVoice ? '#333333' : '#10b981',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '0.5rem',
                      cursor: testingVoice || !selectedVoiceId ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    {testingVoice ? 'Generating...' : 'Test Voice'}
                  </button>

                  {/* Provider Features */}
                  <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#1a1a1a', borderRadius: '0.5rem' }}>
                    <div style={{ fontSize: '0.75rem', color: '#666666', marginBottom: '0.5rem' }}>Features:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {TTS_PROVIDER_INFO[ttsEngine].features.slice(0, 4).map((feature, i) => (
                        <span key={i} style={{
                          padding: '0.25rem 0.5rem',
                          backgroundColor: '#0a0a0a',
                          border: '1px solid #333333',
                          borderRadius: '0.25rem',
                          fontSize: '0.625rem',
                          color: '#999999',
                        }}>
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Brand DNA Inheritance */}
                <div style={{ padding: '1.5rem', backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '0.75rem', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Brand DNA</h3>
                      <span style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.75rem',
                        backgroundColor: overrideForVoice ? '#1a1a1a' : 'rgba(99, 102, 241, 0.2)',
                        color: overrideForVoice ? '#999999' : primaryColor,
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                      }}>
                        {overrideForVoice ? 'Custom for Voice' : 'Inherited from Global Brand DNA'}
                      </span>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <span style={{ fontSize: '0.875rem', color: '#999999' }}>Override for Voice Only</span>
                      <input
                        type="checkbox"
                        checked={overrideForVoice}
                        onChange={(e) => setOverrideForVoice(e.target.checked)}
                        style={{ width: '1.25rem', height: '1.25rem', accentColor: primaryColor }}
                      />
                    </label>
                  </div>

                  {brandDNA && !overrideForVoice && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginTop: '1rem' }}>
                      <div style={{ padding: '0.75rem', backgroundColor: '#1a1a1a', borderRadius: '0.5rem' }}>
                        <div style={{ fontSize: '0.75rem', color: '#666666', marginBottom: '0.25rem' }}>Company</div>
                        <div style={{ fontSize: '0.875rem', color: '#ffffff' }}>{brandDNA.companyDescription?.substring(0, 50)}...</div>
                      </div>
                      <div style={{ padding: '0.75rem', backgroundColor: '#1a1a1a', borderRadius: '0.5rem' }}>
                        <div style={{ fontSize: '0.75rem', color: '#666666', marginBottom: '0.25rem' }}>Tone</div>
                        <div style={{ fontSize: '0.875rem', color: '#ffffff', textTransform: 'capitalize' }}>{brandDNA.toneOfVoice}</div>
                      </div>
                      <div style={{ gridColumn: 'span 2', padding: '0.75rem', backgroundColor: '#1a1a1a', borderRadius: '0.5rem' }}>
                        <div style={{ fontSize: '0.75rem', color: '#666666', marginBottom: '0.25rem' }}>Key Phrases</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          {brandDNA.keyPhrases?.slice(0, 5).map((phrase, i) => (
                            <span key={i} style={{ padding: '0.25rem 0.5rem', backgroundColor: '#0a0a0a', border: '1px solid #333333', borderRadius: '0.25rem', fontSize: '0.75rem' }}>
                              {phrase}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Voice Settings */}
                <div style={{ padding: '1.5rem', backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '0.75rem', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Voice-Specific Settings</h3>

                  {/* Greeting Script */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600', color: '#999999' }}>
                      Greeting Script
                    </label>
                    <textarea
                      value={voiceSettings.greetingScript}
                      onChange={(e) => setVoiceSettings(prev => ({ ...prev, greetingScript: e.target.value }))}
                      placeholder="Hi there! Thank you for calling. My name is Alex, how can I assist you today?"
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #333333',
                        borderRadius: '0.5rem',
                        color: '#ffffff',
                        fontSize: '0.875rem',
                        fontFamily: 'inherit',
                        resize: 'vertical',
                      }}
                    />
                  </div>

                  {/* Tone of Voice */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600', color: '#999999' }}>
                      Tone of Voice
                    </label>
                    <select
                      value={voiceSettings.toneOfVoice}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === 'warm' || value === 'direct' || value === 'professional') {
                          setVoiceSettings(prev => ({ ...prev, toneOfVoice: value }));
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #333333',
                        borderRadius: '0.5rem',
                        color: '#ffffff',
                        fontSize: '0.875rem',
                      }}
                    >
                      <option value="warm">Warm - Friendly and approachable</option>
                      <option value="direct">Direct - Clear and to the point</option>
                      <option value="professional">Professional - Formal and polished</option>
                    </select>
                  </div>

                  {/* Call Hand-off Instructions */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600', color: '#999999' }}>
                      Call Hand-off Instructions
                    </label>
                    <textarea
                      value={voiceSettings.callHandoffInstructions}
                      onChange={(e) => setVoiceSettings(prev => ({ ...prev, callHandoffInstructions: e.target.value }))}
                      placeholder="If the caller requests to speak with a manager, transfer to extension 100..."
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #333333',
                        borderRadius: '0.5rem',
                        color: '#ffffff',
                        fontSize: '0.875rem',
                        fontFamily: 'inherit',
                        resize: 'vertical',
                      }}
                    />
                  </div>
                </div>

                {/* Objection Response Templates */}
                <div style={{ padding: '1.5rem', backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '0.75rem', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1rem' }}>Objection Response Templates</h3>
                  <p style={{ fontSize: '0.875rem', color: '#666666', marginBottom: '1.5rem' }}>
                    Define pre-written responses for common objections. The AI will use these when matching objections are detected.
                  </p>

                  {/* Existing templates */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    {objectionTemplates.map((template, index) => (
                      <div key={index} style={{ padding: '1rem', backgroundColor: '#1a1a1a', borderRadius: '0.5rem', marginBottom: '0.75rem', border: '1px solid #333333' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                          <span style={{ fontWeight: '600', color: primaryColor, fontSize: '0.875rem' }}>&quot;{template.key}&quot;</span>
                          <button
                            onClick={() => handleRemoveObjection(template.key)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.875rem' }}
                          >
                            Remove
                          </button>
                        </div>
                        <p style={{ fontSize: '0.875rem', color: '#cccccc', lineHeight: '1.5' }}>{template.response}</p>
                      </div>
                    ))}
                  </div>

                  {/* Add new template */}
                  <div style={{ padding: '1rem', backgroundColor: '#1a1a1a', borderRadius: '0.5rem', border: '1px dashed #333333' }}>
                    <input
                      type="text"
                      value={newObjectionKey}
                      onChange={(e) => setNewObjectionKey(e.target.value)}
                      placeholder="Objection (e.g., 'too expensive')"
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        backgroundColor: '#0a0a0a',
                        border: '1px solid #333333',
                        borderRadius: '0.25rem',
                        color: '#ffffff',
                        fontSize: '0.875rem',
                        marginBottom: '0.75rem',
                      }}
                    />
                    <textarea
                      value={newObjectionResponse}
                      onChange={(e) => setNewObjectionResponse(e.target.value)}
                      placeholder="Response template..."
                      rows={2}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        backgroundColor: '#0a0a0a',
                        border: '1px solid #333333',
                        borderRadius: '0.25rem',
                        color: '#ffffff',
                        fontSize: '0.875rem',
                        fontFamily: 'inherit',
                        marginBottom: '0.75rem',
                      }}
                    />
                    <button
                      onClick={handleAddObjection}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: primaryColor,
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '0.25rem',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                      }}
                    >
                      + Add Objection Template
                    </button>
                  </div>
                </div>

                {/* Qualification Criteria */}
                <div style={{ padding: '1.5rem', backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '0.75rem', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1rem' }}>Qualification Criteria</h3>
                  <p style={{ fontSize: '0.875rem', color: '#666666', marginBottom: '1rem' }}>
                    Criteria the AI should use to qualify callers during conversations.
                  </p>

                  <div style={{ marginBottom: '1rem' }}>
                    {(voiceSettings.qualificationCriteria ?? []).map((criteria, index) => (
                      <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', padding: '0.5rem 0.75rem', backgroundColor: '#1a1a1a', borderRadius: '0.25rem' }}>
                        <span style={{ flex: 1, fontSize: '0.875rem' }}>{criteria}</span>
                        <button
                          onClick={() => handleRemoveCriteria(index)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem' }}
                        >
                          X
                        </button>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      value={newCriteria}
                      onChange={(e) => setNewCriteria(e.target.value)}
                      placeholder="Add qualification criteria..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAddCriteria();
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #333333',
                        borderRadius: '0.25rem',
                        color: '#ffffff',
                        fontSize: '0.875rem',
                      }}
                    />
                    <button
                      onClick={handleAddCriteria}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: '#333333',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '0.25rem',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                      }}
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Save Button */}
                <button
                  onClick={() => void handleSaveSettings()}
                  disabled={saving}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    backgroundColor: saving ? '#333333' : primaryColor,
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontSize: '1rem',
                    fontWeight: '600',
                  }}
                >
                  {saving ? 'Saving...' : 'Save Voice AI Settings'}
                </button>
              </div>

              {/* Right: Testing Sandbox */}
              <div style={{ position: 'sticky', top: '2rem', height: 'fit-content' }}>
                <div style={{ padding: '1.5rem', backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold' }}>Testing Sandbox</h3>
                    {isCallActive && (
                      <span style={{ fontSize: '0.875rem', color: '#10b981', fontWeight: '600' }}>
                        {formatDuration(callDuration)}
                      </span>
                    )}
                  </div>

                  {/* Phone UI */}
                  <div style={{
                    backgroundColor: '#1a1a1a',
                    borderRadius: '1rem',
                    padding: '1rem',
                    border: '2px solid #333333',
                    minHeight: '400px',
                    display: 'flex',
                    flexDirection: 'column',
                  }}>
                    {/* Call Header */}
                    <div style={{ textAlign: 'center', padding: '0.5rem', borderBottom: '1px solid #333333', marginBottom: '1rem' }}>
                      <div style={{ fontSize: '0.75rem', color: '#666666' }}>
                        {isCallActive ? 'Call in Progress' : 'Ready to Test'}
                      </div>
                      <div style={{ fontSize: '1rem', fontWeight: '600', color: isCallActive ? '#10b981' : '#999999' }}>
                        {isCallActive ? 'Connected' : 'No Active Call'}
                      </div>
                    </div>

                    {/* Messages */}
                    <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem', minHeight: '250px' }}>
                      {callMessages.map((msg) => (
                        <div
                          key={msg.id}
                          style={{
                            marginBottom: '0.75rem',
                            display: 'flex',
                            justifyContent: msg.role === 'caller' ? 'flex-end' : 'flex-start',
                          }}
                        >
                          <div style={{
                            maxWidth: '85%',
                            padding: '0.75rem',
                            borderRadius: msg.role === 'caller' ? '0.75rem 0.75rem 0 0.75rem' : '0.75rem 0.75rem 0.75rem 0',
                            backgroundColor: msg.role === 'caller' ? primaryColor : '#333333',
                            color: '#ffffff',
                            fontSize: '0.875rem',
                            lineHeight: '1.4',
                          }}>
                            <div style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.25rem' }}>
                              {msg.role === 'caller' ? 'Caller' : 'AI Agent'}
                            </div>
                            {msg.content}
                          </div>
                        </div>
                      ))}

                      {isAgentTyping && (
                        <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '0.75rem' }}>
                          <div style={{ padding: '0.75rem', backgroundColor: '#333333', borderRadius: '0.75rem', color: '#999999', fontSize: '0.875rem' }}>
                            Agent is typing...
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    {/* Input / Controls */}
                    {!isCallActive ? (
                      <button
                        onClick={handleStartCall}
                        style={{
                          width: '100%',
                          padding: '1rem',
                          backgroundColor: '#10b981',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '0.5rem',
                          cursor: 'pointer',
                          fontSize: '1rem',
                          fontWeight: '600',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        Incoming Call - Answer
                      </button>
                    ) : (
                      <div>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                          <input
                            type="text"
                            value={callerInput}
                            onChange={(e) => setCallerInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                void handleSendCallerMessage();
                              }
                            }}
                            placeholder="Speak as caller..."
                            style={{
                              flex: 1,
                              padding: '0.75rem',
                              backgroundColor: '#0a0a0a',
                              border: '1px solid #333333',
                              borderRadius: '0.5rem',
                              color: '#ffffff',
                              fontSize: '0.875rem',
                            }}
                          />
                          <button
                            onClick={() => void handleSendCallerMessage()}
                            disabled={!callerInput.trim()}
                            style={{
                              padding: '0.75rem 1rem',
                              backgroundColor: !callerInput.trim() ? '#333333' : primaryColor,
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '0.5rem',
                              cursor: !callerInput.trim() ? 'not-allowed' : 'pointer',
                              fontSize: '0.875rem',
                              fontWeight: '600',
                            }}
                          >
                            Send
                          </button>
                        </div>
                        <button
                          onClick={() => void handleEndCall()}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            backgroundColor: '#ef4444',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                          }}
                        >
                          End Call
                        </button>
                      </div>
                    )}
                  </div>

                  <p style={{ fontSize: '0.75rem', color: '#666666', marginTop: '1rem', textAlign: 'center' }}>
                    Test your voice AI settings with a simulated phone conversation
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Test Calls Tab */}
          {activeTab === 'test-calls' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 500px', gap: '2rem' }}>
              {/* Left: Instructions */}
              <div>
                <div style={{ padding: '1.5rem', backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '0.75rem', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>Test Your Voice AI</h3>
                  <p style={{ color: '#999999', marginBottom: '1.5rem', lineHeight: '1.6' }}>
                    Use the testing sandbox on the right to simulate phone conversations with your Voice AI agent.
                    The agent will respond based on your configured settings, objection templates, and brand DNA.
                  </p>

                  <div style={{ padding: '1rem', backgroundColor: '#1a1a1a', borderRadius: '0.5rem', marginBottom: '1rem' }}>
                    <h4 style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Testing Tips:</h4>
                    <ul style={{ color: '#999999', fontSize: '0.875rem', marginLeft: '1.5rem', lineHeight: '1.8' }}>
                      <li>Try common objections to see if templates are triggered correctly</li>
                      <li>Test qualification questions to see how the AI gathers information</li>
                      <li>Ask about pricing, features, and competitors</li>
                      <li>Request to speak with a manager to test hand-off instructions</li>
                    </ul>
                  </div>

                  <div style={{ padding: '1rem', backgroundColor: '#1a1a1a', borderRadius: '0.5rem' }}>
                    <h4 style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Current Configuration:</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginTop: '0.75rem' }}>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#666666' }}>Tone:</span>
                        <span style={{ marginLeft: '0.5rem', fontSize: '0.875rem', textTransform: 'capitalize' }}>{voiceSettings.toneOfVoice}</span>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#666666' }}>Objection Templates:</span>
                        <span style={{ marginLeft: '0.5rem', fontSize: '0.875rem' }}>{objectionTemplates.length}</span>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#666666' }}>Qualification Criteria:</span>
                        <span style={{ marginLeft: '0.5rem', fontSize: '0.875rem' }}>{(voiceSettings.qualificationCriteria ?? []).length}</span>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#666666' }}>Brand DNA:</span>
                        <span style={{ marginLeft: '0.5rem', fontSize: '0.875rem' }}>{overrideForVoice ? 'Custom' : 'Inherited'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Test Calls */}
                <div style={{ padding: '1.5rem', backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '0.75rem' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1rem' }}>Recent Test Calls</h3>
                  {callHistory.slice(0, 5).map((call) => (
                    <div key={call.id} style={{ padding: '0.75rem', backgroundColor: '#1a1a1a', borderRadius: '0.5rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: '600' }}>{call.summary}</div>
                        <div style={{ fontSize: '0.75rem', color: '#666666' }}>{new Date(call.timestamp).toLocaleString()}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.875rem', fontWeight: '600' }}>{call.duration}</div>
                        <div style={{
                          fontSize: '0.625rem',
                          padding: '0.125rem 0.5rem',
                          borderRadius: '9999px',
                          backgroundColor: call.status === 'completed' ? 'rgba(16, 185, 129, 0.2)' : call.status === 'transferred' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                          color: call.status === 'completed' ? '#10b981' : call.status === 'transferred' ? '#f59e0b' : '#ef4444',
                        }}>
                          {call.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Large Testing Sandbox */}
              <div style={{ position: 'sticky', top: '2rem', height: 'fit-content' }}>
                <div style={{ padding: '1.5rem', backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold' }}>Phone Simulation</h3>
                    {isCallActive && (
                      <span style={{ fontSize: '0.875rem', color: '#10b981', fontWeight: '600' }}>
                        {formatDuration(callDuration)}
                      </span>
                    )}
                  </div>

                  <div style={{
                    backgroundColor: '#1a1a1a',
                    borderRadius: '1rem',
                    padding: '1rem',
                    border: '2px solid #333333',
                    minHeight: '500px',
                    display: 'flex',
                    flexDirection: 'column',
                  }}>
                    <div style={{ textAlign: 'center', padding: '0.5rem', borderBottom: '1px solid #333333', marginBottom: '1rem' }}>
                      <div style={{ fontSize: '0.75rem', color: '#666666' }}>
                        {isCallActive ? 'Call in Progress' : 'Ready to Test'}
                      </div>
                      <div style={{ fontSize: '1rem', fontWeight: '600', color: isCallActive ? '#10b981' : '#999999' }}>
                        {isCallActive ? 'Connected' : 'No Active Call'}
                      </div>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem', minHeight: '350px' }}>
                      {callMessages.map((msg) => (
                        <div
                          key={msg.id}
                          style={{
                            marginBottom: '0.75rem',
                            display: 'flex',
                            justifyContent: msg.role === 'caller' ? 'flex-end' : 'flex-start',
                          }}
                        >
                          <div style={{
                            maxWidth: '85%',
                            padding: '0.75rem',
                            borderRadius: msg.role === 'caller' ? '0.75rem 0.75rem 0 0.75rem' : '0.75rem 0.75rem 0.75rem 0',
                            backgroundColor: msg.role === 'caller' ? primaryColor : '#333333',
                            color: '#ffffff',
                            fontSize: '0.875rem',
                            lineHeight: '1.4',
                          }}>
                            <div style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.25rem' }}>
                              {msg.role === 'caller' ? 'Caller' : 'AI Agent'}
                            </div>
                            {msg.content}
                          </div>
                        </div>
                      ))}

                      {isAgentTyping && (
                        <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '0.75rem' }}>
                          <div style={{ padding: '0.75rem', backgroundColor: '#333333', borderRadius: '0.75rem', color: '#999999', fontSize: '0.875rem' }}>
                            Agent is typing...
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    {!isCallActive ? (
                      <button
                        onClick={handleStartCall}
                        style={{
                          width: '100%',
                          padding: '1rem',
                          backgroundColor: '#10b981',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '0.5rem',
                          cursor: 'pointer',
                          fontSize: '1rem',
                          fontWeight: '600',
                        }}
                      >
                        Incoming Call - Answer
                      </button>
                    ) : (
                      <div>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                          <input
                            type="text"
                            value={callerInput}
                            onChange={(e) => setCallerInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                void handleSendCallerMessage();
                              }
                            }}
                            placeholder="Speak as caller..."
                            style={{
                              flex: 1,
                              padding: '0.75rem',
                              backgroundColor: '#0a0a0a',
                              border: '1px solid #333333',
                              borderRadius: '0.5rem',
                              color: '#ffffff',
                              fontSize: '0.875rem',
                            }}
                          />
                          <button
                            onClick={() => void handleSendCallerMessage()}
                            disabled={!callerInput.trim()}
                            style={{
                              padding: '0.75rem 1rem',
                              backgroundColor: !callerInput.trim() ? '#333333' : primaryColor,
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '0.5rem',
                              cursor: !callerInput.trim() ? 'not-allowed' : 'pointer',
                              fontSize: '0.875rem',
                              fontWeight: '600',
                            }}
                          >
                            Send
                          </button>
                        </div>
                        <button
                          onClick={() => void handleEndCall()}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            backgroundColor: '#ef4444',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                          }}
                        >
                          End Call
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div>
              <div style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Call History</h2>
                <p style={{ color: '#999999' }}>Review past test calls and their outcomes</p>
              </div>

              {callHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem', backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '0.75rem' }}>
                  <p style={{ color: '#666666', marginBottom: '1rem' }}>No call history yet.</p>
                  <p style={{ color: '#999999', fontSize: '0.875rem' }}>Start a test call in the Testing Sandbox to see history here.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {callHistory.map((call) => (
                    <div key={call.id} style={{ padding: '1.5rem', backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                        <div>
                          <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>{call.summary}</h3>
                          <p style={{ fontSize: '0.875rem', color: '#666666' }}>{new Date(call.timestamp).toLocaleString()}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>{call.duration}</div>
                          <span style={{
                            padding: '0.25rem 0.75rem',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            backgroundColor: call.status === 'completed' ? 'rgba(16, 185, 129, 0.2)' : call.status === 'transferred' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                            color: call.status === 'completed' ? '#10b981' : call.status === 'transferred' ? '#f59e0b' : '#ef4444',
                          }}>
                            {call.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Knowledge Tab */}
          {activeTab === 'knowledge' && (
            <div>
              <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Knowledge Base</h2>
                  <p style={{ color: '#999999' }}>Add scripts, FAQs, and product information for your Voice AI to reference</p>
                </div>
              </div>

              {/* Add Knowledge Form */}
              <div style={{ padding: '1.5rem', backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '0.75rem', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1rem' }}>Add Knowledge Item</h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: '1rem', marginBottom: '1rem' }}>
                  <input
                    type="text"
                    value={newKnowledgeTitle}
                    onChange={(e) => setNewKnowledgeTitle(e.target.value)}
                    placeholder="Title (e.g., 'Pricing Information')"
                    style={{
                      padding: '0.75rem',
                      backgroundColor: '#1a1a1a',
                      border: '1px solid #333333',
                      borderRadius: '0.5rem',
                      color: '#ffffff',
                      fontSize: '0.875rem',
                    }}
                  />
                  <select
                    value={newKnowledgeType}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === 'script' || value === 'faq' || value === 'product' || value === 'policy') {
                        setNewKnowledgeType(value);
                      }
                    }}
                    style={{
                      padding: '0.75rem',
                      backgroundColor: '#1a1a1a',
                      border: '1px solid #333333',
                      borderRadius: '0.5rem',
                      color: '#ffffff',
                      fontSize: '0.875rem',
                    }}
                  >
                    <option value="faq">FAQ</option>
                    <option value="script">Script</option>
                    <option value="product">Product Info</option>
                    <option value="policy">Policy</option>
                  </select>
                </div>

                <textarea
                  value={newKnowledgeContent}
                  onChange={(e) => setNewKnowledgeContent(e.target.value)}
                  placeholder="Enter the knowledge content..."
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #333333',
                    borderRadius: '0.5rem',
                    color: '#ffffff',
                    fontSize: '0.875rem',
                    fontFamily: 'inherit',
                    marginBottom: '1rem',
                    resize: 'vertical',
                  }}
                />

                <button
                  onClick={() => void handleAddKnowledge()}
                  disabled={!newKnowledgeTitle.trim() || !newKnowledgeContent.trim()}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: (!newKnowledgeTitle.trim() || !newKnowledgeContent.trim()) ? '#333333' : primaryColor,
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: (!newKnowledgeTitle.trim() || !newKnowledgeContent.trim()) ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                  }}
                >
                  + Add to Knowledge Base
                </button>
              </div>

              {/* Knowledge Items List */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1rem' }}>
                {knowledgeItems.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '0.75rem' }}>
                    <p style={{ color: '#666666', marginBottom: '0.5rem' }}>No knowledge items yet.</p>
                    <p style={{ color: '#999999', fontSize: '0.875rem' }}>Add scripts, FAQs, and product information above.</p>
                  </div>
                ) : (
                  knowledgeItems.map((item) => (
                    <div key={item.id} style={{ padding: '1.5rem', backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
                        <div>
                          <h4 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>{item.title}</h4>
                          <span style={{
                            padding: '0.125rem 0.5rem',
                            backgroundColor: '#1a1a1a',
                            border: '1px solid #333333',
                            borderRadius: '0.25rem',
                            fontSize: '0.625rem',
                            textTransform: 'uppercase',
                            color: '#999999',
                          }}>
                            {item.type}
                          </span>
                        </div>
                        <button
                          onClick={() => void handleRemoveKnowledge(item.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                          }}
                        >
                          Remove
                        </button>
                      </div>
                      <p style={{ fontSize: '0.875rem', color: '#999999', lineHeight: '1.5' }}>
                        {item.content.length > 200 ? `${item.content.substring(0, 200)}...` : item.content}
                      </p>
                      <p style={{ fontSize: '0.75rem', color: '#666666', marginTop: '0.75rem' }}>
                        Added: {new Date(item.uploadedAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
