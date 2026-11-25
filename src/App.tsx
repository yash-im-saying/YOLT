/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  DrumChannel,
  KitPreset,
  LfoConfig,
  MasterFxParams,
  PatternBankId,
  StepData,
  VoiceArchetype,
  VoiceParams,
} from './types/drum';
import {
  ARCHETYPES,
  clonePreset,
  createChannelFromArchetype,
  FACTORY_PRESETS,
} from './audio/presets';
import {
  clonePattern,
  createDefaultStep,
  generateEuclideanPattern,
  shiftChannelSteps,
} from './audio/sequencerMath';
import { DrumAudioEngine, type EngineStateSnapshot } from './audio/audioEngine';
import { loadUserPresets, saveUserPresets } from './audio/presetStorage';
import {
  decodeAndStoreSampleFile,
  isLikelyAudioFile,
  makeShortSampleTag,
} from './audio/sampleStore';
import { TransportBar } from './components/TransportBar';
import { AnalogDisplay } from './components/AnalogDisplay';
import { ChannelStripPanel } from './components/ChannelStripPanel';
import { VoiceSynthEditor } from './components/VoiceSynthEditor';
import { MasterFxRack, ModulationRack } from './components/ModulationAndFxRack';
import { PatternOverviewMatrix, StepSequencer } from './components/StepSequencer';
import { PresetManagerModal } from './components/PresetManagerModal';
import { ExportModal } from './components/ExportModal';

type RackTab = 'voice' | 'modulation' | 'master';

