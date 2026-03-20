'use client';

/**
 * Editor Media Panel
 * Left sidebar for the video editor — Library, Projects, Characters, Upload tabs.
 * Dispatches ADD_CLIP / ADD_AUDIO_TRACK actions directly to the editor reducer.
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderOpen,
  Film,
  Users,
  Upload,
  Search,
  Plus,
  Play,
  Loader2,
  Image as ImageIcon,
  Music,
} from 'lucide-react';

import type { EditorAction } from '../types';
import type { TransitionType, PipelineProject } from '@/types/video-pipeline';
import type { MediaItem, MediaType, AudioCategory } from '@/types/media-library';
import { useAuthFetch } from '@/hooks/useAuthFetch';

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
  const iconMap: Record<string, React.ElementType> = {
    video: Film,
    image: ImageIcon,
    audio: Music,
  };
  const colorMap: Record<string, string> = {
    video: 'text-amber-400',
    image: 'text-blue-400',
    audio: 'text-purple-400',
  };
  const Icon = iconMap[item.type] ?? Film;
  const color = colorMap[item.type] ?? 'text-zinc-400';

  return (
    <div className="flex items-center gap-2 p-1.5 rounded border border-zinc-800 hover:border-zinc-700 bg-zinc-800/20 group">
      <div
        className={`w-7 h-7 rounded flex items-center justify-center flex-shrink-0 ${
          item.type === 'video'
            ? 'bg-amber-500/10'
            : item.type === 'image'
              ? 'bg-blue-500/10'
              : 'bg-purple-500/10'
        }`}
      >
        <Icon className={`w-3.5 h-3.5 ${color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-white truncate">{item.name}</p>
        <p className="text-[9px] text-zinc-600">{item.category}</p>
      </div>
      {onAddToTimeline && actionLabel && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddToTimeline();
          }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all flex-shrink-0"
          title={actionLabel}
        >
          <Plus className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ============================================================================
// EditorMediaPanel
// ============================================================================

export function EditorMediaPanel({ dispatch, defaultTransition: _defaultTransition }: EditorMediaPanelProps) {
  const authFetch = useAuthFetch();

  // ── Library state ──────────────────────────────────────────────────────
  const [panelTab, setPanelTab] = useState<MediaPanelTab>('library');
  const [mediaType, setMediaType] = useState<LibraryMediaType>('all');
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

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) {
        return;
      }

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
    <Card className="bg-zinc-900/50 border-zinc-800">
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
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
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
                {/* Type Filter */}
                <div className="flex gap-1">
                  {(['all', 'video', 'image', 'audio'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => handleMediaTypeChange(t)}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                        mediaType === t
                          ? 'bg-zinc-700 text-white'
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
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
                            ? 'bg-purple-500/20 text-purple-400'
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {f === 'all' ? 'All' : `${f.charAt(0).toUpperCase()}${f.slice(1)}s`}
                      </button>
                    ))}
                  </div>
                )}

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500" />
                  <input
                    type="text"
                    value={mediaSearch}
                    onChange={(e) => setMediaSearch(e.target.value)}
                    placeholder="Search media..."
                    className="w-full pl-7 pr-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                {/* Media List */}
                <div className="max-h-[400px] overflow-y-auto space-y-1.5">
                  {loadingMedia ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                    </div>
                  ) : filteredMedia.length === 0 ? (
                    <div className="text-center py-8">
                      <FolderOpen className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                      <p className="text-xs text-zinc-500">No media found</p>
                      <p className="text-[10px] text-zinc-600 mt-1">Upload files or add from projects</p>
                    </div>
                  ) : (
                    filteredMedia.map((item) => (
                      <MediaItemCard
                        key={item.id}
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
                    ))
                  )}
                </div>
              </>
            )}

            {/* ── Projects Tab ─────────────────────────────────────── */}
            {panelTab === 'projects' && (
              <div className="max-h-[450px] overflow-y-auto space-y-1.5">
                {loadingProjects ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                  </div>
                ) : projects.length === 0 ? (
                  <div className="text-center py-8">
                    <Film className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                    <p className="text-xs text-zinc-500">No projects found</p>
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
                            ? 'border-amber-500/30 bg-amber-500/5'
                            : 'border-zinc-800 hover:border-zinc-700 bg-zinc-800/30'
                        }`}
                      >
                        <p className="text-xs font-medium text-white truncate">{project.name}</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">
                          {project.sceneCount} scenes · {project.status}
                        </p>
                      </button>

                      {/* Expanded: show scenes to import */}
                      {expandedProjectId === project.id && (
                        <div className="pl-2 space-y-1">
                          {loadingProjectDetail ? (
                            <div className="flex justify-center py-3">
                              <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
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
                                className="w-full text-left px-2 py-1.5 rounded bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400 hover:bg-amber-500/20 transition-colors"
                              >
                                <Plus className="w-3 h-3 inline mr-1" />
                                Add all{' '}
                                {expandedProject.generatedScenes.filter((s) => s.videoUrl).length}{' '}
                                scenes
                              </button>

                              {expandedProject.generatedScenes
                                .filter((s) => s.videoUrl)
                                .map((scene, idx) => (
                                  <button
                                    key={scene.sceneId}
                                    onClick={() => {
                                      addClipFromMedia({
                                        name: `${project.name} — Scene ${idx + 1}`,
                                        url: scene.videoUrl ?? '',
                                        thumbnailUrl: scene.thumbnailUrl,
                                        source: 'project',
                                      });
                                    }}
                                    className="w-full text-left px-2 py-1.5 rounded border border-zinc-800 hover:border-amber-500/30 text-xs text-zinc-300 hover:text-white transition-colors flex items-center gap-2"
                                  >
                                    <Play className="w-3 h-3 text-zinc-500 flex-shrink-0" />
                                    <span className="truncate">Scene {idx + 1}</span>
                                    <Plus className="w-3 h-3 text-zinc-600 ml-auto flex-shrink-0" />
                                  </button>
                                ))}

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
                                  className="w-full text-left px-2 py-1.5 rounded border border-green-800/30 hover:border-green-500/30 text-xs text-green-400 hover:text-green-300 transition-colors flex items-center gap-2"
                                >
                                  <Film className="w-3 h-3 flex-shrink-0" />
                                  <span className="truncate">Final Video</span>
                                  <Plus className="w-3 h-3 ml-auto flex-shrink-0" />
                                </button>
                              )}
                            </>
                          ) : (
                            <p className="text-[10px] text-zinc-600 px-2 py-2">
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
                    <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                  </div>
                ) : avatars.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                    <p className="text-xs text-zinc-500">No characters found</p>
                    <p className="text-[10px] text-zinc-600 mt-1">Create characters in the Studio</p>
                  </div>
                ) : (
                  avatars.map((avatar) => (
                    <div
                      key={avatar.id}
                      className="flex items-center gap-2 p-2 rounded border border-zinc-800 hover:border-zinc-700 bg-zinc-800/30"
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
                        <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center flex-shrink-0">
                          <Users className="w-4 h-4 text-zinc-500" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">{avatar.name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Badge variant="outline" className="text-[9px] py-0 px-1">
                            {avatar.source}
                          </Badge>
                          {avatar.role && (
                            <Badge
                              variant="outline"
                              className="text-[9px] py-0 px-1 text-amber-400 border-amber-500/30"
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
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider">
                    Category
                  </label>
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
                    className="w-full mt-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-xs text-white focus:outline-none focus:border-amber-500/50"
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

                {/* Upload Button */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*,image/*,audio/*"
                  onChange={(e) => {
                    void handleFileUpload(e);
                  }}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Choose File
                    </>
                  )}
                </Button>

                {/* Divider */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-zinc-800" />
                  <span className="text-[10px] text-zinc-600">or</span>
                  <div className="flex-1 h-px bg-zinc-800" />
                </div>

                {/* URL Import */}
                <div className="space-y-2">
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider">
                    Import from URL
                  </label>
                  <input
                    type="text"
                    value={urlName}
                    onChange={(e) => setUrlName(e.target.value)}
                    placeholder="Clip name (optional)"
                    className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/50"
                  />
                  <div className="flex gap-1">
                    <input
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://... video URL"
                      className="flex-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/50"
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
