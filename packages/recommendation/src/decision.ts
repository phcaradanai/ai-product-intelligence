import { contentSha256 } from "../../rules/src/index.ts";
import type { PromotionAction } from "../../rules/src/index.ts";
import { recommendationContentHash } from "./build.ts";
import type { PolicyVersion, Recommendation, SkuStatus } from "./build.ts";

/** Thrown when a decision is not allowed; nothing is appended. */
export class DecisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecisionError";
  }
}

export type DecisionKind = "approve" | "reject" | "request_more_data";

export interface DecisionInput {
  decision: DecisionKind;
  decidedBy: string;
  /** Injected clock. */
  decidedAt: string;
  rationale: string;
  /** Caller-asserted approval permission until RBAC exists (DEC-008). Required for approve and reject. */
  canApprove: boolean;
}

/** Immutable record of a human decision (§5.2 decision record). Recommendation ≠ approval ≠ execution (INV-06). */
export interface DecisionRecord {
  id: string;
  recommendationId: string;
  /** SHA-256 of the unredacted recommendation content the decision was made on. */
  evidenceSnapshotSha256: string;
  skuId: string;
  recommendedAction: PromotionAction | null;
  recommendationStatus: SkuStatus;
  decision: DecisionKind;
  decidedBy: string;
  decidedAt: string;
  rationale: string;
  versions: {
    promotionPolicy: PolicyVersion | null;
    rankingPolicy: PolicyVersion | null;
    recommendationPolicy: PolicyVersion | null;
    metrics: Record<string, number>;
  };
  /** The record this one replaces for the same recommendation, if any. */
  supersedes: string | null;
  /** Never fabricated: filled only by a later outcome-measurement step (M4). */
  outcome: null;
  outcomeStatus: "not_yet_measurable";
}

const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Appends a decision to an append-only log and returns the new log; the input log is not mutated.
 * Requires the full (unredacted) recommendation so its content hash can be checked (S6-DEC-10).
 */
export function recordDecision(log: readonly DecisionRecord[], recommendation: Recommendation, input: DecisionInput): DecisionRecord[] {
  if (recommendation.redaction !== null) throw new DecisionError("Decisions are recorded against the full recommendation, not a redacted view");
  const sha = recommendationContentHash(recommendation);
  if (recommendation.id !== `rec_${sha.slice(0, 32)}`) throw new DecisionError("Recommendation content does not match its id");
  if (input.rationale.trim() === "") throw new DecisionError("A rationale is required");
  if (input.decidedBy.trim() === "") throw new DecisionError("decidedBy is required");
  if (!INSTANT.test(input.decidedAt) || Number.isNaN(Date.parse(input.decidedAt))) throw new DecisionError("decidedAt must be an ISO 8601 date-time with an offset");
  if (Date.parse(input.decidedAt) < Date.parse(recommendation.generatedAt)) throw new DecisionError("decidedAt is before the recommendation was generated");
  if ((input.decision === "approve" || input.decision === "reject") && input.canApprove !== true) {
    throw new DecisionError(`"${input.decision}" requires approval permission`);
  }
  if (input.decision === "approve" && recommendation.status !== "recommended") {
    throw new DecisionError(`Only a recommended action can be approved; status is ${recommendation.status}`);
  }
  const { promotionPolicy, rankingPolicy, recommendationPolicy } = recommendation.versions;
  for (const p of [promotionPolicy, rankingPolicy, recommendationPolicy]) {
    if (p === null) continue;
    const at = Date.parse(input.decidedAt);
    if (at < Date.parse(p.effectiveFrom) || (p.effectiveTo !== null && at >= Date.parse(p.effectiveTo))) {
      throw new DecisionError(`Policy ${p.id} v${p.version} is not effective at decidedAt`);
    }
  }

  const previous = [...log].reverse().find((r) => r.recommendationId === recommendation.id);
  const body: Omit<DecisionRecord, "id"> = {
    recommendationId: recommendation.id, evidenceSnapshotSha256: sha, skuId: recommendation.skuId,
    recommendedAction: recommendation.action, recommendationStatus: recommendation.status,
    decision: input.decision, decidedBy: input.decidedBy, decidedAt: input.decidedAt, rationale: input.rationale,
    versions: structuredClone(recommendation.versions), supersedes: previous?.id ?? null,
    outcome: null, outcomeStatus: "not_yet_measurable",
  };
  return [...log, { id: `dec_${contentSha256(body).slice(0, 32)}`, ...body }];
}

/** The latest decision per recommendation; earlier records stay in the log as history. */
export function currentDecisions(log: readonly DecisionRecord[]): DecisionRecord[] {
  const latest = new Map<string, DecisionRecord>();
  for (const r of log) latest.set(r.recommendationId, r);
  return [...latest.values()];
}
