'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import {
  Mic, Play, Pause, Loader2, AudioWaveform,
  Volume2, Video, PhoneCall, AlertCircle, RefreshCw,
  Plus, FolderOpen, Trash2, Check, X, GitCompareArrows,
  Download, MessageSquare, Send, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { VideoVoice } from '@/types/video';

// ─── Types ──────────────────────────────────────────────────────────────────

interface VoiceItem {
  id: string;
  name: string;
  provider: 'elevenlabs' | 'unrealspeech' | 'custom' | 'hedra';
  language?: string;
  gender?: string;
  previewUrl?: string;
  isCustom?: boolean;
}

interface VoiceCollection {
  id: string;
  name: string;
  description: string;
  voiceIds: string[];
  createdAt: string | null;
  updatedAt: string | null;
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function VoiceLibrary() {
  const authFetch = useAuthFetch();
  const [voices, setVoices] = useState<VoiceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingPreviewId, setLoadingPreviewId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'custom' | 'elevenlabs' | 'unrealspeech'>('all');
  const [settingDefault, setSettingDefault] = useState<string | null>(null);
  const [defaultVoiceId, setDefaultVoiceId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Collections state
  const [collections, setCollections] = useState<VoiceCollection[]>([]);
  const [showCollections, setShowCollections] = useState(false);
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDesc, setNewCollectionDesc] = useState('');
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [assigningVoiceId, setAssigningVoiceId] = useState<string | null>(null);
  const [showAssignMenu, setShowAssignMenu] = useState<string | null>(null);

  // Compare state
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const [showComparePanel, setShowComparePanel] = useState(false);

  // TTS Preview state
  const [showTtsPanel, setShowTtsPanel] = useState(false);
  const [ttsText, setTtsText] = useState('Hello, this is a preview of my voice. I can help you create professional content with clear, natural-sounding narration.');
  const [ttsVoiceId, setTtsVoiceId] = useState<string | null>(null);
  const [ttsGenerating, setTtsGenerating] = useState(false);
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);

  // ── Fetch Voices ────────────────────────────────────────────────────────

  const fetchVoices = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await authFetch('/api/video/voices');
      if (!res.ok) { throw new Error('Failed to fetch voices'); }
      const data = await res.json() as { success: boolean; voices: VideoVoice[] };
      const items: VoiceItem[] = (data.voices ?? []).map((v) => ({
        id: v.id,
        name: v.name,
        provider: v.provider ?? 'elevenlabs',
        language: v.language,
        gender: v.gender,
        previewUrl: v.previewUrl,
        isCustom: v.name.includes('Clone') || v.name.includes('clone'),
      }));
      setVoices(items);

