import type {
  DrumChannel,
  LfoConfig,
  MasterFxParams,
  PatternData,
} from '../types/drum';
import {
  clamp,
  getDelayTimeSeconds,
  getRatchetOffsets,
  getStepDurationSeconds,
  getSwingOffsetSeconds,
  isChannelAudible,
  resolveModulatedParams,
} from './sequencerMath';
import {
  ActiveVoiceHandle,
  getSaturationCurve,
  triggerSynthesizedVoice,
  VoiceBusTargets,
} from './synthVoice';

export interface EngineStateSnapshot {
  bpm: number;
  swing: number;
  channels: DrumChannel[];
  pattern: PatternData;
  selectedChannelId: string;
  lfos: [LfoConfig, LfoConfig];
  masterFx: MasterFxParams;
  fillActive: boolean;
}

export interface StereoMeterData {
  leftPeak: number;
  rightPeak: number;
  waveform: Float32Array;
}

/**
 * Generates an algorithmic stereo vintage spring/plate reverb impulse response.
 */
function buildStereoReverbImpulse(
  ctx: BaseAudioContext,
  durationSec: number
): AudioBuffer {
  const dur = clamp(durationSec, 0.3, 3.6);
  const length = Math.floor(ctx.sampleRate * dur);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  let seed = 0x51a9c3d7;

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let lpState = 0;
    for (let i = 0; i < length; i++) {
      seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
      const white = (seed / 0xffffffff) * 2 - 1;
      const tNorm = i / length;
      // Exponential plate decay with early reflection cluster and progressive HF damping
      const env = Math.pow(1 - tNorm, 2.8) * (i < 900 ? 0.8 + 0.2 * Math.sin(i * 0.08) : 1);
      const damp = 0.28 + 0.55 * (1 - tNorm);
      lpState = lpState + damp * (white - lpState);
      data[i] = lpState * env * 0.72;
    }
  }
  return buffer;
}

interface MasterBusNodes {
  dryBus: GainNode;
  reverbSend: GainNode;
  delaySend: GainNode;
  djFilter: BiquadFilterNode;
  tapeShaper: WaveShaperNode;
  compressor: DynamicsCompressorNode;
  masterGain: GainNode;
  reverbConvolver: ConvolverNode;
  reverbWet: GainNode;
  delayNodeL: DelayNode;
  delayNodeR: DelayNode;
  delayFeedbackL: GainNode;
  delayFeedbackR: GainNode;
  delayTone: BiquadFilterNode;
  delayWet: GainNode;
  outNode: AudioNode;
}

