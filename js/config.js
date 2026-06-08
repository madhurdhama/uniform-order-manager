/* Central config: prices, combos, branches, enums, UPI defaults */


const PRICES = {
  badagaon: {
    'Tie':          { Small: 50, Large: 100 },
    'Belt':         { All: 100 },
    'Socks':        { Pair: 30 },
    'Suit':         { All: 350 },
    'Trouser':      { All: 350 },
    'Jacket':       { All: 300 },
    'Winter Cap':   { All: 50 },
    'Half Lower':   { 20: 250, 22: 250, 24: 250, 26: 250, 28: 300, 30: 300 },
    'Half T-Shirt': { 20: 350, 22: 350, 24: 400, 26: 400, 28: 400, 30: 400 },
    'Lower':        { 26: 300, 28: 300, 30: 325, 32: 325, 34: 350, 36: 350, 38: 375, 40: 400, 42: 425, 44: 450 },
    'T-Shirt':      { 26: 300, 28: 300, 30: 325, 32: 325, 34: 350, 36: 350, 38: 375, 40: 400, 42: 425, 44: 450 },
    'Pant':         { 20: 300, 22: 300, 24: 300, 26: 325, 28: 325, 30: 350, 32: 350, 34: 375, 36: 375, 38: 400, 40: 400, 42: 425, 44: 450 },
    'Shirt':        { 20: 300, 22: 300, 24: 300, 26: 325, 28: 325, 30: 350, 32: 350, 34: 375, 36: 375, 38: 400, 40: 400, 42: 425, 44: 450 },
    'Full Lower':   { 20: 350, 22: 350, 24: 375, 26: 375, 28: 400, 30: 400 },
    'Full T-Shirt': { 20: 350, 22: 350, 24: 375, 26: 375, 28: 400, 30: 400 },
    'Blazer':       { 26: 650, 28: 650, 30: 700, 32: 700, 34: 750, 36: 800, 38: 850, 40: 900, 42: 950, 44: 1000, 46: 1050 },
    'Sweater':      { 26: 250, 28: 270, 30: 300, 32: 320, 34: 350, 36: 370, 38: 390, 40: 400, 42: 420, 44: 430, 46: 450 }
  },
  baghpat: {
    'Tie':          { Small: 50, Large: 100 },
    'Belt':         { All: 100 },
    'Socks':        { Pair: 40 },
    'Suit':         { All: 400 },
    'Trouser':      { All: 400 },
    'Jacket':       { All: 300 },
    'Winter Cap':   { All: 50 },
    'Half Lower':   { 20: 250, 22: 250, 24: 250, 26: 250, 28: 300, 30: 300 },
    'Half T-Shirt': { 20: 350, 22: 350, 24: 400, 26: 400, 28: 400, 30: 400 },
    'Lower':        { 20: 350, 22: 350, 24: 375, 26: 375, 28: 400, 30: 400, 32: 425, 34: 425, 36: 450, 38: 450, 40: 475, 42: 475, 44: 500 },
    'T-Shirt':      { 20: 350, 22: 350, 24: 375, 26: 375, 28: 400, 30: 400, 32: 425, 34: 425, 36: 450, 38: 450, 40: 475, 42: 475, 44: 500 },
    'Pant':         { 20: 350, 22: 350, 24: 375, 26: 375, 28: 400, 30: 400, 32: 425, 34: 425, 36: 450, 38: 450, 40: 475, 42: 475, 44: 500 },
    'Shirt':        { 20: 350, 22: 350, 24: 375, 26: 375, 28: 400, 30: 400, 32: 425, 34: 425, 36: 450, 38: 450, 40: 475, 42: 475, 44: 500 },
    'Full Lower':   { 20: 350, 22: 350, 24: 375, 26: 375, 28: 400, 30: 400 },
    'Full T-Shirt': { 20: 350, 22: 350, 24: 375, 26: 375, 28: 400, 30: 400 },
    'Blazer':       { 26: 650, 28: 650, 30: 700, 32: 700, 34: 750, 36: 800, 38: 850, 40: 900, 42: 950, 44: 1000, 46: 1050 },
    'Sweater':      { 26: 250, 28: 270, 30: 300, 32: 320, 34: 350, 36: 370, 38: 390, 40: 400, 42: 420, 44: 430, 46: 450 }
  }
};

function buildPrices(branch) {
  return PRICES[branch] || PRICES.badagaon;
}


const COMBOS = {
  'pant-shirt':        { item1: 'Pant',       item2: 'Shirt',        label: 'Pant + Shirt' },
  'lower-tshirt':      { item1: 'Lower',      item2: 'T-Shirt',      label: 'Lower + T-Shirt' },
  'half-lower-tshirt': { item1: 'Half Lower', item2: 'Half T-Shirt', label: 'Half Lower + T-Shirt' },
  'full-lower-tshirt': { item1: 'Full Lower', item2: 'Full T-Shirt', label: 'Full Lower + T-Shirt' }
};

/* Maps item1Name → combo type key; used when restoring combo rows in Edit Order */
const COMBO_TYPE_BY_ITEM1 = {
  'Pant':       'pant-shirt',
  'Lower':      'lower-tshirt',
  'Half Lower': 'half-lower-tshirt',
  'Full Lower': 'full-lower-tshirt'
};


const BRANCH_LABEL = { badagaon: 'Badagaon', baghpat: 'Baghpat' };


/* Item row types — stored on order.items[].itemType and on DOM data-type */
const ITEM_TYPES = {
  SINGLE:     'single',
  COMBO:      'combo',
  SUIT:       'suit-set',
  ADJUSTMENT: 'adjustment'
};

/* Payment modes — stored on payment entries and used for status logic */
const PAY_MODES = {
  CASH:    'cash',
  ONLINE:  'online',
  PENDING: 'pending'
};

/* Order-level statuses returned by paymentStatus().
   CASH/ONLINE/PENDING overlap with PAY_MODES but SPLIT/PARTIAL/REFUND are derived
   — they are never stored on a payment entry, only computed from the payments array. */
const ORDER_STATUS = {
  CASH:    'cash',
  ONLINE:  'online',
  PENDING: 'pending',
  SPLIT:   'split',
  PARTIAL: 'partial',
  REFUND:  'refund'
};


const DEFAULT_UPI_ID     = 'madhurdhama@okhdfcbank';
const DEFAULT_UPI_NUMBER = '6398913135';
