/* ----------------------------------------------------------
   1. PRICE DATA
---------------------------------------------------------- */

const PRICES = {
  badagaon: {
    'Tie':          { Small: 50, Large: 100 },
    'Belt':         { All: 100 },
    'Socks':        { Pair: 30 },
    'Suit':         { All: 350 },
    'Trouser':      { All: 350 },
    'Jacket':       { All: 300 },
    'Half Lower':   { 20: 250, 22: 250, 24: 250, 26: 250, 28: 300, 30: 300 },
    'Half T-Shirt': { 20: 350, 22: 350, 24: 400, 26: 400, 28: 400, 30: 400 },
    'Lower':        { 26: 300, 28: 300, 30: 325, 32: 325, 34: 350, 36: 350, 38: 375, 40: 400, 42: 425, 44: 450 },
    'T-Shirt':      { 26: 300, 28: 300, 30: 325, 32: 325, 34: 350, 36: 350, 38: 375, 40: 400, 42: 425, 44: 450 },
    'Pant':         { 20: 300, 22: 300, 24: 300, 26: 325, 28: 325, 30: 350, 32: 350, 34: 375, 36: 375, 38: 400, 40: 400, 42: 425, 44: 450 },
    'Shirt':        { 20: 300, 22: 300, 24: 300, 26: 325, 28: 325, 30: 350, 32: 350, 34: 375, 36: 375, 38: 400, 40: 400, 42: 425, 44: 450 }
  },
  baghpat: {
    'Tie':          { Small: 50, Large: 100 },
    'Belt':         { All: 100 },
    'Socks':        { Pair: 40 },
    'Suit':         { All: 400 },
    'Trouser':      { All: 400 },
    'Jacket':       { All: 300 },
    'Half Lower':   { 20: 250, 22: 250, 24: 250, 26: 250, 28: 300, 30: 300 },
    'Half T-Shirt': { 20: 350, 22: 350, 24: 400, 26: 400, 28: 400, 30: 400 },
    'Lower':        { 20: 350, 22: 350, 24: 375, 26: 375, 28: 400, 30: 400, 32: 425, 34: 425, 36: 450, 38: 450, 40: 475, 42: 475, 44: 500 },
    'T-Shirt':      { 20: 350, 22: 350, 24: 375, 26: 375, 28: 400, 30: 400, 32: 425, 34: 425, 36: 450, 38: 450, 40: 475, 42: 475, 44: 500 },
    'Pant':         { 20: 350, 22: 350, 24: 375, 26: 375, 28: 400, 30: 400, 32: 425, 34: 425, 36: 450, 38: 450, 40: 475, 42: 475, 44: 500 },
    'Shirt':        { 20: 350, 22: 350, 24: 375, 26: 375, 28: 400, 30: 400, 32: 425, 34: 425, 36: 450, 38: 450, 40: 475, 42: 475, 44: 500 }
  }
};

const COMBOS = {
  'pant-shirt':   { item1: 'Pant',       item2: 'Shirt',        label: 'Pant & Shirt Set' },
  'lower-tshirt': { item1: 'Lower',      item2: 'T-Shirt',      label: 'Lower & T-Shirt Set' },
  'half-set':     { item1: 'Half Lower', item2: 'Half T-Shirt', label: 'Half Lower & T-Shirt Set' }
};

const COMBO_TYPE_BY_ITEM1 = {
  'Pant':       'pant-shirt',
  'Lower':      'lower-tshirt',
  'Half Lower': 'half-set'
};

const BRANCH_LABEL = { badagaon: 'Badagaon', baghpat: 'Baghpat' };


/* ----------------------------------------------------------
   2. APP STATE
---------------------------------------------------------- */

let currentBranch = localStorage.getItem('uniform_branch') || 'badagaon';

// Migrate legacy key written by older versions of the app
if (!localStorage.getItem('uniform_branch') && localStorage.getItem('uniform_location')) {
  currentBranch = localStorage.getItem('uniform_location');
  localStorage.setItem('uniform_branch', currentBranch);
}

let prices = PRICES[currentBranch];

let newOrderPayMode = 'pending';
let editOrderId     = null;
let itemCounter     = 0;

// Active filter state — 'all' means no filter applied
let dateFilter     = 'all';
let branchFilter   = 'all';   // was: locationFilter
let paymentFilter  = 'all';
let deliveryFilter = 'all';

// Analytics panel filter state
let analyticsDate   = 'today';
let analyticsBranch = 'all';  // was: analyticsLoc

let orderCounter = parseInt(localStorage.getItem('uniform_order_counter') || '0');

// Orders are stored under 'uniform_orders2'. Each order object carries a
// `branch` field (was `location`) — old data with `.location` is read via
// the fallback `order.branch || order.location || 'badagaon'` below.
let savedOrders = JSON.parse(localStorage.getItem('uniform_orders2') || '[]');

let sheetTarget          = null;
let pendingDeleteId      = null;
let paySheetOrderId      = null;
let pendingPayDeleteId   = null;
let deliverySheetOrderId = null;

const sheet = { quickSetSize: null, comboType: null, comboSize: null, singleItem: null, singleSize: null };

// ctx holds live references to the DOM inputs for the current form context
// ('new' = new-order tab, 'edit' = edit-order screen)
const ctx = {
  new:  { name: null, cls: null, parent: null, mobile: null, notes: null },
  edit: { name: null, cls: null, parent: null, mobile: null, notes: null }
};


/* ----------------------------------------------------------
   3. UTILITIES
---------------------------------------------------------- */

const $           = id => document.getElementById(id);
const rupees      = n  => 'Rs.' + (n || 0).toLocaleString('en-IN');
const saveLocal   = () => localStorage.setItem('uniform_orders2', JSON.stringify(savedOrders));
const saveCounter = () => localStorage.setItem('uniform_order_counter', String(orderCounter));

function cloneTemplate(id) {
  return document.getElementById(id).content.cloneNode(true).firstElementChild;
}

function getUnitPrice(itemName, size) {
  return prices[itemName]?.[size] || prices[itemName]?.[parseInt(size)] || 0;
}

function buildSizeOptions(itemName, selectedSize) {
  const frag = document.createDocumentFragment();
  Object.keys(prices[itemName] || {}).forEach(s => {
    const opt = document.createElement('option');
    opt.value = s; opt.textContent = s;
    if (String(s) === String(selectedSize)) opt.selected = true;
    frag.appendChild(opt);
  });
  return frag;
}

function buildItemOptions(selectedItem) {
  const frag = document.createDocumentFragment();
  Object.keys(prices).forEach(name => {
    const opt = document.createElement('option');
    opt.value = name; opt.textContent = name;
    if (name === selectedItem) opt.selected = true;
    frag.appendChild(opt);
  });
  return frag;
}

function toast(message, type = 'info', duration = 2500) {
  const el = document.createElement('div');
  el.className   = 'toast' + (type === 'error' ? ' error' : '');
  el.textContent = message;
  $('toast-container').appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); }, duration);
}

// Prepend country code 91 for WhatsApp deep-links.
// Raw input may include spaces, dashes, or a leading zero.
function normaliseMobile(raw) {
  const digits = (raw || '').replace(/\D/g, '').replace(/^0+/, '');
  return digits.length === 10 ? '91' + digits : digits;
}

function getSearchValue() {
  return $('orders-search')?.value || '';
}

function clearSearch(inputId) {
  const input = $(inputId);
  if (!input) return;
  input.value = '';
  const clearBtn = $(inputId + '-clear');
  if (clearBtn) clearBtn.style.display = 'none';
  renderOrders('');
  input.focus();
}

function updateSearchClear(input) {
  const clearBtn = $(input.id + '-clear');
  if (clearBtn) clearBtn.style.display = input.value ? 'block' : 'none';
}

// Helper: returns the branch for an order, handling legacy data that stored
// the value under the old key name `.location`
function getOrderBranch(order) {
  return order.branch || order.location || 'badagaon';
}


/* ----------------------------------------------------------
   4. FORM HELPERS
---------------------------------------------------------- */

function buildStudentFields(containerId, ctxKey) {
  const wrap = $(containerId);
  wrap.innerHTML = '';
  wrap.appendChild(cloneTemplate('tpl-student-fields'));
  ctx[ctxKey].name   = wrap.querySelector('.sf-name');
  ctx[ctxKey].cls    = wrap.querySelector('.sf-class');
  ctx[ctxKey].parent = wrap.querySelector('.sf-parent');
  ctx[ctxKey].mobile = wrap.querySelector('.sf-mobile');
  ctx[ctxKey].notes  = wrap.querySelector('.sf-notes');

  // Wire up Enter-key navigation between fields for faster data entry
  const fields = [ctx[ctxKey].name, ctx[ctxKey].cls, ctx[ctxKey].parent, ctx[ctxKey].mobile, ctx[ctxKey].notes];
  fields.forEach((field, i) => {
    if (!field) return;
    field.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const next = fields[i + 1];
        if (next) next.focus();
        else field.blur();
      }
    });
  });
}

