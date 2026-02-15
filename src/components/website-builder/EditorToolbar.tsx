/**
 * Editor Toolbar
 * Top toolbar with page info, breakpoint switcher, undo/redo, save, reset
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
  onReset?: () => void;
  saving: boolean;
  publishing?: boolean;
  autoSaveEnabled: boolean;
  onToggleAutoSave: () => void;
  hasUnsavedChanges?: boolean;
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
  onReset,
  saving,
  autoSaveEnabled,
  onToggleAutoSave,
  hasUnsavedChanges = false,
}: EditorToolbarProps) {
  return (
    <div style={{
      height: '56px',
      background: '#0a0a0a',
      color: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 1.5rem',
      borderBottom: '1px solid rgba(255,255,255,0.1)',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Left: Page info + unsaved indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#ffffff' }}>
            {page.title}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
            /{page.slug}
          </div>
        </div>

        <div style={{
          padding: '0.2rem 0.5rem',
          background: page.status === 'published' ? '#10b981' : '#f59e0b',
          borderRadius: '4px',
          fontSize: '0.65rem',
          fontWeight: '600',
          textTransform: 'uppercase',
          color: 'white',
          letterSpacing: '0.5px',
        }}>
          {page.status}
        </div>

        {hasUnsavedChanges && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: '#f59e0b' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
            Unsaved
          </div>
        )}
      </div>

      {/* Center: Undo/Redo + Breakpoint switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {/* Undo/Redo */}
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <button
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            style={{
              padding: '0.4rem 0.6rem',
              background: canUndo ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: canUndo ? '#ffffff' : 'rgba(255,255,255,0.3)',
              border: 'none',
              borderRadius: '4px',
              cursor: canUndo ? 'pointer' : 'not-allowed',
              fontSize: '0.8rem',
            }}
          >
            Undo
          </button>

          <button
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
            style={{
              padding: '0.4rem 0.6rem',
              background: canRedo ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: canRedo ? '#ffffff' : 'rgba(255,255,255,0.3)',
              border: 'none',
              borderRadius: '4px',
              cursor: canRedo ? 'pointer' : 'not-allowed',
              fontSize: '0.8rem',
            }}
          >
            Redo
          </button>
        </div>

        {/* Breakpoint Switcher */}
        <div style={{
          display: 'flex',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '6px',
          padding: '0.2rem',
          gap: '0.15rem',
        }}>
          {(['desktop', 'tablet', 'mobile'] as const).map(bp => (
            <button
              key={bp}
              onClick={() => onBreakpointChange(bp)}
              style={{
                padding: '0.4rem 0.75rem',
                background: breakpoint === bp ? '#6366f1' : 'transparent',
                color: breakpoint === bp ? '#ffffff' : 'rgba(255,255,255,0.6)',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                textTransform: 'capitalize',
              }}
            >
              {bp}
            </button>
          ))}
        </div>
      </div>

      {/* Right: Auto-save, Reset, Save */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          fontSize: '0.8rem',
          cursor: 'pointer',
          color: 'rgba(255,255,255,0.6)',
        }}>
          <input
            type="checkbox"
            checked={autoSaveEnabled}
            onChange={onToggleAutoSave}
            style={{ width: '14px', height: '14px', accentColor: '#6366f1' }}
          />
          Auto-save
        </label>

        {onReset && (
          <button
            onClick={onReset}
            style={{
              padding: '0.4rem 0.75rem',
              background: 'rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.7)',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.8rem',
            }}
          >
            Reset Page
          </button>
        )}

        <button
          onClick={onSave}
          disabled={saving}
          style={{
            padding: '0.4rem 1.25rem',
            background: saving ? 'rgba(255,255,255,0.2)' : '#6366f1',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: '0.85rem',
            fontWeight: '600',
          }}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
