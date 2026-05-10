// Centralised asset loading and caching.
// Everything else imports getSheet() / getChar() — no raw Image() calls elsewhere.

import { BIOME_SHEETS, CHAR_TYPES, CHAR_COLORS, CHAR_COLORS_BY_TYPE } from './constants.js';

const _sheets = new Map();   // biome  → HTMLImageElement
const _chars  = new Map();   // 'Type_01_Idle' → HTMLImageElement

// ── Internal ──────────────────────────────────────────────────────────
function _loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error('Cannot load: ' + src));
    img.src = src;
  });
}

// ── Public ────────────────────────────────────────────────────────────

/** Load (or return cached) tilesheet for a biome. */
export async function loadSheet(biome) {
  if (_sheets.has(biome)) return _sheets.get(biome);
  const img = await _loadImage(BIOME_SHEETS[biome]);
  _sheets.set(biome, img);
  return img;
}

/** Synchronous sheet access — returns null if not yet loaded. */
export function getSheet(biome) {
  return _sheets.get(biome) ?? null;
}

/** Load (or return cached) character idle sprite. Silently returns null on 404. */
export async function loadChar(type, color) {
  const key = `${type}_${color}_Idle`;
  if (_chars.has(key)) return _chars.get(key);
  try {
    const img = await _loadImage(`Assets/1x/Character sprites/${key}.png`);
    _chars.set(key, img);
    return img;
  } catch {
    _chars.set(key, null);   // mark as attempted so we don't retry
    return null;
  }
}

/** Synchronous character access — returns null if not yet loaded. */
export function getChar(type, color) {
  return _chars.get(`${type}_${color}_Idle`) ?? null;
}

/**
 * Background-load all character sprites.
 * @param {(loaded: number, total: number) => void} [onProgress]
 */
export async function preloadAllChars(onProgress) {
  const pairs = CHAR_TYPES.flatMap(t => (CHAR_COLORS_BY_TYPE[t] ?? CHAR_COLORS).map(c => [t, c]));
  let done = 0;
  await Promise.all(pairs.map(([t, c]) =>
    loadChar(t, c).then(() => { done++; onProgress?.(done, pairs.length); })
  ));
}
