import type {
  ArchetypeMeta,
  DrumChannel,
  KitPreset,
  LfoConfig,
  MasterFxParams,
  PatternBankId,
  PatternData,
  StepData,
  VoiceArchetype,
  VoiceParams,
} from '../types/drum';
import { createDefaultStep } from './sequencerMath';

export const ARCHETYPES: Record<VoiceArchetype, ArchetypeMeta> = {
  'rack-kick': {
    id: 'rack-kick',
    name: 'Rack Kick',
    shortName: 'RACK',
    category: 'Mainstream',
    midiNote: 36,
    baseFreq: 56,
    description: 'Punchy hip-hop & trap hybrid kick with tight transient knock and controlled sub.',
    defaultParams: {
      tune: 0,
      pitchEnv: 78,
      pitchDecay: 38,
      attack: 1,
      decay: 260,
      tone: 62,
      snap: 68,
      filterMode: 'lowpass',
      filterCutoff: 4200,
      filterRes: 1.4,
      drive: 34,
      pan: 0,
      level: 0.92,
      reverbSend: 0.02,
      delaySend: 0,
      chokeGroup: 0,
    },
  },
  'spinz-808': {
    id: 'spinz-808',
    name: 'Spinz 808',
    shortName: 'SPNZ',
    category: 'Mainstream',
    midiNote: 35,
    baseFreq: 48,
    description: 'Iconic warm harmonic sub 808 with resonant 120Hz mid-punch and musical sustain tail.',
    defaultParams: {
      tune: 0,
      pitchEnv: 46,
      pitchDecay: 48,
      attack: 2,
      decay: 920,
      tone: 58,
      snap: 22,
      filterMode: 'lowpass',
      filterCutoff: 1450,
      filterRes: 1.8,
      drive: 42,
      pan: 0,
      level: 0.9,
      reverbSend: 0,
      delaySend: 0,
      chokeGroup: 2,
    },
  },
  'zay-808': {
    id: 'zay-808',
    name: 'Zay 808',
    shortName: 'ZAY8',
    category: 'Mainstream',
    midiNote: 35,
    baseFreq: 50,
    description: 'Tighter, aggressive overdriven 808 bass with crisp attack thump and gritty upper harmonics.',
    defaultParams: {
      tune: 0,
      pitchEnv: 64,
      pitchDecay: 32,
      attack: 1,
      decay: 580,
      tone: 72,
      snap: 40,
      filterMode: 'lowpass',
      filterCutoff: 2100,
      filterRes: 2.2,
      drive: 66,
      pan: 0,
      level: 0.88,
      reverbSend: 0,
      delaySend: 0,
      chokeGroup: 2,
    },
  },
  'hit1-hat': {
    id: 'hit1-hat',
    name: 'Hit 1 Hi-Hat',
    shortName: 'HIT1',
    category: 'Mainstream',
    midiNote: 42,
    baseFreq: 8600,
    description: 'Razor-sharp trap closed hi-hat with crystalline metallic shimmer and ultra-fast decay.',
    defaultParams: {
      tune: 0,
      pitchEnv: 0,
      pitchDecay: 15,
      attack: 0,
      decay: 58,
      tone: 74,
      snap: 82,
      filterMode: 'highpass',
      filterCutoff: 6800,
      filterRes: 2.1,
      drive: 16,
      pan: 0.14,
      level: 0.72,
      reverbSend: 0.08,
      delaySend: 0.12,
      chokeGroup: 1,
    },
  },
  'tr808-bd': {
    id: 'tr808-bd',
    name: 'TR-808 Bass Drum',
    shortName: 'BD',
    category: 'TR-808 Kit',
    midiNote: 36,
    baseFreq: 52,
    description: 'Classic Roland TR-808 bridged-T analog sine resonator kick with deep round boom.',
    defaultParams: {
      tune: 0,
      pitchEnv: 58,
      pitchDecay: 44,
      attack: 1,
      decay: 540,
      tone: 48,
      snap: 35,
      filterMode: 'lowpass',
      filterCutoff: 1900,
      filterRes: 1.2,
      drive: 18,
      pan: 0,
      level: 0.92,
      reverbSend: 0.02,
      delaySend: 0,
      chokeGroup: 2,
    },
  },
  'tr808-sd': {
    id: 'tr808-sd',
    name: 'TR-808 Snare Drum',
    shortName: 'SD',
    category: 'TR-808 Kit',
    midiNote: 38,
    baseFreq: 185,
    description: 'Dual bridged-T resonant shells layered with high-passed white noise snappy wire.',
    defaultParams: {
      tune: 0,
      pitchEnv: 28,
      pitchDecay: 24,
      attack: 0,
      decay: 210,
      tone: 56,
      snap: 74,
      filterMode: 'highpass',
      filterCutoff: 420,
      filterRes: 1.3,
      drive: 20,
      pan: -0.05,
      level: 0.84,
      reverbSend: 0.18,
      delaySend: 0.08,
      chokeGroup: 0,
    },
  },
  'tr808-cp': {
    id: 'tr808-cp',
    name: 'TR-808 Hand Clap',
    shortName: 'CP',
    category: 'TR-808 Kit',
    midiNote: 39,
    baseFreq: 1150,
    description: 'Iconic triple-micro-burst bandpass noise hand clap with lush analog reverb tail.',
    defaultParams: {
      tune: 0,
      pitchEnv: 0,
      pitchDecay: 20,
      attack: 0,
      decay: 260,
      tone: 64,
      snap: 80,
      filterMode: 'bandpass',
      filterCutoff: 1280,
      filterRes: 2.6,
      drive: 22,
      pan: 0.08,
      level: 0.8,
      reverbSend: 0.24,
      delaySend: 0.14,
      chokeGroup: 0,
    },
  },
  'tr808-ch': {
    id: 'tr808-ch',
    name: 'TR-808 Closed Hat',
    shortName: 'CH',
    category: 'TR-808 Kit',
    midiNote: 42,
    baseFreq: 7200,
    description: '6-oscillator Schmitt-trigger metallic square cluster through crisp high-pass filter.',
    defaultParams: {
      tune: 0,
      pitchEnv: 0,
      pitchDecay: 15,
      attack: 0,
      decay: 65,
      tone: 62,
      snap: 52,
      filterMode: 'highpass',
      filterCutoff: 6400,
      filterRes: 1.6,
      drive: 10,
      pan: -0.18,
      level: 0.68,
      reverbSend: 0.08,
      delaySend: 0.08,
      chokeGroup: 1,
    },
  },
  'tr808-oh': {
    id: 'tr808-oh',
    name: 'TR-808 Open Hat',
    shortName: 'OH',
    category: 'TR-808 Kit',
    midiNote: 46,
    baseFreq: 7200,
    description: 'Sustained 6-oscillator metallic hi-hat that chokes cleanly when closed hat triggers.',
    defaultParams: {
      tune: 0,
      pitchEnv: 0,
      pitchDecay: 15,
      attack: 1,
      decay: 440,
      tone: 65,
      snap: 45,
      filterMode: 'highpass',
      filterCutoff: 5600,
      filterRes: 1.5,
      drive: 12,
      pan: -0.22,
      level: 0.66,
      reverbSend: 0.16,
      delaySend: 0.12,
      chokeGroup: 1,
    },
  },
  'tr808-cb': {
    id: 'tr808-cb',
    name: 'TR-808 Cowbell',
    shortName: 'CB',
    category: 'TR-808 Kit',
    midiNote: 56,
    baseFreq: 540,
    description: 'Unmistakable 540Hz + 800Hz detuned square-wave oscillators through narrow bandpass.',
    defaultParams: {
      tune: 0,
      pitchEnv: 0,
      pitchDecay: 15,
      attack: 0,
      decay: 310,
      tone: 60,
      snap: 30,
      filterMode: 'bandpass',
      filterCutoff: 980,
      filterRes: 3.2,
      drive: 20,
      pan: 0.25,
      level: 0.65,
      reverbSend: 0.2,
      delaySend: 0.22,
      chokeGroup: 0,
    },
  },
  'tr808-lt': {
    id: 'tr808-lt',
    name: 'TR-808 Low Tom',
    shortName: 'LT',
    category: 'TR-808 Kit',
    midiNote: 45,
    baseFreq: 95,
    description: 'Warm analog bridged-T low tom / conga with subtle downward pitch bend.',
    defaultParams: {
      tune: 0,
      pitchEnv: 34,
      pitchDecay: 60,
      attack: 1,
      decay: 320,
      tone: 52,
      snap: 20,
      filterMode: 'lowpass',
      filterCutoff: 2400,
      filterRes: 1.2,
      drive: 16,
      pan: -0.32,
      level: 0.78,
      reverbSend: 0.18,
      delaySend: 0.1,
      chokeGroup: 0,
    },
  },
  'tr808-mt': {
    id: 'tr808-mt',
    name: 'TR-808 Mid Tom',
    shortName: 'MT',
    category: 'TR-808 Kit',
    midiNote: 47,
    baseFreq: 145,
    description: 'Punchy midrange analog tom with crisp stick click.',
    defaultParams: {
      tune: 0,
      pitchEnv: 32,
      pitchDecay: 50,
      attack: 1,
      decay: 260,
      tone: 55,
      snap: 24,
      filterMode: 'lowpass',
      filterCutoff: 3200,
      filterRes: 1.2,
      drive: 14,
      pan: 0.05,
      level: 0.75,
      reverbSend: 0.18,
      delaySend: 0.1,
      chokeGroup: 0,
    },
  },
  'tr808-ht': {
    id: 'tr808-ht',
    name: 'TR-808 Hi Tom',
    shortName: 'HT',
    category: 'TR-808 Kit',
    midiNote: 50,
    baseFreq: 215,
    description: 'Bright high analog tom / conga for classic electro fills.',
    defaultParams: {
      tune: 0,
      pitchEnv: 30,
      pitchDecay: 42,
      attack: 1,
      decay: 210,
      tone: 58,
      snap: 28,
      filterMode: 'lowpass',
      filterCutoff: 4200,
      filterRes: 1.2,
      drive: 12,
      pan: 0.34,
      level: 0.74,
      reverbSend: 0.2,
      delaySend: 0.12,
      chokeGroup: 0,
    },
  },
  'tr808-rs': {
    id: 'tr808-rs',
    name: 'TR-808 Rimshot',
    shortName: 'RS',
    category: 'TR-808 Kit',
    midiNote: 37,
    baseFreq: 460,
    description: 'Sharp wooden dual-resonant pulse rimshot with punchy mid-high bark.',
    defaultParams: {
      tune: 0,
      pitchEnv: 18,
      pitchDecay: 12,
      attack: 0,
      decay: 75,
      tone: 68,
      snap: 70,
      filterMode: 'bandpass',
      filterCutoff: 1650,
      filterRes: 2.8,
      drive: 28,
      pan: -0.2,
      level: 0.74,
      reverbSend: 0.16,
      delaySend: 0.2,
      chokeGroup: 0,
    },
  },
  'tr808-cy': {
    id: 'tr808-cy',
    name: 'TR-808 Cymbal',
    shortName: 'CY',
    category: 'TR-808 Kit',
    midiNote: 49,
    baseFreq: 6400,
    description: 'Long shimmering 6-oscillator dual-band crash cymbal with analog sizzle.',
    defaultParams: {
      tune: 0,
      pitchEnv: 0,
      pitchDecay: 15,
      attack: 2,
      decay: 1350,
      tone: 70,
      snap: 48,
      filterMode: 'highpass',
      filterCutoff: 4800,
      filterRes: 1.4,
      drive: 12,
      pan: 0.3,
      level: 0.62,
      reverbSend: 0.25,
      delaySend: 0.12,
      chokeGroup: 0,
    },
  },
};

