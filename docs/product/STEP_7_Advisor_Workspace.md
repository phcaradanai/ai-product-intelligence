# STEP 7 — Advisor Workspace (UI)

**Project:** AI Product Intelligence Advisor  
**Date:** 10 October 2026  
**Status:** **IMPLEMENTED AND VERIFIED ON SYNTHETIC DATA.** Finish review: three rounds; the last disposition was `fix`, its 7 items were applied in one batch and recaptured, and no further review was run (see §6 and `REVIEW_STEP_0-7.md`).  
**Assumption:** The user asked to "continue with STEP 7" without choosing between the two candidates offered. STEP 7 is taken to be the Advisor Workspace UI (blueprint §11.1, PRODUCT.md), which was option 1, as in the previous steps. The user then confirmed the scope (one Workspace page), the scene (office desktop, daylight) and the visual direction ("Market Page") through the design flow.  
**Basis:** `STEP_0_Product_Blueprint.md` §5.2, §6, §11 (11.1–11.5, CI-1…CI-12), §15.2; `PRODUCT.md`; STEP 2–6 records; surface brief `.impeccable/surfaces/apps-web-src-routes-index-tsx.md` (direction contract, seed 6330389d)  
**Prompt standard:** Context → Goal → Constraints → Output → Verify

## 1. Context

STEP 2–6 implement the advisor slice (§5.1 steps 1–10) as pure TypeScript packages over synthetic data. There is no user interface yet. Blueprint §11.1 describes a three-zone workspace: navigator, conversation and analyst workspace, and evidence and quality.

## 2. Goal

A TanStack Start + React web app (`apps/web`) with one working route, the Advisor Workspace. It shows:

- the north-star question;
- the shortlist grouped by action;
- every SKU without an action, with its status, reasons and next steps;
- a SKU sheet with facts and their provenance, rule results, alternatives and the confidence dimensions;
- approve, reject and request-more-data actions recorded through `recordDecision()`.

The UI is bilingual Thai/English and switchable. It runs on the synthetic STEP 2 sample with the synthetic policies.

## 3. Constraints

- **Server boundary (§11.4, §15.2).** The pipeline (import, evaluate, rank, recommend, `redactForViewer`) runs only inside server functions. Only the redacted `RecommendationSet` reaches the browser, and client code imports types only. After a production build, the client bundle is checked for confidential sample values.
- **Decisions.** The browser sends only `{ recommendationId, decision, rationale }` plus the demo permission. The server rebuilds the full set deterministically, finds the recommendation by id, stamps `decidedAt` from its own clock and calls `recordDecision()`. The browser never supplies `decidedAt` or the recommendation body.
- **Demo controls.** Viewer clearance and approval permission are demo selectors, clearly labeled as such while DEC-008 is open. The server applies them.
- **Rendering from the model.**
  - Every figure comes from a `FactView`. Footnote marks are generated from `sources` (same reference, same mark).
  - `redacted`, `no_data` and `insufficient_data` are visibly different states, each with text.
  - When ranks are withheld, no row numbers are shown.
  - Group counts are computed, never hard-coded.
- **Exhaustive i18n.** Every reason, next-step, status and action code has a `{ th, en }` entry. A missing entry fails the typecheck. Product, model and brand names are never translated. Numbers and money are formatted with `Intl` per locale.
- **Out of scope:**
  - an LLM (the question is fixed);
  - the other surfaces (Product Explorer, Data Health, Decision History), which are shown in the navigation but disabled;
  - real authentication and RBAC;
  - persistence (the decision log is in memory and resets on restart);
  - Fastify.
- **Design:** the Market Page direction contract (surface brief) and the craft floor.

## 4. Decisions (proposed)

