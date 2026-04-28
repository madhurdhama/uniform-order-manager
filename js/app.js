/* ══════════════════════════════════════════════════════
   PRICE TABLES
══════════════════════════════════════════════════════ */

const PRICES = {
  badagaon: {
    "Tie":          { "Small": 50, "Large": 100 },
    "Belt":         { "All": 100 },
    "Socks":        { "Pair": 30 },
    "Suit":         { "All": 350 },
    "Trouser":      { "All": 350 },
    "Jacket":       { "All": 300 },
    "Half Lower":   { 20: 250, 22: 250, 24: 250, 26: 250, 28: 300, 30: 300 },
    "Half T-Shirt": { 20: 350, 22: 350, 24: 400, 26: 400, 28: 400, 30: 400 },
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
══════════════════════════════════════════════════════ */

const COMBOS = {
  'pant-shirt':   { item1: 'Pant',       item2: 'Shirt',        label: 'Pant & Shirt Set' },
  'lower-tshirt': { item1: 'Lower',      item2: 'T-Shirt',      label: 'Lower & T-Shirt Set' },
  'half-set':     { item1: 'Half Lower', item2: 'Half T-Shirt', label: 'Half Lower & T-Shirt Set' }
};

/* ══════════════════════════════════════════════════════
   APP STATE
══════════════════════════════════════════════════════ */

let currentLocation    = 'badagaon';
let paymentMode        = 'pending';
let eoOrderId          = null;
let itemCounter        = 0;
let dateFilter         = 'all';
let locationFilter     = 'all';
let paymentFilter      = 'all';
let analyticsDate      = 'today';
let analyticsLoc       = 'all';
let orderCounter       = parseInt(localStorage.getItem('uniform_order_counter') || '0');
let savedOrders        = JSON.parse(localStorage.getItem('uniform_orders2') || '[]');

let sheetTarget        = null;
let siItem             = null;
let siSize             = null;
let qsSize             = null;
let coType             = null;
let coSize1            = null;
let pendingDeleteId    = null;
let epOrderId          = null;
let pendingPayDeleteId = null;

const COMBO_TYPE_BY_ITEM1 = {
  'Pant':       'pant-shirt',
  'Lower':      'lower-tshirt',
  'Half Lower': 'half-set'
};

/* ══════════════════════════════════════════════════════
   PAYMENT MODEL HELPERS
══════════════════════════════════════════════════════ */

function normalisedPayments(order) {
  if (order.payments && Array.isArray(order.payments)) return order.payments;
  if (order.paymentMode && order.paymentMode !== 'pending') {
    return [{
      mode:   order.paymentMode,
      amount: order.finalAmt || 0,
      date:   order.date     || ''
    }];
  }
  return [];
}

function totalCollected(order) {
  return normalisedPayments(order).reduce((s, p) => s + (p.amount || 0), 0);
}

function totalDiscount(order) {
  return order.orderDiscount || 0;
}

function balanceDue(order) {
  return Math.max(0, (order.subtotal || 0) - totalCollected(order) - totalDiscount(order));
}

function paymentStatus(order) {
  const payments = normalisedPayments(order);
  if (payments.length === 0) return 'pending';
  if (balanceDue(order) > 0) return 'partial';
  const modes = [...new Set(payments.map(p => p.mode))];
  if (modes.length > 1) return 'split';
  return modes[0] || 'cash';
}

/* ══════════════════════════════════════════════════════
   TOAST NOTIFICATIONS
══════════════════════════════════════════════════════ */

function toast(message, type = 'info', duration = 2500) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast' + (type === 'error' ? ' error' : '');
  el.textContent = message;
  container.appendChild(el);
  requestAnimationFrame(() => { requestAnimationFrame(() => el.classList.add('show')); });
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 250);
  }, duration);
}

/* ══════════════════════════════════════════════════════
   HAMBURGER MENU
══════════════════════════════════════════════════════ */

function toggleHamburger() { $('hamburger-menu').classList.toggle('open'); }
function closeHamburger()  { $('hamburger-menu').classList.remove('open'); }

document.addEventListener('click', function(e) {
  if (!e.target.closest('.header-menu-wrap')) closeHamburger();
});

/* ══════════════════════════════════════════════════════
   UTILITY FUNCTIONS
══════════════════════════════════════════════════════ */

const $           = id => document.getElementById(id);
const rupees      = n  => 'Rs.' + (n || 0).toLocaleString('en-IN');
const saveLocal   = () => localStorage.setItem('uniform_orders2', JSON.stringify(savedOrders));
const saveCounter = () => localStorage.setItem('uniform_order_counter', String(orderCounter));
const getPrices   = () => PRICES[currentLocation];

function getUnitPrice(itemName, size) {
  const t = getPrices();
  return t[itemName]?.[size] || t[itemName]?.[parseInt(size)] || 0;
}

function getSizeOptions(itemName, selectedSize) {
  return Object.keys(getPrices()[itemName] || {})
    .map(s => `<option${String(s) === String(selectedSize) ? ' selected' : ''}>${s}</option>`)
    .join('');
}

function onEnter(event, nextId) {
  if (event.key === 'Enter') { event.preventDefault(); $(nextId)?.focus(); }
}

/* ══════════════════════════════════════════════════════
   LOCATION / PAYMENT MODE
══════════════════════════════════════════════════════ */

function setLocation(loc) {
  currentLocation = loc;
  ['badagaon', 'baghpat'].forEach(l => $('loc-' + l).classList.toggle('active', l === loc));
  $('items-container').innerHTML = '';
  itemCounter = 0;
  recalc();
}

