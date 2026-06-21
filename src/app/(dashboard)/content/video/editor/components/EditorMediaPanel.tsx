'use client';

/**
 * Editor Media Panel
 * Left sidebar for the video editor — Library, Projects, Characters, Upload tabs.
 * Dispatches ADD_CLIP / ADD_AUDIO_TRACK actions directly to the editor reducer.
 */

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderOpen,
  Film,
  Users,
  Upload,
  Search,
  Plus,
  Loader2,
  Music,
} from 'lucide-react';

import type { EditorAction } from '../types';
import type { TransitionType, PipelineProject } from '@/types/video-pipeline';
import type { MediaItem, MediaType, AudioCategory } from '@/types/media-library';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { MediaThumbnail } from './MediaThumbnail';

// ============================================================================
// Types
// ============================================================================

interface EditorMediaPanelProps {
  dispatch: React.Dispatch<EditorAction>;
  defaultTransition: TransitionType;
}

type MediaPanelTab = 'library' | 'projects' | 'characters' | 'upload';
type LibraryMediaType = 'all' | MediaType;
type LibraryAudioFilter = 'all' | AudioCategory;

interface ProjectSummary {
  id: string;
  name: string;
  type: string;
  status: string;
  sceneCount: number;
  hasVideo: boolean;
  updatedAt: string;
}

interface AvatarProfile {
  id: string;
  name: string;
  imageUrl: string | null;
  source: string;
  role: string;
}

// ============================================================================
// Media Item Card (internal)
// ============================================================================

function MediaItemCard({
  item,
  onAddToTimeline,
  actionLabel,
}: {
  item: MediaItem;
  onAddToTimeline?: () => void;
  actionLabel?: string;
}) {
  const isAddable = Boolean(onAddToTimeline && actionLabel);

  // Audio items have no useful thumbnail — keep them as a compact row.
  if (item.type === 'audio') {
    return (
      <button
        type="button"
        disabled={!isAddable}
        onClick={() => onAddToTimeline?.()}
        title={actionLabel}
        className={`group flex w-full items-center gap-2 rounded-md border border-border-strong bg-surface-elevated/30 p-2 text-left transition-colors ${
          isAddable ? 'cursor-pointer hover:border-primary/40 hover:bg-surface-elevated/60' : ''
        }`}
      >
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-primary/10">
          <Music className="h-4 w-4 text-primary-light" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-foreground">{item.name}</p>
          <p className="text-[10px] capitalize text-muted-foreground">{item.category}</p>
        </div>
        {isAddable && (
          <span className="inline-flex flex-shrink-0 items-center gap-1 rounded bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary-light transition-colors group-hover:bg-primary/20">
            <Plus className="h-3 w-3" />
            Add track
          </span>
        )}
      </button>
    );
  }

  // Video + image: a clickable visual tile with a real thumbnail.
  return (
    <button
      type="button"
      disabled={!isAddable}
      onClick={() => onAddToTimeline?.()}
      title={actionLabel}
      className={`group relative block w-full overflow-hidden rounded-lg border border-border-strong bg-surface-elevated/30 text-left transition-all ${
        isAddable ? 'cursor-pointer hover:border-primary/50 hover:bg-surface-elevated/60' : ''
      }`}
    >
      <MediaThumbnail type={item.type} thumbnailUrl={item.thumbnailUrl} alt={item.name} />

      {/* Hover "Add" overlay — clearly signals the whole tile is clickable. */}
      {isAddable && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/0 opacity-0 transition-all group-hover:bg-background/40 group-hover:opacity-100">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-lg">
            <Plus className="h-3.5 w-3.5" />
            {actionLabel}
          </span>
        </div>
      )}

      <div className="p-2">
        <p className="truncate text-xs font-medium text-foreground">{item.name}</p>
        <p className="text-[10px] capitalize text-muted-foreground">{item.category}</p>
      </div>
    </button>
  );
}

// ============================================================================
// EditorMediaPanel
// ============================================================================