function buildItemsSection(wrapId, itemsCtnId, addBtnsId, totalId, totalLabel, isEdit) {
  const wrap = $(wrapId);
  wrap.innerHTML = '';
  const sec  = cloneTemplate('tpl-items-section');
  const ctn  = sec.querySelector('.is-items-ctn');
  const btns = sec.querySelector('.is-add-btns');
  const tot  = sec.querySelector('.is-total-row');

  ctn.id  = itemsCtnId;
  btns.id = addBtnsId;

  if (isEdit) {
    tot.className = 'total-final';
    tot.innerHTML = `<span>${totalLabel}</span><span id="${totalId}">Rs.0</span>`;
  } else {
    tot.className = 'total-row';
    tot.innerHTML = `<span class="total-label">${totalLabel}</span><span id="${totalId}" class="total-amt">Rs.0</span>`;
  }

  wrap.appendChild(sec);
  buildAddButtons(addBtnsId, isEdit);
}

function readStudentFields(ctxKey) {
  const c = ctx[ctxKey];
  return {
    studentName:  (c.name?.value   || '').trim(),
    studentClass: (c.cls?.value    || '').trim(),
    parentName:   (c.parent?.value || '').trim(),
    mobile:       (c.mobile?.value || '').trim(),
    notes:        (c.notes?.value  || '').trim()
  };
}

function writeStudentFields(ctxKey, order) {
  const c = ctx[ctxKey];
  if (c.name)   c.name.value   = order.studentName  || '';
  if (c.cls)    c.cls.value    = order.studentClass || '';
  if (c.parent) c.parent.value = order.parentName   || '';
  if (c.mobile) c.mobile.value = order.mobile       || '';
  if (c.notes)  c.notes.value  = order.notes        || '';
}

function clearStudentFields(ctxKey) {
  const c = ctx[ctxKey];
  ['name', 'cls', 'parent', 'mobile', 'notes'].forEach(k => { if (c[k]) c[k].value = ''; });
}


/* ----------------------------------------------------------
   5. DELIVERY HELPERS
---------------------------------------------------------- */

// Builds the flat list of individual physical items that need to be handed
// over. Each unit gets a unique key so its given/pending state can be
// toggled independently even when the same item appears multiple times.
function buildDeliveryUnits(items) {
  const units = [];
  let seq = 0;
  (items || []).forEach(item => {
    const qty = item.qty || 1;
    if (item.itemType === 'single') {
      for (let q = 0; q < qty; q++)
        units.push({ key: `${item.itemName}(${item.itemSize})#${seq++}`, label: `${item.itemName} (${item.itemSize})`, given: false });
    } else if (item.itemType === 'suit-set') {
      for (let q = 0; q < qty; q++) {
        units.push({ key: `Suit#${seq++}`,    label: 'Suit',    given: false });
        units.push({ key: `Trouser#${seq++}`, label: 'Trouser', given: false });
        units.push({ key: `Jacket#${seq++}`,  label: 'Jacket',  given: false });
      }
    } else if (item.itemType === 'combo') {
      for (let q = 0; q < qty; q++) {
        if (item.item1Name) units.push({ key: `${item.item1Name}(${item.item1Size})#${seq++}`, label: `${item.item1Name} (${item.item1Size})`, given: false });
        if (item.item2Name) units.push({ key: `${item.item2Name}(${item.item2Size})#${seq++}`, label: `${item.item2Name} (${item.item2Size})`, given: false });
      }
    }
  });
  return units;
}

// Legacy orders created before the delivery-tracking feature was added have no
// `deliveryUnits` array. We generate the units on the fly and mark them all as
// already given so they don't incorrectly show as pending.
function ensureDeliveryUnits(order) {
  if (Array.isArray(order.deliveryUnits)) return order.deliveryUnits;
  const units = buildDeliveryUnits(order.items);
  units.forEach(u => u.given = true);
  return units;
}

function pendingItemCount(order) { return ensureDeliveryUnits(order).filter(u => !u.given).length; }
function allItemsDelivered(order){ return pendingItemCount(order) === 0; }


/* ----------------------------------------------------------
   6. PAYMENT HELPERS
---------------------------------------------------------- */

function getPayments(order)    { return Array.isArray(order.payments) ? order.payments : []; }
function totalCollected(order) { return getPayments(order).reduce((s, p) => s + (p.amount || 0), 0); }
function totalDiscount(order)  { return order.orderDiscount || 0; }
function balanceDue(order)     { return Math.max(0, (order.subtotal || 0) - totalCollected(order) - totalDiscount(order)); }

function paymentStatus(order) {
  const payments = getPayments(order);
  if (!payments.length)      return 'pending';
  if (balanceDue(order) > 0) return 'partial';
  const modes = [...new Set(payments.map(p => p.mode))];
  if (modes.length > 1)      return 'split';
  return modes[0] || 'cash';
}


/* ----------------------------------------------------------
   7. UI — HEADER / TABS / BRANCH
---------------------------------------------------------- */

function toggleHamburger() { $('hamburger-menu').classList.toggle('open'); }
function closeHamburger()  { $('hamburger-menu').classList.remove('open'); }

// Called when the user taps a branch button on the New Order form.
// Warns before switching if items are already in the cart (prices differ per branch).
function setBranch(branch) {
  const ctn = $('items-container');
  if (ctn?.querySelector('.js-item-row')) {
    if (!confirm(`Switch to ${BRANCH_LABEL[branch]}? Current items will be cleared.`)) return;
  }
  currentBranch = branch;
  prices = PRICES[branch];
  localStorage.setItem('uniform_branch', branch);
  ['badagaon', 'baghpat'].forEach(b => $('branch-' + b).classList.toggle('active', b === branch));
  if (ctn) ctn.innerHTML = '';
  itemCounter = 0;
  recalcNew();
}

function setNewOrderPayMode(mode) {
  newOrderPayMode = mode;
  ['cash', 'online', 'pending'].forEach(m => $('pay-' + m).classList.toggle('active', m === mode));
  const show = mode !== 'pending';
  const row = $('payment-extra-row');
  if (row) row.style.display = show ? 'grid' : 'none';
}

