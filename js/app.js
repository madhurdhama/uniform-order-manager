/* ══════════════════════════════════════════════════════
   PRICE TABLES
   ──────────────────────────────────────────────────────
   Format:   "Item Name": { Size: Price, ... }
   Sizes: numbers (26, 28) or strings ("Small", "All")

   TO EDIT A PRICE  → change the number after the size
   TO ADD A SIZE    → add ", 46: 500" inside the { }
   TO ADD AN ITEM   → copy a line, change name + prices
   TO REMOVE ITEM   → delete the whole line
══════════════════════════════════════════════════════ */

const PRICES = {
  badagaon: {
    "Tie":          { "Small": 50, "Large": 100 },
    "Belt":         { "All": 100 },
    "Socks":        { "Pair": 30 },
    "Suit":         { "All": 350 },
    "Trouser":      { "All": 350 },
    "Jacket":       { "All": 300 },
    "Half Lower":   { 20: 250, 22: 250, 24: 250 },
    "Half T-Shirt": { 20: 350, 22: 350, 24: 400 },
    "Lower":        { 26: 300, 28: 300, 30: 325, 32: 325, 34: 350, 36: 350, 38: 375, 40: 400, 42: 425, 44: 450 },
    "T-Shirt":      { 26: 300, 28: 300, 30: 325, 32: 325, 34: 350, 36: 350, 38: 375, 40: 400, 42: 425, 44: 450 },
    "Pant":         { 20: 300, 22: 300, 24: 300, 26: 325, 28: 325, 30: 350, 32: 350, 34: 375, 36: 375, 38: 400, 40: 400, 42: 425, 44: 450 },
    "Shirt":        { 20: 300, 22: 300, 24: 300, 26: 325, 28: 325, 30: 350, 32: 350, 34: 375, 36: 375, 38: 400, 40: 400, 42: 425, 44: 450 }
  },
  baghpat: {
    "Tie":          { "Small": 50, "Large": 100 },
    "Belt":         { "All": 100 },
    "Socks":        { "Pair": 40 },
    "Suit":         { "All": 400 },
    "Trouser":      { "All": 400 },
    "Jacket":       { "All": 300 },
    "Half Lower":   { 20: 250, 22: 250, 24: 250, 26: 250, 28: 300, 30: 300 },
    "Half T-Shirt": { 20: 350, 22: 350, 24: 400, 26: 400, 28: 400, 30: 400 },
    "Lower":        { 20: 350, 22: 350, 24: 375, 26: 375, 28: 400, 30: 400, 32: 425, 34: 425, 36: 450, 38: 450, 40: 475, 42: 475, 44: 500 },
    "T-Shirt":      { 20: 350, 22: 350, 24: 375, 26: 375, 28: 400, 30: 400, 32: 425, 34: 425, 36: 450, 38: 450, 40: 475, 42: 475, 44: 500 },
    "Pant":         { 20: 350, 22: 350, 24: 375, 26: 375, 28: 400, 30: 400, 32: 425, 34: 425, 36: 450, 38: 450, 40: 475, 42: 475, 44: 500 },
    "Shirt":        { 20: 350, 22: 350, 24: 375, 26: 375, 28: 400, 30: 400, 32: 425, 34: 425, 36: 450, 38: 450, 40: 475, 42: 475, 44: 500 }, 
  }
};

/* ══════════════════════════════════════════════════════
   COMBO SETS
   Add new combos here — buttons appear automatically.
══════════════════════════════════════════════════════ */

const COMBOS = {
  'pant-shirt':   { item1: 'Pant',       item2: 'Shirt',        label: 'Pant & Shirt Set' },
  'lower-tshirt': { item1: 'Lower',      item2: 'T-Shirt',      label: 'Lower & T-Shirt Set' },
  'half-set':     { item1: 'Half Lower', item2: 'Half T-Shirt', label: 'Half Lower & T-Shirt Set' }
};

/* ══════════════════════════════════════════════════════
   APP STATE
══════════════════════════════════════════════════════ */

let currentLocation = 'badagaon';  // active location
let paymentMode     = 'pending';   // resets to pending after each save
let eoOrderId       = null;        // id of order being edited
let eoPayMode       = 'cash';      // payment mode in edit screen
let itemCounter     = 0;           // global — keeps item element IDs unique
let dateFilter      = 'all';       // saved orders date filter
let orderCounter    = parseInt(localStorage.getItem('uniform_order_counter') || '0');
let savedOrders     = JSON.parse(localStorage.getItem('uniform_orders2') || '[]');

// Sheet picker state
let sheetTarget     = null;  // 'new' or 'eo' — which screen opened the sheet
let siItem          = null;  // selected item name in single-item sheet
let siSize          = null;  // selected size in single-item sheet
let qsSize          = null;  // selected size in quick-set sheet
let coType          = null;  // combo type key in combo sheet
let coSize1         = null;  // selected size in combo sheet
let pendingDeleteId = null; // order id waiting for delete confirmation

/* ══════════════════════════════════════════════════════
   TOAST NOTIFICATIONS
   Replaces alert() for success/info — no tap needed.
   Type: 'info' (default, dark) or 'error' (red).
══════════════════════════════════════════════════════ */

function toast(message, type = 'info', duration = 2500) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast' + (type === 'error' ? ' error' : '');
  el.textContent = message;
  container.appendChild(el);

  // Trigger animation
  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.classList.add('show'));
  });

  // Auto-dismiss
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 250);
  }, duration);
}

/* ══════════════════════════════════════════════════════
   UTILITY FUNCTIONS
══════════════════════════════════════════════════════ */

// Short alias for getElementById
const $         = id => document.getElementById(id);

// Format number as "Rs.1,250"
const rupees    = n  => 'Rs.' + n.toLocaleString('en-IN');

// Persist orders to localStorage
const saveLocal = () => localStorage.setItem('uniform_orders2', JSON.stringify(savedOrders));

// Save order counter to localStorage
const saveCounter = () => localStorage.setItem('uniform_order_counter', String(orderCounter));

// Get price table for the active location
const getPrices = () => PRICES[currentLocation];

// Get unit price — tries string key first, then numeric
function getUnitPrice(itemName, size) {
  const t = getPrices();
  return t[itemName]?.[size] || t[itemName]?.[parseInt(size)] || 0;
}

