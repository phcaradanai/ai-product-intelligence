import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { DecisionRecord } from "../../../../packages/recommendation/src/index.ts";
import { decide, SCENARIOS, VIEWER_CLEARANCES, workspaceView } from "./pipeline.ts";
import { sampleInputs } from "./sample.ts";

/** In-memory, append-only decision log (S7-DEC-05): resets when the server restarts. */
let decisionLog: DecisionRecord[] = [];

/** Redacted workspace for an explicit demo clearance; the full set never leaves the server. */
export const getWorkspace = createServerFn({ method: "GET" })
  .validator(z.strictObject({ clearance: z.enum(VIEWER_CLEARANCES), scenario: z.enum(SCENARIOS) }))
  .handler(async ({ data }) => workspaceView(sampleInputs(data.scenario), data.clearance, decisionLog));

export const submitDecision = createServerFn({ method: "POST" })
  .validator(z.strictObject({
    recommendationId: z.string().regex(/^rec_[0-9a-f]{32}$/),
    decision: z.enum(["approve", "reject", "request_more_data"]),
    rationale: z.string().max(4000),
    canApprove: z.boolean(),
    scenario: z.enum(SCENARIOS),
  }))
  .handler(async ({ data }) => {
    const { scenario, ...request } = data;
    const result = decide(sampleInputs(scenario), decisionLog, request, new Date().toISOString());
    if (!result.ok) return { ok: false as const, reason: result.reason };
    decisionLog = result.log;
    return { ok: true as const, decisionId: result.record.id };
  });
