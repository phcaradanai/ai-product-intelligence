import { z } from "zod";
import { checkDatasetIntegrity } from "../../domain/src/integrity.ts";
import type { IntegrityIssue } from "../../domain/src/integrity.ts";
import type {
  Brand, Category, ProductFamily, ProductVariant, SKU, ProductAlias,
  DataSource, SourceReference, SalesFact, InventorySnapshot, CostFact,
  PriceObservation, ProductMatch, DomainDataset, IdentityTarget,
} from "../../domain/src/models.ts";

/** Runtime validation for untrusted boundary records; business permissions are separate. */
const id = z.string().trim().min(1).max(128);
const label = z.string().trim().min(1).max(512);
const instant = z.iso.datetime({ offset: true });
const nonNegativeInteger = z.number().int().nonnegative();
const moneyMinor = nonNegativeInteger;
const currency = z.string().regex(/^[A-Z]{3}$/, "Expected uppercase ISO 4217 code");
const attributes = z.record(z.string().min(1), z.union([z.string(), z.number().finite(), z.boolean()]));

export const IdentityTargetSchema: z.ZodType<IdentityTarget> = z.strictObject({
  scope: z.enum(["family", "variant", "sku"]),
  entityId: id,
});

export const BrandSchema: z.ZodType<Brand> = z.strictObject({ id, name: label });
export const CategorySchema: z.ZodType<Category> = z.strictObject({
  id, name: label, parentCategoryId: id.nullable(),
});
export const ProductFamilySchema: z.ZodType<ProductFamily> = z.strictObject({
  id, brandId: id, categoryId: id, modelName: label, modelCode: label.nullable(),
});
export const ProductVariantSchema: z.ZodType<ProductVariant> = z.strictObject({
  id, familyId: id, attributes,
});
export const SKUSchema: z.ZodType<SKU> = z.strictObject({
  id, variantId: id, merchantSku: label, gtin: z.string().regex(/^\d{8}$|^\d{12,14}$/).nullable(),
  status: z.enum(["active", "inactive", "discontinued"]),
});
export const ProductAliasSchema: z.ZodType<ProductAlias> = z.strictObject({
  id, target: IdentityTargetSchema, alias: label,
  locale: z.enum(["th", "en", "und"]), verified: z.boolean(), sourceReferenceId: id,
});
export const DataSourceSchema: z.ZodType<DataSource> = z.strictObject({
  id, name: label,
  kind: z.enum(["internal_csv", "internal_erp", "authorized_api", "licensed_feed", "other"]),
  rightsStatus: z.enum(["authorized", "unverified", "expired", "denied"]),
  sensitivity: z.enum(["public", "internal", "confidential", "restricted"]),
  coverage: z.strictObject({
    countries: z.array(z.string().regex(/^[A-Z]{2}$/, "Expected ISO 3166-1 alpha-2 code")),
    categoryIds: z.array(id),
  }),
  permittedUse: z.strictObject({
    storeFullContent: z.boolean(), storeExcerpts: z.boolean(), attributionRequired: z.boolean(),
  }),
  retentionDays: z.number().int().positive().nullable(),
  refreshCadence: z.iso.duration().nullable(),
  lastFetchedAt: instant.nullable(),
  reliability: z.enum(["unknown", "low", "medium", "high"]),
});
export const SourceReferenceSchema: z.ZodType<SourceReference> = z.strictObject({
  id, sourceId: id, recordKey: label,
  locator: z.strictObject({ kind: z.enum(["internal_record", "file", "url"]), value: label }),
  publishedAt: instant.nullable(), fetchedAt: instant.nullable(),
  ingestedAt: instant,
});
export const SalesFactSchema: z.ZodType<SalesFact> = z.strictObject({
  id, skuId: id, sourceReferenceId: id, eventAt: instant, ingestedAt: instant,
  quantitySold: nonNegativeInteger, grossRevenueMinor: moneyMinor, currency,
});
export const InventorySnapshotSchema: z.ZodType<InventorySnapshot> = z.strictObject({
  id, skuId: id, sourceReferenceId: id, locationCode: label,
  observedAt: instant, ingestedAt: instant,
  onHandQuantity: nonNegativeInteger, reservedQuantity: nonNegativeInteger,
}).refine(
  (v) => v.reservedQuantity <= v.onHandQuantity,
  { path: ["reservedQuantity"], message: "Reserved stock exceeds on-hand quantity (negative availability not modeled in STEP 1)" },
);
export const CostFactSchema: z.ZodType<CostFact> = z.strictObject({
  id, skuId: id, sourceReferenceId: id,
  costType: z.enum(["purchase", "landed", "other"]),
  unitCostMinor: moneyMinor, currency,
  effectiveFrom: instant, effectiveTo: instant.nullable(), ingestedAt: instant,
}).refine(
  (v) => v.effectiveTo === null || Date.parse(v.effectiveFrom) < Date.parse(v.effectiveTo),
  { path: ["effectiveTo"], message: "Effective end must be later than start" },
);
export const PriceObservationSchema: z.ZodType<PriceObservation> = z.strictObject({
  id, skuId: id, sourceReferenceId: id, channelCode: label,
  priceType: z.enum(["list", "selling"]), unitPriceMinor: moneyMinor,
  currency, observedAt: instant, ingestedAt: instant,
});
export const ProductMatchSchema: z.ZodType<ProductMatch> = z.strictObject({
  id, externalEntityId: label, sourceReferenceId: id,
  target: IdentityTargetSchema.nullable(),
  matchMethod: z.enum(["exact_identifier", "verified_alias", "attribute_rules", "probabilistic", "semantic", "manual"]),
  matchConfidence: z.number().min(0).max(1).nullable(),
  confidenceKind: z.enum(["heuristic_score", "calibrated_probability"]).nullable(),
  matcherVersion: label,
  reviewStatus: z.enum(["matched", "pending_review", "rejected", "unresolved"]),
  supportingEvidenceReferenceIds: z.array(id),
  validFrom: instant, validTo: instant.nullable(),
  reviewedBy: label.nullable(), reviewedAt: instant.nullable(),
}).superRefine((r, ctx) => {
  const problem = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
  if (r.validTo !== null && Date.parse(r.validFrom) >= Date.parse(r.validTo)) problem("validTo", "Match validity end must be later than start");
  if (r.reviewStatus === "matched" && r.target === null) problem("target", "Accepted matches require a target");
  if (["rejected", "unresolved"].includes(r.reviewStatus) && r.target !== null) problem("target", "Unresolved/rejected records cannot link a target");
  if ((r.matchConfidence === null) !== (r.confidenceKind === null)) problem("confidenceKind", "A score must declare whether it is heuristic or calibrated");
  if ((r.reviewedBy === null) !== (r.reviewedAt === null)) problem("reviewedAt", "Reviewer and timestamp must be supplied together");
  if (r.reviewStatus === "matched" && r.matchMethod !== "exact_identifier" && r.reviewedBy === null) problem("reviewedBy", "Non-identifier acceptance requires reviewer metadata");
});

