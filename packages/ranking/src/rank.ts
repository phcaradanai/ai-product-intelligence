import type { DomainDataset, Sensitivity } from "../../domain/src/models.ts";
import {
  availableStock, realizedGrossMarginRatio, salesGrowthUnits, sellThroughProxy, stockCoverDays, unitsSold,
} from "../../metrics/src/index.ts";
import type { MetricOptions, MetricReason, MetricResult, MetricWindow } from "../../metrics/src/index.ts";
import { contentSha256, policyRef } from "../../rules/src/index.ts";
import type {
  CandidateEvaluation, EvaluationOutput, PolicyRef, PromotionAction, PromotionPolicy, Verdict, VerdictReason,
} from "../../rules/src/index.ts";
import type { RankingCriterion, RankingMetric, RankingPolicy } from "./policy.ts";

/** Thrown when ranking input mixes evaluation contexts or policies; never reported as a ranking. */
export class RankingInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RankingInputError";
  }
}

export type ListReason =
  | "missing_ranking_policy" | "ranking_policy_not_approved" | "ranking_policy_not_effective" | "ranking_policy_not_applicable";

export type NotRankedReason = "not_eligible" | "ranking_metric_unavailable" | ListReason;

export interface RankingKey {
  metric: RankingMetric;
  version: number;
  direction: RankingCriterion["direction"];
  value: number;
}

export interface RankedCandidate {
  /** Competition rank (1, 1, 3). Not a probability or score (INV-10). */
  rank: number;
  tied: boolean;
  skuId: string;
  keys: RankingKey[];
}

export interface NotRankedCandidate {
  skuId: string;
  verdict: Verdict;
  reason: NotRankedReason;
  verdictReasons: VerdictReason[];
  /** For ranking_metric_unavailable: metric → reason codes. */
  metricReasons: Partial<Record<RankingMetric, MetricReason[]>>;
}

export interface RankedList {
  action: PromotionAction;
  /** No authorized external evidence is used yet (S5-DEC-08, blueprint §5.3). */
  evidenceBasis: "internal_only";
  rankingApplied: boolean;
  reasons: ListReason[];
  criteria: RankingCriterion[];
  ranked: RankedCandidate[];
  notRanked: NotRankedCandidate[];
  sensitivity: Sensitivity | null;
}

export interface SkuAlternatives {
  skuId: string;
  actions: { action: PromotionAction; verdict: Verdict; reasons: VerdictReason[] }[];
}

export interface RankingInput {
  dataset: DomainDataset;
  /** Output of evaluateCandidates() (STEP 4); ranking reuses its window, knownAt and evaluatedAt. */
  evaluation: EvaluationOutput;
  /** The promotion policy behind `evaluation`; its hash must match. Supplies the margin cost basis. */
  promotionPolicy: PromotionPolicy | null;
  rankingPolicy: RankingPolicy | null;
}

export interface RankingOutput {
  promotionPolicy: PolicyRef | null;
  rankingPolicy: PolicyRef | null;
  window: MetricWindow | null;
  knownAt: string | null;
  evaluatedAt: string | null;
  lists: RankedList[];
  alternativesBySku: SkuAlternatives[];
}

const SENSITIVITY_ORDER: readonly Sensitivity[] = ["public", "internal", "confidential", "restricted"];
const maxSensitivity = (values: (Sensitivity | null)[]): Sensitivity | null =>
  values.reduce<Sensitivity | null>((acc, v) => (v === null ? acc : acc === null || SENSITIVITY_ORDER.indexOf(v) > SENSITIVITY_ORDER.indexOf(acc) ? v : acc), null);

/** Comparison precision (S5-DEC-04). */
const round9 = (n: number): number => Math.round(n * 1e9) / 1e9;

export function rankingPolicyRef(policy: RankingPolicy): PolicyRef {
  return { id: policy.id, version: policy.version, sha256: contentSha256(policy) };
}

function metricFor(metric: RankingMetric, dataset: DomainDataset, skuId: string, window: MetricWindow, costType: PromotionPolicy["costType"] | null, options: MetricOptions): MetricResult {
  switch (metric) {
    case "units_sold": return unitsSold(dataset, skuId, window, options);
    case "sales_growth_units": return salesGrowthUnits(dataset, skuId, window, options);
    case "available_stock": return availableStock(dataset, skuId, window, options);
    case "stock_cover_days": return stockCoverDays(dataset, skuId, window, options);
    case "sell_through_proxy": return sellThroughProxy(dataset, skuId, window, options);
    case "realized_gross_margin_ratio":
      if (costType === null) throw new RankingInputError("A margin criterion needs the promotion policy's costType");
      return realizedGrossMarginRatio(dataset, skuId, window, costType, options);
  }
}

/** The single (window, knownAt, evaluatedAt) context shared by every evaluation (S5-DEC-06). */
function sharedContext(evaluations: readonly CandidateEvaluation[]): { window: MetricWindow; knownAt: string | null; evaluatedAt: string } | null {
  const first = evaluations[0];
  if (!first) return null;
  for (const e of evaluations) {
    if (e.window.start !== first.window.start || e.window.end !== first.window.end || e.knownAt !== first.knownAt || e.evaluatedAt !== first.evaluatedAt) {
      throw new RankingInputError("Evaluations mix windows, knownAt or evaluatedAt; rank one evaluation run at a time");
    }
    if (e.policy?.sha256 !== first.policy?.sha256) throw new RankingInputError("Evaluations mix promotion policies");
  }
  return { window: first.window, knownAt: first.knownAt, evaluatedAt: first.evaluatedAt };
}

