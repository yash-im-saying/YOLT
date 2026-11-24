import type {
  DrumChannel,
  LfoConfig,
  LfoRateSync,
  PatternData,
  StepData,
  VoiceParams,
} from '../types/drum';

export function createDefaultStep(active = false, velocity = 0.82, accent = false): StepData {
  return {
    active,
    velocity,
    accent,
    pitchOffset: 0,
    filterOffset: 0,
    roll: 1,
    probability: 100,
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Duration of one 16th-note step in seconds at a given BPM.
 */
export function getStepDurationSeconds(bpm: number): number {
  const safeBpm = clamp(bpm, 40, 240);
  return 60 / safeBpm / 4;
}

/**
 * Computes swing delay in seconds for a given step index (0-based).
 * Even steps (0, 2, 4...) are on the grid; odd 16th steps (1, 3, 5...) are delayed
 * proportionally up to 1/3 of a pair (classic MPC/TR-808 triplet swing at 100%).
 */
export function getSwingOffsetSeconds(stepIndex: number, bpm: number, swingPercent: number): number {
  if (stepIndex % 2 === 0) return 0;
  const clampedSwing = clamp(swingPercent, 0, 75);
  const stepDur = getStepDurationSeconds(bpm);
  // At 50% swing, odd 16th shifts by 1/3 of a step (~66% triplet groove)
  return stepDur * (clampedSwing / 100) * 0.66;
}

/**
 * Returns exact trigger timestamps (relative to step start) for a step's ratchet/roll count.
 */
export function getRatchetOffsets(
  stepDurationSec: number,
  roll: 1 | 2 | 3 | 4
): number[] {
  const safeRoll = clamp(Math.round(roll), 1, 4);
  const offsets: number[] = [];
  for (let i = 0; i < safeRoll; i++) {
    offsets.push((stepDurationSec / safeRoll) * i);
  }
  return offsets;
}

/**
 * Converts a tempo-synced LFO division to frequency in Hz.
 */
export function getLfoFrequencyHz(lfo: LfoConfig, bpm: number): number {
  const safeBpm = clamp(bpm, 40, 240);
  const quarterHz = safeBpm / 60;
  const map: Record<Exclude<LfoRateSync, 'free'>, number> = {
    '1/1': quarterHz / 4,
    '1/2': quarterHz / 2,
    '1/4': quarterHz,
    '1/8': quarterHz * 2,
    '1/16': quarterHz * 4,
  };
  if (lfo.sync === 'free') {
    return clamp(lfo.rateHz, 0.1, 20);
  }
  return map[lfo.sync];
}

/**
 * Evaluates a bipolar LFO waveform in [-1, 1] at a given time in seconds.
 */
export function evaluateLfoValue(lfo: LfoConfig, timeSeconds: number, bpm: number): number {
  if (!lfo.enabled || lfo.target === 'none' || lfo.depth <= 0) return 0;
  const freq = getLfoFrequencyHz(lfo, bpm);
  const phase = ((timeSeconds * freq) % 1 + 1) % 1;

  let raw = 0;
  switch (lfo.shape) {
    case 'sine':
      raw = Math.sin(phase * Math.PI * 2);
      break;
    case 'triangle':
      raw = phase < 0.25 ? phase * 4 : phase < 0.75 ? 2 - phase * 4 : phase * 4 - 4;
      break;
    case 'sawtooth':
      raw = 2 * phase - 1;
      break;
    case 'sampleHold': {
      // Deterministic stepped pseudo-random per LFO cycle so live & offline render stay consistent
      const cycle = Math.floor(timeSeconds * freq);
      const hash = Math.sin(cycle * 12.9898 + 78.233) * 43758.5453;
      raw = (hash - Math.floor(hash)) * 2 - 1;
      break;
    }
  }
  return raw * (clamp(lfo.depth, 0, 100) / 100);
}

/**
 * Resolves effective voice parameters for a specific trigger by applying
 * step parameter locks and active LFO modulations without mutating the base voice params.
 */
export function resolveModulatedParams(
  channel: DrumChannel,
  selectedChannelId: string,
  step: StepData,
  lfos: [LfoConfig, LfoConfig],
  timeSeconds: number,
  bpm: number
): VoiceParams {
  const base = channel.params;
  let tune = base.tune + step.pitchOffset;
  let filterCutoff = base.filterCutoff * Math.pow(2, (step.filterOffset / 50) * 2.2);
  let pan = base.pan;
  let drive = base.drive;
  let decay = base.decay;

  for (const lfo of lfos) {
    if (!lfo.enabled || lfo.target === 'none') continue;
    const applies =
      lfo.channelId === 'all' ||
      lfo.channelId === channel.id ||
      (lfo.channelId === 'selected' && channel.id === selectedChannelId);
    if (!applies) continue;

    const mod = evaluateLfoValue(lfo, timeSeconds, bpm);
    switch (lfo.target) {
      case 'cutoff':
        filterCutoff *= Math.pow(2, mod * 2.5);
        break;
      case 'pitch':
        tune += mod * 12;
        break;
      case 'pan':
        pan += mod * 0.9;
        break;
      case 'drive':
        drive += mod * 45;
        break;
      case 'decay':
        decay *= Math.pow(2, mod * 0.9);
        break;
      default:
        break;
    }
  }

  return {
    ...base,
    tune: clamp(tune, -24, 24),
    filterCutoff: clamp(filterCutoff, 80, 18000),
    pan: clamp(pan, -1, 1),
    drive: clamp(drive, 0, 100),
    decay: clamp(decay, 20, 2200),
  };
}

/**
 * Determines whether a channel should be audible taking Mute and Solo states into account.
 */
export function isChannelAudible(channel: DrumChannel, allChannels: DrumChannel[]): boolean {
  const anySolo = allChannels.some((c) => c.solo);
  if (anySolo) {
    return channel.solo;
  }
  return !channel.mute;
}

/**
 * Generates an evenly distributed Euclidean rhythm boolean array of length `steps` with `pulses` hits.
 */
export function generateEuclideanPattern(steps: number, pulses: number, rotation = 0): boolean[] {
  const n = Math.max(1, Math.floor(steps));
  const k = clamp(Math.floor(pulses), 0, n);
  const result: boolean[] = Array.from({ length: n }, () => false);
  if (k === 0) return result;
  for (let i = 0; i < n; i++) {
    const prev = Math.floor((i * k) / n);
    const next = Math.floor(((i + 1) * k) / n);
    if (next > prev) {
      const idx = ((i + rotation) % n + n) % n;
      result[idx] = true;
    }
  }
  return result;
}

/**
 * Shifts a channel's step array left or right within the active pattern length.
 */
export function shiftChannelSteps(
  steps: StepData[],
  length: 16 | 32,
  direction: -1 | 1
): StepData[] {
  const clone = steps.map((s) => ({ ...s }));
  const slice = clone.slice(0, length);
  if (direction === 1) {
    const last = slice.pop()!;
    slice.unshift(last);
  } else {
    const first = slice.shift()!;
    slice.push(first);
  }
  for (let i = 0; i < length; i++) {
    clone[i] = slice[i];
  }
  return clone;
}

/**
 * Deep-clones a PatternData object.
 */
export function clonePattern(pattern: PatternData): PatternData {
  const steps: Record<string, StepData[]> = {};
  for (const [chId, arr] of Object.entries(pattern.steps)) {
    steps[chId] = arr.map((s) => ({ ...s }));
  }
  return {
    length: pattern.length,
    steps,
  };
}

/**
 * Converts delay division to seconds based on BPM.
 */
export function getDelayTimeSeconds(
  division: '1/16' | '1/8' | '3/16' | '1/4',
  bpm: number
): number {
  const sixteenth = getStepDurationSeconds(bpm);
  switch (division) {
    case '1/16':
      return sixteenth;
    case '1/8':
      return sixteenth * 2;
    case '3/16':
      return sixteenth * 3;
    case '1/4':
      return sixteenth * 4;
  }
}

/**
 * Estimates exported file size in bytes for display in the Export Console.
 */
export function estimateExportBytes(params: {
  format: 'wav' | 'aiff' | 'flac' | 'midi';
  bitDepth: 16 | 24;
  sampleRate: 44100 | 48000;
  bpm: number;
  bars: 1 | 2 | 4 | 8;
  includeTail: boolean;
}): number {
  if (params.format === 'midi') {
    return 512 + params.bars * 320;
  }
  const barSec = (60 / clamp(params.bpm, 40, 240)) * 4;
  const totalSec = barSec * params.bars + (params.includeTail ? 1.5 : 0);
  const frames = Math.ceil(totalSec * params.sampleRate);
  const bytesPerSample = params.bitDepth / 8;
  const rawPcmBytes = frames * 2 * bytesPerSample;
  if (params.format === 'flac') {
    // Lossless FLAC with constant silent frames typically runs ~70-95% of raw PCM
    return Math.round(rawPcmBytes * 0.85) + 4096;
  }
  return rawPcmBytes + 64;
}