| ID | Decision | Rationale |
|---|---|---|
| S7-DEC-01 | TanStack Start server functions instead of a separate Fastify API | Smallest server boundary for one route. ADR-002 (TanStack Start + Fastify) stays open |
| S7-DEC-02 | Single root package (no npm workspaces); the app lives in `apps/web` with its own Vite config and imports `packages/*` by relative path | Keeps the existing scripts and lockfile; workspaces can come with M0 |
| S7-DEC-03 | The question is fixed to the north-star question; the window is September 2026 of the sample; `objective` is null (`objective_unspecified`) | No LLM or intent parsing exists yet; never infer an objective |
| S7-DEC-04 | Demo viewer clearance (`internal` / `confidential`) and demo approval permission are URL-state selectors, labeled "demo" | DEC-008 is open; never default to full access, so the default is `internal` with approval off |
| S7-DEC-05 | The decision log is in memory on the server and resets on restart; the UI says so | ADR-003 (persistence) is open |
| S7-DEC-06 | Fonts are self-hosted through Fontsource (Anuphan, Sarabun) | No third-party font host at runtime |
| S7-DEC-07 | `generatedAt` is the fixed sample evaluation time, not the server start time | Content-hash ids stay stable across reloads and restarts. A dev-server reload changed the ids and refused a decision with `unknown_recommendation`; this fixed it |
| S7-DEC-08 | ≤ 1440 px uses a 64 px icon rail (labels kept for screen readers and tooltips); labels show above 1440 px. Disabled surfaces are dimmed | Keeps the three work areas, including the decision foot, in the first viewport at 1280–1440. This deviates from the contract's "icon + label" rail at exactly 1440 |
| S7-DEC-10 | Demo `scenario` selector: `sample` (STEP 2 fixtures) or `edge` (`tests/fixtures/edge/`), chosen on the server | The sample never produces a non-recommended SKU; the edge set makes every §11.3 status and fact state reachable and testable |
| S7-DEC-11 | Fact cells and unknown rule outcomes are coloured by the reason class used for the SKU status (`packages/recommendation/src/classes.ts`). Conflicting data has its own word | One status ramp, and colour is never the only cue (WCAG 1.4.1) |
| S7-DEC-09 | A metric column that is fully redacted says "Redacted" once in its header; its cells show a lock icon with an accessible label | "Nothing labeled twice"; the listing fits at 1440 |

## 5. Output files

| File | Responsibility |
|---|---|
| `apps/web/vite.config.ts`, `apps/web/tsconfig.json` | Vite + TanStack Start plugin (port 3017), strict TS for the app |
| `apps/web/src/router.tsx`, `apps/web/src/routeTree.gen.ts` | Router factory; generated route tree (regenerated by dev/build) |
| `apps/web/src/routes/__root.tsx` | Document shell, `lang` attribute from the URL, self-hosted fonts, not-found view |
| `apps/web/src/routes/index.tsx` | The Workspace route: validated URL state (`lang`, `clearance` default `internal`, `approve` default false, `sku`), loader calls the server function |
| `apps/web/src/server/pipeline.ts` | Server-only, Node-testable pipeline: `buildFullSet()`, `workspaceView()` (redacts server-side), `decide()` (lookup by id, typed refusals) |
| `apps/web/src/server/sample.ts` | Synthetic sample inputs bundled into the server with Vite raw imports |
| `apps/web/src/server/functions.ts` | `getWorkspace` and `submitDecision` server functions (Zod validated); the in-memory decision log |
| `apps/web/src/i18n.ts` | Exhaustive Thai/English tables over every action, status, reason, next-step, metric and refusal code; `Intl` formatters (Gregorian calendar, Bangkok time) |
| `apps/web/src/ui/Workspace.tsx` | Rail, header and demo controls, grouped listing, footnote marks and source strip, SKU sheet, decision form |
| `apps/web/src/styles.css` | The Market Page world: tokens, one status ramp, breakpoints 1440 / 1100 / 760, reduced motion |
| `tests/web.test.ts` | 5 tests: no confidential number in the internal view, values and computed counts in the confidential view, stable ids, typed decision refusals, current decisions |
| `scripts/check-client-bundle.ts` | `npm run check:web-bundle`: refuses a client bundle containing cost values, cost-file text or server-only APIs |
| `.claude/launch.json` | `advisor-web` dev server for the in-app browser |
| `DESIGN.md`, `.impeccable/design.json` | Visual system documented from the built world (impeccable documenter) |
| `.impeccable/surfaces/apps-web-src-routes-index-tsx.md` | Surface brief with the direction contract (seed 6330389d) |

