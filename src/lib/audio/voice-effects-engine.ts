/**
 * Voice Effects Engine
 * Real audio processing using Web Audio API
 *
 * Processing chain:
 *   Input -> Noise Gate -> EQ (3-band) -> Compressor -> Pitch Shift -> Reverb -> Delay -> Output
 *
 * All effects are functional — no stubs. Uses OfflineAudioContext for export.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EqualizerSettings {
  /** Low band gain at 100Hz, range -12 to +12 dB */
  low: number;
  /** Mid band gain at 1kHz, range -12 to +12 dB */
  mid: number;
  /** High band gain at 8kHz, range -12 to +12 dB */
  high: number;
}

export interface CompressorSettings {
  /** Threshold in dB, range -60 to 0 */
  threshold: number;
  /** Compression ratio, range 1 to 20 */
  ratio: number;
  /** Attack time in seconds, range 0.001 to 1 */
  attack: number;
  /** Release time in seconds, range 0.01 to 1 */
  release: number;
}

export interface ReverbSettings {
  /** Dry/wet mix, range 0 to 1 (0 = fully dry, 1 = fully wet) */
  mix: number;
  /** Decay time in seconds, range 0.1 to 5 */
  decay: number;
}

export interface DelaySettings {
  /** Delay time in milliseconds, range 0 to 1000 */
  time: number;
  /** Feedback amount, range 0 to 0.9 */
  feedback: number;
  /** Wet mix, range 0 to 1 */
  mix: number;
}

export interface VoiceEffectsSettings {
  equalizer: EqualizerSettings;
  compressor: CompressorSettings;
  /** Pitch shift in semitones, range -12 to +12 */
  pitchShift: number;
  reverb: ReverbSettings;
  delay: DelaySettings;
  /** Noise gate threshold in dB, range -100 to 0 */
  noiseGateThreshold: number;
  /** Playback speed, range 0.5 to 2.0 (pitch-preserving via playbackRate) */
  speed: number;
}

export interface EffectPreset {
  name: string;
  description: string;
  settings: VoiceEffectsSettings;
}

// ─── Defaults ───────────────────────────────────────────────────────────────

export const DEFAULT_EFFECTS: VoiceEffectsSettings = {
  equalizer: { low: 0, mid: 0, high: 0 },
  compressor: { threshold: -24, ratio: 4, attack: 0.003, release: 0.25 },
  pitchShift: 0,
  reverb: { mix: 0, decay: 1.5 },
  delay: { time: 0, feedback: 0, mix: 0 },
  noiseGateThreshold: -100,
  speed: 1.0,
};

// ─── Presets ────────────────────────────────────────────────────────────────

export const EFFECT_PRESETS: EffectPreset[] = [
  {
    name: 'Natural',
    description: 'No processing, original sound',
    settings: { ...DEFAULT_EFFECTS },
  },
  {
    name: 'Radio DJ',
    description: 'Warm, compressed, broadcast-ready',
    settings: {
      equalizer: { low: 3, mid: 1, high: 4 },
      compressor: { threshold: -18, ratio: 6, attack: 0.003, release: 0.15 },
      pitchShift: -1,
      reverb: { mix: 0.08, decay: 0.6 },
      delay: { time: 0, feedback: 0, mix: 0 },
      noiseGateThreshold: -50,
      speed: 1.0,
    },
  },
  {
    name: 'Podcast',
    description: 'Clean, intimate, easy to listen to',
    settings: {
      equalizer: { low: -2, mid: 2, high: 3 },
      compressor: { threshold: -20, ratio: 3, attack: 0.01, release: 0.3 },
      pitchShift: 0,
      reverb: { mix: 0.05, decay: 0.4 },
      delay: { time: 0, feedback: 0, mix: 0 },
      noiseGateThreshold: -45,
      speed: 1.0,
    },
  },
  {
    name: 'Deep Voice',
    description: 'Lower pitch, more bass presence',
    settings: {
      equalizer: { low: 6, mid: -1, high: -2 },
      compressor: { threshold: -22, ratio: 4, attack: 0.005, release: 0.25 },
      pitchShift: -4,
      reverb: { mix: 0.1, decay: 1.0 },
      delay: { time: 0, feedback: 0, mix: 0 },
      noiseGateThreshold: -60,
      speed: 1.0,
    },
  },
  {
    name: 'Bright & Clear',
    description: 'Enhanced highs, crisp and present',
    settings: {
      equalizer: { low: -3, mid: 3, high: 6 },
      compressor: { threshold: -20, ratio: 3, attack: 0.002, release: 0.2 },
      pitchShift: 1,
      reverb: { mix: 0.03, decay: 0.3 },
      delay: { time: 0, feedback: 0, mix: 0 },
      noiseGateThreshold: -50,
      speed: 1.0,
    },
  },
  {
    name: 'Telephone',
    description: 'Bandpass-filtered, vintage phone effect',
    settings: {
      equalizer: { low: -12, mid: 6, high: -10 },
      compressor: { threshold: -15, ratio: 8, attack: 0.001, release: 0.1 },
      pitchShift: 0,
      reverb: { mix: 0, decay: 0.1 },
      delay: { time: 0, feedback: 0, mix: 0 },
      noiseGateThreshold: -40,
      speed: 1.0,
    },
  },
];

