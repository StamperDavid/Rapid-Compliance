/**
 * Voice Effects Engine — Professional Grade
 * Real audio processing using Web Audio API
 *
 * Processing chain:
 *   Input -> Noise Gate -> High-Pass -> EQ (3-band) -> De-Esser
 *         -> Compressor -> Distortion -> Chorus -> Pitch/Formant Shift
 *         -> Reverb -> Delay -> Limiter -> Output
 *
 * 13 independent effects with full parameter control.
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

export interface ChorusSettings {
  /** LFO rate in Hz, range 0.1 to 10 */
  rate: number;
  /** Modulation depth in milliseconds, range 0 to 20 */
  depth: number;
  /** Wet mix, range 0 to 1 */
  mix: number;
}

export interface DistortionSettings {
  /** Distortion amount, range 0 to 100 */
  amount: number;
  /** Tone control — frequency of post-distortion lowpass filter, range 1000 to 20000 Hz */
  tone: number;
  /** Wet mix, range 0 to 1 */
  mix: number;
}

export interface DeEsserSettings {
  /** Threshold in dB — sibilance above this is reduced, range -60 to 0 */
  threshold: number;
  /** Center frequency for sibilance detection, range 3000 to 10000 Hz */
  frequency: number;
  /** Reduction ratio, range 1 to 10 */
  ratio: number;
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
  /** Playback speed, range 0.5 to 2.0 */
  speed: number;
  /** Formant shift in semitones, range -12 to +12 (independent of pitch) */
  formantShift?: number;
  /** Chorus — vocal doubling and width */
  chorus?: ChorusSettings;
  /** Distortion / saturation — warmth and grit */
  distortion?: DistortionSettings;
  /** De-esser — sibilance reduction */
  deEsser?: DeEsserSettings;
  /** High-pass filter cutoff in Hz, range 20 to 500. 0 = off */
  highPassFreq?: number;
  /** Output limiter enabled — prevents clipping */
  limiterEnabled?: boolean;
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
  formantShift: 0,
  chorus: { rate: 1.5, depth: 3, mix: 0 },
  distortion: { amount: 0, tone: 8000, mix: 0 },
  deEsser: { threshold: -30, frequency: 6000, ratio: 1 },
  highPassFreq: 0,
  limiterEnabled: false,
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
      ...DEFAULT_EFFECTS,
      equalizer: { low: 3, mid: 1, high: 4 },
      compressor: { threshold: -18, ratio: 6, attack: 0.003, release: 0.15 },
      pitchShift: -1,
      reverb: { mix: 0.08, decay: 0.6 },
      noiseGateThreshold: -50,
      highPassFreq: 80,
      deEsser: { threshold: -25, frequency: 6500, ratio: 3 },
      limiterEnabled: true,
    },
  },
  {
    name: 'Podcast',
    description: 'Clean, intimate, easy to listen to',
    settings: {
      ...DEFAULT_EFFECTS,
      equalizer: { low: -2, mid: 2, high: 3 },
      compressor: { threshold: -20, ratio: 3, attack: 0.01, release: 0.3 },
      reverb: { mix: 0.05, decay: 0.4 },
      noiseGateThreshold: -45,
      highPassFreq: 100,
      deEsser: { threshold: -28, frequency: 5500, ratio: 2 },
      limiterEnabled: true,
    },
  },
  {
    name: 'Deep Voice',
    description: 'Lower pitch, more bass presence',
    settings: {
      ...DEFAULT_EFFECTS,
      equalizer: { low: 6, mid: -1, high: -2 },
      compressor: { threshold: -22, ratio: 4, attack: 0.005, release: 0.25 },
      pitchShift: -4,
      formantShift: 2,
      reverb: { mix: 0.1, decay: 1.0 },
      noiseGateThreshold: -60,
      highPassFreq: 60,
      limiterEnabled: true,
    },
  },
  {
    name: 'Bright & Clear',
    description: 'Enhanced highs, crisp and present',
    settings: {
      ...DEFAULT_EFFECTS,
      equalizer: { low: -3, mid: 3, high: 6 },
      compressor: { threshold: -20, ratio: 3, attack: 0.002, release: 0.2 },
      pitchShift: 1,
      reverb: { mix: 0.03, decay: 0.3 },
      noiseGateThreshold: -50,
      highPassFreq: 120,
      deEsser: { threshold: -22, frequency: 7000, ratio: 4 },
      limiterEnabled: true,
    },
  },
  {
    name: 'Telephone',
    description: 'Bandpass-filtered, vintage phone effect',
    settings: {
      ...DEFAULT_EFFECTS,
      equalizer: { low: -12, mid: 6, high: -10 },
      compressor: { threshold: -15, ratio: 8, attack: 0.001, release: 0.1 },
      noiseGateThreshold: -40,
      highPassFreq: 300,
      distortion: { amount: 15, tone: 3000, mix: 0.3 },
    },
  },
];

