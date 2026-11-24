import type { VoiceArchetype, VoiceParams } from '../types/drum';
import { ARCHETYPES } from './presets';
import { clamp } from './sequencerMath';

export interface VoiceBusTargets {
  dryBus: AudioNode;
  reverbSend: AudioNode;
  delaySend: AudioNode;
}

export interface ActiveVoiceHandle {
  choke: (atTime: number) => void;
}

const noiseBufferCache = new WeakMap<BaseAudioContext, AudioBuffer>();
const curveCache = new Map<string, Float32Array<ArrayBuffer>>();

function getWhiteNoiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const cached = noiseBufferCache.get(ctx);
  if (cached) return cached;
  const length = Math.ceil(ctx.sampleRate * 2.5);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  // Deterministic LCG seeded noise so live and offline renders sound identical and punchy
  let seed = 0x13579bdf;
  for (let i = 0; i < length; i++) {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    data[i] = (seed / 0xffffffff) * 2 - 1;
  }
  noiseBufferCache.set(ctx, buffer);
  return buffer;
}

/**
 * Generates an asymmetric analog tape/transistor saturation waveshaper curve.
 */
export function getSaturationCurve(driveAmount: number): Float32Array<ArrayBuffer> {
  const key = Math.round(clamp(driveAmount, 0, 100)).toString();
  const cached = curveCache.get(key);
  if (cached) return cached;

  const samples = 2048;
  const curve = new Float32Array(new ArrayBuffer(samples * 4));
  const k = 1 + (clamp(driveAmount, 0, 100) / 100) * 14;
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    // Slight even-order harmonic asymmetry for warm vintage analog character
    const shifted = x + 0.06 * (k / 15);
    curve[i] = Math.tanh(shifted * k) / Math.tanh(k);
  }
  curveCache.set(key, curve);
  return curve;
}

function semitoneRatio(semitones: number): number {
  return Math.pow(2, semitones / 12);
}

/**
 * Synthesizes and triggers one drum hit on either a live AudioContext or OfflineAudioContext.
 * Returns a choke handle so open hats or 808 glides can be cleanly muted by choke groups.
 */