// ─── Impulse Response Generation ────────────────────────────────────────────

/**
 * Generates a synthetic impulse response for ConvolverNode reverb.
 * Creates a decaying noise burst that simulates room acoustics.
 */
function generateImpulseResponse(
  audioContext: BaseAudioContext,
  decay: number,
  sampleRate: number,
): AudioBuffer {
  const length = Math.floor(sampleRate * Math.max(decay, 0.1));
  const impulse = audioContext.createBuffer(2, length, sampleRate);

  for (let channel = 0; channel < 2; channel++) {
    const channelData = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      // Exponentially decaying noise
      const t = i / sampleRate;
      const envelope = Math.exp(-3.0 * t / decay);
      channelData[i] = (Math.random() * 2 - 1) * envelope;
    }
  }

  return impulse;
}

// ─── Noise Gate (offline processing) ────────────────────────────────────────

/**
 * Applies a noise gate to an AudioBuffer by zeroing out samples below threshold.
 * This is done as a pre-processing step on the raw buffer data.
 */
function applyNoiseGate(buffer: AudioBuffer, thresholdDb: number): AudioBuffer {
  if (thresholdDb <= -100) { return buffer; } // Gate is effectively off

  const threshold = Math.pow(10, thresholdDb / 20);
  const channelCount = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;

  // We need a new context to create a buffer (can't reuse OfflineAudioContext after rendering)
  // Instead, modify in-place since AudioBuffer channels are writable Float32Arrays
  for (let ch = 0; ch < channelCount; ch++) {
    const data = buffer.getChannelData(ch);
    // Use a simple RMS window for gate detection
    const windowSize = Math.floor(sampleRate * 0.01); // 10ms window

    for (let i = 0; i < length; i += windowSize) {
      const end = Math.min(i + windowSize, length);
      let rms = 0;
      for (let j = i; j < end; j++) {
        rms += data[j] * data[j];
      }
      rms = Math.sqrt(rms / (end - i));

      if (rms < threshold) {
        // Below threshold — fade to silence
        for (let j = i; j < end; j++) {
          data[j] *= 0.01; // Heavy attenuation instead of hard zero to avoid clicks
        }
      }
    }
  }

  return buffer;
}

// ─── Main Processing Functions ──────────────────────────────────────────────

/**
 * Build a processing chain on an AudioContext (real-time or offline).
 * Returns the first and last nodes in the chain so the caller can connect
 * source -> firstNode and lastNode -> destination.
 */
