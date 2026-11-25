import React, { useRef, useState } from 'react';
import { RotateCcw, Upload, Volume2, X } from 'lucide-react';
import type { DrumChannel, FilterMode, VoiceArchetype, VoiceParams } from '../types/drum';
import { ARCHETYPES } from '../audio/presets';
import { RotaryKnob } from './RotaryKnob';

interface VoiceSynthEditorProps {
  channel: DrumChannel;
  sampleError: string | null;
  onDismissSampleError: () => void;
  onUpdateParam: <K extends keyof VoiceParams>(key: K, value: VoiceParams[K]) => void;
  onChangeArchetype: (archetype: VoiceArchetype) => void;
  onLoadSampleFiles: (files: FileList | File[]) => void;
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

function formatDurationMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
}

function buildAdsrSvgGeometry(
  attackMs: number,
  decayMs: number,
  sustainPct: number,
  releaseMs: number,
  w: number,
  h: number,
  sampleDurationSec?: number
) {
  const padX = 5;
  const padTop = 15;
  const padBottom = 6;
  const innerW = w - padX * 2;
  const innerH = h - padTop - padBottom;
  const baseY = padTop + innerH;
  const sNorm = Math.max(0, Math.min(100, sustainPct)) / 100;

  let aW: number;
  let dW: number;
  let holdW: number;
  let rW: number;

  if (sampleDurationSec && sampleDurationSec > 0) {
    // Map ADSR directly onto the sample's horizontal time axis so the curve overlays the waveform accurately
    const dur = Math.max(0.02, sampleDurationSec);
    const aSec = Math.min(Math.max(0.0012, attackMs / 1000), dur * 0.35);
    const rSec = Math.min(Math.max(0.008, releaseMs / 1000), Math.max(0.004, dur - aSec));
    const dSec = Math.min(Math.max(0.015, decayMs / 1000), Math.max(0.004, dur - aSec - rSec));
    const hSec = sNorm > 0.01 ? Math.max(0, dur - aSec - dSec - rSec) : 0;

    aW = Math.max(2, (aSec / dur) * innerW);
    dW = Math.max(4, (dSec / dur) * innerW);
    holdW = (hSec / dur) * innerW;
    rW = Math.max(4, (rSec / dur) * innerW);
  } else {
    // Perceptually compressed time axes for synth voices so fast transients & long 808 tails are both legible
    const aNorm = Math.sqrt(Math.max(0, attackMs) / 250);
    const dNorm = Math.sqrt(Math.max(15, decayMs) / 2200);
    const rNorm = Math.sqrt(Math.max(8, releaseMs) / 2000);

    aW = Math.max(4, aNorm * innerW * 0.24);
    dW = Math.max(14, dNorm * innerW * 0.36);
    holdW = sNorm > 0.01 ? innerW * (0.1 + sNorm * 0.14) : 0;
    rW = Math.max(10, rNorm * innerW * 0.26);
  }

  const rawTotal = aW + dW + holdW + rW;
  const scale = rawTotal > innerW ? innerW / rawTotal : 1;

  const x0 = padX;
  const xA = x0 + aW * scale;
  const xD = xA + dW * scale;
  const xH = xD + holdW * scale;
  const xR = Math.min(padX + innerW, xH + rW * scale);

  const yPeak = padTop;
  const ySus = baseY - sNorm * innerH;

  // Curved decay & release segments for authentic analog RC envelope shape
  const dCtrlX = xA + (xD - xA) * 0.32;
  const dCtrlY = ySus + (yPeak - ySus) * 0.18;
  const rCtrlX = xH + (xR - xH) * 0.34;
  const rCtrlY = baseY - (baseY - ySus) * 0.16;

  const strokePath = [
    `M ${x0.toFixed(1)} ${baseY.toFixed(1)}`,
    `L ${xA.toFixed(1)} ${yPeak.toFixed(1)}`,
    `Q ${dCtrlX.toFixed(1)} ${dCtrlY.toFixed(1)} ${xD.toFixed(1)} ${ySus.toFixed(1)}`,
    holdW > 0 ? `L ${xH.toFixed(1)} ${ySus.toFixed(1)}` : '',
    `Q ${rCtrlX.toFixed(1)} ${rCtrlY.toFixed(1)} ${xR.toFixed(1)} ${baseY.toFixed(1)}`,
  ]
    .filter(Boolean)
    .join(' ');

  const fillPath = `${strokePath} L ${xR.toFixed(1)} ${baseY.toFixed(1)} L ${x0.toFixed(1)} ${baseY.toFixed(1)} Z`;

  return {
    strokePath,
    fillPath,
    points: [
      { x: xA, y: yPeak },
      { x: xD, y: ySus },
      ...(holdW > 0 ? [{ x: xH, y: ySus }] : []),
      { x: xR, y: baseY },
    ],
  };
}

