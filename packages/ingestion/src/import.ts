import { createHash } from "node:crypto";
import type { z } from "zod";
import {
  BrandSchema, CategorySchema, ProductFamilySchema, ProductVariantSchema, SKUSchema, ProductAliasSchema,
  SalesFactSchema, InventorySnapshotSchema, CostFactSchema, PriceObservationSchema, SourceReferenceSchema,
  parseDomainDataset,
} from "../../contracts/src/index.ts";
import { EXTERNAL_SOURCE_KINDS } from "../../domain/src/index.ts";
import type { DomainDataset, SourceReference, SKU } from "../../domain/src/models.ts";
import { CsvSyntaxError, parseCsv } from "./csv.ts";
import type { CsvRow } from "./csv.ts";
import {
  isValidOffset, parseAttribute, parseCount, parseEnum, parseInstant, parseMoneyMinor,
} from "./values.ts";
import type { Parsed, ValueIssueCode } from "./values.ts";

export type ImportKind = "catalog" | "sales" | "inventory" | "costs" | "prices";

export type ImportIssueCode =
  | ValueIssueCode
  // file level (run refused)
  | "unregistered_source" | "unauthorized_source" | "source_not_internal" | "sensitivity_mismatch"
  | "invalid_encoding" | "malformed_csv" | "missing_header" | "missing_column" | "unknown_column"
  | "duplicate_column" | "invalid_option"
  // row level
  | "field_count" | "unknown_sku" | "ambiguous_sku" | "schema_invalid" | "conflict"
  // informational (row not rejected)
  | "duplicate_row";

export interface ImportIssue {
  file: string;
  /** Physical start line of the offending row; null for file-level issues. */
  line: number | null;
  column: string | null;
  code: ImportIssueCode;
  message: string;
}

export interface ImportOptions {
  kind: ImportKind;
  sourceId: string;
  fileName: string;
  /** Raw bytes (validated as UTF-8) or already-decoded text. */
  content: Uint8Array | string;
  /** Injected clock; becomes `ingestedAt` of every record (S2-DEC-09). */
  now: string;
  /** Explicit offset for timestamps without one, e.g. "+07:00" (S2-DEC-08). */
  assumeOffset?: string;
  /** Currency → ISO 4217 exponent. Default `{ THB: 2 }` (S2-DEC-07). */
  currencyExponents?: Readonly<Record<string, number>>;
}

export interface ImportRun {
  id: string;
  kind: ImportKind;
  sourceId: string;
  fileName: string;
  sha256: string;
  ingestedAt: string;
  assumeOffset: string | null;
  status: "completed" | "refused";
  rowsRead: number;
  /** Rows that added at least one new record. */
  rowsAccepted: number;
  /** Rows whose records already existed before this run with identical content (idempotent re-import). */
  rowsUnchanged: number;
  /** Rows identical to an earlier row of the same file (reported as `duplicate_row`, not rejected). */
  rowsDuplicate: number;
  rowsRejected: number;
  recordsAdded: number;
  issues: ImportIssue[];
  /**
   * Every data row by physical line (S2-DEC-10). `raw` is null when the source's permitted use
   * forbids storing full content (S2-DEC-14); line and file hash still identify the row.
   */
  rawRows: { line: number; raw: string | null }[];
}

export interface ImportResult {
  run: ImportRun;
  dataset: DomainDataset;
}

type Collection = Exclude<keyof DomainDataset, "sources">;
/** A record proposed by one CSV row, typed per target collection. */
type Proposed = { [C in Collection]: { collection: C; record: DomainDataset[C][number]; schema: z.ZodType } }[Collection];

const COLUMNS: Record<ImportKind, { required: string[]; optional: string[] }> = {
  catalog: {
    required: ["brand_id", "brand_name", "category_id", "category_name", "family_id", "model_name", "variant_id", "sku_id", "merchant_sku", "status"],
    optional: ["model_code", "gtin", "alias_th", "alias_en", "alias_verified"],
  },
  sales: { required: ["transaction_id", "line_no", "merchant_sku", "event_at", "quantity", "gross_revenue", "currency"], optional: [] },
  inventory: { required: ["merchant_sku", "location_code", "observed_at", "on_hand", "reserved"], optional: [] },
  costs: { required: ["merchant_sku", "cost_type", "unit_cost", "currency", "effective_from"], optional: ["effective_to"] },
  prices: { required: ["merchant_sku", "channel_code", "price_type", "unit_price", "currency", "observed_at"], optional: [] },
};

