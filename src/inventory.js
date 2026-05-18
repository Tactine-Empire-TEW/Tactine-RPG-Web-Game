/**
 * inventory.js — shows purchased items; clicking one selects it for
 * placement on the map (sets editPanel.selected, activates edit mode).
 */
import { TILE_SRC } from './constants.js';
import { getSheet, getChar, loadChar } from './assets.js';

const PURCHASE_KEY = 'tew_store_purchases';
const CARD = 64;

let _panel, _grid, _category = 'water'; // Biome panel only shows water tiles
let _editPanel = null;
let _enterEditMode = null;

// ── Public ────────────────────────────────────────────────────────────
export function setupInventory(editPanel, enterEditMode) {
  _editPanel    = editPanel;
  _enterEditMode = enterEditMode;

  _panel = document.getElementById('inv-panel');
  _grid  = document.getElementById('inv-grid');

  document.getElementById('btn-inventory').addEventListener('click', _open);
  document.getElementById('inv-close').addEventListener('click', _close);
  document.getElementById('inv-overlay').addEventListener('click', _close);

  document.querySelectorAll('.inv-cat').forEach(btn => {
    btn.addEventListener('click', () => {
      _category = btn.dataset.cat;
      document.querySelectorAll('.inv-cat').forEach(b =>
        b.classList.toggle('active', b === btn));
      _buildGrid();
    });
  });
}

// ── Open / close ──────────────────────────────────────────────────────
function _open() {
  // close store if open
  document.getElementById('store-panel')?.classList.remove('open');
  document.getElementById('store-overlay')?.classList.remove('open');

  _panel.classList.add('open');
  document.getElementById('inv-overlay').classList.add('open');
  _buildGrid();
}
function _close() {
  _panel.classList.remove('open');
  document.getElementById('inv-overlay').classList.remove('open');
}

// ── Data helpers ──────────────────────────────────────────────────────
function _getPurchases() {
  try { return JSON.parse(localStorage.getItem(PURCHASE_KEY) ?? '[]'); }
  catch { return []; }
}

function _aggregate(kind) {
  const all = _getPurchases().filter(p => p.kind === kind);
  const map = new Map();
  for (const p of all) {
    if (map.has(p.name)) map.get(p.name).qty++;
    else map.set(p.name, { ...p, qty: 1 });
  }
  return [...map.values()];
}

// ── Grid ──────────────────────────────────────────────────────────────
function _buildGrid() {
  _grid.innerHTML = '';
  const kindMap = { buildings: 'building', walls: 'wall', units: 'unit', water: 'wall' };
  const items   = _aggregate(kindMap[_category]);

  if (items.length === 0) {
    const el = document.createElement('div');
    el.className = 'inv-empty';
    el.innerHTML = 'Nothing here yet.<br>Visit the <b>Store</b> to buy items!';
    _grid.appendChild(el);
    return;
  }

  const biome = document.getElementById('biome-sel')?.value ?? 'normal';
  const sheet = getSheet(biome);
  for (const item of items) _addCard(item, sheet);
}

function _addCard(item, sheet) {
  const isUnit = item.kind === 'unit';
  const hasBot = !!item.bot;
  const h      = hasBot ? CARD * 2 : CARD;

  // Draw sprite onto canvas
  const cvs = document.createElement('canvas');
  cvs.width = CARD; cvs.height = h;
  const ctx = cvs.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#1a1208';
  ctx.fillRect(0, 0, CARD, h);

  if (isUnit) {
    const img = getChar(item.type, item.color);
    if (img) {
      ctx.drawImage(img, 0, 0, 16, 16, 0, 0, CARD, CARD);
    } else {
      loadChar(item.type, item.color).then(() => {
        ctx.fillStyle = '#1a1208'; ctx.fillRect(0, 0, CARD, h);
        const img2 = getChar(item.type, item.color);
        if (img2) ctx.drawImage(img2, 0, 0, 16, 16, 0, 0, CARD, CARD);
      });
    }
  } else if (sheet) {
    ctx.drawImage(sheet, item.tx * TILE_SRC, item.ty * TILE_SRC,
                  TILE_SRC, TILE_SRC, 0, 0, CARD, CARD);
    if (hasBot) {
      ctx.drawImage(sheet, item.bot.tx * TILE_SRC, item.bot.ty * TILE_SRC,
                    TILE_SRC, TILE_SRC, 0, CARD, CARD, CARD);
    }
  }

  // Card wrapper
  const wrap = document.createElement('div');
  wrap.className = 'store-card';
  wrap.title     = item.name;

  // Quantity badge
  const badge = document.createElement('div');
  badge.className = 'inv-qty-badge';
  badge.textContent = `×${item.qty}`;

  // Name label
  const nameEl = document.createElement('div');
  nameEl.className  = 'store-card-name';
  nameEl.textContent = item.name;

  // "Place" button
  const btn = document.createElement('button');
  btn.className = 'store-buy-btn';
  btn.textContent = '▶ Place';

  wrap.appendChild(cvs);
  wrap.appendChild(badge);
  wrap.appendChild(nameEl);
  wrap.appendChild(btn);

  // Clicking card or button selects the item for placement
  const selectItem = () => _selectForPlacement(item, btn);
  btn.addEventListener('click', selectItem);
  wrap.addEventListener('click', e => { if (e.target !== btn) selectItem(); });

  _grid.appendChild(wrap);
}

// ── Select item → activate edit mode → close panel ───────────────────
function _selectForPlacement(item, btn) {
  if (!_editPanel) return;

  if (item.kind === 'unit') {
    _editPanel.selected = { kind: 'unit', type: item.type, color: item.color };
  } else {
    _editPanel.selected = item.bot
      ? { kind: 'object', tx: item.tx, ty: item.ty, bot: item.bot }
      : { kind: 'object', tx: item.tx, ty: item.ty };
  }

  // Brief visual feedback on the button
  const orig = btn.textContent;
  btn.textContent = '✔ Ready!';
  btn.classList.add('store-buy-confirmed');

  // Activate edit mode so the user can click the map to place
  if (_enterEditMode) _enterEditMode();

  // Close the inventory panel after short delay
  setTimeout(() => {
    btn.textContent = orig;
    btn.classList.remove('store-buy-confirmed');
    _close();
  }, 500);
}
