/** Owner-supplied recommendation policy (STEP 6, S6-DEC-01). The preference order is owner data, never a default. */
import type { PromotionAction } from "../../rules/src/index.ts";

export interface RecommendationPolicy {
  id: string;
  version: number;
  status: "draft" | "approved";
  approvedBy: string | null;
  approvedAt: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  /**
   * Owner order of actions. The first `eligible` action is recommended, a `blocked` action moves on
   * to the next, and a `review_required` action stops the walk (S6-DEC-02). Unlisted actions are
   * never recommended.
   */
  actionPreference: PromotionAction[];
}
