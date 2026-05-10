import { STORAGE_KEY, WATER_UNITS, FLYING_UNITS, isWaterTileCoord } from './constants.js';

/**
 * Pure data layer — placed objects and units.
 *
 * objects[row][col] = { tx, ty } | null
 * units[row][col]   = { type, color, homeCol, homeRow, moveCooldown } | null
 */
export class World {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this._objects = Array.from({ length: h }, () => Array(w).fill(null));
    this._units   = Array.from({ length: h }, () => Array(w).fill(null));
  }

  get objects() { return this._objects; }
  get units()   { return this._units;   }

  // ── Queries ───────────────────────────────────────────────────────────
  inBounds(col, row) {
    return col >= 0 && row >= 0 && col < this.w && row < this.h;
  }

  hasUnit(col, row) {
    return this.inBounds(col, row) && !!this._units[row][col];
  }

  hasObject(col, row) {
    return this.inBounds(col, row) && !!this._objects[row][col];
  }

  getUnit(col, row) {
    return this.inBounds(col, row) ? this._units[row][col] : null;
  }

  getObject(col, row) {
    return this.inBounds(col, row) ? this._objects[row][col] : null;
  }

  /**
   * Find a unit by visual (render) position.
   * Units in mid-animation are stored at their destination cell but render at
   * a different position, so we must search by renderX/renderY as a fallback.
   * Returns { unit, col, row } of the logical cell, or null.
   */
  findUnitNear(col, row) {
    const u = this.getUnit(col, row);
    if (u) return { unit: u, col, row };
    for (let r = 0; r < this.h; r++) {
      for (let c = 0; c < this.w; c++) {
        const u = this._units[r][c];
        if (!u) continue;
        const rx = u.renderX ?? c;
        const ry = u.renderY ?? r;
        if (Math.abs(rx - col) < 0.6 && Math.abs(ry - row) < 0.6) {
          return { unit: u, col: c, row: r };
        }
      }
    }
    return null;
  }

  isWaterCell(col, row) {
    const obj = this.getObject(col, row);
    return obj ? isWaterTileCoord(obj.ty) : false;
  }

  // ── Mutations ─────────────────────────────────────────────────────────
  placeObject(col, row, tile) {
    if (!this.inBounds(col, row)) return;
    this._objects[row][col] = { tx: tile.tx, ty: tile.ty };
    this._save();
  }

  /** Place a new user-spawned unit with its home at (col,row). */
  placeUnit(col, row, type, color) {
    if (!this.inBounds(col, row)) return;
    this._units[row][col] = {
      type, color,
      homeCol: col, homeRow: row,
      moveCooldown: 60 + Math.floor(Math.random() * 60),
      // Visual interpolation state (not saved)
      renderX: col, renderY: row,
      fromX: col,   fromY: row,
      toX: col,     toY: row,
      moveProgress: 1,
    };
    this._save();
  }

  /** Place an existing unit object (resets home + snaps visual to new position). */
  placeUnitData(col, row, unitData) {
    if (!this.inBounds(col, row)) return;
    this._units[row][col] = {
      ...unitData,
      homeCol: col,
      homeRow: row,
      moveCooldown: unitData.moveCooldown ?? 60,
      // Snap visual position to new grid position
      renderX: col, renderY: row,
      fromX: col,   fromY: row,
      toX: col,     toY: row,
      moveProgress: 1,
    };
    this._save();
  }

  /** Removes top layer: unit first, then object. */
  removeAt(col, row) {
    if (!this.inBounds(col, row)) return;
    if (this._units[row][col])   { this._units[row][col]   = null; this._save(); return; }
    if (this._objects[row][col]) { this._objects[row][col] = null; this._save(); }
  }

  removeUnitAt(col, row) {
    if (!this.inBounds(col, row) || !this._units[row][col]) return;
    this._units[row][col] = null;
    this._save();
  }

  removeObjectAt(col, row) {
    if (!this.inBounds(col, row) || !this._objects[row][col]) return;
    this._objects[row][col] = null;
    this._save();
  }

  // ── Unit movement (called every frame outside edit mode) ──────────────
  tickUnits() {
    // Snapshot so we don't process units twice in one tick
    const snap = [];
    for (let r = 0; r < this.h; r++) {
      for (let c = 0; c < this.w; c++) {
        if (this._units[r][c]) snap.push({ c, r });
      }
    }

    for (const { c, r } of snap) {
      const unit = this._units[r][c];
      if (!unit) continue; // already displaced by an earlier move this tick

      if (unit.moveCooldown === undefined) unit.moveCooldown = 60;
      unit.moveCooldown--;
      if (unit.moveCooldown > 0) continue;
      unit.moveCooldown = 90 + Math.floor(Math.random() * 90); // ~1.5-3 s at 60 fps

      const isFlying    = FLYING_UNITS.has(unit.type);
      const isWaterUnit = WATER_UNITS.has(unit.type);
      const hc = unit.homeCol ?? c;
      const hr = unit.homeRow ?? r;

      // Try each of the 4 cardinal directions in random order
      const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
      for (let i = 3; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
      }

      for (const [dc, dr] of dirs) {
        const nc = c + dc, nr = r + dr;
        if (!this.inBounds(nc, nr)) continue;
        if (this._units[nr][nc])    continue;                    // occupied by another unit
        if (Math.abs(nc - hc) > 2 || Math.abs(nr - hr) > 2) continue; // too far from home

        const cellIsWater = this.isWaterCell(nc, nr);
        const cellHasObj  = this.hasObject(nc, nr);

        if (isFlying) {
          // Dragons fly over water AND objects — no terrain restriction
        } else if (isWaterUnit) {
          if (!cellIsWater) continue;                            // ships stay on water
        } else {
          if (cellIsWater || cellHasObj) continue;              // land units avoid water & buildings
        }

        // Kick off smooth movement — grid updates immediately, visual glides over ~20 frames
        unit.fromX = unit.renderX ?? c;
        unit.fromY = unit.renderY ?? r;
        unit.toX   = nc;
        unit.toY   = nr;
        unit.moveProgress = 0;

        this._units[nr][nc] = unit;
        this._units[r][c]   = null;
        break;
      }
    }
    // No _save() — movement is transient runtime state
  }

  /**
   * Advances the visual interpolation for all moving units.
   * Call every frame (even in edit mode so in-flight animations finish).
   */
  tickRender() {
    for (let r = 0; r < this.h; r++) {
      for (let c = 0; c < this.w; c++) {
        const u = this._units[r][c];
        if (!u) continue;

        // Initialise render coords for legacy units loaded from save
        if (u.renderX === undefined) { u.renderX = c; u.renderY = r; }
        if (u.moveProgress === undefined) u.moveProgress = 1;

        if (u.moveProgress >= 1) continue; // already at destination

        // Advance: 20 frames per tile = ~333 ms at 60 fps
        u.moveProgress = Math.min(1, u.moveProgress + 1 / 20);

        // Quadratic ease-in-out for a natural walking feel
        const t  = u.moveProgress;
        const et = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

        u.renderX = u.fromX + (u.toX - u.fromX) * et;
        u.renderY = u.fromY + (u.toY - u.fromY) * et;
      }
    }
  }

  // ── Persistence ───────────────────────────────────────────────────────
  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        v: 4, w: this.w, h: this.h,
        objects: this._objects,
        units:   this._units,
      }));
    } catch (_) {}
  }

  static load(w, h) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return new World(w, h);
      const d = JSON.parse(raw);
      if (d.v !== 4 || d.w !== w || d.h !== h) return new World(w, h);
      const world = new World(w, h);
      world._objects = d.objects;
      world._units   = d.units;
      return world;
    } catch (_) {
      return new World(w, h);
    }
  }

  clear() {
    this._objects = Array.from({ length: this.h }, () => Array(this.w).fill(null));
    this._units   = Array.from({ length: this.h }, () => Array(this.w).fill(null));
    this._save();
  }
}
