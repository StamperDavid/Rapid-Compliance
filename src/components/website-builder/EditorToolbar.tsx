/**
 * Editor Toolbar
 * Top toolbar with page settings, breakpoint switcher, undo/redo, save
 */

'use client';

import type { Page } from '@/types/website';

interface EditorToolbarProps {
  page: Page;
  breakpoint: 'desktop' | 'tablet' | 'mobile';
  onBreakpointChange: (breakpoint: 'desktop' | 'tablet' | 'mobile') => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onSaveAsTemplate?: () => void;
  onPublish?: () => void;
  onUnpublish?: () => void;
  onPreview?: () => void;
  onSchedule?: () => void;
  onViewVersions?: () => void;
  saving: boolean;
  publishing?: boolean;
  autoSaveEnabled: boolean;
  onToggleAutoSave: () => void;
}

export default function EditorToolbar({
  page,
  breakpoint,
  onBreakpointChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSave,
  onSaveAsTemplate,
  onPublish,
  onUnpublish,
  onPreview,
  onSchedule,
  onViewVersions,
  saving,
  publishing = false,
  autoSaveEnabled,
  onToggleAutoSave,
}: EditorToolbarProps) {
  return (
    <div style={{
      height: '60px',
      background: 'var(--color-bg-paper)',
      color: 'var(--color-text-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 1.5rem',
      borderBottom: '1px solid var(--color-border-light)',
    }}>
      {/* Left: Page info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '0.875rem', fontWeight: '600' }}>
            {page.title}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
            /{page.slug}
          </div>
        </div>

        <div style={{
          padding: '0.25rem 0.5rem',
          background: page.status === 'published' ? 'var(--color-success)' : 'var(--color-warning)',
          borderRadius: '4px',
          fontSize: '0.75rem',
          fontWeight: '600',
          textTransform: 'uppercase',
          color: 'white',
        }}>
          {page.status}
        </div>
      </div>

      {/* Center: Breakpoint switcher & undo/redo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {/* Undo/Redo */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            style={{
              padding: '0.5rem 0.75rem',
              background: canUndo ? 'var(--color-bg-elevated)' : 'var(--color-bg-paper)',
              color: canUndo ? 'var(--color-text-primary)' : 'var(--color-text-disabled)',
              border: 'none',
              borderRadius: '4px',
              cursor: canUndo ? 'pointer' : 'not-allowed',
              fontSize: '0.875rem',
            }}
          >
            ↶ Undo
          </button>

          <button
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
            style={{
              padding: '0.5rem 0.75rem',
              background: canRedo ? 'var(--color-bg-elevated)' : 'var(--color-bg-paper)',
              color: canRedo ? 'var(--color-text-primary)' : 'var(--color-text-disabled)',
              border: 'none',
              borderRadius: '4px',
              cursor: canRedo ? 'pointer' : 'not-allowed',
              fontSize: '0.875rem',
            }}
          >
            ↷ Redo
          </button>
        </div>

        {/* Breakpoint Switcher */}
        <div style={{
          display: 'flex',
          background: 'var(--color-bg-elevated)',
          borderRadius: '4px',
          padding: '0.25rem',
          gap: '0.25rem',
        }}>
          <button
            onClick={() => onBreakpointChange('desktop')}
            style={{
              padding: '0.5rem 1rem',
              background: breakpoint === 'desktop' ? 'var(--color-primary)' : 'transparent',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            🖥️ Desktop
          </button>

          <button
            onClick={() => onBreakpointChange('tablet')}
            style={{
              padding: '0.5rem 1rem',
              background: breakpoint === 'tablet' ? 'var(--color-primary)' : 'transparent',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            📱 Tablet
          </button>

          <button
            onClick={() => onBreakpointChange('mobile')}
            style={{
              padding: '0.5rem 1rem',
              background: breakpoint === 'mobile' ? 'var(--color-primary)' : 'transparent',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            📱 Mobile
          </button>
        </div>
      </div>

      {/* Right: Auto-save toggle, Preview, Publish, Save as Template & Save button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.875rem',
          cursor: 'pointer',
        }}>
          <input
            type="checkbox"
            checked={autoSaveEnabled}
            onChange={onToggleAutoSave}
            style={{ width: '16px', height: '16px' }}
          />
          Auto-save
        </label>

        {/* Preview Button */}
        {onPreview && (
          <button
            onClick={onPreview}
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--color-primary)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
            }}
          >
            👁️ Preview
          </button>
        )}

        {/* View Versions Button */}
        {onViewVersions && (
          <button
            onClick={onViewVersions}
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--color-bg-elevated)',
              color: 'var(--color-text-primary)',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
            }}
          >
            📜 Versions
          </button>
        )}

        {onSaveAsTemplate && (
          <button
            onClick={onSaveAsTemplate}
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--color-bg-elevated)',
              color: 'var(--color-text-primary)',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
            }}
          >
            💾 Save as Template
          </button>
        )}

        {/* Publish/Unpublish/Schedule Buttons */}
        {page.status === 'published' ? (
          onUnpublish && (
            <button
              onClick={onUnpublish}
              disabled={publishing}
              style={{
                padding: '0.5rem 1rem',
                background: publishing ? 'var(--color-text-disabled)' : 'var(--color-warning)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: publishing ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: '600',
              }}
            >
              {publishing ? 'Unpublishing...' : '📤 Unpublish'}
            </button>
          )
        ) : page.status === 'scheduled' ? (
          onUnpublish && (
            <button
              onClick={onUnpublish}
              disabled={publishing}
              style={{
                padding: '0.5rem 1rem',
                background: publishing ? 'var(--color-text-disabled)' : 'var(--color-warning)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: publishing ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: '600',
              }}
            >
              {publishing ? 'Canceling...' : '🗑️ Cancel Schedule'}
            </button>
          )
        ) : (
          <>
            {onPublish && (
              <button
                onClick={onPublish}
                disabled={publishing}
                style={{
                  padding: '0.5rem 1rem',
                  background: publishing ? 'var(--color-text-disabled)' : 'var(--color-primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: publishing ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                }}
              >
                {publishing ? 'Publishing...' : '🚀 Publish'}
              </button>
            )}
            {onSchedule && (
              <button
                onClick={onSchedule}
                disabled={publishing}
                style={{
                  padding: '0.5rem 1rem',
                  background: publishing ? 'var(--color-text-disabled)' : 'var(--color-secondary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: publishing ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                }}
              >
                📅 Schedule
              </button>
            )}
          </>
        )}

        <button
          onClick={onSave}
          disabled={saving}
          style={{
            padding: '0.5rem 1.5rem',
            background: saving ? 'var(--color-text-disabled)' : 'var(--color-success)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem',
            fontWeight: '600',
          }}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}