function buildMasterBus(
  ctx: BaseAudioContext,
  fx: MasterFxParams,
  bpm: number
): MasterBusNodes {
  const dryBus = ctx.createGain();
  dryBus.gain.value = 1;

  const reverbSend = ctx.createGain();
  reverbSend.gain.value = 1;

  const delaySend = ctx.createGain();
  delaySend.gain.value = 1;

  // Vintage Stereo Plate/Spring Reverb
  const reverbConvolver = ctx.createConvolver();
  reverbConvolver.buffer = buildStereoReverbImpulse(ctx, fx.reverbSize);
  const reverbWet = ctx.createGain();
  reverbWet.gain.value = clamp(fx.reverbMix, 0, 1);
  reverbSend.connect(reverbConvolver);
  reverbConvolver.connect(reverbWet);

  // Stereo Ping-Pong Tape Echo
  const baseDelay = clamp(getDelayTimeSeconds(fx.delayDivision, bpm), 0.04, 1.5);
  const delayNodeL = ctx.createDelay(2.0);
  const delayNodeR = ctx.createDelay(2.0);
  delayNodeL.delayTime.value = baseDelay;
  delayNodeR.delayTime.value = clamp(baseDelay * 1.03, 0.04, 1.8); // Subtle stereo tape spread

  const delayTone = ctx.createBiquadFilter();
  delayTone.type = 'lowpass';
  delayTone.frequency.value = 3400; // Warm analog BBD / tape rolloff

  const delayFeedbackL = ctx.createGain();
  const delayFeedbackR = ctx.createGain();
  delayFeedbackL.gain.value = clamp(fx.delayFeedback, 0, 0.82);
  delayFeedbackR.gain.value = clamp(fx.delayFeedback, 0, 0.82);

  const merger = ctx.createChannelMerger(2);
  const delayWet = ctx.createGain();
  delayWet.gain.value = clamp(fx.delayMix, 0, 1);

  delaySend.connect(delayTone);
  delayTone.connect(delayNodeL);
  delayNodeL.connect(delayFeedbackL);
  delayFeedbackL.connect(delayNodeR);
  delayNodeR.connect(delayFeedbackR);
  delayFeedbackR.connect(delayTone);

  delayNodeL.connect(merger, 0, 0);
  delayNodeR.connect(merger, 0, 1);
  merger.connect(delayWet);

  // Sum Dry + Sends -> Master DJ Filter -> Analog Tape Saturation -> Glue Compressor -> Master Gain
  const sumBus = ctx.createGain();
  dryBus.connect(sumBus);
  reverbWet.connect(sumBus);
  delayWet.connect(sumBus);

  const djFilter = ctx.createBiquadFilter();
  applyDjFilterParams(djFilter, fx.djFilter, fx.djFilterRes, ctx.currentTime);

  const tapeShaper = ctx.createWaveShaper();
  tapeShaper.oversample = '2x';
  tapeShaper.curve = getSaturationCurve(fx.tapeWarmth * 0.55);

  const compressor = ctx.createDynamicsCompressor();
  applyCompressorParams(compressor, fx.busComp, ctx.currentTime);

  const masterGain = ctx.createGain();
  masterGain.gain.value = clamp(fx.masterVolume, 0, 1.25);

  sumBus.connect(djFilter);
  djFilter.connect(tapeShaper);
  tapeShaper.connect(compressor);
  compressor.connect(masterGain);

  return {
    dryBus,
    reverbSend,
    delaySend,
    djFilter,
    tapeShaper,
    compressor,
    masterGain,
    reverbConvolver,
    reverbWet,
    delayNodeL,
    delayNodeR,
    delayFeedbackL,
    delayFeedbackR,
    delayTone,
    delayWet,
    outNode: masterGain,
  };
}

function applyDjFilterParams(
  node: BiquadFilterNode,
  djFilter: number,
  reso: number,
  time: number
): void {
  const v = clamp(djFilter, -1, 1);
  const q = clamp(reso, 0.7, 12);
  if (Math.abs(v) < 0.03) {
    node.type = 'allpass';
    node.frequency.setTargetAtTime(1000, time, 0.015);
    node.Q.setTargetAtTime(0.7, time, 0.015);
  } else if (v < 0) {
    node.type = 'lowpass';
    // Exponential sweep from 18000 Hz down to 140 Hz
    const freq = 18000 * Math.pow(140 / 18000, Math.abs(v));
    node.frequency.setTargetAtTime(freq, time, 0.015);
    node.Q.setTargetAtTime(q, time, 0.015);
  } else {
    node.type = 'highpass';
    // Exponential sweep from 40 Hz up to 6200 Hz
    const freq = 40 * Math.pow(6200 / 40, v);
    node.frequency.setTargetAtTime(freq, time, 0.015);
    node.Q.setTargetAtTime(q, time, 0.015);
  }
}

function applyCompressorParams(
  comp: DynamicsCompressorNode,
  busCompPercent: number,
  time: number
): void {
  const amt = clamp(busCompPercent, 0, 100) / 100;
  comp.threshold.setTargetAtTime(-4 - amt * 22, time, 0.02);
  comp.knee.setTargetAtTime(12, time, 0.02);
  comp.ratio.setTargetAtTime(1.5 + amt * 6.5, time, 0.02);
  comp.attack.setTargetAtTime(0.008, time, 0.02);
  comp.release.setTargetAtTime(0.14, time, 0.02);
}

export class DrumAudioEngine {
  private ctx: AudioContext | null = null;
  private bus: MasterBusNodes | null = null;
  private analyserL: AnalyserNode | null = null;
  private analyserR: AnalyserNode | null = null;
  private analyserSum: AnalyserNode | null = null;
  private bufL = new Float32Array(256);
  private bufR = new Float32Array(256);
  private bufWave = new Float32Array(256);