export const ARCHETYPE_LIST: ArchetypeMeta[] = Object.values(ARCHETYPES);

export function createChannelFromArchetype(
  id: string,
  archetype: VoiceArchetype,
  overrides?: Partial<VoiceParams>
): DrumChannel {
  const meta = ARCHETYPES[archetype];
  return {
    id,
    shortName: meta.shortName,
    name: meta.name,
    archetype,
    midiNote: meta.midiNote,
    mute: false,
    solo: false,
    params: {
      ...meta.defaultParams,
      ...(overrides ?? {}),
    },
  };
}

function buildSteps(
  activeIndices: number[],
  options?: {
    accents?: number[];
    rolls?: Record<number, 2 | 3 | 4>;
    pitches?: Record<number, number>;
    velocities?: Record<number, number>;
  }
): StepData[] {
  const arr: StepData[] = Array.from({ length: 32 }, () => createDefaultStep(false, 0.82, false));
  const accentSet = new Set(options?.accents ?? []);
  for (const idx of activeIndices) {
    if (idx >= 0 && idx < 32) {
      arr[idx] = {
        active: true,
        velocity: options?.velocities?.[idx] ?? (accentSet.has(idx) ? 1.0 : 0.8),
        accent: accentSet.has(idx),
        pitchOffset: options?.pitches?.[idx] ?? 0,
        filterOffset: 0,
        roll: options?.rolls?.[idx] ?? 1,
        probability: 100,
      };
    }
  }
  return arr;
}

