import React from 'react';
import { ArrowLeft, ArrowRight, Sliders, Sparkles, Trash2 } from 'lucide-react';
import type { DrumChannel, PatternData, StepData } from '../types/drum';

interface StepSequencerProps {
  selectedChannel: DrumChannel;
  pattern: PatternData;
  currentStep: number;
  page: 0 | 1;
  onChangePage: (page: 0 | 1) => void;
  inspectedStepIndex: number | null;
  onInspectStep: (stepIndex: number | null) => void;
  onToggleStep: (channelId: string, stepIndex: number) => void;
  onUpdateStep: (channelId: string, stepIndex: number, patch: Partial<StepData>) => void;
  onShiftChannel: (direction: -1 | 1) => void;
  onApplyEuclidean: (pulses: number) => void;
  onClearChannel: () => void;
}

function getKeycapStyle(indexInPage: number, active: boolean): string {
  const group = Math.floor(indexInPage / 4);
  if (group === 0) {
    return active
      ? 'bg-[#C93F22] border-[#EE7658] text-[#FAF5EA]'
      : 'bg-[#7F2917] border-[#9E3924] text-[#E8CFC8] hover:bg-[#97311B]';
  }
  if (group === 1) {
    return active
      ? 'bg-[#D67222] border-[#F4A65E] text-[#171310]'
      : 'bg-[#8A4A18] border-[#A75B20] text-[#EAD8C8] hover:bg-[#A3571D]';
  }
  if (group === 2) {
    return active
      ? 'bg-[#D5A72F] border-[#F4D06E] text-[#171310]'
      : 'bg-[#8C6D1F] border-[#AA8528] text-[#EFE3C6] hover:bg-[#A68126]';
  }
  return active
    ? 'bg-[#E2D8C2] border-[#FAF3E4] text-[#171310]'
    : 'bg-[#8F8777] border-[#ABA290] text-[#1E1B17] hover:bg-[#A9A08E]';
}

export interface PatternOverviewMatrixProps {
  channels: DrumChannel[];
  selectedChannelId: string;
  pattern: PatternData;
  currentStep: number;
  page: 0 | 1;
  onSelectChannel: (channelId: string) => void;
  onToggleStep: (channelId: string, stepIndex: number) => void;
}

