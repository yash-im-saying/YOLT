import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, Loader2, X } from 'lucide-react';
import type { ExportFormat, ExportOptions } from '../types/drum';
import type { EngineStateSnapshot } from '../audio/audioEngine';
import { renderPatternOfflineStereo } from '../audio/audioEngine';
import {
  encodeAiffStereo,
  encodeFlacStereo,
  encodePatternToMidi,
  encodeWavStereo,
} from '../audio/encoders';
import { estimateExportBytes } from '../audio/sequencerMath';
import { triggerFileDownload } from '../audio/presetStorage';

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  presetName: string;
  getSnapshot: () => EngineStateSnapshot;
}

const FORMAT_INFO: Record<
  ExportFormat,
  { label: string; ext: string; mime: string; desc: string }
> = {
  wav: {
    label: 'WAV',
    ext: 'wav',
    mime: 'audio/wav',
    desc: 'Uncompressed RIFF/WAVE Stereo PCM. Studio standard for DAWs & samplers.',
  },
  aiff: {
    label: 'AIFF',
    ext: 'aiff',
    mime: 'audio/aiff',
    desc: 'Uncompressed Big-Endian Stereo PCM. Native macOS / Logic Pro mastering format.',
  },
  flac: {
    label: 'FLAC',
    ext: 'flac',
    mime: 'audio/flac',
    desc: 'Free Lossless Audio Codec (RFC 9639). Bit-exact stereo archival & stems.',
  },
  midi: {
    label: 'MIDI',
    ext: 'mid',
    mime: 'audio/midi',
    desc: 'Standard MIDI File (.mid) with BPM, swing timing, velocity & roll subdivisions.',
  },
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function slugifyPresetName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'volt808-loop';
}

