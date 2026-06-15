/* ── APP STATE ───────────────────────────────────────────── */

let currentBranch  = localStorage.getItem('uniform_branch') || 'badagaon';
let prices         = buildPrices(currentBranch);

let newOrderPayMode = PAY_MODES.PENDING;
let editOrderId     = null;
let itemCounter     = 0;  // monotonic counter for unique DOM IDs per session

/* Active filter state for the Orders tab */
let dateFilter         = 'all';
let specificDateFilter = '';
let branchFilter       = 'all';
let paymentFilter      = 'all';
let deliveryFilter     = 'all';

/* Active filter state for Analytics */
let analyticsDate         = 'today';
let analyticsSpecificDate = '';
let analyticsBranch       = 'all';

let savedOrders = [];

/* Which record each sheet is currently acting on.
   Reset to null when the sheet closes. */
const activeSheet = {
  target:       null,   // 'new' | 'edit' — which order form opened this sheet
  orderId:      null,   // order open in payment or delivery sheet
  deleteId:     null,   // order pending delete confirmation
  deletePayIdx: null,   // { orderId, entryIndex } for payment entry delete
};

/* Transient state for the Quick Set, Suit, and Half/Full sheets */
const sheetState = { quickSetSize: null, comboType: null, comboSize: null, hfType: null, hfSize: null, adjSign: 1 };

/* Price List overlay: tracks which branch is shown (independent of current selling branch) */
let priceListBranch = currentBranch;

/* DOM references for student field inputs, keyed by context ('new' | 'edit') */
const studentFormRefs = {
  new:  { name: null, cls: null, parent: null, mobile: null, address: null, notes: null },
  edit: { name: null, cls: null, parent: null, mobile: null, address: null, notes: null }
};


/* ── UTILITIES ───────────────────────────────────────────── */

const $         = id => document.getElementById(id);
const rupees    = n  => 'Rs.' + (n || 0).toLocaleString('en-IN');
const pr        = v  => v != null && v !== 0 ? rupees(v) : `<span class="pl-na">—</span>`;

/* Human-readable labels for each order status — used on order cards and CSV export */
const STATUS_LABEL = {
  [ORDER_STATUS.CASH]:    'Cash',
  [ORDER_STATUS.ONLINE]:  'Online',
  [ORDER_STATUS.SPLIT]:   'Split',
  [ORDER_STATUS.PARTIAL]: 'Partial',
  [ORDER_STATUS.PENDING]: 'Pending',
  [ORDER_STATUS.REFUND]:  'Refund'
};

/* Branch dot colours used on order cards and analytics rows */
const BRANCH_DOT_COLOR = { badagaon: '#059669', baghpat: '#2563eb' };

/* Parses a DD/MM/YYYY date string (as stored in order.date) into a Date object */
function parseDate(str) {
  const p = (str || '').split('/');
  return new Date(p[2], p[1] - 1, p[0]);
}

/* Returns a Date set to midnight today — used for date comparisons throughout */
function todayMidnight() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/* Falls back to manual UUID v4 if crypto.randomUUID isn't available */
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function cloneTemplate(id) {
  return document.getElementById(id).content.cloneNode(true).firstElementChild;
}

function buildSizeOptions(itemName, selectedSize, pricesObj) {
  const p    = pricesObj || prices;
  const frag = document.createDocumentFragment();
  Object.keys(p[itemName] || {}).forEach(s => {
    const opt = document.createElement('option');
    opt.value = s; opt.textContent = s;
    if (String(s) === String(selectedSize)) opt.selected = true;
    frag.appendChild(opt);
  });
  return frag;
}

