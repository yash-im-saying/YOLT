import type { CustomSampleMeta } from '../types/drum';

export interface StoredSampleData {
  meta: CustomSampleMeta;
  left: Float32Array;
  right: Float32Array;
}

const sampleRegistry = new Map<string, StoredSampleData>();
const contextBufferCache = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();

/**
 * Extracts normalized display peaks in [0, 1] for rendering a retro amber waveform preview.
 */
export function extractWaveformPeaks(
  left: Float32Array,
  right: Float32Array,
  bins = 96
): number[] {
  const len = Math.min(left.length, right.length);
  if (len === 0) return Array.from({ length: bins }, () => 0);
  const peaks: number[] = [];
  const blockSize = Math.max(1, Math.floor(len / bins));
  let maxPeak = 1e-4;

  for (let b = 0; b < bins; b++) {
    const start = Math.floor((b / bins) * len);
    const end = Math.min(len, start + blockSize);
    let peak = 0;
    for (let i = start; i < end; i++) {
      const v = Math.max(Math.abs(left[i]), Math.abs(right[i]));
      if (v > peak) peak = v;
    }
    if (peak > maxPeak) maxPeak = peak;
    peaks.push(peak);
  }

  return peaks.map((p) => Number((p / maxPeak).toFixed(3)));
}

function cleanSampleDisplayName(fileName: string): string {
  const withoutExt = fileName.replace(/\.[^.]+$/, '');
  return withoutExt.trim().slice(0, 36) || 'Custom Sample';
}

export function makeShortSampleTag(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (cleaned.length >= 4) return cleaned.slice(0, 4);
  return (cleaned || 'SMP').padEnd(3, 'X');
}

/**
 * Decodes a user-dropped or uploaded audio File into stereo Float32Arrays
 * and registers it for both live playback and offline 24-bit rendering.
 */
export async function decodeAndStoreSampleFile(file: File): Promise<CustomSampleMeta> {
  const arrayBuffer = await file.arrayBuffer();
  if (arrayBuffer.byteLength === 0) {
    throw new Error('The dropped file is empty.');
  }

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const decodeCtx = new AudioCtx();
  let decoded: AudioBuffer;
  try {
    decoded = await decodeCtx.decodeAudioData(arrayBuffer.slice(0));
  } catch {
    throw new Error(`Unsupported or unreadable audio file: "${file.name}"`);
  } finally {
    void decodeCtx.close();
  }

  const left = new Float32Array(decoded.getChannelData(0));
  const right =
    decoded.numberOfChannels > 1
      ? new Float32Array(decoded.getChannelData(1))
      : new Float32Array(left);

  // Guard against micro-clicks on un-trimmed sample tails by ensuring last 1ms tapers smoothly
  const edgeFade = Math.min(Math.floor(decoded.sampleRate * 0.002), Math.floor(left.length / 4));
  for (let i = 0; i < edgeFade; i++) {
    const gain = i / edgeFade;
    left[i] *= gain;
    right[i] *= gain;
    const tailIdx = left.length - 1 - i;
    left[tailIdx] *= gain;
    right[tailIdx] *= gain;
  }

  const id = `smp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const displayName = cleanSampleDisplayName(file.name);
  const meta: CustomSampleMeta = {
    id,
    name: displayName,
    durationSec: decoded.duration,
    sampleRate: decoded.sampleRate,
    channels: decoded.numberOfChannels,
    peaks: extractWaveformPeaks(left, right, 96),
  };

  sampleRegistry.set(id, { meta, left, right });
  return meta;
}

export function getStoredSample(sampleId: string): StoredSampleData | null {
  return sampleRegistry.get(sampleId) ?? null;
}

/**
 * Returns an AudioBuffer bound to the requested AudioContext or OfflineAudioContext,
 * cached per context for zero-allocation real-time playback and offline export.
 */
export function getSampleBufferForContext(
  ctx: BaseAudioContext,
  sampleId: string
): AudioBuffer | null {
  const stored = sampleRegistry.get(sampleId);
  if (!stored) return null;

  let ctxMap = contextBufferCache.get(ctx);
  if (!ctxMap) {
    ctxMap = new Map();
    contextBufferCache.set(ctx, ctxMap);
  }
  const existing = ctxMap.get(sampleId);
  if (existing) return existing;

  const buf = ctx.createBuffer(2, stored.left.length, stored.meta.sampleRate);
  buf.getChannelData(0).set(stored.left);
  buf.getChannelData(1).set(stored.right);
  ctxMap.set(sampleId, buf);
  return buf;
}

export function isLikelyAudioFile(file: File): boolean {
  if (file.type && file.type.startsWith('audio/')) return true;
  return /\.(wav|aif|aiff|flac|mp3|ogg|m4a|aac|webm|opus)$/i.test(file.name);
}
