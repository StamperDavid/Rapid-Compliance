'use client';

/**
 * Visual Workflow Builder Page (ReactFlow)
 *
 * A premium n8n/Make.com-style visual node-graph workflow editor built with ReactFlow.
 * Features:
 * - Full-screen ReactFlow canvas with MiniMap, Controls, dot background
 * - Left palette sidebar: drag nodes onto canvas
 * - Right properties panel: configure selected node
 * - Top toolbar: name, status, save, back
 * - Converts between ReactFlow nodes/edges and Workflow domain type for persistence
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ReactFlow, {
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  ReactFlowProvider,
  BackgroundVariant,
  type Node,
  type Edge,
  type Connection,
  type ReactFlowInstance,
  type NodeMouseHandler,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { FirestoreService } from '@/lib/db/firestore-service';
import { getWorkflowsCollection } from '@/lib/firebase/collections';
import { Timestamp } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';

import {
  TriggerNode,
  ActionNode,
  ConditionNode,
  DelayNode,
  AnimatedEdge,
  getNodeType,
  type FlowNodeData,
  type FlowPaletteItem,
  type FlowNodeCategory,
} from '@/components/workflow/nodes';
import FlowPalette from '@/components/workflow/FlowPalette';
import FlowPropertiesPanel from '@/components/workflow/FlowPropertiesPanel';

// ============================================================================
// ReactFlow custom type registries (must be stable references)
// ============================================================================

const nodeTypes = {
  triggerNode: TriggerNode,
  actionNode: ActionNode,
  conditionNode: ConditionNode,
  delayNode: DelayNode,
};

const edgeTypes = {
  animated: AnimatedEdge,
};

// ============================================================================
// Conversion helpers: Workflow <-> ReactFlow
// ============================================================================

/** Icon lookup for trigger types */
const triggerIcons: Record<string, string> = {
  'entity.created': '✨',
  'entity.updated': '🔄',
  'entity.deleted': '🗑',
  'schedule': '⏰',
  'webhook': '🔗',
  'manual': '👆',
  'ai_agent': '🤖',
  'form.submitted': '📝',
  'email.received': '📨',
};

/** Icon lookup for action types */
const actionIcons: Record<string, string> = {
  'send_email': '📧',
  'send_sms': '💬',
  'send_slack': '💼',
  'create_entity': '➕',
  'update_entity': '✏️',
  'delete_entity': '🗑️',
  'http_request': '🌐',
  'ai_agent': '🤖',
  'cloud_function': '☁️',
  'create_task': '✅',
  'conditional_branch': '🔀',
  'delay': '⏳',
  'loop': '🔁',
};

/** Determine flow node category from action type string */
function categorizeActionType(actionType: string): FlowNodeCategory {
  if (actionType === 'conditional_branch') {
    return 'condition';
  }
  if (actionType === 'delay') {
    return 'delay';
  }
  // Trigger types
  if (['entity.created', 'entity.updated', 'entity.deleted', 'schedule', 'webhook', 'manual', 'ai_agent', 'form.submitted', 'email.received'].includes(actionType)) {
    return 'trigger';
  }
  return 'action';
}

interface StoredWorkflow {
  id: string;
  name: string;
  description?: string;
  trigger: Record<string, unknown>;
  actions: Record<string, unknown>[];
  conditions?: Record<string, unknown>[];
  settings: Record<string, unknown>;
  permissions: Record<string, unknown>;
  stats: Record<string, unknown>;
  status: 'draft' | 'active' | 'paused' | 'archived';
  version: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  /** ReactFlow node positions for visual builder (stored alongside the workflow) */
  _nodePositions?: Record<string, { x: number; y: number }>;
}