export const PatternOverviewMatrix: React.FC<PatternOverviewMatrixProps> = ({
  channels,
  selectedChannelId,
  pattern,
  currentStep,
  page,
  onSelectChannel,
  onToggleStep,
}) => {
  const stepOffset = page * 16;

  return (
    <section
      aria-label="8-Track Pattern Overview Matrix"
      className="anodized-panel rounded-[3px] border border-[#363028] p-3 flex flex-col gap-2"
    >
      <div className="flex items-center justify-between border-b border-[#2E2822] pb-1.5">
        <h2
          className="text-xs font-semibold tracking-wider text-[#C7BCAA]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          8-TRACK PATTERN MATRIX · STEPS {stepOffset + 1}–{stepOffset + 16}
        </h2>
        <span className="font-mono text-[10px] text-[#8F8473]">
          CLICK CELLS TO PROGRAM ANY TRACK
        </span>
      </div>

      <div className="recessed-bay rounded-[3px] border border-[#2E2822] p-2 overflow-x-auto">
        <div className="min-w-[540px] flex flex-col gap-1.5">
          {channels.map((ch) => {
            const steps = pattern.steps[ch.id] ?? [];
            const isSel = ch.id === selectedChannelId;
            return (
              <div
                key={ch.id}
                className={`grid grid-cols-[50px_repeat(16,minmax(0,1fr))] items-center gap-1 ${
                  isSel ? 'opacity-100' : 'opacity-80 hover:opacity-100'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectChannel(ch.id)}
                  className={`text-left font-mono text-[10px] font-semibold truncate px-1.5 py-0.5 rounded-[2px] cursor-pointer ${
                    isSel
                      ? 'bg-[#E27A27]/25 text-[#F5C562]'
                      : 'text-[#9D9281] hover:text-[#FAF5EA]'
                  }`}
                >
                  {ch.shortName}
                </button>
                {Array.from({ length: 16 }, (_, i) => {
                  const sIdx = stepOffset + i;
                  const s = steps[sIdx];
                  const isPlayhead = currentStep === sIdx;
                  return (
                    <button
                      key={sIdx}
                      type="button"
                      onClick={() => {
                        onSelectChannel(ch.id);
                        onToggleStep(ch.id, sIdx);
                      }}
                      aria-label={`Toggle ${ch.name} step ${sIdx + 1}`}
                      aria-pressed={Boolean(s?.active)}
                      className={`h-4 rounded-[1px] border transition-colors cursor-pointer ${
                        s?.active
                          ? isPlayhead
                            ? 'bg-[#FFF0C2] border-[#FFF0C2]'
                            : isSel
                            ? 'bg-[#E27A27] border-[#F4A564]'
                            : 'bg-[#B96A29] border-[#CE8240]'
                          : isPlayhead
                          ? 'bg-[#463D32] border-[#E0B034]'
                          : i % 4 === 0
                          ? 'bg-[#25211C] border-[#363029] hover:bg-[#332D26]'
                          : 'bg-[#191613] border-[#28231E] hover:bg-[#29241E]'
                      }`}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export const StepSequencer: React.FC<StepSequencerProps> = ({
  selectedChannel,
  pattern,
  currentStep,
  page,
  onChangePage,
  inspectedStepIndex,
  onInspectStep,
  onToggleStep,
  onUpdateStep,
  onShiftChannel,
  onApplyEuclidean,
  onClearChannel,
}) => {
  const stepOffset = page * 16;
  const channelSteps = pattern.steps[selectedChannel.id] ?? [];
  const inspectedStep =
    inspectedStepIndex !== null ? channelSteps[inspectedStepIndex] ?? null : null;

  return (
    <section
      aria-label="16-Step Tactile Drum Sequencer"
      className="anodized-panel border-t border-[#3A332B] px-4 py-2.5 flex flex-col gap-2"
    >
      {/* Sequencer Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h2
            className="text-sm font-semibold tracking-wider text-[#F4ECDC] whitespace-nowrap"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            TACTILE STEP KEYS · {selectedChannel.shortName} ({selectedChannel.name})
          </h2>

          {pattern.length === 32 && (
            <div className="flex items-center gap-1 bg-[#141210] border border-[#362F28] rounded-[2px] p-0.5">
              <button
                type="button"
                onClick={() => onChangePage(0)}
                aria-pressed={page === 0}
                className={`px-2 py-0.5 font-mono text-[11px] rounded-[2px] cursor-pointer ${
                  page === 0
                    ? 'bg-[#E0B034] text-[#141210] font-semibold'
                    : 'text-[#A69B89] hover:text-[#FAF5EA]'
                }`}
              >
                Steps 1–16
              </button>
              <button
                type="button"
                onClick={() => onChangePage(1)}
                aria-pressed={page === 1}
                className={`px-2 py-0.5 font-mono text-[11px] rounded-[2px] cursor-pointer ${
                  page === 1
                    ? 'bg-[#E0B034] text-[#141210] font-semibold'
                    : 'text-[#A69B89] hover:text-[#FAF5EA]'
                }`}
              >
                Steps 17–32
              </button>
            </div>
          )}
        </div>

        {/* Pattern Editing Utilities */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() =>
              onInspectStep(
                inspectedStepIndex !== null ? null : stepOffset
              )
            }
            aria-pressed={inspectedStepIndex !== null}
            className={`hw-btn flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] text-xs font-medium border cursor-pointer whitespace-nowrap ${
              inspectedStepIndex !== null
                ? 'bg-[#E27A27] text-[#141210] border-[#F6AA68] font-semibold'
                : 'bg-[#24201C] text-[#D8CEBC] border-[#3D362E] hover:bg-[#2F2A24]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Step P-Lock</span>
          </button>

          <button
            type="button"
            onClick={() => onShiftChannel(-1)}
            aria-label="Shift track steps left"
            className="hw-btn flex items-center gap-1 px-2 py-1 rounded-[2px] text-xs bg-[#24201C] text-[#D8CEBC] border border-[#3D362E] hover:bg-[#2F2A24] cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onShiftChannel(1)}
            aria-label="Shift track steps right"
            className="hw-btn flex items-center gap-1 px-2 py-1 rounded-[2px] text-xs bg-[#24201C] text-[#D8CEBC] border border-[#3D362E] hover:bg-[#2F2A24] cursor-pointer"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => onApplyEuclidean(5)}
            className="hw-btn flex items-center gap-1 px-2.5 py-1 rounded-[2px] text-xs bg-[#24201C] text-[#D8CEBC] border border-[#3D362E] hover:bg-[#2F2A24] cursor-pointer whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#E0B034]" />
            <span>Euclidean</span>
          </button>

          <button
            type="button"
            onClick={onClearChannel}
            aria-label={`Clear all steps for ${selectedChannel.name}`}
            className="hw-btn flex items-center gap-1 px-2.5 py-1 rounded-[2px] text-xs bg-[#24201C] text-[#D8CEBC] border border-[#3D362E] hover:text-[#FF785A] cursor-pointer whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Track</span>
          </button>
        </div>
      </div>

      {/* Inline Step Parameter Lock Inspector (Velocity, Accent, Pitch, Filter, Ratchet Roll, Probability) */}
      {inspectedStepIndex !== null && inspectedStep && (
        <div
          aria-label={`Parameter lock inspector for step ${inspectedStepIndex + 1}`}
          className="recessed-bay rounded-[3px] border border-[#E27A27]/60 px-3 py-2 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-[#F5C562]">
              P-LOCK · STEP {String(inspectedStepIndex + 1).padStart(2, '0')}
            </span>
            <button
              type="button"
              onClick={() =>
                onUpdateStep(selectedChannel.id, inspectedStepIndex, {
                  active: !inspectedStep.active,
                })
              }
              className={`px-2 py-0.5 rounded-[2px] font-mono text-[11px] font-semibold cursor-pointer ${
                inspectedStep.active
                  ? 'bg-[#C93F22] text-[#FAF5EA]'
                  : 'bg-[#26221D] text-[#A69B89]'
              }`}
            >
              {inspectedStep.active ? 'ON' : 'OFF'}
            </button>
            <button
              type="button"
              onClick={() =>
                onUpdateStep(selectedChannel.id, inspectedStepIndex, {
                  accent: !inspectedStep.accent,
                  active: true,
                })
              }
              aria-pressed={inspectedStep.accent}
              className={`px-2 py-0.5 rounded-[2px] font-mono text-[11px] font-semibold cursor-pointer ${
                inspectedStep.accent
                  ? 'bg-[#E0B034] text-[#141210]'
                  : 'bg-[#26221D] text-[#A69B89]'
              }`}
            >
              ACCENT
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <label className="flex items-center gap-1.5 text-[#B7AC9A]">
              <span>Vel</span>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={inspectedStep.velocity}
                onChange={(e) =>
                  onUpdateStep(selectedChannel.id, inspectedStepIndex, {
                    velocity: Number(e.target.value),
                    active: true,
                  })
                }
                className="w-16 accent-[#E0B034] cursor-pointer"
              />
              <span className="font-mono tabular-nums text-[#FAF5EA] w-8">
                {Math.round(inspectedStep.velocity * 100)}%
              </span>
            </label>

            <label className="flex items-center gap-1.5 text-[#B7AC9A]">
              <span>Pitch</span>
              <input
                type="range"
                min={-12}
                max={12}
                step={1}
                value={inspectedStep.pitchOffset}
                onChange={(e) =>
                  onUpdateStep(selectedChannel.id, inspectedStepIndex, {
                    pitchOffset: Number(e.target.value),
                    active: true,
                  })
                }
                className="w-16 accent-[#E27A27] cursor-pointer"
              />
              <span className="font-mono tabular-nums text-[#FAF5EA] w-8">
                {inspectedStep.pitchOffset > 0 ? `+${inspectedStep.pitchOffset}` : inspectedStep.pitchOffset}st
              </span>
            </label>

            <label className="flex items-center gap-1.5 text-[#B7AC9A]">
              <span>Filter</span>
              <input
                type="range"
                min={-50}
                max={50}
                step={5}
                value={inspectedStep.filterOffset}
                onChange={(e) =>
                  onUpdateStep(selectedChannel.id, inspectedStepIndex, {
                    filterOffset: Number(e.target.value),
                    active: true,
                  })
                }
                className="w-16 accent-[#E0B034] cursor-pointer"
              />
              <span className="font-mono tabular-nums text-[#FAF5EA] w-8">
                {inspectedStep.filterOffset > 0 ? `+${inspectedStep.filterOffset}` : inspectedStep.filterOffset}%
              </span>
            </label>

            <div className="flex items-center gap-1">
              <span className="text-[#B7AC9A] mr-1">Roll</span>
              {([1, 2, 3, 4] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() =>
                    onUpdateStep(selectedChannel.id, inspectedStepIndex, {
                      roll: r,
                      active: true,
                    })
                  }
                  aria-pressed={inspectedStep.roll === r}
                  className={`px-1.5 py-0.5 rounded-[2px] font-mono text-[11px] cursor-pointer ${
                    inspectedStep.roll === r
                      ? 'bg-[#E27A27] text-[#141210] font-semibold'
                      : 'bg-[#24201C] text-[#B7AC9A] hover:text-[#FAF5EA]'
                  }`}
                >
                  {r}x
                </button>
              ))}
            </div>

            <label className="flex items-center gap-1.5 text-[#B7AC9A]">
              <span>Prob</span>
              <input
                type="range"
                min={10}
                max={100}
                step={10}
                value={inspectedStep.probability}
                onChange={(e) =>
                  onUpdateStep(selectedChannel.id, inspectedStepIndex, {
                    probability: Number(e.target.value),
                  })
                }
                className="w-14 accent-[#E0B034] cursor-pointer"
              />
              <span className="font-mono tabular-nums text-[#FAF5EA] w-9">
                {inspectedStep.probability}%
              </span>
            </label>
          </div>
        </div>
      )}

      {/* Classic TR-808 16 Tactile Hardware Step Keys */}
      <div className="grid grid-cols-8 lg:grid-cols-16 gap-1.5">
        {Array.from({ length: 16 }, (_, i) => {
          const sIdx = stepOffset + i;
          const step = channelSteps[sIdx];
          const isActive = Boolean(step?.active);
          const isPlayhead = currentStep === sIdx;
          const isInspected = inspectedStepIndex === sIdx;

          return (
            <div key={sIdx} className="flex flex-col items-center gap-1">
              {/* Step Number Silkscreen */}
              <div className="w-full flex items-center justify-between px-0.5 font-mono text-[10px] text-[#9A8E7D]">
                <span>{String(sIdx + 1).padStart(2, '0')}</span>
                {step && (step.roll > 1 || step.pitchOffset !== 0 || step.accent) && isActive && (
                  <span className="text-[9px] font-semibold text-[#F5C562]">
                    {step.roll > 1
                      ? `${step.roll}x`
                      : step.pitchOffset !== 0
                      ? `${step.pitchOffset > 0 ? '+' : ''}${step.pitchOffset}`
                      : 'AC'}
                  </span>
                )}
              </div>

              {/* Physical Keycap Button */}
              <button
                type="button"
                onClick={(e) => {
                  if (e.shiftKey || inspectedStepIndex !== null) {
                    onInspectStep(sIdx);
                    if (!e.shiftKey) {
                      onToggleStep(selectedChannel.id, sIdx);
                    }
                  } else {
                    onToggleStep(selectedChannel.id, sIdx);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onInspectStep(sIdx);
                }}
                aria-pressed={isActive}
                aria-label={`${selectedChannel.name} step ${sIdx + 1}${isActive ? ' active' : ''}`}
                className={`step-keycap w-full h-12 rounded-[3px] border flex flex-col items-center justify-between py-1.5 px-1 cursor-pointer relative ${getKeycapStyle(
                  i,
                  isActive
                )} ${isInspected ? 'ring-2 ring-[#FAF5EA] ring-offset-1 ring-offset-[#191613]' : ''}`}
              >
                {/* Recessed Hardware LED Jewel */}
                <span
                  aria-hidden="true"
                  className={`w-3 h-1.5 rounded-[1px] border border-black/60 transition-colors ${
                    isPlayhead
                      ? 'bg-[#FFF5D6] shadow-[0_0_8px_#FFD66B]'
                      : isActive
                      ? 'bg-[#FF3B1F] shadow-[0_0_6px_#FF4B2B]'
                      : 'bg-[#2A1B16]'
                  }`}
                />

                {/* Velocity Bar Indicator inside Keycap */}
                <div className="w-4/5 h-1 bg-black/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-black/65"
                    style={{ width: isActive ? `${Math.round((step?.velocity ?? 0.8) * 100)}%` : '0%' }}
                  />
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
};