function showTab(tab) {
  $('tab-new').style.display    = tab === 'new'    ? '' : 'none';
  $('tab-orders').style.display = tab === 'orders' ? '' : 'none';
  ['new', 'orders'].forEach(t => $('tab-btn-' + t)?.classList.toggle('active', t === tab));
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


/* ----------------------------------------------------------
   8. UI — ADD BUTTONS & BOTTOM SHEETS
---------------------------------------------------------- */

function buildAddButtons(containerId, isEdit) {
  // sheetTarget ('new' or 'edit') tells the sheet confirm handlers which
  // item container to add rows into when the user confirms their selection.
  const t    = isEdit ? 'edit' : 'new';
  const wrap = $(containerId);
  wrap.innerHTML = '';

  const btn = (cls, text, handler) => {
    const b = document.createElement('button');
    b.className = cls; b.textContent = text; b.onclick = handler;
    wrap.appendChild(b);
  };

  btn('add-btn quickset', 'Full Set (Pant+Shirt+Lower+T-Shirt+Tie+Belt+2Socks)', () => openQuickSetSheet(t));
  Object.entries(COMBOS).forEach(([key, cfg]) => btn('add-btn combo', cfg.label, () => openComboSheet(t, key)));
  btn('add-btn combo', 'Suit Set',      () => openComboSheet(t, 'suit-set'));
  btn('add-btn',       '+ Single Item', () => openSingleItemSheet(t));
}

function openSheet(id)  { $(id).classList.add('open'); }
function closeSheet(id, event) {
  if (event && event.target !== $(id)) return;
  $(id).classList.remove('open');
}

function stepQty(spanId, delta) {
  const el = $(spanId);
  el.textContent = Math.max(1, Math.min(99, parseInt(el.textContent) + delta));
}

function buildChips(containerId, values, selectedValue, onSelectFn) {
  const wrap = $(containerId);
  wrap.innerHTML = '';
  values.forEach(v => {
    const chip = document.createElement('div');
    chip.className   = 'chip' + (String(v) === String(selectedValue) ? ' selected' : '');
    chip.textContent = v;
    chip.onclick     = () => onSelectFn(String(v), chip);
    wrap.appendChild(chip);
  });
}

function selectChip(containerId, value, el) {
  $(containerId).querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  return value;
}

// ── Quick Set sheet ──
function openQuickSetSheet(target) {
  sheetTarget = target;
  $('qs-qty').textContent = '1';
  const sizes = [26, 28, 30, 32, 34, 36, 38, 40, 42, 44];
  sheet.quickSetSize = String(sizes[0]);
  buildChips('qs-sizes', sizes, sheet.quickSetSize,
    (v, el) => { sheet.quickSetSize = selectChip('qs-sizes', v, el); });
  openSheet('qs-modal');
}

function confirmQuickSet() {
  closeSheet('qs-modal');
  const isEdit = sheetTarget === 'edit';
  const ctr = isEdit ? 'edit-items-container' : 'items-container';
  const pfx = isEdit ? 'e' : 'n';
  const fn  = isEdit ? 'recalcEdit' : 'recalcNew';
  const size = String(sheet.quickSetSize);
  const qty  = parseInt($('qs-qty').textContent);
  _addCombo(ctr, pfx, fn, 'pant-shirt',   size, size, qty);
  _addCombo(ctr, pfx, fn, 'lower-tshirt', size, size, qty);
  _addItem (ctr, pfx, fn, 'Tie',   parseInt(size) >= 34 ? 'Large' : 'Small', qty);
  _addItem (ctr, pfx, fn, 'Belt',  'All',  qty);
  _addItem (ctr, pfx, fn, 'Socks', 'Pair', qty * 2);
}

// ── Single Item sheet ──
function openSingleItemSheet(target) {
  sheetTarget = target;
  sheet.singleItem = sheet.singleSize = null;
  $('si-qty').textContent = '1';
  $('si-sizes').innerHTML = '<div style="color:var(--text-3);font-size:12px">Select an item first</div>';
  buildChips('si-items', Object.keys(prices), null, (item, el) => {
    sheet.singleItem = selectChip('si-items', item, el);
    const sizes = Object.keys(prices[item] || {});
    let defaultSize = String(sizes[0]);
    if (item === 'Tie') defaultSize = 'Large';
    sheet.singleSize = defaultSize;
    buildChips('si-sizes', sizes, sheet.singleSize,
      (v, el2) => { sheet.singleSize = selectChip('si-sizes', v, el2); });
  });
  openSheet('si-modal');
}

function confirmSingleItem() {
  if (!sheet.singleItem) { toast('Select an item first', 'error'); return; }
  if (!sheet.singleSize) { toast('Select a size first',  'error'); return; }
  closeSheet('si-modal');
  const isEdit = sheetTarget === 'edit';
  _addItem(
    isEdit ? 'edit-items-container' : 'items-container',
    isEdit ? 'e' : 'n',
    isEdit ? 'recalcEdit' : 'recalcNew',
    sheet.singleItem, sheet.singleSize, parseInt($('si-qty').textContent)
  );
}

// ── Combo sheet ──
function openComboSheet(target, type) {
  sheetTarget = target; sheet.comboType = type; sheet.comboSize = null;
  $('co-qty').textContent = '1';
  if (type === 'suit-set') {
    const unit = prices.Suit.All + prices.Trouser.All + prices.Jacket.All;
    $('co-title').textContent  = 'Suit Set';
    $('co-sub').textContent    = `Suit + Trouser + Jacket = ${rupees(unit)} each`;
    $('co-label1').textContent = '';
    $('co-sizes1').innerHTML   = '';
  } else {
    const cfg   = COMBOS[type];
    const sizes = Object.keys(prices[cfg.item1] || {});
    $('co-title').textContent  = cfg.label;
    $('co-sub').textContent    = 'Both items use the same size';
    $('co-label1').textContent = 'Select size';
    sheet.comboSize = String(sizes[0]);
    buildChips('co-sizes1', sizes, sheet.comboSize,
      (v, el) => { sheet.comboSize = selectChip('co-sizes1', v, el); });
  }
  openSheet('co-modal');
}

function confirmCombo() {
  const isEdit = sheetTarget === 'edit';
  const ctr = isEdit ? 'edit-items-container' : 'items-container';
  const pfx = isEdit ? 'e' : 'n';
  const fn  = isEdit ? 'recalcEdit' : 'recalcNew';
  const qty = parseInt($('co-qty').textContent);
  if (sheet.comboType === 'suit-set') {
    closeSheet('co-modal');
    _addCombo(ctr, pfx, fn, 'suit-set', null, null, qty);
    return;
  }
  if (!sheet.comboSize) { toast('Select a size first', 'error'); return; }
  closeSheet('co-modal');
  _addCombo(ctr, pfx, fn, sheet.comboType, sheet.comboSize, sheet.comboSize, qty);
}


/* ----------------------------------------------------------
   9. UI — ITEM ROWS
---------------------------------------------------------- */

function _addItem(containerId, prefix, recalcFn, defaultItem, defaultSize, defaultQty) {
  itemCounter++;
  const id  = prefix + itemCounter;
  const row = cloneTemplate('tpl-item-row');
  row.id = 'item-' + id;

  const itemSel = row.querySelector('.ir-item-sel');
  const sizeSel = row.querySelector('.ir-size-sel');
  const qtyIn   = row.querySelector('.ir-qty');
  const priceEl = row.querySelector('.ir-price');
  const remBtn  = row.querySelector('.ir-remove');

  itemSel.id = 'isel-' + id;
  sizeSel.id = 'ssel-' + id;
  qtyIn.id   = 'qty-'  + id;
  priceEl.id = 'price-'+ id;

  itemSel.appendChild(buildItemOptions(defaultItem || Object.keys(prices)[0]));
  sizeSel.appendChild(buildSizeOptions(defaultItem || Object.keys(prices)[0], defaultSize));
  qtyIn.value = defaultQty || 1;

  itemSel.addEventListener('change', () => {
    sizeSel.innerHTML = '';
    sizeSel.appendChild(buildSizeOptions(itemSel.value));
    window[recalcFn]();
  });
  sizeSel.addEventListener('change', () => window[recalcFn]());
  qtyIn.addEventListener('input',    () => window[recalcFn]());
  remBtn.addEventListener('click',   () => { row.remove(); window[recalcFn](); });

  $(containerId).appendChild(row);
  window[recalcFn]();
}

function _addCombo(containerId, prefix, recalcFn, type, defaultSize1, defaultSize2, defaultQty) {
  itemCounter++;
  const id  = prefix + itemCounter;
  const qty = defaultQty || 1;

  if (type === 'suit-set') {
    const row   = cloneTemplate('tpl-suit-row');
    row.id      = 'item-' + id;
    const qtyIn = row.querySelector('.sr-qty');
    const price = row.querySelector('.sr-price');
    const info  = row.querySelector('.sr-info');
    const rem   = row.querySelector('.sr-remove');

    qtyIn.id = 'qty-' + id; price.id = 'price-' + id;
    qtyIn.value = qty;

    const unit = prices.Suit.All + prices.Trouser.All + prices.Jacket.All;
    info.textContent  = `Suit ${rupees(prices.Suit.All)} + Trouser ${rupees(prices.Trouser.All)} + Jacket ${rupees(prices.Jacket.All)} = ${rupees(unit)} each`;
    price.textContent = rupees(unit * qty);

    qtyIn.addEventListener('input', () => window[recalcFn]());
    rem.addEventListener('click',   () => { row.remove(); window[recalcFn](); });
    $(containerId).appendChild(row);

  } else {
    const cfg  = COMBOS[type];
    const row  = cloneTemplate('tpl-combo-row');
    row.id            = 'item-' + id;
    row.dataset.item1 = cfg.item1;
    row.dataset.item2 = cfg.item2;

    const qtyIn   = row.querySelector('.cr-qty');
    const price   = row.querySelector('.cr-price');
    const size1   = row.querySelector('.cr-size1');
    const size2   = row.querySelector('.cr-size2');
    const subRow1 = row.querySelector('.cr-row1');
    const subRow2 = row.querySelector('.cr-row2');

    row.querySelector('.cr-label').textContent  = cfg.label;
    row.querySelector('.cr-label1').textContent = cfg.item1;
    row.querySelector('.cr-label2').textContent = cfg.item2;

    qtyIn.id = 'qty-' + id; price.id = 'price-' + id;
    size1.id = 's1-'  + id; size2.id  = 's2-'   + id;
    qtyIn.value = qty;

    size1.appendChild(buildSizeOptions(cfg.item1, defaultSize1));
    size2.appendChild(buildSizeOptions(cfg.item2, defaultSize2 || defaultSize1));

    const recalc = () => window[recalcFn]();
    qtyIn.addEventListener('input',  recalc);
    size1.addEventListener('change', recalc);
    size2.addEventListener('change', recalc);
    row.querySelector('.cr-remove').addEventListener('click', () => { row.remove(); recalc(); });

    row.querySelector('.cr-remove1').addEventListener('click', () => {
      subRow1.remove();
      if (!row.querySelectorAll('.combo-item-row').length) row.remove();
      recalc();
    });
    row.querySelector('.cr-remove2').addEventListener('click', () => {
      subRow2.remove();
      if (!row.querySelectorAll('.combo-item-row').length) row.remove();
      recalc();
    });

    $(containerId).appendChild(row);
  }

  window[recalcFn]();
}

// Walk all item rows in containerId, compute their line totals using pricesObj,
// update each row's price display, and return the overall subtotal.
function _recalc(containerId, totalId, pricesObj = prices) {
  let subtotal = 0;
  $(containerId)?.querySelectorAll('.js-item-row').forEach(row => {
    const id      = row.id.replace('item-', '');
    const type    = row.dataset.type;
    const qtyEl   = $('qty-'   + id);
    const priceEl = $('price-' + id);
    if (!qtyEl || !priceEl) return;
    const qty = parseInt(qtyEl.value) || 1;
    let unit = 0;
    if (type === 'single') {
      const is = $('isel-' + id), ss = $('ssel-' + id);
      if (!is) return;
      unit = pricesObj[is.value]?.[ss.value] || pricesObj[is.value]?.[parseInt(ss.value)] || 0;
    } else if (type === 'suit-set') {
      unit = pricesObj.Suit.All + pricesObj.Trouser.All + pricesObj.Jacket.All;
    } else if (type === 'combo') {
      const s1 = $('s1-' + id), s2 = $('s2-' + id);
      if (s1) unit += pricesObj[row.dataset.item1]?.[s1.value] || pricesObj[row.dataset.item1]?.[parseInt(s1.value)] || 0;
      if (s2) unit += pricesObj[row.dataset.item2]?.[s2.value] || pricesObj[row.dataset.item2]?.[parseInt(s2.value)] || 0;
    }
    const line = unit * qty;
    subtotal  += line;
    priceEl.textContent = rupees(line);
  });
  const el = $(totalId); if (el) el.textContent = rupees(subtotal);
  return subtotal;
}

function recalcNew()  { _recalc('items-container', 'grand-total'); }
function recalcEdit() {
  // Use the edited order's own branch prices, not the current new-order branch
  const order = editOrderId ? savedOrders.find(o => o.id === editOrderId) : null;
  _recalc('edit-items-container', 'eo-grand-total', PRICES[getOrderBranch(order) || 'badagaon']);
}

function collectItems(containerId, pricesObj = prices) {
  const items = [];
  let subtotal = 0;
  $(containerId)?.querySelectorAll('.js-item-row').forEach(row => {
    const id   = row.id.replace('item-', '');
    const type = row.dataset.type;
    const qty  = parseInt($('qty-' + id)?.value) || 1;
    let unit = 0, label = '', extra = {};

    if (type === 'single') {
      const is = $('isel-' + id), ss = $('ssel-' + id);
      if (!is) return;
      unit  = pricesObj[is.value]?.[ss.value] || pricesObj[is.value]?.[parseInt(ss.value)] || 0;
      label = `${is.value} (${ss.value})${qty > 1 ? ' x ' + qty : ''}`;
      extra = { itemType: 'single', itemName: is.value, itemSize: ss.value };

    } else if (type === 'suit-set') {
      unit  = pricesObj.Suit.All + pricesObj.Trouser.All + pricesObj.Jacket.All;
      label = `Suit Set (Suit + Trouser + Jacket)${qty > 1 ? ' x ' + qty : ''}`;
      extra = { itemType: 'suit-set' };

    } else if (type === 'combo') {
      const s1 = $('s1-' + id), s2 = $('s2-' + id);
      if (!s1 && !s2) return;
      const n1 = row.dataset.item1, n2 = row.dataset.item2;
      if (s1) unit += pricesObj[n1]?.[s1.value] || pricesObj[n1]?.[parseInt(s1.value)] || 0;
      if (s2) unit += pricesObj[n2]?.[s2.value] || pricesObj[n2]?.[parseInt(s2.value)] || 0;
      const parts = [];
      if (s1) parts.push(`${n1} (${s1.value})`);
      if (s2) parts.push(`${n2} (${s2.value})`);
      label = parts.join(' + ') + (qty > 1 ? ' x ' + qty : '');
      extra = {
        itemType:  'combo',
        item1Name: s1 ? n1 : null, item1Size: s1 ? s1.value : null,
        item2Name: s2 ? n2 : null, item2Size: s2 ? s2.value : null
      };
    }
    subtotal += unit * qty;
    items.push({ label, lineTotal: unit * qty, qty, unit, ...extra });
  });
  return { items, subtotal };
}


/* ----------------------------------------------------------
   10. UI — SAVE & RESET
---------------------------------------------------------- */

function saveOrder() {
  const fields = readStudentFields('new');
  if (!fields.studentName) { toast('Please enter student name', 'error'); return; }
  if (!$('items-container')?.querySelector('.js-item-row')) { toast('Please add at least one item', 'error'); return; }
  if (fields.mobile && !/^[0-9+\s\-]{7,15}$/.test(fields.mobile)) {
    toast('Mobile number looks incorrect — please check', 'error'); return;
  }

  const { items, subtotal } = collectItems('items-container');
  orderCounter++;
  saveCounter();

  const newDiscount = parseFloat($('new-discount')?.value) || 0;
  let payments = [];
  if (newOrderPayMode !== 'pending') {
    const raw   = $('paid-amt')?.value.trim();
    let paidAmt = raw !== '' ? parseFloat(raw) : Math.max(0, subtotal - newDiscount);
    paidAmt     = Math.min(Math.max(0, paidAmt), subtotal);
    if (paidAmt > 0)
      payments = [{ mode: newOrderPayMode, amount: paidAmt, date: new Date().toLocaleDateString('en-IN') }];
  }

  savedOrders.unshift({
    id:            Date.now(),
    orderNum:      orderCounter,
    branch:        currentBranch,   // stored as 'branch' going forward
    ...fields,
    payments,
    items,
    subtotal,
    orderDiscount: newDiscount,
    date:          new Date().toLocaleDateString('en-IN'),
    deliveryUnits: buildDeliveryUnits(items).map(u => ({ ...u, given: true }))
  });

  saveLocal();
  toast(`Order #${String(orderCounter).padStart(3, '0')} saved — ${fields.studentName}, ${rupees(subtotal)}`);
  resetNewForm();
  showTab('orders');
}

function resetNewForm() {
  clearStudentFields('new');
  if ($('paid-amt'))     $('paid-amt').value     = '';
  if ($('new-discount')) $('new-discount').value = '';
  const ctn = $('items-container'); if (ctn) ctn.innerHTML = '';
  itemCounter = 0;
  setNewOrderPayMode('pending');
  recalcNew();
  document.activeElement?.blur();
}


/* ----------------------------------------------------------
   11. UI — ANALYTICS
---------------------------------------------------------- */

function setAnalyticsDate(v)   { analyticsDate   = v; renderAnalytics(); }
function setAnalyticsBranch(v) { analyticsBranch = v; renderAnalytics(); }

function makeAnRow(label, count, amt, color) {
  const row = cloneTemplate('tpl-an-row');
  row.querySelector('.anr-dot').style.background = color;
  row.querySelector('.anr-label').textContent    = label;
  row.querySelector('.anr-count').textContent    = count;
  row.querySelector('.anr-amt').textContent      = rupees(amt);
  return row;
}

function makeAnRowPlain(label, count, color) {
  const row = cloneTemplate('tpl-an-row-plain');
  row.querySelector('.anrp-dot').style.background = color;
  row.querySelector('.anrp-label').textContent    = label;
  row.querySelector('.anrp-count').textContent    = count;
  return row;
}

function makeAnSection(title) {
  const sec = document.createElement('div');
  sec.className = 'section'; sec.style.marginBottom = '1rem';
  const t = document.createElement('div');
  t.className = 'section-title'; t.textContent = title;
  sec.appendChild(t);
  return sec;
}

function renderAnalytics() {
  function parseDate(str) { const p = (str || '').split('/'); return new Date(p[2], p[1] - 1, p[0]); }

  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let base    = savedOrders;

  if (analyticsDate === 'today') {
    base = base.filter(o => parseDate(o.date).getTime() === today.getTime());
  } else if (analyticsDate === 'week') {
    const week = new Date(today); week.setDate(today.getDate() - 6);
    base = base.filter(o => { const d = parseDate(o.date); return d >= week && d <= today; });
  }

  const orders = analyticsBranch === 'all'
    ? base
    : base.filter(o => getOrderBranch(o) === analyticsBranch);

  const sumC = arr => arr.reduce((s, o) => s + totalCollected(o), 0);

  let cashAmt = 0, onlineAmt = 0, pendingAmt = 0;
  orders.forEach(o => {
    pendingAmt += balanceDue(o);
    getPayments(o).forEach(p => {
      if (p.mode === 'cash')   cashAmt   += p.amount || 0;
      if (p.mode === 'online') onlineAmt += p.amount || 0;
    });
  });

  const collected         = cashAmt + onlineAmt;
  const ordersWithPayment = orders.filter(o => totalCollected(o) > 0);
  const ordersWithBalance = orders.filter(o => balanceDue(o) > 0);
  const cashOrders        = orders.filter(o => paymentStatus(o) === 'cash');
  const onlineOrders      = orders.filter(o => paymentStatus(o) === 'online');
  const splitOrders       = orders.filter(o => paymentStatus(o) === 'split');
  const partialOrders     = orders.filter(o => paymentStatus(o) === 'partial');
  const pendingOrders     = orders.filter(o => paymentStatus(o) === 'pending');
  const badagaon          = orders.filter(o => getOrderBranch(o) === 'badagaon');
  const baghpat           = orders.filter(o => getOrderBranch(o) === 'baghpat');
  const ordersWithPending = orders.filter(o => pendingItemCount(o) > 0);
  const totalPendItems    = orders.reduce((s, o) => s + pendingItemCount(o), 0);
  const fullyDelivered    = orders.filter(o => allItemsDelivered(o));

  const wrap = $('analytics-content');
  wrap.innerHTML = '';

  const headerCard = document.createElement('div');
  headerCard.className = 'section an-header-card';
  headerCard.style.marginBottom = '1rem';

  const makeSegBtn = (value, label, current, setter) => {
    const b = document.createElement('button');
    b.className   = 'an-seg-btn' + (current === value ? ' active' : '');
    b.textContent = label;
    b.onclick     = () => setter(value);
    return b;
  };

  const makeFilterGroup = (labelText, pairs, current, setter) => {
    const grp = document.createElement('div'); grp.className = 'an-filter-group';
    const lbl = document.createElement('label'); lbl.className = 'an-filter-label'; lbl.textContent = labelText;
    const seg = document.createElement('div');   seg.className = 'an-seg';
    pairs.forEach(([v, l]) => seg.appendChild(makeSegBtn(v, l, current, setter)));
    grp.appendChild(lbl); grp.appendChild(seg);
    return grp;
  };

  const filterRow = document.createElement('div'); filterRow.className = 'an-filter-row';
  filterRow.appendChild(makeFilterGroup('Period', [['today','Today'],['week','Week'],['all','All Time']], analyticsDate,   setAnalyticsDate));
  filterRow.appendChild(makeFilterGroup('Branch', [['all','All'],['badagaon','Badagaon'],['baghpat','Baghpat']],           analyticsBranch, setAnalyticsBranch));

  const totBlock = document.createElement('div'); totBlock.className = 'an-total-block';
  totBlock.innerHTML = `
    <div class="an-total-label">Total Revenue</div>
    <div class="an-total-amt">${rupees(collected + pendingAmt)}</div>
    <div class="an-total-sub">${orders.length} order${orders.length !== 1 ? 's' : ''}</div>`;

  headerCard.appendChild(filterRow);
  headerCard.appendChild(totBlock);
  wrap.appendChild(headerCard);

  const collSec = makeAnSection('Collection');
  collSec.appendChild(makeAnRow('Any payment received',  ordersWithPayment.length, collected,   '#16a34a'));
  collSec.appendChild(makeAnRow('Balance outstanding',   ordersWithBalance.length, pendingAmt,  '#d97706'));
  const divider = document.createElement('div'); divider.className = 'an-divider'; divider.style.margin = '8px 0 10px';
  collSec.appendChild(divider);
  collSec.appendChild(makeAnRow('Cash',    cashOrders.length,    cashAmt,          '#16a34a'));
  collSec.appendChild(makeAnRow('Online',  onlineOrders.length,  onlineAmt,        '#1d4ed8'));
  if (splitOrders.length)   collSec.appendChild(makeAnRow('Split',   splitOrders.length,   sumC(splitOrders),   '#6d28d9'));
  if (partialOrders.length) collSec.appendChild(makeAnRow('Partial', partialOrders.length, sumC(partialOrders), '#d97706'));
  if (pendingOrders.length) collSec.appendChild(makeAnRow('Pending', pendingOrders.length, 0,                   '#9ca3af'));
  wrap.appendChild(collSec);

  const dvSec = makeAnSection('Delivery Status');
  dvSec.appendChild(makeAnRowPlain('Orders with pending items', ordersWithPending.length, '#e11d48'));
  dvSec.appendChild(makeAnRowPlain('Total items not yet given', totalPendItems,           '#e11d48'));
  dvSec.appendChild(makeAnRowPlain('Fully delivered orders',    fullyDelivered.length,    '#16a34a'));
  wrap.appendChild(dvSec);

  if (analyticsBranch === 'all') {
    const branchSec = makeAnSection('By Branch');
    branchSec.appendChild(makeAnRow('Badagaon', badagaon.length, sumC(badagaon), '#16a34a'));
    branchSec.appendChild(makeAnRow('Baghpat',  baghpat.length,  sumC(baghpat),  '#1d4ed8'));
    wrap.appendChild(branchSec);
  }
}


/* ----------------------------------------------------------
   12. UI — FILTERS
---------------------------------------------------------- */

function toggleFilterSheet() { $('filter-dropdown').classList.toggle('open'); }

function setDateFilter(f) {
  dateFilter = f;
  ['all', 'today', 'week'].forEach(k => $('fopt-' + k)?.classList.toggle('active', k === f));
  renderOrders(getSearchValue()); updateFilterBar();
}

function setBranchFilter(f) {
  branchFilter = f;
  ['all', 'badagaon', 'baghpat'].forEach(k => $('fopt-branch-' + k)?.classList.toggle('active', k === f));
  renderOrders(getSearchValue()); updateFilterBar();
}

function setDeliveryFilter(f) {
  deliveryFilter = f;
  ['all', 'pending-delivery'].forEach(k => $('fopt-del-' + k)?.classList.toggle('active', k === f));
  renderOrders(getSearchValue()); updateFilterBar();
}

function setPaymentFilter(f) {
  paymentFilter = f;
  ['all', 'pending'].forEach(k => $('fopt-pay-' + k)?.classList.toggle('active', k === f));
  renderOrders(getSearchValue()); updateFilterBar();
}

function updateFilterBar() {
  const el  = $('filter-bar-label');
  const dot = $('filter-dot');
  const btn = document.querySelector('.filter-btn');
  const active = dateFilter !== 'all' || branchFilter !== 'all' || paymentFilter !== 'all' || deliveryFilter !== 'all';

  if (el) {
    if (active) {
      el.innerHTML = `<button class="filter-clear-btn" onclick="clearFilters()">✕ Clear filters</button>`;
    } else {
      el.innerHTML = '';
    }
  }
  if (dot) dot.style.display = active ? 'block' : 'none';
  if (btn) btn.classList.toggle('active', active);
}

function clearFilters() {
  dateFilter = branchFilter = paymentFilter = deliveryFilter = 'all';
  ['all', 'today', 'week'].forEach(k      => $('fopt-' + k)?.classList.toggle('active',        k === 'all'));
  ['all', 'badagaon', 'baghpat'].forEach(k => $('fopt-branch-' + k)?.classList.toggle('active', k === 'all'));
  ['all', 'pending'].forEach(k            => $('fopt-pay-' + k)?.classList.toggle('active',     k === 'all'));
  ['all', 'pending-delivery'].forEach(k   => $('fopt-del-' + k)?.classList.toggle('active',     k === 'all'));
  renderOrders(getSearchValue()); updateFilterBar();
}

function matchesFilter(order) {
  if (paymentFilter === 'pending') {
    const s = paymentStatus(order);
    if (s !== 'pending' && s !== 'partial') return false;
  }
  if (deliveryFilter === 'pending-delivery' && pendingItemCount(order) === 0) return false;
  if (branchFilter !== 'all' && getOrderBranch(order) !== branchFilter) return false;
  if (dateFilter === 'all') return true;
  const p = (order.date || '').split('/');
  const d = new Date(p[2], p[1] - 1, p[0]);
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (dateFilter === 'today') return d.getTime() === today.getTime();
  if (dateFilter === 'week')  { const w = new Date(today); w.setDate(today.getDate() - 6); return d >= w && d <= today; }
  return true;
}


/* ----------------------------------------------------------
   13. UI — RENDER ORDERS LIST
---------------------------------------------------------- */

function renderOrders(query) {
  query = (query || '').toLowerCase();

  const filtered = savedOrders.filter(o => {
    if (!matchesFilter(o)) return false;
    const num = o.orderNum ? '#' + String(o.orderNum).padStart(3, '0') : '';
    return (o.studentName  || '').toLowerCase().includes(query) ||
           (o.studentClass || '').toLowerCase().includes(query) ||
           (o.parentName   || '').toLowerCase().includes(query) ||
           (o.mobile       || '').includes(query)               ||
           (getOrderBranch(o)).toLowerCase().includes(query)    ||
           (o.notes        || '').toLowerCase().includes(query) ||
           num.includes(query);
  });

  const now        = new Date();
  const today      = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const pendingAll = savedOrders.filter(o => balanceDue(o) > 0 || paymentStatus(o) === 'pending');
  const pendingTdy = pendingAll.filter(o => {
    const p = (o.date || '').split('/');
    return new Date(p[2], p[1] - 1, p[0]).getTime() === today.getTime();
  });

  const pendDelivAll = savedOrders.filter(o => pendingItemCount(o) > 0);
  const delivBanner  = $('delivery-banner');
  if (delivBanner) {
    if (pendDelivAll.length) {
      const tot = pendDelivAll.reduce((s, o) => s + pendingItemCount(o), 0);
      delivBanner.style.display = 'flex';
      $('delivery-count').textContent       = pendDelivAll.length;
      $('delivery-items-count').textContent = `${tot} item${tot !== 1 ? 's' : ''} pending`;
      delivBanner.onclick = () => {
        $('orders-search').value = ''; $('orders-search-clear') && ($('orders-search-clear').style.display = 'none');
        setDeliveryFilter('pending-delivery');
      };
    } else {
      delivBanner.style.display = 'none';
    }
  }

  const banner = $('pending-banner');
  if (pendingAll.length) {
    banner.style.display = 'flex';
    $('pending-count').textContent = pendingAll.length;
    // Note: banner always counts across all branches so the note only shows when
    // a branch filter is active (which would cause the number to appear inconsistent)
    const note = branchFilter !== 'all' ? ' (all branches)' : '';
    $('pending-today').textContent = pendingTdy.length
      ? `${pendingTdy.length} today${note}` : `none today${note}`;
    banner.onclick = () => {
      $('orders-search').value = ''; $('orders-search-clear') && ($('orders-search-clear').style.display = 'none');
      setPaymentFilter('pending');
    };
  } else {
    banner.style.display = 'none';
  }

  const bannersRow = $('banners-row');
  if (bannersRow) {
    const eitherVisible = pendingAll.length || pendDelivAll.length;
    bannersRow.style.display = eitherVisible ? 'flex' : 'none';
  }

  const totalSub = filtered.reduce((s, o) => s + (o.subtotal || 0), 0);
  const totalCol = filtered.reduce((s, o) => s + totalCollected(o), 0);
  $('orders-summary').textContent =
    `${filtered.length} order${filtered.length !== 1 ? 's' : ''} — Total: ${rupees(totalSub)} | Collected: ${rupees(totalCol)}`;

  const list = $('orders-list');
  list.innerHTML = '';

  if (!filtered.length) {
    const empty = document.createElement('div');
    empty.className = 'empty'; empty.textContent = 'No orders found';
    list.appendChild(empty);
    return;
  }

  const STATUS_LABEL = { cash: 'Cash', online: 'Online', split: 'Split', partial: 'Partial', pending: 'Pending' };

  filtered.forEach(o => {
    const status    = paymentStatus(o);
    const branch    = getOrderBranch(o);
    const payments  = getPayments(o);
    const pendCount = pendingItemCount(o);

    const card = cloneTemplate('tpl-order-card');
    card.id    = 'card-' + o.id;

    card.querySelector('.oc-student-name').textContent  = o.studentName || '';
    card.querySelector('.oc-student-class').textContent = o.studentClass ? ' ' + o.studentClass : '';
    card.querySelector('.oc-meta').textContent          = `${BRANCH_LABEL[branch]} · ${o.date}`;

    const contactEl = card.querySelector('.oc-contact');
    if (o.parentName || o.mobile) contactEl.textContent = [o.parentName, o.mobile].filter(Boolean).join(' · ');
    else contactEl.style.display = 'none';

    const statusBadge = card.querySelector('.oc-status-badge');
    statusBadge.textContent = STATUS_LABEL[status];
    statusBadge.classList.add(status);

    const numBadge = card.querySelector('.oc-order-num');
    if (o.orderNum) numBadge.textContent = '#' + String(o.orderNum).padStart(3, '0');
    else numBadge.style.display = 'none';

    if (pendCount > 0) {
      const dvBadge = card.querySelector('.oc-delivery-badge');
      card.querySelector('.oc-delivery-text').textContent = `${pendCount} not given`;
      dvBadge.style.display = 'inline-flex';
      dvBadge.onclick = () => openDeliverySheet(o.id);
    }

    const qpBtn = card.querySelector('.oc-quick-pay');
    if (status === 'pending' || status === 'partial') {
      qpBtn.style.display = 'inline-flex';
      qpBtn.onclick = () => openPaymentSheet(o.id);
    }

    if (o.notes) {
      const notesEl = card.querySelector('.oc-notes');
      notesEl.style.display = 'flex';
      notesEl.querySelector('.oc-notes-text').textContent = o.notes;
    }

    card.querySelector('.oc-amount').textContent = rupees(o.subtotal);

    const menuDrop = card.querySelector('.oc-menu-dropdown');
    card.querySelector('.oc-menu-btn').onclick = e => {
      e.stopPropagation();
      const isOpen = menuDrop.classList.contains('open');
      document.querySelectorAll('.menu-dropdown.open').forEach(m => m.classList.remove('open'));
      if (!isOpen) menuDrop.classList.add('open');
    };
    card.querySelector('.oc-edit-btn').onclick          = () => { menuDrop.classList.remove('open'); openEditOrder(o.id); };
    card.querySelector('.oc-delivery-menu-btn').onclick  = () => { menuDrop.classList.remove('open'); openDeliverySheet(o.id); };
    card.querySelector('.oc-payment-menu-btn').onclick   = () => { menuDrop.classList.remove('open'); openPaymentSheet(o.id); };
    card.querySelector('.oc-whatsapp-btn').onclick       = () => { menuDrop.classList.remove('open'); openWhatsApp(o.id); };
    card.querySelector('.oc-delete-btn').onclick         = () => { menuDrop.classList.remove('open'); deleteOrder(o.id); };

    const panel   = card.querySelector('.oc-items-panel');
    const chevron = card.querySelector('.oc-chevron');
    const togBtn  = card.querySelector('.oc-toggle-btn');
    togBtn.querySelector('.oc-item-count').textContent = 'Details';
    togBtn.onclick = () => {
      const open = panel.style.display !== 'none';
      panel.style.display = open ? 'none' : 'block';
      chevron.textContent = open ? '▸' : '▾';
    };

    const units = ensureDeliveryUnits(o);
    let dvOffset = 0;
    (o.items || []).forEach(item => {
      const qty  = item.qty || 1;
      // uPQ = units per quantity: how many physical pieces one unit of this row represents
      const uPQ  = item.itemType === 'suit-set' ? 3
        : item.itemType === 'combo' ? [item.item1Name, item.item2Name].filter(Boolean).length : 1;
      const rowUnits  = units.slice(dvOffset, dvOffset + qty * uPQ);
      dvOffset += qty * uPQ;
      const pendUnits = rowUnits.filter(u => !u.given).length;

      const line = cloneTemplate('tpl-order-item-line');
      line.querySelector('.oil-dot').classList.add(pendUnits > 0 ? 'dot-pending' : 'dot-given');
      line.querySelector('.oil-label').textContent = item.label;
      line.querySelector('.oil-price').textContent = rupees(item.lineTotal);
      if (pendUnits > 0) {
        const pn = line.querySelector('.oil-pend-note');
        pn.style.display = 'inline'; pn.textContent = `${pendUnits} not given`;
      }
      panel.appendChild(line);
    });

    const subRow = document.createElement('div');
    subRow.className = 'order-final-row';
    subRow.innerHTML = `<span>Subtotal</span><span>${rupees(o.subtotal)}</span>`;
    panel.appendChild(subRow);

    payments.forEach((p, i) => {
      const pRow = cloneTemplate('tpl-pay-history-row');
      pRow.querySelector('.phr-label').textContent = `Payment ${i + 1} · ${p.mode.charAt(0).toUpperCase() + p.mode.slice(1)} · ${p.date}`;
      pRow.querySelector('.phr-amt').textContent   = rupees(p.amount);
      panel.appendChild(pRow);
    });

    const discount = totalDiscount(o);
    if (discount > 0) {
      const dRow = document.createElement('div');
      dRow.className = 'order-item-line'; dRow.style.color = '#dc2626';
      dRow.innerHTML = `<span>Discount</span><span>-${rupees(discount)}</span>`;
      panel.appendChild(dRow);
    }

    const balance = balanceDue(o);
    if (balance > 0) {
      const bRow = document.createElement('div');
      bRow.className = 'order-final-row'; bRow.style.color = '#d97706';
      bRow.innerHTML = `<span>Balance Due</span><span>${rupees(balance)}</span>`;
      panel.appendChild(bRow);
    }

    list.appendChild(card);
  });
}


/* ----------------------------------------------------------
   14. UI — DELIVERY SHEET
---------------------------------------------------------- */

function openDeliverySheet(id) {
  const order = savedOrders.find(o => o.id === id);
  if (!order) return;
  deliverySheetOrderId = id;
  renderDeliverySheet(order);
  openSheet('dv-modal');
}

function renderDeliverySheet(order) {
  const units      = ensureDeliveryUnits(order);
  const pendCount  = units.filter(u => !u.given).length;
  const givenCount = units.length - pendCount;

  $('dv-student').textContent = `${order.studentName}${order.studentClass ? ' · ' + order.studentClass : ''}`;
  $('dv-summary').textContent = pendCount === 0
    ? `All ${units.length} piece${units.length !== 1 ? 's' : ''} given`
    : `${pendCount} not given · ${givenCount} given`;

  const ctn = $('dv-items');
  ctn.innerHTML = '';
  units.forEach(u => {
    const row = cloneTemplate('tpl-dv-item');
    const isPending = !u.given;
    row.classList.add(isPending ? 'dv-pending' : 'dv-given');
    row.querySelector('.dvi-dot').classList.add(isPending ? 'dot-pending' : 'dot-given');
    row.querySelector('.dvi-label').textContent  = u.label;
    row.querySelector('.dvi-status').textContent = isPending ? 'Not given' : 'Given';
    const cb = row.querySelector('.dvi-check');
    cb.checked = u.given;
    cb.addEventListener('change', () => toggleItemDelivery(order.id, u.key, cb.checked));
    ctn.appendChild(row);
  });
}

function toggleItemDelivery(orderId, unitKey, isGiven) {
  const idx = savedOrders.findIndex(o => o.id === orderId);
  if (idx === -1) return;
  const units = ensureDeliveryUnits(savedOrders[idx]);
  const unit  = units.find(u => u.key === unitKey);
  if (unit) unit.given = isGiven;
  savedOrders[idx].deliveryUnits = units;
  saveLocal();
  renderDeliverySheet(savedOrders[idx]);
  renderOrders(getSearchValue());
  if (units.every(u => u.given))
    toast(`All items marked as given for ${savedOrders[idx].studentName}`);
}

function markAllDelivered(orderId) {
  const idx = savedOrders.findIndex(o => o.id === orderId);
  if (idx === -1) return;
  const units = ensureDeliveryUnits(savedOrders[idx]);
  units.forEach(u => u.given = true);
  savedOrders[idx].deliveryUnits = units;
  saveLocal();
  renderDeliverySheet(savedOrders[idx]);
  renderOrders(getSearchValue());
  toast('All items marked as given');
}


/* ----------------------------------------------------------
   15. UI — PAYMENT SHEET
---------------------------------------------------------- */

function refreshPaymentSheetHistory(id) {
  const order    = savedOrders.find(o => o.id === id);
  if (!order) return;
  const payments = getPayments(order);
  const histWrap = $('ep-history');
  histWrap.innerHTML = '';

  const infoBlock = document.createElement('div');
  infoBlock.className = 'ep-info-block';

  if (payments.length) {
    const histSec = document.createElement('div');
    histSec.className = 'ep-info-section';

    const histLabel = document.createElement('div');
    histLabel.style.cssText = 'font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px';
    histLabel.textContent = 'Payment History';
    histSec.appendChild(histLabel);

    payments.forEach((p, i) => {
      const entry = cloneTemplate('tpl-pay-entry');
      entry.querySelector('.pe-mode').textContent = p.mode.charAt(0).toUpperCase() + p.mode.slice(1);
      entry.querySelector('.pe-date').textContent = p.date;
      entry.querySelector('.pe-amt').textContent  = rupees(p.amount);
      entry.querySelector('.pe-del').onclick      = () => confirmDeletePayEntry(id, i);
      entry.style.background = 'transparent';
      entry.style.borderRadius = '0';
      entry.style.padding = '4px 0';
      entry.style.marginBottom = '2px';
      histSec.appendChild(entry);
    });

    infoBlock.appendChild(histSec);
  }

  const totalsSec = document.createElement('div');
  totalsSec.className = 'ep-info-section';

  const makeRow = (label, val, cls) => {
    const row = document.createElement('div');
    row.className = 'ep-totals-row';
    row.innerHTML = `<span class="ep-totals-label">${label}</span><span class="ep-totals-val ${cls || ''}">${val}</span>`;
    return row;
  };

  const bal = balanceDue(order);
  totalsSec.appendChild(makeRow('Order total',    rupees(order.subtotal),         ''));
  totalsSec.appendChild(makeRow('Collected',      rupees(totalCollected(order)),  'green'));
  totalsSec.appendChild(makeRow('Balance due',    rupees(bal),                   bal > 0 ? 'orange' : ''));

  infoBlock.appendChild(totalsSec);
  histWrap.appendChild(infoBlock);

  if (!(parseFloat($('ep-amt').value) || 0))
    $('ep-amt').value = bal > 0 ? bal : '';
}

function openPaymentSheet(id) {
  const order = savedOrders.find(o => o.id === id);
  if (!order) return;
  paySheetOrderId = id;
  $('ep-amt').value      = '';
  $('ep-discount').value = order.orderDiscount > 0 ? order.orderDiscount : '';
  refreshPaymentSheetHistory(id);
  setPaymentSheetMode('cash');
  openSheet('ep-modal');
}

function setPaymentSheetMode(mode) {
  ['cash', 'online'].forEach(m => { const b = $('ep-' + m); if (b) b.className = 'edit-pay-btn'; });
  $('ep-' + mode)?.classList.add(mode + '-active');
  $('ep-modal').dataset.chosenMode = mode;
}

function syncDiscountAmount() {
  const order = savedOrders.find(o => o.id === paySheetOrderId);
  if (!order) return;
  const disc = parseFloat($('ep-discount').value) || 0;
  $('ep-amt').value = Math.max(0, (order.subtotal || 0) - totalCollected(order) - disc);
}

function savePaymentEntry() {
  if (!paySheetOrderId) return;
  const idx = savedOrders.findIndex(o => o.id === paySheetOrderId);
  if (idx === -1) return;

  const newMode = $('ep-modal').dataset.chosenMode || 'cash';
  const amtVal  = parseFloat($('ep-amt').value)      || 0;
  const discVal = parseFloat($('ep-discount').value) || 0;

  if (amtVal < 0) { toast('Amount cannot be negative', 'error'); return; }
  const curBal = balanceDue(savedOrders[idx]);
  if (amtVal > curBal && curBal > 0)
    if (!confirm(`Amount (${rupees(amtVal)}) exceeds balance (${rupees(curBal)}). Continue?`)) return;
  if (discVal > 0 && amtVal === 0)
    if (!confirm(`Apply a discount of ${rupees(discVal)} with no payment received?`)) return;

  const payments = [...getPayments(savedOrders[idx])];
  if (amtVal > 0)
    payments.push({ mode: newMode, amount: amtVal, date: new Date().toLocaleDateString('en-IN') });
  savedOrders[idx].payments      = payments;
  savedOrders[idx].orderDiscount = discVal;
  saveLocal();
  closeSheet('ep-modal');
  renderOrders(getSearchValue());
  toast(amtVal > 0 ? 'Payment added' : `Discount of ${rupees(discVal)} applied`);
}

function confirmDeletePayEntry(orderId, entryIndex) {
  const order = savedOrders.find(o => o.id === orderId);
  if (!order) return;
  const entry = getPayments(order)[entryIndex];
  if (!entry) return;
  pendingPayDeleteId = { orderId, entryIndex };
  $('del-modal-sub').textContent =
    `${entry.mode.charAt(0).toUpperCase() + entry.mode.slice(1)} payment of ${rupees(entry.amount)} on ${entry.date}. This cannot be undone.`;
  $('del-modal').dataset.mode = 'payment';
  openDelModal();
}


/* ----------------------------------------------------------
   16. UI — DELETE ORDER
---------------------------------------------------------- */

function openDelModal()  { $('del-modal').classList.add('open');    }
function closeDelModal() { $('del-modal').classList.remove('open'); }

function deleteOrder(id) {
  const order = savedOrders.find(o => o.id === id);
  pendingDeleteId = id;
  $('del-modal-sub').textContent = order
    ? `${order.studentName || 'This order'} — ${rupees(order.subtotal)}. This cannot be undone.`
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
    const payments = [...getPayments(savedOrders[idx])];
    payments.splice(entryIndex, 1);
    savedOrders[idx].payments      = payments;
    savedOrders[idx].orderDiscount = savedOrders[idx].orderDiscount || 0;
    saveLocal();
    toast('Payment entry deleted');
    closeSheet('ep-modal');
    renderOrders(getSearchValue());
  } else {
    if (!pendingDeleteId) return;
    savedOrders     = savedOrders.filter(o => o.id !== pendingDeleteId);
    pendingDeleteId = null;
    saveLocal();
    toast('Order deleted');
    renderOrders(getSearchValue());
  }
}


