import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  METRIC_DEFINITIONS, availableStock, computeSkuMetrics, grossRevenue, realizedGrossMarginRatio,
  salesGrowthUnits, sellThroughProxy, stockCoverDays, unitsSold, MetricInputError,
} from "../packages/metrics/src/index.ts";
import { parseDomainDataset } from "../packages/contracts/src/index.ts";
import { metricsDataset as ds, SEPTEMBER } from "./fixtures/metrics.ts";

const close = (actual: number | null, expected: number) => {
  assert.notEqual(actual, null);
  assert.ok(Math.abs(actual! - expected) < 1e-12, `${actual} ≠ ${expected}`);
};

test("golden fixture itself is a valid dataset", () => {
  parseDomainDataset(structuredClone(ds));
});

// ---------- golden values (hand-computed, see tests/fixtures/metrics.ts) ----------

test("units_sold: half-open window, unauthorized source excluded", () => {
  const r = unitsSold(ds, "sku_a", SEPTEMBER);
  assert.equal(r.status, "computed");
  assert.equal(r.value, 5); // a2 1 + a3 3 + a4 1; a5 at window end and a6 (unverified) excluded
  assert.deepEqual(r.inputIds.sort(), ["a2", "a3", "a4"]);
  assert.deepEqual(r.excludedInputs, [{ id: "a6", reason: "unauthorized_source" }]);
  assert.equal(r.dataAsOf, "2026-09-30T23:00:00+07:00");
});
test("gross_revenue: integer minor units with currency", () => {
  const r = grossRevenue(ds, "sku_a", SEPTEMBER);
  assert.equal(r.value, 9_700_000);
  assert.equal(r.currency, "THB");
  assert.equal(r.sensitivity, "confidential");
});
test("sales_growth_units: equal-length previous window", () => {
  const growth = salesGrowthUnits(ds, "sku_a", SEPTEMBER);
  close(growth.value, 1.5); // (5 − 2) / 2
  assert.equal(growth.dataAsOf, "2026-09-30T23:00:00+07:00", "data time of the current window, not the baseline");
});
test("realized_gross_margin_ratio: cost effective at each sale, per cost type", () => {
  // purchase: 1×15,000 (ca1) + 3×16,000 (ca2, effective from 10 Sep) + 1×16,000 (ca2) = 79,000 THB
  const purchase = realizedGrossMarginRatio(ds, "sku_a", SEPTEMBER, "purchase");
  close(purchase.value, 1_800_000 / 9_700_000);
  assert.deepEqual(purchase.parameters, { costType: "purchase" });
  assert.equal(purchase.sensitivity, "confidential");
  // landed: 5 × 17,000 = 85,000 THB
  close(realizedGrossMarginRatio(ds, "sku_a", SEPTEMBER, "landed").value, 1_200_000 / 9_700_000);
});
test("available_stock: latest snapshot per location before window end; dataAsOf is the oldest used", () => {
  const r = availableStock(ds, "sku_a", SEPTEMBER);
  assert.equal(r.value, 11); // BKK 8−1 (29 Sep) + CNX 4−0 (25 Sep); 2 Oct snapshot excluded
  assert.deepEqual(r.inputIds.sort(), ["ia2", "ia3"]);
  assert.equal(r.dataAsOf, "2026-09-25T22:00:00+07:00");
});
test("stock_cover_days and sell_through_proxy", () => {
  const cover = stockCoverDays(ds, "sku_a", SEPTEMBER);
  close(cover.value, 66); // 11 / (5 / 30)
  assert.equal(cover.dataAsOf, "2026-09-25T22:00:00+07:00", "combined metric takes the oldest part");
  assert.equal(sellThroughProxy(ds, "sku_a", SEPTEMBER).value, 0.3125); // 5 / (5 + 11)
});
test("knownAt recalculates a past answer: late-ingested sale is left out", () => {
  const opts = { knownAt: "2026-10-02T00:00:00+07:00" };
  assert.equal(unitsSold(ds, "sku_a", SEPTEMBER, opts).value, 2);
  assert.equal(grossRevenue(ds, "sku_a", SEPTEMBER, opts).value, 4_000_000);
  assert.equal(unitsSold(ds, "sku_a", SEPTEMBER, opts).knownAt, "2026-10-02T00:00:00+07:00");
});

// ---------- missing-data policy ----------

