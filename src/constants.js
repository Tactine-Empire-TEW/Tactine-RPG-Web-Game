// All shared configuration — change once, applies everywhere.

export const TILE_SRC    = 16;
export const TILE_DST    = 48;
export const CHAR_SRC    = 16;
export const CHAR_FRAMES = 4;

export const MAP_W = 40;
export const MAP_H = 30;

// Grass tile — works for both Grassland (green) and Snow (white) sheets.
export const GRASS_TILE = { tx: 13, ty: 6 };

// Only two biomes — desert removed (tilesheet ground tile was identical to grass).
export const BIOME_SHEETS = {
  normal: 'Assets/1x/Tactical%20RPG%20Overworld%20Pack%20-%20Tilesheet.png',
  snow:   'Assets/1x/Tactical%20RPG%20Overworld%20Pack%20-%20Snow%20Tilesheet.png',
};

export const BIOME_LABELS = {
  normal: 'Grassland',
  snow:   'Snow',
};

// Object panel sections.
// Each section may carry an optional:
//   filter(tx,ty) → bool  — only include tiles where filter returns true
//   cardBg         → CSS colour for the card background in the strip
export const TILE_SECTIONS = [
  { label: 'Water',
    rowStart:  8, rowCount:  5, colCount: 42,
    cardBg: '#0e1a26' },

  // Rows 33-40 split into wall tiles vs nature tiles
  { label: 'Walls Lvl 2',
    rowStart: 33, rowCount:  8, colCount: 30,
    cardBg: '#28241c', showInEdit: false,
    filter: (tx, ty) => isObjectWallTile(tx, ty) },

  { label: 'Walls Lvl 1',
    rowStart: 33, rowCount:  8, colCount: 30,
    cardBg: '#241c18',
    filter: (tx, ty) => isWallLvl1Tile(tx, ty) },

  // Wall Lvl 10: everything remaining in nature rows (catch-all)
  { label: 'Walls Lvl 10',
    rowStart: 33, rowCount:  8, colCount: 30,
    cardBg: '#121010', showInEdit: false,
    filter: (tx, ty) => isWallLvl10Tile(tx, ty) },

  // Rows 41-48: Wall Lvl 3 (Stone Wall A-F, Wooden Fence A-D) + remaining structures
  { label: 'Walls Lvl 3',
    rowStart: 41, rowCount:  8, colCount: 30,
    cardBg: '#221e18', showInEdit: false,
    filter: (tx, ty) => isWallLvl3Tile(tx, ty) },

  // Wall Lvl 4: structure rows A-F (ty=41-46, tx=6-11) — stays at Lvl 4
  { label: 'Walls Lvl 4',
    rowStart: 41, rowCount:  8, colCount: 30,
    cardBg: '#201e14', showInEdit: false,
    filter: (tx, ty) => isWallLvl4Tile(tx, ty) },

  // Wall Lvl 5: nature rows A-F (ty=33-38, tx=6-11) — reclassified from old Lvl 4
  { label: 'Walls Lvl 5',
    rowStart: 33, rowCount:  8, colCount: 30,
    cardBg: '#1e1c14', showInEdit: false,
    filter: (tx, ty) => isWallLvl5Tile(tx, ty) },

  // Wall Lvl 6: Garden Hedge/Flagstone rows A-D (ty=41-44, tx=24-29) + Wooden Fence G-H (ty=47-48)
  { label: 'Walls Lvl 6',
    rowStart: 41, rowCount:  8, colCount: 30,
    cardBg: '#1c1a12', showInEdit: false,
    filter: (tx, ty) => isWallLvl6Tile(tx, ty) },

  // Wall Lvl 7: GateArch/Cobblestone rows A-D (structure only) + E/F sparse
  { label: 'Walls Lvl 7',
    rowStart: 41, rowCount:  8, colCount: 30,
    cardBg: '#1a1810', showInEdit: false,
    filter: (tx, ty) => isWallLvl7Tile(tx, ty) },

  // Wall Lvl 8: Birch/WillowGrove rows A-D (nature only) + E/F sparse — reclassified from Lvl 6
  { label: 'Walls Lvl 8',
    rowStart: 33, rowCount:  8, colCount: 30,
    cardBg: '#181610', showInEdit: false,
    filter: (tx, ty) => isWallLvl8Tile(tx, ty) },

  // Wall Lvl 9: Cobblestone Path cols 4-5 + Garden Hedge cols 1-4 (rows A-D) + Stone Wall G1/G3/H1-H5
  { label: 'Walls Lvl 9',
    rowStart: 41, rowCount:  8, colCount: 30,
    cardBg: '#161412', showInEdit: false,
    filter: (tx, ty) => isWallLvl9Tile(tx, ty) },

  { label: 'Structures',
    rowStart: 41, rowCount:  8, colCount: 30,
    cardBg: '#1a1a14',
    filter: (tx, ty) => !isWallLvl3Tile(tx, ty) && !isWallLvl4Tile(tx, ty) && !isWallLvl5Tile(tx, ty) && !isWallLvl6Tile(tx, ty) && !isWallLvl7Tile(tx, ty) && !isWallLvl9Tile(tx, ty) },

  // Rows 50-62 split by building level
  { label: 'Buildings Lvl 1',
    rowStart: 50, rowCount: 13, colCount: 23,
    cardBg: '#1e1610',
    filter: (tx, ty) => isBuildingLvl1(tx, ty) },

  { label: 'Buildings Lvl 2',  rowStart: 50, rowCount: 13, colCount: 23,
    cardBg: '#1c1208', showInEdit: false, filter: (tx, ty) => isBuildingLvl2(tx, ty) },
  { label: 'Buildings Lvl 3',  rowStart: 50, rowCount: 13, colCount: 23,
    cardBg: '#20140c', showInEdit: false, filter: (tx, ty) => isBuildingLvl3(tx, ty) },
  { label: 'Buildings Lvl 4',  rowStart: 50, rowCount: 13, colCount: 23,
    cardBg: '#241810', showInEdit: false, filter: (tx, ty) => isBuildingLvl4(tx, ty) },
  { label: 'Buildings Lvl 5',  rowStart: 50, rowCount: 13, colCount: 23,
    cardBg: '#26180a', showInEdit: false, filter: (tx, ty) => isBuildingLvl5(tx, ty) },
  { label: 'Buildings Lvl 6',  rowStart: 50, rowCount: 13, colCount: 23,
    cardBg: '#28180c', showInEdit: false, filter: (tx, ty) => isBuildingLvl6(tx, ty) },
  { label: 'Buildings Lvl 7',  rowStart: 50, rowCount: 13, colCount: 23,
    cardBg: '#2c1c08', showInEdit: false, filter: (tx, ty) => isBuildingLvl7(tx, ty) },
  { label: 'Buildings Lvl 8',  rowStart: 50, rowCount: 13, colCount: 23,
    cardBg: '#301e06', showInEdit: false, filter: (tx, ty) => isBuildingLvl8(tx, ty) },
  { label: 'Buildings Lvl 9',  rowStart: 50, rowCount: 13, colCount: 23,
    cardBg: '#1a1008', showInEdit: false, filter: (tx, ty) => isBuildingLvl9(tx, ty) },
  { label: 'Buildings Lvl 10', rowStart: 50, rowCount: 13, colCount: 23,
    cardBg: '#341e04', showInEdit: false, filter: (tx, ty) => isBuildingLvl10(tx, ty) },
];

// Units that live exclusively on water object tiles.
export const WATER_UNITS = new Set([
  'Battleship', 'Frigate', 'FishingBoat', 'TransportShip',
]);

// Dragons — can be placed/wander on any terrain (they fly over everything).
// Only blocked by other units occupying the same cell.
export const FLYING_UNITS = new Set(['Beast', 'BeastRider']);

// A tilesheet row range counts as "water" if obj.ty falls in these bands.
export function isWaterTileCoord(ty) {
  return (ty >= 8 && ty <= 12) || (ty >= 28 && ty <= 32);
}

/**
 * Returns true for tiles in rows 33-40 that are visually wall/battlement tiles.
 * Determined by pixel-colour analysis:
 *   Rows A-F (ty 33-38), tx 0-4: gray/white wall blocks and connectors.
 *   Rows A-D (ty 33-36), tx=5:   arch/gate connector tiles (same gray tone).
 *   Rows G-H (ty 39-40): EXCLUDED — they are pink/magenta gem decorations, NOT walls.
 */
