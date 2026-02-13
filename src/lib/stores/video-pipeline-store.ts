/**
 * Video Pipeline State Store
 *
 * Manages the 7-step video production pipeline:
 * Request → Decompose → Pre-Production → Approval → Generation → Assembly → Post-Production
 *
 * Uses Zustand with localStorage persistence for cross-page state.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  PipelineStep,
  PipelineScene,
  PipelineBrief,
  SceneGenerationResult,
  VideoType,
  TargetPlatform,
  TransitionType,
  DecompositionPlan,
  PipelineProject,
} from '@/types/video-pipeline';
import type { VideoAspectRatio, VideoResolution } from '@/types/video';

// ============================================================================
// State Interface
// ============================================================================

export interface VideoPipelineState {
  // Project identity
  projectId: string | null;
  projectName: string;

  // Pipeline flow
  currentStep: PipelineStep;

  // Step 1: Request - Video brief
  brief: PipelineBrief;

  // Step 2: Decompose - AI decomposition plan
  decompositionPlan: DecompositionPlan | null;

  // Step 3: Pre-Production - Scenes and assets
  scenes: PipelineScene[];
  avatarId: string | null;
  avatarName: string | null;
  voiceId: string | null;
  voiceName: string | null;

  // Step 5: Generation - Scene render results
  generatedScenes: SceneGenerationResult[];

  // Step 6: Assembly - Assembled video
  finalVideoUrl: string | null;
  transitionType: TransitionType;

  // Processing flags
  isGenerating: boolean;
  isAssembling: boolean;

  // Actions
  setBrief: (brief: Partial<PipelineBrief>) => void;
  setProjectId: (id: string) => void;
  setProjectName: (name: string) => void;
  setStep: (step: PipelineStep) => void;
  setDecompositionPlan: (plan: DecompositionPlan) => void;
  setScenes: (scenes: PipelineScene[]) => void;
  addScene: (scene: Omit<PipelineScene, 'id'>) => void;
  updateScene: (sceneId: string, updates: Partial<PipelineScene>) => void;
  removeScene: (sceneId: string) => void;
  reorderScenes: (fromIndex: number, toIndex: number) => void;
  setAvatar: (id: string, name: string) => void;
  setVoice: (id: string, name: string) => void;
  setGeneratedScenes: (results: SceneGenerationResult[]) => void;
  updateGeneratedScene: (sceneId: string, updates: Partial<SceneGenerationResult>) => void;
  setFinalVideoUrl: (url: string) => void;
  setTransitionType: (type: TransitionType) => void;
  setIsGenerating: (val: boolean) => void;
  setIsAssembling: (val: boolean) => void;
  canAdvanceTo: (step: PipelineStep) => boolean;
  advanceStep: () => void;
  reset: () => void;
  loadProject: (project: PipelineProject) => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
  projectId: null,
  projectName: '',
  currentStep: 'request' as const,
  brief: {
    description: '',
    videoType: 'tutorial' as VideoType,
    platform: 'youtube' as TargetPlatform,
    duration: 60,
    aspectRatio: '16:9' as VideoAspectRatio,
    resolution: '1080p' as VideoResolution,
  },
  decompositionPlan: null,
  scenes: [],
  avatarId: null,
  avatarName: null,
  voiceId: null,
  voiceName: null,
  generatedScenes: [],
  finalVideoUrl: null,
  transitionType: 'fade' as TransitionType,
  isGenerating: false,
  isAssembling: false,
};

// ============================================================================
// Store Definition
// ============================================================================

export const useVideoPipelineStore = create<VideoPipelineState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setBrief: (brief) =>
        set({
          brief: { ...get().brief, ...brief },
        }),

      setProjectId: (id) => set({ projectId: id }),

      setProjectName: (name) => set({ projectName: name }),

      setStep: (step) => set({ currentStep: step }),

      setDecompositionPlan: (plan) => set({ decompositionPlan: plan }),

      setScenes: (scenes) => set({ scenes }),

      addScene: (scene) => {
        const { scenes } = get();
        const newScene: PipelineScene = {
          ...scene,
          id: crypto.randomUUID(),
        };
        set({ scenes: [...scenes, newScene] });
      },

      updateScene: (sceneId, updates) => {
        const { scenes } = get();
        set({
          scenes: scenes.map((scene) =>
            scene.id === sceneId ? { ...scene, ...updates } : scene
          ),
        });
      },

      removeScene: (sceneId) => {
        const { scenes } = get();
        const filtered = scenes.filter((scene) => scene.id !== sceneId);
        // Renumber remaining scenes
        const renumbered = filtered.map((scene, index) => ({
          ...scene,
          sceneNumber: index + 1,
        }));
        set({ scenes: renumbered });
      },

      reorderScenes: (fromIndex, toIndex) => {
        const { scenes } = get();
        const reordered = [...scenes];
        const [moved] = reordered.splice(fromIndex, 1);
        reordered.splice(toIndex, 0, moved);
        // Renumber all scenes
        const renumbered = reordered.map((scene, index) => ({
          ...scene,
          sceneNumber: index + 1,
        }));
        set({ scenes: renumbered });
      },

      setAvatar: (id, name) =>
        set({
          avatarId: id,
          avatarName: name,
        }),

      setVoice: (id, name) =>
        set({
          voiceId: id,
          voiceName: name,
        }),

      setGeneratedScenes: (results) => set({ generatedScenes: results }),

      updateGeneratedScene: (sceneId, updates) => {
        const { generatedScenes } = get();
        set({
          generatedScenes: generatedScenes.map((scene) =>
            scene.sceneId === sceneId ? { ...scene, ...updates } : scene
          ),
        });
      },

      setFinalVideoUrl: (url) => set({ finalVideoUrl: url }),

      setTransitionType: (type) => set({ transitionType: type }),

      setIsGenerating: (val) => set({ isGenerating: val }),

      setIsAssembling: (val) => set({ isAssembling: val }),

      canAdvanceTo: (step) => {
        const state = get();

        switch (step) {
          case 'request':
            return true; // Can always go to request

          case 'decompose':
            return state.brief.description.trim().length > 0;

          case 'pre-production':
            return state.decompositionPlan !== null;

          case 'approval':
            return (
              state.scenes.length > 0 &&
              state.avatarId !== null &&
              state.voiceId !== null
            );

          case 'generation':
            return state.scenes.every((scene) => scene.scriptText.trim().length > 0);

          case 'assembly':
            return (
              state.generatedScenes.length > 0 &&
              state.generatedScenes.every((scene) => scene.status === 'completed')
            );

          case 'post-production':
            return state.finalVideoUrl !== null;

          default:
            return false;
        }
      },

      advanceStep: () => {
        const state = get();
        const currentIndex = PIPELINE_STEPS.indexOf(state.currentStep);
        if (currentIndex < PIPELINE_STEPS.length - 1) {
          const nextStep = PIPELINE_STEPS[currentIndex + 1];
          if (state.canAdvanceTo(nextStep)) {
            set({ currentStep: nextStep });
          }
        }
      },

      reset: () => set(initialState),

      loadProject: (project) => {
        set({
          projectId: project.id,
          projectName: project.name,
          currentStep: project.currentStep,
          brief: project.brief,
          scenes: project.scenes,
          avatarId: project.avatarId,
          avatarName: project.avatarName,
          voiceId: project.voiceId,
          voiceName: project.voiceName,
          generatedScenes: project.generatedScenes,
          finalVideoUrl: project.finalVideoUrl,
          transitionType: project.transitionType,
        });
      },
    }),
    {
      name: 'video-pipeline-state',
      storage: createJSONStorage(() => localStorage),
      // Persist everything except processing flags
      partialize: (state) => ({
        projectId: state.projectId,
        projectName: state.projectName,
        currentStep: state.currentStep,
        brief: state.brief,
        decompositionPlan: state.decompositionPlan,
        scenes: state.scenes,
        avatarId: state.avatarId,
        avatarName: state.avatarName,
        voiceId: state.voiceId,
        voiceName: state.voiceName,
        generatedScenes: state.generatedScenes,
        finalVideoUrl: state.finalVideoUrl,
        transitionType: state.transitionType,
      }),
    }
  )
);

// ============================================================================
// Pipeline Steps Constant (for step navigation)
// ============================================================================

const PIPELINE_STEPS: readonly PipelineStep[] = [
  'request',
  'decompose',
  'pre-production',
  'approval',
  'generation',
  'assembly',
  'post-production',
] as const;
