import type { DomainDataset } from "../../packages/domain/src/models.ts";
import { metricsDataset } from "./metrics.ts";

/**
 * SYNTHETIC golden fixture for STEP 5 ranking. Six SKUs on the STEP 3 source registry; expected
 * ranks in tests/ranking.test.ts were derived by hand (September 2026, 30 days, purchase cost):
 *
 * | SKU | Sep units | Aug units | unit price | unit cost | stock | margin | cover (days)        | growth   |
 * |-----|-----------|-----------|------------|-----------|-------|--------|---------------------|----------|
 * | r1  | 11        | 11        | 10,000     | 7,000     | 22    | 0.3    | 60 (float 60.00…01) | 0        |
 * | r2  | 20        | 20        | 10,000     | 7,000     | 40    | 0.3    | 60                  | 0        |
 * | r3  | 10        | 10        | 10,000     | 7,000     | 10    | 0.3    | 30                  | 0        |
 * | r4  | 10        | 10        | 10,000     | 8,000     | 20    | 0.2    | 60                  | 0        |
 * | r5  | 10        | —         | 10,000     | 7,000     | 20    | 0.3    | 60                  | no_data  |
 * | r6  | 10        | 10        | 10,000     | 7,000     | 2     | 0.3    | 6                   | 0        |
 */
const rows = [
  { id: "r1", sep: 11, aug: 11, cost: 700_000, stock: 22 },
  { id: "r2", sep: 20, aug: 20, cost: 700_000, stock: 40 },
  { id: "r3", sep: 10, aug: 10, cost: 700_000, stock: 10 },
  { id: "r4", sep: 10, aug: 10, cost: 800_000, stock: 20 },
  { id: "r5", sep: 10, aug: 0, cost: 700_000, stock: 20 },
  { id: "r6", sep: 10, aug: 10, cost: 700_000, stock: 2 },
];
const PRICE = 1_000_000;
const INGESTED = "2026-10-01T06:00:00+07:00";

export const rankingDataset: DomainDataset = {
  ...structuredClone(metricsDataset),
  variants: rows.map((r) => ({ id: `var_${r.id}`, familyId: "fam_m", attributes: { screenSizeInches: 55 } })),
  skus: rows.map((r) => ({ id: r.id, variantId: `var_${r.id}`, merchantSku: `SYN-${r.id}`, gtin: null, status: "active" as const })),
  sales: rows.flatMap((r) => [
    { id: `${r.id}_sep`, skuId: r.id, sourceReferenceId: "ref_erp", eventAt: "2026-09-15T12:00:00+07:00", ingestedAt: INGESTED, quantitySold: r.sep, grossRevenueMinor: r.sep * PRICE, currency: "THB" },
    ...(r.aug > 0 ? [{ id: `${r.id}_aug`, skuId: r.id, sourceReferenceId: "ref_erp", eventAt: "2026-08-15T12:00:00+07:00", ingestedAt: INGESTED, quantitySold: r.aug, grossRevenueMinor: r.aug * PRICE, currency: "THB" }] : []),
  ]),
  inventory: rows.map((r) => ({ id: `${r.id}_stock`, skuId: r.id, sourceReferenceId: "ref_erp", locationCode: "BKK", observedAt: "2026-09-30T22:00:00+07:00", ingestedAt: INGESTED, onHandQuantity: r.stock, reservedQuantity: 0 })),
  costs: rows.map((r) => ({ id: `${r.id}_cost`, skuId: r.id, sourceReferenceId: "ref_erp", costType: "purchase" as const, unitCostMinor: r.cost, currency: "THB", effectiveFrom: "2026-08-01T00:00:00+07:00", effectiveTo: null, ingestedAt: INGESTED })),
  prices: [],
  matches: [],
};
