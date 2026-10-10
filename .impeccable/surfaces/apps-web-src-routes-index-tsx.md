---
version: 1
slug: "apps-web-src-routes-index-tsx"
primary_target: "apps/web/src/routes/index.tsx"
related_targets: []
---

# Advisor Workspace — surface brief

Scope: the Advisor Workspace route (blueprint §11.1), STEP 7. Mode: **Operate**. Code-led (no image generation in this session).
Audience/job: analyst prepares, manager decides (PRODUCT.md). Office desktop, daylight. Bilingual TH/EN, switchable.
Content: the north-star question (fixed, no LLM yet); shortlist grouped by action; SKU sheet with facts, rule results, alternatives, confidence dimensions, provenance; approve / reject / request more data; demo viewer clearance and demo approval permission, clearly labeled until DEC-008. All data synthetic and labeled.
Constraints: blueprint §6 invariants, §11.3 states, CI-1…CI-12; no score, no "top/potential", no invented values; redaction applied server-side before data reaches the browser.
Unresolved: real navigation for the other surfaces (shown, disabled); real auth and RBAC; persistence.

## Direction contract

THESIS: The shortlist read like a Thai business-daily market listing: dense tabular figures grouped under reverse sector bars, every figure carrying a footnote mark to its source and as-of time. It refuses the dark KPI-card dashboard with a chat sidebar.
OWN-WORLD: Cool newsprint-gray ground (#F1F1EE), ink #141414, a solid slate (#1D2B36) rail and sector bars as committed region fields, market green / red / amber only for status. Anuphan for figures and headings, set with tabular numerals; Sarabun for body text. No card shells: hierarchy comes from type-scale contrast and rules.
STORY: The visitor reads the question, sees which SKUs are recommended for which action and why, sees what is blocked or unknown, checks the provenance of any figure, and records a decision.
FIRST VIEWPORT: Left: a slate rail with standard nav (icon + label). Top: the question as the H1 with its window, evaluation time, evidence basis and viewer controls. Center: the listing table, grouped by action under slate bars that show "n of m pass" and the sort criteria, with rank, SKU, status, figures with footnote marks and rule count. Right: the selected SKU sheet with the primary decision buttons at its foot. The footnote strip sits under the table.
FORM: Market Page, candidate 6 of 7 on my ordered list (assigned by the roll). Seed key 6330389d. Signature move: a footnote mark on every figure, linked to the source strip and highlighted together on hover or focus. Raises: group capacity counts, nothing labeled twice, one fixed status ramp, region-scale colour, hierarchy by scale contrast.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