function emptyPattern(channelIds: string[], length: 16 | 32 = 16): PatternData {
  const steps: Record<string, StepData[]> = {};
  for (const id of channelIds) {
    steps[id] = buildSteps([]);
  }
  return { length, steps };
}

function defaultLfos(): [LfoConfig, LfoConfig] {
  return [
    {
      id: 'lfo1',
      name: 'LFO 1',
      enabled: false,
      shape: 'sine',
      sync: '1/4',
      rateHz: 2.0,
      depth: 35,
      target: 'cutoff',
      channelId: 'selected',
    },
    {
      id: 'lfo2',
      name: 'LFO 2',
      enabled: false,
      shape: 'triangle',
      sync: '1/8',
      rateHz: 4.0,
      depth: 25,
      target: 'pan',
      channelId: 'ch4',
    },
  ];
}

function defaultMasterFx(overrides?: Partial<MasterFxParams>): MasterFxParams {
  return {
    masterVolume: 0.9,
    djFilter: 0,
    djFilterRes: 1.4,
    tapeWarmth: 24,
    busComp: 32,
    reverbMix: 0.18,
    reverbSize: 1.4,
    delayMix: 0.14,
    delayDivision: '3/16',
    delayFeedback: 0.34,
    ...(overrides ?? {}),
  };
}

