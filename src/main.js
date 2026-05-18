/**
 * main.js — bootstraps the game.
 */

import { MAP_W, MAP_H, BIOME_LABELS, WATER_UNITS, FLYING_UNITS, getUnitDisplayName, getObjectDisplayName, getObjectLevel, getObjectCapacity, getObjectCapacityLabel, getObjectSpeedBonus, getObjectProductionBonus, UPGRADE_MAP, BLDG_TOP_BOT_PAIRS, BLDG_BOT_KEYS, TILE_DST, TILE_SRC, isWaterTileCoord, isWallLvl1Tile, CHAR_TYPES, CHAR_COLORS, CHAR_COLORS_BY_TYPE, CHAR_TYPE_LABELS, UNIT_RECRUIT_PRICES, UNIT_CAPACITY_COST, LOCKED_UNITS, VILLAGER_ONLY_UNITS, MINE_ONLY_UNITS, NAVAL_RECRUIT_UNITS, UNIT_STATS, RANGED_UNITS_SET, HYBRID_UNITS_SET } from './constants.js';
import { getSheet, loadSheet, preloadAllChars, preloadAllCharMoves, getChar, loadChar } from './assets.js';
import { Camera    } from './Camera.js';
import { World     } from './World.js';
import { Renderer  } from './Renderer.js';
import { EditPanel } from './EditPanel.js';
import { setupInput } from './input.js?v=5';
import { setupRuflux, addRuflux, getRuflux } from './ruflux.js';
import { setupStore, UNIT_PRICES, openQtyModal, setTutStoreFilter, setOnItemReady, WALL_PRICE } from './store.js';

