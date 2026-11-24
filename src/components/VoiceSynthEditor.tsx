import React from 'react';
import { RotateCcw, Volume2 } from 'lucide-react';
import type { DrumChannel, FilterMode, VoiceArchetype, VoiceParams } from '../types/drum';
import { ARCHETYPES } from '../audio/presets';
import { RotaryKnob } from './RotaryKnob';

interface VoiceSynthEditorProps {
  channel: DrumChannel;
  onUpdateParam: <K extends keyof VoiceParams>(key: K, value: VoiceParams[K]) => void;
  onChangeArchetype: (archetype: VoiceArchetype) => void;
  onResetVoice: () => void;
  onAudition: () => void;
}

const QUICK_MAINSTREAM: VoiceArchetype[] = [
  'rack-kick',
  'spinz-808',
  'zay-808',
  'hit1-hat',
  'tr808-bd',
  'tr808-sd',
  'tr808-cp',
  'tr808-cb',
];

const FILTER_MODES: { value: FilterMode; label: string }[] = [
  { value: 'lowpass', label: 'LP' },
  { value: 'bandpass', label: 'BP' },
  { value: 'highpass', label: 'HP' },
];

export const VoiceSynthEditor: React.FC<VoiceSynthEditorProps> = ({
  channel,
  onUpdateParam,
  onChangeArchetype,
  onResetVoice,
  onAudition,
}) => {
  const { params } = channel;
  const meta = ARCHETYPES[channel.archetype];

  const formatHz = (v: number) =>
    v >= 1000 ? `${(v / 1000).toFixed(1)}kHz` : `${Math.round(v)}Hz`;

  const formatPan = (v: number) => {
    if (Math.abs(v) < 0.03) return 'C';
    return v < 0 ? `L${Math.round(Math.abs(v) * 100)}` : `R${Math.round(v * 100)}`;
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Selected Voice Header & Quick Archetype Swapper */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#322C25]">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-[#E27A27]">
              {channel.shortName}
            </span>
            <h3 className="text-sm font-semibold text-[#F4ECDC] truncate">
              {channel.name}
            </h3>
            <span className="text-xs text-[#8D8272] hidden sm:inline">
              · {meta.category}
            </span>
          </div>
          <p className="text-xs text-[#9D9281] mt-0.5 truncate">
            {meta.description}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onAudition}
            className="hw-btn flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] text-xs font-semibold bg-[#2D2721] text-[#F4ECDC] border border-[#494037] hover:bg-[#383129] cursor-pointer whitespace-nowrap"
          >
            <Volume2 className="w-3.5 h-3.5 text-[#E0B034]" />
            <span>Audition</span>
          </button>
          <button
            type="button"
            onClick={onResetVoice}
            aria-label={`Reset ${channel.name} parameters to factory defaults`}
            className="hw-btn flex items-center gap-1 px-2.5 py-1.5 rounded-[3px] text-xs font-medium bg-[#221E1A] text-[#C5BAA8] border border-[#3B342C] hover:text-[#FAF5EA] cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Quick Sound Swap Strip (Mainstream & TR-808 Signature Voices) */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-medium text-[#968B7A] mr-1">
          Quick Swap:
        </span>
        {QUICK_MAINSTREAM.map((archId) => {
          const item = ARCHETYPES[archId];
          const active = channel.archetype === archId;
          return (
            <button
              key={archId}
              type="button"
              onClick={() => onChangeArchetype(archId)}
              aria-pressed={active}
              className={`px-2.5 py-1 rounded-[2px] text-[11px] font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                active
                  ? 'bg-[#E27A27] text-[#141210] border-[#F6AA68] font-semibold'
                  : 'bg-[#191613] text-[#C9BEA9] border-[#332D26] hover:bg-[#26211C] hover:text-[#FAF5EA]'
              }`}
            >
              {item.name.replace('TR-808 ', '808 ')}
            </button>
          );
        })}
      </div>

      {/* 4 Analog Synthesis Parameter Bays */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2.5">
        {/* Section 1: Oscillator & Pitch */}
        <div className="recessed-bay rounded-[3px] border border-[#322C24] p-2.5 flex flex-col gap-2.5">
          <div className="text-[11px] font-semibold tracking-wider text-[#C7BCAA] border-b border-[#2B251F] pb-1" style={{ fontFamily: 'var(--font-display)' }}>
            OSCILLATOR &amp; PITCH
          </div>
          <div className="grid grid-cols-3 gap-1.5 justify-items-center">
            <RotaryKnob
              label="Tune"
              value={params.tune}
              min={-24}
              max={24}
              step={1}
              defaultValue={meta.defaultParams.tune}
              bipolar
              accent="amber"
              formatValue={(v) => `${v > 0 ? '+' : ''}${Math.round(v)}st`}
              onChange={(v) => onUpdateParam('tune', v)}
            />
            <RotaryKnob
              label="Pitch Env"
              value={params.pitchEnv}
              min={0}
              max={100}
              step={1}
              defaultValue={meta.defaultParams.pitchEnv}
              accent="orange"
              formatValue={(v) => `${Math.round(v)}%`}
              onChange={(v) => onUpdateParam('pitchEnv', v)}
            />
            <RotaryKnob
              label="P. Decay"
              value={params.pitchDecay}
              min={5}
              max={300}
              step={1}
              defaultValue={meta.defaultParams.pitchDecay}
              logarithmic
              accent="orange"
              formatValue={(v) => `${Math.round(v)}ms`}
              onChange={(v) => onUpdateParam('pitchDecay', v)}
            />
          </div>
        </div>

        {/* Section 2: Envelope & Timbre */}
        <div className="recessed-bay rounded-[3px] border border-[#322C24] p-2.5 flex flex-col gap-2.5">
          <div className="text-[11px] font-semibold tracking-wider text-[#C7BCAA] border-b border-[#2B251F] pb-1" style={{ fontFamily: 'var(--font-display)' }}>
            ENVELOPE &amp; TIMBRE
          </div>
          <div className="grid grid-cols-4 gap-1 justify-items-center">
            <RotaryKnob
              size="sm"
              label="Attack"
              value={params.attack}
              min={0}
              max={50}
              step={1}
              defaultValue={meta.defaultParams.attack}
              accent="ivory"
              formatValue={(v) => `${Math.round(v)}ms`}
              onChange={(v) => onUpdateParam('attack', v)}
            />
            <RotaryKnob
              size="sm"
              label="Decay"
              value={params.decay}
              min={20}
              max={2200}
              step={5}
              defaultValue={meta.defaultParams.decay}
              logarithmic
              accent="orange"
              formatValue={(v) => (v >= 1000 ? `${(v / 1000).toFixed(2)}s` : `${Math.round(v)}ms`)}
              onChange={(v) => onUpdateParam('decay', v)}
            />
            <RotaryKnob
              size="sm"
              label="Tone"
              value={params.tone}
              min={0}
              max={100}
              step={1}
              defaultValue={meta.defaultParams.tone}
              accent="amber"
              formatValue={(v) => `${Math.round(v)}%`}
              onChange={(v) => onUpdateParam('tone', v)}
            />
            <RotaryKnob
              size="sm"
              label="Snap"
              value={params.snap}
              min={0}
              max={100}
              step={1}
              defaultValue={meta.defaultParams.snap}
              accent="red"
              formatValue={(v) => `${Math.round(v)}%`}
              onChange={(v) => onUpdateParam('snap', v)}
            />
          </div>
        </div>

        {/* Section 3: Analog Filter & Drive */}
        <div className="recessed-bay rounded-[3px] border border-[#322C24] p-2.5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between border-b border-[#2B251F] pb-1">
            <span className="text-[11px] font-semibold tracking-wider text-[#C7BCAA]" style={{ fontFamily: 'var(--font-display)' }}>
              VCF &amp; DRIVE
            </span>
            <div className="flex items-center gap-0.5" role="group" aria-label="Filter mode">
              {FILTER_MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => onUpdateParam('filterMode', m.value)}
                  aria-pressed={params.filterMode === m.value}
                  className={`px-1.5 py-0.5 font-mono text-[10px] rounded-[2px] cursor-pointer ${
                    params.filterMode === m.value
                      ? 'bg-[#E0B034] text-[#141210] font-semibold'
                      : 'bg-[#221E1A] text-[#9A8E7D] hover:text-[#FAF5EA]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5 justify-items-center">
            <RotaryKnob
              label="Cutoff"
              value={params.filterCutoff}
              min={80}
              max={18000}
              step={10}
              defaultValue={meta.defaultParams.filterCutoff}
              logarithmic
              accent="amber"
              formatValue={formatHz}
              onChange={(v) => onUpdateParam('filterCutoff', v)}
            />
            <RotaryKnob
              label="Reso"
              value={params.filterRes}
              min={0.5}
              max={18}
              step={0.1}
              defaultValue={meta.defaultParams.filterRes}
              accent="orange"
              formatValue={(v) => v.toFixed(1)}
              onChange={(v) => onUpdateParam('filterRes', v)}
            />
            <RotaryKnob
              label="Drive"
              value={params.drive}
              min={0}
              max={100}
              step={1}
              defaultValue={meta.defaultParams.drive}
              accent="red"
              formatValue={(v) => `${Math.round(v)}%`}
              onChange={(v) => onUpdateParam('drive', v)}
            />
          </div>
        </div>

        {/* Section 4: Stereo Routing & Sends */}
        <div className="recessed-bay rounded-[3px] border border-[#322C24] p-2.5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between border-b border-[#2B251F] pb-1">
            <span className="text-[11px] font-semibold tracking-wider text-[#C7BCAA]" style={{ fontFamily: 'var(--font-display)' }}>
              STEREO &amp; SENDS
            </span>
            <select
              aria-label="Choke group"
              value={params.chokeGroup}
              onChange={(e) => onUpdateParam('chokeGroup', Number(e.target.value))}
              className="bg-[#1C1916] text-[10px] font-mono text-[#D8CEBC] border border-[#352F27] rounded-[2px] px-1 py-0.5 cursor-pointer"
            >
              <option value={0}>No Choke</option>
              <option value={1}>Choke 1 (Hats)</option>
              <option value={2}>Choke 2 (808)</option>
            </select>
          </div>
          <div className="grid grid-cols-3 gap-1.5 justify-items-center">
            <RotaryKnob
              label="Pan"
              value={params.pan}
              min={-1}
              max={1}
              step={0.02}
              defaultValue={meta.defaultParams.pan}
              bipolar
              accent="ivory"
              formatValue={formatPan}
              onChange={(v) => onUpdateParam('pan', v)}
            />
            <RotaryKnob
              label="Reverb"
              value={params.reverbSend}
              min={0}
              max={1}
              step={0.01}
              defaultValue={meta.defaultParams.reverbSend}
              accent="amber"
              formatValue={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => onUpdateParam('reverbSend', v)}
            />
            <RotaryKnob
              label="Echo"
              value={params.delaySend}
              min={0}
              max={1}
              step={0.01}
              defaultValue={meta.defaultParams.delaySend}
              accent="orange"
              formatValue={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => onUpdateParam('delaySend', v)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