function setPayment(mode) {
  paymentMode = mode;
  ['cash', 'online', 'pending'].forEach(m => $('pay-' + m).classList.toggle('active', m === mode));
  const f = $('paid-amt-field');
  if (f) f.style.display = (mode === 'cash' || mode === 'online') ? '' : 'none';
}
function setPaymentFilter(f) {
  paymentFilter = f;
  ['all','pending'].forEach(k => $('fopt-pay-'+k)?.classList.toggle('active', k === f));
  renderOrders($('tab-orders').querySelector('.search-box input')?.value || '');
  updateFilterBar();
}

/* ══════════════════════════════════════════════════════
   BUILD ADD BUTTONS
══════════════════════════════════════════════════════ */

function buildAddButtons(containerId, isEo) {
  const target = isEo ? 'eo' : 'new';
  let html = `<button class="add-btn quickset" onclick="openQsSheet('${target}')">
    Full Set (Pant+Shirt+Lower+T-Shirt+Tie+Belt+Socks)
  </button>`;
  Object.entries(COMBOS).forEach(([key, cfg]) => {
    html += `<button class="add-btn combo" onclick="openCoSheet('${target}','${key}')">${cfg.label}</button>`;
  });
  html += `<button class="add-btn combo" onclick="openCoSheet('${target}','suit-set')">Suit Set</button>`;
  html += `<button class="add-btn" onclick="openSiSheet('${target}')">+ Single Item</button>`;
  $(containerId).innerHTML = html;
}

/* ══════════════════════════════════════════════════════
   BOTTOM SHEET HELPERS
══════════════════════════════════════════════════════ */

function openSheet(id) { $(id).classList.add('open'); }

function closeSheet(id, event) {
  if (event && event.target !== $(id)) return;
  $(id).classList.remove('open');
}

function stepQty(spanId, delta) {
  const el  = $(spanId);
  const val = Math.max(1, Math.min(99, parseInt(el.textContent) + delta));
  el.textContent = val;
}

function buildChips(containerId, values, selectedValue, onClickFn) {
  $(containerId).innerHTML = values.map(v => `
    <div class="chip${String(v) === String(selectedValue) ? ' selected' : ''}"
         onclick="${onClickFn}('${v}',this)">${v}</div>
  `).join('');
}

function selectChip(containerId, value, el) {
  $(containerId).querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  return value;
}

/* ══════════════════════════════════════════════════════
   QUICK-SET SHEET
══════════════════════════════════════════════════════ */

function openQsSheet(target) {
  sheetTarget = target;
  $('qs-qty').textContent = '1';
  const sizes = [26, 28, 30, 32, 34, 36, 38, 40, 42, 44];
  qsSize = String(sizes[0]);
  buildChips('qs-sizes', sizes, qsSize, 'selectQsSize');
  openSheet('qs-modal');
}

function selectQsSize(size, el) { qsSize = selectChip('qs-sizes', size, el); }

function confirmQuickSet() {
  closeSheet('qs-modal');
  const isEo  = sheetTarget === 'eo';
  const ctr   = isEo ? 'eo-items-container' : 'items-container';
  const pfx   = isEo ? 'e' : 'n';
  const fn    = isEo ? 'eoRecalc' : 'recalc';
  const size  = String(qsSize);
  const tieSz = parseInt(size) >= 34 ? 'Large' : 'Small';
  const qty   = parseInt($('qs-qty').textContent);
  _addCombo(ctr, pfx, fn, 'pant-shirt',   size, size, qty);
  _addCombo(ctr, pfx, fn, 'lower-tshirt', size, size, qty);
  _addItem(ctr,  pfx, fn, 'Tie',   tieSz, qty);
  _addItem(ctr,  pfx, fn, 'Belt',  'All', qty);
  _addItem(ctr,  pfx, fn, 'Socks', 'Pair', qty * 2);
}

/* ══════════════════════════════════════════════════════
   SINGLE ITEM SHEET
══════════════════════════════════════════════════════ */

function openSiSheet(target) {
  sheetTarget = target;
  siItem = null; siSize = null;
  $('si-qty').textContent = '1';
  const items = Object.keys(getPrices());
  buildChips('si-items', items, null, 'selectSiItem');
  $('si-sizes').innerHTML = '<div style="color:var(--text-3);font-size:12px">Select an item first</div>';
  openSheet('si-modal');
}

function selectSiItem(item, el) {
  siItem = selectChip('si-items', item, el);
  siSize = null;
  const sizes = Object.keys(getPrices()[item] || {});
  siSize = String(sizes[0]);
  buildChips('si-sizes', sizes, siSize, 'selectSiSize');
}

function selectSiSize(size, el) { siSize = selectChip('si-sizes', size, el); }

function confirmSingleItem() {
  if (!siItem) { toast('Select an item first', 'error'); return; }
  if (!siSize) { toast('Select a size first',  'error'); return; }
  closeSheet('si-modal');
  const isEo = sheetTarget === 'eo';
  const ctr  = isEo ? 'eo-items-container' : 'items-container';
  const pfx  = isEo ? 'e' : 'n';
  const fn   = isEo ? 'eoRecalc' : 'recalc';
  _addItem(ctr, pfx, fn, siItem, String(siSize), parseInt($('si-qty').textContent));
}

/* ══════════════════════════════════════════════════════
   COMBO SHEET
══════════════════════════════════════════════════════ */

function openCoSheet(target, type) {
  sheetTarget = target; coType = type; coSize1 = null;
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
    const sizes = Object.keys(getPrices()[cfg.item1] || {});
    $('co-title').textContent  = cfg.label;
    $('co-sub').textContent    = 'Both items use the same size';
    $('co-label1').textContent = 'Select size';
    coSize1 = String(sizes[0]);
    buildChips('co-sizes1', sizes, coSize1, 'selectCoSize1');
  }
  openSheet('co-modal');
}

function selectCoSize1(size, el) { coSize1 = selectChip('co-sizes1', size, el); }

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
  _addCombo(ctr, pfx, fn, coType, String(coSize1), String(coSize1), qty);
}

