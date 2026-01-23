'use client';

/**
 * WorkflowCanvas Component
 * Visual canvas for displaying and editing workflow steps
 */

import { useCallback } from 'react';

// Types for visual workflow representation
export interface WorkflowNode {
  id: string;
  type: 'trigger' | 'action' | 'condition';
  name: string;
  icon: string;
  config: Record<string, unknown>;
  position: number;
}

interface WorkflowCanvasProps {
  nodes: WorkflowNode[];
  selectedNodeId: string | null;
  onNodeSelect: (nodeId: string | null) => void;
  onNodeDelete: (nodeId: string) => void;
  onNodeReorder: (fromIndex: number, toIndex: number) => void;
  onAddNode: (afterIndex: number) => void;
}

export default function WorkflowCanvas({
  nodes,
  selectedNodeId,
  onNodeSelect,
  onNodeDelete,
  onNodeReorder,
  onAddNode,
}: WorkflowCanvasProps) {
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('nodeIndex', index.toString());
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData('nodeIndex'));
    if (fromIndex !== targetIndex) {
      onNodeReorder(fromIndex, targetIndex);
    }
  }, [onNodeReorder]);

  const getNodeTypeColor = (type: string) => {
    switch (type) {
      case 'trigger':
        return 'border-emerald-500/50 bg-emerald-500/10';
      case 'condition':
        return 'border-amber-500/50 bg-amber-500/10';
      case 'action':
      default:
        return 'border-indigo-500/50 bg-indigo-500/10';
    }
  };

  const getNodeTypeBadge = (type: string) => {
    switch (type) {
      case 'trigger':
        return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Trigger' };
      case 'condition':
        return { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Condition' };
      case 'action':
      default:
        return { bg: 'bg-indigo-500/20', text: 'text-indigo-400', label: 'Action' };
    }
  };

  return (
    <div className="h-full w-full overflow-auto p-6">
      {/* Canvas area */}
      <div className="min-h-full flex flex-col items-center">
        {/* Start marker */}
        <div className="flex flex-col items-center mb-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="text-xs text-gray-500 mt-2 font-medium">Start</span>
        </div>

        {/* Nodes */}
        {nodes.length === 0 ? (
          <div className="flex flex-col items-center py-8">
            {/* Connection line */}
            <div className="w-0.5 h-8 bg-gradient-to-b from-emerald-500/50 to-gray-700" />

            {/* Empty state add button */}
            <button
              onClick={() => onAddNode(-1)}
              className="mt-4 px-6 py-3 rounded-xl border-2 border-dashed border-gray-700 hover:border-indigo-500/50 bg-[#1a1a1a]/50 hover:bg-indigo-500/5 transition-all duration-200 group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center group-hover:bg-indigo-500/20 transition-colors">
                  <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-300">Add first step</p>
                  <p className="text-xs text-gray-500">Click to add a trigger</p>
                </div>
              </div>
            </button>
          </div>
        ) : (
          nodes.map((node, index) => (
            <div key={node.id} className="flex flex-col items-center w-full max-w-md">
              {/* Connection line */}
              <div className="w-0.5 h-8 bg-gradient-to-b from-gray-600 to-gray-700" />

              {/* Node card */}
              <div
                draggable={node.type !== 'trigger'}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
                onClick={() => onNodeSelect(node.id)}
                className={`
                  w-full p-4 rounded-xl border backdrop-blur-sm cursor-pointer
                  transition-all duration-200
                  ${getNodeTypeColor(node.type)}
                  ${selectedNodeId === node.id
                    ? 'ring-2 ring-indigo-500 shadow-lg shadow-indigo-500/10'
                    : 'hover:shadow-lg hover:shadow-white/5'
                  }
                `}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className={`
                    w-12 h-12 rounded-xl flex items-center justify-center text-2xl
                    ${node.type === 'trigger' ? 'bg-emerald-500/20' : node.type === 'condition' ? 'bg-amber-500/20' : 'bg-indigo-500/20'}
                  `}>
                    {node.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {(() => {
                        const badge = getNodeTypeBadge(node.type);
                        return (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
                            {badge.label}
                          </span>
                        );
                      })()}
                      <span className="text-xs text-gray-500">#{index + 1}</span>
                    </div>
                    <h3 className="text-sm font-semibold text-gray-100 truncate">{node.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {getNodeDescription(node)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {node.type !== 'trigger' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNodeDelete(node.id);
                        }}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Add button between nodes */}
              <div className="w-0.5 h-4 bg-gray-700" />
              <button
                onClick={() => onAddNode(index)}
                className="w-8 h-8 rounded-full border border-gray-700 bg-[#1a1a1a] hover:border-indigo-500/50 hover:bg-indigo-500/10 flex items-center justify-center transition-all duration-200 group"
                title="Add step"
              >
                <svg className="w-4 h-4 text-gray-500 group-hover:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          ))
        )}

        {/* End marker */}
        {nodes.length > 0 && (
          <>
            <div className="w-0.5 h-8 bg-gradient-to-b from-gray-700 to-gray-600/50" />
            <div className="flex flex-col items-center mt-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-xs text-gray-500 mt-2 font-medium">End</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Helper function to get node description
function getNodeDescription(node: WorkflowNode): string {
  const config = node.config;
  switch (node.type) {
    case 'trigger': {
      if (config.schemaId) {
        return `When ${config.schemaId} is ${node.name.toLowerCase()}`;
      }
      if (config.schedule) {
        return `Runs on schedule`;
      }
      return 'Workflow start';
    }
    case 'condition': {
      return config.field ? `Check ${config.field}` : 'Conditional branch';
    }
    case 'action': {
      if (config.to) {
        return `To: ${Array.isArray(config.to) ? config.to[0] : config.to}`;
      }
      if (config.schemaId) {
        return `Target: ${config.schemaId}`;
      }
      return 'Execute action';
    }
    default: {
      return '';
    }
  }
}
