import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DecisionInputSchema, parseDomainDataset, PromotionPolicySchema, RankingPolicySchema, RecommendationPolicySchema,
} from "../packages/contracts/src/index.ts";
import { rankCandidates } from "../packages/ranking/src/index.ts";
import type { RankingPolicy } from "../packages/ranking/src/index.ts";
import {
  buildRecommendations, currentDecisions, DecisionError, recordDecision, redactForViewer, RecommendationInputError,
} from "../packages/recommendation/src/index.ts";
import type { DecisionInput, Recommendation, RecommendationPolicy, RecommendationSet } from "../packages/recommendation/src/index.ts";
import { evaluateCandidates } from "../packages/rules/src/index.ts";
import type { PromotionAction, PromotionPolicy } from "../packages/rules/src/index.ts";
import { SEPTEMBER } from "./fixtures/metrics.ts";
import { recommendationDataset as ds } from "./fixtures/recommendation.ts";

const json = (f: string): unknown => JSON.parse(readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8"));
/** SYNTHETIC policies: test values, not business guidance. */
const PROMO = PromotionPolicySchema.parse(json("policy.synthetic.json"));
const RANKING = RankingPolicySchema.parse(json("ranking-policy.synthetic.json"));
const RECO = RecommendationPolicySchema.parse(json("recommendation-policy.synthetic.json"));
const promo = (): PromotionPolicy => { const p = structuredClone(PROMO); p.rules = p.rules.filter((r) => r.kind !== "exclusion"); return p; };
const EVALUATED_AT = "2026-10-10T10:00:00+07:00";
const GENERATED_AT = "2026-10-10T10:05:00+07:00";
const SKUS = ["r1", "r2", "r3", "r4", "r5", "r6", "r7"];
const ACTIONS3: PromotionAction[] = ["advertise_only", "discount", "hold"];

function build(o: { promotion?: PromotionPolicy | null; ranking?: RankingPolicy | null; reco?: RecommendationPolicy | null; preference?: PromotionAction[]; objective?: string | null } = {}): RecommendationSet {
  const promotionPolicy = o.promotion === undefined ? promo() : o.promotion;
  const rankingPolicy = o.ranking === undefined ? structuredClone(RANKING) : o.ranking;
  let recommendationPolicy = o.reco === undefined ? structuredClone(RECO) : o.reco;
  if (o.preference && recommendationPolicy) recommendationPolicy = { ...recommendationPolicy, actionPreference: o.preference };
  const evaluation = evaluateCandidates({ dataset: ds, policy: promotionPolicy, skuIds: SKUS, actions: ACTIONS3, window: SEPTEMBER, evaluatedAt: EVALUATED_AT });
  const ranking = rankCandidates({ dataset: ds, evaluation, promotionPolicy, rankingPolicy });
  return buildRecommendations({ dataset: ds, evaluation, promotionPolicy, ranking, rankingPolicy, recommendationPolicy, objective: o.objective === undefined ? "synthetic objective" : o.objective, generatedAt: GENERATED_AT });
}
const rec = (set: RecommendationSet, sku: string): Recommendation => set.recommendations.find((r) => r.skuId === sku)!;
const summary = (r: Recommendation) => [r.status, r.action, r.rank?.rank ?? null];

test("fixture is valid", () => { parseDomainDataset(structuredClone(ds)); });

// ---------- action choice (hand-derived) ----------

test("preference [advertise_only, discount, hold]: statuses, actions and ranks", () => {
  const set = build();
  assert.deepEqual(SKUS.map((s) => [s, ...summary(rec(set, s))]), [
    ["r1", "recommended", "advertise_only", 1],
    ["r2", "recommended", "advertise_only", 1],
    ["r3", "recommended", "advertise_only", 4],
    ["r4", "recommended", "advertise_only", 3],
    ["r5", "recommended", "advertise_only", null],   // eligible, growth unavailable → unranked
    ["r6", "recommended", "hold", null],             // advertise_only and discount blocked (stock 2)
    ["r7", "insufficient_data", null, null],         // no sales → margin unknown
  ]);
});
test("missing data names the metric and the next step", () => {
  const r7 = rec(build(), "r7");
  assert.deepEqual(r7.statusReasons, ["rule_unknown", "no_sales_rows"]);
  assert.deepEqual(r7.missing, [{ action: "advertise_only", ruleId: "r_margin", metric: "realized_gross_margin_ratio", reasons: ["no_sales_rows"], nextSteps: ["import_sales_for_window"] }]);
});
test("no fall-through past an unknown: a review_required top choice stops the walk", () => {
  const set = build({ preference: ["discount", "advertise_only", "hold"] });
  const r1 = rec(set, "r1");
  assert.deepEqual(summary(r1), ["review_required", null, null]);  // not advertise_only, not hold
  assert.deepEqual(r1.statusReasons, ["rule_unknown", "post_action_unknown"]);
  assert.deepEqual(summary(rec(set, "r6")), ["recommended", "hold", null]); // discount and advertise_only are known fails
});
test("every preferred action blocked → blocked status, constraint results kept", () => {
  const r6 = rec(build({ preference: ["advertise_only", "discount"] }), "r6");
  assert.deepEqual([r6.status, r6.action, r6.statusReasons], ["blocked", null, ["rule_failed"]]);
  assert.deepEqual(r6.constraints.map((c) => [c.action, c.verdict]), [["advertise_only", "blocked"], ["discount", "blocked"], ["hold", "eligible"]]);
});
test("no, draft or not-yet-effective recommendation policy → review_required, no action", () => {
  assert.ok(build({ reco: null }).recommendations.every((r) => r.status === "review_required" && r.action === null && r.statusReasons.join() === "missing_action_preference"));
  assert.deepEqual(rec(build({ reco: { ...RECO, status: "draft" } }), "r1").statusReasons, ["recommendation_policy_not_approved"]);
  assert.deepEqual(rec(build({ reco: { ...RECO, effectiveFrom: "2026-11-01T00:00:00+07:00" } }), "r1").statusReasons, ["recommendation_policy_not_effective"]);
});
test("no promotion policy → review_required everywhere; margin fact omitted", () => {
  const set = build({ promotion: null });
  assert.ok(set.recommendations.every((r) => r.status === "review_required" && r.statusReasons.includes("missing_owner_policy")));
  assert.ok(!rec(set, "r1").facts.some((f) => f.metric === "realized_gross_margin_ratio"));
});

// ---------- response anatomy (§5.2) ----------

test("facts are full metric results with versions, data time and source references", () => {
  const r1 = rec(build(), "r1");
  assert.deepEqual(r1.facts.map((f) => [f.metric, f.version, f.value]), [
    ["units_sold", 1, 11], ["gross_revenue", 1, 11_000_000], ["available_stock", 1, 22], ["stock_cover_days", 1, 22 / (11 / 30)], ["realized_gross_margin_ratio", 1, 0.3],
  ]);
  assert.deepEqual(r1.facts[0]!.sources, [{ referenceId: "ref_erp", sourceId: "src_erp", locator: "internal_record:synthetic:ref_erp", ingestedAt: "2026-10-01T06:00:00+07:00" }]);
  assert.equal(r1.facts[2]!.dataAsOf, "2026-09-30T22:00:00+07:00");
});
test("identity, alternatives, evidence basis, confidence dimensions and versions", () => {
  const r1 = rec(build(), "r1");
  assert.deepEqual([r1.identity.merchantSku, r1.identity.brandName, r1.identity.match], ["SYN-r1", "MetricBrand (synthetic)", "internal_canonical"]);
  assert.deepEqual(r1.alternatives.map((a) => [a.action, a.verdict]), [["discount", "review_required"], ["hold", "eligible"]]);
  assert.equal(r1.evidenceBasis, "internal_only");
  assert.deepEqual(r1.confidence, { entityMatch: "internal_canonical", dataQuality: { value: null, reason: "not_computed" }, retrieval: "not_applicable_internal_only", decisionModel: "rule_based" });
  assert.ok(r1.versions.promotionPolicy && r1.versions.rankingPolicy && r1.versions.recommendationPolicy);
  assert.deepEqual(r1.versions.metrics, { units_sold: 1, gross_revenue: 1, available_stock: 1, stock_cover_days: 1, realized_gross_margin_ratio: 1 });
});
test("objective is passed through, never inferred", () => {
  assert.deepEqual([rec(build(), "r1").objective, rec(build(), "r1").objectiveStatus], ["synthetic objective", "provided"]);
  const none = rec(build({ objective: null }), "r1");
  assert.deepEqual([none.objective, none.objectiveStatus, none.action], [null, "objective_unspecified", "advertise_only"]);
});
test("shortlist: grouped by preferred action, ordered by that action's rank, unranked kept apart", () => {
  assert.deepEqual(build().shortlist.map((g) => [g.action, g.ranked.map((c) => [c.skuId, c.rank]), g.unranked]), [
    ["advertise_only", [["r1", 1], ["r2", 1], ["r4", 3], ["r3", 4]], ["r5"]],
    ["discount", [], []],
    ["hold", [], ["r6"]],
  ]);
});
test("no score or recommendation-strength wording", () => {
  assert.ok(!/score|"top|potential|high_|probab/i.test(JSON.stringify(build())));
});
test("building is deterministic and ids are content hashes", () => {
  const a = build(), b = build();
  assert.deepEqual(a, b);
  assert.match(rec(a, "r1").id, /^rec_[0-9a-f]{32}$/);
  assert.notEqual(rec(a, "r1").id, rec(build({ objective: "other" }), "r1").id);
});
test("inputs from different runs are rejected", () => {
  const promotionPolicy = promo();
  const evaluation = evaluateCandidates({ dataset: ds, policy: promotionPolicy, skuIds: SKUS, actions: ACTIONS3, window: SEPTEMBER, evaluatedAt: EVALUATED_AT });
  const ranking = rankCandidates({ dataset: ds, evaluation, promotionPolicy, rankingPolicy: RANKING });
  const otherRanking = { ...RANKING, version: 2 };
  assert.throws(() => buildRecommendations({ dataset: ds, evaluation, promotionPolicy, ranking, rankingPolicy: otherRanking, recommendationPolicy: RECO, objective: null, generatedAt: GENERATED_AT }), RecommendationInputError);
  const narrow = evaluateCandidates({ dataset: ds, policy: promotionPolicy, skuIds: SKUS, actions: ["advertise_only"], window: SEPTEMBER, evaluatedAt: EVALUATED_AT });
  const narrowRanking = rankCandidates({ dataset: ds, evaluation: narrow, promotionPolicy, rankingPolicy: RANKING });
  assert.throws(() => buildRecommendations({ dataset: ds, evaluation: narrow, promotionPolicy, ranking: narrowRanking, rankingPolicy: RANKING, recommendationPolicy: RECO, objective: null, generatedAt: GENERATED_AT }), RecommendationInputError, "preference action not evaluated");
});

// ---------- redaction (§11.4, §15.2) ----------

/** Every number in a redacted view must be a version, a count of redactions, or a catalog attribute. */
function numbersOutsideAllowed(value: unknown, key = "", parent = ""): string[] {
  if (typeof value === "number") return ["version", "redactedFields", "screenSizeInches"].includes(key) || parent === "metrics" ? [] : [`${parent}.${key}=${value}`];
  if (Array.isArray(value)) return value.flatMap((v) => numbersOutsideAllowed(v, key, parent));
  if (value !== null && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => numbersOutsideAllowed(v, k, key));
  return [];
}
test("internal-clearance view contains no confidential number, threshold, rule outcome or rank", () => {
  const view = redactForViewer(build(), "internal");
  assert.deepEqual(numbersOutsideAllowed(view), []);
  const r1 = rec(view, "r1");
  assert.ok(r1.facts.every((f) => f.redacted && f.value === null));
  assert.deepEqual(r1.constraints[0]!.rules.map((r) => [r.ruleId, r.outcome]), [["r_margin", "redacted"], ["r_stock", "redacted"], ["r_status", "pass"]]);
  assert.deepEqual([r1.status, r1.action, r1.rank], ["recommended", "advertise_only", { action: "advertise_only", rank: null, tied: false, ranked: true, withheld: true }]);
  assert.deepEqual(view.shortlist[0]!.ranked.map((c) => c.skuId), ["r1", "r2", "r3", "r4"]); // order by id, rank withheld
  assert.equal(view.shortlist[0]!.rankWithheld, true);
});
test("confidential-clearance view keeps values; redaction does not change the id or the full set", () => {
  const full = build();
  const before = structuredClone(full);
  const view = redactForViewer(full, "confidential");
  assert.equal(rec(view, "r1").facts[0]!.value, 11);
  assert.equal(rec(view, "r1").rank!.rank, 1);
  assert.equal(rec(redactForViewer(full, "internal"), "r1").id, rec(full, "r1").id);
  assert.deepEqual(full, before);
});

// ---------- decision record ----------

const approve: DecisionInput = { decision: "approve", decidedBy: "synthetic_manager", decidedAt: "2026-10-10T11:00:00+07:00", rationale: "Synthetic test decision", canApprove: true };

test("approving a recommended action appends an immutable record with versions and no outcome", () => {
  const r1 = rec(build(), "r1");
  const log = recordDecision([], r1, approve);
  assert.equal(log.length, 1);
  const d = log[0]!;
  assert.deepEqual([d.recommendationId, d.recommendedAction, d.decision, d.supersedes, d.outcome, d.outcomeStatus], [r1.id, "advertise_only", "approve", null, null, "not_yet_measurable"]);
  assert.deepEqual(d.versions, r1.versions);
  assert.match(d.id, /^dec_[0-9a-f]{32}$/);
  assert.ok(!("executed" in d) && !("execution" in d));
});
test("a later decision supersedes; the log is append-only and the input log is untouched", () => {
  const r1 = rec(build(), "r1");
  const first = recordDecision([], r1, approve);
  const second = recordDecision(first, r1, { ...approve, decision: "reject", decidedAt: "2026-10-10T12:00:00+07:00" });
  assert.equal(first.length, 1);
  assert.equal(second.length, 2);
  assert.equal(second[1]!.supersedes, second[0]!.id);
  assert.deepEqual(currentDecisions(second).map((d) => d.decision), ["reject"]);
});
test("refusals: non-recommended approve, missing permission, empty rationale, tampering, redacted view, bad timing", () => {
  const set = build();
  const r1 = rec(set, "r1");
  assert.throws(() => recordDecision([], rec(set, "r7"), approve), DecisionError, "insufficient_data cannot be approved");
  assert.throws(() => recordDecision([], r1, { ...approve, canApprove: false }), DecisionError);
  assert.throws(() => recordDecision([], r1, { ...approve, decision: "reject", canApprove: false }), DecisionError);
  assert.equal(recordDecision([], rec(set, "r7"), { ...approve, decision: "request_more_data", canApprove: false }).length, 1);
  assert.throws(() => recordDecision([], r1, { ...approve, rationale: "  " }), DecisionError);
  const tampered = structuredClone(r1); tampered.facts[0]!.value = 999;
  assert.throws(() => recordDecision([], tampered, approve), DecisionError, "content no longer matches id");
  assert.throws(() => recordDecision([], rec(redactForViewer(set, "confidential"), "r1"), approve), DecisionError);
  assert.throws(() => recordDecision([], r1, { ...approve, decidedAt: "2026-10-10T10:00:00+07:00" }), DecisionError, "before generatedAt");
  const expiring = rec(build({ reco: { ...RECO, effectiveTo: "2026-10-10T10:30:00+07:00" } }), "r1");
  assert.throws(() => recordDecision([], expiring, approve), DecisionError, "policy expired before decision");
});

// ---------- schemas and purity ----------

test("schemas: duplicate preference and loose decision input are rejected", () => {
  assert.equal(RecommendationPolicySchema.safeParse({ ...RECO, actionPreference: ["hold", "hold"] }).success, false);
  assert.equal(RecommendationPolicySchema.safeParse({ ...RECO, actionPreference: [] }).success, false);
  assert.equal(DecisionInputSchema.safeParse(approve).success, true);
  assert.equal(DecisionInputSchema.safeParse({ ...approve, rationale: "" }).success, false);
  assert.equal(DecisionInputSchema.safeParse({ ...approve, executeNow: true }).success, false);
  assert.equal(DecisionInputSchema.safeParse({ ...approve, decidedAt: "2026-10-10" }).success, false);
});
test("recommendation package stays pure: no Zod, no contracts, no I/O", () => {
  for (const file of ["build.ts", "redact.ts", "decision.ts", "policy.ts", "index.ts"]) {
    const source = readFileSync(new URL(`../packages/recommendation/src/${file}`, import.meta.url), "utf8");
    assert.ok(!/from "zod"|contracts\/src|node:fs|fetch\(/.test(source), file);
  }
});
