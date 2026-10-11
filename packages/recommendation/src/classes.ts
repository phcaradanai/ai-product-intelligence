/**
 * Reason classification tables (S6-DEC-04). Pure data with type-only imports, so the web UI can
 * import it at runtime without pulling server code into the client bundle.
 */
import type { RuleUnknownReason, VerdictReason } from "../../rules/src/index.ts";

/** Next-step codes for missing or conflicting data (§5.3). The UI renders them as text. */
export type NextStep =
  | "import_sales_for_window" | "import_inventory_snapshot" | "import_cost_for_cost_type" | "check_sales_coverage"
  | "import_previous_period_sales" | "verify_sales_revenue" | "verify_sales_and_inventory" | "resolve_currency"
  | "choose_authoritative_sales_source" | "fix_overlapping_cost_periods" | "owner_review_post_action_margin" | "fix_catalog";

/**
 * Exhaustive status mapping for unknown-rule reasons (S6-DEC-04). Adding a reason code to metrics or
 * rules without classifying it here fails the typecheck.
 */
export const UNKNOWN_REASON_CLASS: Readonly<Record<RuleUnknownReason, { status: "insufficient_data" | "review_required"; nextStep: NextStep }>> = {
  no_sales_rows: { status: "insufficient_data", nextStep: "import_sales_for_window" },
  no_inventory_snapshots: { status: "insufficient_data", nextStep: "import_inventory_snapshot" },
  missing_cost: { status: "insufficient_data", nextStep: "import_cost_for_cost_type" },
  no_sales_in_window: { status: "insufficient_data", nextStep: "check_sales_coverage" },
  zero_baseline: { status: "insufficient_data", nextStep: "import_previous_period_sales" },
  zero_revenue: { status: "insufficient_data", nextStep: "verify_sales_revenue" },
  zero_denominator: { status: "insufficient_data", nextStep: "verify_sales_and_inventory" },
  mixed_currency: { status: "review_required", nextStep: "resolve_currency" },
  currency_mismatch: { status: "review_required", nextStep: "resolve_currency" },
  multiple_sales_sources: { status: "review_required", nextStep: "choose_authoritative_sales_source" },
  overlapping_cost: { status: "review_required", nextStep: "fix_overlapping_cost_periods" },
  post_action_unknown: { status: "review_required", nextStep: "owner_review_post_action_margin" },
  unknown_sku: { status: "review_required", nextStep: "fix_catalog" },
};

/** Every verdict reason except rule_unknown is a governance stop (review_required); rule_unknown is derived from rule reasons. */
export const VERDICT_REASON_CLASS: Readonly<Record<VerdictReason, "review_required" | "derive_from_rules">> = {
  missing_owner_policy: "review_required",
  policy_not_approved: "review_required",
  policy_not_effective: "review_required",
  policy_reference_error: "review_required",
  no_applicable_rules: "review_required",
  rule_failed: "review_required",
  rule_unknown: "derive_from_rules",
};
