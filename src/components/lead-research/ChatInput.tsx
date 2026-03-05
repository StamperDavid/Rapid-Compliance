'use client';

import { useState, type FormEvent } from 'react';
import { Send, Loader2 } from 'lucide-react';

interface ChatInputProps {
  onSend: (text: string) => void;
  isLoading: boolean;
}

const QUICK_ACTIONS = [
  'Find SaaS companies in Austin',
  'Research HVAC companies in Texas',
  'Show my ICP profile',
  'Start discovery scan',
];

export default function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [input, setInput] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) {return;}
    onSend(input.trim());
    setInput('');
  };

  return (
    <div className="border-t border-[var(--color-border-light)] p-3">
      <div className="flex flex-wrap gap-1.5 mb-2">
        {QUICK_ACTIONS.map(action => (
          <button
            key={action}
            type="button"
            onClick={() => { if (!isLoading) {onSend(action);} }}
            className="text-xs px-2.5 py-1 rounded-full bg-[var(--color-bg-main)] text-[var(--color-text-secondary)] border border-[var(--color-border-light)] hover:border-blue-500 hover:text-blue-400 transition-colors"
          >
            {action}
          </button>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Describe your ideal customer or ask a question..."
          disabled={isLoading}
          className="flex-1 bg-[var(--color-bg-main)] border border-[var(--color-border-light)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-disabled)] focus:outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </form>
    </div>
  );
}
