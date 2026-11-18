/**
 * Trinity - minimal test helpers on top of node:test
 *
 * Covers the small slice of the vitest/jest API the tests use
 * (expect matchers, expect.objectContaining/any/fail, vi.fn),
 * so the project needs no test dependency.
 */

import { AssertionError } from 'node:assert';
import { inspect } from 'node:util';

export { describe, it, test, beforeEach, afterEach, before as beforeAll, after as afterAll } from 'node:test';

const ASYMMETRIC = Symbol('asymmetric');
const MOCK = Symbol('mock');

function fmt(v) {
  return inspect(v, { depth: 6, breakLength: 100 });
}

/** Deep equality like vitest's toEqual: ignores undefined properties, honours asymmetric matchers. */
function equals(a, b) {
  if (b && b[ASYMMETRIC]) return b.match(a);
  if (a && a[ASYMMETRIC]) return a.match(b);
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof Map && b instanceof Map) {
    return a.size === b.size && [...a].every(([k, v]) => b.has(k) && equals(v, b.get(k)));
  }
  if (a instanceof Set && b instanceof Set) {
    return a.size === b.size && [...a].every((v) => [...b].some((w) => equals(v, w)));
  }
  if (Array.isArray(a)) {
    return a.length === b.length && a.every((v, i) => equals(v, b[i]));
  }
  const keys = (o) => Object.keys(o).filter((k) => o[k] !== undefined);
  const ka = keys(a);
  const kb = keys(b);
  return ka.length === kb.length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && equals(a[k], b[k]));
}

/** Subset equality for toMatchObject / objectContaining. */
function matchesSubset(actual, expected) {
  if (typeof actual !== 'object' || actual === null) return false;
  return Object.keys(expected).every((k) => {
    const e = expected[k];
    const a = actual[k];
    if (e && typeof e === 'object' && !e[ASYMMETRIC] && !Array.isArray(e)) return matchesSubset(a, e);
    return equals(a, e);
  });
}

function getPath(obj, path) {
  const parts = Array.isArray(path) ? path : String(path).split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur === null || cur === undefined || !(p in Object(cur))) return { found: false };
    cur = cur[p];
  }
  return { found: true, value: cur };
}

function matchesError(err, expected) {
  if (expected === undefined) return true;
  const msg = err && err.message !== undefined ? err.message : String(err);
  if (expected instanceof RegExp) return expected.test(msg);
  if (typeof expected === 'string') return msg.includes(expected);
  if (typeof expected === 'function') return err instanceof expected;
  return equals(err, expected);
}

function makeMatchers(actual, negate) {
  const check = (pass, message) => {
    if (pass === negate) {
      throw new AssertionError({ message: (negate ? 'Expected not: ' : 'Expected: ') + message });
    }
  };
  const calls = () => {
    if (!actual || !actual[MOCK]) throw new TypeError(`${fmt(actual)} is not a vi.fn() mock`);
    return actual.mock.calls;
  };

  return {
    toBe: (e) => check(Object.is(actual, e), `${fmt(actual)} to be ${fmt(e)}`),
    toEqual: (e) => check(equals(actual, e), `${fmt(actual)} to equal ${fmt(e)}`),
    toStrictEqual: (e) => check(equals(actual, e), `${fmt(actual)} to strictly equal ${fmt(e)}`),
    toMatchObject: (e) => check(matchesSubset(actual, e), `${fmt(actual)} to match ${fmt(e)}`),
    toContain: (e) =>
      check(typeof actual === 'string' ? actual.includes(e) : [...actual].includes(e), `${fmt(actual)} to contain ${fmt(e)}`),
    toContainEqual: (e) => check([...actual].some((v) => equals(v, e)), `${fmt(actual)} to contain equal ${fmt(e)}`),
    toHaveLength: (n) => check(actual != null && actual.length === n, `length ${actual?.length} to be ${n}`),
    toHaveProperty: (path, ...rest) => {
      const r = getPath(actual, path);
      const pass = r.found && (rest.length === 0 || equals(r.value, rest[0]));
      check(pass, `${fmt(actual)} to have property ${fmt(path)}${rest.length ? ' = ' + fmt(rest[0]) : ''}`);
    },
    toBeDefined: () => check(actual !== undefined, `${fmt(actual)} to be defined`),
    toBeUndefined: () => check(actual === undefined, `${fmt(actual)} to be undefined`),
    toBeNull: () => check(actual === null, `${fmt(actual)} to be null`),
    toBeTruthy: () => check(!!actual, `${fmt(actual)} to be truthy`),
    toBeFalsy: () => check(!actual, `${fmt(actual)} to be falsy`),
    toBeGreaterThan: (n) => check(actual > n, `${fmt(actual)} > ${n}`),
    toBeGreaterThanOrEqual: (n) => check(actual >= n, `${fmt(actual)} >= ${n}`),
    toBeLessThan: (n) => check(actual < n, `${fmt(actual)} < ${n}`),
    toBeLessThanOrEqual: (n) => check(actual <= n, `${fmt(actual)} <= ${n}`),
    toBeCloseTo: (n, digits = 2) => check(Math.abs(actual - n) < 10 ** -digits / 2, `${fmt(actual)} to be close to ${n}`),
    toBeInstanceOf: (C) => check(actual instanceof C, `${fmt(actual)} to be instance of ${C?.name}`),
    toThrow: (expected) => {
      let threw = false;
      let err;
      try {
        actual();
      } catch (e) {
        threw = true;
        err = e;
      }
      check(threw && matchesError(err, expected), `function to throw${expected !== undefined ? ' ' + fmt(expected) : ''}${threw ? ` (threw ${fmt(err?.message ?? err)})` : ''}`);
    },
    toHaveBeenCalled: () => check(calls().length > 0, 'mock to have been called'),
    toHaveBeenCalledTimes: (n) => check(calls().length === n, `mock to have been called ${n} times (was ${calls().length})`),
    toHaveBeenCalledWith: (...args) =>
      check(calls().some((c) => equals(c, args)), `mock to have been called with ${fmt(args)}; calls: ${fmt(calls())}`),
  };
}

export function expect(actual) {
  const m = makeMatchers(actual, false);
  m.not = makeMatchers(actual, true);
  return m;
}

expect.objectContaining = (expected) => ({
  [ASYMMETRIC]: true,
  match: (actual) => matchesSubset(actual, expected),
  [inspect.custom]: () => `ObjectContaining ${fmt(expected)}`,
});

expect.any = (C) => ({
  [ASYMMETRIC]: true,
  match: (v) =>
    v !== null && v !== undefined && (v instanceof C || Object(v) instanceof C || typeof v === C.name.toLowerCase()),
  [inspect.custom]: () => `Any<${C.name}>`,
});

expect.fail = (message) => {
  throw new AssertionError({ message });
};

export const vi = {
  fn(impl = () => undefined) {
    let current = impl;
    const mock = function (...args) {
      mock.mock.calls.push(args);
      const result = current.apply(this, args);
      mock.mock.results.push({ type: 'return', value: result });
      return result;
    };
    mock[MOCK] = true;
    mock.mock = { calls: [], results: [] };
    mock.mockImplementation = (fn) => ((current = fn), mock);
    mock.mockReturnValue = (v) => ((current = () => v), mock);
    mock.mockClear = () => ((mock.mock.calls = []), (mock.mock.results = []), mock);
    mock.mockReset = () => (mock.mockClear(), (current = () => undefined), mock);
    return mock;
  },
};
