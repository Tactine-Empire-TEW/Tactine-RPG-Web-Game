/**
 * main.js — bootstraps the game.
 */

import { MAP_W, MAP_H, BIOME_LABELS, WATER_UNITS, FLYING_UNITS, getUnitDisplayName, getObjectDisplayName, getObjectLevel, UPGRADE_MAP, BLDG_TOP_BOT_PAIRS, BLDG_BOT_KEYS, TILE_DST } from './constants.js';
import { getSheet, loadSheet, preloadAllChars, getChar } from './assets.js';
import { Camera    } from './Camera.js';
import { World     } from './World.js';
import { Renderer  } from './Renderer.js';
import { EditPanel } from './EditPanel.js';
import { setupInput } from './input.js';

async function main() {
  const canvas   = document.getElementById('world');
  let   biome    = 'normal';
  let   editMode = false;
  // Sync the dropdown to the JS default — browsers persist <select> state across
  // reloads, so without this the dropdown shows the last-picked biome while the
  // actual loaded sheet is always 'normal'.
  const biomeSel = document.getElementById('biome-sel');
  biomeSel.value = biome;

  const tooltip   = document.getElementById('map-tooltip');
  const _epPanel   = document.getElementById('entity-panel');
  const _epCanvas  = document.getElementById('ep-canvas');
  const _epCtx     = _epCanvas.getContext('2d');
  _epCtx.imageSmoothingEnabled = false;
  const _epName    = document.getElementById('ep-name');
  const _epType    = document.getElementById('ep-type');
  const _epLevel   = document.getElementById('ep-level');
  const _epUpgrade = document.getElementById('ep-upgrade');

  // Track which world cell is currently shown in the panel (for upgrades)
  let _selCol = -1, _selRow = -1;

  // Active upgrade burst animations: [{ col, row, t }]
  const upgradeEffects = [];

  function _showEntityPanel(kind, data, col, row) {
    _epCtx.fillStyle = kind === 'unit' ? '#0a1020' : '#080400';
    _epCtx.fillRect(0, 0, 96, 96);

    if (kind === 'unit') {
      const img = getChar(data.type, data.color);
      if (img) _epCtx.drawImage(img, 0, 0, 16, 16, 0, 0, 96, 96);
      _epName.textContent  = getUnitDisplayName(data.type, data.color);
      _epType.textContent  = data.type;
      _epLevel.textContent = '';
      _epUpgrade.style.display = 'none';
      _selCol = col ?? -1; _selRow = row ?? -1;
    } else {
      // If bot tile was clicked, redirect to the top tile
      let topTx = data.tx, topTy = data.ty, topCol = col ?? -1, topRow = row ?? -1;
      if (BLDG_BOT_KEYS.has(`${data.tx},${data.ty}`)) {
        const topObj = world.getObject(col, (row ?? 0) - 1);
        if (topObj) { topTx = topObj.tx; topTy = topObj.ty; topRow = (row ?? 0) - 1; }
      }
      _selCol = topCol; _selRow = topRow;

      const sh = getSheet(biome);
      if (sh) _epCtx.drawImage(sh, topTx * 16, topTy * 16, 16, 16, 0, 0, 96, 96);
      _epName.textContent  = getObjectDisplayName(topTx, topTy).replace(' Top', '');
      _epType.textContent  = 'Object';

      const lvl = getObjectLevel(topTx, topTy);
      _epLevel.textContent = lvl ? `Level ${lvl}` : '';

      const canUpgrade = UPGRADE_MAP.has(`${topTx},${topTy}`);
      _epUpgrade.style.display = canUpgrade ? 'block' : 'none';
    }

    _epPanel.classList.add('visible');
  }

  function _hideEntityPanel() {
    _epPanel.classList.remove('visible');
    _selCol = _selRow = -1;
  }

  function _spawnUpgradeBurst(col, row) {
    const sx = camera.ox + col * TILE_DST;
    const sy = camera.oy + row * TILE_DST;
    const el = document.createElement('div');
    el.className = 'upgrade-burst';
    el.style.left = `${sx}px`;
    el.style.top  = `${sy}px`;
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }

  _epUpgrade.addEventListener('click', () => {
    if (_selCol < 0 || _selRow < 0) return;
    const cur = world.getObject(_selCol, _selRow);
    if (!cur) return;
    const next = UPGRADE_MAP.get(`${cur.tx},${cur.ty}`);
    if (!next) return;

    // Remove old tile(s)
    const oldBot = BLDG_TOP_BOT_PAIRS.get(`${cur.tx},${cur.ty}`);
    world.removeObjectAt(_selCol, _selRow);
    if (oldBot) world.removeObjectAt(_selCol, _selRow + 1);

    // Place new tile(s)
    world.placeObject(_selCol, _selRow, next);
    const newBot = BLDG_TOP_BOT_PAIRS.get(`${next.tx},${next.ty}`);
    if (newBot) world.placeObject(_selCol, _selRow + 1, newBot);

    // Spawn upgrade burst on all affected cells (canvas + CSS overlay)
    upgradeEffects.push({ col: _selCol, row: _selRow, t: 0 });
    if (newBot) upgradeEffects.push({ col: _selCol, row: _selRow + 1, t: 0 });
    _spawnUpgradeBurst(_selCol, _selRow);
    if (newBot) _spawnUpgradeBurst(_selCol, _selRow + 1);

    // Refresh panel with new tile
    _showEntityPanel('object', next, _selCol, _selRow);
  });

  const camera   = new Camera(MAP_W, MAP_H);
  const world    = World.load(MAP_W, MAP_H);
  const renderer = new Renderer(canvas);
  const panel    = new EditPanel();

  renderer.resize();
  window.addEventListener('resize', () => {
    renderer.resize();
    camera.clamp(canvas.width, canvas.height);
  });
  camera.center(canvas.width, canvas.height);

  // Load initial tilesheet
  try {
    await loadSheet(biome);
  } catch (e) {
    _showError();
    return;
  }

  // Rebuild the strip now that the tilesheet is loaded (panel was built before the async load)
  panel.refresh();

  preloadAllChars();

  // Input
  const inputState = setupInput({
    canvas, camera, world, editPanel: panel,
    getEditMode: () => editMode,
    onPick:  (kind, data, col, row) => _showEntityPanel(kind, data, col, row),
    onClear: ()           => _hideEntityPanel(),
  });

  // UI wiring
  document.getElementById('btn-edit').addEventListener('click', _toggleEdit);
  document.getElementById('btn-done').addEventListener('click', _toggleEdit);

  const loadingOverlay = document.getElementById('loading-overlay');
  biomeSel.addEventListener('change', async () => {
    biome = biomeSel.value;
    document.getElementById('biome-label').textContent = BIOME_LABELS[biome] ?? biome;
    loadingOverlay.classList.add('visible');
    try {
      await loadSheet(biome);
    } finally {
      loadingOverlay.classList.remove('visible');
    }
    panel.refresh();
  });

  function _toggleEdit() {
    editMode = !editMode;
    panel[editMode ? 'open' : 'close']();
    document.getElementById('sel-preview').style.display     = editMode ? 'flex' : 'none';
    document.getElementById('bottom-actions').style.display  = editMode ? 'none' : 'flex';
    canvas.style.cursor = editMode ? 'crosshair' : 'grab';
    document.getElementById('btn-edit').style.display = editMode ? 'none' : '';
    document.getElementById('btn-done').style.display = editMode ? '' : 'none';
  }

  // Game loop
  function loop() {
    requestAnimationFrame(loop);

    // Advance unit AI only in play mode; animation always ticks so glides finish
    if (!editMode) world.tickUnits();
    world.tickRender();

    // Build ghost — drag ghost shows in BOTH play and edit mode; panel ghost edit-only
    let ghost = null;
    if (inputState.hoverScreen) {
      const { col, row } = camera.screenToTile(
        inputState.hoverScreen.x,
        inputState.hoverScreen.y
      );

      const _unitGhostInvalid = (type) => {
        if (world.hasUnit(col, row)) return true;
        if (FLYING_UNITS.has(type))  return false;  // dragons always valid (terrain-wise)
        const isWater = world.isWaterCell(col, row);
        const hasObj  = world.hasObject(col, row);
        if (WATER_UNITS.has(type))   return !isWater;
        return isWater || hasObj;                    // land units invalid on water/objects
      };

      if (inputState.dragUnit) {
        ghost = {
          kind: 'unit', ...inputState.dragUnit, col, row, dragging: true,
          invalid: _unitGhostInvalid(inputState.dragUnit.type),
        };
      } else if (inputState.dragObject) {
        ghost = { kind: 'object', ...inputState.dragObject, col, row, dragging: true };
      } else if (editMode) {
        const candidate = panel.ghostAt(col, row);
        if (candidate) {
          ghost = candidate.kind === 'unit'
            ? { ...candidate, invalid: _unitGhostInvalid(candidate.type) }
            : candidate;
        }
      }
    }

    // Tick upgrade burst effects; remove finished ones
    for (let i = upgradeEffects.length - 1; i >= 0; i--) {
      upgradeEffects[i].t++;
      if (upgradeEffects[i].t > 45) upgradeEffects.splice(i, 1);
    }

    try {
      renderer.renderFrame({ biome, camera, world, ghost, upgradeEffects });
    } catch (err) {
      console.warn('[render]', err);
    }

    // ── Map tooltip: show unit/object name under cursor ───────────────
    const hs = inputState.hoverScreen;
    const dragging = inputState.dragUnit || inputState.dragObject;
    if (hs && !dragging) {
      const { col, row } = camera.screenToTile(hs.x, hs.y);
      const unit = world.getUnit(col, row);
      const obj  = !unit && world.getObject(col, row);
      const label = unit ? getUnitDisplayName(unit.type, unit.color)
                  : obj  ? getObjectDisplayName(obj.tx, obj.ty)
                  : null;
      if (label) {
        tooltip.textContent = label;
        tooltip.style.display = 'block';
        tooltip.style.left = Math.min(hs.x + 14, window.innerWidth  - 180) + 'px';
        tooltip.style.top  = Math.max(hs.y - 34, 4)                         + 'px';
      } else {
        tooltip.style.display = 'none';
      }
    } else {
      tooltip.style.display = 'none';
    }
  }

  loop();
}

function _showError() {
  document.body.innerHTML = `
    <div style="margin:80px auto;max-width:480px;font-family:sans-serif;
                color:#f0c840;background:#0a0500;padding:32px;
                border-radius:8px;border:1px solid #6a4010">
      <div style="font-size:22px;margin-bottom:12px">⚔ Tectine Empire</div>
      <p style="color:#a07820;margin-bottom:16px">Assets couldn't load. Start a local server:</p>
      <pre style="background:#000;padding:12px;border-radius:4px;color:#3fb950;font-size:13px">
python3 -m http.server 8090</pre>
      <p style="color:#a07820;margin-top:12px">
        Then open <a href="http://localhost:8090" style="color:#58a6ff">http://localhost:8090</a>
      </p>
    </div>`;
}

main();
