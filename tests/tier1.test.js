'use strict';

/**
 * tests/tier1.test.js
 *
 * Unit tests covering:
 *   • normalizeExtensionName()  (from utils.js)
 *   • tier1 data-shape guarantees
 *   • buildGraph()              (from tier3.js)
 *
 * The tests for tier1 that require a real network call are placed in
 * a separate describe block with a generous timeout.  Helpers that are
 * pure functions are tested without any network dependency.
 */

const {
  normalizeExtensionName,
} = require('../src/utils');

const { tier1 } = require('../src/tier1');
const { buildGraph } = require('../src/tier3');

/* ══════════════════════════════════════════════════════════════ */
/*  1 – normalizeExtensionName (pure, no network)                */
/* ══════════════════════════════════════════════════════════════ */

describe('normalizeExtensionName()', () => {
  test('strips rv_ prefix', () => {
    expect(normalizeExtensionName('rv_zba')).toBe('zba');
  });

  test('converts to lower-case', () => {
    expect(normalizeExtensionName('Zba')).toBe('zba');
    expect(normalizeExtensionName('ZBA')).toBe('zba');
    expect(normalizeExtensionName('M')).toBe('m');
  });

  test('handles already-normalised input', () => {
    expect(normalizeExtensionName('zba')).toBe('zba');
  });

  test('handles rv_ + mixed case', () => {
    expect(normalizeExtensionName('rv_Zba')).toBe('zba');
    expect(normalizeExtensionName('rv_ZICSR')).toBe('zicsr');
  });

  test('returns empty string for falsy input', () => {
    expect(normalizeExtensionName('')).toBe('');
    expect(normalizeExtensionName(null)).toBe('');
    expect(normalizeExtensionName(undefined)).toBe('');
  });

  test('trims surrounding whitespace', () => {
    expect(normalizeExtensionName('  zba  ')).toBe('zba');
  });
});

/* ══════════════════════════════════════════════════════════════ */
/*  2 – buildGraph() (pure, no network)                          */
/* ══════════════════════════════════════════════════════════════ */

describe('buildGraph()', () => {
  // Minimal fixture – two extensions that share one instruction
  const fixture = {
    zba:  ['sh1add', 'sh2add', 'sh3add'],
    zbb:  ['clz', 'cpop', 'sh1add'],   // 'sh1add' is shared with zba
    zicsr: ['csrrw', 'csrrs'],         // shares nothing
  };

  let graph;
  beforeAll(() => { graph = buildGraph(fixture); });

  test('returns adjacency, evidence, and edges', () => {
    expect(graph).toHaveProperty('adjacency');
    expect(graph).toHaveProperty('evidence');
    expect(graph).toHaveProperty('edges');
  });

  test('finds the edge between zba and zbb', () => {
    expect(graph.adjacency.zba).toBeDefined();
    expect(graph.adjacency.zba.has('zbb')).toBe(true);
    expect(graph.adjacency.zbb.has('zba')).toBe(true);
  });

  test('evidence key holds the shared mnemonic', () => {
    // key is always lexicographically ordered
    const key = 'zba::zbb';
    expect(graph.evidence[key]).toContain('sh1add');
  });

  test('isolated extension has no neighbours', () => {
    // zicsr shares nothing with zba or zbb
    expect(
      graph.adjacency.zicsr === undefined ||
      graph.adjacency.zicsr.size === 0
    ).toBe(true);
  });

  test('edges array is sorted deterministically', () => {
    const names = graph.edges.map(e => `${e.a}::${e.b}`);
    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
  });

  test('edge weight equals number of shared instructions', () => {
    const edge = graph.edges.find(e => e.a === 'zba' && e.b === 'zbb');
    expect(edge).toBeDefined();
    expect(edge.shared.length).toBe(1);
    expect(edge.shared).toContain('sh1add');
  });

  test('empty extensionMap returns empty graph', () => {
    const g = buildGraph({});
    expect(Object.keys(g.adjacency).length).toBe(0);
    expect(g.edges.length).toBe(0);
  });

  test('no sharing → no edges', () => {
    const g = buildGraph({ a: ['x'], b: ['y'] });
    expect(g.edges.length).toBe(0);
  });
});

/* ══════════════════════════════════════════════════════════════ */
/*  3 – tier1() integration test (network required)              */
/* ══════════════════════════════════════════════════════════════ */

describe('tier1() – integration (live network)', () => {
  let result;

  // Allow up to 30 s for the GitHub download
  beforeAll(async () => {
    result = await tier1();
  }, 30_000);

  test('returns a non-null result', () => {
    expect(result).not.toBeNull();
  });

  test('extensionMap is a non-empty object', () => {
    expect(typeof result.extensionMap).toBe('object');
    expect(Object.keys(result.extensionMap).length).toBeGreaterThan(0);
  });

  test('every extension has at least one instruction', () => {
    for (const [ext, instrs] of Object.entries(result.extensionMap)) {
      expect(instrs.length).toBeGreaterThan(0);
    }
  });

  test('all extension names are normalised (no rv_ prefix, lower-case)', () => {
    for (const ext of result.sortedExtNames) {
      expect(ext).toBe(ext.toLowerCase());
      expect(ext.startsWith('rv_')).toBe(false);
    }
  });

  test('totalInstrs is a positive number', () => {
    expect(result.totalInstrs).toBeGreaterThan(0);
  });

  test('multiExt is an array', () => {
    expect(Array.isArray(result.multiExt)).toBe(true);
  });

  test('each multiExt entry has mnemonic and ≥2 extensions', () => {
    for (const item of result.multiExt) {
      expect(typeof item.mnemonic).toBe('string');
      expect(item.extensions.length).toBeGreaterThanOrEqual(2);
    }
  });

  test('sortedExtNames is sorted', () => {
    const sorted = [...result.sortedExtNames].sort();
    expect(result.sortedExtNames).toEqual(sorted);
  });
});