export const ExportModal: React.FC<ExportModalProps> = ({
  open,
  onClose,
  presetName,
  getSnapshot,
}) => {
  const [options, setOptions] = useState<ExportOptions>({
    format: 'wav',
    bitDepth: 24,
    sampleRate: 48000,
    bars: 2,
    includeTail: true,
    fileName: slugifyPresetName(presetName),
  });
  const [rendering, setRendering] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setOptions((prev) => ({
        ...prev,
        fileName: slugifyPresetName(presetName),
      }));
      setStatusMsg(null);
      setErrorMsg(null);
    }
  }, [open, presetName]);

  const snapshot = open ? getSnapshot() : null;

  const estimatedBytes = useMemo(() => {
    if (!snapshot) return 0;
    return estimateExportBytes({
      format: options.format,
      bitDepth: options.bitDepth,
      sampleRate: options.sampleRate,
      bpm: snapshot.bpm,
      bars: options.bars,
      includeTail: options.includeTail,
    });
  }, [snapshot, options]);

  if (!open || !snapshot) return null;

  const isAudio = options.format !== 'midi';
  const fmt = FORMAT_INFO[options.format];

  const handleExport = async () => {
    setRendering(true);
    setErrorMsg(null);
    setStatusMsg(null);

    try {
      const safeBase =
        options.fileName.trim().replace(/[^a-zA-Z0-9_-]+/g, '-') || 'volt808-beat';
      const outName = `${safeBase}.${fmt.ext}`;

      if (options.format === 'midi') {
        const midiBytes = encodePatternToMidi({
          name: presetName,
          bpm: snapshot.bpm,
          swing: snapshot.swing,
          bars: options.bars,
          channels: snapshot.channels,
          pattern: snapshot.pattern,
        });
        triggerFileDownload(midiBytes, outName, fmt.mime);
        setStatusMsg(`Exported ${outName} (${formatFileSize(midiBytes.length)}) — GM Drum Map Ch. 10.`);
      } else {
        const rendered = await renderPatternOfflineStereo({
          snapshot,
          bars: options.bars,
          sampleRate: options.sampleRate,
          includeTail: options.includeTail,
        });

        let encoded: Uint8Array;
        if (options.format === 'wav') {
          encoded = encodeWavStereo(
            rendered.left,
            rendered.right,
            options.sampleRate,
            options.bitDepth
          );
        } else if (options.format === 'aiff') {
          encoded = encodeAiffStereo(
            rendered.left,
            rendered.right,
            options.sampleRate,
            options.bitDepth
          );
        } else {
          encoded = encodeFlacStereo(
            rendered.left,
            rendered.right,
            options.sampleRate,
            options.bitDepth
          );
        }

        triggerFileDownload(encoded, outName, fmt.mime);
        setStatusMsg(
          `Bounced ${outName} (${formatFileSize(encoded.length)}) — ${options.bitDepth}-bit / ${(
            options.sampleRate / 1000
          ).toFixed(1)} kHz Stereo.`
        );
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Export failed during offline bounce.'
      );
    } finally {
      setRendering(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
    >
      <div className="anodized-panel w-full max-w-xl rounded-[4px] border border-[#4A4137] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#342E27]">
          <div>
            <h2
              id="export-modal-title"
              className="text-lg font-bold tracking-wider text-[#F4ECDC]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              MASTER BOUNCE &amp; EXPORT CONSOLE
            </h2>
            <p className="text-xs text-[#9D9281]">
              High-fidelity 24-bit stereo offline rendering &amp; General MIDI sequence export.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close export console"
            className="p-1.5 rounded-[2px] text-[#B7AC9A] hover:text-[#FAF5EA] hover:bg-[#2A251F] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4">
          {/* Format Selector */}
          <div>
            <span className="block text-xs font-medium text-[#B7AC9A] mb-1.5">
              Output Format
            </span>
            <div className="grid grid-cols-4 gap-2" role="group" aria-label="Export format">
              {(['wav', 'aiff', 'flac', 'midi'] as ExportFormat[]).map((f) => {
                const active = options.format === f;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => {
                      setOptions((prev) => ({ ...prev, format: f }));
                      setStatusMsg(null);
                    }}
                    aria-pressed={active}
                    className={`hw-btn py-2.5 rounded-[3px] font-mono text-xs font-semibold border cursor-pointer ${
                      active
                        ? 'bg-[#E27A27] text-[#141210] border-[#F6AA68]'
                        : 'bg-[#1A1714] text-[#D8CEBC] border-[#352E27] hover:bg-[#26221D]'
                    }`}
                  >
                    {FORMAT_INFO[f].label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-[#9E9281] mt-1.5">{fmt.desc}</p>
          </div>

          {/* Filename & Bars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-[#B7AC9A]">
              <span>File Name</span>
              <input
                type="text"
                value={options.fileName}
                onChange={(e) =>
                  setOptions((prev) => ({ ...prev, fileName: e.target.value }))
                }
                className="bg-[#12100E] text-sm font-mono text-[#FAF5EA] border border-[#3A332B] rounded-[2px] px-3 py-1.5 focus:outline-none focus:border-[#E27A27]"
              />
            </label>

            <div className="flex flex-col gap-1 text-xs text-[#B7AC9A]">
              <span>Loop Length (Bars)</span>
              <div className="grid grid-cols-4 gap-1">
                {([1, 2, 4, 8] as const).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setOptions((prev) => ({ ...prev, bars: b }))}
                    aria-pressed={options.bars === b}
                    className={`py-1.5 rounded-[2px] font-mono text-xs border cursor-pointer ${
                      options.bars === b
                        ? 'bg-[#E0B034] text-[#141210] border-[#F4D06E] font-semibold'
                        : 'bg-[#191613] text-[#C9BEA9] border-[#342E27] hover:bg-[#26211C]'
                    }`}
                  >
                    {b}B
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Audio Resolution Controls */}
          {isAudio && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 recessed-bay rounded-[3px] border border-[#322C24] p-3">
              <div className="flex flex-col gap-1 text-xs text-[#B7AC9A]">
                <span>Bit Depth</span>
                <div className="grid grid-cols-2 gap-1">
                  {([24, 16] as const).map((bd) => (
                    <button
                      key={bd}
                      type="button"
                      onClick={() => setOptions((prev) => ({ ...prev, bitDepth: bd }))}
                      aria-pressed={options.bitDepth === bd}
                      className={`py-1 rounded-[2px] font-mono text-xs border cursor-pointer ${
                        options.bitDepth === bd
                          ? 'bg-[#E0B034] text-[#141210] border-[#F4D06E] font-semibold'
                          : 'bg-[#191613] text-[#C9BEA9] border-[#342E27]'
                      }`}
                    >
                      {bd}-Bit
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1 text-xs text-[#B7AC9A]">
                <span>Sample Rate</span>
                <div className="grid grid-cols-2 gap-1">
                  {([48000, 44100] as const).map((sr) => (
                    <button
                      key={sr}
                      type="button"
                      onClick={() => setOptions((prev) => ({ ...prev, sampleRate: sr }))}
                      aria-pressed={options.sampleRate === sr}
                      className={`py-1 rounded-[2px] font-mono text-xs border cursor-pointer ${
                        options.sampleRate === sr
                          ? 'bg-[#E0B034] text-[#141210] border-[#F4D06E] font-semibold'
                          : 'bg-[#191613] text-[#C9BEA9] border-[#342E27]'
                      }`}
                    >
                      {sr === 48000 ? '48k' : '44.1k'}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-[#D8CEBC] self-end pb-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.includeTail}
                  onChange={(e) =>
                    setOptions((prev) => ({ ...prev, includeTail: e.target.checked }))
                  }
                  className="accent-[#E27A27] w-4 h-4 cursor-pointer"
                />
                <span>Include FX Tail</span>
              </label>
            </div>
          )}

          {/* Spec Readout Bar */}
          <div className="vfd-screen rounded-[3px] border border-[#3B3328] px-3 py-2 flex items-center justify-between font-mono text-xs text-[#F5C562]">
            <span>
              {isAudio
                ? `STEREO · ${options.bitDepth}-BIT · ${(options.sampleRate / 1000).toFixed(1)} kHz · ${options.format.toUpperCase()}`
                : `SMF FORMAT 0 · CH 10 DRUMS · ${snapshot.bpm} BPM`}
            </span>
            <span className="tabular-nums text-[#D7B26A]">
              Est. {formatFileSize(estimatedBytes)}
            </span>
          </div>

          {statusMsg && (
            <div className="flex items-center gap-2 rounded-[3px] bg-[#1C2618] border border-[#4E7A3C] px-3 py-2 text-xs text-[#BFE5AD]">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{statusMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="rounded-[3px] bg-[#2D1714] border border-[#B03D27] px-3 py-2 text-xs text-[#F5B0A2]">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#161411] border-t border-[#2E2822] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="hw-btn px-4 py-2 rounded-[3px] text-xs font-medium bg-[#24201C] text-[#D8CEBC] border border-[#3D362E] hover:bg-[#302B25] cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            disabled={rendering}
            onClick={handleExport}
            className="hw-btn flex items-center gap-2 px-5 py-2 rounded-[3px] text-xs font-semibold bg-[#D94626] text-[#FAF5EA] border border-[#EF765B] hover:bg-[#E45232] disabled:opacity-60 cursor-pointer"
          >
            {rendering ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Rendering…</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Render &amp; Download .{fmt.ext}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
