# STEP 3 — Versioned Deterministic Metric Definitions (MET-01)

**Project:** AI Product Intelligence Advisor  
**Date:** 10 October 2026  
**Status:** **IMPLEMENTED AND VERIFIED ON SYNTHETIC DATA — definitions proposed, owner review pending (DEC-004)**  
**Assumption:** The user asked to "continue with STEP 3" without naming its content. STEP 3 is taken to be MET-01, the step proposed after STEP 2 (blueprint §5.1 step 4; `research-draft_v2.md` MOD-03, MET-01).  
**Basis:** `STEP_0_Product_Blueprint.md` §5.1, §6 (INV-01, INV-07, INV-08, INV-09), §8.4, §9; `AI_Product_Intelligence_Advisor_Architecture.md` §9; `research-draft_v2.md` MOD-03; STEP 1 and STEP 2 records  
**Prompt standard:** Context → Goal → Constraints → Output → Verify

## 1. Context

STEP 2 imports trusted internal facts with lineage. The advisor workflow next needs **deterministic metrics**: versioned formulas over trusted facts (knowledge class "deterministic metric", blueprint §8.4). The LLM must never compute them (INV-01).

Who owns the metric definitions is still open (DEC-004). Every definition below is therefore **proposed**. A formula changes only with a version bump.

## 2. Goal

Build `packages/metrics`, which contains:

1. a registry of metric definitions;
2. pure functions that compute each metric for one SKU over one time window, from a `DomainDataset`.

Each result returns a number **or** a visible reason. It always carries its formula version, the inputs used, the inputs excluded, the data time and its sensitivity.

## 3. Constraints

- **In scope:**
  - pure TypeScript that depends only on `packages/domain`, with no Zod, no LLM and no I/O;
  - internal-data metrics for one SKU and one window.
- **Out of scope:**
  - signals and labels (SIG-01);
  - thresholds, scores, ranking, business rules (DEC-01);
  - any judgment such as "high", "overstocked" or "promote".
  - "Stock pressure" in blueprint §5.1 is delivered as stock cover in days, a number and not a verdict.
- **Deferred:**
  - competitor price gap, because there are no authorized external prices yet;
  - aged inventory, because there are no receipt dates;
  - net revenue, because there is no deduction, return or discount data (STEP 2 open question 5);
  - promotion performance and lift, because they need a baseline or control (INV-07).
- **No fabricated values:** the sample numbers in the research reports never appear in fixtures or docs.

## 4. Shared rules (every definition)

| Rule | Definition |
|---|---|
| Window | Half-open `[start, end)`, ISO 8601 date-time with seconds and an offset. A fact belongs to the window by `eventAt` (sales) or `observedAt` (stock). A missing offset, a date-only value, an unparseable value or `end ≤ start` throws `MetricInputError`. It is never reported as missing data, and the host time zone is never used |
| Time zone | Never converted. Windows and facts carry their own offsets, and comparison is by absolute instant |
| Point in time | Optional `knownAt`: only facts with `ingestedAt ≤ knownAt` are used, so a past answer can be recalculated with the same formula version |
| Rights | Only facts whose source is `authorized` are used. Others are listed in `excludedInputs` with a reason (INV-08) |
| Single source | If authorized sales for the SKU in the window come from more than one source, the result is `insufficient_data` / `multiple_sales_sources`. Sources are never summed (STEP 2 open question 6) |
| No rows ≠ zero | A window with no fact rows returns `no_data`, never `0` or `Infinity`. The system cannot tell "sold nothing" from "export did not cover it" (INV-09) |
| Money | Integer minor units. Integer sums are done first, with one division at the end. All money inputs share one currency, or the result is `insufficient_data` |
| Data time | `dataAsOf` for stock is the **oldest** snapshot used. For sales it is the latest `eventAt` used. A metric that combines parts from the same window takes the oldest part. Growth reports the current window's data time, not the baseline's |
| Sensitivity | The highest sensitivity of the input sources (`public` < `internal` < `confidential` < `restricted`). Any metric that uses cost is therefore at least `confidential` |
| Result status | `computed` (value set), `no_data` (no rows), or `insufficient_data` (rows exist but the formula cannot be applied safely). `reasons` lists machine-readable codes |

## 5. Metric definitions v1 (proposed, DEC-004)

