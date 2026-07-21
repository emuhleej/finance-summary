/*
 * #5 - State migration / normalization (ensureStateShape).
 * The app persists state to localStorage/Firebase and its schema keeps growing.
 * ensureStateShape must backfill new fields on old data WITHOUT clobbering
 * existing values or losing anything - otherwise an upgrade corrupts real data.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { fn } = require('./harness');

const ensureStateShape = fn('ensureStateShape');

test('seeds a fresh state when given null', () => {
  const s = ensureStateShape(null);
  assert.equal(typeof s.currentMonth, 'string');
  assert.ok(s.currentMonth.length > 0);
  assert.ok(Array.isArray(s.bills) && s.bills.length > 0);
  assert.ok(Array.isArray(s.debts) && s.debts.length > 0);
  assert.ok(Array.isArray(s.incomes));
});

test('backfills every collection on an empty object', () => {
  const s = ensureStateShape({});
  const emptyArr = (x) => Array.isArray(x) && x.length === 0;
  const emptyObj = (x) => x && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).length === 0;
  assert.ok(emptyArr(s.incomes), 'incomes');
  assert.ok(emptyArr(s.bills), 'bills');
  assert.ok(emptyArr(s.debts), 'debts');
  assert.ok(emptyArr(s.goals), 'goals');
  assert.ok(emptyArr(s.misc), 'misc'); // newest field - must exist for old blobs
  assert.ok(emptyArr(s.paymentHistory), 'paymentHistory');
  assert.ok(emptyObj(s.receipts), 'receipts');
  assert.ok(emptyObj(s.archives), 'archives');
});

test('adds misc:[] to a state saved before miscellaneous existed', () => {
  // simulate a persisted blob with no `misc` key at all
  const legacy = { currentMonth: '2026-03', bills: [], incomes: [], debts: [] };
  const s = ensureStateShape(legacy);
  assert.ok(Array.isArray(s.misc));
  assert.equal(s.misc.length, 0);
});

test('preserves existing data and does not overwrite populated collections', () => {
  const s = ensureStateShape({
    currentMonth: '2026-03',
    bills: [{ id: 'x', name: 'Rent', amount: 5, recurring: true, freq: 3, nextDue: '2026-05-01' }],
    misc: [{ id: 'm1', name: 'Gift', amount: 40, person: 'Emily' }],
    archives: { '2026-02': { bills: [], incomes: [], totals: {} } },
  });
  assert.equal(s.currentMonth, '2026-03');
  assert.equal(s.bills[0].name, 'Rent');
  assert.equal(s.misc[0].name, 'Gift');
  assert.ok(s.archives['2026-02'], 'existing archive kept');
  // existing recurring settings must not be reset to defaults
  assert.equal(s.bills[0].recurring, true);
  assert.equal(s.bills[0].freq, 3);
  assert.equal(s.bills[0].nextDue, '2026-05-01');
});

test('backfills new bill fields on a legacy bill', () => {
  const s = ensureStateShape({ bills: [{ id: 'b1', name: 'Rent', amount: 100 }] });
  const b = s.bills[0];
  assert.equal(b.recurring, false);
  assert.equal(b.freq, 1);
  assert.equal(b.nextDue, null);
  assert.equal(b.completed, false);
  assert.equal(b.completedMonth, null);
});

test('assigns ids to bills/debts that lack them', () => {
  const s = ensureStateShape({
    bills: [{ name: 'No id bill', amount: 10 }],
    debts: [{ name: 'No id debt', balance: 500 }],
  });
  assert.equal(typeof s.bills[0].id, 'string');
  assert.ok(s.bills[0].id.length > 0);
  assert.equal(typeof s.debts[0].id, 'string');
  assert.ok(s.debts[0].id.length > 0);
});

test('backfills debt fields (startBalance, totalPaid, status)', () => {
  const s = ensureStateShape({ debts: [{ id: 'd1', name: 'Card', balance: 500 }] });
  const d = s.debts[0];
  assert.equal(d.startBalance, 500); // defaults to current balance
  assert.equal(d.totalPaid, 0);
  assert.equal(d.status, 'Active');
});

test('does not clobber existing debt fields', () => {
  const s = ensureStateShape({
    debts: [{ id: 'd1', name: 'Card', balance: 400, startBalance: 900, totalPaid: 500, status: 'Paused' }],
  });
  const d = s.debts[0];
  assert.equal(d.startBalance, 900);
  assert.equal(d.totalPaid, 500);
  assert.equal(d.status, 'Paused');
});

test('survives a JSON round-trip (simulating a load from storage)', () => {
  const saved = {
    currentMonth: '2026-01',
    bills: [{ id: 'b1', name: 'Phone', amount: 72 }],
    debts: [{ id: 'd1', name: 'Loan', balance: 1000 }],
  };
  const reloaded = ensureStateShape(JSON.parse(JSON.stringify(saved)));
  assert.equal(reloaded.currentMonth, '2026-01');
  assert.equal(reloaded.bills[0].name, 'Phone');
  assert.equal(reloaded.bills[0].completed, false); // new field present after reload
  assert.ok(Array.isArray(reloaded.misc));
  assert.equal(reloaded.debts[0].startBalance, 1000);
});