/** Convert a stored Workflow into ReactFlow nodes + edges */
function workflowToFlow(workflow: StoredWorkflow): { nodes: Node<FlowNodeData>[]; edges: Edge[] } {
  const nodes: Node<FlowNodeData>[] = [];
  const edges: Edge[] = [];
  const positions = workflow._nodePositions ?? {};

  // Add trigger node
  const triggerType = (workflow.trigger?.type as string) ?? 'manual';
  const triggerId = (workflow.trigger?.id as string) ?? 'trigger-1';
  const triggerName = (workflow.trigger?.name as string) ?? 'Trigger';

  // Extract trigger config (everything except id, type, name)
  const { id: _tId, type: _tType, name: _tName, ...triggerConfig } = workflow.trigger ?? {};

  nodes.push({
    id: triggerId,
    type: 'triggerNode',
    position: positions[triggerId] ?? { x: 300, y: 50 },
    data: {
      label: triggerName,
      actionType: triggerType,
      category: 'trigger',
      icon: triggerIcons[triggerType] ?? '⚡',
      description: '',
      config: triggerConfig as Record<string, unknown>,
    },
  });

  // Add action nodes
  let prevNodeId = triggerId;
  (workflow.actions ?? []).forEach((action, index) => {
    const actionType = (action.type as string) ?? 'delay';
    const actionId = (action.id as string) ?? `action-${index}`;
    const actionName = (action.name as string) ?? `Action ${index + 1}`;

    // Extract action config
    const { id: _aId, type: _aType, name: _aName, order: _aOrder, continueOnError: _aCoe, ...actionConfig } = action;

    const category = categorizeActionType(actionType);
    const nodeType = getNodeType(category);
    const icon = actionType.startsWith('entity.') ? triggerIcons[actionType] : (actionIcons[actionType] ?? '⚡');

    nodes.push({
      id: actionId,
      type: nodeType,
      position: positions[actionId] ?? { x: 300, y: 200 + index * 180 },
      data: {
        label: actionName,
        actionType,
        category,
        icon,
        description: '',
        config: actionConfig as Record<string, unknown>,
      },
    });

    // Edge from previous node
    const edgeLabel = category === 'condition' ? undefined : undefined;
    edges.push({
      id: `e-${prevNodeId}-${actionId}`,
      source: prevNodeId,
      target: actionId,
      type: 'animated',
      label: edgeLabel,
      animated: true,
    });
    prevNodeId = actionId;
  });

  return { nodes, edges };
}

/** Convert ReactFlow nodes + edges back into a partial StoredWorkflow for saving */
function flowToWorkflow(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  meta: { name: string; description: string; status: string; userId: string; existingId?: string }
): StoredWorkflow {
  const id = meta.existingId ?? `workflow-${Date.now()}`;
  const now = Timestamp.now();

  // Find trigger node
  const triggerNode = nodes.find(n => n.data.category === 'trigger');
  const trigger: Record<string, unknown> = triggerNode
    ? {
        id: triggerNode.id,
        type: triggerNode.data.actionType,
        name: triggerNode.data.label,
        ...triggerNode.data.config,
      }
    : { id: `trigger-${Date.now()}`, type: 'manual', name: 'Manual Trigger' };

  // Build execution order from edges (topological sort)
  const actionNodes = nodes.filter(n => n.data.category !== 'trigger');
  const orderedActions = topologicalSort(actionNodes, edges, triggerNode?.id);

  const actions = orderedActions.map((node, index) => ({
    id: node.id,
    type: node.data.actionType,
    name: node.data.label,
    order: index,
    continueOnError: false,
    ...node.data.config,
  }));

  // Save positions for visual restoration
  const nodePositions: Record<string, { x: number; y: number }> = {};
  for (const node of nodes) {
    nodePositions[node.id] = { x: node.position.x, y: node.position.y };
  }

  return {
    id,
    name: meta.name,
    description: meta.description,
    trigger,
    actions,
    conditions: [],
    settings: {
      stopOnError: false,
      timeout: 300000,
      maxConcurrentRuns: 1,
    },
    permissions: {
      canView: ['owner', 'admin'],
      canEdit: ['owner', 'admin'],
      canExecute: ['owner', 'admin', 'member'],
    },
    stats: {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
    },
    status: meta.status as StoredWorkflow['status'],
    version: 1,
    createdAt: now,
    updatedAt: now,
    createdBy: meta.userId,
    _nodePositions: nodePositions,
  };
}

