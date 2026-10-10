# AI Product Intelligence Advisor

**Progress:** The user declared STEP 0 (blueprint) and STEP 1 (data domain foundation) complete on 10 Oct 2026. STEP 2–6 (import, metrics, policy rules, ranking, recommendations and decisions) are implemented as packages. **STEP 7 (Advisor Workspace UI, `apps/web`)** runs the whole slice on synthetic data. Owner policies and definition reviews are pending. Not production approved.  
**Product blueprint:** [`docs/product/STEP_0_Product_Blueprint.md`](docs/product/STEP_0_Product_Blueprint.md) · **STEP records:** [STEP 1](docs/product/STEP_1_Data_Domain_Foundation.md) · [STEP 2](docs/product/STEP_2_Internal_CSV_Import.md) · [STEP 3](docs/product/STEP_3_Metric_Definitions.md) · [STEP 4](docs/product/STEP_4_Business_Rules.md) · [STEP 5](docs/product/STEP_5_Opportunity_Ranking.md) · [STEP 6](docs/product/STEP_6_Recommendation_and_Decision.md) · [STEP 7](docs/product/STEP_7_Advisor_Workspace.md) · [DESIGN.md](DESIGN.md)  
**Basis:** `STEP_0_Product_Blueprint.md` §8, §15, §16.1, §20, architecture v0.2 and `THE-PERFECT-PROMPT-PATTERN.txt`.  
**Scope:** Domain types, Zod boundary schemas, labeled synthetic fixtures, structural integrity checks, tests and documentation **only**.

The package layout (`packages/domain`, `packages/contracts`) follows the proposed monorepo layout in `docs/research/research-draft_v2.md` §7. The original candidate is preserved unchanged, locally only, in `alternative/ai-product-intelligence-step1/` (git-ignored).

## Included entities

- Product identity: `Brand`, `Category`, `ProductFamily`, `ProductVariant`, `SKU`, `ProductAlias`
- Facts: `SalesFact`, `InventorySnapshot`, `CostFact`, `PriceObservation`
- Provenance: `DataSource`, `SourceReference`
- Product linking: `ProductMatch` with `family | variant | sku` resolution, explicit review status, score provenance and temporal validity
- `DomainDataset`, `checkDatasetIntegrity()`, `acceptedTarget()` and `publishedWithin()`

## Layout

```text
packages/
  domain/src/
    models.ts         # Pure TypeScript interfaces; no runtime dependency
    integrity.ts      # Cross-record structural, rights and sensitivity checks
    evidence.ts       # publishedWithin(): publication-time window for evidence
    index.ts
  ingestion/src/
    csv.ts            # RFC 4180 parser with physical line tracking
    values.ts         # money/time/count cell parsers (no rounding, no guessing)
    import.ts         # importCsv(): gated, idempotent, lineage-preserving import
    quality.ts        # buildQualityReport(): counts, issues, coverage gaps
  recommendation/src/
    build.ts          # buildRecommendations(): §5.2 response per SKU + shortlist
    redact.ts         # redactForViewer(): explicit clearance, no default
    decision.ts       # recordDecision(): append-only decision log
  ranking/src/
    policy.ts         # owner ranking policy: ordered criteria + direction, no weights
    rank.ts           # rankCandidates(): lexicographic order of eligible candidates, notRanked with reasons
  rules/src/
    policy.ts         # owner policy types, action vocabulary
    evaluate.ts       # evaluateCandidates(): pass/fail/unknown per rule → eligible/blocked/review_required
  metrics/src/
    definitions.ts    # METRIC_DEFINITIONS registry (v1, proposed)
    compute.ts        # pure per-SKU/window metric functions → MetricResult
  contracts/src/
    schemas.ts        # Zod v4 runtime schemas and parseDomainDataset()
    index.ts
tests/
  fixtures/synthetic.ts  # SYNTHETIC ONLY. Never real business facts.
  domain.test.ts
  contracts.test.ts
docs/product/
  STEP_0_Product_Blueprint.md
  STEP_1_Data_Domain_Foundation.md
package.json
package-lock.json
README.md
```

## Run locally

Requires Node 22+ (for native TypeScript stripping), npm, TypeScript and Zod 4.

```bash
npm ci
npm run typecheck
npm test
npm run import:sample   # import synthetic CSVs, print data-quality report
npm run metrics:sample  # import sample CSVs, print v1 metrics per SKU (Sep 2026)
npm run rules:sample    # evaluate sample SKUs × actions: no policy vs SYNTHETIC policy
npm run ranking:sample  # rank eligible sample candidates: no ranking policy vs SYNTHETIC one
npm run recommend:sample # end-to-end: recommend, two clearance views, one synthetic decision
npm run dev:web          # Advisor Workspace at http://localhost:3017 (synthetic data)
npm run build:web && npm run check:web-bundle   # production build + client-bundle leak check
```

Import the catalog before fact files; facts resolve `merchant_sku` against it. File formats and import rules are in [STEP 2 §3–5](docs/product/STEP_2_Internal_CSV_Import.md).

Run a single test by name:

```bash
node --experimental-strip-types --test --test-name-pattern="stale|old article" tests/domain.test.ts
```

In an offline environment without Zod, the framework-independent checks can still run if `tsc` is available globally:

```bash
npm run typecheck:domain
npm run test:domain
```

Dependencies are pinned in `package-lock.json`. Do not claim the Zod tests pass without having run `npm test` after `npm ci`.

## Safety and scope notes

- Monetary figures use integer *minor currency units* (e.g. Thai satang); currencies are explicit. These are structural examples, **not approved business metric formulas**.
- Timestamps have required timezone offsets. Event/effective/observed times are separate from ingestion time.
- `ProductMatch.reviewStatus` must be `matched` before `acceptedTarget` returns a link. A `pending_review` SKU candidate is **never** accepted. Family-level matching is **not** SKU matching.
- For non-exact-identifier accepted matches, human reviewer metadata is required. Exact-identifier matches are only a **proposed structural rule**, not permission for automatic production linking.
- A source record with `rightsStatus: "unverified"` is stored for synthetic demonstration, **not authorized for real ingestion or AI responses**. `checkDatasetIntegrity()` rejects accepted matches that rely on non-authorized sources and cost facts from non-confidential sources — a structural data guard, **not RBAC**; user-level access control comes with approved policies (DEC-008).
- No database, AI provider, retrieval/indexing, API, UI, live market collector, RBAC or finance/recommendation policy is included.

See `docs/STEP_1_Data_Domain_Foundation.md` for acceptance evidence and proposed decisions.