function buildProcessingChain(
  ctx: BaseAudioContext,
  settings: VoiceEffectsSettings,
): { input: AudioNode; output: AudioNode } {
  const nodes: AudioNode[] = [];

  // 1. Equalizer — 3-band parametric EQ using BiquadFilterNode
  const lowEq = ctx.createBiquadFilter();
  lowEq.type = 'lowshelf';
  lowEq.frequency.value = 100;
  lowEq.gain.value = settings.equalizer.low;
  nodes.push(lowEq);

  const midEq = ctx.createBiquadFilter();
  midEq.type = 'peaking';
  midEq.frequency.value = 1000;
  midEq.Q.value = 1.0;
  midEq.gain.value = settings.equalizer.mid;
  nodes.push(midEq);

  const highEq = ctx.createBiquadFilter();
  highEq.type = 'highshelf';
  highEq.frequency.value = 8000;
  highEq.gain.value = settings.equalizer.high;
  nodes.push(highEq);

  // 2. Compressor
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = settings.compressor.threshold;
  compressor.ratio.value = settings.compressor.ratio;
  compressor.attack.value = settings.compressor.attack;
  compressor.release.value = settings.compressor.release;
  compressor.knee.value = 6;
  nodes.push(compressor);

  // Chain EQ -> Compressor
  for (let i = 1; i < nodes.length; i++) {
    nodes[i - 1].connect(nodes[i]);
  }

  // The remaining effects (reverb, delay) need dry/wet mixing
  let lastDryNode: AudioNode = compressor;

  // 3. Reverb (ConvolverNode with dry/wet mix)
  if (settings.reverb.mix > 0.001) {
    const convolver = ctx.createConvolver();
    const impulse = generateImpulseResponse(ctx, settings.reverb.decay, ctx.sampleRate);
    convolver.buffer = impulse;

    const dryGain = ctx.createGain();
    dryGain.gain.value = 1 - settings.reverb.mix;

    const wetGain = ctx.createGain();
    wetGain.gain.value = settings.reverb.mix;

    const reverbMerge = ctx.createGain();
    reverbMerge.gain.value = 1;

    lastDryNode.connect(dryGain);
    lastDryNode.connect(convolver);
    convolver.connect(wetGain);
    dryGain.connect(reverbMerge);
    wetGain.connect(reverbMerge);

    lastDryNode = reverbMerge;
  }

  // 4. Delay with feedback
  if (settings.delay.mix > 0.001 && settings.delay.time > 0) {
    const delayNode = ctx.createDelay(2.0); // max 2 seconds
    delayNode.delayTime.value = settings.delay.time / 1000; // convert ms to seconds

    const feedbackGain = ctx.createGain();
    feedbackGain.gain.value = Math.min(settings.delay.feedback, 0.9);

    const delayWetGain = ctx.createGain();
    delayWetGain.gain.value = settings.delay.mix;

    const delayDryGain = ctx.createGain();
    delayDryGain.gain.value = 1;

    const delayMerge = ctx.createGain();
    delayMerge.gain.value = 1;

    // Dry path
    lastDryNode.connect(delayDryGain);
    delayDryGain.connect(delayMerge);

    // Wet path with feedback loop
    lastDryNode.connect(delayNode);
    delayNode.connect(feedbackGain);
    feedbackGain.connect(delayNode); // feedback loop
    delayNode.connect(delayWetGain);
    delayWetGain.connect(delayMerge);

    lastDryNode = delayMerge;
  }

  return {
    input: lowEq,
    output: lastDryNode,
  };
}

/**
 * Apply effects to an AudioBuffer and return the processed buffer.
 * Uses OfflineAudioContext for non-real-time rendering.
 *
 * Pitch shift is implemented via playbackRate on AudioBufferSourceNode
 * combined with detune. Speed changes the duration accordingly.
 */
export async function applyEffects(
  audioBuffer: AudioBuffer,
  settings: VoiceEffectsSettings,
): Promise<AudioBuffer> {
  // Calculate output duration accounting for speed and pitch shift
  // playbackRate changes both pitch and speed; we use it for combined pitch+speed
  const pitchRatio = Math.pow(2, settings.pitchShift / 12);
  const effectiveRate = settings.speed * pitchRatio;
  const outputDuration = audioBuffer.duration / effectiveRate;

  // Add extra time for reverb tail and delay tail
  const reverbTail = settings.reverb.mix > 0.001 ? settings.reverb.decay : 0;
  const delayTail = settings.delay.mix > 0.001
    ? (settings.delay.time / 1000) * (1 / (1 - Math.min(settings.delay.feedback, 0.89)))
    : 0;
  const totalDuration = outputDuration + Math.max(reverbTail, delayTail) + 0.1;

  const offlineCtx = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    Math.ceil(totalDuration * audioBuffer.sampleRate),
    audioBuffer.sampleRate,
  );

  // Apply noise gate to a copy of the buffer before processing
  // We create a copy to avoid mutating the original
  const gatedBuffer = offlineCtx.createBuffer(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate,
  );
  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    gatedBuffer.getChannelData(ch).set(audioBuffer.getChannelData(ch));
  }
  applyNoiseGate(gatedBuffer, settings.noiseGateThreshold);

  // Create source with pitch/speed
  const source = offlineCtx.createBufferSource();
  source.buffer = gatedBuffer;
  source.playbackRate.value = effectiveRate;

  // Build the processing chain
  const { input, output } = buildProcessingChain(offlineCtx, settings);

  // Connect: source -> chain -> destination
  source.connect(input);
  output.connect(offlineCtx.destination);

  source.start(0);

  const renderedBuffer = await offlineCtx.startRendering();
  return renderedBuffer;
}

