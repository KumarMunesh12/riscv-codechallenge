'use strict';

/**
 * tier3.js  –  Extension-Sharing Graph  (Bonus)
 *
 * Task
 * ────
 * Generate a graph where:
 *   • Each NODE   is an extension.
 *   • Each EDGE   connects two extensions that share at least one instruction.
 *
 * Output
 * ──────
 * 1. A console-friendly adjacency list printed to stdout.
 * 2. A plain-text "ASCII arc" diagram saved to output/tier3_graph.txt.
 * 3. A machine-readable JSON edge list saved to output/tier3_graph.json
 *    (useful for importing into Gephi, D3, etc.).
 *
 * Unit tests for this tier live in tests/tier1.test.js (graph-building
 * helpers are exported and tested there together with tier-1 logic).
 */

const { writeOutput }         = require('./utils');
const { tier1 }               = require('./tier1');
const fs                      = require('fs');
const path                    = require('path');

/* ─── Graph builder ──────────────────────────────────────────── */

/**
 * Build an undirected adjacency map from the extensionMap produced
 * by tier1.
 *
 * Algorithm
 * ─────────
 * For every instruction that appears in more than one extension we add
 * a bidirectional edge between every pair of those extensions.
 * We also record WHICH instructions are responsible for each edge so
 * the report can show evidence.
 *
 * @param {Object.<string, string[]>} extensionMap
 * @returns {{
 *   adjacency : Object.<string, Set<string>>,
 *   evidence  : Object.<string, string[]>,   // "extA::extB" → [mnemonics]
 *   edges     : Array<{a: string, b: string, shared: string[]}>,
 * }}
 */
function buildGraph(extensionMap) {
  // Invert the map: mnemonic → [ext, ext, …]
  const mnemonicToExts = {};

  for (const [ext, mnemonics] of Object.entries(extensionMap)) {
    for (const m of mnemonics) {
      if (!mnemonicToExts[m]) mnemonicToExts[m] = [];
      mnemonicToExts[m].push(ext);
    }
  }

  // Build adjacency
  const adjacency = {};   // ext → Set<ext>
  const evidence  = {};   // "a::b" → [mnemonic, …]   (a < b lexicographically)

  for (const [mnemonic, exts] of Object.entries(mnemonicToExts)) {
    if (exts.length < 2) continue;   // only shared instructions matter

    for (let i = 0; i < exts.length; i++) {
      for (let j = i + 1; j < exts.length; j++) {
        const a   = exts[i];
        const b   = exts[j];
        const key = a < b ? `${a}::${b}` : `${b}::${a}`;

        // Adjacency
        if (!adjacency[a]) adjacency[a] = new Set();
        if (!adjacency[b]) adjacency[b] = new Set();
        adjacency[a].add(b);
        adjacency[b].add(a);

        // Evidence
        if (!evidence[key]) evidence[key] = [];
        evidence[key].push(mnemonic);
      }
    }
  }

  // Flatten to edge list (sorted for deterministic output)
  const edges = Object.entries(evidence)
    .map(([key, shared]) => {
      const [a, b] = key.split('::');
      return { a, b, shared: shared.sort() };
    })
    .sort((x, y) => x.a.localeCompare(y.a) || x.b.localeCompare(y.b));

  return { adjacency, evidence, edges };
}

/* ─── Renderers ──────────────────────────────────────────────── */

/**
 * Render a human-readable adjacency list.
 *
 * @param {Object.<string, Set<string>>} adjacency
 * @param {Object.<string, string[]>}    evidence
 * @returns {string}
 */
