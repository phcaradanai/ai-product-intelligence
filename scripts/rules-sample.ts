/**
 * Imports the synthetic STEP 2 sample, then evaluates every active SKU × action for September 2026
 * twice: without an owner policy, and with a SYNTHETIC demo policy (test values, not business guidance).
 */
import { readFileSync } from "node:fs";
import { PromotionPolicySchema } from "../packages/contracts/src/index.ts";
import { importCsv } from "../packages/ingestion/src/index.ts";
import { ACTIONS, evaluateCandidates } from "../packages/rules/src/index.ts";
import type { PromotionPolicy } from "../packages/rules/src/index.ts";
import { registryDataset, sampleFiles, SAMPLE_NOW } from "../tests/fixtures/csv/registry.ts";

let dataset = registryDataset();
for (const f of sampleFiles) {
  const content = readFileSync(new URL(`../tests/fixtures/csv/${f.file}`, import.meta.url));
  dataset = importCsv(dataset, { kind: f.kind, sourceId: f.sourceId, fileName: f.file, content, now: SAMPLE_NOW }).dataset;
}
const synthetic = PromotionPolicySchema.parse(JSON.parse(readFileSync(new URL("../tests/fixtures/csv/policy.synthetic.json", import.meta.url), "utf8")));
const skuIds = dataset.skus.filter((s) => s.status === "active").map((s) => s.id);
const window = { start: "2026-09-01T00:00:00+07:00", end: "2026-10-01T00:00:00+07:00" };

const run = (label: string, policy: PromotionPolicy | null) => {
  const out = evaluateCandidates({ dataset, policy, skuIds, actions: ACTIONS, window, evaluatedAt: SAMPLE_NOW });
  return {
    label, policy: out.policy, policyIssues: out.policyIssues,
    rows: out.evaluations.map((e) => ({
      sku: e.skuId, action: e.action, verdict: e.verdict, reasons: e.reasons,
      rules: e.ruleResults.map((r) => `${r.ruleId}:${r.outcome}${r.reasons.length ? `(${r.reasons.join(",")})` : ""}`),
    })),
  };
};
console.log(JSON.stringify([run("no owner policy (current state, DEC-005 open)", null), run("SYNTHETIC demo policy", synthetic)], null, 2));
