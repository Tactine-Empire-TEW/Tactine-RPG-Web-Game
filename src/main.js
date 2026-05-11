/**
 * main.js — bootstraps the game.
 */

import { MAP_W, MAP_H, BIOME_LABELS, WATER_UNITS, FLYING_UNITS, getUnitDisplayName, getObjectDisplayName, getObjectLevel, getObjectCapacity, getObjectCapacityLabel, getObjectSpeedBonus, getObjectProductionBonus, UPGRADE_MAP, BLDG_TOP_BOT_PAIRS, BLDG_BOT_KEYS, TILE_DST, TILE_SRC, isWaterTileCoord, CHAR_TYPES, CHAR_COLORS, CHAR_COLORS_BY_TYPE, CHAR_TYPE_LABELS, UNIT_RECRUIT_PRICES, UNIT_CAPACITY_COST, LOCKED_UNITS, VILLAGER_ONLY_UNITS, MINE_ONLY_UNITS, NAVAL_RECRUIT_UNITS, UNIT_STATS, RANGED_UNITS_SET, HYBRID_UNITS_SET } from './constants.js';
import { getSheet, loadSheet, preloadAllChars, getChar, loadChar } from './assets.js';
import { Camera    } from './Camera.js';
import { World     } from './World.js';
import { Renderer  } from './Renderer.js';
import { EditPanel } from './EditPanel.js';
import { setupInput } from './input.js?v=5';
import { setupRuflux, addRuflux, getRuflux } from './ruflux.js';
import { setupStore, UNIT_PRICES, openQtyModal } from './store.js';

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

  const _epRecruit   = document.getElementById('ep-recruit');
  const _epResidents = document.getElementById('ep-residents');
  const _epResList   = document.getElementById('ep-residents-list');
  const _epSellUnit  = document.getElementById('ep-sell-unit');
  let   _openRecruitFn = () => {};
  let   _recruitMode   = 'family';
  let   _selUnitRef    = null; // direct reference to the selected unit object
  _epRecruit.addEventListener('click', () => _openRecruitFn(_selCol, _selRow, _recruitMode));

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
        const used = filter ? _countCapUsedNear(topCol, topRow, filter) : 0;
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
      const isFamHouse    = objName === 'Family House';
      const isVillagersHut = objName === 'Villagers Hut';
      const showRecruit   = isFamHouse || isVillagersHut;
      _epSellUnit.style.display  = 'none';
      _epRecruit.style.display   = showRecruit ? 'block' : 'none';
      _epResidents.style.display = showRecruit ? 'block' : 'none';
      if (showRecruit) {
        _recruitMode = isVillagersHut ? 'villager' : 'family';
        _epRecruit.textContent = isVillagersHut ? '👷 Recruit Villager' : '⚔ Recruit Units';
        _buildResidentsList(topCol, topRow, _recruitMode);
      }
    }

    _epPanel.classList.add('visible');
  }

  function _hideEntityPanel() {
    _epPanel.classList.remove('visible');
    _epRecruit.style.display   = 'none';
    _epResidents.style.display = 'none';
    _epSellUnit.style.display  = 'none';
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

  // Input
  const inputState = setupInput({
    canvas, camera, world, editPanel: panel,
    getEditMode: () => editMode,
    onPick:   (kind, data, col, row) => _showEntityPanel(kind, data, col, row),
    onClear:  () => _hideEntityPanel(),
    beforePlace: sel     => _invCanPlace(sel),
    afterPlace:  sel     => _invOnPlaced(sel),
    onRemoved:   removed => _invOnRemoved(removed),
  });

  // UI wiring
  setupRuflux(); // async — market data loads in background, non-blocking
  setupStore();
  _openRecruitFn = _setupRecruit();
  _setupTutorial();
  _setupInventory();

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
    let   invCat     = 'buildings';
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
  // filterFn(unit) → bool: pass null to count all, or a function to restrict
  function _countCapUsedNear(col, row, filterFn = null, radius = 4) {
    let total = 0;
    for (let r = 0; r < MAP_H; r++) {
      for (let c = 0; c < MAP_W; c++) {
        const u = world.getUnit(c, r);
        if (!u) continue;
        if (Math.abs(c - col) > radius || Math.abs(r - row) > radius) continue;
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
        if (Math.abs(c - col) > radius || Math.abs(r - row) > radius) continue;
        const u = world.getUnit(c, r);
        if (!u) continue;
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
        info.innerHTML = `<span class="ep-res-name">${name}</span><span class="ep-res-cap">⚡${capCost}</span>`;

        const sellBtn = document.createElement('button');
        sellBtn.className = 'ep-res-sell-btn';
        sellBtn.textContent = `💰 ${sellPrice} RF`;
        sellBtn.title = `Sell for ${sellPrice} RF (70% of recruit price) — frees ⚡${capCost} capacity`;

        const uc = c, ur = r;
        sellBtn.addEventListener('click', () => {
          world.removeUnitAt(uc, ur);
          addRuflux(sellPrice);
          _buildResidentsList(col, row, mode);
          const obj = world.getObject(col, row);
          if (obj) {
            const cap    = getObjectCapacity(obj.tx, obj.ty) ?? 0;
            const label  = getObjectCapacityLabel(obj.tx, obj.ty);
            const filter = mode === 'villager' ? _villagerFilter : _familyFilter;
            const used   = _countCapUsedNear(col, row, filter);
            _epCapValue.textContent = `${used}/${cap} ${label} capacity`;
          }
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
      uipCapBadge.textContent   = `⚡${capCost} capacity`;

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
      world.placeUnit(pos.col, pos.row, type, color);

      recruitRfEl.textContent = getRuflux().toLocaleString();
      _refreshCapStatus();

      btn.textContent = '✔ Recruited!';
      btn.classList.add('store-buy-confirmed');
      setTimeout(() => { _openRecruit(_famCol, _famRow, _currentMode); }, 1100);
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
          const noWater   = isNaval && !hasWater;
          const noSpace   = !isLocked && !noWater && capCost > remaining;
          const cantAfford = !isLocked && !noWater && !noSpace && getRuflux() < price;
          const disabled  = isLocked || noWater || noSpace || cantAfford;

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
          capBadge.textContent = `⚡${capCost}`;
          capBadge.title = `Uses ${capCost} capacity`;
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
            btn.innerHTML = `<img src="Assets/coins/gold-coin.png" class="store-coin-icon" alt="RF"> ${price.toLocaleString()}`;
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
    const guide = document.getElementById('tut-guide');
    if (!guide) return;

    const purchases = JSON.parse(localStorage.getItem('tew_store_purchases') ?? '[]');
    const isFresh = !localStorage.getItem(TUTORIAL_KEY) && purchases.length === 0;
    if (!isFresh) return;

    // Give fresh players ~3000 RF (≈$3 at launch rate)
    if (getRuflux() === 0) addRuflux(3000);

    const cx = Math.floor(MAP_W / 2), cy = Math.floor(MAP_H / 2) - 1;
    const STEPS = [
      {
        action: 'Your <b>Townhall</b> stands at the center of the map.<br>It is your empire\'s <b>Federal Reserve</b> — it stores all your Rufluxes.',
        target: { col: cx, row: cy + 0.5 }, highlight: null, next: 'Got it →',
      },
      {
        action: 'A <b>Family House</b> was placed to the left of the Townhall.<br><b>Click it</b> on the map to open its panel.',
        target: { col: cx - 2, row: cy }, highlight: null, next: 'Clicked it →',
      },
      {
        action: 'The panel opened on the right.<br>Press the blue <b>Recruit Units ⚔</b> button to open the recruitment hall.',
        target: null, highlight: 'ep-recruit', next: 'Pressed it →',
      },
      {
        action: 'Look for the <b>Archers</b> section.<br>Press the gold button on <b>Tectine Archer</b> — it costs ⚡1 capacity, perfect for Lvl 1.<br>Your archer will appear next to the house!',
        target: null, highlight: null, next: 'Archer hired! →',
      },
      {
        action: 'Great! Now find the <b>Villagers Hut</b> to the right of the Townhall — it\'s glowing.<br><b>Click it</b> on the map.',
        target: { col: cx + 2, row: cy }, highlight: null, next: 'Clicked the hut →',
      },
      {
        action: 'The Villagers Hut panel opened.<br>Press <b>👷 Recruit Villager</b> to open the villager recruitment hall.',
        target: null, highlight: 'ep-recruit', next: 'Pressed it →',
      },
      {
        action: 'Find <b>Village Smith</b> in the list.<br>Press the gold button to recruit one — the Smith will appear beside the hut and head to work at the Townhall!',
        target: null, highlight: null, next: 'Hired! →',
      },
      {
        action: '🎉 <b>Your empire is alive!</b><br>You have a warrior defending your lands and a Village Smith working at the Townhall.<br>Explore the Store to grow further!',
        target: null, highlight: 'btn-store', next: 'Start Conquering ⚔',
      },
    ];

    let step = 0;
    const total = STEPS.length;

    function _showStep(n) {
      const s = STEPS[n];
      document.getElementById('tut-step-label').textContent = `${n + 1} / ${total}`;
      document.getElementById('tut-progress-fill').style.width = `${((n + 1) / total) * 100}%`;
      const arrowEl = document.getElementById('tut-arrow');
      if (arrowEl) arrowEl.style.display = 'none'; // hide old arrow — no longer used
      document.getElementById('tut-action').innerHTML = s.action;
      const nextBtn = document.getElementById('tut-next');
      nextBtn.textContent = s.next;
      nextBtn.classList.toggle('tut-last-step', n === total - 1);
      document.querySelectorAll('.tutorial-pulse').forEach(el => el.classList.remove('tutorial-pulse'));
      if (s.highlight) document.getElementById(s.highlight)?.classList.add('tutorial-pulse');
      // Update the map pointer — null hides it
      _tutMapTarget = s.target ?? null;
    }

    function _dismiss() {
      localStorage.setItem(TUTORIAL_KEY, '1');
      guide.classList.remove('open');
      _tutMapTarget = null;
      document.querySelectorAll('.tutorial-pulse').forEach(el => el.classList.remove('tutorial-pulse'));
    }

    guide.classList.add('open');
    _showStep(0);

    document.getElementById('tut-next').addEventListener('click', () => {
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
        // Center on the target tile
        const px = camera.ox + (_tutMapTarget.col + 0.5) * TILE_DST;
        const py = camera.oy + (_tutMapTarget.row + 0.5) * TILE_DST;
        tutPtr.style.left    = `${Math.round(px)}px`;
        tutPtr.style.top     = `${Math.round(py)}px`;
        tutPtr.style.display = 'block';
      } else {
        tutPtr.style.display = 'none';
      }
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