/* ══════════════════════════════════════════════════════
   ADD SINGLE ITEM ROW (internal)
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
    const cfg  = COMBOS[type];
    const sid1 = id + 'a';
    const sid2 = id + 'b';
    row.dataset.type  = 'combo';
    row.dataset.item1 = cfg.item1;
    row.dataset.item2 = cfg.item2;
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
          <button class="remove-btn" style="width:24px;height:24px;font-size:14px" onclick="removeComboItem('${sid1}','${id}','${recalcFn}')">&#215;</button>
        </div>
        <div class="combo-item-row" id="crow-${sid2}">
          <div class="combo-label">${cfg.item2}</div>
          <select id="s2-${id}" onchange="${recalcFn}()">${getSizeOptions(cfg.item2, defaultSize2 || defaultSize1)}</select>
          <button class="remove-btn" style="width:24px;height:24px;font-size:14px" onclick="removeComboItem('${sid2}','${id}','${recalcFn}')">&#215;</button>
        </div>
      </div>`;
  }
  $(containerId).appendChild(row);
  window[recalcFn]();
}

/* ══════════════════════════════════════════════════════
   ITEM HELPERS
══════════════════════════════════════════════════════ */

function onItemChange(id, recalcFn) {
  $('ssel-' + id).innerHTML = getSizeOptions($('isel-' + id).value);
  window[recalcFn]();
}

function removeItem(id, recalcFn) {
  const el = $('item-' + id);
  if (el) el.remove();
  window[recalcFn]();
}

function removeComboItem(sid, comboId, recalcFn) {
  const subRow  = $('crow-' + sid);
  const comboEl = $('item-' + comboId);
  if (!subRow || !comboEl) return;
  subRow.remove();
  const remaining = comboEl.querySelectorAll('.combo-item-row');
  if (remaining.length === 0) {
    comboEl.remove();
  } else {
    const topLabel = comboEl.querySelector('.combo-top div');
    if (topLabel) topLabel.style.fontSize = '11px';
  }
  window[recalcFn]();
}

/* ══════════════════════════════════════════════════════
   RECALCULATE TOTALS
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
      const s1 = $('s1-' + id), s2 = $('s2-' + id);
      if (s1) unit += getUnitPrice(row.dataset.item1, s1.value);
      if (s2) unit += getUnitPrice(row.dataset.item2, s2.value);
      if (!s1 && !s2) return;
    }
    const line = unit * qty;
    subtotal += line;
    priceEl.textContent = rupees(line);
  });
  $(totalId).textContent = rupees(subtotal);
  return subtotal;
}

function addItem(di, ds, dq)           { _addItem('items-container',    'n', 'recalc',   di, ds, dq); }
function addCombo(type, s1, s2, qty)   { _addCombo('items-container',   'n', 'recalc',   type, s1, s2, qty); }
function recalc()                      { _recalc('items-container',     'grand-total'); }
function eoAddItem(di, ds, dq)         { _addItem('eo-items-container', 'e', 'eoRecalc', di, ds, dq); }
function eoAddCombo(type, s1, s2, qty) { _addCombo('eo-items-container','e', 'eoRecalc', type, s1, s2, qty); }
function eoRecalc()                    { _recalc('eo-items-container',  'eo-grand-total'); }

/* ══════════════════════════════════════════════════════
   COLLECT ITEMS
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
      const s1 = $('s1-' + id), s2 = $('s2-' + id);
      if (!s1 && !s2) return;
      const name1 = row.dataset.item1, name2 = row.dataset.item2;
      if (s1) unit += getUnitPrice(name1, s1.value);
      if (s2) unit += getUnitPrice(name2, s2.value);
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
══════════════════════════════════════════════════════ */

function saveOrder() {
  const sname = $('sname').value.trim();
  if (!sname) { toast('Please enter student name', 'error'); return; }
  if (!$('items-container').querySelector('[id^="item-"]')) { toast('Please add at least one item', 'error'); return; }

  const { items, subtotal } = collectItems('items-container');
  orderCounter++;
  saveCounter();

  let payments = [];
  if (paymentMode !== 'pending') {
    const paidInput = $('paid-amt');
    const paidAmt   = paidInput && paidInput.value
      ? Math.min(parseInt(paidInput.value) || subtotal, subtotal)
      : subtotal;
    payments = [{
      mode:   paymentMode,
      amount: paidAmt,
      date:   new Date().toLocaleDateString('en-IN')
    }];
  }

  const order = {
    id:          Date.now(),
    orderNum:    orderCounter,
    location:    currentLocation,
    sname,
    sclass:      $('sclass').value.trim(),
    pname:       $('pname').value.trim(),
    mobile:      $('mobile').value.trim(),
    notes:       $('notes').value.trim(),
    payments,
    items,
    subtotal,
    paymentMode,
    orderDiscount: 0,
    discount:      0,
    finalAmt:      subtotal,
    date:        new Date().toLocaleDateString('en-IN')
  };

  savedOrders.unshift(order);
  saveLocal();
  toast(`Order #${String(orderCounter).padStart(3,'0')} saved — ${sname}, ${rupees(subtotal)}`);
  resetForm();
}

function resetForm() {
  ['sname', 'sclass', 'pname', 'mobile', 'notes'].forEach(id => $(id).value = '');
  if ($('paid-amt')) $('paid-amt').value = '';
  $('items-container').innerHTML = '';
  itemCounter = 0;
  setPayment('pending');
  recalc();
  document.activeElement?.blur();
}

/* ══════════════════════════════════════════════════════
   TABS
══════════════════════════════════════════════════════ */

function showTab(tab) {
  $('tab-new').style.display    = tab === 'new'    ? '' : 'none';
  $('tab-orders').style.display = tab === 'orders' ? '' : 'none';
  ['new','orders'].forEach(t => $('tab-btn-' + t)?.classList.toggle('active', t === tab));
  if (tab === 'orders') renderOrders('');
}

