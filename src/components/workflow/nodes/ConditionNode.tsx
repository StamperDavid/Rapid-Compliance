'use client';

/**
 * ConditionNode
 * Custom ReactFlow node for conditional/branching logic.
 * Amber accent with one input and two output handles (true/false).
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { FlowNodeData } from './types';

function ConditionNode({ data, selected }: NodeProps<FlowNodeData>) {
  return (
    <div
      className={`
        relative min-w-[220px] max-w-[280px] rounded-xl border-2 transition-all duration-200
        ${selected
          ? 'border-amber-400 shadow-lg shadow-amber-500/20'
          : 'border-amber-500/40 hover:border-amber-400/60 hover:shadow-md hover:shadow-amber-500/10'
        }
      `}
      style={{ backgroundColor: 'var(--color-bg-elevated)' }}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !border-2 !border-amber-400 !bg-amber-500/80 !-top-1.5"
      />

      {/* Amber accent top bar */}
      <div
        className="h-1.5 rounded-t-[10px]"
        style={{ background: 'linear-gradient(90deg, #f59e0b, #fbbf24)' }}
      />

      <div className="px-4 py-3">
        {/* Header row: icon + type badge */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-lg shrink-0">
            {data.icon}
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-full">
            Condition
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

        {/* Branch labels */}
        <div className="flex items-center justify-between mt-3 pt-2 border-t" style={{ borderColor: 'var(--color-border-light)' }}>
          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
            True
          </span>
          <span className="text-[10px] font-semibold text-red-400 bg-red-500/10 px-2 py-0.5 rounded">
            False
          </span>
        </div>
      </div>

      {/* True output handle (left-bottom) */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        className="!w-3 !h-3 !border-2 !border-emerald-400 !bg-emerald-500/80 !-bottom-1.5"
        style={{ left: '30%' }}
      />

      {/* False output handle (right-bottom) */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        className="!w-3 !h-3 !border-2 !border-red-400 !bg-red-500/80 !-bottom-1.5"
        style={{ left: '70%' }}
      />
    </div>
  );
}

export default memo(ConditionNode);