const CHANNEL_IDS = ['ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6', 'ch7', 'ch8'];

function makeClassic808Preset(): KitPreset {
  const channels: DrumChannel[] = [
    createChannelFromArchetype('ch1', 'tr808-bd'),
    createChannelFromArchetype('ch2', 'tr808-sd'),
    createChannelFromArchetype('ch3', 'tr808-cp'),
    createChannelFromArchetype('ch4', 'tr808-ch'),
    createChannelFromArchetype('ch5', 'tr808-oh'),
    createChannelFromArchetype('ch6', 'tr808-cb'),
    createChannelFromArchetype('ch7', 'tr808-lt'),
    createChannelFromArchetype('ch8', 'tr808-rs'),
  ];

  const patA: PatternData = {
    length: 16,
    steps: {
      ch1: buildSteps([0, 6, 10], { accents: [0, 10] }),
      ch2: buildSteps([4, 12], { accents: [4, 12] }),
      ch3: buildSteps([4, 12, 15], { velocities: { 15: 0.55 } }),
      ch4: buildSteps([0, 2, 4, 6, 8, 9, 10, 12, 14], {
        velocities: { 9: 0.52, 2: 0.65, 6: 0.68, 14: 0.72 },
      }),
      ch5: buildSteps([2, 14], { velocities: { 2: 0.7, 14: 0.85 } }),
      ch6: buildSteps([0, 3, 6, 10, 12], { accents: [0, 10] }),
      ch7: buildSteps([11, 14], { pitches: { 11: 3, 14: -2 } }),
      ch8: buildSteps([7, 13], { velocities: { 7: 0.65, 13: 0.7 } }),
    },
  };

  const patB: PatternData = {
    length: 16,
    steps: {
      ch1: buildSteps([0, 3, 6, 10, 14], { accents: [0, 10] }),
      ch2: buildSteps([4, 12, 15], { accents: [4, 12], rolls: { 15: 2 } }),
      ch3: buildSteps([4, 12]),
      ch4: buildSteps([0, 1, 2, 4, 6, 7, 8, 10, 12, 14, 15], { rolls: { 15: 2 } }),
      ch5: buildSteps([6, 14]),
      ch6: buildSteps([2, 5, 8, 11, 14]),
      ch7: buildSteps([12, 13, 14, 15], { pitches: { 12: 5, 13: 3, 14: 0, 15: -3 } }),
      ch8: buildSteps([2, 9]),
    },
  };

  return {
    id: 'factory-tr808-classic',
    name: 'TR-808 Classic',
    category: 'Factory',
    genre: 'Electro / Funk',
    description: 'Authentic 1980 Roland TR-808 analog kit with cowbell syncopation and classic electro bounce.',
    bpm: 122,
    swing: 12,
    channels,
    patterns: {
      A: patA,
      B: patB,
      C: emptyPattern(CHANNEL_IDS, 16),
      D: emptyPattern(CHANNEL_IDS, 16),
    },
    lfos: defaultLfos(),
    masterFx: defaultMasterFx({ tapeWarmth: 26, reverbMix: 0.18 }),
  };
}