/* ----------------------------------------------------------
   17. UI — EDIT ORDER
---------------------------------------------------------- */

function openEditOrder(id) {
  const order = savedOrders.find(o => o.id === id);
  if (!order) return;
  editOrderId = id;
  itemCounter = 0;

  const editBranch = getOrderBranch(order);
  const editPrices = PRICES[editBranch];

  // Temporarily override global prices so _addItem / _addCombo pick up the
  // right price table for this order's branch, then restore afterwards.
  const savedGlobalBranch = currentBranch;
  const savedGlobalPrices = prices;
  currentBranch = editBranch;
  prices        = editPrices;

  buildStudentFields('edit-student-fields', 'edit');
  buildItemsSection('edit-items-section', 'edit-items-container', 'add-btns-eo', 'eo-grand-total', 'Total', true);
  writeStudentFields('edit', order);

  // Show the branch badge in the edit screen header
  const branchBadge = $('eo-branch-badge');
  if (branchBadge) { branchBadge.textContent = BRANCH_LABEL[editBranch]; branchBadge.className = `badge ${editBranch}`; }

  $('edit-items-container').innerHTML = '';
  (order.items || []).forEach(item => {
    const qty = item.qty || 1;
    if (item.itemType === 'suit-set') {
      _addCombo('edit-items-container', 'e', 'recalcEdit', 'suit-set', null, null, qty);
    } else if (item.itemType === 'combo') {
      _addCombo('edit-items-container', 'e', 'recalcEdit',
        COMBO_TYPE_BY_ITEM1[item.item1Name] || 'pant-shirt', item.item1Size, item.item2Size, qty);
    } else {
      _addItem('edit-items-container', 'e', 'recalcEdit', item.itemName, item.itemSize, qty);
    }
  });

  currentBranch = savedGlobalBranch;
  prices        = savedGlobalPrices;

  recalcEdit();
  $('edit-order-screen').classList.add('open');
  window.scrollTo(0, 0);
}

