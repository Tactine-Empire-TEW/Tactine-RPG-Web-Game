import {
  TILE_SRC, TILE_SECTIONS,
  CHAR_TYPES, CHAR_COLORS, CHAR_COLORS_BY_TYPE, CHAR_SRC,
  CHAR_TYPE_LABELS,
  getUnitDisplayName, getObjectDisplayName, isHiddenTile,
  BLDG_TOP_BOT_PAIRS, BLDG_BOT_KEYS,
} from './constants.js';
import { getSheet, getChar, loadChar } from './assets.js';

/**
 * Manages the edit-mode bottom panel.
 * Exposes `selected` for input.js to read, and `ghostAt` for the renderer.
 */
export class EditPanel {
  constructor() {
    this._el       = document.getElementById('edit-panel');
    this._strip    = document.getElementById('tile-strip');
    this._catBtns  = document.querySelectorAll('#cat-bar .cat');
    this._prevCvs  = document.getElementById('prev-cvs');
    this._prevCtx  = this._prevCvs.getContext('2d');
    this._prevCtx.imageSmoothingEnabled = false;
    this._prevName = document.getElementById('prev-name');
    this._infoBar  = document.getElementById('strip-info');

    this.category = 'objects';
    this.selected = null;

    this._bindCatButtons();
    this._buildStrip();
  }

  open()  { this._el.classList.add('open'); }
  close() { this._el.classList.remove('open'); }

  ghostAt(col, row) {
    if (!this.selected) return null;
    return { ...this.selected, col, row };
  }

  refresh() { this._buildStrip(); }