function buildItemOptions(selectedItem, pricesObj) {
  const p    = pricesObj || prices;
  const frag = document.createDocumentFragment();
  Object.keys(p).forEach(name => {
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

/* Normalises mobile to E.164-style for wa.me links (strips non-digits, prepends 91 if needed) */
function normaliseMobile(raw) {
  const digits = (raw || '').replace(/\D/g, '').replace(/^0+/, '');
  if (digits.startsWith('91') && digits.length === 12) return digits;
  return digits.length === 10 ? '91' + digits : digits;
}

function getSearchValue() { return $('orders-search')?.value || ''; }

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


/* ── SETTINGS ────────────────────────────────────────────── */

/* currentUserEmail set by Firebase bridge on sign-in */
let currentUserEmail = null;

/* Returns hardcoded defaults; shown immediately while cloud settings load */
function defaultSettings() {
  return { upiId: DEFAULT_UPI_ID, upiNumber: DEFAULT_UPI_NUMBER, qrDataUrl: '' };
}

async function loadSettingsFromCloud() {
  if (!currentUserEmail || typeof loadUserSettings !== 'function') return null;
  try { return await loadUserSettings(currentUserEmail); }
  catch(e) { console.warn('Could not load user settings:', e); return null; }
}

function applySettingsToUI(s) {
  $('settings-upi-id').value     = (!s.upiId     || s.upiId     === DEFAULT_UPI_ID)     ? '' : s.upiId;
  $('settings-upi-number').value = (!s.upiNumber || s.upiNumber === DEFAULT_UPI_NUMBER) ? '' : s.upiNumber;
  const preview = $('settings-qr-preview');
  if (s.qrDataUrl) {
    preview.src = s.qrDataUrl; preview.style.display = 'block';
    $('settings-qr-current').textContent = 'Custom QR saved';
  } else {
    preview.style.display = 'none';
    $('settings-qr-current').textContent = 'Using GooglePay_QR.png (default)';
  }
}

function showSettings() {
  applySettingsToUI(defaultSettings()); /* show defaults immediately while cloud loads */
  $('settings-screen').style.display = 'block';
  document.body.style.overflow = 'hidden';

  /* then load from cloud and update if signed in */
  loadSettingsFromCloud().then(s => { if (s) applySettingsToUI(s); });
}

function closeSettings() {
  $('settings-screen').style.display = 'none';
  document.body.style.overflow = '';
}

function readSettingsFields() {
  const upiId     = ($('settings-upi-id').value     || '').trim();
  const upiNumber = ($('settings-upi-number').value || '').trim();
  const preview   = $('settings-qr-preview');
  const qrDataUrl = (preview.src && preview.style.display !== 'none') ? preview.src : '';
  return { upiId, upiNumber, qrDataUrl };
}

function saveSettingsForm() {
  const { upiId, upiNumber, qrDataUrl } = readSettingsFields();

  if (!currentUserEmail || typeof saveUserSettings !== 'function') {
    toast('Sign in to save settings', 'error'); return;
  }

  saveUserSettings(currentUserEmail, { upiId, upiNumber, qrDataUrl })
    .then(() => { toast('Settings saved'); closeSettings(); })
    .catch(e => toast('Save failed: ' + e.message, 'error', 4000));
}

function clearSettingsQR() {
  $('settings-qr-preview').style.display = 'none';
  $('settings-qr-preview').src           = '';
  $('settings-qr-current').textContent   = 'Using GooglePay_QR.png (default)';
  $('settings-qr-file').value            = '';
  if (currentUserEmail && typeof saveUserSettings === 'function') {
    const { upiId, upiNumber } = readSettingsFields();
    saveUserSettings(currentUserEmail, { upiId, upiNumber, qrDataUrl: '' })
      .catch(e => console.warn('Could not clear QR:', e));
  }
  toast('Custom QR removed — using default');
}

/* Validates size, reads file as base64 dataURL; saves immediately to cloud if signed in */
function handleQRFileSelect(input) {
  const file = input.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { toast('Please select an image file', 'error'); return; }
  if (file.size > 700 * 1024)          { toast('Image too large — max 700 KB', 'error'); return; }

  const reader = new FileReader();
  reader.onload = e => {
    const dataUrl = e.target.result;
    const preview = $('settings-qr-preview');
    preview.src           = dataUrl;
    preview.style.display = 'block';
    $('settings-qr-current').textContent = 'Custom QR saved ✓';
    if (currentUserEmail && typeof saveUserSettings === 'function') {
      const { upiId, upiNumber } = readSettingsFields();
      saveUserSettings(currentUserEmail, { upiId, upiNumber, qrDataUrl: dataUrl })
        .catch(e => console.warn('Could not save QR:', e));
    }
    toast('QR image saved');
  };
  reader.readAsDataURL(file);
}


/* ── FORM HELPERS ────────────────────────────────────────── */

/* Clones tpl-student-fields, wires studentFormRefs[ctxKey] references,
   expand/collapse for address+note, and Enter-key tab navigation. */
function buildStudentFields(containerId, ctxKey) {
  const wrap = $(containerId);
  wrap.innerHTML = '';
  wrap.appendChild(cloneTemplate('tpl-student-fields'));

  studentFormRefs[ctxKey].name    = wrap.querySelector('.sf-name');
  studentFormRefs[ctxKey].cls     = wrap.querySelector('.sf-class');
  studentFormRefs[ctxKey].parent  = wrap.querySelector('.sf-parent');
  studentFormRefs[ctxKey].mobile  = wrap.querySelector('.sf-mobile');
  studentFormRefs[ctxKey].address = wrap.querySelector('.sf-address');
  studentFormRefs[ctxKey].notes   = wrap.querySelector('.sf-notes');

  const pill  = wrap.querySelector('.sf-expand-pill');
  const extra = wrap.querySelector('.sf-extra');

  pill.addEventListener('click', () => {
    const isOpen = extra.style.display !== 'none';
    extra.style.display = isOpen ? 'none' : 'block';
    pill.setAttribute('aria-expanded', String(!isOpen));
  });

  /* Auto-expand address+note if order has pre-filled values */
  studentFormRefs[ctxKey]._expandExtra = () => {
    if ((studentFormRefs[ctxKey].address?.value || '').trim() || (studentFormRefs[ctxKey].notes?.value || '').trim()) {
      extra.style.display = 'block';
      pill.setAttribute('aria-expanded', 'true');
    }
  };

  const coreFields = [studentFormRefs[ctxKey].name, studentFormRefs[ctxKey].cls, studentFormRefs[ctxKey].parent, studentFormRefs[ctxKey].mobile];
  const allFields  = [...coreFields, studentFormRefs[ctxKey].address, studentFormRefs[ctxKey].notes];

  allFields.forEach((field, i) => {
    if (!field) return;
    field.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (i === coreFields.length - 1 && extra.style.display === 'none') {
        extra.style.display = 'block';
        pill.setAttribute('aria-expanded', 'true');
        studentFormRefs[ctxKey].address?.focus();
        return;
      }
      const next = allFields[i + 1];
      if (next) next.focus(); else field.blur();
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
    const clearBtn = sec.querySelector('.clear-items-btn');
    if (clearBtn) clearBtn.remove();
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
  const c = studentFormRefs[ctxKey];
  const capitalize = s => s.replace(/\b\w/g, ch => ch.toUpperCase());
  return {
    studentName:  capitalize((c.name?.value    || '').trim()),
    studentClass: (c.cls?.value     || '').trim().toUpperCase(),
    parentName:   capitalize((c.parent?.value  || '').trim()),
    mobile:       (c.mobile?.value  || '').trim(),
    address:      capitalize((c.address?.value || '').trim()),
    notes:        (c.notes?.value   || '').trim()
  };
}

function writeStudentFields(ctxKey, order) {
  const c = studentFormRefs[ctxKey];
  if (c.name)    c.name.value    = order.studentName  || '';
  if (c.cls)     c.cls.value     = order.studentClass || '';
  if (c.parent)  c.parent.value  = order.parentName   || '';
  if (c.mobile)  c.mobile.value  = order.mobile       || '';
  if (c.address) c.address.value = order.address      || '';
  if (c.notes)   c.notes.value   = order.notes        || '';
  if (c._expandExtra) c._expandExtra();
}

function clearStudentFields(ctxKey) {
  const c = studentFormRefs[ctxKey];
  ['name', 'cls', 'parent', 'mobile', 'address', 'notes'].forEach(k => { if (c[k]) c[k].value = ''; });
}



/* Expands each order item into individual physical delivery units (one per qty per piece).
   Suit = 3 units (Suit+Trouser+Jacket); combo = 2; single = 1. */
function buildDeliveryUnits(items) {
  const units = [];
  let seq = 0;
  (items || []).forEach(item => {
    if (item.itemType === ITEM_TYPES.ADJUSTMENT) return;
    const qty = item.qty || 1;
    if (item.itemType === ITEM_TYPES.SINGLE) {
      for (let q = 0; q < qty; q++)
        units.push({ key: `${item.itemName}(${item.itemSize})#${seq++}`, label: `${item.itemName} (${item.itemSize})`, given: false });
    } else if (item.itemType === ITEM_TYPES.SUIT) {
      for (let q = 0; q < qty; q++) {
        units.push({ key: `Suit#${seq++}`,    label: 'Suit',    given: false });
        units.push({ key: `Trouser#${seq++}`, label: 'Trouser', given: false });
        units.push({ key: `Jacket#${seq++}`,  label: 'Jacket',  given: false });
      }
    } else if (item.itemType === ITEM_TYPES.COMBO) {
      for (let q = 0; q < qty; q++) {
        if (item.item1Name) units.push({ key: `${item.item1Name}(${item.item1Size})#${seq++}`, label: `${item.item1Name} (${item.item1Size})`, given: false });
        if (item.item2Name) units.push({ key: `${item.item2Name}(${item.item2Size})#${seq++}`, label: `${item.item2Name} (${item.item2Size})`, given: false });
      }
    }
  });
  return units;
}

function ensureDeliveryUnits(order) { return order.deliveryUnits || []; }
function pendingItemCount(order)    { return ensureDeliveryUnits(order).filter(u => !u.given).length; }



function getPayments(order)    { return Array.isArray(order.payments) ? order.payments : []; }
function totalCollected(order) { return getPayments(order).reduce((s, p) => s + (p.amount || 0), 0); }
function totalDiscount(order)  { return order.orderDiscount || 0; }
function balanceDue(order)     { return Math.max(0, (order.subtotal || 0) - totalCollected(order) - totalDiscount(order)); }

function paymentStatus(order) {
  const payments = getPayments(order);
  if (!payments.length)      return ORDER_STATUS.PENDING;
  if (balanceDue(order) > 0) return ORDER_STATUS.PARTIAL;
  const modes = [...new Set(payments.map(p => p.mode))];
  if (modes.length > 1)      return ORDER_STATUS.SPLIT;
  return modes[0] === PAY_MODES.ONLINE ? ORDER_STATUS.ONLINE : ORDER_STATUS.CASH;
}



function toggleHamburger() { $('hamburger-menu').classList.toggle('open'); }
function closeHamburger()  { $('hamburger-menu').classList.remove('open'); }

function toggleBranchDropdown() {
  const dropdown = $('branch-header-dropdown');
  const badge    = $('branch-header-badge');
  const isOpen   = dropdown.classList.contains('open');
  dropdown.classList.toggle('open', !isOpen);
  badge.classList.toggle('open', !isOpen);
}

function closeBranchDropdown() {
  $('branch-header-dropdown')?.classList.remove('open');
  $('branch-header-badge')?.classList.remove('open');
}

function syncBranchBadge() {
  const badge = $('branch-header-badge');
  if (!badge) return;
  badge.className = `branch-header-badge branch-${currentBranch}`;
  $('branch-header-label').textContent = BRANCH_LABEL[currentBranch];
  ['badagaon', 'baghpat'].forEach(b => {
    $('bdopt-' + b)?.classList.toggle('active', b === currentBranch);
  });
}

/* Prompts confirmation if items are in the form, then switches branch and rebuilds prices */
function setBranch(branch) {
  const ctn = $('items-container');
  if (ctn?.querySelector('.js-item-row')) {
    if (!confirm(`Switch to ${BRANCH_LABEL[branch]}? Current items will be cleared.`)) {
      closeBranchDropdown();
      return;
    }
  }
  currentBranch = branch;
  prices = buildPrices(currentBranch);
  localStorage.setItem('uniform_branch', branch);
  syncBranchBadge();
  closeBranchDropdown();
  if (ctn) ctn.innerHTML = '';
  itemCounter = 0;
  recalcNew();
  toast(`Switched to ${BRANCH_LABEL[branch]}`);
}

function setNewOrderPayMode(mode) {
  newOrderPayMode = mode;
  ['cash', 'online', 'pending'].forEach(m => $('pay-' + m).classList.toggle('active', m === mode));
  const row = $('payment-extra-row');
  if (row) row.style.display = mode !== PAY_MODES.PENDING ? 'grid' : 'none';
}

function showTab(tab) {
  ['new', 'orders'].forEach(t => {
    const el = $('tab-' + t);
    if (el) el.style.display = t === tab ? '' : 'none';
    $('tab-btn-' + t)?.classList.toggle('active', t === tab);
  });
  if (tab === 'orders') renderOrders('');
}

function showAnalytics() { renderAnalytics(); $('analytics-screen').style.display = 'block'; document.body.style.overflow = 'hidden'; }
function closeAnalytics() { $('analytics-screen').style.display = 'none'; document.body.style.overflow = ''; }



function buildAddButtons(containerId, isEdit) {
  const t    = isEdit ? 'edit' : 'new';
  const wrap = $(containerId);
  if (!wrap) return;
  wrap.innerHTML = '';

  const btn = (cls, text, handler) => {
    const b = document.createElement('button');
    b.className = cls; b.textContent = text; b.onclick = handler;
    wrap.appendChild(b);
  };

  btn('add-btn combo',      'Formal / Sports',            () => openMainComboSheet(t));
  btn('add-btn combo',      'Red Uniform',                () => openHalfFullSheet(t));
  btn('add-btn combo',      'Suit Set',                   () => openComboSheet(t, 'suit-set'));
  btn('add-btn combo',      'Winter Uniform',             () => openBlazerSweaterSheet(t));
  btn('add-btn',            '+ Single Item',              () => openSingleItemSheet(t));
  btn('add-btn adjustment', '± Adjust',                   () => openAdjSheet(t));
  btn('add-btn quickset',   '✦ Complete Uniform',         () => openQuickSetSheet(t));
}

function openSheet(id)  { $(id).classList.add('open'); }
function closeSheet(id, event) {
  if (event && event.target !== $(id)) return; // ignore clicks on sheet content
  $(id).classList.remove('open');
}

/* Returns the correct container ID, ID prefix, and recalc function for new vs edit context */
function resolveSheetTarget(target) {
  const e = target === 'edit';
  return { containerId: e ? 'edit-items-container' : 'items-container', idPrefix: e ? 'e' : 'n', recalcFn: e ? recalcEdit : recalcNew };
}

function stepQty(spanId, delta) {
  const el = $(spanId);
  el.textContent = Math.max(1, Math.min(99, parseInt(el.textContent) + delta));
}

function buildChips(containerId, values, onSelectFn, selectedValue = null) {
  const wrap = $(containerId);
  wrap.innerHTML = '';
  values.forEach(v => {
    const chip = document.createElement('div');
    chip.className   = 'size-chip' + (String(v) === String(selectedValue) ? ' selected' : '');
    chip.textContent = v;
    chip.onclick     = () => onSelectFn(String(v), chip);
    wrap.appendChild(chip);
  });
}

function selectChip(containerId, value, el) {
  $(containerId).querySelectorAll('.size-chip').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  return value;
}

function openQuickSetSheet(target) {
  activeSheet.target = target;
  const sizes = [26, 28, 30, 32, 34, 36, 38, 40, 42, 44];
  buildChips('qs-sizes', sizes, (v, el) => {
    const already = sheetState.quickSetSize === v;
    sheetState.quickSetSize = already ? null : v;
    $('qs-sizes').querySelectorAll('.size-chip').forEach(c => c.classList.remove('selected'));
    if (!already) el.classList.add('selected');
    updateQSPrice();
  });
  $('qs-qty').textContent           = '1';
  $('qs-price-preview').textContent = '';
  $('qs-item-row').classList.remove('has-selection');
  $('qs-confirm-bar').classList.remove('visible');
  openSheet('qs-modal');
}

/* Adds Pant+Shirt, Lower+T-Shirt combos, Tie, Belt, and 2×Socks at the selected size */
function confirmQuickSet() {
  closeSheet('qs-modal');
  const { containerId, idPrefix, recalcFn } = resolveSheetTarget(activeSheet.target);
  const size = String(sheetState.quickSetSize);
  const qty  = parseInt($('qs-qty').textContent);
  addCombo(containerId, idPrefix, recalcFn, 'pant-shirt',   size, size, qty);
  addCombo(containerId, idPrefix, recalcFn, 'lower-tshirt', size, size, qty);
  addItem(containerId, idPrefix, recalcFn, 'Tie',   parseInt(size) >= 34 ? 'Large' : 'Small', qty);
  addItem(containerId, idPrefix, recalcFn, 'Belt',  'All',  qty);
  addItem(containerId, idPrefix, recalcFn, 'Socks', 'Pair', qty * 2);
}

function updateQSPrice() {
  const priceEl   = $('qs-price-preview');
  const totalEl   = $('qs-total-preview');
  const summaryEl = $('qs-confirm-summary');
  const row       = $('qs-item-row');
  const bar       = $('qs-confirm-bar');
  if (!priceEl) return;
  const size = sheetState.quickSetSize;
  const qty  = parseInt($('qs-qty').textContent) || 1;
  if (!size) {
    priceEl.textContent = '';
    row.classList.remove('has-selection');
    bar.classList.remove('visible');
    return;
  }

  const p       = prices;
  const lookup  = (item, sz) => p[item]?.[sz] || p[item]?.[parseInt(sz)] || 0;
  const tieSize = parseInt(size) >= 34 ? 'Large' : 'Small';
  const unit    = lookup('Pant', size) + lookup('Shirt', size) + lookup('Lower', size) + lookup('T-Shirt', size)
             + lookup('Tie', tieSize) + (p['Belt']?.['All'] || 0) + (p['Socks']?.['Pair'] || 0) * 2;
  priceEl.textContent   = unit ? rupees(unit) : '';
  if (totalEl)   totalEl.textContent   = unit ? rupees(unit * qty) : '';
  if (summaryEl) summaryEl.textContent = `Size ${size}${qty > 1 ? ' ×'+qty : ''}`;
  row.classList.add('has-selection');
  bar.classList.add('visible');
}

/* Fixed accessories for the Single Item sheet — no size grid, just tap to toggle */
const SI_ACCESSORIES = [
  { item: 'Tie',  size: 'Small' },
  { item: 'Tie',  size: 'Large' },
  { item: 'Belt', size: 'All'   },
  { item: 'Socks',size: 'Pair'  }
];

let siSelections = {};

function siKey(item, size) { return `${item}|${size}`; }

function getSheetPrices(target) {
  if (target === 'edit' && editOrderId) {
    const ord = savedOrders.find(o => o.id === editOrderId);
    return buildPrices(ord?.branch || currentBranch);
  }
  return prices;
}

/* Builds a single-tap accessory row (Tie, Belt, Socks) for the Single Item sheet */
function buildAccessoryRow(item, size, price, key) {
  const safeId = key.replace('|', '-');
  const label  = (size === 'All' || size === 'Pair') ? item : `${item} — ${size}`;
  const row    = document.createElement('div');
  row.className   = 'acc-item-row';
  row.dataset.key = key;
  row.innerHTML   = `
    <div class="acc-item-left">
      <div class="acc-item-check">
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <polyline points="2,6 5,9 10,3" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <span class="acc-item-name">${label}</span>
      <span class="acc-item-price">Rs.${price}</span>
    </div>
    <div class="acc-item-stepper-wrap inline-stepper">
      <button onclick="siAccStep('${key}',-1,event)">−</button>
      <span id="si-acc-qty-${safeId}">1</span>
      <button onclick="siAccStep('${key}',1,event)">+</button>
    </div>`;
  row.addEventListener('click', e => {
    if (e.target.closest('.inline-stepper')) return;
    siToggleAcc(key, item, size, price, row);
  });
  return row;
}

/* Builds a sized item row (Pant, Shirt, Blazer etc) with size chips.
   stepFn: called on stepper click; toggleFn: called on chip click; idPrefix: for qty/price IDs.
   Items with only one size render as a simple tap row using buildAccessoryRow. */
function buildSizedItemRow(itemName, sizes, toggleFn, stepFn, idPrefix) {
  if (sizes.length === 1) {
    const [size, price] = sizes[0];
    const key = siKey(itemName, size);
    return buildAccessoryRow(itemName, size, price, key);
  }

  const prefix = idPrefix || 'si-sized';
  const wrap = document.createElement('div');
  wrap.className    = 'sized-item-row';
  wrap.dataset.item = itemName;

  const header = document.createElement('div');
  header.className = 'sized-item-header';
  header.innerHTML = `
    <span class="sized-item-name">${itemName}</span>
    <div class="sized-item-controls">
      <span class="sized-item-sel-price" id="${prefix}-price-${itemName}"></span>
      <div class="sized-item-stepper-wrap inline-stepper">
        <button onclick="${stepFn}('${itemName}',-1,event)">−</button>
        <span id="${prefix}-qty-${itemName}">1</span>
        <button onclick="${stepFn}('${itemName}',1,event)">+</button>
      </div>
    </div>`;

  const sizesWrap = document.createElement('div');
  sizesWrap.className = 'size-chip-grid';
  sizes.forEach(([size, price]) => {
    const chip = document.createElement('div');
    chip.className    = 'size-chip';
    chip.textContent  = size;
    chip.dataset.size = size;
    chip.addEventListener('click', () => toggleFn(itemName, size, price, chip, wrap));
    sizesWrap.appendChild(chip);
  });

  wrap.appendChild(header);
  wrap.appendChild(sizesWrap);
  return wrap;
}

function openSingleItemSheet(target) {
  activeSheet.target = target;
  siSelections = {};
  const p = getSheetPrices(target);

  const accCtn = $('si-accessories');
  accCtn.innerHTML = '';
  SI_ACCESSORIES.forEach(({ item, size }) => {
    if (!p[item]?.[size]) return;
    accCtn.appendChild(buildAccessoryRow(item, size, p[item][size], siKey(item, size)));
  });

  const sizedCtn = $('si-sized');
  sizedCtn.innerHTML = '';
  ['Pant','Shirt','Lower','T-Shirt','Half Lower','Half T-Shirt','Full Lower','Full T-Shirt'].forEach(itemName => {
    if (!p[itemName]) return;
    sizedCtn.appendChild(buildSizedItemRow(itemName, Object.entries(p[itemName]), siToggleSized, 'siSizedStep', 'si-sized'));
  });

  siUpdateConfirmBar();
  openSheet('si-modal');
}

function siToggleAcc(key, item, size, price, row) {
  if (siSelections[key]) {
    delete siSelections[key];
    row.classList.remove('selected');
  } else {
    const safeId = key.replace('|', '-');
    const qty    = parseInt(document.getElementById('si-acc-qty-' + safeId)?.textContent) || 1;
    siSelections[key] = { item, size, price, qty };
    row.classList.add('selected');
  }
  siUpdateConfirmBar();
}

function siAccStep(key, delta, e) {
  e.stopPropagation();
  const safeId = key.replace('|', '-');
  const el     = document.getElementById('si-acc-qty-' + safeId);
  if (!el) return;
  const newQty      = Math.max(1, Math.min(99, parseInt(el.textContent) + delta));
  el.textContent    = newQty;
  if (siSelections[key]) { siSelections[key].qty = newQty; siUpdateConfirmBar(); }
}

/* Only one size selectable per item; re-clicking the same chip deselects it */
function siToggleSized(itemName, size, price, chip, wrap) {
  const key     = siKey(itemName, size);
  const prevKey = Object.keys(siSelections).find(k => k.startsWith(itemName + '|'));

  if (prevKey) {
    delete siSelections[prevKey];
    wrap.querySelectorAll('.size-chip').forEach(c => c.classList.remove('selected'));
    if (prevKey === key) {
      wrap.classList.remove('has-selection');
      const priceEl = document.getElementById('si-sized-price-' + itemName);
      if (priceEl) priceEl.textContent = '';
      siUpdateConfirmBar();
      return;
    }
  }

  const qtyEl = document.getElementById('si-sized-qty-' + itemName);
  const qty   = qtyEl ? parseInt(qtyEl.textContent) || 1 : 1;
  siSelections[key] = { item: itemName, size, price, qty };
  chip.classList.add('selected');
  wrap.classList.add('has-selection', 'expanded');
  const priceEl = document.getElementById('si-sized-price-' + itemName);
  if (priceEl) priceEl.textContent = 'Rs.' + price;
  siUpdateConfirmBar();
}

function siSizedStep(itemName, delta, e) {
  e.stopPropagation();
  const el = document.getElementById('si-sized-qty-' + itemName);
  if (!el) return;
  const newQty   = Math.max(1, Math.min(99, parseInt(el.textContent) + delta));
  el.textContent = newQty;
  const selKey   = Object.keys(siSelections).find(k => k.startsWith(itemName + '|'));
  if (selKey) { siSelections[selKey].qty = newQty; siUpdateConfirmBar(); }
}

/* Shows/updates the sticky confirm bar with a summary of selected items and total.
   barId, summaryId, priceId: element IDs; items: array of { label, qty, price } */
function updateConfirmBar(barId, summaryId, priceId, items) {
  const bar = $(barId);
  if (!items.length) { bar.classList.remove('visible'); return; }
  bar.classList.add('visible');
  const sumEl = $(summaryId);
  if (sumEl) sumEl.textContent = items.map(({ label, qty }) => qty > 1 ? `${label} ×${qty}` : label).join(', ');
  const total  = items.reduce((s, { price, qty }) => s + price * qty, 0);
  const priceEl = $(priceId);
  if (priceEl) { priceEl.textContent = total ? rupees(total) : ''; }
}

function siUpdateConfirmBar() {
  updateConfirmBar('sheet-confirm-bar', 'sheet-confirm-summary', 'sheet-price-total',
    Object.values(siSelections).map(({ item, size, price, qty }) => ({
      label: (size === 'All' || size === 'Pair') ? item : `${item} (${size})`,
      qty, price
    }))
  );
}

function confirmSingleItem() {
  const items = Object.values(siSelections);
  if (!items.length) { toast('Select at least one item', 'error'); return; }
  closeSheet('si-modal');
  const { containerId, idPrefix, recalcFn } = resolveSheetTarget(activeSheet.target);
  items.forEach(({ item, size, qty }) => addItem(containerId, idPrefix, recalcFn, item, size, qty));
}

/* Main combo sheet — Pant+Shirt and/or Lower+T-Shirt, each with independent size+qty */
let mcSelections = {};

function openMainComboSheet(target) {
  activeSheet.target = target;
  mcSelections = {};
  const p = getSheetPrices(target);

  const ctn = $('mc-combos');
  ctn.innerHTML = '';

  [['pant-shirt','Pant + Shirt'],['lower-tshirt','Lower + T-Shirt']].forEach(([type, label]) => {
    const cfg   = COMBOS[type];
    const sizes = Object.keys(p[cfg.item1] || {});

    const wrap = document.createElement('div');
    wrap.className    = 'sized-item-row';
    wrap.dataset.item = type;

    const header = document.createElement('div');
    header.className = 'sized-item-header';
    header.innerHTML = `
      <span class="sized-item-name">${label}</span>
      <div class="sized-item-controls">
        <span class="sized-item-sel-price" id="mc-price-${type}"></span>
        <div class="sized-item-stepper-wrap inline-stepper">
          <button onclick="mcStep('${type}',-1,event)">−</button>
          <span id="mc-qty-${type}">1</span>
          <button onclick="mcStep('${type}',1,event)">+</button>
        </div>
      </div>`;

    const sizesWrap = document.createElement('div');
    sizesWrap.className = 'size-chip-grid';
    sizes.forEach(size => {
      const p1    = p[cfg.item1]?.[size] || 0;
      const p2    = p[cfg.item2]?.[size] || 0;
      const price = p1 + p2;
      const chip  = document.createElement('div');
      chip.className    = 'size-chip';
      chip.textContent  = size;
      chip.dataset.size = size;
      chip.addEventListener('click', () => mcToggle(type, size, price, chip, wrap, label));
      sizesWrap.appendChild(chip);
    });

    wrap.appendChild(header);
    wrap.appendChild(sizesWrap);
    ctn.appendChild(wrap);
  });

  mcUpdateConfirmBar();
  openSheet('mc-modal');
}

function mcToggle(type, size, price, chip, wrap, label) {
  const existing = mcSelections[type];
  const isSameChip = existing?.size === size;
  if (existing) {
    delete mcSelections[type];
    wrap.querySelectorAll('.size-chip').forEach(c => c.classList.remove('selected'));
    const priceEl = document.getElementById('mc-price-' + type);
    if (priceEl) priceEl.textContent = '';
    if (isSameChip) {
      wrap.classList.remove('has-selection');
      mcUpdateConfirmBar(); return;
    }
  }
  const qty = parseInt(document.getElementById('mc-qty-' + type)?.textContent) || 1;
  mcSelections[type] = { type, label: wrap.querySelector('.sized-item-name')?.textContent || type, size, price, qty };
  chip.classList.add('selected');
  wrap.classList.add('has-selection', 'expanded');
  const priceEl = document.getElementById('mc-price-' + type);
  if (priceEl) priceEl.textContent = rupees(price);
  mcUpdateConfirmBar();
}

function mcStep(type, delta, e) {
  e.stopPropagation();
  const el = document.getElementById('mc-qty-' + type);
  if (!el) return;
  const newQty   = Math.max(1, Math.min(99, parseInt(el.textContent) + delta));
  el.textContent = newQty;
  if (mcSelections[type]) { mcSelections[type].qty = newQty; mcUpdateConfirmBar(); }
}

function mcUpdateConfirmBar() {
  updateConfirmBar('mc-confirm-bar', 'mc-confirm-summary', 'mc-total-preview',
    Object.values(mcSelections).map(i => ({ label: `${i.label} (${i.size})`, qty: i.qty, price: i.price }))
  );
}

function confirmMainCombo() {
  const items = Object.values(mcSelections);
  if (!items.length) { toast('Select at least one combo', 'error'); return; }
  closeSheet('mc-modal');
  const { containerId, idPrefix, recalcFn } = resolveSheetTarget(activeSheet.target);
  items.forEach(({ type, size, qty }) => addCombo(containerId, idPrefix, recalcFn, type, size, size, qty));
}

/* Half/Full Lower+T-Shirt sheet */
function openHalfFullSheet(target) {
  activeSheet.target = target;
  sheetState.hfType = null;
  sheetState.hfSize = null;
  $('hf-sizes').innerHTML = '';
  $('hf-qty').textContent = '1';
  $('hf-item-row').style.display = 'none';
  $('hf-item-row').classList.remove('has-selection');
  $('hf-confirm-wrap').classList.remove('visible');
  document.querySelectorAll('.hf-variant-btn').forEach(b => b.classList.remove('active'));

  openSheet('hf-modal');

  /* restore last chosen variant after sheet is open */
  const last = localStorage.getItem('hf_last_type');
  if (last) {
    const btn = last === 'half-lower-tshirt' ? $('hf-opt-half') : $('hf-opt-full');
    if (btn) selectHalfFullType(last, btn);
  }
}

function selectHalfFullType(type, el) {
  sheetState.hfType = type;
  sheetState.hfSize = null;
  localStorage.setItem('hf_last_type', type);
  document.querySelectorAll('.hf-variant-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  $('hf-item-row').classList.remove('has-selection');
  $('hf-unit-price').textContent  = '';
  $('hf-price-total').textContent = '';
  $('hf-confirm-wrap').classList.remove('visible');

  const ctxPrices = getSheetPrices(activeSheet.target);
  const cfg       = COMBOS[type];
  const sizes     = Object.keys(ctxPrices[cfg.item1] || {});

  $('hf-item-label').textContent = cfg.label;
  $('hf-item-row').style.display = '';

  buildChips('hf-sizes', sizes, (v, chip) => {
    const already = sheetState.hfSize === v;
    sheetState.hfSize = already ? null : v;
    $('hf-sizes').querySelectorAll('.size-chip').forEach(c => c.classList.remove('selected'));
    if (!already) {
      chip.classList.add('selected');
      $('hf-item-row').classList.add('has-selection');
      updateHalfFullPrice(ctxPrices);
      $('hf-confirm-wrap').classList.add('visible');
    } else {
      $('hf-item-row').classList.remove('has-selection');
      $('hf-unit-price').textContent = '';
      $('hf-price-total').textContent = '';
      $('hf-confirm-wrap').classList.remove('visible');
    }
  });
}

function updateHalfFullPrice(p) {
  if (!sheetState.hfType || !sheetState.hfSize) {
    $('hf-unit-price').textContent = '';
    $('hf-price-total').textContent = '';
    return;
  }
  const cfg      = COMBOS[sheetState.hfType];
  const unit     = (p[cfg.item1]?.[sheetState.hfSize] || 0) + (p[cfg.item2]?.[sheetState.hfSize] || 0);
  const qty      = parseInt($('hf-qty').textContent) || 1;
  const unitEl   = $('hf-unit-price');
  const totalEl  = $('hf-price-total');
  const summary  = $('hf-confirm-summary');
  if (unitEl)   unitEl.textContent  = unit ? 'Rs.' + unit : '';
  if (totalEl)  { totalEl.dataset.unit = unit; totalEl.textContent = unit ? rupees(unit * qty) : ''; }
  if (summary)  summary.textContent = `${cfg.label} (${sheetState.hfSize})${qty > 1 ? ' ×'+qty : ''}`;
}

function updateHalfFullQtyPrice() {
  const totalEl  = $('hf-price-total');
  const summary  = $('hf-confirm-summary');
  const unit     = parseFloat(totalEl?.dataset.unit) || 0;
  const qty      = parseInt($('hf-qty').textContent) || 1;
  if (totalEl)  totalEl.textContent = unit ? rupees(unit * qty) : '';
  if (summary && sheetState.hfType && sheetState.hfSize) {
    const cfg = COMBOS[sheetState.hfType];
    summary.textContent = `${cfg.label} (${sheetState.hfSize})${qty > 1 ? ' ×'+qty : ''}`;
  }
}

function confirmHalfFull() {
  if (!sheetState.hfType) { toast('Select Half or Full first', 'error'); return; }
  if (!sheetState.hfSize) { toast('Select a size first', 'error'); return; }
  const qty = parseInt($('hf-qty').textContent);
  closeSheet('hf-modal');
  const { containerId, idPrefix, recalcFn } = resolveSheetTarget(activeSheet.target);
  addCombo(containerId, idPrefix, recalcFn, sheetState.hfType, sheetState.hfSize, sheetState.hfSize, qty);
}

/* Blazer + Sweater sheet — multi-select, each item has independent size, qty, and price preview */
let bsSelections = {};

function openBlazerSweaterSheet(target) {
  activeSheet.target = target;
  bsSelections = {};
  const p = getSheetPrices(target);

  const ctn = $('bs-items');
  ctn.innerHTML = '';

  /* Winter Cap uses bsToggleCap/bsCapStep so can't reuse buildAccessoryRow (which wires SI handlers) */
  const capPrice = p['Winter Cap']?.['All'] || 0;
  const capRow   = document.createElement('div');
  capRow.className = 'acc-item-row';
  capRow.id        = 'bs-cap-row';
  capRow.innerHTML = `
    <div class="acc-item-left">
      <div class="acc-item-check">
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <polyline points="2,6 5,9 10,3" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <span class="acc-item-name">Winter Cap</span>
      <span class="acc-item-price">Rs.${capPrice}</span>
    </div>
    <div class="acc-item-stepper-wrap inline-stepper">
      <button onclick="bsCapStep(-1,event)">−</button>
      <span id="bs-cap-qty">1</span>
      <button onclick="bsCapStep(1,event)">+</button>
    </div>`;
  capRow.addEventListener('click', e => {
    if (e.target.closest('.inline-stepper')) return;
    bsToggleCap(capPrice, capRow);
  });
  ctn.appendChild(capRow);

  ['Blazer', 'Sweater'].forEach(itemName => {
    const sizes = Object.entries(p[itemName] || {});
    if (!sizes.length) return;
    ctn.appendChild(buildSizedItemRow(itemName, sizes, bsToggle, 'bsStep', 'bs'));
  });

  bsUpdateConfirmBar();
  openSheet('bs-modal');
}

function bsToggle(itemName, size, price, chip, wrap) {
  const existing   = bsSelections[itemName];
  const isSameChip = existing?.size === size;
  if (existing) {
    delete bsSelections[itemName];
    wrap.querySelectorAll('.size-chip').forEach(c => c.classList.remove('selected'));
    const priceEl = document.getElementById('bs-price-' + itemName);
    if (priceEl) priceEl.textContent = '';
    if (isSameChip) { wrap.classList.remove('has-selection'); bsUpdateConfirmBar(); return; }
  }
  const qty = parseInt(document.getElementById('bs-qty-' + itemName)?.textContent) || 1;
  bsSelections[itemName] = { item: itemName, size, price, qty };
  chip.classList.add('selected');
  wrap.classList.add('has-selection', 'expanded');
  const priceEl = document.getElementById('bs-price-' + itemName);
  if (priceEl) priceEl.textContent = rupees(price);
  bsUpdateConfirmBar();
}

function bsStep(itemName, delta, e) {
  e.stopPropagation();
  const el = document.getElementById('bs-qty-' + itemName);
  if (!el) return;
  const newQty   = Math.max(1, Math.min(99, parseInt(el.textContent) + delta));
  el.textContent = newQty;
  if (bsSelections[itemName]) { bsSelections[itemName].qty = newQty; bsUpdateConfirmBar(); }
}

function bsUpdateConfirmBar() {
  updateConfirmBar('bs-confirm-bar', 'bs-confirm-summary', 'bs-total-preview',
    Object.values(bsSelections).map(i => ({ label: `${i.item} (${i.size})`, qty: i.qty, price: i.price }))
  );
}

function bsToggleCap(price, row) {
  const isActive = row.classList.toggle('selected');
  if (isActive) {
    bsSelections['Winter Cap'] = { item: 'Winter Cap', size: 'All', price, qty: 1 };
  } else {
    delete bsSelections['Winter Cap'];
  }
  bsUpdateConfirmBar();
}

function bsCapStep(delta, e) {
  e.stopPropagation();
  const el     = $('bs-cap-qty');
  const newQty = Math.max(1, Math.min(99, parseInt(el.textContent) + delta));
  el.textContent = newQty;
  if (bsSelections['Winter Cap']) { bsSelections['Winter Cap'].qty = newQty; bsUpdateConfirmBar(); }
}

function confirmBlazerSweater() {
  const items = Object.values(bsSelections);
  if (!items.length) { toast('Select at least one item', 'error'); return; }
  closeSheet('bs-modal');
  const { containerId, idPrefix, recalcFn } = resolveSheetTarget(activeSheet.target);
  items.forEach(({ item, size, qty }) => addItem(containerId, idPrefix, recalcFn, item, size, qty));
}

let coSelections = {};

function coUpdateConfirmBar() {
  const items   = Object.values(coSelections);
  const bar     = $('co-confirm-bar');
  const sumEl   = $('co-confirm-summary');
  const priceEl = $('co-price-preview');
  if (!items.length) { bar.classList.remove('visible'); return; }
  bar.classList.add('visible');
  if (sumEl)   sumEl.textContent   = items.map(({ item, qty }) => qty > 1 ? `${item} ×${qty}` : item).join(', ');
  const total = items.reduce((s, { price, qty }) => s + price * qty, 0);
  if (priceEl) priceEl.textContent = total ? rupees(total) : '';
}

function openComboSheet(target, type) {
  activeSheet.target = target;
  sheetState.comboType = type;
  coSelections = {};

  const p   = getSheetPrices(target);
  const ctn = $('co-items');
  ctn.innerHTML = '';

  const pieces = [
    { item: 'Suit',    price: p.Suit?.All    || 0 },
    { item: 'Trouser', price: p.Trouser?.All || 0 },
    { item: 'Jacket',  price: p.Jacket?.All  || 0 },
  ];

  pieces.forEach(({ item, price }) => {
    const key    = item;
    const safeId = item.toLowerCase();
    const row    = document.createElement('div');
    row.className   = 'acc-item-row';
    row.dataset.key = key;
    row.innerHTML   = `
      <div class="acc-item-left">
        <div class="acc-item-check">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <polyline points="2,6 5,9 10,3" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <span class="acc-item-name">${item}</span>
        <span class="acc-item-price">Rs.${price}</span>
      </div>
      <div class="acc-item-stepper-wrap inline-stepper">
        <button onclick="coStep('${key}',-1,event)">−</button>
        <span id="co-qty-${safeId}">1</span>
        <button onclick="coStep('${key}',1,event)">+</button>
      </div>`;
    row.addEventListener('click', e => {
      if (e.target.closest('.inline-stepper')) return;
      if (coSelections[key]) {
        delete coSelections[key];
        row.classList.remove('selected');
      } else {
        const qty = parseInt(document.getElementById('co-qty-' + safeId)?.textContent) || 1;
        coSelections[key] = { item, price, qty };
        row.classList.add('selected');
      }
      coUpdateConfirmBar();
    });
    ctn.appendChild(row);
  });

  $('co-confirm-bar').classList.remove('visible');
  openSheet('co-modal');
}

function coStep(key, delta, e) {
  e.stopPropagation();
  const safeId = key.toLowerCase();
  const el     = $('co-qty-' + safeId);
  if (!el) return;
  const newQty   = Math.max(1, Math.min(99, parseInt(el.textContent) + delta));
  el.textContent = newQty;
  if (coSelections[key]) { coSelections[key].qty = newQty; coUpdateConfirmBar(); }
}

function confirmCombo() {
  const { containerId, idPrefix, recalcFn } = resolveSheetTarget(activeSheet.target);
  const items = Object.values(coSelections);
  if (!items.length) { toast('Select at least one piece', 'error'); return; }
  closeSheet('co-modal');
  items.forEach(({ item, qty }) => addItem(containerId, idPrefix, recalcFn, item, 'All', qty));
}

function openAdjSheet(target) {
  activeSheet.target = target;
  sheetState.adjSign = 1;
  $('adj-plus').className  = 'adj-sign-btn plus-active';
  $('adj-minus').className = 'adj-sign-btn';
  $('adj-amount').value = '';
  $('adj-note').value   = '';
  openSheet('adj-modal');
}

function setAdjSign(sign) {
  sheetState.adjSign = sign;
  $('adj-plus').className  = 'adj-sign-btn' + (sign ===  1 ? ' plus-active'  : '');
  $('adj-minus').className = 'adj-sign-btn' + (sign === -1 ? ' minus-active' : '');
}

function confirmAdj() {
  const rawAmt = parseFloat($('adj-amount').value);
  if (!rawAmt || rawAmt <= 0) { toast('Enter a positive amount', 'error'); return; }
  const note = ($('adj-note').value || '').trim();
  closeSheet('adj-modal');
  const { containerId, idPrefix, recalcFn } = resolveSheetTarget(activeSheet.target);
  addAdjustment(containerId, idPrefix, recalcFn, sheetState.adjSign, rawAmt, note);
}



/* Adds a single-item row to the container; wires change events and removes on × click */
function addItem(containerId, prefix, recalcFn, defaultItem, defaultSize, defaultQty, pricesObj) {
  itemCounter++;
  const id  = prefix + itemCounter;
  const row = cloneTemplate('tpl-item-row');
  row.id = 'item-' + id;

  const p       = pricesObj || prices;
  const itemSel = row.querySelector('.ir-item-sel');
  const sizeSel = row.querySelector('.ir-size-sel');
  const qtyIn   = row.querySelector('.ir-qty');
  const priceEl = row.querySelector('.ir-price');
  const remBtn  = row.querySelector('.ir-remove');

  itemSel.id = 'isel-' + id; sizeSel.id = 'ssel-' + id;
  qtyIn.id   = 'qty-'  + id; priceEl.id = 'price-'+ id;

  itemSel.appendChild(buildItemOptions(defaultItem || Object.keys(p)[0], p));
  sizeSel.appendChild(buildSizeOptions(defaultItem || Object.keys(p)[0], defaultSize, p));
  qtyIn.value = defaultQty || 1;

  itemSel.addEventListener('change', () => { sizeSel.innerHTML = ''; sizeSel.appendChild(buildSizeOptions(itemSel.value, null, p)); recalcFn(); });
  sizeSel.addEventListener('change', () => recalcFn());
  qtyIn.addEventListener('input',    () => recalcFn());
  remBtn.addEventListener('click',   () => { row.remove(); recalcFn(); });

  $(containerId).appendChild(row);
  recalcFn();
}

/* Adds a combo or suit-set row; combo sub-rows can each be independently removed */
function addCombo(containerId, prefix, recalcFn, type, defaultSize1, defaultSize2, defaultQty, pricesObj) {
  itemCounter++;
  const id  = prefix + itemCounter;
  const qty = defaultQty || 1;
  const p   = pricesObj || prices;

  if (type === ITEM_TYPES.SUIT) {
    const row   = cloneTemplate('tpl-suit-row');
    row.id      = 'item-' + id;
    const qtyIn = row.querySelector('.sr-qty');
    const price = row.querySelector('.sr-price');
    const info  = row.querySelector('.sr-info');
    const rem   = row.querySelector('.sr-remove');
    qtyIn.id = 'qty-' + id; price.id = 'price-' + id;
    qtyIn.value = qty;
    const unit = p.Suit.All + p.Trouser.All + p.Jacket.All;
    info.textContent  = `Suit ${rupees(p.Suit.All)} + Trouser ${rupees(p.Trouser.All)} + Jacket ${rupees(p.Jacket.All)} = ${rupees(unit)} each`;
    price.textContent = rupees(unit * qty);
    qtyIn.addEventListener('input', () => recalcFn());
    rem.addEventListener('click',   () => { row.remove(); recalcFn(); });
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
    size1.id = 's1-'  + id; size2.id = 's2-'   + id;
    qtyIn.value = qty;
    size1.appendChild(buildSizeOptions(cfg.item1, defaultSize1, p));
    size2.appendChild(buildSizeOptions(cfg.item2, defaultSize2 || defaultSize1, p));
    qtyIn.addEventListener('input',  () => recalcFn());
    size1.addEventListener('change', () => recalcFn());
    size2.addEventListener('change', () => recalcFn());
    row.querySelector('.cr-remove').addEventListener('click',  () => { row.remove(); recalcFn(); });
    row.querySelector('.cr-remove1').addEventListener('click', () => { subRow1.remove(); if (!row.querySelectorAll('.combo-item-row').length) row.remove(); recalcFn(); });
    row.querySelector('.cr-remove2').addEventListener('click', () => { subRow2.remove(); if (!row.querySelectorAll('.combo-item-row').length) row.remove(); recalcFn(); });
    $(containerId).appendChild(row);
  }
  recalcFn();
}

/* Adds a non-editable adjustment row; line total stored in dataset for recalc() */
function addAdjustment(containerId, prefix, recalcFn, sign, amount, note) {
  itemCounter++;
  const id  = prefix + itemCounter;
  const row = cloneTemplate('tpl-adj-row');
  row.id = 'item-' + id;

  const lineTotal = sign * amount;
  row.dataset.adjLineTotal = String(lineTotal);

  const labelEl = row.querySelector('.ar-label');
  const noteEl  = row.querySelector('.ar-note');
  const priceEl = row.querySelector('.ar-price');
  const remBtn  = row.querySelector('.ar-remove');

  labelEl.textContent = sign === 1 ? '+ Charge' : '− Refund';
  if (note) { noteEl.style.display = 'block'; noteEl.textContent = note; }

  priceEl.textContent = sign === 1 ? rupees(amount) : '−' + rupees(amount);
  priceEl.classList.add(sign === 1 ? 'positive' : 'negative');

  remBtn.addEventListener('click', () => { row.remove(); recalcFn(); });

  $(containerId).appendChild(row);
  recalcFn();
}

/* Iterates all .js-item-row elements, sums line totals, updates the total display.
   Numeric size keys are tried both as string and int to handle mixed key types. */
function recalc(containerId, totalId, pricesObj) {
  const p = pricesObj || prices;
  let subtotal = 0;
  $(containerId)?.querySelectorAll('.js-item-row').forEach(row => {
    const id   = row.id.replace('item-', '');
    const type = row.dataset.type;

    if (type === ITEM_TYPES.ADJUSTMENT) {
      subtotal += parseFloat(row.dataset.adjLineTotal) || 0;
      return;
    }

    const qtyEl   = $('qty-'   + id);
    const priceEl = $('price-' + id);
    if (!qtyEl || !priceEl) return;
    const qty = parseInt(qtyEl.value) || 1;
    let unit = 0;

    if (type === ITEM_TYPES.SINGLE) {
      const is = $('isel-' + id), ss = $('ssel-' + id);
      if (!is) return;
      unit = p[is.value]?.[ss.value] || p[is.value]?.[parseInt(ss.value)] || 0;
    } else if (type === ITEM_TYPES.SUIT) {
      unit = p.Suit.All + p.Trouser.All + p.Jacket.All;
    } else if (type === ITEM_TYPES.COMBO) {
      const s1 = $('s1-' + id), s2 = $('s2-' + id);
      if (s1) unit += p[row.dataset.item1]?.[s1.value] || p[row.dataset.item1]?.[parseInt(s1.value)] || 0;
      if (s2) unit += p[row.dataset.item2]?.[s2.value] || p[row.dataset.item2]?.[parseInt(s2.value)] || 0;
    }

    const line = unit * qty;
    subtotal  += line;
    priceEl.textContent = rupees(line);
  });

  const el = $(totalId); if (el) el.textContent = rupees(subtotal);
  return subtotal;
}

function recalcNew() {
  recalc('items-container', 'grand-total', prices);
  const btn = document.querySelector('#tab-new .clear-items-btn');
  if (btn) btn.style.display = document.getElementById('items-container')?.querySelector('.js-item-row') ? 'block' : 'none';
}

/* Uses the saved order's original branch prices, not the current session prices */
function recalcEdit() {
  const order = editOrderId ? savedOrders.find(o => o.id === editOrderId) : null;
  recalc('edit-items-container', 'eo-grand-total', buildPrices(order?.branch || 'badagaon'));
  const btn = document.querySelector('#edit-order-screen .clear-items-btn');
  if (btn) btn.style.display = document.getElementById('edit-items-container')?.querySelector('.js-item-row') ? 'block' : 'none';
}

/* Reads all item rows from the DOM and returns structured item data + subtotal for saving */
function collectItems(containerId, pricesObj) {
  const p = pricesObj || prices;
  const items = [];
  let subtotal = 0;
  $(containerId)?.querySelectorAll('.js-item-row').forEach(row => {
    const id   = row.id.replace('item-', '');
    const type = row.dataset.type;

    if (type === ITEM_TYPES.ADJUSTMENT) {
      const lineTotal = parseFloat(row.dataset.adjLineTotal) || 0;
      const sign      = lineTotal >= 0 ? 1 : -1;
      const absAmt    = Math.abs(lineTotal);
      const note      = row.querySelector('.ar-note')?.textContent || '';
      const label     = note
        ? `${note} (${sign === 1 ? '+' : '−'}Rs.${absAmt.toLocaleString('en-IN')})`
        : (sign === 1 ? '+ Charge' : '− Refund') + ` Rs.${absAmt.toLocaleString('en-IN')}`;
      subtotal += lineTotal;
      items.push({ label, lineTotal, qty: 1, unit: lineTotal, itemType: ITEM_TYPES.ADJUSTMENT, sign, amount: absAmt, note });
      return;
    }

    const qty  = parseInt($('qty-' + id)?.value) || 1;
    let unit = 0, label = '', extra = {};

    if (type === ITEM_TYPES.SINGLE) {
      const is = $('isel-' + id), ss = $('ssel-' + id);
      if (!is) return;
      unit  = p[is.value]?.[ss.value] || p[is.value]?.[parseInt(ss.value)] || 0;
      label = `${is.value} (${ss.value})${qty > 1 ? ' x ' + qty : ''}`;
      extra = { itemType: ITEM_TYPES.SINGLE, itemName: is.value, itemSize: ss.value };
    } else if (type === ITEM_TYPES.SUIT) {
      unit  = p.Suit.All + p.Trouser.All + p.Jacket.All;
      label = `Suit Set (Suit + Trouser + Jacket)${qty > 1 ? ' x ' + qty : ''}`;
      extra = { itemType: ITEM_TYPES.SUIT };
    } else if (type === ITEM_TYPES.COMBO) {
      const s1 = $('s1-' + id), s2 = $('s2-' + id);
      if (!s1 && !s2) return;
      const n1 = row.dataset.item1, n2 = row.dataset.item2;
      if (s1) unit += p[n1]?.[s1.value] || p[n1]?.[parseInt(s1.value)] || 0;
      if (s2) unit += p[n2]?.[s2.value] || p[n2]?.[parseInt(s2.value)] || 0;
      const parts = [];
      if (s1) parts.push(`${n1} (${s1.value})`);
      if (s2) parts.push(`${n2} (${s2.value})`);
      label = parts.join(' + ') + (qty > 1 ? ' x ' + qty : '');
      extra = { itemType: ITEM_TYPES.COMBO, item1Name: s1 ? n1 : null, item1Size: s1 ? s1.value : null, item2Name: s2 ? n2 : null, item2Size: s2 ? s2.value : null };
    }

    subtotal += unit * qty;
    items.push({ label, lineTotal: unit * qty, qty, unit, ...extra });
  });
  return { items, subtotal };
}



function saveOrder() {
  const fields = readStudentFields('new');
  if (!fields.studentName) { toast('Please enter student name', 'error'); return; }
  if (!$('items-container')?.querySelector('.js-item-row')) { toast('Please add at least one item', 'error'); return; }
  if (fields.mobile && !/^[0-9+\s\-]{7,15}$/.test(fields.mobile)) { toast('Mobile number looks incorrect', 'error'); return; }

  const { items, subtotal } = collectItems('items-container');

  const newDiscount = parseFloat($('new-discount')?.value) || 0;
  let payments = [];
  if (newOrderPayMode !== PAY_MODES.PENDING) {
    const raw   = $('paid-amt')?.value.trim();
    let paidAmt = raw !== '' ? parseFloat(raw) : Math.max(0, subtotal - newDiscount);
    paidAmt     = Math.min(Math.max(0, paidAmt), subtotal);
    if (paidAmt > 0)
      payments = [{ mode: newOrderPayMode, amount: paidAmt, date: new Date().toLocaleDateString('en-IN') }];
  }

  /* New orders start with all delivery units marked given (sold at point of sale).
     Use the Delivery sheet to uncheck any items still to be handed over. */
  const newOrder = {
    id: Date.now(), uuid: generateUUID(), branch: currentBranch, ...fields,
    payments, items, subtotal, orderDiscount: newDiscount,
    date: new Date().toLocaleDateString('en-IN'),
    deliveryUnits: buildDeliveryUnits(items).map(u => ({ ...u, given: true }))
  };
  savedOrders.unshift(newOrder);

  saveOrderRemote(newOrder).catch(err => toast('Cloud save failed: ' + err.message, 'error', 4000));
  toast(`Order saved — ${fields.studentName}, ${rupees(subtotal)}`);
  resetNewForm();
  showTab('orders');
}

function resetNewForm() {
  clearStudentFields('new');
  if ($('paid-amt'))     $('paid-amt').value     = '';
  if ($('new-discount')) $('new-discount').value = '';
  const ctn = $('items-container'); if (ctn) ctn.innerHTML = '';
  itemCounter = 0;
  setNewOrderPayMode(PAY_MODES.PENDING);
  recalcNew();
  document.activeElement?.blur();
}

function clearAllItems(btn) {
  const isEdit      = !!document.getElementById('edit-items-container')?.contains(btn.closest('.section'));
  const containerId = isEdit ? 'edit-items-container' : 'items-container';
  const container   = document.getElementById(containerId);
  if (!container || !container.querySelector('.js-item-row')) return;
  if (!confirm('Clear all items from this order?')) return;
  container.innerHTML = '';
  itemCounter = 0;
  btn.style.display = 'none';
  isEdit ? recalcEdit() : recalcNew();
}



function setAnalyticsDate(v) { analyticsDate = v; renderAnalytics(); refreshBalPanel(); }
function setAnalyticsBranch(v) { analyticsBranch = v; renderAnalytics(); refreshBalPanel(); }
function setAnalyticsSpecificDate(v) { analyticsSpecificDate = v; renderAnalytics(); refreshBalPanel(); }

function refreshBalPanel() {
  const panel = $('bal-history-panel');
  if (panel && panel.style.display !== 'none') renderBalHistoryPanel(panel);
}

/* Builds the branch + date filter UI strip for the analytics screen */
function buildAnalyticsFilterUI() {
  const filterWrap = document.createElement('div');
  filterWrap.className = 'an-filter-wrap';

  const branchToggle = document.createElement('div');
  branchToggle.className = 'an-branch-toggle';
  [['all','All'],['badagaon','Badagaon'],['baghpat','Baghpat']].forEach(([v, l]) => {
    const btn = document.createElement('button');
    btn.className = 'an-branch-btn' + (analyticsBranch === v ? ' active' : '');
    btn.textContent = l;
    btn.onclick = () => setAnalyticsBranch(v);
    branchToggle.appendChild(btn);
  });
  const branchRow = document.createElement('div');
  branchRow.className = 'an-branch-row';
  branchRow.appendChild(branchToggle);
  filterWrap.appendChild(branchRow);

  const chipsRow = document.createElement('div');
  chipsRow.className = 'an-chips-row';
  [['today','Today'],['week','This week'],['all','All time'],['specific','Specific Date ↓']].forEach(([v, l]) => {
    const chip = document.createElement('button');
    chip.className = 'an-chip' + (analyticsDate === v ? ' active' : '');
    chip.textContent = l;
    chip.onclick = () => setAnalyticsDate(v);
    chipsRow.appendChild(chip);
  });
  filterWrap.appendChild(chipsRow);

  if (analyticsDate === 'specific') {
    if (!analyticsSpecificDate) {
      const t = new Date();
      analyticsSpecificDate = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
    }
    const dpInp = document.createElement('input');
    dpInp.type = 'date'; dpInp.className = 'an-date-input';
    dpInp.style.colorScheme = 'light';
    dpInp.value = analyticsSpecificDate;
    dpInp.addEventListener('change', e => setAnalyticsSpecificDate(e.target.value));
    const dpRow = document.createElement('div');
    dpRow.className = 'an-dp-row';
    dpRow.appendChild(dpInp);
    filterWrap.appendChild(dpRow);
  }

  return filterWrap;
}

/* Builds the three metric cards (revenue, collected, balance due) for the analytics screen */
function buildAnalyticsMetrics(orders) {
  const trueValue         = o => (o.subtotal || 0) - totalDiscount(o);
  const totalRevenue      = orders.reduce((s, o) => s + trueValue(o), 0);
  const ordersWithBalance = orders.filter(o => balanceDue(o) > 0);
  const ordersWithPayment = orders.filter(o => totalCollected(o) > 0);

  let cashAmt = 0, onlineAmt = 0, balanceAmt = 0, cashOrders = 0, onlineOrders = 0;
  orders.forEach(o => {
    const outstanding = trueValue(o) - totalCollected(o);
    if (outstanding > 0) balanceAmt += outstanding;
    getPayments(o).forEach(p => {
      if (p.mode === PAY_MODES.CASH)   cashAmt   += p.amount || 0;
      if (p.mode === PAY_MODES.ONLINE) onlineAmt += p.amount || 0;
    });
    const s = paymentStatus(o);
    if (s === ORDER_STATUS.CASH)   cashOrders++;
    if (s === ORDER_STATUS.ONLINE) onlineOrders++;
  });

  const collected = cashAmt + onlineAmt;
  const wrap = document.createElement('div');
  wrap.className = 'an-metrics-wrap';

  const revCard = document.createElement('div');
  revCard.className = 'an-metric an-metric-full';
  revCard.innerHTML = `
    <div class="an-metric-label">Total revenue</div>
    <div class="an-metric-val">${rupees(totalRevenue)}</div>
    <div class="an-metric-sub">${orders.length} order${orders.length !== 1 ? 's' : ''}</div>`;
  wrap.appendChild(revCard);

  const collCard = document.createElement('div');
  collCard.className = 'an-metric an-metric-green';
  collCard.innerHTML = `
    <div class="an-metric-label">Collected</div>
    <div class="an-metric-val">${rupees(collected)}</div>
    <div class="an-metric-sub">${ordersWithPayment.length} order${ordersWithPayment.length !== 1 ? 's' : ''}</div>`;
  wrap.appendChild(collCard);

  const balCard = document.createElement('div');
  balCard.className = 'an-metric an-metric-amber';
  balCard.innerHTML = `
    <div class="an-metric-label">Balance due</div>
    <div class="an-metric-val">${rupees(balanceAmt)}</div>
    <div class="an-metric-sub">${ordersWithBalance.length} order${ordersWithBalance.length !== 1 ? 's' : ''}</div>`;
  wrap.appendChild(balCard);

  return { wrap, cashOrders, onlineOrders, cashAmt, onlineAmt };
}

function renderAnalytics() {
  const today = todayMidnight();

  let base = savedOrders;
  if (analyticsDate === 'today') {
    base = base.filter(o => parseDate(o.date).getTime() === today.getTime());
  } else if (analyticsDate === 'week') {
    const week = new Date(today); week.setDate(today.getDate() - 6);
    base = base.filter(o => { const d = parseDate(o.date); return d >= week && d <= today; });
  } else if (analyticsDate === 'specific' && analyticsSpecificDate) {
    const [y, m, day] = analyticsSpecificDate.split('-').map(Number);
    const picked = new Date(y, m - 1, day);
    base = base.filter(o => parseDate(o.date).getTime() === picked.getTime());
  }

  const orders  = analyticsBranch === 'all' ? base : base.filter(o => o.branch === analyticsBranch);
  const sumC    = arr => arr.reduce((s, o) => s + totalCollected(o), 0);
  const badagaon = orders.filter(o => o.branch === 'badagaon');
  const baghpat  = orders.filter(o => o.branch === 'baghpat');

  const wrap = $('analytics-content');
  wrap.innerHTML = '';
  wrap.appendChild(buildAnalyticsFilterUI());

  const { wrap: metricsWrap, cashOrders, onlineOrders, cashAmt, onlineAmt } = buildAnalyticsMetrics(orders);
  wrap.appendChild(metricsWrap);

  const modeCard = makeAnSection('By payment mode');
  makeAnalyticsRow(modeCard, '#059669', 'Cash',   cashOrders,   cashAmt);
  makeAnalyticsRow(modeCard, '#2563eb', 'Online', onlineOrders, onlineAmt);
  wrap.appendChild(modeCard);

  if (analyticsBranch === 'all') {
    const branchCard = makeAnSection('By branch');
    makeAnalyticsRow(branchCard, '#059669', 'Badagaon', badagaon.length, sumC(badagaon));
    makeAnalyticsRow(branchCard, '#2563eb', 'Baghpat',  baghpat.length,  sumC(baghpat));
    wrap.appendChild(branchCard);
  }

  const balHistoryWrap = document.createElement('div');
  balHistoryWrap.id = 'bal-history-wrap';

  const balHistoryBtn = document.createElement('button');
  balHistoryBtn.className = 'an-bal-history-btn';
  balHistoryBtn.id = 'bal-history-toggle';
  balHistoryBtn.innerHTML = `Due Payments History <span id="bal-history-arrow">▼</span>`;
  balHistoryBtn.onclick = () => {
    const panel = $('bal-history-panel');
    const arrow = $('bal-history-arrow');
    const isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : 'block';
    arrow.textContent = isOpen ? '▼' : '▲';
    if (!isOpen) renderBalHistoryPanel(panel);
  };
  balHistoryWrap.appendChild(balHistoryBtn);

  const balHistoryPanel = document.createElement('div');
  balHistoryPanel.id = 'bal-history-panel';
  balHistoryPanel.style.display = 'none';
  balHistoryWrap.appendChild(balHistoryPanel);

  wrap.appendChild(balHistoryWrap);
}

/* Lists payments made after the order date (balance payments), filtered by date/branch */
function renderBalHistoryPanel(panel) {
  const today = todayMidnight();

  function matchesDate(dateStr) {
    const d = parseDate(dateStr);
    if (analyticsDate === 'today') return d.getTime() === today.getTime();
    if (analyticsDate === 'week')  { const w = new Date(today); w.setDate(today.getDate() - 6); return d >= w && d <= today; }
    if (analyticsDate === 'specific' && analyticsSpecificDate) {
      const [y, m, day] = analyticsSpecificDate.split('-').map(Number);
      return d.getTime() === new Date(y, m - 1, day).getTime();
    }
    return true;
  }

  const entries = [];
  savedOrders.forEach(o => {
    if (analyticsBranch !== 'all' && o.branch !== analyticsBranch) return;
    getPayments(o).forEach(p => {
      if (!p.amount || p.amount <= 0) return;
      if (p.date === o.date) return; /* balance payments are defined as payments after the order date; same-day = initial payment */
      if (!matchesDate(p.date)) return;
      entries.push({
        studentName: o.studentName,
        cls:         o.studentClass,
        orderDate:   o.date,
        payDate:     p.date,
        amount:      p.amount,
        mode:        p.mode,
        remaining:   balanceDue(o)
      });
    });
  });

  entries.sort((a, b) => parseDate(b.payDate) - parseDate(a.payDate));

  panel.innerHTML = '';

  if (entries.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'an-empty';
    empty.textContent = 'No balance payments for this period.';
    panel.appendChild(empty);
    return;
  }

  const total      = entries.reduce((s, e) => s + e.amount, 0);
  const cashTotal  = entries.filter(e => e.mode === PAY_MODES.CASH).reduce((s, e) => s + e.amount, 0);
  const onlineTotal= entries.filter(e => e.mode === PAY_MODES.ONLINE).reduce((s, e) => s + e.amount, 0);

  const totalLine = document.createElement('div');
  totalLine.className = 'an-bal-total-line';
  totalLine.innerHTML = `${rupees(total)} · ${entries.length} payment${entries.length !== 1 ? 's' : ''}
    <span class="an-bal-mode" style="color:#059669">Cash ${rupees(cashTotal)}</span>
    <span class="an-bal-mode" style="color:#2563eb">Online ${rupees(onlineTotal)}</span>`;
  panel.appendChild(totalLine);

  /* entries list */
  const listCard = makeAnSection('');
  entries.forEach(e => {
    const modeColor = e.mode === PAY_MODES.CASH ? '#059669' : '#2563eb';
    const row = document.createElement('div');
    row.className = 'an-bal-entry';
    row.innerHTML = `
      <div class="an-bal-entry-top">
        <div class="an-bal-entry-name">${e.studentName}${e.cls ? ' · ' + e.cls : ''}</div>
        <div class="an-bal-entry-amt">${rupees(e.amount)}</div>
      </div>
      <div class="an-bal-entry-meta">
        <span>Order: ${e.orderDate} · Paid: ${e.payDate} · <span style="color:${modeColor}">${e.mode.charAt(0).toUpperCase()+e.mode.slice(1)}</span></span>
        <span>${e.remaining > 0
          ? `<span class="an-bal-remaining">Due ${rupees(e.remaining)}</span>`
          : `<span class="an-bal-cleared">Paid</span>`}</span>
      </div>`;
    listCard.appendChild(row);
  });
  panel.appendChild(listCard);
}

function makeAnSection(title) {
  const sec = document.createElement('div');
  sec.className = 'an-section-card';
  if (title) {
    const lbl = document.createElement('div');
    lbl.className = 'an-section-label'; lbl.textContent = title;
    sec.appendChild(lbl);
  }
  return sec;
}

function makeAnalyticsRow(container, dotColor, label, count, amt) {
  const row = document.createElement('div');
  row.className = 'an-data-row';
  row.innerHTML = `
    <div class="an-row-left">
      <span class="an-row-dot" style="background:${dotColor}"></span>
      <span class="an-row-label">${label}</span>
      <span class="an-row-count">${count}</span>
    </div>
    <div class="an-row-amt">${rupees(amt)}</div>`;
  container.appendChild(row);
}



function toggleFilterSheet() { $('filter-dropdown').classList.toggle('open'); }

function setDateFilter(f) {
  dateFilter = f;
  ['all','today','week','specific'].forEach(k => $('fopt-'+k)?.classList.toggle('active', k===f));
  const row = $('fopt-specific-row');
  if (row) {
    row.style.display = f === 'specific' ? 'block' : 'none';
    if (f === 'specific') {
      if (!specificDateFilter) {
        const today = new Date();
        specificDateFilter = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
      }
      const inp = $('fopt-specific-date');
      if (inp) { inp.value = specificDateFilter; inp.style.colorScheme = 'light'; }
      renderOrders(getSearchValue());
    }
  }
  renderOrders(getSearchValue()); updateFilterBar();
}

function setSpecificDateFilter(val) { specificDateFilter = val; renderOrders(getSearchValue()); updateFilterBar(); }

function setBranchFilter(f)   { branchFilter   = f; ['all','badagaon','baghpat'].forEach(k => $('fopt-branch-'+k)?.classList.toggle('active', k===f)); renderOrders(getSearchValue()); updateFilterBar(); }
function setDeliveryFilter(f) { deliveryFilter = f; ['all','pending-delivery'].forEach(k => $('fopt-del-'+k)?.classList.toggle('active', k===f)); renderOrders(getSearchValue()); updateFilterBar(); }
function setPaymentFilter(f)  { paymentFilter  = f; ['all','pending','refund'].forEach(k => $('fopt-pay-'+k)?.classList.toggle('active', k===f)); renderOrders(getSearchValue()); updateFilterBar(); }

function updateFilterBar() {
  const active = dateFilter !== 'all' || branchFilter !== 'all' || paymentFilter !== 'all' || deliveryFilter !== 'all';
  const el = $('filter-bar-label');
  if (el) el.innerHTML = active ? `<button class="filter-clear-btn" onclick="clearFilters()">✕ Clear filters</button>` : '';
  const dot = $('filter-dot'); if (dot) dot.style.display = active ? 'block' : 'none';
  const btn = document.querySelector('.filter-btn'); if (btn) btn.classList.toggle('active', active);
}

function clearFilters() {
  dateFilter = branchFilter = paymentFilter = deliveryFilter = 'all';
  specificDateFilter = '';
  ['all','today','week','specific'].forEach(k => $('fopt-'+k)?.classList.toggle('active', k==='all'));
  ['all','badagaon','baghpat'].forEach(k => $('fopt-branch-'+k)?.classList.toggle('active', k==='all'));
  ['all','pending','refund'].forEach(k   => $('fopt-pay-'+k)?.classList.toggle('active',   k==='all'));
  ['all','pending-delivery'].forEach(k   => $('fopt-del-'+k)?.classList.toggle('active',   k==='all'));
  const row = $('fopt-specific-row'); if (row) row.style.display = 'none';
  const inp = $('fopt-specific-date'); if (inp) inp.value = '';
  renderOrders(getSearchValue()); updateFilterBar();
}

function matchesFilter(order) {
  if (paymentFilter === ORDER_STATUS.PENDING) {
    if (order.subtotal <= 0) return false;
    const s = paymentStatus(order);
    if (s !== ORDER_STATUS.PENDING && s !== ORDER_STATUS.PARTIAL) return false;
  }
  if (paymentFilter === ORDER_STATUS.REFUND) { if (order.subtotal > 0) return false; }
  if (deliveryFilter === 'pending-delivery' && pendingItemCount(order) === 0) return false;
  if (branchFilter !== 'all' && order.branch !== branchFilter) return false;
  if (dateFilter === 'all') return true;
  const d     = parseDate(order.date);
  const today = todayMidnight();
  if (dateFilter === 'today') return d.getTime() === today.getTime();
  if (dateFilter === 'week')  { const w = new Date(today); w.setDate(today.getDate() - 6); return d >= w && d <= today; }
  if (dateFilter === 'specific') {
    if (!specificDateFilter) return true;
    const [y, m, day] = specificDateFilter.split('-').map(Number);
    return d.getTime() === new Date(y, m - 1, day).getTime();
  }
  return true;
}



/* Updates the pending-payment and pending-delivery banner strips above the order list.
   Banners always reflect all orders, not just the currently filtered set. */
function updateBanners(filtered, today) {
  const pendingAll   = savedOrders.filter(o => o.subtotal > 0 && (balanceDue(o) > 0 || paymentStatus(o) === ORDER_STATUS.PENDING));
  const pendingTdy   = pendingAll.filter(o => parseDate(o.date).getTime() === today.getTime());
  const pendDelivAll = savedOrders.filter(o => pendingItemCount(o) > 0);

  const delivBanner = $('delivery-banner');
  if (delivBanner) {
    if (pendDelivAll.length) {
      const tot = pendDelivAll.reduce((s, o) => s + pendingItemCount(o), 0);
      delivBanner.style.display = 'flex';
      $('delivery-count').textContent       = pendDelivAll.length;
      $('delivery-items-count').textContent = `${tot} item${tot!==1?'s':''} not delivered`;
      delivBanner.onclick = () => { $('orders-search').value=''; if($('orders-search-clear'))$('orders-search-clear').style.display='none'; setDeliveryFilter('pending-delivery'); };
    } else { delivBanner.style.display = 'none'; }
  }

  const banner = $('pending-banner');
  if (pendingAll.length) {
    banner.style.display = 'flex';
    $('pending-count').textContent = pendingAll.length;
    const note = branchFilter !== 'all' ? ' (all branches)' : '';
    $('pending-today').textContent = pendingTdy.length ? `${pendingTdy.length} today${note}` : `none today${note}`;
    banner.onclick = () => { $('orders-search').value=''; if($('orders-search-clear'))$('orders-search-clear').style.display='none'; setPaymentFilter(PAY_MODES.PENDING); };
  } else { banner.style.display = 'none'; }

  const bannersRow = $('banners-row');
  if (bannersRow) bannersRow.style.display = (pendingAll.length || pendDelivAll.length) ? 'flex' : 'none';

  const totalSub = filtered.reduce((s, o) => s + (o.subtotal||0), 0);
  const totalCol = filtered.reduce((s, o) => s + totalCollected(o), 0);
  $('orders-summary').textContent = `${filtered.length} order${filtered.length!==1?'s':''} — Total: ${rupees(totalSub)} | Collected: ${rupees(totalCol)}`;
}

function buildOrderCard(o) {
  const status    = o.subtotal <= 0 ? ORDER_STATUS.REFUND : paymentStatus(o);
  const payments  = getPayments(o);
  const pendCount = pendingItemCount(o);

  const card = cloneTemplate('tpl-order-card');
  card.id    = 'card-' + o.id;

  const strip = document.createElement('div');
  strip.className = 'card-meta-strip';
  const dotColor = BRANCH_DOT_COLOR[o.branch] || '#94a3b8';
  strip.innerHTML =
    `<span>${o.date}</span>` +
    `<span class="card-meta-branch">` +
      `<span class="card-branch-dot" style="background:${dotColor}"></span>` +
      `${BRANCH_LABEL[o.branch]}` +
    `</span>`;
  card.insertAdjacentElement('afterbegin', strip);

  card.querySelector('.oc-student-name').textContent  = o.studentName || '';
  card.querySelector('.oc-student-class').textContent = o.studentClass ? ' ' + o.studentClass : '';

  const contactEl = card.querySelector('.oc-contact');
  if (o.parentName || o.mobile) contactEl.textContent = [o.parentName, o.mobile].filter(Boolean).join(' · ');
  else contactEl.style.display = 'none';

  const addressEl = card.querySelector('.oc-address');
  if (o.address) { addressEl.textContent = o.address; addressEl.style.display = 'block'; }

  const statusBadge = card.querySelector('.oc-status-badge');
  statusBadge.textContent = STATUS_LABEL[status];
  /* The ORDER_STATUS values double as CSS class names — style.css has .cash/.online/.pending etc rules */
  statusBadge.classList.add(status);
  card.querySelector('.oc-branch-badge')?.remove();

  if (pendCount > 0) {
    const dvBadge = card.querySelector('.oc-delivery-badge');
    card.querySelector('.oc-delivery-text').textContent = `${pendCount} not delivered`;
    dvBadge.style.display = 'inline-flex';
    dvBadge.onclick = () => openDeliverySheet(o.id);
  }

  const qpBtn = card.querySelector('.oc-quick-pay');
  if (status !== ORDER_STATUS.REFUND && (status === ORDER_STATUS.PENDING || status === ORDER_STATUS.PARTIAL)) {
    qpBtn.style.display = 'inline-flex';
    qpBtn.onclick = () => openPaymentSheet(o.id);
  }

  if (o.notes) { const ne = card.querySelector('.oc-notes'); ne.style.display='flex'; ne.querySelector('.oc-notes-text').textContent = o.notes; }

  const disc   = totalDiscount(o);
  const effAmt = o.subtotal - disc;
  const amtEl  = card.querySelector('.oc-amount');
  amtEl.textContent = rupees(effAmt);
  if (effAmt < 0) amtEl.style.color = 'var(--red)';

  const menuDrop = card.querySelector('.oc-menu-dropdown');
  card.querySelector('.oc-menu-btn').onclick = e => {
    e.stopPropagation();
    const isOpen = menuDrop.classList.contains('open');
    document.querySelectorAll('.menu-dropdown.open').forEach(m => m.classList.remove('open'));
    if (!isOpen) menuDrop.classList.add('open');
  };
  card.querySelector('.oc-edit-btn').onclick           = () => { menuDrop.classList.remove('open'); openEditOrder(o.id); };
  card.querySelector('.oc-delivery-menu-btn').onclick  = () => { menuDrop.classList.remove('open'); openDeliverySheet(o.id); };
  card.querySelector('.oc-payment-menu-btn').onclick   = () => { menuDrop.classList.remove('open'); openPaymentSheet(o.id); };
  card.querySelector('.oc-whatsapp-btn').onclick       = () => { menuDrop.classList.remove('open'); openWhatsApp(o.id); };
  card.querySelector('.oc-delete-btn').onclick         = () => { menuDrop.classList.remove('open'); deleteOrder(o.id); };

  const panel     = card.querySelector('.oc-items-panel');
  const toggleBtn = card.querySelector('.oc-toggle-btn');
  toggleBtn.onclick = () => {
    const open = panel.style.display !== 'none';
    panel.style.display = open ? 'none' : 'block';
    toggleBtn.classList.toggle('expanded', !open);
  };
  card.querySelector('.oc-item-count').textContent = 'Details';

  const units = ensureDeliveryUnits(o);
  let dvOffset = 0;
  (o.items || []).forEach(item => {
    if (item.itemType === ITEM_TYPES.ADJUSTMENT) {
      const line = cloneTemplate('tpl-order-item-line');
      line.querySelector('.oil-dot').classList.add('dot-adjustment');
      const isCharge = item.lineTotal >= 0;
      const absAmt   = Math.abs(item.lineTotal || 0);
      const adjLabel = item.note
        ? `${item.note} (${isCharge ? '+' : '−'}Rs.${absAmt.toLocaleString('en-IN')})`
        : (isCharge ? '+ Charge' : '− Refund') + ` Rs.${absAmt.toLocaleString('en-IN')}`;
      line.querySelector('.oil-label').textContent = adjLabel;
      const ps = line.querySelector('.oil-price');
      ps.textContent = (isCharge ? '' : '−') + rupees(absAmt);
      ps.style.color = isCharge ? 'var(--green)' : 'var(--red)';
      panel.appendChild(line);
      return;
    }

    const qty      = item.qty || 1;
    const uPQ      = item.itemType === ITEM_TYPES.SUIT ? 3 : item.itemType === ITEM_TYPES.COMBO ? [item.item1Name, item.item2Name].filter(Boolean).length : 1;
    const rowUnits = units.slice(dvOffset, dvOffset + qty * uPQ);
    dvOffset += qty * uPQ;
    const pendUnits = rowUnits.filter(u => !u.given).length;

    const line = cloneTemplate('tpl-order-item-line');
    line.querySelector('.oil-dot').classList.add(pendUnits > 0 ? 'dot-pending' : 'dot-given');
    line.querySelector('.oil-label').textContent = item.label;
    line.querySelector('.oil-price').textContent = rupees(item.lineTotal);
    if (pendUnits > 0) { const pn = line.querySelector('.oil-pend-note'); pn.style.display='inline'; pn.textContent=`${pendUnits} not delivered`; }
    panel.appendChild(line);
  });

  const subRow = document.createElement('div');
  subRow.className = 'order-final-row';
  subRow.innerHTML = `<span>Subtotal</span><span>${rupees(o.subtotal)}</span>`;
  panel.appendChild(subRow);

  payments.forEach((p, i) => {
    const pRow = cloneTemplate('tpl-pay-history-row');
    pRow.querySelector('.phr-label').textContent = `Payment ${i+1} · ${p.mode.charAt(0).toUpperCase()+p.mode.slice(1)} · ${p.date}`;
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

  return card;
}

function renderOrders(query) {
  query = (query || '').toLowerCase();

  const filtered = savedOrders.filter(o => {
    if (!matchesFilter(o)) return false;
    return (o.studentName||'').toLowerCase().includes(query) || (o.studentClass||'').toLowerCase().includes(query) ||
           (o.parentName||'').toLowerCase().includes(query)  || (o.mobile||'').includes(query)                    ||
           (o.address||'').toLowerCase().includes(query)     || (o.notes||'').toLowerCase().includes(query);
  });

  updateBanners(filtered, todayMidnight());

  const list = $('orders-list');
  list.innerHTML = '';

  if (!filtered.length) {
    const empty = document.createElement('div');
    empty.className = 'empty'; empty.textContent = 'No orders found';
    list.appendChild(empty); return;
  }

  filtered.forEach(o => list.appendChild(buildOrderCard(o)));
}



function openDeliverySheet(id) {
  const order = savedOrders.find(o => o.id === id);
  if (!order) return;
  activeSheet.orderId = id;
  renderDeliverySheet(order);
  openSheet('dv-modal');
}

function renderDeliverySheet(order) {
  const units      = ensureDeliveryUnits(order);
  const pendCount  = units.filter(u => !u.given).length;
  const givenCount = units.length - pendCount;
  $('dv-student').textContent = `${order.studentName}${order.studentClass ? ' · ' + order.studentClass : ''}`;
  $('dv-summary').textContent = pendCount === 0
    ? `All ${units.length} piece${units.length!==1?'s':''} delivered`
    : `${pendCount} not delivered · ${givenCount} delivered`;

  const ctn = $('dv-items'); ctn.innerHTML = '';
  units.forEach(u => {
    const row = cloneTemplate('tpl-dv-item');
    const isPending = !u.given;
    row.classList.add(isPending ? 'dv-pending' : 'dv-given');
    row.querySelector('.dvi-dot').classList.add(isPending ? 'dot-pending' : 'dot-given');
    row.querySelector('.dvi-label').textContent  = u.label;
    row.querySelector('.dvi-status').textContent = isPending ? 'Pending' : 'Delivered';
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
  saveOrderRemote(savedOrders[idx]).catch(e => console.error(e));
  renderDeliverySheet(savedOrders[idx]); renderOrders(getSearchValue());
  if (units.every(u => u.given)) toast(`All items marked delivered for ${savedOrders[idx].studentName}`);
}

function markAllDelivered(orderId) {
  const idx = savedOrders.findIndex(o => o.id === orderId);
  if (idx === -1) return;
  ensureDeliveryUnits(savedOrders[idx]).forEach(u => u.given = true);
  saveOrderRemote(savedOrders[idx]).catch(e => console.error(e));
  renderDeliverySheet(savedOrders[idx]); renderOrders(getSearchValue());
  toast('All items marked delivered');
}



/* Rebuilds the payment history section and pre-fills amount with the current balance */
function refreshPaymentSheetHistory(id) {
  const order = savedOrders.find(o => o.id === id);
  if (!order) return;
  const histWrap = $('ep-history');
  histWrap.innerHTML = '';

  const infoBlock = document.createElement('div');
  infoBlock.className = 'ep-info-block';

  const payments = getPayments(order);
  if (payments.length) {
    const histSec = document.createElement('div'); histSec.className = 'ep-info-section';
    const histLabel = document.createElement('div');
    histLabel.className = 'ep-history-label';
    histLabel.textContent = 'Payment History'; histSec.appendChild(histLabel);

    payments.forEach((p, i) => {
      const entry = cloneTemplate('tpl-pay-entry');
      entry.querySelector('.pe-mode').textContent = p.mode.charAt(0).toUpperCase() + p.mode.slice(1);
      entry.querySelector('.pe-date').textContent = p.date;
      entry.querySelector('.pe-amt').textContent  = rupees(p.amount);
      entry.querySelector('.pe-del').onclick      = () => confirmDeletePayEntry(id, i);
      entry.style.background   = 'transparent';
      entry.style.borderRadius = '0';
      entry.style.padding      = '4px 0';
      entry.style.marginBottom = '2px';
      histSec.appendChild(entry);
    });
    infoBlock.appendChild(histSec);
  }

  const totalsSec = document.createElement('div'); totalsSec.className = 'ep-info-section';
  const makeRow = (label, val, cls) => {
    const row = document.createElement('div'); row.className = 'ep-totals-row';
    row.innerHTML = `<span class="ep-totals-label">${label}</span><span class="ep-totals-val ${cls||''}">${val}</span>`;
    return row;
  };
  const bal = balanceDue(order), disc = totalDiscount(order);
  totalsSec.appendChild(makeRow('Order total', rupees(order.subtotal), ''));
  totalsSec.appendChild(makeRow('Collected',   rupees(totalCollected(order)), 'green'));
  if (disc > 0) totalsSec.appendChild(makeRow('Discount', '−'+rupees(disc), 'red'));
  totalsSec.appendChild(makeRow('Balance due', rupees(bal), bal > 0 ? 'orange' : ''));
  infoBlock.appendChild(totalsSec);
  histWrap.appendChild(infoBlock);
  if (!(parseFloat($('ep-amt').value) || 0)) $('ep-amt').value = bal > 0 ? bal : '';
}

function openPaymentSheet(id) {
  const order = savedOrders.find(o => o.id === id);
  if (!order) return;
  activeSheet.orderId = id;
  $('ep-amt').value      = '';
  $('ep-discount').value = order.orderDiscount > 0 ? order.orderDiscount : '';
  refreshPaymentSheetHistory(id);
  setPaymentSheetMode(PAY_MODES.CASH);
  openSheet('ep-modal');
}

function setPaymentSheetMode(mode) {
  ['cash','online'].forEach(m => { const b = $('ep-'+m); if(b) b.className='edit-pay-btn'; });
  $('ep-'+mode)?.classList.add(mode+'-active');
  $('ep-modal').dataset.chosenMode = mode;
}

function syncDiscountAmount() {
  const order = savedOrders.find(o => o.id === activeSheet.orderId);
  if (!order) return;
  $('ep-amt').value = Math.max(0, (order.subtotal||0) - totalCollected(order) - (parseFloat($('ep-discount').value)||0));
}

function savePaymentEntry() {
  if (!activeSheet.orderId) return;
  const idx = savedOrders.findIndex(o => o.id === activeSheet.orderId);
  if (idx === -1) return;
  const newMode = $('ep-modal').dataset.chosenMode || 'cash';
  const amtVal  = parseFloat($('ep-amt').value)      || 0;
  const discVal = parseFloat($('ep-discount').value) || 0;
  if (amtVal < 0) { toast('Amount cannot be negative', 'error'); return; }
  const curBal = balanceDue(savedOrders[idx]);
  if (amtVal > curBal && curBal > 0) if (!confirm(`Amount (${rupees(amtVal)}) exceeds balance (${rupees(curBal)}). Continue?`)) return;
  if (discVal > 0 && amtVal === 0)   if (!confirm(`Apply a discount of ${rupees(discVal)} with no payment received?`)) return;
  const payments = [...getPayments(savedOrders[idx])];
  if (amtVal > 0) payments.push({ mode: newMode, amount: amtVal, date: new Date().toLocaleDateString('en-IN') });
  savedOrders[idx].payments      = payments;
  savedOrders[idx].orderDiscount = discVal;
  saveOrderRemote(savedOrders[idx]).catch(e => console.error(e));
  closeSheet('ep-modal'); renderOrders(getSearchValue());
  toast(amtVal > 0 ? 'Payment added' : `Discount of ${rupees(discVal)} applied`);
}

function confirmDeletePayEntry(orderId, entryIndex) {
  const entry = getPayments(savedOrders.find(o => o.id === orderId))?.[entryIndex];
  if (!entry) return;
  activeSheet.deletePayIdx = { orderId, entryIndex };
  $('del-modal-sub').textContent = `${entry.mode.charAt(0).toUpperCase()+entry.mode.slice(1)} payment of ${rupees(entry.amount)} on ${entry.date}. This cannot be undone.`;
  $('del-modal').dataset.mode = 'payment';
  openDelModal();
}



function openDelModal()  { $('del-modal').classList.add('open');    }
function closeDelModal() { $('del-modal').classList.remove('open'); }

function deleteOrder(id) {
  const order = savedOrders.find(o => o.id === id);
  activeSheet.deleteId = id;
  $('del-modal-sub').textContent = order ? `Deleting: ${order.studentName||'this order'} — ${rupees(order.subtotal)}. This cannot be undone.` : 'This cannot be undone.';
  $('del-modal').dataset.mode = 'order';
  openDelModal();
}

/* Handles both order deletion and payment entry deletion via data-mode attribute */
function confirmDelete() {
  const mode = $('del-modal').dataset.mode;
  closeDelModal();
  if (mode === 'payment') {
    if (!activeSheet.deletePayIdx) return;
    const { orderId, entryIndex } = activeSheet.deletePayIdx; activeSheet.deletePayIdx = null; $('del-modal').dataset.mode = '';
    const idx = savedOrders.findIndex(o => o.id === orderId); if (idx === -1) return;
    const payments = [...getPayments(savedOrders[idx])]; payments.splice(entryIndex, 1);
    savedOrders[idx].payments = payments; savedOrders[idx].orderDiscount = savedOrders[idx].orderDiscount || 0;
    saveOrderRemote(savedOrders[idx]).catch(e => console.error(e));
    toast('Payment entry deleted'); closeSheet('ep-modal'); renderOrders(getSearchValue());
  } else {
    if (!activeSheet.deleteId) return;
    const deletedId = activeSheet.deleteId;
    savedOrders = savedOrders.filter(o => o.id !== deletedId); activeSheet.deleteId = null;
    deleteOrderRemote(deletedId).catch(e => console.error(e));
    toast('Order deleted'); renderOrders(getSearchValue());
  }
}



function openEditOrder(id) {
  const order = savedOrders.find(o => o.id === id);
  if (!order) return;
  editOrderId = id; itemCounter = 0;

  const editBranch = order.branch;
  const editPrices = buildPrices(editBranch);
  const savedGlobalPrices = prices;
  /* Temporarily override global prices: sheet helpers (addItem, addCombo etc)
     read the global `prices` directly, so we swap it to this order's branch for
     the duration of building the edit form, then restore in the finally block. */
  prices = editPrices;

  buildStudentFields('edit-student-fields', 'edit');
  buildItemsSection('edit-items-section', 'edit-items-container', 'add-btns-eo', 'eo-grand-total', 'Total', true);
  writeStudentFields('edit', order);

  const branchBadge = $('eo-branch-badge');
  if (branchBadge) {
    branchBadge.textContent = BRANCH_LABEL[editBranch];
    branchBadge.className   = `badge ${editBranch}`;
  }

  $('edit-items-container').innerHTML = '';
  try {
    (order.items || []).forEach(item => {
      const qty = item.qty || 1;
      if (item.itemType === ITEM_TYPES.SUIT) {
        addCombo('edit-items-container', 'e', recalcEdit, 'suit-set', null, null, qty, editPrices);
      } else if (item.itemType === ITEM_TYPES.COMBO) {
        const comboType = COMBO_TYPE_BY_ITEM1[item.item1Name] || 'pant-shirt';
        addCombo('edit-items-container', 'e', recalcEdit, comboType, item.item1Size, item.item2Size, qty, editPrices);
      } else if (item.itemType === ITEM_TYPES.ADJUSTMENT) {
        addAdjustment('edit-items-container', 'e', recalcEdit, item.sign, item.amount, item.note || '');
      } else {
        addItem('edit-items-container', 'e', recalcEdit, item.itemName, item.itemSize, qty, editPrices);
      }
    });
  } finally {
    prices = savedGlobalPrices;
  }
  recalcEdit();
  $('edit-order-screen').classList.add('open');
  window.scrollTo(0, 0);
}

function closeEditOrder() { $('edit-order-screen').classList.remove('open'); editOrderId = null; }

function saveEditOrder() {
  const fields = readStudentFields('edit');
  if (!fields.studentName) { toast('Please enter student name', 'error'); return; }
  if (!$('edit-items-container')?.querySelector('.js-item-row')) { toast('Please add at least one item', 'error'); return; }

  const idx = savedOrders.findIndex(o => o.id === editOrderId);
  if (idx === -1) { toast('Order not found', 'error'); return; }
  const orig      = savedOrders[idx];
  const collected = totalCollected(orig);

  let items, subtotal;
  const savedPrices = prices;
  prices = buildPrices(orig.branch); /* same global-override pattern as openEditOrder */
  try {
    ({ items, subtotal } = collectItems('edit-items-container'));
  } finally {
    prices = savedPrices;
  }

  if (subtotal < collected)
    if (!confirm(`Warning: new total (${rupees(subtotal)}) is less than already collected (${rupees(collected)}).\nPayment entries will be adjusted. Proceed?`)) return;

  /* Payments are capped to fit within the new subtotal — prevents over-collection
     when items are removed during edit (e.g. collected Rs.500, new total is Rs.400) */
  let remaining = subtotal;
  const adjustedPayments = [...getPayments(orig)].map(p => {
    const amt = Math.min(p.amount || 0, remaining); remaining = Math.max(0, remaining - amt); return { ...p, amount: amt };
  });

  /* Carry over delivery 'given' state for any unit keys that still exist in the new items */
  const givenKeys = new Set(ensureDeliveryUnits(orig).filter(u => u.given).map(u => u.key));
  const newUnits  = buildDeliveryUnits(items);
  newUnits.forEach(u => { if (givenKeys.has(u.key)) u.given = true; });

  savedOrders[idx] = { ...orig, ...fields, items, subtotal, payments: adjustedPayments, orderDiscount: orig.orderDiscount || 0, deliveryUnits: newUnits };
  saveOrderRemote(savedOrders[idx]).catch(e => console.error(e));
  toast(`Order updated — ${fields.studentName}, ${rupees(subtotal)}`);
  closeEditOrder();
  renderOrders(getSearchValue());
}



/* Builds a formatted WhatsApp message with items, payments, balance, UPI details,
   and exchange policy; opens wa.me link if mobile saved, else copies to clipboard. */
async function openWhatsApp(id) {
  const order = savedOrders.find(o => o.id === id);
  if (!order) return;

  const cloudSettings = await loadSettingsFromCloud();
  const upiId     = cloudSettings?.upiId     || DEFAULT_UPI_ID;
  const upiNumber = cloudSettings?.upiNumber || DEFAULT_UPI_NUMBER;

  const payments  = getPayments(order);
  const balance   = balanceDue(order);
  const discount  = totalDiscount(order);
  const dvUnits   = ensureDeliveryUnits(order);

  const itemLines = (order.items || []).map(item => {
    if (item.itemType === ITEM_TYPES.ADJUSTMENT) {
      const isCharge = item.lineTotal >= 0;
      const absAmt   = Math.abs(item.lineTotal || 0);
      const sign     = isCharge ? '+' : '−';
      return item.note
        ? `  • ${item.note} (${sign}Rs.${absAmt.toLocaleString('en-IN')})`
        : `  • ${isCharge ? 'Charge' : 'Refund'} ${sign}Rs.${absAmt.toLocaleString('en-IN')}`;
    }
    return `  • ${item.label} = Rs.${item.lineTotal.toLocaleString('en-IN')}`;
  }).join('\n');

  const totalPend = dvUnits.filter(u => !u.given).length;
  const pendNote  = totalPend > 0 ? `\n⚠️ ${totalPend} item${totalPend!==1?'s':''} not yet delivered` : '';

  const detailLines = [
    order.studentName ? `Student: ${order.studentName}${order.studentClass ? ` (${order.studentClass})` : ''}` : '',
    order.parentName  ? `Parent: ${order.parentName}`  : '',
    order.mobile      ? `Mobile: ${order.mobile}`      : '',
    order.address     ? `Address: ${order.address}`    : '',
    order.notes       ? `Note: ${order.notes}`         : ''
  ].filter(Boolean).join('\n');

  const payLines     = payments.length ? payments.map(p => `  • ${p.mode.charAt(0).toUpperCase()+p.mode.slice(1)} = Rs.${p.amount.toLocaleString('en-IN')} (${p.date})`).join('\n') : '';
  const discountLine = discount > 0 ? `  • Discount = -Rs.${discount.toLocaleString('en-IN')}` : '';
  const paymentSection = (payLines || discountLine) ? `\n*Payments:*\n${[payLines, discountLine].filter(Boolean).join('\n')}\n` : '';

  const balanceLine = balance > 0
    ? `⚠️ *Balance Due: Rs.${balance.toLocaleString('en-IN')}*\n\n📲 *Pay via UPI:*\n *UPI ID:* ${upiId}\n *UPI Number:* ${upiNumber}`
    : '✅ Fully Paid';
  const exchangePolicy = `\n\n——————————————\n *Exchange Policy*\nNo returns. Size exchange only within 7 days of delivery in unused condition.\n• Larger size → pay the difference\n• Smaller size → we refund the difference`;

  const message =
`*Golden Gate International School*
*Uniform Bill* — ${order.date}

${detailLines}

*Items:*
${itemLines}${pendNote}

*Total: Rs.${order.subtotal.toLocaleString('en-IN')}*
${paymentSection}
${balanceLine}${exchangePolicy}`;

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



function exportCSV() {
  if (!savedOrders.length) { toast('No orders to export'); return; }
  const headers = ['UUID','Date','Branch','Student Name','Class','Parent Name','Mobile','Address','Notes','Items','Items Not Delivered','Subtotal','Collected','Discount','Balance','Status','Payment Detail'];
  const rows = savedOrders.map(o => {
    const payments  = getPayments(o);
    const payDetail = payments.map(p => `${p.mode} Rs.${p.amount} on ${p.date}`).join(' | ');
    const pendLabels = ensureDeliveryUnits(o).filter(u => !u.given).map(u => u.label).join(' | ');
    return [
      o.uuid, o.date, o.branch,
      o.studentName||'', o.studentClass||'', o.parentName||'', o.mobile||'', o.address||'', o.notes||'',
      (o.items||[]).map(i => i.label + ' = ' + (i.lineTotal<0?'-':'') + 'Rs.' + Math.abs(i.lineTotal)).join(' | '),
      pendLabels||'All delivered',
      o.subtotal, totalCollected(o), totalDiscount(o), balanceDue(o), paymentStatus(o), payDetail
    ];
  });
  const csv  = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const link = document.createElement('a');
  link.href  = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  link.download = `uniform-orders-${new Date().toLocaleDateString('en-IN').replace(/\//g,'-')}.csv`;
  link.click();
}

function exportJSON() {
  if (!savedOrders.length) { toast('No orders to export'); return; }
  const backup = { exportedAt: new Date().toISOString(), orders: savedOrders };
  const link   = document.createElement('a');
  link.href     = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
  link.download = `uniform-backup-${new Date().toLocaleDateString('en-IN').replace(/\//g,'-')}.json`;
  link.click();
}

/* Merges imported orders by UUID; skips duplicates; syncs new orders to Firestore */
function importJSON(event) {
  const file = event.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const parsed   = JSON.parse(e.target.result);
      const imported = Array.isArray(parsed) ? parsed : (parsed.orders || []);
      if (!imported.length) { toast('No orders found in file', 'error'); return; }

      const existingUUIDs = new Set(savedOrders.map(o => o.uuid).filter(Boolean));
      const newOrders     = imported
        .filter(o => !o.uuid || !existingUUIDs.has(o.uuid))
        .map(o => o.uuid ? o : { ...o, uuid: generateUUID() });

      if (!newOrders.length) { toast('All orders already exist — nothing imported'); return; }

      savedOrders = [...savedOrders, ...newOrders].sort((a, b) => b.id - a.id);
      Promise.all(newOrders.map(o => saveOrderRemote(o))).catch(e => toast('Cloud sync failed: ' + e.message, 'error', 4000));
      renderOrders('');
      toast(`Imported ${newOrders.length} order${newOrders.length !== 1 ? 's' : ''}`);
    } catch (err) { toast('Import failed: ' + err.message, 'error', 4000); }
    event.target.value = '';
  };
  reader.readAsText(file);
}



function showPriceList() {
  priceListBranch = currentBranch;
  renderPriceList();
  $('pricelist-screen').style.display = 'block';
  document.body.style.overflow = 'hidden';
}
function closePriceList() { $('pricelist-screen').style.display = 'none'; document.body.style.overflow = ''; }

function setPriceBranch(branch) {
  priceListBranch = branch;
  renderPriceList();
}

/* Builds and appends a price table card into `container`.
   colHeaders: array of strings or { label, total } objects.
   rows: array of cell arrays where each cell is a string or { val, total?, bold? } object. */
function makePriceTable(container, groupTitle, colHeaders, rows) {
  const card = document.createElement('div');
  card.className = 'pl-card';
  card.innerHTML = `<div class="pl-group-title">${groupTitle}</div>`;
  const scrollWrap = document.createElement('div');
  scrollWrap.className = 'pl-scroll';
  const table = document.createElement('table');
  table.className = 'pl-table';

  const thead = document.createElement('thead');
  thead.innerHTML = `<tr>${colHeaders.map((h, i) => {
    const isTotal = h.total;
    return `<th class="pl-th${i === 0 ? ' pl-th-first' : ''}${isTotal ? ' pl-th-total' : ''}">${h.label ?? h}</th>`;
  }).join('')}</tr>`;
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  rows.forEach((cells, ri) => {
    const tr = document.createElement('tr');
    if (ri % 2 === 1) tr.classList.add('pl-row-alt');
    tr.innerHTML = cells.map((c, ci) => {
      const isTotal = typeof c === 'object' && c.total;
      const isFirst = ci === 0;
      const val     = typeof c === 'object' ? (c.val ?? '') : c;
      const bold    = typeof c === 'object' && c.bold;
      const cls     = isFirst ? 'pl-td-first' : isTotal ? 'pl-td-total' : 'pl-td';
      return `<td class="${cls}"${bold ? ' style="font-weight:700"' : ''}>${val}</td>`;
    }).join('');
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  scrollWrap.appendChild(table);
  card.appendChild(scrollWrap);
  container.appendChild(card);
}

function renderPriceList() {
  const p    = buildPrices(priceListBranch);
  const wrap = $('price-list-content');
  const mt   = (title, headers, rows) => makePriceTable(wrap, title, headers, rows);
  wrap.innerHTML = '';

  const branchRow = document.createElement('div');
  branchRow.className = 'pl-branch-row';
  const branchToggle = document.createElement('div');
  branchToggle.className = 'an-branch-toggle';
  [['badagaon','Badagaon'],['baghpat','Baghpat']].forEach(([v,l]) => {
    const btn = document.createElement('button');
    btn.className = 'an-branch-btn' + (priceListBranch === v ? ' active' : '');
    btn.textContent = l;
    btn.onclick = () => setPriceBranch(v);
    branchToggle.appendChild(btn);
  });
  branchRow.appendChild(branchToggle);
  wrap.appendChild(branchRow);

  // Baghpat has uniform pricing across Pant/Shirt/Lower/T-Shirt so a simpler table suffices
  if (priceListBranch === 'baghpat') {
    mt('Pant / Shirt / Lower / T-Shirt',
      ['Size', 'Each', { label: '(Pant+Shirt) / ...', total: true }],
      Object.entries(p['Pant']).map(([size, price]) => [
        size, pr(price), { val: pr(price * 2), total: true }
      ])
    );
  } else {
    // Badagaon: Pant and Lower have different prices at some sizes
    const allSizes = [...new Set([...Object.keys(p['Pant']), ...Object.keys(p['Lower'])])].sort((a,b) => parseInt(a)-parseInt(b));
    mt('Pant / Shirt / Lower / T-Shirt',
      ['Size', 'P..... | L.....', { label: 'Pant+Shirt', total: true }, { label: 'Lower+T-Shirt', total: true }],
      allSizes.map(size => {
        const pp = p['Pant'][size] || null;
        const lp = p['Lower'][size] || null;
        const eachLabel = pp && lp ? `${pr(pp)} | ${lp}` : pp ? pr(pp) : pr(lp);
        return [size, eachLabel, { val: pr(pp && pp * 2), total: true }, { val: pr(lp && lp * 2), total: true }];
      })
    );
  }

  mt('Half Lower / Half T-Shirt',
    ['Size', 'Each', { label: 'Half Lower + Half T-Shirt', total: true }],
    Object.keys(p['Half Lower']).map(size => {
      const l = p['Half Lower'][size] || 0;
      const t = p['Half T-Shirt'][size] || 0;
      return [size, `${pr(l)} + ${t}`, { val: pr(l + t), total: true }];
    })
  );

  mt('Full Lower / Full T-Shirt',
    ['Size', 'Each', { label: 'Full Lower + Full T-Shirt', total: true }],
    Object.keys(p['Full Lower']).map(size => {
      const l = p['Full Lower'][size] || 0;
      const t = p['Full T-Shirt'][size] || 0;
      return [size, `${pr(l)} + ${t}`, { val: pr(l + t), total: true }];
    })
  );

  mt('Blazer & Sweater',
    ['Size', { label: 'Blazer', total: true }, { label: 'Sweater', total: true }],
    Object.keys(p['Blazer']).map(size => [size, { val: pr(p['Blazer'][size]), total: true }, { val: pr(p['Sweater'][size]), total: true }])
  );

  const suitTotal = p.Suit.All + p.Trouser.All + p.Jacket.All;
  mt('Suit Set',
    ['Item', { label: 'Price', total: true }],
    [
      ['Suit',    { val: pr(p.Suit.All),    total: true }],
      ['Trouser', { val: pr(p.Trouser.All), total: true }],
      ['Jacket',  { val: pr(p.Jacket.All),  total: true }],
      [{ val: 'Set total', bold: true }, { val: pr(suitTotal), total: true, bold: true }]
    ]
  );

  mt('Accessories',
    ['Item', { label: 'Price', total: true }],
    [
      ['Tie — Small',  { val: pr(p['Tie']['Small']),      total: true }],
      ['Tie — Large',  { val: pr(p['Tie']['Large']),      total: true }],
      ['Belt',         { val: pr(p['Belt']['All']),       total: true }],
      ['Socks',        { val: pr(p['Socks']['Pair']),     total: true }],
      ['Winter Cap',   { val: pr(p['Winter Cap']['All']), total: true }]
    ]
  );
}



/* Shows default QR, then swaps to custom image if one is saved in Firestore */
function showQR() {
  const qrImg = $('qr-img');
  qrImg.src = 'GooglePay_QR.png';
  $('qr-screen').style.display = 'block';
  document.body.style.overflow = 'hidden';
  loadSettingsFromCloud().then(s => { if (s?.qrDataUrl) qrImg.src = s.qrDataUrl; });
}
function closeQR() { $('qr-screen').style.display = 'none'; document.body.style.overflow = ''; }



/* Close any open floating dropdowns/menus when clicking outside their containers */
document.addEventListener('click', e => {
  if (!e.target.closest('.header-menu-wrap')) closeHamburger();
  if (!e.target.closest('.branch-header-wrap')) closeBranchDropdown();
  if (!e.target.closest('.filter-btn-wrap'))  $('filter-dropdown')?.classList.remove('open');
  if (!e.target.closest('.menu-wrap'))        document.querySelectorAll('.menu-dropdown.open').forEach(m => m.classList.remove('open'));
});



buildStudentFields('new-student-fields', 'new');
buildItemsSection('new-items-section', 'items-container', 'add-btns-new', 'grand-total', 'Subtotal', false);
syncBranchBadge();

/* ── FIREBASE BRIDGE CALLBACKS ───────────────────────────── */

window.__firestoreUnsubscribe = null;

/* Called by the Firebase bridge after successful sign-in.
   Subscribes to Firestore orders; re-subscribes if already active. */
function startApp(user) {
  currentUserEmail = user.email;
  renderOrders('');
  if (window.__firestoreUnsubscribe) window.__firestoreUnsubscribe();
  window.__firestoreUnsubscribe = subscribeOrders(orders => {
    savedOrders = orders;
    renderOrders(getSearchValue());
  });
}