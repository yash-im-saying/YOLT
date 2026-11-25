import React, { useState } from 'react';
import type { DrumChannel, VoiceArchetype } from '../types/drum';
import { ARCHETYPE_LIST } from '../audio/presets';

interface ChannelStripPanelProps {
  channels: DrumChannel[];
  selectedChannelId: string;
  activeHitIds: string[];
  onSelectChannel: (id: string) => void;
  onAuditionChannel: (channel: DrumChannel) => void;
  onChangeArchetype: (channelId: string, archetype: VoiceArchetype) => void;
  onDropSamplesOnChannel: (channelId: string, files: FileList | File[]) => void;
  onToggleMute: (channelId: string) => void;
  onToggleSolo: (channelId: string) => void;
  onChangeLevel: (channelId: string, level: number) => void;
}

const MAINSTREAM_ARCHETYPES = ARCHETYPE_LIST.filter((a) => a.category === 'Mainstream');
const TR808_ARCHETYPES = ARCHETYPE_LIST.filter((a) => a.category === 'TR-808 Kit');

export const ChannelStripPanel: React.FC<ChannelStripPanelProps> = ({
  channels,
  selectedChannelId,
  activeHitIds,
  onSelectChannel,
  onAuditionChannel,
  onChangeArchetype,
  onDropSamplesOnChannel,
  onToggleMute,
  onToggleSolo,
  onChangeLevel,
}) => {
  const hitSet = new Set(activeHitIds);
  const [dragOverChannelId, setDragOverChannelId] = useState<string | null>(null);

  return (
    <section
      aria-label="Drum Voices and Mixer"
      className="recessed-bay rounded-sm border border-[#352F27] p-2.5 flex flex-col gap-1.5"
    >
      <div className="flex items-center justify-between px-1 pb-1 border-b border-[#2D2721]">
        <h2
          className="text-xs font-semibold tracking-wider text-[#C7BCAA]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          8-CHANNEL ANALOG MIXER &amp; VOICE RACK
        </h2>
        <span className="font-mono text-[10px] text-[#8F8473]">DROP AUDIO · PAD · MIX</span>
      </div>

      <div className="flex flex-col gap-1">
        {channels.map((ch, idx) => {
          const isSelected = ch.id === selectedChannelId;
          const isHit = hitSet.has(ch.id);
          const isDropTarget = dragOverChannelId === ch.id;

          return (
            <div
              key={ch.id}
              data-channel-dropzone={ch.id}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (dragOverChannelId !== ch.id) {
                  setDragOverChannelId(ch.id);
                }
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                const related = e.relatedTarget as Node | null;
                if (!related || !e.currentTarget.contains(related)) {
                  setDragOverChannelId((prev) => (prev === ch.id ? null : prev));
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragOverChannelId(null);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  onDropSamplesOnChannel(ch.id, e.dataTransfer.files);
                }
              }}
              className={`grid grid-cols-[56px_1fr_auto_64px] items-center gap-1.5 px-1.5 py-0.5 rounded-[3px] border transition-colors ${
                isDropTarget
                  ? 'bg-[#362917] border-[#F0C14B] shadow-[inset_0_0_0_1px_rgba(240,193,75,0.45)]'
                  : isSelected
                  ? 'bg-[#28231D] border-[#E27A27]/70'
                  : 'bg-[#1B1815] border-[#2A2520] hover:border-[#3D362E]'
              }`}
            >
              {/* Tactile Pad Trigger + Channel Select */}
              <button
                type="button"
                onClick={() => {
                  onSelectChannel(ch.id);
                  onAuditionChannel(ch);
                }}
                aria-label={`Select and trigger channel ${idx + 1} ${ch.name}`}
                className={`hw-btn relative flex items-center justify-between px-1.5 py-1 rounded-[2px] text-left cursor-pointer border ${
                  isSelected
                    ? 'bg-[#3A3229] border-[#E0B034]/60 text-[#FAF5EA]'
                    : 'bg-[#24201C] border-[#38312A] text-[#D8CEBC] hover:bg-[#2D2823]'
                }`}
              >
                <span className="font-mono text-[11px] font-semibold tracking-tight truncate">
                  {ch.shortName}
                </span>
                <span
                  aria-hidden="true"
                  className={`w-2 h-2 shrink-0 rounded-full border border-black/60 transition-colors duration-75 ${
                    isHit
                      ? 'bg-[#FF6E3A] shadow-[0_0_6px_#FF6E3A]'
                      : isSelected
                      ? 'bg-[#E0B034]'
                      : 'bg-[#3A332B]'
                  }`}
                />
              </button>

              {/* Voice Archetype Swapper or Drop Indicator */}
              {isDropTarget ? (
                <div className="w-full min-w-0 bg-[#1F180E] text-[#F4C54C] text-xs font-mono font-semibold px-2 py-1 rounded-[2px] border border-[#E0B034]/70 truncate">
                  Drop sample → CH {idx + 1}
                </div>
              ) : (
                <select
                  aria-label={`Voice engine for channel ${idx + 1}`}
                  value={ch.archetype}
                  onChange={(e) => {
                    onSelectChannel(ch.id);
                    onChangeArchetype(ch.id, e.target.value as VoiceArchetype);
                  }}
                  className="w-full min-w-0 bg-[#141210] text-[#E8DFCE] text-xs font-medium px-2 py-1 rounded-[2px] border border-[#332D26] focus:outline-none focus:border-[#E27A27] cursor-pointer truncate"
                >
                  {ch.archetype === 'user-sample' && ch.customSample && (
                    <optgroup label="User Sample">
                      <option value="user-sample">
                        Sample: {ch.customSample.name}
                      </option>
                    </optgroup>
                  )}
                  <optgroup label="Mainstream Synthesized">
                    {MAINSTREAM_ARCHETYPES.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Roland TR-808 Kit">
                    {TR808_ARCHETYPES.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              )}

              {/* Mute & Solo Hardware Buttons */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onToggleMute(ch.id)}
                  aria-pressed={ch.mute}
                  aria-label={`Mute ${ch.name}`}
                  className={`w-6 h-6 rounded-[2px] font-mono text-[10px] font-semibold border cursor-pointer transition-colors ${
                    ch.mute
                      ? 'bg-[#C93F22] text-[#FAF5EA] border-[#E86A4D]'
                      : 'bg-[#221E1A] text-[#9D9281] border-[#38312A] hover:text-[#FAF5EA]'
                  }`}
                >
                  M
                </button>
                <button
                  type="button"
                  onClick={() => onToggleSolo(ch.id)}
                  aria-pressed={ch.solo}
                  aria-label={`Solo ${ch.name}`}
                  className={`w-6 h-6 rounded-[2px] font-mono text-[10px] font-semibold border cursor-pointer transition-colors ${
                    ch.solo
                      ? 'bg-[#E0B034] text-[#141210] border-[#F5CF6B]'
                      : 'bg-[#221E1A] text-[#9D9281] border-[#38312A] hover:text-[#FAF5EA]'
                  }`}
                >
                  S
                </button>
              </div>

              {/* Channel Output Level Fader */}
              <div className="flex items-center gap-1.5">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={ch.params.level}
                  aria-label={`${ch.name} output level`}
                  onChange={(e) => onChangeLevel(ch.id, Number(e.target.value))}
                  className="w-full accent-[#E0B034] cursor-pointer"
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
