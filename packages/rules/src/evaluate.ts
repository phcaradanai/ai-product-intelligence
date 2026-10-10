import { createHash } from "node:crypto";
import type { DomainDataset, Sensitivity } from "../../domain/src/models.ts";
import {
  availableStock, METRIC_DEFINITIONS, realizedGrossMarginRatio, sellThroughProxy, stockCoverDays, unitsSold,
} from "../../metrics/src/index.ts";
import type { MetricOptions, MetricReason, MetricResult, MetricWindow } from "../../metrics/src/index.ts";
import { PRICE_CHANGING_ACTIONS } from "./policy.ts";
import type { ExclusionRule, PolicyRule, PromotionAction, PromotionPolicy, ThresholdMetric } from "./policy.ts";

export type RuleOutcome = "pass" | "fail" | "unknown";
export type Verdict = "eligible" | "blocked" | "review_required";
export type VerdictReason =
  | "missing_owner_policy" | "policy_not_approved" | "policy_not_effective" | "policy_reference_error"
  | "no_applicable_rules" | "rule_failed" | "rule_unknown";

/** Reasons for an `unknown` rule outcome. */
export type RuleUnknownReason = MetricReason | "post_action_unknown" | "unknown_sku";
/**
 * Reasons for a `fail` outcome. Codes only: values stay in the structured `metric` and `threshold`
 * fields so that redaction can remove them (STEP 6).
 */
export type RuleFailReason = "below_threshold" | "above_threshold" | `excluded_${ExclusionRule["scope"]}:${string}` | `sku_status_${string}`;
export type RuleReason = RuleUnknownReason | RuleFailReason;

export interface RuleResult {
  ruleId: string;
  kind: PolicyRule["kind"];
  outcome: RuleOutcome;
  /** Why the outcome is fail or unknown; metric reason codes are passed through. */
  reasons: RuleReason[];
  metric: { id: string; version: number; status: MetricResult["status"]; value: number | null; dataAsOf: string | null } | null;
  threshold: { comparator: "gte" | "lte"; value: number; unit: string } | null;
  sensitivity: Sensitivity | null;
}

export interface PolicyRef {
  id: string;
  version: number;
  sha256: string;
}

export interface CandidateEvaluation {
  skuId: string;
  action: PromotionAction;
  verdict: Verdict;
  reasons: VerdictReason[];
  ruleResults: RuleResult[];
  policy: PolicyRef | null;
  window: MetricWindow;
  knownAt: string | null;
  evaluatedAt: string;
  sensitivity: Sensitivity | null;
}

export interface PolicyIssue {
  ruleId: string;
  code: "unknown_reference";
  message: string;
}

export interface EvaluationInput {
  dataset: DomainDataset;
  /** Owner policy validated with PromotionPolicySchema; null when none exists yet. */
  policy: PromotionPolicy | null;
  skuIds: readonly string[];
  actions: readonly PromotionAction[];
  window: MetricWindow;
  /** Injected clock; checked against the policy's effective period. */
  evaluatedAt: string;
  knownAt?: string;
}

export interface EvaluationOutput {
  policy: PolicyRef | null;
  policyIssues: PolicyIssue[];
  evaluations: CandidateEvaluation[];
}

const SENSITIVITY_ORDER: readonly Sensitivity[] = ["public", "internal", "confidential", "restricted"];
const maxSensitivity = (values: (Sensitivity | null)[]): Sensitivity | null =>
  values.reduce<Sensitivity | null>((acc, v) => (v === null ? acc : acc === null || SENSITIVITY_ORDER.indexOf(v) > SENSITIVITY_ORDER.indexOf(acc) ? v : acc), null);

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableJson((value as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

/** Thrown for malformed evaluation input; never reported as a verdict. */
export class RulesInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RulesInputError";
  }
}

