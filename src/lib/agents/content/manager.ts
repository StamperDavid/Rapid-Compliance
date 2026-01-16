// STATUS: SHELL - INCOMPLETE LOGIC
// Content Manager - Coordinates copywriter and calendar specialists

import { BaseManager } from '../base-manager';
import type { AgentMessage, AgentReport, ManagerConfig, Signal } from '../types';

const CONTENT_MANAGER_CONFIG: ManagerConfig = {
  identity: {
    id: 'CONTENT_MANAGER',
    name: 'Content Manager',
    role: 'manager',
    status: 'SHELL',
    reportsTo: 'JASPER',
    capabilities: [
      'content_strategy',
      'copywriting_coordination',
      'editorial_calendar',
    ],
  },
  systemPrompt: `You are the Content Manager, responsible for all content creation and scheduling.
Your specialists:
- COPYWRITER: Headlines, ad copy, landing pages
- CALENDAR_COORDINATOR: Content scheduling and publishing`,
  tools: ['delegate', 'review_content', 'schedule_publish'],
  outputSchema: {},
  maxTokens: 4096,
  temperature: 0.5,
  specialists: ['COPYWRITER', 'CALENDAR_COORDINATOR'],
  delegationRules: [
    {
      triggerKeywords: ['copy', 'headline', 'write', 'content', 'blog', 'article'],
      delegateTo: 'COPYWRITER',
      priority: 10,
      requiresApproval: false,
    },
    {
      triggerKeywords: ['calendar', 'schedule', 'publish', 'deadline', 'editorial'],
      delegateTo: 'CALENDAR_COORDINATOR',
      priority: 10,
      requiresApproval: false,
    },
  ],
};

export class ContentManager extends BaseManager {
  constructor() {
    super(CONTENT_MANAGER_CONFIG);
  }

  initialize(): Promise<void> {
    this.isInitialized = true;
    return Promise.resolve();
  }

  execute(message: AgentMessage): Promise<AgentReport> {
    return Promise.resolve(this.createReport(
      message.id,
      'BLOCKED',
      { reason: 'CONTENT_MANAGER_IS_SHELL' }
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