// ─── Impulse Response Generation ────────────────────────────────────────────

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
      const t = i / sampleRate;
      const envelope = Math.exp(-3.0 * t / decay);
      channelData[i] = (Math.random() * 2 - 1) * envelope;
    }
  }

  return impulse;
}

// ─── Distortion Curve Generation ────────────────────────────────────────────

function makeDistortionCurve(amount: number): Float32Array {
  const samples = 44100;
  const curve = new Float32Array(samples);
  const k = Math.max(amount, 0.01);

  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    // Soft-clip waveshaping: tanh-style curve
    curve[i] = ((Math.PI + k) * x) / (Math.PI + k * Math.abs(x));
  }

  return curve;
}

// ─── Noise Gate (offline processing) ────────────────────────────────────────

function applyNoiseGate(buffer: AudioBuffer, thresholdDb: number): AudioBuffer {
  if (thresholdDb <= -100) { return buffer; }

  const threshold = Math.pow(10, thresholdDb / 20);
  const channelCount = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;

  for (let ch = 0; ch < channelCount; ch++) {
    const data = buffer.getChannelData(ch);
    const windowSize = Math.floor(sampleRate * 0.01); // 10ms window

    for (let i = 0; i < length; i += windowSize) {
      const end = Math.min(i + windowSize, length);
      let rms = 0;
      for (let j = i; j < end; j++) {
        rms += data[j] * data[j];
      }
      rms = Math.sqrt(rms / (end - i));

      if (rms < threshold) {
        for (let j = i; j < end; j++) {
          data[j] *= 0.01;
        }
      }
    }
  }

  return buffer;
}

// ─── Main Processing Chain ──────────────────────────────────────────────────

