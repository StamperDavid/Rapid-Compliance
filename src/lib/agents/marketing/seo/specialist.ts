// STATUS: GHOST - FILE EXISTS BUT NO LOGIC
// SEO Expert
// FUNCTIONAL LOC: 0

import { BaseSpecialist } from '../../base-specialist';
import type { AgentMessage, AgentReport, SpecialistConfig, Signal } from '../../types';

const CONFIG: SpecialistConfig = {
  identity: {
    id: 'SEO_EXPERT',
    name: 'SEO Expert',
    role: 'specialist',
    status: 'GHOST',
    reportsTo: 'MARKETING_MANAGER',
    capabilities: ['keyword_research', 'on_page_optimization', 'link_building', 'serp_analysis'],
  },
  systemPrompt: 'NOT IMPLEMENTED',
  tools: [],
  outputSchema: {},
  maxTokens: 4096,
  temperature: 0.3,
};

export class SEOExpert extends BaseSpecialist {
  constructor() { super(CONFIG); }
  async initialize(): Promise<void> { throw new Error('GHOST'); }
  async execute(_m: AgentMessage): Promise<AgentReport> { throw new Error('GHOST'); }
  async handleSignal(_s: Signal): Promise<AgentReport> { throw new Error('GHOST'); }
  generateReport(taskId: string, data: unknown): AgentReport { return this.createReport(taskId, 'FAILED', data); }
  hasRealLogic(): boolean { return false; }
  getFunctionalLOC() { return { functional: 0, boilerplate: 35 }; }
}
