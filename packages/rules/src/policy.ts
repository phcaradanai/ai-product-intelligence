/** Owner-supplied promotion policy (STEP 4). Values are data from the commercial owner (DEC-005), never code defaults. */
import type { CostFact, SKU } from "../../domain/src/models.ts";
import type { MetricDefinition } from "../../metrics/src/index.ts";

export const ACTIONS = ["discount", "bundle", "advertise_only", "hold"] as const;
export type PromotionAction = (typeof ACTIONS)[number];

/** Metrics usable in thresholds (S4-DEC-08), with the unit a threshold must declare. */
export const THRESHOLD_METRICS = {
  realized_gross_margin_ratio: "ratio",
  available_stock: "units",
  stock_cover_days: "days",
  units_sold: "units",
  sell_through_proxy: "ratio",
} as const satisfies Record<string, MetricDefinition["unit"]>;
export type ThresholdMetric = keyof typeof THRESHOLD_METRICS;

/** Actions after which current margin no longer describes the outcome (S4-DEC-04). */
export const PRICE_CHANGING_ACTIONS: ReadonlySet<PromotionAction> = new Set(["discount", "bundle"]);

interface RuleBase {
  id: string;
  appliesTo: PromotionAction[];
}

export interface MetricThresholdRule extends RuleBase {
  kind: "metric_threshold";
  metric: ThresholdMetric;
  comparator: "gte" | "lte";
  threshold: number;
  unit: MetricDefinition["unit"];
}

export interface ExclusionRule extends RuleBase {
  kind: "exclusion";
  scope: "sku" | "variant" | "family" | "brand" | "category";
  ids: string[];
}

export interface AllowedSkuStatusRule extends RuleBase {
  kind: "allowed_sku_status";
  statuses: SKU["status"][];
}

export type PolicyRule = MetricThresholdRule | ExclusionRule | AllowedSkuStatusRule;

export interface PromotionPolicy {
  id: string;
  version: number;
  status: "draft" | "approved";
  approvedBy: string | null;
  approvedAt: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  costType: CostFact["costType"];
  /** Actions the owner explicitly declares free of rules (S4-DEC-03). */
  unrestrictedActions: PromotionAction[];
  rules: PolicyRule[];
}
