'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, Square, Play, Pause, RotateCcw, Sparkles, Save,
  Trash2, MicOff, AlertCircle, CheckCircle2, Loader2,
  Settings2, BookOpen, ChevronDown, ChevronUp, Download,
  RotateCw,
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

// ─── Types & Constants ──────────────────────────────────────────────────────

type Phase = 'idle' | 'countdown' | 'recording' | 'recorded' | 'playing' | 'cloning';

const MAX_DURATION_S = 180;
const COUNTDOWN_FROM = 3;
const BAR_WIDTH = 3;
const BAR_GAP = 1;
const WAVEFORM_HEIGHT = 160;

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function extractPeaks(buffer: AudioBuffer, numBars: number): number[] {
  const data = buffer.getChannelData(0);
  const step = Math.floor(data.length / numBars);
  const peaks: number[] = [];
  for (let i = 0; i < numBars; i++) {
    let max = 0;
    const start = i * step;
    const end = Math.min(start + step, data.length);
    for (let j = start; j < end; j++) {
      const v = Math.abs(data[j]);
      if (v > max) { max = v; }
    }
    peaks.push(max);
  }
  return peaks;
}

// ─── Effects Slider Component ───────────────────────────────────────────────

interface EffectSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
  leftLabel?: string;
  rightLabel?: string;
  formatValue?: (v: number) => string;
}

