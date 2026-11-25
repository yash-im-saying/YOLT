import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAdsrToGain,
  buildZeroDcSaturationCurve,
  computeAdsrSchedule,
} from './envelopeMath.ts';
import {
  extractWaveformPeaks,
  makeShortSampleTag,
} from './sampleStore.ts';

describe('buildZeroDcSaturationCurve (pop-free saturation)', () => {
  it('strictly maps 0.0 input to exact 0.0 output across all drive levels', () => {
    for (const drive of [0, 1, 15, 35, 66, 100]) {
      const curve = buildZeroDcSaturationCurve(drive);
      assert.equal(curve.length % 2, 1, 'Curve length must be odd for exact center index');
      const center = (curve.length - 1) / 2;
      assert.equal(curve[center], 0, `DC offset at drive=${drive} must be exact 0`);
      assert.ok(Math.abs(curve[0]) <= 1.0001 && Math.abs(curve[curve.length - 1]) <= 1.0001);
    }
  });
});

describe('computeAdsrSchedule & applyAdsrToGain', () => {
  it('maintains strictly ordered timestamps and stops after releaseEndTime for sustained synth voices', () => {
    const s = computeAdsrSchedule({
      startTime: 1.0,
      attackMs: 12,
      decayMs: 420,
      sustainPercent: 35,
      releaseMs: 180,
    });
    assert.ok(s.startTime < s.attackEndTime);
    assert.ok(s.attackEndTime < s.decayEndTime);
    assert.ok(s.decayEndTime < s.releaseStartTime);
    assert.ok(s.releaseStartTime < s.releaseEndTime);
    assert.ok(s.releaseEndTime < s.stopTime);
    assert.ok(s.stopTime - s.releaseEndTime >= 0.02);
  });

  it('clamps user-sample ADSR envelope inside natural sample duration so tail hits 0 before buffer ends', () => {
    const sampleDurationSec = 0.28;
    const s = computeAdsrSchedule({
      startTime: 2.0,
      attackMs: 5,
      decayMs: 1500,
      sustainPercent: 100,
      releaseMs: 800,
      sampleDurationSec,
    });
    assert.ok(s.releaseEndTime <= 2.0 + sampleDurationSec + 1e-6);
    assert.ok(s.releaseEndTime > s.releaseStartTime);
    assert.ok(s.stopTime > s.releaseEndTime);
  });

  it('ramps AudioParam linearly to exact 0.0 at releaseEndTime for both percussive and sustained curves', () => {
    const events: Array<{ fn: string; val: number; time: number }> = [];
    const fakeParam = {
      cancelScheduledValues(t: number) {
        events.push({ fn: 'cancel', val: 0, time: t });
      },
      setValueAtTime(v: number, t: number) {
        events.push({ fn: 'set', val: v, time: t });
      },
      linearRampToValueAtTime(v: number, t: number) {
        events.push({ fn: 'lin', val: v, time: t });
      },
      exponentialRampToValueAtTime(v: number, t: number) {
        events.push({ fn: 'exp', val: v, time: t });
      },
    } as unknown as AudioParam;

    for (const sustainPercent of [0, 45, 100]) {
      events.length = 0;
      const sched = computeAdsrSchedule({
        startTime: 0.5,
        attackMs: 4,
        decayMs: 250,
        sustainPercent,
        releaseMs: 90,
      });
      applyAdsrToGain(fakeParam, sched, 1.0);
      assert.equal(events[1].fn, 'set');
      assert.equal(events[1].val, 0);
      const last = events[events.length - 1];
      assert.equal(last.fn, 'lin', 'Final stage must be linear ramp to exact 0');
      assert.equal(last.val, 0, 'Final amplitude must reach exact 0.0');
      assert.equal(last.time, sched.releaseEndTime);
    }
  });
});

describe('sampleStore helpers', () => {
  it('extracts normalized waveform peaks in [0, 1] and formats short 4-char tags', () => {
    const left = new Float32Array(1000);
    const right = new Float32Array(1000);
    for (let i = 0; i < 1000; i++) {
      left[i] = Math.sin(i * 0.1) * (1 - i / 1000);
      right[i] = left[i] * 0.8;
    }
    const peaks = extractWaveformPeaks(left, right, 32);
    assert.equal(peaks.length, 32);
    assert.ok(peaks.every((p) => p >= 0 && p <= 1));
    assert.ok(Math.max(...peaks) === 1);
    assert.equal(makeShortSampleTag('Vintage_Snare_01'), 'VINT');
    assert.equal(makeShortSampleTag('bd'), 'BDX');
  });
});
