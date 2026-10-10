# STEP 2 — Internal CSV Import & Data-Quality Report

**Project:** AI Product Intelligence Advisor  
**Date:** 10 October 2026  
**Status:** **IMPLEMENTED AND VERIFIED ON SYNTHETIC DATA — contract review pending**  
**Basis:** `STEP_0_Product_Blueprint.md` §5.1 (steps 2–3), §8, §10, §14 (`ProductCatalogImport`); `STEP_1_Data_Domain_Foundation.md`; `docs/research/research-draft_v2.md` MOD-02, DATA-01/02/03, M1  
**Prompt standard:** Context → Goal → Constraints → Output → Verify

## 1. Context

STEP 1 delivered the domain types, Zod contracts and integrity checks, which the user declared complete on 10 Oct 2026. Every later capability (metrics, retrieval, advisor) needs trusted internal facts that trace back to their source rows. The database choice (ADR-003) and the Docker stack (FND-02) are still open, so this step stays in memory and storage-agnostic.

## 2. Goal

Import authorized **internal** CSV exports into a valid `DomainDataset`. There are five file kinds: catalog, sales, inventory, costs and prices. Each import returns an import run with raw-row lineage and per-row issues. A data-quality report is built across runs.

## 3. Constraints

- **Out of scope:**
  - databases, migrations, Docker, queues, workers and scheduling;
  - external or market sources;
  - fuzzy, probabilistic or alias matching (ID-02/03);
  - any business metric such as stock cover, margin or growth (MET-01, next step);
  - UI, LLM and RAG.
- `packages/ingestion` may import `packages/contracts` and `packages/domain`. `packages/domain` still must not import Zod.
- The importer never creates `DataSource` records. A source must already be registered (it is a governance record).
- Records are never silently overwritten (MOD-02: re-import must not duplicate).
- Fixtures are synthetic only (`SYN-`).

### 3.1 Failure levels

| Level | Conditions | Effect |
|---|---|---|
| **File refused** | unregistered source; source `rightsStatus` ≠ `authorized`; source kind not internal; cost file from a source that is not `confidential`/`restricted`; invalid UTF-8; malformed CSV (unterminated quote); missing required column; unknown column | No records accepted; run status `refused` with file-level issues |
| **Row rejected** | everything else (bad value, unknown/ambiguous merchant SKU, missing timestamp offset, unsupported currency, excess decimals, in-file conflict, Zod or integrity failure) | Row skipped; issue reports file, physical line, column, code |
| **Merge conflict** | same natural key already present with different content | Existing record kept; issue `conflict` |
| **Informational** | row identical to an earlier row in the same file | Counted once; issue `duplicate_row` (S2-DEC-15) |

## 4. Contract decisions (proposed, not approved ADRs)

| ID | Decision | Rationale / caveat |
|---|---|---|
| S2-DEC-01 | In-memory import: `importCsv()` → `ImportRun`; `mergeRun()` → new dataset | No storage lock-in before ADR-003 |
| S2-DEC-02 | Fact and source-reference IDs are `<prefix>_<first 24 hex chars of sha256(JSON of natural-key parts)>`; catalog rows keep the canonical IDs given in the file | Idempotent re-import. Hashing avoids collisions when key parts contain `_` and keeps IDs ≤ 128 characters. The readable key is stored in `SourceReference.recordKey` |
| S2-DEC-03 | Natural keys: sales = `transaction_id` + `line_no`; inventory = merchant SKU + location + `observed_at`; cost = merchant SKU + cost type + `effective_from`; price = merchant SKU + channel + price type + `observed_at`; catalog = the canonical IDs in the file | A transaction can have several lines |
| S2-DEC-04 | Same key with identical content (ignoring `ingestedAt` and `sourceReferenceId`) is a no-op that keeps the original lineage. Different content is a `conflict` and the existing record is kept | Superseding corrected exports is an open question |
| S2-DEC-05 | Facts reference SKUs by `merchant_sku` through exact lookup. Unknown → row rejected. Shared by several SKUs → `ambiguous_sku`, row rejected | Never take the first match; uniqueness of merchant SKU is STEP 1 open question 2 |
| S2-DEC-06 | Money: decimal string → integer minor units by string arithmetic. More decimals than the currency exponent → rejected (never rounded). Strict thousands grouping (`24,000.00`) accepted; any other comma form rejected | Thai exports often group thousands; decimal separator is always `.` |
| S2-DEC-07 | Currency exponents are an explicit run option (default `{ THB: 2 }`). Other currencies are rejected | ISO 4217 exponent is a fact, but supported currencies are a business choice |
| S2-DEC-08 | Timestamps need an offset. Values without one are rejected unless the run passes `assumeOffset`, which the run then records. Date-only values are always rejected | No silent time-zone assumption |
| S2-DEC-09 | `ingestedAt` comes from an injected clock (`now`) | Deterministic tests; separates record time from ingestion time |
| S2-DEC-10 | Each accepted row gets a `SourceReference` (`locator.kind = "file"`, `value = <file>#L<physical line>`). Each run keeps the file SHA-256 and the raw text of every row | Lineage to the raw row. The physical line differs from the row number when quoted fields contain newlines |
| S2-DEC-11 | Catalog aliases (`alias_th`, `alias_en`) are imported with `verified: false` unless `alias_verified` = `true` | Unverified aliases never create accepted links |
| S2-DEC-12 | UTF-8 only (BOM tolerated). TIS-620 / Windows-874 are refused | Limitation; add transcoding when a real source needs it |
| S2-DEC-13 | The quality report counts data problems and coverage gaps only. It contains no business metric | Metrics are MET-01 |
| S2-DEC-14 | If the source's `permittedUse.storeFullContent` is `false`, the run keeps line numbers and the file hash but sets raw row text to `null` | Honors §10 permitted storage; lineage stays verifiable against the original file |
| S2-DEC-15 | A row identical to an earlier row in the same file is counted once and reported as `duplicate_row` (informational, not rejected) | Double-exported lines stay visible in the quality report; it is separate from `rowsUnchanged` (already present before the run) |
| S2-DEC-16 | Import order: the catalog must be imported before facts | Fact rows resolve merchant SKUs against the catalog; otherwise every row is `unknown_sku` |

