'use client';

/**
 * OrchestratorBase - Floating AI Assistant Component
 *
 * A unified base component for both Merchant and Admin AI Orchestrators.
 * Features glassmorphism styling and integrates with the feature manifest.
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
  findMatchingSpecialists,
  getSpecialist,
  type Specialist,
  type SpecialistPlatform,
} from '@/lib/orchestrator/feature-manifest';
import { matchSpecialistTrigger } from '@/lib/ai/persona-mapper';
import type { IndustryType } from '@/types/organization';
import {
  MessageSquare,
  X,
  Minus,
  Send,
  Sparkles,
  Zap,
  ChevronDown,
  HelpCircle,
  MessageCircleQuestion,
  Lightbulb,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

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
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    if (isOpen && !isMinimized && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized]);

  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || isTyping) return;

    const userMessage = input.trim();
    setInput('');

    // Add user message
    addMessage({ role: 'user', content: userMessage });

    // Get assistant name for personalized responses
    const assistantName = config.assistantName || (config.context === 'admin' ? 'Jasper' : 'Assistant');
    const industry = (config.merchantInfo?.industry as IndustryType) || 'custom';
    const ownerName = config.ownerName || config.merchantInfo?.ownerName || 'Commander';

    // Check for direct name invocation (e.g., "Jasper, find leads" or "Alex, create content")
    const lowerMessage = userMessage.toLowerCase();
    const nameInvoked = lowerMessage.includes(assistantName.toLowerCase() + ',') ||
                        lowerMessage.startsWith(assistantName.toLowerCase() + ' ');

    // Check for industry-specific specialist triggers
    const industryMatchedSpecialist = matchSpecialistTrigger(userMessage, industry, config.context === 'admin' ? 'admin' : 'client');

    // Check for general specialist triggers
    const matchedSpecialists = findMatchingSpecialists(userMessage);

    // PROACTIVE INTENT DETECTION for Admin (Jasper)
    const isLaunchIntent = config.context === 'admin' && (
      lowerMessage.includes('where do we start') ||
      lowerMessage.includes('where should we start') ||
      lowerMessage.includes('what\'s the plan') ||
      lowerMessage.includes('what should i do') ||
      lowerMessage.includes('launch') ||
      lowerMessage.includes('let\'s go') ||
      lowerMessage.includes('get started') ||
      lowerMessage.includes('first steps') ||
      lowerMessage.includes('what\'s next') ||
      lowerMessage.includes('priority')
    );

    const isListRequest = config.context === 'admin' && (
      lowerMessage.includes('what can you do') ||
      lowerMessage.includes('what are my options') ||
      lowerMessage.includes('show me features') ||
      lowerMessage.includes('list features')
    );

    // DIRECT DATA QUERIES - Answer immediately, no deflection
    const isDataQuery = config.context === 'admin' && (
      lowerMessage.includes('how many') ||
      lowerMessage.includes('count') ||
      lowerMessage.includes('total') ||
      lowerMessage.includes('organizations') ||
      lowerMessage.includes('orgs') ||
      lowerMessage.includes('clients') ||
      lowerMessage.includes('users') ||
      lowerMessage.includes('trials')
    );

    // EXPERT GUIDE MODE: Detect requests for unconfigured features
    const isSocialMediaRequest = lowerMessage.includes('social') ||
      lowerMessage.includes('instagram') ||
      lowerMessage.includes('linkedin') ||
      lowerMessage.includes('twitter') ||
      lowerMessage.includes('facebook') ||
      lowerMessage.includes('tiktok');

    const isEmailRequest = lowerMessage.includes('email') ||
      lowerMessage.includes('newsletter') ||
      lowerMessage.includes('smtp');

    const isHideRequest = lowerMessage.includes('hide') ||
      lowerMessage.includes('don\'t need') ||
      lowerMessage.includes('remove') ||
      lowerMessage.includes('i don\'t use');

    setTyping(true);

    // Simulate AI response (replace with actual AI integration)
    setTimeout(() => {
      let response = '';
      let invokedSpecialistId: SpecialistPlatform | undefined;

      // ADMIN RESPONSES (Jasper as Internal Business Partner)
      if (config.context === 'admin') {
        const stats = config.adminStats || { totalOrgs: 0, activeAgents: 0, pendingTickets: 0 };

        // DIRECT DATA QUERY - Answer immediately
        if (isDataQuery) {
          response = `${stats.totalOrgs} organizations active right now${stats.totalOrgs > 0 ? `, with ${stats.activeAgents} AI operations running` : ''}. ${stats.pendingTickets > 0 ? `${stats.pendingTickets} support ticket${stats.pendingTickets > 1 ? 's' : ''} need attention.` : ''}`;
        }
        // Launch intent - Proactive data-driven response
        else if (isLaunchIntent) {
          const trialEstimate = Math.max(1, Math.floor(stats.totalOrgs * 0.7));
          response = `${stats.totalOrgs} organizations under management, roughly ${trialEstimate} on trial. The highest-impact move right now is converting those trial accounts - each one is worth about $299/month recurring.

I can start drafting personalized conversion outreach for the most engaged trials. Want me to get that going?`;
          invokedSpecialistId = 'lead_hunter';
        }
        // List request - Redirect to strategic action
        else if (isListRequest) {
          response = `I manage your entire sales operation - leads, outreach, content, analytics, the whole stack. But rather than running through capabilities, let me tell you what matters right now: we've got ${stats.totalOrgs} organizations, several on trial. The strategic play is converting those, not reviewing menus. What's your priority?`;
        }
        // Social media request (unconfigured)
        else if (isSocialMediaRequest && !isHideRequest) {
          response = `I checked - Instagram and LinkedIn aren't connected yet. To post and manage your social presence, I'll need API access to those accounts. Want me to walk you through linking them, or should I hide social features from the dashboard until you're ready to set them up?`;
        }
        // Email request (unconfigured)
        else if (isEmailRequest && !isHideRequest) {
          response = `Email isn't configured yet - no SMTP connection or email service linked. To send newsletters and campaigns, I'll need those credentials. I can walk you through the setup now, or hide email features until you have time for it. What works better?`;
        }
        // Hide feature request
        else if (isHideRequest) {
          const featureToHide = isSocialMediaRequest ? 'social media' : isEmailRequest ? 'email' : 'that feature';
          response = `Done - hiding ${featureToHide} from the dashboard. You can bring it back anytime from Settings → Feature Visibility. Anything else cluttering your workspace?`;
        }
        // Task execution with name invocation
        else if (industryMatchedSpecialist && nameInvoked) {
          invokedSpecialistId = industryMatchedSpecialist as SpecialistPlatform;
          const taskDescription = userMessage.replace(new RegExp(assistantName + ',?\\s*', 'i'), '');
          response = `On it. Working on "${taskDescription}" now - I'll have results for you shortly.`;
        }
        // General task matching
        else if (matchedSpecialists.length > 0) {
          invokedSpecialistId = matchedSpecialists[0].id;
          response = `I can handle that. Starting now - I'll update you when there's something to review.`;
        }
        // Status/Dashboard request
        else if (lowerMessage.includes('status') || lowerMessage.includes('dashboard') || lowerMessage.includes('pulse')) {
          response = `${stats.totalOrgs} organizations active, ${stats.activeAgents} AI operations running${stats.pendingTickets > 0 ? `, ${stats.pendingTickets} tickets need attention` : ', all tickets resolved'}. What should I focus on?`;
        }
        // Execute command
        else if (lowerMessage.includes('execute') || lowerMessage.includes('initiate') || lowerMessage.includes('go') || lowerMessage.includes('start')) {
          invokedSpecialistId = 'lead_hunter';
          response = `Starting now. I'm scanning for prospects in your target verticals and queuing up conversion emails for review. Should have the first batch of leads ready in a few minutes - I'll let you know.`;
        }
        // Name invocation
        else if (nameInvoked) {
          response = `${stats.totalOrgs} organizations active right now. What do you need?`;
        }
        // Default response
        else {
          response = `${stats.totalOrgs} organizations active, ${stats.activeAgents} operations running. What would you like me to work on?`;
        }
      }
      // CLIENT/MERCHANT RESPONSES - Assistant as Internal Business Partner
      else {
        const industryContext = config.merchantInfo?.industry || 'your business';

        // Task execution with name invocation
        if (industryMatchedSpecialist && nameInvoked) {
          invokedSpecialistId = industryMatchedSpecialist as SpecialistPlatform;
          const taskDescription = userMessage.replace(new RegExp(assistantName + ',?\\s*', 'i'), '');
          response = `On it. Working on "${taskDescription}" now - I'll have something for you shortly.`;
        }
        // General task matching
        else if (matchedSpecialists.length > 0) {
          invokedSpecialistId = matchedSpecialists[0].id;
          response = `I can handle that. Starting now.`;
        }
        // Status request
        else if (lowerMessage.includes('status') || lowerMessage.includes('dashboard')) {
          response = `Pulling up your ${industryContext} dashboard now. What metrics are you looking for?`;
        }
        // Name invocation
        else if (nameInvoked) {
          response = `I'm here. What do you need me to work on?`;
        }
        // Default - natural conversation
        else {
          response = `I'm tracking your ${industryContext} operations. What would you like me to focus on?`;
        }
      }

      addMessage({
        role: 'assistant',
        content: response,
        metadata: invokedSpecialistId ? { specialistInvoked: invokedSpecialistId } : undefined,
      });
      setTyping(false);
    }, 1000);
  }, [input, isTyping, addMessage, setTyping, config]);

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
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-sm">
                    {config.assistantName || (config.context === 'admin' ? 'Jasper' : config.merchantInfo?.assistantName || 'AI Assistant')}
                  </h3>
                  <p className="text-gray-400 text-xs">
                    {config.context === 'admin' ? 'Strategic Growth Architect' : 'Your Business Partner'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
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
                  placeholder="Ask me anything..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                />
                <button
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

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

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
        <div className="text-sm whitespace-pre-wrap leading-relaxed">
          {message.content.split('**').map((part, i) =>
            i % 2 === 1 ? <strong key={i}>{part}</strong> : part
          )}
        </div>
        {/* REMOVED: Specialist metadata display - Jasper is the sole voice */}
      </div>
    </motion.div>
  );
}

export default OrchestratorBase;
