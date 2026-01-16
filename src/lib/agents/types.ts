// STATUS: FOUNDATION - Core types for the Agent Swarm
// All agents must implement these interfaces

export type AgentStatus = 'GHOST' | 'UNBUILT' | 'SHELL' | 'FUNCTIONAL' | 'TESTED';

export interface AgentIdentity {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  reportsTo: string | null;
  capabilities: string[];
}

export interface AgentMessage {
  id: string;
  timestamp: Date;
  from: string;
  to: string;
  type: 'COMMAND' | 'QUERY' | 'REPORT' | 'ALERT' | 'HANDOFF';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  payload: unknown;
  requiresResponse: boolean;
  traceId: string; // For tracking message chains
}

export interface AgentReport {
  agentId: string;
  timestamp: Date;
  taskId: string;
  status: 'STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'BLOCKED';
  data: unknown;
  errors?: string[];
  nextSteps?: string[];
}

export interface SpecialistConfig {
  identity: AgentIdentity;
  systemPrompt: string;
  tools: string[];
  outputSchema: Record<string, unknown>;
  maxTokens: number;
  temperature: number;
}

export interface ManagerConfig extends SpecialistConfig {
  specialists: string[];
  delegationRules: DelegationRule[];
}

export interface DelegationRule {
  triggerKeywords: string[];
  delegateTo: string;
  priority: number;
  requiresApproval: boolean;
}

// Signal Bus Types
export interface Signal {
  id: string;
  type: 'BROADCAST' | 'DIRECT' | 'BUBBLE_UP' | 'BUBBLE_DOWN';
  origin: string;
  target: string; // Agent ID, or broadcast targets: 'ALL' | 'MANAGERS' | 'SPECIALISTS'
  payload: AgentMessage;
  hops: string[]; // Track signal path
  maxHops: number;
  createdAt: Date;
  expiresAt: Date;
}

export interface SignalHandler {
  agentId: string;
  canHandle: (signal: Signal) => boolean;
  handle: (signal: Signal) => Promise<AgentReport>;
}

// Swarm State
export interface SwarmState {
  activeAgents: Map<string, AgentIdentity>;
  pendingSignals: Signal[];
  completedTasks: string[];
  errorLog: Array<{ agentId: string; error: string; timestamp: Date }>;
}