      // Fetch defaults
      const defRes = await authFetch('/api/video/defaults');
      if (defRes.ok) {
        const defData = await defRes.json() as { success: boolean; defaults?: { voiceId?: string } };
        setDefaultVoiceId(defData.defaults?.voiceId ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load voices');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  // ── Fetch Collections ─────────────────────────────────────────────────

  const fetchCollections = useCallback(async () => {
    try {
      const res = await authFetch('/api/audio/voice-collections');
      if (res.ok) {
        const data = await res.json() as { success: boolean; collections: VoiceCollection[] };
        setCollections(data.collections ?? []);
      }
    } catch {
      // Silent — collections are supplementary
    }
  }, [authFetch]);

  useEffect(() => {
    void fetchVoices();
    void fetchCollections();
  }, [fetchVoices, fetchCollections]);

  const filteredVoices = voices.filter((v) => {
    if (filter === 'all') { return true; }
    if (filter === 'custom') { return v.provider === 'custom'; }
    return v.provider === filter;
  });

  // ── Playback ──────────────────────────────────────────────────────────

  const handlePlay = async (voice: VoiceItem) => {
    if (playingId === voice.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current) { audioRef.current.pause(); }

    if (voice.previewUrl) {
      playUrl(voice.id, voice.previewUrl);
      return;
    }

    setLoadingPreviewId(voice.id);
    try {
      const res = await authFetch('/api/video/voice-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceId: voice.id, voiceName: voice.name, provider: voice.provider }),
      });
      const data = await res.json() as { success: boolean; audioUrl?: string };
      if (data.audioUrl) { playUrl(voice.id, data.audioUrl); }
    } catch { /* silent */ } finally {
      setLoadingPreviewId(null);
    }
  };

  const playUrl = (id: string, url: string) => {
    const audio = new Audio(url);
    audioRef.current = audio;
    setPlayingId(id);
    audio.onended = () => setPlayingId(null);
    audio.play().catch(() => setPlayingId(null));
  };

  const handleSetDefault = async (voice: VoiceItem) => {
    setSettingDefault(voice.id);
    try {
      await authFetch('/api/video/defaults', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceId: voice.id, voiceName: voice.name, voiceProvider: voice.provider }),
      });
      setDefaultVoiceId(voice.id);
    } catch { /* silent */ } finally {
      setSettingDefault(null);
    }
  };

  // ── Collection Actions ────────────────────────────────────────────────

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) { return; }
    setCreatingCollection(true);
    try {
      const res = await authFetch('/api/audio/voice-collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCollectionName.trim(),
          description: newCollectionDesc.trim(),
        }),
      });
      const data = await res.json() as { success: boolean; collection?: VoiceCollection };
      if (data.success && data.collection) {
        setCollections((prev) => [data.collection as VoiceCollection, ...prev]);
        setNewCollectionName('');
        setNewCollectionDesc('');
        setShowCreateCollection(false);
      }
    } catch { /* silent */ } finally {
      setCreatingCollection(false);
    }
  };

  const handleDeleteCollection = async (collectionId: string) => {
    try {
      await authFetch('/api/audio/voice-collections', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: collectionId }),
      });
      setCollections((prev) => prev.filter((c) => c.id !== collectionId));
    } catch { /* silent */ }
  };

  const handleAssignVoice = async (voiceId: string, collectionId: string) => {
    setAssigningVoiceId(voiceId);
    const collection = collections.find((c) => c.id === collectionId);
    if (!collection) { setAssigningVoiceId(null); return; }

    const alreadyIn = collection.voiceIds.includes(voiceId);
    const newVoiceIds = alreadyIn
      ? collection.voiceIds.filter((id) => id !== voiceId)
      : [...collection.voiceIds, voiceId];

    try {
      await authFetch('/api/audio/voice-collections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: collectionId, voiceIds: newVoiceIds }),
      });
      setCollections((prev) => prev.map((c) =>
        c.id === collectionId ? { ...c, voiceIds: newVoiceIds } : c,
      ));
    } catch { /* silent */ } finally {
      setAssigningVoiceId(null);
      setShowAssignMenu(null);
    }
  };

  const handlePlayAllPreviews = async (collection: VoiceCollection) => {
    // Play previews sequentially for voices in this collection
    const collectionVoices = voices.filter((v) => collection.voiceIds.includes(v.id));
    for (const voice of collectionVoices) {
      if (voice.previewUrl) {
        await new Promise<void>((resolve) => {
          const audio = new Audio(voice.previewUrl);
          audioRef.current = audio;
          setPlayingId(voice.id);
          audio.onended = () => {
            setPlayingId(null);
            resolve();
          };
          audio.onerror = () => {
            setPlayingId(null);
            resolve();
          };
          audio.play().catch(() => {
            setPlayingId(null);
            resolve();
          });
        });
      }
    }
  };

  // ── Compare Actions ───────────────────────────────────────────────────

  const toggleCompareVoice = (voiceId: string) => {
    setCompareSelection((prev) => {
      if (prev.includes(voiceId)) { return prev.filter((id) => id !== voiceId); }
      if (prev.length >= 3) { return prev; } // Max 3
      return [...prev, voiceId];
    });
  };

  const handleSelectWinner = async (voiceId: string) => {
    const voice = voices.find((v) => v.id === voiceId);
    if (voice) {
      await handleSetDefault(voice);
    }
    setCompareMode(false);
    setCompareSelection([]);
    setShowComparePanel(false);
  };

  // ── TTS Preview Actions ───────────────────────────────────────────────

  const handleGenerateTts = async () => {
    if (!ttsVoiceId || !ttsText.trim()) { return; }
    const voice = voices.find((v) => v.id === ttsVoiceId);
    if (!voice) { return; }

    setTtsGenerating(true);
    setTtsAudioUrl(null);
    try {
      const res = await authFetch('/api/video/voice-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceId: voice.id,
          voiceName: voice.name,
          provider: voice.provider,
          text: ttsText.trim(),
        }),
      });
      const data = await res.json() as { success: boolean; audioUrl?: string };
      if (data.audioUrl) {
        setTtsAudioUrl(data.audioUrl);
      }
    } catch { /* silent */ } finally {
      setTtsGenerating(false);
    }
  };

  const handlePlayTts = () => {
    if (!ttsAudioUrl) { return; }
    if (ttsPlaying) {
      ttsAudioRef.current?.pause();
      setTtsPlaying(false);
      return;
    }
    const audio = new Audio(ttsAudioUrl);
    ttsAudioRef.current = audio;
    setTtsPlaying(true);
    audio.onended = () => setTtsPlaying(false);
    audio.play().catch(() => setTtsPlaying(false));
  };

  const handleDownloadTts = () => {
    if (!ttsAudioUrl) { return; }
    const a = document.createElement('a');
    a.href = ttsAudioUrl;
    a.download = 'tts-preview.mp3';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // ── Loading / Error States ────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading voice library...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <AlertCircle className="w-8 h-8 text-destructive" />
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={() => { void fetchVoices(); }} className="gap-2">
          <RefreshCw className="w-3 h-3" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Voice Library</h2>
          <p className="text-xs text-muted-foreground">{voices.length} voices available across all providers</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCompareMode(!compareMode);
              if (compareMode) {
                setCompareSelection([]);
                setShowComparePanel(false);
              }
            }}
            className={cn(
              'gap-1.5 border-border-strong text-xs',
              compareMode ? 'text-primary-light border-primary/30' : 'text-muted-foreground',
            )}
          >
            <GitCompareArrows className="w-3.5 h-3.5" />
            {compareMode ? 'Exit Compare' : 'Compare'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTtsPanel(!showTtsPanel)}
            className={cn(
              'gap-1.5 border-border-strong text-xs',
              showTtsPanel ? 'text-primary-light border-primary/30' : 'text-muted-foreground',
            )}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            TTS Preview
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { void fetchVoices(); }}
            className="gap-1.5 border-border-strong text-muted-foreground"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Compare Selection Bar */}
      {compareMode && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-primary-light">
              Select 2-3 voices to compare ({compareSelection.length}/3 selected)
            </div>
            {compareSelection.length >= 2 && (
              <Button
                size="sm"
                onClick={() => setShowComparePanel(true)}
                className="gap-1.5 bg-primary hover:bg-primary-dark text-white text-xs h-7"
              >
                <GitCompareArrows className="w-3 h-3" />
                Compare Now
              </Button>
            )}
          </div>
        </div>
      )}

      {/* TTS Preview Panel */}
      {showTtsPanel && (
        <div className="rounded-xl border border-primary/30 bg-card/80 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <MessageSquare className="w-4 h-4 text-primary-light" />
            Text-to-Speech Preview
          </div>

          <textarea
            value={ttsText}
            onChange={(e) => setTtsText(e.target.value)}
            placeholder="Enter text to speak..."
            rows={3}
            className="w-full px-3 py-2.5 bg-surface-elevated border border-border-strong rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
          />

          <div className="flex items-center gap-3">
            <select
              value={ttsVoiceId ?? ''}
              onChange={(e) => setTtsVoiceId(e.target.value || null)}
              className="flex-1 px-3 py-2 bg-surface-elevated border border-border-strong rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Select a voice...</option>
              {voices.filter((v) => v.provider === 'elevenlabs' || v.provider === 'custom' || v.provider === 'unrealspeech').map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.provider})
                </option>
              ))}
            </select>

            <Button
              size="sm"
              onClick={() => { void handleGenerateTts(); }}
              disabled={ttsGenerating || !ttsVoiceId || !ttsText.trim()}
              className="gap-1.5 bg-primary-dark hover:bg-primary-dark text-white text-xs"
            >
              {ttsGenerating ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Send className="w-3 h-3" />
              )}
              Generate
            </Button>
          </div>

          {ttsAudioUrl && (
            <div className="flex items-center gap-2 pt-2 border-t border-border-strong">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePlayTts}
                className="gap-1.5 text-xs h-7"
              >
                {ttsPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                {ttsPlaying ? 'Pause' : 'Play'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownloadTts}
                className="gap-1.5 text-xs h-7"
              >
                <Download className="w-3 h-3" />
                Download
              </Button>
              <span className="text-[10px] text-muted-foreground ml-auto">Audio ready</span>
            </div>
          )}
        </div>
      )}

      {/* Compare Panel */}
      {showComparePanel && compareSelection.length >= 2 && (
        <ComparePanel
          voices={voices.filter((v) => compareSelection.includes(v.id))}
          authFetch={authFetch}
          onSelectWinner={(id) => { void handleSelectWinner(id); }}
          onClose={() => setShowComparePanel(false)}
        />
      )}

      {/* Collections Section */}
      <div className="rounded-xl border border-border-strong bg-card/50">
        <button
          onClick={() => setShowCollections(!showCollections)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-elevated/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-primary-light" />
            <span className="text-sm font-medium text-foreground">Collections</span>
            <span className="text-[10px] text-muted-foreground">({collections.length})</span>
          </div>
          {showCollections ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>

        {showCollections && (
          <div className="px-4 pb-4 space-y-3 border-t border-border-strong/50">
            {/* Create Collection */}
            {!showCreateCollection ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateCollection(true)}
                className="gap-1.5 border-border-strong text-muted-foreground text-xs mt-3"
              >
                <Plus className="w-3 h-3" />
                New Collection
              </Button>
            ) : (
              <div className="mt-3 space-y-2 rounded-lg bg-surface-elevated/30 p-3">
                <input
                  type="text"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  placeholder="Collection name (e.g. Brand Voices)"
                  className="w-full px-3 py-2 bg-surface-elevated border border-border-strong rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <input
                  type="text"
                  value={newCollectionDesc}
                  onChange={(e) => setNewCollectionDesc(e.target.value)}
                  placeholder="Description (optional)"
                  className="w-full px-3 py-2 bg-surface-elevated border border-border-strong rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => { void handleCreateCollection(); }}
                    disabled={creatingCollection || !newCollectionName.trim()}
                    className="gap-1 bg-primary hover:bg-primary-dark text-white text-xs"
                  >
                    {creatingCollection ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    Create
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setShowCreateCollection(false); setNewCollectionName(''); setNewCollectionDesc(''); }}
                    className="text-xs text-muted-foreground"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Collection List */}
            {collections.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No collections yet. Create one to organize your voices.</p>
            ) : (
              <div className="space-y-2 mt-2">
                {collections.map((collection) => {
                  const voiceCount = collection.voiceIds.length;
                  const collectionVoiceNames = collection.voiceIds
                    .map((id) => voices.find((v) => v.id === id)?.name)
                    .filter(Boolean)
                    .slice(0, 3);

                  return (
                    <div
                      key={collection.id}
                      className="rounded-lg border border-border-strong/50 bg-surface-elevated/30 p-3"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          <p className="text-sm font-medium text-white">{collection.name}</p>
                          {collection.description && (
                            <p className="text-[10px] text-muted-foreground">{collection.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {voiceCount > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { void handlePlayAllPreviews(collection); }}
                              className="h-6 px-2 text-[10px] gap-1 text-muted-foreground"
                              title="Play all voice previews in this collection"
                            >
                              <Play className="w-2.5 h-2.5" />
                              Play All
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { void handleDeleteCollection(collection.id); }}
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] text-muted-foreground">
                          {voiceCount} voice{voiceCount !== 1 ? 's' : ''}
                        </span>
                        {collectionVoiceNames.length > 0 && (
                          <>
                            <span className="text-muted-foreground">|</span>
                            <span className="text-[10px] text-muted-foreground truncate">
                              {collectionVoiceNames.join(', ')}{voiceCount > 3 ? '...' : ''}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-1.5">
        {(['all', 'custom', 'elevenlabs', 'unrealspeech'] as const).map((f) => {
          const count = f === 'all' ? voices.length
            : f === 'custom' ? voices.filter((v) => v.provider === 'custom').length
            : voices.filter((v) => v.provider === f).length;
          if (f !== 'all' && count === 0) { return null; }
          const label = f === 'all' ? 'All'
            : f === 'custom' ? 'My Clones'
            : f === 'elevenlabs' ? 'ElevenLabs'
            : 'UnrealSpeech';
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                filter === f
                  ? 'bg-primary/20 text-primary-light border-primary/30'
                  : 'bg-surface-elevated/50 text-muted-foreground border-border-strong/50 hover:border-border',
              )}
            >
              {`${label} (${count})`}
            </button>
          );
        })}
      </div>

      {/* Voice Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filteredVoices.slice(0, 50).map((voice) => {
          const isPlaying = playingId === voice.id;
          const isDefault = defaultVoiceId === voice.id;
          const isSelected = compareSelection.includes(voice.id);

          return (
            <div
              key={voice.id}
              onClick={compareMode ? () => toggleCompareVoice(voice.id) : undefined}
              className={cn(
                'relative rounded-xl border p-4 transition-all',
                compareMode && 'cursor-pointer',
                isSelected && compareMode
                  ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20'
                  : isDefault
                  ? 'border-primary/50 bg-primary/5'
                  : 'border-border-strong bg-card/50 hover:border-border-strong',
              )}
            >
              {isDefault && (
                <span className="absolute top-2 right-2 px-1.5 py-0.5 text-[9px] font-bold bg-primary/20 text-primary-light rounded">
                  DEFAULT
                </span>
              )}

              {compareMode && isSelected && (
                <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </span>
              )}

              <div className="flex items-start gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                  isPlaying ? 'bg-primary/20' : 'bg-surface-elevated',
                )}>
                  {isPlaying ? (
                    <Volume2 className="w-5 h-5 text-primary-light animate-pulse" />
                  ) : (
                    <Mic className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{voice.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {voice.language && <span className="text-[10px] text-muted-foreground">{voice.language}</span>}
                    {voice.gender && (
                      <>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-[10px] text-muted-foreground capitalize">{voice.gender}</span>
                      </>
                    )}
                    <span className={cn(
                      'px-1 py-0.5 text-[8px] font-bold rounded',
                      voice.provider === 'custom' ? 'bg-green-500/20 text-green-400'
                        : voice.provider === 'elevenlabs' ? 'bg-primary/20 text-primary-light'
                        : 'bg-primary/20 text-primary-light',
                    )}>
                      {voice.provider === 'custom' ? 'CLONE'
                        : voice.provider === 'elevenlabs' ? 'XI'
                        : 'US'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              {!compareMode && (
                <div className="flex items-center gap-1.5 mt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { void handlePlay(voice); }}
                    disabled={loadingPreviewId === voice.id}
                    className="h-7 px-2 text-xs gap-1"
                  >
                    {loadingPreviewId === voice.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : isPlaying ? (
                      <Pause className="w-3 h-3" />
                    ) : (
                      <Play className="w-3 h-3" />
                    )}
                    {isPlaying ? 'Stop' : 'Preview'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { void handleSetDefault(voice); }}
                    disabled={settingDefault === voice.id || isDefault}
                    className="h-7 px-2 text-xs gap-1"
                    title="Set as default voice for videos"
                  >
                    {settingDefault === voice.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Video className="w-3 h-3" />
                    )}
                    Video
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs gap-1"
                    title="Use as voice agent voice"
                  >
                    <PhoneCall className="w-3 h-3" />
                    Agent
                  </Button>

                  {/* Assign to Collection */}
                  {collections.length > 0 && (
                    <div className="relative ml-auto">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAssignMenu(showAssignMenu === voice.id ? null : voice.id)}
                        className="h-7 px-2 text-xs gap-1"
                        title="Add to collection"
                      >
                        <FolderOpen className="w-3 h-3" />
                      </Button>
                      {showAssignMenu === voice.id && (
                        <div className="absolute right-0 top-8 z-20 w-48 rounded-lg border border-border-strong bg-surface-elevated shadow-xl py-1">
                          {collections.map((col) => {
                            const isInCollection = col.voiceIds.includes(voice.id);
                            return (
                              <button
                                key={col.id}
                                onClick={() => { void handleAssignVoice(voice.id, col.id); }}
                                disabled={assigningVoiceId === voice.id}
                                className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-border-strong/50 flex items-center gap-2"
                              >
                                {isInCollection ? (
                                  <Check className="w-3 h-3 text-green-400" />
                                ) : (
                                  <Plus className="w-3 h-3 text-muted-foreground" />
                                )}
                                {col.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredVoices.length > 50 && (
        <p className="text-xs text-muted-foreground text-center">
          Showing 50 of {filteredVoices.length} voices. Use filters to narrow results.
        </p>
      )}

      {filteredVoices.length === 0 && (
        <div className="flex flex-col items-center py-16 gap-3">
          <AudioWaveform className="w-10 h-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No voices match this filter.</p>
        </div>
      )}
    </div>
  );
}

// ─── Compare Panel ──────────────────────────────────────────────────────────

interface ComparePanelProps {
  voices: VoiceItem[];
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onSelectWinner: (voiceId: string) => void;
  onClose: () => void;
}

function ComparePanel({ voices, authFetch, onSelectWinner, onClose }: ComparePanelProps) {
  const [comparePlaying, setComparePlaying] = useState<string | null>(null);
  const [compareLoading, setCompareLoading] = useState<string | null>(null);
  const compareAudioRef = useRef<HTMLAudioElement | null>(null);
  const sampleText = 'Hello, this is a comparison test. This voice is being evaluated for quality, clarity, and naturalness. How does it sound to you?';

  const playCompareAudio = useCallback((voiceId: string, url: string) => {
    const audio = new Audio(url);
    compareAudioRef.current = audio;
    setComparePlaying(voiceId);
    audio.onended = () => setComparePlaying(null);
    audio.play().catch(() => setComparePlaying(null));
  }, []);

  const handleComparePlay = async (voice: VoiceItem) => {
    if (comparePlaying === voice.id) {
      compareAudioRef.current?.pause();
      setComparePlaying(null);
      return;
    }
    if (compareAudioRef.current) { compareAudioRef.current.pause(); }

    if (voice.previewUrl) {
      playCompareAudio(voice.id, voice.previewUrl);
      return;
    }

    setCompareLoading(voice.id);
    try {
      const res = await authFetch('/api/video/voice-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceId: voice.id,
          voiceName: voice.name,
          provider: voice.provider,
          text: sampleText,
        }),
      });
      const data = await res.json() as { success: boolean; audioUrl?: string };
      if (data.audioUrl) {
        playCompareAudio(voice.id, data.audioUrl);
      }
    } catch { /* silent */ } finally {
      setCompareLoading(null);
    }
  };

  return (
    <div className="rounded-xl border border-primary/30 bg-card/80 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-primary-light">
          <GitCompareArrows className="w-4 h-4" />
          Voice Comparison
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-6 w-6 p-0 text-muted-foreground hover:text-white"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <p className="text-[10px] text-muted-foreground bg-surface-elevated/50 rounded px-2 py-1.5">
        Sample: &ldquo;{sampleText}&rdquo;
      </p>

      <div className="space-y-2">
        {voices.map((voice) => {
          const isPlaying = comparePlaying === voice.id;
          const isLoading = compareLoading === voice.id;

          return (
            <div
              key={voice.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border-strong/50 bg-surface-elevated/30"
            >
              <button
                onClick={() => { void handleComparePlay(voice); }}
                disabled={isLoading}
                className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors',
                  isPlaying
                    ? 'bg-primary/20 text-primary-light'
                    : 'bg-border-strong text-muted-foreground hover:text-white',
                )}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4 ml-0.5" />
                )}
              </button>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{voice.name}</p>
                <span className="text-[10px] text-muted-foreground">{voice.provider}</span>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => onSelectWinner(voice.id)}
                className="gap-1 text-xs border-primary/30 text-primary-light hover:bg-primary/10 h-7"
              >
                <Check className="w-3 h-3" />
                Select Winner
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
