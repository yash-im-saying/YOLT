import { clamp } from './sequencerMath';

export interface AdsrSchedule {
  startTime: number;
  attackEndTime: number;
  decayEndTime: number;
  releaseStartTime: number;
  releaseEndTime: number;
  stopTime: number;
  sustainLevel: number;
}

export interface AdsrInputs {
  startTime: number;
  attackMs: number;
  decayMs: number;
  sustainPercent: number;
  releaseMs: number;
  /** Optional natural duration of a sample buffer (after playbackRate scaling). */
  sampleDurationSec?: number;
}

const MIN_ATTACK_SEC = 0.0012;
const MIN_RELEASE_SEC = 0.008;
const STOP_SAFETY_MARGIN_SEC = 0.025;

/**
 * Computes click-free ADSR envelope breakpoints for both synthesized drums and user samples.
 * Guarantees:
 * - Amplitude ramps smoothly to exact 0.0 at `releaseEndTime`
 * - `stopTime` is strictly after `releaseEndTime` so sources never hard-cut while audible
 * - When `sampleDurationSec` is provided, `releaseEndTime` never exceeds the buffer tail
 */
export function computeAdsrSchedule(input: AdsrInputs): AdsrSchedule {
  const startTime = Math.max(0, input.startTime);
  const attackSec = Math.max(MIN_ATTACK_SEC, clamp(input.attackMs, 0, 500) / 1000);
  const decaySec = clamp(input.decayMs, 15, 2500) / 1000;
  const sustainLevel = clamp(input.sustainPercent, 0, 100) / 100;
  const releaseSec = Math.max(MIN_RELEASE_SEC, clamp(input.releaseMs, 5, 2500) / 1000);

  if (input.sampleDurationSec !== undefined && input.sampleDurationSec > 0) {
    const dur = Math.max(0.012, input.sampleDurationSec);
    // Clamp stages gracefully inside the available sample duration so the tail always fades to 0
    const effAttack = Math.min(attackSec, dur * 0.35);
    const effRelease = Math.min(releaseSec, Math.max(0.004, dur - effAttack));

    if (sustainLevel <= 0.001) {
      // Percussive AD + anti-click release tail inside sample duration
      const maxDecay = Math.max(0.004, dur - effAttack - effRelease);
      const effDecay = Math.min(decaySec, maxDecay);
      const attackEndTime = startTime + effAttack;
      const decayEndTime = attackEndTime + effDecay;
      const releaseStartTime = decayEndTime;
      const releaseEndTime = Math.min(startTime + dur, releaseStartTime + effRelease);
      return {
        startTime,
        attackEndTime,
        decayEndTime,
        releaseStartTime,
        releaseEndTime,
        stopTime: releaseEndTime + STOP_SAFETY_MARGIN_SEC,
        sustainLevel: 0,
      };
    }

    // With sustain > 0, hold up to the natural sample length minus release (capped at 6s)
    const maxHoldWindow = Math.min(6.0, dur);
    const effDecay = Math.min(decaySec, Math.max(0.004, maxHoldWindow - effAttack - effRelease));
    const holdSec = Math.max(0, maxHoldWindow - effAttack - effDecay - effRelease);
    const attackEndTime = startTime + effAttack;
    const decayEndTime = attackEndTime + effDecay;
    const releaseStartTime = decayEndTime + holdSec;
    const releaseEndTime = Math.min(startTime + dur, releaseStartTime + effRelease);

    return {
      startTime,
      attackEndTime,
      decayEndTime,
      releaseStartTime,
      releaseEndTime,
      stopTime: releaseEndTime + STOP_SAFETY_MARGIN_SEC,
      sustainLevel,
    };
  }

  // Synthesized drum voice schedule
  const attackEndTime = startTime + attackSec;
  const decayEndTime = attackEndTime + decaySec;

  if (sustainLevel <= 0.001) {
    // Percussive curve: Decay brings level down smoothly, Release carries the final tail to exact 0.0
    const tailSec = Math.max(MIN_RELEASE_SEC, releaseSec * 0.35);
    const releaseStartTime = decayEndTime;
    const releaseEndTime = releaseStartTime + tailSec;
    return {
      startTime,
      attackEndTime,
      decayEndTime,
      releaseStartTime,
      releaseEndTime,
      stopTime: releaseEndTime + STOP_SAFETY_MARGIN_SEC,
      sustainLevel: 0,
    };
  }

  // Sustained drum body (808s, long kicks, cymbals): proportional hold window then smooth release to 0.0
  const holdSec = 0.02 + sustainLevel * 0.28;
  const releaseStartTime = decayEndTime + holdSec;
  const releaseEndTime = releaseStartTime + releaseSec;

  return {
    startTime,
    attackEndTime,
    decayEndTime,
    releaseStartTime,
    releaseEndTime,
    stopTime: releaseEndTime + STOP_SAFETY_MARGIN_SEC,
    sustainLevel,
  };
}