function showAnalytics() {
  renderAnalytics();
  $('analytics-screen').style.display = 'block';
  document.body.style.overflow = 'hidden';
}

function closeAnalytics() {
  $('analytics-screen').style.display = 'none';
  document.body.style.overflow = '';
}

/* ══════════════════════════════════════════════════════
   ANALYTICS
══════════════════════════════════════════════════════ */

function setAnalyticsDate(v) { analyticsDate = v; renderAnalytics(); }
function setAnalyticsLoc(v)  { analyticsLoc  = v; renderAnalytics(); }

function renderAnalytics() {
  const now        = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  function parseDate(str) {
    const p = (str || '').split('/');
    return new Date(p[2], p[1]-1, p[0]);
  }

  let base = savedOrders;
  if (analyticsDate === 'today') {
    base = base.filter(o => parseDate(o.date).getTime() === todayStart.getTime());
  } else if (analyticsDate === 'week') {
    const weekStart = new Date(todayStart); weekStart.setDate(todayStart.getDate() - 6);
    base = base.filter(o => { const d = parseDate(o.date); return d >= weekStart && d <= todayStart; });
  }

  const orders = analyticsLoc === 'all' ? base
    : base.filter(o => (o.location || 'badagaon') === analyticsLoc);

  let cashAmt = 0, onlineAmt = 0, pendingAmt = 0;
  orders.forEach(o => {
    pendingAmt += balanceDue(o);
    normalisedPayments(o).forEach(p => {
      if (p.mode === 'cash')   cashAmt   += p.amount || 0;
      if (p.mode === 'online') onlineAmt += p.amount || 0;
    });
  });

  const collected     = cashAmt + onlineAmt;
  const total         = collected + pendingAmt;
  const cashOrders    = orders.filter(o => paymentStatus(o) === 'cash');
  const onlineOrders  = orders.filter(o => paymentStatus(o) === 'online');
  const splitOrders   = orders.filter(o => paymentStatus(o) === 'split');
  const partialOrders = orders.filter(o => paymentStatus(o) === 'partial');
  const pendingOrders = orders.filter(o => paymentStatus(o) === 'pending');
  const badagaon      = orders.filter(o => (o.location||'badagaon') === 'badagaon');
  const baghpat       = orders.filter(o => o.location === 'baghpat');

  function sumCollected(arr) { return arr.reduce((s,o) => s + totalCollected(o), 0); }

  function row(label, count, amt, color) {
    return `<div class="an-row">
      <div class="an-row-left">
        <span class="an-row-dot" style="background:${color}"></span>
        <span class="an-row-label">${label}</span>
        <span class="an-row-count">${count}</span>
      </div>
      <div class="an-row-amt">${rupees(amt)}</div>
    </div>`;
  }

  $('analytics-content').innerHTML = `
    <div class="section an-header-card" style="margin-bottom:1rem">
      <div class="an-filter-row">
        <div class="an-filter-group">
          <label class="an-filter-label">Period</label>
          <div class="an-seg">
            ${[['today','Today'],['week','Week'],['all','All Time']].map(([v,l]) =>
              `<button class="an-seg-btn${analyticsDate===v?' active':''}" onclick="setAnalyticsDate('${v}')">${l}</button>`
            ).join('')}
          </div>
        </div>
        <div class="an-filter-group">
          <label class="an-filter-label">Location</label>
          <div class="an-seg">
            ${[['all','All'],['badagaon','Badagaon'],['baghpat','Baghpat']].map(([v,l]) =>
              `<button class="an-seg-btn${analyticsLoc===v?' active':''}" onclick="setAnalyticsLoc('${v}')">${l}</button>`
            ).join('')}
          </div>
        </div>
      </div>
      <div class="an-total-block">
        <div class="an-total-label">Total Revenue</div>
        <div class="an-total-amt">${rupees(total)}</div>
        <div class="an-total-sub">${orders.length} order${orders.length!==1?'s':''}</div>
      </div>
    </div>

    <div class="section" style="margin-bottom:1rem">
      <div class="section-title">Collection</div>
      ${row('Collected', cashOrders.length+onlineOrders.length+splitOrders.length+partialOrders.length, collected, '#16a34a')}
      ${row('Pending / Due', pendingOrders.length+partialOrders.length, pendingAmt, '#d97706')}
      <div class="an-divider" style="margin:8px 0 10px"></div>
      ${row('Cash',   cashAmt,   cashAmt,   '#16a34a')}
      ${row('Online', onlineAmt, onlineAmt, '#1d4ed8')}
      ${splitOrders.length   ? row('Split',   splitOrders.length,   sumCollected(splitOrders),   '#6d28d9') : ''}
      ${partialOrders.length ? row('Partial', partialOrders.length, sumCollected(partialOrders), '#d97706') : ''}
    </div>

    ${analyticsLoc === 'all' ? `
    <div class="section" style="margin-bottom:1rem">
      <div class="section-title">By Location</div>
      ${row('Badagaon', badagaon.length, sumCollected(badagaon), '#6d28d9')}
      ${row('Baghpat',  baghpat.length,  sumCollected(baghpat),  '#be185d')}
    </div>` : ''}
  `;
}

/* ══════════════════════════════════════════════════════
   DATE / LOCATION FILTER
══════════════════════════════════════════════════════ */

function toggleFilterSheet() { $('filter-dropdown').classList.toggle('open'); }

function setDateFilter(f) {
  dateFilter = f;
  ['all','today','week'].forEach(k => $('fopt-'+k)?.classList.toggle('active', k === f));
  renderOrders($('tab-orders').querySelector('.search-box input')?.value || '');
  updateFilterBar();
}

