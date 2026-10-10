# STEP 5 — Opportunity Ranking: Rule-based Baseline (DEC-02)

**Project:** AI Product Intelligence Advisor  
**Date:** 10 October 2026  
**Status:** **IMPLEMENTED AND VERIFIED ON SYNTHETIC DATA. No owner ranking policy exists, so nothing real is ranked yet.**  
**Assumption:** The user asked to "continue with STEP 5" without choosing between the candidates offered. STEP 5 is taken to be opportunity ranking (`research-draft_v2.md` DEC-02; blueprint §5.1 step 8), which was option 1, as in the previous steps.  
**Basis:** `STEP_0_Product_Blueprint.md` §5.1–5.3, §6 (INV-05, INV-09, INV-10), §9, §9.2, §11.3, §14, CI-2; STEP 3 and STEP 4 records  
**Prompt standard:** Context → Goal → Constraints → Output → Verify

## 1. Context

STEP 4 labels each (SKU, action) `eligible`, `blocked` or `review_required` under an owner policy. Blueprint §5.1 step 8 then ranks the viable candidates with a **rule-based baseline**. Model experiments (Jev, LLM) are optional, and only allowed if they beat this baseline.

Blueprint §9.2 forbids inventing default percentages or scores. INV-10 forbids presenting a rank as a success probability.

## 2. Goal

Build `packages/ranking`: order the `eligible` candidates for each action by an **owner-supplied ranking policy**, an ordered list of metrics, each with a direction. This is a lexicographic order, with no weights and no score. Every other candidate is returned, unranked, with its reason. Per SKU, the four actions are listed with their verdicts as alternatives. Add a strict Zod schema for the ranking policy in `packages/contracts`.

## 3. Constraints

- **Package dependencies:**
  - `packages/ranking` imports only `domain`, `metrics` and `rules`. It does not import Zod or `contracts`.
  - The graph is `contracts → ranking → rules → metrics → domain`.
- **Out of scope:**
  - choosing one action per SKU and writing explanations (`RecommendationBuilder`, §14, §5.1 step 9);
  - signals from external evidence (SIG-01);
  - Jev or LLM ranking experiments;
  - what-if scenarios.
- **Output wording:** no numeric score field and no "top", "potential", "high" or "recommended" wording (CI-2, INV-10). Output is a `rank`, the criterion values and a `tied` flag.
- **No ranking criteria** in code, docs or defaults. Criteria exist only in `*.synthetic.json` fixtures.

## 4. Ranking policy shape (v1)

| Field | Meaning |
|---|---|
| `id`, `version`, `status`, `approvedBy`, `approvedAt`, `effectiveFrom`, `effectiveTo` | Same governance as the STEP 4 promotion policy. Every result records a SHA-256 of the content |
| `criteria[]` | Ordered list of `{ metric, direction }`. `direction` is `desc` or `asc` and is required, never defaulted. The first criterion decides, and each later criterion breaks ties in the ones before it |
| `appliesTo` | Actions this ranking orders (for example `discount`, `bundle`, `advertise_only`) |

Ranking metrics: `units_sold`, `sales_growth_units`, `realized_gross_margin_ratio`, `available_stock`, `stock_cover_days`, `sell_through_proxy`. `gross_revenue` is excluded because its values are currency-bound.

## 5. Decisions (proposed)

| ID | Decision | Rationale |
|---|---|---|
| S5-DEC-01 | Lexicographic order over owner criteria; no weights and no composite score | §9.2 forbids invented scores; a rank is not a probability (INV-10) |
| S5-DEC-02 | Only `eligible` candidates are ranked. `review_required` and `blocked` candidates go to `notRanked` with their verdict and reasons | Nothing disappears (§5.2 hard-constraint results; §11.3 blocked state) |
| S5-DEC-03 | An eligible candidate whose ranking metric is not `computed` goes to `notRanked` / `ranking_metric_unavailable`. Unknown values are never sorted first or last | Unknown is never a position (INV-09) |
| S5-DEC-04 | Values are compared after rounding to 9 decimal places | `stock_cover_days` involves two divisions, so mathematically equal values can differ in the last bit and split ties |
| S5-DEC-05 | Ties use competition ranking (1, 1, 3), marked `tied: true`. Order within a tie is by SKU id, for display only | Deterministic and honest about ties |
| S5-DEC-06 | Ranking reuses the STEP 4 evaluation context: the same window, `knownAt` and `evaluatedAt`. The margin cost basis is the promotion policy's `costType`. Mixed contexts, or a promotion policy whose hash does not match the evaluation, throw `RankingInputError` | Eligibility and order describe the same facts |
| S5-DEC-07 | No ranking policy, a draft, a not-yet-effective one, or one that does not apply to the action → nothing ranked for that action. Candidates go to `notRanked` with a reason | Same governance as STEP 4 |
| S5-DEC-08 | Each ranked list carries `evidenceBasis: "internal_only"` | §5.3: without external evidence, say so. External signals do not exist yet |
| S5-DEC-09 | Each list's sensitivity is the highest sensitivity of the metrics behind its criteria | The order by margin reveals margin even when values are hidden (DEC-008) |
| S5-DEC-10 | Deviation: `research-draft_v2.md` has DEC-02 depending on SIG-01 (signals). This baseline uses internal metrics only | Signals need authorized external evidence, which does not exist yet |

