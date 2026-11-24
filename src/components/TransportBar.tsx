import React from 'react';
import { ChevronLeft, ChevronRight, Download, FolderOpen, Play, Square, Zap } from 'lucide-react';
import type { PatternBankId } from '../types/drum';

interface TransportBarProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  bpm: number;
  onChangeBpm: (bpm: number) => void;
  onTapTempo: () => void;
  swing: number;
  onChangeSwing: (swing: number) => void;
  activeBank: PatternBankId;
  onSelectBank: (bank: PatternBankId) => void;
  patternLength: 16 | 32;
  onToggleLength: () => void;
  fillActive: boolean;
  onSetFillActive: (active: boolean) => void;
  presetName: string;
  onPrevPreset: () => void;
  onNextPreset: () => void;
  onOpenPresets: () => void;
  onOpenExport: () => void;
}

const BANKS: PatternBankId[] = ['A', 'B', 'C', 'D'];

export const TransportBar: React.FC<TransportBarProps> = ({
  isPlaying,
  onTogglePlay,
  bpm,
  onChangeBpm,
  onTapTempo,
  swing,
  onChangeSwing,
  activeBank,
  onSelectBank,
  patternLength,
  onToggleLength,
  fillActive,
  onSetFillActive,
  presetName,
  onPrevPreset,
  onNextPreset,
  onOpenPresets,
  onOpenExport,
}) => {
  return (
    <header className="anodized-panel border-b border-[#3A332B] px-4 py-2.5 flex flex-wrap items-center justify-between gap-4">
      {/* Zone 1: Vintage Brand Plate + Quick Preset Switcher */}
      <div className="flex items-center gap-5 shrink-0">
        <div className="flex flex-col">
          <h1
            className="font-display text-2xl font-bold tracking-wider text-[#F4ECDC] leading-none whitespace-nowrap"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            VOLT 808
          </h1>
          <div className="mt-1 h-[3px] w-full flex">
            <span className="flex-1 bg-[#D94626]" />
            <span className="flex-1 bg-[#E27A27]" />
            <span className="flex-1 bg-[#E0B034]" />
            <span className="flex-1 bg-[#E6DCC5]" />
          </div>
        </div>

        {/* Instant Live Preset Stepper */}
        <div className="flex items-center bg-[#141210] border border-[#3B342C] rounded-[3px]">
          <button
            type="button"
            onClick={onPrevPreset}
            aria-label="Previous preset"
            className="px-2 py-1.5 text-[#B7AC9A] hover:text-[#FAF5EA] hover:bg-[#26221D] transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onOpenPresets}
            aria-label={`Open preset manager, active preset ${presetName}`}
            className="px-3 py-1.5 text-left min-w-[152px] max-w-[200px] border-x border-[#2D2822] hover:bg-[#1E1A16] transition-colors cursor-pointer"
          >
            <span className="block font-mono text-xs font-medium text-[#F5C562] truncate">
              {presetName}
            </span>
          </button>
          <button
            type="button"
            onClick={onNextPreset}
            aria-label="Next preset"
            className="px-2 py-1.5 text-[#B7AC9A] hover:text-[#FAF5EA] hover:bg-[#26221D] transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Zone 2: Tactile Transport, Clock, Swing & Pattern Banks */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Start / Stop */}
        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={isPlaying ? 'Stop sequencer' : 'Play sequencer'}
          className={`hw-btn flex items-center gap-2 px-4 py-2 rounded-[3px] text-xs font-semibold tracking-wider whitespace-nowrap cursor-pointer border ${
            isPlaying
              ? 'bg-[#C93F22] text-[#FAF5EA] border-[#E86E4E]'
              : 'bg-[#2C2722] text-[#E8DFCE] border-[#4A4238] hover:bg-[#352F29]'
          }`}
        >
          {isPlaying ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
          <span>{isPlaying ? 'Stop' : 'Play'}</span>
        </button>

        {/* Live Fill Trigger */}
        <button
          type="button"
          onPointerDown={() => onSetFillActive(true)}
          onPointerUp={() => onSetFillActive(false)}
          onPointerLeave={() => onSetFillActive(false)}
          onClick={() => onSetFillActive(!fillActive)}
          aria-pressed={fillActive}
          aria-label="Trigger live drum fill"
          className={`hw-btn flex items-center gap-1.5 px-3 py-2 rounded-[3px] text-xs font-semibold tracking-wider whitespace-nowrap cursor-pointer border ${
            fillActive
              ? 'bg-[#E27A27] text-[#141210] border-[#F7AD65]'
              : 'bg-[#24201C] text-[#D8CEBC] border-[#3F3830] hover:bg-[#2E2924]'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Fill</span>
        </button>

        {/* BPM Clock & Tap */}
        <div className="flex items-center gap-1.5 bg-[#141210] border border-[#3B342C] rounded-[3px] px-2.5 py-1">
          <label htmlFor="bpm-input" className="text-[11px] font-medium text-[#A69B89] whitespace-nowrap">
            BPM
          </label>
          <input
            id="bpm-input"
            type="number"
            min={40}
            max={240}
            value={bpm}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!Number.isNaN(v)) onChangeBpm(Math.min(240, Math.max(40, Math.round(v))));
            }}
            className="w-14 bg-transparent font-mono text-sm font-semibold tabular-nums text-[#F5C562] text-center focus:outline-none focus:ring-1 focus:ring-[#E27A27] rounded-[2px]"
          />
          <button
            type="button"
            onClick={onTapTempo}
            className="px-2 py-0.5 text-[11px] font-medium bg-[#27231E] text-[#D7CEBC] border border-[#423B32] rounded-[2px] hover:bg-[#332D27] cursor-pointer whitespace-nowrap"
          >
            Tap
          </button>
        </div>

        {/* Swing Control */}
        <div className="flex items-center gap-2 bg-[#141210] border border-[#3B342C] rounded-[3px] px-2.5 py-1">
          <label htmlFor="swing-slider" className="text-[11px] font-medium text-[#A69B89] whitespace-nowrap">
            Swing
          </label>
          <input
            id="swing-slider"
            type="range"
            min={0}
            max={75}
            value={swing}
            onChange={(e) => onChangeSwing(Number(e.target.value))}
            className="w-16 accent-[#E27A27] cursor-pointer"
          />
          <span className="font-mono text-xs tabular-nums text-[#E8DFCE] w-8 text-right">
            {swing}%
          </span>
        </div>

        {/* Pattern Bank A / B / C / D */}
        <div className="flex items-center gap-1 bg-[#141210] border border-[#3B342C] rounded-[3px] p-1" role="group" aria-label="Pattern banks">
          {BANKS.map((bank) => {
            const active = bank === activeBank;
            return (
              <button
                key={bank}
                type="button"
                onClick={() => onSelectBank(bank)}
                aria-pressed={active}
                aria-label={`Pattern bank ${bank}`}
                className={`w-7 h-7 font-mono text-xs font-semibold rounded-[2px] cursor-pointer transition-colors ${
                  active
                    ? 'bg-[#E0B034] text-[#141210]'
                    : 'bg-[#221E1A] text-[#A99F8E] hover:text-[#FAF5EA] hover:bg-[#2E2924]'
                }`}
              >
                {bank}
              </button>
            );
          })}
          <button
            type="button"
            onClick={onToggleLength}
            aria-label={`Toggle pattern length, currently ${patternLength} steps`}
            className="ml-1 px-2 h-7 font-mono text-[11px] font-semibold bg-[#221E1A] text-[#D8CEBC] border border-[#3A332B] rounded-[2px] hover:bg-[#2F2A24] cursor-pointer whitespace-nowrap"
          >
            {patternLength} Steps
          </button>
        </div>
      </div>

      {/* Zone 3: Presets & 24-Bit Export Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onOpenPresets}
          className="hw-btn flex items-center gap-1.5 px-3 py-2 rounded-[3px] text-xs font-semibold bg-[#26221E] text-[#E8DFCE] border border-[#443C33] hover:bg-[#322D27] whitespace-nowrap cursor-pointer"
        >
          <FolderOpen className="w-3.5 h-3.5 text-[#E0B034]" />
          <span>Presets</span>
        </button>

        <button
          type="button"
          onClick={onOpenExport}
          className="hw-btn flex items-center gap-1.5 px-3.5 py-2 rounded-[3px] text-xs font-semibold bg-[#D94626] text-[#FAF5EA] border border-[#EE7154] hover:bg-[#E45232] whitespace-nowrap cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export 24-Bit</span>
        </button>
      </div>
    </header>
  );
};
