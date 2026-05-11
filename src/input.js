/**
 * input.js — all mouse / keyboard handlers.
 *
 * Edit-mode interaction model:
 *   • Single click on empty cell   → place selected tile
 *   • Double-click on placed item  → remove it
 *   • Drag > 8 px on existing item → drag-and-drop (off-map = delete)
 *   • Drag > 8 px on empty area    → pan camera
 *   • Right-click                  → remove top item
 *   • Escape during drag           → cancel, restore item
 *
 * Play mode: left-drag pans immediately.
 * Unit movement: handled by World.tickUnits(), called from main loop (not here).
 */

import { WATER_UNITS, FLYING_UNITS, BLDG_TOP_BOT_PAIRS, BLDG_BOT_KEYS, isWaterTileCoord } from './constants.js';

const DRAG_THRESHOLD  = 8;   // pixels
const DBLCLICK_MS     = 350; // max ms between clicks to count as double-click

export function setupInput({ canvas, camera, world, editPanel, getEditMode, onPick, onClear, beforePlace, afterPlace, onRemoved }) {
  // Townhall tiles are permanent — never removable
  const _isTownhall = (tx, ty) => tx === 16 && (ty === 61 || ty === 62);
  const state = {
    hoverScreen: null,   // { x, y } current mouse position (screen)
    dragUnit:    null,   // full unit object while dragging a unit
    dragObject:  null,   // { tx, ty } while dragging a placed object
  };

  // Mousedown tracking (click-vs-drag detection)
  let mdActive   = false;
  let mdX = 0, mdY = 0;
  let mdCol = 0, mdRow = 0;
  let hasDragged = false;

  // Panning
  let panning   = false;
  let panStartX = 0, panStartY = 0;
  let camStartX = 0, camStartY = 0;

  // Drag-drop origin
  let _fromCol = -1, _fromRow = -1;

  // Double-click detection
  let lastClickTime = 0;
  let lastClickCol  = -1, lastClickRow = -1;

  // ── Helpers ───────────────────────────────────────────────────────────

  function _cell(cx, cy) { return camera.screenToTile(cx, cy); }

  function _isValidUnitPlacement(type, col, row) {
    if (world.hasUnit(col, row))   return false;        // cell already has a unit

    if (FLYING_UNITS.has(type))   return true;          // dragons fly over everything

    const isWaterUnit = WATER_UNITS.has(type);
    const cellIsWater = world.isWaterCell(col, row);
    const cellHasObj  = world.hasObject(col, row);

    if (isWaterUnit)  return cellIsWater;               // ships need water
    if (cellIsWater)  return false;                     // land units can't enter water
    if (cellHasObj)   return false;                     // land units blocked by objects
    return true;
  }

  function _placeSelected(clientX, clientY) {
    const { col, row } = _cell(clientX, clientY);
    const sel = editPanel.selected;
    if (!sel) return;

    // Inventory quantity gate
    if (beforePlace && !beforePlace(sel)) return;

    if (sel.kind === 'object') {
      // Block placement if target cell (or bottom cell of 2-tile) is already occupied
      if (world.hasObject(col, row)) return;
      if (sel.bot && world.hasObject(col, row + 1)) return;
      world.placeObject(col, row, { tx: sel.tx, ty: sel.ty });
      if (sel.bot) world.placeObject(col, row + 1, sel.bot);
      if (afterPlace) afterPlace(sel);
    } else if (sel.kind === 'unit') {
      if (_isValidUnitPlacement(sel.type, col, row)) {
        world.placeUnit(col, row, sel.type, sel.color);
        if (afterPlace) afterPlace(sel);
      }
    }
  }

  // Before placing at (col,row): remove whatever is there plus its paired partner.
  function _clearForPlacement(col, row) {
    const existing = world.getObject(col, row);
    if (!existing) return;
    const key = `${existing.tx},${existing.ty}`;
    if (BLDG_TOP_BOT_PAIRS.has(key))   world.removeObjectAt(col, row + 1); // clear orphaned Bot
    else if (BLDG_BOT_KEYS.has(key))   world.removeObjectAt(col, row - 1); // clear orphaned Top
    world.removeObjectAt(col, row);
  }

  // Removes an object/unit and its paired partner; Townhall is indestructible.
  // Fires onRemoved so the inventory can reclaim the item.
  function _removeWithPair(col, row) {
    let removed = null;

    const o = world.getObject(col, row);
    if (o) {
      if (_isTownhall(o.tx, o.ty)) return; // Townhall: permanent
      const key = `${o.tx},${o.ty}`;
      removed = { type: 'object', tx: o.tx, ty: o.ty };

      if (BLDG_TOP_BOT_PAIRS.has(key)) {
        removed.bot = BLDG_TOP_BOT_PAIRS.get(key);
        world.removeObjectAt(col, row + 1);
      } else if (BLDG_BOT_KEYS.has(key)) {
        // Clicked the bot half — use the top tile as canonical reference
        const topO = world.getObject(col, row - 1);
        if (!topO || _isTownhall(topO.tx, topO.ty)) return;
        removed = { type: 'object', tx: topO.tx, ty: topO.ty, bot: { tx: o.tx, ty: o.ty } };
        world.removeObjectAt(col, row - 1);
      }
    } else {
      const u = world.findUnitNear(col, row);
      if (u) removed = { type: 'unit', unitType: u.unit.type, color: u.unit.color };
    }

    world.removeAt(col, row);
    if (removed && onRemoved) onRemoved(removed);
  }

  function _tryStartDrag(col, row) {
    // Unit drag: works in both edit AND play mode.
    // Use findUnitNear so clicking a mid-animation unit (stored at destination
    // cell but visually between cells) still picks it up correctly.
    const uResult = world.findUnitNear(col, row);
    if (uResult) {
      world.removeUnitAt(uResult.col, uResult.row);
      state.dragUnit = { ...uResult.unit };
      _fromCol = uResult.col; _fromRow = uResult.row;
      canvas.style.cursor = 'grabbing';
      return true;
    }
    // Object drag: edit AND play mode — water tiles locked in play mode, Townhall never dragged
    const o = world.getObject(col, row);
    if (o) {
      if (_isTownhall(o.tx, o.ty)) return false;
      if (!getEditMode() && isWaterTileCoord(o.ty)) return false;
      const key = `${o.tx},${o.ty}`;
      // If this is the bottom half of a 2-tile building, pick up from the top tile
      if (BLDG_BOT_KEYS.has(key)) {
        const topO = world.getObject(col, row - 1);
        if (topO) {
          world.removeObjectAt(col, row - 1);
          world.removeObjectAt(col, row);
          state.dragObject = { tx: topO.tx, ty: topO.ty, bot: { tx: o.tx, ty: o.ty } };
          _fromCol = col; _fromRow = row - 1;
          canvas.style.cursor = 'grabbing';
          return true;
        }
      }
      // Top tile or single tile
      const pairBot = BLDG_TOP_BOT_PAIRS.get(key);
      world.removeObjectAt(col, row);
      if (pairBot) world.removeObjectAt(col, row + 1);
      state.dragObject = pairBot ? { tx: o.tx, ty: o.ty, bot: pairBot } : { tx: o.tx, ty: o.ty };
      _fromCol = col; _fromRow = row;
      canvas.style.cursor = 'grabbing';
      return true;
    }
    return false;
  }

  function _startPan(fromX, fromY) {
    panning   = true;
    panStartX = fromX; panStartY = fromY;
    canvas.style.cursor = 'grabbing';
  }

  function _dropDrag(clientX, clientY) {
    const { col, row } = _cell(clientX, clientY);
    const inMap = world.inBounds(col, row);

    if (state.dragUnit) {
      const u = state.dragUnit;
      if (inMap && _isValidUnitPlacement(u.type, col, row)) {
        world.placeUnitData(col, row, u);
      } else if (inMap) {
        world.placeUnitData(_fromCol, _fromRow, u); // restore
      } else {
        // Off-map → return to inventory instead of deleting
        if (onRemoved) onRemoved({ type: 'unit', unitType: u.type, color: u.color });
      }
      state.dragUnit = null;
    }

    if (state.dragObject) {
      const dobj     = state.dragObject;
      const occupied = world.hasObject(col, row) ||
        (dobj.bot && world.hasObject(col, row + 1));
      if (inMap && !occupied) {
        world.placeObject(col, row, dobj);
        if (dobj.bot) world.placeObject(col, row + 1, dobj.bot);
      } else if (inMap) {
        // Target occupied — restore to original position
        world.placeObject(_fromCol, _fromRow, dobj);
        if (dobj.bot) world.placeObject(_fromCol, _fromRow + 1, dobj.bot);
      } else {
        // Off-map: Townhall snaps back; everything else returns to inventory
        if (_isTownhall(dobj.tx, dobj.ty)) {
          world.placeObject(_fromCol, _fromRow, dobj);
          if (dobj.bot) world.placeObject(_fromCol, _fromRow + 1, dobj.bot);
        } else {
          if (onRemoved) onRemoved({ type: 'object', tx: dobj.tx, ty: dobj.ty, bot: dobj.bot || null });
        }
      }
      state.dragObject = null;
    }

    _fromCol = _fromRow = -1;
  }

  function _cancelDrag() {
    if (state.dragUnit)   world.placeUnitData(_fromCol, _fromRow, state.dragUnit);
    if (state.dragObject) {
      world.placeObject(_fromCol, _fromRow, state.dragObject);
      if (state.dragObject.bot) world.placeObject(_fromCol, _fromRow + 1, state.dragObject.bot);
    }
    state.dragUnit = state.dragObject = null;

    _fromCol = _fromRow = -1;
  }

  function _cursorHint(cx, cy) {
    if (state.dragUnit || state.dragObject || panning) return 'grabbing';
    const { col, row } = _cell(cx, cy);
    if (!getEditMode()) {
      // Play mode: grab cursor on draggable units, grab on empty (hints at panning)
      return world.hasUnit(col, row) ? 'grab' : 'grab';
    }
    return (world.hasUnit(col, row) || world.hasObject(col, row)) ? 'grab' : 'crosshair';
  }

  // ── Canvas events ─────────────────────────────────────────────────────

  canvas.addEventListener('mousedown', e => {
    e.preventDefault();

    // Right-click: remove in edit mode
    if (e.button === 2) {
      if (getEditMode()) {
        const { col, row } = _cell(e.clientX, e.clientY);
        _removeWithPair(col, row);
      }
      return;
    }

    if (e.button !== 0) return;

    // Alt+left or middle: immediate pan
    if (e.altKey || e.button === 1) {
      camStartX = camera.x; camStartY = camera.y;
      _startPan(e.clientX, e.clientY);
      return;
    }

    // Both play and edit mode: record mousedown and wait for threshold.
    // Drag on a unit → drag-drop; drag on empty → pan; clean click → place (edit only).
    const { col, row } = _cell(e.clientX, e.clientY);
    mdX = e.clientX; mdY = e.clientY;
    mdCol = col; mdRow = row;
    camStartX = camera.x; camStartY = camera.y;
    mdActive  = true;
    hasDragged = false;

    // Show entity panel immediately on click.
    // Use findUnitNear so mid-animation units (visual pos ≠ logical pos) are found.
    const puResult = world.findUnitNear(col, row);
    const pu = puResult?.unit ?? null;
    const po = !pu && world.getObject(col, row);
    if (pu)       onPick?.('unit',   pu, puResult.col, puResult.row);
    else if (po)  onPick?.('object', po, col, row);
    else          onClear?.();
  });

  canvas.addEventListener('mousemove', e => {
    state.hoverScreen = { x: e.clientX, y: e.clientY };

    if (panning) {
      camera.x = camStartX - (e.clientX - panStartX);
      camera.y = camStartY - (e.clientY - panStartY);
      camera.clamp(canvas.width, canvas.height);
      return;
    }

    if (state.dragUnit || state.dragObject) {
      canvas.style.cursor = 'grabbing';
      return;
    }

    if (mdActive && !hasDragged) {
      const dx = e.clientX - mdX, dy = e.clientY - mdY;
      if (dx * dx + dy * dy > DRAG_THRESHOLD * DRAG_THRESHOLD) {
        hasDragged = true;
        if (!_tryStartDrag(mdCol, mdRow)) {
          _startPan(mdX, mdY);
        }
      }
    }

    canvas.style.cursor = _cursorHint(e.clientX, e.clientY);
  });

  canvas.addEventListener('mouseleave', () => {
    if (!state.dragUnit && !state.dragObject) state.hoverScreen = null;
    panning = false;
  });

  canvas.addEventListener('contextmenu', e => e.preventDefault());

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    camera.x += e.deltaX;
    camera.y += e.deltaY;
    camera.clamp(canvas.width, canvas.height);
  }, { passive: false });

  // ── Window: mouseup (catches release anywhere inc. outside canvas) ────
  window.addEventListener('mouseup', e => {
    if (e.button !== 0) return;

    if (state.dragUnit || state.dragObject) {
      _dropDrag(e.clientX, e.clientY);
    } else if (mdActive && !hasDragged && getEditMode()) {
      const { col, row } = _cell(mdX, mdY);
      const now = Date.now();

      if (now - lastClickTime < DBLCLICK_MS && col === lastClickCol && row === lastClickRow) {
        // Double-click → remove top item at that cell (plus paired partner if 2-tile building)
        _removeWithPair(col, row);
        lastClickTime = 0; // reset so triple-click doesn't also remove
      } else {
        // Single click → place selected tile
        _placeSelected(mdX, mdY);
        lastClickTime = now;
        lastClickCol  = col;
        lastClickRow  = row;
      }
    }

    mdActive   = false;
    hasDragged = false;
    panning    = false;
    canvas.style.cursor = getEditMode() ? 'crosshair' : 'grab';
  });

  // Keep ghost alive while dragging outside canvas
  window.addEventListener('mousemove', e => {
    if (state.dragUnit || state.dragObject) {
      state.hoverScreen = { x: e.clientX, y: e.clientY };
    }
  });

  // ── Keyboard ──────────────────────────────────────────────────────────
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (state.dragUnit || state.dragObject) {
        _cancelDrag();
        canvas.style.cursor = getEditMode() ? 'crosshair' : 'grab';
        return;
      }
      document.getElementById('btn-edit')?.click();
    }
  });

  return state;
}
