import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultStep,
  evaluateLfoValue,
  generateEuclideanPattern,
  getRatchetOffsets,
  getStepDurationSeconds,
  getSwingOffsetSeconds,
  isChannelAudible,
  resolveModulatedParams,
  shiftChannelSteps,
} from './sequencerMath';
import { createChannelFromArchetype } from './presets';
import type { LfoConfig } from '../types/drum';

test('step duration computes exact 16th-note seconds at 120 BPM', () => {
  assert.equal(getStepDurationSeconds(120), 0.125);
  assert.equal(getStepDurationSeconds(60), 0.25);
});

test('swing offsets only odd 16th steps and scales proportionally', () => {
  assert.equal(getSwingOffsetSeconds(0, 120, 50), 0);
  assert.equal(getSwingOffsetSeconds(2, 120, 50), 0);
  const oddOffset = getSwingOffsetSeconds(1, 120, 50);
  assert.ok(Math.abs(oddOffset - 0.125 * 0.5 * 0.66) < 1e-9);
  assert.equal(getSwingOffsetSeconds(1, 120, 0), 0);
});

test('ratchet offsets subdivide step duration evenly', () => {
  const offsets = getRatchetOffsets(0.12, 4);
  assert.equal(offsets.length, 4);
  assert.ok(Math.abs(offsets[0] - 0) < 1e-9);
  assert.ok(Math.abs(offsets[1] - 0.03) < 1e-9);
  assert.ok(Math.abs(offsets[2] - 0.06) < 1e-9);
  assert.ok(Math.abs(offsets[3] - 0.09) < 1e-9);
});

test('LFO sine and triangle evaluation stay within depth bounds', () => {
  const lfo: LfoConfig = {
    id: 'lfo1',
    name: 'LFO 1',
    enabled: true,
    shape: 'sine',
    sync: '1/4',
    rateHz: 2,
    depth: 50,
    target: 'cutoff',
    channelId: 'all',
  };
  // At 120 BPM, 1/4 note = 2 Hz -> quarter cycle at t = 0.125s -> sin(pi/2) = 1 -> * 0.5 = 0.5
  const peak = evaluateLfoValue(lfo, 0.125, 120);
  assert.ok(Math.abs(peak - 0.5) < 1e-6);

  const disabled = evaluateLfoValue({ ...lfo, enabled: false }, 0.125, 120);
  assert.equal(disabled, 0);
});

test('resolveModulatedParams applies step P-locks and LFO modulation with safe clamping', () => {
  const ch = createChannelFromArchetype('ch1', 'spinz-808');
  const step = { ...createDefaultStep(true), pitchOffset: 7, filterOffset: 25 };
  const lfos: [LfoConfig, LfoConfig] = [
    {
      id: 'lfo1',
      name: 'LFO 1',
      enabled: true,
      shape: 'sine',
      sync: '1/4',
      rateHz: 2,
      depth: 100,
      target: 'pan',
      channelId: 'ch1',
    },
    {
      id: 'lfo2',
      name: 'LFO 2',
      enabled: false,
      shape: 'triangle',
      sync: '1/8',
      rateHz: 4,
      depth: 50,
      target: 'none',
      channelId: 'all',
    },
  ];

  const resolved = resolveModulatedParams(ch, 'ch1', step, lfos, 0.125, 120);
  assert.equal(resolved.tune, ch.params.tune + 7);
  assert.ok(resolved.filterCutoff > ch.params.filterCutoff);
  assert.ok(resolved.pan > 0.85 && resolved.pan <= 1);
});

test('mute and solo audibility logic respects solo override', () => {
  const ch1 = createChannelFromArchetype('ch1', 'rack-kick');
  const ch2 = createChannelFromArchetype('ch2', 'spinz-808');
  ch2.mute = true;

  assert.equal(isChannelAudible(ch1, [ch1, ch2]), true);
  assert.equal(isChannelAudible(ch2, [ch1, ch2]), false);

  ch2.solo = true;
  assert.equal(isChannelAudible(ch1, [ch1, ch2]), false);
  assert.equal(isChannelAudible(ch2, [ch1, ch2]), true);
});

test('Euclidean rhythm generator distributes exact pulse count', () => {
  const tresillo = generateEuclideanPattern(16, 5);
  assert.equal(tresillo.length, 16);
  assert.equal(tresillo.filter(Boolean).length, 5);
});

test('shiftChannelSteps wraps hits within active pattern length', () => {
  const steps = Array.from({ length: 32 }, (_, i) => createDefaultStep(i === 0));
  const shiftedRight = shiftChannelSteps(steps, 16, 1);
  assert.equal(shiftedRight[0].active, false);
  assert.equal(shiftedRight[1].active, true);
  const shiftedBack = shiftChannelSteps(shiftedRight, 16, -1);
  assert.equal(shiftedBack[0].active, true);
});
