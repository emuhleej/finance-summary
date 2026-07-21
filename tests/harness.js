/*
 * Test harness for the budget planner.
 *
 * The whole app lives in a single index.html with its logic in one inline
 * <script>. Rather than refactor that (or spin up a real browser), we read the
 * inline script, run it inside a Node `vm` context with lightweight DOM stubs,
 * and expose the pure logic functions to the tests.
 *
 * index.html itself is NOT modified. The only adjustment made here, in-memory,
 * is turning the app's module-local `let state` into a sandbox global so tests
 * can set the "current month" the same way the running app would.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// Grab the inline script (the one WITHOUT a src=, i.e. not firebase-config.js).
const match = html.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/);
if (!match) throw new Error('Could not find the inline <script> in index.html');

let code = match[1];
// Expose `state` on the sandbox global so tests can drive the current month.
code = code.replace(/\blet\s+state\s*=\s*null\s*;/, 'var state = null;');

// A permissive stub for any DOM node / browser object: every property access
// returns another callable stub, so the app's on-load listener wiring runs
// without throwing. None of it matters for the pure logic under test.
function stub() {
  return new Proxy(function () {}, {
    get(_t, p) {
      if (p === 'classList') return { add() {}, remove() {}, toggle() {}, contains() { return false; } };
      if (p === 'style') return {};
      if (p === 'dataset') return {};
      if (p === 'value') return '';
      if (p === 'length') return 0;
      if (p === Symbol.iterator) return function* () {};
      if (p === Symbol.toPrimitive) return () => '';
      return stub();
    },
    set() { return true; },
    apply() { return stub(); },
  });
}

// Controllable clock so time-dependent logic (rollover reads `new Date()` to
// decide how many months have passed) can be tested deterministically.
const RealDate = Date;
let fakeNow = null; // epoch ms, or null to use the real clock
class FakeDate extends RealDate {
  constructor(...args) {
    if (args.length === 0 && fakeNow !== null) super(fakeNow);
    else super(...args);
  }
  static now() {
    return fakeNow !== null ? fakeNow : RealDate.now();
  }
}

const sandbox = {
  document: stub(),
  window: stub(),
  sessionStorage: stub(),
  localStorage: stub(),
  navigator: {},
  console,
  Date: FakeDate,
  setTimeout: () => 0,
  clearTimeout: () => {},
  TextEncoder: typeof TextEncoder !== 'undefined' ? TextEncoder : undefined,
};

vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'index.html:inline' });

/** Set the app's global state (partial is fine for pure-logic tests). */
function setState(s) {
  sandbox.state = s;
}

/** Pin the app's "today" to a YYYY-MM-DD (local noon), or null to reset. */
function setNow(iso) {
  if (iso === null || iso === undefined) {
    fakeNow = null;
    return;
  }
  const [y, m, d] = iso.split('-').map(Number);
  fakeNow = new RealDate(y, m - 1, d, 12, 0, 0).getTime();
}

/** Fetch a top-level function/value defined by the app script. */
function fn(name) {
  const f = sandbox[name];
  if (typeof f === 'undefined') throw new Error(`app symbol not found: ${name}`);
  return f;
}

module.exports = { sandbox, setState, setNow, fn };
