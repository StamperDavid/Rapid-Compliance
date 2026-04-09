'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useVideoPipelineStore } from '@/lib/stores/video-pipeline-store';
import SubpageNav from '@/components/ui/SubpageNav';
import { CONTENT_GENERATOR_TABS } from '@/lib/constants/subpage-nav';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Download,
  Trash2,
  Edit3,
  Plus,
  Loader2,
  Film,
  Clock,
  CheckCircle,
  AlertCircle,
  Image as ImageIcon,
  Music,
  Upload,
  Search,
  Volume2,
  AudioWaveform,
  Mic,
  Sparkles,
  FolderOpen,
  Scissors,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ProjectStatus, PipelineStep, VideoType, PipelineProject } from '@/types/video-pipeline';
import type { MediaItem, MediaType } from '@/types/media-library';

// ============================================================================
// Types
// ============================================================================

interface ProjectSummary {
  id: string;
  name: string;
  type: VideoType;
  currentStep: PipelineStep;
  status: ProjectStatus;
  sceneCount: number;
  hasVideo: boolean;
  createdAt: string;
  updatedAt: string;
}

type MediaTab = 'videos' | 'images' | 'audio';
type VideoFilter = 'all' | 'completed' | 'in-progress' | 'draft';
type AudioFilter = 'all' | 'sound' | 'voice' | 'music';

// ============================================================================
// Constants
// ============================================================================

const MEDIA_TABS: { key: MediaTab; label: string; icon: React.ElementType }[] = [
  { key: 'videos', label: 'Videos', icon: Film },
  { key: 'images', label: 'Images', icon: ImageIcon },
  { key: 'audio', label: 'Audio', icon: Music },
];

const VIDEO_FILTERS: { id: VideoFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'completed', label: 'Completed' },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'draft', label: 'Draft' },
];

const AUDIO_FILTERS: { id: AudioFilter; label: string; icon: React.ElementType }[] = [
  { id: 'all', label: 'All', icon: Music },
  { id: 'sound', label: 'Sounds', icon: Sparkles },
  { id: 'voice', label: 'Voices', icon: Mic },
  { id: 'music', label: 'Music', icon: AudioWaveform },
];