/** SHA-256 of a value's canonical JSON (sorted keys); used to pin policy versions in results. */
export function contentSha256(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

export function policyRef(policy: PromotionPolicy): PolicyRef {
  return { id: policy.id, version: policy.version, sha256: contentSha256(policy) };
}

/** Exclusion ids that do not exist in the dataset (S4-DEC-06). */
export function checkPolicyReferences(policy: PromotionPolicy, dataset: DomainDataset): PolicyIssue[] {
  const known: Record<string, Set<string>> = {
    sku: new Set(dataset.skus.map((s) => s.id)),
    variant: new Set(dataset.variants.map((v) => v.id)),
    family: new Set(dataset.families.map((f) => f.id)),
    brand: new Set(dataset.brands.map((b) => b.id)),
    category: new Set(dataset.categories.map((c) => c.id)),
  };
  const issues: PolicyIssue[] = [];
  for (const rule of policy.rules) {
    if (rule.kind !== "exclusion") continue;
    for (const id of rule.ids) {
      if (!known[rule.scope]!.has(id)) {
        issues.push({ ruleId: rule.id, code: "unknown_reference", message: `${rule.scope} "${id}" is not in the dataset` });
      }
    }
  }
  return issues;
}

function metricFor(metric: ThresholdMetric, dataset: DomainDataset, skuId: string, window: MetricWindow, policy: PromotionPolicy, options: MetricOptions): MetricResult {
  switch (metric) {
    case "realized_gross_margin_ratio": return realizedGrossMarginRatio(dataset, skuId, window, policy.costType, options);
    case "available_stock": return availableStock(dataset, skuId, window, options);
    case "stock_cover_days": return stockCoverDays(dataset, skuId, window, options);
    case "units_sold": return unitsSold(dataset, skuId, window, options);
    case "sell_through_proxy": return sellThroughProxy(dataset, skuId, window, options);
  }
}

/** Brand, category, family and variant of a SKU, for exclusion scopes. */
function lineage(dataset: DomainDataset, skuId: string): Record<"sku" | "variant" | "family" | "brand" | "category", string | undefined> {
  const sku = dataset.skus.find((s) => s.id === skuId);
  const variant = sku && dataset.variants.find((v) => v.id === sku.variantId);
  const family = variant && dataset.families.find((f) => f.id === variant.familyId);
  return { sku: sku?.id, variant: variant?.id, family: family?.id, brand: family?.brandId, category: family?.categoryId };
}

function evaluateRule(rule: PolicyRule, action: PromotionAction, dataset: DomainDataset, skuId: string, window: MetricWindow, policy: PromotionPolicy, options: MetricOptions): RuleResult {
  const result: RuleResult = { ruleId: rule.id, kind: rule.kind, outcome: "pass", reasons: [], metric: null, threshold: null, sensitivity: null };
  switch (rule.kind) {
    case "metric_threshold": {
      const m = metricFor(rule.metric, dataset, skuId, window, policy, options);
      result.metric = { id: m.metric, version: m.version, status: m.status, value: m.value, dataAsOf: m.dataAsOf };
      result.threshold = { comparator: rule.comparator, value: rule.threshold, unit: rule.unit };
      // A rule on a cost-derived metric reveals cost policy (its threshold) even when no data exists,
      // so it is at least confidential (INV-08; found by the STEP 6 redaction test).
      result.sensitivity = METRIC_DEFINITIONS[rule.metric].inputs.includes("costs") ? maxSensitivity([m.sensitivity, "confidential"]) : m.sensitivity;
      if (m.status !== "computed" || m.value === null) {
        result.outcome = "unknown";
        result.reasons.push(...m.reasons);
        return result;
      }
      const ok = rule.comparator === "gte" ? m.value >= rule.threshold : m.value <= rule.threshold;
      if (!ok) {
        result.outcome = "fail";
        result.reasons.push(rule.comparator === "gte" ? "below_threshold" : "above_threshold");
      } else if (rule.metric === "realized_gross_margin_ratio" && PRICE_CHANGING_ACTIONS.has(action)) {
        result.outcome = "unknown";
        result.reasons.push("post_action_unknown");
      }
      return result;
    }
    case "exclusion": {
      const id = lineage(dataset, skuId)[rule.scope];
      if (id !== undefined && rule.ids.includes(id)) {
        result.outcome = "fail";
        result.reasons.push(`excluded_${rule.scope}:${id}`);
      }
      return result;
    }
    case "allowed_sku_status": {
      const status = dataset.skus.find((s) => s.id === skuId)?.status;
      if (status === undefined) {
        result.outcome = "unknown";
        result.reasons.push("unknown_sku");
      } else if (!rule.statuses.includes(status)) {
        result.outcome = "fail";
        result.reasons.push(`sku_status_${status}`);
      }
      return result;
    }
  }
}

/**
 * Deterministic policy evaluation per (SKU, action). Never ranks, scores or recommends.
 * Unknown is never pass (S4-DEC-01).
 */
export function evaluateCandidates(input: EvaluationInput): EvaluationOutput {
  const { dataset, policy, window, evaluatedAt } = input;
  if (!INSTANT.test(evaluatedAt) || Number.isNaN(Date.parse(evaluatedAt))) {
    throw new RulesInputError(`evaluatedAt must be an ISO 8601 date-time with seconds and an offset: "${evaluatedAt}"`);
  }
  const options: MetricOptions = input.knownAt === undefined ? {} : { knownAt: input.knownAt };
  const ref = policy ? policyRef(policy) : null;
  const policyIssues = policy ? checkPolicyReferences(policy, dataset) : [];

  const capReasons: VerdictReason[] = [];
  if (!policy) capReasons.push("missing_owner_policy");
  else {
    if (policy.status !== "approved") capReasons.push("policy_not_approved");
    const at = Date.parse(evaluatedAt);
    if (at < Date.parse(policy.effectiveFrom) || (policy.effectiveTo !== null && at >= Date.parse(policy.effectiveTo))) {
      capReasons.push("policy_not_effective");
    }
    if (policyIssues.length > 0) capReasons.push("policy_reference_error");
  }

  const evaluations: CandidateEvaluation[] = [];
  for (const skuId of input.skuIds) {
    for (const action of input.actions) {
      const ruleResults = policy
        ? policy.rules.filter((r) => r.appliesTo.includes(action)).map((r) => evaluateRule(r, action, dataset, skuId, window, policy, options))
        : [];
      const reasons: VerdictReason[] = [...capReasons];
      if (policy && ruleResults.length === 0 && !policy.unrestrictedActions.includes(action)) reasons.push("no_applicable_rules");
      if (ruleResults.some((r) => r.outcome === "fail")) reasons.push("rule_failed");
      if (ruleResults.some((r) => r.outcome === "unknown")) reasons.push("rule_unknown");

      const verdict: Verdict = reasons.includes("rule_failed") ? "blocked" : reasons.length > 0 ? "review_required" : "eligible";
      evaluations.push({
        skuId, action, verdict, reasons, ruleResults, policy: ref, window,
        knownAt: input.knownAt ?? null, evaluatedAt,
        sensitivity: maxSensitivity(ruleResults.map((r) => r.sensitivity)),
      });
    }
  }
  return { policy: ref, policyIssues, evaluations };
}
