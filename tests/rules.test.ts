import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PromotionPolicySchema } from "../packages/contracts/src/index.ts";
import { evaluateCandidates, policyRef, RulesInputError } from "../packages/rules/src/index.ts";
import type { CandidateEvaluation, EvaluationInput, PromotionAction, PromotionPolicy } from "../packages/rules/src/index.ts";
import { metricsDataset as ds, SEPTEMBER } from "./fixtures/metrics.ts";

/** SYNTHETIC owner policy: thresholds are test values, not business guidance. */
const raw: unknown = JSON.parse(readFileSync(new URL("./fixtures/policy.synthetic.json", import.meta.url), "utf8"));
const POLICY = PromotionPolicySchema.parse(raw);
const policy = (): PromotionPolicy => structuredClone(POLICY);
const EVALUATED_AT = "2026-10-10T10:00:00+07:00";

const evaluate = (overrides: Partial<EvaluationInput> = {}) =>
  evaluateCandidates({ dataset: ds, policy: policy(), skuIds: ["sku_a"], actions: ["advertise_only"], window: SEPTEMBER, evaluatedAt: EVALUATED_AT, ...overrides });
const one = (skuId: string, action: PromotionAction, overrides: Partial<EvaluationInput> = {}): CandidateEvaluation =>
  evaluate({ skuIds: [skuId], actions: [action], ...overrides }).evaluations[0]!;
const outcomes = (e: CandidateEvaluation) => Object.fromEntries(e.ruleResults.map((r) => [r.ruleId, r.outcome]));

// ---------- verdicts (hand-derived from the STEP 3 golden values) ----------

test("all rules pass → eligible (sku_a: margin 0.1856 ≥ 0.15, stock 11 ≥ 5, active)", () => {
  const e = one("sku_a", "advertise_only");
  assert.deepEqual([e.verdict, e.reasons], ["eligible", []]);
  assert.deepEqual(outcomes(e), { r_margin: "pass", r_stock: "pass", r_status: "pass" });
  assert.equal(e.ruleResults[0]!.metric!.version, 1);
});
test("discount: a passing current-margin rule is post_action_unknown, not pass", () => {
  const e = one("sku_a", "discount");
  assert.equal(e.verdict, "review_required");
  assert.deepEqual(e.ruleResults.find((r) => r.ruleId === "r_margin")!.reasons, ["post_action_unknown"]);
});
test("a failing rule blocks; a failing margin stays fail even for discount", () => {
  const p = policy();
  (p.rules[0] as { threshold: number }).threshold = 0.2; // 0.1856 < 0.2
  for (const action of ["advertise_only", "discount"] as const) {
    const e = one("sku_a", action, { policy: p });
    assert.equal(e.verdict, "blocked", action);
    assert.equal(outcomes(e).r_margin, "fail");
  }
});
test("unknown is never pass: no sales → margin unknown → review_required", () => {
  const e = one("sku_b", "advertise_only");
  assert.deepEqual([e.verdict, e.reasons], ["review_required", ["rule_unknown"]]);
  assert.deepEqual(e.ruleResults.find((r) => r.ruleId === "r_margin")!.reasons, ["no_sales_rows"]);
  assert.equal(outcomes(e).r_stock, "pass"); // available 5 ≥ 5
});
test("exclusion blocks, and unknowns are still listed", () => {
  const e = one("sku_d", "discount");
  assert.equal(e.verdict, "blocked");
  assert.deepEqual(e.reasons, ["rule_failed", "rule_unknown"]);
  assert.deepEqual(e.ruleResults.find((r) => r.ruleId === "r_excl")!.reasons, ["excluded_sku:sku_d"]);
});
test("SKU status is a policy rule, not a built-in", () => {
  const discontinued = structuredClone(ds);
  discontinued.skus.find((s) => s.id === "sku_a")!.status = "discontinued";
  assert.equal(one("sku_a", "advertise_only", { dataset: discontinued }).verdict, "blocked");
  const p = policy();
  p.rules = p.rules.filter((r) => r.kind !== "allowed_sku_status");
  assert.equal(one("sku_a", "advertise_only", { dataset: discontinued, policy: p }).verdict, "eligible");
});

// ---------- governance caps ----------

test("no policy → review_required / missing_owner_policy for every candidate", () => {
  const out = evaluate({ policy: null, skuIds: ["sku_a", "sku_b"], actions: ["discount", "hold"] });
  assert.equal(out.evaluations.length, 4);
  assert.ok(out.evaluations.every((e) => e.verdict === "review_required" && e.reasons.join() === "missing_owner_policy"));
  assert.equal(out.policy, null);
});
test("a draft policy can never make a candidate eligible", () => {
  const p = policy(); p.status = "draft";
  assert.deepEqual(one("sku_a", "advertise_only", { policy: p }).reasons, ["policy_not_approved"]);
});
test("policy outside its effective period caps the verdict", () => {
  assert.deepEqual(one("sku_a", "advertise_only", { evaluatedAt: "2026-08-15T10:00:00+07:00" }).reasons, ["policy_not_effective"]);
});
test("no applicable rules is review_required unless the action is declared unrestricted", () => {
  assert.deepEqual(one("sku_a", "hold").verdict, "eligible");
  const p = policy(); p.unrestrictedActions = [];
  assert.deepEqual(one("sku_a", "hold", { policy: p }).reasons, ["no_applicable_rules"]);
});
test("exclusion ids missing from the dataset are reported and cap verdicts", () => {
  const p = policy();
  p.rules.push({ id: "r_typo", kind: "exclusion", appliesTo: ["advertise_only"], scope: "brand", ids: ["brand_typo"] });
  const out = evaluate({ policy: p });
  assert.deepEqual(out.policyIssues.map((i) => [i.ruleId, i.code]), [["r_typo", "unknown_reference"]]);
  assert.deepEqual(out.evaluations[0]!.reasons, ["policy_reference_error"]);
});