function closeEditOrder() {
  $('edit-order-screen').classList.remove('open');
  editOrderId = null;
}

function saveEditOrder() {
  const fields = readStudentFields('edit');
  if (!fields.studentName) { toast('Please enter student name', 'error'); return; }
  if (!$('edit-items-container')?.querySelector('.js-item-row')) { toast('Please add at least one item', 'error'); return; }

  const idx = savedOrders.findIndex(o => o.id === editOrderId);
  if (idx === -1) { toast('Order not found', 'error'); return; }
  const orig        = savedOrders[idx];
  const savedPrices = prices;
  prices            = PRICES[getOrderBranch(orig)];
  const { items, subtotal } = collectItems('edit-items-container');
  prices            = savedPrices;
  const collected = totalCollected(orig);

  if (subtotal < collected)
    if (!confirm(
      `Warning: new total (${rupees(subtotal)}) is less than already collected (${rupees(collected)}).\n` +
      `Payment entries will be adjusted. Proceed?`
    )) return;

  // Cap each existing payment so totals don't exceed the new (lower) subtotal.
  // We work through payments in order, reducing 'remaining' as we go.
  let remaining = subtotal;
  const adjustedPayments = [...getPayments(orig)].map(p => {
    const amt = Math.min(p.amount || 0, remaining);
    remaining = Math.max(0, remaining - amt);
    return { ...p, amount: amt };
  });

  // Preserve given/pending state for items that still exist in the edited order.
  // Keys that no longer appear start as pending (given: false by default).
  const givenKeys = new Set(ensureDeliveryUnits(orig).filter(u => u.given).map(u => u.key));
  const newUnits  = buildDeliveryUnits(items);
  newUnits.forEach(u => { if (givenKeys.has(u.key)) u.given = true; });

  savedOrders[idx] = {
    ...orig, ...fields, items, subtotal,
    payments:      adjustedPayments,
    orderDiscount: orig.orderDiscount || 0,
    deliveryUnits: newUnits
  };

  saveLocal();
  toast(`Order updated — ${fields.studentName}, ${rupees(subtotal)}`);
  closeEditOrder();
  renderOrders(getSearchValue());
}


