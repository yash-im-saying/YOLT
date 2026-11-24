import React from 'react';
import type {
  DrumChannel,
  LfoConfig,
  LfoRateSync,
  LfoShape,
  LfoTarget,
  MasterFxParams,
} from '../types/drum';
import { RotaryKnob } from './RotaryKnob';

interface ModulationRackProps {
  lfos: [LfoConfig, LfoConfig];
  channels: DrumChannel[];
  onUpdateLfo: (index: 0 | 1, patch: Partial<LfoConfig>) => void;
}

const LFO_SHAPES: { value: LfoShape; label: string }[] = [
  { value: 'sine', label: 'Sine' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'sawtooth', label: 'Saw' },
  { value: 'sampleHold', label: 'S&H' },
];

const LFO_SYNCS: LfoRateSync[] = ['1/1', '1/2', '1/4', '1/8', '1/16', 'free'];

const LFO_TARGETS: { value: LfoTarget; label: string }[] = [
  { value: 'none', label: 'Off' },
  { value: 'cutoff', label: 'Filter Cutoff' },
  { value: 'pitch', label: 'Voice Pitch' },
  { value: 'pan', label: 'Stereo Pan' },
  { value: 'drive', label: 'Analog Drive' },
  { value: 'decay', label: 'Amp Decay' },
];

