import React, { useRef, useState } from 'react';
import { Check, Download, Plus, Trash2, Upload, X } from 'lucide-react';
import type { KitPreset } from '../types/drum';
import { isValidPreset, triggerFileDownload } from '../audio/presetStorage';

interface PresetManagerModalProps {
  open: boolean;
  onClose: () => void;
  factoryPresets: KitPreset[];
  userPresets: KitPreset[];
  activePresetId: string;
  queuedPresetId: string | null;
  swapMode: 'instant' | 'next-bar';
  onChangeSwapMode: (mode: 'instant' | 'next-bar') => void;
  onSelectPreset: (preset: KitPreset) => void;
  onSaveUserPreset: (name: string, genre: string) => void;
  onDeleteUserPreset: (id: string) => void;
  onImportPresets: (presets: KitPreset[]) => void;
}

export const PresetManagerModal: React.FC<PresetManagerModalProps> = ({
  open,
  onClose,
  factoryPresets,
  userPresets,
  activePresetId,
  queuedPresetId,
  swapMode,
  onChangeSwapMode,
  onSelectPreset,
  onSaveUserPreset,
  onDeleteUserPreset,
  onImportPresets,
}) => {
  const [newName, setNewName] = useState('');
  const [newGenre, setNewGenre] = useState('Live Set');
  const [feedback, setFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!open) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) {
      setFeedback('Enter a preset name before saving.');
      return;
    }
    onSaveUserPreset(trimmed, newGenre.trim() || 'Custom');
    setNewName('');
    setFeedback(`Saved "${trimmed}" to User Bank.`);
  };

  const handleExportBank = () => {
    const payload = JSON.stringify(userPresets.length > 0 ? userPresets : factoryPresets, null, 2);
    triggerFileDownload(payload, 'volt808-preset-bank.json', 'application/json');
    setFeedback('Exported preset bank JSON.');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      const valid = list.filter(isValidPreset).map((p) => ({
        ...p,
        category: 'User' as const,
        id: p.id.startsWith('user-') ? p.id : `user-import-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      }));
      if (valid.length === 0) {
        setFeedback('No valid VOLT 808 presets found in that JSON file.');
      } else {
        onImportPresets(valid);
        setFeedback(`Imported ${valid.length} preset${valid.length > 1 ? 's' : ''}.`);
      }
    } catch {
      setFeedback('Could not read preset JSON file.');
    }
    e.target.value = '';
  };

  const renderPresetRow = (preset: KitPreset, deletable: boolean) => {
    const isActive = preset.id === activePresetId;
    const isQueued = preset.id === queuedPresetId;

    return (
      <div
        key={preset.id}
        className={`flex items-center justify-between gap-3 p-2.5 rounded-[3px] border ${
          isActive
            ? 'bg-[#2C251D] border-[#E27A27]'
            : isQueued
            ? 'bg-[#262119] border-[#E0B034]'
            : 'bg-[#181512] border-[#2E2822] hover:border-[#473E34]'
        }`}
      >
        <button
          type="button"
          onClick={() => onSelectPreset(preset)}
          className="flex-1 text-left min-w-0 cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[#F4ECDC] truncate">
              {preset.name}
            </span>
            <span className="font-mono text-[11px] text-[#B7AC9A] shrink-0">
              {preset.bpm} BPM · {preset.genre}
            </span>
          </div>
          <p className="text-xs text-[#958A79] truncate mt-0.5">
            {preset.description}
          </p>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          {isActive && (
            <span className="font-mono text-[11px] font-semibold text-[#F5C562] flex items-center gap-1 px-2">
              <Check className="w-3.5 h-3.5" />
              Loaded
            </span>
          )}
          {isQueued && (
            <span className="font-mono text-[11px] font-semibold text-[#E27A27] px-2">
              Queued
            </span>
          )}
          {!isActive && (
            <button
              type="button"
              onClick={() => onSelectPreset(preset)}
              className="hw-btn px-3 py-1 rounded-[2px] text-xs font-semibold bg-[#2B251F] text-[#E8DFCE] border border-[#443C33] hover:bg-[#3A3229] cursor-pointer"
            >
              {swapMode === 'next-bar' ? 'Queue' : 'Load'}
            </button>
          )}
          {deletable && (
            <button
              type="button"
              onClick={() => onDeleteUserPreset(preset.id)}
              aria-label={`Delete preset ${preset.name}`}
              className="p-1.5 rounded-[2px] text-[#A69B89] hover:text-[#FF6D4D] hover:bg-[#2B201C] cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="preset-modal-title"
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
    >
      <div className="anodized-panel w-full max-w-3xl max-h-[88vh] rounded-[4px] border border-[#4A4137] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#342E27]">
          <div>
            <h2
              id="preset-modal-title"
              className="text-lg font-bold tracking-wider text-[#F4ECDC]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              PRESET MANAGER &amp; LIVE SET BANK
            </h2>
            <p className="text-xs text-[#9D9281]">
              Swap full synthesized drum kits, patterns, LFOs, and FX mid-performance.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preset manager"
            className="p-1.5 rounded-[2px] text-[#B7AC9A] hover:text-[#FAF5EA] hover:bg-[#2A251F] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Swap Mode + Bank Actions */}
        <div className="px-5 py-2.5 bg-[#161411] border-b border-[#2D2721] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[#B7AC9A]">Live Swap Timing:</span>
            <div className="flex items-center gap-1 bg-[#110F0D] border border-[#342E27] rounded-[2px] p-0.5">
              <button
                type="button"
                onClick={() => onChangeSwapMode('instant')}
                aria-pressed={swapMode === 'instant'}
                className={`px-2.5 py-1 text-xs rounded-[2px] cursor-pointer ${
                  swapMode === 'instant'
                    ? 'bg-[#E0B034] text-[#141210] font-semibold'
                    : 'text-[#A69B89] hover:text-[#FAF5EA]'
                }`}
              >
                Instant Swap
              </button>
              <button
                type="button"
                onClick={() => onChangeSwapMode('next-bar')}
                aria-pressed={swapMode === 'next-bar'}
                className={`px-2.5 py-1 text-xs rounded-[2px] cursor-pointer ${
                  swapMode === 'next-bar'
                    ? 'bg-[#E0B034] text-[#141210] font-semibold'
                    : 'text-[#A69B89] hover:text-[#FAF5EA]'
                }`}
              >
                Queue Next Bar
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="hw-btn flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] text-xs bg-[#24201C] text-[#D8CEBC] border border-[#3D362E] hover:bg-[#302B25] cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import JSON</span>
            </button>
            <button
              type="button"
              onClick={handleExportBank}
              className="hw-btn flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] text-xs bg-[#24201C] text-[#D8CEBC] border border-[#3D362E] hover:bg-[#302B25] cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Bank</span>
            </button>
          </div>
        </div>

        {/* Save Current Kit Form */}
        <form
          onSubmit={handleSave}
          className="px-5 py-3 border-b border-[#2D2721] bg-[#1B1815] flex flex-wrap items-end gap-2.5"
        >
          <label className="flex-1 min-w-[180px] flex flex-col gap-1 text-xs text-[#B7AC9A]">
            <span>Save Current Kit &amp; Pattern As</span>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Warehouse Spinz Set"
              className="bg-[#12100E] text-sm text-[#FAF5EA] border border-[#3A332B] rounded-[2px] px-3 py-1.5 focus:outline-none focus:border-[#E27A27]"
            />
          </label>
          <label className="w-36 flex flex-col gap-1 text-xs text-[#B7AC9A]">
            <span>Style / Tag</span>
            <input
              type="text"
              value={newGenre}
              onChange={(e) => setNewGenre(e.target.value)}
              placeholder="Live Set"
              className="bg-[#12100E] text-sm text-[#FAF5EA] border border-[#3A332B] rounded-[2px] px-2.5 py-1.5 focus:outline-none focus:border-[#E27A27]"
            />
          </label>
          <button
            type="submit"
            className="hw-btn flex items-center gap-1.5 px-4 py-2 rounded-[2px] text-xs font-semibold bg-[#D94626] text-[#FAF5EA] border border-[#EF765B] hover:bg-[#E45232] cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Save Preset</span>
          </button>
        </form>

        {feedback && (
          <div className="px-5 py-2 bg-[#231D15] border-b border-[#3D3122] font-mono text-xs text-[#F5C562]">
            {feedback}
          </div>
        )}

        {/* Preset Lists */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
          <div>
            <h3 className="text-xs font-semibold tracking-wider text-[#B7AC9A] mb-2">
              FACTORY KITS ({factoryPresets.length})
            </h3>
            <div className="flex flex-col gap-2">
              {factoryPresets.map((p) => renderPresetRow(p, false))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold tracking-wider text-[#B7AC9A] mb-2">
              USER PRESETS ({userPresets.length})
            </h3>
            {userPresets.length === 0 ? (
              <div className="recessed-bay rounded-[3px] border border-[#2C261F] p-4 text-xs text-[#958A79]">
                No custom presets saved yet. Dial in a custom kit above and save it for instant recall during live sets.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {userPresets.map((p) => renderPresetRow(p, true))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
