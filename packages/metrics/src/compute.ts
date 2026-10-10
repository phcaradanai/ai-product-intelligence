import type {
  CostFact, DataSource, DomainDataset, InventorySnapshot, SalesFact, Sensitivity,
} from "../../domain/src/models.ts";
import { METRIC_DEFINITIONS } from "./definitions.ts";
import type { MetricId } from "./definitions.ts";

export interface MetricWindow {
  /** Inclusive, ISO 8601 with offset. */
  start: string;
  /** Exclusive, ISO 8601 with offset. */
  end: string;
}

export interface MetricOptions {
  /** Only facts with ingestedAt ≤ knownAt are used (point-in-time recalculation). */
  knownAt?: string;
}

export type MetricStatus = "computed" | "no_data" | "insufficient_data";

export type MetricReason =
  | "no_sales_rows" | "no_inventory_snapshots" | "mixed_currency" | "multiple_sales_sources"
  | "zero_baseline" | "zero_revenue" | "missing_cost" | "overlapping_cost" | "currency_mismatch"
  | "no_sales_in_window" | "zero_denominator";

export interface MetricResult {
  metric: MetricId;
  version: number;
  skuId: string;
  window: MetricWindow;
  knownAt: string | null;
  parameters: Record<string, string>;
  status: MetricStatus;
  /** Set only when status is "computed". */
  value: number | null;
  unit: string;
  /** Currency of a money value or of the money inputs; null when no money is involved. */
  currency: string | null;
  reasons: MetricReason[];
  /** Detail for reasons, e.g. which sale lacks a cost. */
  details: string[];
  /** Oldest snapshot time for stock; latest eventAt for sales; oldest of the parts for combined metrics. */
  dataAsOf: string | null;
  inputIds: string[];
  excludedInputs: { id: string; reason: "unauthorized_source" | "unknown_source" }[];
  sensitivity: Sensitivity | null;
}

const SENSITIVITY_ORDER: readonly Sensitivity[] = ["public", "internal", "confidential", "restricted"];
const maxSensitivity = (values: (Sensitivity | null)[]): Sensitivity | null =>
  values.reduce<Sensitivity | null>((acc, v) => (v === null ? acc : acc === null || SENSITIVITY_ORDER.indexOf(v) > SENSITIVITY_ORDER.indexOf(acc) ? v : acc), null);
const t = (iso: string): number => Date.parse(iso);

const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

/** Thrown for a malformed window or knownAt; never reported as missing data. */
export class MetricInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetricInputError";
  }
}

/**
 * Window bounds and knownAt must be full date-times with an explicit offset: without one,
 * Date.parse would use the host time zone, and an unparseable value would look like "no sales".
 */
function assertInputs(window: MetricWindow, options: MetricOptions): void {
  const check = (name: string, value: string) => {
    if (!INSTANT.test(value) || Number.isNaN(Date.parse(value))) {
      throw new MetricInputError(`${name} must be an ISO 8601 date-time with seconds and an offset: "${value}"`);
    }
  };
  check("window.start", window.start);
  check("window.end", window.end);
  if (options.knownAt !== undefined) check("knownAt", options.knownAt);
  if (t(window.start) >= t(window.end)) throw new MetricInputError(`window.start must be before window.end`);
}
const DAY_MS = 86_400_000;

type Fact = { id: string; skuId: string; sourceReferenceId: string; ingestedAt: string };

interface Selected<F extends Fact> {
  facts: F[];
  excluded: MetricResult["excludedInputs"];
  sources: Map<string, DataSource>;
}

/** Facts for one SKU known at `knownAt`, split by source authorization (INV-08). */
function select<F extends Fact>(dataset: DomainDataset, facts: readonly F[], skuId: string, knownAt: string | null, inWindow: (f: F) => boolean): Selected<F> {
  const sourceById = new Map(dataset.sources.map((s) => [s.id, s]));
  const sourceByRef = new Map(dataset.references.map((r) => [r.id, sourceById.get(r.sourceId)]));
  const out: Selected<F> = { facts: [], excluded: [], sources: new Map() };
  for (const f of facts) {
    if (f.skuId !== skuId || !inWindow(f)) continue;
    if (knownAt !== null && t(f.ingestedAt) > t(knownAt)) continue;
    const source = sourceByRef.get(f.sourceReferenceId);
    if (!source) { out.excluded.push({ id: f.id, reason: "unknown_source" }); continue; }
    if (source.rightsStatus !== "authorized") { out.excluded.push({ id: f.id, reason: "unauthorized_source" }); continue; }
    out.facts.push(f);
    out.sources.set(source.id, source);
  }
  return out;
}