export function isObjectWallTile(tx, ty) {
  if (ty < 33 || ty > 40) return false;
  if (ty >= 39)  return false;           // rows G, H handled separately
  if (tx <= 4)   return true;            // rows A-F, tx=0-4: Wall Lvl 2 blocks
  if (tx === 5 && ty <= 36) return true; // rows A-D, tx=5: Wall Lvl 2 gate connectors
  return false;
}

/**
 * Returns true for tiles in rows 33-40 that are visually Wall Lvl 1 / Structure Lvl 1.
 * Pixel analysis: brownish-rose tones (rgb ~134,87,87 and ~164,125,114).
 *   tx=24-29 in rows A-D (ty 33-36): right side of objects section.
 *   tx=5-9  in rows G-H (ty 39-40): these replace the incorrectly-named Pine Tree tiles.
 */
export function isWallLvl1Tile(tx, ty) {
  if (tx >= 24 && tx <= 29 && ty >= 33 && ty <= 36) return true;
  // Row G: only tx=5 (G-1) and tx=7 (G-3) have content; tx=9 (G-5) is unused/empty
  if (ty === 39 && (tx === 5 || tx === 7)) return true;
  if (ty === 40 && tx >= 5 && tx <= 9) return true;
  return false;
}

/**
 * Rows 41-48: Stone Wall (tx=0-4) in rows A-F and Wooden Fence (tx=5) in rows A-D
 * are Wall Lvl 3 tiles. Rows G-H and tx>=6 remain as generic Structures.
 */
export function isWallLvl3Tile(tx, ty) {
  if (ty < 41 || ty > 48) return false;
  if (tx <= 4 && ty <= 46) return true;    // Stone Wall, rows A-F
  if (tx === 5 && ty <= 44) return true;   // Wooden Fence, rows A-D only
  return false;
}

/**
 * Wall Lvl 10 — catch-all for every remaining tile in nature rows 33-40
 * that is not already claimed by Wall Lvl 1, 2, 5, or 8.
 */
export function isWallLvl10Tile(tx, ty) {
  if (ty < 33 || ty > 40) return false;
  if (isObjectWallTile(tx, ty)) return false;
  if (isWallLvl1Tile(tx, ty))   return false;
  if (isWallLvl5Tile(tx, ty))   return false;
  if (isWallLvl8Tile(tx, ty))   return false;
  if (isHiddenTile(tx, ty))     return false;
  return true;
}

/**
 * Wall Lvl 9 tiles — structure section.
 * Rows A-D (ty=41-44): Cobblestone Path cols 4-5 (tx=18-19) + Garden Hedge cols 1-4 (tx=20-23).
 * Row G (ty=47): Stone Wall G1 and G3 (tx=0, tx=2).
 * Row H (ty=48): Stone Wall H1-H5 (tx=0-4).
 */
export function isWallLvl9Tile(tx, ty) {
  if (ty >= 41 && ty <= 44 && tx >= 18 && tx <= 23) return true;
  if (ty === 47 && (tx === 0 || tx === 2)) return true;
  if (ty === 48 && tx >= 0 && tx <= 4) return true;
  return false;
}

/**
 * Wall Lvl 4 tiles — structure section (ty=41-46), tx=6-11.
 * Mirrors the nature-section Lvl 5 positions but in structure rows.
 */
export function isWallLvl4Tile(tx, ty) {
  if (ty >= 41 && ty <= 44 && tx >= 6 && tx <= 11) return true;
  if (ty === 45 && (tx === 5 || tx === 7)) return true;
  if (ty === 46 && tx >= 5 && tx <= 9) return true;
  return false;
}

/**
 * Wall Lvl 5 tiles — nature section (ty=33-38), tx=6-11.
 * These were previously misclassified as Lvl 4.
 */
export function isWallLvl5Tile(tx, ty) {
  if (ty >= 33 && ty <= 36 && tx >= 6 && tx <= 11) return true;
  if (ty === 37 && (tx === 5 || tx === 7)) return true;
  if (ty === 38 && tx >= 5 && tx <= 9) return true;
  return false;
}

/**
 * Wall Lvl 6 tiles — identified by user.
 * Structure rows A-D (ty=41-44): Garden Hedge col-5 (tx=24) + Flagstone cols 1-5 (tx=25-29).
 * Structure rows G-H (ty=47-48): Wooden Fence (tx=5,7 in G; tx=5-9 in H).
 */
export function isWallLvl6Tile(tx, ty) {
  if (ty >= 41 && ty <= 44 && tx >= 24 && tx <= 29) return true;
  if (ty === 47 && (tx === 5 || tx === 7)) return true;
  if (ty === 48 && tx >= 5 && tx <= 9) return true;
  return false;
}

/** True if (tx, ty) is a Building Lvl 1 tile (identified by user). */
export function isBuildingLvl1(tx, ty) {
  return Object.prototype.hasOwnProperty.call(_BLDG_LVL1, `${tx},${ty}`);
}

/** True if (tx, ty) is a Building Lvl 2 tile (identified by user). */
export function isBuildingLvl2(tx, ty) {
  return Object.prototype.hasOwnProperty.call(_BLDG_LVL2, `${tx},${ty}`);
}

/** True if (tx, ty) is a Building Lvl 3 tile (identified by user). */
export function isBuildingLvl3(tx, ty) {
  return Object.prototype.hasOwnProperty.call(_BLDG_LVL3, `${tx},${ty}`);
}

/** True if (tx, ty) is a Building Lvl 4 tile (identified by user). */
export function isBuildingLvl4(tx, ty) {
  return Object.prototype.hasOwnProperty.call(_BLDG_LVL4, `${tx},${ty}`);
}

/** True if (tx, ty) is a Building Lvl 5 tile (identified by user). */
export function isBuildingLvl5(tx, ty) {
  return Object.prototype.hasOwnProperty.call(_BLDG_LVL5, `${tx},${ty}`);
}

/** True if (tx, ty) is a Building Lvl 6 tile (identified by user). */
export function isBuildingLvl6(tx, ty) {
  return Object.prototype.hasOwnProperty.call(_BLDG_LVL6, `${tx},${ty}`);
}

/**
 * Wall Lvl 7 tiles — structure section only (nature section reclassified as Lvl 7).
 * Structure rows A-D (ty=41-44): Gate Arch cols 3-5 + Cobblestone cols 1-3 (tx=12-17).
 * Structure rows E-F (ty=45-46): Gate Arch sparse/full (tx=10,12 in E; tx=10-14 in F).
 */
export function isWallLvl7Tile(tx, ty) {
  if (ty >= 41 && ty <= 44 && tx >= 12 && tx <= 17) return true;
  if (ty === 45 && (tx === 10 || tx === 12)) return true;
  if (ty === 46 && tx >= 10 && tx <= 14) return true;
  return false;
}

/**
 * Wall Lvl 8 tiles — nature section (formerly misclassified as Lvl 6).
 * Nature rows A-D (ty=33-36): Birch Tree cols 3-5 + Willow Grove cols 1-3 (tx=12-17).
 * Nature rows E-F (ty=37-38): Birch Tree sparse/full (tx=10,12 in E; tx=10-14 in F).
 */
export function isWallLvl8Tile(tx, ty) {
  if (ty >= 33 && ty <= 36 && tx >= 12 && tx <= 17) return true;
  if (ty === 37 && (tx === 10 || tx === 12)) return true;
  if (ty === 38 && tx >= 10 && tx <= 14) return true;
  return false;
}

/** True if (tx, ty) is a Building Lvl 6 tile (identified by user). */
export function isBuildingLvl7(tx, ty) {
  return Object.prototype.hasOwnProperty.call(_BLDG_LVL7, `${tx},${ty}`);
}

/** True if (tx, ty) is a Building Lvl 7 tile (identified by user). */
export function isBuildingLvl8(tx, ty) {
  return Object.prototype.hasOwnProperty.call(_BLDG_LVL8, `${tx},${ty}`);
}

/** True if (tx, ty) is a Building Lvl 10 tile (identified by user). */
export function isBuildingLvl10(tx, ty) {
  return Object.prototype.hasOwnProperty.call(_BLDG_LVL10, `${tx},${ty}`);
}

