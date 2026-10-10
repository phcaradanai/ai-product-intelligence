import type { DataSource, DomainDataset } from "../../../packages/domain/src/models.ts";
import { emptyDataset } from "../../../packages/ingestion/src/index.ts";

/** SYNTHETIC source registry for CSV import tests. Registry entries are governance records, created outside the importer. */
const base = (id: string, name: string, kind: DataSource["kind"], rightsStatus: DataSource["rightsStatus"], sensitivity: DataSource["sensitivity"]): DataSource => ({
  id, name, kind, rightsStatus, sensitivity,
  coverage: { countries: ["TH"], categoryIds: [] },
  permittedUse: { storeFullContent: true, storeExcerpts: true, attributionRequired: false },
  retentionDays: null, refreshCadence: null, lastFetchedAt: null, reliability: "unknown",
});

export const csvSources: DataSource[] = [
  base("src_syn_erp", "Synthetic ERP export", "internal_erp", "authorized", "confidential"),
  base("src_syn_catalog", "Synthetic catalog export", "internal_csv", "authorized", "internal"),
  base("src_syn_expired", "Synthetic export with expired rights", "internal_csv", "expired", "internal"),
  base("src_syn_feed", "Synthetic licensed feed", "licensed_feed", "authorized", "public"),
];

export const registryDataset = (): DomainDataset => ({ ...emptyDataset(), sources: structuredClone(csvSources) });

/** Which registered source each sample file comes from. */
export const sampleFiles = [
  { kind: "catalog", file: "catalog.csv", sourceId: "src_syn_catalog" },
  { kind: "sales", file: "sales.csv", sourceId: "src_syn_erp" },
  { kind: "inventory", file: "inventory.csv", sourceId: "src_syn_erp" },
  { kind: "costs", file: "costs.csv", sourceId: "src_syn_erp" },
  { kind: "prices", file: "prices.csv", sourceId: "src_syn_catalog" },
] as const;

export const SAMPLE_NOW = "2026-10-10T10:00:00+07:00";
