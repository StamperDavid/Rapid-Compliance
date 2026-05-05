/**
 * Next Best Action Engine — type-only exports.
 *
 * Lives apart from next-best-action-engine.ts so client components can
 * `import type { ActionRecommendations }` without dragging the engine's
 * dependency chain into the browser bundle.
 */

import type { DealHealthScore } from './deal-health-types';

export interface NextBestAction {
  id: string;
  type: ActionType;
  priority: 'High' | 'Medium' | 'Low';
  confidence: number; // 0-1
  title: string;
  description: string;
  reasoning: string[];
  suggestedTimeline: string;
  estimatedImpact: 'High' | 'Medium' | 'Low';
  automatable: boolean;
  metadata?: Record<string, unknown>;
}

export type ActionType =
  | 'call'
  | 'email'
  | 'meeting'
  | 'proposal'
  | 'followup'
  | 'discount'
  | 'escalate'
  | 'nurture'
  | 'close'
  | 'reassess'
  | 'research';

export interface ActionRecommendations {
  dealId: string;
  dealName: string;
  actions: NextBestAction[];
  healthScore: DealHealthScore;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  generatedAt: Date;
  confidence: number;
}