/**
 * Applies a click-free ADSR gain automation curve to an AudioParam,
 * always starting at 0 and ending at exact 0.0 at `schedule.releaseEndTime`.
 */
export function applyAdsrToGain(
  gainParam: AudioParam,
  schedule: AdsrSchedule,
  peakGain = 1.0
): void {
  const {
    startTime,
    attackEndTime,
    decayEndTime,
    releaseStartTime,
    releaseEndTime,
    sustainLevel,
  } = schedule;

  const peak = Math.max(0.001, peakGain);
  gainParam.cancelScheduledValues(startTime);
  gainParam.setValueAtTime(0, startTime);
  gainParam.linearRampToValueAtTime(peak, attackEndTime);

  if (sustainLevel <= 0.001) {
    // Exponential percussive drop to a low knee, then smooth linear ramp to exact 0.0
    const knee = Math.max(0.0005, peak * 0.015);
    if (decayEndTime > attackEndTime + 0.001) {
      gainParam.exponentialRampToValueAtTime(knee, decayEndTime);
    } else {
      gainParam.linearRampToValueAtTime(knee, decayEndTime);
    }
    gainParam.linearRampToValueAtTime(0, releaseEndTime);
  } else {
    const susGain = Math.max(0.001, peak * sustainLevel);
    if (decayEndTime > attackEndTime + 0.001) {
      gainParam.exponentialRampToValueAtTime(susGain, decayEndTime);
    } else {
      gainParam.linearRampToValueAtTime(susGain, decayEndTime);
    }

    if (releaseStartTime > decayEndTime) {
      gainParam.setValueAtTime(susGain, releaseStartTime);
    }

    // Two-stage exponential-then-linear release to exact 0.0 (eliminates click completely)
    const relDur = Math.max(0.004, releaseEndTime - releaseStartTime);
    const expEnd = releaseStartTime + relDur * 0.82;
    const floorGain = Math.max(0.0004, susGain * 0.012);
    if (expEnd > releaseStartTime + 0.002) {
      gainParam.exponentialRampToValueAtTime(floorGain, expEnd);
    }
    gainParam.linearRampToValueAtTime(0, releaseEndTime);
  }
}

/**
 * Generates an asymmetric analog saturation curve that is strictly DC-centered:
 * curve(0) === 0.0 so idle or decaying voices never inject a DC step/pop.
 */
export function buildZeroDcSaturationCurve(driveAmount: number): Float32Array<ArrayBuffer> {
  const samples = 2049; // odd length guarantees exact center index 1024 === x = 0.0
  const curve = new Float32Array(new ArrayBuffer(samples * 4));
  const clamped = clamp(driveAmount, 0, 100);
  if (clamped <= 0.5) {
    for (let i = 0; i < samples; i++) {
      curve[i] = (i / (samples - 1)) * 2 - 1;
    }
    return curve;
  }

  const k = 1 + (clamped / 100) * 14;
  const asymShift = 0.055 * (clamped / 100);
  const dcAtZero = Math.tanh(asymShift * k);
  const maxPos = Math.abs(Math.tanh((1 + asymShift) * k) - dcAtZero);
  const maxNeg = Math.abs(Math.tanh((-1 + asymShift) * k) - dcAtZero);
  const norm = Math.max(maxPos, maxNeg, 1e-6);

  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    const raw = Math.tanh((x + asymShift) * k) - dcAtZero;
    curve[i] = raw / norm;
  }
  curve[(samples - 1) / 2] = 0;
  return curve;
}
