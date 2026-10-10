import type { Sensitivity } from "../../domain/src/models.ts";
import { exceeds } from "./build.ts";
import type { RecommendationSet } from "./build.ts";

/**
 * Viewer-specific copy with everything above `viewerClearance` removed (S6-DEC-08, blueprint §11.4,
 * §15.2). The clearance is required: there is no default, and never full access by omission.
 * Verdicts and statuses stay visible; values, thresholds, rule outcomes and rank order do not.
 */
export function redactForViewer(set: RecommendationSet, viewerClearance: Sensitivity): RecommendationSet {
  const out: RecommendationSet = structuredClone(set);
  out.redaction = { viewerClearance };

  const hiddenRankActions = new Set<string>();
  for (const group of out.shortlist) {
    if (!exceeds(group.sensitivity, viewerClearance)) continue;
    hiddenRankActions.add(group.action);
    group.rankWithheld = true;
    group.ranked = group.ranked.map((c) => ({ skuId: c.skuId, rank: null, tied: false })).sort((a, b) => (a.skuId < b.skuId ? -1 : 1));
  }

  for (const rec of out.recommendations) {
    let redactedFields = 0;
    for (const fact of rec.facts) {
      if (!exceeds(fact.sensitivity, viewerClearance)) continue;
      fact.value = null;
      fact.reasons = [];
      fact.details = [];
      fact.redacted = true;
      redactedFields += 1;
    }
    for (const c of rec.constraints) {
      for (const rule of c.rules) {
        if (!exceeds(rule.sensitivity, viewerClearance)) continue;
        rule.outcome = "redacted";
        rule.reasons = [];
        rule.threshold = null;
        if (rule.metric) rule.metric = { ...rule.metric, value: null };
        rule.redacted = true;
        redactedFields += 1;
      }
    }
    for (const m of rec.missing) {
      const rule = rec.constraints.find((c) => c.action === m.action)?.rules.find((r) => r.ruleId === m.ruleId);
      if (rule?.redacted) {
        m.reasons = [];
        m.nextSteps = [];
      }
    }
    if (rec.rank && hiddenRankActions.has(rec.rank.action)) {
      rec.rank = { ...rec.rank, rank: null, tied: false, withheld: true };
      redactedFields += 1;
    }
    rec.redaction = { viewerClearance, redactedFields };
  }
  return out;
}