| Metric | Formula | Unit | Missing-data policy |
|---|---|---|---|
| `units_sold` v1 | Σ `quantitySold` of sales in the window | units | No rows → `no_data` (`no_sales_rows`) |
| `gross_revenue` v1 | Σ `grossRevenueMinor` of sales in the window | minor units of the single currency | No rows → `no_data`. Mixed currencies → `insufficient_data` (`mixed_currency`) |
| `sales_growth_units` v1 | (U − U_prev) / U_prev. U_prev is `units_sold` over the window of equal length that ends at `start` | ratio | Either window `no_data` → `no_data`. U_prev = 0 → `insufficient_data` (`zero_baseline`) |
| `realized_gross_margin_ratio` v1 (parameter `costType`, required) | (R − Σ qtyᵢ × costᵢ) / R. R is `gross_revenue`, and costᵢ is the cost of `costType` effective at saleᵢ `eventAt` (`effectiveFrom ≤ eventAt < effectiveTo`) | ratio | No sales → `no_data`. R = 0 → `zero_revenue`. A sale with no cost → `missing_cost`. Overlapping costs of the type → `overlapping_cost`. Currency differs → `currency_mismatch`. Cost types are never mixed |
| `available_stock` v1 | Σ over locations of (`onHand − reserved`), using the latest snapshot per location with `observedAt < end` | units | No snapshots → `no_data` (`no_inventory_snapshots`). `dataAsOf` = oldest snapshot used. Staleness is reported, not judged (DEC-009) |
| `stock_cover_days` v1 | `available_stock` / (`units_sold` / window days) | days | Either part not computed → same status. `units_sold` = 0 → `insufficient_data` (`no_sales_in_window`), never `Infinity` |
| `sell_through_proxy` v1 | `units_sold` / (`units_sold` + `available_stock`) | ratio | **Proxy:** no receipts data, so this is not a true sell-through. Denominator 0 → `insufficient_data` (`zero_denominator`) |

Gross revenue is "before discounts and returns as exported". Whether the export already nets these out depends on the source (DEC-004, STEP 2 open question 5).

## 6. Output files

| File | Responsibility |
|---|---|
| `packages/metrics/src/definitions.ts` | `METRIC_DEFINITIONS` registry: id, version, status, unit, formula text, inputs, parameters, missing-data policy |
| `packages/metrics/src/compute.ts` | One function per metric, plus `computeSkuMetrics()`. Handles source authorization, `knownAt`, single-source check, sensitivity propagation and `dataAsOf` rules. Produces typed `MetricResult` |
| `packages/metrics/src/index.ts` | Package exports |
| `tests/fixtures/metrics.ts` | Synthetic golden fixture: 8 SKUs. Each SKU isolates one rule (window edges, late ingestion, unverified source, zero line, two sources, missing, overlapping or foreign-currency cost, mixed currency) |
| `tests/metrics.test.ts` | 18 tests. Golden values were computed by hand before the code ran. Covers the missing-data policy, sensitivity, the v1 pin and a purity check |
| `scripts/metrics-sample.ts` | `npm run metrics:sample`: imports the STEP 2 sample CSVs and prints v1 metrics per active SKU for September 2026 |

## 7. Verify — observed results

Environment: Node 22.23.1, zod 4.6.5, typescript 5.9.3 (`package-lock.json`). Run at the repository root on 10 October 2026, after `rm -rf node_modules && npm ci`.

| Check | Command | Result |
|---|---|---|
| Full typecheck | `npm run typecheck` | **PASS** (exit 0) |
| Domain-only typecheck | `npm run typecheck:domain` | **PASS** (exit 0) |
| All tests | `npm test` | **PASS**: 82/82 (domain 18, contracts 12, ingestion 34, metrics 18), exit 0 |
| Domain tests | `npm run test:domain` | **PASS** (exit 0) |
| Sample import | `npm run import:sample` | **PASS** (exit 0) |
| Sample metrics | `npm run metrics:sample` | **PASS** (exit 0). Spot-checked by hand for SYN-AX25-55: 4 units, 9,600,000 satang, margin 0.3, stock 10, cover 75 days, growth `no_data` (no August rows in the sample) |
| Purity | `grep -rln zod packages/domain packages/metrics` | no matches |
| Mutation check | Disabled, one at a time: no-rows guard, rights exclusion, multi-source check, overlapping-cost check, cost-type filter, zero-sales cover guard, oldest-`dataAsOf` rule, input validation, growth data time | All 9 mutations failed ≥ 1 test; code restored |

### Acceptance mapping (MOD-03 / MOD-06)

| Criterion | Status |
|---|---|
| Every metric has a formula version | Met: registry plus `version` on every result. The pin test forces a version bump when a formula changes |
| Results match SQL ground truth | **Partly met.** Hand-computed golden values are used, because there is no SQL store yet (ADR-003) |
| Time zone, currency, filters supported | Met for time zone (absolute instants with explicit offsets), currency (single-currency rule) and SKU/window/`knownAt`. Category-level aggregation is not built |
| Recalculate with the same formula version | Met: `knownAt` cutoff on `ingestedAt` |
| No LLM as calculator; traceable to inputs | Met: pure functions; `inputIds` and `excludedInputs` on every result |

## 8. Open questions

1. Who owns and approves these definitions (DEC-004)? Are the names and formulas right for the business?
2. Source coverage periods: to tell zero sales from missing data, each import needs the period it covers.
3. Which cost type is authoritative for margin: `purchase` or `landed`? STEP 4 makes this a required `costType` field of the owner policy.
4. Freshness thresholds per metric (DEC-009). Today `dataAsOf` is exposed but not judged.
5. Should `sell_through_proxy` be replaced when receipts or opening-stock data exist?
6. MOD-03 asks for results that match "SQL ground truth". No SQL store exists yet (ADR-003). This step uses hand-computed golden values instead.
7. Sensitivity granularity (DEC-008): sensitivity is taken per source. Units and stock from the confidential ERP source are therefore `confidential`, so an analyst without cost permission would see no units or stock. Blueprint §11.4 gates only price, cost and margin. Is field-level classification needed?