test("no sales rows is no_data, never zero", () => {
  const r = unitsSold(ds, "sku_b", SEPTEMBER);
  assert.deepEqual([r.status, r.value, r.reasons], ["no_data", null, ["no_sales_rows"]]);
  assert.equal(stockCoverDays(ds, "sku_b", SEPTEMBER).status, "no_data");
  assert.equal(availableStock(ds, "sku_b", SEPTEMBER).value, 5);
});
test("a real zero-quantity row is zero; stock cover is not Infinity", () => {
  assert.equal(unitsSold(ds, "sku_c", SEPTEMBER).value, 0);
  const cover = stockCoverDays(ds, "sku_c", SEPTEMBER);
  assert.deepEqual([cover.status, cover.value, cover.reasons], ["insufficient_data", null, ["no_sales_in_window"]]);
  assert.deepEqual(realizedGrossMarginRatio(ds, "sku_c", SEPTEMBER, "purchase").reasons, ["zero_revenue"]);
  assert.equal(sellThroughProxy(ds, "sku_c", SEPTEMBER).value, 0);
});
test("growth with no previous rows is no_data", () => {
  assert.equal(salesGrowthUnits(ds, "sku_c", SEPTEMBER).status, "no_data");
});
test("sales from two sources are flagged, not summed", () => {
  const r = unitsSold(ds, "sku_d", SEPTEMBER);
  assert.deepEqual([r.status, r.value, r.reasons], ["insufficient_data", null, ["multiple_sales_sources"]]);
});
test("margin: missing, overlapping and foreign-currency costs are insufficient_data", () => {
  const missing = realizedGrossMarginRatio(ds, "sku_e", SEPTEMBER, "purchase");
  assert.deepEqual([missing.status, missing.reasons, missing.details], ["insufficient_data", ["missing_cost"], ["e1"]]);
  assert.deepEqual(realizedGrossMarginRatio(ds, "sku_f", SEPTEMBER, "purchase").reasons, ["overlapping_cost"]);
  assert.deepEqual(realizedGrossMarginRatio(ds, "sku_g", SEPTEMBER, "purchase").reasons, ["currency_mismatch"]);
  assert.deepEqual(realizedGrossMarginRatio(ds, "sku_a", SEPTEMBER, "other").reasons, ["missing_cost"]);
});
test("mixed sale currencies block revenue but not units", () => {
  assert.deepEqual(grossRevenue(ds, "sku_h", SEPTEMBER).reasons, ["mixed_currency"]);
  assert.equal(unitsSold(ds, "sku_h", SEPTEMBER).value, 2);
});
test("sensitivity propagates from inputs: cost makes margin confidential", () => {
  assert.equal(unitsSold(ds, "sku_e", SEPTEMBER).sensitivity, "internal");
  assert.equal(realizedGrossMarginRatio(ds, "sku_e", SEPTEMBER, "purchase").sensitivity, "confidential");
});

// ---------- versioning and scope ----------

test("v1 results are pinned: a formula change must bump the version", () => {
  assert.ok(Object.values(METRIC_DEFINITIONS).every((d) => d.version === 1 && d.status === "proposed"));
  const pinned = computeSkuMetrics(ds, "sku_a", SEPTEMBER, "purchase").map((r) => [r.metric, r.version, r.status, r.value === null ? null : Number(r.value.toFixed(9))]);
  assert.deepEqual(pinned, [
    ["units_sold", 1, "computed", 5],
    ["gross_revenue", 1, "computed", 9_700_000],
    ["sales_growth_units", 1, "computed", 1.5],
    ["realized_gross_margin_ratio", 1, "computed", 0.18556701],
    ["available_stock", 1, "computed", 11],
    ["stock_cover_days", 1, "computed", 66],
    ["sell_through_proxy", 1, "computed", 0.3125],
  ]);
});
test("metrics package stays pure: no Zod, no I/O, no judgment labels", () => {
  for (const file of ["compute.ts", "definitions.ts", "index.ts"]) {
    const source = readFileSync(new URL(`../packages/metrics/src/${file}`, import.meta.url), "utf8");
    assert.ok(!/from "zod"|node:fs|node:http|fetch\(/.test(source), file);
    assert.ok(!/"(high|low|overstock\w*|promote|good|bad)"/i.test(source), file);
  }
});

test("malformed windows and knownAt throw instead of looking like missing sales", () => {
  const bad: [Partial<typeof SEPTEMBER>, string | undefined][] = [
    [{ start: "2026-09-01T00:00:00" }, undefined],          // no offset: host time zone would leak in
    [{ start: "2026-09-01" }, undefined],                   // date only
    [{ end: "not-a-date" }, undefined],                     // unparseable
    [{ end: "2026-09-01T00:00:00+07:00" }, undefined],      // end ≤ start
    [{}, "2026-10-02T00:00:00"],                            // knownAt without offset
  ];
  for (const [patch, knownAt] of bad) {
    const options = knownAt === undefined ? {} : { knownAt };
    assert.throws(() => unitsSold(ds, "sku_a", { ...SEPTEMBER, ...patch }, options), MetricInputError, JSON.stringify(patch));
  }
});
