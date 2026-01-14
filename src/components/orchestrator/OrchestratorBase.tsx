'use client';

/**
 * OrchestratorBase - Floating AI Assistant Component with Voice
 *
 * A unified base component for both Merchant and Admin AI Orchestrators.
 * Features:
 * - OpenRouter integration for multi-model support (default: Gemini 2.0 Flash)
 * - Voice synthesis via TTS Engine (ElevenLabs, Unreal, Native)
 * - Live Conversation Mode with VAD (Voice Activity Detection)
 * - Interruptible speech (stops playback when user speaks)
 * - Model and voice selection
 *
 * JASPER BRAIN ACTIVATION: Connects to live OpenRouter API via /api/orchestrator/chat
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useOrchestratorStore,
  type ChatMessage,
  type OrchestratorContext,
} from '@/lib/stores/orchestrator-store';
import {
  SPECIALISTS,
  type Specialist,
} from '@/lib/orchestrator/feature-manifest';
import {
  MessageSquare,
  X,
  Minus,
  Send,
  Sparkles,
  Zap,
  ChevronDown,
  HelpCircle,
  Lightbulb,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Settings,
  Radio,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export interface VoiceSettings {
  enabled: boolean;
  voiceId?: string;
  ttsEngine?: 'native' | 'unreal' | 'elevenlabs';
  liveMode: boolean; // Continuous mic mode with VAD
}

export interface OrchestratorConfig {
  context: OrchestratorContext;
  systemPrompt: string;
  welcomeMessage: string;
  briefingGenerator?: () => Promise<string>;
  onSpecialistInvoke?: (specialist: Specialist, action: string) => Promise<void>;
  /** Dynamic assistant name (e.g., "Jasper" for admin, custom name for clients) */
  assistantName?: string;
  /** Owner's name for personalized greetings */
  ownerName?: string;
  merchantInfo?: {
    industry?: string;
    niche?: string;
    companyName?: string;
    assistantName?: string;
    ownerName?: string;
  };
  adminStats?: {
    totalOrgs: number;
    activeAgents: number;
    pendingTickets: number;
  };
  organizationId?: string;
  /** Model selection (defaults to google/gemini-2.0-flash-exp) */
  modelId?: string;
  /** Voice configuration */
  voiceSettings?: Partial<VoiceSettings>;
}

// Default voice IDs for different personas
const DEFAULT_VOICE_IDS = {
  jasper_deep: '21m00Tcm4TlvDq8ikWAM', // ElevenLabs Rachel - Deep/Strategic
  jasper_energetic: 'AZnzlk1XvdvUeBnXmlld', // ElevenLabs Domi - Energetic
  merchant_warm: 'EXAVITQu4vr4xnSDxMaL', // ElevenLabs Sarah - Warm
};

// Available models
const AVAILABLE_MODELS = {
  'google/gemini-2.0-flash-exp': 'Gemini 2.0 Flash (Fast)',
  'google/gemini-flash-1.5': 'Gemini 1.5 Flash',
  'anthropic/claude-3-haiku': 'Claude 3 Haiku',
  'anthropic/claude-3.5-sonnet': 'Claude 3.5 Sonnet',
  'openai/gpt-4-turbo': 'GPT-4 Turbo',
};

// ============================================================================
// VOICE HOOKS
// ============================================================================

/**
 * Custom hook for Voice Activity Detection (VAD)
 * Detects when user is speaking and triggers callbacks
 */
function useVoiceActivityDetection(
  onSpeechStart: () => void,
  onSpeechEnd: (transcript: string) => void,
  enabled: boolean
) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<any>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      setIsListening(false);
      return;
    }

    // Check for browser support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[VAD] Speech recognition not supported');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let finalTranscript = '';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onspeechstart = () => {
      setIsSpeaking(true);
      onSpeechStart();
      // Clear any pending silence timeout
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
    };

    recognition.onspeechend = () => {
      setIsSpeaking(false);
      // Set a timeout to process the final transcript
      silenceTimeoutRef.current = setTimeout(() => {
        if (finalTranscript.trim()) {
          onSpeechEnd(finalTranscript.trim());
          finalTranscript = '';
        }
      }, 1000); // 1 second of silence before processing
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error('[VAD] Recognition error:', event.error);
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        // Restart on errors except no-speech
        setTimeout(() => {
          try {
            recognition.start();
          } catch (e) {
            // Ignore restart errors
          }
        }, 1000);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      // Auto-restart if still enabled
      if (enabled) {
        setTimeout(() => {
          try {
            recognition.start();
          } catch (e) {
            // Ignore restart errors
          }
        }, 100);
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (e) {
      console.error('[VAD] Failed to start recognition:', e);
    }

    return () => {
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
      if (recognition) {
        try {
          recognition.stop();
        } catch (e) {
          // Ignore stop errors
        }
      }
    };
  }, [enabled, onSpeechStart, onSpeechEnd]);

  return { isListening, isSpeaking };
}

