'use strict';

/**
 * tier1.js  –  Instruction Set Parsing
 *
 * Tasks
 * ─────
 * 1. Download instr_dict.json from the RISC-V Extensions Landscape repo.
 * 2. Group every instruction by its extension tag(s) (normalised).
 * 3. Print / save a summary table:
 *      <extension>  |  <count>  |  e.g. <mnemonic>
 * 4. Identify instructions that belong to MORE than one extension.
 *
 * Returns (for use by tier2 / tier3):
 * {
 *   instrDict      : <raw JSON>,
 *   extensionMap   : { normalised_ext → [mnemonic, …] },
 *   multiExt       : [{ mnemonic, extensions[] }, …],
 *   sortedExtNames : [string, …],
 *   totalInstrs    : number,
 * }
 */

const { fetchJSON, normalizeExtensionName, writeOutput } = require('./utils');

const INSTR_DICT_URL =
  'https://raw.githubusercontent.com/rpsene/' +
  'riscv-extensions-landscape/main/src/instr_dict.json';

/* ─── Main ───────────────────────────────────────────────────── */

async function tier1() {
  const DIVIDER = '─'.repeat(72);

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║   TIER 1 — Instruction Set Parsing               ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  /* 1 ── Download ──────────────────────────────────────────────── */
  console.log('Downloading instr_dict.json …');
  const instrDict = await fetchJSON(INSTR_DICT_URL);

  if (!instrDict) {
    console.error('ERROR: could not fetch instruction dictionary.');
    return null;
  }

  const allMnemonics = Object.keys(instrDict);
  console.log(`  ✓ ${allMnemonics.length} entries loaded\n`);

  /* 2 ── Group by extension ────────────────────────────────────── */
  // extensionMap : { ext_name → Set of mnemonic strings }
  const extensionMap = {};   // will be converted to plain arrays before return
  const multiExt     = [];   // mnemonics that live in >1 extension
  const parseErrors  = [];

  for (const mnemonic of allMnemonics) {
    const entry = instrDict[mnemonic];

    // Validate
    // The real instr_dict.json uses "extension" (not "ext")
    const extField = entry.extension ?? entry.ext;
    if (!entry || !Array.isArray(extField) || extField.length === 0) {
      parseErrors.push(mnemonic);
      continue;
    }

    const normExts = extField
      .map(normalizeExtensionName)
      .filter(Boolean);

    // Populate the map
    for (const ext of normExts) {
      if (!extensionMap[ext]) extensionMap[ext] = new Set();
      extensionMap[ext].add(mnemonic);
    }

    // Record multi-extension membership
    if (normExts.length > 1) {
      multiExt.push({ mnemonic, extensions: normExts });
    }
  }

  // Convert Sets → sorted arrays
  for (const ext of Object.keys(extensionMap)) {
    extensionMap[ext] = [...extensionMap[ext]].sort();
  }

  const sortedExtNames  = Object.keys(extensionMap).sort();
  const totalInstrs     = allMnemonics.length - parseErrors.length;

  /* 3 ── Build output ──────────────────────────────────────────── */
  const lines = [];

  // Header
  lines.push('TIER 1 — Extension Summary');
  lines.push(DIVIDER);
  lines.push(
    padCol('Extension', 14) +
    padCol('Instructions', 14) +
    'Example mnemonic'
  );
  lines.push(DIVIDER);

  // One row per extension
  for (const ext of sortedExtNames) {
    const instrs  = extensionMap[ext];
    const example = instrs[0] ?? '—';
    lines.push(
      padCol(ext, 14) +
      padCol(String(instrs.length), 14) +
      example.toUpperCase()
    );
  }

  lines.push(DIVIDER);
  lines.push(
    `Total: ${totalInstrs} instructions across ` +
    `${sortedExtNames.length} extensions`
  );

  // Multi-extension section
  lines.push('');
  lines.push('Instructions shared by more than one extension');
  lines.push(DIVIDER);

  if (multiExt.length === 0) {
    lines.push('  (none found)');
  } else {
    for (const { mnemonic, extensions } of multiExt) {
      lines.push(
        `  ${padCol(mnemonic.toUpperCase(), 18)}` +
        extensions.join(', ')
      );
    }
  }

  // Parse errors (if any)
  if (parseErrors.length > 0) {
    lines.push('');
    lines.push(`⚠  ${parseErrors.length} entries skipped (missing ext field):`);
    lines.push('  ' + parseErrors.slice(0, 10).join(', ') +
      (parseErrors.length > 10 ? ` … (+${parseErrors.length - 10} more)` : ''));
  }

  const output = lines.join('\n') + '\n';

  /* 4 ── Print & save ──────────────────────────────────────────── */
  console.log(output);
  writeOutput('tier1_summary.txt', output);

  return {
    instrDict,
    extensionMap,
    multiExt,
    sortedExtNames,
    totalInstrs,
  };
}

/* ─── Helpers ────────────────────────────────────────────────── */

/** Right-pad a string to a fixed column width. */
function padCol(str, width) {
  return String(str).padEnd(width);
}

/* ─── Exports & direct run ───────────────────────────────────── */

module.exports = { tier1 };

if (require.main === module) {
  tier1().catch(err => { console.error(err); process.exit(1); });
}