function makeAtlantaSpinzPreset(): KitPreset {
  const channels: DrumChannel[] = [
    createChannelFromArchetype('ch1', 'rack-kick'),
    createChannelFromArchetype('ch2', 'spinz-808'),
    createChannelFromArchetype('ch3', 'tr808-cp', { decay: 210, drive: 28 }),
    createChannelFromArchetype('ch4', 'tr808-sd', { tune: 2, decay: 160, snap: 82 }),
    createChannelFromArchetype('ch5', 'hit1-hat'),
    createChannelFromArchetype('ch6', 'tr808-oh', { decay: 320, pan: 0.24 }),
    createChannelFromArchetype('ch7', 'tr808-rs', { tune: 3 }),
    createChannelFromArchetype('ch8', 'tr808-cb', { tune: -2, level: 0.48 }),
  ];

  const patA: PatternData = {
    length: 16,
    steps: {
      ch1: buildSteps([0, 6, 10], { accents: [0, 10] }),
      ch2: buildSteps([0, 6, 10, 14], {
        accents: [0, 10],
        pitches: { 0: 0, 6: 0, 10: 3, 14: -2 },
      }),
      ch3: buildSteps([4, 12], { accents: [4, 12] }),
      ch4: buildSteps([11, 15], { velocities: { 11: 0.62, 15: 0.55 } }),
      ch5: buildSteps([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], {
        rolls: { 5: 2, 11: 3, 15: 4 },
        velocities: { 1: 0.58, 3: 0.6, 5: 0.78, 7: 0.56, 9: 0.58, 11: 0.8, 13: 0.6, 15: 0.85 },
      }),
      ch6: buildSteps([2, 10], { velocities: { 2: 0.64, 10: 0.68 } }),
      ch7: buildSteps([7, 14], { velocities: { 7: 0.6, 14: 0.7 } }),
      ch8: buildSteps([]),
    },
  };

  const patB: PatternData = {
    length: 16,
    steps: {
      ch1: buildSteps([0, 3, 6, 10], { accents: [0, 10] }),
      ch2: buildSteps([0, 3, 6, 10, 13, 15], {
        pitches: { 0: 0, 3: 5, 6: 0, 10: 3, 13: 2, 15: -2 },
      }),
      ch3: buildSteps([4, 12], { accents: [4, 12] }),
      ch4: buildSteps([4, 12, 14], { rolls: { 14: 2 }, velocities: { 14: 0.7 } }),
      ch5: buildSteps([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], {
        rolls: { 3: 2, 7: 3, 13: 2, 15: 4 },
      }),
      ch6: buildSteps([2, 8, 14]),
      ch7: buildSteps([6, 11]),
      ch8: buildSteps([0, 6, 12]),
    },
  };

  return {
    id: 'factory-atlanta-spinz',
    name: 'Atlanta Spinz',
    category: 'Factory',
    genre: 'Trap / Hip-Hop',
    description: 'Rack Kick layered with resonant Spinz 808 glides, Hit 1 Hi-Hat ratchet rolls, and crisp 808 clap.',
    bpm: 140,
    swing: 6,
    channels,
    patterns: {
      A: patA,
      B: patB,
      C: emptyPattern(CHANNEL_IDS, 16),
      D: emptyPattern(CHANNEL_IDS, 16),
    },
    lfos: defaultLfos(),
    masterFx: defaultMasterFx({ tapeWarmth: 36, busComp: 46, reverbMix: 0.14, delayMix: 0.12 }),
  };
}

