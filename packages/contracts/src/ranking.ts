import { z } from "zod";
import { RANKING_METRICS } from "../../ranking/src/index.ts";
import type { RankingPolicy } from "../../ranking/src/index.ts";
import { ACTIONS } from "../../rules/src/index.ts";

/** Strict validation for owner-supplied ranking policies (STEP 5). */
const instant = z.iso.datetime({ offset: true });

export const RankingPolicySchema: z.ZodType<RankingPolicy> = z.strictObject({
  id: z.string().trim().min(1).max(128),
  version: z.number().int().positive(),
  status: z.enum(["draft", "approved"]),
  approvedBy: z.string().trim().min(1).nullable(),
  approvedAt: instant.nullable(),
  effectiveFrom: instant,
  effectiveTo: instant.nullable(),
  appliesTo: z.array(z.enum(ACTIONS)).min(1),
  criteria: z.array(z.strictObject({ metric: z.enum(RANKING_METRICS), direction: z.enum(["desc", "asc"]) })).min(1),
}).superRefine((p, ctx) => {
  if (p.status === "approved" && (p.approvedBy === null || p.approvedAt === null)) {
    ctx.addIssue({ code: "custom", path: ["approvedBy"], message: "An approved ranking policy needs approvedBy and approvedAt" });
  }
  if (p.effectiveTo !== null && Date.parse(p.effectiveFrom) >= Date.parse(p.effectiveTo)) {
    ctx.addIssue({ code: "custom", path: ["effectiveTo"], message: "effectiveTo must be after effectiveFrom" });
  }
  const metrics = p.criteria.map((c) => c.metric);
  if (new Set(metrics).size !== metrics.length) ctx.addIssue({ code: "custom", path: ["criteria"], message: "Each metric may appear once" });
  if (new Set(p.appliesTo).size !== p.appliesTo.length) ctx.addIssue({ code: "custom", path: ["appliesTo"], message: "Duplicate action" });
});
