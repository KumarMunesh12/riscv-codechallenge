'use strict';

/**
 * index.js  –  Entry point
 *
 * Runs all three tiers in sequence and prints a final summary.
 * Any tier may be run independently:
 *   node src/tier1.js
 *   node src/tier2.js
 *   node src/tier3.js
 *
 * Usage
 * ─────
 *   node index.js          run everything
 *   npm start              same via package.json script
 */

const { tier1 } = require('./src/tier1');
const { tier2 } = require('./src/tier2');
const { tier3 } = require('./src/tier3');

async function main() {
  const startTime = Date.now();

  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║          RISC-V Instruction Set Explorer                  ║');
  console.log('║          LFX Mentorship 2026 – Coding Challenge           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  /* ── Tier 1 ─────────────────────────────────────────────────── */
  const t1 = await tier1();
  if (!t1) { console.error('\nAborting: tier 1 failed.'); process.exit(1); }

  /* ── Tier 2 ─────────────────────────────────────────────────── */
  const t2 = await tier2();
  if (!t2) { console.error('\nAborting: tier 2 failed.'); process.exit(1); }

  /* ── Tier 3 ─────────────────────────────────────────────────── */
  const t3 = await tier3();
  if (!t3) { console.error('\nAborting: tier 3 failed.'); process.exit(1); }

  /* ── Final summary ──────────────────────────────────────────── */
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║   All tiers complete                                      ║');
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log(`║   Extensions parsed   : ${String(t1.sortedExtNames.length).padEnd(33)}║`);
  console.log(`║   Total instructions  : ${String(t1.totalInstrs).padEnd(33)}║`);
  console.log(`║   Multi-ext instrs    : ${String(t1.multiExt.length).padEnd(33)}║`);
  console.log(`║   Matched (JSON∩Man.) : ${String(t2.matched.length).padEnd(33)}║`);
  console.log(`║   JSON only           : ${String(t2.jsonOnly.length).padEnd(33)}║`);
  console.log(`║   Manual only         : ${String(t2.manualOnly.length).padEnd(33)}║`);
  console.log(`║   Graph edges         : ${String(t3.edges.length).padEnd(33)}║`);
  console.log(`║   Elapsed time        : ${String(elapsed + ' s').padEnd(33)}║`);
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log('║   Output files written to ./output/                       ║');
  console.log('║     tier1_summary.txt                                     ║');
  console.log('║     tier2_report.txt                                      ║');
  console.log('║     tier3_graph.txt                                       ║');
  console.log('║     tier3_ascii_graph.txt                                 ║');
  console.log('║     tier3_graph.json                                      ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