  private isPlaying = false;
  private currentStep = 0;
  private nextNoteTime = 0;
  private timerId: number | null = null;
  private lastReverbSize = 1.4;
  private activeChokeHandles = new Map<number, ActiveVoiceHandle>();

  private stateProvider: () => EngineStateSnapshot;
  private onStepChange: (step: number, triggeredChannelIds: string[]) => void;
  private onBarBoundary?: () => void;

  constructor(
    stateProvider: () => EngineStateSnapshot,
    onStepChange: (step: number, triggeredChannelIds: string[]) => void,
    onBarBoundary?: () => void
  ) {
    this.stateProvider = stateProvider;
    this.onStepChange = onStepChange;
    this.onBarBoundary = onBarBoundary;
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx({ sampleRate: 48000 });
      const snap = this.stateProvider();
      this.lastReverbSize = snap.masterFx.reverbSize;
      this.bus = buildMasterBus(this.ctx, snap.masterFx, snap.bpm);

      // Stereo metering & oscilloscope analyzers
      const splitter = this.ctx.createChannelSplitter(2);
      this.analyserL = this.ctx.createAnalyser();
      this.analyserR = this.ctx.createAnalyser();
      this.analyserSum = this.ctx.createAnalyser();
      this.analyserL.fftSize = 256;
      this.analyserR.fftSize = 256;
      this.analyserSum.fftSize = 512;
      this.bufWave = new Float32Array(this.analyserSum.fftSize);

      this.bus.outNode.connect(splitter);
      splitter.connect(this.analyserL, 0);
      splitter.connect(this.analyserR, 1);
      this.bus.outNode.connect(this.analyserSum);
      this.bus.outNode.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public syncMasterFx(fx: MasterFxParams, bpm: number): void {
    if (!this.ctx || !this.bus) return;
    const now = this.ctx.currentTime;
    this.bus.masterGain.gain.setTargetAtTime(clamp(fx.masterVolume, 0, 1.25), now, 0.015);
    applyDjFilterParams(this.bus.djFilter, fx.djFilter, fx.djFilterRes, now);
    this.bus.tapeShaper.curve = getSaturationCurve(fx.tapeWarmth * 0.55);
    applyCompressorParams(this.bus.compressor, fx.busComp, now);
    this.bus.reverbWet.gain.setTargetAtTime(clamp(fx.reverbMix, 0, 1), now, 0.02);

    if (Math.abs(fx.reverbSize - this.lastReverbSize) > 0.12) {
      this.lastReverbSize = fx.reverbSize;
      this.bus.reverbConvolver.buffer = buildStereoReverbImpulse(this.ctx, fx.reverbSize);
    }

    const dSec = clamp(getDelayTimeSeconds(fx.delayDivision, bpm), 0.04, 1.5);
    this.bus.delayNodeL.delayTime.setTargetAtTime(dSec, now, 0.03);
    this.bus.delayNodeR.delayTime.setTargetAtTime(clamp(dSec * 1.03, 0.04, 1.8), now, 0.03);
    this.bus.delayFeedbackL.gain.setTargetAtTime(clamp(fx.delayFeedback, 0, 0.82), now, 0.02);
    this.bus.delayFeedbackR.gain.setTargetAtTime(clamp(fx.delayFeedback, 0, 0.82), now, 0.02);
    this.bus.delayWet.gain.setTargetAtTime(clamp(fx.delayMix, 0, 1), now, 0.02);
  }

  public auditionChannel(channel: DrumChannel, velocity = 0.9): void {
    const ctx = this.ensureContext();
    if (!this.bus) return;
    const targets: VoiceBusTargets = {
      dryBus: this.bus.dryBus,
      reverbSend: this.bus.reverbSend,
      delaySend: this.bus.delaySend,
    };
    this.triggerWithChoke(ctx, channel, channel.params, velocity, ctx.currentTime + 0.005, targets);
  }

  private triggerWithChoke(
    ctx: BaseAudioContext,
    channel: DrumChannel,
    params: DrumChannel['params'],
    velocity: number,
    when: number,
    targets: VoiceBusTargets,
    chokeMap?: Map<number, ActiveVoiceHandle>
  ): void {
    const map = chokeMap ?? this.activeChokeHandles;
    if (params.chokeGroup > 0) {
      const prev = map.get(params.chokeGroup);
      if (prev) {
        prev.choke(when);
      }
    }
    const handle = triggerSynthesizedVoice(
      ctx,
      channel.archetype,
      params,
      velocity,
      when,
      targets
    );
    if (params.chokeGroup > 0) {
      map.set(params.chokeGroup, handle);
    }
  }

  public start(): void {
    const ctx = this.ensureContext();
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.currentStep = 0;
    this.nextNoteTime = ctx.currentTime + 0.04;
    this.schedulerTick();
    this.timerId = window.setInterval(() => this.schedulerTick(), 25);
  }

  public stop(): void {
    this.isPlaying = false;
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
    this.currentStep = 0;
    this.onStepChange(-1, []);
  }

  private schedulerTick(): void {
    if (!this.isPlaying || !this.ctx || !this.bus) return;
    const lookahead = 0.1;

    while (this.nextNoteTime < this.ctx.currentTime + lookahead) {
      const snap = this.stateProvider();
      const stepIdx = this.currentStep % snap.pattern.length;
      if (stepIdx === 0 && this.onBarBoundary) {
        this.onBarBoundary();
      }
      this.scheduleStep(stepIdx, this.nextNoteTime, snap);
      const stepDur = getStepDurationSeconds(snap.bpm);
      this.nextNoteTime += stepDur;
      this.currentStep = (stepIdx + 1) % snap.pattern.length;
    }
  }

  private scheduleStep(stepIdx: number, baseTime: number, snap: EngineStateSnapshot): void {
    if (!this.ctx || !this.bus) return;
    const targets: VoiceBusTargets = {
      dryBus: this.bus.dryBus,
      reverbSend: this.bus.reverbSend,
      delaySend: this.bus.delaySend,
    };

    const stepDur = getStepDurationSeconds(snap.bpm);
    const swingOffset = getSwingOffsetSeconds(stepIdx, snap.bpm, snap.swing);
    const stepTime = baseTime + swingOffset;
    const triggeredIds: string[] = [];

    for (const ch of snap.channels) {
      if (!isChannelAudible(ch, snap.channels)) continue;
      const step = snap.pattern.steps[ch.id]?.[stepIdx];
      if (!step) continue;

      // Live FILL button injects energetic snare/tom/hat fills on final beat (steps 12..15)
      const isFillStep = snap.fillActive && stepIdx % 16 >= 12;
      const fillInject =
        isFillStep &&
        (ch.archetype === 'tr808-sd' ||
          ch.archetype === 'tr808-lt' ||
          ch.archetype === 'tr808-mt' ||
          ch.archetype === 'tr808-ht' ||
          ch.archetype === 'hit1-hat');

      if (!step.active && !fillInject) continue;

      if (!fillInject && step.probability < 100) {
        if (Math.random() * 100 > step.probability) continue;
      }

      const rollCount = isFillStep && (ch.archetype === 'tr808-sd' || ch.archetype === 'hit1-hat')
        ? (Math.min(4, Math.max(step.roll, 2)) as 1 | 2 | 3 | 4)
        : step.roll;

      const rollOffsets = getRatchetOffsets(stepDur, rollCount);
      triggeredIds.push(ch.id);

      for (let r = 0; r < rollOffsets.length; r++) {
        const hitTime = stepTime + rollOffsets[r];
        const modParams = resolveModulatedParams(
          ch,
          snap.selectedChannelId,
          step,
          snap.lfos,
          hitTime,
          snap.bpm
        );
        const baseVel = step.active ? step.velocity : 0.72;
        const vel = (step.accent ? Math.min(1.12, baseVel * 1.18) : baseVel) * (r === 0 ? 1 : 0.85);
        this.triggerWithChoke(this.ctx, ch, modParams, vel, hitTime, targets);
      }
    }

    const delayMs = Math.max(0, (stepTime - this.ctx.currentTime) * 1000);
    window.setTimeout(() => {
      if (this.isPlaying) {
        this.onStepChange(stepIdx, triggeredIds);
      }
    }, delayMs);
  }

  public getStereoMeterData(): StereoMeterData {
    if (!this.analyserL || !this.analyserR || !this.analyserSum) {
      return { leftPeak: 0, rightPeak: 0, waveform: this.bufWave };
    }
    this.analyserL.getFloatTimeDomainData(this.bufL);
    this.analyserR.getFloatTimeDomainData(this.bufR);
    this.analyserSum.getFloatTimeDomainData(this.bufWave);

    let peakL = 0;
    let peakR = 0;
    for (let i = 0; i < this.bufL.length; i++) {
      const aL = Math.abs(this.bufL[i]);
      const aR = Math.abs(this.bufR[i]);
      if (aL > peakL) peakL = aL;
      if (aR > peakR) peakR = aR;
    }
    return {
      leftPeak: clamp(peakL, 0, 1),
      rightPeak: clamp(peakR, 0, 1),
      waveform: this.bufWave,
    };
  }

  public getSampleRate(): number {
    return this.ctx?.sampleRate ?? 48000;
  }

  public dispose(): void {
    this.stop();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}

/**
 * Offline high-precision stereo renderer that bounces the exact kit, modulation LFOs,
 * parameter locks, swing, and master analog bus into stereo Float32Arrays ready for 24-bit WAV/AIFF/FLAC encoding.
 */
export async function renderPatternOfflineStereo(params: {
  snapshot: EngineStateSnapshot;
  bars: number;
  sampleRate: 44100 | 48000;
  includeTail: boolean;
}): Promise<{ left: Float32Array; right: Float32Array; durationSec: number }> {
  const { snapshot, bars, sampleRate, includeTail } = params;
  const stepDur = getStepDurationSeconds(snapshot.bpm);
  const totalSteps = bars * 16;
  const loopDuration = totalSteps * stepDur;
  const tailSec = includeTail ? 1.5 : 0.02;
  const totalDuration = loopDuration + tailSec;
  const totalFrames = Math.ceil(totalDuration * sampleRate);

  const offlineCtx = new OfflineAudioContext(2, totalFrames, sampleRate);
  const bus = buildMasterBus(offlineCtx, snapshot.masterFx, snapshot.bpm);
  bus.outNode.connect(offlineCtx.destination);

  const targets: VoiceBusTargets = {
    dryBus: bus.dryBus,
    reverbSend: bus.reverbSend,
    delaySend: bus.delaySend,
  };
  const chokeMap = new Map<number, ActiveVoiceHandle>();

  for (let stepIdx = 0; stepIdx < totalSteps; stepIdx++) {
    const patIdx = stepIdx % snapshot.pattern.length;
    const baseTime = stepIdx * stepDur + getSwingOffsetSeconds(stepIdx, snapshot.bpm, snapshot.swing);

    for (const ch of snapshot.channels) {
      if (!isChannelAudible(ch, snapshot.channels)) continue;
      const step = snapshot.pattern.steps[ch.id]?.[patIdx];
      if (!step || !step.active) continue;

      const rollOffsets = getRatchetOffsets(stepDur, step.roll);
      for (let r = 0; r < rollOffsets.length; r++) {
        const hitTime = baseTime + rollOffsets[r];
        const modParams = resolveModulatedParams(
          ch,
          snapshot.selectedChannelId,
          step,
          snapshot.lfos,
          hitTime,
          snapshot.bpm
        );
        const vel = (step.accent ? Math.min(1.12, step.velocity * 1.18) : step.velocity) * (r === 0 ? 1 : 0.85);

        if (modParams.chokeGroup > 0) {
          const prev = chokeMap.get(modParams.chokeGroup);
          if (prev) prev.choke(hitTime);
        }
        const handle = triggerSynthesizedVoice(
          offlineCtx,
          ch.archetype,
          modParams,
          vel,
          hitTime,
          targets
        );
        if (modParams.chokeGroup > 0) {
          chokeMap.set(modParams.chokeGroup, handle);
        }
      }
    }
  }

  const rendered = await offlineCtx.startRendering();
  return {
    left: rendered.getChannelData(0),
    right: rendered.getChannelData(1),
    durationSec: totalDuration,
  };
}
