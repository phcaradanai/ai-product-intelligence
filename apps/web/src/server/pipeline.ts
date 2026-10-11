/**
 * Server-only advisor pipeline for the Workspace (STEP 7). Pure over its inputs so it runs under
 * Node tests; never import this module from client code (S7 server boundary).
 */
import { PromotionPolicySchema, RankingPolicySchema, RecommendationPolicySchema, DecisionInputSchema } from "../../../../packages/contracts/src/index.ts";
import type { DataSource, DomainDataset, Sensitivity } from "../../../../packages/domain/src/models.ts";
import { importCsv } from "../../../../packages/ingestion/src/index.ts";
import type { ImportKind } from "../../../../packages/ingestion/src/index.ts";
import { rankCandidates } from "../../../../packages/ranking/src/index.ts";
import type { RankingCriterion } from "../../../../packages/ranking/src/index.ts";
import { buildRecommendations, currentDecisions, DecisionError, recordDecision, redactForViewer } from "../../../../packages/recommendation/src/index.ts";
import type { DecisionKind, DecisionRecord, RecommendationSet } from "../../../../packages/recommendation/src/index.ts";
import { ACTIONS, evaluateCandidates } from "../../../../packages/rules/src/index.ts";
import type { PromotionAction } from "../../../../packages/rules/src/index.ts";

export interface SampleInputs {
  /** Empty dataset with the source registry (governance records). */
  registry: DomainDataset;
  files: { kind: ImportKind; file: string; sourceId: string; content: string }[];
  promotionPolicy: unknown;
  rankingPolicy: unknown;
  recommendationPolicy: unknown;
  /** Fixed sample clock for ingestion and evaluation. */
  sampleNow: string;
  /** Clock of this server process; recommendations are generated at this instant. */
  generatedAt: string;
}

export const WINDOW = { start: "2026-09-01T00:00:00+07:00", end: "2026-10-01T00:00:00+07:00" } as const;
export const VIEWER_CLEARANCES = ["internal", "confidential"] as const satisfies readonly Sensitivity[];
/** Synthetic demo scenarios: the STEP 2 sample, and an edge set that reaches every status and fact state. */
export const SCENARIOS = ["sample", "edge"] as const;
export type Scenario = (typeof SCENARIOS)[number];
export type ViewerClearance = (typeof VIEWER_CLEARANCES)[number];

export interface GroupSummary {
  action: PromotionAction;
  eligible: number;
  total: number;
  rankingApplied: boolean;
  criteria: RankingCriterion[];
}

/** Everything the browser may see: the redacted set plus non-sensitive context. */
export interface WorkspaceView {
  set: RecommendationSet;
  groups: GroupSummary[];
  sources: Record<string, { name: string; kind: DataSource["kind"]; sensitivity: Sensitivity }>;
  policies: { promotion: string; ranking: string; recommendation: string };
  evaluatedAt: string;
  decisions: DecisionRecord[];
  decisionLogNote: "in_memory_resets_on_restart";
}

/** Runs import → evaluate → rank → recommend once; deterministic for fixed inputs. */
export function buildFullSet(inputs: SampleInputs) {
  let dataset = inputs.registry;
  for (const f of inputs.files) {
    dataset = importCsv(dataset, { kind: f.kind, sourceId: f.sourceId, fileName: f.file, content: f.content, now: inputs.sampleNow }).dataset;
  }
  const promotionPolicy = PromotionPolicySchema.parse(inputs.promotionPolicy);
  const rankingPolicy = RankingPolicySchema.parse(inputs.rankingPolicy);
  const recommendationPolicy = RecommendationPolicySchema.parse(inputs.recommendationPolicy);
  const skuIds = dataset.skus.filter((s) => s.status === "active").map((s) => s.id);
  const evaluation = evaluateCandidates({ dataset, policy: promotionPolicy, skuIds, actions: ACTIONS, window: WINDOW, evaluatedAt: inputs.sampleNow });
  const ranking = rankCandidates({ dataset, evaluation, promotionPolicy, rankingPolicy });
  const set = buildRecommendations({
    dataset, evaluation, promotionPolicy, ranking, rankingPolicy, recommendationPolicy,
    objective: null, generatedAt: inputs.generatedAt,
  });
  const groups: GroupSummary[] = recommendationPolicy.actionPreference.map((action) => {
    const list = ranking.lists.find((l) => l.action === action);
    const candidates = evaluation.evaluations.filter((e) => e.action === action);
    return {
      action,
      eligible: candidates.filter((e) => e.verdict === "eligible").length,
      total: candidates.length,
      rankingApplied: list?.rankingApplied ?? false,
      criteria: list?.rankingApplied ? list.criteria : [],
    };
  });
  const sources = Object.fromEntries(dataset.sources.map((s) => [s.id, { name: s.name, kind: s.kind, sensitivity: s.sensitivity }]));
  const policies = {
    promotion: `${promotionPolicy.id} v${promotionPolicy.version}`,
    ranking: `${rankingPolicy.id} v${rankingPolicy.version}`,
    recommendation: `${recommendationPolicy.id} v${recommendationPolicy.version}`,
  };
  return { set, groups, sources, policies, evaluatedAt: inputs.sampleNow };
}

/** The browser view: redacted on the server for an explicit clearance (S6-DEC-08). */
export function workspaceView(inputs: SampleInputs, clearance: ViewerClearance, log: readonly DecisionRecord[]): WorkspaceView {
  const full = buildFullSet(inputs);
  const ids = new Set(full.set.recommendations.map((r) => r.id));
  return {
    set: redactForViewer(full.set, clearance),
    groups: full.groups, sources: full.sources, policies: full.policies, evaluatedAt: full.evaluatedAt,
    decisions: currentDecisions(log).filter((d) => ids.has(d.recommendationId)),
    decisionLogNote: "in_memory_resets_on_restart",
  };
}

export type DecisionRefusal = "unknown_recommendation" | "not_recommended" | "no_permission" | "empty_rationale" | "refused_by_recorder";

/**
 * Records a decision against the full recommendation looked up by id. The browser never supplies
 * the recommendation body or the decision time.
 */
export function decide(
  inputs: SampleInputs, log: readonly DecisionRecord[],
  request: { recommendationId: string; decision: DecisionKind; rationale: string; canApprove: boolean },
  decidedAt: string,
): { ok: true; log: DecisionRecord[]; record: DecisionRecord } | { ok: false; reason: DecisionRefusal } {
  const rec = buildFullSet(inputs).set.recommendations.find((r) => r.id === request.recommendationId);
  if (!rec) return { ok: false, reason: "unknown_recommendation" };
  if (request.rationale.trim() === "") return { ok: false, reason: "empty_rationale" };
  if (request.decision !== "request_more_data" && !request.canApprove) return { ok: false, reason: "no_permission" };
  if (request.decision === "approve" && rec.status !== "recommended") return { ok: false, reason: "not_recommended" };
  const input = DecisionInputSchema.parse({ decision: request.decision, decidedBy: "demo_user", decidedAt, rationale: request.rationale, canApprove: request.canApprove });
  try {
    const next = recordDecision(log, rec, input);
    return { ok: true, log: next, record: next[next.length - 1]! };
  } catch (e) {
    if (e instanceof DecisionError) return { ok: false, reason: "refused_by_recorder" };
    throw e;
  }
}
