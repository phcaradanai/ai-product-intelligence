# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

TanStack Start + React (confirmed by the user, 10 Oct 2026; matches blueprint §13.1 and ADR-002, which remains formally "Proposed"). The UI reuses the existing TypeScript packages directly: `packages/domain`, `packages/contracts` (Zod 4) and `packages/ingestion`. The API layer is proposed as Fastify + Zod and is not yet built. The database (ADR-003) is undecided.

## Users

The first surface, the Advisor Workspace, serves **two roles in one workflow** (confirmed):

- **Business / Commercial Analyst — prepares.** Checks the numbers and evidence behind a candidate. Needs reproducible metrics, source links, filters and as-of times, then hands a recommendation forward.
- **Category / Merchandising Manager — decides.** Chooses which SKU to act on and which tactic to use, then approves, rejects or asks for more data. Needs a ranked shortlist, margin and stock guardrails, alternatives and risks.

Later surfaces add other roles from the blueprint (§2), but these are not yet validated: Data Steward / Product Ops (Match Review, Data Health) and Business Approver / Admin (audit). Real users, organization and team are not identified yet (DEC-002).

## Product Purpose

AI Product Intelligence Advisor is an evidence-first product and promotion decision-intelligence platform. It combines trusted internal facts (catalog, sales, stock, cost, price) with permitted external market evidence. From these it produces explainable, auditable and measurable recommendations.

The north-star question is: "ทีวีรุ่นไหนในสต็อกที่ควรทำโปรโมชั่นในเดือนนี้ และควรใช้โปรโมชั่นแบบใด?" (Which in-stock TVs should we promote this month, and with what promotion type?)

The answer is a policy-compliant shortlist. Each candidate shows one action from `discount | bundle | advertise_only | hold` and one status from `recommended | insufficient_data | review_required`. The system succeeds when users make better decisions that trace back to evidence and can be measured against real outcomes. A fluent answer alone is not success.

## Positioning

Generic BI dashboards show numbers, and generic chatbots describe documents. This product owns the canonical product identity (family → variant → SKU), and every recommendation is tied to that exact identity. Provenance, freshness and uncertainty are part of the data contract, not decorative citations. Hard business rules are deterministic and always override model scores. The loop closes with a human decision and a measured outcome:

`Product Identity → Trusted Data → Market Signals → Business Analysis → Recommendation → Human Decision → Outcome Measurement`

## Operating Context

- **Workflow:** ask a question → resolve the products → check facts and evidence → review constraints → compare alternatives → approve, reject or request more data → review the outcome later.
- **Users never need a second chat prompt** to inspect SKU records, calculation periods, evidence links, alternatives or limitations (blueprint §11.1).
- **Surfaces (blueprint §11.2):** Advisor Workspace, Product Explorer, Data Health / Match Review, Decision History. Navigation is undecided.
- **Data arrives** as authorized internal CSV exports (STEP 2 importer) and later from approved ERP/POS connections and licensed market feeds.
- **Pilot hypothesis:** a single organization, Thailand, TVs and consumer electronics. All three are still proposed (DEC-001, DEC-002, DEC-011).

## Capabilities and Constraints

- **Built (synthetic data only):**
  - domain model and Zod contracts (STEP 1);
  - in-memory CSV import (STEP 2);
  - versioned metrics (STEP 3);
  - owner-policy rules (STEP 4);
  - rule-based ranking (STEP 5);
  - recommendations, redaction and decision log (STEP 6);
  - the Advisor Workspace web app (STEP 7).
- **Not built:**
  - retrieval and external evidence;
  - LLM orchestration;
  - authentication and RBAC;
  - database and persistence;
  - the other three surfaces.
- **Invariants (blueprint §6), binding on every surface:**
  - The LLM is never the source of truth for money, stock or sales.
  - Every critical claim is traceable.
  - Family, variant and SKU are never conflated.
  - External text is untrusted data.
  - Recommendation ≠ approval ≠ execution.
  - A forecast is not measured lift.
  - Missing or stale evidence is shown, never hidden.
  - Confidence dimensions stay separate: entity match, data quality, retrieval, decision model. A score or rank is never shown as a success probability.
- **Permissions:** cost and margin are visible, and approve actions available, only with permission. Authorization happens before the API responds (DEC-008 is open).
- **States every answer surface must express:** ready, limited evidence (internal data only or stale), review required, insufficient data, blocked by a rule or permission, decision pending or completed (blueprint §11.3).
- **Terminology:**
  - SKU, ProductFamily, ProductVariant, ProductMatch (`matched | pending_review | rejected | unresolved`);
  - as-of / `published_at` / `fetched_at` / `ingested_at`;
  - knowledge classes: observed fact, deterministic metric, market signal, AI inference, proposed action, actual outcome.
- **Undecided:** pilot category and organization, metric definitions, policy values (margin floor, stock, budget), market-data rights, pilot KPI, freshness SLAs, RBAC model (DEC-001 to DEC-016).

## Brand Commitments

- **Product name:** "AI Product Intelligence Advisor" (the repository is named `oracle-advisor`). No logo, voice guide or brand assets exist.
- **Bilingual UI (confirmed):** Thai and English, switchable, with both supported from the start. Product names, SKU codes and model codes stay as recorded. Thai business questions and Thai/English product aliases must both work.

## Evidence on Hand

- **Product truth:** `docs/product/STEP_0_Product_Blueprint.md` (charter, invariants, ontology, UX states, evaluation gates, decision register); `docs/research/` (architecture drafts v0.1/v0.2, competitive and deep research, snapshots from 9 Oct 2026).
- **Data:** synthetic only. Fictional `SYN-` brands and products are in `tests/fixtures/synthetic.ts` and `tests/fixtures/csv/`.
- **Concept image:** `docs/concept/AI Product Intelligence Dashboard.png`. It is an illustrative look-and-feel reference only. Its numbers, score, discount percentage, brands and competitors are placeholders that conflict with the invariants (blueprint §11.5, CI-1 to CI-12) and must not be reproduced as content.
- **Absent, never to be fabricated:** real customers, KPIs, sales or margin figures, competitor prices, market sentiment, vendor data, testimonials, case studies, user research, measured promotion outcomes.

## Product Principles

1. **Evidence before eloquence.** A claim without traceable backing is blocked or labeled, however fluent it reads.
2. **Facts, inferences, recommendations and outcomes look different.** Users can tell them apart at a glance.
3. **Honest uncertainty is a feature.** `insufficient_data`, `review_required` and "internal data only" are first-class answers, not error states.
4. **Humans decide; the system prepares.** Analysts assemble, managers approve, and nothing executes on its own.
5. **Exact identity or explicit ambiguity.** Never imply SKU-level precision the evidence does not support.

## Accessibility & Inclusion

- Keyboard navigation, readable contrast and narrow-screen behavior are part of review. Target breakpoints and a formal standard are not set yet (blueprint §11.4).
- Thai and English text must both render and wrap correctly, including long Thai product aliases.
