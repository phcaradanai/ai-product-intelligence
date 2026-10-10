# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

Early-stage repo for the *AI Product Intelligence Advisor* — an evidence-first AI product/promotion decision-intelligence platform (Thai-first, TV/electronics pilot proposed). STEP 0 (blueprint) and STEP 1 (data domain foundation) were declared complete by the user on 10 Oct 2026. STEP 2 (in-memory internal CSV import and data-quality report) STEP 3 (versioned deterministic metrics, MET-01) STEP 4 (business-rule policy evaluator, DEC-01) STEP 5 (rule-based opportunity ranking, DEC-02) STEP 6 (recommendation builder and decision record) and STEP 7 (Advisor Workspace web app in `apps/web`, TanStack Start) are implemented. There is no separate API service, database, lint config or CI yet, and it is not a git repository. `alternative/ai-product-intelligence-step1/` is the original STEP 1 candidate kept locally for reference (git-ignored) — do not edit it; the live code is at the root.

## Commands

Node ≥ 22.10 (tests run TypeScript directly via `--experimental-strip-types`; no build step, no test framework).

```bash
npm ci                     # install pinned zod / typescript / @types/node
npm run typecheck          # tsc over packages/ and tests/
npm test                   # node:test over tests/{domain,contracts,ingestion,metrics,rules,ranking,recommendation,web}.test.ts (new test files must be added to this script; a guard test in domain.test.ts fails otherwise)
npm run import:sample      # import tests/fixtures/csv/*.csv and print the quality report
npm run metrics:sample     # import the sample and print v1 metrics per active SKU
npm run rules:sample       # evaluate sample SKUs × actions with no policy and with a SYNTHETIC policy
npm run ranking:sample     # rank eligible sample candidates with no ranking policy and with a SYNTHETIC one
npm run recommend:sample   # end-to-end sample: recommendations, internal/confidential views, one decision
npm run dev:web            # Advisor Workspace on http://localhost:3017 (also `.claude/launch.json` → advisor-web)
npm run typecheck:web      # app typecheck (root typecheck does not cover apps/)
npm run build:web && npm run check:web-bundle   # build, then fail if confidential values/server code reach the client bundle
npm run typecheck:domain   # domain package only (no Zod needed)
npm run test:domain        # domain tests only
node --experimental-strip-types --test --test-name-pattern="<regex>" tests/domain.test.ts   # single test
```

Imports use explicit `.ts` extensions (`allowImportingTsExtensions`, `verbatimModuleSyntax`, `exactOptionalPropertyTypes`). `erasableSyntaxOnly` is on because Node strips types without transpiling, so enums, namespaces and constructor parameter properties are not allowed.

## Code layout

- `packages/domain/src/` — pure TypeScript, **must not import Zod**: `models.ts` (13 entities + `DomainDataset`), `integrity.ts` (`checkDatasetIntegrity()` cross-record checks: references, duplicates, time ranges, match review rules, source rights, cost sensitivity; `acceptedTarget()`), `evidence.ts` (`publishedWithin()`).
- `packages/contracts/src/schemas.ts` — Zod 4 strict schemas mirroring each domain type (`z.ZodType<T>`), and `parseDomainDataset()` = schema parse + integrity check. Changing a domain type means changing its schema too; the typecheck enforces the match.
- `packages/ingestion/src/` imports `contracts` and `domain`. `importCsv(dataset, options)` returns `{ run, dataset }` and never mutates its input. It refuses whole files at source, rights, encoding and header gates, and rejects single rows with file, line, column and code. Records are never overwritten: same content is a no-op, different content is a `conflict`. The importer never creates `DataSource` records. `buildQualityReport()` deliberately contains no business metrics. Import the catalog before fact files, because facts resolve `merchant_sku` against it. Fact IDs are `naturalKeyId()` hashes of the natural key. Decisions S2-DEC-01 to 16 and the file formats are in `docs/product/STEP_2_Internal_CSV_Import.md`.
- `packages/metrics/src/` is pure TypeScript and depends only on `domain` (no Zod, no I/O). Each metric function returns a `MetricResult`: a value **or** `no_data`/`insufficient_data` with reason codes, plus version, `inputIds`, `excludedInputs`, `dataAsOf` and propagated `sensitivity`. Rules: no rows is never 0; stock cover is never Infinity; only authorized sources are used; sales from more than one source are flagged, not summed; cost types are never mixed. Metrics must not contain thresholds, scores or judgment labels, because those belong to signals and rules. A formula change bumps its version, and the pin test in `tests/metrics.test.ts` enforces this. Golden values in `tests/fixtures/metrics.ts` are hand-computed.
- `packages/rules/src/` imports only `domain` and `metrics`. It must not import Zod or `contracts`; the dependency graph is `contracts → rules → metrics → domain`. `evaluateCandidates()` checks an **owner-supplied** `PromotionPolicy` (validated by `PromotionPolicySchema` in contracts) per (SKU, action) and returns `pass/fail/unknown` per rule plus a verdict of `eligible | blocked | review_required`. It never returns "recommended", a score or a rank. Rules:
  - Unknown is never pass.
  - No policy → `missing_owner_policy`.
  - A draft or not-yet-effective policy, or one with unknown ids, can never yield `eligible`.
  - An action with no rules is `review_required` unless it is declared unrestricted.
  - A passing margin rule for `discount`/`bundle` is `post_action_unknown`.
  - **Never put real policy values (thresholds) in code, docs or defaults; they are DEC-005 owner input.** Thresholds exist only in `*.synthetic.json` fixtures.
