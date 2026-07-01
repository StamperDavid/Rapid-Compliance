/**
 * GlobalStylesContext — carries the live global design tokens (Elementor
 * "Global Colors/Fonts") down to the renderer so the editor can preview token
 * edits without a page reload.
 *
 * Default is `null`: when there is NO provider (e.g. the public live `/sites`
 * route), consumers fall back to seeding tokens from the brand/theme directly.
 * This keeps the live site fully self-sufficient — the provider is an
 * editor-only enhancement, never a requirement.
 */

'use client';

import { createContext, useContext } from 'react';
import type { GlobalStyleTokens } from '@/types/website';

/**
 * The live global tokens for the current site, or `null` when no provider is
 * mounted (consumers then fall back to `themeToTokens(theme)`).
 */
export const GlobalStylesContext = createContext<GlobalStyleTokens | null>(null);

/**
 * Provide a live set of global design tokens to descendants. Wrap the editor
 * canvas with this so token edits preview immediately; the live site omits it.
 */
export function GlobalStylesProvider({
  value,
  children,
}: {
  value: GlobalStyleTokens;
  children: React.ReactNode;
}): React.JSX.Element {
  return <GlobalStylesContext.Provider value={value}>{children}</GlobalStylesContext.Provider>;
}

/**
 * Read the current global design tokens. Returns `null` when no
 * `GlobalStylesProvider` is above in the tree (e.g. on the live site), letting
 * the caller fall back to brand/theme-derived tokens.
 */
export function useGlobalStyles(): GlobalStyleTokens | null {
  return useContext(GlobalStylesContext);
}
