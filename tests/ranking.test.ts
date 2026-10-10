import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PromotionPolicySchema, RankingPolicySchema } from "../packages/contracts/src/index.ts";
import { evaluateCandidates } from "../packages/rules/src/index.ts";
import type { EvaluationOutput, PromotionAction, PromotionPolicy } from "../packages/rules/src/index.ts";
import { rankCandidates, RankingInputError } from "../packages/ranking/src/index.ts";
import type { RankingOutput, RankingPolicy } from "../packages/ranking/src/index.ts";
import { rankingDataset as ds } from "./fixtures/ranking.ts";
import { SEPTEMBER } from "./fixtures/metrics.ts";

const json = (f: string): unknown => JSON.parse(readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8"));
/** SYNTHETIC policies: test values, not business guidance. */
const PROMO = PromotionPolicySchema.parse(json("policy.synthetic.json"));
const RANKING = RankingPolicySchema.parse(json("ranking-policy.synthetic.json"));
const promo = (): PromotionPolicy => { const p = structuredClone(PROMO); p.rules = p.rules.filter((r) => r.kind !== "exclusion"); return p; };
const ranking = (): RankingPolicy => structuredClone(RANKING);
const EVALUATED_AT = "2026-10-10T10:00:00+07:00";
const SKUS = ["r1", "r2", "r3", "r4", "r5", "r6"];

function run(opts: { promotion?: PromotionPolicy | null; rankingPolicy?: RankingPolicy | null; actions?: PromotionAction[]; knownAt?: string } = {}): { evaluation: EvaluationOutput; out: RankingOutput } {
  const promotionPolicy = opts.promotion === undefined ? promo() : opts.promotion;
  const evaluation = evaluateCandidates({
    dataset: ds, policy: promotionPolicy, skuIds: SKUS, actions: opts.actions ?? ["advertise_only", "discount", "hold"],
    window: SEPTEMBER, evaluatedAt: EVALUATED_AT, ...(opts.knownAt ? { knownAt: opts.knownAt } : {}),
  });
  const out = rankCandidates({ dataset: ds, evaluation, promotionPolicy, rankingPolicy: opts.rankingPolicy === undefined ? ranking() : opts.rankingPolicy });
  return { evaluation, out };
}
const list = (out: RankingOutput, action: PromotionAction) => out.lists.find((l) => l.action === action)!;

test("golden fixture is valid", async () => {
  const { parseDomainDataset } = await import("../packages/contracts/src/index.ts");
  parseDomainDataset(structuredClone(ds));
});

// ---------- golden order (hand-derived, see tests/fixtures/ranking.ts) ----------

test("lexicographic order with a competition-rank tie", () => {
  const l = list(run().out, "advertise_only");
  assert.equal(l.rankingApplied, true);
  assert.deepEqual(l.ranked.map((c) => [c.rank, c.skuId, c.tied]), [[1, "r1", true], [1, "r2", true], [3, "r4", false], [4, "r3", false]]);
});
test("float noise does not split a tie (cover 22/(11/30) = 60.00000000000001 vs 60)", () => {
  const l = list(run().out, "advertise_only");
  assert.deepEqual(l.ranked.filter((c) => c.skuId === "r1" || c.skuId === "r2").map((c) => c.keys[0]!.value), [60, 60]);
});
test("eligible but a ranking metric is unavailable → notRanked, never placed first or last", () => {
  const l = list(run().out, "advertise_only");
  const r5 = l.notRanked.find((n) => n.skuId === "r5")!;
  assert.deepEqual([r5.verdict, r5.reason, r5.metricReasons], ["eligible", "ranking_metric_unavailable", { sales_growth_units: ["no_sales_rows"] }]);
  assert.ok(!l.ranked.some((c) => c.skuId === "r5"));
});
test("blocked and review_required candidates are listed, not ranked", () => {
  const { out } = run();
  const r6 = list(out, "advertise_only").notRanked.find((n) => n.skuId === "r6")!;
  assert.deepEqual([r6.verdict, r6.reason, r6.verdictReasons], ["blocked", "not_eligible", ["rule_failed"]]);
  const discount = list(out, "discount");
  assert.equal(discount.ranked.length, 0);
  assert.deepEqual(discount.notRanked.map((n) => [n.skuId, n.verdict]), [
    ["r1", "review_required"], ["r2", "review_required"], ["r3", "review_required"], ["r4", "review_required"], ["r5", "review_required"], ["r6", "blocked"],
  ]);
});
test("every candidate appears exactly once per action", () => {
  for (const l of run().out.lists) {
    assert.deepEqual([...l.ranked.map((c) => c.skuId), ...l.notRanked.map((n) => n.skuId)].sort(), SKUS);
  }
});
test("direction is honored: asc reverses the first criterion", () => {
  const p = ranking(); p.criteria[0]!.direction = "asc";
  assert.deepEqual(list(run({ rankingPolicy: p }).out, "advertise_only").ranked.map((c) => [c.rank, c.skuId]), [[1, "r3"], [2, "r1"], [2, "r2"], [4, "r4"]]);
});

// ---------- governance ----------

test("no ranking policy → nothing ranked, every eligible candidate listed with the reason", () => {
  const l = list(run({ rankingPolicy: null }).out, "advertise_only");
  assert.deepEqual([l.rankingApplied, l.reasons, l.ranked.length], [false, ["missing_ranking_policy"], 0]);
  assert.ok(l.notRanked.filter((n) => n.verdict === "eligible").every((n) => n.reason === "missing_ranking_policy"));
});
test("draft or not-yet-effective ranking policy ranks nothing", () => {
  const draft = ranking(); draft.status = "draft";
  assert.deepEqual(list(run({ rankingPolicy: draft }).out, "advertise_only").reasons, ["ranking_policy_not_approved"]);
  const later = ranking(); later.effectiveFrom = "2026-11-01T00:00:00+07:00";
  assert.deepEqual(list(run({ rankingPolicy: later }).out, "advertise_only").reasons, ["ranking_policy_not_effective"]);
});
test("actions outside the ranking policy are not ranked (hold is eligible but unranked)", () => {
  const hold = list(run().out, "hold");
  assert.deepEqual(hold.reasons, ["ranking_policy_not_applicable"]);
  assert.ok(hold.notRanked.every((n) => n.verdict === "eligible" && n.reason === "ranking_policy_not_applicable"));
});
test("no promotion policy → nothing eligible → nothing ranked", () => {
  const { out } = run({ promotion: null });
  assert.ok(out.lists.every((l) => l.ranked.length === 0 && l.notRanked.every((n) => n.verdictReasons.includes("missing_owner_policy"))));
});

// ---------- context, provenance, output vocabulary ----------

test("a promotion policy that does not match the evaluation is rejected", () => {
  const { evaluation } = run();
  const other = promo(); other.costType = "landed";
  assert.throws(() => rankCandidates({ dataset: ds, evaluation, promotionPolicy: other, rankingPolicy: ranking() }), RankingInputError);
});
test("evaluations from different windows cannot be ranked together", () => {
  const a = run().evaluation;
  const b = evaluateCandidates({ dataset: ds, policy: promo(), skuIds: SKUS, actions: ["advertise_only"], window: { start: "2026-08-01T00:00:00+07:00", end: "2026-09-01T00:00:00+07:00" }, evaluatedAt: EVALUATED_AT });
  const mixed: EvaluationOutput = { ...a, evaluations: [...a.evaluations, ...b.evaluations] };
  assert.throws(() => rankCandidates({ dataset: ds, evaluation: mixed, promotionPolicy: promo(), rankingPolicy: ranking() }), RankingInputError);
});
test("output carries both policy refs, the shared context and internal-only evidence basis", () => {
  const { out, evaluation } = run({ knownAt: "2026-10-05T00:00:00+07:00" });
  assert.deepEqual(out.promotionPolicy, evaluation.policy);
  assert.match(out.rankingPolicy!.sha256, /^[0-9a-f]{64}$/);
  assert.deepEqual([out.window, out.knownAt, out.evaluatedAt], [SEPTEMBER, "2026-10-05T00:00:00+07:00", EVALUATED_AT]);
  assert.ok(out.lists.every((l) => l.evidenceBasis === "internal_only"));
});
test("ranking by margin makes the list confidential", () => {
  assert.equal(list(run().out, "advertise_only").sensitivity, "confidential");
});
test("alternatives list every action per SKU with its verdict; no action is chosen", () => {
  const r1 = run().out.alternativesBySku.find((a) => a.skuId === "r1")!;
  assert.deepEqual(r1.actions.map((a) => [a.action, a.verdict]), [["advertise_only", "eligible"], ["discount", "review_required"], ["hold", "eligible"]]);
});
test("no score or verdict language in the output", () => {
  const text = JSON.stringify(run().out);
  assert.ok(!/score|"top|potential|recommend/i.test(text));
});
test("ranking is deterministic", () => {
  assert.deepEqual(run().out, run().out);
});

// ---------- schema ----------

test("ranking policy schema rejects missing direction, duplicates, revenue and empty criteria", () => {
  const ok = (mutate: (p: { criteria: Record<string, unknown>[] } & Record<string, unknown>) => void) => {
    const p = structuredClone(json("ranking-policy.synthetic.json")) as { criteria: Record<string, unknown>[] } & Record<string, unknown>;
    mutate(p);
    return RankingPolicySchema.safeParse(p).success;
  };
  assert.equal(ok(() => {}), true);
  assert.equal(ok((p) => { delete p.criteria[0]!.direction; }), false, "direction is never defaulted");
  assert.equal(ok((p) => { p.criteria[1]!.metric = "stock_cover_days"; }), false, "duplicate metric");
  assert.equal(ok((p) => { p.criteria[0]!.metric = "gross_revenue"; }), false, "currency-bound metric");
  assert.equal(ok((p) => { p.criteria = []; }), false, "empty criteria");
  assert.equal(ok((p) => { p.criteria[0]!.weight = 0.5; }), false, "no weights");
});
test("ranking package stays pure: no Zod, no contracts", () => {
  for (const file of ["rank.ts", "policy.ts", "index.ts"]) {
    const source = readFileSync(new URL(`../packages/ranking/src/${file}`, import.meta.url), "utf8");
    assert.ok(!/from "zod"|contracts\/src|node:fs/.test(source), file);
  }
});
