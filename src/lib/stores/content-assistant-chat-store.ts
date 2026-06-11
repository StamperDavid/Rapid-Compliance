/**
 * Persistent chat state for the Content Assistant — the chat box through which
 * the Content Manager is accessed. It lives ONLY in the content generator
 * (`/content/*`), but its conversation must survive moving between the content
 * sub-pages (video / image / library / editor / voice) and a browser refresh,
 * clearing only when the site is closed.
 *
 * Uses sessionStorage (NOT localStorage): the chat must survive page-switches and
 * refresh WITHIN a session, but clear the moment the operator closes the site —
 * exactly the "lives until the site is closed" requirement. localStorage would
 * outlive a site close and leave a stale conversation behind.
 *
 * Only the conversation and the panel-open flag persist. Transient composer
 * state (draft input, in-flight attachments whose previews are local `blob:`
 * URLs that die on reload, loading flags) is intentionally NOT persisted.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const WELCOME: ChatMessage = {
  role: 'assistant',
  content:
    "Hey — I'm your creative director. Tell me what you're trying to make and I'll help you shape it. Even a rough idea works: who's it for, where will it live, what feeling should it leave behind?",
};

type MessagesUpdater = ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[]);

interface ContentAssistantChatState {
  messages: ChatMessage[];
  open: boolean;
  /** Accepts a value or an updater fn, matching React's setState ergonomics. */
  setMessages: (value: MessagesUpdater) => void;
  setOpen: (open: boolean) => void;
  /** Wipe the conversation back to just the welcome line (new chat). */
  resetChat: () => void;
}

export const useContentAssistantChatStore = create<ContentAssistantChatState>()(
  persist(
    (set) => ({
      messages: [WELCOME],
      open: false,
      setMessages: (value) =>
        set((state) => ({
          messages: typeof value === 'function' ? value(state.messages) : value,
        })),
      setOpen: (open) => set({ open }),
      resetChat: () => set({ messages: [WELCOME] }),
    }),
    {
      name: 'content-assistant-chat',
      // sessionStorage → survives nav + refresh, clears when the site is closed.
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        messages: state.messages,
        open: state.open,
      }),
    },
  ),
);
