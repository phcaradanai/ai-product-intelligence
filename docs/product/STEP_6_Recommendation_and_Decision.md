# STEP 6 — Recommendation Builder & Decision Record

**Project:** AI Product Intelligence Advisor  
**Date:** 10 October 2026  
**Status:** **IMPLEMENTED AND VERIFIED ON SYNTHETIC DATA. No owner policies exist, so every real SKU is `review_required`.**  
**Assumption:** The user asked to "continue with STEP 6" without choosing between the candidates offered. STEP 6 is taken to be the recommendation builder plus decision record (blueprint §5.1 steps 9–10, §5.2, §14 `RecommendationBuilder` and `DecisionRecorder`; backlog DEC-03), which was option 1, as in the previous steps.  
**Basis:** `STEP_0_Product_Blueprint.md` §5.1–5.3, §6 (INV-02, INV-06, INV-08, INV-09, INV-10), §8.4, §9.1, §11.3, §11.4, §14, §15.2; STEP 3–5 records  
**Prompt standard:** Context → Goal → Constraints → Output → Verify

## 1. Context

STEP 4 labels each (SKU, action) eligible, blocked or review_required. STEP 5 orders the eligible candidates per action. The advisor must now answer per SKU in the §5.2 response anatomy: one recommended action or an honest status, the trusted facts, the constraint results, the alternatives, the evidence basis and the confidence dimensions. A human then approves, rejects or requests more data, and that decision is recorded with every version (§5.1 step 10).

## 2. Goal

Build `packages/recommendation`:

1. `buildRecommendations()` returns a full, unredacted `RecommendationSet`: one structured §5.2 response per SKU, plus a shortlist grouped by action.
2. `redactForViewer()` returns the view for an explicit viewer clearance.
3. `recordDecision()` appends an immutable decision record to an in-memory, append-only log.

Add strict Zod schemas for the owner recommendation policy and for decision input in `packages/contracts`.

## 3. Constraints

- **Package dependencies:**
  - `packages/recommendation` imports only `domain`, `metrics`, `rules` and `ranking`. It does not import Zod or `contracts`.
  - The graph is `contracts → recommendation → ranking → rules → metrics → domain`.
- **Out of scope:**
  - natural-language explanation (LLM or templates); the output is structured only, and wording belongs to the UI or a later LLM step;
  - outcome measurement (§5.1 step 11, M4);
  - RBAC itself (DEC-008);
  - persistence (ADR-003);
  - any execution of an action (INV-06).
- **Owner choices stay owner data.** Which action wins when several are allowed is an owner choice, recorded in `RecommendationPolicy.actionPreference`. There is no default order.
- **Objective:** passed through from the caller. It is never inferred and never used to choose an action.

## 4. Decisions (proposed)

| ID | Decision | Rationale |
|---|---|---|
| S6-DEC-01 | Owner `RecommendationPolicy` with `actionPreference` (an ordered list of actions) and the same governance as earlier policies: status, approver, effective period, hash, Zod. Without an approved, effective policy, no SKU gets an action: `review_required` / `missing_action_preference` | Picking one action per SKU is a business choice |
| S6-DEC-02 | **No fall-through past unknowns.** Walk `actionPreference` in order. A `blocked` action (a known fail) moves on to the next action. An `eligible` action is recommended. A `review_required` action **stops** the walk, and the SKU gets that status | Otherwise an unrestricted `hold` would become a silent "recommended" that hides missing data or missing policy |
| S6-DEC-03 | SKU status ∈ `recommended`, `insufficient_data`, `review_required`, `blocked`. `blocked` means every preferred action failed a hard rule (§11.3 blocked state). The `blocked` value extends §5.2's three statuses | Nothing is dropped, and a blocked SKU shows its constraint results |
| S6-DEC-04 | A stopping action's reasons map to a status through an exhaustive typed table. Missing data (`no_sales_rows`, `missing_cost`, …) → `insufficient_data`, with the missing metric and a next-step code. Conflicts (`multiple_sales_sources`, `overlapping_cost`, …), governance reasons and `post_action_unknown` → `review_required` | §5.3: say what is missing and what would help. A new reason code fails the typecheck |
| S6-DEC-05 | Shortlist: groups follow `actionPreference`. Within a group, SKUs follow that action's STEP 5 rank. Eligible but unranked SKUs go in a separate `unranked` list. Ranks are never merged across actions | Ranks of different actions are not comparable |
| S6-DEC-06 | Facts: `units_sold`, `gross_revenue`, `available_stock`, `stock_cover_days`, and `realized_gross_margin_ratio` with the promotion policy's `costType`. Each is a full STEP 3 result with formula version, `dataAsOf`, sensitivity and source references resolved from `inputIds` | INV-02 |
| S6-DEC-07 | Confidence dimensions are kept separate (§9.1): `entityMatch: internal_canonical`, `retrieval: not_applicable_internal_only`, `decisionModel: rule_based`, `dataQuality: null` (`not_computed`). There is no single confidence number | INV-10 |
| S6-DEC-08 | Redaction against an explicit, required viewer clearance (`public` < `internal` < `confidential` < `restricted`). Facts, rule metric values and thresholds, rule outcomes and ranking keys above the clearance are removed. So is the rank order of a list whose sensitivity exceeds the clearance. Verdicts and statuses stay visible | §11.4, §15.2. Residual: a verdict can still imply that a hidden rule failed |
| S6-DEC-09 | The recommendation id is the SHA-256 of the unredacted content. Redacted views keep the id. `generatedAt` comes from an injected clock | Tamper check on decisions; the same id for every viewer |
| S6-DEC-10 | `recordDecision()` refuses: approving anything not `recommended`; approve or reject without `canApprove`; an id that does not match the content; an empty rationale; a `decidedAt` before `generatedAt` or outside any policy's effective period | §5.2 decision record; INV-06 |
| S6-DEC-11 | The decision log is append-only. A new record for the same recommendation references the record it supersedes. Records carry `outcome: null` / `not_yet_measurable` and no execution field | Never fabricate outcomes; recommendation ≠ approval ≠ execution |