function setLocationFilter(f) {
  locationFilter = f;
  ['all','badagaon','baghpat'].forEach(k => $('fopt-loc-'+k)?.classList.toggle('active', k === f));
  renderOrders($('tab-orders').querySelector('.search-box input')?.value || '');
  updateFilterBar();
}

function updateFilterBar() {
  const dateLabels = { today: 'Today', week: 'This Week' };
  const locLabels  = { badagaon: 'Badagaon', baghpat: 'Baghpat' };
  const el  = $('filter-bar-label');
  const dot = $('filter-dot');
  const btn = document.querySelector('.filter-btn');
  const pills = [];
  if (dateFilter !== 'all')     pills.push(`<span class="filter-pill">${dateLabels[dateFilter]}</span>`);
  if (locationFilter !== 'all') pills.push(`<span class="filter-pill loc">${locLabels[locationFilter]}</span>`);
  if (paymentFilter !== 'all')  pills.push(`<span class="filter-pill" style="background:#fef3c7;color:#d97706">Pending / Partial</span>`);
  if (el) el.innerHTML = pills.length
    ? pills.join('') + ` <button class="filter-clear-btn" onclick="clearFilters()">✕ Clear</button>` : '';
  const isActive = dateFilter !== 'all' || locationFilter !== 'all' || paymentFilter !== 'all';
  if (dot) dot.style.display = isActive ? 'block' : 'none';
  if (btn) btn.classList.toggle('active', isActive);
}

function clearFilters() {
  dateFilter = 'all'; locationFilter = 'all'; paymentFilter = 'all';
  ['all','today','week'].forEach(k => $('fopt-'+k)?.classList.toggle('active', k === 'all'));
  ['all','badagaon','baghpat'].forEach(k => $('fopt-loc-'+k)?.classList.toggle('active', k === 'all'));
  ['all','pending'].forEach(k => $('fopt-pay-'+k)?.classList.toggle('active', k === 'all'));
  renderOrders($('tab-orders').querySelector('.search-box input')?.value || '');
  updateFilterBar();
}

document.addEventListener('click', function(e) {
  if (!e.target.closest('.filter-btn-wrap')) $('filter-dropdown')?.classList.remove('open');
});

function matchesDateFilter(order) {
  if (paymentFilter === 'pending') {
    const s = paymentStatus(order);
    if (s !== 'pending' && s !== 'partial') return false;
  }
  if (locationFilter !== 'all') {
    if ((order.location || 'badagaon') !== locationFilter) return false;
  }
  if (dateFilter === 'all') return true;
  const parts     = (order.date || '').split('/');
  const orderDate = new Date(parts[2], parts[1] - 1, parts[0]);
  const now       = new Date();
  const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (dateFilter === 'today') return orderDate.getTime() === today.getTime();
  if (dateFilter === 'week') {
    const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 6);
    return orderDate >= weekAgo && orderDate <= today;
  }
  return true;
}

