import { z } from "zod";
import { ACTIONS, THRESHOLD_METRICS } from "../../rules/src/index.ts";
import type { PromotionPolicy, ThresholdMetric } from "../../rules/src/index.ts";

/** Strict validation for owner-supplied policy files (STEP 4, S4-DEC-05). */
const id = z.string().trim().min(1).max(128);
const instant = z.iso.datetime({ offset: true });
const actions = z.array(z.enum(ACTIONS)).min(1);
const metricIds = Object.keys(THRESHOLD_METRICS) as [ThresholdMetric, ...ThresholdMetric[]];

const MetricThresholdRuleSchema = z.strictObject({
  id, kind: z.literal("metric_threshold"), appliesTo: actions,
  metric: z.enum(metricIds),
  comparator: z.enum(["gte", "lte"]),
  threshold: z.number().finite(),
  unit: z.enum(["units", "ratio", "days", "minor_currency"]),
}).superRefine((r, ctx) => {
  const expected = THRESHOLD_METRICS[r.metric];
  if (r.unit !== expected) ctx.addIssue({ code: "custom", path: ["unit"], message: `${r.metric} is measured in ${expected}, not ${r.unit}` });
  if (expected === "ratio" && (r.threshold < 0 || r.threshold > 1)) ctx.addIssue({ code: "custom", path: ["threshold"], message: "Ratio thresholds must be within [0, 1] (e.g. 0.15, not 15)" });
  if (expected !== "ratio" && r.threshold < 0) ctx.addIssue({ code: "custom", path: ["threshold"], message: "Threshold cannot be negative" });
});

const ExclusionRuleSchema = z.strictObject({
  id, kind: z.literal("exclusion"), appliesTo: actions,
  scope: z.enum(["sku", "variant", "family", "brand", "category"]),
  ids: z.array(id).min(1),
});

const AllowedSkuStatusRuleSchema = z.strictObject({
  id, kind: z.literal("allowed_sku_status"), appliesTo: actions,
  statuses: z.array(z.enum(["active", "inactive", "discontinued"])).min(1),
});

export const PromotionPolicySchema: z.ZodType<PromotionPolicy> = z.strictObject({
  id, version: z.number().int().positive(),
  status: z.enum(["draft", "approved"]),
  approvedBy: z.string().trim().min(1).nullable(), approvedAt: instant.nullable(),
  effectiveFrom: instant, effectiveTo: instant.nullable(),
  costType: z.enum(["purchase", "landed", "other"]),
  unrestrictedActions: z.array(z.enum(ACTIONS)),
  rules: z.array(z.discriminatedUnion("kind", [MetricThresholdRuleSchema, ExclusionRuleSchema, AllowedSkuStatusRuleSchema])),
}).superRefine((p, ctx) => {
  if (p.status === "approved" && (p.approvedBy === null || p.approvedAt === null)) {
    ctx.addIssue({ code: "custom", path: ["approvedBy"], message: "An approved policy needs approvedBy and approvedAt" });
  }
  if (p.effectiveTo !== null && Date.parse(p.effectiveFrom) >= Date.parse(p.effectiveTo)) {
    ctx.addIssue({ code: "custom", path: ["effectiveTo"], message: "effectiveTo must be after effectiveFrom" });
  }
  const ids = p.rules.map((r) => r.id);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", path: ["rules"], message: "Rule ids must be unique" });
  for (const a of p.unrestrictedActions) {
    if (p.rules.some((r) => r.appliesTo.includes(a))) {
      ctx.addIssue({ code: "custom", path: ["unrestrictedActions"], message: `"${a}" is declared unrestricted but rules apply to it` });
    }
  }
});
