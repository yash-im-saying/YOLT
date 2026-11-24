import React, { useEffect, useRef } from 'react';
import type { DrumAudioEngine } from '../audio/audioEngine';
import type { DrumChannel, PatternBankId } from '../types/drum';

interface AnalogDisplayProps {
  engineRef: React.RefObject<DrumAudioEngine | null>;
  isPlaying: boolean;
  bpm: number;
  swing: number;
  currentStep: number;
  patternLength: 16 | 32;
  activeBank: PatternBankId;
  presetName: string;
  queuedPresetName: string | null;
  selectedChannel: DrumChannel;
}

export const AnalogDisplay: React.FC<AnalogDisplayProps> = ({
  engineRef,
  isPlaying,
  bpm,
  swing,
  currentStep,
  patternLength,
  activeBank,
  presetName,
  queuedPresetName,
  selectedChannel,
}) => {
  const scopeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const meterLRef = useRef<HTMLDivElement | null>(null);
  const meterRRef = useRef<HTMLDivElement | null>(null);
  const peakHoldL = useRef(0);
  const peakHoldR = useRef(0);

  useEffect(() => {
    let rafId = 0;

    const draw = () => {
      const canvas = scopeCanvasRef.current;
      const engine = engineRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          ctx.fillStyle = '#0D0B08';
          ctx.fillRect(0, 0, w, h);

          // CRT graticule grid
          ctx.strokeStyle = 'rgba(224, 176, 52, 0.11)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (let x = w / 8; x < w; x += w / 8) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
          }
          for (let y = h / 4; y < h; y += h / 4) {
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
          }
          ctx.stroke();

          // Center zero-axis
          ctx.strokeStyle = 'rgba(224, 176, 52, 0.24)';
          ctx.beginPath();
          ctx.moveTo(0, h / 2);
          ctx.lineTo(w, h / 2);
          ctx.stroke();

          const data = engine?.getStereoMeterData();
          const wave = data?.waveform;

          if (data) {
            peakHoldL.current = Math.max(data.leftPeak, peakHoldL.current * 0.88);
            peakHoldR.current = Math.max(data.rightPeak, peakHoldR.current * 0.88);
          } else {
            peakHoldL.current *= 0.85;
            peakHoldR.current *= 0.85;
          }

          if (meterLRef.current) {
            meterLRef.current.style.width = `${Math.min(100, Math.round(peakHoldL.current * 100))}%`;
          }
          if (meterRRef.current) {
            meterRRef.current.style.width = `${Math.min(100, Math.round(peakHoldR.current * 100))}%`;
          }

          // Phosphor amber waveform trace
          ctx.strokeStyle = '#F2A93B';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          if (wave && wave.length > 0) {
            const slice = w / wave.length;
            for (let i = 0; i < wave.length; i++) {
              const v = wave[i];
              const y = h / 2 - v * (h * 0.44);
              const x = i * slice;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
          } else {
            ctx.moveTo(0, h / 2);
            ctx.lineTo(w, h / 2);
          }
          ctx.stroke();
        }
      }
      rafId = window.requestAnimationFrame(draw);
    };

    rafId = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(rafId);
  }, [engineRef]);

  const stepDisplay = currentStep >= 0 ? String(currentStep + 1).padStart(2, '0') : '--';

  return (
    <section
      aria-label="Stereo Output Monitor"
      className="vfd-screen rounded-sm border border-[#3B3328] p-2.5 flex flex-col gap-2"
    >
      {/* Top VFD Readout Strip */}
      <div className="flex items-center justify-between gap-2 border-b border-[#E0B034]/15 pb-1.5">
        <div className="min-w-0">
          <div className="text-[10px] font-mono tracking-wider text-[#9A8867]">
            ACTIVE KIT / PATTERN {activeBank}
          </div>
          <div className="font-mono text-sm font-semibold text-[#F5C562] truncate">
            {presetName}
            {queuedPresetName && (
              <span className="ml-2 text-[11px] text-[#E27A27]">
                Next Bar: {queuedPresetName}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0 font-mono tabular-nums">
          <div className="text-right">
            <div className="text-[10px] text-[#9A8867]">TEMPO</div>
            <div className="text-sm font-semibold text-[#F5C562]">{bpm} BPM</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-[#9A8867]">STEP</div>
            <div className="text-sm font-semibold text-[#F5C562]">
              {stepDisplay}/{patternLength}
            </div>
          </div>
        </div>
      </div>

      {/* Stereo Oscilloscope Canvas */}
      <div className="relative rounded-[2px] overflow-hidden border border-[#2C251C]">
        <canvas
          ref={scopeCanvasRef}
          width={420}
          height={68}
          data-testid="stereo-oscilloscope"
          className="w-full h-[68px] block"
        />
        <div className="pointer-events-none absolute top-1 left-2 font-mono text-[10px] text-[#D7B26A]/80">
          {selectedChannel.shortName} · {selectedChannel.name}
        </div>
        <div className="pointer-events-none absolute top-1 right-2 font-mono text-[10px] text-[#D7B26A]/80">
          {isPlaying ? 'RUNNING' : 'STOPPED'} · SWING {swing}%
        </div>
      </div>

      {/* Stereo L/R Analog VU Bars + Resolution Spec */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 font-mono text-[10px] text-[#B8A682]">
          <span className="w-3 shrink-0">L</span>
          <div className="flex-1 h-2 bg-[#1A1610] border border-[#342C20] overflow-hidden">
            <div
              ref={meterLRef}
              className="h-full transition-[width] duration-75"
              style={{
                width: '0%',
                background:
                  'linear-gradient(90deg, #5F9E4A 0%, #CFA22C 68%, #D94626 92%)',
              }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] text-[#B8A682]">
          <span className="w-3 shrink-0">R</span>
          <div className="flex-1 h-2 bg-[#1A1610] border border-[#342C20] overflow-hidden">
            <div
              ref={meterRRef}
              className="h-full transition-[width] duration-75"
              style={{
                width: '0%',
                background:
                  'linear-gradient(90deg, #5F9E4A 0%, #CFA22C 68%, #D94626 92%)',
              }}
            />
          </div>
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono text-[#8E7F65] pt-0.5">
          <span>STEREO BUS · 24-BIT / 48 kHz</span>
          <span>-24dB · -12dB · -6dB · 0dB</span>
        </div>
      </div>
    </section>
  );
};