export const VoiceSynthEditor: React.FC<VoiceSynthEditorProps> = ({
  channel,
  sampleError,
  onDismissSampleError,
  onUpdateParam,
  onChangeArchetype,
  onLoadSampleFiles,
  onResetVoice,
  onAudition,
}) => {
  const { params } = channel;
  const meta = ARCHETYPES[channel.archetype];
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const formatHz = (v: number) =>
    v >= 1000 ? `${(v / 1000).toFixed(1)}kHz` : `${Math.round(v)}Hz`;

  const formatPan = (v: number) => {
    if (Math.abs(v) < 0.03) return 'C';
    return v < 0 ? `L${Math.round(Math.abs(v) * 100)}` : `R${Math.round(v * 100)}`;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const related = e.relatedTarget as Node | null;
    if (!related || !e.currentTarget.contains(related)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onLoadSampleFiles(e.dataTransfer.files);
    }
  };

  const customSample = channel.archetype === 'user-sample' ? channel.customSample : undefined;

  const adsrSvg = buildAdsrSvgGeometry(
    params.attack,
    params.decay,
    params.sustain,
    params.release,
    184,
    72,
    customSample?.durationSec
  );

  return (
    <div
      className={`flex flex-col gap-2.5 rounded-[3px] transition-colors ${
        isDragOver ? 'ring-2 ring-[#E0B034] bg-[#261E14]/40' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-testid="voice-synth-dropzone"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.wav,.aif,.aiff,.flac,.mp3,.ogg,.m4a,.aac"
        className="sr-only"
        aria-label={`Load audio sample into ${channel.name}`}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onLoadSampleFiles(e.target.files);
            e.target.value = '';
          }
        }}
      />

      {/* Selected Voice Header & Action Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-[#322C25]">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-[#E27A27]">
              {channel.shortName}
            </span>
            <h3 className="text-sm font-semibold text-[#F4ECDC] truncate">
              {channel.name}
            </h3>
            <span className="text-xs text-[#8D8272] hidden sm:inline whitespace-nowrap">
              · {customSample
                ? `User Sample · ${customSample.durationSec.toFixed(2)}s · ${(customSample.sampleRate / 1000).toFixed(1)}kHz`
                : meta.category}
            </span>
          </div>
          <p className="text-[11px] text-[#9D9281] mt-0.5 truncate">
            {isDragOver
              ? `Release to load audio sample onto ${channel.shortName} (${channel.name})`
              : meta.description}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="hw-btn flex items-center gap-1.5 px-2.5 py-1.5 rounded-[3px] text-xs font-semibold bg-[#2A2218] text-[#F2CA66] border border-[#6E5423] hover:bg-[#382D1F] cursor-pointer whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5 text-[#E0B034]" />
            <span>Load Sample</span>
          </button>
          <button
            type="button"
            onClick={onAudition}
            className="hw-btn flex items-center gap-1.5 px-2.5 py-1.5 rounded-[3px] text-xs font-semibold bg-[#2D2721] text-[#F4ECDC] border border-[#494037] hover:bg-[#383129] cursor-pointer whitespace-nowrap"
          >
            <Volume2 className="w-3.5 h-3.5 text-[#E0B034]" />
            <span>Audition</span>
          </button>
          <button
            type="button"
            onClick={onResetVoice}
            aria-label={`Reset ${channel.name} parameters to factory defaults`}
            className="hw-btn flex items-center gap-1 px-2 py-1.5 rounded-[3px] text-xs font-medium bg-[#221E1A] text-[#C5BAA8] border border-[#3B342C] hover:text-[#FAF5EA] cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Inline Validation Error Notice for Invalid Sample Drops */}
      {sampleError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-[3px] bg-[#361A14] border border-[#B24229] text-xs text-[#F8D0C4]"
        >
          <span className="truncate">{sampleError}</span>
          <button
            type="button"
            onClick={onDismissSampleError}
            aria-label="Dismiss sample error"
            className="text-[#F8D0C4] hover:text-white cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Quick Sound Swap Strip (Mainstream & TR-808 Signature Voices) */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-medium text-[#968B7A] mr-0.5">
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
              className={`px-2 py-0.5 rounded-[2px] text-[11px] font-medium border transition-colors cursor-pointer whitespace-nowrap ${
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

      {/* Row 1: ADSR Envelope + Waveform Scope (Left) & Oscillator/Timbre (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.32fr_1fr] gap-2">
        {/* Bay 1: Per-Drum ADSR Envelope & Sample Waveform Dropzone */}
        <div className="recessed-bay rounded-[3px] border border-[#322C24] p-2 flex flex-col gap-2">
          <div className="flex items-center justify-between border-b border-[#2B251F] pb-1">
            <span
              className="text-[11px] font-semibold tracking-wider text-[#C7BCAA]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              ADSR ENVELOPE &amp; SAMPLE
            </span>
            <span className="font-mono text-[10px] text-[#9A8E7D] whitespace-nowrap">
              {customSample ? 'DROP TO REPLACE' : 'DROP WAV/AIFF/FLAC/MP3'}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            {/* Retro Amber VFD ADSR Contour & Custom Sample Waveform Window */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Click or drag & drop an audio file from your device"
              className={`relative shrink-0 w-[184px] h-[72px] rounded-[2px] border overflow-hidden cursor-pointer text-left transition-colors ${
                isDragOver
                  ? 'border-[#F0C14B] bg-[#1C160C]'
                  : 'border-[#3B3328] bg-[#0E0C09] hover:border-[#6A5739]'
              }`}
            >
              <svg
                viewBox="0 0 184 72"
                className="w-full h-full block"
                aria-label="ADSR envelope and sample waveform preview"
              >
                <defs>
                  <linearGradient id="adsrFillGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E0B034" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#E27A27" stopOpacity="0.03" />
                  </linearGradient>
                </defs>
                {/* Subtle graticule lines */}
                <line x1="0" y1="36" x2="184" y2="36" stroke="#241E16" strokeWidth="1" />
                <line x1="46" y1="0" x2="46" y2="72" stroke="#1E1913" strokeWidth="1" />
                <line x1="92" y1="0" x2="92" y2="72" stroke="#1E1913" strokeWidth="1" />
                <line x1="138" y1="0" x2="138" y2="72" stroke="#1E1913" strokeWidth="1" />

                {/* Decoded Custom Sample Waveform Bars */}
                {customSample &&
                  customSample.peaks.map((pk, idx) => {
                    const x = 4 + (idx / customSample.peaks.length) * 176;
                    const barH = Math.max(2, pk * 56);
                    return (
                      <line
                        key={idx}
                        x1={x}
                        y1={36 - barH / 2}
                        x2={x}
                        y2={36 + barH / 2}
                        stroke="#8B5A23"
                        strokeOpacity="0.65"
                        strokeWidth="1.3"
                      />
                    );
                  })}

                {/* Live ADSR Envelope Fill & Phosphor Stroke */}
                <path d={adsrSvg.fillPath} fill="url(#adsrFillGrad)" />
                <path
                  d={adsrSvg.strokePath}
                  fill="none"
                  stroke="#F4C54C"
                  strokeWidth="1.75"
                  strokeLinejoin="round"
                />
                {adsrSvg.points.map((pt, i) => (
                  <circle
                    key={i}
                    cx={pt.x}
                    cy={pt.y}
                    r="2.1"
                    fill="#FF8B3D"
                    stroke="#0E0C09"
                    strokeWidth="0.7"
                  />
                ))}
              </svg>
              <span className="pointer-events-none absolute top-1 left-1.5 font-mono text-[9px] text-[#C8A458]/90 tracking-wider">
                {customSample ? customSample.name.slice(0, 18) : 'A·D·S·R'}
              </span>
              <span className="pointer-events-none absolute bottom-0.5 right-1.5 font-mono text-[9px] text-[#8E7D63]">
                {customSample ? `${customSample.durationSec.toFixed(2)}s` : 'DROP SMP'}
              </span>
            </button>

            {/* 4 Tactile ADSR Rotary Knobs */}
            <div className="flex-1 w-full grid grid-cols-4 gap-1 justify-items-center">
              <RotaryKnob
                size="sm"
                label="Attack"
                value={params.attack}
                min={0}
                max={250}
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
                min={15}
                max={2200}
                step={5}
                defaultValue={meta.defaultParams.decay}
                logarithmic
                accent="orange"
                formatValue={formatDurationMs}
                onChange={(v) => onUpdateParam('decay', v)}
              />
              <RotaryKnob
                size="sm"
                label="Sustain"
                value={params.sustain}
                min={0}
                max={100}
                step={1}
                defaultValue={meta.defaultParams.sustain}
                accent="amber"
                formatValue={(v) => `${Math.round(v)}%`}
                onChange={(v) => onUpdateParam('sustain', v)}
              />
              <RotaryKnob
                size="sm"
                label="Release"
                value={params.release}
                min={8}
                max={2000}
                step={2}
                defaultValue={meta.defaultParams.release}
                logarithmic
                accent="red"
                formatValue={formatDurationMs}
                onChange={(v) => onUpdateParam('release', v)}
              />
            </div>
          </div>
        </div>

        {/* Bay 2: Oscillator, Pitch & Timbre */}
        <div className="recessed-bay rounded-[3px] border border-[#322C24] p-2 flex flex-col gap-2">
          <div className="flex items-center justify-between border-b border-[#2B251F] pb-1">
            <span
              className="text-[11px] font-semibold tracking-wider text-[#C7BCAA]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              OSCILLATOR &amp; TIMBRE
            </span>
            <span className="font-mono text-[10px] text-[#8F8473]">PITCH · BODY</span>
          </div>
          <div className="grid grid-cols-5 gap-1 justify-items-center">
            <RotaryKnob
              size="sm"
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
              size="sm"
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
              size="sm"
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
      </div>

      {/* Row 2: Analog VCF & Drive (Left) & Stereo Routing & Sends (Right) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {/* Bay 3: Analog Filter & Drive */}
        <div className="recessed-bay rounded-[3px] border border-[#322C24] p-2 flex flex-col gap-2">
          <div className="flex items-center justify-between border-b border-[#2B251F] pb-1">
            <span
              className="text-[11px] font-semibold tracking-wider text-[#C7BCAA]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              VCF &amp; ANALOG DRIVE
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
              size="sm"
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
              size="sm"
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
              size="sm"
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

        {/* Bay 4: Stereo Routing & Sends */}
        <div className="recessed-bay rounded-[3px] border border-[#322C24] p-2 flex flex-col gap-2">
          <div className="flex items-center justify-between border-b border-[#2B251F] pb-1">
            <span
              className="text-[11px] font-semibold tracking-wider text-[#C7BCAA]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              STEREO &amp; FX SENDS
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
              size="sm"
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
              size="sm"
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
              size="sm"
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
