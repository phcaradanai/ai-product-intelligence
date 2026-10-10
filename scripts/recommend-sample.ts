/**
 * End-to-end on the synthetic STEP 2 sample: import → evaluate (SYNTHETIC promotion policy) → rank
 * (SYNTHETIC ranking policy) → recommend (SYNTHETIC preference) → views for two clearances → one
 * synthetic decision. Policy values are test values, not business guidance.
 */
import { readFileSync } from "node:fs";
import { PromotionPolicySchema, RankingPolicySchema, RecommendationPolicySchema } from "../packages/contracts/src/index.ts";
import { importCsv } from "../packages/ingestion/src/index.ts";
import { rankCandidates } from "../packages/ranking/src/index.ts";
import { buildRecommendations, recordDecision, redactForViewer } from "../packages/recommendation/src/index.ts";
import type { RecommendationSet } from "../packages/recommendation/src/index.ts";
import { ACTIONS, evaluateCandidates } from "../packages/rules/src/index.ts";
import { registryDataset, sampleFiles, SAMPLE_NOW } from "../tests/fixtures/csv/registry.ts";

const json = (f: string): unknown => JSON.parse(readFileSync(new URL(`../tests/fixtures/csv/${f}`, import.meta.url), "utf8"));
let dataset = registryDataset();
for (const f of sampleFiles) {
  const content = readFileSync(new URL(`../tests/fixtures/csv/${f.file}`, import.meta.url));
  dataset = importCsv(dataset, { kind: f.kind, sourceId: f.sourceId, fileName: f.file, content, now: SAMPLE_NOW }).dataset;
}
const promotionPolicy = PromotionPolicySchema.parse(json("policy.synthetic.json"));
const rankingPolicy = RankingPolicySchema.parse(json("ranking-policy.synthetic.json"));
const recommendationPolicy = RecommendationPolicySchema.parse(json("recommendation-policy.synthetic.json"));
const window = { start: "2026-09-01T00:00:00+07:00", end: "2026-10-01T00:00:00+07:00" };
const skuIds = dataset.skus.filter((s) => s.status === "active").map((s) => s.id);

const evaluation = evaluateCandidates({ dataset, policy: promotionPolicy, skuIds, actions: ACTIONS, window, evaluatedAt: SAMPLE_NOW });
const ranking = rankCandidates({ dataset, evaluation, promotionPolicy, rankingPolicy });
const full = buildRecommendations({
  dataset, evaluation, promotionPolicy, ranking, rankingPolicy, recommendationPolicy,
  objective: "SYNTHETIC demo objective", generatedAt: "2026-10-10T10:05:00+07:00",
});

const brief = (set: RecommendationSet) => ({
  clearance: set.redaction?.viewerClearance,
  shortlist: set.shortlist.map((g) => ({ action: g.action, rankWithheld: g.rankWithheld, ranked: g.ranked, unranked: g.unranked })),
  skus: set.recommendations.map((r) => ({
    sku: r.identity.merchantSku, status: r.status, action: r.action, rank: r.rank?.rank ?? null, statusReasons: r.statusReasons,
    facts: Object.fromEntries(r.facts.map((f) => [f.metric, f.redacted ? "redacted" : f.status === "computed" ? f.value : f.status])),
    evidenceBasis: r.evidenceBasis,
  })),
});
const first = full.recommendations.find((r) => r.status === "recommended")!;
const log = recordDecision([], first, {
  decision: "approve", decidedBy: "synthetic_manager", decidedAt: "2026-10-10T11:00:00+07:00", rationale: "SYNTHETIC demo decision", canApprove: true,
});
console.log(JSON.stringify({
  note: "SYNTHETIC data and policies",
  confidentialView: brief(redactForViewer(full, "confidential")),
  internalView: brief(redactForViewer(full, "internal")),
  decision: { id: log[0]!.id, sku: log[0]!.skuId, action: log[0]!.recommendedAction, outcomeStatus: log[0]!.outcomeStatus },
}, null, 2));
