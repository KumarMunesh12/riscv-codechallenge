'use strict';

/**
 * utils.js
 * Shared utilities used across all three tiers.
 *
 * Exports:
 *   normalizeExtensionName(name)   – strip rv_ prefix, lowercase
 *   fetchJSON(url)                 – download & parse JSON
 *   fetchText(url)                 – download plain text
 *   writeOutput(filename, content) – save to ./output/
 */

const fs   = require('fs');
const path = require('path');

/* ─── Network ────────────────────────────────────────────────── */

/**
 * Download and parse a JSON file from the given URL.
 * Returns the parsed object, or null on any error.
 *
 * @param {string} url
 * @returns {Promise<object|null>}
 */
async function fetchJSON(url) {
  try {
    const fetch    = require('node-fetch');
    const response = await fetch(url, { timeout: 15_000 });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (err) {
    console.error(`  ✗ fetchJSON failed for ${url}\n    ${err.message}`);
    return null;
  }
}

/**
 * Download a plain-text file from the given URL.
 * Returns the text string, or null on any error.
 *
 * @param {string} url
 * @returns {Promise<string|null>}
 */
async function fetchText(url) {
  try {
    const fetch    = require('node-fetch');
    const response = await fetch(url, { timeout: 15_000 });

    if (!response.ok) return null;

    return await response.text();
  } catch {
    return null;
  }
}

/* ─── Normalisation ──────────────────────────────────────────── */

/**
 * Normalise a RISC-V extension name so that different source
 * representations compare equal.
 *
 * Rules applied (in order):
 *   1. Cast to string; return '' for falsy input.
 *   2. Strip a leading "rv_" prefix  (e.g. "rv_zba"  → "zba")
 *   3. Convert to lower-case         (e.g. "Zba"     → "zba")
 *   4. Trim surrounding whitespace.
 *
 * Examples:
 *   normalizeExtensionName('rv_zba')  // 'zba'
 *   normalizeExtensionName('Zicsr')   // 'zicsr'
 *   normalizeExtensionName('M')       // 'm'
 *   normalizeExtensionName('ZBA')     // 'zba'
 *
 * @param {string} name
 * @returns {string}
 */
function normalizeExtensionName(name) {
  if (!name) return '';
  return String(name)
    .replace(/^rv_/i, '')
    .toLowerCase()
    .trim();
}

/* ─── File I/O ───────────────────────────────────────────────── */

/**
 * Write a text file into the ./output/ directory.
 * The directory is created automatically if it does not exist.
 *
 * @param {string} filename  – e.g. 'tier1_summary.txt'
 * @param {string} content
 */
function writeOutput(filename, content) {
  const outputDir = path.resolve(__dirname, '..', 'output');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const dest = path.join(outputDir, filename);
  fs.writeFileSync(dest, content, 'utf8');
  console.log(`  → saved output/${filename}`);
}

/* ─── Exports ────────────────────────────────────────────────── */

module.exports = {
  fetchJSON,
  fetchText,
  normalizeExtensionName,
  writeOutput,
};