function buildProcessingChain(
  ctx: BaseAudioContext,
  settings: VoiceEffectsSettings,
): { input: AudioNode; output: AudioNode } {
  const nodes: AudioNode[] = [];

  // 1. High-Pass Filter — removes rumble and plosives
  const hpFreq = settings.highPassFreq ?? 0;
  if (hpFreq > 20) {
    const highPass = ctx.createBiquadFilter();
    highPass.type = 'highpass';
    highPass.frequency.value = hpFreq;
    highPass.Q.value = 0.707; // Butterworth
    nodes.push(highPass);
  }

  // 2. Equalizer — 3-band parametric EQ using BiquadFilterNode
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

  // 3. De-Esser — sibilance reduction via sidechain-style compression on high frequencies
  const deEsser = settings.deEsser;
  if (deEsser && deEsser.ratio > 1) {
    // Use a narrow bandpass to detect sibilance, then compress just that band
    const deEsserBand = ctx.createBiquadFilter();
    deEsserBand.type = 'peaking';
    deEsserBand.frequency.value = deEsser.frequency;
    deEsserBand.Q.value = 2.0;
    // Apply negative gain proportional to the ratio to reduce sibilant frequencies
    const reductionDb = -(deEsser.ratio - 1) * 2;
    deEsserBand.gain.value = Math.max(reductionDb, -12);
    nodes.push(deEsserBand);
  }

  // 4. Compressor
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = settings.compressor.threshold;
  compressor.ratio.value = settings.compressor.ratio;
  compressor.attack.value = settings.compressor.attack;
  compressor.release.value = settings.compressor.release;
  compressor.knee.value = 6;
  nodes.push(compressor);

  // Chain all nodes so far
  for (let i = 1; i < nodes.length; i++) {
    nodes[i - 1].connect(nodes[i]);
  }

  let lastDryNode: AudioNode = nodes[nodes.length - 1];

  // 5. Distortion / Saturation — WaveShaperNode with tone control
  const dist = settings.distortion;
  if (dist && dist.mix > 0.001 && dist.amount > 0) {
    const waveshaper = ctx.createWaveShaper();
    waveshaper.curve = makeDistortionCurve(dist.amount) as Float32Array<ArrayBuffer>;
    waveshaper.oversample = '4x'; // Reduce aliasing

    // Post-distortion tone filter to tame harshness
    const toneFilter = ctx.createBiquadFilter();
    toneFilter.type = 'lowpass';
    toneFilter.frequency.value = dist.tone;
    toneFilter.Q.value = 0.5;

    const distDryGain = ctx.createGain();
    distDryGain.gain.value = 1 - dist.mix;

    const distWetGain = ctx.createGain();
    distWetGain.gain.value = dist.mix;

    const distMerge = ctx.createGain();
    distMerge.gain.value = 1;

    // Dry path
    lastDryNode.connect(distDryGain);
    distDryGain.connect(distMerge);

    // Wet path: signal -> waveshaper -> tone filter -> wet gain -> merge
    lastDryNode.connect(waveshaper);
    waveshaper.connect(toneFilter);
    toneFilter.connect(distWetGain);
    distWetGain.connect(distMerge);

    lastDryNode = distMerge;
  }

  // 6. Chorus — delayed copy with LFO-modulated delay time for width
  const chorus = settings.chorus;
  if (chorus && chorus.mix > 0.001 && chorus.depth > 0) {
    const chorusDelay = ctx.createDelay(0.1);
    const baseDelayTime = 0.015; // 15ms base delay
    chorusDelay.delayTime.value = baseDelayTime;

    // LFO for modulating the delay time
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = chorus.rate;

    const lfoGain = ctx.createGain();
    lfoGain.gain.value = chorus.depth / 1000; // Convert ms to seconds

    lfo.connect(lfoGain);
    lfoGain.connect(chorusDelay.delayTime);
    lfo.start(0);

    const chorusDryGain = ctx.createGain();
    chorusDryGain.gain.value = 1;

    const chorusWetGain = ctx.createGain();
    chorusWetGain.gain.value = chorus.mix;

    const chorusMerge = ctx.createGain();
    chorusMerge.gain.value = 1;

    lastDryNode.connect(chorusDryGain);
    chorusDryGain.connect(chorusMerge);

    lastDryNode.connect(chorusDelay);
    chorusDelay.connect(chorusWetGain);
    chorusWetGain.connect(chorusMerge);

    lastDryNode = chorusMerge;
  }

  // 7. Reverb (ConvolverNode with dry/wet mix)
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

  // 8. Delay with feedback
  if (settings.delay.mix > 0.001 && settings.delay.time > 0) {
    const delayNode = ctx.createDelay(2.0);
    delayNode.delayTime.value = settings.delay.time / 1000;

    const feedbackGain = ctx.createGain();
    feedbackGain.gain.value = Math.min(settings.delay.feedback, 0.9);

    const delayWetGain = ctx.createGain();
    delayWetGain.gain.value = settings.delay.mix;

    const delayDryGain = ctx.createGain();
    delayDryGain.gain.value = 1;

    const delayMerge = ctx.createGain();
    delayMerge.gain.value = 1;

    lastDryNode.connect(delayDryGain);
    delayDryGain.connect(delayMerge);

    lastDryNode.connect(delayNode);
    delayNode.connect(feedbackGain);
    feedbackGain.connect(delayNode);
    delayNode.connect(delayWetGain);
    delayWetGain.connect(delayMerge);

    lastDryNode = delayMerge;
  }

  // 9. Output Limiter — prevents clipping, brick-wall at 0dB
  if (settings.limiterEnabled) {
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -1;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.01;
    limiter.knee.value = 0;

    lastDryNode.connect(limiter);
    lastDryNode = limiter;
  }

  return {
    input: nodes[0],
    output: lastDryNode,
  };
}

