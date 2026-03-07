'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AudioWaveform, Play, Pause, Save, Loader2, AlertCircle,
  ChevronDown, ChevronUp, Search, Wand2,
  Settings2, RotateCcw, CheckCircle2, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { cn } from '@/lib/utils';
import {
  type VoiceEffectsSettings,
  type EffectPreset,
  DEFAULT_EFFECTS,
  EFFECT_PRESETS,
  VoiceEffectsPreview,
  exportProcessed,
} from '@/lib/audio/voice-effects-engine';

// ─── Types ──────────────────────────────────────────────────────────────────

interface VoiceOption {
  voice_id: string;
  name: string;
  language?: string;
  gender?: string;
  provider: string;
  preview_url?: string;
}

type DesignerPhase = 'select' | 'design' | 'saving';

// ─── Constants ──────────────────────────────────────────────────────────────

const SAMPLE_TEXT_OPTIONS = [
  'Hello! This is a preview of my voice. I can help you create professional content for your business.',
  'Welcome to SalesVelocity! Let me show you how we can accelerate your growth and close more deals.',
  'Breaking news: Our latest product launch has exceeded all expectations. Here are the details.',
  'Good morning! Today we have an exciting presentation prepared for our investors and stakeholders.',
];

const DESIGNER_PRESETS: EffectPreset[] = [
  ...EFFECT_PRESETS,
  {
    name: 'Narrator',
    description: 'Warm, authoritative, documentary-style',
    settings: {
      ...DEFAULT_EFFECTS,
      equalizer: { low: 4, mid: 2, high: 1 },
      compressor: { threshold: -20, ratio: 5, attack: 0.005, release: 0.2 },
      pitchShift: -2,
      formantShift: 1,
      reverb: { mix: 0.12, decay: 1.2 },
      noiseGateThreshold: -55,
      highPassFreq: 80,
      deEsser: { threshold: -25, frequency: 6000, ratio: 3 },
      limiterEnabled: true,
      speed: 0.95,
    },
  },
  {
    name: 'Energetic',
    description: 'Bright, fast, commercial-ready',
    settings: {
      ...DEFAULT_EFFECTS,
      equalizer: { low: -1, mid: 4, high: 5 },
      compressor: { threshold: -16, ratio: 5, attack: 0.002, release: 0.15 },
      pitchShift: 2,
      formantShift: -1,
      reverb: { mix: 0.06, decay: 0.4 },
      noiseGateThreshold: -50,
      highPassFreq: 100,
      deEsser: { threshold: -22, frequency: 7000, ratio: 3 },
      limiterEnabled: true,
      speed: 1.1,
    },
  },
  {
    name: 'Whisper',
    description: 'Intimate, ASMR-style, soft presence',
    settings: {
      ...DEFAULT_EFFECTS,
      equalizer: { low: -4, mid: 3, high: 8 },
      compressor: { threshold: -30, ratio: 3, attack: 0.01, release: 0.4 },
      reverb: { mix: 0.2, decay: 2.0 },
      delay: { time: 80, feedback: 0.15, mix: 0.1 },
      noiseGateThreshold: -80,
      highPassFreq: 120,
      chorus: { rate: 0.5, depth: 2, mix: 0.15 },
      speed: 0.9,
    },
  },
  {
    name: 'Robot',
    description: 'Metallic, processed, sci-fi feel',
    settings: {
      ...DEFAULT_EFFECTS,
      equalizer: { low: -6, mid: 8, high: 4 },
      compressor: { threshold: -12, ratio: 10, attack: 0.001, release: 0.05 },
      pitchShift: -3,
      reverb: { mix: 0.15, decay: 0.8 },
      delay: { time: 30, feedback: 0.4, mix: 0.25 },
      noiseGateThreshold: -40,
      distortion: { amount: 30, tone: 4000, mix: 0.4 },
      chorus: { rate: 5, depth: 8, mix: 0.3 },
    },
  },
  {
    name: 'Cinematic',
    description: 'Epic, larger-than-life, movie trailer',
    settings: {
      ...DEFAULT_EFFECTS,
      equalizer: { low: 5, mid: 3, high: 2 },
      compressor: { threshold: -18, ratio: 6, attack: 0.003, release: 0.2 },
      pitchShift: -3,
      formantShift: 3,
      reverb: { mix: 0.25, decay: 3.0 },
      delay: { time: 200, feedback: 0.3, mix: 0.15 },
      noiseGateThreshold: -55,
      highPassFreq: 60,
      chorus: { rate: 0.3, depth: 4, mix: 0.2 },
      distortion: { amount: 8, tone: 6000, mix: 0.1 },
      limiterEnabled: true,
    },
  },
  {
    name: 'Female Shift',
    description: 'Higher formants, brighter character',
    settings: {
      ...DEFAULT_EFFECTS,
      equalizer: { low: -3, mid: 1, high: 4 },
      compressor: { threshold: -22, ratio: 3, attack: 0.005, release: 0.2 },
      pitchShift: 3,
      formantShift: 5,
      noiseGateThreshold: -50,
      highPassFreq: 150,
      deEsser: { threshold: -20, frequency: 7500, ratio: 4 },
      limiterEnabled: true,
    },
  },
  {
    name: 'Male Shift',
    description: 'Lower formants, deeper character',
    settings: {
      ...DEFAULT_EFFECTS,
      equalizer: { low: 4, mid: 0, high: -2 },
      compressor: { threshold: -22, ratio: 4, attack: 0.005, release: 0.25 },
      pitchShift: -3,
      formantShift: -5,
      noiseGateThreshold: -55,
      highPassFreq: 60,
      limiterEnabled: true,
    },
  },
  {
    name: 'Vintage Warm',
    description: 'Analog saturation, vinyl warmth',
    settings: {
      ...DEFAULT_EFFECTS,
      equalizer: { low: 3, mid: 2, high: -3 },
      compressor: { threshold: -20, ratio: 4, attack: 0.01, release: 0.3 },
      distortion: { amount: 12, tone: 5000, mix: 0.25 },
      reverb: { mix: 0.08, decay: 0.6 },
      highPassFreq: 80,
      limiterEnabled: true,
    },
  },
];