export function EditorMediaPanel({ dispatch, defaultTransition: _defaultTransition }: EditorMediaPanelProps) {
  const authFetch = useAuthFetch();

  // ── Library state ──────────────────────────────────────────────────────
  const [panelTab, setPanelTab] = useState<MediaPanelTab>('library');
  // Lead with Video — clips are the operator's most common add, and the
  // bin should show them first rather than a wall of images.
  const [mediaType, setMediaType] = useState<LibraryMediaType>('video');
  const [audioFilter, setAudioFilter] = useState<LibraryAudioFilter>('all');
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [mediaSearch, setMediaSearch] = useState('');

  // ── Project import state ───────────────────────────────────────────────
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [expandedProject, setExpandedProject] = useState<PipelineProject | null>(null);
  const [loadingProjectDetail, setLoadingProjectDetail] = useState(false);

  // ── Characters state ───────────────────────────────────────────────────
  const [avatars, setAvatars] = useState<AvatarProfile[]>([]);
  const [loadingAvatars, setLoadingAvatars] = useState(false);

  // ── Upload state ───────────────────────────────────────────────────────
  const [isUploading, setIsUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<string>('clip');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── URL import state ───────────────────────────────────────────────────
  const [urlInput, setUrlInput] = useState('');
  const [urlName, setUrlName] = useState('');

  // ========================================================================
  // Helpers: dispatch wrappers
  // ========================================================================

  const addClipFromMedia = useCallback(
    (clip: { name: string; url: string; thumbnailUrl: string | null; source: 'library' | 'project' | 'upload' | 'url'; duration?: number }) => {
      dispatch({
        type: 'ADD_CLIP',
        clip: {
          name: clip.name,
          url: clip.url,
          thumbnailUrl: clip.thumbnailUrl,
          duration: clip.duration ?? 0,
          source: clip.source,
        },
      });
    },
    [dispatch],
  );

  const addAudioFromMedia = useCallback(
    (track: { name: string; url: string; category: 'music' | 'sound' | 'voice' }) => {
      dispatch({
        type: 'ADD_AUDIO_TRACK',
        track: {
          name: track.name,
          url: track.url,
          volume: 0.5,
          category: track.category,
        },
      });
    },
    [dispatch],
  );

  // ========================================================================
  // Media Library Loading
  // ========================================================================

  const fetchMedia = useCallback(
    async (type: LibraryMediaType, audioCat: LibraryAudioFilter) => {
      setLoadingMedia(true);
      try {
        const params = new URLSearchParams();
        if (type !== 'all') {
          params.set('type', type);
        }
        if (type === 'audio' && audioCat !== 'all') {
          params.set('category', audioCat);
        }
        const url = `/api/media${params.toString() ? `?${params}` : ''}`;
        const response = await authFetch(url);
        if (response.ok) {
          const data = (await response.json()) as { success: boolean; items: MediaItem[] };
          if (data.success) {
            setMediaItems(data.items);
          }
        }
      } catch {
        setMediaItems([]);
      } finally {
        setLoadingMedia(false);
      }
    },
    [authFetch],
  );

  const handleMediaTypeChange = useCallback(
    (type: LibraryMediaType) => {
      setMediaType(type);
      void fetchMedia(type, audioFilter);
    },
    [fetchMedia, audioFilter],
  );

  const handleAudioFilterChange = useCallback(
    (filter: LibraryAudioFilter) => {
      setAudioFilter(filter);
      void fetchMedia('audio', filter);
    },
    [fetchMedia],
  );

  // Load the default (Video) library on mount so the bin isn't empty when the
  // editor opens with the panel already showing. `fetchMedia` is stable
  // (memoized on authFetch), so this effectively runs once.
  useEffect(() => {
    void fetchMedia('video', 'all');
  }, [fetchMedia]);

  // ========================================================================
  // Projects Loading
  // ========================================================================

  const fetchProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const response = await authFetch('/api/video/project/list');
      if (response.ok) {
        const data = (await response.json()) as { success: boolean; projects: ProjectSummary[] };
        if (data.success) {
          setProjects(data.projects);
        }
      }
    } catch {
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  }, [authFetch]);

  const handleExpandProject = useCallback(
    async (projectId: string) => {
      if (expandedProjectId === projectId) {
        setExpandedProjectId(null);
        setExpandedProject(null);
        return;
      }
      setExpandedProjectId(projectId);
      setLoadingProjectDetail(true);
      try {
        const response = await authFetch(`/api/video/project/${projectId}`);
        if (response.ok) {
          const data = (await response.json()) as { success: boolean; project: PipelineProject };
          if (data.success) {
            setExpandedProject(data.project);
          }
        }
      } catch {
        // Error handled by null state
      } finally {
        setLoadingProjectDetail(false);
      }
    },
    [authFetch, expandedProjectId],
  );

  // ========================================================================
  // Characters Loading
  // ========================================================================

  const fetchAvatars = useCallback(async () => {
    setLoadingAvatars(true);
    try {
      const response = await authFetch('/api/video/avatar-profiles');
      if (response.ok) {
        const data = (await response.json()) as { success: boolean; profiles: AvatarProfile[] };
        if (data.success) {
          setAvatars(data.profiles);
        }
      }
    } catch {
      setAvatars([]);
    } finally {
      setLoadingAvatars(false);
    }
  }, [authFetch]);

  // ========================================================================
  // Tab Switch Handler
  // ========================================================================

  const handlePanelTabChange = useCallback(
    (tab: MediaPanelTab) => {
      setPanelTab(tab);
      if (tab === 'library') {
        void fetchMedia(mediaType, audioFilter);
      }
      if (tab === 'projects' && projects.length === 0) {
        void fetchProjects();
      }
      if (tab === 'characters' && avatars.length === 0) {
        void fetchAvatars();
      }
    },
    [mediaType, audioFilter, projects.length, avatars.length, fetchMedia, fetchProjects, fetchAvatars],
  );

  // ========================================================================
  // File Upload
  // ========================================================================

  const uploadFile = useCallback(
    async (file: File) => {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);

        // Detect type from MIME
        let type: MediaType = 'video';
        if (file.type.startsWith('image/')) {
          type = 'image';
        } else if (file.type.startsWith('audio/')) {
          type = 'audio';
        }

        formData.append('type', type);
        formData.append('category', uploadCategory);
        formData.append('name', file.name);

        const response = await authFetch('/api/media', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const data = (await response.json()) as { success: boolean; item: MediaItem };
          if (data.success) {
            // If it's a video, also add it to the timeline
            if (type === 'video') {
              addClipFromMedia({
                name: file.name,
                url: data.item.url,
                thumbnailUrl: data.item.thumbnailUrl,
                duration: data.item.duration ?? 0,
                source: 'upload',
              });
            }
            // If it's audio, also add it as an audio track
            if (type === 'audio') {
              const audioCategoryMap: Record<string, 'music' | 'sound' | 'voice'> = {
                music: 'music',
                sound: 'sound',
                voice: 'voice',
              };
              addAudioFromMedia({
                name: file.name,
                url: data.item.url,
                category: audioCategoryMap[uploadCategory] ?? 'sound',
              });
            }
            // Refresh library if we're on the library tab
            void fetchMedia(mediaType, audioFilter);
          }
        }
      } catch {
        // Upload error — nothing to surface in this component
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [authFetch, uploadCategory, addClipFromMedia, addAudioFromMedia, fetchMedia, mediaType, audioFilter],
  );

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        void uploadFile(file);
      }
    },
    [uploadFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) {
        void uploadFile(file);
      }
    },
    [uploadFile],
  );

  // ========================================================================
  // URL Import
  // ========================================================================

  const handleUrlImport = useCallback(() => {
    if (!urlInput.trim()) {
      return;
    }
    addClipFromMedia({
      name: urlName.trim() || 'Clip from URL',
      url: urlInput.trim(),
      thumbnailUrl: null,
      source: 'url',
    });
    setUrlInput('');
    setUrlName('');
  }, [urlInput, urlName, addClipFromMedia]);

  // ── Filtered media items ───────────────────────────────────────────────
  const filteredMedia = useMemo(() => {
    if (!mediaSearch.trim()) {
      return mediaItems;
    }
    const q = mediaSearch.toLowerCase();
    return mediaItems.filter((item) => item.name.toLowerCase().includes(q));
  }, [mediaItems, mediaSearch]);

  // ========================================================================
  // Render
  // ========================================================================

  return (
    <Card className="bg-card/50 border-border-strong">
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex gap-1">
          {(
            [
              { key: 'library' as const, icon: FolderOpen, label: 'Library' },
              { key: 'projects' as const, icon: Film, label: 'Projects' },
              { key: 'characters' as const, icon: Users, label: 'Characters' },
              { key: 'upload' as const, icon: Upload, label: 'Upload' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => handlePanelTabChange(tab.key)}
              className={`flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                panelTab === tab.key
                  ? 'bg-primary/20 text-primary-light'
                  : 'text-muted-foreground hover:text-foreground hover:bg-surface-elevated'
              }`}
            >
              <tab.icon className="w-3 h-3" />
              {tab.label}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="p-3 pt-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={panelTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="space-y-3"
          >
            {/* ── Library Tab ──────────────────────────────────────── */}
            {panelTab === 'library' && (
              <>
                {/* Type Filter — leads with Video, the most common add. */}
                <div className="flex gap-1">
                  {(
                    [
                      { key: 'video', label: 'Videos' },
                      { key: 'all', label: 'All' },
                      { key: 'image', label: 'Images' },
                      { key: 'audio', label: 'Audio' },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.key}
                      onClick={() => handleMediaTypeChange(t.key)}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                        mediaType === t.key
                          ? 'bg-primary/20 text-primary-light'
                          : 'text-muted-foreground hover:text-foreground hover:bg-surface-elevated'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Audio Sub-filter */}
                {mediaType === 'audio' && (
                  <div className="flex gap-1">
                    {(['all', 'sound', 'voice', 'music'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => handleAudioFilterChange(f)}
                        className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                          audioFilter === f
                            ? 'bg-primary/20 text-primary-light'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {f === 'all' ? 'All' : `${f.charAt(0).toUpperCase()}${f.slice(1)}s`}
                      </button>
                    ))}
                  </div>
                )}

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                  <Input
                    type="text"
                    value={mediaSearch}
                    onChange={(e) => setMediaSearch(e.target.value)}
                    placeholder="Search media..."
                    className="h-auto w-full pl-7 pr-3 py-1.5 bg-surface-elevated border-border-strong rounded text-xs text-foreground"
                  />
                </div>

                {/* Media List — grid of clickable tiles; audio spans full width. */}
                <div className="max-h-[400px] overflow-y-auto">
                  {loadingMedia ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    </div>
                  ) : filteredMedia.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border-strong px-3 py-8 text-center">
                      <FolderOpen className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                      <p className="text-xs font-medium text-foreground">
                        {mediaType === 'video'
                          ? 'No videos here yet'
                          : mediaType === 'audio'
                            ? 'No audio here yet'
                            : mediaType === 'image'
                              ? 'No images here yet'
                              : 'Nothing in your library yet'}
                      </p>
                      <p className="mx-auto mt-1 max-w-[200px] text-[10px] leading-relaxed text-muted-foreground">
                        {mediaSearch.trim()
                          ? 'No matches for your search. Try a different term.'
                          : 'Upload your own footage from the Upload tab, or import finished scenes from a Project.'}
                      </p>
                      {!mediaSearch.trim() && (
                        <div className="mt-3 flex justify-center gap-2">
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => handlePanelTabChange('upload')}>
                            <Upload className="h-3 w-3" />
                            Upload
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => handlePanelTabChange('projects')}>
                            <Film className="h-3 w-3" />
                            Projects
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {filteredMedia.map((item) => (
                      <div key={item.id} className={item.type === 'audio' ? 'col-span-2' : ''}>
                      <MediaItemCard
                        item={item}
                        onAddToTimeline={() => {
                          if (item.type === 'video') {
                            addClipFromMedia({
                              name: item.name,
                              url: item.url,
                              thumbnailUrl: item.thumbnailUrl,
                              duration: item.duration ?? 0,
                              source: 'library',
                            });
                          } else if (item.type === 'audio') {
                            const catMap: Record<string, 'music' | 'sound' | 'voice'> = {
                              music: 'music',
                              sound: 'sound',
                              voice: 'voice',
                            };
                            addAudioFromMedia({
                              name: item.name,
                              url: item.url,
                              category: catMap[item.category] ?? 'sound',
                            });
                          }
                        }}
                        actionLabel={
                          item.type === 'video'
                            ? 'Add to Timeline'
                            : item.type === 'audio'
                              ? 'Add Audio Track'
                              : undefined
                        }
                      />
                      </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── Projects Tab ─────────────────────────────────────── */}
            {panelTab === 'projects' && (
              <div className="max-h-[450px] overflow-y-auto space-y-1.5">
                {!loadingProjects && projects.length > 0 && (
                  <p className="px-0.5 pb-1 text-[10px] text-muted-foreground">
                    Pick a project to import its finished scenes or final video.
                  </p>
                )}
                {loadingProjects ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  </div>
                ) : projects.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border-strong px-3 py-8 text-center">
                    <Film className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                    <p className="text-xs font-medium text-foreground">No projects yet</p>
                    <p className="mx-auto mt-1 max-w-[210px] text-[10px] leading-relaxed text-muted-foreground">
                      Import scenes from one of your projects. Once you generate a video project,
                      its scenes and final cut show up here ready to drop on the timeline.
                    </p>
                  </div>
                ) : (
                  projects.map((project) => (
                    <div key={project.id} className="space-y-1">
                      <button
                        onClick={() => {
                          void handleExpandProject(project.id);
                        }}
                        className={`w-full text-left p-2 rounded border transition-colors ${
                          expandedProjectId === project.id
                            ? 'border-primary/30 bg-primary/5'
                            : 'border-border-strong hover:border-border-strong bg-surface-elevated/30'
                        }`}
                      >
                        <p className="text-xs font-medium text-foreground truncate">{project.name}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {project.sceneCount} scenes · {project.status}
                        </p>
                      </button>

                      {/* Expanded: show scenes to import */}
                      {expandedProjectId === project.id && (
                        <div className="pl-2 space-y-1">
                          {loadingProjectDetail ? (
                            <div className="flex justify-center py-3">
                              <Loader2 className="w-4 h-4 animate-spin text-primary" />
                            </div>
                          ) : expandedProject?.generatedScenes?.filter((s) => s.videoUrl).length ? (
                            <>
                              {/* Add all scenes button */}
                              <button
                                onClick={() => {
                                  const scenes = expandedProject.generatedScenes.filter(
                                    (s) => s.videoUrl,
                                  );
                                  for (const scene of scenes) {
                                    const sceneIndex =
                                      expandedProject.scenes.findIndex(
                                        (s) => s.id === scene.sceneId,
                                      ) + 1;
                                    addClipFromMedia({
                                      name: `${project.name} — Scene ${sceneIndex}`,
                                      url: scene.videoUrl ?? '',
                                      thumbnailUrl: scene.thumbnailUrl,
                                      source: 'project',
                                    });
                                  }
                                }}
                                className="w-full text-left px-2 py-1.5 rounded bg-primary/10 border border-primary/20 text-xs text-primary-light hover:bg-primary/20 transition-colors"
                              >
                                <Plus className="w-3 h-3 inline mr-1" />
                                Add all{' '}
                                {expandedProject.generatedScenes.filter((s) => s.videoUrl).length}{' '}
                                scenes
                              </button>

                              <div className="grid grid-cols-2 gap-2">
                                {expandedProject.generatedScenes
                                  .filter((s) => s.videoUrl)
                                  .map((scene, idx) => (
                                    <button
                                      key={scene.sceneId}
                                      type="button"
                                      title={`Add Scene ${idx + 1} to timeline`}
                                      onClick={() => {
                                        addClipFromMedia({
                                          name: `${project.name} — Scene ${idx + 1}`,
                                          url: scene.videoUrl ?? '',
                                          thumbnailUrl: scene.thumbnailUrl,
                                          source: 'project',
                                        });
                                      }}
                                      className="group relative block w-full cursor-pointer overflow-hidden rounded-lg border border-border-strong bg-surface-elevated/30 text-left transition-all hover:border-primary/50 hover:bg-surface-elevated/60"
                                    >
                                      <MediaThumbnail
                                        type="video"
                                        thumbnailUrl={scene.thumbnailUrl}
                                        alt={`Scene ${idx + 1}`}
                                      />
                                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-all group-hover:bg-background/40 group-hover:opacity-100">
                                        <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground shadow-lg">
                                          <Plus className="h-3 w-3" />
                                          Add
                                        </span>
                                      </div>
                                      <p className="truncate p-1.5 text-[11px] font-medium text-foreground">
                                        Scene {idx + 1}
                                      </p>
                                    </button>
                                  ))}
                              </div>

                              {/* Add final video if exists */}
                              {expandedProject.finalVideoUrl && (
                                <button
                                  onClick={() => {
                                    addClipFromMedia({
                                      name: `${project.name} — Final`,
                                      url: expandedProject.finalVideoUrl ?? '',
                                      thumbnailUrl: null,
                                      source: 'project',
                                    });
                                  }}
                                  className="w-full text-left px-2 py-1.5 rounded border border-success-dark/30 hover:border-success/30 text-xs text-success-light hover:text-success transition-colors flex items-center gap-2"
                                >
                                  <Film className="w-3 h-3 flex-shrink-0" />
                                  <span className="truncate">Final Video</span>
                                  <Plus className="w-3 h-3 ml-auto flex-shrink-0" />
                                </button>
                              )}
                            </>
                          ) : (
                            <p className="text-[10px] text-muted-foreground px-2 py-2">
                              No video clips available
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── Characters Tab ────────────────────────────────────── */}
            {panelTab === 'characters' && (
              <div className="max-h-[450px] overflow-y-auto space-y-1.5">
                {loadingAvatars ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  </div>
                ) : avatars.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border-strong px-3 py-8 text-center">
                    <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                    <p className="text-xs font-medium text-foreground">No characters yet</p>
                    <p className="mx-auto mt-1 max-w-[200px] text-[10px] leading-relaxed text-muted-foreground">
                      Create reusable characters in the Studio and they will show up here.
                    </p>
                  </div>
                ) : (
                  avatars.map((avatar) => (
                    <div
                      key={avatar.id}
                      className="flex items-center gap-2 p-2 rounded border border-border-strong hover:border-border-strong bg-surface-elevated/30"
                    >
                      {avatar.imageUrl ? (
                        <Image
                          src={avatar.imageUrl}
                          alt={avatar.name}
                          width={32}
                          height={32}
                          unoptimized
                          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-border-strong flex items-center justify-center flex-shrink-0">
                          <Users className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{avatar.name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Badge variant="outline" className="text-[9px] py-0 px-1">
                            {avatar.source}
                          </Badge>
                          {avatar.role && (
                            <Badge
                              variant="outline"
                              className="text-[9px] py-0 px-1 text-primary-light border-primary/30"
                            >
                              {avatar.role}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── Upload Tab ───────────────────────────────────────── */}
            {panelTab === 'upload' && (
              <div className="space-y-3">
                {/* Category Selector */}
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Category
                  </label>
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
                    className="w-full mt-1 px-2 py-1.5 bg-surface-elevated border border-border-strong rounded text-xs text-foreground focus:outline-none focus:border-primary/50"
                  >
                    <optgroup label="Video">
                      <option value="clip">Video Clip</option>
                      <option value="scene">Scene</option>
                    </optgroup>
                    <optgroup label="Image">
                      <option value="photo">Photo</option>
                      <option value="graphic">Graphic</option>
                      <option value="screenshot">Screenshot</option>
                      <option value="thumbnail">Thumbnail</option>
                    </optgroup>
                    <optgroup label="Audio">
                      <option value="sound">Sound Effect</option>
                      <option value="voice">Voice Recording</option>
                      <option value="music">Music Track</option>
                    </optgroup>
                  </select>
                </div>

                {/* Drag-and-drop / choose-file drop zone */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*,image/*,audio/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors ${
                    isDragOver
                      ? 'border-primary bg-primary/10'
                      : 'border-border-strong bg-surface-elevated/30 hover:border-primary/50 hover:bg-surface-elevated/60'
                  }`}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <p className="text-xs font-medium text-foreground">Uploading…</p>
                    </>
                  ) : (
                    <>
                      <Upload className="h-6 w-6 text-primary-light" />
                      <p className="text-xs font-medium text-foreground">
                        Drag in or choose a video file to start
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Video, image, or audio. Videos drop straight onto the timeline.
                      </p>
                    </>
                  )}
                </div>

                {/* Divider */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-surface-elevated" />
                  <span className="text-[10px] text-muted-foreground">or</span>
                  <div className="flex-1 h-px bg-surface-elevated" />
                </div>

                {/* URL Import */}
                <div className="space-y-2">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Import from URL
                  </label>
                  <Input
                    type="text"
                    value={urlName}
                    onChange={(e) => setUrlName(e.target.value)}
                    placeholder="Clip name (optional)"
                    className="h-auto w-full px-2 py-1.5 bg-surface-elevated border-border-strong rounded text-xs text-foreground"
                  />
                  <div className="flex gap-1">
                    <Input
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://... video URL"
                      className="h-auto flex-1 px-2 py-1.5 bg-surface-elevated border-border-strong rounded text-xs text-foreground"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleUrlImport();
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleUrlImport}
                      disabled={!urlInput.trim()}
                      className="px-2"
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
