'use client';

import Link from 'next/link';

interface PipelineStage {
  name: string;
  count: number;
  value: number;
  color: string;
}

interface LeadPipelineWidgetProps {
  compact?: boolean;
  stages?: PipelineStage[];
}

const DEFAULT_STAGES: PipelineStage[] = [
  { name: 'New', count: 0, value: 0, color: 'var(--color-info)' },
  { name: 'Qualified', count: 0, value: 0, color: 'var(--color-primary)' },
  { name: 'Proposal', count: 0, value: 0, color: 'var(--color-warning)' },
  { name: 'Negotiation', count: 0, value: 0, color: 'var(--color-success)' },
  { name: 'Closed', count: 0, value: 0, color: 'var(--color-success)' },
];

export function LeadPipelineWidget({ compact = false, stages = DEFAULT_STAGES }: LeadPipelineWidgetProps) {
  const totalLeads = stages.reduce((sum, s) => sum + s.count, 0);
  const totalValue = stages.reduce((sum, s) => sum + s.value, 0);

  return (
    <div className="bg-[var(--color-bg-paper)] border border-[var(--color-border)] rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Lead Pipeline</h3>
        <Link href="/leads" className="text-sm text-[var(--color-primary)] hover:underline">
          View All
        </Link>
      </div>

      {/* Pipeline Summary */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-[var(--color-bg-primary)] rounded-lg p-4">
          <div className="text-2xl font-bold text-[var(--color-text-primary)]">{totalLeads}</div>
          <div className="text-xs text-[var(--color-text-secondary)]">Total Leads</div>
        </div>
        <div className="bg-[var(--color-bg-primary)] rounded-lg p-4">
          <div className="text-2xl font-bold text-[var(--color-text-primary)]">
            ${totalValue.toLocaleString()}
          </div>
          <div className="text-xs text-[var(--color-text-secondary)]">Pipeline Value</div>
        </div>
      </div>

      {!compact && (
        <>
          {/* Pipeline Stages */}
          <div className="space-y-3">
            {stages.map((stage) => (
              <div key={stage.name} className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: stage.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--color-text-primary)]">{stage.name}</span>
                    <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {stage.count}
                    </span>
                  </div>
                  <div className="h-1.5 bg-[var(--color-bg-elevated)] rounded-full mt-1">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        backgroundColor: stage.color,
                        width: totalLeads > 0 ? `${(stage.count / totalLeads) * 100}%` : '0%',
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="mt-6 pt-4 border-t border-[var(--color-border)]">
            <button className="w-full py-2.5 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
              Add New Lead
            </button>
          </div>
        </>
      )}

      {compact && totalLeads === 0 && (
        <div className="text-center py-4">
          <p className="text-sm text-[var(--color-text-secondary)]">No leads in pipeline</p>
          <Link
            href="/leads"
            className="inline-block mt-2 text-sm text-[var(--color-primary)] hover:underline"
          >
            Add your first lead
          </Link>
        </div>
      )}
    </div>
  );
}