// Build <option> tags for a size dropdown, pre-selecting selectedSize
function getSizeOptions(itemName, selectedSize) {
  return Object.keys(getPrices()[itemName] || {})
    .map(s => `<option${String(s) === String(selectedSize) ? ' selected' : ''}>${s}</option>`)
    .join('');
}

// Move focus to next field when Enter is pressed (faster data entry)
function onEnter(event, nextId) {
  if (event.key === 'Enter') { event.preventDefault(); $(nextId)?.focus(); }
}

/* ══════════════════════════════════════════════════════
   LOCATION / PAYMENT MODE
══════════════════════════════════════════════════════ */

function setLocation(loc) {
  currentLocation = loc;
  ['badagaon', 'baghpat'].forEach(l => $('loc-' + l).classList.toggle('active', l === loc));
  // Clear items since prices differ between locations
  $('items-container').innerHTML = '';
  itemCounter = 0;
  recalc();
}

function setPayment(mode) {
  paymentMode = mode;
  ['cash', 'online', 'pending'].forEach(m => $('pay-' + m).classList.toggle('active', m === mode));
}

function setEoPay(mode) {
  eoPayMode = mode;
  ['cash', 'online', 'pending'].forEach(m => $('eo-pay-' + m).classList.toggle('active', m === mode));
}

/* ══════════════════════════════════════════════════════
   BUILD ADD BUTTONS
   Called on init and when entering edit screen.
   isEo = true when building for the edit order screen.
══════════════════════════════════════════════════════ */

function buildAddButtons(containerId, isEo) {
  const target = isEo ? 'eo' : 'new';

  // Green full-set button at top
  let html = `<button class="add-btn quickset" onclick="openQsSheet('${target}')">
    Full Set (Pant+Shirt+Lower+T-Shirt+Tie+Belt+Socks)
  </button>`;

  // Combo set buttons (purple) — each opens the combo sheet
  Object.entries(COMBOS).forEach(([key, cfg]) => {
    html += `<button class="add-btn combo" onclick="openCoSheet('${target}','${key}')">${cfg.label}</button>`;
  });

  html += `<button class="add-btn combo" onclick="openCoSheet('${target}','suit-set')">Suit Set</button>`;

  // Single item button — opens the single-item sheet
  html += `<button class="add-btn" onclick="openSiSheet('${target}')">+ Single Item</button>`;

  $(containerId).innerHTML = html;
}

/* ══════════════════════════════════════════════════════
   BOTTOM SHEET HELPERS
   All three sheets (Quick Set, Single Item, Combo) share
   the same open/close mechanism. Tapping the dark backdrop
   closes the sheet; tapping the sheet itself does nothing.
══════════════════════════════════════════════════════ */

function openSheet(id) { $(id).classList.add('open'); }

function closeSheet(id, event) {
  // If called from onclick backdrop, only close if tap was on backdrop itself
  if (event && event.target !== $(id)) return;
  $(id).classList.remove('open');
}

// Quantity stepper used by all sheets
function stepQty(spanId, delta) {
  const el  = $(spanId);
  const val = Math.max(1, Math.min(99, parseInt(el.textContent) + delta));
  el.textContent = val;
}

// Build chip grid from an array of values
function buildChips(containerId, values, selectedValue, onClickFn) {
  $(containerId).innerHTML = values.map(v => `
    <div class="chip${String(v) === String(selectedValue) ? ' selected' : ''}"
         onclick="${onClickFn}('${v}',this)">${v}</div>
  `).join('');
}

// Select a chip — deselect siblings first
function selectChip(containerId, value, el) {
  $(containerId).querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  return value;
}

/* ══════════════════════════════════════════════════════
   QUICK-SET SHEET
   One size → 7 items added at once.
   Tie auto-set: Large for size ≥34, Small otherwise.
══════════════════════════════════════════════════════ */

function openQsSheet(target) {
  sheetTarget = target;
  $('qs-qty').textContent = '1';

  const sizes = [26, 28, 30, 32, 34, 36, 38, 40, 42, 44];
  qsSize = String(sizes[0]);
  buildChips('qs-sizes', sizes, qsSize, 'selectQsSize');
  openSheet('qs-modal');
}

function selectQsSize(size, el) {
  qsSize = selectChip('qs-sizes', size, el);
}

function confirmQuickSet() {
  closeSheet('qs-modal');

  const isEo   = sheetTarget === 'eo';
  const ctr    = isEo ? 'eo-items-container' : 'items-container';
  const pfx    = isEo ? 'e' : 'n';
  const fn     = isEo ? 'eoRecalc' : 'recalc';
  const size   = String(qsSize);
  const tieSz  = parseInt(size) >= 34 ? 'Large' : 'Small';
  const qty    = parseInt($('qs-qty').textContent);

  _addCombo(ctr, pfx, fn, 'pant-shirt',   size, size, qty);
  _addCombo(ctr, pfx, fn, 'lower-tshirt', size, size, qty);
  _addItem(ctr,  pfx, fn, 'Tie',   tieSz, qty);
  _addItem(ctr,  pfx, fn, 'Belt',  'All', qty);
  _addItem(ctr,  pfx, fn, 'Socks', 'Pair', qty * 2);  // always 2 pairs per set
}

/* ══════════════════════════════════════════════════════
   SINGLE ITEM SHEET
   Pick item name → sizes update → pick size → add.
══════════════════════════════════════════════════════ */

function openSiSheet(target) {
  sheetTarget = target;
  siItem      = null;
  siSize      = null;
  $('si-qty').textContent = '1';

  const items = Object.keys(getPrices());
  buildChips('si-items', items, null, 'selectSiItem');
  $('si-sizes').innerHTML = '<div style="color:var(--text-3);font-size:12px">Select an item first</div>';
  openSheet('si-modal');
}

function selectSiItem(item, el) {
  siItem = selectChip('si-items', item, el);
  siSize = null;
  // Build size chips for this item
  const sizes = Object.keys(getPrices()[item] || {});
  // Auto-select the first size (lowest number, or "All"/"Pair"/"Small")
  // This is especially useful for Belt (All), Socks (Pair), Suit (All) etc.
  siSize = String(sizes[0]);
  buildChips('si-sizes', sizes, siSize, 'selectSiSize');
}

