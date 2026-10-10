/**
 * Synthetic sample inputs for the Workspace, bundled into the server build with Vite raw imports.
 * Server-only: imported exclusively from server functions.
 */
import catalog from "../../../../tests/fixtures/csv/catalog.csv?raw";
import costs from "../../../../tests/fixtures/csv/costs.csv?raw";
import inventory from "../../../../tests/fixtures/csv/inventory.csv?raw";
import prices from "../../../../tests/fixtures/csv/prices.csv?raw";
import sales from "../../../../tests/fixtures/csv/sales.csv?raw";
import promotionPolicy from "../../../../tests/fixtures/csv/policy.synthetic.json";
import rankingPolicy from "../../../../tests/fixtures/csv/ranking-policy.synthetic.json";
import recommendationPolicy from "../../../../tests/fixtures/csv/recommendation-policy.synthetic.json";
import { registryDataset, sampleFiles, SAMPLE_NOW } from "../../../../tests/fixtures/csv/registry.ts";
import type { SampleInputs } from "./pipeline.ts";

const content: Record<string, string> = {
  "catalog.csv": catalog, "sales.csv": sales, "inventory.csv": inventory, "costs.csv": costs, "prices.csv": prices,
};

/**
 * Recommendations are generated as of the fixed sample evaluation time, so content-hash ids stay
 * stable across server restarts and reloads (only the in-memory decision log resets).
 */
const GENERATED_AT = SAMPLE_NOW;

export function sampleInputs(): SampleInputs {
  return {
    registry: registryDataset(),
    files: sampleFiles.map((f) => ({ ...f, content: content[f.file]! })),
    promotionPolicy, rankingPolicy, recommendationPolicy,
    sampleNow: SAMPLE_NOW,
    generatedAt: GENERATED_AT,
  };
}