- `packages/ranking/src/` imports only `domain`, `metrics` and `rules`. The dependency graph is `contracts → ranking → rules → metrics → domain`. `rankCandidates()` takes a STEP 4 `EvaluationOutput`, the matching `PromotionPolicy` (hash must match; it supplies `costType`) and an owner `RankingPolicy` (ordered `{metric, direction}` criteria, validated by `RankingPolicySchema`).
  - Ordering is lexicographic, with no weights, no score field, and no "top", "potential" or "recommended" wording.
  - Only `eligible` candidates are ranked. All others, and eligible candidates whose ranking metric is unavailable, go to `notRanked` with a reason. Nothing is dropped.
  - Values are compared at 9 decimals. Ties use competition ranks.
  - Every list says `evidenceBasis: "internal_only"`.
  - It never picks one action per SKU; that is the future `RecommendationBuilder`.
- `packages/recommendation/src/` imports only `domain`, `metrics`, `rules` and `ranking`. The full dependency graph is `contracts → recommendation → ranking → rules → metrics → domain`.
  - `buildRecommendations()` produces the §5.2 response per SKU from one evaluation and ranking run, which is checked.
  - The action comes from the owner `RecommendationPolicy.actionPreference`. The walk skips only `blocked` actions; a `review_required` action stops it, so there is no fall-through to `hold`.
  - Status is one of `recommended | insufficient_data | review_required | blocked`, classified by the exhaustive `UNKNOWN_REASON_CLASS` table. A new metric or rule reason code must be added there.
  - The output is structured only, with no prose.
  - `redactForViewer(set, clearance)` must be applied before showing anything. Clearance is required, never defaulted.
  - `recordDecision()` is append-only and checks the content hash, status, permission, rationale and policy periods. `outcome` is always null (`not_yet_measurable`).
  - Rule fail reasons are codes, never values. Rules on cost-derived metrics are at least `confidential`.
- `apps/web/` is a single root package with no workspaces (S7-DEC-02).
  - The whole pipeline runs only in server functions (`src/server/functions.ts` → `pipeline.ts`). Only `redactForViewer()` output reaches the browser.
  - Client code imports package **types** only. Never import `pipeline.ts`/`sample.ts` or package runtime code into UI files; `check:web-bundle` enforces this.
  - Decisions go to the server by recommendation id, and the server stamps `decidedAt`.
  - Demo clearance defaults to `internal` and approval to off.
  - Copy lives in `src/i18n.ts` as exhaustive `{th, en}` Records. A new code must be added there, or the typecheck fails.
  - Visual system: `DESIGN.md` plus the surface brief `.impeccable/surfaces/apps-web-src-routes-index-tsx.md` (direction "Market Page"). The impeccable design hook runs on UI edits.
- `tests/fixtures/synthetic.ts` is the domain fixture; fictional `SYN-` data covering all match review states, authorized vs unverified sources, and a stale article. Tests mutate `structuredClone` copies. `tests/fixtures/csv/` holds the sample exports and source registry for import tests.
- Contract decisions S1-DEC-01…14 are in `docs/product/STEP_1_Data_Domain_Foundation.md`; record new ones there, and update its §7 verify table only with output you actually ran.

Much of the research material is written in Thai. The north-star user question is Thai: “ทีวีรุ่นไหนในสต็อกที่ควรทำโปรโมชั่นในเดือนนี้ และควรใช้โปรโมชั่นแบบใด?” (which in-stock TVs should be promoted this month, and with what promotion type).

## Document map and precedence

