import { TILE_DST } from './constants.js';

/**
 * Camera tracks the top-left scroll offset (x, y) in world pixels.
 * Everything reads originX/Y for rendering and uses screenToTile for input.
 */
export class Camera {
  constructor(mapW, mapH) {
    this.mapW = mapW;
    this.mapH = mapH;
    this.x = 0;
    this.y = 0;
  }

  /** Centre on the middle of the map. */
  center(canvasW, canvasH) {
    this.x = Math.max(0, (this.mapW * TILE_DST - canvasW) / 2);
    this.y = Math.max(0, (this.mapH * TILE_DST - canvasH) / 2);
    this.clamp(canvasW, canvasH);
  }

  /** Keep camera inside the map bounds. */
  clamp(canvasW, canvasH) {
    const maxX = Math.max(0, this.mapW * TILE_DST - canvasW);
    const maxY = Math.max(0, this.mapH * TILE_DST - canvasH);
    this.x = Math.min(maxX, Math.max(0, this.x));
    this.y = Math.min(maxY, Math.max(0, this.y));
  }

  /** Screen X of world x=0. */
  get ox() { return -this.x; }
  /** Screen Y of world y=0. */
  get oy() { return -this.y; }

  /** Convert screen pixel position to tile grid coordinates. */
  screenToTile(sx, sy) {
    return {
      col: Math.floor((sx + this.x) / TILE_DST),
      row: Math.floor((sy + this.y) / TILE_DST),
    };
  }

  /** Culled tile range visible on screen (for render loops). */
  visibleRange(canvasW, canvasH) {
    return {
      c0: Math.max(0,        Math.floor(this.x / TILE_DST)),
      r0: Math.max(0,        Math.floor(this.y / TILE_DST)),
      c1: Math.min(this.mapW, Math.ceil((this.x + canvasW)  / TILE_DST)),
      r1: Math.min(this.mapH, Math.ceil((this.y + canvasH) / TILE_DST)),
    };
  }
}
