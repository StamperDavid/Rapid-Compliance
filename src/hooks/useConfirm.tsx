'use client';

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { focusManagement } from '@/lib/accessibility/aria-utils';

interface ConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'destructive' | 'default';
}

interface PromptOptions {
  title: string;
  description: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;
type PromptFn = (options: PromptOptions) => Promise<string | null>;

interface DialogContextValue {
  confirm: ConfirmFn;
  prompt: PromptFn;
}

const DialogContext = createContext<DialogContextValue | null>(null);

type DialogState =
  | { type: 'confirm'; options: ConfirmOptions; resolve: (v: boolean) => void }
  | { type: 'prompt'; options: PromptOptions; resolve: (v: string | null) => void };

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [promptValue, setPromptValue] = useState('');
  const dialogRef = useRef<DialogState | null>(null);
  const promptValueRef = useRef('');

  dialogRef.current = dialog;
  promptValueRef.current = promptValue;

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      setDialog({ type: 'confirm', options, resolve });
    });
  }, []);

  const prompt = useCallback<PromptFn>((options) => {
    return new Promise<string | null>((resolve) => {
      setPromptValue(options.defaultValue ?? '');
      setDialog({ type: 'prompt', options, resolve });
    });
  }, []);

  const handleClose = useCallback(() => {
    const d = dialogRef.current;
    if (!d) { return; }
    if (d.type === 'confirm') {
      d.resolve(false);
    } else {
      d.resolve(null);
    }
    setDialog(null);
  }, []);

  const handleConfirm = useCallback(() => {
    const d = dialogRef.current;
    if (!d) { return; }
    if (d.type === 'confirm') {
      d.resolve(true);
    } else {
      d.resolve(promptValueRef.current);
    }
    setDialog(null);
  }, []);

  return (
    <DialogContext.Provider value={{ confirm, prompt }}>
      {children}

      {dialog?.type === 'confirm' && (
        <ConfirmDialog
          open
          onClose={handleClose}
          onConfirm={handleConfirm}
          title={dialog.options.title}
          description={dialog.options.description}
          confirmLabel={dialog.options.confirmLabel}
          cancelLabel={dialog.options.cancelLabel}
          variant={dialog.options.variant}
        />
      )}

      <AnimatePresence>
        {dialog?.type === 'prompt' && (
          <PromptDialogInner
            title={dialog.options.title}
            description={dialog.options.description}
            placeholder={dialog.options.placeholder}
            confirmLabel={dialog.options.confirmLabel}
            cancelLabel={dialog.options.cancelLabel}
            value={promptValue}
            onChange={setPromptValue}
            onClose={handleClose}
            onConfirm={handleConfirm}
          />
        )}
      </AnimatePresence>
    </DialogContext.Provider>
  );
}

function PromptDialogInner({
  title,
  description,
  placeholder,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  value,
  onChange,
  onClose,
  onConfirm,
}: {
  title: string;
  description: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    requestAnimationFrame(() => inputRef.current?.focus());

    const el = contentRef.current;
    if (!el) { return; }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
        return;
      }
      focusManagement.trapFocus(el, e);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      focusManagement.returnFocus(previousFocusRef.current);
    };
  }, [onClose, onConfirm]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <motion.div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-surface-paper border border-border-light rounded-2xl w-full max-w-md shadow-2xl"
      >
        <div className="p-6">
          <h3 id={titleId} className="text-lg font-semibold text-[var(--color-text-primary)]">{title}</h3>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{description}</p>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="mt-4 w-full px-3 py-2 bg-surface-elevated border border-border-light rounded-xl text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border-light">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] bg-surface-elevated hover:bg-surface-elevated/80 border border-border-light rounded-xl transition-all"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-semibold bg-primary hover:bg-primary-light text-white rounded-xl transition-all"
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(DialogContext);
  if (!ctx) { throw new Error('useConfirm must be used within ConfirmProvider'); }
  return ctx.confirm;
}

export function usePrompt(): PromptFn {
  const ctx = useContext(DialogContext);
  if (!ctx) { throw new Error('usePrompt must be used within ConfirmProvider'); }
  return ctx.prompt;
}