export function emptyDataset(): DomainDataset {
  return {
    brands: [], categories: [], families: [], variants: [], skus: [], aliases: [], sources: [],
    references: [], sales: [], inventory: [], costs: [], prices: [], matches: [],
  };
}

class RowError extends Error {
  readonly column: string | null;
  readonly code: ImportIssueCode;
  constructor(column: string | null, code: ImportIssueCode, message: string) {
    super(message);
    this.column = column;
    this.code = code;
  }
}

const take = <T>(column: string, parsed: Parsed<T>): T => {
  if (!parsed.ok) throw new RowError(column, parsed.code, parsed.message);
  return parsed.value;
};

/** Content equality ignoring ingestion lineage, which legitimately differs between re-imports (S2-DEC-04). */
function sameContent(a: object, b: object): boolean {
  const strip = (r: object) => {
    const { ingestedAt: _i, sourceReferenceId: _s, ...rest } = r as Record<string, unknown>;
    return rest;
  };
  return stableJson(strip(a)) === stableJson(strip(b));
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableJson((value as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Imports one internal CSV export into a copy of `dataset`. Never mutates the input, never creates
 * DataSource records, never overwrites existing records. The returned dataset is validated with
 * `parseDomainDataset()`.
 */
export function importCsv(dataset: DomainDataset, options: ImportOptions): ImportResult {
  const bytes = typeof options.content === "string" ? new TextEncoder().encode(options.content) : options.content;
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const assumeOffset = options.assumeOffset ?? null;
  const exponents = options.currencyExponents ?? { THB: 2 };
  const run: ImportRun = {
    id: `run_${options.sourceId}_${sha256.slice(0, 12)}_${options.now}`,
    kind: options.kind, sourceId: options.sourceId, fileName: options.fileName, sha256,
    ingestedAt: options.now, assumeOffset, status: "completed",
    rowsRead: 0, rowsAccepted: 0, rowsUnchanged: 0, rowsDuplicate: 0, rowsRejected: 0, recordsAdded: 0, issues: [], rawRows: [],
  };
  const refuse = (code: ImportIssueCode, message: string, column: string | null = null): ImportResult => {
    run.status = "refused";
    run.issues.push({ file: options.fileName, line: null, column, code, message });
    return { run, dataset };
  };

  // ---- file-level gates (S2 §3.1) ----
  if (assumeOffset !== null && !isValidOffset(assumeOffset)) return refuse("invalid_option", `assumeOffset "${assumeOffset}" is not ±HH:MM or Z`);
  const source = dataset.sources.find((s) => s.id === options.sourceId);
  if (!source) return refuse("unregistered_source", `Source ${options.sourceId} is not in the source registry`);
  if (source.rightsStatus !== "authorized") return refuse("unauthorized_source", `Source ${source.id} rights status is ${source.rightsStatus}`);
  if (EXTERNAL_SOURCE_KINDS.has(source.kind)) return refuse("source_not_internal", `Source ${source.id} is external (${source.kind}); STEP 2 imports internal exports only`);
  if (options.kind === "costs" && source.sensitivity !== "confidential" && source.sensitivity !== "restricted") {
    return refuse("sensitivity_mismatch", `Cost data requires a confidential or restricted source; ${source.id} is ${source.sensitivity}`);
  }

  let text: string;
  try {
    text = typeof options.content === "string" ? options.content : new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return refuse("invalid_encoding", "File is not valid UTF-8 (TIS-620/Windows-874 are not supported)");
  }
  let rows: CsvRow[];
  try {
    rows = parseCsv(text);
  } catch (e) {
    if (e instanceof CsvSyntaxError) return refuse("malformed_csv", e.message);
    throw e;
  }
  const [headerRow, ...dataRows] = rows;
  if (!headerRow) return refuse("missing_header", "File has no header row");
  const header = headerRow.fields.map((h) => h.trim());
  const spec = COLUMNS[options.kind];
  const seen = new Set<string>();
  for (const h of header) {
    if (seen.has(h)) return refuse("duplicate_column", `Column "${h}" appears more than once`, h);
    seen.add(h);
    const allowed = spec.required.includes(h) || spec.optional.includes(h) || (options.kind === "catalog" && /^attr:[A-Za-z][A-Za-z0-9_]*$/.test(h));
    if (!allowed) return refuse("unknown_column", `Column "${h}" is not part of the ${options.kind} format`, h);
  }
  for (const r of spec.required) if (!seen.has(r)) return refuse("missing_column", `Required column "${r}" is missing`, r);

  // ---- rows ----
  const working: DomainDataset = structuredClone(dataset);
  const index = new Map<string, Map<string, object>>();
  for (const key of Object.keys(working) as (keyof DomainDataset)[]) {
    index.set(key, new Map(working[key].map((r) => [r.id, r])));
  }
  const skusByMerchant = new Map<string, SKU[]>();
  for (const sku of working.skus) skusByMerchant.set(sku.merchantSku, [...(skusByMerchant.get(sku.merchantSku) ?? []), sku]);

  const ctx: RowContext = { options, exponents, assumeOffset, skusByMerchant };
  const addedThisRun = new Set<string>();

  for (const row of dataRows) {
    run.rowsRead += 1;
    run.rawRows.push({ line: row.line, raw: source.permittedUse.storeFullContent ? row.raw : null });
    const issue = (column: string | null, code: ImportIssueCode, message: string) =>
      run.issues.push({ file: options.fileName, line: row.line, column, code, message });
    if (row.fields.length !== header.length) {
      issue(null, "field_count", `Expected ${header.length} fields, found ${row.fields.length}`);
      run.rowsRejected += 1;
      continue;
    }
    const cells = new Map(header.map((h, i) => [h, (row.fields[i] ?? "").trim()]));
    const cell = (name: string): string => cells.get(name) ?? "";

    let proposed: Proposed[];
    let recordKey: string;
    let primaryId: string;
    try {
      ({ proposed, recordKey, primaryId } = buildRow(options.kind, cell, header, ctx));
    } catch (e) {
      if (!(e instanceof RowError)) throw e;
      issue(e.column, e.code, e.message);
      run.rowsRejected += 1;
      continue;
    }

    const referenceId = naturalKeyId("ref", [options.sourceId, sha256, row.line]);
    const reference: SourceReference = {
      id: referenceId, sourceId: options.sourceId, recordKey,
      locator: { kind: "file", value: `${options.fileName}#L${row.line}` },
      publishedAt: null, fetchedAt: null, ingestedAt: options.now,
    };
    for (const p of proposed) if ("sourceReferenceId" in p.record) (p.record as { sourceReferenceId: string }).sourceReferenceId = referenceId;

    // Row-atomic: validate everything, detect conflicts, then add new records or nothing.
    let rejected = false;
    const fresh: Proposed[] = [];
    for (const p of proposed) {
      const parsed = p.schema.safeParse(p.record);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        issue(first?.path.join(".") || null, "schema_invalid", `${p.collection}: ${first?.message ?? "invalid record"}`);
        rejected = true;
        break;
      }
      const existing = index.get(p.collection)!.get(p.record.id);
      if (existing === undefined) {
        if (!fresh.some((f) => f.collection === p.collection && f.record.id === p.record.id)) fresh.push(p);
      } else if (!sameContent(existing, p.record)) {
        issue(null, "conflict", `${p.collection} ${p.record.id} already exists with different content; existing record kept`);
        rejected = true;
        break;
      }
    }
    if (rejected) { run.rowsRejected += 1; continue; }
    if (fresh.length === 0) {
      if (addedThisRun.has(primaryId)) {
        run.rowsDuplicate += 1;
        issue(null, "duplicate_row", `Row repeats ${recordKey} from earlier in this file; counted once`);
      } else {
        run.rowsUnchanged += 1;
      }
      continue;
    }

    if (!SourceReferenceSchema.safeParse(reference).success) throw new Error(`Generated invalid source reference ${referenceId}`);
    for (const p of [{ collection: "references" as const, record: reference }, ...fresh]) {
      (working[p.collection] as object[]).push(p.record);
      index.get(p.collection)!.set(p.record.id, p.record);
    }
    for (const p of fresh) {
      if (p.collection === "skus") {
        const sku = p.record as SKU;
        skusByMerchant.set(sku.merchantSku, [...(skusByMerchant.get(sku.merchantSku) ?? []), sku]);
      }
    }
    for (const p of fresh) addedThisRun.add(p.record.id);
    run.rowsAccepted += 1;
    run.recordsAdded += fresh.length;
  }

  // Whole-dataset guard: per-row validation is not enough (STEP 1 integrity rules).
  return { run, dataset: parseDomainDataset(working) };
}

interface RowContext {
  options: ImportOptions;
  exponents: Readonly<Record<string, number>>;
  assumeOffset: string | null;
  skusByMerchant: Map<string, SKU[]>;
}

/**
 * Deterministic, collision-free record ID from natural-key parts (S2-DEC-02). Hashing avoids
 * ambiguity when parts contain the separator and keeps IDs within the 128-character limit.
 */
export function naturalKeyId(prefix: string, parts: readonly (string | number)[]): string {
  return `${prefix}_${createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 24)}`;
}

function required(cell: (n: string) => string, name: string): string {
  const v = cell(name);
  if (v === "") throw new RowError(name, "missing_value", `"${name}" is required`);
  return v;
}

/** Exact merchant-SKU lookup (S2-DEC-05): unknown or shared merchant SKUs reject the row. */
function resolveSku(cell: (n: string) => string, ctx: RowContext): SKU {
  const merchantSku = required(cell, "merchant_sku");
  const hits = ctx.skusByMerchant.get(merchantSku) ?? [];
  if (hits.length === 0) throw new RowError("merchant_sku", "unknown_sku", `Merchant SKU "${merchantSku}" is not in the catalog`);
  if (hits.length > 1) throw new RowError("merchant_sku", "ambiguous_sku", `Merchant SKU "${merchantSku}" maps to ${hits.length} SKUs: ${hits.map((s) => s.id).join(", ")}`);
  return hits[0]!;
}

function money(cell: (n: string) => string, amountColumn: string, ctx: RowContext): { amount: number; currency: string } {
  const currency = required(cell, "currency");
  return { amount: take(amountColumn, parseMoneyMinor(cell(amountColumn), currency, ctx.exponents)), currency };
}

interface BuiltRow {
  proposed: Proposed[];
  /** Human-readable natural key, stored as SourceReference.recordKey. */
  recordKey: string;
  /** ID of the record that identifies the row (the SKU for catalog rows, the fact otherwise). */
  primaryId: string;
}

function buildRow(kind: ImportKind, cell: (n: string) => string, header: string[], ctx: RowContext): BuiltRow {
  const { sourceId, now } = ctx.options;
  const instant = (name: string) => take(name, parseInstant(cell(name), ctx.assumeOffset));
  const ref = ""; // filled in by importCsv once the row is known to be well-formed

  switch (kind) {
    case "catalog": {
      const skuId = required(cell, "sku_id");
      const familyId = required(cell, "family_id");
      const variantId = required(cell, "variant_id");
      const attributes: Record<string, string | number | boolean> = {};
      for (const h of header) {
        if (h.startsWith("attr:") && cell(h) !== "") attributes[h.slice(5)] = parseAttribute(cell(h));
      }
      const verifiedCell = cell("alias_verified");
      if (verifiedCell !== "" && verifiedCell !== "true" && verifiedCell !== "false") {
        throw new RowError("alias_verified", "invalid_value", `alias_verified must be true or false`);
      }
      const proposed: Proposed[] = [
        { collection: "brands", schema: BrandSchema, record: { id: required(cell, "brand_id"), name: required(cell, "brand_name") } },
        { collection: "categories", schema: CategorySchema, record: { id: required(cell, "category_id"), name: required(cell, "category_name"), parentCategoryId: null } },
        {
          collection: "families", schema: ProductFamilySchema,
          record: { id: familyId, brandId: cell("brand_id"), categoryId: cell("category_id"), modelName: required(cell, "model_name"), modelCode: cell("model_code") || null },
        },
        { collection: "variants", schema: ProductVariantSchema, record: { id: variantId, familyId, attributes } },
        {
          collection: "skus", schema: SKUSchema,
          record: {
            id: skuId, variantId, merchantSku: required(cell, "merchant_sku"), gtin: cell("gtin") || null,
            status: take("status", parseEnum(cell("status"), ["active", "inactive", "discontinued"] as const)),
          },
        },
      ];
      for (const [column, locale] of [["alias_th", "th"], ["alias_en", "en"]] as const) {
        const alias = cell(column);
        if (alias === "") continue;
        proposed.push({
          collection: "aliases", schema: ProductAliasSchema,
          record: {
            id: `alias_${skuId}_${locale}`, target: { scope: "sku", entityId: skuId }, alias, locale,
            verified: verifiedCell === "true", sourceReferenceId: ref,
          },
        });
      }
      return { proposed, recordKey: `sku:${skuId}`, primaryId: skuId };
    }
    case "sales": {
      const sku = resolveSku(cell, ctx);
      const transactionId = required(cell, "transaction_id");
      const lineNo = take("line_no", parseCount(cell("line_no")));
      const { amount, currency } = money(cell, "gross_revenue", ctx);
      const id = naturalKeyId("sales", [sourceId, transactionId, lineNo]);
      return {
        recordKey: `txn:${transactionId}/${lineNo}`, primaryId: id,
        proposed: [{
          collection: "sales", schema: SalesFactSchema,
          record: {
            id, skuId: sku.id, sourceReferenceId: ref,
            eventAt: instant("event_at"), ingestedAt: now,
            quantitySold: take("quantity", parseCount(cell("quantity"))), grossRevenueMinor: amount, currency,
          },
        }],
      };
    }
    case "inventory": {
      const sku = resolveSku(cell, ctx);
      const location = required(cell, "location_code");
      const observedAt = instant("observed_at");
      const id = naturalKeyId("stock", [sourceId, sku.id, location, observedAt]);
      return {
        recordKey: `stock:${sku.merchantSku}/${location}/${observedAt}`, primaryId: id,
        proposed: [{
          collection: "inventory", schema: InventorySnapshotSchema,
          record: {
            id, skuId: sku.id, sourceReferenceId: ref,
            locationCode: location, observedAt, ingestedAt: now,
            onHandQuantity: take("on_hand", parseCount(cell("on_hand"))), reservedQuantity: take("reserved", parseCount(cell("reserved"))),
          },
        }],
      };
    }
    case "costs": {
      const sku = resolveSku(cell, ctx);
      const costType = take("cost_type", parseEnum(cell("cost_type"), ["purchase", "landed", "other"] as const));
      const effectiveFrom = instant("effective_from");
      const { amount, currency } = money(cell, "unit_cost", ctx);
      const id = naturalKeyId("cost", [sourceId, sku.id, costType, effectiveFrom]);
      return {
        recordKey: `cost:${sku.merchantSku}/${costType}/${effectiveFrom}`, primaryId: id,
        proposed: [{
          collection: "costs", schema: CostFactSchema,
          record: {
            id, skuId: sku.id, sourceReferenceId: ref,
            costType, unitCostMinor: amount, currency, effectiveFrom,
            effectiveTo: cell("effective_to") === "" ? null : instant("effective_to"), ingestedAt: now,
          },
        }],
      };
    }
    case "prices": {
      const sku = resolveSku(cell, ctx);
      const channel = required(cell, "channel_code");
      const priceType = take("price_type", parseEnum(cell("price_type"), ["list", "selling"] as const));
      const observedAt = instant("observed_at");
      const { amount, currency } = money(cell, "unit_price", ctx);
      const id = naturalKeyId("price", [sourceId, sku.id, channel, priceType, observedAt]);
      return {
        recordKey: `price:${sku.merchantSku}/${channel}/${priceType}/${observedAt}`, primaryId: id,
        proposed: [{
          collection: "prices", schema: PriceObservationSchema,
          record: {
            id, skuId: sku.id, sourceReferenceId: ref,
            channelCode: channel, priceType, unitPriceMinor: amount, currency, observedAt, ingestedAt: now,
          },
        }],
      };
    }
  }
}