/**
 * Custom hook for audio playback with interruption support
 */
function useAudioPlayback() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const playAudio = useCallback((base64Audio: string, format: string) => {
    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // Create new audio element
    const audio = new Audio(`data:audio/${format};base64,${base64Audio}`);
    audioRef.current = audio;

    audio.onplay = () => setIsPlaying(true);
    audio.onended = () => setIsPlaying(false);
    audio.onerror = () => setIsPlaying(false);

    audio.play().catch((e) => {
      console.error('[Audio] Playback error:', e);
      setIsPlaying(false);
    });
  }, []);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
      setIsPlaying(false);
    }
  }, []);

  return { playAudio, stopAudio, isPlaying };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function OrchestratorBase({ config }: { config: OrchestratorConfig }) {
  const {
    isOpen,
    isMinimized,
    chatHistory,
    isTyping,
    hasSeenWelcome,
    setOpen,
    setMinimized,
    addMessage,
    setTyping,
    markWelcomeSeen,
    openFeedbackModal,
  } = useOrchestratorStore();

  const [input, setInput] = useState('');
  const [showCommands, setShowCommands] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Voice state
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    enabled: config.voiceSettings?.enabled ?? false,
    voiceId: config.voiceSettings?.voiceId ?? DEFAULT_VOICE_IDS.jasper_deep,
    ttsEngine: config.voiceSettings?.ttsEngine ?? 'elevenlabs',
    liveMode: config.voiceSettings?.liveMode ?? false,
  });
  const [selectedModel, setSelectedModel] = useState(config.modelId || 'google/gemini-2.0-flash-exp');

  // Audio playback hook
  const { playAudio, stopAudio, isPlaying } = useAudioPlayback();

  // VAD hook for Live Conversation mode
  const handleSpeechStart = useCallback(() => {
    // Stop any playing audio when user starts speaking (interruptible speech)
    if (isPlaying) {
      stopAudio();
    }
  }, [isPlaying, stopAudio]);

  const handleSpeechEnd = useCallback((transcript: string) => {
    if (transcript && voiceSettings.liveMode) {
      setInput(transcript);
      // Auto-send after a brief delay to allow correction
      setTimeout(() => {
        const sendButton = document.getElementById('orchestrator-send-btn');
        if (sendButton) sendButton.click();
      }, 500);
    }
  }, [voiceSettings.liveMode]);

  const { isListening, isSpeaking } = useVoiceActivityDetection(
    handleSpeechStart,
    handleSpeechEnd,
    voiceSettings.liveMode
  );

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  // Welcome message on first open
  useEffect(() => {
    if (isOpen && !hasSeenWelcome && chatHistory.length === 0) {
      addMessage({
        role: 'assistant',
        content: config.welcomeMessage,
      });
      markWelcomeSeen();
    }
  }, [isOpen, hasSeenWelcome, chatHistory.length, config.welcomeMessage, addMessage, markWelcomeSeen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current && !voiceSettings.liveMode) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized, voiceSettings.liveMode]);

  /**
   * JASPER BRAIN ACTIVATION - Live OpenRouter API Integration with Voice
   */
  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || isTyping) return;

    const userMessage = input.trim();
    setInput('');

    // Add user message to chat history
    addMessage({ role: 'user', content: userMessage });

    setTyping(true);

    try {
      // Build conversation history for context (last 15 messages for memory)
      const conversationHistory = chatHistory.slice(-15).map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      // Call the live OpenRouter API via our orchestrator endpoint
      const response = await fetch('/api/orchestrator/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          message: userMessage,
          context: config.context,
          systemPrompt: config.systemPrompt,
          conversationHistory,
          adminStats: config.adminStats,
          merchantInfo: config.merchantInfo,
          organizationId: config.organizationId,
          modelId: selectedModel,
          voiceEnabled: voiceSettings.enabled,
          voiceId: voiceSettings.voiceId,
          ttsEngine: voiceSettings.ttsEngine,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.response) {
        addMessage({
          role: 'assistant',
          content: data.response,
          metadata: data.metadata?.toolExecuted
            ? { toolUsed: data.metadata.toolExecuted }
            : undefined,
        });

        // Play audio if voice is enabled and audio was returned
        if (voiceSettings.enabled && data.audio?.data) {
          playAudio(data.audio.data, data.audio.format);
        }
      } else {
        throw new Error('Invalid response from API');
      }
    } catch (error: any) {
      console.error('[Jasper] Chat error:', error);

      // Fallback response if API fails
      const fallbackResponse = config.context === 'admin'
        ? `I'm having trouble connecting right now. ${config.adminStats?.totalOrgs || 0} organizations are active - what would you like me to work on once I'm back online?`
        : `I'm experiencing a brief connection issue. I'll be back in a moment to help with your request.`;

      addMessage({
        role: 'assistant',
        content: fallbackResponse,
      });
    } finally {
      setTyping(false);
    }
  }, [input, isTyping, addMessage, setTyping, config, chatHistory, selectedModel, voiceSettings, playAudio]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const quickInvokeSpecialist = (specialist: Specialist) => {
    setInput(`Help me with ${specialist.name}`);
    setShowCommands(false);
    setTimeout(() => handleSendMessage(), 100);
  };

  const toggleLiveMode = () => {
    setVoiceSettings(prev => ({
      ...prev,
      liveMode: !prev.liveMode,
      enabled: true, // Enable voice when entering live mode
    }));
  };

  const toggleVoice = () => {
    setVoiceSettings(prev => ({
      ...prev,
      enabled: !prev.enabled,
    }));
  };

  // Render minimized state
  if (isMinimized) {
    return (
      <motion.button
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={() => setMinimized(false)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 shadow-lg shadow-indigo-500/30 flex items-center justify-center hover:scale-110 transition-transform"
      >
        <MessageSquare className="w-6 h-6 text-white" />
        {chatHistory.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">
            {chatHistory.filter((m) => m.role === 'assistant').length}
          </span>
        )}
      </motion.button>
    );
  }

  return (
    <>
      {/* Floating Trigger Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 shadow-2xl shadow-indigo-500/40 flex items-center justify-center hover:scale-110 transition-transform group"
          >
            <Sparkles className="w-7 h-7 text-white group-hover:animate-pulse" />
            <motion.div
              className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 opacity-0 group-hover:opacity-30"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-6 right-6 z-50 w-[420px] h-[600px] flex flex-col rounded-2xl overflow-hidden backdrop-blur-xl bg-black/40 border border-white/10 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center relative">
                  <Zap className="w-5 h-5 text-white" />
                  {/* Live mode indicator */}
                  {voiceSettings.liveMode && (
                    <motion.div
                      className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    />
                  )}
                </div>
                <div>
                  <h3 className="text-white font-semibold text-sm">
                    {config.assistantName || (config.context === 'admin' ? 'Jasper' : config.merchantInfo?.assistantName || 'AI Assistant')}
                  </h3>
                  <p className="text-gray-400 text-xs">
                    {voiceSettings.liveMode ? (
                      <span className="text-green-400 flex items-center gap-1">
                        <Radio className="w-3 h-3" /> Live Mode
                      </span>
                    ) : (
                      config.context === 'admin' ? 'Strategic Growth Architect' : 'Your Business Partner'
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {/* Live Mode Toggle */}
                <button
                  onClick={toggleLiveMode}
                  className={`p-2 rounded-lg transition-colors ${voiceSettings.liveMode ? 'bg-green-600/30 text-green-400' : 'hover:bg-white/10 text-gray-400'}`}
                  title={voiceSettings.liveMode ? 'Exit Live Mode' : 'Enter Live Mode (Continuous Mic)'}
                >
                  {voiceSettings.liveMode ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </button>
                {/* Voice Toggle */}
                <button
                  onClick={toggleVoice}
                  className={`p-2 rounded-lg transition-colors ${voiceSettings.enabled ? 'bg-indigo-600/30 text-indigo-400' : 'hover:bg-white/10 text-gray-400'}`}
                  title={voiceSettings.enabled ? 'Disable Voice' : 'Enable Voice'}
                >
                  {voiceSettings.enabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
                {/* Settings */}
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-white/20 text-white' : 'hover:bg-white/10 text-gray-400'}`}
                >
                  <Settings className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setMinimized(true)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <Minus className="w-4 h-4 text-gray-400" />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </div>

            {/* Settings Panel */}
            <AnimatePresence>
              {showSettings && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-b border-white/10 bg-black/40 overflow-hidden"
                >
                  <div className="p-4 space-y-4">
                    {/* Model Selection */}
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">AI Model</label>
                      <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      >
                        {Object.entries(AVAILABLE_MODELS).map(([id, name]) => (
                          <option key={id} value={id} className="bg-gray-900">{name}</option>
                        ))}
                      </select>
                    </div>

                    {/* TTS Engine */}
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Voice Engine</label>
                      <select
                        value={voiceSettings.ttsEngine}
                        onChange={(e) => setVoiceSettings(prev => ({ ...prev, ttsEngine: e.target.value as any }))}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      >
                        <option value="elevenlabs" className="bg-gray-900">ElevenLabs (Ultra Quality)</option>
                        <option value="unreal" className="bg-gray-900">Unreal Speech (Fast)</option>
                        <option value="native" className="bg-gray-900">Native Voice (Balanced)</option>
                      </select>
                    </div>

                    {/* Voice ID */}
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Voice Style</label>
                      <select
                        value={voiceSettings.voiceId}
                        onChange={(e) => setVoiceSettings(prev => ({ ...prev, voiceId: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      >
                        <option value={DEFAULT_VOICE_IDS.jasper_deep} className="bg-gray-900">Deep & Strategic</option>
                        <option value={DEFAULT_VOICE_IDS.jasper_energetic} className="bg-gray-900">Energetic & Dynamic</option>
                        <option value={DEFAULT_VOICE_IDS.merchant_warm} className="bg-gray-900">Warm & Friendly</option>
                      </select>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Chat Messages */}
            <div
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10"
            >
              {chatHistory.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {isTyping && (
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <div className="flex gap-1">
                    <motion.span
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                      className="w-2 h-2 rounded-full bg-indigo-400"
                    />
                    <motion.span
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                      className="w-2 h-2 rounded-full bg-indigo-400"
                    />
                    <motion.span
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                      className="w-2 h-2 rounded-full bg-indigo-400"
                    />
                  </div>
                  <span>Thinking...</span>
                </div>
              )}
            </div>

            {/* Live Mode Status Bar */}
            {voiceSettings.liveMode && (
              <div className="px-4 py-2 border-t border-white/10 bg-green-900/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <motion.div
                    className={`w-2 h-2 rounded-full ${isSpeaking ? 'bg-red-500' : isListening ? 'bg-green-500' : 'bg-yellow-500'}`}
                    animate={isSpeaking ? { scale: [1, 1.3, 1] } : {}}
                    transition={{ duration: 0.3, repeat: isSpeaking ? Infinity : 0 }}
                  />
                  <span className="text-xs text-gray-300">
                    {isSpeaking ? 'Listening...' : isListening ? 'Ready' : 'Initializing...'}
                  </span>
                </div>
                {isPlaying && (
                  <button
                    onClick={stopAudio}
                    className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                  >
                    <VolumeX className="w-3 h-3" /> Stop
                  </button>
                )}
              </div>
            )}

            {/* Command Palette */}
            <AnimatePresence>
              {showCommands && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="border-t border-white/10 bg-black/60 backdrop-blur-md max-h-48 overflow-y-auto"
                >
                  <div className="p-2 grid grid-cols-2 gap-1">
                    {SPECIALISTS.slice(0, 6).map((specialist) => (
                      <button
                        key={specialist.id}
                        onClick={() => quickInvokeSpecialist(specialist)}
                        className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/10 transition-colors text-left"
                      >
                        <span className="text-lg">{specialist.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-xs font-medium truncate">{specialist.name}</p>
                          <p className="text-gray-500 text-xs truncate">{specialist.role}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Quick Actions */}
            <div className="px-4 py-2 border-t border-white/10 flex gap-2">
              <button
                onClick={() => openFeedbackModal('support')}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-gray-400 text-xs"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                Support
              </button>
              <button
                onClick={() => openFeedbackModal('feature')}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-gray-400 text-xs"
              >
                <Lightbulb className="w-3.5 h-3.5" />
                Feature Request
              </button>
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-white/10 bg-black/20">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCommands(!showCommands)}
                  className={`p-2 rounded-lg transition-colors ${showCommands ? 'bg-indigo-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                >
                  <ChevronDown className={`w-5 h-5 transition-transform ${showCommands ? 'rotate-180' : ''}`} />
                </button>
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={voiceSettings.liveMode ? "Speak or type..." : "Ask me anything..."}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                />
                <button
                  id="orchestrator-send-btn"
                  onClick={handleSendMessage}
                  disabled={!input.trim() || isTyping}
                  className="p-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:from-indigo-500 hover:to-purple-500 transition-all"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ============================================================================
// MESSAGE BUBBLE
// ============================================================================

/**
 * Message Bubble with Markdown Support
 */
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  const renderMarkdown = (content: string) => {
    const paragraphs = content.split(/\n\n+/);

    return paragraphs.map((paragraph, pIndex) => {
      if (paragraph.match(/^[\s]*[-*]\s/m)) {
        const items = paragraph.split(/\n/).filter((line) => line.trim());
        return (
          <ul key={pIndex} className="list-disc list-inside my-2 space-y-1">
            {items.map((item, iIndex) => (
              <li key={iIndex} className="text-sm">
                {formatInlineMarkdown(item.replace(/^[\s]*[-*]\s/, ''))}
              </li>
            ))}
          </ul>
        );
      }

      if (paragraph.match(/^[\s]*\d+\.\s/m)) {
        const items = paragraph.split(/\n/).filter((line) => line.trim());
        return (
          <ol key={pIndex} className="list-decimal list-inside my-2 space-y-1">
            {items.map((item, iIndex) => (
              <li key={iIndex} className="text-sm">
                {formatInlineMarkdown(item.replace(/^[\s]*\d+\.\s/, ''))}
              </li>
            ))}
          </ol>
        );
      }

      const lines = paragraph.split('\n');
      return (
        <p key={pIndex} className="mb-2 last:mb-0">
          {lines.map((line, lIndex) => (
            <span key={lIndex}>
              {formatInlineMarkdown(line)}
              {lIndex < lines.length - 1 && <br />}
            </span>
          ))}
        </p>
      );
    });
  };

  const formatInlineMarkdown = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    const patterns = [
      { regex: /`([^`]+)`/g, render: (match: string) => <code key={key++} className="px-1 py-0.5 bg-black/30 rounded text-xs font-mono">{match}</code> },
      { regex: /\*\*([^*]+)\*\*/g, render: (match: string) => <strong key={key++} className="font-semibold">{match}</strong> },
      { regex: /\*([^*]+)\*/g, render: (match: string) => <em key={key++} className="italic">{match}</em> },
    ];

    for (const { regex, render } of patterns) {
      const newParts: React.ReactNode[] = [];

      if (typeof remaining === 'string') {
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(remaining)) !== null) {
          if (match.index > lastIndex) {
            newParts.push(remaining.slice(lastIndex, match.index));
          }
          newParts.push(render(match[1]));
          lastIndex = match.index + match[0].length;
        }

        if (lastIndex < remaining.length) {
          newParts.push(remaining.slice(lastIndex));
        }

        if (newParts.length > 0) {
          parts.push(...newParts);
          remaining = '';
        }
      }
    }

    if (parts.length === 0) {
      return text;
    }

    return parts;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
            : 'bg-white/10 text-gray-100'
        }`}
      >
        <div className="text-sm leading-relaxed">
          {renderMarkdown(message.content)}
        </div>
      </div>
    </motion.div>
  );
}

export default OrchestratorBase;
