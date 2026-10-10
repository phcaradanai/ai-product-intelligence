import type { DomainDataset, Sensitivity } from "../../domain/src/models.ts";
import {
  availableStock, grossRevenue, realizedGrossMarginRatio, stockCoverDays, unitsSold,
} from "../../metrics/src/index.ts";
import type { MetricOptions, MetricResult, MetricWindow } from "../../metrics/src/index.ts";
import { rankingPolicyRef } from "../../ranking/src/index.ts";
import type { RankingOutput, RankingPolicy } from "../../ranking/src/index.ts";
import { contentSha256, policyRef } from "../../rules/src/index.ts";
import type {
  CandidateEvaluation, EvaluationOutput, PromotionAction, PromotionPolicy, RuleOutcome, RuleResult, RuleUnknownReason, Verdict, VerdictReason,
} from "../../rules/src/index.ts";
import type { RecommendationPolicy } from "./policy.ts";

/** Thrown when inputs do not belong to one evaluation run; never reported as a recommendation. */
export class RecommendationInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecommendationInputError";
  }
}

export type SkuStatus = "recommended" | "insufficient_data" | "review_required" | "blocked";
export type PolicyGateReason = "missing_action_preference" | "recommendation_policy_not_approved" | "recommendation_policy_not_effective";
export type StatusReason = VerdictReason | RuleUnknownReason | PolicyGateReason;

/** Next-step codes for missing or conflicting data (§5.3). The UI renders them as text. */
export type NextStep =
  | "import_sales_for_window" | "import_inventory_snapshot" | "import_cost_for_cost_type" | "check_sales_coverage"
  | "import_previous_period_sales" | "verify_sales_revenue" | "verify_sales_and_inventory" | "resolve_currency"
  | "choose_authoritative_sales_source" | "fix_overlapping_cost_periods" | "owner_review_post_action_margin" | "fix_catalog";

/**
 * Exhaustive status mapping for unknown-rule reasons (S6-DEC-04). Adding a reason code to metrics or
 * rules without classifying it here fails the typecheck.
 */
export const UNKNOWN_REASON_CLASS: Readonly<Record<RuleUnknownReason, { status: "insufficient_data" | "review_required"; nextStep: NextStep }>> = {
  no_sales_rows: { status: "insufficient_data", nextStep: "import_sales_for_window" },
  no_inventory_snapshots: { status: "insufficient_data", nextStep: "import_inventory_snapshot" },
  missing_cost: { status: "insufficient_data", nextStep: "import_cost_for_cost_type" },
  no_sales_in_window: { status: "insufficient_data", nextStep: "check_sales_coverage" },
  zero_baseline: { status: "insufficient_data", nextStep: "import_previous_period_sales" },
  zero_revenue: { status: "insufficient_data", nextStep: "verify_sales_revenue" },
  zero_denominator: { status: "insufficient_data", nextStep: "verify_sales_and_inventory" },
  mixed_currency: { status: "review_required", nextStep: "resolve_currency" },
  currency_mismatch: { status: "review_required", nextStep: "resolve_currency" },
  multiple_sales_sources: { status: "review_required", nextStep: "choose_authoritative_sales_source" },
  overlapping_cost: { status: "review_required", nextStep: "fix_overlapping_cost_periods" },
  post_action_unknown: { status: "review_required", nextStep: "owner_review_post_action_margin" },
  unknown_sku: { status: "review_required", nextStep: "fix_catalog" },
};

/** Every verdict reason except rule_unknown is a governance stop (review_required); rule_unknown is derived from rule reasons. */
export const VERDICT_REASON_CLASS: Readonly<Record<VerdictReason, "review_required" | "derive_from_rules">> = {
  missing_owner_policy: "review_required",
  policy_not_approved: "review_required",
  policy_not_effective: "review_required",
  policy_reference_error: "review_required",
  no_applicable_rules: "review_required",
  rule_failed: "review_required",
  rule_unknown: "derive_from_rules",
};

