import type { KitPreset } from '../types/drum';

const STORAGE_KEY = 'volt808_user_presets_v1';

export function loadUserPresets(): KitPreset[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidPreset);
  } catch {
    return [];
  }
}

export function saveUserPresets(presets: KitPreset[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // Ignore storage quota issues cleanly
  }
}

export function isValidPreset(item: unknown): item is KitPreset {
  if (!item || typeof item !== 'object') return false;
  const p = item as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    typeof p.bpm === 'number' &&
    Array.isArray(p.channels) &&
    p.channels.length === 8 &&
    typeof p.patterns === 'object' &&
    p.patterns !== null
  );
}

export function triggerFileDownload(data: Uint8Array | string, fileName: string, mimeType: string): void {
  const part: BlobPart =
    typeof data === 'string'
      ? data
      : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  const blob = new Blob([part], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