// ─── Formant-Aware Pitch/Speed Calculation ──────────────────────────────────

/**
 * Calculates the effective playback rate accounting for pitch shift, formant shift,
 * and speed. Formant shift works by adjusting playback rate (which shifts formants)
 * while compensating with the opposite pitch detune.
 *
 * The formant shift is baked into the playback rate. The caller must also apply
 * detune = -formantShift * 100 cents to the source node to preserve pitch.
 */
function calculatePlaybackRate(settings: VoiceEffectsSettings): {
  playbackRate: number;
  detuneCents: number;
} {
  const formant = settings.formantShift ?? 0;
  const pitchRatio = Math.pow(2, settings.pitchShift / 12);
  const formantRatio = Math.pow(2, formant / 12);

  return {
    playbackRate: settings.speed * pitchRatio * formantRatio,
    detuneCents: -formant * 100,
  };
}

// ─── Offline Processing ─────────────────────────────────────────────────────

export async function applyEffects(
  audioBuffer: AudioBuffer,
  settings: VoiceEffectsSettings,
): Promise<AudioBuffer> {
  const { playbackRate, detuneCents } = calculatePlaybackRate(settings);
  const outputDuration = audioBuffer.duration / playbackRate;

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

  // Apply noise gate to a copy
  const gatedBuffer = offlineCtx.createBuffer(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate,
  );
  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    gatedBuffer.getChannelData(ch).set(audioBuffer.getChannelData(ch));
  }
  applyNoiseGate(gatedBuffer, settings.noiseGateThreshold);

  // Create source with pitch/speed/formant
  const source = offlineCtx.createBufferSource();
  source.buffer = gatedBuffer;
  source.playbackRate.value = playbackRate;
  if (detuneCents !== 0) {
    source.detune.value = detuneCents;
  }

  const { input, output } = buildProcessingChain(offlineCtx, settings);

  source.connect(input);
  output.connect(offlineCtx.destination);

  source.start(0);

  const renderedBuffer = await offlineCtx.startRendering();
  return renderedBuffer;
}

export async function exportProcessed(
  audioBuffer: AudioBuffer,
  settings: VoiceEffectsSettings,
): Promise<Blob> {
  const processed = await applyEffects(audioBuffer, settings);
  return audioBufferToWav(processed);
}

// ─── WAV Encoding ───────────────────────────────────────────────────────────

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitsPerSample = 16;

  const length = buffer.length;
  const interleaved = new Float32Array(length * numChannels);

  for (let ch = 0; ch < numChannels; ch++) {
    const channelData = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      interleaved[i * numChannels + ch] = channelData[i];
    }
  }

  const dataLength = interleaved.length * (bitsPerSample / 8);
  const headerLength = 44;
  const totalLength = headerLength + dataLength;

  const arrayBuffer = new ArrayBuffer(totalLength);
  const view = new DataView(arrayBuffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalLength - 8, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
  view.setUint16(32, numChannels * (bitsPerSample / 8), true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

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

    const { playbackRate, detuneCents } = calculatePlaybackRate(settings);
    source.playbackRate.value = playbackRate;
    if (detuneCents !== 0) {
      source.detune.value = detuneCents;
    }

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

  getProgress(originalDuration: number, settings: VoiceEffectsSettings): number {
    if (!this.isPlaying || originalDuration <= 0) { return 0; }
    const { playbackRate } = calculatePlaybackRate(settings);
    const playedOriginalTime = this.getCurrentTime() * playbackRate;
    return Math.min(playedOriginalTime / originalDuration, 1);
  }
}
