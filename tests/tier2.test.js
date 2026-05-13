'use strict';

/**
 * tests/tier2.test.js
 *
 * Unit tests covering:
 *   • extractFromAdoc()   – pure regex function, no network
 *   • tier2()             – integration test (network required)
 */

const { extractFromAdoc } = require('../src/tier2');
const { tier2 }           = require('../src/tier2');

/* ══════════════════════════════════════════════════════════════ */
/*  1 – extractFromAdoc() (pure, no network)                     */
/* ══════════════════════════════════════════════════════════════ */

describe('extractFromAdoc()', () => {
  test('returns empty array for empty input', () => {
    expect(extractFromAdoc('')).toEqual([]);
    expect(extractFromAdoc(null)).toEqual([]);
    expect(extractFromAdoc(undefined)).toEqual([]);
  });

  test('finds Z-extensions', () => {
    const src = 'The Zba extension and Zbb are optional.';
    const found = extractFromAdoc(src);
    expect(found).toContain('zba');
    expect(found).toContain('zbb');
  });

  test('finds Zicsr and Zifencei', () => {
    const src = 'This requires Zicsr. See also Zifencei.';
    const found = extractFromAdoc(src);
    expect(found).toContain('zicsr');
    expect(found).toContain('zifencei');
  });

  test('finds single-letter extensions as whole words', () => {
    // M and A should be found; "match" and "map" should NOT produce 'm' or 'a'
    const src = 'The M extension provides multiplication. The A extension is atomic.';
    const found = extractFromAdoc(src);
    expect(found).toContain('m');
    expect(found).toContain('a');
  });

  test('normalises to lower-case', () => {
    const found = extractFromAdoc('Use Zba and Zbb in this section');
    expect(found).toContain('zba');
    expect(found).toContain('zbb');
  });

  test('deduplicates repeated tokens', () => {
    const src = 'Zba Zba Zba';
    const found = extractFromAdoc(src);
    const count = found.filter(e => e === 'zba').length;
    expect(count).toBe(1);
  });

  test('strips AsciiDoc inline markup before matching', () => {
    // [.extension]#Zba# and `Zbb` are common AsciiDoc patterns
    const src = '[.extension]#Zba# and `Zbb` are both supported.';
    const found = extractFromAdoc(src);
    expect(found).toContain('zba');
    expect(found).toContain('zbb');
  });

  test('does not extract random capital letters from prose', () => {
    // "In", "The", "ISA" should NOT produce single-letter matches
    const src = 'In The ISA, we find instructions.';
    const found = extractFromAdoc(src);
    // 'I', 'T', 'S' etc. should not appear (they are inside longer words)
    // Only standalone single-letter tokens should match.
    const unexpected = ['i', 't', 's'];
    for (const u of unexpected) {
      expect(found).not.toContain(u);
    }
  });
});

/* ══════════════════════════════════════════════════════════════ */
/*  2 – tier2() integration test (network required)              */
/* ══════════════════════════════════════════════════════════════ */

describe('tier2() – integration (live network)', () => {
  let result;

  // Allow up to 60 s: tier2 calls tier1 + fetches many manual files
  beforeAll(async () => {
    result = await tier2();
  }, 60_000);

  test('returns a non-null result', () => {
    expect(result).not.toBeNull();
  });

  test('result has matched, jsonOnly, manualOnly arrays', () => {
    expect(Array.isArray(result.matched)).toBe(true);
    expect(Array.isArray(result.jsonOnly)).toBe(true);
    expect(Array.isArray(result.manualOnly)).toBe(true);
  });

  test('arrays contain only strings', () => {
    for (const ext of [
      ...result.matched,
      ...result.jsonOnly,
      ...result.manualOnly,
    ]) {
      expect(typeof ext).toBe('string');
    }
  });

  test('matched names are lower-case (normalised)', () => {
    for (const ext of result.matched) {
      expect(ext).toBe(ext.toLowerCase());
    }
  });

  test('no extension appears in both matched and jsonOnly', () => {
    const matchedSet = new Set(result.matched);
    for (const ext of result.jsonOnly) {
      expect(matchedSet.has(ext)).toBe(false);
    }
  });

  test('no extension appears in both matched and manualOnly', () => {
    const matchedSet = new Set(result.matched);
    for (const ext of result.manualOnly) {
      expect(matchedSet.has(ext)).toBe(false);
    }
  });

  test('no extension appears in both jsonOnly and manualOnly', () => {
    const jsonSet = new Set(result.jsonOnly);
    for (const ext of result.manualOnly) {
      expect(jsonSet.has(ext)).toBe(false);
    }
  });

  test('at least one extension is matched', () => {
    // If the network is up and both sources have data there must be some overlap.
    expect(result.matched.length).toBeGreaterThan(0);
  });
});