export default function App() {
  const initialPreset = useMemo(() => clonePreset(FACTORY_PRESETS[0]), []);

  const [userPresets, setUserPresets] = useState<KitPreset[]>(() => loadUserPresets());
  const [activePresetId, setActivePresetId] = useState<string>(initialPreset.id);
  const [presetName, setPresetName] = useState<string>(initialPreset.name);
  const [bpm, setBpm] = useState<number>(initialPreset.bpm);
  const [swing, setSwing] = useState<number>(initialPreset.swing);
  const [channels, setChannels] = useState<DrumChannel[]>(initialPreset.channels);
  const [patterns, setPatterns] = useState(initialPreset.patterns);
  const [activeBank, setActiveBank] = useState<PatternBankId>('A');
  const [lfos, setLfos] = useState<[LfoConfig, LfoConfig]>(initialPreset.lfos);
  const [masterFx, setMasterFx] = useState<MasterFxParams>(initialPreset.masterFx);

  const [selectedChannelId, setSelectedChannelId] = useState<string>('ch1');
  const [rackTab, setRackTab] = useState<RackTab>('voice');
  const [sequencerPage, setSequencerPage] = useState<0 | 1>(0);
  const [inspectedStepIndex, setInspectedStepIndex] = useState<number | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [activeHitIds, setActiveHitIds] = useState<string[]>([]);
  const [fillActive, setFillActive] = useState<boolean>(false);

  const [presetModalOpen, setPresetModalOpen] = useState<boolean>(false);
  const [exportModalOpen, setExportModalOpen] = useState<boolean>(false);
  const [swapMode, setSwapMode] = useState<'instant' | 'next-bar'>('instant');
  const [queuedPreset, setQueuedPreset] = useState<KitPreset | null>(null);
  const [sampleError, setSampleError] = useState<string | null>(null);

  const tapTimesRef = useRef<number[]>([]);
  const hitClearTimerRef = useRef<number | null>(null);
  const queuedPresetRef = useRef<KitPreset | null>(null);
  const engineRef = useRef<DrumAudioEngine | null>(null);

  const allPresets = useMemo(
    () => [...FACTORY_PRESETS, ...userPresets],
    [userPresets]
  );

  const activePattern = patterns[activeBank];
  const selectedChannel = useMemo(
    () => channels.find((c) => c.id === selectedChannelId) ?? channels[0],
    [channels, selectedChannelId]
  );

  // Keep fresh state snapshot in ref so Web Audio lookahead scheduler never reads stale closures
  const snapshotRef = useRef<EngineStateSnapshot>({
    bpm,
    swing,
    channels,
    pattern: activePattern,
    selectedChannelId,
    lfos,
    masterFx,
    fillActive,
  });

  snapshotRef.current = {
    bpm,
    swing,
    channels,
    pattern: activePattern,
    selectedChannelId,
    lfos,
    masterFx,
    fillActive,
  };

  queuedPresetRef.current = queuedPreset;

  const applyPresetImmediately = useCallback((preset: KitPreset) => {
    const copy = clonePreset(preset);
    setActivePresetId(copy.id);
    setPresetName(copy.name);
    setBpm(copy.bpm);
    setSwing(copy.swing);
    setChannels(copy.channels);
    setPatterns(copy.patterns);
    setActiveBank('A');
    setSequencerPage(0);
    setLfos(copy.lfos);
    setMasterFx(copy.masterFx);
    setQueuedPreset(null);
  }, []);

  // Initialize Web Audio Engine once
  useEffect(() => {
    const engine = new DrumAudioEngine(
      () => snapshotRef.current,
      (step, triggeredIds) => {
        setCurrentStep(step);
        if (triggeredIds.length > 0) {
          setActiveHitIds(triggeredIds);
          if (hitClearTimerRef.current) window.clearTimeout(hitClearTimerRef.current);
          hitClearTimerRef.current = window.setTimeout(() => setActiveHitIds([]), 90);
        }
      },
      () => {
        const queued = queuedPresetRef.current;
        if (queued) {
          applyPresetImmediately(queued);
        }
      }
    );
    engineRef.current = engine;
    return () => {
      if (hitClearTimerRef.current) window.clearTimeout(hitClearTimerRef.current);
      engine.dispose();
      engineRef.current = null;
    };
  }, [applyPresetImmediately]);

  // Sync Master FX & BPM changes in real-time
  useEffect(() => {
    engineRef.current?.syncMasterFx(masterFx, bpm);
  }, [masterFx, bpm]);

  const handleTogglePlay = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (isPlaying) {
      engine.stop();
      setIsPlaying(false);
      setCurrentStep(-1);
      setActiveHitIds([]);
    } else {
      engine.start();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const handleAuditionChannel = useCallback((ch: DrumChannel) => {
    engineRef.current?.auditionChannel(ch, 0.92);
    setActiveHitIds([ch.id]);
    if (hitClearTimerRef.current) window.clearTimeout(hitClearTimerRef.current);
    hitClearTimerRef.current = window.setTimeout(() => setActiveHitIds([]), 100);
  }, []);

  const handleSelectPreset = useCallback(
    (preset: KitPreset) => {
      if (swapMode === 'next-bar' && isPlaying) {
        setQueuedPreset(preset);
      } else {
        applyPresetImmediately(preset);
      }
    },
    [swapMode, isPlaying, applyPresetImmediately]
  );

  const handleStepPreset = useCallback(
    (delta: -1 | 1) => {
      const idx = allPresets.findIndex((p) => p.id === activePresetId);
      const nextIdx =
        idx < 0
          ? 0
          : (idx + delta + allPresets.length) % allPresets.length;
      handleSelectPreset(allPresets[nextIdx]);
    },
    [allPresets, activePresetId, handleSelectPreset]
  );

  // Keyboard shortcuts for live performance (Space = Play/Stop, 1-8 = Audition/Select pads)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (presetModalOpen || exportModalOpen) {
        if (e.key === 'Escape') {
          setPresetModalOpen(false);
          setExportModalOpen(false);
        }
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.key >= '1' && e.key <= '8') {
        const ch = channels[Number(e.key) - 1];
        if (ch) {
          setSelectedChannelId(ch.id);
          handleAuditionChannel(ch);
        }
      } else if (e.key === '[') {
        handleStepPreset(-1);
      } else if (e.key === ']') {
        handleStepPreset(1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    channels,
    handleAuditionChannel,
    handleStepPreset,
    handleTogglePlay,
    presetModalOpen,
    exportModalOpen,
  ]);

  const handleTapTempo = () => {
    const now = performance.now();
    const taps = tapTimesRef.current.filter((t) => now - t < 2000);
    taps.push(now);
    tapTimesRef.current = taps;
    if (taps.length >= 2) {
      let sum = 0;
      for (let i = 1; i < taps.length; i++) {
        sum += taps[i] - taps[i - 1];
      }
      const avgMs = sum / (taps.length - 1);
      const computed = Math.round(60000 / avgMs);
      setBpm(Math.min(240, Math.max(40, computed)));
    }
  };

  const handleChangeArchetype = (channelId: string, archetype: VoiceArchetype) => {
    if (archetype === 'user-sample') return;
    const nextChannel = createChannelFromArchetype(channelId, archetype);
    setChannels((prev) =>
      prev.map((c) =>
        c.id === channelId
          ? { ...nextChannel, mute: c.mute, solo: c.solo, customSample: undefined }
          : c
      )
    );
    setSampleError(null);
    engineRef.current?.auditionChannel(nextChannel, 0.88);
  };

  const handleLoadSampleFiles = useCallback(
    async (targetChannelId: string, fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (files.length === 0) return;

      const startIdx = channels.findIndex((c) => c.id === targetChannelId);
      if (startIdx < 0) return;

      const errors: string[] = [];
      const updates = new Map<
        string,
        {
          meta: Awaited<ReturnType<typeof decodeAndStoreSampleFile>>;
          shortName: string;
        }
      >();

      for (let i = 0; i < files.length; i++) {
        const slotIdx = startIdx + i;
        if (slotIdx >= channels.length) break;
        const file = files[i];
        if (!isLikelyAudioFile(file)) {
          errors.push(`"${file.name}" is not a supported audio format (use WAV, AIFF, FLAC, MP3, or OGG).`);
          continue;
        }
        try {
          const meta = await decodeAndStoreSampleFile(file);
          updates.set(channels[slotIdx].id, {
            meta,
            shortName: makeShortSampleTag(meta.name),
          });
        } catch (err) {
          errors.push(
            err instanceof Error ? err.message : `Could not decode "${file.name}".`
          );
        }
      }

      if (updates.size > 0) {
        const sampleDefaults = ARCHETYPES['user-sample'].defaultParams;
        let firstLoadedChannel: DrumChannel | null = null;

        setChannels((prev) =>
          prev.map((c) => {
            const loaded = updates.get(c.id);
            if (!loaded) return c;
            const nextCh: DrumChannel = {
              ...c,
              archetype: 'user-sample',
              name: loaded.meta.name,
              shortName: loaded.shortName,
              customSample: loaded.meta,
              params: {
                ...sampleDefaults,
                level: c.params.level,
              },
            };
            if (!firstLoadedChannel && c.id === targetChannelId) {
              firstLoadedChannel = nextCh;
            }
            return nextCh;
          })
        );

        setSelectedChannelId(targetChannelId);
        setRackTab('voice');
        setSampleError(errors.length > 0 ? errors[0] : null);

        // Audition the newly loaded target sample immediately
        const targetUpdate = updates.get(targetChannelId);
        if (targetUpdate) {
          const existing = channels[startIdx];
          const auditionCh: DrumChannel = {
            ...existing,
            archetype: 'user-sample',
            name: targetUpdate.meta.name,
            shortName: targetUpdate.shortName,
            customSample: targetUpdate.meta,
            params: {
              ...sampleDefaults,
              level: existing.params.level,
            },
          };
          engineRef.current?.auditionChannel(auditionCh, 0.9);
          setActiveHitIds([targetChannelId]);
          if (hitClearTimerRef.current) window.clearTimeout(hitClearTimerRef.current);
          hitClearTimerRef.current = window.setTimeout(() => setActiveHitIds([]), 120);
        }
      } else if (errors.length > 0) {
        setSampleError(errors[0]);
      }
    },
    [channels]
  );

  const handleUpdateVoiceParam = <K extends keyof VoiceParams>(
    key: K,
    value: VoiceParams[K]
  ) => {
    setChannels((prev) =>
      prev.map((c) =>
        c.id === selectedChannel.id
          ? { ...c, params: { ...c.params, [key]: value } }
          : c
      )
    );
  };

  const handleResetVoice = () => {
    const meta = ARCHETYPES[selectedChannel.archetype];
    setChannels((prev) =>
      prev.map((c) =>
        c.id === selectedChannel.id
          ? { ...c, params: { ...meta.defaultParams } }
          : c
      )
    );
  };

  const handleToggleMute = (channelId: string) => {
    setChannels((prev) =>
      prev.map((c) => (c.id === channelId ? { ...c, mute: !c.mute } : c))
    );
  };

  const handleToggleSolo = (channelId: string) => {
    setChannels((prev) =>
      prev.map((c) => (c.id === channelId ? { ...c, solo: !c.solo } : c))
    );
  };

  const handleChangeLevel = (channelId: string, level: number) => {
    setChannels((prev) =>
      prev.map((c) =>
        c.id === channelId ? { ...c, params: { ...c.params, level } } : c
      )
    );
  };

  const handleUpdateLfo = (index: 0 | 1, patch: Partial<LfoConfig>) => {
    setLfos((prev) => {
      const next: [LfoConfig, LfoConfig] = [{ ...prev[0] }, { ...prev[1] }];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const handleUpdateMasterFx = <K extends keyof MasterFxParams>(
    key: K,
    value: MasterFxParams[K]
  ) => {
    setMasterFx((prev) => ({ ...prev, [key]: value }));
  };

  const handleToggleStep = (channelId: string, stepIndex: number) => {
    setPatterns((prev) => {
      const bank = clonePattern(prev[activeBank]);
      const arr = bank.steps[channelId] ?? Array.from({ length: 32 }, () => createDefaultStep());
      arr[stepIndex] = { ...arr[stepIndex], active: !arr[stepIndex].active };
      bank.steps[channelId] = arr;
      return { ...prev, [activeBank]: bank };
    });
  };

  const handleUpdateStep = (
    channelId: string,
    stepIndex: number,
    patch: Partial<StepData>
  ) => {
    setPatterns((prev) => {
      const bank = clonePattern(prev[activeBank]);
      const arr = bank.steps[channelId] ?? Array.from({ length: 32 }, () => createDefaultStep());
      arr[stepIndex] = { ...arr[stepIndex], ...patch };
      bank.steps[channelId] = arr;
      return { ...prev, [activeBank]: bank };
    });
  };

  const handleTogglePatternLength = () => {
    setPatterns((prev) => {
      const bank = clonePattern(prev[activeBank]);
      const nextLen: 16 | 32 = bank.length === 16 ? 32 : 16;
      if (nextLen === 32) {
        // Mirror bar 1 into bar 2 if bar 2 is empty for instant musical extension
        for (const chId of Object.keys(bank.steps)) {
          const steps = bank.steps[chId];
          const bar2HasHits = steps.slice(16, 32).some((s) => s.active);
          if (!bar2HasHits) {
            for (let i = 0; i < 16; i++) {
              steps[16 + i] = { ...steps[i] };
            }
          }
        }
      } else {
        setSequencerPage(0);
      }
      bank.length = nextLen;
      return { ...prev, [activeBank]: bank };
    });
  };

  const handleShiftChannel = (direction: -1 | 1) => {
    setPatterns((prev) => {
      const bank = clonePattern(prev[activeBank]);
      const arr = bank.steps[selectedChannel.id];
      if (arr) {
        bank.steps[selectedChannel.id] = shiftChannelSteps(arr, bank.length, direction);
      }
      return { ...prev, [activeBank]: bank };
    });
  };

  const handleApplyEuclidean = (pulses: number) => {
    setPatterns((prev) => {
      const bank = clonePattern(prev[activeBank]);
      const existingCount = (bank.steps[selectedChannel.id] ?? [])
        .slice(0, bank.length)
        .filter((s) => s.active).length;
      const nextPulses =
        existingCount === pulses ? (pulses === 5 ? 7 : 5) : pulses;
      const mask = generateEuclideanPattern(bank.length, nextPulses);
      const arr = Array.from({ length: 32 }, (_, i) =>
        createDefaultStep(i < bank.length ? mask[i] : false, i % 4 === 0 ? 0.95 : 0.78, i === 0)
      );
      bank.steps[selectedChannel.id] = arr;
      return { ...prev, [activeBank]: bank };
    });
  };

  const handleClearChannel = () => {
    setPatterns((prev) => {
      const bank = clonePattern(prev[activeBank]);
      bank.steps[selectedChannel.id] = Array.from({ length: 32 }, () => createDefaultStep(false));
      return { ...prev, [activeBank]: bank };
    });
  };

  const handleSaveUserPreset = (name: string, genre: string) => {
    const newPreset: KitPreset = {
      id: `user-${Date.now()}`,
      name,
      category: 'User',
      genre,
      description: `Custom 8-voice kit at ${bpm} BPM (${channels
        .slice(0, 4)
        .map((c) => c.shortName)
        .join(', ')}…)`,
      bpm,
      swing,
      channels: JSON.parse(JSON.stringify(channels)),
      patterns: JSON.parse(JSON.stringify(patterns)),
      lfos: JSON.parse(JSON.stringify(lfos)),
      masterFx: { ...masterFx },
      createdAt: Date.now(),
    };
    const updated = [newPreset, ...userPresets];
    setUserPresets(updated);
    saveUserPresets(updated);
    setActivePresetId(newPreset.id);
    setPresetName(newPreset.name);
  };

  const handleDeleteUserPreset = (id: string) => {
    const updated = userPresets.filter((p) => p.id !== id);
    setUserPresets(updated);
    saveUserPresets(updated);
  };

  const handleImportPresets = (imported: KitPreset[]) => {
    const updated = [...imported, ...userPresets];
    setUserPresets(updated);
    saveUserPresets(updated);
  };

  return (
    <div
      data-playing={isPlaying ? 'true' : 'false'}
      data-step={currentStep}
      className="min-h-screen bg-[#110F0D] text-[#E8DFCE] flex justify-center p-0 sm:p-2 lg:p-3"
    >
      {/* Hardware Drum Machine Chassis with Walnut Wood Side Cheeks */}
      <div className="w-full max-w-[1440px] flex rounded-[5px] overflow-hidden shadow-[0_18px_50px_rgba(0,0,0,0.85)] border border-[#3B3228]">
        {/* Left Walnut Wood Cheek */}
        <div className="hidden xl:block w-5 shrink-0 walnut-cheek" aria-hidden="true" />

        {/* Main Anodized Metal Faceplate */}
        <div className="flex-1 min-w-0 flex flex-col bg-[#1A1714]">
          {/* Top Transport & Console Bar */}
          <TransportBar
            isPlaying={isPlaying}
            onTogglePlay={handleTogglePlay}
            bpm={bpm}
            onChangeBpm={setBpm}
            onTapTempo={handleTapTempo}
            swing={swing}
            onChangeSwing={setSwing}
            activeBank={activeBank}
            onSelectBank={setActiveBank}
            patternLength={activePattern.length}
            onToggleLength={handleTogglePatternLength}
            fillActive={fillActive}
            onSetFillActive={setFillActive}
            presetName={presetName}
            onPrevPreset={() => handleStepPreset(-1)}
            onNextPreset={() => handleStepPreset(1)}
            onOpenPresets={() => setPresetModalOpen(true)}
            onOpenExport={() => setExportModalOpen(true)}
          />

          {/* Main Instrument Body: Mixer/Scope (Left) + Synth/Modulation/Master Rack & Matrix (Right) */}
          <main className="flex-1 p-3 grid grid-cols-1 lg:grid-cols-[424px_1fr] gap-3 items-stretch">
            {/* Left Column: VFD Oscilloscope + 8-Channel Mixer & Voice Selector */}
            <div className="flex flex-col gap-2.5">
              <AnalogDisplay
                engineRef={engineRef}
                isPlaying={isPlaying}
                bpm={bpm}
                swing={swing}
                currentStep={currentStep}
                patternLength={activePattern.length}
                activeBank={activeBank}
                presetName={presetName}
                queuedPresetName={queuedPreset?.name ?? null}
                selectedChannel={selectedChannel}
              />

              <ChannelStripPanel
                channels={channels}
                selectedChannelId={selectedChannel.id}
                activeHitIds={activeHitIds}
                onSelectChannel={(id) => {
                  setSelectedChannelId(id);
                }}
                onAuditionChannel={handleAuditionChannel}
                onChangeArchetype={handleChangeArchetype}
                onDropSamplesOnChannel={(chId, files) => {
                  void handleLoadSampleFiles(chId, files);
                }}
                onToggleMute={handleToggleMute}
                onToggleSolo={handleToggleSolo}
                onChangeLevel={handleChangeLevel}
              />
            </div>

            {/* Right Column: Tabbed Analog Synthesis/Modulation/FX Rack + 8-Track Pattern Overview Matrix */}
            <div className="flex flex-col gap-2.5 min-w-0">
              <section
                aria-label="Sound Design and Modulation Rack"
                className="anodized-panel rounded-[3px] border border-[#363028] flex flex-col overflow-hidden"
              >
                {/* Rack Mode Selector Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-[#161411] border-b border-[#322C24]">
                  <div className="flex items-center gap-1" role="tablist" aria-label="Synthesizer rack sections">
                    {(
                      [
                        { id: 'voice', label: 'Voice Synthesis' },
                        { id: 'modulation', label: 'Modulation (2 LFOs)' },
                        { id: 'master', label: 'Master Bus & FX' },
                      ] as { id: RackTab; label: string }[]
                    ).map((tab) => {
                      const active = rackTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => setRackTab(tab.id)}
                          className={`px-3 py-1 rounded-[2px] text-xs font-semibold tracking-wide transition-colors cursor-pointer whitespace-nowrap ${
                            active
                              ? 'bg-[#E0B034] text-[#141210]'
                              : 'bg-[#221E1A] text-[#B7AC9A] hover:text-[#FAF5EA] hover:bg-[#2C2722]'
                          }`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="hidden sm:flex items-center gap-3 font-mono text-[11px] text-[#8E8372]">
                    <span>KEYS 1–8: TRIGGER PADS</span>
                    <span aria-hidden="true">·</span>
                    <span>SPACE: PLAY/STOP</span>
                  </div>
                </div>

                {/* Active Rack Panel */}
                <div className="p-3">
                  {rackTab === 'voice' && (
                    <VoiceSynthEditor
                      channel={selectedChannel}
                      sampleError={sampleError}
                      onDismissSampleError={() => setSampleError(null)}
                      onUpdateParam={handleUpdateVoiceParam}
                      onChangeArchetype={(arch) =>
                        handleChangeArchetype(selectedChannel.id, arch)
                      }
                      onLoadSampleFiles={(files) => {
                        void handleLoadSampleFiles(selectedChannel.id, files);
                      }}
                      onResetVoice={handleResetVoice}
                      onAudition={() => handleAuditionChannel(selectedChannel)}
                    />
                  )}

                  {rackTab === 'modulation' && (
                    <ModulationRack
                      lfos={lfos}
                      channels={channels}
                      onUpdateLfo={handleUpdateLfo}
                    />
                  )}

                  {rackTab === 'master' && (
                    <MasterFxRack
                      masterFx={masterFx}
                      onUpdateMasterFx={handleUpdateMasterFx}
                    />
                  )}
                </div>
              </section>

              <PatternOverviewMatrix
                channels={channels}
                selectedChannelId={selectedChannel.id}
                pattern={activePattern}
                currentStep={currentStep}
                page={sequencerPage}
                onSelectChannel={setSelectedChannelId}
                onToggleStep={handleToggleStep}
              />
            </div>
          </main>

          {/* Bottom Full-Width Classic TR-808 Tactile 16-Step Sequencer */}
          <StepSequencer
            selectedChannel={selectedChannel}
            pattern={activePattern}
            currentStep={currentStep}
            page={sequencerPage}
            onChangePage={setSequencerPage}
            inspectedStepIndex={inspectedStepIndex}
            onInspectStep={setInspectedStepIndex}
            onToggleStep={handleToggleStep}
            onUpdateStep={handleUpdateStep}
            onShiftChannel={handleShiftChannel}
            onApplyEuclidean={handleApplyEuclidean}
            onClearChannel={handleClearChannel}
          />
        </div>

        {/* Right Walnut Wood Cheek */}
        <div className="hidden xl:block w-5 shrink-0 walnut-cheek" aria-hidden="true" />
      </div>

      {/* Live Preset Manager Modal */}
      <PresetManagerModal
        open={presetModalOpen}
        onClose={() => setPresetModalOpen(false)}
        factoryPresets={FACTORY_PRESETS}
        userPresets={userPresets}
        activePresetId={activePresetId}
        queuedPresetId={queuedPreset?.id ?? null}
        swapMode={swapMode}
        onChangeSwapMode={setSwapMode}
        onSelectPreset={handleSelectPreset}
        onSaveUserPreset={handleSaveUserPreset}
        onDeleteUserPreset={handleDeleteUserPreset}
        onImportPresets={handleImportPresets}
      />

      {/* 24-Bit Stereo Audio & MIDI Export Modal */}
      <ExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        presetName={presetName}
        getSnapshot={() => snapshotRef.current}
      />
    </div>
  );
}