function makeZayBouncePreset(): KitPreset {
  const channels: DrumChannel[] = [
    createChannelFromArchetype('ch1', 'rack-kick', { drive: 48, tune: 1 }),
    createChannelFromArchetype('ch2', 'zay-808'),
    createChannelFromArchetype('ch3', 'tr808-cp', { tune: 1, snap: 86 }),
    createChannelFromArchetype('ch4', 'tr808-rs', { tune: 2, drive: 34 }),
    createChannelFromArchetype('ch5', 'hit1-hat', { tune: 2, decay: 46 }),
    createChannelFromArchetype('ch6', 'tr808-oh', { decay: 260 }),
    createChannelFromArchetype('ch7', 'tr808-cb', { drive: 30 }),
    createChannelFromArchetype('ch8', 'tr808-mt', { tune: -3 }),
  ];

  const patA: PatternData = {
    length: 16,
    steps: {
      ch1: buildSteps([0, 8, 10], { accents: [0, 8] }),
      ch2: buildSteps([0, 3, 8, 10, 14], {
        accents: [0, 8],
        pitches: { 0: 0, 3: 7, 8: 0, 10: 5, 14: 3 },
      }),
      ch3: buildSteps([4, 12], { accents: [4, 12] }),
      ch4: buildSteps([2, 7, 15], { velocities: { 2: 0.72, 7: 0.65, 15: 0.8 } }),
      ch5: buildSteps([0, 2, 3, 4, 6, 8, 10, 11, 12, 14, 15], {
        rolls: { 3: 2, 11: 3, 15: 3 },
      }),
      ch6: buildSteps([6, 14], { velocities: { 6: 0.65, 14: 0.75 } }),
      ch7: buildSteps([0, 6, 12], { velocities: { 0: 0.7, 6: 0.55, 12: 0.72 } }),
      ch8: buildSteps([13, 15], { pitches: { 13: 2, 15: -2 } }),
    },
  };

  return {
    id: 'factory-zay-bounce',
    name: 'Zay Bounce',
    category: 'Factory',
    genre: 'Modern Rap / Bounce',
    description: 'Overdriven Zay 808 bass hits paired with punchy Rack Kick, Hit 1 hats, and gritty rim percussion.',
    bpm: 146,
    swing: 10,
    channels,
    patterns: {
      A: patA,
      B: emptyPattern(CHANNEL_IDS, 16),
      C: emptyPattern(CHANNEL_IDS, 16),
      D: emptyPattern(CHANNEL_IDS, 16),
    },
    lfos: defaultLfos(),
    masterFx: defaultMasterFx({ tapeWarmth: 44, busComp: 52, reverbMix: 0.12 }),
  };
}