## 5. File formats

All headers are lowercase. Columns not listed here cause the file to be refused.

| Kind | Required columns | Optional columns |
|---|---|---|
| `catalog` | brand_id, brand_name, category_id, category_name, family_id, model_name, variant_id, sku_id, merchant_sku, status | model_code, gtin, alias_th, alias_en, alias_verified, `attr:<name>` |
| `sales` | transaction_id, line_no, merchant_sku, event_at, quantity, gross_revenue, currency | — |
| `inventory` | merchant_sku, location_code, observed_at, on_hand, reserved | — |
| `costs` | merchant_sku, cost_type, unit_cost, currency, effective_from | effective_to |
| `prices` | merchant_sku, channel_code, price_type, unit_price, currency, observed_at | — |

`attr:<name>` values that match `^-?\d+(\.\d+)?$` become numbers, `true`/`false` become booleans, and anything else stays a string. Empty optional cells mean `null`, or "absent" for attributes and aliases.

## 6. Output files

| File | Responsibility |
|---|---|
| `packages/ingestion/src/csv.ts` | RFC 4180 parser: quotes, `""` escapes, embedded newlines, CRLF, BOM. Tracks the physical start line and raw text of each row |
| `packages/ingestion/src/values.ts` | Cell parsers: counts, money → minor units (string arithmetic), offset-aware timestamps, enums, attributes |
| `packages/ingestion/src/import.ts` | `importCsv()`: file gates, header contract, per-kind row mapping, exact merchant-SKU lookup, row-atomic Zod validation, idempotent merge with conflict detection, source references, whole-dataset `parseDomainDataset()`; `emptyDataset()` |
| `packages/ingestion/src/quality.ts` | `buildQualityReport()`: per-run counts, issue counts by code, active-SKU coverage gaps, integrity issues |
| `packages/ingestion/src/index.ts` | Package exports |
| `tests/fixtures/csv/*.csv` | Synthetic sample exports: catalog (5 SKUs, Thai/English aliases, quoted commas), sales (multi-line transaction, grouped amounts), inventory, costs, prices |
| `tests/fixtures/csv/registry.ts` | Synthetic source registry (authorized internal ERP/catalog, expired internal, licensed external) and the sample-file manifest |
| `tests/ingestion.test.ts` | 34 tests: parser, value parsers, end-to-end import, idempotency, conflicts, lineage, file refusals, row rejections, quality report |
| `scripts/import-sample.ts` | `npm run import:sample`: imports the sample files and prints the quality report as JSON |
| `package.json`, `tsconfig*.json` | New `test` file entry and `import:sample` script; `scripts/` included in the typecheck; `erasableSyntaxOnly` enabled because Node type stripping rejects non-erasable TS syntax |

## 7. Verify — observed results

Environment: Node 22.23.1, zod 4.6.5, typescript 5.9.3, @types/node 22.20.5 (`package-lock.json`). Run at the repository root on 10 October 2026, after `rm -rf node_modules && npm ci`.

| Check | Command | Result |
|---|---|---|
| Full typecheck | `npm run typecheck` | **PASS** (exit 0) |
| Domain-only typecheck | `npm run typecheck:domain` | **PASS** (exit 0) |
| All tests | `npm test` | **PASS**: 64/64 (domain 18, contracts 12, ingestion 34), exit 0 |
| Domain tests | `npm run test:domain` | **PASS**: 18/18, exit 0 |
| Sample import | `npm run import:sample` | **PASS** (exit 0): 5 runs completed, 23/23 rows accepted, 0 rejected, 0 coverage gaps, 0 integrity issues |
| Domain stays Zod-free | `grep -rn zod packages/domain` | no matches |
| Mutation check | Disabled, one at a time: ambiguous-SKU guard, conflict detection, rights gate, excess-precision guard | Each mutation failed ≥ 1 test; code restored (run before S2-DEC-02/14/15 were added; those have their own tests) |

### Acceptance mapping (MOD-02)

| Criterion | Evidence |
|---|---|
| Re-import does not duplicate | "re-importing the same files adds nothing (idempotent)" yields an identical dataset and 0 records added |
| Job status and errors are visible | `ImportRun` status, counts, issues with file, line, column and code; `buildQualityReport()` |
| Timestamp and source reference kept | Every record has a `SourceReference` (`file#L<line>`, file hash in ID); raw rows kept on the run; `ingestedAt` comes from the injected clock |
| Expired or unauthorized data separated | Refusal tests: unregistered, expired, external, cost data from a non-confidential source |

## 8. Open questions

1. How should a corrected export supersede an earlier record (versioning vs. a correction event)?
2. Are merchant SKUs unique per organization or per channel? This decides when `ambiguous_sku` is expected.
3. Which time zone do real exports use, and do they include offsets?
4. What file encodings and delimiters do the real ERP/POS exports use?
5. Should returns and cancellations be negative sales lines or a separate fact (STEP 1 S1-DEC-03)?
6. Cross-source duplicates: the source ID is part of the key, so a transaction exported by both ERP and POS gets two records and MET-01 would double-count it. Is one source authoritative per fact kind?
