import type { DataSource, DomainDataset, SalesFact, SourceReference } from "../../packages/domain/src/models.ts";

/**
 * SYNTHETIC DATA FOR DEVELOPMENT ONLY. Brands, models, prices, costs and mentions are fictional.
 * No value here is a business fact, policy threshold or market observation.
 */

const INGESTED = "2026-10-10T10:00:00+07:00";

const internalSource = (id: string, name: string, sensitivity: DataSource["sensitivity"]): DataSource => ({
  id, name, kind: "internal_csv", rightsStatus: "authorized", sensitivity,
  coverage: { countries: ["TH"], categoryIds: ["cat_tv"] },
  permittedUse: { storeFullContent: true, storeExcerpts: true, attributionRequired: false },
  retentionDays: null, refreshCadence: "P1D", lastFetchedAt: null, reliability: "unknown",
});

const internalRef = (id: string, sourceId: string): SourceReference => ({
  id, sourceId, recordKey: id, locator: { kind: "internal_record", value: `synthetic:${id}` },
  publishedAt: null, fetchedAt: null, ingestedAt: INGESTED,
});

const skuPrices = { sku_ax55_2025: 2_400_000, sku_ax65_2025: 3_500_000, sku_ax55_2026: 2_700_000, sku_bz50: 1_300_000, sku_bz55: 1_600_000 } as const;

/** 30 days (1–30 Sep 2026) of deterministic synthetic daily sales per SKU. */
const sales: SalesFact[] = Object.entries(skuPrices).flatMap(([skuId, price], s) =>
  Array.from({ length: 30 }, (_, d) => {
    const quantitySold = (d * 7 + s * 3) % 5;
    const day = String(d + 1).padStart(2, "0");
    return {
      id: `sales_${skuId}_${day}`, skuId, sourceReferenceId: "ref_sales_export",
      eventAt: `2026-09-${day}T12:00:00+07:00`, ingestedAt: INGESTED,
      quantitySold, grossRevenueMinor: quantitySold * price, currency: "THB",
    };
  }),
);

