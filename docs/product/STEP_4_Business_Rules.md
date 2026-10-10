# STEP 4 — Business Rules: Policy Evaluator (DEC-01)

**Project:** AI Product Intelligence Advisor  
**Date:** 10 October 2026  
**Status:** **IMPLEMENTED AND VERIFIED ON SYNTHETIC DATA. No owner policy exists (DEC-005), so every real candidate is `review_required`.**  
**Assumption:** The user asked to "continue with STEP 4" without choosing between the two candidates offered. STEP 4 is taken to be business rules (`research-draft_v2.md` DEC-01; blueprint §5.1 step 7, §14 `BusinessPolicyEvaluator`). It was option 1, its only dependency is MET-01, and the other path (MET-02/RET-01) needs authentication and a database first.  
**Basis:** `STEP_0_Product_Blueprint.md` §5.1, §5.3, §6 (INV-05, INV-06, INV-07, INV-10), §9, §11.3, §14, DEC-005, DEC-008; STEP 3 record  
**Prompt standard:** Context → Goal → Constraints → Output → Verify

## 1. Context

STEP 3 delivers versioned metrics. Before any candidate is ranked or explained, hard business constraints must be checked deterministically. A model preference can never override them (INV-05).

The constraint *values* belong to the commercial owner (DEC-005): margin floor, stock, exclusions, vendor limits. None of these values exist yet.

## 2. Goal

Build `packages/rules`: a pure evaluator that takes an **owner-supplied policy (data)**, a dataset, SKUs, actions and a window. For every (SKU, action) it returns `pass | fail | unknown` per rule and an overall verdict of `eligible | blocked | review_required`. Each result carries policy and metric versions. Add a strict Zod schema for the policy in `packages/contracts`.

## 3. Constraints

- **Package dependencies:**
  - `packages/rules` imports only `domain` and `metrics`. It does not import Zod or `contracts`.
  - `packages/contracts` validates the policy and imports `rules` types.
  - The graph stays `contracts → rules → metrics → domain`.
- **Out of scope:**
  - ranking, scores, recommendation building, explanation (§5.1 steps 8–9);
  - budget rules, because there is no campaign-cost data;
  - post-action scenarios such as discount depth or what-if (INV-07).
- **No policy values** in code, docs or defaults. Thresholds appear only in test fixtures, labeled SYNTHETIC.
- **Verdict vocabulary** is `eligible | blocked | review_required`, never `recommended`, which belongs to the recommendation step.

## 4. Policy shape (v1)

| Field | Meaning |
|---|---|
| `id`, `version` | Identify the policy. Every evaluation also records a SHA-256 hash of the policy content |
| `status` | `draft` or `approved`. A draft can never produce `eligible`: its verdicts are at most `review_required`, and a failing rule still blocks |
| `approvedBy`, `approvedAt` | Required when `status` is `approved` |
| `effectiveFrom`, `effectiveTo` | Checked against the injected `evaluatedAt`, never the wall clock |
| `costType` | Cost basis for margin metrics (`purchase` / `landed` / `other`) |
| `unrestrictedActions` | Actions the owner explicitly declares free of rules. Without this, an action with no applicable rule is `review_required` |
| `rules[]` | See below. Each rule has `id`, `kind` and `appliesTo` (actions) |

Rule kinds:

| Kind | Fields | Outcome |
|---|---|---|
| `metric_threshold` | `metric`, `comparator` (`gte` / `lte`), `threshold`, `unit` | `pass` / `fail` from the STEP 3 metric. `unknown` when the metric is not computed. `unit` must equal the metric's unit, and ratio thresholds must lie in [0, 1] |
| `exclusion` | `scope` (`sku` / `variant` / `family` / `brand` / `category`), `ids[]` | `fail` when the SKU falls under a listed id; otherwise `pass`. Covers vendor and brand restrictions |
| `allowed_sku_status` | `statuses[]` | `pass` when the SKU status is listed; otherwise `fail`. Whether discontinued SKUs may be promoted is the owner's choice |

## 5. Decisions (proposed)

