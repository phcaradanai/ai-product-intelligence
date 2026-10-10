/** Owner-supplied ranking policy (STEP 5). Criteria are owner data, never code defaults (blueprint §9.2). */
import type { PromotionAction } from "../../rules/src/index.ts";

/** Metrics usable as ranking criteria; gross_revenue is excluded because its values are currency-bound. */
export const RANKING_METRICS = [
  "units_sold", "sales_growth_units", "realized_gross_margin_ratio", "available_stock", "stock_cover_days", "sell_through_proxy",
] as const;
export type RankingMetric = (typeof RANKING_METRICS)[number];

export interface RankingCriterion {
  metric: RankingMetric;
  /** Required: "desc" puts larger values first. Never defaulted; the direction is a business choice. */
  direction: "desc" | "asc";
}

export interface RankingPolicy {
  id: string;
  version: number;
  status: "draft" | "approved";
  approvedBy: string | null;
  approvedAt: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  /** Actions whose eligible candidates this policy orders. */
  appliesTo: PromotionAction[];
  /** Lexicographic: the first criterion decides; later ones break ties. */
  criteria: RankingCriterion[];
}
