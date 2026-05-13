'use strict';

/**
 * tier2.js  –  Cross-Reference with the ISA Manual
 *
 * Strategy (3 layers, first that works wins):
 *   1. Fetch raw AsciiDoc files from raw.githubusercontent.com
 *   2. Fetch file list + blobs via GitHub REST API (no auth needed)
 *   3. Built-in fallback list compiled from the published ISA manual v20240411
 *
 * This means tier2 always produces a meaningful result even when
 * raw.githubusercontent.com is blocked or rate-limited.
 */

const { fetchText, normalizeExtensionName, writeOutput } = require('./utils');
const { tier1 }                                          = require('./tier1');

/* ─── Layer 1: known raw file paths ─────────────────────────── */

const BASE_RAW =
  'https://raw.githubusercontent.com/riscv/riscv-isa-manual/main/src/';

const MANUAL_FILES = [
  'rv32.adoc',         'rv64.adoc',        'rv-32-64g.adoc',
  'naming.adoc',       'm-st-ext.adoc',    'a-st-ext.adoc',
  'f-st-ext.adoc',     'd-st-ext.adoc',    'q-st-ext.adoc',
  'c-st-ext.adoc',     'v-st-ext.adoc',    'zifencei.adoc',
  'zicsr.adoc',        'zicond.adoc',      'zfinx.adoc',
  'zimop.adoc',        'unpriv-cfi.adoc',  'supervisor.adoc',
  'hypervisor.adoc',   'machine.adoc',     'counters.adoc',
];

/* ─── Layer 3: built-in fallback ────────────────────────────── */

const KNOWN_MANUAL_EXTENSIONS = new Set([
  'i','e','m','a','f','d','q','c','v','h','g',
  'zifencei','zicsr','zicond','zicbo','zicbom','zicbop','zicboz',
  'zihintpause','zihintntl','zimop','zicfilp','zicfiss',
  'zfinx','zdinx','zhinx','zhinxmin',
  'zfh','zfhmin','zfbfmin',
  'zba','zbb','zbc','zbs',
  'zbkb','zbkc','zbkx',
  'zk','zkn','zknd','zkne','zknh','zkr','zks','zksed','zksh','zkt',
  'zvbb','zvbc','zvkg','zvkn','zvkned','zvknha','zvknhb',
  'zvks','zvksed','zvksh','zvkt',
  'zawrs','zacas','zabha','zalasr',
  'zcb','zcmop','zcmp','zcmt',
  'zvfbfmin','zvfbfwma',
  's','svinval','svnapot','svpbmt','sscofpmf',
  'smrnmi','smstateen','smdbltrp',
  'sdext','sdtrig','system',
]);

/* ─── Token regex ────────────────────────────────────────────── */

const TOKEN_RE = new RegExp(
  '\\bZ[a-z][A-Za-z0-9]+\\b'     +
  '|\\bS[a-z][A-Za-z0-9]+\\b'    +
  '|\\bRV[AB][0-9]{2}[USMH]?\\b' +
  '|(?<![A-Za-z])[MAFCDQCVHBPNS](?![A-Za-z])',
  'g'
);

function extractFromAdoc(src) {
  if (!src) return [];
  const cleaned = src
    .replace(/\[.*?\]#(.*?)#/g, ' $1 ')
    .replace(/`([^`]+)`/g, ' $1 ');
  const found = new Set();
  let m;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(cleaned)) !== null) {
    const norm = normalizeExtensionName(m[0]);
    if (norm) found.add(norm);
  }
  return [...found];
}

/* ─── Layer 1 ────────────────────────────────────────────────── */

async function tryRawFiles() {
  const found = new Set();
  let fetched = 0;
  for (const file of MANUAL_FILES) {
    const src = await fetchText(BASE_RAW + file);
    if (src) { fetched++; extractFromAdoc(src).forEach(e => found.add(e)); }
  }
  return { fetched, found };
}

/* ─── Layer 2 ────────────────────────────────────────────────── */

async function tryGitHubAPI() {
  const found = new Set();
  let fetched = 0;
  try {
    const treeSrc = await fetchText(
      'https://api.github.com/repos/riscv/riscv-isa-manual/git/trees/main?recursive=1'
    );
    if (!treeSrc) return { fetched: 0, found };
    const tree = JSON.parse(treeSrc);
    if (!Array.isArray(tree.tree)) return { fetched: 0, found };
    const adocFiles = tree.tree
      .filter(f => f.path && f.path.startsWith('src/') && f.path.endsWith('.adoc'))
      .slice(0, 30);
    for (const file of adocFiles) {
      const src = await fetchText(
        `https://raw.githubusercontent.com/riscv/riscv-isa-manual/main/${file.path}`
      );
      if (src) { fetched++; extractFromAdoc(src).forEach(e => found.add(e)); }
    }
  } catch { /* ignore */ }
  return { fetched, found };
}

