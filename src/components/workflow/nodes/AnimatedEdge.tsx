'use client';

/**
 * AnimatedEdge
 * Custom ReactFlow edge with animated dash stroke and optional label.
 * Used for connections between workflow nodes.
 */

import { memo } from 'react';
import { getBezierPath, EdgeLabelRenderer, type EdgeProps } from 'reactflow';

function AnimatedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  label,
  data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Determine edge color from data or default
  const edgeColor = (data as Record<string, unknown> | undefined)?.color as string | undefined;
  const strokeColor = edgeColor ?? 'var(--color-border-main)';
  const isConditionTrue = label === 'Yes';
  const isConditionFalse = label === 'No';

  let labelColor = 'var(--color-text-secondary)';
  let labelBg = 'var(--color-bg-elevated)';
  if (isConditionTrue) {
    labelColor = '#34d399';
    labelBg = 'rgba(16, 185, 129, 0.15)';
  } else if (isConditionFalse) {
    labelColor = '#f87171';
    labelBg = 'rgba(248, 113, 113, 0.15)';
  }

  return (
    <>
      <path
        id={id}
        style={{
          ...style,
          stroke: strokeColor,
          strokeWidth: 2,
          fill: 'none',
          strokeDasharray: '6 4',
          animation: 'dashFlow 1s linear infinite',
        }}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />
      {/* Invisible wider path for easier selection */}
      <path
        style={{
          stroke: 'transparent',
          strokeWidth: 20,
          fill: 'none',
        }}
        d={edgePath}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: 11,
              fontWeight: 600,
              color: labelColor,
              backgroundColor: labelBg,
              padding: '2px 8px',
              borderRadius: 6,
              border: `1px solid ${labelColor}40`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default memo(AnimatedEdge);
