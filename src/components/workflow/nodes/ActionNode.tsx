'use client';

/**
 * ActionNode
 * Custom ReactFlow node for workflow actions.
 * Indigo/blue accent with input and output handles.
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { FlowNodeData } from './types';

function ActionNode({ data, selected }: NodeProps<FlowNodeData>) {
  return (
    <div
      className={`
        relative min-w-[220px] max-w-[280px] rounded-xl border-2 transition-all duration-200
        ${selected
          ? 'border-indigo-400 shadow-lg shadow-indigo-500/20'
          : 'border-indigo-500/40 hover:border-indigo-400/60 hover:shadow-md hover:shadow-indigo-500/10'
        }
      `}
      style={{ backgroundColor: 'var(--color-bg-elevated)' }}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !border-2 !border-indigo-400 !bg-indigo-500/80 !-top-1.5"
      />

      {/* Indigo accent top bar */}
      <div
        className="h-1.5 rounded-t-[10px]"
        style={{ background: 'linear-gradient(90deg, #6366f1, #818cf8)' }}
      />

      <div className="px-4 py-3">
        {/* Header row: icon + type badge */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-lg shrink-0">
            {data.icon}
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400 bg-indigo-500/15 px-2 py-0.5 rounded-full">
            Action
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
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !border-2 !border-indigo-400 !bg-indigo-500/80 !-bottom-1.5"
      />
    </div>
  );
}

export default memo(ActionNode);