// ─── Effect Slider ──────────────────────────────────────────────────────────

function EffectSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (val: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-zinc-400 w-20 flex-shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 accent-purple-500 h-1.5"
      />
      <span className="text-xs text-zinc-500 w-16 text-right tabular-nums">
        {value.toFixed(step < 1 ? (step < 0.1 ? 2 : 1) : 0)}{unit ?? ''}
      </span>
    </div>
  );
}

// ─── Voice Card ─────────────────────────────────────────────────────────────

function VoiceCard({
  voice,
  isSelected,
  onSelect,
}: {
  voice: VoiceOption;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const providerColors: Record<string, string> = {
    elevenlabs: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
    unrealSpeech: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    custom: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
  };

  return (
    <button
      onClick={onSelect}
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left w-full',
        isSelected
          ? 'bg-purple-500/10 border-purple-500/50 shadow-lg shadow-purple-500/5'
          : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/50',
      )}
    >
      <div className={cn(
        'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
        isSelected ? 'bg-purple-500/20' : 'bg-zinc-800',
      )}>
        <AudioWaveform className={cn('w-4 h-4', isSelected ? 'text-purple-400' : 'text-zinc-500')} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-medium truncate', isSelected ? 'text-purple-300' : 'text-zinc-200')}>
          {voice.name}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={cn(
            'text-[10px] px-1.5 py-0.5 rounded border',
            providerColors[voice.provider] ?? 'bg-zinc-800 text-zinc-500 border-zinc-700',
          )}>
            {voice.provider}
          </span>
          {voice.gender && (
            <span className="text-[10px] text-zinc-600">{voice.gender}</span>
          )}
          {voice.language && (
            <span className="text-[10px] text-zinc-600">{voice.language}</span>
          )}
        </div>
      </div>
      {isSelected && (
        <CheckCircle2 className="w-4 h-4 text-purple-400 flex-shrink-0" />
      )}
    </button>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function VoiceDesigner() {
  const authFetch = useAuthFetch();

  // ── Phase ──
  const [phase, setPhase] = useState<DesignerPhase>('select');

  // ── Voice selection ──
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState<VoiceOption | null>(null);
  const [voiceSearch, setVoiceSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState<string>('all');

  // ── TTS sample ──
  const [sampleText, setSampleText] = useState(SAMPLE_TEXT_OPTIONS[0]);
  const [isGeneratingSample, setIsGeneratingSample] = useState(false);
  const [sampleBuffer, setSampleBuffer] = useState<AudioBuffer | null>(null);
  const [sampleError, setSampleError] = useState<string | null>(null);

  // ── Effects ──
  const [effects, setEffects] = useState<VoiceEffectsSettings>({ ...DEFAULT_EFFECTS });
  const [activePreset, setActivePreset] = useState<string>('Natural');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // ── Playback ──
  const [isPlaying, setIsPlaying] = useState(false);
  const previewRef = useRef<VoiceEffectsPreview | null>(null);
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState(0);

  // ── Saving ──
  const [newVoiceName, setNewVoiceName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Load voices ──
  useEffect(() => {
    const loadVoices = async () => {
      setLoadingVoices(true);
      try {
        // Fetch from voice API + custom clones
        const [voicesRes, customRes] = await Promise.all([
          authFetch('/api/video/voices'),
          authFetch('/api/video/voice-clone'),
        ]);

        const allVoices: VoiceOption[] = [];

        if (voicesRes.ok) {
          const data = await voicesRes.json() as {
            voices?: Array<{
              voice_id: string;
              name: string;
              language?: string;
              gender?: string;
              provider?: string;
            }>;
          };
          if (data.voices) {
            allVoices.push(...data.voices.map((v) => ({
              voice_id: v.voice_id,
              name: v.name,
              language: v.language,
              gender: v.gender,
              provider: v.provider ?? 'elevenlabs',
            })));
          }
        }

        if (customRes.ok) {
          const customData = await customRes.json() as {
            voices?: Array<{
              voiceId: string;
              name: string;
              provider?: string;
            }>;
          };
          if (customData.voices) {
            // Avoid duplicates
            const existingIds = new Set(allVoices.map((v) => v.voice_id));
            for (const cv of customData.voices) {
              if (!existingIds.has(cv.voiceId)) {
                allVoices.push({
                  voice_id: cv.voiceId,
                  name: cv.name,
                  provider: cv.provider ?? 'custom',
                });
              }
            }
          }
        }

        setVoices(allVoices);
      } catch {
        // Silent — voices are supplementary
      } finally {
        setLoadingVoices(false);
      }
    };

    void loadVoices();
  }, [authFetch]);

  // ── Filtered voices ──
  const filteredVoices = voices.filter((v) => {
    const matchesSearch = !voiceSearch ||
      v.name.toLowerCase().includes(voiceSearch.toLowerCase()) ||
      v.provider.toLowerCase().includes(voiceSearch.toLowerCase());
    const matchesProvider = providerFilter === 'all' || v.provider === providerFilter;
    return matchesSearch && matchesProvider;
  });

  // ── Unique providers ──
  const providers = ['all', ...new Set(voices.map((v) => v.provider))];

  // ── Generate TTS sample ──
  const generateSample = useCallback(async () => {
    if (!selectedVoice) { return; }

    setIsGeneratingSample(true);
    setSampleError(null);
    setSampleBuffer(null);

    try {
      const res = await authFetch('/api/video/voice-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceId: selectedVoice.voice_id,
          text: sampleText,
          provider: selectedVoice.provider,
        }),
      });

      if (!res.ok) {
        const errData = await res.json() as { error?: string };
        setSampleError(errData.error ?? 'Failed to generate voice sample');
        return;
      }

      const data = await res.json() as { audioUrl?: string; base64?: string };

      // Decode audio to AudioBuffer
      let arrayBuffer: ArrayBuffer;

      if (data.base64) {
        // base64 data URL: "data:audio/mpeg;base64,..."
        const base64Str = data.base64.includes(',')
          ? data.base64.split(',')[1]
          : data.base64;
        const binaryStr = atob(base64Str);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        arrayBuffer = bytes.buffer;
      } else if (data.audioUrl) {
        const audioRes = await fetch(data.audioUrl);
        arrayBuffer = await audioRes.arrayBuffer();
      } else {
        setSampleError('No audio data received');
        return;
      }

      const audioCtx = new AudioContext();
      const buffer = await audioCtx.decodeAudioData(arrayBuffer);
      await audioCtx.close();

      setSampleBuffer(buffer);
      setPhase('design');
    } catch (err) {
      setSampleError(err instanceof Error ? err.message : 'Failed to generate sample');
    } finally {
      setIsGeneratingSample(false);
    }
  }, [selectedVoice, sampleText, authFetch]);

  // ── Playback ──
  const stopPlayback = useCallback(() => {
    if (previewRef.current) {
      previewRef.current.stop();
      previewRef.current = null;
    }
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }
    setIsPlaying(false);
    setPlaybackProgress(0);
  }, []);

  const playWithEffects = useCallback(() => {
    if (!sampleBuffer) { return; }

    stopPlayback();

    const preview = new VoiceEffectsPreview();
    previewRef.current = preview;
    preview.play(sampleBuffer, effects, () => {
      stopPlayback();
    });
    setIsPlaying(true);

    const duration = sampleBuffer.duration;
    playbackIntervalRef.current = setInterval(() => {
      if (preview.getIsPlaying()) {
        setPlaybackProgress(preview.getProgress(duration, effects));
      } else {
        stopPlayback();
      }
    }, 100);
  }, [sampleBuffer, effects, stopPlayback]);

  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      stopPlayback();
    } else {
      playWithEffects();
    }
  }, [isPlaying, stopPlayback, playWithEffects]);

  // ── Cleanup ──
  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, [stopPlayback]);

  // ── Apply preset ──
  const applyPreset = (preset: EffectPreset) => {
    setEffects({ ...preset.settings });
    setActivePreset(preset.name);
    stopPlayback();
  };

  // ── Reset effects ──
  const resetEffects = () => {
    setEffects({ ...DEFAULT_EFFECTS });
    setActivePreset('Natural');
    stopPlayback();
  };

  // ── Update individual effect ──
  const updateEffect = <K extends keyof VoiceEffectsSettings>(
    key: K,
    value: VoiceEffectsSettings[K],
  ) => {
    setEffects((prev) => ({ ...prev, [key]: value }));
    setActivePreset(''); // Clear preset label when manually adjusting
  };

  // ── Save as new voice ──
  const handleSave = async () => {
    if (!sampleBuffer || !newVoiceName.trim()) { return; }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      // Export processed audio as WAV blob
      const processedWav = await exportProcessed(sampleBuffer, effects);

      // Create FormData for voice clone API
      const formData = new FormData();
      formData.append('name', newVoiceName.trim());
      formData.append('description', `Voice designed from "${selectedVoice?.name ?? 'unknown'}" with ${activePreset || 'custom'} effects`);
      formData.append('files', new Blob([processedWav], { type: 'audio/wav' }), `${newVoiceName.trim()}.wav`);

      const res = await authFetch('/api/video/voice-clone', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json() as { error?: string };
        setSaveError(errData.error ?? 'Failed to save voice');
        return;
      }

      setSaveSuccess(true);

      // Reset after success
      setTimeout(() => {
        setPhase('select');
        setSelectedVoice(null);
        setSampleBuffer(null);
        setEffects({ ...DEFAULT_EFFECTS });
        setActivePreset('Natural');
        setNewVoiceName('');
        setSaveSuccess(false);
      }, 2000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save voice');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Format time ──
  const formatTime = (s: number): string => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
          <Wand2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Voice Designer</h2>
          <p className="text-xs text-zinc-500">Select a voice, modify it with effects, and save as a new custom voice</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* ─── Phase 1: Select Voice ─── */}
        {phase === 'select' && (
          <motion.div
            key="select"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4"
          >
            {/* Step indicator */}
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <div className="w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-bold">1</div>
              <span className="font-medium text-white">Choose a voice</span>
              <div className="w-8 h-px bg-zinc-700" />
              <div className="w-6 h-6 rounded-full bg-zinc-800 text-zinc-600 flex items-center justify-center text-xs font-bold">2</div>
              <span className="text-zinc-600">Design</span>
              <div className="w-8 h-px bg-zinc-700" />
              <div className="w-6 h-6 rounded-full bg-zinc-800 text-zinc-600 flex items-center justify-center text-xs font-bold">3</div>
              <span className="text-zinc-600">Save</span>
            </div>

            {/* Search & Filter */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                <input
                  type="text"
                  placeholder="Search voices..."
                  value={voiceSearch}
                  onChange={(e) => setVoiceSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-zinc-800/80 border border-zinc-700 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                />
              </div>
              <div className="flex gap-1">
                {providers.map((p) => (
                  <button
                    key={p}
                    onClick={() => setProviderFilter(p)}
                    className={cn(
                      'px-3 py-2 rounded-xl text-xs font-medium border transition-all capitalize',
                      providerFilter === p
                        ? 'bg-purple-500/15 border-purple-500/40 text-purple-300'
                        : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-500 hover:border-zinc-500',
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Voice Grid */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
              {loadingVoices ? (
                <div className="flex items-center justify-center py-12 gap-2 text-zinc-500">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Loading voices...</span>
                </div>
              ) : filteredVoices.length === 0 ? (
                <div className="text-center py-12">
                  <AudioWaveform className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                  <p className="text-sm text-zinc-500">No voices found</p>
                  <p className="text-xs text-zinc-600 mt-1">Try a different search or filter</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[400px] overflow-y-auto pr-1">
                  {filteredVoices.map((voice) => (
                    <VoiceCard
                      key={voice.voice_id}
                      voice={voice}
                      isSelected={selectedVoice?.voice_id === voice.voice_id}
                      onSelect={() => setSelectedVoice(voice)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Sample Text */}
            {selectedVoice && (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Sample Text
                </label>
                <textarea
                  value={sampleText}
                  onChange={(e) => setSampleText(e.target.value)}
                  placeholder="Enter text to generate a voice sample..."
                  rows={3}
                  className="w-full px-4 py-3 bg-zinc-800/80 border border-zinc-700 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none mb-3"
                />
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {SAMPLE_TEXT_OPTIONS.map((text, i) => (
                    <button
                      key={i}
                      onClick={() => setSampleText(text)}
                      className={cn(
                        'px-2.5 py-1 rounded-lg text-[10px] border transition-all',
                        sampleText === text
                          ? 'bg-purple-500/15 border-purple-500/30 text-purple-300'
                          : 'bg-zinc-800 border-zinc-700/50 text-zinc-500 hover:text-zinc-300',
                      )}
                    >
                      Sample {i + 1}
                    </button>
                  ))}
                </div>

                {sampleError && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl mb-3">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <p className="text-xs text-red-400">{sampleError}</p>
                  </div>
                )}

                <Button
                  onClick={() => { void generateSample(); }}
                  disabled={isGeneratingSample || !sampleText.trim()}
                  className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl w-full"
                >
                  {isGeneratingSample ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Wand2 className="w-4 h-4" />
                  )}
                  {isGeneratingSample ? 'Generating Sample...' : 'Generate Sample & Design Voice'}
                </Button>
              </div>
            )}
          </motion.div>
        )}

        {/* ─── Phase 2: Design Voice ─── */}
        {phase === 'design' && sampleBuffer && (
          <motion.div
            key="design"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4"
          >
            {/* Step indicator */}
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <div className="w-6 h-6 rounded-full bg-purple-500/30 text-purple-300 flex items-center justify-center text-xs font-bold">1</div>
              <span className="text-purple-400">{selectedVoice?.name}</span>
              <div className="w-8 h-px bg-purple-500/30" />
              <div className="w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-bold">2</div>
              <span className="font-medium text-white">Design</span>
              <div className="w-8 h-px bg-zinc-700" />
              <div className="w-6 h-6 rounded-full bg-zinc-800 text-zinc-600 flex items-center justify-center text-xs font-bold">3</div>
              <span className="text-zinc-600">Save</span>
            </div>

            {/* Playback Controls */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
              <div className="flex items-center gap-4">
                <button
                  onClick={togglePlayback}
                  className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center hover:shadow-lg hover:shadow-violet-500/30 transition-all flex-shrink-0"
                >
                  {isPlaying ? (
                    <Pause className="w-6 h-6 text-white" />
                  ) : (
                    <Play className="w-6 h-6 text-white ml-0.5" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-white truncate">
                      {selectedVoice?.name} — {activePreset || 'Custom Effects'}
                    </p>
                    <span className="text-xs text-zinc-500 ml-2 flex-shrink-0">
                      {formatTime(playbackProgress * sampleBuffer.duration)} / {formatTime(sampleBuffer.duration)}
                    </span>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-1.5">
                    <div
                      className="bg-gradient-to-r from-violet-500 to-indigo-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${playbackProgress * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Effect Presets */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-zinc-300">Voice Presets</h3>
                <button
                  onClick={resetEffects}
                  className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
                {DESIGNER_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => applyPreset(preset)}
                    className={cn(
                      'px-3 py-2.5 rounded-xl border text-left transition-all',
                      activePreset === preset.name
                        ? 'bg-purple-500/10 border-purple-500/40'
                        : 'bg-zinc-800/50 border-zinc-700/50 hover:border-zinc-500',
                    )}
                  >
                    <p className={cn(
                      'text-xs font-medium',
                      activePreset === preset.name ? 'text-purple-300' : 'text-zinc-300',
                    )}>
                      {preset.name}
                    </p>
                    <p className="text-[10px] text-zinc-600 mt-0.5 truncate">{preset.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Effects Controls */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 overflow-hidden">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-800/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-zinc-500" />
                  <span className="text-sm font-semibold text-zinc-300">Fine-Tune Effects</span>
                </div>
                {showAdvanced ? (
                  <ChevronUp className="w-4 h-4 text-zinc-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-zinc-500" />
                )}
              </button>

              {showAdvanced && (
                <div className="px-5 pb-5 space-y-5 border-t border-zinc-800 pt-4">
                  {/* Pitch & Speed */}
                  <div>
                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Pitch & Speed</p>
                    <div className="space-y-2">
                      <EffectSlider
                        label="Pitch"
                        value={effects.pitchShift}
                        min={-12}
                        max={12}
                        step={1}
                        unit=" st"
                        onChange={(v) => updateEffect('pitchShift', v)}
                      />
                      <EffectSlider
                        label="Speed"
                        value={effects.speed}
                        min={0.5}
                        max={2.0}
                        step={0.05}
                        unit="x"
                        onChange={(v) => updateEffect('speed', v)}
                      />
                    </div>
                  </div>

                  {/* Equalizer */}
                  <div>
                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Equalizer</p>
                    <div className="space-y-2">
                      <EffectSlider
                        label="Low (100Hz)"
                        value={effects.equalizer.low}
                        min={-12}
                        max={12}
                        step={1}
                        unit=" dB"
                        onChange={(v) => updateEffect('equalizer', { ...effects.equalizer, low: v })}
                      />
                      <EffectSlider
                        label="Mid (1kHz)"
                        value={effects.equalizer.mid}
                        min={-12}
                        max={12}
                        step={1}
                        unit=" dB"
                        onChange={(v) => updateEffect('equalizer', { ...effects.equalizer, mid: v })}
                      />
                      <EffectSlider
                        label="High (8kHz)"
                        value={effects.equalizer.high}
                        min={-12}
                        max={12}
                        step={1}
                        unit=" dB"
                        onChange={(v) => updateEffect('equalizer', { ...effects.equalizer, high: v })}
                      />
                    </div>
                  </div>

                  {/* Compressor */}
                  <div>
                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Compressor</p>
                    <div className="space-y-2">
                      <EffectSlider
                        label="Threshold"
                        value={effects.compressor.threshold}
                        min={-60}
                        max={0}
                        step={1}
                        unit=" dB"
                        onChange={(v) => updateEffect('compressor', { ...effects.compressor, threshold: v })}
                      />
                      <EffectSlider
                        label="Ratio"
                        value={effects.compressor.ratio}
                        min={1}
                        max={20}
                        step={0.5}
                        unit=":1"
                        onChange={(v) => updateEffect('compressor', { ...effects.compressor, ratio: v })}
                      />
                    </div>
                  </div>

                  {/* Reverb */}
                  <div>
                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Reverb</p>
                    <div className="space-y-2">
                      <EffectSlider
                        label="Mix"
                        value={effects.reverb.mix}
                        min={0}
                        max={1}
                        step={0.01}
                        onChange={(v) => updateEffect('reverb', { ...effects.reverb, mix: v })}
                      />
                      <EffectSlider
                        label="Decay"
                        value={effects.reverb.decay}
                        min={0.1}
                        max={5}
                        step={0.1}
                        unit="s"
                        onChange={(v) => updateEffect('reverb', { ...effects.reverb, decay: v })}
                      />
                    </div>
                  </div>

                  {/* Delay */}
                  <div>
                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Delay</p>
                    <div className="space-y-2">
                      <EffectSlider
                        label="Time"
                        value={effects.delay.time}
                        min={0}
                        max={1000}
                        step={10}
                        unit="ms"
                        onChange={(v) => updateEffect('delay', { ...effects.delay, time: v })}
                      />
                      <EffectSlider
                        label="Feedback"
                        value={effects.delay.feedback}
                        min={0}
                        max={0.9}
                        step={0.05}
                        onChange={(v) => updateEffect('delay', { ...effects.delay, feedback: v })}
                      />
                      <EffectSlider
                        label="Mix"
                        value={effects.delay.mix}
                        min={0}
                        max={1}
                        step={0.01}
                        onChange={(v) => updateEffect('delay', { ...effects.delay, mix: v })}
                      />
                    </div>
                  </div>

                  {/* Noise Gate */}
                  <div>
                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Noise Gate</p>
                    <EffectSlider
                      label="Threshold"
                      value={effects.noiseGateThreshold}
                      min={-100}
                      max={0}
                      step={1}
                      unit=" dB"
                      onChange={(v) => updateEffect('noiseGateThreshold', v)}
                    />
                  </div>

                  {/* Formant Shift */}
                  <div>
                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Formant Shift</p>
                    <EffectSlider
                      label="Shift"
                      value={effects.formantShift ?? 0}
                      min={-12}
                      max={12}
                      step={1}
                      unit=" st"
                      onChange={(v) => updateEffect('formantShift', v)}
                    />
                  </div>

                  {/* High-Pass Filter */}
                  <div>
                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">High-Pass Filter</p>
                    <EffectSlider
                      label="Cutoff"
                      value={effects.highPassFreq ?? 0}
                      min={0}
                      max={500}
                      step={10}
                      unit=" Hz"
                      onChange={(v) => updateEffect('highPassFreq', v)}
                    />
                  </div>

                  {/* De-Esser */}
                  <div>
                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">De-Esser</p>
                    <div className="space-y-2">
                      <EffectSlider
                        label="Threshold"
                        value={effects.deEsser?.threshold ?? -30}
                        min={-60}
                        max={0}
                        step={1}
                        unit=" dB"
                        onChange={(v) => updateEffect('deEsser', { ...(effects.deEsser ?? { threshold: -30, frequency: 6000, ratio: 3 }), threshold: v })}
                      />
                      <EffectSlider
                        label="Frequency"
                        value={effects.deEsser?.frequency ?? 6000}
                        min={3000}
                        max={10000}
                        step={100}
                        unit=" Hz"
                        onChange={(v) => updateEffect('deEsser', { ...(effects.deEsser ?? { threshold: -30, frequency: 6000, ratio: 3 }), frequency: v })}
                      />
                      <EffectSlider
                        label="Ratio"
                        value={effects.deEsser?.ratio ?? 3}
                        min={1}
                        max={10}
                        step={0.5}
                        unit=":1"
                        onChange={(v) => updateEffect('deEsser', { ...(effects.deEsser ?? { threshold: -30, frequency: 6000, ratio: 3 }), ratio: v })}
                      />
                    </div>
                  </div>

                  {/* Chorus */}
                  <div>
                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Chorus</p>
                    <div className="space-y-2">
                      <EffectSlider
                        label="Rate"
                        value={effects.chorus?.rate ?? 1}
                        min={0.1}
                        max={10}
                        step={0.1}
                        unit=" Hz"
                        onChange={(v) => updateEffect('chorus', { ...(effects.chorus ?? { rate: 1, depth: 5, mix: 0 }), rate: v })}
                      />
                      <EffectSlider
                        label="Depth"
                        value={effects.chorus?.depth ?? 5}
                        min={0}
                        max={20}
                        step={0.5}
                        unit="ms"
                        onChange={(v) => updateEffect('chorus', { ...(effects.chorus ?? { rate: 1, depth: 5, mix: 0 }), depth: v })}
                      />
                      <EffectSlider
                        label="Mix"
                        value={effects.chorus?.mix ?? 0}
                        min={0}
                        max={1}
                        step={0.01}
                        onChange={(v) => updateEffect('chorus', { ...(effects.chorus ?? { rate: 1, depth: 5, mix: 0 }), mix: v })}
                      />
                    </div>
                  </div>

                  {/* Distortion / Saturation */}
                  <div>
                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Distortion / Saturation</p>
                    <div className="space-y-2">
                      <EffectSlider
                        label="Amount"
                        value={effects.distortion?.amount ?? 0}
                        min={0}
                        max={100}
                        step={1}
                        onChange={(v) => updateEffect('distortion', { ...(effects.distortion ?? { amount: 0, tone: 8000, mix: 0 }), amount: v })}
                      />
                      <EffectSlider
                        label="Tone"
                        value={effects.distortion?.tone ?? 8000}
                        min={1000}
                        max={20000}
                        step={100}
                        unit=" Hz"
                        onChange={(v) => updateEffect('distortion', { ...(effects.distortion ?? { amount: 0, tone: 8000, mix: 0 }), tone: v })}
                      />
                      <EffectSlider
                        label="Mix"
                        value={effects.distortion?.mix ?? 0}
                        min={0}
                        max={1}
                        step={0.01}
                        onChange={(v) => updateEffect('distortion', { ...(effects.distortion ?? { amount: 0, tone: 8000, mix: 0 }), mix: v })}
                      />
                    </div>
                  </div>

                  {/* Output Limiter */}
                  <div>
                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Output Limiter</p>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-zinc-400 w-20 flex-shrink-0">Enabled</span>
                      <button
                        onClick={() => updateEffect('limiterEnabled', !effects.limiterEnabled)}
                        className={cn(
                          'relative w-10 h-5 rounded-full transition-colors',
                          effects.limiterEnabled ? 'bg-purple-500' : 'bg-zinc-700',
                        )}
                      >
                        <div
                          className={cn(
                            'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                            effects.limiterEnabled ? 'translate-x-5' : 'translate-x-0.5',
                          )}
                        />
                      </button>
                      <span className="text-xs text-zinc-500">
                        {effects.limiterEnabled ? 'On — prevents clipping' : 'Off'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Save Section */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Save className="w-4 h-4 text-zinc-500" />
                <h3 className="text-sm font-semibold text-zinc-300">Save as New Voice</h3>
              </div>
              <p className="text-xs text-zinc-500 mb-4">
                The processed audio will be submitted to ElevenLabs to create a new custom voice clone.
                This voice will appear in your Voice Library and can be used in video generation.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newVoiceName}
                  onChange={(e) => setNewVoiceName(e.target.value)}
                  placeholder="Name your new voice..."
                  className="flex-1 px-4 py-2.5 bg-zinc-800/80 border border-zinc-700 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
                <Button
                  onClick={() => { void handleSave(); }}
                  disabled={isSaving || !newVoiceName.trim()}
                  className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl px-6"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {isSaving ? 'Saving...' : 'Save Voice'}
                </Button>
              </div>

              {saveError && (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl mt-3">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <p className="text-xs text-red-400 flex-1">{saveError}</p>
                  <button onClick={() => setSaveError(null)} className="text-red-500 hover:text-red-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {saveSuccess && (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-xl mt-3">
                  <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <p className="text-xs text-green-400">Voice saved successfully! It will appear in your Voice Library.</p>
                </div>
              )}
            </div>

            {/* Back button */}
            <button
              onClick={() => {
                stopPlayback();
                setPhase('select');
                setSampleBuffer(null);
              }}
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              &larr; Back to voice selection
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