## 5. Output files

| File | Responsibility |
|---|---|
| `packages/recommendation/src/policy.ts` | `RecommendationPolicy` (owner `actionPreference`) |
| `packages/recommendation/src/build.ts` | `buildRecommendations()`: input consistency checks, preference walk, the exhaustive `UNKNOWN_REASON_CLASS` / `VERDICT_REASON_CLASS` tables, facts with resolved sources, constraints, alternatives, confidence dimensions, versions, content-hash ids, shortlist |
| `packages/recommendation/src/redact.ts` | `redactForViewer(set, clearance)`. Clearance is required |
| `packages/recommendation/src/decision.ts` | `recordDecision()` (append-only, with refusals), `currentDecisions()`, `DecisionError` |
| `packages/recommendation/src/index.ts` | Package exports |
| `packages/contracts/src/recommendation.ts` | `RecommendationPolicySchema`, `DecisionInputSchema` (strict, with no execution field) |
| `packages/rules/src/evaluate.ts` (amended) | Fail reasons are codes (`below_threshold`, …) with no embedded values. Rules on cost-derived metrics are at least `confidential` (STEP 4 S4-DEC-10/11) |
| `tests/fixtures/recommendation.ts`, `tests/fixtures/recommendation-policy.synthetic.json`, `tests/fixtures/csv/recommendation-policy.synthetic.json` | SYNTHETIC fixture (ranking fixture plus r7, which has no sales) and preference policies |
| `tests/recommendation.test.ts` | 21 tests: action choice, no fall-through, blocked, governance, anatomy, objective pass-through, shortlist, vocabulary, determinism, run consistency, redaction (no confidential number anywhere), decisions and refusals, schemas, purity |
| `tests/domain.test.ts` (added test) | Guard that `npm test` runs every `tests/*.test.ts` file |
| `scripts/recommend-sample.ts` | `npm run recommend:sample`: import → evaluate → rank → recommend → confidential and internal views → one synthetic decision |

## 6. Verify — observed results

Environment: Node 22.23.1, zod 4.6.5, typescript 5.9.3 (`package-lock.json`). Run at the repository root on 10 October 2026, after `rm -rf node_modules && npm ci`.

| Check | Command | Result |
|---|---|---|
| Full typecheck | `npm run typecheck` | **PASS** (exit 0) |
| Domain-only typecheck | `npm run typecheck:domain` | **PASS** (exit 0) |
| All tests | `npm test` | **PASS**: 144/144 (domain 19, contracts 12, ingestion 34, metrics 18, rules 20, ranking 20, recommendation 21), exit 0 |
| Samples | `import:sample`, `metrics:sample`, `rules:sample`, `ranking:sample`, `recommend:sample` | **PASS** (exit 0 each) |
| Golden choice | `tests/recommendation.test.ts` | r1/r2 `advertise_only` rank 1 (tied), r4 rank 3, r3 rank 4, r5 `advertise_only` unranked, r6 `hold` (higher actions blocked), r7 `insufficient_data` (`no_sales_rows` → `import_sales_for_window`). With `discount` preferred first, r1 is `review_required` (`post_action_unknown`) and does **not** fall through |
| `recommend:sample` | hand-checked | Confidential view: SYN-AX26-55 1, SYN-BZ-50 2, SYN-AX25-55 3 (`advertise_only`); SYN-AX25-65 `hold` (stock 4 blocks the other actions). Internal view: every fact redacted (ERP source is confidential) and ranks withheld; statuses and actions visible. One synthetic decision: `not_yet_measurable` |
| Purity | `grep -rlnE 'from "zod"\|contracts/src' packages/{domain,metrics,rules,ranking,recommendation}` | no matches |
| Mutation check | Disabled, one at a time: no-fall-through, two reason classifications, policy gate, fact redaction, threshold redaction, rank withholding, approve-only-recommended, content-hash check, permission check, rationale check, effective-period check, cost-rule confidential floor | All 13 mutations failed ≥ 1 test; code restored |

**Issues found and fixed during this step:**

1. **Value leak in rule reasons (STEP 4).** Fail reasons embedded the metric value as text. They are now codes, and values live only in structured fields.
2. **Margin floor leak.** The redaction test found that a margin rule on a SKU with no sales had no sensitivity, so its threshold (0.15) was visible at `internal` clearance. Rules on cost-derived metrics are now at least `confidential`.
3. **Unwired test file.** The first mutation run showed every STEP 6 mutation "surviving" because `tests/recommendation.test.ts` was not in `npm test`. It is now wired in, and a guard test fails if any test file is left out.

## 7. Open questions and owner inputs

1. Action preference order. Should it vary by objective (for example clearing stock vs protecting margin)? v1 has one order.
2. Who approves, and is separation of duties required (analyst prepares, manager approves)? Not enforced in code; `canApprove` is a caller input until RBAC exists (DEC-008).
3. Viewer clearance model (DEC-008). With source-level sensitivity, ERP units and stock are confidential, so a low-clearance viewer sees almost no facts (STEP 3 open question 7).
4. How should the data-quality confidence dimension be computed?
5. Where are decisions persisted (ADR-003), and what is their retention?