/* ─── Main ───────────────────────────────────────────────────── */

async function tier2() {
  const DIVIDER = '─'.repeat(72);

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║   TIER 2 — Cross-Reference with the ISA Manual   ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  const t1 = await tier1();
  if (!t1) { console.error('ERROR: tier1 failed.'); return null; }

  const jsonExts = new Set(t1.sortedExtNames.map(normalizeExtensionName));

  console.log('Scanning ISA manual source files …');

  let manualExts, source;

  const raw = await tryRawFiles();
  if (raw.fetched > 0) {
    manualExts = raw.found;
    source = `raw.githubusercontent.com  (${raw.fetched} files fetched)`;
  } else {
    console.log('  raw fetch failed — trying GitHub REST API …');
    const api = await tryGitHubAPI();
    if (api.fetched > 0) {
      manualExts = api.found;
      source = `GitHub REST API  (${api.fetched} files fetched)`;
    } else {
      console.log('  API fetch failed — using built-in fallback list …');
      manualExts = KNOWN_MANUAL_EXTENSIONS;
      source = 'built-in fallback  (compiled from ISA manual v20240411)';
    }
  }

  console.log(`  ✓ source: ${source}`);
  console.log(`  ✓ ${manualExts.size} unique extensions found in manual\n`);

  const matched    = [...jsonExts].filter(e => manualExts.has(e)).sort();
  const jsonOnly   = [...jsonExts].filter(e => !manualExts.has(e)).sort();
  const manualOnly = [...manualExts].filter(e => !jsonExts.has(e)).sort();

  const lines = [];
  lines.push('TIER 2 — Cross-Reference Report');
  lines.push(DIVIDER);
  lines.push(`Source: ${source}`);
  lines.push(DIVIDER);
  lines.push(`${matched.length} matched, ${jsonOnly.length} in JSON only, ${manualOnly.length} in manual only`);
  lines.push(DIVIDER);

  lines.push('');
  lines.push(`MATCHED  (${matched.length})`);
  lines.push('Extensions present in both instr_dict.json and the ISA manual:');
  if (matched.length > 0) {
    for (let i = 0; i < matched.length; i += 8)
      lines.push('  ' + matched.slice(i, i + 8).join('  '));
  } else {
    lines.push('  (none)');
  }

  lines.push('');
  lines.push(`IN JSON ONLY — not mentioned in the ISA manual  (${jsonOnly.length})`);
  if (jsonOnly.length > 0) {
    for (const ext of jsonOnly) {
      const count = t1.extensionMap[ext]?.length ?? 0;
      lines.push(`  ${ext.padEnd(22)}  ${count} instruction(s)`);
    }
  } else {
    lines.push('  (none)');
  }

  lines.push('');
  lines.push(`IN MANUAL ONLY — not present in instr_dict.json  (${manualOnly.length})`);
  if (manualOnly.length > 0) {
    for (let i = 0; i < manualOnly.length; i += 8)
      lines.push('  ' + manualOnly.slice(i, i + 8).join('  '));
  } else {
    lines.push('  (none)');
  }

  lines.push('');
  lines.push(DIVIDER);
  lines.push('Naming differences handled by stripping "rv_" prefix and lower-casing.');

  const output = lines.join('\n') + '\n';
  console.log(output);
  writeOutput('tier2_report.txt', output);

  return { matched, jsonOnly, manualOnly };
}

module.exports = { tier2, extractFromAdoc };

if (require.main === module) {
  tier2().catch(err => { console.error(err); process.exit(1); });
}