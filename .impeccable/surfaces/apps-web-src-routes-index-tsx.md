---
version: 1
slug: "apps-web-src-routes-index-tsx"
primary_target: "apps/web/src/routes/index.tsx"
related_targets: ["apps/web/src/routes/dashboard.tsx"]
---

# Advisor Workspace — surface brief

Scope: two pages, as in the concept image's navigation: **Chat & Advisor** (`/`, routes/index.tsx) and the **Product dashboard** (`/dashboard`, routes/dashboard.tsx), split at the user's request on 11 Oct 2026. Mode: **Operate**. Code-led (no image generation in this session).
Audience/job: analyst prepares, manager decides (PRODUCT.md). Office desktop, daylight. Bilingual TH/EN, switchable.
Content: the north-star question (fixed, no LLM); computed status counts that double as filters; a shortlist of product cards with synthetic, size-true TV illustrations; a focus panel for the selected SKU (facts, rules, alternatives, evidence behind one-click tabs); an advisor panel with a composed, sourced summary and follow-up chips that perform real actions; a floating decision bar. Demo controls stay labeled as demo until DEC-008. All data synthetic and labeled.
Constraints: blueprint §6 invariants, §11.3 states, CI-1…CI-12. No invented KPIs, no score, no "High Potential", no discount %, no placeholder market signals: external signals show "not connected". "Internal data only", every SKU's status, redaction locks and the existence of insufficient and blocked SKUs are visible without a click (INV-09). Redaction stays server-side.
History: supersedes the "Market Page" direction (seed 6330389d, 10 Oct 2026) at the user's request on 11 Oct 2026: "too much text, too many boxes".
Unresolved: real navigation for the other surfaces (shown, disabled); auth/RBAC; persistence; real product imagery.

## Direction contract

THESIS: A calm, light workspace in Apple's Liquid Glass idiom. Translucent glass carries only the controls and navigation (sidebar, toolbar, advisor panel, decision bar) above solid content, so the product and its verdict lead and the evidence waits one click away. It refuses both the dense ledger table and the dark KPI-tile dashboard with fake numbers.
OWN-WORLD: A soft daylight wallpaper (cool white with faint blue and peach light fields). Frosted glass with a top specular edge and a hairline inner stroke, 22px radii. Content surfaces are solid white with a soft offset shadow. System-blue accent for selection and the primary action. iOS status hues (green, orange, red, indigo-gray) only for status. The system UI typeface with tabular figures; self-hosted Noto Sans Thai. No glass on glass.
STORY: The visitor reads the question and the advisor's one-sentence answer. They filter by status, pick a product card, see its verdict and three key facts, open rules, evidence or alternatives only when needed, and approve, reject or ask for more data from the floating bar.
FIRST VIEWPORT: Both pages share a floating glass sidebar (Chat, Dashboard, two disabled surfaces, data freshness at its foot) and a glass toolbar (search on the dashboard, window, language, demo menu). **Chat:** a centred conversation. The question is a blue bubble; the answer is a white bubble with the sentence, the ranking basis and ranked rows (TV thumbnail, SKU, action, cover). Each row opens the dashboard on that SKU. A glass composer at the foot offers preset follow-up chips (no free text until an LLM exists). **Dashboard:** title and meta, computed status filters, a horizontal rail of product cards, the focus panel of the selected SKU (big size-true TV, verdict, key facts, tabs) and a floating glass decision bar.
FORM: User-pinned direction (concept image layout + Apple Liquid Glass, light theme, synthetic TV illustrations), no seed roll. Signature move: Liquid Glass control layer floating over solid content, with the product illustration sized to its real screen size.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