export interface PolicyVersion {
  id: string;
  version: number;
  sha256: string;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface SourceView {
  referenceId: string;
  sourceId: string | null;
  locator: string | null;
  ingestedAt: string | null;
}

export interface FactView extends MetricResult {
  sources: SourceView[];
  redacted: boolean;
}

export interface RuleResultView extends Omit<RuleResult, "outcome"> {
  outcome: RuleOutcome | "redacted";
  redacted: boolean;
}

export interface ConstraintView {
  action: PromotionAction;
  verdict: Verdict;
  reasons: VerdictReason[];
  rules: RuleResultView[];
}

export interface MissingInfo {
  action: PromotionAction;
  ruleId: string;
  metric: string | null;
  reasons: RuleUnknownReason[];
  nextSteps: NextStep[];
}

export interface Recommendation {
  /** "rec_" + SHA-256 of the unredacted content (S6-DEC-09). */
  id: string;
  skuId: string;
  identity: {
    skuId: string; merchantSku: string | null; status: string | null; variantId: string | null;
    attributes: Record<string, string | number | boolean>; familyId: string | null; modelName: string | null;
    brandId: string | null; brandName: string | null; categoryId: string | null;
    match: "internal_canonical";
  };
  objective: string | null;
  objectiveStatus: "provided" | "objective_unspecified";
  window: MetricWindow;
  knownAt: string | null;
  evaluatedAt: string;
  generatedAt: string;
  status: SkuStatus;
  action: PromotionAction | null;
  statusReasons: StatusReason[];
  missing: MissingInfo[];
  rank: { action: PromotionAction; rank: number | null; tied: boolean; ranked: boolean; withheld: boolean } | null;
  facts: FactView[];
  constraints: ConstraintView[];
  alternatives: { action: PromotionAction; verdict: Verdict; reasons: VerdictReason[] }[];
  evidenceBasis: "internal_only";
  confidence: {
    entityMatch: "internal_canonical";
    dataQuality: { value: null; reason: "not_computed" };
    retrieval: "not_applicable_internal_only";
    decisionModel: "rule_based";
  };
  versions: {
    promotionPolicy: PolicyVersion | null;
    rankingPolicy: PolicyVersion | null;
    recommendationPolicy: PolicyVersion | null;
    metrics: Record<string, number>;
  };
  sensitivity: Sensitivity | null;
  /** Null on the full view; set by redactForViewer(). */
  redaction: { viewerClearance: Sensitivity; redactedFields: number } | null;
}

export interface ShortlistGroup {
  action: PromotionAction;
  ranked: { skuId: string; rank: number | null; tied: boolean }[];
  unranked: string[];
  rankWithheld: boolean;
  sensitivity: Sensitivity | null;
}

export interface RecommendationSet {
  generatedAt: string;
  objective: string | null;
  window: MetricWindow | null;
  evidenceBasis: "internal_only";
  shortlist: ShortlistGroup[];
  recommendations: Recommendation[];
  redaction: { viewerClearance: Sensitivity } | null;
}

export interface RecommendationInput {
  dataset: DomainDataset;
  evaluation: EvaluationOutput;
  promotionPolicy: PromotionPolicy | null;
  ranking: RankingOutput;
  rankingPolicy: RankingPolicy | null;
  recommendationPolicy: RecommendationPolicy | null;
  /** Caller's stated business objective; passed through, never inferred, never used to choose. */
  objective: string | null;
  /** Injected clock. */
  generatedAt: string;
}

const SENSITIVITY_ORDER: readonly Sensitivity[] = ["public", "internal", "confidential", "restricted"];
export const maxSensitivity = (values: (Sensitivity | null)[]): Sensitivity | null =>
  values.reduce<Sensitivity | null>((acc, v) => (v === null ? acc : acc === null || SENSITIVITY_ORDER.indexOf(v) > SENSITIVITY_ORDER.indexOf(acc) ? v : acc), null);
export const exceeds = (s: Sensitivity | null, clearance: Sensitivity): boolean =>
  s !== null && SENSITIVITY_ORDER.indexOf(s) > SENSITIVITY_ORDER.indexOf(clearance);

const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;
const inPeriod = (at: string, from: string, to: string | null) => Date.parse(at) >= Date.parse(from) && (to === null || Date.parse(at) < Date.parse(to));

const version = (ref: { id: string; version: number; sha256: string }, p: { effectiveFrom: string; effectiveTo: string | null }): PolicyVersion =>
  ({ ...ref, effectiveFrom: p.effectiveFrom, effectiveTo: p.effectiveTo });

/** Content hash over everything except the id and the viewer-specific redaction. */
export function recommendationContentHash(rec: Recommendation): string {
  const { id: _id, redaction: _r, ...content } = rec;
  return contentSha256(content);
}

function identityOf(dataset: DomainDataset, skuId: string): Recommendation["identity"] {
  const sku = dataset.skus.find((s) => s.id === skuId);
  const variant = sku ? dataset.variants.find((v) => v.id === sku.variantId) : undefined;
  const family = variant ? dataset.families.find((f) => f.id === variant.familyId) : undefined;
  const brand = family ? dataset.brands.find((b) => b.id === family.brandId) : undefined;
  return {
    skuId, merchantSku: sku?.merchantSku ?? null, status: sku?.status ?? null, variantId: variant?.id ?? null,
    attributes: variant?.attributes ?? {}, familyId: family?.id ?? null, modelName: family?.modelName ?? null,
    brandId: brand?.id ?? null, brandName: brand?.name ?? null, categoryId: family?.categoryId ?? null,
    match: "internal_canonical",
  };
}

function factsOf(dataset: DomainDataset, skuId: string, window: MetricWindow, options: MetricOptions, promotionPolicy: PromotionPolicy | null): FactView[] {
  const results = [
    unitsSold(dataset, skuId, window, options),
    grossRevenue(dataset, skuId, window, options),
    availableStock(dataset, skuId, window, options),
    stockCoverDays(dataset, skuId, window, options),
    ...(promotionPolicy ? [realizedGrossMarginRatio(dataset, skuId, window, promotionPolicy.costType, options)] : []),
  ];
  const refs = new Map(dataset.references.map((r) => [r.id, r]));
  const factIndex = new Map<string, string>();
  for (const f of [...dataset.sales, ...dataset.inventory, ...dataset.costs]) factIndex.set(f.id, f.sourceReferenceId);
  return results.map((r) => ({
    ...r,
    sources: [...new Set(r.inputIds.map((id) => factIndex.get(id)).filter((x): x is string => x !== undefined))].sort().map((refId) => {
      const ref = refs.get(refId);
      return { referenceId: refId, sourceId: ref?.sourceId ?? null, locator: ref ? `${ref.locator.kind}:${ref.locator.value}` : null, ingestedAt: ref?.ingestedAt ?? null };
    }),
    redacted: false,
  }));
}

/** Walk the owner preference order (S6-DEC-02) and classify the stop (S6-DEC-04). */
function decide(evals: Map<PromotionAction, CandidateEvaluation>, preference: readonly PromotionAction[]):
  { status: SkuStatus; action: PromotionAction | null; statusReasons: StatusReason[]; missing: MissingInfo[] } {
  for (const action of preference) {
    const e = evals.get(action)!;
    if (e.verdict === "blocked") continue;
    if (e.verdict === "eligible") return { status: "recommended", action, statusReasons: [], missing: [] };

    const governance = e.reasons.filter((r) => VERDICT_REASON_CLASS[r] === "review_required");
    const unknownRules = e.ruleResults.filter((r) => r.outcome === "unknown");
    const unknownReasons = unknownRules.flatMap((r) => r.reasons as RuleUnknownReason[]);
    const missing: MissingInfo[] = unknownRules.map((r) => {
      const reasons = r.reasons as RuleUnknownReason[];
      return { action, ruleId: r.ruleId, metric: r.metric?.id ?? null, reasons, nextSteps: [...new Set(reasons.map((x) => UNKNOWN_REASON_CLASS[x].nextStep))] };
    });
    const status: SkuStatus = governance.length > 0 || unknownReasons.some((x) => UNKNOWN_REASON_CLASS[x].status === "review_required")
      ? "review_required" : "insufficient_data";
    return { status, action: null, statusReasons: [...new Set<StatusReason>([...e.reasons, ...unknownReasons])], missing };
  }
  return { status: "blocked", action: null, statusReasons: ["rule_failed"], missing: [] };
}

/**
 * Builds the full (unredacted) §5.2 response per SKU. Structured only: no prose, no execution.
 * Call redactForViewer() before showing it to anyone.
 */
export function buildRecommendations(input: RecommendationInput): RecommendationSet {
  const { dataset, evaluation, promotionPolicy, ranking, rankingPolicy, recommendationPolicy, generatedAt } = input;
  if (!INSTANT.test(generatedAt) || Number.isNaN(Date.parse(generatedAt))) throw new RecommendationInputError(`generatedAt must be an ISO 8601 date-time with an offset: "${generatedAt}"`);

  // ---- one evaluation run (S5-DEC-06 carried forward) ----
  const promoRef = promotionPolicy ? policyRef(promotionPolicy) : null;
  if (promoRef?.sha256 !== evaluation.policy?.sha256 || ranking.promotionPolicy?.sha256 !== evaluation.policy?.sha256) {
    throw new RecommendationInputError("promotionPolicy, evaluation and ranking do not share one promotion policy");
  }
  const rankRef = rankingPolicy ? rankingPolicyRef(rankingPolicy) : null;
  if (rankRef?.sha256 !== ranking.rankingPolicy?.sha256) throw new RecommendationInputError("rankingPolicy does not match the ranking output");
  const first = evaluation.evaluations[0];
  if (first && (ranking.window?.start !== first.window.start || ranking.window?.end !== first.window.end || ranking.knownAt !== first.knownAt || ranking.evaluatedAt !== first.evaluatedAt)) {
    throw new RecommendationInputError("ranking was computed for a different window, knownAt or evaluatedAt");
  }

  const gate: PolicyGateReason[] = [];
  if (!recommendationPolicy) gate.push("missing_action_preference");
  else {
    if (recommendationPolicy.status !== "approved") gate.push("recommendation_policy_not_approved");
    if (!inPeriod(generatedAt, recommendationPolicy.effectiveFrom, recommendationPolicy.effectiveTo)) gate.push("recommendation_policy_not_effective");
  }
  const preference = recommendationPolicy?.actionPreference ?? [];

  const versions: Recommendation["versions"] = {
    promotionPolicy: promoRef && promotionPolicy ? version(promoRef, promotionPolicy) : null,
    rankingPolicy: rankRef && rankingPolicy ? version(rankRef, rankingPolicy) : null,
    recommendationPolicy: recommendationPolicy ? version({ id: recommendationPolicy.id, version: recommendationPolicy.version, sha256: contentSha256(recommendationPolicy) }, recommendationPolicy) : null,
    metrics: {},
  };

  const skuIds = [...new Set(evaluation.evaluations.map((e) => e.skuId))];
  const recommendations: Recommendation[] = skuIds.map((skuId) => {
    const evals = new Map(evaluation.evaluations.filter((e) => e.skuId === skuId).map((e) => [e.action, e]));
    for (const a of preference) if (!evals.has(a)) throw new RecommendationInputError(`Evaluation lacks action "${a}" for ${skuId}`);
    const e0 = evals.values().next().value as CandidateEvaluation;
    const options: MetricOptions = e0.knownAt === null ? {} : { knownAt: e0.knownAt };

    const decision = gate.length > 0
      ? { status: "review_required" as const, action: null, statusReasons: [...gate] as StatusReason[], missing: [] }
      : decide(evals, preference);

    let rank: Recommendation["rank"] = null;
    if (decision.action) {
      const list = ranking.lists.find((l) => l.action === decision.action);
      const hit = list?.ranked.find((c) => c.skuId === skuId);
      rank = { action: decision.action, rank: hit?.rank ?? null, tied: hit?.tied ?? false, ranked: hit !== undefined, withheld: false };
    }

    const facts = factsOf(dataset, skuId, e0.window, options, promotionPolicy);
    const ordered = [...preference, ...[...evals.keys()].filter((a) => !preference.includes(a))];
    const constraints: ConstraintView[] = ordered.map((a) => {
      const e = evals.get(a)!;
      return { action: a, verdict: e.verdict, reasons: e.reasons, rules: e.ruleResults.map((r) => ({ ...r, redacted: false })) };
    });
    const metrics: Record<string, number> = {};
    for (const f of facts) metrics[f.metric] = f.version;
    for (const c of constraints) for (const r of c.rules) if (r.metric) metrics[r.metric.id] = r.metric.version;

    const rec: Recommendation = {
      id: "",
      skuId, identity: identityOf(dataset, skuId),
      objective: input.objective, objectiveStatus: input.objective === null ? "objective_unspecified" : "provided",
      window: e0.window, knownAt: e0.knownAt, evaluatedAt: e0.evaluatedAt, generatedAt,
      ...decision, rank, facts, constraints,
      alternatives: ordered.filter((a) => a !== decision.action).map((a) => ({ action: a, verdict: evals.get(a)!.verdict, reasons: evals.get(a)!.reasons })),
      evidenceBasis: "internal_only",
      confidence: { entityMatch: "internal_canonical", dataQuality: { value: null, reason: "not_computed" }, retrieval: "not_applicable_internal_only", decisionModel: "rule_based" },
      versions: { ...versions, metrics },
      sensitivity: maxSensitivity([...facts.map((f) => f.sensitivity), ...constraints.flatMap((c) => c.rules.map((r) => r.sensitivity))]),
      redaction: null,
    };
    rec.id = `rec_${recommendationContentHash(rec).slice(0, 32)}`;
    return rec;
  });

  // ---- shortlist (S6-DEC-05) ----
  const shortlist: ShortlistGroup[] = preference.map((action) => {
    const chosen = recommendations.filter((r) => r.action === action);
    const list = ranking.lists.find((l) => l.action === action);
    return {
      action,
      ranked: chosen.filter((r) => r.rank?.ranked).map((r) => ({ skuId: r.skuId, rank: r.rank!.rank, tied: r.rank!.tied }))
        .sort((a, b) => a.rank! - b.rank! || (a.skuId < b.skuId ? -1 : 1)),
      unranked: chosen.filter((r) => !r.rank?.ranked).map((r) => r.skuId).sort(),
      rankWithheld: false,
      sensitivity: list?.sensitivity ?? null,
    };
  });

  return { generatedAt, objective: input.objective, window: first?.window ?? null, evidenceBasis: "internal_only", shortlist, recommendations, redaction: null };
}
