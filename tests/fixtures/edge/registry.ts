import type { DataSource, DomainDataset } from "../../../packages/domain/src/models.ts";
import { csvSources, SAMPLE_NOW } from "../csv/registry.ts";
import { emptyDataset } from "../../../packages/ingestion/src/index.ts";

/**
 * SYNTHETIC edge scenario (STEP 7 review): every SKU status and fact state the sample never reaches.
 * Expected with the sample promotion and ranking policies and this file's preference
 * [advertise_only, discount] (no hold), September 2026:
 *   SYN-E1-50  no sales                   → insufficient_data (no_sales_rows)
 *   SYN-E2-55  no cost                    → insufficient_data (missing_cost)
 *   SYN-E3-65  stock 2 below the minimum  → blocked (both preferred actions fail)
 *   SYN-E4-43  sales from ERP and POS     → review_required (multiple_sales_sources)
 *   SYN-E5-58  margin 0.3, stock 10       → recommended advertise_only, rank 1
 *   SYN-E6-40  discontinued BrightLab SKU: not evaluated; it exists so the sample policy's brand
 *              exclusion resolves (otherwise every verdict is capped by policy_reference_error)
 */
const pos: DataSource = {
  id: "src_syn_pos", name: "Synthetic POS export", kind: "internal_csv", rightsStatus: "authorized", sensitivity: "confidential",
  coverage: { countries: ["TH"], categoryIds: [] },
  permittedUse: { storeFullContent: true, storeExcerpts: true, attributionRequired: false },
  retentionDays: null, refreshCadence: null, lastFetchedAt: null, reliability: "unknown",
};

export const edgeRegistryDataset = (): DomainDataset => ({ ...emptyDataset(), sources: structuredClone([...csvSources, pos]) });

export const edgeFiles = [
  { kind: "catalog", file: "catalog.csv", sourceId: "src_syn_catalog" },
  { kind: "sales", file: "sales.csv", sourceId: "src_syn_erp" },
  { kind: "sales", file: "sales-pos.csv", sourceId: "src_syn_pos" },
  { kind: "inventory", file: "inventory.csv", sourceId: "src_syn_erp" },
  { kind: "costs", file: "costs.csv", sourceId: "src_syn_erp" },
] as const;

export { SAMPLE_NOW };