/** Simple topological sort of action nodes based on edges, starting from the trigger */
function topologicalSort(
  actionNodes: Node<FlowNodeData>[],
  edges: Edge[],
  triggerId?: string
): Node<FlowNodeData>[] {
  if (actionNodes.length === 0) {
    return [];
  }

  const nodeMap = new Map<string, Node<FlowNodeData>>();
  for (const node of actionNodes) {
    nodeMap.set(node.id, node);
  }

  // Build adjacency
  const adjList = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  for (const node of actionNodes) {
    adjList.set(node.id, []);
    inDegree.set(node.id, 0);
  }

  for (const edge of edges) {
    const targetNode = nodeMap.get(edge.target);
    if (targetNode) {
      const sourceList = adjList.get(edge.source) ?? [];
      sourceList.push(edge.target);
      adjList.set(edge.source, sourceList);
      inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    }
  }

  // If trigger connects to action nodes, those have edges from trigger but trigger is not in actionNodes
  // So edges from trigger -> action reduce in-degree of those action nodes
  // since trigger is not in the nodeMap, we need to handle that
  for (const edge of edges) {
    if (edge.source === triggerId && nodeMap.has(edge.target)) {
      // These nodes are direct children of trigger, should already have inDegree 0
      // since trigger is not in the adjacency, the in-degree was not incremented
      // So they are already correct.
    }
  }

  // BFS / Kahn's algorithm
  const queue: string[] = [];
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) {
      queue.push(nodeId);
    }
  }

  const result: Node<FlowNodeData>[] = [];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }
    const node = nodeMap.get(current);
    if (node) {
      result.push(node);
    }

    for (const neighbor of (adjList.get(current) ?? [])) {
      const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) {
        queue.push(neighbor);
      }
    }
  }

  // Add any remaining nodes not in the sorted result (disconnected nodes)
  for (const node of actionNodes) {
    if (!result.includes(node)) {
      result.push(node);
    }
  }

  return result;
}

// ============================================================================
// Main Builder Component (inner, requires ReactFlowProvider)
// ============================================================================

function WorkflowBuilderInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { user } = useAuth();
  const _authFetch = useAuthFetch();
  const workflowId = searchParams.get('id');

  // ReactFlow state
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // Workflow meta state
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [workflowStatus, setWorkflowStatus] = useState<'draft' | 'active' | 'paused'>('draft');

  // UI state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!!workflowId);
  const [isSaving, setIsSaving] = useState(false);
  const [showPalette, setShowPalette] = useState(true);
  const [showProperties, setShowProperties] = useState(true);

  // Node ID counter for generating unique IDs
  const nodeIdCounter = useRef(1);

  // Selected node reference
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) {
      return null;
    }
    return nodes.find(n => n.id === selectedNodeId) ?? null;
  }, [selectedNodeId, nodes]);

  // ---- Load existing workflow ----
  useEffect(() => {
    if (!workflowId) {
      return;
    }

    const load = async () => {
      try {
        setIsLoading(true);
        const data = await FirestoreService.get(getWorkflowsCollection(), workflowId);
        if (data) {
          const stored = data as unknown as StoredWorkflow;
          setWorkflowName(stored.name ?? '');
          setWorkflowDescription(stored.description ?? '');
          setWorkflowStatus((stored.status as 'draft' | 'active' | 'paused') ?? 'draft');

          const { nodes: flowNodes, edges: flowEdges } = workflowToFlow(stored);
          setNodes(flowNodes);
          setEdges(flowEdges);

          // Set counter past existing IDs
          let maxNum = 1;
          for (const n of flowNodes) {
            const match = n.id.match(/\d+/);
            if (match) {
              const num = parseInt(match[0], 10);
              if (num >= maxNum) {
                maxNum = num + 1;
              }
            }
          }
          nodeIdCounter.current = maxNum;
        }
      } catch (error) {
        logger.error('Failed to load workflow', error instanceof Error ? error : new Error(String(error)), { file: 'builder/page.tsx' });
        toast.error('Failed to load workflow');
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [workflowId, setNodes, setEdges, toast]);

  // ---- Handle new connections ----
  const onConnect = useCallback(
    (params: Connection) => {
      // Build edge label for condition nodes
      const sourceNode = nodes.find(n => n.id === params.source);
      let label: string | undefined;
      if (sourceNode?.data.category === 'condition') {
        label = params.sourceHandle === 'true' ? 'Yes' : 'No';
      }

      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: 'animated',
            animated: true,
            label,
          },
          eds
        )
      );
    },
    [setEdges, nodes]
  );

  // ---- Handle node click ----
  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    setSelectedNodeId(node.id);
    setShowProperties(true);
  }, []);

  // ---- Handle pane click (deselect) ----
  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  // ---- Drop handler for palette items ----
  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      const itemJson = event.dataTransfer.getData('application/reactflow-item');
      if (!itemJson || !rfInstance || !reactFlowWrapper.current) {
        return;
      }

      let item: FlowPaletteItem;
      try {
        item = JSON.parse(itemJson) as FlowPaletteItem;
      } catch {
        return;
      }

      // Calculate drop position in flow coordinates
      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = rfInstance.project({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });

      const newId = `${item.actionType.replace(/[^a-zA-Z0-9]/g, '_')}-${nodeIdCounter.current}`;
      nodeIdCounter.current += 1;

      const nodeType = getNodeType(item.nodeCategory);

      const newNode: Node<FlowNodeData> = {
        id: newId,
        type: nodeType,
        position,
        data: {
          label: item.name,
          actionType: item.actionType,
          category: item.nodeCategory,
          icon: item.icon,
          description: item.description,
          config: {},
        },
      };

      setNodes((nds) => nds.concat(newNode));

      // Auto-select the new node
      setSelectedNodeId(newId);
      setShowProperties(true);
    },
    [rfInstance, setNodes]
  );

  // ---- Update node data from properties panel ----
  const handleNodeUpdate = useCallback(
    (nodeId: string, updates: Partial<FlowNodeData>) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, ...updates } }
            : node
        )
      );
    },
    [setNodes]
  );

  // ---- Delete node ----
  const handleNodeDelete = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      if (selectedNodeId === nodeId) {
        setSelectedNodeId(null);
      }
    },
    [setNodes, setEdges, selectedNodeId]
  );

  // ---- Save workflow ----
  const handleSave = async () => {
    if (!workflowName.trim()) {
      toast.error('Please enter a workflow name');
      return;
    }

    try {
      setIsSaving(true);

      const workflowData = flowToWorkflow(nodes, edges, {
        name: workflowName,
        description: workflowDescription,
        status: workflowStatus,
        userId: user?.id ?? 'anonymous',
        existingId: workflowId ?? undefined,
      });

      if (workflowId) {
        // Update existing
        const { id: _id, createdAt: _ca, createdBy: _cb, stats: _s, ...updateData } = workflowData;
        await FirestoreService.update(
          getWorkflowsCollection(),
          workflowId,
          updateData
        );
      } else {
        // Create new
        await FirestoreService.set(
          getWorkflowsCollection(),
          workflowData.id,
          workflowData,
          false
        );
      }

      toast.success('Workflow saved successfully');
      router.push('/workflows');
    } catch (error) {
      logger.error('Failed to save workflow', error instanceof Error ? error : new Error(String(error)), { file: 'builder/page.tsx' });
      toast.error('Failed to save workflow');
    } finally {
      setIsSaving(false);
    }
  };

  // ---- Loading state ----
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg-main)' }}>
        <div className="text-center">
          <div className="w-12 h-12 border-2 rounded-full animate-spin mx-auto mb-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Loading workflow...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--color-bg-main)' }}>
      {/* ================================================================ */}
      {/* TOOLBAR */}
      {/* ================================================================ */}
      <header
        className="h-14 border-b flex items-center justify-between px-4 shrink-0 z-50"
        style={{ borderColor: 'var(--color-border-light)', backgroundColor: 'var(--color-bg-main)' }}
      >
        <div className="flex items-center gap-3">
          {/* Back */}
          <button
            onClick={() => router.push('/workflows')}
            className="p-2 rounded-lg transition-colors hover:bg-white/5"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Workflow icon */}
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, var(--color-primary), #818cf8)' }}
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>

          {/* Name input */}
          <input
            type="text"
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            placeholder="Untitled Workflow"
            className="bg-transparent text-lg font-semibold border-none outline-none focus:ring-0 w-56"
            style={{ color: 'var(--color-text-primary)' }}
          />
        </div>

        <div className="flex items-center gap-3">
          {/* Toggle palette */}
          <button
            onClick={() => setShowPalette(v => !v)}
            className={`p-2 rounded-lg transition-colors ${showPalette ? 'bg-indigo-500/20 text-indigo-400' : ''}`}
            style={!showPalette ? { color: 'var(--color-text-disabled)' } : undefined}
            title="Toggle node palette"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
            </svg>
          </button>

          {/* Toggle properties */}
          <button
            onClick={() => setShowProperties(v => !v)}
            className={`p-2 rounded-lg transition-colors ${showProperties ? 'bg-indigo-500/20 text-indigo-400' : ''}`}
            style={!showProperties ? { color: 'var(--color-text-disabled)' } : undefined}
            title="Toggle properties panel"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </button>

          <div className="w-px h-6" style={{ backgroundColor: 'var(--color-border-light)' }} />

          {/* Status dropdown */}
          <select
            value={workflowStatus}
            onChange={(e) => setWorkflowStatus(e.target.value as 'draft' | 'active' | 'paused')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            style={{
              backgroundColor: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border-light)',
              color: 'var(--color-text-primary)',
            }}
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </select>

          {/* Save */}
          <button
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="px-5 py-2 text-white text-sm font-medium rounded-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Saving...
              </span>
            ) : (
              'Save Workflow'
            )}
          </button>
        </div>
      </header>

      {/* ================================================================ */}
      {/* MAIN LAYOUT: Palette | Canvas | Properties */}
      {/* ================================================================ */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR - Palette */}
        {showPalette && (
          <div
            className="w-[250px] border-r shrink-0"
            style={{ borderColor: 'var(--color-border-light)' }}
          >
            <FlowPalette />
          </div>
        )}

        {/* CENTER - ReactFlow Canvas */}
        <div
          ref={reactFlowWrapper}
          className="flex-1"
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onInit={setRfInstance}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={{
              type: 'animated',
              animated: true,
            }}
            fitView
            snapToGrid
            snapGrid={[16, 16]}
            deleteKeyCode="Delete"
            style={{ backgroundColor: 'var(--color-bg-main)' }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color="var(--color-border-light)"
            />
            <Controls
              className="!rounded-xl !border !shadow-lg"
              style={{
                borderColor: 'var(--color-border-light)',
                backgroundColor: 'var(--color-bg-elevated)',
              }}
            />
            <MiniMap
              nodeColor={(node: Node) => {
                const data = node.data as FlowNodeData;
                switch (data?.category) {
                  case 'trigger': return '#10b981';
                  case 'condition': return '#f59e0b';
                  case 'delay': return '#64748b';
                  default: return '#6366f1';
                }
              }}
              maskColor="rgba(0, 0, 0, 0.7)"
              className="!rounded-xl !border !shadow-lg"
              style={{
                borderColor: 'var(--color-border-light)',
                backgroundColor: 'var(--color-bg-elevated)',
              }}
            />
          </ReactFlow>

          {/* CSS for animated edges */}
          <style>{`
            @keyframes dashFlow {
              to {
                stroke-dashoffset: -10;
              }
            }
            .react-flow__controls button {
              background-color: var(--color-bg-elevated) !important;
              border-color: var(--color-border-light) !important;
              color: var(--color-text-primary) !important;
            }
            .react-flow__controls button:hover {
              background-color: var(--color-bg-paper) !important;
            }
            .react-flow__controls button svg {
              fill: var(--color-text-primary) !important;
            }
            .react-flow__minimap {
              background-color: var(--color-bg-elevated) !important;
            }
          `}</style>
        </div>

        {/* RIGHT SIDEBAR - Properties */}
        {showProperties && (
          <div
            className="w-[320px] border-l shrink-0"
            style={{ borderColor: 'var(--color-border-light)' }}
          >
            <FlowPropertiesPanel
              selectedNode={selectedNode}
              onNodeUpdate={handleNodeUpdate}
              onNodeDelete={handleNodeDelete}
              onClose={() => setSelectedNodeId(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Wrapper with ReactFlowProvider
// ============================================================================

export default function WorkflowBuilderPage() {
  return (
    <ReactFlowProvider>
      <WorkflowBuilderInner />
    </ReactFlowProvider>
  );
}