function EffectSlider({
  label, value, min, max, step: stepVal, unit, onChange,
  leftLabel, rightLabel, formatValue,
}: EffectSliderProps) {
  const displayValue = formatValue ? formatValue(value) : `${value}${unit ?? ''}`;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs text-zinc-400">{label}</label>
        <span className="text-xs font-mono text-zinc-500">{displayValue}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={stepVal}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-purple-500 h-1.5"
      />
      {(leftLabel ?? rightLabel) && (
        <div className="flex justify-between text-[10px] text-zinc-600 mt-0.5">
          <span>{leftLabel ?? ''}</span>
          <span>{rightLabel ?? ''}</span>
        </div>
      )}
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export function VoiceRecorderStudio() {
  const authFetch = useAuthFetch();

  // State
  const [phase, setPhase] = useState<Phase>('idle');
  const [countdownNum, setCountdownNum] = useState(COUNTDOWN_FROM);
  const [duration, setDuration] = useState(0);
  const [level, setLevel] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [playProgress, setPlayProgress] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [cloneName, setCloneName] = useState('');
  const [cloneStatus, setCloneStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [cloneMessage, setCloneMessage] = useState('');
  const [showEffects, setShowEffects] = useState(false);
  const [effectSettings, setEffectSettings] = useState<VoiceEffectsSettings>({ ...DEFAULT_EFFECTS });
  const [selectedPreset, setSelectedPreset] = useState('Natural');
  const [isExporting, setIsExporting] = useState(false);
  const [decodedBuffer, setDecodedBuffer] = useState<AudioBuffer | null>(null);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement>(null);
  const staticCanvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef(0);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const levelsRef = useRef<number[]>([]);
  const playAnimRef = useRef(0);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const effectsPreviewRef = useRef<VoiceEffectsPreview>(new VoiceEffectsPreview());

  // ── Cleanup ─────────────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); }
    if (playAnimRef.current) { cancelAnimationFrame(playAnimRef.current); }
    if (timerRef.current) { clearInterval(timerRef.current); }
    if (countdownTimerRef.current) { clearInterval(countdownTimerRef.current); }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    effectsPreviewRef.current.stop();
    mediaRecorderRef.current = null;
    streamRef.current = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  // ── Live Waveform Rendering ─────────────────────────────────────────────

  const drawLiveWaveform = useCallback(() => {
    const canvas = liveCanvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) { return; }

    const ctx = canvas.getContext('2d');
    if (!ctx) { return; }

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteTimeDomainData(dataArray);

      // Calculate RMS level
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const v = (dataArray[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / dataArray.length);
      setLevel(rms);
      levelsRef.current.push(rms);

      const totalBarWidth = BAR_WIDTH + BAR_GAP;
      const maxBars = Math.floor(canvas.width / totalBarWidth);
      if (levelsRef.current.length > maxBars) {
        levelsRef.current = levelsRef.current.slice(-maxBars);
      }

      // Clear
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw bars from right to left (newest on right)
      const levels = levelsRef.current;
      const centerY = canvas.height / 2;

      for (let i = 0; i < levels.length; i++) {
        const x = canvas.width - (levels.length - i) * totalBarWidth;
        const amplitude = Math.max(levels[i] * 2, 0.02);
        const barH = amplitude * centerY * 0.9;

        const intensity = Math.min(amplitude * 3, 1);
        const r = Math.round(220 + intensity * 35);
        const g = Math.round(80 + intensity * 40);
        const b = Math.round(60);

        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(x, centerY - barH, BAR_WIDTH, barH * 2);
      }

      // Center line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(canvas.width, centerY);
      ctx.stroke();
    };

    draw();
  }, []);

  // ── Static Waveform Rendering ───────────────────────────────────────────

  const drawStaticWaveform = useCallback((peakData: number[], progress: number) => {
    const canvas = staticCanvasRef.current;
    if (!canvas) { return; }
    const ctx = canvas.getContext('2d');
    if (!ctx) { return; }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const totalBarWidth = BAR_WIDTH + BAR_GAP;
    const centerY = canvas.height / 2;
    const progressX = progress * canvas.width;

    for (let i = 0; i < peakData.length; i++) {
      const x = i * totalBarWidth;
      const amplitude = Math.max(peakData[i], 0.02);
      const barH = amplitude * centerY * 0.9;

      const isPast = x < progressX;
      if (isPast) {
        ctx.fillStyle = 'rgba(168, 85, 247, 0.9)';
      } else { ctx.fillStyle = 'rgba(113, 113, 122, 0.4)'; }

      ctx.fillRect(x, centerY - barH, BAR_WIDTH, barH * 2);
    }

    // Playhead
    if (progress > 0 && progress < 1) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillRect(progressX - 1, 0, 2, canvas.height);
    }

    // Center line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(canvas.width, centerY);
    ctx.stroke();
  }, []);

  useEffect(() => {
    if (phase === 'recorded' || phase === 'playing') {
      drawStaticWaveform(peaks, playProgress);
    }
  }, [peaks, playProgress, phase, drawStaticWaveform]);

  // ── Start Recording ─────────────────────────────────────────────────────

  const startCountdown = useCallback(async () => {
    setMicError(null);
    setCloneStatus('idle');
    setCloneMessage('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
        },
      });
      streamRef.current = stream;

      const ctx = new AudioContext({ sampleRate: 44100 });
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Countdown
      setPhase('countdown');
      setCountdownNum(COUNTDOWN_FROM);

      let count = COUNTDOWN_FROM;
      countdownTimerRef.current = setInterval(() => {
        count--;
        if (count <= 0) {
          if (countdownTimerRef.current) { clearInterval(countdownTimerRef.current); }
          beginRecording(stream);
        } else {
          setCountdownNum(count);
        }
      }, 1000);
    } catch {
      setMicError('Microphone access denied. Please allow microphone access in your browser settings.');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const beginRecording = useCallback((stream: MediaStream) => {
    chunksRef.current = [];
    levelsRef.current = [];
    setDuration(0);
    setPhase('recording');
    setAudioBlob(null);
    setAudioUrl(null);
    setPeaks([]);
    setPlayProgress(0);
    setDecodedBuffer(null);

    const recorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm',
    });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) { chunksRef.current.push(e.data); }
    };

    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const url = URL.createObjectURL(blob);
      setAudioBlob(blob);
      setAudioUrl(url);
      setPhase('recorded');

      // Extract peaks and decode buffer for effects processing
      try {
        const arrBuf = await blob.arrayBuffer();
        const offlineCtx = new AudioContext();
        const audioBuffer = await offlineCtx.decodeAudioData(arrBuf);
        setDecodedBuffer(audioBuffer);

        const canvas = staticCanvasRef.current;
        const numBars = canvas
          ? Math.floor(canvas.width / (BAR_WIDTH + BAR_GAP))
          : 200;
        setPeaks(extractPeaks(audioBuffer, numBars));
        void offlineCtx.close();
      } catch {
        // Fallback: use recorded levels as peaks
        const numBars = 200;
        const step = Math.max(1, Math.floor(levelsRef.current.length / numBars));
        const fallback: number[] = [];
        for (let i = 0; i < numBars; i++) {
          fallback.push(levelsRef.current[i * step] ?? 0);
        }
        setPeaks(fallback);
      }
    };

    recorder.start(100);

    // Timer
    let elapsed = 0;
    timerRef.current = setInterval(() => {
      elapsed++;
      setDuration(elapsed);
      if (elapsed >= MAX_DURATION_S) {
        stopRecording();
      }
    }, 1000);

    // Start live waveform
    drawLiveWaveform();
  }, [drawLiveWaveform]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Stop Recording ──────────────────────────────────────────────────────

  const stopRecording = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); }
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); }
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setLevel(0);
  }, []);

  // ── Playback with Effects ──────────────────────────────────────────────

  const startPlayback = useCallback(() => {
    if (!decodedBuffer) {
      // Fallback for if buffer wasn't decoded
      if (!audioUrl) { return; }
      const audio = new Audio(audioUrl);
      const pitchRatio = Math.pow(2, effectSettings.pitchShift / 12);
      audio.playbackRate = effectSettings.speed * pitchRatio;
      setPhase('playing');
      setPlayProgress(0);

      const updateProgress = () => {
        if (audio.duration) {
          setPlayProgress(audio.currentTime / audio.duration);
        }
        if (!audio.paused && !audio.ended) {
          playAnimRef.current = requestAnimationFrame(updateProgress);
        }
      };

      audio.onended = () => {
        setPhase('recorded');
        setPlayProgress(0);
      };

      audio.play().then(() => {
        playAnimRef.current = requestAnimationFrame(updateProgress);
      }).catch(() => {
        setPhase('recorded');
      });
      return;
    }

    // Use effects preview engine for real-time processed playback
    setPhase('playing');
    setPlayProgress(0);

    effectsPreviewRef.current.play(decodedBuffer, effectSettings, () => {
      setPhase('recorded');
      setPlayProgress(0);
    });

    // Update progress via animation frame
    const updateProgress = () => {
      const preview = effectsPreviewRef.current;
      if (preview.getIsPlaying() && decodedBuffer) {
        setPlayProgress(preview.getProgress(decodedBuffer.duration, effectSettings));
        playAnimRef.current = requestAnimationFrame(updateProgress);
      }
    };
    playAnimRef.current = requestAnimationFrame(updateProgress);
  }, [audioUrl, decodedBuffer, effectSettings]);

  const stopPlayback = useCallback(() => {
    effectsPreviewRef.current.stop();
    if (playAnimRef.current) { cancelAnimationFrame(playAnimRef.current); }
    setPhase('recorded');
    setPlayProgress(0);
  }, []);

  // ── Export with Effects ────────────────────────────────────────────────

  const handleExportWithEffects = useCallback(async () => {
    if (!decodedBuffer) { return; }
    setIsExporting(true);
    try {
      const blob = await exportProcessed(decodedBuffer, effectSettings);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cloneName.trim() || 'voice-recording'}-processed.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Export error — user can retry
    } finally {
      setIsExporting(false);
    }
  }, [decodedBuffer, effectSettings, cloneName]);

  // ── Discard ─────────────────────────────────────────────────────────────

  const discard = useCallback(() => {
    cleanup();
    if (audioUrl) { URL.revokeObjectURL(audioUrl); }
    setPhase('idle');
    setAudioBlob(null);
    setAudioUrl(null);
    setPeaks([]);
    setPlayProgress(0);
    setDuration(0);
    setLevel(0);
    setDecodedBuffer(null);
    levelsRef.current = [];
  }, [audioUrl, cleanup]);

  // ── Clone Voice ─────────────────────────────────────────────────────────

  const handleClone = useCallback(async () => {
    if (!audioBlob || !cloneName.trim()) { return; }

    setCloneStatus('loading');
    setCloneMessage('');

    try {
      const formData = new FormData();
      formData.append('name', cloneName.trim());
      formData.append('samples', audioBlob, 'voice-recording.webm');

      const res = await authFetch('/api/video/voice-clone', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json() as {
        success: boolean;
        voiceId?: string;
        voiceName?: string;
        error?: string;
      };

      if (!data.success) {
        setCloneStatus('error');
        setCloneMessage(data.error ?? 'Clone failed');
        return;
      }

      setCloneStatus('success');
      setCloneMessage(`Voice "${data.voiceName}" created! It's now available in your voice library and video pipeline.`);
    } catch {
      setCloneStatus('error');
      setCloneMessage('Failed to clone voice. Try again.');
    }
  }, [audioBlob, cloneName, authFetch]);

  // ── Save Recording ──────────────────────────────────────────────────────

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const handleSave = useCallback(async () => {
    if (!audioBlob) { return; }
    setSaveStatus('saving');

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1] ?? '');
        };
        reader.readAsDataURL(audioBlob);
      });
      const base64 = await base64Promise;

      const res = await authFetch('/api/audio/recordings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cloneName.trim() || `Recording ${new Date().toLocaleDateString()}`,
          base64,
          contentType: audioBlob.type,
          duration,
        }),
      });

      const data = await res.json() as { success: boolean };
      if (data.success) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    } catch {
      setSaveStatus('idle');
    }
  }, [audioBlob, cloneName, duration, authFetch]);

  // ── Effect Settings Updaters ──────────────────────────────────────────

  const updateEffect = useCallback(<K extends keyof VoiceEffectsSettings>(
    key: K,
    value: VoiceEffectsSettings[K],
  ) => {
    setEffectSettings((prev) => ({ ...prev, [key]: value }));
    setSelectedPreset(''); // Clear preset when manually adjusting
  }, []);

  const updateEq = useCallback((band: keyof VoiceEffectsSettings['equalizer'], value: number) => {
    setEffectSettings((prev) => ({
      ...prev,
      equalizer: { ...prev.equalizer, [band]: value },
    }));
    setSelectedPreset('');
  }, []);

  const updateCompressor = useCallback((param: keyof VoiceEffectsSettings['compressor'], value: number) => {
    setEffectSettings((prev) => ({
      ...prev,
      compressor: { ...prev.compressor, [param]: value },
    }));
    setSelectedPreset('');
  }, []);

  const updateReverb = useCallback((param: keyof VoiceEffectsSettings['reverb'], value: number) => {
    setEffectSettings((prev) => ({
      ...prev,
      reverb: { ...prev.reverb, [param]: value },
    }));
    setSelectedPreset('');
  }, []);

  const updateDelay = useCallback((param: keyof VoiceEffectsSettings['delay'], value: number) => {
    setEffectSettings((prev) => ({
      ...prev,
      delay: { ...prev.delay, [param]: value },
    }));
    setSelectedPreset('');
  }, []);

  const applyPreset = useCallback((preset: EffectPreset) => {
    setEffectSettings({ ...preset.settings });
    setSelectedPreset(preset.name);
  }, []);

  const resetAllEffects = useCallback(() => {
    setEffectSettings({ ...DEFAULT_EFFECTS });
    setSelectedPreset('Natural');
  }, []);

  // ── Canvas Resize ───────────────────────────────────────────────────────

  useEffect(() => {
    const resizeCanvas = (canvas: HTMLCanvasElement | null) => {
      if (!canvas) { return; }
      const parent = canvas.parentElement;
      if (!parent) { return; }
      const dpr = window.devicePixelRatio || 1;
      canvas.width = parent.clientWidth * dpr;
      canvas.height = WAVEFORM_HEIGHT * dpr;
      canvas.style.width = `${parent.clientWidth}px`;
      canvas.style.height = `${WAVEFORM_HEIGHT}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) { ctx.scale(dpr, dpr); }
    };

    resizeCanvas(liveCanvasRef.current);
    resizeCanvas(staticCanvasRef.current);

    const handler = () => {
      resizeCanvas(liveCanvasRef.current);
      resizeCanvas(staticCanvasRef.current);
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────

  const isRecordingOrCountdown = phase === 'recording' || phase === 'countdown';
  const hasRecording = phase === 'recorded' || phase === 'playing';

  return (
    <div className="space-y-6">
      {/* Main Studio Card */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80 backdrop-blur">
        {/* Ambient glow */}
        {phase === 'recording' && (
          <div className="absolute inset-0 bg-red-500/5 animate-pulse pointer-events-none" />
        )}

        <div className="p-6">
          {/* Title Row */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Mic className={cn(
                'w-5 h-5',
                phase === 'recording' ? 'text-red-400' : 'text-purple-400',
              )} />
              <h2 className="text-lg font-semibold text-white">Recording Studio</h2>
            </div>
            {phase === 'recording' && (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs font-mono text-red-400">REC</span>
              </div>
            )}
          </div>

          {/* Waveform Area */}
          <div className="relative rounded-xl bg-zinc-950/60 border border-zinc-800/50 overflow-hidden mb-6">
            {/* Live waveform (recording) */}
            <canvas
              ref={liveCanvasRef}
              className={cn(
                'w-full transition-opacity duration-300',
                isRecordingOrCountdown ? 'opacity-100' : 'opacity-0 absolute inset-0',
              )}
              style={{ height: WAVEFORM_HEIGHT }}
            />

            {/* Static waveform (playback) */}
            <canvas
              ref={staticCanvasRef}
              className={cn(
                'w-full transition-opacity duration-300',
                hasRecording ? 'opacity-100' : 'opacity-0 absolute inset-0',
              )}
              style={{ height: WAVEFORM_HEIGHT }}
            />

            {/* Idle state */}
            {phase === 'idle' && (
              <div
                className="flex flex-col items-center justify-center text-zinc-600"
                style={{ height: WAVEFORM_HEIGHT }}
              >
                <AudioWaveformIcon className="w-12 h-12 mb-2 opacity-30" />
                <p className="text-sm">Click Record to begin</p>
              </div>
            )}

            {/* Countdown overlay */}
            <AnimatePresence>
              {phase === 'countdown' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm"
                >
                  <motion.span
                    key={countdownNum}
                    initial={{ scale: 2, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    className="text-6xl font-bold text-white"
                  >
                    {countdownNum}
                  </motion.span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Timer & Level Meter */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              {/* Timer */}
              <span className={cn(
                'text-2xl font-mono tabular-nums',
                phase === 'recording' ? 'text-red-400' : 'text-white',
              )}>
                {formatTime(duration)}
              </span>
              <span className="text-sm text-zinc-600">/ {formatTime(MAX_DURATION_S)}</span>
            </div>

            {/* Level Meter */}
            {(phase === 'recording' || phase === 'countdown') && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Level</span>
                <div className="w-32 h-3 rounded-full bg-zinc-800 overflow-hidden">
                  <motion.div
                    className={cn(
                      'h-full rounded-full transition-colors',
                      level > 0.6 ? 'bg-red-500' : level > 0.3 ? 'bg-amber-500' : 'bg-green-500',
                    )}
                    animate={{ width: `${Math.min(level * 300, 100)}%` }}
                    transition={{ duration: 0.05 }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4">
            {phase === 'idle' && (
              <Button
                size="lg"
                onClick={() => { void startCountdown(); }}
                className="gap-2 bg-red-600 hover:bg-red-700 text-white rounded-full px-8 h-14 text-base shadow-lg shadow-red-500/20"
              >
                <Mic className="w-5 h-5" />
                Record
              </Button>
            )}

            {phase === 'recording' && (
              <Button
                size="lg"
                onClick={stopRecording}
                className="gap-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-full px-8 h-14 text-base"
              >
                <Square className="w-4 h-4 fill-current" />
                Stop
              </Button>
            )}

            {phase === 'recorded' && (
              <>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={discard}
                  className="gap-2 border-zinc-700 text-zinc-400 hover:text-red-400 hover:border-red-500/30 rounded-full"
                >
                  <Trash2 className="w-4 h-4" />
                  Discard
                </Button>
                <Button
                  size="lg"
                  onClick={startPlayback}
                  className="gap-2 bg-purple-600 hover:bg-purple-700 text-white rounded-full px-8 h-14 text-base shadow-lg shadow-purple-500/20"
                >
                  <Play className="w-5 h-5" />
                  Play
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => { void startCountdown(); }}
                  className="gap-2 border-zinc-700 text-zinc-400 hover:text-white rounded-full"
                >
                  <RotateCcw className="w-4 h-4" />
                  Re-record
                </Button>
              </>
            )}

            {phase === 'playing' && (
              <Button
                size="lg"
                onClick={stopPlayback}
                className="gap-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-full px-8 h-14 text-base"
              >
                <Pause className="w-5 h-5" />
                Stop
              </Button>
            )}
          </div>

          {/* Mic Error */}
          {micError && (
            <div className="mt-4 flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <MicOff className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-400">{micError}</p>
            </div>
          )}
        </div>
      </div>

      {/* Post-Recording Actions */}
      {hasRecording && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Effects Panel */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
            <button
              onClick={() => setShowEffects(!showEffects)}
              className="flex items-center gap-2 text-sm font-medium text-zinc-300 mb-2 w-full text-left"
            >
              <Settings2 className="w-4 h-4 text-purple-400" />
              Voice Effects
              {showEffects ? (
                <ChevronUp className="w-3.5 h-3.5 text-zinc-500 ml-auto" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-zinc-500 ml-auto" />
              )}
            </button>

            {showEffects && (
              <div className="space-y-5 mt-4">
                {/* Presets Row */}
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5 uppercase tracking-wider">Presets</label>
                  <div className="flex flex-wrap gap-1.5">
                    {EFFECT_PRESETS.map((preset) => (
                      <button
                        key={preset.name}
                        onClick={() => applyPreset(preset)}
                        title={preset.description}
                        className={cn(
                          'px-2.5 py-1 rounded-md text-xs font-medium transition-colors border',
                          selectedPreset === preset.name
                            ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                            : 'bg-zinc-800/50 text-zinc-400 border-zinc-700/50 hover:border-zinc-600',
                        )}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Equalizer */}
                <div>
                  <label className="block text-xs text-zinc-500 mb-2 uppercase tracking-wider">Equalizer</label>
                  <div className="grid grid-cols-3 gap-3">
                    <EffectSlider
                      label="Low (100Hz)"
                      value={effectSettings.equalizer.low}
                      min={-12} max={12} step={1} unit="dB"
                      onChange={(v) => updateEq('low', v)}
                    />
                    <EffectSlider
                      label="Mid (1kHz)"
                      value={effectSettings.equalizer.mid}
                      min={-12} max={12} step={1} unit="dB"
                      onChange={(v) => updateEq('mid', v)}
                    />
                    <EffectSlider
                      label="High (8kHz)"
                      value={effectSettings.equalizer.high}
                      min={-12} max={12} step={1} unit="dB"
                      onChange={(v) => updateEq('high', v)}
                    />
                  </div>
                </div>

                {/* Compressor */}
                <div>
                  <label className="block text-xs text-zinc-500 mb-2 uppercase tracking-wider">Compressor</label>
                  <div className="grid grid-cols-2 gap-3">
                    <EffectSlider
                      label="Threshold"
                      value={effectSettings.compressor.threshold}
                      min={-60} max={0} step={1} unit="dB"
                      onChange={(v) => updateCompressor('threshold', v)}
                    />
                    <EffectSlider
                      label="Ratio"
                      value={effectSettings.compressor.ratio}
                      min={1} max={20} step={0.5}
                      formatValue={(v) => `${v}:1`}
                      onChange={(v) => updateCompressor('ratio', v)}
                    />
                    <EffectSlider
                      label="Attack"
                      value={effectSettings.compressor.attack}
                      min={0.001} max={1} step={0.001}
                      formatValue={(v) => `${(v * 1000).toFixed(0)}ms`}
                      onChange={(v) => updateCompressor('attack', v)}
                    />
                    <EffectSlider
                      label="Release"
                      value={effectSettings.compressor.release}
                      min={0.01} max={1} step={0.01}
                      formatValue={(v) => `${(v * 1000).toFixed(0)}ms`}
                      onChange={(v) => updateCompressor('release', v)}
                    />
                  </div>
                </div>

                {/* Pitch & Speed */}
                <div>
                  <label className="block text-xs text-zinc-500 mb-2 uppercase tracking-wider">Pitch & Speed</label>
                  <div className="grid grid-cols-2 gap-3">
                    <EffectSlider
                      label="Pitch Shift"
                      value={effectSettings.pitchShift}
                      min={-12} max={12} step={1}
                      formatValue={(v) => `${v > 0 ? '+' : ''}${v} st`}
                      onChange={(v) => updateEffect('pitchShift', v)}
                      leftLabel="-12" rightLabel="+12"
                    />
                    <EffectSlider
                      label="Speed"
                      value={effectSettings.speed}
                      min={0.5} max={2.0} step={0.05}
                      formatValue={(v) => `${v.toFixed(2)}x`}
                      onChange={(v) => updateEffect('speed', v)}
                      leftLabel="Slow" rightLabel="Fast"
                    />
                  </div>
                </div>

                {/* Reverb */}
                <div>
                  <label className="block text-xs text-zinc-500 mb-2 uppercase tracking-wider">Reverb</label>
                  <div className="grid grid-cols-2 gap-3">
                    <EffectSlider
                      label="Mix"
                      value={effectSettings.reverb.mix}
                      min={0} max={1} step={0.01}
                      formatValue={(v) => `${Math.round(v * 100)}%`}
                      onChange={(v) => updateReverb('mix', v)}
                      leftLabel="Dry" rightLabel="Wet"
                    />
                    <EffectSlider
                      label="Decay"
                      value={effectSettings.reverb.decay}
                      min={0.1} max={5} step={0.1}
                      formatValue={(v) => `${v.toFixed(1)}s`}
                      onChange={(v) => updateReverb('decay', v)}
                      leftLabel="Short" rightLabel="Long"
                    />
                  </div>
                </div>

                {/* Delay */}
                <div>
                  <label className="block text-xs text-zinc-500 mb-2 uppercase tracking-wider">Delay</label>
                  <div className="grid grid-cols-3 gap-3">
                    <EffectSlider
                      label="Time"
                      value={effectSettings.delay.time}
                      min={0} max={1000} step={10}
                      formatValue={(v) => `${v}ms`}
                      onChange={(v) => updateDelay('time', v)}
                    />
                    <EffectSlider
                      label="Feedback"
                      value={effectSettings.delay.feedback}
                      min={0} max={0.9} step={0.05}
                      formatValue={(v) => `${Math.round(v * 100)}%`}
                      onChange={(v) => updateDelay('feedback', v)}
                    />
                    <EffectSlider
                      label="Mix"
                      value={effectSettings.delay.mix}
                      min={0} max={1} step={0.01}
                      formatValue={(v) => `${Math.round(v * 100)}%`}
                      onChange={(v) => updateDelay('mix', v)}
                    />
                  </div>
                </div>

                {/* Noise Gate */}
                <div>
                  <label className="block text-xs text-zinc-500 mb-2 uppercase tracking-wider">Noise Gate</label>
                  <EffectSlider
                    label="Threshold"
                    value={effectSettings.noiseGateThreshold}
                    min={-100} max={0} step={1} unit="dB"
                    onChange={(v) => updateEffect('noiseGateThreshold', v)}
                    leftLabel="Off" rightLabel="Aggressive"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2 border-t border-zinc-800/50">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetAllEffects}
                    className="gap-1.5 border-zinc-700 text-zinc-400 text-xs"
                  >
                    <RotateCw className="w-3 h-3" />
                    Reset All
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => { void handleExportWithEffects(); }}
                    disabled={isExporting || !decodedBuffer}
                    className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs flex-1"
                  >
                    {isExporting ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Download className="w-3 h-3" />
                    )}
                    {isExporting ? 'Exporting...' : 'Export with Effects'}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Clone & Save Panel */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
              <Sparkles className="w-4 h-4 text-purple-400" />
              Use This Recording
            </div>

            <input
              type="text"
              value={cloneName}
              onChange={(e) => setCloneName(e.target.value)}
              placeholder="Name (e.g. David's Voice)"
              className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />

            <div className="flex gap-2">
              <Button
                onClick={() => { void handleClone(); }}
                disabled={cloneStatus === 'loading' || !cloneName.trim()}
                className="gap-2 bg-purple-600 hover:bg-purple-700 text-white flex-1"
              >
                {cloneStatus === 'loading' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Clone My Voice
              </Button>
              <Button
                variant="outline"
                onClick={() => { void handleSave(); }}
                disabled={saveStatus === 'saving'}
                className="gap-2 border-zinc-700 text-zinc-300"
              >
                {saveStatus === 'saving' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : saveStatus === 'saved' ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saveStatus === 'saved' ? 'Saved!' : 'Save'}
              </Button>
            </div>

            {/* Clone Status Messages */}
            {cloneStatus === 'success' && (
              <div className="flex items-start gap-2 px-3 py-2.5 bg-green-500/10 border border-green-500/20 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-green-400">{cloneMessage}</p>
              </div>
            )}
            {cloneStatus === 'error' && (
              <div className="flex items-start gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-400">{cloneMessage}</p>
              </div>
            )}

            <p className="text-[10px] text-zinc-600">
              Clone creates an ElevenLabs voice from your recording. Use it in video avatars, voice agents, and AI music.
            </p>
          </div>
        </div>
      )}

      {/* Guided Script & Tips */}
      <GuidedRecordingScript isRecording={phase === 'recording'} isIdle={phase === 'idle'} />
    </div>
  );
}

// ─── Guided Recording Script ────────────────────────────────────────────────

const VOICE_CLONE_SCRIPT = [
  {
    section: 'Natural Conversation',
    lines: [
      'Hello, my name is... and I work at... Today I want to talk to you about something that really matters.',
      'You know, when I first started in this industry, I had no idea how much things would change.',
      "But here's the thing — the companies that adapt are the ones that win. And that's exactly what we help you do.",
    ],
  },
  {
    section: 'Excitement & Energy',
    lines: [
      "I'm incredibly excited to share this with you! This is going to change everything about how you do business.",
      "Can you believe we just hit our biggest milestone yet? That's right — and we're just getting started!",
      "Wow, the results are absolutely amazing. Our clients are seeing a three hundred percent increase in conversions!",
    ],
  },
  {
    section: 'Authority & Confidence',
    lines: [
      'Let me be very clear about this. Our platform delivers real, measurable results. Period.',
      'We have worked with over five hundred companies across thirty-seven industries, and the data speaks for itself.',
      'This is not just another tool. This is a complete transformation of how businesses operate.',
    ],
  },
  {
    section: 'Empathy & Understanding',
    lines: [
      "I completely understand your concern. Many of our clients felt the same way before they saw the results.",
      "Look, I know this is a big decision. That's why we make it easy for you to get started with zero risk.",
      "We've been in your shoes. We know what it's like to feel overwhelmed by all the options out there.",
    ],
  },
  {
    section: 'Questions & Pauses',
    lines: [
      'So what does this mean for your business? Well... let me show you exactly what I mean.',
      'Have you ever wondered why some companies grow ten times faster than others? The answer might surprise you.',
      "Ready to see this in action? Great — let's dive in.",
    ],
  },
  {
    section: 'Numbers & Technical',
    lines: [
      'The ROI is one thousand two hundred forty-seven percent. Our API processes over fifty thousand requests per second.',
      'Plans start at just forty-nine dollars per month, or three hundred ninety-nine dollars annually — saving you two hundred dollars.',
      'Schedule a call at www dot sales velocity dot ai, or email us at hello at salesvelocity dot ai.',
    ],
  },
];

function GuidedRecordingScript({ isRecording, isIdle }: { isRecording: boolean; isIdle: boolean }) {
  const [showScript, setShowScript] = useState(false);
  const [showTips, setShowTips] = useState(true);

  return (
    <div className="space-y-4">
      {/* Tips (shown when idle) */}
      {isIdle && showTips && (
        <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/30 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-zinc-400">Before You Record</h3>
            <button onClick={() => setShowTips(false)} className="text-xs text-zinc-600 hover:text-zinc-400">
              Hide
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { title: 'Environment', tip: 'Quiet room, no echo. Close windows and doors. Avoid fans or AC noise.' },
              { title: 'Microphone', tip: '6-12 inches from mic. A headset or USB mic gives the best results.' },
              { title: 'The Script', tip: 'Read the guided script below while recording. It covers all inflections needed for a lifelike voice clone.' },
            ].map((item) => (
              <div key={item.title} className="px-3 py-2.5 bg-zinc-800/30 rounded-lg">
                <p className="text-xs font-medium text-zinc-300 mb-1">{item.title}</p>
                <p className="text-[11px] text-zinc-500 leading-relaxed">{item.tip}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Guided Script Teleprompter */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
        <button
          onClick={() => setShowScript(!showScript)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-zinc-800/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <BookOpen className={cn(
              'w-4 h-4',
              isRecording ? 'text-red-400' : 'text-amber-400',
            )} />
            <span className="text-sm font-medium text-zinc-300">
              {isRecording ? 'Read This Script While Recording' : 'Voice Clone Script'}
            </span>
            <span className="text-[10px] text-zinc-600 ml-1">
              Designed to capture all inflections for a lifelike clone
            </span>
          </div>
          {showScript ? (
            <ChevronUp className="w-4 h-4 text-zinc-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-zinc-500" />
          )}
        </button>

        {showScript && (
          <div className="px-5 pb-5 space-y-5 border-t border-zinc-800/50">
            <p className="text-[11px] text-zinc-500 pt-3">
              Read each section naturally. Vary your pace and energy to match the mood described.
              Replace the &ldquo;...&rdquo; with your own name/company. Aim for 60-90 seconds total.
            </p>

            {VOICE_CLONE_SCRIPT.map((section) => (
              <div key={section.section}>
                <h4 className={cn(
                  'text-xs font-semibold uppercase tracking-wider mb-2',
                  isRecording ? 'text-red-400/70' : 'text-amber-500/70',
                )}>
                  {section.section}
                </h4>
                <div className="space-y-2">
                  {section.lines.map((line, i) => (
                    <p
                      key={i}
                      className={cn(
                        'text-sm leading-relaxed pl-3 border-l-2',
                        isRecording
                          ? 'text-zinc-200 border-red-500/30'
                          : 'text-zinc-400 border-zinc-700/50',
                      )}
                    >
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            ))}

            <div className="pt-2 border-t border-zinc-800/50">
              <p className="text-[10px] text-zinc-600">
                This script covers: natural conversation, excitement, authority, empathy, questioning pauses,
                numbers, URLs, and abbreviations. All of these inflection patterns are needed to create a
                voice that sounds natural across different contexts — marketing videos, phone calls, presentations.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Simple waveform icon for idle state
function AudioWaveformIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="8" y1="18" x2="8" y2="30" />
      <line x1="14" y1="12" x2="14" y2="36" />
      <line x1="20" y1="8" x2="20" y2="40" />
      <line x1="26" y1="14" x2="26" y2="34" />
      <line x1="32" y1="10" x2="32" y2="38" />
      <line x1="38" y1="16" x2="38" y2="32" />
    </svg>
  );
}