const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; icon: typeof CheckCircle }> = {
  completed: { label: 'Completed', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: CheckCircle },
  assembled: { label: 'Assembled', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Film },
  generated: { label: 'Generated', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', icon: CheckCircle },
  generating: { label: 'Generating', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: Loader2 },
  approved: { label: 'Approved', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: CheckCircle },
  draft: { label: 'Draft', color: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30', icon: Edit3 },
};

const VIDEO_TYPE_LABELS: Record<VideoType, string> = {
  tutorial: 'Tutorial',
  explainer: 'Explainer',
  'product-demo': 'Product Demo',
  'sales-pitch': 'Sales Pitch',
  testimonial: 'Testimonial',
  'social-ad': 'Social Ad',
};

// ============================================================================
// Helpers
// ============================================================================

function filterToStatuses(tab: VideoFilter): ProjectStatus[] | undefined {
  switch (tab) {
    case 'completed':
      return ['completed'];
    case 'in-progress':
      return ['approved', 'generating', 'generated', 'assembled'];
    case 'draft':
      return ['draft'];
    default:
      return undefined;
  }
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) { return 'Today'; }
  if (diffDays === 1) { return 'Yesterday'; }
  if (diffDays < 7) { return `${diffDays} days ago`; }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) { return ''; }
  if (bytes < 1024) { return `${bytes} B`; }
  if (bytes < 1024 * 1024) { return `${(bytes / 1024).toFixed(1)} KB`; }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================================================
// Component
// ============================================================================

export default function MediaLibraryPage() {
  const router = useRouter();
  const authFetch = useAuthFetch();
  const { loadProject, reset } = useVideoPipelineStore();

  // ── Tab state ───────────────────────────────────────────────────────────
  const [activeMediaTab, setActiveMediaTab] = useState<MediaTab>('videos');

  // ── Video state ─────────────────────────────────────────────────────────
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [videoFilter, setVideoFilter] = useState<VideoFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedProject, setExpandedProject] = useState<PipelineProject | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // ── Media (images/audio) state ──────────────────────────────────────────
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [audioFilter, setAudioFilter] = useState<AudioFilter>('all');
  const [mediaSearch, setMediaSearch] = useState('');
  const [deletingMediaId, setDeletingMediaId] = useState<string | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ── Upload state ────────────────────────────────────────────────────────
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ========================================================================
  // Video Project Fetching
  // ========================================================================

  const fetchProjects = useCallback(async (tab: VideoFilter) => {
    setLoadingProjects(true);
    try {
      const statuses = filterToStatuses(tab);
      const params = new URLSearchParams();
      if (statuses) {
        for (const s of statuses) { params.append('status', s); }
      }
      const url = `/api/video/project/list${params.toString() ? `?${params}` : ''}`;
      const response = await authFetch(url);
      if (response.ok) {
        const data = await response.json() as { success: boolean; projects: ProjectSummary[] };
        if (data.success) { setProjects(data.projects); }
      }
    } catch {
      // Empty state will show
    } finally {
      setLoadingProjects(false);
    }
  }, [authFetch]);

  // Refetch projects on mount and when filter changes
  const mountRef = useRef(false);
  useEffect(() => {
    if (activeMediaTab === 'videos') {
      void fetchProjects(videoFilter);
      mountRef.current = true;
    }
  }, [videoFilter, fetchProjects, activeMediaTab]);

  // ========================================================================
  // Media Fetching (Images / Audio)
  // ========================================================================

  const fetchMedia = useCallback(async (type: MediaType, category?: string) => {
    setLoadingMedia(true);
    try {
      const params = new URLSearchParams({ type });
      if (category && category !== 'all') { params.set('category', category); }
      const response = await authFetch(`/api/media?${params}`);
      if (response.ok) {
        const data = await response.json() as { success: boolean; items: MediaItem[] };
        if (data.success) { setMediaItems(data.items); }
      }
    } catch {
      setMediaItems([]);
    } finally {
      setLoadingMedia(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (activeMediaTab === 'images') {
      void fetchMedia('image');
    } else if (activeMediaTab === 'audio') {
      void fetchMedia('audio', audioFilter);
    }
  }, [activeMediaTab, audioFilter, fetchMedia]);

  // ========================================================================
  // Video Project Actions
  // ========================================================================

  const handleExpand = useCallback(async (projectId: string) => {
    if (expandedId === projectId) {
      setExpandedId(null);
      setExpandedProject(null);
      return;
    }
    setExpandedId(projectId);
    setLoadingDetail(true);
    try {
      const response = await authFetch(`/api/video/project/${projectId}`);
      if (response.ok) {
        const data = await response.json() as { success: boolean; project: PipelineProject };
        if (data.success) { setExpandedProject(data.project); }
      }
    } catch {
      // Handled by null state
    } finally {
      setLoadingDetail(false);
    }
  }, [authFetch, expandedId]);

  const handleEdit = useCallback((project: PipelineProject) => {
    loadProject(project);
    router.push('/content/video');
  }, [loadProject, router]);

  const handleOpenInEditor = useCallback((_project: PipelineProject) => {
    // Navigate to editor — the project clips can be imported from there
    router.push('/content/video/editor');
  }, [router]);

  const handleDelete = useCallback(async (projectId: string) => {
    setDeleting(projectId);
    try {
      const response = await authFetch(`/api/video/project/${projectId}`, { method: 'DELETE' });
      if (response.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== projectId));
        if (expandedId === projectId) {
          setExpandedId(null);
          setExpandedProject(null);
        }
        // Refetch to confirm deletion from Firestore
        void fetchProjects(videoFilter);
      }
    } catch {
      // Handled silently
    } finally {
      setDeleting(null);
    }
  }, [authFetch, expandedId, fetchProjects, videoFilter]);

  const handleCreateNew = useCallback(() => {
    reset();
    router.push('/content/video');
  }, [reset, router]);

  // ========================================================================
  // Media Item Actions
  // ========================================================================

  const handleDeleteMedia = useCallback(async (mediaId: string) => {
    setDeletingMediaId(mediaId);
    try {
      const response = await authFetch(`/api/media/${mediaId}`, { method: 'DELETE' });
      if (response.ok) {
        setMediaItems((prev) => prev.filter((m) => m.id !== mediaId));
      }
    } catch {
      // Handled silently
    } finally {
      setDeletingMediaId(null);
    }
  }, [authFetch]);

  const handlePlayAudio = useCallback((item: MediaItem) => {
    if (playingAudioId === item.id) {
      audioRef.current?.pause();
      setPlayingAudioId(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(item.url);
    audio.onended = () => setPlayingAudioId(null);
    audioRef.current = audio;
    void audio.play();
    setPlayingAudioId(item.id);
  }, [playingAudioId]);

  // ========================================================================
  // Upload
  // ========================================================================

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) { return; }

    setIsUploading(true);
    try {
      let type: MediaType = 'video';
      let category = 'clip';

      if (file.type.startsWith('image/')) {
        type = 'image';
        category = 'photo';
      } else if (file.type.startsWith('audio/')) {
        type = 'audio';
        category = 'sound';
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);
      formData.append('category', category);
      formData.append('name', file.name);

      const response = await authFetch('/api/media', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        // Refresh the current tab's data
        if (activeMediaTab === 'images' && type === 'image') {
          void fetchMedia('image');
        } else if (activeMediaTab === 'audio' && type === 'audio') {
          void fetchMedia('audio', audioFilter);
        }
      }
    } catch {
      // Upload error
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) { fileInputRef.current.value = ''; }
    }
  }, [authFetch, activeMediaTab, audioFilter, fetchMedia]);

  // ── Filtered media ──────────────────────────────────────────────────────
  const filteredMedia = mediaSearch.trim()
    ? mediaItems.filter((item) => item.name.toLowerCase().includes(mediaSearch.toLowerCase()))
    : mediaItems;

  // ========================================================================
  // Render
  // ========================================================================

  return (
    <div className="p-8 space-y-6">
      <SubpageNav items={CONTENT_GENERATOR_TABS} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <FolderOpen className="w-7 h-7 text-amber-500" />
            Media Library
          </h1>
          <p className="text-zinc-400 mt-1">
            Browse, manage, and upload your videos, images, and audio
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={
              activeMediaTab === 'videos' ? 'video/*' :
              activeMediaTab === 'images' ? 'image/*' :
              'audio/*'
            }
            onChange={(e) => { void handleUpload(e); }}
            className="hidden"
          />
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Uploading...</>
            ) : (
              <><Upload className="w-4 h-4" />Upload</>
            )}
          </Button>
          {activeMediaTab === 'videos' && (
            <Button
              onClick={handleCreateNew}
              className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Plus className="w-4 h-4" />
              Create Video
            </Button>
          )}
        </div>
      </div>

      {/* Media Type Tabs */}
      <div className="flex items-center gap-4 border-b border-zinc-800 pb-0">
        {MEDIA_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeMediaTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveMediaTab(tab.key)}
              className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? 'text-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {isActive && (
                <motion.div
                  layoutId="media-tab-underline"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500"
                  transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeMediaTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          {/* ── Videos Tab ──────────────────────────────────────────── */}
          {activeMediaTab === 'videos' && (
            <>
              {/* Filter Tabs */}
              <div className="flex gap-2 pb-3">
                {VIDEO_FILTERS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setVideoFilter(tab.id)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      videoFilter === tab.id
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Video Projects Grid */}
              {loadingProjects ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                </div>
              ) : projects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Film className="w-16 h-16 text-zinc-700 mb-4" />
                  <h2 className="text-lg font-semibold text-zinc-300">No videos yet</h2>
                  <p className="text-zinc-500 mt-1 max-w-md">
                    {videoFilter === 'all'
                      ? 'Create your first video in the Video Studio or ask Jasper to prepare one.'
                      : `No ${videoFilter} videos found. Try a different filter.`}
                  </p>
                  {videoFilter === 'all' && (
                    <Button
                      onClick={handleCreateNew}
                      className="mt-4 gap-2 bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      <Plus className="w-4 h-4" />
                      Create Your First Video
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {projects.map((project) => {
                    const statusInfo = STATUS_CONFIG[project.status];
                    const StatusIcon = statusInfo.icon;
                    const isExpanded = expandedId === project.id;

                    return (
                      <Card
                        key={project.id}
                        className={`bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer ${
                          isExpanded ? 'col-span-1 md:col-span-2 lg:col-span-3 border-amber-500/30' : ''
                        }`}
                        onClick={() => { void handleExpand(project.id); }}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-semibold text-white truncate">{project.name}</h3>
                              <div className="flex items-center gap-2 mt-1.5">
                                <Badge variant="outline" className={`text-xs ${statusInfo.color}`}>
                                  <StatusIcon className={`w-3 h-3 mr-1 ${project.status === 'generating' ? 'animate-spin' : ''}`} />
                                  {statusInfo.label}
                                </Badge>
                                <span className="text-xs text-zinc-500">
                                  {VIDEO_TYPE_LABELS[project.type] ?? project.type}
                                </span>
                              </div>
                            </div>
                            {project.hasVideo && (
                              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                <Play className="w-5 h-5 text-amber-400" />
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-3 mt-3 text-xs text-zinc-500">
                            <span className="flex items-center gap-1">
                              <Film className="w-3 h-3" />{project.sceneCount} scenes
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />{formatDate(project.updatedAt)}
                            </span>
                          </div>

                          {/* Expanded Detail View */}
                          {isExpanded && (
                            <div className="mt-4 pt-4 border-t border-zinc-800 space-y-4" onClick={(e) => e.stopPropagation()}>
                              {loadingDetail ? (
                                <div className="flex items-center justify-center py-6">
                                  <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                                </div>
                              ) : expandedProject ? (
                                <>
                                  {expandedProject.finalVideoUrl ? (
                                    <div className="rounded-lg overflow-hidden bg-black">
                                      <video src={expandedProject.finalVideoUrl} controls className="w-full max-h-[400px]" />
                                    </div>
                                  ) : expandedProject.generatedScenes?.some((s) => s.videoUrl) ? (
                                    <div className="space-y-3">
                                      <h4 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                                        <Play className="w-3.5 h-3.5 text-amber-400" />Scene Videos
                                      </h4>
                                      <div className="grid gap-3">
                                        {expandedProject.generatedScenes
                                          .filter((s): s is typeof s & { videoUrl: string } => Boolean(s.videoUrl))
                                          .map((scene, idx) => (
                                            <div key={scene.sceneId} className="rounded-lg overflow-hidden bg-black/60 border border-zinc-700/50">
                                              <video src={scene.videoUrl} controls className="w-full max-h-[300px]" />
                                              <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900/80">
                                                <span className="text-xs text-zinc-400">
                                                  Scene {idx + 1}
                                                  {scene.provider && <Badge variant="outline" className="ml-2 text-[10px] py-0">{scene.provider}</Badge>}
                                                </span>
                                                <a href={scene.videoUrl} download className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1">
                                                  <Download className="w-3 h-3" />Download
                                                </a>
                                              </div>
                                            </div>
                                          ))}
                                      </div>
                                    </div>
                                  ) : null}

                                  {expandedProject.scenes.length > 0 && (
                                    <div className="space-y-2">
                                      <h4 className="text-sm font-medium text-zinc-300">Script Preview</h4>
                                      <div className="max-h-40 overflow-y-auto space-y-1.5 text-xs text-zinc-400 bg-zinc-800/50 rounded-lg p-3">
                                        {expandedProject.scenes.map((scene) => (
                                          <p key={scene.id}>
                                            <span className="text-amber-400 font-medium">Scene {scene.sceneNumber}:</span>{' '}
                                            {scene.scriptText}
                                          </p>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  <div>
                                    <h4 className="text-sm font-medium text-zinc-300">Description</h4>
                                    <p className="text-xs text-zinc-400 mt-1">{expandedProject.brief.description}</p>
                                  </div>

                                  <div className="flex items-center gap-2 pt-2">
                                    <Button size="sm" className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white" onClick={() => handleEdit(expandedProject)}>
                                      <Edit3 className="w-3.5 h-3.5" />Edit in Studio
                                    </Button>
                                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleOpenInEditor(expandedProject)}>
                                      <Scissors className="w-3.5 h-3.5" />Open in Editor
                                    </Button>
                                    {expandedProject.finalVideoUrl && (
                                      <a href={expandedProject.finalVideoUrl} download>
                                        <Button size="sm" variant="outline" className="gap-1.5">
                                          <Download className="w-3.5 h-3.5" />Download
                                        </Button>
                                      </a>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="gap-1.5 text-red-400 hover:text-red-300 hover:border-red-500/50"
                                      onClick={() => { void handleDelete(project.id); }}
                                      disabled={deleting === project.id}
                                    >
                                      {deleting === project.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                      Delete
                                    </Button>
                                  </div>
                                </>
                              ) : (
                                <div className="flex items-center gap-2 text-sm text-zinc-500 py-4">
                                  <AlertCircle className="w-4 h-4" />Could not load project details
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ── Images Tab ──────────────────────────────────────────── */}
          {activeMediaTab === 'images' && (
            <>
              {/* Search */}
              <div className="flex items-center gap-3 pb-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    value={mediaSearch}
                    onChange={(e) => setMediaSearch(e.target.value)}
                    placeholder="Search images..."
                    className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>

              {/* Images Grid */}
              {loadingMedia ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                </div>
              ) : filteredMedia.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <ImageIcon className="w-16 h-16 text-zinc-700 mb-4" />
                  <h2 className="text-lg font-semibold text-zinc-300">No images yet</h2>
                  <p className="text-zinc-500 mt-1 max-w-md">
                    Upload photos, graphics, screenshots, or thumbnails to build your media library.
                  </p>
                  <Button
                    className="mt-4 gap-2"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4" />
                    Upload Your First Image
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {filteredMedia.map((item) => (
                    <Card key={item.id} className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-all group overflow-hidden">
                      <div className="aspect-square bg-zinc-800 relative overflow-hidden">
                        <Image
                          src={item.url}
                          alt={item.name}
                          fill
                          unoptimized
                          className="object-cover"
                        />
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <a href={item.url} download>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-white hover:text-amber-400">
                              <Download className="w-4 h-4" />
                            </Button>
                          </a>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-white hover:text-red-400"
                            onClick={() => { void handleDeleteMedia(item.id); }}
                            disabled={deletingMediaId === item.id}
                          >
                            {deletingMediaId === item.id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <Trash2 className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>
                      <CardContent className="p-2">
                        <p className="text-xs text-white truncate">{item.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[9px] py-0 text-blue-400 border-blue-500/30">
                            {item.category}
                          </Badge>
                          {item.fileSize > 0 && (
                            <span className="text-[9px] text-zinc-600">{formatFileSize(item.fileSize)}</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Audio Tab ───────────────────────────────────────────── */}
          {activeMediaTab === 'audio' && (
            <>
              {/* Audio Category Filters */}
              <div className="flex items-center gap-3 pb-3">
                <div className="flex gap-1.5">
                  {AUDIO_FILTERS.map((filter) => {
                    const Icon = filter.icon;
                    return (
                      <button
                        key={filter.id}
                        onClick={() => setAudioFilter(filter.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          audioFilter === filter.id
                            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                            : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {filter.label}
                      </button>
                    );
                  })}
                </div>
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    value={mediaSearch}
                    onChange={(e) => setMediaSearch(e.target.value)}
                    placeholder="Search audio..."
                    className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>

              {/* Audio List */}
              {loadingMedia ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                </div>
              ) : filteredMedia.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Music className="w-16 h-16 text-zinc-700 mb-4" />
                  <h2 className="text-lg font-semibold text-zinc-300">No audio yet</h2>
                  <p className="text-zinc-500 mt-1 max-w-md">
                    Upload sound effects, voice recordings, or music tracks.
                  </p>
                  <Button
                    className="mt-4 gap-2"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4" />
                    Upload Audio
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredMedia.map((item) => {
                    const isPlaying = playingAudioId === item.id;
                    const categoryIcon = item.category === 'voice' ? Mic
                      : item.category === 'music' ? AudioWaveform
                      : Sparkles;
                    const CategoryIcon = categoryIcon;
                    const categoryColor = item.category === 'voice' ? 'text-green-400 bg-green-500/10 border-green-500/30'
                      : item.category === 'music' ? 'text-purple-400 bg-purple-500/10 border-purple-500/30'
                      : 'text-amber-400 bg-amber-500/10 border-amber-500/30';

                    return (
                      <Card key={item.id} className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-all">
                        <CardContent className="p-3 flex items-center gap-3">
                          {/* Play button */}
                          <button
                            onClick={() => handlePlayAudio(item)}
                            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                              isPlaying
                                ? 'bg-purple-500 text-white'
                                : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
                            }`}
                          >
                            {isPlaying ? <Volume2 className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                          </button>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{item.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant="outline" className={`text-[10px] py-0 ${categoryColor}`}>
                                <CategoryIcon className="w-2.5 h-2.5 mr-1" />
                                {item.category}
                              </Badge>
                              {item.duration && (
                                <span className="text-[10px] text-zinc-600">
                                  {Math.floor(item.duration / 60)}:{String(Math.floor(item.duration % 60)).padStart(2, '0')}
                                </span>
                              )}
                              {item.fileSize > 0 && (
                                <span className="text-[10px] text-zinc-600">{formatFileSize(item.fileSize)}</span>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <a href={item.url} download>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-zinc-500 hover:text-white">
                                <Download className="w-3.5 h-3.5" />
                              </Button>
                            </a>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-zinc-500 hover:text-red-400"
                              onClick={() => { void handleDeleteMedia(item.id); }}
                              disabled={deletingMediaId === item.id}
                            >
                              {deletingMediaId === item.id
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Trash2 className="w-3.5 h-3.5" />}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
