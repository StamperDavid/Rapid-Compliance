'use client';

/**
 * TriggerNode
 * Custom ReactFlow node for workflow triggers.
 * Green accent with single output handle.
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { FlowNodeData } from './types';

function TriggerNode({ data, selected }: NodeProps<FlowNodeData>) {
  return (
    <div
      className={`
        relative min-w-[220px] max-w-[280px] rounded-xl border-2 transition-all duration-200
        ${selected
          ? 'border-emerald-400 shadow-lg shadow-emerald-500/20'
          : 'border-emerald-500/40 hover:border-emerald-400/60 hover:shadow-md hover:shadow-emerald-500/10'
        }
      `}
      style={{ backgroundColor: 'var(--color-bg-elevated)' }}
    >
      {/* Green accent top bar */}
      <div
        className="h-1.5 rounded-t-[10px]"
        style={{ background: 'linear-gradient(90deg, #10b981, #34d399)' }}
      />

      <div className="px-4 py-3">
        {/* Header row: icon + type badge */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-lg shrink-0">
            {data.icon}
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full">
            Trigger
          </span>
        </div>

        {/* Label */}
        <h3
          className="text-sm font-semibold truncate"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {data.label}
        </h3>

        {/* Description / config summary */}
        <p
          className="text-xs mt-1 truncate"
          style={{ color: 'var(--color-text-disabled)' }}
        >
          {data.description || 'Click to configure'}
        </p>

        {/* Status dot */}
        <div className="absolute top-3 right-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </div>
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !border-2 !border-emerald-400 !bg-emerald-500/80 !-bottom-1.5"
      />
    </div>
  );
}

export default memo(TriggerNode);
