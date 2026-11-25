export type VoiceArchetype =
  | 'rack-kick'
  | 'spinz-808'
  | 'zay-808'
  | 'hit1-hat'
  | 'tr808-bd'
  | 'tr808-sd'
  | 'tr808-cp'
  | 'tr808-ch'
  | 'tr808-oh'
  | 'tr808-cb'
  | 'tr808-lt'
  | 'tr808-mt'
  | 'tr808-ht'
  | 'tr808-rs'
  | 'tr808-cy'
  | 'user-sample';

export type FilterMode = 'lowpass' | 'highpass' | 'bandpass';

export interface CustomSampleMeta {
  id: string;
  name: string;
  durationSec: number;
  sampleRate: number;
  channels: number;
  peaks: number[];
}

export interface VoiceParams {
  tune: number;          // -24 to +24 semitones relative to archetype base pitch
  pitchEnv: number;      // 0 to 100 % pitch sweep depth
  pitchDecay: number;    // 5 to 300 ms
  attack: number;        // 0 to 250 ms (ADSR A)
  decay: number;         // 15 to 2200 ms (ADSR D)
  sustain: number;       // 0 to 100 % (ADSR S)
  release: number;       // 8 to 2000 ms (ADSR R)
  tone: number;          // 0 to 100 % body/harmonic tone
  snap: number;          // 0 to 100 % click/noise/snappy mix
  filterMode: FilterMode;
  filterCutoff: number;  // 80 to 18000 Hz
  filterRes: number;     // 0.5 to 18 Q
  drive: number;         // 0 to 100 % analog saturation
  pan: number;           // -1 (L) to +1 (R)
  level: number;         // 0 to 1
  reverbSend: number;    // 0 to 1
  delaySend: number;     // 0 to 1
  chokeGroup: number;    // 0 = none, 1 = hi-hats, 2 = bass/808
}

export interface StepData {
  active: boolean;
  velocity: number;      // 0.1 to 1.0
  accent: boolean;
  pitchOffset: number;   // -12 to +12 semitones per-step P-lock
  filterOffset: number;  // -50 to +50 % filter cutoff shift
  roll: 1 | 2 | 3 | 4;   // ratchet/roll subdivisions per step
  probability: number;   // 10 to 100 %
}

export interface DrumChannel {
  id: string;
  shortName: string;
  name: string;
  archetype: VoiceArchetype;
  midiNote: number;
  mute: boolean;
  solo: boolean;
  params: VoiceParams;
  customSample?: CustomSampleMeta;
}

export type LfoShape = 'sine' | 'triangle' | 'sawtooth' | 'sampleHold';
export type LfoRateSync = '1/1' | '1/2' | '1/4' | '1/8' | '1/16' | 'free';
export type LfoTarget = 'none' | 'cutoff' | 'pitch' | 'pan' | 'drive' | 'decay';

export interface LfoConfig {
  id: 'lfo1' | 'lfo2';
  name: string;
  enabled: boolean;
  shape: LfoShape;
  sync: LfoRateSync;
  rateHz: number;        // used when sync === 'free' (0.1 to 20 Hz)
  depth: number;         // 0 to 100 %
  target: LfoTarget;
  channelId: string;     // 'selected' | 'all' | specific channel id
}

export interface MasterFxParams {
  masterVolume: number;       // 0 to 1.2
  djFilter: number;           // -1 (LPF) to 0 (Bypass) to +1 (HPF)
  djFilterRes: number;        // 0.7 to 12
  tapeWarmth: number;         // 0 to 100 %
  busComp: number;            // 0 to 100 %
  reverbMix: number;          // 0 to 1
  reverbSize: number;         // 0.3 to 3.5 seconds
  delayMix: number;           // 0 to 1
  delayDivision: '1/8' | '3/16' | '1/4' | '1/16';
  delayFeedback: number;      // 0 to 0.82
}

export type PatternBankId = 'A' | 'B' | 'C' | 'D';

export interface PatternData {
  length: 16 | 32;
  steps: Record<string, StepData[]>; // channelId -> StepData[32]
}

export interface KitPreset {
  id: string;
  name: string;
  category: 'Factory' | 'User';
  genre: string;
  description: string;
  bpm: number;
  swing: number; // 0 to 75 %
  channels: DrumChannel[];
  patterns: Record<PatternBankId, PatternData>;
  lfos: [LfoConfig, LfoConfig];
  masterFx: MasterFxParams;
  createdAt?: number;
}

export type ExportFormat = 'wav' | 'aiff' | 'flac' | 'midi';

export interface ExportOptions {
  format: ExportFormat;
  bitDepth: 16 | 24;
  sampleRate: 44100 | 48000;
  bars: 1 | 2 | 4 | 8;
  includeTail: boolean;
  fileName: string;
}

export interface ArchetypeMeta {
  id: VoiceArchetype;
  name: string;
  shortName: string;
  category: 'Mainstream' | 'TR-808 Kit' | 'User Sample';
  midiNote: number;
  baseFreq: number;
  description: string;
  defaultParams: VoiceParams;
}