export const syntheticDataset: DomainDataset = {
  brands: [
    { id: "brand_demo", name: "DemoVision (synthetic)" },
    { id: "brand_bright", name: "BrightLab (synthetic)" },
  ],
  categories: [{ id: "cat_tv", name: "Televisions (synthetic)", parentCategoryId: null }],
  families: [
    { id: "family_ax_2025", brandId: "brand_demo", categoryId: "cat_tv", modelName: "DemoVision AX 2025 (synthetic)", modelCode: "SYN-AX25" },
    { id: "family_ax_2026", brandId: "brand_demo", categoryId: "cat_tv", modelName: "DemoVision AX 2026 (synthetic)", modelCode: "SYN-AX26" },
    { id: "family_bz", brandId: "brand_bright", categoryId: "cat_tv", modelName: "BrightLab BZ (synthetic)", modelCode: "SYN-BZ" },
  ],
  variants: [
    { id: "variant_ax25_55", familyId: "family_ax_2025", attributes: { screenSizeInches: 55, modelYear: 2025, panelType: "QLED" } },
    { id: "variant_ax25_65", familyId: "family_ax_2025", attributes: { screenSizeInches: 65, modelYear: 2025, panelType: "QLED" } },
    { id: "variant_ax26_55", familyId: "family_ax_2026", attributes: { screenSizeInches: 55, modelYear: 2026, panelType: "QLED" } },
    { id: "variant_bz_50", familyId: "family_bz", attributes: { screenSizeInches: 50, modelYear: 2026, panelType: "LED" } },
    { id: "variant_bz_55", familyId: "family_bz", attributes: { screenSizeInches: 55, modelYear: 2026, panelType: "LED" } },
  ],
  skus: [
    { id: "sku_ax55_2025", variantId: "variant_ax25_55", merchantSku: "SYN-AX25-55", gtin: null, status: "active" },
    { id: "sku_ax65_2025", variantId: "variant_ax25_65", merchantSku: "SYN-AX25-65", gtin: null, status: "active" },
    { id: "sku_ax55_2026", variantId: "variant_ax26_55", merchantSku: "SYN-AX26-55", gtin: null, status: "active" },
    { id: "sku_bz50", variantId: "variant_bz_50", merchantSku: "SYN-BZ-50", gtin: null, status: "active" },
    { id: "sku_bz55", variantId: "variant_bz_55", merchantSku: "SYN-BZ-55", gtin: null, status: "discontinued" },
  ],
  sources: [
    internalSource("source_erp", "Synthetic ERP export", "confidential"),
    internalSource("source_catalog", "Synthetic catalog CSV", "internal"),
    {
      id: "source_licensed_news", name: "Synthetic licensed news feed", kind: "licensed_feed",
      rightsStatus: "authorized", sensitivity: "public",
      coverage: { countries: ["TH"], categoryIds: ["cat_tv"] },
      permittedUse: { storeFullContent: false, storeExcerpts: true, attributionRequired: true },
      retentionDays: null, refreshCadence: "PT1H", lastFetchedAt: "2026-10-09T23:00:00+07:00", reliability: "unknown",
    },
    {
      id: "source_unverified_social", name: "Synthetic social mentions (rights unverified)", kind: "other",
      rightsStatus: "unverified", sensitivity: "public",
      coverage: { countries: ["TH"], categoryIds: [] },
      permittedUse: { storeFullContent: false, storeExcerpts: false, attributionRequired: true },
      retentionDays: null, refreshCadence: null, lastFetchedAt: "2026-10-09T20:00:00+07:00", reliability: "unknown",
    },
  ],
  references: [
    internalRef("ref_catalog", "source_catalog"),
    internalRef("ref_sales_export", "source_erp"),
    internalRef("ref_stock", "source_erp"),
    internalRef("ref_cost", "source_erp"),
    internalRef("ref_price", "source_catalog"),
    {
      id: "ref_news_recent", sourceId: "source_licensed_news", recordKey: "news-1",
      locator: { kind: "url", value: "https://news.example.invalid/synthetic/ax-2026-launch" },
      publishedAt: "2026-10-08T09:00:00+07:00", fetchedAt: "2026-10-09T23:00:00+07:00", ingestedAt: INGESTED,
    },
    {
      // Old article fetched recently: must not count as a new event (STEP 0 §15.2).
      id: "ref_news_stale", sourceId: "source_licensed_news", recordKey: "news-2",
      locator: { kind: "url", value: "https://news.example.invalid/synthetic/ax-2025-review" },
      publishedAt: "2025-03-01T08:00:00+07:00", fetchedAt: "2026-10-09T23:00:00+07:00", ingestedAt: INGESTED,
    },
    {
      id: "ref_social", sourceId: "source_unverified_social", recordKey: "mention-1",
      locator: { kind: "internal_record", value: "synthetic:mention-1" },
      publishedAt: null, fetchedAt: "2026-10-09T20:00:00+07:00", ingestedAt: INGESTED,
    },
  ],
  aliases: [
    { id: "alias_th_ax25_55", target: { scope: "variant", entityId: "variant_ax25_55" }, alias: "เดโมวิชั่น เอเอ็กซ์ 55 นิ้ว 2025", locale: "th", verified: false, sourceReferenceId: "ref_catalog" },
    { id: "alias_en_ax25", target: { scope: "family", entityId: "family_ax_2025" }, alias: "DemoVision AX 2025", locale: "en", verified: true, sourceReferenceId: "ref_catalog" },
    { id: "alias_th_bz", target: { scope: "family", entityId: "family_bz" }, alias: "ไบรท์แล็บ บีแซด", locale: "th", verified: true, sourceReferenceId: "ref_catalog" },
    { id: "alias_en_bz50", target: { scope: "sku", entityId: "sku_bz50" }, alias: "BrightLab BZ 50in", locale: "en", verified: true, sourceReferenceId: "ref_catalog" },
  ],
  sales,
  inventory: Object.keys(skuPrices).map((skuId, i) => ({
    id: `stock_${skuId}`, skuId, sourceReferenceId: "ref_stock", locationCode: "SYN-BKK-01",
    observedAt: "2026-09-30T22:00:00+07:00", ingestedAt: INGESTED,
    onHandQuantity: 5 + i * 4, reservedQuantity: i,
  })),
  costs: Object.entries(skuPrices).map(([skuId, price]) => ({
    id: `cost_${skuId}`, skuId, sourceReferenceId: "ref_cost", costType: "purchase" as const,
    unitCostMinor: Math.round(price * 0.7), currency: "THB",
    effectiveFrom: "2026-09-01T00:00:00+07:00", effectiveTo: null, ingestedAt: INGESTED,
  })),
  prices: Object.entries(skuPrices).map(([skuId, price]) => ({
    id: `price_${skuId}`, skuId, sourceReferenceId: "ref_price", channelCode: "SYN-STORE",
    priceType: "selling" as const, unitPriceMinor: price, currency: "THB",
    observedAt: "2026-09-30T22:00:00+07:00", ingestedAt: INGESTED,
  })),
  matches: [
    {
      id: "match_family", externalEntityId: "news-1", sourceReferenceId: "ref_news_recent",
      target: { scope: "family", entityId: "family_ax_2026" }, matchMethod: "manual",
      matchConfidence: null, confidenceKind: null, matcherVersion: "manual-synthetic-v1", reviewStatus: "matched",
      supportingEvidenceReferenceIds: ["ref_news_recent"], validFrom: "2026-10-08T00:00:00+07:00", validTo: null,
      reviewedBy: "synthetic_reviewer", reviewedAt: INGESTED,
    },
    {
      id: "match_pending", externalEntityId: "mention-1", sourceReferenceId: "ref_social",
      target: { scope: "sku", entityId: "sku_ax55_2025" }, matchMethod: "semantic",
      matchConfidence: 0.77, confidenceKind: "heuristic_score", matcherVersion: "synthetic-semantic-v0", reviewStatus: "pending_review",
      supportingEvidenceReferenceIds: ["ref_social"], validFrom: "2026-10-09T00:00:00+07:00", validTo: null,
      reviewedBy: null, reviewedAt: null,
    },
    {
      // A reviewer rejected a probabilistic candidate link; the model stores no target once rejected
      // (see STEP 1 doc §5 open question 8).
      id: "match_rejected", externalEntityId: "news-2", sourceReferenceId: "ref_news_stale",
      target: null, matchMethod: "probabilistic",
      matchConfidence: 0.64, confidenceKind: "heuristic_score", matcherVersion: "synthetic-prob-v0", reviewStatus: "rejected",
      supportingEvidenceReferenceIds: ["ref_news_stale"], validFrom: "2026-10-09T00:00:00+07:00", validTo: null,
      reviewedBy: "synthetic_reviewer", reviewedAt: INGESTED,
    },
    {
      id: "match_unresolved", externalEntityId: "mention-2", sourceReferenceId: "ref_social",
      target: null, matchMethod: "semantic",
      matchConfidence: null, confidenceKind: null, matcherVersion: "synthetic-semantic-v0", reviewStatus: "unresolved",
      supportingEvidenceReferenceIds: [], validFrom: "2026-10-09T00:00:00+07:00", validTo: null,
      reviewedBy: null, reviewedAt: null,
    },
  ],
};
