import { z } from "zod";
import type { DecisionInput, RecommendationPolicy } from "../../recommendation/src/index.ts";
import { ACTIONS } from "../../rules/src/index.ts";

/** Strict validation for the owner recommendation policy and for decision input (STEP 6). */
const instant = z.iso.datetime({ offset: true });

export const RecommendationPolicySchema: z.ZodType<RecommendationPolicy> = z.strictObject({
  id: z.string().trim().min(1).max(128),
  version: z.number().int().positive(),
  status: z.enum(["draft", "approved"]),
  approvedBy: z.string().trim().min(1).nullable(),
  approvedAt: instant.nullable(),
  effectiveFrom: instant,
  effectiveTo: instant.nullable(),
  actionPreference: z.array(z.enum(ACTIONS)).min(1),
}).superRefine((p, ctx) => {
  if (p.status === "approved" && (p.approvedBy === null || p.approvedAt === null)) {
    ctx.addIssue({ code: "custom", path: ["approvedBy"], message: "An approved recommendation policy needs approvedBy and approvedAt" });
  }
  if (p.effectiveTo !== null && Date.parse(p.effectiveFrom) >= Date.parse(p.effectiveTo)) {
    ctx.addIssue({ code: "custom", path: ["effectiveTo"], message: "effectiveTo must be after effectiveFrom" });
  }
  if (new Set(p.actionPreference).size !== p.actionPreference.length) {
    ctx.addIssue({ code: "custom", path: ["actionPreference"], message: "Each action may appear once" });
  }
});

export const DecisionInputSchema: z.ZodType<DecisionInput> = z.strictObject({
  decision: z.enum(["approve", "reject", "request_more_data"]),
  decidedBy: z.string().trim().min(1).max(256),
  decidedAt: instant,
  rationale: z.string().trim().min(1).max(4000),
  canApprove: z.boolean(),
});
