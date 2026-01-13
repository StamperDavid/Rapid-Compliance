/**
 * Recovery Sequences
 *
 * Multi-channel siege timing with escalating urgency.
 *
 * Strategy:
 * - Email #1: 1 hour after abandonment (soft reminder)
 * - Email #2: 4 hours later (value proposition)
 * - SMS #1: 24 hours later (personal touch)
 * - Voice #1: 48 hours later (high-intent recovery)
 */

export interface RecoveryStep {
  channel: 'email' | 'sms' | 'voice';
  template: string;
  delayMs: number;
}

export interface RecoverySequence {
  name: string;
  steps: RecoveryStep[];
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * Get recovery sequence based on where user dropped off
 */
export function getRecoverySequence(abandonedStep: string | null): RecoverySequence {
  // Early abandonment (step 1 - industry selection)
  if (abandonedStep === 'industry') {
    return {
      name: 'early_abandonment',
      steps: [
        { channel: 'email', template: 'welcome_back_soft', delayMs: 1 * HOUR },
        { channel: 'email', template: 'industry_guide', delayMs: 4 * HOUR },
        { channel: 'sms', template: 'quick_setup', delayMs: 1 * DAY },
      ],
    };
  }

  // Account setup abandonment (step 2)
  if (abandonedStep === 'account') {
    return {
      name: 'account_abandonment',
      steps: [
        { channel: 'email', template: 'account_reminder', delayMs: 1 * HOUR },
        { channel: 'sms', template: 'finish_signup', delayMs: 4 * HOUR },
        { channel: 'email', template: 'value_reminder', delayMs: 1 * DAY },
        { channel: 'voice', template: 'personal_assist', delayMs: 2 * DAY },
      ],
    };
  }

  // Business setup abandonment (step 3 - high intent)
  if (abandonedStep === 'business') {
    return {
      name: 'business_abandonment',
      steps: [
        { channel: 'email', template: 'account_reminder', delayMs: 30 * 60 * 1000 }, // 30 min
        { channel: 'sms', template: 'finish_signup', delayMs: 2 * HOUR },
        { channel: 'voice', template: 'personal_assist', delayMs: 1 * DAY },
        { channel: 'sms', template: 'final_offer', delayMs: 2 * DAY },
      ],
    };
  }

  // Default standard sequence
  return {
    name: 'standard_recovery',
    steps: [
      { channel: 'email', template: 'come_back', delayMs: 1 * HOUR },
      { channel: 'email', template: 'value_reminder', delayMs: 4 * HOUR },
      { channel: 'sms', template: 'personal_reach', delayMs: 1 * DAY },
      { channel: 'voice', template: 'final_offer', delayMs: 2 * DAY },
    ],
  };
}

/**
 * Get sequence step names for display
 */
export function getSequenceStepNames(): Record<string, string> {
  return {
    welcome_back_soft: 'Welcome Back (Soft)',
    industry_guide: 'Industry Guide',
    account_reminder: 'Account Reminder',
    come_back: 'Come Back',
    value_reminder: 'Value Proposition',
    quick_setup: 'Quick Setup SMS',
    finish_signup: 'Finish Signup SMS',
    personal_reach: 'Personal Reach SMS',
    final_offer: 'Final Offer',
    personal_assist: 'Personal Assist Call',
  };
}