export function triggerSynthesizedVoice(
  ctx: BaseAudioContext,
  archetype: VoiceArchetype,
  params: VoiceParams,
  velocity: number,
  when: number,
  targets: VoiceBusTargets
): ActiveVoiceHandle {
  const t = Math.max(ctx.currentTime, when);
  const meta = ARCHETYPES[archetype];
  const pitchRatio = semitoneRatio(params.tune);
  const vel = clamp(velocity, 0.05, 1.15);
  const attackSec = Math.max(0.0008, params.attack / 1000);
  const decaySec = clamp(params.decay / 1000, 0.02, 2.5);
  const pitchDecaySec = clamp(params.pitchDecay / 1000, 0.005, 0.35);
  const toneNorm = clamp(params.tone / 100, 0, 1);
  const snapNorm = clamp(params.snap / 100, 0, 1);

  // Per-voice output chain: VoiceSum -> Filter -> Drive -> ChokeGain -> Level -> StereoPanner -> Sends
  const voiceSum = ctx.createGain();
  voiceSum.gain.value = 1;

  const filter = ctx.createBiquadFilter();
  filter.type = params.filterMode;
  filter.frequency.setValueAtTime(clamp(params.filterCutoff, 60, 19000), t);
  filter.Q.setValueAtTime(clamp(params.filterRes, 0.5, 18), t);

  const shaper = ctx.createWaveShaper();
  shaper.oversample = '2x';
  shaper.curve = getSaturationCurve(params.drive);

  const chokeGain = ctx.createGain();
  chokeGain.gain.setValueAtTime(1, t);

  const levelGain = ctx.createGain();
  levelGain.gain.setValueAtTime(clamp(params.level * vel, 0, 1.35), t);

  const panner = ctx.createStereoPanner();
  panner.pan.setValueAtTime(clamp(params.pan, -1, 1), t);

  voiceSum.connect(filter);
  filter.connect(shaper);
  shaper.connect(chokeGain);
  chokeGain.connect(levelGain);
  levelGain.connect(panner);

  panner.connect(targets.dryBus);

  if (params.reverbSend > 0.005) {
    const revGain = ctx.createGain();
    revGain.gain.setValueAtTime(clamp(params.reverbSend, 0, 1), t);
    panner.connect(revGain);
    revGain.connect(targets.reverbSend);
  }
  if (params.delaySend > 0.005) {
    const dlyGain = ctx.createGain();
    dlyGain.gain.setValueAtTime(clamp(params.delaySend, 0, 1), t);
    panner.connect(dlyGain);
    dlyGain.connect(targets.delaySend);
  }

  const stopAt = t + decaySec + 0.12;
  const noiseBuf = getWhiteNoiseBuffer(ctx);

  switch (archetype) {
    case 'rack-kick': {
      // Punchy hip-hop/trap Rack Kick: dual-stage pitch sweep + warm knock body + sharp transient click
      const baseF = meta.baseFreq * pitchRatio;
      const startF = baseF * (1 + (params.pitchEnv / 100) * 5.2);
      const midF = baseF * 1.48;

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(startF, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(24, midF), t + pitchDecaySec * 0.42);
      osc.frequency.exponentialRampToValueAtTime(Math.max(22, baseF), t + pitchDecaySec);

      // Subtle triangle layer for punchy mid-low knock
      const knockOsc = ctx.createOscillator();
      knockOsc.type = 'triangle';
      knockOsc.frequency.setValueAtTime(startF * 1.15, t);
      knockOsc.frequency.exponentialRampToValueAtTime(Math.max(30, baseF * 1.1), t + pitchDecaySec * 0.6);

      const knockGain = ctx.createGain();
      knockGain.gain.setValueAtTime(0.32 * toneNorm, t);
      knockGain.gain.exponentialRampToValueAtTime(0.001, t + Math.min(decaySec, 0.14));

      const amp = ctx.createGain();
      amp.gain.setValueAtTime(0.0001, t);
      amp.gain.linearRampToValueAtTime(1.05, t + attackSec);
      amp.gain.exponentialRampToValueAtTime(0.0008, t + decaySec);

      osc.connect(amp);
      knockOsc.connect(knockGain);
      knockGain.connect(amp);
      amp.connect(voiceSum);

      // Crisp beater/rack click transient
      if (snapNorm > 0.02) {
        const clickSrc = ctx.createBufferSource();
        clickSrc.buffer = noiseBuf;
        const clickBp = ctx.createBiquadFilter();
        clickBp.type = 'bandpass';
        clickBp.frequency.setValueAtTime(2400 + toneNorm * 1800, t);
        clickBp.Q.setValueAtTime(1.5, t);
        const clickAmp = ctx.createGain();
        clickAmp.gain.setValueAtTime(0.65 * snapNorm, t);
        clickAmp.gain.exponentialRampToValueAtTime(0.0008, t + 0.016);
        clickSrc.connect(clickBp);
        clickBp.connect(clickAmp);
        clickAmp.connect(voiceSum);
        clickSrc.start(t);
        clickSrc.stop(t + 0.028);
      }

      osc.start(t);
      knockOsc.start(t);
      osc.stop(stopAt);
      knockOsc.stop(stopAt);
      break;
    }

    case 'spinz-808': {
      // Iconic Spinz 808: warm sub fundamental + 2nd/3rd harmonic richness + resonant 125Hz warmth + long smooth decay
      const baseF = meta.baseFreq * pitchRatio;
      const startF = baseF * (1 + (params.pitchEnv / 100) * 3.1);

      const subOsc = ctx.createOscillator();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(startF, t);
      subOsc.frequency.exponentialRampToValueAtTime(Math.max(24, baseF), t + pitchDecaySec);

      // Warm harmonic overtone osc for classic Spinz midrange audibility on small speakers
      const harmOsc = ctx.createOscillator();
      harmOsc.type = 'triangle';
      harmOsc.frequency.setValueAtTime(startF * 2, t);
      harmOsc.frequency.exponentialRampToValueAtTime(Math.max(48, baseF * 2), t + pitchDecaySec);

      const harmGain = ctx.createGain();
      harmGain.gain.setValueAtTime(0.22 * toneNorm, t);
      harmGain.gain.exponentialRampToValueAtTime(0.02 * toneNorm + 0.001, t + decaySec * 0.75);

      const bodyEq = ctx.createBiquadFilter();
      bodyEq.type = 'peaking';
      bodyEq.frequency.setValueAtTime(118 * pitchRatio, t);
      bodyEq.Q.setValueAtTime(1.8, t);
      bodyEq.gain.setValueAtTime(4.5 * toneNorm, t);

      const amp = ctx.createGain();
      amp.gain.setValueAtTime(0.0001, t);
      amp.gain.linearRampToValueAtTime(1.0, t + attackSec);
      amp.gain.setTargetAtTime(0.0008, t + attackSec + 0.02, decaySec * 0.34);

      subOsc.connect(bodyEq);
      harmOsc.connect(harmGain);
      harmGain.connect(bodyEq);
      bodyEq.connect(amp);
      amp.connect(voiceSum);

      // Subtle punchy thump transient
      if (snapNorm > 0.02) {
        const thump = ctx.createOscillator();
        thump.type = 'sine';
        thump.frequency.setValueAtTime(220 * pitchRatio, t);
        thump.frequency.exponentialRampToValueAtTime(55, t + 0.018);
        const thumpGain = ctx.createGain();
        thumpGain.gain.setValueAtTime(0.45 * snapNorm, t);
        thumpGain.gain.exponentialRampToValueAtTime(0.0008, t + 0.024);
        thump.connect(thumpGain);
        thumpGain.connect(voiceSum);
        thump.start(t);
        thump.stop(t + 0.032);
      }

      subOsc.start(t);
      harmOsc.start(t);
      subOsc.stop(stopAt + 0.3);
      harmOsc.stop(stopAt + 0.3);
      break;
    }

    case 'zay-808': {
      // Zay 808: tighter punch, faster steeper pitch drop, aggressive gritty harmonic clipping
      const baseF = meta.baseFreq * pitchRatio;
      const startF = baseF * (1 + (params.pitchEnv / 100) * 4.4);

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(startF, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(26, baseF), t + pitchDecaySec * 0.78);

      const gritOsc = ctx.createOscillator();
      gritOsc.type = 'sawtooth';
      gritOsc.frequency.setValueAtTime(startF, t);
      gritOsc.frequency.exponentialRampToValueAtTime(Math.max(26, baseF), t + pitchDecaySec * 0.78);

      const gritFilter = ctx.createBiquadFilter();
      gritFilter.type = 'lowpass';
      gritFilter.frequency.setValueAtTime(340 + toneNorm * 620, t);
      const gritGain = ctx.createGain();
      gritGain.gain.setValueAtTime(0.28 * toneNorm, t);
      gritGain.gain.exponentialRampToValueAtTime(0.001, t + decaySec * 0.7);

      const preClip = ctx.createWaveShaper();
      preClip.curve = getSaturationCurve(45 + toneNorm * 35);

      const amp = ctx.createGain();
      amp.gain.setValueAtTime(0.0001, t);
      amp.gain.linearRampToValueAtTime(1.06, t + attackSec);
      amp.gain.exponentialRampToValueAtTime(0.0008, t + decaySec);

      osc.connect(preClip);
      gritOsc.connect(gritFilter);
      gritFilter.connect(gritGain);
      gritGain.connect(preClip);
      preClip.connect(amp);
      amp.connect(voiceSum);

      if (snapNorm > 0.02) {
        const snapSrc = ctx.createBufferSource();
        snapSrc.buffer = noiseBuf;
        const snapBp = ctx.createBiquadFilter();
        snapBp.type = 'bandpass';
        snapBp.frequency.setValueAtTime(1600, t);
        snapBp.Q.setValueAtTime(1.2, t);
        const snapGain = ctx.createGain();
        snapGain.gain.setValueAtTime(0.5 * snapNorm, t);
        snapGain.gain.exponentialRampToValueAtTime(0.0008, t + 0.015);
        snapSrc.connect(snapBp);
        snapBp.connect(snapGain);
        snapGain.connect(voiceSum);
        snapSrc.start(t);
        snapSrc.stop(t + 0.025);
      }

      osc.start(t);
      gritOsc.start(t);
      osc.stop(stopAt);
      gritOsc.stop(stopAt);
      break;
    }

    case 'tr808-bd': {
      // Classic Roland TR-808 Bridged-T Bass Drum
      const baseF = meta.baseFreq * pitchRatio;
      const startF = baseF * (1 + (params.pitchEnv / 100) * 3.4);

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(startF, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(24, baseF), t + pitchDecaySec);

      const amp = ctx.createGain();
      amp.gain.setValueAtTime(0.0001, t);
      amp.gain.linearRampToValueAtTime(1.05, t + attackSec);
      amp.gain.exponentialRampToValueAtTime(0.0008, t + decaySec);

      osc.connect(amp);
      amp.connect(voiceSum);

      // Authentic TR-808 trigger impulse pulse
      if (snapNorm > 0.02) {
        const pulse = ctx.createOscillator();
        pulse.type = 'triangle';
        pulse.frequency.setValueAtTime(280 * pitchRatio, t);
        pulse.frequency.exponentialRampToValueAtTime(75, t + 0.01);
        const pGain = ctx.createGain();
        pGain.gain.setValueAtTime(0.55 * snapNorm, t);
        pGain.gain.exponentialRampToValueAtTime(0.0008, t + 0.014);
        pulse.connect(pGain);
        pGain.connect(voiceSum);
        pulse.start(t);
        pulse.stop(t + 0.02);
      }

      osc.start(t);
      osc.stop(stopAt);
      break;
    }

    case 'tr808-sd': {
      // Authentic TR-808 Dual Bridged-T Shells (180Hz & 330Hz) + Snappy High-Passed White Noise
      const f1 = 180 * pitchRatio;
      const f2 = 330 * pitchRatio;

      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(f1 * (1 + (params.pitchEnv / 100) * 0.6), t);
      osc1.frequency.exponentialRampToValueAtTime(f1, t + pitchDecaySec);

      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(f2 * (1 + (params.pitchEnv / 100) * 0.5), t);
      osc2.frequency.exponentialRampToValueAtTime(f2, t + pitchDecaySec);

      const bodyAmp = ctx.createGain();
      bodyAmp.gain.setValueAtTime(0.78 * (0.4 + 0.6 * (1 - toneNorm * 0.4)), t);
      bodyAmp.gain.exponentialRampToValueAtTime(0.0008, t + Math.min(decaySec, 0.24));

      osc1.connect(bodyAmp);
      osc2.connect(bodyAmp);
      bodyAmp.connect(voiceSum);

      // Snappy white noise wire
      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = noiseBuf;
      const noiseHp = ctx.createBiquadFilter();
      noiseHp.type = 'highpass';
      noiseHp.frequency.setValueAtTime(1400 + toneNorm * 1400, t);
      const noiseAmp = ctx.createGain();
      noiseAmp.gain.setValueAtTime(0.0001, t);
      noiseAmp.gain.linearRampToValueAtTime(0.95 * snapNorm, t + attackSec);
      noiseAmp.gain.exponentialRampToValueAtTime(0.0008, t + decaySec);

      noiseSrc.connect(noiseHp);
      noiseHp.connect(noiseAmp);
      noiseAmp.connect(voiceSum);

      osc1.start(t);
      osc2.start(t);
      noiseSrc.start(t);
      osc1.stop(stopAt);
      osc2.stop(stopAt);
      noiseSrc.stop(stopAt);
      break;
    }

    case 'tr808-cp': {
      // Authentic TR-808 Hand Clap: 3 micro-bursts separated by ~10ms + decaying reverb tail through 1.2kHz bandpass
      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = noiseBuf;

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1180 * pitchRatio, t);
      bp.Q.setValueAtTime(2.1 + toneNorm * 1.4, t);

      const amp = ctx.createGain();
      amp.gain.setValueAtTime(0.0001, t);

      // 3 iconic staggered clap bursts (0ms, 11ms, 22ms) + main tail at 32ms
      const bursts = [0, 0.011, 0.022];
      for (const offset of bursts) {
        amp.gain.setValueAtTime(0.95, t + offset);
        amp.gain.exponentialRampToValueAtTime(0.16, t + offset + 0.009);
      }
      amp.gain.setValueAtTime(0.92 * (0.45 + 0.55 * snapNorm), t + 0.032);
      amp.gain.exponentialRampToValueAtTime(0.0008, t + 0.032 + decaySec);

      noiseSrc.connect(bp);
      bp.connect(amp);
      amp.connect(voiceSum);

      noiseSrc.start(t);
      noiseSrc.stop(stopAt + 0.05);
      break;
    }

    case 'hit1-hat':
    case 'tr808-ch':
    case 'tr808-oh':
    case 'tr808-cy': {
      // Classic 6-oscillator Schmitt-trigger metallic square cluster + crisp noise air
      // Authentic TR-808 ratios: 205.3, 304.4, 369.6, 522.7, 540.0, 800.0 Hz (scaled up slightly for Hit 1 Hat)
      const isHit1 = archetype === 'hit1-hat';
      const isCymbal = archetype === 'tr808-cy';
      const freqs = isHit1
        ? [315, 468, 592, 812, 945, 1340]
        : [205.3, 304.4, 369.6, 522.7, 540.0, 800.0];

      const metalBus = ctx.createGain();
      metalBus.gain.value = isHit1 ? 0.34 : 0.42;

      const oscs: OscillatorNode[] = [];
      for (const f of freqs) {
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.setValueAtTime(f * pitchRatio * (isHit1 ? 1.35 : 1.0), t);
        o.connect(metalBus);
        o.start(t);
        o.stop(stopAt);
        oscs.push(o);
      }

      const metalBp = ctx.createBiquadFilter();
      metalBp.type = 'bandpass';
      metalBp.frequency.setValueAtTime((isHit1 ? 10200 : isCymbal ? 7200 : 8400) * pitchRatio, t);
      metalBp.Q.setValueAtTime(isHit1 ? 1.4 : 1.1, t);

      const metalHp = ctx.createBiquadFilter();
      metalHp.type = 'highpass';
      metalHp.frequency.setValueAtTime(isHit1 ? 7400 : 5400, t);

      const amp = ctx.createGain();
      amp.gain.setValueAtTime(0.0001, t);
      amp.gain.linearRampToValueAtTime(1.0, t + attackSec);
      if (isCymbal) {
        amp.gain.exponentialRampToValueAtTime(0.32, t + decaySec * 0.25);
        amp.gain.exponentialRampToValueAtTime(0.0008, t + decaySec);
      } else {
        amp.gain.exponentialRampToValueAtTime(0.0008, t + decaySec);
      }

      metalBus.connect(metalBp);
      metalBp.connect(metalHp);
      metalHp.connect(amp);

      // Crisp high-frequency air/click transient (crucial for Hit 1 Hi-Hat bite)
      if (snapNorm > 0.05) {
        const nSrc = ctx.createBufferSource();
        nSrc.buffer = noiseBuf;
        const nHp = ctx.createBiquadFilter();
        nHp.type = 'highpass';
        nHp.frequency.setValueAtTime(isHit1 ? 9200 : 7600, t);
        const nGain = ctx.createGain();
        nGain.gain.setValueAtTime((isHit1 ? 0.72 : 0.42) * snapNorm, t);
        nGain.gain.exponentialRampToValueAtTime(0.0008, t + Math.min(decaySec, isHit1 ? 0.045 : 0.08));
        nSrc.connect(nHp);
        nHp.connect(nGain);
        nGain.connect(amp);
        nSrc.start(t);
        nSrc.stop(stopAt);
      }

      amp.connect(voiceSum);
      break;
    }

    case 'tr808-cb': {
      // Iconic TR-808 Cowbell: 540Hz + 800Hz square oscillators through resonant bandpass + dual-stage decay
      const o1 = ctx.createOscillator();
      o1.type = 'square';
      o1.frequency.setValueAtTime(540 * pitchRatio, t);

      const o2 = ctx.createOscillator();
      o2.type = 'square';
      o2.frequency.setValueAtTime(800 * pitchRatio, t);

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(880 * pitchRatio, t);
      bp.Q.setValueAtTime(2.6 + toneNorm * 1.4, t);

      const amp = ctx.createGain();
      amp.gain.setValueAtTime(0.0001, t);
      amp.gain.linearRampToValueAtTime(0.9, t + attackSec);
      amp.gain.exponentialRampToValueAtTime(0.28, t + Math.min(0.05, decaySec * 0.2));
      amp.gain.exponentialRampToValueAtTime(0.0008, t + decaySec);

      o1.connect(bp);
      o2.connect(bp);
      bp.connect(amp);
      amp.connect(voiceSum);

      o1.start(t);
      o2.start(t);
      o1.stop(stopAt);
      o2.stop(stopAt);
      break;
    }

    case 'tr808-lt':
    case 'tr808-mt':
    case 'tr808-ht': {
      // Authentic TR-808 Low / Mid / Hi Toms & Congas
      const baseF = meta.baseFreq * pitchRatio;
      const startF = baseF * (1 + (params.pitchEnv / 100) * 1.45);

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(startF, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, baseF), t + pitchDecaySec);

      const overOsc = ctx.createOscillator();
      overOsc.type = 'triangle';
      overOsc.frequency.setValueAtTime(startF * 1.5, t);
      overOsc.frequency.exponentialRampToValueAtTime(Math.max(60, baseF * 1.5), t + pitchDecaySec);

      const overGain = ctx.createGain();
      overGain.gain.setValueAtTime(0.22 * toneNorm, t);
      overGain.gain.exponentialRampToValueAtTime(0.001, t + decaySec * 0.4);

      const amp = ctx.createGain();
      amp.gain.setValueAtTime(0.0001, t);
      amp.gain.linearRampToValueAtTime(0.95, t + attackSec);
      amp.gain.exponentialRampToValueAtTime(0.0008, t + decaySec);

      osc.connect(amp);
      overOsc.connect(overGain);
      overGain.connect(amp);
      amp.connect(voiceSum);

      if (snapNorm > 0.04) {
        const stickSrc = ctx.createBufferSource();
        stickSrc.buffer = noiseBuf;
        const stickBp = ctx.createBiquadFilter();
        stickBp.type = 'bandpass';
        stickBp.frequency.setValueAtTime(1800, t);
        const stickAmp = ctx.createGain();
        stickAmp.gain.setValueAtTime(0.32 * snapNorm, t);
        stickAmp.gain.exponentialRampToValueAtTime(0.0008, t + 0.012);
        stickSrc.connect(stickBp);
        stickBp.connect(stickAmp);
        stickAmp.connect(voiceSum);
        stickSrc.start(t);
        stickSrc.stop(t + 0.02);
      }

      osc.start(t);
      overOsc.start(t);
      osc.stop(stopAt);
      overOsc.stop(stopAt);
      break;
    }

    case 'tr808-rs': {
      // TR-808 Rimshot: dual woody resonant triangle/pulse oscillators + short bark burst
      const f1 = 460 * pitchRatio;
      const f2 = 1660 * pitchRatio;

      const o1 = ctx.createOscillator();
      o1.type = 'triangle';
      o1.frequency.setValueAtTime(f1 * 1.2, t);
      o1.frequency.exponentialRampToValueAtTime(f1, t + 0.012);

      const o2 = ctx.createOscillator();
      o2.type = 'square';
      o2.frequency.setValueAtTime(f2, t);

      const o2Gain = ctx.createGain();
      o2Gain.gain.setValueAtTime(0.42 * toneNorm, t);
      o2Gain.gain.exponentialRampToValueAtTime(0.001, t + 0.022);

      const amp = ctx.createGain();
      amp.gain.setValueAtTime(0.0001, t);
      amp.gain.linearRampToValueAtTime(0.95, t + attackSec);
      amp.gain.exponentialRampToValueAtTime(0.0008, t + decaySec);

      o1.connect(amp);
      o2.connect(o2Gain);
      o2Gain.connect(amp);
      amp.connect(voiceSum);

      o1.start(t);
      o2.start(t);
      o1.stop(stopAt);
      o2.stop(stopAt);
      break;
    }
  }

  return {
    choke(atTime: number) {
      const ct = Math.max(ctx.currentTime, atTime);
      chokeGain.gain.cancelScheduledValues(ct);
      chokeGain.gain.setValueAtTime(chokeGain.gain.value, ct);
      chokeGain.gain.exponentialRampToValueAtTime(0.0001, ct + 0.008);
    },
  };
}