async function main() {
  const canvas   = document.getElementById('world');
  let   biome    = 'normal';
  let   editMode = false;

  // Inventory quantity hooks — implemented by _setupInventory below
  let _invCanPlace  = (_sel)     => true;
  let _invOnPlaced  = (_sel)     => {};
  let _invOnRemoved = (_removed) => {};
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
  const _epName     = document.getElementById('ep-name');
  const _epType     = document.getElementById('ep-type');
  const _epLevel    = document.getElementById('ep-level');
  const _epCapacity  = document.getElementById('ep-capacity');
  const _epCapValue  = document.getElementById('ep-cap-value');
  const _epSpeed      = document.getElementById('ep-speed');
  const _epSpeedValue = document.getElementById('ep-speed-value');
  const _epProduction = document.getElementById('ep-production');
  const _epProdValue  = document.getElementById('ep-prod-value');
  const _epUpgrade    = document.getElementById('ep-upgrade');

  const _epRecruit      = document.getElementById('ep-recruit');
  const _epResidents    = document.getElementById('ep-residents');
  const _epResList      = document.getElementById('ep-residents-list');
  const _epSellUnit     = document.getElementById('ep-sell-unit');
  const _epAssignFarmer = document.getElementById('ep-assign-farmer');
  const _epFieldWorkers = document.getElementById('ep-field-workers');
  const _epFWList       = document.getElementById('ep-field-workers-list');
  let   _openRecruitFn  = () => {};
  let   _recruitMode    = 'family';
  let   _selUnitRef    = null; // direct reference to the selected unit object
  _epRecruit.addEventListener('click', () => {
    _openRecruitFn(_selCol, _selRow, _recruitMode);
    _tutAdvance(_recruitMode === 'villager' ? 'recruit-opened-villager' : 'recruit-opened-family');
  });

  _epSellUnit.addEventListener('click', () => {
    if (!_selUnitRef) return;
    // Find by object reference — unit may have wandered since it was clicked
    let found = false;
    for (let r = 0; r < MAP_H && !found; r++) {
      for (let c = 0; c < MAP_W && !found; c++) {
        if (world.getUnit(c, r) === _selUnitRef) {
          world.removeUnitAt(c, r);
          found = true;
        }
      }
    }
    if (!found) { _hideEntityPanel(); return; }
    const u = _selUnitRef;
    const colors = CHAR_COLORS_BY_TYPE[u.type] ?? CHAR_COLORS;
    const ci = Math.max(0, colors.indexOf(u.color));
    const sellPrice = Math.floor(((UNIT_RECRUIT_PRICES[u.type] ?? [])[ci] ?? 200) * 0.70);
    addRuflux(sellPrice);
    _hideEntityPanel();
  });

  // Tutorial map pointer target — updated per tutorial step, read in game loop
  let _tutMapTarget = null;
  // Tutorial spotlight target — { type:'tile', col, row, rows } or { type:'dom', id, pad }
  let _tutSpotlight = null;
  // Tutorial unit filter — when set, only this unit card is enabled in the recruit panel
  let _tutAllowedUnit = null; // { type, colorIdx }
  // Tutorial advance hook — set by _setupTutorial, called from hooks throughout main.js
  let _tutAdvance = (_trigger) => false;
  // Fields Land glow overlays — kept as no-ops, removed per UX feedback
  const _fieldGlows = [];
  // Wheat harvest particles — [{ el, fieldCol, fieldRow, startTime, dur, jitter }]
  const _wheatParticles = [];

  // Windmill production system
  const _windmillBars = []; // { col, row, wrapEl, fillEl } — canvas overlays
  const _foodParticles = []; // { el, col, row, startTime, dur, jitter }
  const WINDMILL_BASE_RATE = 100 / 90; // % per second per matching-level field at lvl1
  const FOOD_KEY = 'tew_empire_food';
  function _getFood() { try { return parseInt(localStorage.getItem(FOOD_KEY) ?? '0', 10) || 0; } catch { return 0; } }
  function _addFood(n) {
    const v = _getFood() + n;
    try { localStorage.setItem(FOOD_KEY, String(v)); } catch {}
    const el = document.getElementById('food-count');
    if (el) el.textContent = v.toLocaleString();
  }
  function _updateFoodDisplay() {
    const el = document.getElementById('food-count');
    if (el) el.textContent = _getFood().toLocaleString();
  }
  // Cached Food.png image — 128×128, 8×8 grid of 16×16 pixel-art sprites
  const _foodImg = new Image();
  _foodImg.src = 'Assets/Food.png';


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
      _epType.textContent  = CHAR_TYPE_LABELS[data.type] ?? data.type;
      _epLevel.textContent = '';
      _epUpgrade.style.display   = 'none';
      _epCapacity.style.display  = 'none';
      _epSpeed.style.display     = 'none';
      _epProduction.style.display= 'none';
      _epRecruit.style.display   = 'none';
      _epResidents.style.display = 'none';
      _selCol = col ?? -1; _selRow = row ?? -1;
      _selUnitRef = data; // keep direct reference so sell works even after unit wanders

      // Sell button with price
      const colors = CHAR_COLORS_BY_TYPE[data.type] ?? CHAR_COLORS;
      const ci = Math.max(0, colors.indexOf(data.color));
      const sellPrice = Math.floor(((UNIT_RECRUIT_PRICES[data.type] ?? [])[ci] ?? 200) * 0.70);
      _epSellUnit.textContent = `💰 Sell — ${sellPrice} RF`;
      _epSellUnit.style.display = 'block';
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

      const cap = getObjectCapacity(topTx, topTy);
      _epCapacity.style.display = cap !== null ? 'flex' : 'none';
      if (cap !== null) {
        const label    = getObjectCapacityLabel(topTx, topTy);
        const bldgName = getObjectDisplayName(topTx, topTy).replace(' Top', '');
        const filter   = bldgName === 'Villagers Hut' ? _villagerFilter
                       : bldgName === 'Family House'  ? _familyFilter
                       : null;
        const used = bldgName === 'Windmill'
          ? _countWindmillFields(topCol, topRow)
          : filter ? _countCapUsedNear(topCol, topRow, filter) : 0;
        _epCapValue.textContent = `${used}/${cap} ${label} capacity`;
      }

      const speed = getObjectSpeedBonus(topTx, topTy);
      _epSpeed.style.display = speed !== null ? 'flex' : 'none';
      if (speed !== null) _epSpeedValue.textContent = `Work Speed +${speed}%`;

      const prod = getObjectProductionBonus(topTx, topTy);
      _epProduction.style.display = prod !== null ? 'flex' : 'none';
      if (prod !== null) _epProdValue.textContent = `Production +${prod}%`;

      const canUpgrade = UPGRADE_MAP.has(`${topTx},${topTy}`);
      _epUpgrade.style.display = canUpgrade ? 'block' : 'none';

      const objName = getObjectDisplayName(topTx, topTy).replace(' Top', '');
      const isFamHouse     = objName === 'Family House';
      const isVillagersHut = objName === 'Villagers Hut';
      const isFieldsLand   = objName === 'Fields Land';
      const showRecruit    = isFamHouse || isVillagersHut;
      _epSellUnit.style.display     = 'none';
      _epRecruit.style.display      = showRecruit ? 'block' : 'none';
      _epResidents.style.display    = showRecruit ? 'block' : 'none';
      _epAssignFarmer.style.display = isFieldsLand ? 'block' : 'none';
      _epFieldWorkers.style.display = isFieldsLand ? 'block' : 'none';
      if (showRecruit) {
        _recruitMode = isVillagersHut ? 'villager' : 'family';
        _epRecruit.textContent = isVillagersHut ? '👷 Recruit Villager' : '⚔ Recruit Units';
        _buildResidentsList(topCol, topRow, _recruitMode);
      }
      if (isFieldsLand) {
        _buildFieldWorkersList(topCol, topRow);
        _epAssignFarmer.onclick = () => _openAssignPopup(topCol, topRow);
        _tutAdvance('fields-land-panel-opened');
      }

      const isWindmill = objName === 'Windmill';
      const epWindmillSection = document.getElementById('ep-windmill-section');
      const epAssignField     = document.getElementById('ep-assign-field');
      epWindmillSection.style.display = isWindmill ? 'block' : 'none';
      if (isWindmill) {
        const obj = world.getObject(topCol, topRow);
        if (!obj.assignedFields) obj.assignedFields = [];
        _buildWindmillFieldsList(topCol, topRow);
        epAssignField.onclick = () => _openWindmillAssignPopup(topCol, topRow);
        _tutAdvance('windmill-panel-opened');
      }

      if (objName === 'Townhall') _tutAdvance('townhall-opened');
      if (isFamHouse)             _tutAdvance('family-house-opened');
      if (isVillagersHut)         _tutAdvance('villager-hut-opened');
    }

    _epPanel.classList.add('visible');
  }

  function _hideEntityPanel() {
    _epPanel.classList.remove('visible');
    _epRecruit.style.display      = 'none';
    _epResidents.style.display    = 'none';
    _epSellUnit.style.display     = 'none';
    _epAssignFarmer.style.display = 'none';
    _epFieldWorkers.style.display = 'none';
    document.getElementById('ep-windmill-section').style.display = 'none';
    _selCol = _selRow = -1;
    _selUnitRef = null;
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

  // Belt-and-suspenders: ensure Townhall exists in the live world object
  // (handles browser cache bypasses and any edge cases from World._ensureTownhall)
  (function _placeTownhallIfMissing() {
    const objs = world.objects;
    for (let r = 0; r < MAP_H; r++) {
      for (let c = 0; c < MAP_W; c++) {
        const o = objs[r][c];
        if (o && o.tx === 16 && o.ty === 61) return; // already on map
      }
    }
    const cx = Math.floor(MAP_W / 2);
    const cy = Math.floor(MAP_H / 2) - 1;
    if (!world.hasObject(cx, cy) && !world.hasObject(cx, cy + 1)) {
      world.placeObject(cx, cy,     { tx: 16, ty: 61 });
      world.placeObject(cx, cy + 1, { tx: 16, ty: 62 });
    }
  })();

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
  preloadAllCharMoves();

  // Input
  const inputState = setupInput({
    canvas, camera, world, editPanel: panel,
    getEditMode: () => editMode,
    onPick:   (kind, data, col, row) => _showEntityPanel(kind, data, col, row),
    onClear:  () => _hideEntityPanel(),
    beforePlace: sel     => {
      if (sel?.kind === 'object' && isWallLvl1Tile(sel.tx, sel.ty)) {
        if (getRuflux() < WALL_PRICE) return false;
        addRuflux(-WALL_PRICE);
        return true;
      }
      return _invCanPlace(sel);
    },
    afterPlace:  sel     => {
      _invOnPlaced(sel);
      if (sel.kind === 'object') {
        const n = getObjectDisplayName(sel.tx, sel.ty).replace(' Top', '');
        const tutTriggered = (n === 'Gold Mine' && _tutAdvance('gold-mine-placed')) ||
                             (n === 'Fields Land' && _tutAdvance('fields-land-placed')) ||
                             (n === 'Windmill' && _tutAdvance('windmill-placed'));
        // For direct-from-store placement: exit edit mode after one placement
        // (walls and water tiles stay in edit mode for continuous painting)
        if (sel.isUnlimited && !isWallLvl1Tile(sel.tx, sel.ty) && !isWaterTileCoord(sel.ty)) {
          panel.selected = null;
          editMode = false;
          canvas.style.cursor = 'grab';
        }
      }
    },
    onRemoved:     removed => _invOnRemoved(removed),
    onObjectMoved: (oldCol, oldRow, newCol, newRow) => {
      // Keep _selCol/_selRow in sync so the entity panel stays live after a drag
      if (_selCol === oldCol && _selRow === oldRow) {
        _selCol = newCol;
        _selRow = newRow;
      }
    },
  });

  // UI wiring
  setupRuflux(); // async — market data loads in background, non-blocking
  setupStore();
  setOnItemReady((entry) => {
    // Immediately kill pointer-events on all side panels so they don't intercept
    // canvas clicks during their CSS slide-out animation
    const closePanel = (id) => {
      const el = document.getElementById(id);
      if (el) { el.classList.remove('open'); el.style.pointerEvents = 'none'; }
    };
    closePanel('store-panel');
    closePanel('store-overlay');
    closePanel('inv-panel');
    closePanel('inv-overlay');
    closePanel('recruit-panel');
    closePanel('recruit-overlay');

    // Arm item for placement
    const sel = entry.bot
      ? { kind: 'object', tx: entry.tx, ty: entry.ty, bot: entry.bot, isUnlimited: true }
      : { kind: 'object', tx: entry.tx, ty: entry.ty, isUnlimited: true };
    panel.selected = sel;
    editMode = true;
    canvas.style.cursor = 'crosshair';

    // Restore pointer-events after slide-out completes
    setTimeout(() => {
      ['store-panel','inv-panel','recruit-panel'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.removeProperty('pointer-events');
      });
    }, 400);
  });
  document.getElementById('btn-store').addEventListener('click', () => _tutAdvance('store-opened'));
  window.addEventListener('tew:purchased', e => {
    const name = e.detail?.name ?? '';
    if (name === 'Gold Mine')   _tutAdvance('gold-mine-purchased');
    if (name === 'Fields Land') _tutAdvance('fields-land-purchased');
    if (name === 'Windmill')    _tutAdvance('windmill-purchased');
  });
  _openRecruitFn = _setupRecruit();
  _setupTutorial();
  _setupInventory();

  document.getElementById('windmill-assign-close').addEventListener('click', _closeWindmillAssignPopup);
  document.getElementById('windmill-assign-overlay').addEventListener('click', _closeWindmillAssignPopup);
  _updateFoodDisplay();

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

  // ── Inventory panel (replaces edit panel for placement) ──────────────
  function _setupInventory() {
    const PURCHASE_KEY = 'tew_store_purchases';
    const CARD = 64;
    const invPanel   = document.getElementById('inv-panel');
    const invOverlay = document.getElementById('inv-overlay');
    const invGrid    = document.getElementById('inv-grid');
    let   invCat     = 'water';
    let   _selWrap   = null; // currently highlighted card

    function _getPurchases() {
      try { return JSON.parse(localStorage.getItem(PURCHASE_KEY) ?? '[]'); }
      catch { return []; }
    }
    function _aggregate(kind) {
      const map = new Map();
      for (const p of _getPurchases().filter(p => p.kind === kind)) {
        if (map.has(p.name)) map.get(p.name).qty++;
        else map.set(p.name, { ...p, qty: 1 });
      }
      return [...map.values()];
    }

    function _openInv() {
      document.getElementById('store-panel').classList.remove('open');
      document.getElementById('store-overlay').classList.remove('open');
      invPanel.classList.add('open');
      // No overlay — map must stay fully interactive for placement
      editMode = true;
      panel.close(); // keep old strip hidden
      canvas.style.cursor = 'crosshair';
      document.getElementById('sel-preview').style.display = 'flex';
      _buildGrid();
    }

    function _closeInv() {
      invPanel.classList.remove('open');
      // Exit edit mode
      editMode = false;
      canvas.style.cursor = 'grab';
      document.getElementById('sel-preview').style.display = 'none';
      panel.selected = null;
      _selWrap = null;
    }

    function _buildGrid() {
      invGrid.innerHTML = '';
      _selWrap = null;

      const countEl = document.getElementById('inv-item-count');
      if (countEl) countEl.textContent = _getPurchases().length;

      if (invCat === 'water') { _buildWaterGrid(); return; }

      const kindMap = { buildings: 'building', walls: 'wall', units: 'unit' };
      // Only show items that still have quantity available; exclude water terrain tiles from non-water tabs
      const items = _aggregate(kindMap[invCat]).filter(item => {
        if (item.ty !== undefined && isWaterTileCoord(item.ty)) return false;
        const testSel = item.kind === 'unit'
          ? { kind: 'unit', type: item.type, color: item.color }
          : { kind: 'object', tx: item.tx, ty: item.ty };
        return _available(testSel) > 0;
      });

      if (!items.length) {
        invGrid.innerHTML = `
          <div class="inv-empty">
            <div class="inv-empty-icon">📦</div>
            <div class="inv-empty-title">Nothing here yet</div>
            <div class="inv-empty-sub">Visit the <b style="color:#3a8a3a">Store</b><br>to purchase items for your empire.</div>
          </div>`;
        return;
      }
      const sheet = getSheet(biome);
      for (const item of items) _addCard(item, sheet, false);
    }

    function _buildWaterGrid() {
      const sheet = getSheet(biome);
      // Water section: rows 8–12, up to 42 columns
      for (let ty = 8; ty <= 12; ty++) {
        for (let tx = 0; tx < 42; tx++) {
          if (!sheet) break;
          // Quick check: does this tile have any content?
          try {
            const tmp = document.createElement('canvas');
            tmp.width = TILE_SRC; tmp.height = TILE_SRC;
            const tctx = tmp.getContext('2d');
            tctx.drawImage(sheet, tx * TILE_SRC, ty * TILE_SRC, TILE_SRC, TILE_SRC, 0, 0, TILE_SRC, TILE_SRC);
            const data = tctx.getImageData(0, 0, TILE_SRC, TILE_SRC).data;
            let hasPixel = false;
            for (let i = 3; i < data.length; i += 4) { if (data[i] > 30) { hasPixel = true; break; } }
            if (!hasPixel) continue;
          } catch (_) {}

          const item = { kind: 'water', tx, ty, name: `Water ${ty}-${tx}`, isUnlimited: true };
          _addCard(item, sheet, true);
        }
      }
    }

    function _addCard(item, sheet, isUnlimited) {
      const isUnit = item.kind === 'unit';
      const hasBot = !!item.bot;
      const h      = hasBot ? CARD * 2 : CARD;

      const cvs = document.createElement('canvas');
      cvs.width = CARD; cvs.height = h;
      const ctx = cvs.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#0e1a26';
      ctx.fillRect(0, 0, CARD, h);

      if (isUnit) {
        const img = getChar(item.type, item.color);
        if (img) ctx.drawImage(img, 0, 0, 16, 16, 0, 0, CARD, CARD);
        else loadChar(item.type, item.color).then(() => {
          ctx.fillStyle = '#1a1208'; ctx.fillRect(0, 0, CARD, h);
          const img2 = getChar(item.type, item.color);
          if (img2) ctx.drawImage(img2, 0, 0, 16, 16, 0, 0, CARD, CARD);
        });
      } else if (sheet) {
        ctx.drawImage(sheet, item.tx * TILE_SRC, item.ty * TILE_SRC, TILE_SRC, TILE_SRC, 0, 0, CARD, CARD);
        if (hasBot) ctx.drawImage(sheet, item.bot.tx * TILE_SRC, item.bot.ty * TILE_SRC, TILE_SRC, TILE_SRC, 0, CARD, CARD, CARD);
      }

      const wrap = document.createElement('div');
      wrap.className = 'store-card inv-item-card';
      wrap.title = item.name;

      if (!isUnlimited) {
        const badge = document.createElement('div');
        badge.className = 'inv-qty-badge';
        // compute real available = owned - placed, not just purchased qty
        const testSel = item.kind === 'unit'
          ? { kind: 'unit', type: item.type, color: item.color }
          : { kind: 'object', tx: item.tx, ty: item.ty };
        const avail = _available(testSel);
        badge.textContent = `×${avail}`;
        if (avail === 0) {
          badge.style.background   = 'linear-gradient(135deg,#5a1010,#2a0808)';
          badge.style.borderColor  = '#9a2020';
          badge.style.color        = '#ff6060';
        }
        wrap.appendChild(badge);
      } else {
        const badge = document.createElement('div');
        badge.className = 'inv-qty-badge inv-qty-inf';
        badge.textContent = '∞';
        wrap.appendChild(badge);
      }

      wrap.appendChild(cvs);

      const nameEl = document.createElement('div');
      nameEl.className = 'store-card-name';
      nameEl.textContent = item.name;
      wrap.appendChild(nameEl);

      // Store sel descriptor on the DOM node so _invOnPlaced can find it
      wrap._invSel = item.kind === 'unit'
        ? { kind: 'unit', type: item.type, color: item.color, isUnlimited: !!item.isUnlimited }
        : { kind: 'object', tx: item.tx, ty: item.ty, isUnlimited: !!item.isUnlimited };

      if (!isUnlimited) {
        const sellPrice = Math.floor((item.price ?? 0) * 0.70);
        const sellBtn = document.createElement('button');
        sellBtn.className = 'inv-sell-btn';
        sellBtn.textContent = 'Sell';
        sellBtn.title = `Sell for ${sellPrice} RF (70% of original)`;
        sellBtn.addEventListener('click', e => {
          e.stopPropagation(); // don't trigger card selection
          _sellItem(item, sellBtn);
        });
        wrap.appendChild(sellBtn);
      }

      wrap.addEventListener('click', () => _selectItem(item, wrap));
      invGrid.appendChild(wrap);
    }

    // ── Sell item ─────────────────────────────────────────────────────
    function _sellItem(item, btn) {
      const testSel = item.kind === 'unit'
        ? { kind: 'unit', type: item.type, color: item.color }
        : { kind: 'object', tx: item.tx, ty: item.ty };

      if (_available(testSel) === 0) {
        const origText = btn.textContent;
        btn.textContent = 'Placed!';
        btn.classList.add('inv-sell-btn-blocked');
        setTimeout(() => {
          btn.textContent = origText;
          btn.classList.remove('inv-sell-btn-blocked');
        }, 1200);
        return;
      }

      const sellPrice = Math.floor((item.price ?? 0) * 0.70);

      // Remove ONE matching purchase entry
      const purchases = _getPurchases();
      let removed = false;
      const newPurchases = purchases.filter(p => {
        if (removed) return true;
        if (item.kind === 'unit') {
          if (p.kind === 'unit' && p.type === item.type && p.color === item.color) {
            removed = true; return false;
          }
        } else {
          if ((p.kind === 'building' || p.kind === 'wall') && p.tx === item.tx && p.ty === item.ty) {
            removed = true; return false;
          }
        }
        return true;
      });

      if (!removed) return;

      localStorage.setItem(PURCHASE_KEY, JSON.stringify(newPurchases));
      addRuflux(sellPrice);
      _buildGrid();
    }

    // ── Quantity helpers ──────────────────────────────────────────────
    function _countOwned(sel) {
      if (sel.isUnlimited) return Infinity;
      const p = _getPurchases();
      if (sel.kind === 'unit') {
        return p.filter(x => x.kind === 'unit' && x.type === sel.type && x.color === sel.color).length;
      }
      // object (building / wall) — match top tile tx,ty
      return p.filter(x => (x.kind === 'building' || x.kind === 'wall') && x.tx === sel.tx && x.ty === sel.ty).length;
    }

    function _countPlaced(sel) {
      let n = 0;
      if (sel.kind === 'unit') {
        for (let r = 0; r < MAP_H; r++)
          for (let c = 0; c < MAP_W; c++) {
            const u = world.units[r][c];
            if (u && u.type === sel.type && u.color === sel.color) n++;
          }
      } else {
        for (let r = 0; r < MAP_H; r++)
          for (let c = 0; c < MAP_W; c++) {
            const o = world.objects[r][c];
            if (o && o.tx === sel.tx && o.ty === sel.ty) n++;
          }
      }
      return n;
    }

    function _available(sel) {
      if (!sel || sel.isUnlimited) return Infinity;
      return Math.max(0, _countOwned(sel) - _countPlaced(sel));
    }

    function _updateSelBadge() {
      if (!_selWrap || !panel.selected) return;
      const avail = _available(panel.selected);
      const badge = _selWrap.querySelector('.inv-qty-badge');
      if (!badge || badge.classList.contains('inv-qty-inf')) return;
      badge.textContent = `×${avail}`;
      if (avail === 0) {
        badge.style.background = 'linear-gradient(135deg,#5a1010,#2a0808)';
        badge.style.borderColor = '#9a2020';
        badge.style.color = '#ff6060';
      }
    }

    // Expose to the outer hooks
    _invCanPlace = (sel) => {
      if (!sel || sel.isUnlimited) return true;
      return _available(sel) > 0;
    };

    _invOnRemoved = (_removed) => {
      // available = owned(purchases) - placed(world).
      // Removing from the map auto-decreases placed, so available rises naturally.
      // No purchase entry manipulation needed — just refresh the badges.
      _invOnPlaced(null);
    };
    _invOnPlaced = (_sel) => {
      // Refresh every visible badge so all counts stay accurate
      invGrid.querySelectorAll('.store-card').forEach(card => {
        const badge = card.querySelector('.inv-qty-badge');
        if (!badge || badge.classList.contains('inv-qty-inf')) return;
        // Read back the stored sel data from the card
        const cardSel = card._invSel;
        if (!cardSel) return;
        const avail = _available(cardSel);
        badge.textContent = `×${avail}`;
        if (avail === 0) {
          badge.style.background  = 'linear-gradient(135deg,#5a1010,#2a0808)';
          badge.style.borderColor = '#9a2020';
          badge.style.color       = '#ff6060';
        } else {
          badge.style.background  = '';
          badge.style.borderColor = '';
          badge.style.color       = '';
        }
      });

      // Deselect if the active item is exhausted
      if (panel.selected && _available(panel.selected) === 0) {
        _selWrap?.classList.remove('inv-selected');
        _selWrap = null;
        panel.selected = null;
        const prevName = document.getElementById('prev-name');
        if (prevName) prevName.textContent = 'Out of stock';
      }
    };

    function _selectItem(item, wrap) {
      // Block selection if this item has 0 available
      const testSel = item.kind === 'unit'
        ? { kind: 'unit', type: item.type, color: item.color, isUnlimited: !!item.isUnlimited }
        : { kind: 'object', tx: item.tx, ty: item.ty, isUnlimited: !!item.isUnlimited };
      if (_available(testSel) === 0) return; // can't select exhausted item

      // Highlight
      if (_selWrap) _selWrap.classList.remove('inv-selected');
      _selWrap = wrap;
      wrap.classList.add('inv-selected');

      // Set edit panel selection
      if (item.kind === 'unit') {
        panel.selected = { kind: 'unit', type: item.type, color: item.color, isUnlimited: !!item.isUnlimited };
      } else {
        panel.selected = item.bot
          ? { kind: 'object', tx: item.tx, ty: item.ty, bot: item.bot, isUnlimited: !!item.isUnlimited }
          : { kind: 'object', tx: item.tx, ty: item.ty, isUnlimited: !!item.isUnlimited };
      }

      // Update sel-preview
      const prevCvs  = document.getElementById('prev-cvs');
      const prevCtx  = prevCvs?.getContext('2d');
      const prevName = document.getElementById('prev-name');
      if (prevCtx) {
        prevCtx.imageSmoothingEnabled = false;
        prevCtx.fillStyle = '#0a0500';
        prevCtx.fillRect(0, 0, prevCvs.width, prevCvs.height);
        const sh = getSheet(biome);
        if (item.kind !== 'unit' && sh) {
          prevCtx.drawImage(sh, item.tx * TILE_SRC, item.ty * TILE_SRC,
            TILE_SRC, TILE_SRC, 0, 0, prevCvs.width, prevCvs.height);
        }
      }
      if (prevName) prevName.textContent = item.name;
    }

    // Wire up
    document.getElementById('btn-inventory').addEventListener('click', _openInv);
    document.getElementById('inv-close').addEventListener('click', _closeInv);

    document.querySelectorAll('.inv-cat').forEach(b => {
      b.addEventListener('click', () => {
        invCat = b.dataset.cat;
        document.querySelectorAll('.inv-cat').forEach(x => x.classList.toggle('active', x === b));
        _buildGrid();
      });
    });
  }

  // ── Recruit helpers ───────────────────────────────────────────────────
  // Counts capacity used by units that were recruited FROM the building at (col, row).
  // Falls back to proximity radius for legacy units that predate houseCol/houseRow.
  function _countCapUsedNear(col, row, filterFn = null, radius = 4) {
    let total = 0;
    for (let r = 0; r < MAP_H; r++) {
      for (let c = 0; c < MAP_W; c++) {
        const u = world.getUnit(c, r);
        if (!u) continue;
        // Prefer exact house match; fall back to proximity for legacy units
        if (u.houseCol !== undefined) {
          if (u.houseCol !== col || u.houseRow !== row) continue;
        } else {
          if (Math.abs(c - col) > radius || Math.abs(r - row) > radius) continue;
        }
        if (filterFn && !filterFn(u)) continue;
        const colors = CHAR_COLORS_BY_TYPE[u.type] ?? CHAR_COLORS;
        const ci = Math.max(0, colors.indexOf(u.color));
        total += (UNIT_CAPACITY_COST[u.type] ?? [])[ci] ?? 1;
      }
    }
    return total;
  }

  // Filters: Family House counts warriors; Villagers Hut counts villagers only
  const _familyFilter   = u => !VILLAGER_ONLY_UNITS.has(u.type);
  const _villagerFilter = u =>  VILLAGER_ONLY_UNITS.has(u.type);

  function _findNearbyEmpty(col, row) {
    for (let radius = 1; radius <= 6; radius++) {
      for (let dc = -radius; dc <= radius; dc++) {
        for (let dr = -radius; dr <= radius; dr++) {
          if (Math.abs(dc) !== radius && Math.abs(dr) !== radius) continue; // perimeter only
          const nc = col + dc, nr = row + dr;
          if (!world.inBounds(nc, nr)) continue;
          if (world.hasUnit(nc, nr) || world.hasObject(nc, nr) || world.isWaterCell(nc, nr)) continue;
          return { col: nc, row: nr };
        }
      }
    }
    return null;
  }

  function _hasWaterOnMap() {
    for (let r = 0; r < MAP_H; r++)
      for (let c = 0; c < MAP_W; c++)
        if (world.isWaterCell(c, r)) return true;
    return false;
  }

  // ── Residents list for Family House entity panel ─────────────────────
  function _buildResidentsList(col, row, mode = 'family', radius = 4) {
    if (!_epResList) return;
    _epResList.innerHTML = '';
    let count = 0;
    const resFilter = mode === 'villager' ? _villagerFilter : _familyFilter;

    for (let r = 0; r < MAP_H; r++) {
      for (let c = 0; c < MAP_W; c++) {
        const u = world.getUnit(c, r);
        if (!u) continue;
        // Use houseCol/houseRow for exact match; fall back to proximity for legacy units
        if (u.houseCol !== undefined) {
          if (u.houseCol !== col || u.houseRow !== row) continue;
        } else {
          if (Math.abs(c - col) > radius || Math.abs(r - row) > radius) continue;
        }
        if (!resFilter(u)) continue;
        count++;

        const colors = CHAR_COLORS_BY_TYPE[u.type] ?? CHAR_COLORS;
        const ci = Math.max(0, colors.indexOf(u.color));
        const capCost   = (UNIT_CAPACITY_COST[u.type]    ?? [])[ci] ?? 1;
        const sellPrice = Math.floor(((UNIT_RECRUIT_PRICES[u.type] ?? [])[ci] ?? 200) * 0.70);
        const name      = getUnitDisplayName(u.type, u.color);

        const entry = document.createElement('div');
        entry.className = 'ep-res-entry';

        const info = document.createElement('div');
        info.className = 'ep-res-info';
        info.innerHTML = `<span class="ep-res-name">${name}</span><span class="ep-res-cap">👤${capCost}</span>`;

        const sellBtn = document.createElement('button');
        sellBtn.className = 'ep-res-sell-btn';
        sellBtn.textContent = `💰 ${sellPrice} RF`;
        sellBtn.title = `Sell for ${sellPrice} RF (70% of recruit price) — frees 👤${capCost} capacity`;

        // Store reference, not coords — units move between build-time and click-time
        const unitRef = u;
        sellBtn.addEventListener('click', () => {
          // Find by reference so a wandered unit is still found and removed correctly
          let found = false;
          for (let sr = 0; sr < MAP_H && !found; sr++) {
            for (let sc = 0; sc < MAP_W && !found; sc++) {
              if (world.getUnit(sc, sr) === unitRef) {
                world.removeUnitAt(sc, sr);
                found = true;
              }
            }
          }
          if (!found) { _buildResidentsList(col, row, mode); return; }

          addRuflux(sellPrice);
          _buildResidentsList(col, row, mode);
          _refreshEntityCapacity(col, row, mode);
          // Refresh recruit panel if it is already open for this house
          const rp = document.getElementById('recruit-panel');
          if (rp?.classList.contains('open')) _openRecruitFn(col, row, mode);
        });

        entry.appendChild(info);
        entry.appendChild(sellBtn);
        _epResList.appendChild(entry);
      }
    }

    if (count === 0) {
      _epResList.innerHTML = '<div class="ep-res-empty">No residents yet</div>';
    }
  }

  // ── Fields Land workers system ────────────────────────────────────────

  function _countFieldWorkers(col, row) {
    let n = 0;
    for (let r = 0; r < MAP_H; r++)
      for (let c = 0; c < MAP_W; c++) {
        const u = world.getUnit(c, r);
        if (u && u.fieldCol === col && u.fieldRow === row) n++;
      }
    return n;
  }

  function _buildFieldWorkersList(col, row) {
    if (!_epFWList) return;
    _epFWList.innerHTML = '';
    let count = 0;
    for (let r = 0; r < MAP_H; r++) {
      for (let c = 0; c < MAP_W; c++) {
        const u = world.getUnit(c, r);
        if (!u || u.fieldCol !== col || u.fieldRow !== row) continue;
        count++;
        const name = getUnitDisplayName(u.type, u.color);
        const entry = document.createElement('div');
        entry.className = 'ep-res-entry';
        entry.innerHTML = `<span class="ep-res-name">${name}</span><span class="ep-res-cap">🌾 Working</span>`;
        _epFWList.appendChild(entry);
      }
    }
    // Update capacity display
    const obj = world.getObject(col, row);
    if (obj && _epCapValue) {
      const cap = getObjectCapacity(obj.tx, obj.ty) ?? 0;
      _epCapValue.textContent = `${count}/${cap} farmers capacity`;
    }
    if (count === 0) {
      _epFWList.innerHTML = '<div class="ep-res-empty">No farmers assigned</div>';
    }
  }

  function _openAssignPopup(fieldCol, fieldRow) {
    const overlay = document.getElementById('assign-overlay');
    const popup   = document.getElementById('assign-popup');
    const list    = document.getElementById('assign-list');
    if (!overlay || !popup || !list) return;

    const obj = world.getObject(fieldCol, fieldRow);
    const maxWorkers = obj ? (getObjectCapacity(obj.tx, obj.ty) ?? 1) : 1;
    const currentWorkers = _countFieldWorkers(fieldCol, fieldRow);

    // Update popup subtitle
    const sub = popup.querySelector('.assign-popup-sub');
    if (sub) sub.textContent = `${currentWorkers}/${maxWorkers} farmers assigned`;

    list.innerHTML = '';
    let hasVillagers = false;

    for (let r = 0; r < MAP_H; r++) {
      for (let c = 0; c < MAP_W; c++) {
        const u = world.getUnit(c, r);
        if (!u || !VILLAGER_ONLY_UNITS.has(u.type)) continue;
        hasVillagers = true;

        const name       = getUnitDisplayName(u.type, u.color);
        const alreadyHere = u.fieldCol === fieldCol && u.fieldRow === fieldRow;
        const atCapacity  = currentWorkers >= maxWorkers && !alreadyHere;
        const assignedElsewhere = u.fieldCol !== undefined && !alreadyHere;

        const card = document.createElement('div');
        card.className = 'assign-card' + (alreadyHere ? ' assign-card-active' : '') + (atCapacity ? ' assign-card-dim' : '');

        // Portrait canvas inside a wrap (for the absolute-positioned badge)
        const portraitWrap = document.createElement('div');
        portraitWrap.className = 'assign-portrait-wrap';

        const cvs = document.createElement('canvas');
        cvs.className = 'assign-portrait';
        cvs.width = 76; cvs.height = 76;
        const ctx = cvs.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = alreadyHere ? '#101f08' : '#060d03';
        ctx.fillRect(0, 0, 76, 76);
        const img = getChar(u.type, u.color);
        if (img) ctx.drawImage(img, 0, 0, 16, 16, 6, 6, 64, 64);
        else loadChar(u.type, u.color).then(() => {
          const img2 = getChar(u.type, u.color);
          ctx.fillStyle = alreadyHere ? '#101f08' : '#060d03';
          ctx.fillRect(0, 0, 76, 76);
          if (img2) ctx.drawImage(img2, 0, 0, 16, 16, 6, 6, 64, 64);
        });

        // Status badge (inside wrap for absolute positioning)
        const badge = document.createElement('div');
        badge.className = 'assign-status-badge';
        if (alreadyHere)          { badge.textContent = '🌾 Working'; badge.classList.add('badge-working'); }
        else if (assignedElsewhere) { badge.textContent = '🔗 Busy';   badge.classList.add('badge-busy'); }
        else                        { badge.textContent = '✅ Free';    badge.classList.add('badge-free'); }

        const nameEl = document.createElement('div');
        nameEl.className = 'assign-card-name';
        nameEl.textContent = name;

        const btn = document.createElement('button');
        btn.className = 'assign-card-btn' + (alreadyHere ? ' assign-card-btn-remove' : '');
        if (atCapacity)  { btn.textContent = 'Field Full'; btn.disabled = true; }
        else if (alreadyHere) btn.textContent = '− Unassign';
        else             btn.textContent = '+ Assign';

        const unitRef = u;
        btn.addEventListener('click', () => {
          if (alreadyHere) {
            unitRef.fieldCol = undefined;
            unitRef.fieldRow = undefined;
            _removeFieldGlow(fieldCol, fieldRow);
          } else {
            unitRef.fieldCol = fieldCol;
            unitRef.fieldRow = fieldRow;
            const fp = _findNearbyEmpty(fieldCol, fieldRow);
            if (fp) { unitRef.homeCol = fp.col; unitRef.homeRow = fp.row; }
            _addFieldGlow(fieldCol, fieldRow);
            _tutAdvance('villager-assigned-to-field');
          }
          world._save?.();
          _closeAssignPopup();
          _buildFieldWorkersList(fieldCol, fieldRow);
          const newCount = _countFieldWorkers(fieldCol, fieldRow);
          if (_epCapValue) _epCapValue.textContent = `${newCount}/${maxWorkers} farmers capacity`;
        });

        portraitWrap.appendChild(cvs);
        portraitWrap.appendChild(badge);
        card.appendChild(portraitWrap);
        card.appendChild(nameEl);
        card.appendChild(btn);
        list.appendChild(card);
      }
    }

    if (!hasVillagers) {
      list.innerHTML = '<div class="assign-empty">🌾<br><b>No farmers yet</b><br>Recruit Tectine Farmers from your Villagers Hut first!</div>';
    }

    overlay.style.display = 'block';
    popup.style.display   = 'flex';
    document.getElementById('assign-close').onclick = _closeAssignPopup;
    overlay.onclick = _closeAssignPopup;
  }

  function _closeAssignPopup() {
    document.getElementById('assign-overlay').style.display = 'none';
    document.getElementById('assign-popup').style.display   = 'none';
  }

  function _addFieldGlow(_col, _row) {}   // glow removed per UX feedback
  function _removeFieldGlow(_col, _row) {}

  // ── Windmill production system ────────────────────────────────────────
  function _isWindmillObj(o) {
    return o && getObjectDisplayName(o.tx, o.ty).replace(' Top', '') === 'Windmill';
  }

  function _windmillCapacity(o) {
    return (getObjectLevel(o.tx, o.ty) ?? 1) * 2; // Lvl1=2, Lvl2=4
  }

  function _windmillOutput(o) {
    return 10 + ((getObjectLevel(o.tx, o.ty) ?? 1) - 1) * 5; // Lvl1=10, Lvl2=15, Lvl3=20
  }

  function _windmillFillRatePerSec(o) {
    const windLevel = getObjectLevel(o.tx, o.ty) ?? 1;
    const fields = o.assignedFields ?? [];
    let rate = 0;
    for (const {col: fc, row: fr} of fields) {
      const fo = world.getObject(fc, fr);
      if (!fo) continue;
      const fieldLevel = getObjectLevel(fo.tx, fo.ty) ?? 1;
      const matchRatio = Math.min(fieldLevel, windLevel) / windLevel;
      const contribution = matchRatio * 0.8 + 0.2; // min 20% even with mismatch
      rate += contribution * windLevel;
    }
    return rate * WINDMILL_BASE_RATE;
  }

  function _countWindmillFields(col, row) {
    return (world.getObject(col, row)?.assignedFields ?? []).length;
  }

  function _buildWindmillFieldsList(col, row) {
    const listEl = document.getElementById('ep-windmill-fields-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    const obj = world.getObject(col, row);
    const fields = obj?.assignedFields ?? [];
    if (!fields.length) {
      listEl.innerHTML = '<div style="font-size:10px;color:#6a4020;font-style:italic;padding:4px 0">No fields assigned</div>';
      return;
    }
    for (const {col: fc, row: fr} of fields) {
      const fo = world.getObject(fc, fr);
      const lvl = fo ? (getObjectLevel(fo.tx, fo.ty) ?? 1) : '?';
      const row2 = document.createElement('div');
      row2.className = 'ep-res-row';
      row2.innerHTML = `<span style="flex:1;font-size:10px;color:#c09040">🌾 Fields Land Lvl ${lvl} (${fc},${fr})</span>`;
      const unBtn = document.createElement('button');
      unBtn.className = 'ep-res-sell-btn';
      unBtn.textContent = 'Unassign';
      unBtn.style.cssText = 'font-size:9px;padding:2px 6px;background:rgba(100,30,0,.5);color:#e89050;border:1px solid rgba(200,90,20,.4);border-radius:4px;cursor:pointer';
      unBtn.onclick = () => {
        const o2 = world.getObject(col, row);
        if (o2?.assignedFields) {
          o2.assignedFields = o2.assignedFields.filter(f => !(f.col === fc && f.row === fr));
          world._save?.();
        }
        _buildWindmillFieldsList(col, row);
        const cap = _windmillCapacity(world.getObject(col, row));
        const used = _countWindmillFields(col, row);
        if (_epCapValue) _epCapValue.textContent = `${used}/${cap} fields capacity`;
      };
      row2.appendChild(unBtn);
      listEl.appendChild(row2);
    }
  }

  let _windmillAssignTarget = null; // { col, row }

  function _openWindmillAssignPopup(col, row) {
    _windmillAssignTarget = { col, row };
    const overlay = document.getElementById('windmill-assign-overlay');
    const popup   = document.getElementById('windmill-assign-popup');
    const listEl  = document.getElementById('windmill-assign-list');
    if (!overlay || !popup || !listEl) return;

    // Find all Fields Land on the map
    const allFields = [];
    for (let r = 0; r < world.h; r++) {
      for (let c = 0; c < world.w; c++) {
        const o = world.getObject(c, r);
        if (o && getObjectDisplayName(o.tx, o.ty).replace(' Top', '') === 'Fields Land') {
          allFields.push({ col: c, row: r, obj: o });
        }
      }
    }

    const windmillObj = world.getObject(col, row);
    const assigned = windmillObj?.assignedFields ?? [];
    const cap = _windmillCapacity(windmillObj);
    const atCapacity = assigned.length >= cap;

    listEl.innerHTML = '';
    if (!allFields.length) {
      listEl.innerHTML = '<div class="assign-empty">No Fields Land on the map.<br>Place one first.</div>';
    }
    for (const {col: fc, row: fr, obj: fo} of allFields) {
      const alreadyHere = assigned.some(f => f.col === fc && f.row === fr);
      // Check if assigned to another windmill
      let assignedElsewhere = false;
      for (let r = 0; r < world.h; r++) {
        for (let c = 0; c < world.w; c++) {
          if (c === col && r === row) continue;
          const wo = world.getObject(c, r);
          if (wo && _isWindmillObj(wo) && (wo.assignedFields ?? []).some(f => f.col === fc && f.row === fr)) {
            assignedElsewhere = true;
          }
        }
      }

      const fieldLevel = getObjectLevel(fo.tx, fo.ty) ?? 1;
      const card = document.createElement('div');
      card.className = 'assign-card' + (alreadyHere ? ' assign-card-active' : '') + (assignedElsewhere && !alreadyHere ? ' assign-card-dim' : '');

      // Canvas preview
      const cvs = document.createElement('canvas');
      cvs.width = 76; cvs.height = 76;
      cvs.className = 'assign-portrait';
      const ctx2 = cvs.getContext('2d');
      ctx2.imageSmoothingEnabled = false;
      ctx2.fillStyle = '#0a0400';
      ctx2.fillRect(0, 0, 76, 76);
      const sh = getSheet(biome);
      if (sh) ctx2.drawImage(sh, fo.tx * 16, fo.ty * 16, 16, 16, 0, 0, 76, 76);

      const portraitWrap = document.createElement('div');
      portraitWrap.className = 'assign-portrait-wrap';
      portraitWrap.appendChild(cvs);

      // Status badge
      const badge = document.createElement('span');
      badge.className = 'assign-status-badge ' + (alreadyHere ? 'badge-working' : assignedElsewhere ? 'badge-busy' : 'badge-free');
      badge.textContent = alreadyHere ? 'Assigned' : assignedElsewhere ? 'Busy' : 'Free';
      portraitWrap.appendChild(badge);

      const nameEl = document.createElement('div');
      nameEl.className = 'assign-card-name';
      nameEl.textContent = `Lvl ${fieldLevel} Field`;

      const btn = document.createElement('button');
      btn.className = 'assign-card-btn' + (alreadyHere ? ' assign-card-btn-remove' : '');
      if (atCapacity && !alreadyHere) { btn.textContent = 'Full'; btn.disabled = true; }
      else if (alreadyHere)           btn.textContent = '− Unassign';
      else                             btn.textContent = '+ Assign';

      btn.onclick = () => {
        const wo = world.getObject(col, row);
        if (!wo) return;
        if (!wo.assignedFields) wo.assignedFields = [];
        if (alreadyHere) {
          wo.assignedFields = wo.assignedFields.filter(f => !(f.col === fc && f.row === fr));
        } else {
          if (wo.assignedFields.length < cap) {
            wo.assignedFields.push({ col: fc, row: fr });
            _tutAdvance('field-assigned-to-windmill');
          }
        }
        world._save?.();
        _closeWindmillAssignPopup();
        _buildWindmillFieldsList(col, row);
        const newCap = _windmillCapacity(wo);
        const newUsed = _countWindmillFields(col, row);
        if (_epCapValue) _epCapValue.textContent = `${newUsed}/${newCap} fields capacity`;
      };

      card.appendChild(portraitWrap);
      card.appendChild(nameEl);
      card.appendChild(btn);
      listEl.appendChild(card);
    }

    overlay.style.display = 'block';
    popup.style.display   = 'flex';
  }

  function _closeWindmillAssignPopup() {
    document.getElementById('windmill-assign-overlay').style.display = 'none';
    document.getElementById('windmill-assign-popup').style.display   = 'none';
    _windmillAssignTarget = null;
  }

  function _ensureWindmillBar(col, row) {
    if (_windmillBars.some(b => b.col === col && b.row === row)) return;
    const wrap = document.createElement('div');
    wrap.className = 'windmill-bar-overlay';
    const fill = document.createElement('div');
    fill.className = 'windmill-bar-overlay-fill';
    wrap.appendChild(fill);
    document.body.appendChild(wrap);
    _windmillBars.push({ col, row, wrapEl: wrap, fillEl: fill });
  }

  function _removeWindmillBar(col, row) {
    const idx = _windmillBars.findIndex(b => b.col === col && b.row === row);
    if (idx === -1) return;
    _windmillBars[idx].wrapEl.remove();
    _windmillBars.splice(idx, 1);
  }

  function _spawnFoodParticle(col, row) {
    // Draw a random sprite from the 8×8 grid onto a canvas element
    const cvs = document.createElement('canvas');
    cvs.width = 28; cvs.height = 28;
    cvs.className = 'food-particle';
    cvs.style.left = '-9999px';
    const ctx = cvs.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    // Skip known grey/metallic sprites: (2,0), (6,0), (6,1)
    const _goodSprites = [
      [0,0],[1,0],[3,0],[4,0],[5,0],[7,0],
      [0,1],[1,1],[2,1],[3,1],[4,1],[5,1],[7,1],
      [0,2],[1,2],[2,2],[3,2],[4,2],[5,2],[7,2],
      [0,3],[1,3],[2,3],[3,3],[4,3],[5,3],[6,3],[7,3],
    ];
    const pick = _goodSprites[Math.floor(Math.random() * _goodSprites.length)];
    const sc = pick[0], sr = pick[1];
    const draw = () => ctx.drawImage(_foodImg, sc * 16, sr * 16, 16, 16, 0, 0, 28, 28);
    if (_foodImg.complete) draw();
    else _foodImg.addEventListener('load', draw, { once: true });
    document.body.appendChild(cvs);
    _foodParticles.push({
      el: cvs, col, row,
      startTime: Date.now(), dur: 2200,
      jitter: Math.random() * 24 - 12,
    });
  }

  function _spawnWheatParticle(fieldCol, fieldRow) {
    const img = document.createElement('img');
    img.src = 'Assets/Wheat.png';
    img.className = 'wheat-particle';
    img.style.left = '-9999px'; // off-screen until first frame positions it
    document.body.appendChild(img);
    _wheatParticles.push({
      el: img,
      fieldCol,
      fieldRow,
      startTime: Date.now(),
      dur: 1900,
      jitter: Math.random() * 20 - 10, // horizontal scatter within tile
    });
  }

  // Updates the entity panel's capacity line for (col, row) in-place
  function _refreshEntityCapacity(col, row, mode = 'family') {
    const obj = world.getObject(col, row);
    if (!obj || !_epCapValue) return;
    const cap    = getObjectCapacity(obj.tx, obj.ty) ?? 0;
    const label  = getObjectCapacityLabel(obj.tx, obj.ty);
    const filter = mode === 'villager' ? _villagerFilter : _familyFilter;
    const used   = _countCapUsedNear(col, row, filter);
    _epCapValue.textContent = `${used}/${cap} ${label} capacity`;
  }

  // ── Recruit panel (opened from Family House entity panel) ────────────
  function _setupRecruit() {
    const recruitPanel   = document.getElementById('recruit-panel');
    const recruitOverlay = document.getElementById('recruit-overlay');
    const recruitGrid    = document.getElementById('recruit-grid');
    const recruitInfo    = document.getElementById('recruit-info');
    const recruitRfEl    = document.getElementById('recruit-rf-count');
    const recruitCapEl   = document.getElementById('recruit-cap-status');

    const uipPanel    = document.getElementById('unit-info-panel');
    const uipCanvas   = document.getElementById('uip-canvas');
    const uipCtx      = uipCanvas?.getContext('2d');
    const uipName     = document.getElementById('uip-name');
    const uipCategory = document.getElementById('uip-category');
    const uipRangeBadge = document.getElementById('uip-range-badge');
    const uipCapBadge   = document.getElementById('uip-cap-badge');
    const uipBuyBtn   = document.getElementById('uip-buy-btn');
    let   _uipRecruit = () => {};

    let _famCol = -1, _famRow = -1, _currentMode = 'family';

    function _getFamCap() {
      const obj = world.getObject(_famCol, _famRow);
      return obj ? (getObjectCapacity(obj.tx, obj.ty) ?? 0) : 0;
    }

    function _capFilter() {
      return _currentMode === 'villager' ? _villagerFilter : _familyFilter;
    }

    function _refreshCapStatus() {
      if (!recruitCapEl) return;
      const max  = _getFamCap();
      const used = _countCapUsedNear(_famCol, _famRow, _capFilter());
      recruitCapEl.textContent = `${used}/${max} capacity`;
      recruitCapEl.style.color = used >= max ? '#e05050' : '#70b050';
    }

    function _showUnitInfo(type, color, ci, cvs) {
      if (!uipPanel || !uipCtx) return;
      // Recalculate live — capacity and RF may have changed since card was built
      const price     = (UNIT_RECRUIT_PRICES[type] ?? [])[ci] ?? 200;
      const capCost   = (UNIT_CAPACITY_COST[type]  ?? [])[ci] ?? 1;
      const usedCap   = _countCapUsedNear(_famCol, _famRow, _capFilter());
      const remaining = _getFamCap() - usedCap;
      const isLocked  = LOCKED_UNITS.has(type);
      const noWater   = NAVAL_RECRUIT_UNITS.has(type) && !_hasWaterOnMap();
      const noSpace   = !isLocked && !noWater && capCost > remaining;
      const cantAfford = !isLocked && !noWater && !noSpace && getRuflux() < price;
      // Sprite
      uipCtx.imageSmoothingEnabled = false;
      uipCtx.fillStyle = '#0a1408';
      uipCtx.fillRect(0, 0, 80, 80);
      const img = getChar(type, color);
      if (img) uipCtx.drawImage(img, 0, 0, 16, 16, 0, 0, 80, 80);

      const name  = getUnitDisplayName(type, color);
      const stats = (UNIT_STATS[type] ?? [])[ci] ?? [0,0,0,0,0];
      const isRanged = RANGED_UNITS_SET.has(type);
      const isHybrid = HYBRID_UNITS_SET.has(type);

      uipName.textContent     = name;
      uipCategory.textContent = CHAR_TYPE_LABELS[type] ?? type;
      uipRangeBadge.textContent = isHybrid ? '🌀 Hybrid' : isRanged ? '🏹 Ranged' : '⚔ Melee';
      uipCapBadge.textContent   = `👤${capCost} capacity`;

      const MAX = 35;
      const ids = ['atk','def','spd','satk','sdef'];
      stats.forEach((v, i) => {
        const bar = document.getElementById(`uip-${ids[i]}-bar`);
        const val = document.getElementById(`uip-${ids[i]}-val`);
        if (bar) bar.style.width = `${Math.min(100, (v / MAX) * 100)}%`;
        if (val) val.textContent = v;
      });

      // Buy button state — live checks
      uipBuyBtn.innerHTML = '';
      if (isLocked) {
        uipBuyBtn.textContent = '🔒 Locked — Special Event'; uipBuyBtn.disabled = true;
      } else if (noWater) {
        uipBuyBtn.textContent = '🌊 Requires water tiles'; uipBuyBtn.disabled = true;
      } else if (noSpace) {
        uipBuyBtn.textContent = `✗ Need ${capCost} capacity`; uipBuyBtn.disabled = true;
      } else if (cantAfford) {
        uipBuyBtn.textContent = `✗ Need ${(price - getRuflux()).toLocaleString()} more RF`; uipBuyBtn.disabled = true;
      } else {
        const coin = document.createElement('img');
        coin.src = 'Assets/coins/gold-coin.png'; coin.className = 'store-coin-icon'; coin.alt = 'RF';
        uipBuyBtn.appendChild(coin);
        uipBuyBtn.appendChild(document.createTextNode(` Recruit — ${price.toLocaleString()} RF`));
        uipBuyBtn.disabled = false;
        _uipRecruit = () => _recruitUnit(type, color, ci, uipBuyBtn);
      }

      uipPanel.classList.add('visible');
    }

    function _recruitUnit(type, color, colorIdx, btn) {
      const price   = (UNIT_RECRUIT_PRICES[type] ?? [])[colorIdx] ?? 200;
      const capCost = (UNIT_CAPACITY_COST[type]  ?? [])[colorIdx] ?? 1;
      const origHtml = btn.innerHTML;

      function _flash(msg) {
        btn.textContent = msg;
        btn.classList.add('store-buy-broke');
        setTimeout(() => { btn.innerHTML = origHtml; btn.classList.remove('store-buy-broke'); }, 1500);
      }

      if (getRuflux() < price)                                                         { _flash('✗ Need more RF'); return; }
      if (_countCapUsedNear(_famCol, _famRow, _capFilter()) + capCost > _getFamCap()) { _flash('✗ Hut is full!'); return; }

      const pos = _findNearbyEmpty(_famCol, _famRow);
      if (!pos) { _flash('✗ No space nearby!'); return; }

      addRuflux(-price);
      world.placeUnit(pos.col, pos.row, type, color, _famCol, _famRow);

      recruitRfEl.textContent = getRuflux().toLocaleString();
      _refreshCapStatus();
      _refreshEntityCapacity(_famCol, _famRow, _currentMode);
      _buildResidentsList(_famCol, _famRow, _currentMode);

      btn.textContent = '✔ Recruited!';
      btn.classList.add('store-buy-confirmed');

      const isVillager = VILLAGER_ONLY_UNITS.has(type);
      const tutAdvanced = _tutAdvance(isVillager ? 'villager-recruited' : 'archer-recruited');
      if (tutAdvanced) {
        setTimeout(() => _closeRecruit(), 1100);
      } else {
        setTimeout(() => { _openRecruit(_famCol, _famRow, _currentMode); }, 1100);
      }
    }

    function _openRecruit(famCol, famRow, mode = 'family') {
      _famCol = famCol; _famRow = famRow; _currentMode = mode;

      document.getElementById('inv-panel')?.classList.remove('open');
      document.getElementById('store-panel')?.classList.remove('open');
      document.getElementById('store-overlay')?.classList.remove('open');

      recruitRfEl.textContent = getRuflux().toLocaleString();
      recruitGrid.innerHTML   = '';
      recruitInfo.textContent = '';
      _refreshCapStatus();

      // Update header subtitle based on mode
      const subEl = recruitPanel.querySelector('.recruit-sub');
      if (subEl) subEl.textContent = mode === 'villager'
        ? 'Hire villagers for your empire\'s economy'
        : 'Train warriors from your Family House';

      const hasWater  = _hasWaterOnMap();
      const usedCap   = _countCapUsedNear(_famCol, _famRow, _capFilter());
      const maxCap    = _getFamCap();
      const remaining = maxCap - usedCap;
      const CARD = 64;

      for (const type of CHAR_TYPES) {
        const isVillager = VILLAGER_ONLY_UNITS.has(type);
        if (mode === 'villager') {
          if (!isVillager) continue; // villager hut: only villagers
        } else {
          if (isVillager || MINE_ONLY_UNITS.has(type)) continue; // family house: no villagers/mine
        }

        const lbl = document.createElement('div');
        lbl.className = 'store-section-lbl';
        lbl.textContent = CHAR_TYPE_LABELS[type] ?? type;
        recruitGrid.appendChild(lbl);

        const colors = CHAR_COLORS_BY_TYPE[type] ?? CHAR_COLORS;
        const isLocked = LOCKED_UNITS.has(type);
        const isNaval  = NAVAL_RECRUIT_UNITS.has(type);

        for (let ci = 0; ci < colors.length; ci++) {
          const color    = colors[ci];
          const name     = getUnitDisplayName(type, color);
          const price    = (UNIT_RECRUIT_PRICES[type] ?? [])[ci] ?? 200;
          const capCost  = (UNIT_CAPACITY_COST[type]  ?? [])[ci] ?? 1;
          const noWater    = isNaval && !hasWater;
          const noSpace    = !isLocked && !noWater && capCost > remaining;
          const cantAfford = !isLocked && !noWater && !noSpace && getRuflux() < price;
          const tutLocked  = _tutAllowedUnit !== null &&
                             !(_tutAllowedUnit.type === type && _tutAllowedUnit.colorIdx === ci);
          const disabled   = isLocked || noWater || noSpace || cantAfford || tutLocked;

          const cvs = document.createElement('canvas');
          cvs.width = CARD; cvs.height = CARD;
          const ctx = cvs.getContext('2d');
          ctx.imageSmoothingEnabled = false;
          ctx.fillStyle = '#0a1020'; ctx.fillRect(0, 0, CARD, CARD);
          const img = getChar(type, color);
          if (img) ctx.drawImage(img, 0, 0, 16, 16, 0, 0, CARD, CARD);
          else loadChar(type, color).then(() => {
            ctx.fillStyle = '#0a1020'; ctx.fillRect(0, 0, CARD, CARD);
            const img2 = getChar(type, color);
            if (img2) ctx.drawImage(img2, 0, 0, 16, 16, 0, 0, CARD, CARD);
          });

          const wrap = document.createElement('div');
          wrap.className = 'store-card';
          wrap.title = name;
          if (disabled) wrap.style.opacity = '0.4';

          const capBadge = document.createElement('div');
          capBadge.className = 'recruit-cap-badge';
          capBadge.textContent = `👤${capCost}`;
          capBadge.title = `Uses ${capCost} space`;
          wrap.appendChild(capBadge);

          wrap.appendChild(cvs);
          const nameEl = document.createElement('div');
          nameEl.className = 'store-card-name'; nameEl.textContent = name;
          wrap.appendChild(nameEl);

          const btn = document.createElement('button');
          btn.className = 'store-buy-btn';
          if (isLocked) {
            btn.textContent = '🔒 Locked'; btn.disabled = true;
          } else if (noWater) {
            btn.textContent = '🌊 Need water'; btn.disabled = true;
          } else if (noSpace) {
            btn.textContent = `✗ ${capCost} cap needed`; btn.disabled = true;
          } else if (cantAfford) {
            btn.textContent = `✗ Need ${(price - getRuflux()).toLocaleString()} RF`; btn.disabled = true;
          } else {
            btn.innerHTML = `<img src="Assets/coins/gold-coin.png" class="store-coin-icon" alt="RF"> ${price.toLocaleString()} <span class="recruit-btn-cap">👤${capCost}</span>`;
            btn.addEventListener('click', e => { e.stopPropagation(); _recruitUnit(type, color, ci, btn); });
          }
          wrap.appendChild(btn);

          wrap.addEventListener('mouseenter', () => { if (recruitInfo) recruitInfo.textContent = `${name} — ${price.toLocaleString()} RF · ${capCost} capacity`; });
          wrap.addEventListener('mouseleave', () => { if (recruitInfo) recruitInfo.textContent = ''; });
          wrap.addEventListener('click', () => _showUnitInfo(type, color, ci, cvs));

          recruitGrid.appendChild(wrap);
        }
      }

      recruitPanel.classList.add('open');
      recruitOverlay.classList.add('open');
    }

    function _closeRecruit() {
      recruitPanel.classList.remove('open');
      recruitOverlay.classList.remove('open');
      uipPanel?.classList.remove('visible');
    }

    document.getElementById('recruit-close').addEventListener('click', _closeRecruit);
    recruitOverlay.addEventListener('click', _closeRecruit);
    document.getElementById('uip-close')?.addEventListener('click', () => uipPanel?.classList.remove('visible'));
    uipBuyBtn?.addEventListener('click', () => _uipRecruit());

    return _openRecruit;
  }

  // ── Tutorial (shown once for fresh accounts) ─────────────────────────
  function _setupTutorial() {
    const TUTORIAL_KEY = 'tew_tutorial_shown';
    const guide    = document.getElementById('tut-guide');
    const blocker  = document.getElementById('tut-blocker');
    const spotDiv  = document.getElementById('tut-spotlight');
    if (!guide) return;

    const purchases = JSON.parse(localStorage.getItem('tew_store_purchases') ?? '[]');
    const isFresh = !localStorage.getItem(TUTORIAL_KEY) && purchases.length === 0;
    if (!isFresh) return;

    // Start with 0 RF — each action step grants exactly what's needed
    const existingRf = getRuflux();
    if (existingRf > 0) addRuflux(-existingRf);

    // Upgrade Villagers Hut to Level 2 (capacity = 2) so tutorial can recruit 2 farmers
    const cx = Math.floor(MAP_W / 2), cy = Math.floor(MAP_H / 2) - 1;
    world.placeObject(cx + 2, cy, { tx: 0, ty: 56 }); // Level 2 Villagers Hut

    const ARCHER_PRICE      = (UNIT_RECRUIT_PRICES.Archer   ?? [])[0] ?? 100;
    const VILLAGER_PRICE    = (UNIT_RECRUIT_PRICES.Villager ?? [])[0] ?? 80;
    const GOLD_MINE_PRICE   = 1500;
    const FIELDS_LAND_PRICE = 300;

    const STEPS = [
      // 0 — Townhall intro
      {
        action: 'Your <b>Townhall</b> sits at the center — <b>click it</b>.<br>Leveling it unlocks upgrades for every other building.',
        spotlight: { type: 'tile', col: cx, row: cy, rows: 2 },
        trigger: 'townhall-opened',
      },
      // 1 — Family House
      {
        action: 'A <b>Family House</b> sits to the left — <b>click it</b>.',
        spotlight: { type: 'tile', col: cx - 2, row: cy, rows: 2 },
        trigger: 'family-house-opened',
      },
      // 2 — Recruit button
      {
        action: 'Press the <b>⚔ Recruit Units</b> button.',
        spotlight: { type: 'dom', id: 'ep-recruit', pad: 10 },
        highlight: 'ep-recruit',
        trigger: 'recruit-opened-family',
        blockRecruit: true,
      },
      // 3 — Hire Tectine Archer
      {
        action: 'Find <b>Tectine Archer</b> and press the gold button.',
        spotlight: { type: 'dom', id: 'recruit-panel', pad: 0 },
        trigger: 'archer-recruited',
        rfGrant: ARCHER_PRICE,
        allowUnit: { type: 'Archer', colorIdx: 0 },
      },
      // 4 — Villagers Hut (first visit)
      {
        action: '<b>Click the Villagers Hut</b> to the right of the Townhall.',
        spotlight: { type: 'tile', col: cx + 2, row: cy, rows: 2 },
        trigger: 'villager-hut-opened',
      },
      // 5 — Recruit Villager button
      {
        action: 'Press <b>👷 Recruit Villager</b>.',
        spotlight: { type: 'dom', id: 'ep-recruit', pad: 10 },
        highlight: 'ep-recruit',
        trigger: 'recruit-opened-villager',
        blockRecruit: true,
      },
      // 6 — First Tectine Farmer
      {
        action: 'Recruit your first <b>Tectine Farmer</b>.',
        spotlight: { type: 'dom', id: 'recruit-panel', pad: 0 },
        trigger: 'villager-recruited',
        rfGrant: VILLAGER_PRICE,
        allowUnit: { type: 'Villager', colorIdx: 0 },
      },
      // 7 — Villagers Hut (second visit)
      {
        action: 'Great! <b>Click the Villagers Hut</b> again to recruit one more farmer.',
        spotlight: { type: 'tile', col: cx + 2, row: cy, rows: 2 },
        trigger: 'villager-hut-opened',
      },
      // 8 — Recruit Villager button (second time)
      {
        action: 'Press <b>👷 Recruit Villager</b> once more.',
        spotlight: { type: 'dom', id: 'ep-recruit', pad: 10 },
        highlight: 'ep-recruit',
        trigger: 'recruit-opened-villager',
        blockRecruit: true,
      },
      // 9 — Second Tectine Farmer
      {
        action: 'Recruit a second <b>Tectine Farmer</b>.',
        spotlight: { type: 'dom', id: 'recruit-panel', pad: 0 },
        trigger: 'villager-recruited',
        rfGrant: VILLAGER_PRICE,
        allowUnit: { type: 'Villager', colorIdx: 0 },
      },
      // 10 — Open Store (RF granted here so it's ready when the store opens)
      {
        action: 'Now let\'s build your economy!<br><b>Click the Store</b> button.',
        spotlight: { type: 'dom', id: 'btn-store', pad: 8 },
        highlight: 'btn-store',
        trigger: 'store-opened',
        rfGrant: GOLD_MINE_PRICE,
      },
      // 11 — Buy Gold Mine
      {
        action: 'Find <b>Gold Mine</b> in the Buildings tab and buy it.',
        spotlight: { type: 'dom', id: 'store-panel', pad: 0 },
        trigger: 'gold-mine-purchased',
        storeFilter: 'Gold Mine',
      },
      // 12 — Place Gold Mine (store closed automatically, cursor is in crosshair/place mode)
      {
        action: 'The Gold Mine is armed! <b>Click anywhere on the map</b> to place it.',
        spotlight: { type: 'dom', id: 'canvas', pad: 0 },
        trigger: 'gold-mine-placed',
      },
      // 13 — Open Store for Fields Land (RF granted here)
      {
        action: 'Head back to the <b>Store</b> to buy a Fields Land.',
        spotlight: { type: 'dom', id: 'btn-store', pad: 8 },
        highlight: 'btn-store',
        trigger: 'store-opened',
        rfGrant: FIELDS_LAND_PRICE,
      },
      // 14 — Buy Fields Land
      {
        action: 'Find <b>Fields Land</b> in the Store and buy it.',
        spotlight: { type: 'dom', id: 'store-panel', pad: 0 },
        trigger: 'fields-land-purchased',
        storeFilter: 'Fields Land',
      },
      // 15 — Place Fields Land
      {
        action: 'Fields Land is armed! <b>Click anywhere on the map</b> to place it.',
        spotlight: { type: 'dom', id: 'canvas', pad: 0 },
        trigger: 'fields-land-placed',
      },
      // 16 — Click the Fields Land
      {
        action: '<b>Click your Fields Land</b> on the map to manage it.',
        spotlight: { type: 'dom', id: 'canvas', pad: 0 },
        trigger: 'fields-land-panel-opened',
      },
      // 17 — Assign farmer
      {
        action: 'Press <b>🌾 Assign Farmer</b> and select a Tectine Farmer to work your land!',
        spotlight: { type: 'dom', id: 'ep-assign-farmer', pad: 10 },
        highlight: 'ep-assign-farmer',
        trigger: 'villager-assigned-to-field',
        blockAssign: true,
      },
      // 18 — Open store for Windmill
      {
        action: 'Open the <b>Store</b> to buy a Windmill — it processes your field output into Food!',
        spotlight: { type: 'dom', id: 'btn-store', pad: 8 },
        highlight: 'btn-store',
        trigger: 'store-opened',
        rfGrant: 800,
      },
      // 19 — Buy Windmill
      {
        action: 'Find the <b>Windmill</b> in the Store and buy it.',
        spotlight: { type: 'dom', id: 'store-panel', pad: 0 },
        trigger: 'windmill-purchased',
        storeFilter: 'Windmill',
      },
      // 20 — Place Windmill
      {
        action: 'Windmill armed! <b>Click anywhere on the map</b> to place it.',
        spotlight: { type: 'dom', id: 'canvas', pad: 0 },
        trigger: 'windmill-placed',
      },
      // 21 — Click Windmill
      {
        action: '<b>Click your Windmill</b> on the map to open its panel.',
        spotlight: { type: 'dom', id: 'canvas', pad: 0 },
        trigger: 'windmill-panel-opened',
      },
      // 22 — Assign field
      {
        action: 'Press <b>🌾 Assign Field</b> and connect your Fields Land to start producing Food!',
        spotlight: { type: 'dom', id: 'ep-assign-field', pad: 10 },
        highlight: 'ep-assign-field',
        trigger: 'field-assigned-to-windmill',
      },
      // 23 — Final
      {
        action: '🎉 <b>Your empire is thriving!</b><br>Warriors defend, farmers harvest, windmills process Food.<br>Watch your Food bar fill and keep expanding!',
        spotlight: { type: 'dom', id: 'food-hud', pad: 8 },
        highlight: 'food-hud',
        next: 'Start Conquering ⚔',
        trigger: null,
      },
    ];

    let step = 0;
    const total = STEPS.length;
    let _rfAnimTimer = null;

    function _animateRfGrant(amount) {
      if (_rfAnimTimer) clearInterval(_rfAnimTimer);
      const hudEl = document.getElementById('ruflux-count');
      if (hudEl) hudEl.classList.add('tut-rf-animating');
      const ticks = 28;
      let granted = 0;
      _rfAnimTimer = setInterval(() => {
        const remaining = amount - granted;
        if (remaining <= 0) {
          clearInterval(_rfAnimTimer);
          if (hudEl) hudEl.classList.remove('tut-rf-animating');
          // Only re-render recruit panel if the current step actually needs it open
          if (_selCol !== -1 && STEPS[step]?.spotlight?.id === 'recruit-panel') {
            _openRecruitFn(_selCol, _selRow, _recruitMode);
          }
          return;
        }
        const chunk = Math.ceil(remaining / Math.max(1, ticks - granted));
        addRuflux(chunk);
        granted += chunk;
      }, 40);
    }

    function _clearTutUI() {
      blocker?.classList.remove('active');
      document.getElementById('entity-panel')?.classList.remove('tut-recruit-only');
      document.getElementById('entity-panel')?.classList.remove('tut-assign-only');
      spotDiv?.classList.remove('active');
      _tutSpotlight = null;
      _tutAllowedUnit = null;
      setTutStoreFilter(null);
      document.getElementById('recruit-overlay')?.style.removeProperty('pointer-events');
      document.querySelectorAll('.tutorial-pulse').forEach(el => el.classList.remove('tutorial-pulse'));
    }

    function _showStep(n) {
      const s = STEPS[n];
      document.getElementById('tut-step-label').textContent = `${n + 1} / ${total}`;
      document.getElementById('tut-progress-fill').style.width = `${((n + 1) / total) * 100}%`;
      document.getElementById('tut-arrow').style.display = 'none';
      document.getElementById('tut-action').innerHTML = s.action;

      const nextBtn = document.getElementById('tut-next');
      if (s.next) {
        nextBtn.textContent = s.next;
        nextBtn.style.display = '';
        nextBtn.classList.toggle('tut-last-step', n === total - 1);
      } else {
        nextBtn.style.display = 'none';
      }

      _clearTutUI();

      if (s.spotlight) {
        _tutSpotlight = s.spotlight;
        spotDiv?.classList.add('active');
      }

      _tutMapTarget = s.spotlight?.type === 'tile'
        ? { col: s.spotlight.col, row: s.spotlight.row + (s.spotlight.rows ?? 1) / 2 - 0.5 }
        : null;

      if (s.highlight) document.getElementById(s.highlight)?.classList.add('tutorial-pulse');

      if (s.blockRecruit) {
        blocker?.classList.add('active');
        document.getElementById('entity-panel')?.classList.add('tut-recruit-only');
      }
      if (s.blockAssign) {
        blocker?.classList.add('active');
        document.getElementById('entity-panel')?.classList.add('tut-assign-only');
      }

      if (s.spotlight?.type === 'tile') _hideEntityPanel();

      // Close recruit panel unless this step actually uses it
      if (s.spotlight?.id !== 'recruit-panel' && s.spotlight?.id !== 'ep-recruit') {
        document.getElementById('recruit-panel')?.classList.remove('open');
        document.getElementById('recruit-overlay')?.classList.remove('open');
      }

      if (s.spotlight?.id === 'recruit-panel') {
        document.getElementById('recruit-overlay')?.style.setProperty('pointer-events', 'none');
      }

      if (s.closeStoreOnShow) {
        document.getElementById('store-panel')?.classList.remove('open');
        document.getElementById('store-overlay')?.classList.remove('open');
      }

      _tutAllowedUnit = s.allowUnit ?? null;
      setTutStoreFilter(s.storeFilter ?? null);

      if (s.rfGrant) _animateRfGrant(s.rfGrant);
    }

    function _dismiss() {
      if (_rfAnimTimer) clearInterval(_rfAnimTimer);
      localStorage.setItem(TUTORIAL_KEY, '1');
      guide.classList.remove('open');
      _tutMapTarget = null;
      _clearTutUI();
      _tutAdvance = () => false;
    }

    guide.classList.add('open');
    _showStep(0);

    _tutAdvance = (trigger) => {
      if (!guide.classList.contains('open')) return false;
      const s = STEPS[step];
      if (!s || s.trigger !== trigger) return false;
      step++;
      if (step >= total) _dismiss();
      else _showStep(step);
      return true;
    };

    document.getElementById('tut-next').addEventListener('click', () => {
      if (STEPS[step]?.trigger !== null) return;
      step++;
      if (step >= total) _dismiss();
      else _showStep(step);
    });
    document.getElementById('tut-skip').addEventListener('click', _dismiss);
  }

  function _enterEditMode() {
    // Now unused — inventory controls edit mode directly
  }

  function _toggleEdit() {
    // Kept for keyboard shortcut compatibility but no longer bound to UI buttons
    editMode = !editMode;
    panel[editMode ? 'open' : 'close']();
    canvas.style.cursor = editMode ? 'crosshair' : 'grab';
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

    // ── Tutorial map pointer — track building tile each frame ─────────
    const tutPtr = document.getElementById('tut-map-pointer');
    if (tutPtr) {
      if (_tutMapTarget) {
        const px = camera.ox + (_tutMapTarget.col + 0.5) * TILE_DST;
        const py = camera.oy + (_tutMapTarget.row + 0.5) * TILE_DST;
        tutPtr.style.left    = `${Math.round(px)}px`;
        tutPtr.style.top     = `${Math.round(py)}px`;
        tutPtr.style.display = 'block';
      } else {
        tutPtr.style.display = 'none';
      }
    }

    // ── Tutorial spotlight — reposition each frame ────────────────────
    const spotDiv = document.getElementById('tut-spotlight');
    if (spotDiv && _tutSpotlight) {
      const sp = _tutSpotlight;
      if (sp.type === 'tile') {
        const pad = 4;
        const px = camera.ox + sp.col * TILE_DST - pad;
        const py = camera.oy + sp.row * TILE_DST - pad;
        const rows = sp.rows ?? 1;
        spotDiv.style.left   = `${Math.round(px)}px`;
        spotDiv.style.top    = `${Math.round(py)}px`;
        spotDiv.style.width  = `${TILE_DST + pad * 2}px`;
        spotDiv.style.height = `${TILE_DST * rows + pad * 2}px`;
      } else if (sp.type === 'dom') {
        const el = document.getElementById(sp.id);
        if (el) {
          const r = el.getBoundingClientRect();
          const pad = sp.pad ?? 8;
          spotDiv.style.left   = `${Math.round(r.left   - pad)}px`;
          spotDiv.style.top    = `${Math.round(r.top    - pad)}px`;
          spotDiv.style.width  = `${Math.round(r.width  + pad * 2)}px`;
          spotDiv.style.height = `${Math.round(r.height + pad * 2)}px`;
        }
      }
    }

    // ── Wheat particles ───────────────────────────────────────────────
    // 1. Scan current Fields Land positions — must check name, not just ty
    //    (Family House also sits at ty=50 but is a different building)
    const _wNow = Date.now();
    const _fieldPositions = [];
    for (let r = 0; r < world.h; r++) {
      for (let c = 0; c < world.w; c++) {
        const o = world.getObject(c, r);
        if (o && getObjectDisplayName(o.tx, o.ty).replace(' Top', '') === 'Fields Land')
          _fieldPositions.push({ col: c, row: r });
      }
    }

    const _isFieldsLandObj = (o) =>
      o && getObjectDisplayName(o.tx, o.ty).replace(' Top', '') === 'Fields Land';

    // 2. Spawn new particles from assigned workers
    const _wUnits = world.units;
    for (let r = 0; r < world.h; r++) {
      for (let c = 0; c < world.w; c++) {
        const u = _wUnits[r][c];
        if (!u || u.fieldCol === undefined) continue;
        // Heal stale field reference if building was moved or replaced
        const storedObj = world.getObject(u.fieldCol, u.fieldRow);
        if (!_isFieldsLandObj(storedObj)) {
          if (_fieldPositions.length === 0) continue;
          let best = _fieldPositions[0], bestD = Infinity;
          for (const fp of _fieldPositions) {
            const d = Math.abs(fp.col - c) + Math.abs(fp.row - r);
            if (d < bestD) { bestD = d; best = fp; }
          }
          u.fieldCol = best.col;
          u.fieldRow = best.row;
        }
        if (!u._wheatNext || _wNow >= u._wheatNext) {
          _spawnWheatParticle(u.fieldCol, u.fieldRow);
          u._wheatNext = _wNow + 1800 + Math.random() * 1400;
        }
      }
    }

    // 3. Update existing particles every frame (tracks camera movement)
    for (let i = _wheatParticles.length - 1; i >= 0; i--) {
      const p = _wheatParticles[i];
      const elapsed = _wNow - p.startTime;
      if (elapsed >= p.dur) {
        p.el.remove();
        _wheatParticles.splice(i, 1);
        continue;
      }
      const t = elapsed / p.dur; // 0..1
      // Ease-out float: fast rise then slow
      const rise   = t * t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const opacity = t < 0.12 ? t / 0.12 : t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
      const scale  = 0.65 + rise * 0.45;
      const rotate = (t - 0.5) * 20; // gentle wobble
      // Recompute screen position from live camera + stored field tile
      const baseX = Math.round(camera.ox + (p.fieldCol + 0.5) * TILE_DST) - 12;
      const baseY = Math.round(camera.oy + (p.fieldRow + 0.3) * TILE_DST) - 12;
      const floatY = rise * -62;
      p.el.style.left      = `${baseX + p.jitter}px`;
      p.el.style.top       = `${baseY}px`;
      p.el.style.opacity   = opacity.toFixed(3);
      p.el.style.transform = `translateY(${floatY.toFixed(1)}px) scale(${scale.toFixed(3)}) rotate(${rotate.toFixed(1)}deg)`;
    }

    // ── Windmill production tick ──────────────────────────────────────
    const _wFrameDt = 1 / 60; // assume 60fps; could use rAF delta for precision
    for (let r = 0; r < world.h; r++) {
      for (let c = 0; c < world.w; c++) {
        const o = world.getObject(c, r);
        if (!o || !_isWindmillObj(o)) continue;
        if (!o.assignedFields?.length) continue;
        // Initialise progress if not set
        if (o.windmillProgress === undefined) o.windmillProgress = 0;
        const rate = _windmillFillRatePerSec(o);
        o.windmillProgress += rate * _wFrameDt;
        if (o.windmillProgress >= 100) {
          o.windmillProgress = 0;
          const output = _windmillOutput(o);
          _addFood(output);
          _spawnFoodParticle(c, r);
        }
        // Ensure canvas bar exists
        _ensureWindmillBar(c, r);
      }
    }
    // Remove bars for windmills that no longer have assigned fields
    for (let i = _windmillBars.length - 1; i >= 0; i--) {
      const b = _windmillBars[i];
      const o = world.getObject(b.col, b.row);
      if (!o || !_isWindmillObj(o) || !o.assignedFields?.length) {
        b.wrapEl.remove();
        _windmillBars.splice(i, 1);
      }
    }
    // Update windmill bar overlays
    for (const b of _windmillBars) {
      const o = world.getObject(b.col, b.row);
      const pct = o?.windmillProgress ?? 0;
      const px = Math.round(camera.ox + b.col * TILE_DST);
      const py = Math.round(camera.oy + b.row * TILE_DST - 8);
      b.wrapEl.style.left   = `${px}px`;
      b.wrapEl.style.top    = `${py}px`;
      b.wrapEl.style.width  = `${TILE_DST}px`;
      b.fillEl.style.width  = `${pct.toFixed(1)}%`;
    }
    // Update entity panel windmill bar if a windmill is selected
    if (_selCol !== -1 && _selRow !== -1) {
      const selO = world.getObject(_selCol, _selRow);
      if (selO && _isWindmillObj(selO)) {
        const pct = selO.windmillProgress ?? 0;
        const fillEl = document.getElementById('ep-windmill-bar-fill');
        const pctEl  = document.getElementById('ep-windmill-pct');
        if (fillEl) fillEl.style.width = `${pct.toFixed(1)}%`;
        if (pctEl)  pctEl.textContent  = `${Math.floor(pct)}%`;
      }
    }

    // ── Food particles ────────────────────────────────────────────────
    const _fpNow = Date.now();
    for (let i = _foodParticles.length - 1; i >= 0; i--) {
      const p = _foodParticles[i];
      const elapsed = _fpNow - p.startTime;
      if (elapsed >= p.dur) { p.el.remove(); _foodParticles.splice(i, 1); continue; }
      const t = elapsed / p.dur;
      const rise    = t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2,2)/2;
      const opacity = t < 0.1 ? t/0.1 : t > 0.7 ? 1-(t-0.7)/0.3 : 1;
      const scale   = 0.7 + rise * 0.5;
      const baseX   = Math.round(camera.ox + (p.col + 0.5) * TILE_DST) - 14;
      const baseY   = Math.round(camera.oy + (p.row + 0.3) * TILE_DST) - 14;
      p.el.style.left      = `${baseX + p.jitter}px`;
      p.el.style.top       = `${baseY}px`;
      p.el.style.opacity   = opacity.toFixed(3);
      p.el.style.transform = `translateY(${(rise * -80).toFixed(1)}px) scale(${scale.toFixed(3)})`;
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
