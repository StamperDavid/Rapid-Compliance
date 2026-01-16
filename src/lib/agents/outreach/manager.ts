// STATUS: SHELL - INCOMPLETE LOGIC
// Outreach Manager - Coordinates email and SMS specialists

import { BaseManager } from '../base-manager';
import type { AgentMessage, AgentReport, ManagerConfig, Signal } from '../types';

const OUTREACH_MANAGER_CONFIG: ManagerConfig = {
  identity: {
    id: 'OUTREACH_MANAGER',
    name: 'Outreach Manager',
    role: 'manager',
    status: 'SHELL',
    reportsTo: 'JASPER',
    capabilities: [
      'email_campaign_coordination',
      'sms_campaign_coordination',
      'sequence_management',
    ],
  },
  systemPrompt: `You are the Outreach Manager, responsible for customer communication.
Your specialists:
- EMAIL_SPECIALIST: Email campaigns and sequences
- SMS_SPECIALIST: SMS marketing and notifications`,
  tools: ['delegate', 'schedule_campaign', 'analyze_deliverability'],
  outputSchema: {},
  maxTokens: 4096,
  temperature: 0.3,
  specialists: ['EMAIL_SPECIALIST', 'SMS_SPECIALIST'],
  delegationRules: [
    {
      triggerKeywords: ['email', 'newsletter', 'drip', 'sequence', 'inbox'],
      delegateTo: 'EMAIL_SPECIALIST',
      priority: 10,
      requiresApproval: false,
    },
    {
      triggerKeywords: ['sms', 'text message', 'mobile', 'short code'],
      delegateTo: 'SMS_SPECIALIST',
      priority: 10,
      requiresApproval: false,
    },
  ],
};

export class OutreachManager extends BaseManager {
  constructor() {
    super(OUTREACH_MANAGER_CONFIG);
  }

  initialize(): Promise<void> {
    this.isInitialized = true;
    return Promise.resolve();
  }

  execute(message: AgentMessage): Promise<AgentReport> {
    return Promise.resolve(this.createReport(
      message.id,
      'BLOCKED',
      { reason: 'OUTREACH_MANAGER_IS_SHELL' }
    ));
  }

  handleSignal(signal: Signal): Promise<AgentReport> {
    return Promise.resolve(this.createReport(signal.id, 'BLOCKED', {}));
  }

  generateReport(taskId: string, data: unknown): AgentReport {
    return this.createReport(taskId, 'COMPLETED', data);
  }

  hasRealLogic(): boolean {
    return false;
  }

  getFunctionalLOC(): { functional: number; boilerplate: number } {
    return { functional: 0, boilerplate: 55 };
  }
}