/* ----------------------------------------------------------
   18. WHATSAPP BILL
---------------------------------------------------------- */

function openWhatsApp(id) {
  const order = savedOrders.find(o => o.id === id);
  if (!order) return;

  const payments   = getPayments(order);
  const balance    = balanceDue(order);
  const collected  = totalCollected(order);
  const discount   = totalDiscount(order);
  const orderLabel = order.orderNum ? ` | #${String(order.orderNum).padStart(3, '0')}` : '';

  const dvUnits = ensureDeliveryUnits(order);
  let dvOffset  = 0;
  const itemLines = (order.items || []).map(item => {
    const qty  = item.qty || 1;
    const uPQ  = item.itemType === 'suit-set' ? 3
      : item.itemType === 'combo' ? [item.item1Name, item.item2Name].filter(Boolean).length : 1;
    const rowUnits = dvUnits.slice(dvOffset, dvOffset + qty * uPQ);
    dvOffset += qty * uPQ;
    const pend = rowUnits.filter(u => !u.given).length;
    return `  ${item.label} = Rs.${item.lineTotal.toLocaleString('en-IN')}${pend > 0 ? ` (${pend} pending delivery)` : ''}`;
  }).join('\n');

  const payLines = payments.length
    ? payments.map((p, i) =>
        `  Payment ${i + 1} (${p.mode.charAt(0).toUpperCase() + p.mode.slice(1)}, ${p.date}) = Rs.${p.amount.toLocaleString('en-IN')}`
      ).join('\n')
    : '  No payment received yet';

  const contactLines = [
    order.parentName ? `Parent  : ${order.parentName}` : '',
    order.mobile     ? `Mobile  : ${order.mobile}`     : ''
  ].filter(Boolean).join('\n');

  const totalPend = dvUnits.filter(u => !u.given).length;
  const pendNote  = totalPend > 0
    ? `\n *${totalPend} item${totalPend !== 1 ? 's' : ''} pending delivery — will be given when available*` : '';

  const message =
`*Golden Gate International School*
*Uniform Bill${orderLabel}*
-------------------------
Student : ${order.studentName || ''}${order.studentClass ? ' (' + order.studentClass + ')' : ''}
${contactLines ? contactLines + '\n' : ''}Date    : ${order.date}${order.notes ? '\nNote    : ' + order.notes : ''}
-------------------------
*Items:*
${itemLines}${pendNote}
-------------------------
*Total = Rs.${order.subtotal.toLocaleString('en-IN')}*

*Payments:*
${payLines}
${discount > 0 ? `  Discount = -Rs.${discount.toLocaleString('en-IN')}\n` : ''}-------------------------
*Collected = Rs.${collected.toLocaleString('en-IN')}*
${balance > 0 ? `*Balance Due = Rs.${balance.toLocaleString('en-IN')}*` : '*Fully Paid ✓*'}
-------------------------
Thank you!`;

  if (order.mobile) {
    window.open(`https://wa.me/${normaliseMobile(order.mobile)}?text=${encodeURIComponent(message)}`, '_blank');
  } else {
    const fallback = text => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('No mobile saved — bill copied to clipboard'); }
      catch { toast('Copy failed — please copy manually', 'error'); }
      document.body.removeChild(ta);
    };
    if (navigator.clipboard && window.isSecureContext)
      navigator.clipboard.writeText(message).then(() => toast('No mobile saved — bill copied to clipboard')).catch(() => fallback(message));
    else fallback(message);
  }
}