| ID | Decision | Rationale |
|---|---|---|
| S4-DEC-01 | Verdict precedence: any `fail` → `blocked` (unknowns still listed); else any `unknown` → `review_required`; else `eligible` | Unknown is never pass (INV-09) |
| S4-DEC-02 | No policy → every candidate is `review_required` / `missing_owner_policy` | §11.3 "missing owner policy" state |
| S4-DEC-03 | An action with no applicable rule is `review_required` / `no_applicable_rules`, unless listed in `unrestrictedActions` | Avoids vacuous "eligible" |
| S4-DEC-04 | Margin thresholds check **current realized** margin. For `discount` and `bundle`, a passing margin rule becomes `unknown` / `post_action_unknown`, because a price change can break the floor. A failing one stays `fail` | Honest and conservative until scenario modeling exists (INV-07) |
| S4-DEC-05 | The policy is rejected (Zod) when a unit mismatches the metric, a ratio threshold is outside [0, 1], or a field or kind is unknown | Catches typos such as `15` instead of `0.15` |
| S4-DEC-06 | Policy ids that are not in the dataset (exclusions) are reported as `policy_reference_error` and cap verdicts at `review_required` | An unknown id never silently excludes nothing |
| S4-DEC-07 | A rule result inherits its metric's sensitivity, and an evaluation takes the highest of its rules | A pass/fail on a margin rule reveals margin (DEC-008) |
| S4-DEC-08 | Threshold metrics in v1: `realized_gross_margin_ratio`, `available_stock`, `stock_cover_days`, `units_sold`, `sell_through_proxy` | `gross_revenue` (currency-bound) and `sales_growth_units` (unbounded) are deferred |
| S4-DEC-09 | `evaluatedAt` must be a full date-time with an offset; otherwise `RulesInputError` is thrown | A malformed clock would silently skip the effective-period check |
| S4-DEC-10 | (Amended in STEP 6) Fail reasons are codes: `below_threshold`, `above_threshold`, `excluded_<scope>:<id>`, `sku_status_<status>`. Metric values live only in the structured `metric` field | Values in free text cannot be redacted |
| S4-DEC-11 | (Amended in STEP 6) A rule on a cost-derived metric is at least `confidential`, even when the metric has no data | Its threshold reveals cost policy |

## 6. Output files

| File | Responsibility |
|---|---|
| `packages/rules/src/policy.ts` | Policy and rule types, the `ACTIONS` vocabulary, `THRESHOLD_METRICS` (metric → required unit), `PRICE_CHANGING_ACTIONS` |
| `packages/rules/src/evaluate.ts` | `evaluateCandidates()`, `checkPolicyReferences()`, `policyRef()` (SHA-256 of the policy content), `RulesInputError` |
| `packages/rules/src/index.ts` | Package exports |
| `packages/contracts/src/policy.ts` | `PromotionPolicySchema`: strict Zod validation. Checks unit vs metric, ratio range, approver, effective period, unique rule ids, and that no rule applies to an unrestricted action |
| `tests/fixtures/policy.synthetic.json` | SYNTHETIC approved policy over the STEP 3 golden fixture |
| `tests/fixtures/csv/policy.synthetic.json` | SYNTHETIC approved policy over the STEP 2 sample IDs (used by `rules:sample`) |
| `tests/rules.test.ts` | 18 tests: verdicts, governance caps, provenance, sensitivity, determinism, input guard, schema typos, purity |
| `scripts/rules-sample.ts` | `npm run rules:sample`: every active sample SKU × 4 actions, evaluated without a policy and with the synthetic policy |

## 7. Verify — observed results

Environment: Node 22.23.1, zod 4.6.5, typescript 5.9.3 (`package-lock.json`). Run at the repository root on 10 October 2026, after `rm -rf node_modules && npm ci`.

| Check | Command | Result |
|---|---|---|
| Full typecheck | `npm run typecheck` | **PASS** (exit 0) |
| Domain-only typecheck | `npm run typecheck:domain` | **PASS** (exit 0) |
| All tests | `npm test` | **PASS**: 100/100 (domain 18, contracts 12, ingestion 34, metrics 18, rules 18), exit 0 |
| Domain tests | `npm run test:domain` | **PASS** (exit 0) |
| Samples | `npm run import:sample`, `metrics:sample`, `rules:sample` | **PASS** (exit 0 each) |
| `rules:sample`, no policy | every SKU × action | `review_required` / `missing_owner_policy` (16/16) |
| `rules:sample`, synthetic policy | hand-checked | SYN-AX25-65: available stock 4 is below the threshold 5, so `blocked` for discount, bundle and advertise_only. SYN-BZ-50 discount: `blocked` by the brand exclusion. Every discount/bundle with a passing margin rule: `review_required` (`post_action_unknown`). `advertise_only` with all rules passing: `eligible`. `hold` (declared unrestricted): `eligible` |
| Purity | `grep -rlnE 'from "zod"\|contracts/src' packages/domain packages/metrics packages/rules` | no matches |
| Mutation check | Disabled, one at a time: unknown→pass, skipping the unknown branch, dropping `rule_unknown`, verdict precedence, `no_applicable_rules`, post-action margin, draft cap, reference-error cap, sensitivity propagation, ratio-range check | All 10 mutations failed ≥ 1 test; code restored. Two earlier attempted mutations were invalid (a no-op sed and a semantically equivalent change) and were replaced |

## 8. Owner inputs required (DEC-005)

1. Margin floor and its cost basis (`purchase` or `landed`), per action.
2. Minimum available stock per action.
3. Exclusions: SKUs, families, brands and categories, including vendor restrictions.
4. Which SKU statuses may be promoted, including discontinued stock.
5. Effective period and approver.
6. Which actions, if any, are unrestricted (for example `hold`).
7. Budget rules, once campaign-cost data exists.

Ranking of eligible candidates is a separate owner policy; see [`STEP_5_Opportunity_Ranking.md`](STEP_5_Opportunity_Ranking.md) §8.