function selectSiSize(size, el) {
  siSize = selectChip('si-sizes', size, el);
}

function confirmSingleItem() {
  if (!siItem) { toast('Select an item first', 'error'); return; }
  if (!siSize) { toast('Select a size first', 'error');  return; }
  closeSheet('si-modal');

  const isEo = sheetTarget === 'eo';
  const ctr  = isEo ? 'eo-items-container' : 'items-container';
  const pfx  = isEo ? 'e' : 'n';
  const fn   = isEo ? 'eoRecalc' : 'recalc';
  const qty  = parseInt($('si-qty').textContent);

  _addItem(ctr, pfx, fn, siItem, String(siSize), qty);
}

/* ══════════════════════════════════════════════════════
   COMBO SHEET
   Single size picker — both items get the same size.
   For Suit Set: no size needed (fixed "All" price).
   User can adjust individual sizes in the row after adding.
══════════════════════════════════════════════════════ */

function openCoSheet(target, type) {
  sheetTarget = target;
  coType      = type;
  coSize1     = null;
  $('co-qty').textContent = '1';

  if (type === 'suit-set') {
    const p    = getPrices();
    const unit = p['Suit']['All'] + p['Trouser']['All'] + p['Jacket']['All'];
    $('co-title').textContent  = 'Suit Set';
    $('co-sub').textContent    = `Suit + Trouser + Jacket = ${rupees(unit)} each`;
    $('co-label1').textContent = '';
    $('co-sizes1').innerHTML   = '';
  } else {
    const cfg   = COMBOS[type];
    // Use item1 sizes for the single picker (item2 always has matching sizes)
    const sizes = Object.keys(getPrices()[cfg.item1] || {});
    $('co-title').textContent  = cfg.label;
    $('co-sub').textContent    = 'Both items use the same size';
    $('co-label1').textContent = 'Select size';
    // Auto-select first (lowest) size so user can just tap Add for common orders
    coSize1 = String(sizes[0]);
    buildChips('co-sizes1', sizes, coSize1, 'selectCoSize1');
  }

  openSheet('co-modal');
}

function selectCoSize1(size, el) {
  coSize1 = selectChip('co-sizes1', size, el);
}

function confirmCombo() {
  const isEo = sheetTarget === 'eo';
  const ctr  = isEo ? 'eo-items-container' : 'items-container';
  const pfx  = isEo ? 'e' : 'n';
  const fn   = isEo ? 'eoRecalc' : 'recalc';
  const qty  = parseInt($('co-qty').textContent);

  if (coType === 'suit-set') {
    closeSheet('co-modal');
    _addCombo(ctr, pfx, fn, 'suit-set', null, null, qty);
    return;
  }

  if (!coSize1) { toast('Select a size first', 'error'); return; }
  closeSheet('co-modal');
  // Both item1 and item2 get the same size
  _addCombo(ctr, pfx, fn, coType, String(coSize1), String(coSize1), qty);
}

/* ══════════════════════════════════════════════════════
   ADD SINGLE ITEM ROW (internal)
   prefix = 'n' (new order) or 'e' (edit screen) — keeps IDs unique
   recalcFn = name of recalc function to call on any change
   defaultItem/Size/Qty used when restoring a saved order
══════════════════════════════════════════════════════ */

function _addItem(containerId, prefix, recalcFn, defaultItem, defaultSize, defaultQty) {
  itemCounter++;
  const id        = prefix + itemCounter;
  const itemNames = Object.keys(getPrices());
  const firstItem = defaultItem || itemNames[0];
  const qty       = defaultQty  || 1;

  const itemOptions = itemNames
    .map(n => `<option${n === firstItem ? ' selected' : ''}>${n}</option>`)
    .join('');

  const row = document.createElement('div');
  row.className    = 'item-row';
  row.id           = 'item-' + id;
  row.dataset.type = 'single';
  row.innerHTML = `
    <select id="isel-${id}" onchange="onItemChange('${id}','${recalcFn}')">${itemOptions}</select>
    <select id="ssel-${id}" onchange="${recalcFn}()">${getSizeOptions(firstItem, defaultSize)}</select>
    <input  id="qty-${id}"  type="number" value="${qty}" min="1" max="99" style="text-align:center" oninput="${recalcFn}()">
    <div    id="price-${id}" class="item-price">Rs.0</div>
    <button class="remove-btn" onclick="removeItem('${id}','${recalcFn}')">&#215;</button>
  `;
  $(containerId).appendChild(row);
  window[recalcFn]();
}

/* ══════════════════════════════════════════════════════
   ADD COMBO ROW (internal)
   Regular combos show as one row with a small expand
   toggle — tap to reveal each item with its own × button
   so either item can be removed independently.
   Suit Set stays as one fixed row (no individual sizes).
══════════════════════════════════════════════════════ */

