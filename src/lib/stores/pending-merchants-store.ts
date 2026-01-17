/**
 * Pending Merchants Store
 *
 * Captures contact info immediately on step 1 of onboarding.
 * Enables multi-channel recovery siege when leads abandon.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type RecoveryStatus =
  | 'active'
  | 'abandoned'
  | 'recovery_email_1'
  | 'recovery_email_2'
  | 'recovery_sms_1'
  | 'recovery_voice_1'
  | 'recovered'
  | 'converted';

export type DropOffReason =
  | 'price_concern'
  | 'feature_confusion'
  | 'timing_not_right'
  | 'technical_issue'
  | 'unknown'
  | null;

export type RecoverySource =
  | 'email_1'
  | 'email_2'
  | 'sms_1'
  | 'voice_1'
  | 'organic'
  | null;

export interface PendingMerchant {
  id: string;
  email: string;
  fullName: string;
  phoneNumber?: string;
  industry?: string;
  industryName?: string;
  customIndustry?: string;
  nicheDescription?: string;
  companyName?: string;

  // Abandonment tracking
  stepAbandoned: 'industry' | 'account' | 'business' | null;
  abandonedAt: string | null;

  // Recovery tracking
  recoveryStatus: RecoveryStatus;
  recoverySource: RecoverySource;
  recoveryTimestamp: string | null;
  dropOffReason: DropOffReason;

  // Channel metrics
  emailsSent: number;
  smsSent: number;
  voiceCallsAttempted: number;
  lastContactedAt: string | null;

  // Engagement metrics
  emailsOpened: number;
  emailsClicked: number;
  smsReplies: number;

  // Timestamps
  createdAt: string;
  updatedAt: string;

  // Attribution
  sessionId?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

interface PendingMerchantState {
  currentMerchant: PendingMerchant | null;
  merchants: Record<string, PendingMerchant>;

  // Actions
  initializeMerchant: (data: Partial<PendingMerchant>) => string;
  updateMerchant: (data: Partial<PendingMerchant>) => void;
  markAbandoned: (step: PendingMerchant['stepAbandoned'], reason: DropOffReason) => void;
  markRecovered: (source: RecoverySource) => void;
  markConverted: () => void;

  // Channel tracking
  recordEmailSent: () => void;
  recordSmsSent: () => void;
  recordVoiceCall: () => void;
  recordEmailOpened: () => void;
  recordEmailClicked: () => void;
  updateRecoveryStatus: (status: RecoveryStatus) => void;

  // Utilities
  getMerchant: (id: string) => PendingMerchant | null;
  getAbandonedMerchants: () => PendingMerchant[];
  clearCurrentMerchant: () => void;
}

const generateId = () => `pm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const usePendingMerchantStore = create<PendingMerchantState>()(
  persist(
    (set, get) => ({
      currentMerchant: null,
      merchants: {},

      initializeMerchant: (data) => {
        const id = generateId();
        const now = new Date().toISOString();

        const merchant: PendingMerchant = {
          id,
          email: data.email || '',
          fullName: data.fullName || '',
          phoneNumber: data.phoneNumber,
          industry: data.industry,
          industryName: data.industryName,
          customIndustry: data.customIndustry,
          nicheDescription: data.nicheDescription,
          companyName: data.companyName,

          stepAbandoned: null,
          abandonedAt: null,

          recoveryStatus: 'active',
          recoverySource: null,
          recoveryTimestamp: null,
          dropOffReason: null,

          emailsSent: 0,
          smsSent: 0,
          voiceCallsAttempted: 0,
          lastContactedAt: null,

          emailsOpened: 0,
          emailsClicked: 0,
          smsReplies: 0,

          createdAt: now,
          updatedAt: now,

          sessionId: data.sessionId,
          utmSource: data.utmSource,
          utmMedium: data.utmMedium,
          utmCampaign: data.utmCampaign,
        };

        set((state) => ({
          currentMerchant: merchant,
          merchants: { ...state.merchants, [id]: merchant },
        }));

        return id;
      },

      updateMerchant: (data) => {
        set((state) => {
          if (!state.currentMerchant) {return state;}

          const updated = {
            ...state.currentMerchant,
            ...data,
            updatedAt: new Date().toISOString(),
          };

          return {
            currentMerchant: updated,
            merchants: { ...state.merchants, [updated.id]: updated },
          };
        });
      },

      markAbandoned: (step, reason) => {
        set((state) => {
          if (!state.currentMerchant) {return state;}

          const updated = {
            ...state.currentMerchant,
            stepAbandoned: step,
            abandonedAt: new Date().toISOString(),
            recoveryStatus: 'abandoned' as RecoveryStatus,
            dropOffReason: reason,
            updatedAt: new Date().toISOString(),
          };

          return {
            currentMerchant: updated,
            merchants: { ...state.merchants, [updated.id]: updated },
          };
        });
      },

      markRecovered: (source) => {
        set((state) => {
          if (!state.currentMerchant) {return state;}

          const updated = {
            ...state.currentMerchant,
            recoveryStatus: 'recovered' as RecoveryStatus,
            recoverySource: source,
            recoveryTimestamp: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          return {
            currentMerchant: updated,
            merchants: { ...state.merchants, [updated.id]: updated },
          };
        });
      },

      markConverted: () => {
        set((state) => {
          if (!state.currentMerchant) {return state;}

          const updated = {
            ...state.currentMerchant,
            recoveryStatus: 'converted' as RecoveryStatus,
            updatedAt: new Date().toISOString(),
          };

          return {
            currentMerchant: updated,
            merchants: { ...state.merchants, [updated.id]: updated },
          };
        });
      },

      recordEmailSent: () => {
        set((state) => {
          if (!state.currentMerchant) {return state;}

          const updated = {
            ...state.currentMerchant,
            emailsSent: state.currentMerchant.emailsSent + 1,
            lastContactedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          return {
            currentMerchant: updated,
            merchants: { ...state.merchants, [updated.id]: updated },
          };
        });
      },

      recordSmsSent: () => {
        set((state) => {
          if (!state.currentMerchant) {return state;}

          const updated = {
            ...state.currentMerchant,
            smsSent: state.currentMerchant.smsSent + 1,
            lastContactedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          return {
            currentMerchant: updated,
            merchants: { ...state.merchants, [updated.id]: updated },
          };
        });
      },

      recordVoiceCall: () => {
        set((state) => {
          if (!state.currentMerchant) {return state;}

          const updated = {
            ...state.currentMerchant,
            voiceCallsAttempted: state.currentMerchant.voiceCallsAttempted + 1,
            lastContactedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          return {
            currentMerchant: updated,
            merchants: { ...state.merchants, [updated.id]: updated },
          };
        });
      },

      recordEmailOpened: () => {
        set((state) => {
          if (!state.currentMerchant) {return state;}

          const updated = {
            ...state.currentMerchant,
            emailsOpened: state.currentMerchant.emailsOpened + 1,
            updatedAt: new Date().toISOString(),
          };

          return {
            currentMerchant: updated,
            merchants: { ...state.merchants, [updated.id]: updated },
          };
        });
      },

      recordEmailClicked: () => {
        set((state) => {
          if (!state.currentMerchant) {return state;}

          const updated = {
            ...state.currentMerchant,
            emailsClicked: state.currentMerchant.emailsClicked + 1,
            updatedAt: new Date().toISOString(),
          };

          return {
            currentMerchant: updated,
            merchants: { ...state.merchants, [updated.id]: updated },
          };
        });
      },

      updateRecoveryStatus: (status) => {
        set((state) => {
          if (!state.currentMerchant) {return state;}

          const updated = {
            ...state.currentMerchant,
            recoveryStatus: status,
            updatedAt: new Date().toISOString(),
          };

          return {
            currentMerchant: updated,
            merchants: { ...state.merchants, [updated.id]: updated },
          };
        });
      },

      getMerchant: (id) => {
        return get().merchants[id] || null;
      },

      getAbandonedMerchants: () => {
        return Object.values(get().merchants).filter(
          (m) => m.recoveryStatus === 'abandoned'
        );
      },

      clearCurrentMerchant: () => {
        set({ currentMerchant: null });
      },
    }),
    {
      name: 'pending-merchants-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentMerchant: state.currentMerchant,
        merchants: state.merchants,
      }),
    }
  )
);
