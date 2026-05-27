/* ── APP STATE ───────────────────────────────────────────── */

let currentBranch  = localStorage.getItem('uniform_branch')  || 'badagaon';
let currentSeason  = localStorage.getItem('uniform_season')  || 'summer';
let prices         = buildPrices(currentBranch, currentSeason);

let newOrderPayMode = 'pending';
let editOrderId     = null;
let itemCounter     = 0;

let dateFilter         = 'all';
let specificDateFilter = '';
let branchFilter       = 'all';
let paymentFilter      = 'all';
let deliveryFilter     = 'all';

let analyticsDate         = 'today';
let analyticsSpecificDate = '';
let analyticsBranch       = 'all';

let savedOrders = [];

let sheetTarget          = null;
let pendingDeleteId      = null;
let paySheetOrderId      = null;
let pendingPayDeleteId   = null;
let deliverySheetOrderId = null;

const sheet = { quickSetSize: null, comboType: null, comboSize: null };

let adjSign     = 1;
let priceBranch = currentBranch;

const ctx = {
  new:  { name: null, cls: null, parent: null, mobile: null, address: null, notes: null },
  edit: { name: null, cls: null, parent: null, mobile: null, address: null, notes: null }
};


/* ── UTILITIES ───────────────────────────────────────────── */

const $         = id => document.getElementById(id);
const rupees    = n  => 'Rs.' + (n || 0).toLocaleString('en-IN');

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

function loadSettings() {
  /* sync fallback — returns defaults; real data loaded async in showSettings */
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
  applySettingsToUI(loadSettings()); /* show defaults immediately */
  syncSeasonToggleUI();
  $('settings-screen').style.display = 'block';
  document.body.style.overflow = 'hidden';

  /* then load from cloud and update if signed in */
  loadSettingsFromCloud().then(s => { if (s) applySettingsToUI(s); });
}

function closeSettings() {
  $('settings-screen').style.display = 'none';
  document.body.style.overflow = '';
}

function saveSettingsForm() {
  const upiId     = ($('settings-upi-id').value     || '').trim();
  const upiNumber = ($('settings-upi-number').value || '').trim();
  const qrDataUrl = $('settings-qr-preview').src && $('settings-qr-preview').style.display !== 'none'
                    ? $('settings-qr-preview').src : '';

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
    const upiId     = ($('settings-upi-id').value     || '').trim();
    const upiNumber = ($('settings-upi-number').value || '').trim();
    saveUserSettings(currentUserEmail, { upiId, upiNumber, qrDataUrl: '' })
      .catch(e => console.warn('Could not clear QR:', e));
  }
  toast('Custom QR removed — using default');
}

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
      const upiId     = ($('settings-upi-id').value     || '').trim();
      const upiNumber = ($('settings-upi-number').value || '').trim();
      saveUserSettings(currentUserEmail, { upiId, upiNumber, qrDataUrl: dataUrl })
        .catch(e => console.warn('Could not save QR:', e));
    }
    toast('QR image saved');
  };
  reader.readAsDataURL(file);
}


/* ── SEASON ──────────────────────────────────────────────── */

function setSeason(season) {
  const ctn = $('items-container');
  if (ctn?.querySelector('.js-item-row')) {
    if (!confirm(`Switch to ${season === 'winter' ? 'Winter' : 'Summer'} season? Current items will be cleared.`)) {
      syncSeasonToggleUI();
      return;
    }
  }
  currentSeason = season;
  prices = buildPrices(currentBranch, currentSeason);
  localStorage.setItem('uniform_season', season);
  syncSeasonToggleUI();
  syncSeasonBadge();
  if (ctn) ctn.innerHTML = '';
  itemCounter = 0;
  recalcNew();
  buildAddButtons('add-btns-new', false);
  toast(`Switched to ${season === 'winter' ? '❄️ Winter' : '☀️ Summer'} season`);
}

function syncSeasonToggleUI() {
  const sumBtn = $('season-summer-btn');
  const winBtn = $('season-winter-btn');
  if (!sumBtn || !winBtn) return;
  sumBtn.classList.toggle('season-active-summer', currentSeason === 'summer');
  winBtn.classList.toggle('season-active-winter', currentSeason === 'winter');
  sumBtn.classList.toggle('season-inactive', currentSeason !== 'summer');
  winBtn.classList.toggle('season-inactive', currentSeason !== 'winter');
}

function syncSeasonBadge() {
  const badge = $('season-header-badge');
  if (!badge) return;
  if (currentSeason === 'winter') {
    badge.textContent      = '❄️ Winter';
    badge.style.background = '#dbeafe';
    badge.style.color      = '#1e3a8a';
    badge.style.border     = '1.5px solid #93c5fd';
  } else {
    badge.textContent      = '☀️ Summer';
    badge.style.background = '#fef3c7';
    badge.style.color      = '#92400e';
    badge.style.border     = '1.5px solid #fde68a';
  }
}


/* ── FORM HELPERS ────────────────────────────────────────── */

