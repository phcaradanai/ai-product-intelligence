/**
 * Metric definitions registry (STEP 3 / MET-01). Every definition is PROPOSED until the metric
 * owner is decided (DEC-004). Changing a formula requires a version bump.
 */

export type MetricId =
  | "units_sold"
  | "gross_revenue"
  | "sales_growth_units"
  | "realized_gross_margin_ratio"
  | "available_stock"
  | "stock_cover_days"
  | "sell_through_proxy";

export interface MetricDefinition {
  id: MetricId;
  version: number;
  status: "proposed";
  /** "units" | "ratio" | "days" | "minor_currency" (minor units of the result's currency). */
  unit: "units" | "ratio" | "days" | "minor_currency";
  formula: string;
  inputs: readonly ("sales" | "inventory" | "costs")[];
  missingDataPolicy: string;
  parameters: readonly string[];
}

export const METRIC_DEFINITIONS: Readonly<Record<MetricId, MetricDefinition>> = {
  units_sold: {
    id: "units_sold", version: 1, status: "proposed", unit: "units",
    formula: "Σ quantitySold of authorized sales with eventAt in [start, end)",
    inputs: ["sales"], parameters: [],
    missingDataPolicy: "no rows → no_data (never 0); more than one sales source → insufficient_data",
  },
  gross_revenue: {
    id: "gross_revenue", version: 1, status: "proposed", unit: "minor_currency",
    formula: "Σ grossRevenueMinor of authorized sales with eventAt in [start, end); as exported, before deductions",
    inputs: ["sales"], parameters: [],
    missingDataPolicy: "no rows → no_data; mixed currencies or more than one sales source → insufficient_data",
  },
  sales_growth_units: {
    id: "sales_growth_units", version: 1, status: "proposed", unit: "ratio",
    formula: "(units_sold[start,end) − units_sold[prev]) / units_sold[prev]; prev = equal-length window ending at start",
    inputs: ["sales"], parameters: [],
    missingDataPolicy: "either window no_data → no_data; previous units = 0 → insufficient_data (zero_baseline)",
  },
  realized_gross_margin_ratio: {
    id: "realized_gross_margin_ratio", version: 1, status: "proposed", unit: "ratio",
    formula: "(R − Σ qtyᵢ × costᵢ) / R; R = gross_revenue; costᵢ = cost of costType effective at saleᵢ.eventAt (effectiveFrom ≤ t < effectiveTo)",
    inputs: ["sales", "costs"], parameters: ["costType"],
    missingDataPolicy: "no sales → no_data; R = 0, missing or overlapping cost, or currency mismatch → insufficient_data",
  },
  available_stock: {
    id: "available_stock", version: 1, status: "proposed", unit: "units",
    formula: "Σ over locations (onHand − reserved) of the latest snapshot per location with observedAt < end",
    inputs: ["inventory"], parameters: [],
    missingDataPolicy: "no snapshots → no_data; dataAsOf = oldest snapshot used; staleness reported, not judged",
  },
  stock_cover_days: {
    id: "stock_cover_days", version: 1, status: "proposed", unit: "days",
    formula: "available_stock / (units_sold / window days)",
    inputs: ["sales", "inventory"], parameters: [],
    missingDataPolicy: "component not computed → same status; units_sold = 0 → insufficient_data (no_sales_in_window), never Infinity",
  },
  sell_through_proxy: {
    id: "sell_through_proxy", version: 1, status: "proposed", unit: "ratio",
    formula: "units_sold / (units_sold + available_stock); PROXY without receipts data",
    inputs: ["sales", "inventory"], parameters: [],
    missingDataPolicy: "component not computed → same status; denominator 0 → insufficient_data (zero_denominator)",
  },
};
