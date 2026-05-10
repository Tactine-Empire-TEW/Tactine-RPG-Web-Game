import { TILE_SRC, TILE_DST, CHAR_SRC, GRASS_TILE } from './constants.js';
import { getSheet, getChar } from './assets.js';

/**
 * Owns the <canvas> and draws every frame.
 * Reads state from Camera/World — NEVER writes to them.
 */
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this._tick  = 0;
  }

  resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.ctx.imageSmoothingEnabled = false;
  }

  renderFrame({ biome, camera, world, ghost, upgradeEffects }) {
    this._tick++;
    const ctx = this.ctx;
    const cw  = this.canvas.width;
    const ch  = this.canvas.height;
    ctx.imageSmoothingEnabled = false;

    ctx.fillStyle = '#0c0804';
    ctx.fillRect(0, 0, cw, ch);

    this._drawTerrain(biome, camera, cw, ch);
    this._drawObjects(biome, world, camera, cw, ch);
    this._drawUnits(world, camera, cw, ch);

    if (ghost) this._drawGhost(ghost, biome, camera);
    if (upgradeEffects?.length) this._drawUpgradeEffects(upgradeEffects, camera);
  }

  _drawUpgradeEffects(effects, camera) {
    const ctx = this.ctx;
    const T   = TILE_DST;

    for (const fx of effects) {
      const p  = fx.t / 45;           // 0 → 1 over 45 frames (~750 ms)
      if (p >= 1) continue;
      const ease = 1 - p;             // linear fade

      const x  = camera.ox + fx.col * T;
      const y  = camera.oy + fx.row * T;
      const cx = x + T / 2;
      const cy = y + T / 2;

      ctx.save();

      // ── Bright golden tile flash (whole tile, first half) ──────────────
      if (p < 0.5) {
        ctx.globalAlpha = (0.5 - p) / 0.5 * 0.82;
        ctx.fillStyle   = '#ffe060';
        ctx.fillRect(x, y, T, T);
      }

      // ── Ring: starts at T/3 radius, expands to 1.6×T ──────────────────
      const ringR = T * 0.33 + p * T * 1.27;
      ctx.globalAlpha = ease * 0.95;
      ctx.strokeStyle = '#f5c020';
      ctx.lineWidth   = Math.max(1.5, 5 * ease);
      ctx.beginPath();
      ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
      ctx.stroke();

      // ── 8 sparkle particles ────────────────────────────────────────────
      const dist  = T * 0.4 + p * T * 1.1;
      const pSize = Math.max(1, 5 * ease);
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        ctx.globalAlpha = ease * (i % 2 === 0 ? 1 : 0.65);
        ctx.fillStyle   = i % 2 === 0 ? '#ffdd00' : '#ffffff';
        ctx.beginPath();
        ctx.arc(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist,
                pSize, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  _drawTerrain(biome, camera, cw, ch) {
    const sheet = getSheet(biome);
    if (!sheet) return;
    const ctx = this.ctx;
    const { ox, oy } = camera;
    const { c0, r0, c1, r1 } = camera.visibleRange(cw, ch);
    const T = TILE_DST;

    for (let r = r0; r < r1; r++) {
      for (let c = c0; c < c1; c++) {
        ctx.drawImage(
          sheet,
          GRASS_TILE.tx * TILE_SRC, GRASS_TILE.ty * TILE_SRC, TILE_SRC, TILE_SRC,
          ox + c * T, oy + r * T, T, T
        );
      }
    }
  }

  _drawObjects(biome, world, camera, cw, ch) {
    const sheet = getSheet(biome);
    if (!sheet) return;
    const ctx  = this.ctx;
    const objs = world.objects;
    const { ox, oy } = camera;
    const { c0, r0, c1, r1 } = camera.visibleRange(cw, ch);
    const T = TILE_DST;

    for (let r = r0; r < r1; r++) {
      if (!objs[r]) continue;
      for (let c = c0; c < c1; c++) {
        const obj = objs[r][c];
        if (!obj) continue;

        const sx  = ox + c * T;
        const sy  = oy + r * T;
        const bob = Math.sin(this._tick * 0.04 + c * 0.31 + r * 0.47) * 1.8;

        ctx.drawImage(
          sheet,
          obj.tx * TILE_SRC, obj.ty * TILE_SRC, TILE_SRC, TILE_SRC,
          sx, sy + bob, T, T
        );
      }
    }
  }

  _drawUnits(world, camera, cw, ch) {
    const ctx   = this.ctx;
    const unitL = world.units;
    const { ox, oy } = camera;
    const { c0, r0, c1, r1 } = camera.visibleRange(cw, ch);
    const T      = TILE_DST;
    const frameX = (Math.floor(this._tick / 12) % 4) * CHAR_SRC;

    for (let r = r0; r < r1; r++) {
      if (!unitL[r]) continue;
      for (let c = c0; c < c1; c++) {
        const u = unitL[r][c];
        if (!u) continue;
        const img = getChar(u.type, u.color);
        if (!img) continue;

        // Use smooth interpolated position; fall back to grid position for legacy units
        const rx = u.renderX ?? c;
        const ry = u.renderY ?? r;
        ctx.drawImage(img, frameX, 0, CHAR_SRC, CHAR_SRC, ox + rx * T, oy + ry * T, T, T);
      }
    }
  }

  _drawGhost(ghost, biome, camera) {
    const ctx = this.ctx;
    const T   = TILE_DST;
    const sx  = camera.ox + ghost.col * T;
    const sy  = camera.oy + ghost.row * T;

    // Drag ghosts are more opaque (0.85) so the unit stays clearly visible;
    // panel-selection ghosts are lighter (0.55) to indicate "not yet placed".
    const alpha = ghost.dragging ? 0.85 : 0.55;

    if (ghost.kind === 'object') {
      const sheet = getSheet(biome);
      if (sheet) {
        ctx.globalAlpha = alpha;
        ctx.drawImage(sheet, ghost.tx * TILE_SRC, ghost.ty * TILE_SRC, TILE_SRC, TILE_SRC, sx, sy, T, T);
        if (ghost.bot) {
          ctx.drawImage(sheet, ghost.bot.tx * TILE_SRC, ghost.bot.ty * TILE_SRC,
                        TILE_SRC, TILE_SRC, sx, sy + T, T, T);
        }
        ctx.globalAlpha = 1;
      }
    } else if (ghost.kind === 'unit') {
      const img = getChar(ghost.type, ghost.color);
      if (img) {
        ctx.globalAlpha = alpha;
        ctx.drawImage(img, 0, 0, CHAR_SRC, CHAR_SRC, sx, sy, T, T);
        ctx.globalAlpha = 1;
      }
    }

    // Gold border = valid; red border = invalid — spans both rows for 2-tile buildings
    const ghostRows = ghost.bot ? 2 : 1;
    ctx.strokeStyle = ghost.invalid ? 'rgba(255, 60, 60, 0.90)' : 'rgba(255, 210, 0, 0.85)';
    ctx.lineWidth   = ghost.dragging ? 2.5 : 2;
    ctx.strokeRect(sx + 1, sy + 1, T - 2, T * ghostRows - 2);
  }
}
