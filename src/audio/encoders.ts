import type { DrumChannel, PatternData } from '../types/drum';
import { clamp, getRatchetOffsets, getStepDurationSeconds, getSwingOffsetSeconds, isChannelAudible } from './sequencerMath';

/**
 * Quantizes a float sample in [-1, 1] into a signed 16-bit or 24-bit integer.
 */
export function floatToSignedInt(sample: number, bitDepth: 16 | 24): number {
  const s = clamp(sample, -1, 1);
  if (bitDepth === 24) {
    // 24-bit signed range: -8388608 to 8388607
    return s < 0 ? Math.round(s * 8388608) : Math.round(s * 8388607);
  }
  return s < 0 ? Math.round(s * 32768) : Math.round(s * 32767);
}

function writeAscii(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i) & 0xff);
  }
}

/**
 * Encodes stereo Float32Audio buffers into a valid RIFF/WAVE PCM binary (16-bit or 24-bit Stereo).
 */
export function encodeWavStereo(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  bitDepth: 16 | 24 = 24
): Uint8Array {
  const numFrames = Math.min(left.length, right.length);
  const numChannels = 2;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numFrames * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true);  // AudioFormat = 1 (Linear PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let pos = 44;
  if (bitDepth === 24) {
    for (let i = 0; i < numFrames; i++) {
      const l = floatToSignedInt(left[i], 24);
      const r = floatToSignedInt(right[i], 24);
      view.setUint8(pos++, l & 0xff);
      view.setUint8(pos++, (l >> 8) & 0xff);
      view.setUint8(pos++, (l >> 16) & 0xff);
      view.setUint8(pos++, r & 0xff);
      view.setUint8(pos++, (r >> 8) & 0xff);
      view.setUint8(pos++, (r >> 16) & 0xff);
    }
  } else {
    for (let i = 0; i < numFrames; i++) {
      view.setInt16(pos, floatToSignedInt(left[i], 16), true);
      pos += 2;
      view.setInt16(pos, floatToSignedInt(right[i], 16), true);
      pos += 2;
    }
  }

  return new Uint8Array(buffer);
}

/**
 * Converts a positive number (such as sampleRate 44100 or 48000) to 10-byte IEEE 754 80-bit extended precision big-endian.
 */
export function encodeIeee80Extended(value: number): Uint8Array {
  const bytes = new Uint8Array(10);
  if (value === 0) return bytes;
  let v = Math.abs(value);
  const sign = value < 0 ? 0x80 : 0x00;
  let exponent = Math.floor(Math.log2(v));
  const mantissa = v / Math.pow(2, exponent); // in [1, 2)
  const biasedExp = exponent + 16383;

  bytes[0] = sign | ((biasedExp >> 8) & 0x7f);
  bytes[1] = biasedExp & 0xff;

  // 64-bit mantissa (integer bit + 63 fractional bits)
  const hi = Math.floor(mantissa * 0x80000000); // top 32 bits
  const lo = Math.floor((mantissa * 0x80000000 - hi) * 0x100000000); // bottom 32 bits

  bytes[2] = (hi >>> 24) & 0xff;
  bytes[3] = (hi >>> 16) & 0xff;
  bytes[4] = (hi >>> 8) & 0xff;
  bytes[5] = hi & 0xff;
  bytes[6] = (lo >>> 24) & 0xff;
  bytes[7] = (lo >>> 16) & 0xff;
  bytes[8] = (lo >>> 8) & 0xff;
  bytes[9] = lo & 0xff;
  return bytes;
}

/**
 * Encodes stereo Float32Audio buffers into a spec-compliant FORM/AIFF binary (16-bit or 24-bit Stereo Big-Endian).
 */