- `PRODUCT.md` holds the product context for UI and design work (`/impeccable`). It records users (analyst prepares, manager decides), the stack (TanStack Start + React), a bilingual Thai/English UI, and evidence that must not be fabricated. There is no DESIGN.md yet.
- `docs/product/STEP_7_Advisor_Workspace.md`: STEP 7 record (server boundary, S7-DEC, verify and finish-review results).
- `docs/product/STEP_6_Recommendation_and_Decision.md`: STEP 6 record (preference walk, status mapping, redaction, decision log, S6-DEC).
- `docs/product/STEP_5_Opportunity_Ranking.md`: STEP 5 record (ranking policy shape, S5-DEC, owner inputs).
- `docs/product/STEP_4_Business_Rules.md`: STEP 4 record (policy shape, verdict rules, S4-DEC, owner inputs).
- `docs/product/STEP_3_Metric_Definitions.md`: STEP 3 record (shared metric rules, v1 definitions, verify results).
- `docs/product/STEP_2_Internal_CSV_Import.md`: STEP 2 record (file formats, failure levels, S2-DEC, verify results).
- `docs/product/STEP_1_Data_Domain_Foundation.md` — STEP 1 record: constraints applied, contract decisions, verify results. (`STEP_1_Prompt_01.md` is superseded.)
- `docs/product/STEP_0_Product_Blueprint.md` — **the primary reference.** Synthesizes everything else into product charter, first vertical slice, invariants, domain ontology, reference architecture, evaluation gates, decision register, and the hand-off contract for coding tasks. Status: DRAFT, approval pending.
- `docs/research/research-draft_v2.md` — v0.2 architecture/implementation plan: modules MOD-01..10, proposed monorepo layout (§7), backlog, milestones M0–M4, POC experiments EXP-01..04, ADR-001..012 (§14).
- `docs/research/AI_Product_Intelligence_Advisor_Architecture.md` — v0.1 architecture draft (superseded by v0.2 where they conflict).
- `docs/research/AI_Product_Intelligence_Competitive_Research.md`, `deep-research-report.md` — OSS/commercial case studies (Onyx, Splink/Zingg, Hindsight, Jev, Medusa, Saleor, DataWeave, etc.). Snapshots dated 9 Oct 2026, not live vendor facts.
- `docs/research/THE-PERFECT-PROMPT-PATTERN.md` is a byte-identical duplicate of the competitive research file; the actual prompt pattern is `THE-PERFECT-PROMPT-PATTERN.txt`.
- `docs/concept/AI Product Intelligence Dashboard.png` — concept image; look-and-feel only. Its placeholder numbers/score/discount % conflict with invariants. Blueprint §11.5 (CI-1…CI-12) lists what must not be copied.

Proposed precedence when sources disagree (blueprint §0): new approved decisions/ADRs → approved blueprint → v0.2 draft → v0.1 draft → research reports.

Blueprint markers matter: **[ESTABLISHED]**, **[PROPOSED]**, **[OPEN]**, **[LATER]**. Nothing in the docs is approved yet — never treat a [PROPOSED] stack choice or ADR as accepted, and never claim approval just because a document exists.

## How implementation work is meant to proceed

Every scoped task follows the Perfect Prompt Pattern (blueprint §20): **Context → Goal → Constraints → Output → Verify** — one narrow deliverable per task, report deviations before changing architecture, never fabricate data or test results.

STEP 7 is done on synthetic data. No owner policies exist yet, so a real dataset would show every SKU as `review_required`. The next step is not yet defined. Candidates:
- **M0 foundation:** git, CI, Docker, PostgreSQL, auth. This unblocks persistence (ADR-003), RBAC (DEC-008) and real data.
- **Further surfaces:** Product Explorer, Data Health/Match Review, Decision History (blueprint §11.2).

Confirm with the user.

Milestones: STEP 0 blueprint → M0 engineering foundation → M1 trusted product data → M2 evidence-first analyst → M3 opportunity advisor → M4 decision & outcome loop.

## Architecture (proposed, not locked)

Modular monolith + background workers. Proposed layout (v0.2 §7): `apps/{web,api}`, `packages/{domain,contracts,metrics,business-rules,evidence,ai-adapters,shared}`, `workers/{ingestion,enrichment,matching,signals}`, `modules/*`, `experiments/*`, `infrastructure/*`, `tests/{fixtures,golden-questions,entity-matching,recommendations,security}`.

Candidate stack: TanStack Start/React/Tailwind; Fastify + TypeScript + Zod; PostgreSQL (+ FTS/pgvector for hybrid retrieval); DuckDB/Parquet for history; MinIO/S3; Redis + BullMQ; provider-independent LLM adapters; optional Jev (typed choice model, benchmark-only) and Hindsight (memory, never authoritative); explicit orchestration code before LangGraph; Docker Compose.

Core loop: `Product Identity → Trusted Data → Market Signals → Business Analysis → Recommendation → Human Decision → Outcome Measurement`. The advisor pipeline: interpret → resolve products → load facts → compute deterministic metrics → enrich with authorized evidence → validate (rights/freshness/match) → enforce hard policy → rank (rule-based baseline) → explain → human decision → measure outcome later.

## Invariants that shape all code (blueprint §6)

- The LLM is never the source of truth for money, stock, sales, or sources; arithmetic and metrics are deterministic, versioned code/SQL.
- Every critical claim is traceable (evidence IDs, source refs, explicit timestamps: `event_time`/`observed_at`/`published_at`/`fetched_at`/`ingested_at`/`data_as_of`, with explicit currency and time zone).
- Product family / variant / SKU are distinct; external evidence links to an exact SKU only when supported, via a `ProductMatch` with method, confidence, matcher version, and review status.
- External text is untrusted data, never instructions.
- Hard business constraints are deterministic and override any model score; recommendation ≠ approval ≠ execution.
- Forecasts are not measured lift; missing/stale evidence must surface as `insufficient_data` / `review_required` / "internal data only".
- Keep confidence dimensions separate (entity match, data quality, retrieval, decision model).
- Recommendation vocabulary: `discount | bundle | advertise_only | hold`. Do not invent policy thresholds, percentages, KPIs, or market data — use clearly labeled synthetic data only.
- No unauthorized scraping; external sources must be licensed/authorized.
