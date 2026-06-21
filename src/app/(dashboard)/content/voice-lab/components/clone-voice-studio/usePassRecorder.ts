'use client';

/**
 * usePassRecorder — a focused microphone recorder for the Clone Voice Studio.
 *
 * Reuses the proven recording approach from VoiceRecorderStudio:
 *   - navigator.mediaDevices.getUserMedia with echo-cancel / noise-suppress / AGC
 *   - MediaRecorder writing opus-in-webm chunks
 *   - an AnalyserNode driving a live RMS level meter
 *   - a one-second elapsed timer
 *
 * It is deliberately single-purpose (record one pass → get one Blob) so the
 * studio can own two independent recorders, one per capture pass.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type RecorderStatus = 'idle' | 'recording' | 'recorded';

export interface PassRecording {
  blob: Blob;
  url: string;
  durationSeconds: number;
}

export interface UsePassRecorderResult {
  status: RecorderStatus;
  /** Live microphone level, 0..1 (RMS). Only meaningful while recording. */
  level: number;
  /** Whole seconds elapsed in the current / last take. */
  elapsedSeconds: number;
  /** The finished recording, or null until a take completes. */
  recording: PassRecording | null;
  /** A plain-English microphone error, or null. */
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  /** Clear the current recording so the operator can record again. */
  reset: () => void;
}

const MIC_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 44_100,
  },
};

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') {
    return 'audio/webm';
  }
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
    return 'audio/webm;codecs=opus';
  }
  return 'audio/webm';
}

export function usePassRecorder(): UsePassRecorderResult {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [level, setLevel] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [recording, setRecording] = useState<PassRecording | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const animFrameRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);
  const lastUrlRef = useRef<string | null>(null);

  const teardownStream = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    setLevel(0);
  }, []);

  // Tear everything down on unmount and revoke any object URL we created.
  useEffect(() => {
    return () => {
      teardownStream();
      recorderRef.current = null;
      if (lastUrlRef.current) {
        URL.revokeObjectURL(lastUrlRef.current);
        lastUrlRef.current = null;
      }
    };
  }, [teardownStream]);

  const runLevelMeter = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) {
      return;
    }
    const buffer = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      const node = analyserRef.current;
      if (!node) {
        return;
      }
      node.getByteTimeDomainData(buffer);
      let sum = 0;
      for (let i = 0; i < buffer.length; i += 1) {
        const v = (buffer[i] - 128) / 128;
        sum += v * v;
      }
      setLevel(Math.sqrt(sum / buffer.length));
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
  }, []);

  const start = useCallback(async () => {
    setError(null);

    // Clear any previous take before starting a fresh one.
    if (lastUrlRef.current) {
      URL.revokeObjectURL(lastUrlRef.current);
      lastUrlRef.current = null;
    }
    setRecording(null);
    setElapsedSeconds(0);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);
    } catch {
      setError(
        'We could not reach your microphone. Allow microphone access in your browser, then try again.',
      );
      return;
    }
    streamRef.current = stream;

    try {
      const ctx = new AudioContext({ sampleRate: 44_100 });
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2_048;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;
    } catch {
      // The level meter is a nicety — if the AudioContext fails we still record.
      analyserRef.current = null;
    }

    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType: pickMimeType() });
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const url = URL.createObjectURL(blob);
      lastUrlRef.current = url;
      const durationSeconds = Math.max(
        0,
        Math.round((Date.now() - startedAtRef.current) / 1_000),
      );
      setRecording({ blob, url, durationSeconds });
      setElapsedSeconds(durationSeconds);
      setStatus('recorded');
      teardownStream();
    };

    startedAtRef.current = Date.now();
    recorder.start(100);
    setStatus('recording');

    timerRef.current = setInterval(() => {
      setElapsedSeconds(Math.round((Date.now() - startedAtRef.current) / 1_000));
    }, 1_000);

    runLevelMeter();
  }, [runLevelMeter, teardownStream]);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
  }, []);

  const reset = useCallback(() => {
    if (lastUrlRef.current) {
      URL.revokeObjectURL(lastUrlRef.current);
      lastUrlRef.current = null;
    }
    setRecording(null);
    setElapsedSeconds(0);
    setStatus('idle');
    setError(null);
  }, []);

  return {
    status,
    level,
    elapsedSeconds,
    recording,
    error,
    start,
    stop,
    reset,
  };
}
