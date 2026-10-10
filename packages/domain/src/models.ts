/** STEP 1 candidate domain contracts. Framework-agnostic; not approved production policies. */

export type Id = string;
/** ISO 8601 timestamp with a timezone offset or Z. Validated at the boundary. */
export type Instant = string;
/** ISO 4217 currency code; monetary amounts are integer minor units. */
export type CurrencyCode = string;
export type MoneyMinor = number;
export type LocaleCode = "th" | "en" | "und";

export type IdentityScope = "family" | "variant" | "sku";
export interface IdentityTarget {
  scope: IdentityScope;
  entityId: Id;
}

export interface Brand {
  id: Id;
  name: string;
}

export interface Category {
  id: Id;
  name: string;
  parentCategoryId: Id | null;
}

export interface ProductFamily {
  id: Id;
  brandId: Id;
  categoryId: Id;
  modelName: string;
  modelCode: string | null;
}

export interface ProductVariant {
  id: Id;
  familyId: Id;
  /** Attributes distinguish variants, e.g. screenSizeInches; units live in attribute keys. */
  attributes: Record<string, string | number | boolean>;
}

export interface SKU {
  id: Id;
  variantId: Id;
  merchantSku: string;
  gtin: string | null;
  status: "active" | "inactive" | "discontinued";
}

export interface ProductAlias {
  id: Id;
  target: IdentityTarget;
  alias: string;
  locale: LocaleCode;
  /** Unverified aliases must not by themselves produce an accepted SKU link. */
  verified: boolean;
  sourceReferenceId: Id;
}

export type DataSourceKind = "internal_csv" | "internal_erp" | "authorized_api" | "licensed_feed" | "other";
export type Sensitivity = "public" | "internal" | "confidential" | "restricted";

/**
 * Source registry record (STEP 0 §10). `null` means "not yet defined by the data owner",
 * never a default policy value.
 */
export interface DataSource {
  id: Id;
  name: string;
  kind: DataSourceKind;
  /** Only "authorized" sources may back accepted identity links or AI answers. */
  rightsStatus: "authorized" | "unverified" | "expired" | "denied";
  sensitivity: Sensitivity;
  coverage: { countries: string[]; categoryIds: Id[] };
  permittedUse: {
    storeFullContent: boolean;
    storeExcerpts: boolean;
    attributionRequired: boolean;
  };
  retentionDays: number | null;
  /** ISO 8601 duration, e.g. "P1D"; null when no cadence is agreed. */
  refreshCadence: string | null;
  lastFetchedAt: Instant | null;
  reliability: "unknown" | "low" | "medium" | "high";
}

export interface SourceReference {
  id: Id;
  sourceId: Id;
  recordKey: string;
  locator: { kind: "internal_record" | "file" | "url"; value: string };
  /** When the source published the content; null when unknown. Never substitute fetchedAt. */
  publishedAt: Instant | null;
  /** When we retrieved the content; required for external sources (checked in integrity). */
  fetchedAt: Instant | null;
  /** When this source record was ingested; not the event or publication date. */
  ingestedAt: Instant;
}

export interface SalesFact {
  id: Id;
  skuId: Id;
  sourceReferenceId: Id;
  /** Time of business transaction; never replace with ingestion time. */
  eventAt: Instant;
  ingestedAt: Instant;
  quantitySold: number;
  /** Gross revenue is stored in currency minor units (e.g. satang for THB). */
  grossRevenueMinor: MoneyMinor;
  currency: CurrencyCode;
}

export interface InventorySnapshot {
  id: Id;
  skuId: Id;
  sourceReferenceId: Id;
  locationCode: string;
  observedAt: Instant;
  ingestedAt: Instant;
  onHandQuantity: number;
  reservedQuantity: number;
}

export interface CostFact {
  id: Id;
  skuId: Id;
  sourceReferenceId: Id;
  costType: "purchase" | "landed" | "other";
  unitCostMinor: MoneyMinor;
  currency: CurrencyCode;
  effectiveFrom: Instant;
  effectiveTo: Instant | null;
  ingestedAt: Instant;
}

export interface PriceObservation {
  id: Id;
  skuId: Id;
  sourceReferenceId: Id;
  channelCode: string;
  priceType: "list" | "selling";
  unitPriceMinor: MoneyMinor;
  currency: CurrencyCode;
  observedAt: Instant;
  ingestedAt: Instant;
}

export type MatchMethod = "exact_identifier" | "verified_alias" | "attribute_rules" | "probabilistic" | "semantic" | "manual";
export type MatchReviewStatus = "matched" | "pending_review" | "rejected" | "unresolved";
export type MatchConfidenceKind = "heuristic_score" | "calibrated_probability";

export interface ProductMatch {
  id: Id;
  externalEntityId: string;
  sourceReferenceId: Id;
  /** A proposed target is NOT an accepted match unless reviewStatus === 'matched'. */
  target: IdentityTarget | null;
  matchMethod: MatchMethod;
  matchConfidence: number | null;
  confidenceKind: MatchConfidenceKind | null;
  matcherVersion: string;
  reviewStatus: MatchReviewStatus;
  supportingEvidenceReferenceIds: Id[];
  validFrom: Instant;
  validTo: Instant | null;
  reviewedBy: string | null;
  reviewedAt: Instant | null;
}

export interface DomainDataset {
  brands: Brand[];
  categories: Category[];
  families: ProductFamily[];
  variants: ProductVariant[];
  skus: SKU[];
  aliases: ProductAlias[];
  sources: DataSource[];
  references: SourceReference[];
  sales: SalesFact[];
  inventory: InventorySnapshot[];
  costs: CostFact[];
  prices: PriceObservation[];
  matches: ProductMatch[];
}