export function encodeAiffStereo(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  bitDepth: 16 | 24 = 24
): Uint8Array {
  const numFrames = Math.min(left.length, right.length);
  const numChannels = 2;
  const bytesPerSample = bitDepth / 8;
  const pcmDataSize = numFrames * numChannels * bytesPerSample;
  const padByte = pcmDataSize % 2 === 1 ? 1 : 0;
  const ssndChunkSize = 8 + pcmDataSize; // offset (4) + blockSize (4) + audio bytes
  // FORM header (12) + COMM chunk (26) + SSND header (8) + SSND body (ssndChunkSize) + pad
  const totalSize = 12 + 26 + 8 + ssndChunkSize + padByte;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  // FORM header
  writeAscii(view, 0, 'FORM');
  view.setUint32(4, totalSize - 8, false);
  writeAscii(view, 8, 'AIFF');

  // COMM chunk (8 header + 18 data = 26 bytes)
  writeAscii(view, 12, 'COMM');
  view.setUint32(16, 18, false);
  view.setUint16(20, numChannels, false);
  view.setUint32(22, numFrames, false);
  view.setUint16(26, bitDepth, false);
  const extRate = encodeIeee80Extended(sampleRate);
  for (let i = 0; i < 10; i++) {
    view.setUint8(28 + i, extRate[i]);
  }

  // SSND chunk
  writeAscii(view, 38, 'SSND');
  view.setUint32(42, ssndChunkSize, false);
  view.setUint32(46, 0, false); // offset
  view.setUint32(50, 0, false); // blockSize

  let pos = 54;
  if (bitDepth === 24) {
    for (let i = 0; i < numFrames; i++) {
      const l = floatToSignedInt(left[i], 24);
      const r = floatToSignedInt(right[i], 24);
      view.setUint8(pos++, (l >> 16) & 0xff);
      view.setUint8(pos++, (l >> 8) & 0xff);
      view.setUint8(pos++, l & 0xff);
      view.setUint8(pos++, (r >> 16) & 0xff);
      view.setUint8(pos++, (r >> 8) & 0xff);
      view.setUint8(pos++, r & 0xff);
    }
  } else {
    for (let i = 0; i < numFrames; i++) {
      view.setInt16(pos, floatToSignedInt(left[i], 16), false);
      pos += 2;
      view.setInt16(pos, floatToSignedInt(right[i], 16), false);
      pos += 2;
    }
  }

  return new Uint8Array(buffer);
}

// ---------------------------------------------------------------------------
// RFC 9639 Spec-Compliant 24-bit / 16-bit Stereo FLAC Encoder
// ---------------------------------------------------------------------------

function computeCrc8(data: Uint8Array, start: number, end: number): number {
  let crc = 0;
  for (let i = start; i < end; i++) {
    crc ^= data[i];
    for (let b = 0; b < 8; b++) {
      crc = (crc & 0x80) !== 0 ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
    }
  }
  return crc;
}