function _addCombo(containerId, prefix, recalcFn, type, defaultSize1, defaultSize2, defaultQty) {
  itemCounter++;
  const id  = prefix + itemCounter;
  const qty = defaultQty || 1;
  const row = document.createElement('div');
  row.className = 'combo-row';
  row.id        = 'item-' + id;

  if (type === 'suit-set') {
    const p    = getPrices();
    const unit = p['Suit']['All'] + p['Trouser']['All'] + p['Jacket']['All'];
    row.dataset.type = 'suit-set';
    row.innerHTML = `
      <div class="combo-top">
        <div style="font-size:12px;font-weight:600;color:var(--text-2)">Suit Set</div>
        <input id="qty-${id}" type="number" value="${qty}" min="1" max="99" style="text-align:center" oninput="${recalcFn}()">
        <div id="price-${id}" class="item-price">${rupees(unit)}</div>
        <button class="remove-btn" onclick="removeItem('${id}','${recalcFn}')">&#215;</button>
      </div>
      <div style="font-size:11px;color:var(--text-3);padding:2px 0 4px">
        Suit ${rupees(p['Suit']['All'])} + Trouser ${rupees(p['Trouser']['All'])} + Jacket ${rupees(p['Jacket']['All'])} = ${rupees(unit)} each
      </div>`;

  } else {
    const cfg = COMBOS[type];
    row.dataset.type  = 'combo';
    row.dataset.item1 = cfg.item1;
    row.dataset.item2 = cfg.item2;

    // Each item line has its own × button.
    // Removing one item degrades the combo to a single-item row.
    // Removing both removes the whole combo row.
    const sid1 = id + 'a';
    const sid2 = id + 'b';

    row.innerHTML = `
      <div class="combo-top">
        <div style="font-size:12px;font-weight:600;color:var(--text-2)">${cfg.label}</div>
        <input id="qty-${id}" type="number" value="${qty}" min="1" max="99" style="text-align:center" oninput="${recalcFn}()">
        <div id="price-${id}" class="item-price">Rs.0</div>
        <button class="remove-btn" onclick="removeItem('${id}','${recalcFn}')" title="Remove both">&#215;</button>
      </div>
      <div class="combo-sub">
        <div class="combo-item-row" id="crow-${sid1}">
          <div class="combo-label">${cfg.item1}</div>
          <select id="s1-${id}" onchange="${recalcFn}()">${getSizeOptions(cfg.item1, defaultSize1)}</select>
          <button class="remove-btn" style="width:24px;height:24px;font-size:14px" onclick="removeComboItem('${sid1}','${id}','${recalcFn}')" title="Remove ${cfg.item1}">&#215;</button>
        </div>
        <div class="combo-item-row" id="crow-${sid2}">
          <div class="combo-label">${cfg.item2}</div>
          <select id="s2-${id}" onchange="${recalcFn}()">${getSizeOptions(cfg.item2, defaultSize2 || defaultSize1)}</select>
          <button class="remove-btn" style="width:24px;height:24px;font-size:14px" onclick="removeComboItem('${sid2}','${id}','${recalcFn}')" title="Remove ${cfg.item2}">&#215;</button>
        </div>
      </div>`;
  }

  $(containerId).appendChild(row);
  window[recalcFn]();
}

/* ══════════════════════════════════════════════════════
   ITEM HELPERS
══════════════════════════════════════════════════════ */

// When item name dropdown changes, refresh its size dropdown
function onItemChange(id, recalcFn) {
  $('ssel-' + id).innerHTML = getSizeOptions($('isel-' + id).value);
  window[recalcFn]();
}

// Remove an item row and recalculate total
function removeItem(id, recalcFn) {
  const el = $('item-' + id);
  if (el) el.remove();
  window[recalcFn]();
}

// Remove one item from a combo row.
// sid = sub-row id ('n1a' or 'n1b'), comboId = parent combo id ('n1').
// If the other sub-row is still present, the combo keeps working with one side hidden.
// If both are gone, the whole combo row is removed.
function removeComboItem(sid, comboId, recalcFn) {
  const subRow  = $('crow-' + sid);
  const comboEl = $('item-' + comboId);
  if (!subRow || !comboEl) return;

  subRow.remove();

  // Check how many item rows remain inside the combo
  const remaining = comboEl.querySelectorAll('.combo-item-row');
  if (remaining.length === 0) {
    // Both items removed — remove the whole combo row
    comboEl.remove();
  } else {
    // One item remains — hide the combo-top label and show it as a plain row
    const topLabel = comboEl.querySelector('.combo-top div');
    if (topLabel) topLabel.style.fontSize = '11px';
  }
  window[recalcFn]();
}


/* ══════════════════════════════════════════════════════
   RECALCULATE TOTALS
   Loops all item rows, updates each line price display,
   shows per-line breakdown when qty > 1, updates grand total.
══════════════════════════════════════════════════════ */

function _recalc(containerId, totalId) {
  let subtotal = 0;

  $(containerId).querySelectorAll('[id^="item-"]').forEach(row => {
    const id      = row.id.replace('item-', '');
    const type    = row.dataset.type;
    const qtyEl   = $('qty-'   + id);
    const priceEl = $('price-' + id);
    if (!qtyEl) return;

    const qty = parseInt(qtyEl.value) || 1;
    let unit = 0;

    if (type === 'single') {
      const is = $('isel-' + id), ss = $('ssel-' + id);
      if (!is) return;
      unit = getUnitPrice(is.value, ss.value);
    } else if (type === 'suit-set') {
      const p = getPrices();
      unit = p['Suit']['All'] + p['Trouser']['All'] + p['Jacket']['All'];
    } else if (type === 'combo') {
      const s1 = $('s1-' + id);
      const s2 = $('s2-' + id);
      // Handle partial combos — one item may have been removed
      if (s1) unit += getUnitPrice(row.dataset.item1, s1.value);
      if (s2) unit += getUnitPrice(row.dataset.item2, s2.value);
      // If both selectors gone (shouldn't happen, but guard anyway)
      if (!s1 && !s2) return;
    }

    const line = unit * qty;
    subtotal += line;
    priceEl.textContent = rupees(line);
  });

  $(totalId).textContent = rupees(subtotal);
  return subtotal;
}

/* ── Public wrappers ── */
function addItem(di, ds, dq)         { _addItem('items-container',  'n', 'recalc',   di, ds, dq); }
function addCombo(type, s1, s2, qty) { _addCombo('items-container', 'n', 'recalc',   type, s1, s2, qty); }
function recalc()                    { _recalc('items-container',   'grand-total'); }
function eoAddItem(di, ds, dq)         { _addItem('eo-items-container',  'e', 'eoRecalc', di, ds, dq); }
function eoAddCombo(type, s1, s2, qty) { _addCombo('eo-items-container', 'e', 'eoRecalc', type, s1, s2, qty); }
function eoRecalc()                    { _recalc('eo-items-container',   'eo-grand-total'); }

/* ══════════════════════════════════════════════════════
   COLLECT ITEMS
   Reads all item rows and returns { items, subtotal }.
   Called before saving or updating an order.
══════════════════════════════════════════════════════ */