function base(metric: MetricId, skuId: string, window: MetricWindow, options: MetricOptions, parameters: Record<string, string> = {}): MetricResult {
  assertInputs(window, options);
  const def = METRIC_DEFINITIONS[metric];
  return {
    metric, version: def.version, skuId, window, knownAt: options.knownAt ?? null, parameters,
    status: "computed", value: null, unit: def.unit, currency: null, reasons: [], details: [],
    dataAsOf: null, inputIds: [], excludedInputs: [], sensitivity: null,
  };
}

const fail = (r: MetricResult, status: Exclude<MetricStatus, "computed">, reason: MetricReason, detail?: string): MetricResult => {
  r.status = status;
  r.value = null;
  r.reasons.push(reason);
  if (detail) r.details.push(detail);
  return r;
};

/** Authorized sales in the window, or the reason they cannot be used. */
function salesIn(dataset: DomainDataset, skuId: string, window: MetricWindow, options: MetricOptions, r: MetricResult): SalesFact[] | null {
  const sel = select(dataset, dataset.sales, skuId, options.knownAt ?? null, (s) => t(s.eventAt) >= t(window.start) && t(s.eventAt) < t(window.end));
  r.excludedInputs.push(...sel.excluded);
  r.inputIds.push(...sel.facts.map((f) => f.id));
  r.sensitivity = maxSensitivity([r.sensitivity, ...[...sel.sources.values()].map((s) => s.sensitivity)]);
  if (sel.facts.length === 0) { fail(r, "no_data", "no_sales_rows"); return null; }
  if (sel.sources.size > 1) { fail(r, "insufficient_data", "multiple_sales_sources", [...sel.sources.keys()].join(", ")); return null; }
  r.dataAsOf = sel.facts.reduce((latest, s) => (t(s.eventAt) > t(latest) ? s.eventAt : latest), sel.facts[0]!.eventAt);
  return sel.facts;
}

export function unitsSold(dataset: DomainDataset, skuId: string, window: MetricWindow, options: MetricOptions = {}): MetricResult {
  const r = base("units_sold", skuId, window, options);
  const sales = salesIn(dataset, skuId, window, options, r);
  if (sales) r.value = sales.reduce((n, s) => n + s.quantitySold, 0);
  return r;
}

export function grossRevenue(dataset: DomainDataset, skuId: string, window: MetricWindow, options: MetricOptions = {}): MetricResult {
  const r = base("gross_revenue", skuId, window, options);
  const sales = salesIn(dataset, skuId, window, options, r);
  if (!sales) return r;
  const currencies = new Set(sales.map((s) => s.currency));
  if (currencies.size > 1) return fail(r, "insufficient_data", "mixed_currency", [...currencies].join(", "));
  r.currency = sales[0]!.currency;
  r.value = sales.reduce((n, s) => n + s.grossRevenueMinor, 0);
  return r;
}

/** Combines component results: the first non-computed component decides the status. */
function combine(r: MetricResult, parts: MetricResult[]): boolean {
  for (const p of parts) {
    r.inputIds.push(...p.inputIds);
    r.excludedInputs.push(...p.excludedInputs);
    r.details.push(...p.details);
  }
  r.sensitivity = maxSensitivity(parts.map((p) => p.sensitivity));
  const asOf = parts.map((p) => p.dataAsOf).filter((d): d is string => d !== null);
  r.dataAsOf = asOf.length === 0 ? null : asOf.reduce((a, b) => (t(b) < t(a) ? b : a));
  const blocked = parts.find((p) => p.status !== "computed");
  if (blocked) {
    r.status = blocked.status;
    r.reasons.push(...blocked.reasons);
    return false;
  }
  return true;
}

export function salesGrowthUnits(dataset: DomainDataset, skuId: string, window: MetricWindow, options: MetricOptions = {}): MetricResult {
  const r = base("sales_growth_units", skuId, window, options);
  const length = t(window.end) - t(window.start);
  const previous: MetricWindow = { start: new Date(t(window.start) - length).toISOString(), end: window.start };
  const current = unitsSold(dataset, skuId, window, options);
  const prior = unitsSold(dataset, skuId, previous, options);
  const ok = combine(r, [current, prior]);
  // Data time describes the window being reported, not the comparison baseline.
  r.dataAsOf = current.dataAsOf;
  if (!ok) return r;
  if (prior.value === 0) return fail(r, "insufficient_data", "zero_baseline");
  r.value = (current.value! - prior.value!) / prior.value!;
  return r;
}

