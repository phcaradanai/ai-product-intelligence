/**
 * Synthetic inputs for the Workspace, bundled into the server build with Vite raw imports.
 * Server-only: imported exclusively from server functions. Two scenarios: the STEP 2 sample, and an
 * edge scenario that reaches every SKU status and fact state the sample never shows.
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
import edgeCatalog from "../../../../tests/fixtures/edge/catalog.csv?raw";
import edgeCosts from "../../../../tests/fixtures/edge/costs.csv?raw";
import edgeInventory from "../../../../tests/fixtures/edge/inventory.csv?raw";
import edgeSales from "../../../../tests/fixtures/edge/sales.csv?raw";
import edgeSalesPos from "../../../../tests/fixtures/edge/sales-pos.csv?raw";
import edgeRecommendationPolicy from "../../../../tests/fixtures/edge/recommendation-policy.synthetic.json";
import { edgeFiles, edgeRegistryDataset } from "../../../../tests/fixtures/edge/registry.ts";
import type { SampleInputs, Scenario } from "./pipeline.ts";

const sampleContent: Record<string, string> = {
  "catalog.csv": catalog, "sales.csv": sales, "inventory.csv": inventory, "costs.csv": costs, "prices.csv": prices,
};
const edgeContent: Record<string, string> = {
  "catalog.csv": edgeCatalog, "sales.csv": edgeSales, "sales-pos.csv": edgeSalesPos, "inventory.csv": edgeInventory, "costs.csv": edgeCosts,
};

/**
 * Recommendations are generated as of the fixed sample evaluation time, so content-hash ids stay
 * stable across server restarts and reloads (only the in-memory decision log resets).
 */
const GENERATED_AT = SAMPLE_NOW;

export function sampleInputs(scenario: Scenario = "sample"): SampleInputs {
  if (scenario === "edge") {
    return {
      registry: edgeRegistryDataset(),
      files: edgeFiles.map((f) => ({ ...f, content: edgeContent[f.file]! })),
      promotionPolicy, rankingPolicy, recommendationPolicy: edgeRecommendationPolicy,
      sampleNow: SAMPLE_NOW, generatedAt: GENERATED_AT,
    };
  }
  return {
    registry: registryDataset(),
    files: sampleFiles.map((f) => ({ ...f, content: sampleContent[f.file]! })),
    promotionPolicy, rankingPolicy, recommendationPolicy,
    sampleNow: SAMPLE_NOW, generatedAt: GENERATED_AT,
  };
}
