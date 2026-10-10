/**
 * Imports the synthetic STEP 2 sample, evaluates it with the SYNTHETIC promotion policy (STEP 4),
 * then ranks eligible candidates with no ranking policy and with a SYNTHETIC ranking policy.
 * Policy values are test values, not business guidance.
 */
import { readFileSync } from "node:fs";
import { PromotionPolicySchema, RankingPolicySchema } from "../packages/contracts/src/index.ts";
import { importCsv } from "../packages/ingestion/src/index.ts";
import { rankCandidates } from "../packages/ranking/src/index.ts";
import type { RankingPolicy } from "../packages/ranking/src/index.ts";
import { ACTIONS, evaluateCandidates } from "../packages/rules/src/index.ts";
import { registryDataset, sampleFiles, SAMPLE_NOW } from "../tests/fixtures/csv/registry.ts";

const json = (f: string): unknown => JSON.parse(readFileSync(new URL(`../tests/fixtures/csv/${f}`, import.meta.url), "utf8"));
let dataset = registryDataset();
for (const f of sampleFiles) {
  const content = readFileSync(new URL(`../tests/fixtures/csv/${f.file}`, import.meta.url));
  dataset = importCsv(dataset, { kind: f.kind, sourceId: f.sourceId, fileName: f.file, content, now: SAMPLE_NOW }).dataset;
}
const promotionPolicy = PromotionPolicySchema.parse(json("policy.synthetic.json"));
const synthetic = RankingPolicySchema.parse(json("ranking-policy.synthetic.json"));
const window = { start: "2026-09-01T00:00:00+07:00", end: "2026-10-01T00:00:00+07:00" };
const skuIds = dataset.skus.filter((s) => s.status === "active").map((s) => s.id);
const evaluation = evaluateCandidates({ dataset, policy: promotionPolicy, skuIds, actions: ACTIONS, window, evaluatedAt: SAMPLE_NOW });

const show = (label: string, rankingPolicy: RankingPolicy | null) => {
  const out = rankCandidates({ dataset, evaluation, promotionPolicy, rankingPolicy });
  return {
    label, rankingPolicy: out.rankingPolicy,
    lists: out.lists.map((l) => ({
      action: l.action, evidenceBasis: l.evidenceBasis, rankingApplied: l.rankingApplied, reasons: l.reasons, sensitivity: l.sensitivity,
      ranked: l.ranked.map((c) => ({ rank: c.rank, tied: c.tied, sku: c.skuId, keys: c.keys.map((k) => `${k.metric}=${k.value}`) })),
      notRanked: l.notRanked.map((n) => ({ sku: n.skuId, verdict: n.verdict, reason: n.reason })),
    })),
  };
};
console.log(JSON.stringify([show("no ranking policy (current state)", null), show("SYNTHETIC ranking policy", synthetic)], null, 2));
