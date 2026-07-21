/*
 * #1 - Month rollover (highest blast radius).
 * Covers monthsBetween, and rollover()'s archiving, interest accrual (incl.
 * multi-month compounding), paid-flag reset, and recurring-bill advancement.
 *
 * rollover() reads the current date, so each test pins "today" via setNow().
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { fn, setState, setNow } = require('./harness');

const rollover = fn('rollover');
const monthsBetween = fn('monthsBetween');

// A complete-enough state for computeTotals / rollover to run against.
function baseState(currentMonth, overrides = {}) {
  return {
    currentMonth,
    bills: [],
    incomes: [{ id: 'i1', source: 'Job', person: 'Emily', amount: 2000, holdback: 800 }],
    debts: [],
    goals: [],
    misc: [],
    receipts: {},
    archives: {},
    paymentHistory: [],
    ...overrides,
  };
}

test('monthsBetween: gap in whole months, incl. across a year', () => {
  assert.equal(monthsBetween('2026-05', '2026-07'), 2);
  assert.equal(monthsBetween('2026-07', '2026-07'), 0);
  assert.equal(monthsBetween('2026-08', '2026-07'), -1);
  assert.equal(monthsBetween('2025-11', '2026-02'), 3);
});

test('rollover: no-op when the month has not changed', () => {
  setNow('2026-07-15');
  const s = baseState('2026-07', { bills: [{ id: 'b1', name: 'Rent', amount: 1000, paid: true }] });
  setState(s);
  assert.equal(rollover(), false);
  assert.deepEqual(Object.keys(s.archives), []);
  assert.equal(s.bills[0].paid, true); // untouched
  assert.equal(s.currentMonth, '2026-07');
});

test('rollover: future currentMonth is also a no-op', () => {
  setNow('2026-07-15');
  const s = baseState('2026-08');
  setState(s);
  assert.equal(rollover(), false);
  assert.equal(s.currentMonth, '2026-08');
});

test('rollover: closes one month - archives it and resets paid flags', () => {
  setNow('2026-07-15');
  const s = baseState('2026-06', {
    bills: [
      { id: 'b1', name: 'Rent', amount: 1000, person: 'Hameed', category: 'Housing', paid: true },
      { id: 'b2', name: 'Water', amount: 50, person: 'Hameed', category: 'Housing', paid: false },
    ],
  });
  setState(s);
  assert.equal(rollover(), true);
  assert.equal(s.currentMonth, '2026-07');
  assert.ok(s.archives['2026-06'], 'archived the closed month');
  const archivedNames = s.archives['2026-06'].bills.map((b) => b.name).sort();
  assert.deepEqual(archivedNames, ['Rent', 'Water']);
  // archive captures the paid status as it was at close
  assert.equal(s.archives['2026-06'].bills.find((b) => b.name === 'Rent').paid, true);
  // new month starts fresh
  assert.equal(s.bills.every((b) => b.paid === false), true);
});

test('rollover: accrues interest only on active, APR-bearing debts', () => {
  setNow('2026-07-15');
  const s = baseState('2026-06', {
    debts: [
      { id: 'd1', name: 'Card', status: 'Active', apr: 12, balance: 1000, startBalance: 1000, totalPaid: 0 },
      { id: 'd2', name: 'Paused', status: 'Paused', apr: 12, balance: 500, startBalance: 500, totalPaid: 0 },
      { id: 'd3', name: 'NoAPR', status: 'Active', apr: 0, balance: 300, startBalance: 300, totalPaid: 0 },
    ],
  });
  setState(s);
  rollover();
  assert.equal(s.debts[0].balance, 1010); // 1000 + 1% = 1010
  assert.equal(s.debts[1].balance, 500); // paused, unchanged
  assert.equal(s.debts[2].balance, 300); // 0% APR, unchanged
  const interestEvents = s.paymentHistory.filter((h) => h.type === 'Monthly interest');
  assert.equal(interestEvents.length, 1);
});

test('rollover: multi-month gap archives each month and compounds interest', () => {
  setNow('2026-07-15');
  const s = baseState('2026-05', {
    debts: [{ id: 'd1', name: 'Card', status: 'Active', apr: 12, balance: 1000, startBalance: 1000, totalPaid: 0 }],
  });
  setState(s);
  assert.equal(rollover(), true);
  assert.equal(s.currentMonth, '2026-07');
  assert.deepEqual(Object.keys(s.archives).sort(), ['2026-05', '2026-06']);
  // compounded twice: 1000 -> 1010 -> 1020.10
  assert.equal(s.debts[0].balance, 1020.1);
  assert.equal(s.paymentHistory.filter((h) => h.type === 'Monthly interest').length, 2);
});

test('rollover: advances a paid, due, non-monthly recurring bill', () => {
  setNow('2026-07-15');
  const s = baseState('2026-06', {
    bills: [
      { id: 'b1', name: 'Insurance', amount: 300, person: 'Emily', recurring: true, freq: 3, nextDue: '2026-06-10', paid: true },
    ],
  });
  setState(s);
  rollover();
  assert.equal(s.bills[0].nextDue, '2026-09-10'); // advanced by 3 months
  assert.equal(s.bills[0].paid, false); // reset for the new month
});

test('rollover: does NOT advance a recurring bill that was left unpaid', () => {
  setNow('2026-07-15');
  const s = baseState('2026-06', {
    bills: [
      { id: 'b1', name: 'Insurance', amount: 300, person: 'Emily', recurring: true, freq: 3, nextDue: '2026-06-10', paid: false },
    ],
  });
  setState(s);
  rollover();
  assert.equal(s.bills[0].nextDue, '2026-06-10'); // unchanged - still owed
});
