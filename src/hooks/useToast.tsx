'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const ToastContext = createContext<ToastContextValue | null>(null);

// ============================================================================
// PROVIDER
// ============================================================================

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const removeToast = useCallback((id: string) => {
    const timeout = timeoutRefs.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutRefs.current.delete(id);
    }
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((type: ToastType, message: string, duration = 4000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const toast: Toast = { id, type, message, duration };

    setToasts(prev => [...prev, toast]);

    if (duration > 0) {
      const timeout = setTimeout(() => removeToast(id), duration);
      timeoutRefs.current.set(id, timeout);
    }
  }, [removeToast]);

  const success = useCallback((message: string, duration?: number) =>
    addToast('success', message, duration), [addToast]);

  const error = useCallback((message: string, duration?: number) =>
    addToast('error', message, duration), [addToast]);

  const warning = useCallback((message: string, duration?: number) =>
    addToast('warning', message, duration), [addToast]);

  const info = useCallback((message: string, duration?: number) =>
    addToast('info', message, duration), [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, warning, info }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    // Return a no-op implementation when outside provider
    return {
      toasts: [],
      addToast: () => {},
      removeToast: () => {},
      success: () => {},
      error: () => {},
      warning: () => {},
      info: () => {},
    };
  }
  return context;
}

// ============================================================================
// TOAST CONTAINER COMPONENT
// ============================================================================

const typeStyles: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: { bg: 'bg-green-900/90', border: 'border-green-500/50', icon: '✓' },
  error: { bg: 'bg-red-900/90', border: 'border-red-500/50', icon: '✕' },
  warning: { bg: 'bg-yellow-900/90', border: 'border-yellow-500/50', icon: '⚠' },
  info: { bg: 'bg-blue-900/90', border: 'border-blue-500/50', icon: 'ℹ' },
};

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
      {toasts.map(toast => {
        const styles = typeStyles[toast.type];
        return (
          <div
            key={toast.id}
            className={`${styles.bg} ${styles.border} border backdrop-blur-xl rounded-lg p-4 shadow-xl flex items-start gap-3 animate-in slide-in-from-right-5 duration-200`}
          >
            <span className="text-lg flex-shrink-0">{styles.icon}</span>
            <p className="text-white text-sm flex-1">{toast.message}</p>
            <button
              onClick={() => onRemove(toast.id)}
              className="text-white/60 hover:text-white text-lg leading-none flex-shrink-0"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default useToast;
