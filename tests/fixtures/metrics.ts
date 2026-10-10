import type { CostFact, DataSource, DomainDataset, InventorySnapshot, SalesFact } from "../../packages/domain/src/models.ts";

/**
 * SYNTHETIC golden fixture for STEP 3 metrics. Expected values in tests/metrics.test.ts were
 * computed by hand from these rows. Amounts are fictional THB minor units (satang).
 */

const src = (id: string, kind: DataSource["kind"], rightsStatus: DataSource["rightsStatus"], sensitivity: DataSource["sensitivity"]): DataSource => ({
  id, name: `${id} (synthetic)`, kind, rightsStatus, sensitivity,
  coverage: { countries: ["TH"], categoryIds: [] },
  permittedUse: { storeFullContent: true, storeExcerpts: true, attributionRequired: false },
  retentionDays: null, refreshCadence: null, lastFetchedAt: null, reliability: "unknown",
});

const INGESTED = "2026-10-01T06:00:00+07:00";
const skuIds = ["sku_a", "sku_b", "sku_c", "sku_d", "sku_e", "sku_f", "sku_g", "sku_h"];
const refFor = { src_erp: "ref_erp", src_pos: "ref_pos", src_bad: "ref_bad" } as const;
type Src = keyof typeof refFor;

const sale = (id: string, skuId: string, eventAt: string, quantitySold: number, grossRevenueMinor: number, source: Src = "src_erp", currency = "THB", ingestedAt = INGESTED): SalesFact => ({
  id, skuId, sourceReferenceId: refFor[source], eventAt, ingestedAt, quantitySold, grossRevenueMinor, currency,
});
const cost = (id: string, skuId: string, costType: CostFact["costType"], unitCostMinor: number, effectiveFrom: string, effectiveTo: string | null, currency = "THB"): CostFact => ({
  id, skuId, sourceReferenceId: "ref_erp", costType, unitCostMinor, currency, effectiveFrom, effectiveTo, ingestedAt: INGESTED,
});
const stock = (id: string, skuId: string, locationCode: string, observedAt: string, onHandQuantity: number, reservedQuantity: number): InventorySnapshot => ({
  id, skuId, sourceReferenceId: "ref_erp", locationCode, observedAt, ingestedAt: INGESTED, onHandQuantity, reservedQuantity,
});

/** September 2026 in Bangkok time: [2026-09-01, 2026-10-01), 30 days. */
export const SEPTEMBER = { start: "2026-09-01T00:00:00+07:00", end: "2026-10-01T00:00:00+07:00" };

export const metricsDataset: DomainDataset = {
  brands: [{ id: "brand_m", name: "MetricBrand (synthetic)" }],
  categories: [{ id: "cat_tv", name: "TV (synthetic)", parentCategoryId: null }],
  families: [{ id: "fam_m", brandId: "brand_m", categoryId: "cat_tv", modelName: "M (synthetic)", modelCode: null }],
  variants: skuIds.map((s) => ({ id: `var_${s}`, familyId: "fam_m", attributes: { screenSizeInches: 55 } })),
  skus: skuIds.map((s) => ({ id: s, variantId: `var_${s}`, merchantSku: `SYN-${s}`, gtin: null, status: "active" as const })),
  aliases: [],
  sources: [
    src("src_erp", "internal_erp", "authorized", "confidential"),
    src("src_pos", "internal_csv", "authorized", "internal"),
    src("src_bad", "internal_csv", "unverified", "internal"),
  ],
  references: (Object.entries(refFor) as [Src, string][]).map(([sourceId, id]) => ({
    id, sourceId, recordKey: id, locator: { kind: "internal_record" as const, value: `synthetic:${id}` },
    publishedAt: null, fetchedAt: null, ingestedAt: INGESTED,
  })),
  sales: [
    // sku_a: the main golden SKU
    sale("a1", "sku_a", "2026-08-15T12:00:00+07:00", 2, 4_000_000),                 // previous window
    sale("a2", "sku_a", "2026-09-03T12:00:00+07:00", 1, 2_000_000),
    sale("a3", "sku_a", "2026-09-10T12:00:00+07:00", 3, 5_700_000, "src_erp", "THB", "2026-10-05T06:00:00+07:00"), // ingested late
    sale("a4", "sku_a", "2026-09-30T23:00:00+07:00", 1, 2_000_000),                 // last hour of the window
    sale("a5", "sku_a", "2026-10-01T00:00:00+07:00", 5, 10_000_000),                // window end is exclusive
    sale("a6", "sku_a", "2026-09-15T12:00:00+07:00", 10, 20_000_000, "src_bad"),     // unverified source
    // sku_c: a real zero-quantity line
    sale("c1", "sku_c", "2026-09-05T12:00:00+07:00", 0, 0),
    // sku_d: same SKU from two authorized sources
    sale("d1", "sku_d", "2026-09-05T12:00:00+07:00", 1, 1_000_000),
    sale("d2", "sku_d", "2026-09-06T12:00:00+07:00", 1, 1_000_000, "src_pos"),
    // sku_e: sale before any cost is effective; sales from an internal-sensitivity source
    sale("e1", "sku_e", "2026-09-05T12:00:00+07:00", 1, 1_000_000, "src_pos"),
    // sku_f: overlapping purchase costs
    sale("f1", "sku_f", "2026-09-05T12:00:00+07:00", 1, 1_000_000),
    // sku_g: cost in a different currency
    sale("g1", "sku_g", "2026-09-05T12:00:00+07:00", 1, 1_000_000),
    // sku_h: mixed sale currencies
    sale("h1", "sku_h", "2026-09-05T12:00:00+07:00", 1, 1_000_000),
    sale("h2", "sku_h", "2026-09-06T12:00:00+07:00", 1, 30_000, "src_erp", "USD"),
  ],
  inventory: [
    stock("ia1", "sku_a", "BKK", "2026-09-20T22:00:00+07:00", 10, 2),
    stock("ia2", "sku_a", "BKK", "2026-09-29T22:00:00+07:00", 8, 1),
    stock("ia3", "sku_a", "CNX", "2026-09-25T22:00:00+07:00", 4, 0),
    stock("ia4", "sku_a", "BKK", "2026-10-02T22:00:00+07:00", 50, 0),  // after window end
    stock("ib1", "sku_b", "BKK", "2026-09-29T22:00:00+07:00", 6, 1),
    stock("ic1", "sku_c", "BKK", "2026-09-29T22:00:00+07:00", 3, 0),
  ],
  costs: [
    cost("ca1", "sku_a", "purchase", 1_500_000, "2026-08-01T00:00:00+07:00", "2026-09-10T00:00:00+07:00"),
    cost("ca2", "sku_a", "purchase", 1_600_000, "2026-09-10T00:00:00+07:00", null),
    cost("ca3", "sku_a", "landed", 1_700_000, "2026-08-01T00:00:00+07:00", null),
    cost("ce1", "sku_e", "purchase", 500_000, "2026-09-10T00:00:00+07:00", null),
    cost("cf1", "sku_f", "purchase", 500_000, "2026-09-01T00:00:00+07:00", null),
    cost("cf2", "sku_f", "purchase", 600_000, "2026-09-03T00:00:00+07:00", null),
    cost("cg1", "sku_g", "purchase", 500, "2026-09-01T00:00:00+07:00", null, "USD"),
  ],
  prices: [],
  matches: [],
};