// ── Individual unit display names [type][colorIndex 0-5] ─────────────────
export const UNIT_NAMES = {
  Soldier:      ['Tectine Footman',  'Iron Shield Guard', 'Spear Sentinel',   'Bastion Defender',  'Gilded Vanguard',   'Templar Knight'],
  Archer:       ['Tectine Archer',   'Longbow Ranger',    'Forest Scout',      'Hawk Sniper',       'Eagle Eye',         'Imperial Crossbow'],
  Vanguard:     ['Fire Apprentice',  'Ice Conjurer',      'Storm Weaver',      'Shadow Mage',       'Arcane Sorcerer',   'Grand Wizard'],
  Sapper:       ['Field Engineer',   'Siege Sapper',      'Mine Layer',        'Wall Breaker',      'Bomb Specialist',   'Grand Engineer'],
  Healer:       ['Battle Medic',     'Holy Cleric',       'Grove Shaman',      'Forest Druid',      'Temple Healer',     'Arch Paladin'],
  Scout:        ['Swift Scout',      'Shadow Spy',        'Path Finder',       'Night Stalker',     'Phantom Ranger',    'Void Infiltrator'],
  Siege:        ['Catapult Crew',    'Ballista Corps',    'Fire Trebuchet',    'Rock Hurler',       'Thunder Cannon',    'Sky Bombardier'],
  Ram:          ['Battering Ram',    'Iron Ram',          'War Hammer Ram',    'Steel Breaker',     'Dragon Ram',        'Titan Basher'],
  Beast:        ['Ember Drake',      'Frost Wyvern',      'Thunder Serpent',   'Shadow Dragon',     'Crimson Wyrm',      'Ancient Dragon'],
  BeastRider:   ['Drake Scout',      'Wyvern Lancer',     'Dragon Knight',     'Shadowscale Rider', 'Crimson Rider',     'Dragon Lord'],
  Elemental:    ['Flame Spirit',     'Tide Elemental',    'Stone Golem',       'Gale Wraith'],
  Acolyte:      ['Acolyte Mage',     'Rune Apprentice',   'Arcane Disciple',   'Spell Weaver',      'Mystic Caller',     'Grand Conjurer'],
  Villager:     ['Tectine Farmer',   'Village Smith',     'Trade Merchant',    'Master Carpenter',  'Harbor Fisher',     'Empire Scholar'],
  Battleship:   ['Tectine Battleship','Iron Dreadnought', 'Man-of-War',        'Steel Ironclad',    'War Galleon',       'Titan Warship'],
  Frigate:      ['Swift Frigate',    'Scout Gunship',     'Light Frigate',     'Sea Ranger',        'Heavy Frigate',     'Royal Frigate'],
  FishingBoat:  ['River Skiff',      "Fisher's Cog",      'Lake Canoe',        'Shore Boat',        'Reed Raft',         'Harbor Dinghy'],
  TransportShip:['Supply Barge',     'Cargo Vessel',      'Trade Ferry',       'River Hauler',      'War Transport',     'Empire Galleon'],
};

/** Returns the unique display name for a unit type + color combination. */
export function getUnitDisplayName(type, color) {
  const idx = parseInt(color, 10) - 1; // '01'→0, '06'→5
  return UNIT_NAMES[type]?.[idx] ?? `${type} ${color}`;
}

// ── Building Lvl 1 — user-identified tiles ────────────────────────────
const _BLDG_LVL1 = {
  '4,50':  'Bldg Lvl1 Stronghold A',
  '16,50': 'Bldg Lvl1 Watchtower A',
  '4,52':  'Bldg Lvl1 Stronghold C',
  '16,52': 'Bldg Lvl1 Watchtower C',
  '4,54':  'Bldg Lvl1 Stronghold E',
  '16,54': 'Bldg Lvl1 Watchtower E-5',
  '4,56':  'Bldg Lvl1 Stronghold G',
  '16,56': 'Bldg Lvl1 Guard Tower',
  '4,58':  'Bldg Lvl1 Fortress-2',
  '16,58': 'Bldg Lvl1 Tower-2 Top',   // ┐ 2-tile building (I-5 on top of J-5)
  '16,59': 'Bldg Lvl1 Tower-2 Bot',   // ┘
  '4,60':  'Bldg Lvl1 Stronghold K',
  '4,62':  'Bldg Lvl1 Fortress-1',
  '16,61': 'Bldg Lvl1 Tower-1 Top',   // ┐ 2-tile building (L-5 on top of M-5)
  '16,62': 'Bldg Lvl1 Tower-1 Bot',   // ┘
};

// ── Building Lvl 2 — user-identified tiles ────────────────────────────
// 14 tiles: Stronghold col-1 (tx=0) and Watchtower col-1 (tx=12) across specific rows,
// plus Watchtower E-5 (tx=16, ty=54) as a standalone.
const _BLDG_LVL2 = {
  '0,50':  'Bldg Lvl2 Stronghold A',
  '12,50': 'Bldg Lvl2 Watchtower A',
  '0,52':  'Bldg Lvl2 Stronghold C',
  '12,52': 'Bldg Lvl2 Watchtower C',
  '0,54':  'Bldg Lvl2 Stronghold E',
  '12,54': 'Bldg Lvl2 Watchtower E',
  '0,56':  'Bldg Lvl2 Stronghold G',
  '12,56': 'Bldg Lvl2 Watchtower G',
  '0,58':  'Bldg Lvl2 Stronghold I',
  '12,58': 'Bldg Lvl2 Watchtower I Top',  // ┐ 2-tile building
  '12,59': 'Bldg Lvl2 Watchtower I Bot',  // ┘
  '0,60':  'Bldg Lvl2 Stronghold K',
  '12,61': 'Bldg Lvl2 Watchtower L Top',  // ┐ 2-tile building
  '12,62': 'Bldg Lvl2 Watchtower L Bot',  // ┘
  '0,62':  'Bldg Lvl2 Stronghold M',
};

// ── Building Lvl 3 — user-identified tiles ────────────────────────────
// Key: "tx,ty".  Barracks col = tx=6  (Barracks X-1).  Market col = tx=18 (Grand Market X-1).
// ROW letter: A=ty50, C=ty52, E=ty54, G=ty56, I=ty58, J=ty59, K=ty60, L=ty61, M=ty62.
const _BLDG_LVL3 = {
  '6,50':  'Bldg Lvl3 Barracks-1',
  '18,50': 'Bldg Lvl3 Market-1',
  '6,52':  'Bldg Lvl3 Barracks-2',
  '18,52': 'Bldg Lvl3 Market-2',
  '6,54':  'Bldg Lvl3 Barracks-3',
  '18,54': 'Bldg Lvl3 Market-3',
  '6,56':  'Bldg Lvl3 Barracks-4',
  '18,56': 'Bldg Lvl3 Market-4',
  '6,58':  'Bldg Lvl3 Barracks-5',
  '18,58': 'Bldg Lvl3 Market-5 Top',  // ┐ 2-tile building (I-1 on top of J-1)
  '18,59': 'Bldg Lvl3 Market-5 Bot',  // ┘
  '6,60':  'Bldg Lvl3 Barracks-6',
  '18,61': 'Bldg Lvl3 Market-6 Top',  // ┐ 2-tile building (L-1 on top of M-1)
  '18,62': 'Bldg Lvl3 Market-6 Bot',  // ┘
  '6,62':  'Bldg Lvl3 Barracks-7',
};

// ── Building Lvl 4 — user-identified tiles ────────────────────────────
// 25 tiles: Stronghold col-2 (tx=1), Barracks col-6 (tx=10),
// Watchtower col-2 (tx=13), Grand Market col-6 (tx=22) across specific rows.
const _BLDG_LVL4 = {
  '1,50':  'Bldg Lvl4 Stronghold A',
  '13,50': 'Bldg Lvl4 Watchtower A',
  '1,52':  'Bldg Lvl4 Stronghold C',
  '13,52': 'Bldg Lvl4 Watchtower C',
  '1,54':  'Bldg Lvl4 Stronghold E',
  '13,54': 'Bldg Lvl4 Watchtower E',
  '1,56':  'Bldg Lvl4 Stronghold G',
  '13,56': 'Bldg Lvl4 Watchtower G',
  '1,58':  'Bldg Lvl4 Stronghold I',
  '13,58': 'Bldg Lvl4 Watchtower I Top',  // ┐ 2-tile building
  '13,59': 'Bldg Lvl4 Watchtower I Bot',  // ┘
  '1,60':  'Bldg Lvl4 Stronghold K',
  '13,61': 'Bldg Lvl4 Watchtower L Top',  // ┐ 2-tile building
  '13,62': 'Bldg Lvl4 Watchtower L Bot',  // ┘
  '1,62':  'Bldg Lvl4 Stronghold M',
};