/* ----------------------------------------------------------
   19. EXPORT / IMPORT
---------------------------------------------------------- */

function exportCSV() {
  if (!savedOrders.length) { toast('No orders to export'); return; }
  const headers = [
    'Order#', 'Date', 'Branch', 'Student Name', 'Class', 'Parent Name', 'Mobile', 'Notes',
    'Items', 'Items Pending Delivery', 'Subtotal', 'Collected', 'Discount', 'Balance', 'Status', 'Payment Detail'
  ];
  const rows = savedOrders.map(o => {
    const payments   = getPayments(o);
    const payDetail  = payments.map(p => `${p.mode} Rs.${p.amount} on ${p.date}`).join(' | ');
    const pendLabels = ensureDeliveryUnits(o).filter(u => !u.given).map(u => u.label).join(' | ');
    return [
      o.orderNum ? '#' + String(o.orderNum).padStart(3, '0') : '',
      o.date, getOrderBranch(o),
      o.studentName || '', o.studentClass || '', o.parentName || '', o.mobile || '', o.notes || '',
      (o.items || []).map(i => i.label + ' = Rs.' + i.lineTotal).join(' | '),
      pendLabels || 'All given',
      o.subtotal, totalCollected(o), totalDiscount(o), balanceDue(o),
      paymentStatus(o), payDetail
    ];
  });
  const csv  = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const link = document.createElement('a');
  link.href     = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  link.download = `uniform-orders-${new Date().toLocaleDateString('en-IN').replace(/\//g, '-')}.csv`;
  link.click();
}

