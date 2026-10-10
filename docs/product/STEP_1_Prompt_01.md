# STEP 1 / PROMPT 01 — Data Domain Foundation

> **Status:** **SUPERSEDED.** STEP 1 was implemented from blueprint §16.1 directly; the authoritative record is [`STEP_1_Data_Domain_Foundation.md`](STEP_1_Data_Domain_Foundation.md). Where this prompt differs (Vitest, Zod inside `packages/domain`, fixtures under `packages/domain/fixtures/`, per-record cost classification, fixture sizes), the implementation and its S1-DEC decisions win. Kept for history only.  
> **Source:** `STEP_0_Product_Blueprint.md` (Blueprint v0.2) §8, §14, §16.1, §20.  
> **Attach:** `docs/concept/AI Product Intelligence Dashboard.png` as look-and-feel reference only. It carries no data or requirements (blueprint §11.5).

---

## Context

I am building **AI Product Intelligence Advisor**, an evidence-first product and promotion decision-intelligence platform for a single organization. The pilot is Thai-first and uses a proposed TV/electronics category. The governing document is `docs/product/STEP_0_Product_Blueprint.md` (Blueprint v0.2, DRAFT). Read §6 (invariants), §8 (ontology, time metadata, ProductMatch) and §16.1 before writing code. The attached image shows the eventual UI direction. Ignore it for this task except as context. The repository currently holds only documentation. Inspect it first and report what you find.

## Goal

Design **only the data domain layer**. Use framework-independent TypeScript domain types with Zod runtime schemas for:

Brand, Category, ProductFamily, ProductVariant, SKU, ProductAlias, SalesFact, InventorySnapshot, CostFact, PriceObservation, DataSource, SourceReference, ProductMatch.

Model the relationships Brand/Category → ProductFamily → ProductVariant → SKU, with facts attached to SKU. An external entity resolves through ProductMatch to a family, a variant or (only when supported) a SKU.

## Constraints

- TypeScript (strict) + Zod, tested with Vitest. No UI, LLM orchestration, RAG, database migrations, ORM, HTTP server, or vendor integration.
- Keep family, variant and SKU as distinct types (INV-03). `ProductMatch` must carry `external_entity_id`, `canonical_product_id`, an optional `sku_id`, `match_method` (`exact_id | alias | probabilistic | semantic | manual`), `match_confidence`, `matcher_version`, `review_status` (`matched | pending_review | rejected | unresolved`), `supporting_evidence_ids[]`, and `valid_from` / `valid_to`.
- Every fact carries source lineage (`SourceReference`) and only the timestamps that apply to it: `event_time`/`effective_at`, `observed_at`, `published_at`, `fetched_at`, `ingested_at`. Timestamps are ISO-8601 with an explicit offset.
- Money is never a bare number. Store an amount plus an ISO-4217 currency, with no implicit currency conversion. Store amounts as integer minor units (e.g. satang for THB) and never use floating-point arithmetic.
- `CostFact` is a sensitive class, so mark it with a data-classification field (INV-08).
- `DataSource` includes rights metadata: access permission, coverage, permitted storage/excerpts, attribution, retention, and refresh cadence (§10).
- Do not invent business policy values, margins, thresholds or KPIs. Seed data must be clearly synthetic, with fictional brands and models and names prefixed `SYN-` or similar. Include Thai and English aliases.
- Put code under `packages/domain/` per the proposed layout in `docs/research/research-draft_v2.md` §7. Keep dependencies minimal.

## Output

- `packages/domain/src/` contains one module per entity group (catalog, identity/matching, facts, sources), plus an index.
- Each entity has both a Zod schema and an inferred type.
- `packages/domain/fixtures/` holds a synthetic dataset: 2 brands, 1 TV category, 3 families, 6 variants (size/year differences), 10 SKUs, aliases in Thai and English, 90 days of sales facts, inventory snapshots, cost and price observations, 2 data sources, and ProductMatch examples covering each `review_status`.
- Tests cover:
  - all fixtures validate;
  - an invalid currency, missing source, or missing offset is rejected;
  - a ProductMatch can never claim `sku_id` with `review_status = unresolved`;
  - same-family variants of different sizes are distinct entities;
  - a cost record without classification is rejected.
- A minimal `package.json`/`tsconfig` with `typecheck` and `test` scripts.
- Explain the model in five lines and list any deviation from blueprint §8.

## Verify

Run the type check and the tests, then paste the real command output. Confirm that no file outside `packages/domain/` (plus root workspace config, if needed) was created. List the limitations, any assumptions you made, and the next dependency (STEP 2 candidates: metric definitions or import validation). Do not claim anything you did not run.