// ── Building Lvl 5 — user-identified tiles ────────────────────────────
// 15 tiles: Barracks col-5 (tx=10) + Grand Market col-5 (tx=22) — moved from old Lvl 4.
const _BLDG_LVL5 = {
  '10,50': 'Bldg Lvl5 Barracks A',
  '22,50': 'Bldg Lvl5 Grand Market A',
  '10,52': 'Bldg Lvl5 Barracks C',
  '22,52': 'Bldg Lvl5 Grand Market C',
  '10,54': 'Bldg Lvl5 Barracks E',
  '22,54': 'Bldg Lvl5 Grand Market E',
  '10,56': 'Bldg Lvl5 Barracks G',
  '22,56': 'Bldg Lvl5 Grand Market G',
  '10,58': 'Bldg Lvl5 Barracks I',
  '22,58': 'Bldg Lvl5 Grand Market I Top',  // ┐ 2-tile building
  '22,59': 'Bldg Lvl5 Grand Market I Bot',  // ┘
  '10,60': 'Bldg Lvl5 Barracks K',
  '22,61': 'Bldg Lvl5 Grand Market L Top',  // ┐ 2-tile building
  '22,62': 'Bldg Lvl5 Grand Market L Bot',  // ┘
  '10,62': 'Bldg Lvl5 Barracks M',
};

// ── Building Lvl 6 — user-identified tiles ────────────────────────────
// 15 tiles: Barracks col-4 (tx=9), Grand Market col-4 (tx=21) across specific rows.
const _BLDG_LVL6 = {
  '9,50':  'Bldg Lvl6 Barracks A',
  '21,50': 'Bldg Lvl6 Grand Market A',
  '9,52':  'Bldg Lvl6 Barracks C',
  '21,52': 'Bldg Lvl6 Grand Market C',
  '9,54':  'Bldg Lvl6 Barracks E',
  '21,54': 'Bldg Lvl6 Grand Market E',
  '9,56':  'Bldg Lvl6 Barracks G',
  '21,56': 'Bldg Lvl6 Grand Market G',
  '9,58':  'Bldg Lvl6 Barracks I',
  '21,58': 'Bldg Lvl6 Grand Market I Top',  // ┐ 2-tile building
  '21,59': 'Bldg Lvl6 Grand Market I Bot',  // ┘
  '9,60':  'Bldg Lvl6 Barracks K',
  '21,61': 'Bldg Lvl6 Grand Market L Top',  // ┐ 2-tile building
  '21,62': 'Bldg Lvl6 Grand Market L Bot',  // ┘
  '9,62':  'Bldg Lvl6 Barracks M',
};

// ── Building Lvl 6 — user-identified tiles ────────────────────────────
// 14 tiles: Stronghold col-3 (tx=2) + Watchtower col-3 (tx=14) across specific rows.
// Barracks (tx=8) and Grand Market (tx=20) reclassified to Lvl 7.
const _BLDG_LVL7 = {
  '2,50':  'Bldg Lvl7 Stronghold A',
  '14,50': 'Bldg Lvl7 Watchtower A',
  '2,52':  'Bldg Lvl7 Stronghold C',
  '14,52': 'Bldg Lvl7 Watchtower C',
  '2,54':  'Bldg Lvl7 Stronghold E',
  '14,54': 'Bldg Lvl7 Watchtower E',
  '2,56':  'Bldg Lvl7 Stronghold G',
  '14,56': 'Bldg Lvl7 Watchtower G',
  '2,58':  'Bldg Lvl7 Stronghold I',
  '14,58': 'Bldg Lvl7 Watchtower I Top',  // ┐ 2-tile building
  '14,59': 'Bldg Lvl7 Watchtower I Bot',  // ┘
  '2,60':  'Bldg Lvl7 Stronghold K',
  '2,62':  'Bldg Lvl7 Stronghold M',
  '14,61': 'Bldg Lvl7 Watchtower L Top',  // ┐ 2-tile building
  '14,62': 'Bldg Lvl7 Watchtower L Bot',  // ┘
};

// ── Building Lvl 7 — user-identified tiles ────────────────────────────
// 15 tiles: Barracks col-3 (tx=8) + Grand Market col-3 (tx=20) across specific rows.
const _BLDG_LVL8 = {
  '8,50':  'Bldg Lvl8 Barracks A',
  '20,50': 'Bldg Lvl8 Grand Market A',
  '8,52':  'Bldg Lvl8 Barracks C',
  '20,52': 'Bldg Lvl8 Grand Market C',
  '8,54':  'Bldg Lvl8 Barracks E',
  '20,54': 'Bldg Lvl8 Grand Market E',
  '8,56':  'Bldg Lvl8 Barracks G',
  '20,56': 'Bldg Lvl8 Grand Market G',
  '8,58':  'Bldg Lvl8 Barracks I',
  '20,58': 'Bldg Lvl8 Grand Market I Top',  // ┐ 2-tile building
  '20,59': 'Bldg Lvl8 Grand Market I Bot',  // ┘
  '8,60':  'Bldg Lvl8 Barracks K',
  '20,61': 'Bldg Lvl8 Grand Market L Top',  // ┐ 2-tile building
  '20,62': 'Bldg Lvl8 Grand Market L Bot',  // ┘
  '8,62':  'Bldg Lvl8 Barracks M',
};

// ── Building Lvl 10 — user-identified tiles ───────────────────────────
// 14 tiles: Stronghold col-4 (tx=3) + Watchtower col-4 (tx=15) across specific rows.
const _BLDG_LVL10 = {
  '3,50':  'Bldg Lvl10 Stronghold A',
  '15,50': 'Bldg Lvl10 Watchtower A',
  '3,52':  'Bldg Lvl10 Stronghold C',
  '15,52': 'Bldg Lvl10 Watchtower C',
  '3,54':  'Bldg Lvl10 Stronghold E',
  '15,54': 'Bldg Lvl10 Watchtower E',
  '3,56':  'Bldg Lvl10 Stronghold G',
  '15,56': 'Bldg Lvl10 Watchtower G',
  '3,58':  'Bldg Lvl10 Stronghold I',
  '15,58': 'Bldg Lvl10 Watchtower I Top',  // ┐ 2-tile building
  '15,59': 'Bldg Lvl10 Watchtower I Bot',  // ┘
  '3,60':  'Bldg Lvl10 Stronghold K',
  '15,61': 'Bldg Lvl10 Watchtower L Top',  // ┐ 2-tile building
  '15,62': 'Bldg Lvl10 Watchtower L Bot',  // ┘
  '3,62':  'Bldg Lvl10 Stronghold M',
};

// ── Object/tile display names — guaranteed unique per (tx, ty) ────────
//
// Pattern:
//   Wall Lvl 2         →  "Wall Lvl 2 <Row>-<N>"        e.g. "Wall Lvl 2 A-3"
//   Wall Lvl 1         →  "Wall Lvl 1 <Row>-<N>"        e.g. "Wall Lvl 1 G-1"
//   Nature             →  "<Type> <Row><N>"              e.g. "Pine Tree B2"
//   Buildings          →  "<Type> <Row>-<N>"             e.g. "Stronghold C-2"
//   Bldg Lvl 1         →  "Bldg Lvl1 <Desc>"             e.g. "Bldg Lvl1 Tower-1 Top"
//   Water              →  "<Base> <rowOff>-<tx>"         e.g. "Still Lake 0-5"