/** Lexicographic comparison over owner criteria; ties broken by SKU id for display only. */
function compare(a: RankedCandidate, b: RankedCandidate): number {
  for (let i = 0; i < a.keys.length; i++) {
    const ka = a.keys[i]!;
    const kb = b.keys[i]!;
    if (ka.value !== kb.value) return ka.direction === "desc" ? kb.value - ka.value : ka.value - kb.value;
  }
  return a.skuId < b.skuId ? -1 : a.skuId > b.skuId ? 1 : 0;
}
const sameKeys = (a: RankedCandidate, b: RankedCandidate) => a.keys.every((k, i) => k.value === b.keys[i]!.value);

/**
 * Orders eligible candidates per action by an owner ranking policy (STEP 5). Never scores,
 * never picks one action per SKU, never drops a candidate.
 */
export function rankCandidates(input: RankingInput): RankingOutput {
  const { dataset, evaluation, promotionPolicy, rankingPolicy } = input;
  const promoRef = promotionPolicy ? policyRef(promotionPolicy) : null;
  if (promoRef?.sha256 !== evaluation.policy?.sha256) {
    throw new RankingInputError("promotionPolicy does not match the policy used for the evaluation");
  }
  const context = sharedContext(evaluation.evaluations);
  const rankRef = rankingPolicy ? rankingPolicyRef(rankingPolicy) : null;

  const policyReasons: ListReason[] = [];
  if (!rankingPolicy) policyReasons.push("missing_ranking_policy");
  else {
    if (rankingPolicy.status !== "approved") policyReasons.push("ranking_policy_not_approved");
    if (context) {
      const at = Date.parse(context.evaluatedAt);
      if (at < Date.parse(rankingPolicy.effectiveFrom) || (rankingPolicy.effectiveTo !== null && at >= Date.parse(rankingPolicy.effectiveTo))) {
        policyReasons.push("ranking_policy_not_effective");
      }
    }
  }

  const actions = [...new Set(evaluation.evaluations.map((e) => e.action))];
  const lists: RankedList[] = actions.map((action) => {
    const candidates = evaluation.evaluations.filter((e) => e.action === action);
    const reasons: ListReason[] = [...policyReasons];
    if (rankingPolicy && !rankingPolicy.appliesTo.includes(action)) reasons.push("ranking_policy_not_applicable");
    const criteria = rankingPolicy?.criteria ?? [];
    const list: RankedList = {
      action, evidenceBasis: "internal_only", rankingApplied: reasons.length === 0, reasons,
      criteria, ranked: [], notRanked: [], sensitivity: null,
    };
    const notRanked = (e: CandidateEvaluation, reason: NotRankedReason, metricReasons: NotRankedCandidate["metricReasons"] = {}) =>
      list.notRanked.push({ skuId: e.skuId, verdict: e.verdict, reason, verdictReasons: e.reasons, metricReasons });

    const sensitivities: (Sensitivity | null)[] = [];
    for (const e of candidates) {
      if (e.verdict !== "eligible") { notRanked(e, "not_eligible"); continue; }
      if (!list.rankingApplied || !context) { notRanked(e, reasons[0]!); continue; }
      const options: MetricOptions = context.knownAt === null ? {} : { knownAt: context.knownAt };
      const keys: RankingKey[] = [];
      const missing: NotRankedCandidate["metricReasons"] = {};
      for (const c of criteria) {
        const m = metricFor(c.metric, dataset, e.skuId, context.window, promotionPolicy?.costType ?? null, options);
        sensitivities.push(m.sensitivity);
        if (m.status !== "computed" || m.value === null) missing[c.metric] = m.reasons;
        else keys.push({ metric: c.metric, version: m.version, direction: c.direction, value: round9(m.value) });
      }
      if (Object.keys(missing).length > 0) notRanked(e, "ranking_metric_unavailable", missing);
      else list.ranked.push({ rank: 0, tied: false, skuId: e.skuId, keys });
    }

    list.ranked.sort(compare);
    list.ranked.forEach((c, i) => {
      const prev = list.ranked[i - 1];
      if (prev && sameKeys(prev, c)) {
        c.rank = prev.rank;
        c.tied = true;
        prev.tied = true;
      } else {
        c.rank = i + 1;
      }
    });
    list.sensitivity = maxSensitivity(sensitivities);
    return list;
  });

  const skuIds = [...new Set(evaluation.evaluations.map((e) => e.skuId))];
  const alternativesBySku = skuIds.map((skuId) => ({
    skuId,
    actions: evaluation.evaluations.filter((e) => e.skuId === skuId).map((e) => ({ action: e.action, verdict: e.verdict, reasons: e.reasons })),
  }));

  return {
    promotionPolicy: promoRef, rankingPolicy: rankRef,
    window: context?.window ?? null, knownAt: context?.knownAt ?? null, evaluatedAt: context?.evaluatedAt ?? null,
    lists, alternativesBySku,
  };
}
