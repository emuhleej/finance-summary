/*
 * #2 - Recurring-bill date math.
 * Covers addMonths (month-end clamping, leap years, year rollover), billFreq,
 * billDueThisMonth (scheduled vs. due vs. overdue), and countsThisMonth
 * (completed-bill counting rules).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { fn, setState } = require('./harness');

const addMonths = fn('addMonths');
const billFreq = fn('billFreq');
const billDueThisMonth = fn('billDueThisMonth');
const countsThisMonth = fn('countsThisMonth');

test('addMonths: simple forward step keeps the day', () => {
  assert.equal(addMonths('2026-01-15', 1), '2026-02-15');
  assert.equal(addMonths('2026-07-10', 3), '2026-10-10');
});

test('addMonths: clamps to the last day of a shorter month', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28'); // Feb, non-leap
  assert.equal(addMonths('2026-08-31', 6), '2027-02-28'); // Aug 31 -> Feb 28
  assert.equal(addMonths('2026-05-31', 1), '2026-06-30'); // 31 -> 30
});

test('addMonths: leap year gives Feb 29', () => {
  assert.equal(addMonths('2024-01-31', 1), '2024-02-29');
});

test('addMonths: rolls the year over correctly', () => {
  assert.equal(addMonths('2026-11-15', 3), '2027-02-15');
  assert.equal(addMonths('2026-12-15', 1), '2027-01-15');
  assert.equal(addMonths('2026-03-15', 12), '2027-03-15'); // annual
});

test('billFreq: defaults to monthly unless recurring', () => {
  assert.equal(billFreq({ recurring: false, freq: 3 }), 1); // not recurring => monthly
  assert.equal(billFreq({ recurring: true, freq: 3 }), 3);
  assert.equal(billFreq({ recurring: true }), 1); // missing freq => monthly
});

test('billDueThisMonth: non-recurring and monthly bills are always due', () => {
  setState({ currentMonth: '2026-07' });
  assert.equal(billDueThisMonth({ recurring: false }), true);
  assert.equal(billDueThisMonth({ recurring: true, freq: 1 }), true);
});

test('billDueThisMonth: non-monthly bill only counts on/after its next-due month', () => {
  setState({ currentMonth: '2026-07' });
  // scheduled for a future month -> not due yet
  assert.equal(billDueThisMonth({ recurring: true, freq: 3, nextDue: '2026-08-15' }), false);
  // due this month
  assert.equal(billDueThisMonth({ recurring: true, freq: 3, nextDue: '2026-07-10' }), true);
  // overdue from a previous month -> still counts
  assert.equal(billDueThisMonth({ recurring: true, freq: 3, nextDue: '2026-06-01' }), true);
});

test('billDueThisMonth: non-monthly bill without a next-due date falls back to due', () => {
  setState({ currentMonth: '2026-07' });
  assert.equal(billDueThisMonth({ recurring: true, freq: 6, nextDue: null }), true);
});

test('countsThisMonth: active bills follow the due rule', () => {
  setState({ currentMonth: '2026-07' });
  assert.equal(countsThisMonth({ completed: false, recurring: false }), true);
  assert.equal(
    countsThisMonth({ completed: false, recurring: true, freq: 3, nextDue: '2026-09-01' }),
    false
  );
});

test('countsThisMonth: completed bills only count in the month they were completed', () => {
  setState({ currentMonth: '2026-07' });
  assert.equal(countsThisMonth({ completed: true, completedMonth: '2026-07', paid: true }), true);
  assert.equal(countsThisMonth({ completed: true, completedMonth: '2026-07', paid: false }), true);
  assert.equal(countsThisMonth({ completed: true, completedMonth: '2026-06', paid: true }), false);
});