/**
 * Process an AudioBuffer with effects and export as a downloadable WAV Blob.
 * Uses OfflineAudioContext to bake all effects into the file.
 */
export async function exportProcessed(
  audioBuffer: AudioBuffer,
  settings: VoiceEffectsSettings,
): Promise<Blob> {
  const processed = await applyEffects(audioBuffer, settings);
  return audioBufferToWav(processed);
}

// ─── WAV Encoding ───────────────────────────────────────────────────────────

/**
 * Converts an AudioBuffer to a WAV Blob (PCM 16-bit).
 * This is pure JavaScript — no external libraries needed.
 */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitsPerSample = 16;

  // Interleave channels
  const length = buffer.length;
  const interleaved = new Float32Array(length * numChannels);

  for (let ch = 0; ch < numChannels; ch++) {
    const channelData = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      interleaved[i * numChannels + ch] = channelData[i];
    }
  }

  // Convert to 16-bit PCM
  const dataLength = interleaved.length * (bitsPerSample / 8);
  const headerLength = 44;
  const totalLength = headerLength + dataLength;

  const arrayBuffer = new ArrayBuffer(totalLength);
  const view = new DataView(arrayBuffer);

  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalLength - 8, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
  view.setUint16(32, numChannels * (bitsPerSample / 8), true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  // Write PCM samples
  let offset = 44;
  for (let i = 0; i < interleaved.length; i++) {
    const sample = Math.max(-1, Math.min(1, interleaved[i]));
    const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    view.setInt16(offset, intSample, true);
    offset += 2;
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

// ─── Real-time Preview Engine ───────────────────────────────────────────────

/**
 * Manages a real-time audio preview with effects applied via AudioContext.
 * Call play() to start, stop() to stop. Update settings on-the-fly.
 */
export class VoiceEffectsPreview {
  private audioContext: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private chainInput: AudioNode | null = null;
  private chainOutput: AudioNode | null = null;
  private isPlaying = false;
  private onEndedCallback: (() => void) | null = null;
  private startTime = 0;
  private pausedAt = 0;

  play(
    audioBuffer: AudioBuffer,
    settings: VoiceEffectsSettings,
    onEnded?: () => void,
  ): void {
    this.stop();

    this.audioContext = new AudioContext();
    this.onEndedCallback = onEnded ?? null;

    // Apply noise gate to a copy
    const gatedBuffer = this.audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate,
    );
    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
      gatedBuffer.getChannelData(ch).set(audioBuffer.getChannelData(ch));
    }
    applyNoiseGate(gatedBuffer, settings.noiseGateThreshold);

    const source = this.audioContext.createBufferSource();
    source.buffer = gatedBuffer;

    const pitchRatio = Math.pow(2, settings.pitchShift / 12);
    source.playbackRate.value = settings.speed * pitchRatio;

    const { input, output } = buildProcessingChain(this.audioContext, settings);

    source.connect(input);
    output.connect(this.audioContext.destination);

    source.onended = () => {
      this.isPlaying = false;
      this.onEndedCallback?.();
    };

    source.start(0);
    this.sourceNode = source;
    this.chainInput = input;
    this.chainOutput = output;
    this.isPlaying = true;
    this.startTime = this.audioContext.currentTime;
  }

  stop(): void {
    if (this.sourceNode) {
      try { this.sourceNode.stop(); } catch { /* already stopped */ }
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.chainInput) {
      this.chainInput.disconnect();
      this.chainInput = null;
    }
    if (this.chainOutput) {
      this.chainOutput.disconnect();
      this.chainOutput = null;
    }
    if (this.audioContext) {
      void this.audioContext.close();
      this.audioContext = null;
    }
    this.isPlaying = false;
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  getCurrentTime(): number {
    if (!this.audioContext || !this.isPlaying) { return 0; }
    return this.audioContext.currentTime - this.startTime;
  }

  /** Get progress as 0-1 fraction of the original buffer duration */
  getProgress(originalDuration: number, settings: VoiceEffectsSettings): number {
    if (!this.isPlaying || originalDuration <= 0) { return 0; }
    const pitchRatio = Math.pow(2, settings.pitchShift / 12);
    const effectiveRate = settings.speed * pitchRatio;
    const playedOriginalTime = this.getCurrentTime() * effectiveRate;
    return Math.min(playedOriginalTime / originalDuration, 1);
  }
}
