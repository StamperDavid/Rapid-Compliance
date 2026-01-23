/**
 * Visual Workflow Builder Component
 * Drag-and-drop workflow designer using React Flow
 */

'use client';

import React, { useState, useCallback, useRef } from 'react';
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  ReactFlowProvider,
  MiniMap,
  type Node,
  type Edge,
  type Connection,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { Workflow, WorkflowAction } from '@/types/workflow';

interface VisualWorkflowBuilderProps {
  workflow?: Partial<Workflow>;
  onSave: (workflow: Partial<Workflow>) => void;
  onCancel: () => void;
}

// Initial nodes for new workflow
const initialNodes: Node[] = [
  {
    id: '1',
    type: 'input',
    data: { label: '⚡ Start', nodeType: 'trigger' },
    position: { x: 250, y: 50 },
  },
];

const initialEdges: Edge[] = [];

function VisualWorkflowBuilderInner({ workflow, onSave, onCancel }: VisualWorkflowBuilderProps) {
  const [name, setName] = useState(workflow?.name ?? '');
  const [description, setDescription] = useState(workflow?.description ?? '');
  const [trigger, setTrigger] = useState<string>(workflow?.trigger?.type ?? 'manual');
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showNodeConfig, setShowNodeConfig] = useState(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodeIdCounter, setNodeIdCounter] = useState(2);

  // Handle new connections
  const onConnect = useCallback(
    (params: Edge | Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Handle node click
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setShowNodeConfig(true);
  }, []);

  // Add new node
  const addNode = (nodeType: string) => {
    const newNode: Node = {
      id: `${nodeIdCounter}`,
      type: nodeType === 'trigger' ? 'input' : nodeType === 'end' ? 'output' : 'default',
      data: { 
        label: getNodeLabel(nodeType),
        nodeType: nodeType,
        config: {},
      },
      position: { 
        x: Math.random() * 300 + 100, 
        y: Math.random() * 300 + 150 
      },
    };
    
    setNodes((nds) => nds.concat(newNode));
    setNodeIdCounter((id) => id + 1);
  };

  // Get node label based on type
  const getNodeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      trigger: '⚡ Trigger',
      email: '📧 Send Email',
      sms: '📱 Send SMS',
      task: '✓ Create Task',
      condition: '❓ Condition',
      wait: '⏱ Wait',
      webhook: '🔗 Webhook',
      integrationCall: '🔌 Integration',
      updateEntity: '📝 Update Record',
      notification: '🔔 Notification',
      end: '🏁 End',
    };
    return labels[type] ?? `📌 ${type}`;
  };

  // Update node configuration
  const _updateNodeConfig = (config: Record<string, unknown>) => {
    if (selectedNode) {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === selectedNode.id
            ? { ...node, data: { ...(node.data as Record<string, unknown>), config } }
            : node
        )
      );
    }
  };

  // Convert React Flow data to Workflow format
  const convertToWorkflow = (): Partial<Workflow> => {
    // Note: This is a simplified conversion for the visual builder
    // In production, you'd need to properly map node data to WorkflowAction types
    interface NodeDataConfig {
      nodeType?: string;
      config?: Record<string, unknown>;
    }

    const actions: Partial<WorkflowAction>[] = nodes
      .filter(n => n.type !== 'input')
      .map((node, index) => {
        const data = node.data as NodeDataConfig;
        return {
          id: node.id,
          type: (data.nodeType ?? 'action') as WorkflowAction['type'],
          name: node.id,
          order: index + 1,
          config: data.config ?? {},
          conditions: [],
        };
      });

    interface WorkflowTriggerPartial {
      type: string;
      id: string;
      name: string;
    }

    const workflowTrigger: WorkflowTriggerPartial = {
      type: trigger,
      id: 'trigger-1',
      name: 'Workflow Trigger',
    };

    return {
      ...workflow,
      name,
      description,
      trigger: workflowTrigger as Workflow['trigger'],
      actions: actions as WorkflowAction[],
    };
  };

  // Handle save
  const handleSave = () => {
    const workflowData = convertToWorkflow();
    onSave(workflowData);
  };

  // Export workflow as JSON
  const handleExport = () => {
    const workflowData = convertToWorkflow();
    const blob = new Blob([JSON.stringify(workflowData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workflow-${name.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#000' }}>
      {/* Header */}
      <div style={{ padding: '1rem 2rem', backgroundColor: '#1a1a1a', borderBottom: '1px solid #333' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff' }}>
            Visual Workflow Builder
          </h2>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={handleExport}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#333',
                color: '#fff',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontWeight: '500',
                fontSize: '0.875rem',
              }}
            >
              📥 Export JSON
            </button>
            <button
              onClick={onCancel}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#333',
                color: '#fff',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontWeight: '500',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#6366f1',
                color: '#fff',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontWeight: '500',
              }}
            >
              💾 Save Workflow
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#999', marginBottom: '0.25rem' }}>
              Workflow Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                backgroundColor: '#0a0a0a',
                border: '1px solid #333',
                borderRadius: '0.25rem',
                color: '#fff',
                fontSize: '0.875rem',
              }}
              placeholder="e.g., New Lead Onboarding"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#999', marginBottom: '0.25rem' }}>
              Trigger Type
            </label>
            <select
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                backgroundColor: '#0a0a0a',
                border: '1px solid #333',
                borderRadius: '0.25rem',
                color: '#fff',
                fontSize: '0.875rem',
              }}
            >
              <option value="manual">Manual Trigger</option>
              <option value="schedule">Scheduled</option>
              <option value="webhook">Webhook</option>
              <option value="entity.created">When Record Created</option>
              <option value="entity.updated">When Record Updated</option>
              <option value="email.received">When Email Received</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#999', marginBottom: '0.25rem' }}>
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                backgroundColor: '#0a0a0a',
                border: '1px solid #333',
                borderRadius: '0.25rem',
                color: '#fff',
                fontSize: '0.875rem',
              }}
              placeholder="Brief description"
            />
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex' }}>
        {/* Node Palette */}
        <div style={{ width: '220px', backgroundColor: '#1a1a1a', borderRight: '1px solid #333', padding: '1rem', overflowY: 'auto' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Actions
          </h3>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
              Communication
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {['email', 'sms', 'notification'].map((type) => (
                <button
                  key={type}
                  onClick={() => addNode(type)}
                  style={{
                    padding: '0.75rem',
                    backgroundColor: '#0a0a0a',
                    border: '1px solid #333',
                    borderRadius: '0.375rem',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = '#6366f1'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = '#333'}
                >
                  {getNodeLabel(type)}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
              CRM
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {['task', 'updateEntity'].map((type) => (
                <button
                  key={type}
                  onClick={() => addNode(type)}
                  style={{
                    padding: '0.75rem',
                    backgroundColor: '#0a0a0a',
                    border: '1px solid #333',
                    borderRadius: '0.375rem',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = '#6366f1'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = '#333'}
                >
                  {getNodeLabel(type)}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
              Logic & Flow
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {['condition', 'wait'].map((type) => (
                <button
                  key={type}
                  onClick={() => addNode(type)}
                  style={{
                    padding: '0.75rem',
                    backgroundColor: '#0a0a0a',
                    border: '1px solid #333',
                    borderRadius: '0.375rem',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = '#6366f1'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = '#333'}
                >
                  {getNodeLabel(type)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
              Integration
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {['webhook', 'integrationCall', 'end'].map((type) => (
                <button
                  key={type}
                  onClick={() => addNode(type)}
                  style={{
                    padding: '0.75rem',
                    backgroundColor: '#0a0a0a',
                    border: '1px solid #333',
                    borderRadius: '0.375rem',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = '#6366f1'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = '#333'}
                >
                  {getNodeLabel(type)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* React Flow Canvas */}
        <div ref={reactFlowWrapper} style={{ flex: 1 }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            fitView
            style={{ backgroundColor: '#0a0a0a' }}
          >
            <Background color="#333" gap={16} />
            <Controls />
            <MiniMap
              nodeColor={(node: Node) => {
                if (node.type === 'input') {
                  return '#10b981';
                }
                if (node.type === 'output') {
                  return '#ef4444';
                }
                return '#6366f1';
              }}
              style={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
            />
          </ReactFlow>
        </div>

        {/* Node Configuration Panel */}
        {showNodeConfig && selectedNode && (
          <div style={{ width: '320px', backgroundColor: '#1a1a1a', borderLeft: '1px solid #333', padding: '1.5rem', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#fff' }}>
                Node Configuration
              </h3>
              <button
                onClick={() => setShowNodeConfig(false)}
                style={{
                  padding: '0.25rem 0.5rem',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#999',
                  cursor: 'pointer',
                  fontSize: '1.5rem',
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ fontSize: '0.875rem', color: '#999', marginBottom: '1.5rem', padding: '0.75rem', backgroundColor: '#0a0a0a', borderRadius: '0.375rem' }}>
              {(selectedNode.data as { label?: string }).label ?? 'Node'}
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#999', marginBottom: '0.5rem', fontWeight: '500' }}>
                Display Label
              </label>
              <input
                type="text"
                value={(selectedNode.data as { label?: string }).label ?? ''}
                onChange={(e) => {
                  setNodes((nds) =>
                    nds.map((node) =>
                      node.id === selectedNode.id
                        ? { ...node, data: { ...(node.data as Record<string, unknown>), label: e.target.value } }
                        : node
                    )
                  );
                }}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  backgroundColor: '#0a0a0a',
                  border: '1px solid #333',
                  borderRadius: '0.25rem',
                  color: '#fff',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            <div style={{ padding: '1rem', backgroundColor: '#0a0a0a', borderRadius: '0.375rem', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.5rem' }}>
                Configuration
              </div>
              <div style={{ fontSize: '0.75rem', color: '#999' }}>
                Node-specific settings will appear here based on the selected action type.
              </div>
            </div>

            <button
              onClick={() => {
                setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
                setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
                setShowNodeConfig(false);
              }}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: '#ef4444',
                color: '#fff',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontWeight: '500',
              }}
            >
              🗑️ Delete Node
            </button>
          </div>
        )}
      </div>

      {/* Instructions Footer */}
      <div style={{ padding: '0.75rem 2rem', backgroundColor: '#1a1a1a', borderTop: '1px solid #333', fontSize: '0.75rem', color: '#666', textAlign: 'center' }}>
        💡 Drag nodes from the left panel • Connect nodes by dragging from one to another • Click nodes to configure • Double-click canvas to add notes
      </div>
    </div>
  );
}

export default function VisualWorkflowBuilder(props: VisualWorkflowBuilderProps) {
  return (
    <ReactFlowProvider>
      <VisualWorkflowBuilderInner {...props} />
    </ReactFlowProvider>
  );
}

