'use client';

/**
 * RecoveryInsights Component
 *
 * AI-generated insights and recommendations for improving recovery rates.
 * Actionable intelligence for the Revenue Officer.
 */

import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle, TrendingUp, Zap } from 'lucide-react';

export interface RecoveryInsight {
  id: string;
  type: 'success' | 'warning' | 'opportunity' | 'alert';
  title: string;
  description: string;
  metric?: string;
  recommendation?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

interface RecoveryInsightsProps {
  insights: RecoveryInsight[];
}

export function RecoveryInsights({ insights }: RecoveryInsightsProps) {
  const getInsightIcon = (type: RecoveryInsight['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-success" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-warning" />;
      case 'opportunity':
        return <TrendingUp className="w-5 h-5 text-primary" />;
      case 'alert':
        return <Zap className="w-5 h-5 text-error" />;
    }
  };

  const getInsightColor = (type: RecoveryInsight['type']) => {
    switch (type) {
      case 'success':
        return 'from-success/20 to-success/5 border-success/30';
      case 'warning':
        return 'from-warning/20 to-warning/5 border-warning/30';
      case 'opportunity':
        return 'from-primary/20 to-primary/5 border-primary/30';
      case 'alert':
        return 'from-error/20 to-error/5 border-error/30';
    }
  };

  const getPriorityBadge = (priority: RecoveryInsight['priority']) => {
    const colors: Record<string, string> = {
      low: 'bg-[var(--color-text-disabled)]/20 text-[var(--color-text-disabled)] border-[var(--color-text-disabled)]/30',
      medium: 'bg-primary/20 text-primary border-primary/30',
      high: 'bg-warning/20 text-warning border-warning/30',
      critical: 'bg-error/20 text-error border-error/30',
    };

    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${colors[priority]}`}>
        {priority.toUpperCase()}
      </span>
    );
  };

  // Sort by priority
  const sortedInsights = [...insights].sort((a, b) => {
    const priorityOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-[var(--color-text-primary)] text-lg font-semibold">AI-Generated Insights</h3>
        <span className="text-[var(--color-text-secondary)] text-sm">{insights.length} insights</span>
      </div>

      {sortedInsights.length === 0 ? (
        <div className="rounded-2xl bg-surface-paper border border-border-light backdrop-blur-xl p-12 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <p className="text-[var(--color-text-primary)] font-semibold mb-2">All systems optimal!</p>
          <p className="text-[var(--color-text-secondary)] text-sm">
            No critical insights at the moment. Keep up the great work!
          </p>
        </div>
      ) : (
        sortedInsights.map((insight, idx) => (
          <motion.div
            key={insight.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            className={`rounded-xl bg-gradient-to-br ${getInsightColor(insight.type)} border backdrop-blur-xl p-5`}
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 mt-1">{getInsightIcon(insight.type)}</div>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h4 className="text-[var(--color-text-primary)] font-semibold">{insight.title}</h4>
                  {getPriorityBadge(insight.priority)}
                </div>
                <p className="text-[var(--color-text-secondary)] text-sm mb-3">{insight.description}</p>

                {insight.metric && (
                  <div className="mb-3 px-3 py-2 rounded-lg bg-surface-main inline-block">
                    <p className="text-[var(--color-text-primary)] text-xs font-mono">{insight.metric}</p>
                  </div>
                )}

                {insight.recommendation && (
                  <div className="mt-3 pt-3 border-t border-border-light">
                    <p className="text-[var(--color-text-secondary)] text-xs font-medium mb-1">Recommendation:</p>
                    <p className="text-[var(--color-text-primary)] text-sm">{insight.recommendation}</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))
      )}
    </div>
  );
}

export default RecoveryInsights;