export function getObjectDisplayName(tx, ty) {
  // Water (rows 8-12)
  if (ty >= 8 && ty <= 12) {
    const BASES = [
      'Rippling Shallows','Crystal Pond','Still Lake','Blue Lagoon','Deep Pool',
      'River Bend','Calm Bay','Mirror Lake','Glacial Waters','Tidal Pool',
      'Spring Pool','Misty Lake','Serene Cove','Fen Water','Clear Stream',
      'Bubbling Brook','Hidden Cove','Mossy Pool','Quiet Bay','Stone Pool',
      'Amber Pool','Dark Waters','Silver Lake','Emerald Pool','Sapphire Bay',
      'Brackish Waters','Reed Shallows','Gravel Ford','Shadow Pool','Glassy Waters',
      'Pebbly Brook','Sunken Pool','Mire Waters','Sandy Shallows','Ice Melt Pool',
      'Rain Pool','Cobalt Lagoon','Turquoise Waters','Brine Shallows','Algae Pool',
      'Kelp Bed','Mud Pool',
    ];
    return `${BASES[tx % BASES.length]} ${ty - 8}-${tx}`;
  }
  if (ty >= 28 && ty <= 32) {
    const DEEP = ['Deep Ocean Trench','Abyssal Pool','Dark Depths','Ocean Void','Sea Abyss'];
    return `${DEEP[(ty - 28) % DEEP.length]} ${tx + 1}`;
  }

  // Rows 33-40: nature/wall section — chain-consistent names (same name at every level)
  if (ty >= 33 && ty <= 40) {
    const ROW = String.fromCharCode(65 + (ty - 33)); // A-H

    // Lvl 5 (tx=6-11 rows A-D; tx=5,7 sparse E; tx=5-9 sparse F)
    if (isWallLvl5Tile(tx, ty)) {
      if (ty <= 36) return tx === 11 ? `Wall ${ROW} Gate` : `Wall ${ROW}-${tx - 5}`;
      return `Wall ${ROW}-${tx - 4}`; // sparse E/F
    }
    // Lvl 8 (tx=12-17 rows A-D; tx=10,12 sparse E; tx=10-14 sparse F)
    if (isWallLvl8Tile(tx, ty)) {
      if (ty <= 36) return tx === 17 ? `Wall ${ROW} Gate` : `Wall ${ROW}-${tx - 11}`;
      return `Wall ${ROW}-${tx - 9}`; // sparse E/F
    }
    // Lvl 2 blocks (tx=0-4, rows A-F)
    if (ty < 39 && tx <= 4) return `Wall ${ROW}-${tx + 1}`;
    // Lvl 2 Gate (tx=5, rows A-D)
    if (tx === 5 && ty <= 36) return `Wall ${ROW} Gate`;
    // Lvl 1 (tx=24-29, rows A-D)
    if (tx >= 24 && tx <= 29 && ty <= 36)
      return tx === 29 ? `Wall ${ROW} Gate` : `Wall ${ROW}-${tx - 23}`;
    // Lvl 1 sparse G/H (tx=5-9, rows G-H)
    if (tx >= 5 && tx <= 9 && ty >= 39) return `Wall ${ROW}-${tx - 4}`;
    // Lvl 10 main (tx=18-23, rows A-D)
    if (tx >= 18 && tx <= 22 && ty <= 36) return `Wall ${ROW}-${tx - 17}`;
    if (tx === 23 && ty <= 36) return `Wall ${ROW} Gate`;
    // Lvl 10 catch-all (decorative/remaining nature tiles)
    return `Wall ${ROW}-${tx + 1}`;
  }

  // Structure tiles (rows 41-48)
  if (ty >= 41 && ty <= 48) {
    const ROW = String.fromCharCode(65 + (ty - 41)); // A-H

    // Lvl 9 (tx=18-23 rows A-D; tx=0,2 sparse G; tx=0-4 sparse H) — use ROW=ty-41
    if (isWallLvl9Tile(tx, ty)) {
      if (ty <= 44) return tx === 23 ? `Wall ${ROW} Gate` : `Wall ${ROW}-${tx - 17}`;
      return `Wall ${ROW}-${tx + 1}`; // sparse G/H
    }
    // Lvl 4 (tx=6-11 rows A-D; tx=5,7 sparse E; tx=5-9 sparse F) — use ROW=ty-41, variant tx-5
    if (isWallLvl4Tile(tx, ty)) {
      if (ty <= 44) return tx === 11 ? `Wall ${ROW} Gate` : `Wall ${ROW}-${tx - 5}`;
      return `Wall ${ROW}-${tx - 4}`; // sparse E/F
    }
    // Lvl 6 (tx=24-29 rows A-D; tx=5,7 sparse G; tx=5-9 sparse H) — use ROW=ty-41
    if (isWallLvl6Tile(tx, ty)) {
      if (ty <= 44) return tx === 29 ? `Wall ${ROW} Gate` : `Wall ${ROW}-${tx - 23}`;
      return `Wall ${ROW}-${tx - 4}`; // sparse G/H
    }
    // Lvl 7 (tx=12-17 rows A-D; tx=10,12 sparse E; tx=10-14 sparse F) — use ROW=ty-41
    if (isWallLvl7Tile(tx, ty)) {
      if (ty <= 44) return tx === 17 ? `Wall ${ROW} Gate` : `Wall ${ROW}-${tx - 11}`;
      return `Wall ${ROW}-${tx - 9}`; // sparse E/F
    }
    // Lvl 3 blocks (tx=0-4 rows A-F); Gate (tx=5 rows A-D)
    if (tx <= 4 && ty <= 46) return `Wall ${ROW}-${tx + 1}`;
    if (tx === 5 && ty <= 44) return `Wall ${ROW} Gate`;

    // Remaining structure tiles
    const GROUPS = [
      { max:  5, base: 'Stone Wall',       off: 0  },
      { max: 10, base: 'Wooden Fence',     off: 5  },
      { max: 15, base: 'Gate Arch',        off: 10 },
      { max: 20, base: 'Cobblestone Path', off: 15 },
      { max: 25, base: 'Garden Hedge',     off: 20 },
      { max: 30, base: 'Flagstone',        off: 25 },
    ];
    const g = GROUPS.find(x => tx < x.max) ?? { base: 'Ruin', off: 30 };
    return `${g.base} ${ROW}${tx - g.off + 1}`;
  }

  // Buildings (rows 50-62) — chain-consistent names (same name at every level)
  if (ty >= 50 && ty <= 62) {
    // Stronghold chain tx values (Lvl1→2→3 Barracks→4→5→6→7→8→9→10)
    const STRONGHOLD_TX = new Set([4, 0, 6, 1, 10, 9, 2, 8, 7, 3]);
    // Watchtower chain tx values (Lvl1→2→3 Market→4→5→6→7→8→9→10)
    const WATCHTOWER_TX = new Set([16, 12, 18, 13, 22, 21, 14, 20, 19, 15]);
    if (STRONGHOLD_TX.has(tx)) {
      const n = {
        50: 'Family House',   // capacity/banking hub for assigned units
        52: 'Bank',           // connects up to 10 Family Houses; grows interest per upgrade
        54: 'Dojo',           // training building for assigned units
        56: 'Villagers Hut',  // base housing for villager units
        58: 'Windmill',       // converts Fields Land output → food resources for Farmers Market
        60: 'Farmers Market', // sells resources to households; sourced from Fields Land
        62: 'Ore Refiner',    // refines mine output → Rufluxes per day/week/month
      };
      return n[ty] ?? `Building ${ty}`;
    }
    if (WATCHTOWER_TX.has(tx)) {
      if (ty === 58) return "Dragon's Incubator Top";
      if (ty === 59) return "Dragon's Incubator Bot";
      if (ty === 61) return 'Townhall Top';
      if (ty === 62) return 'Townhall Bot';
      const n = {
        50: 'Fields Land',      // base farmland; workers produce resources
        52: 'Water Springs',    // heals units assigned from Family Houses
        54: 'Gold Mine',        // produces gold/ore; feeds Ore Refiner
        56: 'Abandoned Mine',   // placeholder mine (inactive for now)
      };
      return n[ty] ?? `Land ${ty}`;
    }
    const ROW = String.fromCharCode(65 + (ty - 50));
    if (tx <= 4)  return `Stronghold ${ROW}-${tx + 1}`;
    if (tx <= 10) return `Barracks ${ROW}-${tx - 5}`;
    if (tx <= 16) return `Watchtower ${ROW}-${tx - 11}`;
    if (tx <= 22) return `Grand Market ${ROW}-${tx - 17}`;
    return `Keep ${ROW}-${tx - 23 + 1}`;
  }

  return `Object-${tx}-${ty}`;
}

// tx values for each named building chain.
const _FAMILY_HOUSE_TX = new Set([4, 0, 6, 1, 10, 9, 2, 8, 7, 3]);
const _WATCHTOWER_TX   = new Set([16, 12, 18, 13, 22, 21, 14, 20, 19, 15]);

const WATCHTOWER_MAX_WORKERS = 4;

/**
 * Returns the capacity (number of units/workers) for a building tile,
 * or null if the building has no defined capacity.
 * Enforcement logic will be wired later.
 */