/* ══════════════════════════════════════════════════════
   RENDER SAVED ORDERS
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
      orderNumStr.includes(query)
    );
  });

  const now          = new Date();
  const todayStart   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const pendingAll   = savedOrders.filter(o => balanceDue(o) > 0 || paymentStatus(o) === 'pending');
  const pendingToday = pendingAll.filter(o => {
    const p = (o.date || '').split('/');
    return new Date(p[2], p[1]-1, p[0]).getTime() === todayStart.getTime();
  });
  const banner = $('pending-banner');
  if (pendingAll.length > 0) {
    banner.style.display = 'flex';
    $('pending-count').textContent = pendingAll.length;
    $('pending-today').textContent = pendingToday.length > 0
      ? `${pendingToday.length} from today` : 'none today';
    banner.onclick = () => {
      $('tab-orders').querySelector('.search-box input').value = '';
      setPaymentFilter('pending');
    };
  } else {
    banner.style.display = 'none';
  }

  const totalAmt = filtered.reduce((s, o) => s + totalCollected(o), 0);
  $('orders-summary').textContent =
    `${filtered.length} order${filtered.length !== 1 ? 's' : ''} — Collected: ${rupees(totalAmt)}`;

  if (filtered.length === 0) {
    $('orders-list').innerHTML = '<div class="empty">No orders found</div>';
    return;
  }

  const STATUS_LABEL = { cash: 'Cash', online: 'Online', split: 'Split', partial: 'Partial', pending: 'Pending' };
  const LOC_TEXT     = { badagaon: 'Badagaon', baghpat: 'Baghpat' };

  const menuIcon = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <circle cx="8" cy="2.5" r="1.4"/>
    <circle cx="8" cy="8"   r="1.4"/>
    <circle cx="8" cy="13.5" r="1.4"/>
  </svg>`;

  $('orders-list').innerHTML = filtered.map(o => {
    const status    = paymentStatus(o);
    const loc       = o.location || 'badagaon';
    const collected = totalCollected(o);
    const balance   = balanceDue(o);
    const discount  = totalDiscount(o);
    const payments  = normalisedPayments(o);
    const itemCount = (o.items || []).length;
    const displayAmt = collected > 0 ? collected : o.subtotal;

    const orderNum = o.orderNum
      ? `<span style="display:inline-flex;align-items:center;font-size:11px;font-weight:600;font-family:monospace;padding:2px 8px;border-radius:20px;background:#f3f4f6;color:#6b7280">#${String(o.orderNum).padStart(3,'0')}</span>`
      : '';

    const quickPay = (status === 'pending' || status === 'partial') ? `
      <button onclick="openPaySheet(${o.id})"
        style="font-size:11px;font-weight:600;padding:2px 10px;border-radius:20px;border:1px solid var(--green);background:var(--green-bg);color:var(--green);cursor:pointer;display:inline-flex;align-items:center;gap:4px">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add Payment
      </button>` : '';

    const paymentHistoryLines = payments.map((p, i) => `
      <div class="order-item-line" style="color:var(--text-3)">
        <span>Payment ${i+1} · ${p.mode.charAt(0).toUpperCase()+p.mode.slice(1)} · ${p.date}</span>
        <span style="color:var(--green);font-weight:600">${rupees(p.amount)}</span>
      </div>
      ${p.discount > 0 ? `<div class="order-item-line" style="color:#dc2626;font-size:12px"><span>Discount</span><span>-${rupees(p.discount)}</span></div>` : ''}
    `).join('');

    return `
      <div class="order-card" id="card-${o.id}">
        <div class="order-card-top">
          <div style="flex:1;min-width:0">
            <div class="order-name">
              ${o.sname || ''}
              <span style="font-size:12px;font-weight:400;color:var(--text-3)">${o.sclass || ''}</span>
            </div>
            ${(o.pname || o.mobile) ? `
            <div class="order-contact">${[o.pname, o.mobile].filter(Boolean).join(' · ')}</div>` : ''}
            <div class="order-contact" style="margin-top:1px">${[LOC_TEXT[loc], o.date].join(' · ')}</div>
            <div style="margin-top:6px;display:flex;align-items:center;gap:5px;flex-wrap:wrap">
              <span class="badge ${status}">${STATUS_LABEL[status]}</span>
              ${status === 'partial' ? `<span style="font-size:11px;color:#d97706;font-weight:600">Due: ${rupees(balance)}</span>` : ''}
              ${orderNum}
              ${quickPay}
            </div>
            ${o.notes ? `<div style="font-size:12px;color:var(--orange);margin-top:4px;display:flex;align-items:center;gap:4px;font-style:italic">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              ${o.notes}</div>` : ''}
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;margin-left:10px;flex-shrink:0">
            <div class="menu-wrap" id="menu-wrap-${o.id}">
              <button class="menu-btn" onclick="toggleMenu(${o.id})">${menuIcon}</button>
              <div class="menu-dropdown" id="menu-${o.id}">
                <button class="menu-item" onclick="closeMenu(${o.id});openEditOrder(${o.id})">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Edit Order
                </button>
                <button class="menu-item" onclick="closeMenu(${o.id});openPaySheet(${o.id})">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>Edit Payment
                </button>
                <button class="menu-item destructive" onclick="closeMenu(${o.id});deleteOrder(${o.id})">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>Delete
                </button>
              </div>
            </div>
            <div class="order-amount">${rupees(displayAmt)}</div>
            ${balance > 0 && collected > 0 ? `<div style="font-size:11px;color:#d97706;font-weight:600;text-align:right">+${rupees(balance)} due</div>` : ''}
            ${discount > 0 ? `<div class="discount-badge" style="text-align:right">-${rupees(discount)} off</div>` : ''}
          </div>
        </div>
        <div class="card-bottom">
          <button class="send-bill-btn" onclick="openWhatsApp(${o.id})">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Send Bill
          </button>
          <button class="items-toggle-btn" onclick="toggleItems(${o.id})">
            ${itemCount} item${itemCount !== 1 ? 's' : ''}
            <span class="items-chevron" id="chev-${o.id}">▸</span>
          </button>
        </div>
        <div class="order-items" id="items-${o.id}" style="display:none">
          ${(o.items || []).map(i => `
            <div class="order-item-line">
              <span>${i.label}</span><span>${rupees(i.lineTotal)}</span>
            </div>`).join('')}
          <div class="order-final-row"><span>Subtotal</span><span>${rupees(o.subtotal)}</span></div>
          ${paymentHistoryLines}
          ${balance > 0 ? `<div class="order-final-row" style="color:#d97706"><span>Balance Due</span><span>${rupees(balance)}</span></div>` : ''}
        </div>
      </div>`;
  }).join('');
}

/* ══════════════════════════════════════════════════════
   COLLAPSIBLE ITEM LINES
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
══════════════════════════════════════════════════════ */

function toggleMenu(id) {
  const menu   = $('menu-' + id);
  const isOpen = menu.classList.contains('open');
  document.querySelectorAll('.menu-dropdown.open').forEach(m => m.classList.remove('open'));
  if (!isOpen) menu.classList.add('open');
}

function closeMenu(id) { $('menu-' + id)?.classList.remove('open'); }

document.addEventListener('click', function(e) {
  if (!e.target.closest('.menu-wrap'))
    document.querySelectorAll('.menu-dropdown.open').forEach(m => m.classList.remove('open'));
});

/* ══════════════════════════════════════════════════════
   DELETE ORDER
══════════════════════════════════════════════════════ */

function openDelModal()  { $('del-modal').classList.add('open');    }
function closeDelModal() { $('del-modal').classList.remove('open'); }

function deleteOrder(id) {
  const order = savedOrders.find(o => o.id === id);
  pendingDeleteId = id;
  $('del-modal-sub').textContent = order
    ? `${order.sname || 'This order'} — ${rupees(order.subtotal)}. This cannot be undone.`
    : 'This cannot be undone.';
  $('del-modal').dataset.mode = 'order';
  openDelModal();
}

function confirmDelete() {
  const mode = $('del-modal').dataset.mode;
  closeDelModal();

  if (mode === 'payment') {
    if (!pendingPayDeleteId) return;
    const { orderId, entryIndex } = pendingPayDeleteId;
    pendingPayDeleteId = null;
    $('del-modal').dataset.mode = '';
    const idx = savedOrders.findIndex(o => o.id === orderId);
    if (idx === -1) return;
    const payments = normalisedPayments(savedOrders[idx]);
    payments.splice(entryIndex, 1);
    savedOrders[idx].payments    = payments;
    savedOrders[idx].finalAmt    = totalCollected(savedOrders[idx]);
    savedOrders[idx].discount    = totalDiscount(savedOrders[idx]);
    savedOrders[idx].paymentMode = paymentStatus(savedOrders[idx]);
    saveLocal();
    toast('Payment entry deleted');
    openPaySheet(orderId);
    renderOrders($('tab-orders').querySelector('.search-box input')?.value || '');
  } else {
    if (!pendingDeleteId) return;
    savedOrders = savedOrders.filter(o => o.id !== pendingDeleteId);
    pendingDeleteId = null;
    saveLocal();
    toast('Order deleted');
    renderOrders($('tab-orders').querySelector('.search-box input')?.value || '');
  }
}

