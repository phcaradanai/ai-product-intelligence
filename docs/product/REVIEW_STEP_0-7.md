# Review — STEP 0 to STEP 7

**Date:** 11 October 2026  
**Scope:** everything built so far, checked against `STEP_0_Product_Blueprint.md` (§5.1 workflow, §11.3 UX states, §15.2 must-pass tests) and the open questions in each STEP record.  
**Method:**
- clean `npm ci`, then every script with its exit code;
- the design detector;
- in-app checks;
- a fresh finish-review subagent for the UI.

Evidence names refer to tests in `tests/*.test.ts` or to files.

## 1. Verdict

The engineering slice for blueprint §5.1 steps 1–10 is **built and verified on synthetic data**. Steps 5 (external enrichment) and 11 (outcome measurement) are not built, and part of step 6 is not built either.

Nothing is production-ready. Owner decisions block that (§5), not engineering.

Gaps found and fixed in this review:

| # | Gap | Fix |
|---|---|---|
| G1 | The synthetic sample produces only `recommended` SKUs. The "no promotion yet" section, the insufficient/review/blocked flags, the next-steps list and the no-data/insufficient fact cells had never rendered | Edge scenario `tests/fixtures/edge/` plus a demo "data set" selector. Tests in `tests/web.test.ts` pin every status and fact state |
| G2 | UI code drifted from DESIGN.md:<br>• Thai line-height below 1.35<br>• "insufficient" coloured two ways<br>• footnote marks in the status amber, against the contract<br>• hard-coded colours<br>• an off-ramp font size | Code aligned. Reason-class tables moved to `packages/recommendation/src/classes.ts` so the UI colours cells with the same classification. The detector returns `[]` |
| G3 | STEP 7 ended on a `fix` disposition with three unreviewed regression fixes | Final review round after G1 and G2 (§4) |
| G4 | CLAUDE.md was stale: "not a git repository", "no DESIGN.md", blueprint "DRAFT" | Corrected |
| G5 | Scratch file `.impeccable/tmp/brief.md` was committed | Untracked and git-ignored |

## 2. Blueprint §5.1 workflow

| Step | Status | Evidence |
|---|---|---|
| 1 Interpret | **Partial**: the north-star question is fixed. There is no intent parsing and no LLM. The objective is passed through, never inferred | S7-DEC-03 |
| 2 Resolve products | **Built**: canonical family/variant/SKU, exact merchant-SKU lookup, `ambiguous_sku` refusal. No fuzzy or probabilistic matcher | `tests/ingestion.test.ts` "ambiguous" / "unknown merchant SKU"; `tests/domain.test.ts` match states |
| 3 Load facts | **Built**: internal CSV import with lineage, rights gates and idempotency | `tests/ingestion.test.ts` |
| 4 Compute | **Built**: seven versioned metrics, hand-computed golden values | `tests/metrics.test.ts` |
| 5 Enrich (external) | **Not built**: no authorized external sources (DEC-006); every list says `internal_only` | `evidenceBasis` in ranking and recommendation |
| 6 Validate | **Partial**:<br>• built: rights gates, source-level sensitivity, single-source rule;<br>• exposed but not judged: freshness, because SLAs are open (DEC-009);<br>• not built: a data-quality score (`not_computed`) | `tests/metrics.test.ts`, `tests/rules.test.ts` |
| 7 Enforce policy | **Built**: deterministic owner policy; unknown is never pass | `tests/rules.test.ts` |
| 8 Rank | **Built**: lexicographic, owner criteria, no score | `tests/ranking.test.ts` |
| 9 Explain | **Partial**: the structured §5.2 anatomy is complete. There is no natural-language explanation (no LLM) | `tests/recommendation.test.ts` |
| 10 Capture choice | **Built**: approve, reject and request-more-data, with hash, permission and policy-period checks. The log is in memory only | `tests/recommendation.test.ts`, `tests/web.test.ts` |
| 11 Measure later | **Not built**: `outcome` is always null (`not_yet_measurable`) | S6-DEC-11 |