function exportJSON() {
  if (!savedOrders.length) { toast('No orders to export'); return; }
  const backup = { exportedAt: new Date().toISOString(), orderCounter, orders: savedOrders };
  const link   = document.createElement('a');
  link.href     = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
  link.download = `uniform-backup-${new Date().toLocaleDateString('en-IN').replace(/\//g, '-')}.json`;
  link.click();
}

function importJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const parsed   = JSON.parse(e.target.result);
      const imported = Array.isArray(parsed) ? parsed : (parsed.orders || []);
      if (!imported.length) { toast('No orders found in file', 'error'); return; }

      const existingIds = new Set(savedOrders.map(o => o.id));
      const newOrders   = imported.filter(o => o.id && !existingIds.has(o.id));
      if (!newOrders.length) { toast('All orders already exist'); return; }

      savedOrders = [...savedOrders, ...newOrders].sort((a, b) => a.id - b.id);
      savedOrders.forEach((o, i) => { o.orderNum = i + 1; });
      orderCounter = savedOrders.length;
      savedOrders.sort((a, b) => b.id - a.id);

      saveLocal(); saveCounter();
      renderOrders('');
      toast(`Imported ${newOrders.length} order${newOrders.length !== 1 ? 's' : ''} — order numbers re-sequenced`);
    } catch (err) {
      toast('Import failed: ' + err.message, 'error', 4000);
    }
    event.target.value = '';
  };
  reader.readAsText(file);
}


/* ----------------------------------------------------------
   20. GLOBAL EVENT LISTENERS
---------------------------------------------------------- */

document.addEventListener('click', e => {
  if (!e.target.closest('.header-menu-wrap')) closeHamburger();
  if (!e.target.closest('.filter-btn-wrap')) $('filter-dropdown')?.classList.remove('open');
  if (!e.target.closest('.menu-wrap'))
    document.querySelectorAll('.menu-dropdown.open').forEach(m => m.classList.remove('open'));
});


/* ----------------------------------------------------------
   21. INIT
---------------------------------------------------------- */

buildStudentFields('new-student-fields', 'new');
buildItemsSection('new-items-section', 'items-container', 'add-btns-new', 'grand-total', 'Subtotal', false);

// Highlight the active branch button to match the persisted preference
['badagaon', 'baghpat'].forEach(b => $('branch-' + b)?.classList.toggle('active', b === currentBranch));

recalcNew();