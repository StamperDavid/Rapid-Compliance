/**
 * useFeatureVisibility Hook
 *
 * React hook for managing feature visibility in the UI.
 * Fetches visibility settings from Firestore and provides
 * methods to toggle features on/off.
 *
 * Used by:
 * - Workspace Layout (to filter navigation)
 * - Dashboard (to hide unconfigured widgets)
 * - AI Implementation Guide (to hide features on demand)
 *
 * @module useFeatureVisibility
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './useAuth';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';
import {
  FeatureToggleService,
  buildNavigationStructure,
  type NavSection,
  type FeatureCategory,
  type FeatureStatus,
  type FeatureVisibilitySettings,
} from '@/lib/orchestrator/feature-toggle-service';

export interface UseFeatureVisibilityResult {
  // Data
  settings: FeatureVisibilitySettings | null;
  filteredNav: NavSection[];
  hiddenCount: number;
  isLoading: boolean;
  error: Error | null;

  // Actions
  toggleFeature: (featureId: string, hidden: boolean, reason?: string) => Promise<void>;
  toggleCategory: (category: FeatureCategory, hidden: boolean) => Promise<void>;
  hideFeatures: (featureIds: string[], reason?: string) => Promise<void>;
  showFeatures: (featureIds: string[]) => Promise<void>;
  resetToDefault: () => Promise<void>;
  isFeatureHidden: (featureId: string) => boolean;
  isCategoryHidden: (category: FeatureCategory) => boolean;
  refresh: () => Promise<void>;
}

export function useFeatureVisibility(): UseFeatureVisibilityResult {
  const { user } = useAuth();
  const [settings, setSettings] = useState<FeatureVisibilitySettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch visibility settings
  const fetchSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await FeatureToggleService.getVisibilitySettings();
      setSettings(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch visibility settings'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  // Build filtered navigation - applies uniformly to all roles
  const filteredNav = useMemo(() => {
    const fullNav = buildNavigationStructure();

    if (!settings) {
      return fullNav; // No settings = show everything
    }

    return fullNav
      // Filter out hidden categories
      .filter(section => !settings.hiddenCategories.includes(section.id))
      // Filter out hidden items within each section
      .map(section => ({
        ...section,
        items: section.items.filter(item => {
          if (!item.featureId) {
            return true;
          }
          const featureSettings = settings.features[item.featureId];
          return featureSettings?.status !== 'hidden';
        }),
      }))
      // Remove empty sections
      .filter(section => section.items.length > 0);
  }, [settings]);

  // Count hidden features - applies uniformly to all roles
  const hiddenCount = useMemo(() => {
    if (!settings) {
      return 0;
    }
    const hiddenFeatures = Object.values(settings.features).filter(f => f.status === 'hidden').length;
    return hiddenFeatures + settings.hiddenCategories.length;
  }, [settings]);

  // Toggle a single feature
  const toggleFeature = useCallback(async (featureId: string, hidden: boolean, reason?: string) => {
    if (!user?.id) {
      return;
    }

    const status: FeatureStatus = hidden ? 'hidden' : 'unconfigured';
    await FeatureToggleService.toggleFeature(featureId, status, user.id, reason);

    // Update local state immediately for responsiveness
    setSettings(prev => {
      if (!prev) {
        return {
          organizationId: DEFAULT_ORG_ID,
          features: {
            [featureId]: {
              featureId,
              status,
              hiddenAt: hidden ? new Date() : undefined,
              hiddenBy: hidden ? user.id : undefined,
              reason: hidden ? reason : undefined,
            },
          },
          hiddenCategories: [],
          updatedAt: new Date(),
          updatedBy: user.id,
        };
      }

      return {
        ...prev,
        features: {
          ...prev.features,
          [featureId]: {
            featureId,
            status,
            hiddenAt: hidden ? new Date() : undefined,
            hiddenBy: hidden ? user.id : undefined,
            reason: hidden ? reason : undefined,
          },
        },
        updatedAt: new Date(),
        updatedBy: user.id,
      };
    });
  }, [user?.id]);

  // Toggle an entire category
  const toggleCategory = useCallback(async (category: FeatureCategory, hidden: boolean) => {
    if (!user?.id) {
      return;
    }

    await FeatureToggleService.toggleCategory(category, hidden, user.id);

    // Update local state
    setSettings(prev => {
      if (!prev) {
        return {
          organizationId: DEFAULT_ORG_ID,
          features: {},
          hiddenCategories: hidden ? [category] : [],
          updatedAt: new Date(),
          updatedBy: user.id,
        };
      }

      const newHiddenCategories = hidden
        ? [...prev.hiddenCategories.filter(c => c !== category), category]
        : prev.hiddenCategories.filter(c => c !== category);

      return {
        ...prev,
        hiddenCategories: newHiddenCategories,
        updatedAt: new Date(),
        updatedBy: user.id,
      };
    });
  }, [user?.id]);

  // Hide multiple features
  const hideFeatures = useCallback(async (featureIds: string[], reason?: string) => {
    if (!user?.id) {
      return;
    }
    await FeatureToggleService.hideFeatures(featureIds, user.id, reason);
    await fetchSettings();
  }, [user?.id, fetchSettings]);

  // Show multiple features
  const showFeatures = useCallback(async (featureIds: string[]) => {
    if (!user?.id) {
      return;
    }
    await FeatureToggleService.showFeatures(featureIds, user.id);
    await fetchSettings();
  }, [user?.id, fetchSettings]);

  // Reset to default
  const resetToDefault = useCallback(async () => {
    if (!user?.id) {
      return;
    }
    await FeatureToggleService.resetToDefault(user.id);
    setSettings({
      organizationId: DEFAULT_ORG_ID,
      features: {},
      hiddenCategories: [],
      updatedAt: new Date(),
      updatedBy: user.id,
    });
  }, [user?.id]);

  // Check if a feature is hidden - applies uniformly to all roles
  const isFeatureHidden = useCallback((featureId: string): boolean => {
    if (!settings) {
      return false;
    }
    return settings.features[featureId]?.status === 'hidden';
  }, [settings]);

  // Check if a category is hidden - applies uniformly to all roles
  const isCategoryHidden = useCallback((category: FeatureCategory): boolean => {
    if (!settings) {
      return false;
    }
    return settings.hiddenCategories.includes(category);
  }, [settings]);

  return {
    settings,
    filteredNav,
    hiddenCount,
    isLoading,
    error,
    toggleFeature,
    toggleCategory,
    hideFeatures,
    showFeatures,
    resetToDefault,
    isFeatureHidden,
    isCategoryHidden,
    refresh: fetchSettings,
  };
}

export default useFeatureVisibility;
