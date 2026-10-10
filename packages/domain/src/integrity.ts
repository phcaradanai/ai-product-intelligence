import type { DataSource, DataSourceKind, DomainDataset, IdentityTarget, ProductMatch } from "./models.ts";

/** Source kinds whose records are retrieved from outside the organization and need fetchedAt. */
export const EXTERNAL_SOURCE_KINDS: ReadonlySet<DataSourceKind> = new Set(["authorized_api", "licensed_feed", "other"]);

export interface IntegrityIssue {
  path: string;
  code: "duplicate_id" | "missing_reference" | "invalid_range" | "invalid_state" | "unauthorized_source";
  message: string;
}

/**
 * Cross-record structural checks, intentionally NOT business approval policy.
 * Call schema validation on untrusted payloads before this function.
 */
export function checkDatasetIntegrity(data: DomainDataset): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const collections = {
    brands: data.brands,
    categories: data.categories,
    families: data.families,
    variants: data.variants,
    skus: data.skus,
    aliases: data.aliases,
    sources: data.sources,
    references: data.references,
    sales: data.sales,
    inventory: data.inventory,
    costs: data.costs,
    prices: data.prices,
    matches: data.matches,
  } as const;
  const ids: Record<string, Set<string>> = {};
  for (const [name, values] of Object.entries(collections)) {
    const current = new Set<string>();
    for (const [i, value] of values.entries()) {
      if (current.has(value.id)) {
        issues.push({ path: `${name}[${i}].id`, code: "duplicate_id", message: `Duplicate ${name} ID: ${value.id}` });
      }
      current.add(value.id);
    }
    ids[name] = current;
  }

  const exists = (collection: string, id: string, path: string): void => {
    if (!ids[collection]?.has(id)) {
      issues.push({ path, code: "missing_reference", message: `Missing ${collection} record: ${id}` });
    }
  };
  const targetExists = (target: IdentityTarget, path: string): void => {
    const lookup = { family: "families", variant: "variants", sku: "skus" } as const;
    exists(lookup[target.scope], target.entityId, path);
  };
  const range = (start: string, end: string | null, path: string): void => {
    if (end !== null && Date.parse(start) >= Date.parse(end)) {
      issues.push({ path, code: "invalid_range", message: "End must be strictly later than start" });
    }
  };
  const ingestion = (recordTime: string, ingestedAt: string, path: string): void => {
    // Do not assert fetched/ingested must follow business event time: backfills and clock skew exist.
    if (Number.isNaN(Date.parse(recordTime)) || Number.isNaN(Date.parse(ingestedAt))) {
      issues.push({ path, code: "invalid_state", message: "Invalid timestamp; run Zod schema validation first" });
    }
  };

  data.categories.forEach((r, i) => {
    if (r.parentCategoryId !== null) {
      exists("categories", r.parentCategoryId, `categories[${i}].parentCategoryId`);
      if (r.parentCategoryId === r.id) {
        issues.push({ path: `categories[${i}].parentCategoryId`, code: "invalid_state", message: "Category cannot parent itself" });
      }
    }
  });
  data.families.forEach((r, i) => {
    exists("brands", r.brandId, `families[${i}].brandId`);
    exists("categories", r.categoryId, `families[${i}].categoryId`);
  });
  data.variants.forEach((r, i) => exists("families", r.familyId, `variants[${i}].familyId`));
  data.skus.forEach((r, i) => exists("variants", r.variantId, `skus[${i}].variantId`));
  const sourceById = new Map(data.sources.map((s) => [s.id, s]));
  const referenceSource = new Map<string, DataSource | undefined>(data.references.map((r) => [r.id, sourceById.get(r.sourceId)]));
  data.references.forEach((r, i) => {
    exists("sources", r.sourceId, `references[${i}].sourceId`);
    const source = sourceById.get(r.sourceId);
    if (source && EXTERNAL_SOURCE_KINDS.has(source.kind) && r.fetchedAt === null) {
      issues.push({ path: `references[${i}].fetchedAt`, code: "invalid_state", message: "External source records require fetchedAt" });
    }
    if (r.publishedAt !== null && r.fetchedAt !== null && Date.parse(r.publishedAt) > Date.parse(r.fetchedAt)) {
      issues.push({ path: `references[${i}].publishedAt`, code: "invalid_state", message: "Content cannot be published after it was fetched" });
    }
  });
  data.aliases.forEach((r, i) => {
    targetExists(r.target, `aliases[${i}].target`);
    exists("references", r.sourceReferenceId, `aliases[${i}].sourceReferenceId`);
  });
  for (const collection of ["sales", "inventory", "costs", "prices"] as const) {
    data[collection].forEach((r, i) => {
      exists("skus", r.skuId, `${collection}[${i}].skuId`);
      exists("references", r.sourceReferenceId, `${collection}[${i}].sourceReferenceId`);
    });
  }
  data.sales.forEach((r, i) => ingestion(r.eventAt, r.ingestedAt, `sales[${i}]`));
  data.inventory.forEach((r, i) => ingestion(r.observedAt, r.ingestedAt, `inventory[${i}]`));
  data.prices.forEach((r, i) => ingestion(r.observedAt, r.ingestedAt, `prices[${i}]`));
  data.costs.forEach((r, i) => {
    range(r.effectiveFrom, r.effectiveTo, `costs[${i}].effectiveTo`);
    const sensitivity = referenceSource.get(r.sourceReferenceId)?.sensitivity;
    if (sensitivity !== undefined && sensitivity !== "confidential" && sensitivity !== "restricted") {
      issues.push({ path: `costs[${i}].sourceReferenceId`, code: "invalid_state", message: "Cost facts must come from a confidential or restricted source (INV-08)" });
    }
  });
  data.matches.forEach((r, i) => {
    exists("references", r.sourceReferenceId, `matches[${i}].sourceReferenceId`);
    r.supportingEvidenceReferenceIds.forEach((id, j) => exists("references", id, `matches[${i}].supportingEvidenceReferenceIds[${j}]`));
    if (r.target) targetExists(r.target, `matches[${i}].target`);
    range(r.validFrom, r.validTo, `matches[${i}].validTo`);
    if (r.reviewStatus === "matched" && !r.target) {
      issues.push({ path: `matches[${i}].target`, code: "invalid_state", message: "Accepted match requires a target" });
    }
    if ((r.reviewStatus === "rejected" || r.reviewStatus === "unresolved") && r.target) {
      issues.push({ path: `matches[${i}].target`, code: "invalid_state", message: "Rejected/unresolved match cannot attach an accepted target" });
    }
    if ((r.matchConfidence === null) !== (r.confidenceKind === null)) {
      issues.push({ path: `matches[${i}].confidenceKind`, code: "invalid_state", message: "Confidence and kind must be supplied together" });
    }
    if (r.reviewStatus === "matched" && r.matchMethod !== "exact_identifier" && (r.reviewedBy === null || r.reviewedAt === null)) {
      issues.push({ path: `matches[${i}].reviewedBy`, code: "invalid_state", message: "Non-identifier accepted match requires recorded human review" });
    }
    if (r.reviewStatus === "matched") {
      [r.sourceReferenceId, ...r.supportingEvidenceReferenceIds].forEach((refId) => {
        const source = referenceSource.get(refId);
        if (source && source.rightsStatus !== "authorized") {
          issues.push({ path: `matches[${i}]`, code: "unauthorized_source", message: `Accepted match relies on ${source.rightsStatus} source ${source.id}` });
        }
      });
    }
  });
  return issues;
}

/** Only accepted matches are resolved; pending suggestions must never be treated as links. */
export function acceptedTarget(match: ProductMatch): IdentityTarget | null {
  return match.reviewStatus === "matched" ? match.target : null;
}