  // ── Internal ──────────────────────────────────────────────────────────
  _bindCatButtons() {
    this._catBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.category = btn.dataset.cat;
        this._catBtns.forEach(b => b.classList.toggle('active', b === btn));
        this._buildStrip();
      });
    });
  }

  _buildStrip() {
    this._strip.innerHTML = '';
    this.selected = null;
    this._clearPreview();
    if (this._prevName) this._prevName.textContent = '';
    if (this._infoBar)  this._infoBar.textContent  = '';

    if (this.category === 'objects') this._buildObjectStrip();
    else                              this._buildUnitStrip();
  }

  _buildObjectStrip() {
    const biome = document.getElementById('biome-sel')?.value ?? 'normal';
    const sheet = getSheet(biome);

    for (const section of TILE_SECTIONS) {
      if (section.showInEdit === false) continue;
      let sectionHasCards = false;
      const sectionCards = [];

      for (let dr = 0; dr < section.rowCount; dr++) {
        const ty = section.rowStart + dr;
        for (let tx = 0; tx < section.colCount; tx++) {
          if (section.filter && !section.filter(tx, ty)) continue;
          if (isHiddenTile(tx, ty)) continue;
          // Skip bottom-half tiles — they're drawn inside their Top card
          if (BLDG_BOT_KEYS.has(`${tx},${ty}`)) continue;
          if (sheet && !this._tileHasContent(sheet, tx, ty)) continue;

          const topName = getObjectDisplayName(tx, ty);
          const bot     = BLDG_TOP_BOT_PAIRS.get(`${tx},${ty}`) ?? null;
          // For paired buildings, strip " Top" from the label
          const name    = bot ? topName.replace(' Top', '') : topName;
          const cardBg  = section.cardBg ?? '#1a2810';
          const cardH   = bot ? 116 : 58;   // double height for 2-tile buildings

          const card = this._makeCard(58, cardH, mc => {
            const mctx = mc.getContext('2d');
            mctx.imageSmoothingEnabled = false;
            mctx.fillStyle = cardBg;
            mctx.fillRect(0, 0, mc.width, mc.height);
            if (sheet) {
              mctx.drawImage(sheet, tx * TILE_SRC, ty * TILE_SRC, TILE_SRC, TILE_SRC,
                             0, 0, 58, 58);
              if (bot) {
                mctx.drawImage(sheet, bot.tx * TILE_SRC, bot.ty * TILE_SRC, TILE_SRC, TILE_SRC,
                               0, 58, 58, 58);
              }
            }
          });

          card.title = name;
          card.addEventListener('mouseenter', () => {
            if (this._infoBar) this._infoBar.textContent = name;
          });
          card.addEventListener('mouseleave', () => {
            if (this._infoBar) this._infoBar.textContent = this.selected ? this._selectedLabel() : '';
          });
          card.addEventListener('click', () => {
            this._selectCard(card);
            this.selected = bot
              ? { kind: 'object', tx, ty, bot }
              : { kind: 'object', tx, ty };
            if (this._prevName) this._prevName.textContent = name;
            if (this._infoBar)  this._infoBar.textContent  = name;
            this._drawPreview(ctx => {
              const sh = getSheet(biome);
              if (sh) ctx.drawImage(sh, tx * TILE_SRC, ty * TILE_SRC, TILE_SRC, TILE_SRC, 0, 0, 58, 58);
            });
          });

          sectionCards.push(card);
          sectionHasCards = true;
        }
      }

      if (sectionHasCards) {
        const lbl = document.createElement('div');
        lbl.className = 'strip-section-lbl';
        lbl.textContent = section.label;
        this._strip.appendChild(lbl);
        sectionCards.forEach(c => this._strip.appendChild(c));
      }
    }
  }

  _buildUnitStrip() {
    for (const type of CHAR_TYPES) {
      // Check if any color variant has loaded
      const hasAny = CHAR_COLORS.some(c => !!getChar(type, c));

      const lbl = document.createElement('div');
      lbl.className = 'strip-section-lbl';
      lbl.textContent = CHAR_TYPE_LABELS[type] ?? type;
      this._strip.appendChild(lbl);

      const colors = CHAR_COLORS_BY_TYPE[type] ?? CHAR_COLORS;
      for (const color of colors) {
        const name = getUnitDisplayName(type, color);

        // Create card; capture the inner canvas for lazy-update
        let innerCanvas;
        const card = this._makeCard(58, 58, mc => {
          innerCanvas = mc;
          const mctx = mc.getContext('2d');
          mctx.imageSmoothingEnabled = false;
          mctx.fillStyle = '#0a1020';
          mctx.fillRect(0, 0, mc.width, mc.height);
          const img = getChar(type, color);
          if (img) mctx.drawImage(img, 0, 0, CHAR_SRC, CHAR_SRC, 0, 0, mc.width, mc.height);
        });

        card.title = name;
        card.addEventListener('mouseenter', () => {
          if (this._infoBar) this._infoBar.textContent = name;
        });
        card.addEventListener('mouseleave', () => {
          if (this._infoBar) this._infoBar.textContent = this.selected ? this._selectedLabel() : '';
        });
        card.addEventListener('click', () => {
          this._selectCard(card);
          this.selected = { kind: 'unit', type, color };
          if (this._prevName) this._prevName.textContent = name;
          if (this._infoBar)  this._infoBar.textContent  = name;
          this._drawPreview(ctx => {
            loadChar(type, color).then(() => {
              ctx.fillStyle = '#0a1020'; ctx.fillRect(0, 0, 58, 58);
              const img = getChar(type, color);
              if (img) ctx.drawImage(img, 0, 0, CHAR_SRC, CHAR_SRC, 0, 0, 58, 58);
            });
          });
        });

        this._strip.appendChild(card);

        // Lazy-load sprite and repaint card if not ready yet
        if (!getChar(type, color)) {
          loadChar(type, color).then(() => {
            if (!innerCanvas) return;
            const mctx = innerCanvas.getContext('2d');
            mctx.imageSmoothingEnabled = false;
            mctx.fillStyle = '#0a1020';
            mctx.fillRect(0, 0, innerCanvas.width, innerCanvas.height);
            const img = getChar(type, color);
            if (img) mctx.drawImage(img, 0, 0, CHAR_SRC, CHAR_SRC, 0, 0, innerCanvas.width, innerCanvas.height);
          });
        }
      }
    }
  }

  // ── Card / preview helpers ────────────────────────────────────────────
  _makeCard(w, h, draw) {
    const card = document.createElement('div');
    card.className = 'strip-card';
    const mc = document.createElement('canvas');
    mc.width = w; mc.height = h;
    draw(mc);
    card.appendChild(mc);
    return card;
  }

  _selectCard(card) {
    this._strip.querySelectorAll('.strip-card').forEach(c => c.classList.remove('sel'));
    card.classList.add('sel');
  }

  _drawPreview(drawFn) {
    const ctx = this._prevCtx;
    ctx.fillStyle = '#0a0500';
    ctx.fillRect(0, 0, this._prevCvs.width, this._prevCvs.height);
    drawFn(ctx);
  }

  _clearPreview() {
    this._prevCtx.fillStyle = '#0a0500';
    this._prevCtx.fillRect(0, 0, this._prevCvs.width, this._prevCvs.height);
  }

  _selectedLabel() {
    const s = this.selected;
    if (!s) return '';
    if (s.kind === 'unit')   return getUnitDisplayName(s.type, s.color);
    if (s.kind === 'object') return getObjectDisplayName(s.tx, s.ty);
    return '';
  }

  // Returns true if the tile at (tx, ty) has any non-transparent pixel
  _tileHasContent(sheet, tx, ty) {
    try {
      const tmp = document.createElement('canvas');
      tmp.width = TILE_SRC; tmp.height = TILE_SRC;
      const ctx = tmp.getContext('2d');
      ctx.drawImage(sheet, tx * TILE_SRC, ty * TILE_SRC, TILE_SRC, TILE_SRC, 0, 0, TILE_SRC, TILE_SRC);
      const data = ctx.getImageData(0, 0, TILE_SRC, TILE_SRC).data;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 30) return true;
      }
      return false;
    } catch (_) {
      return true;
    }
  }
}