## 3. Blueprint §11.3 UX states and §15.2 must-pass tests

| §11.3 state | Status | Where it shows |
|---|---|---|
| Ready | Shown | sample scenario |
| Limited evidence (internal only, stale) | **Partial**: "internal data only" is always shown and `dataAsOf` per fact. There is no staleness judgment (DEC-009) | header, sheet facts |
| Review required | Shown | edge scenario SYN-E4-43 |
| Insufficient data | Shown, with next steps | edge scenario SYN-E1-50 and SYN-E2-55 |
| Blocked | Shown | edge scenario SYN-E3-65 |
| Decision pending / completed | Shown: latest decision, outcome "not yet measurable" | sheet decision block |

| §15.2 must-pass test | Status | Evidence |
|---|---|---|
| Similar names with different sizes must not merge | **Covered** for what exists. Variants are distinct entities, there is no automatic matcher, and merchant-SKU lookup is exact | `tests/domain.test.ts`; `tests/ingestion.test.ts` "ambiguous" |
| Old article fetched recently is not a new trend | **Covered at the data layer**. There is no trend engine yet | `tests/domain.test.ts` "recently fetched old article" |
| User without cost access sees no figures | **Covered** in the library, server and bundle | `tests/recommendation.test.ts` redaction; `tests/web.test.ts` internal view; `npm run check:web-bundle` |
| External review text with instructions stays untrusted | **Not applicable yet**: no external text and no LLM | — |
| High-score product failing margin or stock is excluded | **Covered in spirit**. There are no model scores, rules always win, and only eligible candidates are ranked | `tests/rules.test.ts`, `tests/ranking.test.ts` |
| Current competitor prices are not answered without support | **Not applicable yet**: no competitor data. The answer basis is labeled internal only | `evidenceBasis` |
| A what-if is not presented as lift | **Covered in spirit**. There is no what-if; price-changing actions are `post_action_unknown` | S4-DEC-04 |

## 4. UI finish review (STEP 7)

Final round (3rd) after G1 and G2: a fresh reviewer returned **`fix`** with 7 items. Two concerned accessibility: colour was the only cue between two states, and the fade sliced glyphs. The other five were framing and mobile details. All 7 were applied in one batch and recaptured; the detector is clean. **This batch has not been re-reviewed**, so STEP 7's design finish is not certified `ship`. Details: `STEP_7_Advisor_Workspace.md` §6, "Review round 3".

## 5. Owner blockers

These block production use and real recommendations. They do not block the next engineering step.

| Item | Blocks |
|---|---|
| DEC-001 … DEC-016 (category, organization, sources, metric owner, policies, data rights, KPI, RBAC, freshness, providers, language, cost/margin use, promotion history, budget, Jev/Hindsight hosting, team) | Real data, pilot, production |
| Promotion policy (STEP 4 §8, DEC-005), ranking criteria (STEP 5 §8), action preference (STEP 6 §7) | Any real `eligible`, ranked or recommended SKU |
| Metric definitions, owner review (DEC-004); authoritative cost type; source coverage periods | Trust in figures |
| S1-DEC-11 (tagged ProductMatch target vs blueprint §8.3) | Amending §8.3 |
| Clearance model (DEC-008): source-level sensitivity hides units and stock from internal viewers | Analyst usefulness |
| `docs/research/THE-PERFECT-PROMPT-PATTERN.md` is a byte-identical duplicate of the competitive research file. Delete or rename? (unanswered) | Nothing; housekeeping |

## 6. Engineering gaps that do not need an owner decision

1. **No CI**, although the repository now has a GitHub remote. This is FND-01, the proposed STEP 8.
2. No lint configuration (FND-01).
3. Docker, database, migrations and auth (FND-02/03) wait on ADR-003 and DEC-008.