/* ══════════════════════════════════════════════════════
   PAYMENT BOTTOM SHEET
══════════════════════════════════════════════════════ */

function openPaySheet(id) {
  const order = savedOrders.find(o => o.id === id);
  if (!order) return;
  epOrderId = id;

  const balance  = balanceDue(order);
  const payments = normalisedPayments(order);

  const historyHtml = payments.length ? `
    <div style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.07em;margin:14px 0 6px">Payment History</div>
    ${payments.map((p, i) => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;background:var(--surface);border-radius:8px;margin-bottom:5px;font-size:13px">
        <div>
          <span style="font-weight:600;color:var(--text-2)">${p.mode.charAt(0).toUpperCase()+p.mode.slice(1)}</span>
          <span style="color:var(--text-3);margin-left:6px">${p.date}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-weight:700;color:var(--green)">${rupees(p.amount)}</span>
          <button onclick="confirmDeletePayEntry(${id},${i})"
            style="background:none;border:none;cursor:pointer;color:var(--text-3);display:flex;align-items:center;padding:2px"
            title="Delete this entry">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
        </div>
      </div>`).join('')}
    <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-3);padding:4px 2px 0">
      <span>Collected so far</span>
      <span style="font-weight:600;color:var(--text)">${rupees(totalCollected(order))}</span>
    </div>` : '';

  $('ep-history').innerHTML = historyHtml;
  $('ep-orig').textContent  = `Order total: ${rupees(order.subtotal)}  •  Balance: ${rupees(balance)}`;
  $('ep-amt').value         = balance > 0 ? balance : '';
  $('ep-discount').value    = '';

  // Always show discount field — it's order-level, always editable
  const existingDiscount = order.orderDiscount || 0;
  const discRow = $('ep-discount-row');
  if (discRow) discRow.style.display = '';
  $('ep-discount').value = existingDiscount > 0 ? existingDiscount : '';

  epSetMode('cash');
  openSheet('ep-modal');
}

function epSetMode(mode) {
  ['pending','cash','online'].forEach(m => {
    const btn = $('ep-' + m);
    if (btn) btn.className = 'edit-pay-btn';
  });
  const activeBtn = $('ep-' + mode);
  if (activeBtn) activeBtn.classList.add(mode + '-active');
  $('ep-modal').dataset.chosenMode = mode;
}

function epSyncFromDiscount() {
  const order = savedOrders.find(o => o.id === epOrderId);
  if (!order) return;
  const disc = parseInt($('ep-discount').value) || 0;
  $('ep-amt').value = Math.max(0, balanceDue(order) - disc);
}

function applyPaySheet() {
  if (!epOrderId) return;
  const idx = savedOrders.findIndex(o => o.id === epOrderId);
  if (idx === -1) return;
  const newMode = $('ep-modal').dataset.chosenMode || 'cash';
  const amtVal  = parseFloat($('ep-amt').value)      || 0;
  const discVal = parseFloat($('ep-discount').value) || 0;
  if (amtVal < 0) { toast('Amount cannot be negative', 'error'); return; }
  const payments = normalisedPayments(savedOrders[idx]);
  // Only add a new payment entry if an amount was actually received
  if (amtVal > 0) {
    payments.push({ mode: newMode, amount: amtVal, date: new Date().toLocaleDateString('en-IN') });
    savedOrders[idx].payments = payments;
  }
  // Discount always updates at order level regardless
  savedOrders[idx].orderDiscount = discVal;
  savedOrders[idx].finalAmt      = totalCollected(savedOrders[idx]);
  savedOrders[idx].discount      = discVal;
  savedOrders[idx].paymentMode   = paymentStatus(savedOrders[idx]);
  saveLocal();
  closeSheet('ep-modal');
  renderOrders($('tab-orders').querySelector('.search-box input')?.value || '');
  toast('Payment entry added');
}

function confirmDeletePayEntry(orderId, entryIndex) {
  const order = savedOrders.find(o => o.id === orderId);
  if (!order) return;
  const entry = normalisedPayments(order)[entryIndex];
  if (!entry) return;
  pendingPayDeleteId = { orderId, entryIndex };
  $('del-modal-sub').textContent =
    `${entry.mode.charAt(0).toUpperCase()+entry.mode.slice(1)} payment of ${rupees(entry.amount)} on ${entry.date}. This cannot be undone.`;
  $('del-modal').dataset.mode = 'payment';
  openDelModal();
}

/* ══════════════════════════════════════════════════════
   FULL ORDER EDIT SCREEN
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
  $('eo-items-container').innerHTML = '';

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
      const [,   s2] = parts[1] ? parseItemLabel(parts[1]) : [null, null];
      if (s2) {
        eoAddCombo(COMBO_TYPE_BY_ITEM1[n1] || 'pant-shirt', s1, s2, qty);
      } else {
        eoAddItem(n1, s1, qty);
      }
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

function parseItemLabel(str) {
  if (!str) return ['', ''];
  const m = str.trim().match(/^(.+?)\s*\((.+)\)$/);
  return m ? [m[1].trim(), m[2].trim()] : [str.trim(), ''];
}

function closeEditOrder() {
  $('edit-order-screen').classList.remove('open');
  eoOrderId = null;
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
  const payments = normalisedPayments(orig);
  let remaining  = subtotal;
  const adjustedPayments = payments.map(p => {
    const amt = Math.min(p.amount || 0, remaining);
    remaining = Math.max(0, remaining - amt);
    return { ...p, amount: amt };
  });
  savedOrders[idx] = {
    ...orig,
    sname,
    sclass:      $('eo-sclass').value.trim(),
    pname:       $('eo-pname').value.trim(),
    mobile:      $('eo-mobile').value.trim(),
    notes:       $('eo-notes').value.trim(),
    items, subtotal,
    payments:    adjustedPayments,
    finalAmt:    totalCollected({ payments: adjustedPayments }),
    discount:    totalDiscount({ payments: adjustedPayments }),
    paymentMode: paymentStatus({ subtotal, payments: adjustedPayments })
  };
  saveLocal();
  toast(`Order updated — ${sname}, ${rupees(subtotal)}`);
  closeEditOrder();
  renderOrders($('tab-orders').querySelector('.search-box input')?.value || '');
}

/* ══════════════════════════════════════════════════════
   WHATSAPP BILL
══════════════════════════════════════════════════════ */

function openWhatsApp(id) {
  const order = savedOrders.find(o => o.id === id);
  if (!order) return;
  const orderLabel = order.orderNum ? ` | #${String(order.orderNum).padStart(3,'0')}` : '';
  const payments   = normalisedPayments(order);
  const balance    = balanceDue(order);
  const collected  = totalCollected(order);
  const discount   = totalDiscount(order);
  const itemLines  = (order.items || []).map(i => `  ${i.label} = Rs.${i.lineTotal.toLocaleString('en-IN')}`).join('\n');
  const paymentLines = payments.length
    ? payments.map((p, i) =>
        `  Payment ${i+1} (${p.mode.charAt(0).toUpperCase()+p.mode.slice(1)}, ${p.date}) = Rs.${p.amount.toLocaleString('en-IN')}` +
        (p.discount > 0 ? `\n  Discount = -Rs.${p.discount.toLocaleString('en-IN')}` : '')
      ).join('\n')
    : '  No payment received yet';
  const contactLines = [
    order.pname  ? `Parent  : ${order.pname}`  : '',
    order.mobile ? `Mobile  : ${order.mobile}` : ''
  ].filter(Boolean).join('\n');
  const statusLine = balance > 0
    ? `*Balance Due = Rs.${balance.toLocaleString('en-IN')}*`
    : `*Fully Paid ✓*`;

  const message =