function buildStudentFields(containerId, ctxKey) {
  const wrap = $(containerId);
  wrap.innerHTML = '';
  wrap.appendChild(cloneTemplate('tpl-student-fields'));

  ctx[ctxKey].name    = wrap.querySelector('.sf-name');
  ctx[ctxKey].cls     = wrap.querySelector('.sf-class');
  ctx[ctxKey].parent  = wrap.querySelector('.sf-parent');
  ctx[ctxKey].mobile  = wrap.querySelector('.sf-mobile');
  ctx[ctxKey].address = wrap.querySelector('.sf-address');
  ctx[ctxKey].notes   = wrap.querySelector('.sf-notes');

  const pill  = wrap.querySelector('.sf-expand-pill');
  const extra = wrap.querySelector('.sf-extra');

  pill.addEventListener('click', () => {
    const isOpen = extra.style.display !== 'none';
    extra.style.display = isOpen ? 'none' : 'block';
    pill.setAttribute('aria-expanded', String(!isOpen));
  });

  ctx[ctxKey]._expandExtra = () => {
    if ((ctx[ctxKey].address?.value || '').trim() || (ctx[ctxKey].notes?.value || '').trim()) {
      extra.style.display = 'block';
      pill.setAttribute('aria-expanded', 'true');
    }
  };

  const coreFields = [ctx[ctxKey].name, ctx[ctxKey].cls, ctx[ctxKey].parent, ctx[ctxKey].mobile];
  const allFields  = [...coreFields, ctx[ctxKey].address, ctx[ctxKey].notes];

  allFields.forEach((field, i) => {
    if (!field) return;
    field.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (i === coreFields.length - 1 && extra.style.display === 'none') {
        extra.style.display = 'block';
        pill.setAttribute('aria-expanded', 'true');
        ctx[ctxKey].address?.focus();
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
  const c = ctx[ctxKey];
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
  const c = ctx[ctxKey];
  if (c.name)    c.name.value    = order.studentName  || '';
  if (c.cls)     c.cls.value     = order.studentClass || '';
  if (c.parent)  c.parent.value  = order.parentName   || '';
  if (c.mobile)  c.mobile.value  = order.mobile       || '';
  if (c.address) c.address.value = order.address      || '';
  if (c.notes)   c.notes.value   = order.notes        || '';
  if (c._expandExtra) c._expandExtra();
}

function clearStudentFields(ctxKey) {
  const c = ctx[ctxKey];
  ['name', 'cls', 'parent', 'mobile', 'address', 'notes'].forEach(k => { if (c[k]) c[k].value = ''; });
}


/* ── DELIVERY HELPERS ────────────────────────────────────── */

function buildDeliveryUnits(items) {
  const units = [];
  let seq = 0;
  (items || []).forEach(item => {
    if (item.itemType === 'adjustment') return;
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

function ensureDeliveryUnits(order) { return order.deliveryUnits || []; }
function pendingItemCount(order)    { return ensureDeliveryUnits(order).filter(u => !u.given).length; }


/* ── PAYMENT HELPERS ─────────────────────────────────────── */

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


/* ── HEADER / TABS / BRANCH / SEASON UI ─────────────────── */

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

function setBranch(branch) {
  const ctn = $('items-container');
  if (ctn?.querySelector('.js-item-row')) {
    if (!confirm(`Switch to ${BRANCH_LABEL[branch]}? Current items will be cleared.`)) {
      closeBranchDropdown();
      return;
    }
  }
  currentBranch = branch;
  prices = buildPrices(currentBranch, currentSeason);
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
  if (row) row.style.display = mode !== 'pending' ? 'grid' : 'none';
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


/* ── ADD BUTTONS & BOTTOM SHEETS ────────────────────────── */

function buildAddButtons(containerId, isEdit) {
  const t    = isEdit ? 'edit' : 'new';
  const wrap = $(containerId);
  if (!wrap) return;
  wrap.innerHTML = '';

  const season = isEdit ? (editOrderId ? (savedOrders.find(o => o.id === editOrderId)?.season || currentSeason) : currentSeason) : currentSeason;

  const btn = (cls, text, handler) => {
    const b = document.createElement('button');
    b.className = cls; b.textContent = text; b.onclick = handler;
    wrap.appendChild(b);
  };

  btn('add-btn combo', 'Pant + Shirt',             () => openComboSheet(t, 'pant-shirt'));
  btn('add-btn combo', 'Lower + T-Shirt',          () => openComboSheet(t, 'lower-tshirt'));

  if (season === 'summer') {
    btn('add-btn combo', 'Half Lower + T-Shirt', () => openComboSheet(t, 'half-lower-tshirt'));
  } else {
    btn('add-btn combo', 'Full Lower + T-Shirt', () => openComboSheet(t, 'full-lower-tshirt'));
  }

  btn('add-btn combo',      'Suit Set',            () => openComboSheet(t, 'suit-set'));
  btn('add-btn',            '+ Single Item',        () => openSingleItemSheet(t));
  btn('add-btn adjustment', '± Adjust',             () => openAdjSheet(t));
  btn('add-btn quickset',   '✦ Complete Uniform',   () => openQuickSetSheet(t));
}

function openSheet(id)  { $(id).classList.add('open'); }
function closeSheet(id, event) {
  if (event && event.target !== $(id)) return;
  $(id).classList.remove('open');
}

function sheetCtx(target) {
  const e = target === 'edit';
  return { ctr: e ? 'edit-items-container' : 'items-container', pfx: e ? 'e' : 'n', fn: e ? 'recalcEdit' : 'recalcNew' };
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

function openQuickSetSheet(target) {
  sheetTarget = target;
  const sizes = [26, 28, 30, 32, 34, 36, 38, 40, 42, 44];
  sheet.quickSetSize = String(sizes[0]);
  buildChips('qs-sizes', sizes, sheet.quickSetSize,
    (v, el) => { sheet.quickSetSize = selectChip('qs-sizes', v, el); updateQSPrice(); });
  $('qs-qty').textContent = '1';
  updateQSPrice();
  openSheet('qs-modal');
}

function confirmQuickSet() {
  closeSheet('qs-modal');
  const { ctr, pfx, fn } = sheetCtx(sheetTarget);
  const size = String(sheet.quickSetSize);
  const qty  = parseInt($('qs-qty').textContent);
  _addCombo(ctr, pfx, fn, 'pant-shirt',   size, size, qty);
  _addCombo(ctr, pfx, fn, 'lower-tshirt', size, size, qty);
  _addItem (ctr, pfx, fn, 'Tie',   parseInt(size) >= 34 ? 'Large' : 'Small', qty);
  _addItem (ctr, pfx, fn, 'Belt',  'All',  qty);
  _addItem (ctr, pfx, fn, 'Socks', 'Pair', qty * 2);
}

function updateQSPrice() {
  const el   = $('qs-price-preview');
  if (!el) return;
  const size = sheet.quickSetSize;
  const qty  = parseInt($('qs-qty').textContent) || 1;
  if (!size) { el.textContent = ''; return; }

  const p       = prices;
  const lookup  = (item, sz) => p[item]?.[sz] || p[item]?.[parseInt(sz)] || 0;
  const tieSize = parseInt(size) >= 34 ? 'Large' : 'Small';
  const unit    = lookup('Pant', size) + lookup('Shirt', size) + lookup('Lower', size) + lookup('T-Shirt', size)
             + lookup('Tie', tieSize) + (p['Belt']?.['All'] || 0) + (p['Socks']?.['Pair'] || 0) * 2;
  el.textContent = unit ? rupees(unit * qty) : '';
}

/* Single Item sheet */
const SI_ACCESSORIES = [
  { item: 'Tie',        size: 'Small'  },
  { item: 'Tie',        size: 'Large'  },
  { item: 'Belt',       size: 'All'    },
  { item: 'Socks',      size: 'Pair'   },
  { item: 'Winter Cap', size: 'All', winterOnly: true }
];

function getSiSizedOrder(season) {
  const winter = season === 'winter' ? ['Blazer','Sweater'] : [];
  return [
    ...winter,
    'Pant','Shirt','Lower','T-Shirt',
    'Half Lower','Half T-Shirt',
    'Full Lower','Full T-Shirt',
    'Suit','Trouser','Jacket'
  ];
}

let siSelections = {};

function siKey(item, size) { return `${item}|${size}`; }

function siGetCtx(target) {
  if (target === 'edit' && editOrderId) {
    const ord = savedOrders.find(o => o.id === editOrderId);
    return { p: buildPrices(ord?.branch || currentBranch, ord?.season || currentSeason), season: ord?.season || currentSeason };
  }
  return { p: prices, season: currentSeason };
}

function openSingleItemSheet(target) {
  sheetTarget  = target;
  siSelections = {};
  const { p, season } = siGetCtx(target);

  const accCtn = $('si-accessories');
  accCtn.innerHTML = '';
  SI_ACCESSORIES.forEach(({ item, size, winterOnly }) => {
    if (winterOnly && season !== 'winter') return;
    if (!p[item]?.[size]) return;
    const price  = p[item][size];
    const key    = siKey(item, size);
    const safeId = key.replace('|', '-');

    const row = document.createElement('div');
    row.className   = 'si-acc-row';
    row.dataset.key = key;
    row.innerHTML   = `
      <div class="si-acc-left">
        <div class="si-acc-check">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <polyline points="2,6 5,9 10,3" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <span class="si-acc-name">${size === 'All' || size === 'Pair' ? item : item + ' — ' + size}</span>
        <span class="si-acc-price">Rs.${price}</span>
      </div>
      <div class="si-acc-stepper-wrap si-row-stepper">
        <button onclick="siAccStep('${key}',-1,event)">−</button>
        <span id="si-acc-qty-${safeId}">1</span>
        <button onclick="siAccStep('${key}',1,event)">+</button>
      </div>`;

    row.addEventListener('click', e => {
      if (e.target.closest('.si-row-stepper')) return;
      siToggleAcc(key, item, size, price, row);
    });
    accCtn.appendChild(row);
  });

  const sizedCtn = $('si-sized');
  sizedCtn.innerHTML = '';

  getSiSizedOrder(season).forEach(itemName => {
    if (!p[itemName]) return;
    if (WINTER_ONLY_ITEMS.has(itemName) && season !== 'winter') return;

    const sizes = Object.entries(p[itemName]);

    if (sizes.length === 1) {
      const [size, price] = sizes[0];
      const key    = siKey(itemName, size);
      const safeId = key.replace('|', '-');
      const row    = document.createElement('div');
      row.className   = 'si-acc-row';
      row.dataset.key = key;
      row.innerHTML   = `
        <div class="si-acc-left">
          <div class="si-acc-check">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <polyline points="2,6 5,9 10,3" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <span class="si-acc-name">${itemName}</span>
          <span class="si-acc-price">Rs.${price}</span>
        </div>
        <div class="si-acc-stepper-wrap si-row-stepper">
          <button onclick="siAccStep('${key}',-1,event)">−</button>
          <span id="si-acc-qty-${safeId}">1</span>
          <button onclick="siAccStep('${key}',1,event)">+</button>
        </div>`;
      row.addEventListener('click', e => {
        if (e.target.closest('.si-row-stepper')) return;
        siToggleAcc(key, itemName, size, price, row);
      });
      sizedCtn.appendChild(row);
      return;
    }

    const wrap = document.createElement('div');
    wrap.className    = 'si-sized-row';
    wrap.dataset.item = itemName;

    const header = document.createElement('div');
    header.className = 'si-sized-header';
    header.innerHTML = `
      <span class="si-sized-name">${itemName}</span>
      <div class="si-sized-right">
        <span class="si-sized-sel-price" id="si-sized-price-${itemName}"></span>
        <div class="si-sized-stepper-wrap si-row-stepper">
          <button onclick="siSizedStep('${itemName}',-1,event)">−</button>
          <span id="si-sized-qty-${itemName}">1</span>
          <button onclick="siSizedStep('${itemName}',1,event)">+</button>
        </div>
      </div>`;

    const sizesWrap = document.createElement('div');
    sizesWrap.className = 'si-sized-sizes';

    sizes.forEach(([size, price]) => {
      const chip = document.createElement('div');
      chip.className    = 'si-size-chip';
      chip.textContent  = size;
      chip.dataset.size = size;
      chip.addEventListener('click', () => siToggleSized(itemName, size, price, chip, wrap));
      sizesWrap.appendChild(chip);
    });

    wrap.appendChild(header);
    wrap.appendChild(sizesWrap);
    sizedCtn.appendChild(wrap);
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

function siToggleSized(itemName, size, price, chip, wrap) {
  const key     = siKey(itemName, size);
  const prevKey = Object.keys(siSelections).find(k => k.startsWith(itemName + '|'));

  if (prevKey) {
    delete siSelections[prevKey];
    wrap.querySelectorAll('.si-size-chip').forEach(c => c.classList.remove('selected'));
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

function siUpdateConfirmBar() {
  const bar      = $('si-confirm-bar');
  const sumEl    = $('si-confirm-summary');
  const priceEl  = $('si-price-preview');
  const items    = Object.values(siSelections);
  if (!items.length) { bar.classList.remove('visible'); return; }
  bar.classList.add('visible');
  sumEl.textContent = items.map(({ item, size, qty }) => {
    const label = (size === 'All' || size === 'Pair') ? item : `${item} (${size})`;
    return qty > 1 ? `${label} ×${qty}` : label;
  }).join(', ');
  const total = items.reduce((s, { price, qty }) => s + price * qty, 0);
  if (priceEl) priceEl.textContent = total ? rupees(total) : '';
}

function confirmSingleItem() {
  const items = Object.values(siSelections);
  if (!items.length) { toast('Select at least one item', 'error'); return; }
  closeSheet('si-modal');
  const { ctr, pfx, fn } = sheetCtx(sheetTarget);
  items.forEach(({ item, size, qty }) => _addItem(ctr, pfx, fn, item, size, qty));
}

/* Combo sheet */
function openComboSheet(target, type) {
  sheetTarget = target; sheet.comboType = type; sheet.comboSize = null;
  $('co-qty').textContent = '1';

  let ctxPrices = prices;
  if (target === 'edit' && editOrderId) {
    const ord = savedOrders.find(o => o.id === editOrderId);
    ctxPrices = buildPrices(ord?.branch || currentBranch, ord?.season || currentSeason);
  }

  if (type === 'suit-set') {
    const unit = ctxPrices.Suit.All + ctxPrices.Trouser.All + ctxPrices.Jacket.All;
    $('co-title').textContent         = 'Suit Set';
    $('co-sub').textContent           = `Suit + Trouser + Jacket = ${rupees(unit)} each`;
    $('co-label1').textContent        = '';
    $('co-sizes1').innerHTML          = '';
    $('co-price-preview').textContent = '';
  } else {
    const cfg   = COMBOS[type];
    const sizes = Object.keys(ctxPrices[cfg.item1] || {});
    $('co-title').textContent  = cfg.label;
    $('co-sub').textContent    = 'Both items use the same size';
    $('co-label1').textContent = 'Select size';
    sheet.comboSize = String(sizes[0]);
    buildChips('co-sizes1', sizes, sheet.comboSize,
      (v, el) => { sheet.comboSize = selectChip('co-sizes1', v, el); updateComboPrice(type, v, ctxPrices); });
    updateComboPrice(type, sheet.comboSize, ctxPrices);
  }
  openSheet('co-modal');
}

function updateComboPrice(type, size, p) {
  const el = $('co-price-preview');
  if (!el) return;
  const cfg = COMBOS[type];
  if (!cfg) { el.textContent = ''; return; }
  const p1    = p[cfg.item1]?.[size] || p[cfg.item1]?.[parseInt(size)] || 0;
  const p2    = p[cfg.item2]?.[size] || p[cfg.item2]?.[parseInt(size)] || 0;
  const unit  = p1 + p2;
  const qty   = parseInt($('co-qty').textContent) || 1;
  el.dataset.unit = unit;
  el.textContent  = unit ? rupees(unit * qty) : '';
}

function updateComboQtyPrice() {
  const el   = $('co-price-preview');
  if (!el) return;
  const unit = parseFloat(el.dataset.unit) || 0;
  const qty  = parseInt($('co-qty').textContent) || 1;
  el.textContent = unit ? rupees(unit * qty) : '';
}

function confirmCombo() {
  const { ctr, pfx, fn } = sheetCtx(sheetTarget);
  const qty = parseInt($('co-qty').textContent);
  if (sheet.comboType === 'suit-set') { closeSheet('co-modal'); _addCombo(ctr, pfx, fn, 'suit-set', null, null, qty); return; }
  if (!sheet.comboSize) { toast('Select a size first', 'error'); return; }
  closeSheet('co-modal');
  _addCombo(ctr, pfx, fn, sheet.comboType, sheet.comboSize, sheet.comboSize, qty);
}

/* Adjustment sheet */
function openAdjSheet(target) {
  sheetTarget = target;
  adjSign = 1;
  $('adj-plus').className  = 'adj-sign-btn plus-active';
  $('adj-minus').className = 'adj-sign-btn';
  $('adj-amount').value = '';
  $('adj-note').value   = '';
  openSheet('adj-modal');
}

function setAdjSign(sign) {
  adjSign = sign;
  $('adj-plus').className  = 'adj-sign-btn' + (sign ===  1 ? ' plus-active'  : '');
  $('adj-minus').className = 'adj-sign-btn' + (sign === -1 ? ' minus-active' : '');
}

function confirmAdj() {
  const rawAmt = parseFloat($('adj-amount').value);
  if (!rawAmt || rawAmt <= 0) { toast('Enter a positive amount', 'error'); return; }
  const note = ($('adj-note').value || '').trim();
  closeSheet('adj-modal');
  const { ctr, pfx, fn } = sheetCtx(sheetTarget);
  _addAdjustment(ctr, pfx, fn, adjSign, rawAmt, note);
}


/* ── ITEM ROWS ───────────────────────────────────────────── */

function _addItem(containerId, prefix, recalcFn, defaultItem, defaultSize, defaultQty, pricesObj) {
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

  itemSel.addEventListener('change', () => { sizeSel.innerHTML = ''; sizeSel.appendChild(buildSizeOptions(itemSel.value, null, p)); window[recalcFn](); });
  sizeSel.addEventListener('change', () => window[recalcFn]());
  qtyIn.addEventListener('input',    () => window[recalcFn]());
  remBtn.addEventListener('click',   () => { row.remove(); window[recalcFn](); });

  $(containerId).appendChild(row);
  window[recalcFn]();
}

function _addCombo(containerId, prefix, recalcFn, type, defaultSize1, defaultSize2, defaultQty, pricesObj) {
  itemCounter++;
  const id  = prefix + itemCounter;
  const qty = defaultQty || 1;
  const p   = pricesObj || prices;

  if (type === 'suit-set') {
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
    size1.id = 's1-'  + id; size2.id = 's2-'   + id;
    qtyIn.value = qty;
    size1.appendChild(buildSizeOptions(cfg.item1, defaultSize1, p));
    size2.appendChild(buildSizeOptions(cfg.item2, defaultSize2 || defaultSize1, p));
    const recalc = () => window[recalcFn]();
    qtyIn.addEventListener('input',  recalc);
    size1.addEventListener('change', recalc);
    size2.addEventListener('change', recalc);
    row.querySelector('.cr-remove').addEventListener('click',  () => { row.remove(); recalc(); });
    row.querySelector('.cr-remove1').addEventListener('click', () => { subRow1.remove(); if (!row.querySelectorAll('.combo-item-row').length) row.remove(); recalc(); });
    row.querySelector('.cr-remove2').addEventListener('click', () => { subRow2.remove(); if (!row.querySelectorAll('.combo-item-row').length) row.remove(); recalc(); });
    $(containerId).appendChild(row);
  }
  window[recalcFn]();
}

function _addAdjustment(containerId, prefix, recalcFn, sign, amount, note) {
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

  remBtn.addEventListener('click', () => { row.remove(); window[recalcFn](); });

  $(containerId).appendChild(row);
  window[recalcFn]();
}

function _recalc(containerId, totalId, pricesObj) {
  const p = pricesObj || prices;
  let subtotal = 0;
  $(containerId)?.querySelectorAll('.js-item-row').forEach(row => {
    const id   = row.id.replace('item-', '');
    const type = row.dataset.type;

    if (type === 'adjustment') {
      subtotal += parseFloat(row.dataset.adjLineTotal) || 0;
      return;
    }

    const qtyEl   = $('qty-'   + id);
    const priceEl = $('price-' + id);
    if (!qtyEl || !priceEl) return;
    const qty = parseInt(qtyEl.value) || 1;
    let unit = 0;

    if (type === 'single') {
      const is = $('isel-' + id), ss = $('ssel-' + id);
      if (!is) return;
      unit = p[is.value]?.[ss.value] || p[is.value]?.[parseInt(ss.value)] || 0;
    } else if (type === 'suit-set') {
      unit = p.Suit.All + p.Trouser.All + p.Jacket.All;
    } else if (type === 'combo') {
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
  _recalc('items-container', 'grand-total', prices);
  const btn = document.querySelector('#tab-new .clear-items-btn');
  if (btn) btn.style.display = document.getElementById('items-container')?.querySelector('.js-item-row') ? 'block' : 'none';
}

function recalcEdit() {
  const order = editOrderId ? savedOrders.find(o => o.id === editOrderId) : null;
  _recalc('edit-items-container', 'eo-grand-total', buildPrices(order?.branch || 'badagaon', order?.season || currentSeason));
  const btn = document.querySelector('#edit-order-screen .clear-items-btn');
  if (btn) btn.style.display = document.getElementById('edit-items-container')?.querySelector('.js-item-row') ? 'block' : 'none';
}

function collectItems(containerId, pricesObj) {
  const p = pricesObj || prices;
  const items = [];
  let subtotal = 0;
  $(containerId)?.querySelectorAll('.js-item-row').forEach(row => {
    const id   = row.id.replace('item-', '');
    const type = row.dataset.type;

    if (type === 'adjustment') {
      const lineTotal = parseFloat(row.dataset.adjLineTotal) || 0;
      const sign      = lineTotal >= 0 ? 1 : -1;
      const absAmt    = Math.abs(lineTotal);
      const note      = row.querySelector('.ar-note')?.textContent || '';
      const label     = note
        ? `${note} (${sign === 1 ? '+' : '−'}Rs.${absAmt.toLocaleString('en-IN')})`
        : (sign === 1 ? '+ Charge' : '− Refund') + ` Rs.${absAmt.toLocaleString('en-IN')}`;
      subtotal += lineTotal;
      items.push({ label, lineTotal, qty: 1, unit: lineTotal, itemType: 'adjustment', sign, amount: absAmt, note });
      return;
    }

    const qty  = parseInt($('qty-' + id)?.value) || 1;
    let unit = 0, label = '', extra = {};

    if (type === 'single') {
      const is = $('isel-' + id), ss = $('ssel-' + id);
      if (!is) return;
      unit  = p[is.value]?.[ss.value] || p[is.value]?.[parseInt(ss.value)] || 0;
      label = `${is.value} (${ss.value})${qty > 1 ? ' x ' + qty : ''}`;
      extra = { itemType: 'single', itemName: is.value, itemSize: ss.value };
    } else if (type === 'suit-set') {
      unit  = p.Suit.All + p.Trouser.All + p.Jacket.All;
      label = `Suit Set (Suit + Trouser + Jacket)${qty > 1 ? ' x ' + qty : ''}`;
      extra = { itemType: 'suit-set' };
    } else if (type === 'combo') {
      const s1 = $('s1-' + id), s2 = $('s2-' + id);
      if (!s1 && !s2) return;
      const n1 = row.dataset.item1, n2 = row.dataset.item2;
      if (s1) unit += p[n1]?.[s1.value] || p[n1]?.[parseInt(s1.value)] || 0;
      if (s2) unit += p[n2]?.[s2.value] || p[n2]?.[parseInt(s2.value)] || 0;
      const parts = [];
      if (s1) parts.push(`${n1} (${s1.value})`);
      if (s2) parts.push(`${n2} (${s2.value})`);
      label = parts.join(' + ') + (qty > 1 ? ' x ' + qty : '');
      extra = { itemType: 'combo', item1Name: s1 ? n1 : null, item1Size: s1 ? s1.value : null, item2Name: s2 ? n2 : null, item2Size: s2 ? s2.value : null };
    }

    subtotal += unit * qty;
    items.push({ label, lineTotal: unit * qty, qty, unit, ...extra });
  });
  return { items, subtotal };
}


/* ── SAVE & RESET ────────────────────────────────────────── */

function saveOrder() {
  const fields = readStudentFields('new');
  if (!fields.studentName) { toast('Please enter student name', 'error'); return; }
  if (!$('items-container')?.querySelector('.js-item-row')) { toast('Please add at least one item', 'error'); return; }
  if (fields.mobile && !/^[0-9+\s\-]{7,15}$/.test(fields.mobile)) { toast('Mobile number looks incorrect', 'error'); return; }

  const { items, subtotal } = collectItems('items-container');

  const newDiscount = parseFloat($('new-discount')?.value) || 0;
  let payments = [];
  if (newOrderPayMode !== 'pending') {
    const raw   = $('paid-amt')?.value.trim();
    let paidAmt = raw !== '' ? parseFloat(raw) : Math.max(0, subtotal - newDiscount);
    paidAmt     = Math.min(Math.max(0, paidAmt), subtotal);
    if (paidAmt > 0)
      payments = [{ mode: newOrderPayMode, amount: paidAmt, date: new Date().toLocaleDateString('en-IN') }];
  }

  const newOrder = {
    id: Date.now(), uuid: generateUUID(), branch: currentBranch, season: currentSeason, ...fields,
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
  setNewOrderPayMode('pending');
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


/* ── ANALYTICS ───────────────────────────────────────────── */

function setAnalyticsDate(v) { analyticsDate = v; renderAnalytics(); refreshBalPanel(); }
function setAnalyticsBranch(v) { analyticsBranch = v; renderAnalytics(); refreshBalPanel(); }
function setAnalyticsSpecificDate(v) { analyticsSpecificDate = v; renderAnalytics(); refreshBalPanel(); }

function refreshBalPanel() {
  const panel = $('bal-history-panel');
  if (panel && panel.style.display !== 'none') renderBalHistoryPanel(panel);
}

function renderAnalytics() {
  function parseDate(str) { const p = (str || '').split('/'); return new Date(p[2], p[1] - 1, p[0]); }
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
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

  const orders = analyticsBranch === 'all' ? base : base.filter(o => o.branch === analyticsBranch);
  const trueValue = o => (o.subtotal || 0) - totalDiscount(o);

  let cashAmt = 0, onlineAmt = 0, balanceAmt = 0, cashOrders = 0, onlineOrders = 0;
  orders.forEach(o => {
    const outstanding = trueValue(o) - totalCollected(o);
    if (outstanding > 0) balanceAmt += outstanding;
    getPayments(o).forEach(p => {
      if (p.mode === 'cash')   cashAmt   += p.amount || 0;
      if (p.mode === 'online') onlineAmt += p.amount || 0;
    });
    const s = paymentStatus(o);
    if (s === 'cash')   cashOrders++;
    if (s === 'online') onlineOrders++;
  });

  const collected         = cashAmt + onlineAmt;
  const totalRevenue      = orders.reduce((s, o) => s + trueValue(o), 0);
  const ordersWithBalance = orders.filter(o => balanceDue(o) > 0);
  const ordersWithPayment = orders.filter(o => totalCollected(o) > 0);
  const badagaon          = orders.filter(o => o.branch === 'badagaon');
  const baghpat           = orders.filter(o => o.branch === 'baghpat');
  const sumC              = arr => arr.reduce((s, o) => s + totalCollected(o), 0);

  const wrap = $('analytics-content');
  wrap.innerHTML = '';

  /* ── FILTER UI ────────────────────────────────────────── */
  const filterWrap = document.createElement('div');
  filterWrap.className = 'an-filter-wrap';

  const branchRow = document.createElement('div');
  branchRow.className = 'an-branch-row';
  const branchToggle = document.createElement('div');
  branchToggle.className = 'an-branch-toggle';
  [['all','All'],['badagaon','Badagaon'],['baghpat','Baghpat']].forEach(([v,l]) => {
    const btn = document.createElement('button');
    btn.className = 'an-branch-btn' + (analyticsBranch === v ? ' active' : '');
    btn.textContent = l;
    btn.onclick = () => setAnalyticsBranch(v);
    branchToggle.appendChild(btn);
  });
  branchRow.appendChild(branchToggle);
  filterWrap.appendChild(branchRow);

  const chipsRow = document.createElement('div');
  chipsRow.className = 'an-chips-row';
  [['today','Today'],['week','This week'],['all','All time'],['specific','Specific Date ↓']].forEach(([v,l]) => {
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
    const dpRow = document.createElement('div');
    dpRow.className = 'an-dp-row';
    const dpInp = document.createElement('input');
    dpInp.type = 'date'; dpInp.className = 'an-date-input';
    dpInp.style.colorScheme = 'light';
    dpInp.value = analyticsSpecificDate;
    dpInp.addEventListener('change', e => setAnalyticsSpecificDate(e.target.value));
    dpRow.appendChild(dpInp);
    filterWrap.appendChild(dpRow);
  }

  wrap.appendChild(filterWrap);

  /* ── METRICS ──────────────────────────────────────────── */
  const metricsWrap = document.createElement('div');
  metricsWrap.className = 'an-metrics-wrap';

  const revCard = document.createElement('div');
  revCard.className = 'an-metric an-metric-full';
  revCard.innerHTML = `
    <div class="an-metric-label">Total revenue</div>
    <div class="an-metric-val">${rupees(totalRevenue)}</div>
    <div class="an-metric-sub">${orders.length} order${orders.length !== 1 ? 's' : ''}</div>`;
  metricsWrap.appendChild(revCard);

  const collCard = document.createElement('div');
  collCard.className = 'an-metric an-metric-green';
  collCard.innerHTML = `
    <div class="an-metric-label">Collected</div>
    <div class="an-metric-val">${rupees(collected)}</div>
    <div class="an-metric-sub">${ordersWithPayment.length} order${ordersWithPayment.length !== 1 ? 's' : ''}</div>`;
  metricsWrap.appendChild(collCard);

  const balCard = document.createElement('div');
  balCard.className = 'an-metric an-metric-amber';
  balCard.innerHTML = `
    <div class="an-metric-label">Balance due</div>
    <div class="an-metric-val">${rupees(balanceAmt)}</div>
    <div class="an-metric-sub">${ordersWithBalance.length} order${ordersWithBalance.length !== 1 ? 's' : ''}</div>`;
  metricsWrap.appendChild(balCard);

  wrap.appendChild(metricsWrap);

  const modeCard = makeAnSection('By payment mode');
  makeAnRow2(modeCard, '#059669', 'Cash',   cashOrders,   cashAmt);
  makeAnRow2(modeCard, '#2563eb', 'Online', onlineOrders, onlineAmt);
  wrap.appendChild(modeCard);

  if (analyticsBranch === 'all') {
    const branchCard = makeAnSection('By branch');
    makeAnRow2(branchCard, '#059669', 'Badagaon', badagaon.length, sumC(badagaon));
    makeAnRow2(branchCard, '#2563eb', 'Baghpat',  baghpat.length,  sumC(baghpat));
    wrap.appendChild(branchCard);
  }

  /* ── BALANCE PAYMENT HISTORY ────────────── */
  const balHistoryWrap = document.createElement('div');
  balHistoryWrap.id = 'bal-history-wrap';

  const balHistoryBtn = document.createElement('button');
  balHistoryBtn.className = 'an-bal-history-btn';
  balHistoryBtn.id = 'bal-history-toggle';
  balHistoryBtn.innerHTML = 'Due Payments History <span id="bal-history-arrow">▼</span>';
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

function renderBalHistoryPanel(panel) {
  function parseDate(str) { const p = (str || '').split('/'); return new Date(p[2], p[1] - 1, p[0]); }
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

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
      if (p.date === o.date) return;
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
  const cashTotal  = entries.filter(e => e.mode === 'cash').reduce((s, e) => s + e.amount, 0);
  const onlineTotal= entries.filter(e => e.mode === 'online').reduce((s, e) => s + e.amount, 0);

  const totalLine = document.createElement('div');
  totalLine.className = 'an-bal-total-line';
  totalLine.innerHTML = `${rupees(total)} · ${entries.length} payment${entries.length !== 1 ? 's' : ''}
    <span class="an-bal-mode" style="color:#059669">Cash ${rupees(cashTotal)}</span>
    <span class="an-bal-mode" style="color:#2563eb">Online ${rupees(onlineTotal)}</span>`;
  panel.appendChild(totalLine);

  /* entries list */
  const listCard = makeAnSection('');
  entries.forEach(e => {
    const modeColor = e.mode === 'cash' ? '#059669' : '#2563eb';
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

function makeAnRow2(container, dotColor, label, count, amt) {
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


/* ── FILTERS ─────────────────────────────────────────────── */

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

function parseOrderDate(str) {
  const p = (str || '').split('/');
  return new Date(p[2], p[1] - 1, p[0]);
}

function matchesFilter(order) {
  if (paymentFilter === 'pending') {
    if (order.subtotal <= 0) return false;
    const s = paymentStatus(order);
    if (s !== 'pending' && s !== 'partial') return false;
  }
  if (paymentFilter === 'refund') { if (order.subtotal > 0) return false; }
  if (deliveryFilter === 'pending-delivery' && pendingItemCount(order) === 0) return false;
  if (branchFilter !== 'all' && order.branch !== branchFilter) return false;
  if (dateFilter === 'all') return true;
  const d     = parseOrderDate(order.date);
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (dateFilter === 'today') return d.getTime() === today.getTime();
  if (dateFilter === 'week')  { const w = new Date(today); w.setDate(today.getDate() - 6); return d >= w && d <= today; }
  if (dateFilter === 'specific') {
    if (!specificDateFilter) return true;
    const [y, m, day] = specificDateFilter.split('-').map(Number);
    return d.getTime() === new Date(y, m - 1, day).getTime();
  }
  return true;
}


/* ── RENDER ORDERS LIST ──────────────────────────────────── */

function renderOrders(query) {
  query = (query || '').toLowerCase();

  const filtered = savedOrders.filter(o => {
    if (!matchesFilter(o)) return false;
    return (o.studentName||'').toLowerCase().includes(query) || (o.studentClass||'').toLowerCase().includes(query) ||
           (o.parentName||'').toLowerCase().includes(query)  || (o.mobile||'').includes(query)                    ||
           (o.address||'').toLowerCase().includes(query)     || (o.notes||'').toLowerCase().includes(query);
  });

  const now = new Date(), today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const pendingAll   = savedOrders.filter(o => o.subtotal > 0 && (balanceDue(o) > 0 || paymentStatus(o) === 'pending'));
  const pendingTdy   = pendingAll.filter(o => { const p = (o.date||'').split('/'); return new Date(p[2],p[1]-1,p[0]).getTime() === today.getTime(); });
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
    banner.onclick = () => { $('orders-search').value=''; if($('orders-search-clear'))$('orders-search-clear').style.display='none'; setPaymentFilter('pending'); };
  } else { banner.style.display = 'none'; }

  const bannersRow = $('banners-row');
  if (bannersRow) bannersRow.style.display = (pendingAll.length || pendDelivAll.length) ? 'flex' : 'none';

  const totalSub = filtered.reduce((s, o) => s + (o.subtotal||0), 0);
  const totalCol = filtered.reduce((s, o) => s + totalCollected(o), 0);
  $('orders-summary').textContent = `${filtered.length} order${filtered.length!==1?'s':''} — Total: ${rupees(totalSub)} | Collected: ${rupees(totalCol)}`;

  const list = $('orders-list');
  list.innerHTML = '';

  if (!filtered.length) {
    const empty = document.createElement('div');
    empty.className = 'empty'; empty.textContent = 'No orders found';
    list.appendChild(empty); return;
  }

  const STATUS_LABEL     = { cash: 'Cash', online: 'Online', split: 'Split', partial: 'Partial', pending: 'Pending', refund: 'Refund' };
  const BRANCH_DOT_COLOR = { badagaon: '#059669', baghpat: '#2563eb' };

  filtered.forEach(o => {
    const status    = o.subtotal <= 0 ? 'refund' : paymentStatus(o);
    const payments  = getPayments(o);
    const pendCount = pendingItemCount(o);

    const card = cloneTemplate('tpl-order-card');
    card.id    = 'card-' + o.id;

    const strip = document.createElement('div');
    strip.className = 'card-meta-strip';
    const dotColor = BRANCH_DOT_COLOR[o.branch] || '#94a3b8';
    const seasonIcon = o.season === 'winter' ? ' ❄️' : '';
    strip.innerHTML =
      `<span>${o.date}</span>` +
      `<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:var(--text-3)">` +
        `<span style="width:7px;height:7px;border-radius:50%;background:${dotColor};display:inline-block;flex-shrink:0"></span>` +
        `${BRANCH_LABEL[o.branch]}${seasonIcon}` +
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
    statusBadge.textContent = STATUS_LABEL[status]; statusBadge.classList.add(status);
    card.querySelector('.oc-branch-badge')?.remove();

    if (pendCount > 0) {
      const dvBadge = card.querySelector('.oc-delivery-badge');
      card.querySelector('.oc-delivery-text').textContent = `${pendCount} not delivered`;
      dvBadge.style.display = 'inline-flex';
      dvBadge.onclick = () => openDeliverySheet(o.id);
    }

    const qpBtn = card.querySelector('.oc-quick-pay');
    if (status !== 'refund' && (status === 'pending' || status === 'partial')) {
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
      if (item.itemType === 'adjustment') {
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
      const uPQ      = item.itemType === 'suit-set' ? 3 : item.itemType === 'combo' ? [item.item1Name, item.item2Name].filter(Boolean).length : 1;
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

    list.appendChild(card);
  });
}


/* ── DELIVERY SHEET ──────────────────────────────────────── */

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


/* ── PAYMENT SHEET ───────────────────────────────────────── */

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
    histLabel.style.cssText = 'font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px';
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
  paySheetOrderId = id;
  $('ep-amt').value      = '';
  $('ep-discount').value = order.orderDiscount > 0 ? order.orderDiscount : '';
  refreshPaymentSheetHistory(id);
  setPaymentSheetMode('cash');
  openSheet('ep-modal');
}

function setPaymentSheetMode(mode) {
  ['cash','online'].forEach(m => { const b = $('ep-'+m); if(b) b.className='edit-pay-btn'; });
  $('ep-'+mode)?.classList.add(mode+'-active');
  $('ep-modal').dataset.chosenMode = mode;
}

function syncDiscountAmount() {
  const order = savedOrders.find(o => o.id === paySheetOrderId);
  if (!order) return;
  $('ep-amt').value = Math.max(0, (order.subtotal||0) - totalCollected(order) - (parseFloat($('ep-discount').value)||0));
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
  pendingPayDeleteId = { orderId, entryIndex };
  $('del-modal-sub').textContent = `${entry.mode.charAt(0).toUpperCase()+entry.mode.slice(1)} payment of ${rupees(entry.amount)} on ${entry.date}. This cannot be undone.`;
  $('del-modal').dataset.mode = 'payment';
  openDelModal();
}


/* ── DELETE ORDER ────────────────────────────────────────── */

function openDelModal()  { $('del-modal').classList.add('open');    }
function closeDelModal() { $('del-modal').classList.remove('open'); }

function deleteOrder(id) {
  const order = savedOrders.find(o => o.id === id);
  pendingDeleteId = id;
  $('del-modal-sub').textContent = order ? `Deleting: ${order.studentName||'this order'} — ${rupees(order.subtotal)}. This cannot be undone.` : 'This cannot be undone.';
  $('del-modal').dataset.mode = 'order';
  openDelModal();
}

function confirmDelete() {
  const mode = $('del-modal').dataset.mode;
  closeDelModal();
  if (mode === 'payment') {
    if (!pendingPayDeleteId) return;
    const { orderId, entryIndex } = pendingPayDeleteId; pendingPayDeleteId = null; $('del-modal').dataset.mode = '';
    const idx = savedOrders.findIndex(o => o.id === orderId); if (idx === -1) return;
    const payments = [...getPayments(savedOrders[idx])]; payments.splice(entryIndex, 1);
    savedOrders[idx].payments = payments; savedOrders[idx].orderDiscount = savedOrders[idx].orderDiscount || 0;
    saveOrderRemote(savedOrders[idx]).catch(e => console.error(e));
    toast('Payment entry deleted'); closeSheet('ep-modal'); renderOrders(getSearchValue());
  } else {
    if (!pendingDeleteId) return;
    const deletedId = pendingDeleteId;
    savedOrders = savedOrders.filter(o => o.id !== deletedId); pendingDeleteId = null;
    deleteOrderRemote(deletedId).catch(e => console.error(e));
    toast('Order deleted'); renderOrders(getSearchValue());
  }
}


/* ── EDIT ORDER ──────────────────────────────────────────── */

function openEditOrder(id) {
  const order = savedOrders.find(o => o.id === id);
  if (!order) return;
  editOrderId = id; itemCounter = 0;

  const editBranch  = order.branch;
  const editSeason  = order.season || 'summer';
  const editPrices  = buildPrices(editBranch, editSeason);
  const savedGlobalPrices = prices;
  prices = editPrices;

  buildStudentFields('edit-student-fields', 'edit');
  buildItemsSection('edit-items-section', 'edit-items-container', 'add-btns-eo', 'eo-grand-total', 'Total', true);
  writeStudentFields('edit', order);

  const branchBadge = $('eo-branch-badge');
  if (branchBadge) {
    const seasonIcon = editSeason === 'winter' ? ' ❄️' : ' ☀️';
    branchBadge.textContent = BRANCH_LABEL[editBranch] + seasonIcon;
    branchBadge.className   = `badge ${editBranch}`;
  }

  $('edit-items-container').innerHTML = '';
  try {
    (order.items || []).forEach(item => {
      const qty = item.qty || 1;
      if (item.itemType === 'suit-set') {
        _addCombo('edit-items-container', 'e', 'recalcEdit', 'suit-set', null, null, qty, editPrices);
      } else if (item.itemType === 'combo') {
        const comboType = COMBO_TYPE_BY_ITEM1[item.item1Name] || 'pant-shirt';
        _addCombo('edit-items-container', 'e', 'recalcEdit', comboType, item.item1Size, item.item2Size, qty, editPrices);
      } else if (item.itemType === 'adjustment') {
        _addAdjustment('edit-items-container', 'e', 'recalcEdit', item.sign, item.amount, item.note || '');
      } else {
        _addItem('edit-items-container', 'e', 'recalcEdit', item.itemName, item.itemSize, qty, editPrices);
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
  prices = buildPrices(orig.branch, orig.season || currentSeason);
  try {
    ({ items, subtotal } = collectItems('edit-items-container'));
  } finally {
    prices = savedPrices;
  }

  if (subtotal < collected)
    if (!confirm(`Warning: new total (${rupees(subtotal)}) is less than already collected (${rupees(collected)}).\nPayment entries will be adjusted. Proceed?`)) return;

  let remaining = subtotal;
  const adjustedPayments = [...getPayments(orig)].map(p => {
    const amt = Math.min(p.amount || 0, remaining); remaining = Math.max(0, remaining - amt); return { ...p, amount: amt };
  });

  const givenKeys = new Set(ensureDeliveryUnits(orig).filter(u => u.given).map(u => u.key));
  const newUnits  = buildDeliveryUnits(items);
  newUnits.forEach(u => { if (givenKeys.has(u.key)) u.given = true; });

  savedOrders[idx] = { ...orig, ...fields, items, subtotal, payments: adjustedPayments, orderDiscount: orig.orderDiscount || 0, deliveryUnits: newUnits };
  saveOrderRemote(savedOrders[idx]).catch(e => console.error(e));
  toast(`Order updated — ${fields.studentName}, ${rupees(subtotal)}`);
  closeEditOrder();
  renderOrders(getSearchValue());
}


/* ── WHATSAPP BILL ───────────────────────────────────────── */

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
    if (item.itemType === 'adjustment') {
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


/* ── EXPORT / IMPORT ─────────────────────────────────────── */

function exportCSV() {
  if (!savedOrders.length) { toast('No orders to export'); return; }
  const headers = ['UUID','Date','Branch','Season','Student Name','Class','Parent Name','Mobile','Address','Notes','Items','Items Not Delivered','Subtotal','Collected','Discount','Balance','Status','Payment Detail'];
  const rows = savedOrders.map(o => {
    const payments  = getPayments(o);
    const payDetail = payments.map(p => `${p.mode} Rs.${p.amount} on ${p.date}`).join(' | ');
    const pendLabels = ensureDeliveryUnits(o).filter(u => !u.given).map(u => u.label).join(' | ');
    return [
      o.uuid, o.date, o.branch, o.season || 'summer',
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


/* ── PRICE LIST OVERLAY ──────────────────────────────────── */

function showPriceList() {
  priceBranch = currentBranch;
  renderPriceList();
  $('pricelist-screen').style.display = 'block';
  document.body.style.overflow = 'hidden';
}
function closePriceList() { $('pricelist-screen').style.display = 'none'; document.body.style.overflow = ''; }

function setPriceBranch(branch) {
  priceBranch = branch;
  renderPriceList();
}

function renderPriceList() {
  const p    = buildPrices(priceBranch, 'summer');
  const pw   = buildPrices(priceBranch, 'winter');
  const wrap = $('price-list-content');
  wrap.innerHTML = '';

  const branchRow = document.createElement('div');
  branchRow.className = 'pl-branch-row';
  const branchToggle = document.createElement('div');
  branchToggle.className = 'an-branch-toggle';
  [['badagaon','Badagaon'],['baghpat','Baghpat']].forEach(([v,l]) => {
    const btn = document.createElement('button');
    btn.className = 'an-branch-btn' + (priceBranch === v ? ' active' : '');
    btn.textContent = l;
    btn.onclick = () => setPriceBranch(v);
    branchToggle.appendChild(btn);
  });
  branchRow.appendChild(branchToggle);
  wrap.appendChild(branchRow);

  const pr = v => v != null && v !== 0 ? rupees(v) : `<span class="pl-na">—</span>`;

  function makeTable(groupTitle, colHeaders, rows) {
    const card = document.createElement('div');
    card.className = 'pl-card';
    card.innerHTML = `<div class="pl-group-title">${groupTitle}</div>`;
    const scrollWrap = document.createElement('div');
    scrollWrap.className = 'pl-scroll';
    const table = document.createElement('table');
    table.className = 'pl-table';

    const thead = document.createElement('thead');
    thead.innerHTML = '<tr>' + colHeaders.map((h, i) => {
      const isTotal = h.total;
      return `<th class="pl-th${i === 0 ? ' pl-th-first' : ''}${isTotal ? ' pl-th-total' : ''}">${h.label ?? h}</th>`;
    }).join('') + '</tr>';
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
    wrap.appendChild(card);
  }

  if (priceBranch === 'baghpat') {
    makeTable('Pant / Shirt / Lower / T-Shirt',
      ['Size', 'Each', { label: '(Pant+Shirt) / ...', total: true }],
      Object.entries(p['Pant']).map(([size, price]) => [
        size, pr(price), { val: pr(price * 2), total: true }
      ])
    );
  } else {
    const allSizes = [...new Set([...Object.keys(p['Pant']), ...Object.keys(p['Lower'])])].sort((a,b) => parseInt(a)-parseInt(b));
    makeTable('Pant / Shirt / Lower / T-Shirt',
      ['Size', 'P..... | L.....', { label: 'Pant+Shirt', total: true }, { label: 'Lower+T-Shirt', total: true }],
      allSizes.map(size => {
        const pp = p['Pant'][size] || null;
        const lp = p['Lower'][size] || null;
        const eachLabel = pp && lp ? `${pr(pp)} | ${lp}` : pp ? pr(pp) : pr(lp);
        return [size, eachLabel, { val: pr(pp && pp * 2), total: true }, { val: pr(lp && lp * 2), total: true }];
      })
    );
  }

  makeTable('Half Lower / Half T-Shirt — Summer',
    ['Size', 'Each', { label: 'Half Lower + Half T-Shirt', total: true }],
    Object.keys(p['Half Lower']).map(size => {
      const l = p['Half Lower'][size] || 0;
      const t = p['Half T-Shirt'][size] || 0;
      return [size, `${pr(l)} + ${t}`, { val: pr(l + t), total: true }];
    })
  );

  makeTable('Full Lower / Full T-Shirt — Winter',
    ['Size', 'Each', { label: 'Full Lower + Full T-Shirt', total: true }],
    Object.keys(pw['Full Lower']).map(size => {
      const l = pw['Full Lower'][size] || 0;
      const t = pw['Full T-Shirt'][size] || 0;
      return [size, `${pr(l)} + ${t}`, { val: pr(l + t), total: true }];
    })
  );

  makeTable('Blazer & Sweater — Winter',
    ['Size', { label: 'Blazer', total: true }, { label: 'Sweater', total: true }],
    Object.keys(pw['Blazer']).map(size => [size, { val: pr(pw['Blazer'][size]), total: true }, { val: pr(pw['Sweater'][size]), total: true }])
  );

  const suitTotal = pw.Suit.All + pw.Trouser.All + pw.Jacket.All;
  makeTable('Suit Set',
    ['Item', { label: 'Price', total: true }],
    [
      ['Suit',    { val: pr(pw.Suit.All),    total: true }],
      ['Trouser', { val: pr(pw.Trouser.All), total: true }],
      ['Jacket',  { val: pr(pw.Jacket.All),  total: true }],
      [{ val: 'Set total', bold: true }, { val: pr(suitTotal), total: true, bold: true }]
    ]
  );

  makeTable('Accessories',
    ['Item', { label: 'Price', total: true }],
    [
      ['Tie — Small',  { val: pr(p['Tie']['Small']),  total: true }],
      ['Tie — Large',  { val: pr(p['Tie']['Large']),  total: true }],
      ['Belt',         { val: pr(p['Belt']['All']),   total: true }],
      ['Socks',        { val: pr(p['Socks']['Pair']), total: true }],
      ['Winter Cap',   { val: pr(pw['Winter Cap']['All']), total: true }]
    ]
  );
}


/* ── QR PAYMENT OVERLAY ──────────────────────────────────── */

function showQR() {
  const qrImg = $('qr-img');
  qrImg.src = 'GooglePay_QR.png';
  $('qr-screen').style.display = 'block';
  document.body.style.overflow = 'hidden';
  loadSettingsFromCloud().then(s => { if (s?.qrDataUrl) qrImg.src = s.qrDataUrl; });
}
function closeQR() { $('qr-screen').style.display = 'none'; document.body.style.overflow = ''; }


/* ── GLOBAL EVENT LISTENERS ──────────────────────────────── */

document.addEventListener('click', e => {
  if (!e.target.closest('.header-menu-wrap')) closeHamburger();
  if (!e.target.closest('.branch-header-wrap')) closeBranchDropdown();
  if (!e.target.closest('.filter-btn-wrap'))  $('filter-dropdown')?.classList.remove('open');
  if (!e.target.closest('.menu-wrap'))        document.querySelectorAll('.menu-dropdown.open').forEach(m => m.classList.remove('open'));
});


/* ── INIT ────────────────────────────────────────────────── */

buildStudentFields('new-student-fields', 'new');
buildItemsSection('new-items-section', 'items-container', 'add-btns-new', 'grand-total', 'Subtotal', false);
syncBranchBadge();
syncSeasonBadge();
syncSeasonToggleUI();

/* ── FIREBASE BRIDGE CALLBACKS ───────────────────────────── */

window.__firestoreUnsubscribe = null;

function startApp(user) {
  currentUserEmail = user.email;
  renderOrders('');
  if (window.__firestoreUnsubscribe) window.__firestoreUnsubscribe();
  window.__firestoreUnsubscribe = subscribeOrders(orders => {
    savedOrders = orders;
    renderOrders(getSearchValue());
  });
}