export const DomainDatasetSchema: z.ZodType<DomainDataset> = z.strictObject({
  brands: z.array(BrandSchema), categories: z.array(CategorySchema), families: z.array(ProductFamilySchema),
  variants: z.array(ProductVariantSchema), skus: z.array(SKUSchema), aliases: z.array(ProductAliasSchema),
  sources: z.array(DataSourceSchema), references: z.array(SourceReferenceSchema),
  sales: z.array(SalesFactSchema), inventory: z.array(InventorySnapshotSchema),
  costs: z.array(CostFactSchema), prices: z.array(PriceObservationSchema),
  matches: z.array(ProductMatchSchema),
});

export class DatasetIntegrityError extends Error {
  readonly issues: IntegrityIssue[];
  constructor(issues: IntegrityIssue[]) {
    super(`Domain dataset has ${issues.length} cross-record integrity issue(s)`);
    this.name = "DatasetIntegrityError";
    this.issues = issues;
  }
}

/** Validate the boundary schema AND cross-record structure before accepting a dataset. */
export function parseDomainDataset(input: unknown): DomainDataset {
  const parsed = DomainDatasetSchema.parse(input);
  const issues = checkDatasetIntegrity(parsed);
  if (issues.length > 0) throw new DatasetIntegrityError(issues);
  return parsed;
}
