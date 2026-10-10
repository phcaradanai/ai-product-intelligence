/** Imports the synthetic STEP 2 sample CSVs and prints v1 metrics per active SKU for September 2026 (Bangkok). */
import { readFileSync } from "node:fs";
import { importCsv } from "../packages/ingestion/src/index.ts";
import { computeSkuMetrics } from "../packages/metrics/src/index.ts";
import { registryDataset, sampleFiles, SAMPLE_NOW } from "../tests/fixtures/csv/registry.ts";

let dataset = registryDataset();
for (const f of sampleFiles) {
  const content = readFileSync(new URL(`../tests/fixtures/csv/${f.file}`, import.meta.url));
  dataset = importCsv(dataset, { kind: f.kind, sourceId: f.sourceId, fileName: f.file, content, now: SAMPLE_NOW }).dataset;
}
const window = { start: "2026-09-01T00:00:00+07:00", end: "2026-10-01T00:00:00+07:00" };
const rows = dataset.skus.filter((s) => s.status === "active").map((sku) => ({
  sku: sku.merchantSku,
  metrics: Object.fromEntries(computeSkuMetrics(dataset, sku.id, window, "purchase").map((r) => [
    `${r.metric}@v${r.version}`,
    r.status === "computed" ? { value: r.value, unit: r.unit, currency: r.currency, dataAsOf: r.dataAsOf, sensitivity: r.sensitivity } : { status: r.status, reasons: r.reasons },
  ])),
}));
console.log(JSON.stringify({ note: "SYNTHETIC data; proposed v1 definitions (DEC-004)", window, rows }, null, 2));