function computeCrc16(data: Uint8Array, start: number, end: number): number {
  let crc = 0;
  for (let i = start; i < end; i++) {
    crc ^= data[i] << 8;
    for (let b = 0; b < 8; b++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x8005) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

/**
 * Pure RFC 1321 MD5 digest for FLAC STREAMINFO signature over raw little-endian interleaved PCM bytes.
 */
function computeMd5(input: Uint8Array): Uint8Array {
  const s = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];
  const K = new Uint32Array(64);
  for (let i = 0; i < 64; i++) {
    K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0;
  }

  const origLen = input.length;
  const padLen = ((56 - ((origLen + 1) % 64)) + 64) % 64;
  const totalLen = origLen + 1 + padLen + 8;
  const msg = new Uint8Array(totalLen);
  msg.set(input);
  msg[origLen] = 0x80;
  const bitLenLo = (origLen * 8) >>> 0;
  const bitLenHi = Math.floor((origLen * 8) / 0x100000000) >>> 0;
  const view = new DataView(msg.buffer);
  view.setUint32(totalLen - 8, bitLenLo, true);
  view.setUint32(totalLen - 4, bitLenHi, true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;
  const M = new Uint32Array(16);

  for (let offset = 0; offset < totalLen; offset += 64) {
    for (let j = 0; j < 16; j++) {
      M[j] = view.getUint32(offset + j * 4, true);
    }
    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;

    for (let i = 0; i < 64; i++) {
      let F = 0;
      let g = 0;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      const sum = (F + A + K[i] + M[g]) >>> 0;
      A = D;
      D = C;
      C = B;
      const rot = (sum << s[i]) | (sum >>> (32 - s[i]));
      B = (B + rot) >>> 0;
    }
    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  const out = new Uint8Array(16);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, a0, true);
  outView.setUint32(4, b0, true);
  outView.setUint32(8, c0, true);
  outView.setUint32(12, d0, true);
  return out;
}

function encodeFlacUtf8Number(val: number): number[] {
  if (val < 0x80) return [val];
  if (val < 0x800) return [0xc0 | (val >> 6), 0x80 | (val & 0x3f)];
  if (val < 0x10000) {
    return [0xe0 | (val >> 12), 0x80 | ((val >> 6) & 0x3f), 0x80 | (val & 0x3f)];
  }
  return [
    0xf0 | (val >> 18),
    0x80 | ((val >> 12) & 0x3f),
    0x80 | ((val >> 6) & 0x3f),
    0x80 | (val & 0x3f),
  ];
}

/**
 * Encodes stereo Float32Audio buffers into a valid, spec-compliant RFC 9639 FLAC binary
 * supporting 24-bit and 16-bit lossless stereo at 44100 Hz or 48000 Hz.
 */
export function encodeFlacStereo(
  left: Float32Array,
  right: Float32Array,
  sampleRate: 44100 | 48000,
  bitDepth: 16 | 24 = 24
): Uint8Array {
  const numFrames = Math.min(left.length, right.length);
  const blockSize = 4096;
  const bytesPerSample = bitDepth / 8;

  // Quantize to signed ints once and build raw little-endian PCM bytes for STREAMINFO MD5
  const leftInt = new Int32Array(numFrames);
  const rightInt = new Int32Array(numFrames);
  const rawPcmForMd5 = new Uint8Array(numFrames * 2 * bytesPerSample);
  let mPos = 0;
  for (let i = 0; i < numFrames; i++) {
    const l = floatToSignedInt(left[i], bitDepth);
    const r = floatToSignedInt(right[i], bitDepth);
    leftInt[i] = l;
    rightInt[i] = r;
    if (bitDepth === 24) {
      rawPcmForMd5[mPos++] = l & 0xff;
      rawPcmForMd5[mPos++] = (l >> 8) & 0xff;
      rawPcmForMd5[mPos++] = (l >> 16) & 0xff;
      rawPcmForMd5[mPos++] = r & 0xff;
      rawPcmForMd5[mPos++] = (r >> 8) & 0xff;
      rawPcmForMd5[mPos++] = (r >> 16) & 0xff;
    } else {
      rawPcmForMd5[mPos++] = l & 0xff;
      rawPcmForMd5[mPos++] = (l >> 8) & 0xff;
      rawPcmForMd5[mPos++] = r & 0xff;
      rawPcmForMd5[mPos++] = (r >> 8) & 0xff;
    }
  }
  const md5 = computeMd5(rawPcmForMd5);

  const sampleRateCode = sampleRate === 44100 ? 0x9 : 0xa; // 1001=44.1kHz, 1010=48kHz
  const sampleSizeCode = bitDepth === 24 ? 0x6 : 0x4;      // 110=24-bit, 100=16-bit

  const frames: Uint8Array[] = [];
  let minFrameSize = Number.MAX_SAFE_INTEGER;
  let maxFrameSize = 0;
  let frameIndex = 0;

  for (let start = 0; start < numFrames; start += blockSize) {
    const curBlock = Math.min(blockSize, numFrames - start);
    const isFull4096 = curBlock === 4096;
    const blockCode = isFull4096 ? 0xc : 0x7; // 1100=4096, 0111=16-bit (blockSize-1) at end of header

    const headerBytes: number[] = [];
    // Sync code 0xFFF8 (fixed-blocksize stream)
    headerBytes.push(0xff, 0xf8);
    // Block size code (4 bits) + sample rate code (4 bits)
    headerBytes.push((blockCode << 4) | sampleRateCode);
    // Channel assignment 0001 (2 independent L/R) + sample size (3 bits) + 0 reserved
    headerBytes.push((0x1 << 4) | (sampleSizeCode << 1) | 0x0);
    // UTF-8 encoded frame number
    headerBytes.push(...encodeFlacUtf8Number(frameIndex));
    // Optional 16-bit (blocksize - 1)
    if (!isFull4096) {
      const bm1 = curBlock - 1;
      headerBytes.push((bm1 >> 8) & 0xff, bm1 & 0xff);
    }
    const headerArr = new Uint8Array(headerBytes);
    const crc8 = computeCrc8(headerArr, 0, headerArr.length);

    // Check if either channel is constant across the block (lossless compression on silence!)
    let leftConst = true;
    const l0 = leftInt[start];
    for (let i = 1; i < curBlock; i++) {
      if (leftInt[start + i] !== l0) {
        leftConst = false;
        break;
      }
    }
    let rightConst = true;
    const r0 = rightInt[start];
    for (let i = 1; i < curBlock; i++) {
      if (rightInt[start + i] !== r0) {
        rightConst = false;
        break;
      }
    }

    const leftSubSize = 1 + (leftConst ? bytesPerSample : curBlock * bytesPerSample);
    const rightSubSize = 1 + (rightConst ? bytesPerSample : curBlock * bytesPerSample);
    const frameSize = headerArr.length + 1 + leftSubSize + rightSubSize + 2;
    const frameBuf = new Uint8Array(frameSize);
    let p = 0;

    frameBuf.set(headerArr, p);
    p += headerArr.length;
    frameBuf[p++] = crc8;

    const writeSubframe = (channelData: Int32Array, isConstant: boolean) => {
      // Subframe header byte: 0 (pad) | 000000 (CONSTANT) or 000001 (VERBATIM) | 0 (no wasted bits)
      frameBuf[p++] = isConstant ? 0x00 : 0x02;
      const count = isConstant ? 1 : curBlock;
      if (bitDepth === 24) {
        for (let i = 0; i < count; i++) {
          const val = channelData[start + i];
          frameBuf[p++] = (val >> 16) & 0xff;
          frameBuf[p++] = (val >> 8) & 0xff;
          frameBuf[p++] = val & 0xff;
        }
      } else {
        for (let i = 0; i < count; i++) {
          const val = channelData[start + i];
          frameBuf[p++] = (val >> 8) & 0xff;
          frameBuf[p++] = val & 0xff;
        }
      }
    };

    writeSubframe(leftInt, leftConst);
    writeSubframe(rightInt, rightConst);

    const crc16 = computeCrc16(frameBuf, 0, p);
    frameBuf[p++] = (crc16 >> 8) & 0xff;
    frameBuf[p++] = crc16 & 0xff;

    frames.push(frameBuf);
    minFrameSize = Math.min(minFrameSize, frameSize);
    maxFrameSize = Math.max(maxFrameSize, frameSize);
    frameIndex++;
  }

  if (frames.length === 0) {
    minFrameSize = 0;
    maxFrameSize = 0;
  }

  const totalFramesBytes = frames.reduce((acc, f) => acc + f.length, 0);
  // 4 ("fLaC") + 4 (STREAMINFO header) + 34 (STREAMINFO body) + frames
  const out = new Uint8Array(42 + totalFramesBytes);
  const view = new DataView(out.buffer);

  // Magic
  writeAscii(view, 0, 'fLaC');
  // METADATA_BLOCK_HEADER: isLast=1 (0x80) | type=0 (STREAMINFO), length = 34 (0x000022)
  out[4] = 0x80;
  out[5] = 0x00;
  out[6] = 0x00;
  out[7] = 34;

  // STREAMINFO (34 bytes starting at offset 8)
  const minBlk = Math.min(blockSize, Math.max(16, numFrames));
  const maxBlk = blockSize;
  view.setUint16(8, minBlk, false);
  view.setUint16(10, maxBlk, false);
  // 24-bit minFrameSize
  out[12] = (minFrameSize >> 16) & 0xff;
  out[13] = (minFrameSize >> 8) & 0xff;
  out[14] = minFrameSize & 0xff;
  // 24-bit maxFrameSize
  out[15] = (maxFrameSize >> 16) & 0xff;
  out[16] = (maxFrameSize >> 8) & 0xff;
  out[17] = maxFrameSize & 0xff;

  // Sample rate (20 bits) | (channels-1) (3 bits = 1) | (bps-1) (5 bits) | totalSamples (36 bits)
  // Packed into 8 bytes (offsets 18..25)
  const sr = sampleRate & 0xfffff;
  const chMinus1 = 1; // Stereo = 2 channels -> 1
  const bpsMinus1 = (bitDepth - 1) & 0x1f;
  const totalSamplesHi = Math.floor(numFrames / 0x100000000) & 0xf; // top 4 bits of 36-bit count
  const totalSamplesLo = numFrames >>> 0;

  out[18] = (sr >> 12) & 0xff;
  out[19] = (sr >> 4) & 0xff;
  out[20] = ((sr & 0xf) << 4) | (chMinus1 << 1) | ((bpsMinus1 >> 4) & 0x1);
  out[21] = ((bpsMinus1 & 0xf) << 4) | totalSamplesHi;
  view.setUint32(22, totalSamplesLo, false);

  // MD5 signature (16 bytes at offsets 26..41)
  out.set(md5, 26);

  // Concatenate frames
  let cursor = 42;
  for (const f of frames) {
    out.set(f, cursor);
    cursor += f.length;
  }

  return out;
}

// ---------------------------------------------------------------------------
// Standard MIDI File (SMF Format 0) Encoder for Drum Patterns
// ---------------------------------------------------------------------------

function writeVlq(out: number[], value: number): void {
  let v = Math.max(0, Math.floor(value));
  const bytes: number[] = [v & 0x7f];
  v >>>= 7;
  while (v > 0) {
    bytes.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  for (let i = bytes.length - 1; i >= 0; i--) {
    out.push(bytes[i]);
  }
}

interface MidiEvent {
  tick: number;
  order: number; // 0 = note-off, 1 = note-on (ensure note-off precedes retrigger on same tick)
  bytes: number[];
}

/**
 * Encodes the current drum pattern, swing, velocities, and ratchet rolls into a
 * Standard MIDI File (.mid, Channel 10 General MIDI Drum Map).
 */
export function encodePatternToMidi(params: {
  name: string;
  bpm: number;
  swing: number;
  bars: number;
  channels: DrumChannel[];
  pattern: PatternData;
}): Uint8Array {
  const ppq = 480; // 480 ticks per quarter note -> 120 ticks per 16th step
  const ticksPerStep = ppq / 4;
  const safeBpm = clamp(params.bpm, 40, 240);
  const usPerQuarter = Math.round(60_000_000 / safeBpm);
  const stepDurSec = getStepDurationSeconds(safeBpm);

  const totalSteps = params.bars * 16;
  const events: MidiEvent[] = [];

  for (let stepIdx = 0; stepIdx < totalSteps; stepIdx++) {
    const patStep = stepIdx % params.pattern.length;
    const swingSec = getSwingOffsetSeconds(stepIdx, safeBpm, params.swing);
    const swingTicks = Math.round((swingSec / stepDurSec) * ticksPerStep);
    const baseTick = stepIdx * ticksPerStep + swingTicks;

    for (const ch of params.channels) {
      if (!isChannelAudible(ch, params.channels)) continue;
      const step = params.pattern.steps[ch.id]?.[patStep];
      if (!step || !step.active) continue;

      const rollOffsets = getRatchetOffsets(stepDurSec, step.roll);
      const subTicks = Math.max(12, Math.floor(ticksPerStep / step.roll));
      const noteLen = Math.max(10, Math.floor(subTicks * 0.65));

      for (let r = 0; r < rollOffsets.length; r++) {
        const subOffsetTicks = Math.round((rollOffsets[r] / stepDurSec) * ticksPerStep);
        const startTick = baseTick + subOffsetTicks;
        const velFactor = step.accent ? Math.min(1, step.velocity * 1.15) : step.velocity;
        const midiVel = clamp(Math.round(velFactor * 127), 1, 127);
        const note = clamp(ch.midiNote + Math.round(step.pitchOffset), 24, 96);

        events.push({
          tick: startTick,
          order: 1,
          bytes: [0x99, note, midiVel], // Channel 10 Note On
        });
        events.push({
          tick: startTick + noteLen,
          order: 0,
          bytes: [0x89, note, 0], // Channel 10 Note Off
        });
      }
    }
  }

  events.sort((a, b) => (a.tick !== b.tick ? a.tick - b.tick : a.order - b.order));

  const trackData: number[] = [];

  // Track Name meta event (FF 03 len text)
  const cleanName = (params.name || 'VOLT 808 Pattern').slice(0, 60);
  const nameBytes = Array.from(cleanName).map((c) => c.charCodeAt(0) & 0x7f);
  trackData.push(0x00, 0xff, 0x03, nameBytes.length, ...nameBytes);

  // Set Tempo meta event (FF 51 03 tt tt tt)
  trackData.push(
    0x00,
    0xff,
    0x51,
    0x03,
    (usPerQuarter >> 16) & 0xff,
    (usPerQuarter >> 8) & 0xff,
    usPerQuarter & 0xff
  );

  // Time Signature 4/4 meta event (FF 58 04 04 02 18 08)
  trackData.push(0x00, 0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08);

  let lastTick = 0;
  for (const ev of events) {
    const delta = Math.max(0, ev.tick - lastTick);
    writeVlq(trackData, delta);
    trackData.push(...ev.bytes);
    lastTick = ev.tick;
  }

  // End of Track meta event (FF 2F 00)
  const endTick = Math.max(lastTick, totalSteps * ticksPerStep);
  writeVlq(trackData, Math.max(0, endTick - lastTick));
  trackData.push(0xff, 0x2f, 0x00);

  // Assemble SMF header + track chunk
  const totalBytes = 14 + 8 + trackData.length;
  const out = new Uint8Array(totalBytes);
  const view = new DataView(out.buffer);

  writeAscii(view, 0, 'MThd');
  view.setUint32(4, 6, false);    // header length
  view.setUint16(8, 0, false);    // format 0
  view.setUint16(10, 1, false);   // 1 track
  view.setUint16(12, ppq, false); // ticks per quarter note

  writeAscii(view, 14, 'MTrk');
  view.setUint32(18, trackData.length, false);
  out.set(trackData, 22);

  return out;
}