## 6. Verify — observed results

Environment: Node 22.23.1, React 19.3.0, @tanstack/react-start 1.168.61, Vite 8.3.4, zod 4.6.5, typescript 5.9.3 (`package-lock.json`). Run on 10 October 2026, after `rm -rf node_modules apps/web/dist && npm ci`.

| Check | Command | Result |
|---|---|---|
| Typechecks | `typecheck`, `typecheck:domain`, `typecheck:web` | **PASS** (exit 0 each) |
| All tests | `npm test` | **PASS**: 149/149 (domain 19, contracts 12, ingestion 34, metrics 18, rules 20, ranking 20, recommendation 21, web 5) |
| Samples | `import:sample`, `metrics:sample`, `rules:sample`, `ranking:sample`, `recommend:sample` | **PASS** (exit 0 each) |
| Production build | `npm run build:web` | **PASS** (exit 0) |
| Server boundary | `npm run check:web-bundle` | **PASS**: no cost values, cost-file text or server-only APIs in the client bundle. The same strings are present in the server bundle, so the check can fire |
| Design detector | `impeccable detect --json apps/web/src` | `[]`. The first run flagged a 3px side border on the sheet, which was changed to a 1px rule |
| In-app run | dev server via `.claude/launch.json` | Thai and English, both clearances, and approve recorded end-to-end. A refusal message was shown and diagnosed (S7-DEC-07). No horizontal overflow at 375 px (`scrollWidth` 375) |

**Finish review.** The shipped reviewer agent type is not available in this harness. Substitute: a fresh general-purpose subagent with no shared history, running the skill's `degraded/finish-reviewer.md` brief.

- **Round 1, `fix`, 8 items:**
  - decision buttons off-screen (grid-row bug);
  - sheet missing at the user's 1280 width;
  - listing clipped in English at internal clearance;
  - two box-shadow side stripes;
  - a glyph used as an icon;
  - one-way footnote highlight;
  - mobile TH/EN control;
  - Thai copy containing "action".

  All 8 were fixed in one batch.
- **Round 2 (verdict pass), `fix`:**
  - all 8 resolved; two of them (glyph, footnote highlight) are confirmed in source only;
  - three regressions found: disabled nav looked live in the icon rail; the sticky decision block cut a half line; the mobile header band was tall.

  All three were fixed afterwards (dimmed disabled icons, fade above the decision block, single-line mobile headers) and recaptured. **They were not re-reviewed**, because the two-round budget was spent.

Screenshots: `.impeccable/review/` (desktop 1440, 1600, 1280; internal English; tall; mobile first viewport and sheet).

### Review round 3 (11 October 2026, after `REVIEW_STEP_0-7.md`)

**Before this round:**
- Edge scenario added.
- Code aligned to DESIGN.md:
  - Thai line-height floor 1.35;
  - footnote marks moved off the status amber;
  - reason-class colours for fact cells;
  - colours turned into tokens;
  - ramp font size.
- Detector `[]`, with one narrow ignore: `#000` in a mask gradient.

**Fresh reviewer, disposition `fix`, 7 items:**

1. one word in two colours (conflicting vs missing data);
2. unknown rule outcome not coloured by reason class;
3. the sticky decision fade still sliced glyphs;
4. the source strip is off-screen when a mark lights;
5. blocked SKUs framed as "missing data", without the failing rule;
6. mobile demo controls take half the first viewport, and stray column ticks between groups;
7. the mobile scroll mask never clears.

**Applied in one batch:**

1. a "Conflicting data" word;
2. a `u-insufficient` class;
3. an opaque gradient above the decision block;
4. a mark tooltip with its source;
5. a "Why it is blocked" block, with failing rule names in the sheet and the listing;
6. a `<details>` for the demo controls on phones, and spacer rows;
7. an `at-end` mask removal.

Recaptured: desktop, edge, mobile. Detector `[]`. Checked in the browser: tooltip text, mask removal, demo collapsed on phones, no overflow at 375 px.

**Not re-reviewed:** stopping here is deliberate, to avoid an open-ended review loop. The user decides whether to fund another round.