// ---------- provenance, sensitivity, determinism ----------

test("each evaluation carries policy hash, window, knownAt and evaluatedAt", () => {
  const e = one("sku_a", "advertise_only", { knownAt: "2026-10-02T00:00:00+07:00" });
  assert.deepEqual(e.policy, policyRef(POLICY));
  assert.match(e.policy!.sha256, /^[0-9a-f]{64}$/);
  assert.deepEqual([e.window, e.knownAt, e.evaluatedAt], [SEPTEMBER, "2026-10-02T00:00:00+07:00", EVALUATED_AT]);
});
test("policy hash changes with any policy change", () => {
  const p = policy(); (p.rules[1] as { threshold: number }).threshold = 6;
  assert.notEqual(policyRef(p).sha256, policyRef(POLICY).sha256);
});
test("a margin rule makes the evaluation confidential; exclusion-only results carry no sensitivity", () => {
  assert.equal(one("sku_a", "advertise_only").sensitivity, "confidential");
  const p = policy(); p.rules = p.rules.filter((r) => r.kind === "exclusion");
  assert.equal(one("sku_d", "discount", { policy: p }).sensitivity, null);
});
test("evaluation is deterministic", () => {
  const input = { skuIds: ["sku_a", "sku_b", "sku_c", "sku_d"], actions: ["discount", "bundle", "advertise_only", "hold"] as PromotionAction[] };
  assert.deepEqual(evaluate(input), evaluate(input));
});
test("malformed evaluatedAt throws instead of skipping the effective-period check", () => {
  assert.throws(() => evaluate({ evaluatedAt: "2026-10-10" }), RulesInputError);
  assert.throws(() => evaluate({ evaluatedAt: "2026-10-10T10:00:00" }), RulesInputError);
});

// ---------- policy schema (S4-DEC-05) ----------

const bad = (mutate: (p: Record<string, unknown> & { rules: Record<string, unknown>[] }) => void) => {
  const p = structuredClone(raw) as Record<string, unknown> & { rules: Record<string, unknown>[] };
  mutate(p);
  return PromotionPolicySchema.safeParse(p).success;
};
test("policy schema rejects silent typos", () => {
  assert.equal(bad(() => {}), true);
  assert.equal(bad((p) => { p.rules[0]!.threshold = 15; }), false, "ratio 15 instead of 0.15");
  assert.equal(bad((p) => { p.rules[1]!.unit = "days"; }), false, "unit does not match metric");
  assert.equal(bad((p) => { p.rules[0]!.metric = "gross_revenue"; }), false, "metric not allowed in thresholds");
  assert.equal(bad((p) => { p.rules[0]!.kind = "budget"; }), false, "unknown rule kind");
  assert.equal(bad((p) => { p.approvedBy = null; }), false, "approved without approver");
  assert.equal(bad((p) => { p.unrestrictedActions = ["discount"]; }), false, "unrestricted action with rules");
  assert.equal(bad((p) => { p.rules[1]!.id = "r_margin"; }), false, "duplicate rule id");
  assert.equal(bad((p) => { p.rules[0]!.appliesTo = ["promote"]; }), false, "unknown action");
});

test("rules package stays pure: no Zod, no contracts, no ranking vocabulary", () => {
  for (const file of ["evaluate.ts", "policy.ts", "index.ts"]) {
    const source = readFileSync(new URL(`../packages/rules/src/${file}`, import.meta.url), "utf8");
    assert.ok(!/from "zod"|contracts\/src|node:fs/.test(source), file);
    assert.ok(!/"recommended"|\bscore\w*\s*[:=(]|\brank\w*\s*[:=(]/i.test(source), file);
  }
});
test("a rule on a cost-derived metric is confidential even when the metric has no data", () => {
  const e = one("sku_b", "advertise_only"); // no sales → margin no_data, sensitivity from inputs would be null
  assert.equal(e.ruleResults.find((r) => r.ruleId === "r_margin")!.sensitivity, "confidential");
});
test("fail reasons are codes, never values", () => {
  const p = policy(); (p.rules[0] as { threshold: number }).threshold = 0.2;
  assert.deepEqual(one("sku_a", "advertise_only", { policy: p }).ruleResults.find((r) => r.ruleId === "r_margin")!.reasons, ["below_threshold"]);
});