export const ModulationRack: React.FC<ModulationRackProps> = ({
  lfos,
  channels,
  onUpdateLfo,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {lfos.map((lfo, idx) => {
        const lfoIdx = idx as 0 | 1;
        return (
          <div
            key={lfo.id}
            className="recessed-bay rounded-[3px] border border-[#342E26] p-3 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between border-b border-[#2C261F] pb-2">
              <div className="flex items-center gap-2">
                <h3
                  className="text-sm font-semibold tracking-wider text-[#F4ECDC]"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {lfo.name} MODULATOR
                </h3>
                <span className="font-mono text-[10px] text-[#9A8E7D]">
                  {lfo.sync === 'free' ? `${lfo.rateHz.toFixed(1)} Hz` : `SYNC ${lfo.sync}`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onUpdateLfo(lfoIdx, { enabled: !lfo.enabled })}
                aria-pressed={lfo.enabled}
                aria-label={`Toggle ${lfo.name} active state`}
                className={`hw-btn px-3 py-1 rounded-[2px] font-mono text-[11px] font-semibold border cursor-pointer ${
                  lfo.enabled
                    ? 'bg-[#D94626] text-[#FAF5EA] border-[#EF765B]'
                    : 'bg-[#221E1A] text-[#9B9080] border-[#3A332B] hover:text-[#FAF5EA]'
                }`}
              >
                {lfo.enabled ? 'ACTIVE' : 'BYPASS'}
              </button>
            </div>

            <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-[11px] text-[#A99E8C]">
                  <span>Waveform</span>
                  <select
                    value={lfo.shape}
                    onChange={(e) => onUpdateLfo(lfoIdx, { shape: e.target.value as LfoShape })}
                    className="bg-[#1A1714] text-xs text-[#E8DFCE] border border-[#352E27] rounded-[2px] px-2 py-1.5 cursor-pointer"
                  >
                    {LFO_SHAPES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1 text-[11px] text-[#A99E8C]">
                  <span>Clock Sync</span>
                  <select
                    value={lfo.sync}
                    onChange={(e) => onUpdateLfo(lfoIdx, { sync: e.target.value as LfoRateSync })}
                    className="bg-[#1A1714] text-xs font-mono text-[#E8DFCE] border border-[#352E27] rounded-[2px] px-2 py-1.5 cursor-pointer"
                  >
                    {LFO_SYNCS.map((rate) => (
                      <option key={rate} value={rate}>
                        {rate === 'free' ? 'Free (Hz)' : `Sync ${rate}`}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1 text-[11px] text-[#A99E8C]">
                  <span>Destination</span>
                  <select
                    value={lfo.target}
                    onChange={(e) => onUpdateLfo(lfoIdx, { target: e.target.value as LfoTarget })}
                    className="bg-[#1A1714] text-xs text-[#E8DFCE] border border-[#352E27] rounded-[2px] px-2 py-1.5 cursor-pointer"
                  >
                    {LFO_TARGETS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1 text-[11px] text-[#A99E8C]">
                  <span>Target Channel</span>
                  <select
                    value={lfo.channelId}
                    onChange={(e) => onUpdateLfo(lfoIdx, { channelId: e.target.value })}
                    className="bg-[#1A1714] text-xs text-[#E8DFCE] border border-[#352E27] rounded-[2px] px-2 py-1.5 cursor-pointer"
                  >
                    <option value="selected">Selected Channel</option>
                    <option value="all">All 8 Channels</option>
                    {channels.map((ch, cIdx) => (
                      <option key={ch.id} value={ch.id}>
                        CH {cIdx + 1} · {ch.shortName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex items-center gap-3 pl-2 border-l border-[#2B251F]">
                <RotaryKnob
                  label="Depth"
                  value={lfo.depth}
                  min={0}
                  max={100}
                  step={1}
                  defaultValue={35}
                  accent="orange"
                  formatValue={(v) => `${Math.round(v)}%`}
                  onChange={(v) => onUpdateLfo(lfoIdx, { depth: v })}
                />
                {lfo.sync === 'free' && (
                  <RotaryKnob
                    label="Rate"
                    value={lfo.rateHz}
                    min={0.1}
                    max={20}
                    step={0.1}
                    defaultValue={2.0}
                    logarithmic
                    accent="amber"
                    formatValue={(v) => `${v.toFixed(1)}Hz`}
                    onChange={(v) => onUpdateLfo(lfoIdx, { rateHz: v })}
                  />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

interface MasterFxRackProps {
  masterFx: MasterFxParams;
  onUpdateMasterFx: <K extends keyof MasterFxParams>(key: K, value: MasterFxParams[K]) => void;
}

export const MasterFxRack: React.FC<MasterFxRackProps> = ({
  masterFx,
  onUpdateMasterFx,
}) => {
  const formatDjFilter = (v: number) => {
    if (Math.abs(v) < 0.03) return 'FLAT';
    return v < 0 ? `LP ${Math.round(Math.abs(v) * 100)}%` : `HP ${Math.round(v * 100)}%`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {/* Master Performance Filter & Analog Bus */}
      <div className="recessed-bay rounded-[3px] border border-[#342E26] p-3 flex flex-col gap-2.5">
        <div className="text-[11px] font-semibold tracking-wider text-[#C7BCAA] border-b border-[#2C261F] pb-1" style={{ fontFamily: 'var(--font-display)' }}>
          MASTER PERFORMANCE FILTER &amp; TAPE
        </div>
        <div className="grid grid-cols-4 gap-1 justify-items-center">
          <RotaryKnob
            size="sm"
            label="DJ Filter"
            value={masterFx.djFilter}
            min={-1}
            max={1}
            step={0.02}
            defaultValue={0}
            bipolar
            accent="red"
            formatValue={formatDjFilter}
            onChange={(v) => onUpdateMasterFx('djFilter', v)}
          />
          <RotaryKnob
            size="sm"
            label="Reso"
            value={masterFx.djFilterRes}
            min={0.7}
            max={12}
            step={0.1}
            defaultValue={1.4}
            accent="orange"
            formatValue={(v) => v.toFixed(1)}
            onChange={(v) => onUpdateMasterFx('djFilterRes', v)}
          />
          <RotaryKnob
            size="sm"
            label="Tape Sat"
            value={masterFx.tapeWarmth}
            min={0}
            max={100}
            step={1}
            defaultValue={24}
            accent="amber"
            formatValue={(v) => `${Math.round(v)}%`}
            onChange={(v) => onUpdateMasterFx('tapeWarmth', v)}
          />
          <RotaryKnob
            size="sm"
            label="Bus Comp"
            value={masterFx.busComp}
            min={0}
            max={100}
            step={1}
            defaultValue={32}
            accent="ivory"
            formatValue={(v) => `${Math.round(v)}%`}
            onChange={(v) => onUpdateMasterFx('busComp', v)}
          />
        </div>
      </div>

      {/* Vintage Stereo Plate / Spring Reverb */}
      <div className="recessed-bay rounded-[3px] border border-[#342E26] p-3 flex flex-col gap-2.5">
        <div className="text-[11px] font-semibold tracking-wider text-[#C7BCAA] border-b border-[#2C261F] pb-1" style={{ fontFamily: 'var(--font-display)' }}>
          STEREO SPRING / PLATE REVERB
        </div>
        <div className="grid grid-cols-3 gap-2 justify-items-center">
          <RotaryKnob
            label="Return"
            value={masterFx.reverbMix}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.18}
            accent="amber"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onUpdateMasterFx('reverbMix', v)}
          />
          <RotaryKnob
            label="Decay"
            value={masterFx.reverbSize}
            min={0.3}
            max={3.5}
            step={0.1}
            defaultValue={1.4}
            accent="orange"
            formatValue={(v) => `${v.toFixed(1)}s`}
            onChange={(v) => onUpdateMasterFx('reverbSize', v)}
          />
          <RotaryKnob
            label="Master Out"
            value={masterFx.masterVolume}
            min={0}
            max={1.2}
            step={0.01}
            defaultValue={0.9}
            accent="ivory"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onUpdateMasterFx('masterVolume', v)}
          />
        </div>
      </div>

      {/* Stereo Tape Echo */}
      <div className="recessed-bay rounded-[3px] border border-[#342E26] p-3 flex flex-col gap-2.5">
        <div className="flex items-center justify-between border-b border-[#2C261F] pb-1">
          <span className="text-[11px] font-semibold tracking-wider text-[#C7BCAA]" style={{ fontFamily: 'var(--font-display)' }}>
            STEREO TAPE ECHO
          </span>
          <select
            aria-label="Tape echo sync division"
            value={masterFx.delayDivision}
            onChange={(e) =>
              onUpdateMasterFx(
                'delayDivision',
                e.target.value as MasterFxParams['delayDivision']
              )
            }
            className="bg-[#1C1916] text-[10px] font-mono text-[#E8DFCE] border border-[#352F27] rounded-[2px] px-1.5 py-0.5 cursor-pointer"
          >
            <option value="1/16">1/16</option>
            <option value="1/8">1/8</option>
            <option value="3/16">3/16 Dot</option>
            <option value="1/4">1/4</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2 justify-items-center">
          <RotaryKnob
            label="Echo Mix"
            value={masterFx.delayMix}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.14}
            accent="orange"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onUpdateMasterFx('delayMix', v)}
          />
          <RotaryKnob
            label="Feedback"
            value={masterFx.delayFeedback}
            min={0}
            max={0.82}
            step={0.01}
            defaultValue={0.34}
            accent="red"
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onUpdateMasterFx('delayFeedback', v)}
          />
        </div>
      </div>
    </div>
  );
};
