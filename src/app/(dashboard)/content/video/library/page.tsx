'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useVideoPipelineStore } from '@/lib/stores/video-pipeline-store';
import {
  Video,
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ProjectStatus, PipelineStep, VideoType, PipelineProject } from '@/types/video-pipeline';

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

type FilterTab = 'all' | 'completed' | 'in-progress' | 'draft';

// ============================================================================
// Constants
// ============================================================================

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'completed', label: 'Completed' },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'draft', label: 'Draft' },
];

const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; icon: typeof CheckCircle }> = {
  completed: { label: 'Completed', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: CheckCircle },
  assembled: { label: 'Assembled', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Film },
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

function filterToStatuses(tab: FilterTab): ProjectStatus[] | undefined {
  switch (tab) {
    case 'completed':
      return ['completed'];
    case 'in-progress':
      return ['approved', 'generating', 'assembled'];
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

// ============================================================================
// Component
// ============================================================================

export default function VideoLibraryPage() {
  const router = useRouter();
  const authFetch = useAuthFetch();
  const { loadProject, reset } = useVideoPipelineStore();

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedProject, setExpandedProject] = useState<PipelineProject | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Fetch projects
  const fetchProjects = useCallback(async (tab: FilterTab) => {
    setLoading(true);
    try {
      const statuses = filterToStatuses(tab);
      const params = new URLSearchParams();
      if (statuses) {
        for (const s of statuses) {
          params.append('status', s);
        }
      }
      const url = `/api/video/project/list${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await authFetch(url);
      if (response.ok) {
        const data = await response.json() as { success: boolean; projects: ProjectSummary[] };
        if (data.success) {
          setProjects(data.projects);
        }
      }
    } catch {
      // Silently handle — empty state will show
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void fetchProjects(activeTab);
  }, [activeTab, fetchProjects]);

  // Load full project details for expanded view
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
        if (data.success) {
          setExpandedProject(data.project);
        }
      }
    } catch {
      // Silently handle
    } finally {
      setLoadingDetail(false);
    }
  }, [authFetch, expandedId]);

  // Open project in the pipeline editor
  const handleEdit = useCallback((project: PipelineProject) => {
    loadProject(project);
    router.push('/content/video');
  }, [loadProject, router]);

  // Delete project
  const handleDelete = useCallback(async (projectId: string) => {
    setDeleting(projectId);
    try {
      const response = await authFetch(`/api/video/project/${projectId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== projectId));
        if (expandedId === projectId) {
          setExpandedId(null);
          setExpandedProject(null);
        }
      }
    } catch {
      // Silently handle
    } finally {
      setDeleting(null);
    }
  }, [authFetch, expandedId]);

  // Create new video
  const handleCreateNew = useCallback(() => {
    reset();
    router.push('/content/video');
  }, [reset, router]);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Video className="w-7 h-7 text-amber-500" />
            Video Library
          </h1>
          <p className="text-zinc-400 mt-1">
            Browse, manage, and review your video projects
          </p>
        </div>
        <Button
          onClick={handleCreateNew}
          className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
        >
          <Plus className="w-4 h-4" />
          Create New Video
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-zinc-800 pb-3">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Film className="w-16 h-16 text-zinc-700 mb-4" />
          <h2 className="text-lg font-semibold text-zinc-300">No videos yet</h2>
          <p className="text-zinc-500 mt-1 max-w-md">
            {activeTab === 'all'
              ? 'Create your first video in the Video Studio or ask Jasper to prepare one for you.'
              : `No ${activeTab} videos found. Try a different filter.`}
          </p>
          {activeTab === 'all' && (
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
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-white truncate">
                        {project.name}
                      </h3>
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

                  {/* Meta */}
                  <div className="flex items-center gap-3 mt-3 text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                      <Film className="w-3 h-3" />
                      {project.sceneCount} scenes
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(project.updatedAt)}
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
                          {/* Video Player */}
                          {expandedProject.finalVideoUrl && (
                            <div className="rounded-lg overflow-hidden bg-black">
                              <video
                                src={expandedProject.finalVideoUrl}
                                controls
                                className="w-full max-h-[400px]"
                              />
                            </div>
                          )}

                          {/* Script Preview */}
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

                          {/* Brief Description */}
                          <div>
                            <h4 className="text-sm font-medium text-zinc-300">Description</h4>
                            <p className="text-xs text-zinc-400 mt-1">
                              {expandedProject.brief.description}
                            </p>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 pt-2">
                            <Button
                              size="sm"
                              className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
                              onClick={() => handleEdit(expandedProject)}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              Edit in Studio
                            </Button>
                            {expandedProject.finalVideoUrl && (
                              <a href={expandedProject.finalVideoUrl} download>
                                <Button size="sm" variant="outline" className="gap-1.5">
                                  <Download className="w-3.5 h-3.5" />
                                  Download
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
                              {deleting === project.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                              Delete
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-zinc-500 py-4">
                          <AlertCircle className="w-4 h-4" />
                          Could not load project details
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
    </div>
  );
}
