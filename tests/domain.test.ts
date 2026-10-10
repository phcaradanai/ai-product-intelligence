import { test } from "node:test";
import assert from "node:assert/strict";
import { acceptedTarget, checkDatasetIntegrity, publishedWithin } from "../packages/domain/src/index.ts";
import { syntheticDataset } from "./fixtures/synthetic.ts";
import type { DomainDataset } from "../packages/domain/src/models.ts";

const clone = (): DomainDataset => structuredClone(syntheticDataset);

test("synthetic fixture links all products, business facts, and references", () => {
  assert.deepEqual(checkDatasetIntegrity(clone()), []);
});
test("detects missing brand reference", () => {
  const input = clone(); input.families[0]!.brandId = "missing_brand";
  assert.ok(checkDatasetIntegrity(input).some(x => x.path === "families[0].brandId" && x.code === "missing_reference"));
});
test("detects duplicate SKU identity", () => {
  const input = clone(); input.skus.push({ ...input.skus[0]! });
  assert.ok(checkDatasetIntegrity(input).some(x => x.path === `skus[${input.skus.length - 1}].id` && x.code === "duplicate_id"));
});
test("different-size and different-year variants do not collapse into a single SKU", () => {
  const input = clone();
  assert.equal(new Set(input.variants.map((v) => v.id)).size, input.variants.length);
  assert.equal(new Set(input.skus.map((s) => s.variantId)).size, input.skus.length);
});
test("an accepted family-level match does not imply an exact SKU", () => {
  const input = clone();
  assert.deepEqual(acceptedTarget(input.matches[0]!), { scope: "family", entityId: "family_ax_2026" });
});
test("a pending SKU suggestion is never an accepted match", () => {
  assert.equal(acceptedTarget(syntheticDataset.matches[1]!), null);
});
test("unresolved matches cannot retain actionable targets", () => {
  const input = clone(); input.matches[1]!.reviewStatus = "unresolved";
  assert.ok(checkDatasetIntegrity(input).some(x => x.code === "invalid_state" && x.path === "matches[1].target"));
});
test("detects invalid temporal match range", () => {
  const input = clone(); input.matches[0]!.validTo = "2026-10-08T00:00:00+07:00";
  assert.ok(checkDatasetIntegrity(input).some(x => x.code === "invalid_range"));
});
test("detects orphaned evidence reference", () => {
  const input = clone(); input.matches[0]!.supportingEvidenceReferenceIds.push("unknown_reference");
  assert.ok(checkDatasetIntegrity(input).some(x => x.path.includes("supportingEvidenceReferenceIds") && x.code === "missing_reference"));
});
test("detects improperly labeled confidence", () => {
  const input = clone(); input.matches[1]!.confidenceKind = null;
  assert.ok(checkDatasetIntegrity(input).some(x => x.path === "matches[1].confidenceKind" && x.code === "invalid_state"));
});

test("fixture covers every match review status", () => {
  assert.deepEqual(new Set(syntheticDataset.matches.map((m) => m.reviewStatus)), new Set(["matched", "pending_review", "rejected", "unresolved"]));
});
test("a recently fetched old article is not a newly published event", () => {
  const stale = syntheticDataset.references.find((r) => r.id === "ref_news_stale")!;
  assert.equal(publishedWithin(stale, "2026-10-01T00:00:00+07:00", "2026-11-01T00:00:00+07:00"), false);
  const recent = syntheticDataset.references.find((r) => r.id === "ref_news_recent")!;
  assert.equal(publishedWithin(recent, "2026-10-01T00:00:00+07:00", "2026-11-01T00:00:00+07:00"), true);
});
test("unknown publication time is reported as unknown, not as fetch time", () => {
  const social = syntheticDataset.references.find((r) => r.id === "ref_social")!;
  assert.equal(publishedWithin(social, "2026-10-01T00:00:00+07:00", "2026-11-01T00:00:00+07:00"), null);
});
test("external source records require fetchedAt", () => {
  const input = clone(); const i = input.references.findIndex((r) => r.id === "ref_news_recent");
  input.references[i]!.fetchedAt = null;
  assert.ok(checkDatasetIntegrity(input).some((x) => x.path === `references[${i}].fetchedAt`));
});
test("content cannot be published after it was fetched", () => {
  const input = clone(); const i = input.references.findIndex((r) => r.id === "ref_news_recent");
  input.references[i]!.publishedAt = "2026-10-10T00:00:00+07:00";
  assert.ok(checkDatasetIntegrity(input).some((x) => x.path === `references[${i}].publishedAt`));
});
test("an accepted match cannot rely on an unverified source", () => {
  const input = clone(); input.matches[1]!.reviewStatus = "matched";
  input.matches[1]!.reviewedBy = "synthetic_reviewer"; input.matches[1]!.reviewedAt = "2026-10-10T10:00:00+07:00";
  assert.ok(checkDatasetIntegrity(input).some((x) => x.path === "matches[1]" && x.code === "unauthorized_source"));
});
test("a match becomes unauthorized when its source rights expire", () => {
  const input = clone(); input.sources.find((s) => s.id === "source_licensed_news")!.rightsStatus = "expired";
  assert.ok(checkDatasetIntegrity(input).some((x) => x.path === "matches[0]" && x.code === "unauthorized_source"));
});
test("cost facts from a non-confidential source are rejected", () => {
  const input = clone(); input.costs[0]!.sourceReferenceId = "ref_price";
  assert.ok(checkDatasetIntegrity(input).some((x) => x.path === "costs[0].sourceReferenceId"));
});

test("npm test runs every tests/*.test.ts file", async () => {
  const { readFileSync, readdirSync } = await import("node:fs");
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { scripts: { test: string } };
  const files = readdirSync(new URL(".", import.meta.url)).filter((f) => f.endsWith(".test.ts"));
  for (const f of files) assert.ok(pkg.scripts.test.includes(`tests/${f}`), `${f} is not wired into npm test`);
});