`*Golden Gate International School*
*Uniform Bill${orderLabel}*
-------------------------
Student : ${order.sname || ''}${order.sclass ? ' (' + order.sclass + ')' : ''}
${contactLines ? contactLines + '\n' : ''}Date    : ${order.date}${order.notes ? '\nNote    : ' + order.notes : ''}
-------------------------
*Items:*
${itemLines}
-------------------------
*Total = Rs.${order.subtotal.toLocaleString('en-IN')}*

*Payments:*
${paymentLines}
${discount > 0 ? `  Total Discount = -Rs.${discount.toLocaleString('en-IN')}\n` : ''}-------------------------
*Collected = Rs.${collected.toLocaleString('en-IN')}*
${statusLine}
-------------------------
Thank you!`;

  if (order.mobile) {
    window.open(`https://wa.me/${order.mobile}?text=${encodeURIComponent(message)}`, '_blank');
  } else {
    navigator.clipboard.writeText(message)
      .then(() => toast('No mobile saved — bill copied to clipboard'))
      .catch(() => toast('Copy failed — please copy manually', 'error'));
  }
}

/* ══════════════════════════════════════════════════════
   EXPORT CSV
══════════════════════════════════════════════════════ */

function exportCSV() {
  if (!savedOrders.length) { toast('No orders to export'); return; }
  const headers = ['Order#','Date','Location','Student','Class','Parent','Mobile','Notes',
                   'Items','Subtotal','Collected','Discount','Balance','Status','Payment Detail'];
  const rows = savedOrders.map(o => {
    const payments  = normalisedPayments(o);
    const payDetail = payments.map(p =>
      `${p.mode} Rs.${p.amount} on ${p.date}${p.discount > 0 ? ' (disc Rs.'+p.discount+')' : ''}`
    ).join(' | ');
    return [
      o.orderNum ? '#' + String(o.orderNum).padStart(3,'0') : '',
      o.date, o.location || 'badagaon',
      o.sname || '', o.sclass || '', o.pname || '', o.mobile || '', o.notes || '',
      (o.items || []).map(i => i.label + ' = Rs.' + i.lineTotal).join(' | '),
      o.subtotal, totalCollected(o), totalDiscount(o), balanceDue(o),
      paymentStatus(o), payDetail
    ];
  });
  const csv  = [headers,...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const link = document.createElement('a');
  link.href     = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  link.download = `uniform-orders-${new Date().toLocaleDateString('en-IN').replace(/\//g,'-')}.csv`;
  link.click();
}

/* ══════════════════════════════════════════════════════
   EXPORT / IMPORT JSON
══════════════════════════════════════════════════════ */

function exportJSON() {
  if (!savedOrders.length) { toast('No orders to export'); return; }
  const backup = { exportedAt: new Date().toISOString(), orderCounter, orders: savedOrders };
  const link   = document.createElement('a');
  link.href     = URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}));
  link.download = `uniform-backup-${new Date().toLocaleDateString('en-IN').replace(/\//g,'-')}.json`;
  link.click();
}

function importJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const parsed   = JSON.parse(e.target.result);
      const imported = Array.isArray(parsed) ? parsed : (parsed.orders || []);
      const importRC = parsed.orderCounter || 0;
      if (!imported.length) { toast('No orders found in file', 'error'); return; }
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
    event.target.value = '';
  };
  reader.readAsText(file);
}

/* ══════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════ */

buildAddButtons('add-btns-new', false);
buildAddButtons('add-btns-eo',  true);
recalc();
