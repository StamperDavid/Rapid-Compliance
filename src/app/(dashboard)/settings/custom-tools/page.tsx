'use client';

import React, { useState, useEffect } from 'react';
import { useAuth, usePermission } from '@/hooks/useAuth';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import {
  validateToolUrl,
  COMMON_EMOJI_ICONS,
  type CustomTool,
  type CustomToolFormData,
} from '@/types/custom-tools';

interface ToolResponse {
  tool: CustomTool;
}

interface ToolsListResponse {
  tools: CustomTool[];
}

interface ToolModalProps {
  tool: CustomTool | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CustomToolFormData) => Promise<void>;
  primaryColor: string;
}

function ToolModal({ tool, isOpen, onClose, onSave, primaryColor }: ToolModalProps) {
  const [formData, setFormData] = useState<CustomToolFormData>({
    name: '',
    icon: COMMON_EMOJI_ICONS[0],
    url: '',
    enabled: true,
  });
  const [urlError, setUrlError] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (tool) {
      setFormData({
        name: tool.name,
        icon: tool.icon,
        url: tool.url,
        enabled: tool.enabled,
      });
    } else {
      setFormData({
        name: '',
        icon: COMMON_EMOJI_ICONS[0],
        url: '',
        enabled: true,
      });
    }
    setUrlError('');
  }, [tool, isOpen]);

  const handleUrlChange = (url: string) => {
    setFormData({ ...formData, url });
    const validation = validateToolUrl(url);
    setUrlError(validation.valid ? '' : (validation.error ?? ''));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validateToolUrl(formData.url);
    if (!validation.valid) {
      setUrlError(validation.error ?? 'Invalid URL');
      return;
    }

    setSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Error saving tool:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
    }}>
      <div style={{
        backgroundColor: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: '1rem',
        padding: '2rem',
        width: '100%',
        maxWidth: '500px',
        margin: '1rem',
      }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '1.5rem' }}>
          {tool ? 'Edit Custom Tool' : 'Add Custom Tool'}
        </h2>

        <form onSubmit={(e) => void handleSubmit(e)}>
          {/* Name */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', color: '#999', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="My Custom App"
              required
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                backgroundColor: '#0a0a0a',
                border: '1px solid #333',
                borderRadius: '0.5rem',
                color: '#fff',
                fontSize: '1rem',
              }}
            />
          </div>

          {/* Icon */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', color: '#999', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              Icon (Emoji)
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {COMMON_EMOJI_ICONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setFormData({ ...formData, icon: emoji })}
                  style={{
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: formData.icon === emoji ? primaryColor : '#0a0a0a',
                    border: formData.icon === emoji ? `2px solid ${primaryColor}` : '1px solid #333',
                    borderRadius: '0.5rem',
                    fontSize: '1.25rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* URL */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', color: '#999', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              URL (HTTPS only) *
            </label>
            <input
              type="url"
              value={formData.url}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://example.com/app"
              required
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                backgroundColor: '#0a0a0a',
                border: `1px solid ${urlError ? '#ef4444' : '#333'}`,
                borderRadius: '0.5rem',
                color: '#fff',
                fontSize: '1rem',
              }}
            />
            {urlError && (
              <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '0.5rem' }}>{urlError}</p>
            )}
          </div>

          {/* Enabled Toggle */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
              <div
                onClick={() => setFormData({ ...formData, enabled: !formData.enabled })}
                style={{
                  width: '48px',
                  height: '24px',
                  backgroundColor: formData.enabled ? primaryColor : '#333',
                  borderRadius: '12px',
                  position: 'relative',
                  transition: 'background-color 0.2s',
                  cursor: 'pointer',
                }}
              >
                <div style={{
                  width: '20px',
                  height: '20px',
                  backgroundColor: '#fff',
                  borderRadius: '50%',
                  position: 'absolute',
                  top: '2px',
                  left: formData.enabled ? '26px' : '2px',
                  transition: 'left 0.2s',
                }} />
              </div>
              <span style={{ color: '#fff', fontSize: '0.875rem' }}>
                {formData.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </label>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#333',
                color: '#fff',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !formData.name || !formData.url || !!urlError}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: primaryColor,
                color: '#fff',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving || !formData.name || !formData.url || !!urlError ? 0.5 : 1,
              }}
            >
              {saving ? 'Saving...' : (tool ? 'Update Tool' : 'Add Tool')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CustomToolsSettingsPage() {
  const _user = useAuth().user;
  const { theme } = useOrgTheme();
  const canManageOrganization = usePermission('canManageOrganization');

  const [tools, setTools] = useState<CustomTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<CustomTool | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const primaryColor = theme?.colors?.primary?.main ?? '#6366f1';

  // Fetch tools
  useEffect(() => {
    const fetchTools = async () => {
      try {
        const response = await fetch(`/api/custom-tools`);
        if (response.ok) {
          const data = (await response.json()) as ToolsListResponse;
          setTools(data.tools ?? []);
        }
      } catch (error) {
        console.error('Error fetching tools:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchTools();
  }, []);

  const handleAddTool = () => {
    setEditingTool(null);
    setModalOpen(true);
  };

  const handleEditTool = (tool: CustomTool) => {
    setEditingTool(tool);
    setModalOpen(true);
  };

  const handleSaveTool = async (formData: CustomToolFormData) => {
    const method = editingTool ? 'PUT' : 'POST';
    const body = editingTool
      ? { ...formData, id: editingTool.id }
      : { ...formData, order: tools.length };

    const response = await fetch(`/api/custom-tools`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error('Failed to save tool');
    }

    const data = (await response.json()) as ToolResponse;

    if (editingTool) {
      setTools(tools.map(t => t.id === editingTool.id ? data.tool : t));
    } else {
      setTools([...tools, data.tool]);
    }
  };

  const handleDeleteTool = async (toolId: string) => {
    try {
      const response = await fetch(`/api/custom-tools`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: toolId }),
      });

      if (response.ok) {
        setTools(tools.filter(t => t.id !== toolId));
      }
    } catch (error) {
      console.error('Error deleting tool:', error);
    }
    setDeleteConfirm(null);
  };

  const handleToggleEnabled = async (tool: CustomTool) => {
    try {
      const response = await fetch(`/api/custom-tools`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tool.id,
          name: tool.name,
          icon: tool.icon,
          url: tool.url,
          enabled: !tool.enabled,
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as ToolResponse;
        setTools(tools.map(t => t.id === tool.id ? data.tool : t));
      }
    } catch (error) {
      console.error('Error toggling tool:', error);
    }
  };

  if (!canManageOrganization) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1 style={{ color: '#fff', fontSize: '1.5rem', marginBottom: '1rem' }}>Access Denied</h1>
        <p style={{ color: '#666' }}>You do not have permission to manage custom tools.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', overflowY: 'auto', minHeight: '100vh', backgroundColor: '#000' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
              Custom Tools
            </h1>
            <p style={{ color: '#666', fontSize: '0.875rem' }}>
              Add external apps and tools that appear in your workspace sidebar
            </p>
          </div>
          <button
            onClick={handleAddTool}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: primaryColor,
              color: '#fff',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            + Add Tool
          </button>
        </div>

        {/* Tools List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '3px solid #333',
              borderTopColor: primaryColor,
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1rem',
            }} />
            <p style={{ color: '#666' }}>Loading tools...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : tools.length === 0 ? (
          <div style={{
            backgroundColor: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: '1rem',
            padding: '4rem',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🔧</div>
            <h3 style={{ color: '#fff', fontSize: '1.25rem', marginBottom: '0.5rem' }}>
              No Custom Tools Yet
            </h3>
            <p style={{ color: '#666', marginBottom: '1.5rem' }}>
              Add your first custom tool to extend your workspace with external apps.
            </p>
            <button
              onClick={handleAddTool}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: primaryColor,
                color: '#fff',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              Add Your First Tool
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {tools.map((tool) => (
              <div
                key={tool.id}
                style={{
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '0.75rem',
                  padding: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                }}
              >
                {/* Icon */}
                <div style={{
                  width: '50px',
                  height: '50px',
                  backgroundColor: '#0a0a0a',
                  borderRadius: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.75rem',
                  flexShrink: 0,
                }}>
                  {tool.icon}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                    <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: '600' }}>{tool.name}</h3>
                    <span style={{
                      padding: '0.125rem 0.5rem',
                      backgroundColor: tool.enabled ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      color: tool.enabled ? '#22c55e' : '#ef4444',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                    }}>
                      {tool.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <p style={{
                    color: '#666',
                    fontSize: '0.875rem',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {tool.url}
                  </p>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                  {/* Toggle */}
                  <button
                    onClick={() => void handleToggleEnabled(tool)}
                    title={tool.enabled ? 'Disable' : 'Enable'}
                    style={{
                      width: '36px',
                      height: '36px',
                      backgroundColor: '#0a0a0a',
                      border: '1px solid #333',
                      borderRadius: '0.5rem',
                      color: '#999',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1rem',
                    }}
                  >
                    {tool.enabled ? '🔘' : '⭕'}
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => handleEditTool(tool)}
                    title="Edit"
                    style={{
                      width: '36px',
                      height: '36px',
                      backgroundColor: '#0a0a0a',
                      border: '1px solid #333',
                      borderRadius: '0.5rem',
                      color: '#999',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1rem',
                    }}
                  >
                    ✏️
                  </button>

                  {/* Delete */}
                  {deleteConfirm === tool.id ? (
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button
                        onClick={() => void handleDeleteTool(tool.id)}
                        style={{
                          padding: '0.5rem 0.75rem',
                          backgroundColor: '#ef4444',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '0.5rem',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                        }}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        style={{
                          padding: '0.5rem 0.75rem',
                          backgroundColor: '#333',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '0.5rem',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(tool.id)}
                      title="Delete"
                      style={{
                        width: '36px',
                        height: '36px',
                        backgroundColor: '#0a0a0a',
                        border: '1px solid #333',
                        borderRadius: '0.5rem',
                        color: '#ef4444',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1rem',
                      }}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info Card */}
        <div style={{
          backgroundColor: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          marginTop: '2rem',
        }}>
          <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: '600', marginBottom: '0.75rem' }}>
            About Custom Tools
          </h3>
          <ul style={{ color: '#666', fontSize: '0.875rem', lineHeight: '1.75', paddingLeft: '1.25rem' }}>
            <li>Custom tools are embedded as secure, sandboxed iframes</li>
            <li>Only HTTPS URLs are allowed for security</li>
            <li>Tools will appear in the sidebar under &quot;Custom Tools&quot; section</li>
            <li>Disable tools temporarily without deleting them</li>
          </ul>
        </div>
      </div>

      {/* Modal */}
      <ToolModal
        tool={editingTool}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveTool}
        primaryColor={primaryColor}
      />
    </div>
  );
}