## 6. Output files

| File | Responsibility |
|---|---|
| `packages/ranking/src/policy.ts` | `RankingPolicy`, `RankingCriterion`, `RANKING_METRICS` |
| `packages/ranking/src/rank.ts` | `rankCandidates()`, `rankingPolicyRef()`, `RankingInputError`; per-action `RankedList` and `alternativesBySku` |
| `packages/ranking/src/index.ts` | Package exports |
| `packages/contracts/src/ranking.ts` | `RankingPolicySchema`: strict; criteria ≥ 1, unique metrics, direction required, no weights, `gross_revenue` excluded, approver and effective period |
| `packages/rules/src/evaluate.ts` | Now exports `contentSha256()` (shared policy hashing); `policyRef()` uses it, so promotion policy hashes are unchanged |
| `tests/fixtures/ranking.ts` | SYNTHETIC golden fixture (r1–r6) with a hand-derived table, including a float-noise tie and an eligible-but-unrankable SKU |
| `tests/fixtures/ranking-policy.synthetic.json`, `tests/fixtures/csv/ranking-policy.synthetic.json` | SYNTHETIC ranking policies for the golden fixture and the STEP 2 sample |
| `tests/ranking.test.ts` | 20 tests: golden order and tie, float precision, notRanked completeness, direction, governance, context and policy matching, provenance, sensitivity, alternatives, vocabulary, determinism, schema, purity |
| `scripts/ranking-sample.ts` | `npm run ranking:sample`: the STEP 2 sample evaluated with the synthetic promotion policy, then ranked without a policy and with the synthetic ranking policy |

## 7. Verify — observed results

Environment: Node 22.23.1, zod 4.6.5, typescript 5.9.3 (`package-lock.json`). Run at the repository root on 10 October 2026, after `rm -rf node_modules && npm ci`.

| Check | Command | Result |
|---|---|---|
| Full typecheck | `npm run typecheck` | **PASS** (exit 0) |
| Domain-only typecheck | `npm run typecheck:domain` | **PASS** (exit 0) |
| All tests | `npm test` | **PASS**: 120/120 (domain 18, contracts 12, ingestion 34, metrics 18, rules 18, ranking 20), exit 0 |
| Domain tests | `npm run test:domain` | **PASS** (exit 0) |
| Samples | `import:sample`, `metrics:sample`, `rules:sample`, `ranking:sample` | **PASS** (exit 0 each) |
| Golden order | `tests/ranking.test.ts` | r1 and r2 tied at rank 1 (cover 60 and 60.00000000000001 round to 60; margin 0.3; growth 0); r4 rank 3 (margin 0.2); r3 rank 4 (cover 30); r5 `ranking_metric_unavailable` (growth `no_sales_rows`); r6 `blocked` |
| `ranking:sample`, synthetic policy | hand-checked | `advertise_only`: 1 SYN-AX26-55 (cover 240 d), 2 SYN-BZ-50 (170 d), 3 SYN-AX25-55 (75 d); SYN-AX25-65 `blocked`. Evidence basis `internal_only`; sensitivity `confidential` |
| `ranking:sample`, no policy | — | Nothing ranked; eligible candidates listed with `missing_ranking_policy` |
| Purity | `grep -rlnE 'from "zod"\|contracts/src' packages/{domain,metrics,rules,ranking}` | no matches |
| Mutation check | Disabled, one at a time: 9-decimal rounding, eligibility filter, unavailable-metric guard, tie handling, draft cap, appliesTo, promotion-policy hash match, criterion direction, sensitivity | All 9 mutations failed ≥ 1 test; code restored |

One test assertion was wrong on the first run: it expected every `discount` candidate to be `review_required`, but r6 is `blocked` by its stock rule. The test was corrected; the code was not changed.

## 8. Owner inputs required

1. Ranking criteria per action: which metrics, in what order, and in which direction (for example, "highest stock cover first" or "lowest", which is a business choice).
2. Approver and effective period of the ranking policy.
3. Cost basis for margin criteria, taken from the promotion policy's `costType` (STEP 4).
4. Whether ranking should later include external signals (SIG-01), and on which authorized sources.

Choosing one action per SKU uses a separate owner policy (`actionPreference`); see [`STEP_6_Recommendation_and_Decision.md`](STEP_6_Recommendation_and_Decision.md) §7.
