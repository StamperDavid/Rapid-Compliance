/**
 * Entity Config Store
 *
 * Zustand store for entity toggle state.
 * Key behavior: if no config exists in Firestore, isEntityEnabled()
 * returns true for all entities (backward compat for existing users).
 * Always-on entities always return true regardless of config.
 */

import { create } from 'zustand';
import type { EntityConfig } from '@/types/entity-config';
import { isAlwaysOnEntity, DEFAULT_ENTITY_CONFIG } from '@/lib/constants/entity-config';
import { getCurrentUser } from '@/lib/auth/auth-service';

interface EntityConfigStoreState {
  config: EntityConfig | null;
  loading: boolean;
  initialized: boolean;

  /** Load config from API */
  loadConfig: () => Promise<void>;

  /**
   * Check if an entity is enabled.
   * Always-on entities always return true.
   * Returns true for all entities if no config exists (backward compat).
   */
  isEntityEnabled: (entityId: string) => boolean;

  /** Toggle a single entity */
  updateEntity: (entityId: string, enabled: boolean) => void;

  /** Replace all entity toggles at once */
  updateAllEntities: (entities: Record<string, boolean>) => void;

  /** Set config directly (e.g., from API response) */
  setConfig: (config: EntityConfig) => void;
}

export const useEntityConfigStore = create<EntityConfigStoreState>((set, get) => ({
  config: null,
  loading: false,
  initialized: false,

  loadConfig: async () => {
    if (get().loading) { return; }
    set({ loading: true });

    try {
      const headers: Record<string, string> = {};
      const user = getCurrentUser();
      if (user) {
        const token = await user.getIdToken();
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch('/api/entity-config', { headers });
      if (res.ok) {
        const data = (await res.json()) as { config: EntityConfig | null };
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

  isEntityEnabled: (entityId: string): boolean => {
    // Always-on entities are never disabled
    if (isAlwaysOnEntity(entityId)) { return true; }

    const { config, initialized } = get();
    // Not yet initialized — hide non-always-on entities to prevent flash of wrong content
    if (!initialized) { return false; }
    // No config exists — existing user, show everything (backward compat)
    if (!config) { return true; }
    // Config exists — respect the toggle (default false for unknown entities)
    return config.entities[entityId] ?? false;
  },

  updateEntity: (entityId: string, enabled: boolean) => {
    const { config } = get();
    const current = config ?? DEFAULT_ENTITY_CONFIG;
    set({
      config: {
        ...current,
        entities: { ...current.entities, [entityId]: enabled },
        updatedAt: new Date().toISOString(),
      },
    });
  },

  updateAllEntities: (entities: Record<string, boolean>) => {
    const { config } = get();
    const current = config ?? DEFAULT_ENTITY_CONFIG;
    set({
      config: {
        ...current,
        entities,
        updatedAt: new Date().toISOString(),
      },
    });
  },

  setConfig: (config: EntityConfig) => {
    set({ config, initialized: true });
  },
}));