export function getObjectCapacity(tx, ty) {
  if (ty === 50) {
    const lvl = getObjectLevel(tx, ty) ?? 1;
    if (_FAMILY_HOUSE_TX.has(tx)) return lvl; // Lvl1=1, Lvl2=2, ...
    if (_WATCHTOWER_TX.has(tx))   return lvl; // Fields Land: capacity = level (1-10)
  }
  if (ty === 56 && _FAMILY_HOUSE_TX.has(tx)) {
    return (getObjectLevel(tx, ty) ?? 1) * 2; // Lvl1=2, Lvl2=4, ..., Lvl10=20
  }
  // Windmill: capacity = level * 2 fields (Lvl1=2, Lvl2=4, etc.)
  if (ty === 58 && _FAMILY_HOUSE_TX.has(tx)) {
    return (getObjectLevel(tx, ty) ?? 1) * 2;
  }
  return null;
}

/**
 * Returns the label used for the capacity slot (e.g. "units", "workers").
 */
export function getObjectCapacityLabel(tx, ty) {
  if (ty === 50 && _WATCHTOWER_TX.has(tx)) return 'workers';
  if (ty === 56) return 'villagers';
  if (ty === 58 && _FAMILY_HOUSE_TX.has(tx)) return 'fields';
  return 'units';
}

const FIELDS_LAND_SPEED_BASE_LVL  = 4;  // speed bonus starts at this level
const FIELDS_LAND_SPEED_PER_LVL   = 10; // +10% work speed per level from lvl 4
const FIELDS_LAND_PROD_PER_LVL    = 10; // +10% resource production per level (all levels)

/**
 * Returns the work-speed bonus percentage for a Fields Land tile at lvl ≥ 4,
 * or null if no speed bonus applies. Enforcement wired later.
 */
export function getObjectSpeedBonus(tx, ty) {
  if (ty === 50 && _WATCHTOWER_TX.has(tx)) {
    const lvl = getObjectLevel(tx, ty) ?? 1;
    if (lvl >= FIELDS_LAND_SPEED_BASE_LVL)
      return (lvl - FIELDS_LAND_SPEED_BASE_LVL + 1) * FIELDS_LAND_SPEED_PER_LVL;
  }
  return null;
}

/**
 * Returns the resource-production bonus percentage for a Fields Land tile
 * at any level (+10% × level). Only applies to the ty=50 (Fields Land) row.
 */
export function getObjectProductionBonus(tx, ty) {
  if (ty === 50 && _WATCHTOWER_TX.has(tx)) {
    const lvl = getObjectLevel(tx, ty) ?? 1;
    return lvl * FIELDS_LAND_PROD_PER_LVL;
  }
  return null;
}

export const CHAR_TYPES = [
  'Soldier', 'Archer', 'Vanguard', 'Sapper', 'Healer', 'Scout',
  'Siege', 'Ram', 'Beast', 'BeastRider', 'Elemental', 'Acolyte',
  'Villager', 'Battleship', 'Frigate', 'FishingBoat', 'TransportShip',
];
export const CHAR_COLORS = ['01', '02', '03', '04', '05', '06'];

// Overrides for types that don't have all 6 color sprites on disk.
// All other types default to CHAR_COLORS (all 6).
export const CHAR_COLORS_BY_TYPE = {
  Elemental: ['01', '02', '03', '04'],   // only 4 Elemental sprites exist
};

// Human-readable category labels for the unit strip sections.
// Beast → "Dragons", BeastRider → "Dragon Riders" for display only;
// the internal type key still matches the sprite filename.
export const CHAR_TYPE_LABELS = {
  Soldier:      'Soldiers',
  Archer:       'Archers',
  Vanguard:     'Magicians',
  Sapper:       'Sappers',
  Healer:       'Healers',
  Scout:        'Scouts',
  Siege:        'Siege Engines',
  Ram:          'Battering Rams',
  Beast:        'Dragons',
  BeastRider:   'Dragon Riders',
  Elemental:    'Elementals',
  Acolyte:      'Acolytes',
  Villager:     'Villagers',
  Battleship:   'Battleships',
  Frigate:      'Frigates',
  FishingBoat:  'Fishing Boats',
  TransportShip:'Transport Ships',
};

/**
 * Returns true for tiles that should never appear in the object strip.
 * Covers known-empty variant slots and building continuation rows
 * (odd rows B,D,F,H in ty=51-57, and partial exclusions in ty=59-61).
 */
export function isHiddenTile(tx, ty) {
  // Sparse empty slots in nature/structure rows
  if (ty === 37 && (tx === 9  || tx === 14)) return true;  // Pine Tree E5, Birch Tree E5
  if (ty === 39 && (tx === 4  || tx === 9))  return true;  // Crimson Gem G-5, Wall Lvl1 G-5
  if (ty === 45 && (tx === 9  || tx === 14)) return true;  // Wooden Fence E5, Gate Arch E5
  if (ty === 47 && (tx === 4  || tx === 9))  return true;  // Stone Wall G5, Wooden Fence G5

  // Building section — odd rows are continuation tiles, not standalone objects.
  // Variants -2 through -5 of all four building types in rows B,D,F,H (ty=51,53,55,57).
  if (ty === 51 || ty === 53 || ty === 55 || ty === 57) {
    if (tx >= 1  && tx <= 4)  return true;  // Stronghold -2 to -5
    if (tx >= 7  && tx <= 10) return true;  // Barracks -2 to -5
    if (tx >= 13 && tx <= 16) return true;  // Watchtower -2 to -5
    if (tx >= 19 && tx <= 22) return true;  // Grand Market -2 to -5
  }
  // Row J (ty=59): Stronghold J-2/5 and Barracks J-2/5 only
  if (ty === 59 && ((tx >= 1 && tx <= 4) || (tx >= 7 && tx <= 10))) return true;
  // Row K (ty=60): Watchtower K-2/5 and Grand Market K-2/5 only
  if (ty === 60 && ((tx >= 13 && tx <= 16) || (tx >= 19 && tx <= 22))) return true;
  // Row L (ty=61): Stronghold L-2/5 and Barracks L-2/5 only
  if (ty === 61 && ((tx >= 1 && tx <= 4) || (tx >= 7 && tx <= 10))) return true;

  return false;
}

/**
 * Two-tile stacked buildings: key = "tx,ty" of the Top tile,
 * value = { tx, ty } of the Bottom tile directly below it.
 * Used to merge pairs into a single strip card and place both tiles at once.
 */
export const BLDG_TOP_BOT_PAIRS = new Map([
  ['16,58', {tx:16,ty:59}], ['16,61', {tx:16,ty:62}],  // Lvl1 towers
  ['12,58', {tx:12,ty:59}], ['12,61', {tx:12,ty:62}],  // Lvl2 watchtowers
  ['18,58', {tx:18,ty:59}], ['18,61', {tx:18,ty:62}],  // Lvl3 markets
  ['13,58', {tx:13,ty:59}], ['13,61', {tx:13,ty:62}],  // Lvl4 watchtowers
  ['22,58', {tx:22,ty:59}], ['22,61', {tx:22,ty:62}],  // Lvl5 grand markets
  ['21,58', {tx:21,ty:59}], ['21,61', {tx:21,ty:62}],  // Lvl6 grand markets
  ['14,58', {tx:14,ty:59}], ['14,61', {tx:14,ty:62}],  // Lvl7 watchtowers
  ['20,58', {tx:20,ty:59}], ['20,61', {tx:20,ty:62}],  // Lvl8 grand markets
  ['19,58', {tx:19,ty:59}], ['19,61', {tx:19,ty:62}],  // Lvl9 grand markets (I-2+J-2, L-2+M-2)
  ['15,58', {tx:15,ty:59}], ['15,61', {tx:15,ty:62}],  // Lvl10 watchtowers
]);

// Keys of Bottom tiles — skipped in the strip (shown via their Top card instead).
export const BLDG_BOT_KEYS = new Set(
  [...BLDG_TOP_BOT_PAIRS.values()].map(b => `${b.tx},${b.ty}`)
);