function makeDetroitElectroPreset(): KitPreset {
  const channels: DrumChannel[] = [
    createChannelFromArchetype('ch1', 'tr808-bd', { decay: 640, drive: 26 }),
    createChannelFromArchetype('ch2', 'tr808-sd', { decay: 230, snap: 80 }),
    createChannelFromArchetype('ch3', 'tr808-cp', { reverbSend: 0.34, delaySend: 0.24 }),
    createChannelFromArchetype('ch4', 'tr808-ch'),
    createChannelFromArchetype('ch5', 'tr808-oh', { decay: 380 }),
    createChannelFromArchetype('ch6', 'tr808-cb', { delaySend: 0.32 }),
    createChannelFromArchetype('ch7', 'tr808-ht'),
    createChannelFromArchetype('ch8', 'tr808-cy', { decay: 1100, level: 0.52 }),
  ];

  const patA: PatternData = {
    length: 16,
    steps: {
      ch1: buildSteps([0, 6, 10, 14], { accents: [0, 10] }),
      ch2: buildSteps([4, 12], { accents: [4, 12] }),
      ch3: buildSteps([4, 12, 14], { velocities: { 14: 0.6 } }),
      ch4: buildSteps([0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14]),
      ch5: buildSteps([2, 10]),
      ch6: buildSteps([0, 3, 6, 8, 11, 14], { accents: [0, 8] }),
      ch7: buildSteps([7, 15], { pitches: { 7: 0, 15: -4 } }),
      ch8: buildSteps([0], { velocities: { 0: 0.72 } }),
    },
  };

  const lfos = defaultLfos();
  lfos[0] = {
    ...lfos[0],
    enabled: true,
    shape: 'triangle',
    sync: '1/2',
    depth: 28,
    target: 'cutoff',
    channelId: 'ch6',
  };

  return {
    id: 'factory-detroit-electro',
    name: 'Detroit Electro',
    category: 'Factory',
    genre: 'Electro / Machine Funk',
    description: 'Syncopated 808 machine funk with LFO-swept cowbell, shimmering 808 cymbal, and tape echo sends.',
    bpm: 132,
    swing: 16,
    channels,
    patterns: {
      A: patA,
      B: emptyPattern(CHANNEL_IDS, 16),
      C: emptyPattern(CHANNEL_IDS, 16),
      D: emptyPattern(CHANNEL_IDS, 16),
    },
    lfos,
    masterFx: defaultMasterFx({ delayMix: 0.24, delayDivision: '3/16', delayFeedback: 0.44 }),
  };
}

function makeWarehouseTechnoPreset(): KitPreset {
  const channels: DrumChannel[] = [
    createChannelFromArchetype('ch1', 'rack-kick', { tune: -3, decay: 380, drive: 56 }),
    createChannelFromArchetype('ch2', 'tr808-lt', { tune: -5, decay: 460, drive: 48, reverbSend: 0.42 }),
    createChannelFromArchetype('ch3', 'tr808-cp', { filterCutoff: 1550, reverbSend: 0.36, delaySend: 0.3 }),
    createChannelFromArchetype('ch4', 'hit1-hat', { decay: 44, pan: -0.22 }),
    createChannelFromArchetype('ch5', 'tr808-oh', { decay: 290, pan: 0.22 }),
    createChannelFromArchetype('ch6', 'tr808-rs', { delaySend: 0.42, pan: -0.35 }),
    createChannelFromArchetype('ch7', 'tr808-mt', { tune: -2, delaySend: 0.34, pan: 0.32 }),
    createChannelFromArchetype('ch8', 'tr808-cy', { decay: 760, filterCutoff: 6400 }),
  ];

  const patA: PatternData = {
    length: 16,
    steps: {
      ch1: buildSteps([0, 4, 8, 12], { accents: [0, 4, 8, 12] }),
      ch2: buildSteps([2, 6, 10, 14, 15], { velocities: { 2: 0.55, 6: 0.52, 10: 0.58, 14: 0.55, 15: 0.4 } }),
      ch3: buildSteps([4, 12]),
      ch4: buildSteps([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], {
        velocities: { 0: 0.4, 2: 0.9, 4: 0.4, 6: 0.9, 8: 0.4, 10: 0.9, 12: 0.4, 14: 0.9 },
      }),
      ch5: buildSteps([2, 6, 10, 14]),
      ch6: buildSteps([3, 11, 14]),
      ch7: buildSteps([5, 13]),
      ch8: buildSteps([0, 8], { velocities: { 0: 0.5, 8: 0.45 } }),
    },
  };

  const lfos = defaultLfos();
  lfos[0] = {
    ...lfos[0],
    enabled: true,
    shape: 'sine',
    sync: '1/1',
    depth: 38,
    target: 'cutoff',
    channelId: 'ch4',
  };

  return {
    id: 'factory-warehouse-techno',
    name: 'Warehouse 909/808',
    category: 'Factory',
    genre: 'Analog Techno',
    description: 'Four-on-the-floor overdriven Rack Kick with subterranean 808 tom rumble and dub echo percussion.',
    bpm: 136,
    swing: 4,
    channels,
    patterns: {
      A: patA,
      B: emptyPattern(CHANNEL_IDS, 16),
      C: emptyPattern(CHANNEL_IDS, 16),
      D: emptyPattern(CHANNEL_IDS, 16),
    },
    lfos,
    masterFx: defaultMasterFx({
      tapeWarmth: 52,
      busComp: 58,
      reverbMix: 0.28,
      reverbSize: 2.3,
      delayMix: 0.26,
      delayFeedback: 0.48,
    }),
  };
}

