/** Imports the synthetic sample CSVs and prints the data-quality report as JSON. */
import { readFileSync } from "node:fs";
import { buildQualityReport, importCsv } from "../packages/ingestion/src/index.ts";
import type { ImportRun } from "../packages/ingestion/src/index.ts";
import { registryDataset, sampleFiles, SAMPLE_NOW } from "../tests/fixtures/csv/registry.ts";

let dataset = registryDataset();
const runs: ImportRun[] = [];
for (const f of sampleFiles) {
  const content = readFileSync(new URL(`../tests/fixtures/csv/${f.file}`, import.meta.url));
  const result = importCsv(dataset, { kind: f.kind, sourceId: f.sourceId, fileName: f.file, content, now: SAMPLE_NOW });
  dataset = result.dataset;
  runs.push(result.run);
}
console.log(JSON.stringify(buildQualityReport(dataset, runs), null, 2));
