/*
 * #3 - Debt math.
 * Covers monthlyInterestAmount (APR accrual, paused/zero guards, rounding),
 * payoffEstimate (0% APR, payment-too-small, amortization), and payoffLabel
 * (year/month formatting).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { fn } = require('./harness');

const monthlyInterestAmount = fn('monthlyInterestAmount');
const payoffEstimate = fn('payoffEstimate');
const payoffLabel = fn('payoffLabel');

test('monthlyInterestAmount: accrues APR/12 on the balance', () => {
  assert.equal(monthlyInterestAmount({ status: 'Active', apr: 12, balance: 1000 }), 10);
  // real-world value with rounding to cents
  assert.equal(monthlyInterestAmount({ status: 'Active', apr: 5.49, balance: 255670.26 }), 1169.69);
});

test('monthlyInterestAmount: no interest when paused, zero APR, or zero balance', () => {
  assert.equal(monthlyInterestAmount({ status: 'Paused', apr: 12, balance: 1000 }), 0);
  assert.equal(monthlyInterestAmount({ status: 'Active', apr: 0, balance: 1000 }), 0);
  assert.equal(monthlyInterestAmount({ status: 'Active', apr: 12, balance: 0 }), 0);
  assert.equal(monthlyInterestAmount({ status: 'Active', apr: 12, balance: -50 }), 0);
});

test('monthlyInterestAmount: honors an explicit balance override', () => {
  const d = { status: 'Active', apr: 12, balance: 1000 };
  assert.equal(monthlyInterestAmount(d, 2000), 20); // uses override, not d.balance
  assert.equal(monthlyInterestAmount(d), 10); // falls back to d.balance
});

test('payoffEstimate: already paid off', () => {
  const r = payoffEstimate({ balance: 0, minPayment: 100, apr: 5 });
  assert.equal(r.months, 0);
  assert.match(r.label, /Paid off/);
});

test('payoffEstimate: no monthly payment set', () => {
  const r = payoffEstimate({ balance: 1000, minPayment: 0, apr: 5 });
  assert.equal(r.months, null);
  assert.match(r.label, /Set a monthly payment/);
});

test('payoffEstimate: 0% APR is simple division', () => {
  const r = payoffEstimate({ balance: 1000, minPayment: 100, apr: 0 });
  assert.equal(r.months, 10);
});

test('payoffEstimate: payment that does not cover interest never pays off', () => {
  const r = payoffEstimate({ balance: 1000, minPayment: 5, apr: 12 }); // interest = 10/mo
  assert.equal(r.months, null);
  assert.match(r.label, /does not cover monthly interest/);
});

test('payoffEstimate: amortized payoff months', () => {
  // r = 0.01, n = ceil(-ln(1 - r*B/P)/ln(1+r)) = ceil(10.588...) = 11
  const r = payoffEstimate({ balance: 1000, minPayment: 100, apr: 12 });
  assert.equal(r.months, 11);
});

test('payoffLabel: formats months and years', () => {
  assert.match(payoffLabel(0), /^0 mo - /);
  assert.match(payoffLabel(3), /^3 mo - /);
  assert.match(payoffLabel(12), /^1 yr - /);
  assert.match(payoffLabel(14), /^1 yr 2 mo - /);
  assert.match(payoffLabel(24), /^2 yrs - /);
});