// ── Building Lvl 9 — explicit lookup (Barracks col-2 tx=7, Grand Market col-2 tx=19) ─
const _BLDG_LVL9 = {
  '7,50':  'Bldg Lvl9 Barracks A',
  '19,50': 'Bldg Lvl9 Grand Market A',
  '7,52':  'Bldg Lvl9 Barracks C',
  '19,52': 'Bldg Lvl9 Grand Market C',
  '7,54':  'Bldg Lvl9 Barracks E',
  '19,54': 'Bldg Lvl9 Grand Market E',
  '7,56':  'Bldg Lvl9 Barracks G',
  '19,56': 'Bldg Lvl9 Grand Market G',
  '7,58':  'Bldg Lvl9 Barracks I',
  '19,58': 'Bldg Lvl9 Grand Market I Top',  // 2-tile (I-2 top, J-2 bot)
  '19,59': 'Bldg Lvl9 Grand Market I Bot',
  '7,60':  'Bldg Lvl9 Barracks K',
  '19,61': 'Bldg Lvl9 Grand Market L Top',  // 2-tile (L-2 top, M-2 bot)
  '19,62': 'Bldg Lvl9 Grand Market L Bot',
  '7,62':  'Bldg Lvl9 Barracks M',
};

export function isBuildingLvl9(tx, ty) {
  return Object.prototype.hasOwnProperty.call(_BLDG_LVL9, `${tx},${ty}`);
}

// ── Upgrade map: 'tx,ty' of a tile → {tx,ty} of its next-level replacement ──
// For 2-tile buildings the key is the TOP tile; the bot follows via BLDG_TOP_BOT_PAIRS.
function _buildUpgradeMap() {
  const m = new Map();

  // ── WALL CHAIN ─────────────────────────────────────────────────────────
  // Lvl 1 (tx=24-29 in ty=33-36) → Lvl 2 (tx=0-5 same ty)
  for (let ty = 33; ty <= 36; ty++) {
    for (let n = 1; n <= 5; n++) m.set(`${23+n},${ty}`, {tx: n-1, ty});
    m.set(`29,${ty}`, {tx: 5, ty}); // col-6 → Gate
  }
  // Lvl 1 G row (ty=39) → Lvl 2 E row (ty=37); H row (ty=40) → Lvl 2 F row (ty=38).
  // Pattern: tx - 5, ty - 2.  From Lvl 2 E/F the existing chain continues normally.
  m.set('5,39', {tx:0, ty:37}); // G-1 → E-1
  m.set('7,39', {tx:2, ty:37}); // G-3 → E-3
  for (let tx = 5; tx <= 9; tx++) m.set(`${tx},40`, {tx: tx-5, ty:38}); // H-N → F-N
  // Lvl 2 (tx=0-5 in ty=33-38) → Lvl 3 (same tx, ty+8)
  for (let ty = 33; ty <= 38; ty++) {
    for (let tx = 0; tx <= 4; tx++) m.set(`${tx},${ty}`, {tx, ty: ty+8});
    if (ty <= 36) m.set(`5,${ty}`, {tx: 5, ty: ty+8}); // Gate only rows A-D
  }
  // Lvl 3 (tx=0-5 in ty=41-44) → Lvl 4 (tx+6, same ty)
  for (let ty = 41; ty <= 44; ty++) {
    for (let tx = 0; tx <= 4; tx++) m.set(`${tx},${ty}`, {tx: tx+6, ty});
    m.set(`5,${ty}`, {tx: 11, ty});
  }
  // Lvl 3 rows E-F sparse → Lvl 4 sparse
  m.set('0,45', {tx:5,ty:45}); m.set('2,45', {tx:7,ty:45});
  for (let tx = 0; tx <= 4; tx++) m.set(`${tx},46`, {tx: tx+5, ty:46});
  // Lvl 4 (ty=41-44 tx=6-11, ty=45 tx=5/7, ty=46 tx=5-9) → Lvl 5 (same tx, ty-8)
  for (let ty = 41; ty <= 44; ty++) {
    for (let tx = 6; tx <= 11; tx++) m.set(`${tx},${ty}`, {tx, ty: ty-8});
  }
  m.set('5,45', {tx:5,ty:37}); m.set('7,45', {tx:7,ty:37});
  for (let tx = 5; tx <= 9; tx++) m.set(`${tx},46`, {tx, ty:38});
  // Lvl 5 (ty=33-36 tx=6-11) → Lvl 6 (tx+18, ty+8); sparse rows too
  for (let ty = 33; ty <= 36; ty++) {
    for (let tx = 6; tx <= 11; tx++) m.set(`${tx},${ty}`, {tx: tx+18, ty: ty+8});
  }
  m.set('5,37', {tx:5,ty:47}); m.set('7,37', {tx:7,ty:47});
  for (let tx = 5; tx <= 9; tx++) m.set(`${tx},38`, {tx, ty:48});
  // Lvl 6 (ty=41-44 tx=24-29) → Lvl 7 (tx-12, same ty); sparse rows too
  for (let ty = 41; ty <= 44; ty++) {
    for (let tx = 24; tx <= 29; tx++) m.set(`${tx},${ty}`, {tx: tx-12, ty});
  }
  m.set('5,47', {tx:10,ty:45}); m.set('7,47', {tx:12,ty:45});
  for (let tx = 5; tx <= 9; tx++) m.set(`${tx},48`, {tx: tx+5, ty:46});
  // Lvl 7 (ty=41-44 tx=12-17) → Lvl 8 (same tx, ty-8); sparse rows too
  for (let ty = 41; ty <= 44; ty++) {
    for (let tx = 12; tx <= 17; tx++) m.set(`${tx},${ty}`, {tx, ty: ty-8});
  }
  m.set('10,45', {tx:10,ty:37}); m.set('12,45', {tx:12,ty:37});
  for (let tx = 10; tx <= 14; tx++) m.set(`${tx},46`, {tx, ty:38});
  // Lvl 8 (ty=33-36 tx=12-17) → Lvl 9 (tx+6, ty+8); sparse rows too
  for (let ty = 33; ty <= 36; ty++) {
    for (let tx = 12; tx <= 17; tx++) m.set(`${tx},${ty}`, {tx: tx+6, ty: ty+8});
  }
  m.set('10,37', {tx:0,ty:47}); m.set('12,37', {tx:2,ty:47});
  for (let tx = 10; tx <= 14; tx++) m.set(`${tx},38`, {tx: tx-10, ty:48});
  // Lvl 9 (ty=41-44 tx=18-23) → Lvl 10 (same tx, ty-8); sparse rows too
  for (let ty = 41; ty <= 44; ty++) {
    for (let tx = 18; tx <= 23; tx++) m.set(`${tx},${ty}`, {tx, ty: ty-8});
  }
  m.set('0,47', {tx:0,ty:39}); m.set('2,47', {tx:2,ty:39});
  for (let tx = 0; tx <= 4; tx++) m.set(`${tx},48`, {tx, ty:40});

  // ── BUILDING CHAIN ─────────────────────────────────────────────────────
  // Building rows (single-tile and 2-tile tops share the same tx upgrade chain)
  const BLDG_ROWS = [50, 52, 54, 56, 58, 60, 61, 62];
  for (const ty of BLDG_ROWS) {
    // Stronghold: Lvl1(4)→Lvl2(0)→Lvl3 Barracks(6)→ then continues Barracks chain
    m.set(`4,${ty}`,  {tx:0, ty}); m.set(`0,${ty}`, {tx:6, ty});
    // Watchtower: Lvl1(16)→Lvl2(12)→Lvl3 Market(18)→ then continues Market chain
    m.set(`16,${ty}`, {tx:12, ty}); m.set(`12,${ty}`, {tx:18, ty});
    // Barracks: Lvl3(6)→Lvl4 Stronghold(1)→Lvl5(10)→Lvl6(9)→Lvl7 Stronghold(2)→Lvl8(8)→Lvl9(7)→Lvl10 Stronghold(3)
    m.set(`6,${ty}`,  {tx:1,  ty}); m.set(`1,${ty}`,  {tx:10, ty});
    m.set(`10,${ty}`, {tx:9,  ty}); m.set(`9,${ty}`,  {tx:2,  ty});
    m.set(`2,${ty}`,  {tx:8,  ty}); m.set(`8,${ty}`,  {tx:7,  ty});
    m.set(`7,${ty}`,  {tx:3,  ty});
    // Grand Market: Lvl3(18)→Lvl4 Watchtower(13)→Lvl5(22)→Lvl6(21)→Lvl7 Watchtower(14)→Lvl8(20)→Lvl9(19)→Lvl10 Watchtower(15)
    m.set(`18,${ty}`, {tx:13, ty}); m.set(`13,${ty}`, {tx:22, ty});
    m.set(`22,${ty}`, {tx:21, ty}); m.set(`21,${ty}`, {tx:14, ty});
    m.set(`14,${ty}`, {tx:20, ty}); m.set(`20,${ty}`, {tx:19, ty});
    m.set(`19,${ty}`, {tx:15, ty});
  }
  return m;
}
export const UPGRADE_MAP = _buildUpgradeMap();

