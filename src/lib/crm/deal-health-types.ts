/**
 * Deal Health — type-only exports.
 *
 * This file MUST stay free of runtime imports. It exists so client
 * components can `import type { DealHealthScore }` without dragging the
 * full deal-health → deal-service → event-triggers → sequence-scheduler
 * → google-calendar-service → googleapis chain into the browser bundle.
 * Even type-only imports get walked by webpack when the source file
 * also exports runtime values.
 */

export interface DealHealthScore {
  overall: number; // 0-100 (higher is healthier)
  status: 'healthy' | 'at-risk' | 'critical';
  factors: DealHealthFactor[];
  warnings: string[];
  recommendations: string[];
}

export interface DealHealthFactor {
  name: string;
  score: number; // 0-100
  weight: number; // How important this factor is
  impact: 'positive' | 'negative' | 'neutral';
  description: string;
}