function renderAdjacencyList(adjacency, evidence) {
  const DIVIDER = '─'.repeat(72);
  const lines   = [];

  lines.push('TIER 3 — Extension Sharing Graph (adjacency list)');
  lines.push(DIVIDER);
  lines.push('Each extension is listed with the extensions it shares instructions with.');
  lines.push('');

  const allExts = Object.keys(adjacency).sort();

  if (allExts.length === 0) {
    lines.push('  No shared instructions found.');
    return lines.join('\n');
  }

  for (const ext of allExts) {
    const neighbours = [...adjacency[ext]].sort();
    lines.push(`${ext}  (${neighbours.length} neighbour${neighbours.length !== 1 ? 's' : ''})`);

    for (const nb of neighbours) {
      const key     = ext < nb ? `${ext}::${nb}` : `${nb}::${ext}`;
      const shared  = evidence[key] ?? [];
      const preview = shared.slice(0, 3).map(m => m.toUpperCase()).join(', ');
      const more    = shared.length > 3 ? ` +${shared.length - 3} more` : '';
      lines.push(`  ├── ${nb.padEnd(20)} shared: ${preview}${more}`);
    }

    lines.push('');
  }

  lines.push(DIVIDER);
  lines.push(
    `${allExts.length} nodes,  ` +
    `${Object.keys(evidence).length} edges`
  );

  return lines.join('\n');
}

/**
 * Render a compact ASCII-art graph (nodes as boxes, edges as lines).
 * This is intentionally simple – the focus is on the data, not layout.
 *
 * @param {Array<{a: string, b: string, shared: string[]}>} edges
 * @param {string[]} allExts
 * @returns {string}
 */
function renderASCIIGraph(edges, allExts) {
  const lines = [];

  lines.push('TIER 3 — ASCII Edge List');
  lines.push('─'.repeat(72));
  lines.push(
    'Format:  [extensionA] ──(N shared)── [extensionB]  : mnemonic, …'
  );
  lines.push('');

  for (const { a, b, shared } of edges) {
    const label   = `(${shared.length} shared)`;
    const preview = shared.slice(0, 4).map(m => m.toUpperCase()).join(', ');
    const more    = shared.length > 4 ? ` …` : '';
    lines.push(
      `  [${a}] ──${label}── [${b}]` +
      `\n    ↳ ${preview}${more}\n`
    );
  }

  if (edges.length === 0) {
    lines.push('  (no shared instructions between extensions)');
  }

  lines.push('─'.repeat(72));
  lines.push(`${allExts.length} extensions,  ${edges.length} edges`);

  return lines.join('\n');
}

/* ─── Main ───────────────────────────────────────────────────── */

async function tier3() {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║   TIER 3 — Extension-Sharing Graph (Bonus)       ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  /* 1 ── Get data from tier1 ───────────────────────────────────── */
  const t1 = await tier1();
  if (!t1) {
    console.error('ERROR: tier1 failed; cannot build graph.');
    return null;
  }

  /* 2 ── Build graph ───────────────────────────────────────────── */
  console.log('Building extension-sharing graph …');
  const { adjacency, evidence, edges } = buildGraph(t1.extensionMap);

  const allExts = t1.sortedExtNames;
  console.log(
    `  ✓ ${allExts.length} nodes,  ` +
    `${edges.length} edges\n`
  );

  /* 3 ── Render adjacency list ─────────────────────────────────── */
  const adjText = renderAdjacencyList(adjacency, evidence);
  console.log(adjText);
  writeOutput('tier3_graph.txt', adjText);

  /* 4 ── Render ASCII diagram ──────────────────────────────────── */
  const asciiText = renderASCIIGraph(edges, allExts);
  writeOutput('tier3_ascii_graph.txt', asciiText);

  /* 5 ── Save machine-readable JSON edge list ──────────────────── */
  const graphJSON = JSON.stringify(
    {
      nodes : allExts.map(id => ({ id })),
      edges : edges.map(({ a, b, shared }) => ({
        source  : a,
        target  : b,
        weight  : shared.length,
        shared,
      })),
    },
    null,
    2
  );

  writeOutput('tier3_graph.json', graphJSON);

  return { adjacency, evidence, edges, allExts };
}

/* ─── Exports & direct run ───────────────────────────────────── */

module.exports = { tier3, buildGraph, renderAdjacencyList };

if (require.main === module) {
  tier3().catch(err => { console.error(err); process.exit(1); });
}
