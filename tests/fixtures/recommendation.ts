import type { DomainDataset } from "../../packages/domain/src/models.ts";
import { rankingDataset } from "./ranking.ts";

/**
 * SYNTHETIC golden fixture for STEP 6: the STEP 5 ranking fixture (r1–r6) plus r7, which has stock
 * and cost but no sales, so its margin is no_data (expected status: insufficient_data).
 */
export const recommendationDataset: DomainDataset = (() => {
  const ds = structuredClone(rankingDataset);
  ds.variants.push({ id: "var_r7", familyId: "fam_m", attributes: { screenSizeInches: 55 } });
  ds.skus.push({ id: "r7", variantId: "var_r7", merchantSku: "SYN-r7", gtin: null, status: "active" });
  ds.inventory.push({ id: "r7_stock", skuId: "r7", sourceReferenceId: "ref_erp", locationCode: "BKK", observedAt: "2026-09-30T22:00:00+07:00", ingestedAt: "2026-10-01T06:00:00+07:00", onHandQuantity: 20, reservedQuantity: 0 });
  ds.costs.push({ id: "r7_cost", skuId: "r7", sourceReferenceId: "ref_erp", costType: "purchase", unitCostMinor: 700_000, currency: "THB", effectiveFrom: "2026-08-01T00:00:00+07:00", effectiveTo: null, ingestedAt: "2026-10-01T06:00:00+07:00" });
  return ds;
})();
