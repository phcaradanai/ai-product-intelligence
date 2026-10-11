import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildFullSet, decide, workspaceView } from "../apps/web/src/server/pipeline.ts";
import type { SampleInputs } from "../apps/web/src/server/pipeline.ts";
import { registryDataset, sampleFiles, SAMPLE_NOW } from "./fixtures/csv/registry.ts";

/** Same inputs the web server bundles (apps/web/src/server/sample.ts), read from disk for Node. */
const read = (f: string) => readFileSync(new URL(`./fixtures/csv/${f}`, import.meta.url), "utf8");
const inputs = (): SampleInputs => ({
  registry: registryDataset(),
  files: sampleFiles.map((f) => ({ ...f, content: read(f.file) })),
  promotionPolicy: JSON.parse(read("policy.synthetic.json")),
  rankingPolicy: JSON.parse(read("ranking-policy.synthetic.json")),
  recommendationPolicy: JSON.parse(read("recommendation-policy.synthetic.json")),
  sampleNow: SAMPLE_NOW,
  generatedAt: SAMPLE_NOW,
});
const LATER = "2026-10-10T12:00:00+07:00";

function numbersOutsideAllowed(value: unknown, key = "", parent = ""): string[] {
  if (typeof value === "number") {
    const allowed = ["version", "redactedFields", "screenSizeInches", "modelYear", "eligible", "total"].includes(key) || parent === "metrics";
    return allowed ? [] : [`${parent}.${key}=${value}`];
  }
  if (Array.isArray(value)) return value.flatMap((v) => numbersOutsideAllowed(v, key, parent));
  if (value !== null && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => numbersOutsideAllowed(v, k, key));
  return [];
}

test("internal-clearance view carries no confidential number or rank (server-side redaction)", () => {
  const view = workspaceView(inputs(), "internal", []);
  assert.deepEqual(numbersOutsideAllowed(view), []);
  assert.ok(view.set.recommendations.every((r) => r.redaction?.viewerClearance === "internal"));
  assert.ok(view.set.shortlist.filter((g) => g.ranked.length > 0).every((g) => g.rankWithheld));
});
test("confidential view carries values and ranks; group counts are computed", () => {
  const view = workspaceView(inputs(), "confidential", []);
  const ax26 = view.set.recommendations.find((r) => r.identity.merchantSku === "SYN-AX26-55")!;
  assert.equal(ax26.facts.find((f) => f.metric === "available_stock")!.value, 8);
  assert.equal(ax26.rank!.rank, 1);
  assert.deepEqual(view.groups.map((g) => [g.action, g.eligible, g.total]), [["advertise_only", 3, 4], ["discount", 0, 4], ["bundle", 0, 4], ["hold", 4, 4]]);
});
test("recommendation ids are stable across rebuilds (decisions survive page reloads)", () => {
  assert.deepEqual(buildFullSet(inputs()).set.recommendations.map((r) => r.id), buildFullSet(inputs()).set.recommendations.map((r) => r.id));
});
test("decisions: looked up by id on the server; refusals are typed", () => {
  const set = buildFullSet(inputs()).set;
  const rec = set.recommendations.find((r) => r.identity.merchantSku === "SYN-AX26-55")!;
  const base = { recommendationId: rec.id, decision: "approve" as const, rationale: "synthetic test", canApprove: true };
  assert.deepEqual(decide(inputs(), [], { ...base, recommendationId: "rec_" + "0".repeat(32) }, LATER), { ok: false, reason: "unknown_recommendation" });
  assert.deepEqual(decide(inputs(), [], { ...base, rationale: " " }, LATER), { ok: false, reason: "empty_rationale" });
  assert.deepEqual(decide(inputs(), [], { ...base, canApprove: false }, LATER), { ok: false, reason: "no_permission" });
  const ok = decide(inputs(), [], base, LATER);
  assert.ok(ok.ok && ok.log.length === 1 && ok.record.outcome === null && ok.record.decidedAt === LATER);
  assert.deepEqual(decide(inputs(), [], { ...base, decidedAt: undefined } as never, "2026-10-01T00:00:00+07:00"), { ok: false, reason: "refused_by_recorder" });
  const more = decide(inputs(), [], { ...base, decision: "request_more_data", canApprove: false }, LATER);
  assert.ok(more.ok);
});
test("the view lists only current decisions for this set", () => {
  const set = buildFullSet(inputs()).set;
  const rec = set.recommendations[0]!;
  const first = decide(inputs(), [], { recommendationId: rec.id, decision: "request_more_data", rationale: "a", canApprove: false }, LATER);
  assert.ok(first.ok);
  const second = decide(inputs(), first.log, { recommendationId: rec.id, decision: "request_more_data", rationale: "b", canApprove: false }, "2026-10-10T13:00:00+07:00");
  assert.ok(second.ok);
  const view = workspaceView(inputs(), "internal", second.log);
  assert.deepEqual(view.decisions.map((d) => d.rationale), ["b"]);
});

// ---------- edge scenario: every status and fact state is reachable (STEP 7 review) ----------

import { edgeFiles, edgeRegistryDataset } from "./fixtures/edge/registry.ts";
const readEdge = (f: string) => readFileSync(new URL(`./fixtures/edge/${f}`, import.meta.url), "utf8");
const edgeInputs = (): SampleInputs => ({
  ...inputs(),
  registry: edgeRegistryDataset(),
  files: edgeFiles.map((f) => ({ ...f, content: readEdge(f.file) })),
  recommendationPolicy: JSON.parse(readEdge("recommendation-policy.synthetic.json")),
});

test("edge scenario reaches recommended, insufficient_data, review_required and blocked", () => {
  const recs = buildFullSet(edgeInputs()).set.recommendations;
  const by = (sku: string) => recs.find((r) => r.identity.merchantSku === sku)!;
  assert.deepEqual(["SYN-E1-50", "SYN-E2-55", "SYN-E3-65", "SYN-E4-43", "SYN-E5-58"].map((s) => [s, by(s).status, by(s).action]), [
    ["SYN-E1-50", "insufficient_data", null],
    ["SYN-E2-55", "insufficient_data", null],
    ["SYN-E3-65", "blocked", null],
    ["SYN-E4-43", "review_required", null],
    ["SYN-E5-58", "recommended", "advertise_only"],
  ]);
  assert.deepEqual(by("SYN-E1-50").missing[0]!.nextSteps, ["import_sales_for_window"]);
  assert.deepEqual(by("SYN-E2-55").missing[0]!.reasons, ["missing_cost"]);
  assert.ok(by("SYN-E4-43").statusReasons.includes("multiple_sales_sources"));
});
test("edge scenario reaches the no_data and insufficient_data fact states", () => {
  const recs = buildFullSet(edgeInputs()).set.recommendations;
  const fact = (sku: string, metric: string) => recs.find((r) => r.identity.merchantSku === sku)!.facts.find((f) => f.metric === metric)!;
  assert.equal(fact("SYN-E1-50", "units_sold").status, "no_data");
  assert.equal(fact("SYN-E4-43", "units_sold").status, "insufficient_data");
});