/** Returns the level number (1-10) for a wall or building tile, or null for unleveled tiles. */
export function getObjectLevel(tx, ty) {
  if (isBuildingLvl1(tx, ty))  return 1;
  if (isBuildingLvl2(tx, ty))  return 2;
  if (isBuildingLvl3(tx, ty))  return 3;
  if (isBuildingLvl4(tx, ty))  return 4;
  if (isBuildingLvl5(tx, ty))  return 5;
  if (isBuildingLvl6(tx, ty))  return 6;
  if (isBuildingLvl7(tx, ty))  return 7;
  if (isBuildingLvl8(tx, ty))  return 8;
  if (isBuildingLvl9(tx, ty))  return 9;
  if (isBuildingLvl10(tx, ty)) return 10;
  if (isWallLvl1Tile(tx, ty))  return 1;
  if (isObjectWallTile(tx, ty)) return 2;
  if (isWallLvl3Tile(tx, ty))  return 3;
  if (isWallLvl4Tile(tx, ty))  return 4;
  if (isWallLvl5Tile(tx, ty))  return 5;
  if (isWallLvl6Tile(tx, ty))  return 6;
  if (isWallLvl7Tile(tx, ty))  return 7;
  if (isWallLvl8Tile(tx, ty))  return 8;
  if (isWallLvl9Tile(tx, ty))  return 9;
  if (isWallLvl10Tile(tx, ty)) return 10;
  return null;
}

// ── Unit stats per color index [atk, def, spd, spAtk, spDef] ────────────
export const UNIT_STATS = {
  Soldier:     [[12,10,5,3,8],[10,14,4,3,12],[14,8,6,4,6],[8,18,3,2,15],[15,12,7,6,10],[16,16,5,8,14]],
  Archer:      [[10,5,8,14,5],[11,5,9,16,5],[12,4,10,17,4],[13,6,10,18,6],[14,6,11,20,6],[15,8,10,22,8]],
  Vanguard:    [[8,4,6,16,8],[8,5,6,18,9],[10,5,7,20,10],[9,6,6,22,12],[10,7,7,24,14],[12,8,6,28,16]],
  Sapper:      [[10,6,7,8,4],[11,7,7,10,5],[12,8,7,12,5],[13,9,6,14,6],[14,10,6,16,7],[16,12,6,18,8]],
  Healer:      [[2,8,5,12,14],[2,9,5,14,16],[2,10,5,16,18],[3,11,5,18,20],[3,12,5,20,22],[4,14,5,24,26]],
  Scout:       [[8,4,14,10,4],[9,4,15,11,4],[10,5,16,12,5],[10,5,17,13,5],[11,6,18,14,6],[12,6,20,16,6]],
  Siege:       [[18,4,2,8,3],[20,5,2,10,3],[22,6,2,12,4],[24,7,2,14,4],[26,8,2,16,5],[30,10,2,18,5]],
  Ram:         [[20,6,3,4,4],[22,7,3,4,5],[24,8,3,4,5],[26,9,3,4,6],[28,10,3,4,6],[32,12,3,4,7]],
  Beast:       [[20,12,10,18,10],[18,14,10,20,12],[22,10,12,22,10],[24,14,10,20,14],[26,14,10,22,14],[30,18,10,28,18]],
  BeastRider:  [[16,10,11,14,8],[17,11,11,15,9],[18,12,11,16,10],[20,12,12,18,10],[22,14,12,20,12],[26,16,12,22,14]],
  Elemental:   [[25,20,8,30,25],[24,22,8,32,26],[26,18,10,34,22],[28,24,8,36,28]],
  Acolyte:     [[4,6,7,10,10],[4,7,7,12,12],[4,7,8,14,14],[5,8,8,16,16],[5,9,8,18,18],[6,10,8,20,20]],
  Villager:    [[2,3,6,1,3],[4,4,5,2,4],[3,3,7,2,3],[4,5,5,3,5],[3,4,8,2,4],[5,5,6,4,6]],
  Battleship:  [[18,12,4,14,10],[20,14,4,16,12],[22,16,4,18,14],[24,18,4,20,16],[26,20,4,22,18],[30,24,4,26,22]],
  Frigate:     [[14,8,8,12,8],[16,9,9,14,9],[18,10,10,16,10],[20,11,10,18,11],[22,12,11,20,12],[26,14,12,24,14]],
  FishingBoat: [[2,4,10,2,4],[2,5,11,2,5],[3,5,12,3,5],[3,6,12,3,6],[4,6,13,4,6],[4,7,14,4,7]],
  TransportShip:[[4,10,6,3,8],[4,12,6,3,10],[5,14,6,4,12],[5,16,6,4,14],[6,18,6,5,16],[8,22,6,6,20]],
};

export const RANGED_UNITS_SET  = new Set(['Archer','Vanguard','Scout','Siege','Acolyte','Healer','Battleship','Frigate']);
export const HYBRID_UNITS_SET  = new Set(['Beast','BeastRider','Elemental']);

// Bump whenever the saved-world schema changes
export const STORAGE_KEY = 'seWorld_v4';

// ── Unit recruit prices per color index (0=Lvl1 … 5=Lvl6) ──────────────
export const UNIT_RECRUIT_PRICES = {
  Soldier:      [150, 180, 200, 250, 250, 250],
  Archer:       [100, 120, 140, 160, 180, 200],
  Vanguard:     [120, 150, 180, 220, 260, 300],
  Sapper:       [150, 180, 200, 230, 260, 300],
  Healer:       [180, 200, 230, 260, 290, 320],
  Scout:        [100, 120, 140, 165, 190, 220],
  Siege:        [450, 480, 500, 530, 560, 600],
  Ram:          [380, 400, 430, 460, 490, 520],
  Beast:        [1600, 1700, 1800, 1900, 2000, 2100],
  BeastRider:   [1300, 1400, 1500, 1600, 1700, 1800],
  Elemental:    [2000, 2100, 2200, 2300],
  Acolyte:      [250, 280, 310, 350, 390, 430],
  Villager:     [80,  90,  100, 110, 120, 130],
  Battleship:   [900, 1000, 1100, 1200, 1300, 1400],
  Frigate:      [650,  750,  850,  950, 1050, 1150],
  FishingBoat:  [150,  170,  190,  210,  230,  250],
  TransportShip:[400,  450,  500,  550,  600,  650],
};

// ── Family House capacity cost per unit per color index ─────────────────
export const UNIT_CAPACITY_COST = {
  Soldier:      [2, 2, 2, 3, 3, 3],
  Archer:       [1, 1, 1, 2, 2, 2],
  Vanguard:     [1, 1, 2, 2, 2, 3],
  Sapper:       [1, 2, 2, 2, 3, 3],
  Healer:       [1, 1, 1, 2, 2, 3],
  Scout:        [1, 1, 1, 1, 2, 2],
  Siege:        [2, 3, 3, 4, 4, 5],
  Ram:          [2, 2, 3, 3, 4, 4],
  Beast:        [3, 3, 4, 4, 5, 6],
  BeastRider:   [2, 3, 3, 4, 4, 5],
  Elemental:    [3, 3, 4, 4],
  Acolyte:      [1, 1, 1, 2, 2, 2],
  Villager:     [1, 1, 1, 1, 2, 2],
  Battleship:   [3, 3, 4, 4, 5, 5],
  Frigate:      [2, 2, 3, 3, 4, 4],
  FishingBoat:  [1, 1, 1, 2, 2, 2],
  TransportShip:[2, 2, 2, 3, 3, 3],
};

// ── Unit category restrictions ───────────────────────────────────────────
export const LOCKED_UNITS        = new Set(['Elemental']);            // only via special events
export const VILLAGER_ONLY_UNITS = new Set(['Villager']);             // recruited from Villagers Hut
export const MINE_ONLY_UNITS     = new Set(['FishingBoat', 'TransportShip']); // from Abandoned Mine
export const NAVAL_RECRUIT_UNITS = new Set(['Battleship', 'Frigate']); // require water on map