function makeLofiTape808Preset(): KitPreset {
  const channels: DrumChannel[] = [
    createChannelFromArchetype('ch1', 'tr808-bd', { tune: -2, filterCutoff: 950, drive: 40, decay: 460 }),
    createChannelFromArchetype('ch2', 'tr808-sd', { tune: -3, filterCutoff: 320, decay: 190, drive: 32, reverbSend: 0.28 }),
    createChannelFromArchetype('ch3', 'tr808-cp', { filterCutoff: 980, reverbSend: 0.34 }),
    createChannelFromArchetype('ch4', 'tr808-ch', { filterCutoff: 5200, decay: 55 }),
    createChannelFromArchetype('ch5', 'tr808-oh', { filterCutoff: 4800, decay: 310 }),
    createChannelFromArchetype('ch6', 'tr808-rs', { tune: -4, reverbSend: 0.3 }),
    createChannelFromArchetype('ch7', 'spinz-808', { tune: -2, filterCutoff: 880, decay: 680 }),
    createChannelFromArchetype('ch8', 'tr808-lt', { tune: -2, reverbSend: 0.26 }),
  ];

  const patA: PatternData = {
    length: 16,
    steps: {
      ch1: buildSteps([0, 7, 10], { accents: [0, 10] }),
      ch2: buildSteps([4, 12], { accents: [4, 12] }),
      ch3: buildSteps([12], { velocities: { 12: 0.58 } }),
      ch4: buildSteps([0, 2, 4, 6, 8, 10, 12, 14, 15], {
        velocities: { 2: 0.6, 6: 0.55, 10: 0.6, 14: 0.55, 15: 0.42 },
      }),
      ch5: buildSteps([14], { velocities: { 14: 0.6 } }),
      ch6: buildSteps([3, 11], { velocities: { 3: 0.55, 11: 0.62 } }),
      ch7: buildSteps([0, 10], { pitches: { 0: 0, 10: -3 }, velocities: { 0: 0.72, 10: 0.7 } }),
      ch8: buildSteps([15], { velocities: { 15: 0.52 } }),
    },
  };

  return {
    id: 'factory-lofi-tape-808',
    name: 'Lo-Fi Tape 808',
    category: 'Factory',
    genre: 'Boom-Bap / Dusty',
    description: 'Heavily swung, warm tape-saturated 808 kit with mellow low-pass tone and vintage spring ambience.',
    bpm: 88,
    swing: 38,
    channels,
    patterns: {
      A: patA,
      B: emptyPattern(CHANNEL_IDS, 16),
      C: emptyPattern(CHANNEL_IDS, 16),
      D: emptyPattern(CHANNEL_IDS, 16),
    },
    lfos: defaultLfos(),
    masterFx: defaultMasterFx({
      tapeWarmth: 64,
      busComp: 44,
      reverbMix: 0.26,
      reverbSize: 1.8,
      delayMix: 0.16,
      delayDivision: '1/8',
    }),
  };
}

export const FACTORY_PRESETS: KitPreset[] = [
  makeClassic808Preset(),
  makeAtlantaSpinzPreset(),
  makeZayBouncePreset(),
  makeDetroitElectroPreset(),
  makeWarehouseTechnoPreset(),
  makeLofiTape808Preset(),
];

export function clonePreset(preset: KitPreset): KitPreset {
  return JSON.parse(JSON.stringify(preset)) as KitPreset;
}
