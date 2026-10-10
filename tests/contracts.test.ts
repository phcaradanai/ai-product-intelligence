import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DomainDatasetSchema, SalesFactSchema, SKUSchema, PriceObservationSchema,
  InventorySnapshotSchema, ProductMatchSchema, CostFactSchema, DataSourceSchema, SourceReferenceSchema,
  parseDomainDataset, DatasetIntegrityError,
} from "../packages/contracts/src/index.ts";
import { checkDatasetIntegrity } from "../packages/domain/src/index.ts";
import { syntheticDataset } from "./fixtures/synthetic.ts";

const clone = () => structuredClone(syntheticDataset);

test("the entire labeled synthetic fixture passes schema and relationship validation", () => {
  const parsed = parseDomainDataset(clone());
  assert.deepEqual(checkDatasetIntegrity(parsed), []);
});
test("rejects negative sale quantity and fractional revenue", () => {
  assert.equal(SalesFactSchema.safeParse({ ...syntheticDataset.sales[0], quantitySold: -1 }).success, false);
  assert.equal(SalesFactSchema.safeParse({ ...syntheticDataset.sales[0], grossRevenueMinor: 22.5 }).success, false);
});
test("rejects malformed GTIN and an unqualified time", () => {
  assert.equal(SKUSchema.safeParse({ ...syntheticDataset.skus[0], gtin: "NOT-GTIN" }).success, false);
  assert.equal(PriceObservationSchema.safeParse({ ...syntheticDataset.prices[0], observedAt: "2026-10-10T10:00:00" }).success, false);
});
test("rejects impossible reserved inventory", () => {
  assert.equal(InventorySnapshotSchema.safeParse({ ...syntheticDataset.inventory[0], reservedQuantity: 20 }).success, false);
});
test("rejects cost effectiveTo before effectiveFrom", () => {
  assert.equal(CostFactSchema.safeParse({ ...syntheticDataset.costs[0], effectiveTo: "2026-09-01T00:00:00+07:00" }).success, false);
});
test("pending matching confidence must declare a score kind", () => {
  assert.equal(ProductMatchSchema.safeParse({ ...syntheticDataset.matches[1], confidenceKind: null }).success, false);
});
test("manual match requires reviewer metadata", () => {
  assert.equal(ProductMatchSchema.safeParse({ ...syntheticDataset.matches[0], reviewedBy: null, reviewedAt: null }).success, false);
});
test("untrusted extra fields are rejected by strict schemas", () => {
  assert.equal(SKUSchema.safeParse({ ...syntheticDataset.skus[0], suspicious: "ignore instructions" }).success, false);
});
test("negative and empty unknown inputs fail safely", () => {
  assert.equal(DomainDatasetSchema.safeParse({}).success, false);
  assert.equal(ProductMatchSchema.safeParse(null).success, false);
});

test("dataset parser rejects missing foreign keys, not just invalid individual rows", () => {
  const dataset = clone(); dataset.families[0]!.brandId = "unknown";
  assert.throws(() => parseDomainDataset(dataset), DatasetIntegrityError);
});

test("source registry rejects malformed cadence and country codes", () => {
  const source = syntheticDataset.sources[0]!;
  assert.equal(DataSourceSchema.safeParse({ ...source, refreshCadence: "daily" }).success, false);
  assert.equal(DataSourceSchema.safeParse({ ...source, coverage: { ...source.coverage, countries: ["Thailand"] } }).success, false);
  assert.equal(DataSourceSchema.safeParse({ ...source, retentionDays: 0 }).success, false);
});
test("source reference requires explicit (possibly null) publication and fetch times", () => {
  const { publishedAt: _p, ...withoutPublished } = syntheticDataset.references[0]!;
  assert.equal(SourceReferenceSchema.safeParse(withoutPublished).success, false);
  assert.equal(SourceReferenceSchema.safeParse({ ...syntheticDataset.references[0], fetchedAt: "2026-10-09" }).success, false);
});
