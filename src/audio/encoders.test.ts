import test from 'node:test';
import assert from 'node:assert/strict';
import {
  encodeAiffStereo,
  encodeFlacStereo,
  encodeIeee80Extended,
  encodePatternToMidi,
  encodeWavStereo,
  floatToSignedInt,
} from './encoders';
import { FACTORY_PRESETS } from './presets';

function readAscii(bytes: Uint8Array, start: number, len: number): string {
  return String.fromCharCode(...bytes.slice(start, start + len));
}

test('floatToSignedInt quantizes 24-bit and 16-bit full scale cleanly', () => {
  assert.equal(floatToSignedInt(1, 24), 8388607);
  assert.equal(floatToSignedInt(-1, 24), -8388608);
  assert.equal(floatToSignedInt(0, 24), 0);
  assert.equal(floatToSignedInt(1, 16), 32767);
  assert.equal(floatToSignedInt(-1, 16), -32768);
});

test('encodeWavStereo produces valid 24-bit stereo RIFF/WAVE header and little-endian samples', () => {
  const left = new Float32Array([0, 0.5, -0.5, 1.0]);
  const right = new Float32Array([0, -0.25, 0.25, -1.0]);
  const wav = encodeWavStereo(left, right, 48000, 24);
  const view = new DataView(wav.buffer);

  assert.equal(readAscii(wav, 0, 4), 'RIFF');
  assert.equal(readAscii(wav, 8, 4), 'WAVE');
  assert.equal(readAscii(wav, 12, 4), 'fmt ');
  assert.equal(view.getUint16(20, true), 1);     // PCM
  assert.equal(view.getUint16(22, true), 2);     // Stereo
  assert.equal(view.getUint32(24, true), 48000); // 48kHz
  assert.equal(view.getUint16(32, true), 6);     // Block align = 2 * 3 bytes
  assert.equal(view.getUint16(34, true), 24);    // 24-bit
  assert.equal(readAscii(wav, 36, 4), 'data');
  assert.equal(view.getUint32(40, true), 4 * 6);
  assert.equal(wav.length, 44 + 24);

  // Verify sample frame 3 left = +8388607 (0x7FFFFF) little-endian -> FF FF 7F
  const s3Offset = 44 + 3 * 6;
  assert.equal(wav[s3Offset], 0xff);
  assert.equal(wav[s3Offset + 1], 0xff);
  assert.equal(wav[s3Offset + 2], 0x7f);
});

test('encodeIeee80Extended encodes 48000 Hz and 44100 Hz accurately', () => {
  // Known IEEE 80-bit extended bytes for 44100: 40 0E AC 44 00 00 00 00 00 00
  const ext44100 = encodeIeee80Extended(44100);
  assert.deepEqual(Array.from(ext44100), [0x40, 0x0e, 0xac, 0x44, 0, 0, 0, 0, 0, 0]);

  // Known IEEE 80-bit extended bytes for 48000: 40 0E BB 80 00 00 00 00 00 00
  const ext48000 = encodeIeee80Extended(48000);
  assert.deepEqual(Array.from(ext48000), [0x40, 0x0e, 0xbb, 0x80, 0, 0, 0, 0, 0, 0]);
});

test('encodeAiffStereo produces valid 24-bit stereo FORM/AIFF binary', () => {
  const left = new Float32Array([0, 0.5, -0.5, 1.0]);
  const right = new Float32Array([0, -0.5, 0.5, -1.0]);
  const aiff = encodeAiffStereo(left, right, 48000, 24);
  const view = new DataView(aiff.buffer);

  assert.equal(readAscii(aiff, 0, 4), 'FORM');
  assert.equal(readAscii(aiff, 8, 4), 'AIFF');
  assert.equal(readAscii(aiff, 12, 4), 'COMM');
  assert.equal(view.getUint16(20, false), 2);   // Stereo
  assert.equal(view.getUint32(22, false), 4);   // 4 frames
  assert.equal(view.getUint16(26, false), 24);  // 24-bit
  assert.equal(readAscii(aiff, 38, 4), 'SSND');
  assert.equal(view.getUint32(42, false), 8 + 24);

  // Verify sample frame 3 left = +8388607 (0x7FFFFF) big-endian -> 7F FF FF
  const s3Offset = 54 + 3 * 6;
  assert.equal(aiff[s3Offset], 0x7f);
  assert.equal(aiff[s3Offset + 1], 0xff);
  assert.equal(aiff[s3Offset + 2], 0xff);
});

test('encodeFlacStereo produces spec-compliant 24-bit stereo RFC 9639 FLAC with valid STREAMINFO and frames', () => {
  const len = 5000; // tests multi-frame (4096 + 904 partial frame)
  const left = new Float32Array(len);
  const right = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    left[i] = Math.sin((i / 48000) * 440 * Math.PI * 2) * 0.6;
    right[i] = 0; // silent right channel tests CONSTANT subframe compression!
  }

  const flac = encodeFlacStereo(left, right, 48000, 24);
  const view = new DataView(flac.buffer);

  assert.equal(readAscii(flac, 0, 4), 'fLaC');
  assert.equal(flac[4], 0x80); // last metadata block + type 0 (STREAMINFO)
  assert.equal(flac[7], 34);   // 34-byte STREAMINFO

  // Verify sample rate (48000), channels (2 -> stored as 1), bit depth (24 -> stored as 23), total samples (5000)
  const sr = (flac[18] << 12) | (flac[19] << 4) | (flac[20] >> 4);
  const chMinus1 = (flac[20] >> 1) & 0x7;
  const bpsMinus1 = ((flac[20] & 0x1) << 4) | (flac[21] >> 4);
  const totalSamplesLo = view.getUint32(22, false);

  assert.equal(sr, 48000);
  assert.equal(chMinus1, 1);
  assert.equal(bpsMinus1, 23);
  assert.equal(totalSamplesLo, len);

  // First audio frame starts at byte 42 with sync code 0xFFF8
  assert.equal(flac[42], 0xff);
  assert.equal(flac[43], 0xf8);

  // Because right channel is silent (CONSTANT), file should be significantly smaller than uncompressed 24-bit stereo (30,000 bytes)
  assert.ok(flac.length < 20000, `Expected silent-channel FLAC compression, got ${flac.length} bytes`);
});

test('encodePatternToMidi creates valid SMF Format 0 drum MIDI with tempo and Channel 10 notes', () => {
  const preset = FACTORY_PRESETS[1]; // Atlanta Spinz (has rolls & accents)
  const midi = encodePatternToMidi({
    name: preset.name,
    bpm: preset.bpm,
    swing: preset.swing,
    bars: 2,
    channels: preset.channels,
    pattern: preset.patterns.A,
  });
  const view = new DataView(midi.buffer);

  assert.equal(readAscii(midi, 0, 4), 'MThd');
  assert.equal(view.getUint32(4, false), 6);
  assert.equal(view.getUint16(8, false), 0);   // Format 0
  assert.equal(view.getUint16(10, false), 1);  // 1 track
  assert.equal(view.getUint16(12, false), 480);// 480 PPQ
  assert.equal(readAscii(midi, 14, 4), 'MTrk');

  // Verify channel 10 Note-On events (0x99) and End-Of-Track (FF 2F 00) exist
  let hasNoteOn = false;
  for (let i = 22; i < midi.length; i++) {
    if (midi[i] === 0x99) {
      hasNoteOn = true;
      break;
    }
  }
  assert.equal(hasNoteOn, true);
  assert.equal(midi[midi.length - 3], 0xff);
  assert.equal(midi[midi.length - 2], 0x2f);
  assert.equal(midi[midi.length - 1], 0x00);
});
