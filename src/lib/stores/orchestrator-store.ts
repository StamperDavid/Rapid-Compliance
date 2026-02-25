/**
 * Orchestrator UI Store
 *
 * Manages the state for the floating AI Orchestrator assistants
 * (Merchant and Admin contexts) including chat history, modal visibility,
 * and feedback/support ticket states.
 *
 * @module orchestrator-store
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ============================================================================
// TYPES
// ============================================================================

export type OrchestratorContext = 'merchant' | 'admin';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    toolUsed?: string;
    specialistInvoked?: string;
    actionTaken?: string;
    missionId?: string;
  };
}

export interface SupportTicket {
  title: string;
  severity: 'low' | 'high' | 'critical';
  description: string;
}

export interface FeatureRequest {
  featureName: string;
  businessImpact: string;
}

export type FeedbackPath = 'support' | 'feature';

export interface OrchestratorUIState {
  // Chat state
  isOpen: boolean;
  isMinimized: boolean;
  chatHistory: ChatMessage[];
  isTyping: boolean;

  // Welcome/onboarding state
  hasSeenWelcome: boolean;
  lastLoginBriefing: string | null;

  // Feedback modal state
  feedbackModalOpen: boolean;
  feedbackPath: FeedbackPath | null;
  pendingSupportTicket: Partial<SupportTicket>;
  pendingFeatureRequest: Partial<FeatureRequest>;

  // Context
  context: OrchestratorContext;

  // Actions
  setOpen: (open: boolean) => void;
  setMinimized: (minimized: boolean) => void;
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  setHistory: (messages: ChatMessage[]) => void;
  clearHistory: () => void;
  setTyping: (typing: boolean) => void;
  markWelcomeSeen: () => void;
  setLastBriefing: (briefing: string) => void;

  // Feedback actions
  openFeedbackModal: (path?: FeedbackPath) => void;
  closeFeedbackModal: () => void;
  setFeedbackPath: (path: FeedbackPath) => void;
  updateSupportTicket: (data: Partial<SupportTicket>) => void;
  updateFeatureRequest: (data: Partial<FeatureRequest>) => void;
  resetFeedbackForms: () => void;

  // Context actions
  setContext: (context: OrchestratorContext) => void;
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

const generateId = () => `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const useOrchestratorStore = create<OrchestratorUIState>()(
  persist(
    (set) => ({
      // Initial state
      isOpen: false,
      isMinimized: false,
      chatHistory: [],
      isTyping: false,
      hasSeenWelcome: false,
      lastLoginBriefing: null,
      feedbackModalOpen: false,
      feedbackPath: null,
      pendingSupportTicket: {},
      pendingFeatureRequest: {},
      context: 'merchant',

      // Chat actions
      setOpen: (open) => set({ isOpen: open, isMinimized: false }),

      setMinimized: (minimized) => set({ isMinimized: minimized }),

      addMessage: (message) => set((state) => ({
        chatHistory: [
          ...state.chatHistory,
          {
            ...message,
            id: generateId(),
            timestamp: new Date(),
          },
        ],
      })),

      setHistory: (messages) => set({ chatHistory: messages }),

      clearHistory: () => set({ chatHistory: [] }),

      setTyping: (typing) => set({ isTyping: typing }),

      markWelcomeSeen: () => set({ hasSeenWelcome: true }),

      setLastBriefing: (briefing) => set({ lastLoginBriefing: briefing }),

      // Feedback actions
      openFeedbackModal: (path) => set({
        feedbackModalOpen: true,
        feedbackPath: path ?? null
      }),

      closeFeedbackModal: () => set({
        feedbackModalOpen: false,
        feedbackPath: null,
      }),

      setFeedbackPath: (path) => set({ feedbackPath: path }),

      updateSupportTicket: (data) => set((state) => ({
        pendingSupportTicket: { ...state.pendingSupportTicket, ...data },
      })),

      updateFeatureRequest: (data) => set((state) => ({
        pendingFeatureRequest: { ...state.pendingFeatureRequest, ...data },
      })),

      resetFeedbackForms: () => set({
        pendingSupportTicket: {},
        pendingFeatureRequest: {},
        feedbackPath: null,
      }),

      // Context actions
      setContext: (context) => set({ context }),
    }),
    {
      name: 'orchestrator-ui-state',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        hasSeenWelcome: state.hasSeenWelcome,
        context: state.context,
        // Don't persist chat history or modal states
      }),
    }
  )
);

// ============================================================================
// SELECTOR HOOKS
// ============================================================================

export const useOrchestratorChat = () => useOrchestratorStore((state) => ({
  isOpen: state.isOpen,
  isMinimized: state.isMinimized,
  chatHistory: state.chatHistory,
  isTyping: state.isTyping,
  setOpen: state.setOpen,
  setMinimized: state.setMinimized,
  addMessage: state.addMessage,
  setHistory: state.setHistory,
  clearHistory: state.clearHistory,
  setTyping: state.setTyping,
}));

export const useOrchestratorFeedback = () => useOrchestratorStore((state) => ({
  feedbackModalOpen: state.feedbackModalOpen,
  feedbackPath: state.feedbackPath,
  pendingSupportTicket: state.pendingSupportTicket,
  pendingFeatureRequest: state.pendingFeatureRequest,
  openFeedbackModal: state.openFeedbackModal,
  closeFeedbackModal: state.closeFeedbackModal,
  setFeedbackPath: state.setFeedbackPath,
  updateSupportTicket: state.updateSupportTicket,
  updateFeatureRequest: state.updateFeatureRequest,
  resetFeedbackForms: state.resetFeedbackForms,
}));

export const useOrchestratorWelcome = () => useOrchestratorStore((state) => ({
  hasSeenWelcome: state.hasSeenWelcome,
  lastLoginBriefing: state.lastLoginBriefing,
  markWelcomeSeen: state.markWelcomeSeen,
  setLastBriefing: state.setLastBriefing,
}));