function collectItems(containerId) {
  let items = [], subtotal = 0;

  $(containerId).querySelectorAll('[id^="item-"]').forEach(row => {
    const id   = row.id.replace('item-', '');
    const type = row.dataset.type;
    const qty  = parseInt($('qty-' + id)?.value) || 1;
    let unit = 0, label = '', extra = {};

    if (type === 'single') {
      const is = $('isel-' + id), ss = $('ssel-' + id);
      if (!is) return;
      unit  = getUnitPrice(is.value, ss.value);
      label = `${is.value} (${ss.value})${qty > 1 ? ' x ' + qty : ''}`;
    } else if (type === 'suit-set') {
      const p = getPrices();
      unit    = p['Suit']['All'] + p['Trouser']['All'] + p['Jacket']['All'];
      label   = `Suit Set (Suit + Trouser + Jacket)${qty > 1 ? ' x ' + qty : ''}`;
      extra   = { isSuitSet: true };
    } else if (type === 'combo') {
      const s1 = $('s1-' + id);
      const s2 = $('s2-' + id);
      if (!s1 && !s2) return;
      const name1 = row.dataset.item1;
      const name2 = row.dataset.item2;
      if (s1) unit += getUnitPrice(name1, s1.value);
      if (s2) unit += getUnitPrice(name2, s2.value);
      // Build label from whichever items remain
      const parts = [];
      if (s1) parts.push(`${name1} (${s1.value})`);
      if (s2) parts.push(`${name2} (${s2.value})`);
      label = parts.join(' + ') + (qty > 1 ? ' x ' + qty : '');
      extra = { isCombo: true };
    }

    const lineTotal = unit * qty;
    subtotal += lineTotal;
    items.push({ label, lineTotal, ...extra });
  });

  return { items, subtotal };
}

/* ══════════════════════════════════════════════════════
   SAVE ORDER
   Auto-assigns an order number (#001, #002, ...).
══════════════════════════════════════════════════════ */

function saveOrder() {
  const sname = $('sname').value.trim();
  if (!sname) { toast('Please enter student name', 'error'); return; }
  if (!$('items-container').querySelector('[id^="item-"]')) { toast('Please add at least one item', 'error'); return; }

  const { items, subtotal } = collectItems('items-container');

  orderCounter++;
  saveCounter();

  const order = {
    id:          Date.now(),
    orderNum:    orderCounter,     // unique order number shown as #001
    location:    currentLocation,
    sname,
    sclass:      $('sclass').value.trim(),
    pname:       $('pname').value.trim(),
    mobile:      $('mobile').value.trim(),
    notes:       $('notes').value.trim(),
    paymentMode,
    items,
    subtotal,
    discount:    0,
    finalAmt:    subtotal,
    date:        new Date().toLocaleDateString('en-IN')
  };

  savedOrders.unshift(order);
  saveLocal();
  toast(`Order #${String(orderCounter).padStart(3,'0')} saved — ${sname}, ${rupees(subtotal)}`);
  resetForm();
}

function resetForm() {
  ['sname', 'sclass', 'pname', 'mobile', 'notes'].forEach(id => $(id).value = '');
  $('items-container').innerHTML = '';
  itemCounter = 0;
  setPayment('pending');
  recalc();
  $('sname').focus();
}

/* ══════════════════════════════════════════════════════
   TABS
══════════════════════════════════════════════════════ */

function showTab(tab) {
  $('tab-new').style.display    = tab === 'new'    ? '' : 'none';
  $('tab-orders').style.display = tab === 'orders' ? '' : 'none';
  document.querySelectorAll('.tab').forEach((el, i) =>
    el.classList.toggle('active', (i===0&&tab==='new') || (i===1&&tab==='orders'))
  );
  if (tab === 'orders') renderOrders('');
}

/* ══════════════════════════════════════════════════════
   DATE FILTER
══════════════════════════════════════════════════════ */

function setDateFilter(filter) {
  dateFilter = filter;
  ['all', 'today', 'week'].forEach(f => $('filter-' + f).classList.toggle('active', f === filter));
  renderOrders($('tab-orders').querySelector('.search-box input')?.value || '');
}

// Returns true if the order's date matches the active filter
function matchesDateFilter(order) {
  if (dateFilter === 'all') return true;
  const parts     = (order.date || '').split('/');
  const orderDate = new Date(parts[2], parts[1] - 1, parts[0]);
  const now       = new Date();
  const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (dateFilter === 'today') return orderDate.getTime() === today.getTime();
  if (dateFilter === 'week') {
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 6);
    return orderDate >= weekAgo && orderDate <= today;
  }
  return true;
}

/* ══════════════════════════════════════════════════════
   RENDER SAVED ORDERS
   Applies date filter + search query, updates pending
   banner, renders all order cards.
══════════════════════════════════════════════════════ */

