# RISC-V Instruction Set Explorer

Submission for the **LFX Mentorship Summer 2026 — Mapping the RISC-V Extensions Landscape** coding challenge.

---

## Author

**Munesh Kumar**
- GitHub: [@KumarMunesh12](https://github.com/KumarMunesh12)
- Portfolio: [kumarmunesh.github.io](https://kumarmunesh12.github.io/Portfolio/)

---

## Project Overview

This tool completes all three tiers of the challenge in a single JavaScript project:

| Tier | Task | Status |
|------|------|--------|
| **Tier 1** | Parse `instr_dict.json`, group by extension, find multi-extension instructions | ✅ Required |
| **Tier 2** | Fetch ISA manual AsciiDoc files, cross-reference extension names, report gaps | ✅ Required |
| **Tier 3** | Build extension-sharing graph, save adjacency list + JSON edge list | ✅ Bonus |

---

## Requirements

- Node.js 14 or later
- npm
- Internet connection (fetches data from GitHub at runtime)

---

## Installation

```bash
git clone https://github.com/KumarMunesh12/riscv-instruction-explorer.git
cd riscv-instruction-explorer
npm install
```

---

## Usage

### Run all three tiers at once

```bash
npm start
```

### Run each tier individually

```bash
npm run tier1   # Instruction parsing only
npm run tier2   # Cross-reference only
npm run tier3   # Graph generation only
```

### Run tests

```bash
npm test             # all tests
npm run test:verbose # with test names printed
```

---

## Project Structure

```
riscv-instruction-explorer/
├── src/
│   ├── utils.js          # fetchJSON, fetchText, normalizeExtensionName, writeOutput
│   ├── tier1.js          # download + parse instr_dict.json, group by extension
│   ├── tier2.js          # fetch ISA manual files, cross-reference extensions
│   └── tier3.js          # build sharing graph, render adjacency list + JSON
├── tests/
│   ├── tier1.test.js     # unit tests: normalizeExtensionName, buildGraph, tier1()
│   └── tier2.test.js     # unit tests: extractFromAdoc, tier2()
├── output/               # auto-created at runtime, never committed to git
├── index.js              # runs all tiers, prints summary table
├── package.json
└── .gitignore
```

---

## Output Files

The `output/` directory is created automatically the first time you run any tier.
It is listed in `.gitignore` and is never committed.

| File | Created by | Contents |
|------|------------|----------|
| `tier1_summary.txt` | `tier1.js` | Extension table + multi-extension instruction list |
| `tier2_report.txt` | `tier2.js` | Matched / JSON-only / manual-only extension lists |
| `tier3_graph.txt` | `tier3.js` | Human-readable adjacency list with evidence mnemonics |
| `tier3_ascii_graph.txt` | `tier3.js` | One-line-per-edge ASCII diagram |
| `tier3_graph.json` | `tier3.js` | Machine-readable edge list for D3 / Gephi |

---

## Sample Output

### Tier 1 — `output/tier1_summary.txt`

```
TIER 1 — Extension Summary
────────────────────────────────────────────────────────────────────────
Extension     Instructions  Example mnemonic
────────────────────────────────────────────────────────────────────────
zba                      4  SH1ADD
zbb                     18  CLZ
zicsr                   12  CSRRW
...
────────────────────────────────────────────────────────────────────────
Total: 450 instructions across 42 extensions

Instructions shared by more than one extension
────────────────────────────────────────────────────────────────────────
  SH1ADD             zba, zbb
```

### Tier 2 — `output/tier2_report.txt`

```
TIER 2 — Cross-Reference Report
────────────────────────────────────────────────────────────────────────
35 matched, 7 in JSON only, 3 in manual only
────────────────────────────────────────────────────────────────────────

MATCHED  (35)
  zba  zbb  zbc  zbs  zicsr  zifencei  m  a  f  d  ...

IN JSON ONLY — not mentioned in the ISA manual  (7)
  zvkn                 4 instruction(s)
  ...

IN MANUAL ONLY — not present in instr_dict.json  (3)
  zfh  ...
```

### Tier 3 — `output/tier3_graph.txt`

```
TIER 3 — Extension Sharing Graph (adjacency list)
────────────────────────────────────────────────────────────────────────
zba  (1 neighbour)
  ├── zbb                  shared: SH1ADD

zbb  (3 neighbours)
  ├── zba                  shared: SH1ADD
  ├── zicsr                shared: CSRRW, CSRRS
  ├── m                    shared: MUL
```

---

## Key Design Decisions

### 1 — Extension name normalisation

The two data sources use different naming conventions:

| Source | Example |
|--------|---------|
| `instr_dict.json` | `rv_zba` |
| ISA manual AsciiDoc | `Zba` |

Both are normalised before any comparison using a single helper:

```javascript
// src/utils.js
function normalizeExtensionName(name) {
  return String(name)
    .replace(/^rv_/i, '')   // strip rv_ prefix
    .toLowerCase()           // case-insensitive
    .trim();
}
// rv_zba → zba    Zba → zba    ZBA → zba
```

### 2 — AsciiDoc token extraction (Tier 2)

A single compiled regex covers the three token shapes that appear in the
ISA manual source files:

```
Z[a-z][A-Za-z0-9]+        Z-extensions  (Zba, Zicsr, Zifencei …)
S[a-z][A-Za-z0-9]+        S-extensions  (Sscofpmf …)
RV[AB][0-9]{2}[USMH]?     profiles      (RVA22U64, RVB23 …)
[MAFCDQCVHBPNS]            single-letter (whole-word only)
```

AsciiDoc inline markup (`[.role]#token#`, `` `token` ``) is stripped
before matching so tokens inside markup are still found.

### 3 — Undirected sharing graph (Tier 3)

```
For each instruction that appears in N extensions:
  add an edge between every pair (N choose 2)
  record the mnemonic as evidence for that edge
```

Adjacency is stored as `Map<ext, Set<ext>>` for O(1) neighbour lookup.
Edges are output in three formats: human text, ASCII diagram, and JSON.

### 4 — Graceful network failure

Every `fetch` call is wrapped in a try/catch with a 15-second timeout.
A `null` return signals failure; callers log a warning and continue so
one missing manual file never aborts the entire run.

---

## Edge Cases Handled

| Edge case | How it is handled |
|-----------|-------------------|
| Instruction missing `ext` field | Skipped; logged as a parse warning |
| `ext` field is not an array | Skipped; logged as a parse warning |
| Extension name case mismatch | `normalizeExtensionName()` applied to both sides |
| Manual file returns 404 | `fetchText` returns `null`; file is silently skipped |
| Instruction in N > 2 extensions | All C(N,2) pairs added as graph edges |
| Duplicate token in same adoc file | `Set` deduplicates before returning |

---

## Testing

Tests are split into two files.
Pure-function tests run with no network; integration tests require GitHub access.

```
tests/tier1.test.js
  normalizeExtensionName()   6 pure tests   (no network)
  buildGraph()               8 pure tests   (no network)
  tier1()                    7 integration  (network, 30 s timeout)

tests/tier2.test.js
  extractFromAdoc()          8 pure tests   (no network)
  tier2()                    7 integration  (network, 60 s timeout)
```

Run the pure tests only (no network needed):

```bash
# Jest pattern filter — only describe blocks without "integration"
npx jest --testNamePattern="normalizeExtensionName|buildGraph|extractFromAdoc"
```

---

## Assumptions

1. `instr_dict.json` is fetchable from the `main` branch of
   `rpsene/riscv-extensions-landscape`.
2. ISA manual AsciiDoc files live under `src/` in the `main` branch of
   `riscv/riscv-isa-manual`. Files that return 404 are skipped without error.
3. Extension names can be compared after stripping `rv_` and lowercasing.
4. The machine running the tool has outbound HTTPS access to
   `raw.githubusercontent.com`.

---

## Performance

| Step | Typical time |
|------|-------------|
| Tier 1 (1 JSON download) | ~2 s |
| Tier 2 (20 AsciiDoc files) | ~10–20 s |
| Tier 3 (pure computation) | < 1 s |
| **Total** | **~15–25 s** |

---

## Troubleshooting

**`npm error ENOENT: package.json not found`**
You are not inside the project directory.
```bash
cd ~/riscv-instruction-explorer
npm install
```

**`fetchJSON failed` / `fetchText failed`**
GitHub is unreachable. Check your connection:
```bash
curl -I https://raw.githubusercontent.com
```

**Tests time out**
The default timeout is 60 s. If your connection is slow:
```bash
npx jest --testTimeout=120000
```

**`output/` directory not created**
Make sure you are running `node index.js` from the project root,
not from inside `src/`.

---

## Future Improvements

- Parallel `Promise.all` fetching to speed up Tier 2
- Cache downloaded files to `data/` so repeated runs skip network calls
- SVG / PNG graph rendering via Graphviz or D3
- Interactive React dashboard (same stack as the Extensions Landscape UI)
- CSV export for spreadsheet analysis

---

## Acknowledgements

- **rpsene** — maintainer of riscv-extensions-landscape
- **RISC-V International** — ISA specification and manual
- **LFX Mentorship Program** — for this opportunity

---

## License

MIT
