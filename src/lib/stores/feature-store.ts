/**
 * Feature Module Store
 *
 * Zustand store for feature toggle state.
 * Key behavior: if no config exists in Firestore, isModuleEnabled()
 * returns true for all modules (backward compat for existing users).
 */

import { create } from 'zustand';
import type { FeatureConfig, FeatureModuleId } from '@/types/feature-modules';
import { DEFAULT_FEATURE_CONFIG } from '@/lib/constants/feature-modules';

interface FeatureStoreState {
  config: FeatureConfig | null;
  loading: boolean;
  initialized: boolean;

  /** Load config from API */
  loadConfig: () => Promise<void>;

  /**
   * Check if a module is enabled.
   * Returns true for all modules if no config exists (backward compat).
   */
  isModuleEnabled: (id: FeatureModuleId) => boolean;

  /** Toggle a single module */
  updateModule: (id: FeatureModuleId, enabled: boolean) => void;

  /** Replace all module toggles at once */
  updateAllModules: (modules: Record<FeatureModuleId, boolean>) => void;

  /** Set config directly (e.g., from API response) */
  setConfig: (config: FeatureConfig) => void;
}

export const useFeatureStore = create<FeatureStoreState>((set, get) => ({
  config: null,
  loading: false,
  initialized: false,

  loadConfig: async () => {
    if (get().loading) { return; }
    set({ loading: true });

    try {
      const res = await fetch('/api/features');
      if (res.ok) {
        const data = (await res.json()) as { config: FeatureConfig | null };
        set({
          config: data.config,
          initialized: true,
          loading: false,
        });
      } else {
        set({ initialized: true, loading: false });
      }
    } catch {
      set({ initialized: true, loading: false });
    }
  },

  isModuleEnabled: (id: FeatureModuleId): boolean => {
    const { config, initialized } = get();
    // Not yet initialized — show everything to prevent flash-of-hidden-content
    if (!initialized) { return true; }
    // No config exists — existing user, show everything
    if (!config) { return true; }
    // Config exists — respect the toggle
    return config.modules[id] ?? true;
  },

  updateModule: (id: FeatureModuleId, enabled: boolean) => {
    const { config } = get();
    const current = config ?? DEFAULT_FEATURE_CONFIG;
    set({
      config: {
        ...current,
        modules: { ...current.modules, [id]: enabled },
        updatedAt: new Date().toISOString(),
      },
    });
  },

  updateAllModules: (modules: Record<FeatureModuleId, boolean>) => {
    const { config } = get();
    const current = config ?? DEFAULT_FEATURE_CONFIG;
    set({
      config: {
        ...current,
        modules,
        updatedAt: new Date().toISOString(),
      },
    });
  },

  setConfig: (config: FeatureConfig) => {
    set({ config, initialized: true });
  },
}));