function renderOrders(query) {
  query = (query || '').toLowerCase();

  const filtered = savedOrders.filter(o => {
    if (!matchesDateFilter(o)) return false;
    const orderNumStr = o.orderNum ? '#' + String(o.orderNum).padStart(3,'0') : '';
    return (
      (o.sname    || '').toLowerCase().includes(query) ||
      (o.sclass   || '').toLowerCase().includes(query) ||
      (o.mobile   || '').includes(query)               ||
      (o.location || '').toLowerCase().includes(query) ||
      (o.notes    || '').toLowerCase().includes(query) ||
      orderNumStr.includes(query)   // search by #047 or just 47
    );
  });

  // Pending banner: total count + how many from today
  const now          = new Date();
  const todayStart   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const pendingAll   = savedOrders.filter(o => o.paymentMode === 'pending');
  const pendingToday = pendingAll.filter(o => {
    const p = (o.date || '').split('/');
    return new Date(p[2], p[1] - 1, p[0]).getTime() === todayStart.getTime();
  });
  const banner = $('pending-banner');
  if (pendingAll.length > 0) {
    banner.style.display = 'flex';
    $('pending-count').textContent = pendingAll.length;
    $('pending-today').textContent = pendingToday.length > 0
      ? `${pendingToday.length} from today` : 'none today';
    banner.onclick = () => {
      setDateFilter('all');
      $('tab-orders').querySelector('.search-box input').value = '';
      renderOrders('');
      setTimeout(() => {
        const first = document.querySelector('.badge.pending');
        if (first) first.closest('.order-card')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    };
  } else {
    banner.style.display = 'none';
  }

  const totalAmt = filtered.reduce((s, o) => s + o.finalAmt, 0);
  $('orders-summary').textContent =
    `${filtered.length} order${filtered.length !== 1 ? 's' : ''} - Total: ${rupees(totalAmt)}`;

  if (filtered.length === 0) {
    $('orders-list').innerHTML = '<div class="empty">No orders found</div>';
    return;
  }

  $('orders-list').innerHTML = filtered.map(o => {
    const mode     = o.paymentMode || 'cash';
    const loc      = o.location    || 'badagaon';
    const orderNum = o.orderNum ? `<span style="display:inline-flex;align-items:center;font-size:11px;font-weight:600;font-family:monospace;padding:2px 8px;border-radius:20px;background:#f3f4f6;color:#6b7280">#${String(o.orderNum).padStart(3,'0')}</span>` : '';
    const PAY_TEXT = { cash: 'Cash', online: 'Online', pending: 'Pending' };
    const LOC_TEXT = { badagaon: 'Badagaon', baghpat: 'Baghpat' };
    const itemCount = (o.items || []).length;

    const menuIcon = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="8" cy="2.5" r="1.4"/>
      <circle cx="8" cy="8"   r="1.4"/>
      <circle cx="8" cy="13.5" r="1.4"/>
    </svg>`;

    return `
      <div class="order-card" id="card-${o.id}">

        <div class="order-card-top">
          <div style="flex:1;min-width:0">

            <!-- Name + class -->
            <div class="order-name">
              ${o.sname || ''}
              <span style="font-size:12px;font-weight:400;color:var(--text-3)">${o.sclass || ''}</span>
            </div>

            <!-- Parent · mobile on their own line -->
            ${(o.pname || o.mobile) ? `
            <div class="order-contact">
              ${[o.pname, o.mobile].filter(Boolean).join(' · ')}
            </div>` : ''}

            <!-- Location · date below contact -->
            <div class="order-contact" style="margin-top:1px">
              ${[LOC_TEXT[loc], o.date].join(' · ')}
            </div>

            <!-- Payment badge -->
            <div style="margin-top:6px;display:flex;align-items:center;gap:5px">
              <span class="badge ${mode}">${PAY_TEXT[mode]}</span>
              ${orderNum}
            </div>

            ${o.notes ? `<div style="font-size:12px;color:var(--orange);margin-top:4px;display:flex;align-items:center;gap:4px;font-style:italic"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>${o.notes}</div>` : ''}
          </div>

          <!-- Menu + amount + discount top-right -->
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;margin-left:10px;flex-shrink:0">
            <div class="menu-wrap" id="menu-wrap-${o.id}">
              <button class="menu-btn" onclick="toggleMenu(${o.id})" title="More options">${menuIcon}</button>
              <div class="menu-dropdown" id="menu-${o.id}">
                <button class="menu-item" onclick="closeMenu(${o.id});openEditOrder(${o.id})">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Edit Order
                </button>
                <button class="menu-item" onclick="closeMenu(${o.id});toggleEditPayment(${o.id})">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>Edit Payment
                </button>
                <button class="menu-item destructive" onclick="closeMenu(${o.id});deleteOrder(${o.id})">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>Delete
                </button>
              </div>
            </div>
            <div class="order-amount">${rupees(o.finalAmt)}</div>
            ${o.discount > 0 ? `<div class="discount-badge" style="text-align:right">-${rupees(o.discount)} off</div>` : ''}
          </div>
        </div>

        <!-- Bottom bar: Send Bill left, items toggle right -->
        <div class="card-bottom">
          <button class="action-btn" onclick="openWhatsApp(${o.id})">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Send Bill
          </button>
          <button class="items-toggle-btn" onclick="toggleItems(${o.id})">
            ${itemCount} item${itemCount !== 1 ? 's' : ''}
            <span class="items-chevron" id="chev-${o.id}">▸</span>
          </button>
        </div>

        <!-- Collapsible item lines -->
        <div class="order-items" id="items-${o.id}" style="display:none">
          ${(o.items || []).map(i => `
            <div class="order-item-line">
              <span>${i.label}</span>
              <span>${rupees(i.lineTotal)}</span>
            </div>`).join('')}
          <div class="order-final-row">
            <span>Subtotal</span>
            <span>${rupees(o.subtotal)}</span>
          </div>
          ${o.finalAmt !== o.subtotal ? `
          <div class="order-final-row" style="color:#dc2626">
            <span>Paid (after discount)</span>
            <span>${rupees(o.finalAmt)}</span>
          </div>` : ''}
        </div>

        <!-- Edit payment panel -->
        <div class="edit-panel" id="edit-${o.id}">
          <div class="edit-panel-title">Update Payment</div>
          <div class="edit-pay-toggle">
            <button class="edit-pay-btn ${mode==='pending'?'pending-active':''}" id="ep-pending-${o.id}" onclick="setEditPay(${o.id},'pending')">Pending</button>
            <button class="edit-pay-btn ${mode==='cash'   ?'cash-active'   :''}" id="ep-cash-${o.id}"    onclick="setEditPay(${o.id},'cash')">Cash</button>
            <button class="edit-pay-btn ${mode==='online' ?'online-active' :''}" id="ep-online-${o.id}"  onclick="setEditPay(${o.id},'online')">Online</button>
          </div>
          <div class="edit-amount-row">
            <label>Amount Paid (Rs.)</label>
            <input type="number" id="ep-amt-${o.id}" value="${o.finalAmt}" min="0">
          </div>
          <div class="edit-orig">
            Original total: ${rupees(o.subtotal)}
            ${o.discount > 0 ? ' - Discount: ' + rupees(o.discount) : ''}
          </div>
          <button class="update-btn" onclick="applyEditPayment(${o.id})">Save Changes</button>
        </div>

      </div>`;
  }).join('');
}

/* ══════════════════════════════════════════════════════
   COLLAPSIBLE ITEM LINES
   Tap "N items ▸" to expand/collapse the item list.
══════════════════════════════════════════════════════ */

function toggleItems(id) {
  const panel = $('items-' + id);
  const chev  = $('chev-'  + id);
  const open  = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : 'block';
  chev.textContent    = open ? '▸' : '▾';
}

/* ══════════════════════════════════════════════════════
   THREE-DOT MENU
   Each card has its own dropdown. Tapping ••• opens it;
   tapping outside or choosing an action closes it.
══════════════════════════════════════════════════════ */

function toggleMenu(id) {
  const menu = $('menu-' + id);
  const isOpen = menu.classList.contains('open');
  // Close all other open menus first
  document.querySelectorAll('.menu-dropdown.open').forEach(m => m.classList.remove('open'));
  if (!isOpen) menu.classList.add('open');
}

function closeMenu(id) {
  $('menu-' + id)?.classList.remove('open');
}

// Close any open menu when tapping anywhere outside
document.addEventListener('click', function(e) {
  if (!e.target.closest('.menu-wrap')) {
    document.querySelectorAll('.menu-dropdown.open').forEach(m => m.classList.remove('open'));
  }
});

/* ══════════════════════════════════════════════════════
   DELETE ORDER / EDIT PAYMENT PANEL
══════════════════════════════════════════════════════ */

function openDelModal()  { $('del-modal').classList.add('open');    }
function closeDelModal() { $('del-modal').classList.remove('open'); }

function deleteOrder(id) {
  const order = savedOrders.find(o => o.id === id);
  pendingDeleteId = id;
  $('del-modal-sub').textContent = order
    ? `${order.sname || 'This order'} — ${rupees(order.finalAmt)}. This cannot be undone.`
    : 'This cannot be undone.';
  openDelModal();
}

function confirmDelete() {
  if (!pendingDeleteId) return;
  closeDelModal();
  savedOrders = savedOrders.filter(o => o.id !== pendingDeleteId);
  pendingDeleteId = null;
  saveLocal();
  toast('Order deleted');
  renderOrders($('tab-orders').querySelector('.search-box input')?.value || '');
}

function toggleEditPayment(id) { $('edit-' + id).classList.toggle('open'); }

function setEditPay(id, mode) {
  ['pending','cash','online'].forEach(m => {
    const btn = $(`ep-${m}-${id}`);
    btn.classList.remove('cash-active','online-active','pending-active');
    if (m === mode) btn.classList.add(mode + '-active');
  });
  $('edit-' + id).dataset.chosenMode = mode;
}

function applyEditPayment(id) {
  const panel   = $('edit-' + id);
  const newMode = panel.dataset.chosenMode ||
    ['pending','cash','online'].find(m => $(`ep-${m}-${id}`).classList.contains(m+'-active')) || 'cash';
  const newAmt  = parseInt($(`ep-amt-${id}`).value) || 0;
  const idx     = savedOrders.findIndex(o => o.id === id);
  if (idx === -1) return;
  savedOrders[idx].paymentMode = newMode;
  savedOrders[idx].finalAmt    = newAmt;
  savedOrders[idx].discount    = Math.max(0, savedOrders[idx].subtotal - newAmt);
  saveLocal();
  renderOrders($('tab-orders').querySelector('.search-box input')?.value || '');
}

/* ══════════════════════════════════════════════════════
   FULL ORDER EDIT SCREEN
   Opens a fixed overlay pre-filled with the order's data.
   Rebuilds item rows using parseItemLabel to restore sizes.
══════════════════════════════════════════════════════ */

function openEditOrder(id) {
  const order = savedOrders.find(o => o.id === id);
  if (!order) return;

  eoOrderId       = id;
  itemCounter     = 0;
  currentLocation = order.location || 'badagaon';
  buildAddButtons('add-btns-eo', true);

  $('eo-sname').value  = order.sname  || '';
  $('eo-sclass').value = order.sclass || '';
  $('eo-pname').value  = order.pname  || '';
  $('eo-mobile').value = order.mobile || '';
  $('eo-notes').value  = order.notes  || '';
  setEoPay(order.paymentMode || 'cash');
  $('eo-items-container').innerHTML = '';

  // Map item1 name back to combo type key for restoring combos
  const comboTypeByItem1 = {
    'Pant':       'pant-shirt',
    'Lower':      'lower-tshirt',
    'Half Lower': 'half-set'
  };

  (order.items || []).forEach(savedItem => {
    if (savedItem.isSuitSet) {
      const m = savedItem.label.match(/x (\d+)$/);
      eoAddCombo('suit-set', null, null, m ? parseInt(m[1]) : 1);
    } else if (savedItem.isCombo) {
      const m     = savedItem.label.match(/x (\d+)$/);
      const qty   = m ? parseInt(m[1]) : 1;
      const clean = savedItem.label.replace(/ x \d+$/, '');
      const parts = clean.split(' + ');
      const [n1, s1] = parseItemLabel(parts[0]);
      const [,   s2] = parseItemLabel(parts[1]);
      eoAddCombo(comboTypeByItem1[n1] || 'pant-shirt', s1, s2, qty);
    } else {
      const m   = savedItem.label.match(/x (\d+)$/);
      const qty = m ? parseInt(m[1]) : 1;
      const [name, size] = parseItemLabel(savedItem.label.replace(/ x \d+$/, ''));
      eoAddItem(name, size, qty);
    }
  });

  eoRecalc();
  $('edit-order-screen').classList.add('open');
  window.scrollTo(0, 0);
}

// Helper: "Shirt (30)" → ["Shirt", "30"]
function parseItemLabel(str) {
  const m = str.trim().match(/^(.+?)\s*\((.+)\)$/);
  return m ? [m[1].trim(), m[2].trim()] : [str.trim(), ''];
}

function closeEditOrder() {
  $('edit-order-screen').classList.remove('open');
  eoOrderId = null;
  // Restore location pill to match currentLocation
  // (openEditOrder may have changed it to the order's location)
  ['badagaon', 'baghpat'].forEach(l =>
    $('loc-' + l).classList.toggle('active', l === currentLocation)
  );
  buildAddButtons('add-btns-new', false);
}

function saveEditOrder() {
  const sname = $('eo-sname').value.trim();
  if (!sname) { toast('Please enter student name', 'error'); return; }
  if (!$('eo-items-container').querySelector('[id^="item-"]')) { toast('Please add at least one item', 'error'); return; }

  const { items, subtotal } = collectItems('eo-items-container');
  const idx = savedOrders.findIndex(o => o.id === eoOrderId);
  if (idx === -1) { toast('Order not found', 'error'); return; }

  const orig     = savedOrders[idx];
  // Keep discount only if it still makes sense (not larger than new subtotal)
  const discount = Math.min(orig.discount || 0, subtotal);

  savedOrders[idx] = {
    ...orig,
    sname,
    sclass:      $('eo-sclass').value.trim(),
    pname:       $('eo-pname').value.trim(),
    mobile:      $('eo-mobile').value.trim(),
    notes:       $('eo-notes').value.trim(),
    paymentMode: eoPayMode,
    items, subtotal, discount,
    finalAmt: subtotal - discount
  };

  saveLocal();
  toast(`Order updated — ${sname}, ${rupees(savedOrders[idx].finalAmt)}`);
  closeEditOrder();
  renderOrders($('tab-orders').querySelector('.search-box input')?.value || '');
}


/* ══════════════════════════════════════════════════════
   WHATSAPP BILL
   Opens WhatsApp directly with pre-filled message.
   Fallback: copies to clipboard if WhatsApp not installed.
══════════════════════════════════════════════════════ */

function openWhatsApp(id) {
  const order = savedOrders.find(o => o.id === id);
  if (!order) return;

  const PAY_LABEL  = { cash: 'Cash', online: 'Online', pending: 'Pending' };
  const orderLabel = order.orderNum ? ` | #${String(order.orderNum).padStart(3,'0')}` : '';

  const itemLines = (order.items || [])
    .map(i => `  ${i.label} = Rs.${i.lineTotal.toLocaleString('en-IN')}`)
    .join('\n');

  const discountLine = order.finalAmt !== order.subtotal
    ? `\n  Discount = - Rs.${order.discount.toLocaleString('en-IN')}` : '';

  // Build contact lines cleanly — no blank lines
  const contactLines = [
    order.pname  ? `Parent  : ${order.pname}`  : '',
    order.mobile ? `Mobile  : ${order.mobile}` : ''
  ].filter(Boolean).join('\n');

  const message =
`*Golden Gate International School*
*Uniform Bill${orderLabel}*
-------------------------
Student : ${order.sname || ''}${order.sclass ? ' (' + order.sclass + ')' : ''}
${contactLines ? contactLines + '\n' : ''}Date    : ${order.date}${order.notes ? '\nNote    : ' + order.notes : ''}
-------------------------
${itemLines}${discountLine}
-------------------------
*Total = Rs.${order.finalAmt.toLocaleString('en-IN')}*
Payment : ${PAY_LABEL[order.paymentMode || 'pending']}
-------------------------
Thank you!`;

  // Open WhatsApp directly with pre-filled text
  // wa.me with no phone number opens WhatsApp to choose a contact
  const url = 'https://wa.me/?text=' + encodeURIComponent(message);
  const opened = window.open(url, '_blank');

  // Fallback: if popup blocked or WhatsApp not available, copy to clipboard
  if (!opened) {
    navigator.clipboard.writeText(message)
      .then(() => toast('Copied to clipboard'))
      .catch(() => {
        const ta = document.createElement('textarea');
        ta.value = message;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        toast('Copied to clipboard');
      });
  }
}

/* ══════════════════════════════════════════════════════
   EXPORT CSV
   Downloads all orders as .csv — open in Excel or Sheets.
══════════════════════════════════════════════════════ */

function exportCSV() {
  if (!savedOrders.length) { toast('No orders to export'); return; }

  const headers = ['Order#','Date','Location','Student','Class','Parent','Mobile','Notes',
                   'Items','Subtotal','Discount','Total','Payment'];
  const rows = savedOrders.map(o => [
    o.orderNum ? '#' + String(o.orderNum).padStart(3,'0') : '',
    o.date, o.location || 'badagaon', o.sname || '', o.sclass || '',
    o.pname || '', o.mobile || '', o.notes || '',
    (o.items || []).map(i => i.label + ' = Rs.' + i.lineTotal).join(' | '),
    o.subtotal, o.discount || 0, o.finalAmt, o.paymentMode
  ]);
  const csv  = [headers,...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const link = document.createElement('a');
  link.href     = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  link.download = `uniform-orders-${new Date().toLocaleDateString('en-IN').replace(/\//g,'-')}.csv`;
  link.click();
}

/* ══════════════════════════════════════════════════════
   EXPORT JSON — full backup
   Use this regularly! localStorage is wiped if browser
   cache is cleared or you switch phones/devices.
══════════════════════════════════════════════════════ */

function exportJSON() {
  if (!savedOrders.length) { toast('No orders to export'); return; }
  const backup = { exportedAt: new Date().toISOString(), orderCounter, orders: savedOrders };
  const link   = document.createElement('a');
  link.href     = URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}));
  link.download = `uniform-backup-${new Date().toLocaleDateString('en-IN').replace(/\//g,'-')}.json`;
  link.click();
}

/* ══════════════════════════════════════════════════════
   IMPORT JSON — restore from backup
   Merges with existing orders (skips duplicates by ID).
   Also restores orderCounter so numbering stays correct.
══════════════════════════════════════════════════════ */

function importJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const parsed   = JSON.parse(e.target.result);
      // Support both plain array (old) and object with metadata (new)
      const imported = Array.isArray(parsed) ? parsed : (parsed.orders || []);
      const importRC = parsed.orderCounter || 0;

      if (!imported.length) { toast('No orders found in file', 'error'); return; return; }

      const existingIds = new Set(savedOrders.map(o => o.id));
      const newOrders   = imported.filter(o => o.id && !existingIds.has(o.id));

      if (newOrders.length === 0) {
        toast('All orders already exist');
      } else {
        savedOrders  = [...savedOrders, ...newOrders].sort((a,b) => b.id - a.id);
        orderCounter = Math.max(orderCounter, importRC);
        saveLocal();
        saveCounter();
        renderOrders('');
        toast(`Imported ${newOrders.length} order${newOrders.length !== 1 ? 's' : ''} successfully`);
      }
    } catch (err) {
      toast('Import failed: ' + err.message, 'error', 4000);
    }
    event.target.value = ''; // reset so same file can be re-imported if needed
  };
  reader.readAsText(file);
}

/* ══════════════════════════════════════════════════════
   INIT — runs once when page loads
══════════════════════════════════════════════════════ */

buildAddButtons('add-btns-new', false);
buildAddButtons('add-btns-eo',  true);
recalc();