export function realizedGrossMarginRatio(
  dataset: DomainDataset, skuId: string, window: MetricWindow, costType: CostFact["costType"], options: MetricOptions = {},
): MetricResult {
  const r = base("realized_gross_margin_ratio", skuId, window, options, { costType });
  const revenue = grossRevenue(dataset, skuId, window, options);
  if (!combine(r, [revenue])) return r;
  r.currency = revenue.currency;
  if (revenue.value === 0) return fail(r, "insufficient_data", "zero_revenue");

  const sales = dataset.sales.filter((s) => revenue.inputIds.includes(s.id));
  const costSel = select(dataset, dataset.costs, skuId, options.knownAt ?? null, (c) => c.costType === costType);
  r.excludedInputs.push(...costSel.excluded);
  r.sensitivity = maxSensitivity([r.sensitivity, ...[...costSel.sources.values()].map((s) => s.sensitivity)]);

  let costTotal = 0;
  const used = new Set<string>();
  for (const sale of sales) {
    const at = t(sale.eventAt);
    const effective = costSel.facts.filter((c) => t(c.effectiveFrom) <= at && (c.effectiveTo === null || at < t(c.effectiveTo)));
    if (effective.length === 0) { fail(r, "insufficient_data", "missing_cost", sale.id); continue; }
    if (effective.length > 1) { fail(r, "insufficient_data", "overlapping_cost", `${sale.id}: ${effective.map((c) => c.id).join(", ")}`); continue; }
    const cost = effective[0]!;
    if (cost.currency !== sale.currency) { fail(r, "insufficient_data", "currency_mismatch", `${sale.id} ${sale.currency} vs ${cost.id} ${cost.currency}`); continue; }
    costTotal += sale.quantitySold * cost.unitCostMinor;
    used.add(cost.id);
  }
  r.inputIds.push(...used);
  if (r.status !== "computed") {
    r.reasons = [...new Set(r.reasons)];
    return r;
  }
  r.value = (revenue.value! - costTotal) / revenue.value!;
  return r;
}

export function availableStock(dataset: DomainDataset, skuId: string, window: MetricWindow, options: MetricOptions = {}): MetricResult {
  const r = base("available_stock", skuId, window, options);
  const sel = select(dataset, dataset.inventory, skuId, options.knownAt ?? null, (s) => t(s.observedAt) < t(window.end));
  r.excludedInputs.push(...sel.excluded);
  const latest = new Map<string, InventorySnapshot>();
  for (const s of sel.facts) {
    const current = latest.get(s.locationCode);
    if (!current || t(s.observedAt) > t(current.observedAt)) latest.set(s.locationCode, s);
  }
  const snapshots = [...latest.values()];
  if (snapshots.length === 0) return fail(r, "no_data", "no_inventory_snapshots");
  const usedSources = new Set(snapshots.map((s) => dataset.references.find((ref) => ref.id === s.sourceReferenceId)!.sourceId));
  r.sensitivity = maxSensitivity([...usedSources].map((id) => sel.sources.get(id)!.sensitivity));
  r.inputIds.push(...snapshots.map((s) => s.id));
  r.dataAsOf = snapshots.reduce((oldest, s) => (t(s.observedAt) < t(oldest) ? s.observedAt : oldest), snapshots[0]!.observedAt);
  r.value = snapshots.reduce((n, s) => n + (s.onHandQuantity - s.reservedQuantity), 0);
  return r;
}

export function stockCoverDays(dataset: DomainDataset, skuId: string, window: MetricWindow, options: MetricOptions = {}): MetricResult {
  const r = base("stock_cover_days", skuId, window, options);
  const stock = availableStock(dataset, skuId, window, options);
  const units = unitsSold(dataset, skuId, window, options);
  if (!combine(r, [stock, units])) return r;
  if (units.value === 0) return fail(r, "insufficient_data", "no_sales_in_window");
  const days = (t(window.end) - t(window.start)) / DAY_MS;
  r.value = stock.value! / (units.value! / days);
  return r;
}

export function sellThroughProxy(dataset: DomainDataset, skuId: string, window: MetricWindow, options: MetricOptions = {}): MetricResult {
  const r = base("sell_through_proxy", skuId, window, options);
  const units = unitsSold(dataset, skuId, window, options);
  const stock = availableStock(dataset, skuId, window, options);
  if (!combine(r, [units, stock])) return r;
  const denominator = units.value! + stock.value!;
  if (denominator === 0) return fail(r, "insufficient_data", "zero_denominator");
  r.value = units.value! / denominator;
  return r;
}

/** All v1 metrics for one SKU and window. `costType` selects the cost basis for margin. */
export function computeSkuMetrics(
  dataset: DomainDataset, skuId: string, window: MetricWindow, costType: CostFact["costType"], options: MetricOptions = {},
): MetricResult[] {
  return [
    unitsSold(dataset, skuId, window, options),
    grossRevenue(dataset, skuId, window, options),
    salesGrowthUnits(dataset, skuId, window, options),
    realizedGrossMarginRatio(dataset, skuId, window, costType, options),
    availableStock(dataset, skuId, window, options),
    stockCoverDays(dataset, skuId, window, options),
    sellThroughProxy(dataset, skuId, window, options),
  ];
}
