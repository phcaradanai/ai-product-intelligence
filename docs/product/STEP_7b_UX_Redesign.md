# STEP 7b — UX/UI Redesign: Liquid Glass, Separate Chat and Dashboard

**Project:** AI Product Intelligence Advisor  
**Date:** 11 October 2026  
**Status:** **DONE on synthetic data** (finish review: 1 fix round applied; awaiting user acceptance)  
**Trigger:** the user asked for a UX/UI redesign before STEP 8:

- the previous "Market Page" UI had **too much text and too many boxes**;
- look back at the concept image (`docs/concept/`) and use current, widely used UX such as **Apple's Liquid Glass**;
- the visual should make people want to use it;
- mid-build follow-up: **separate the dashboard page and the AI chat page**, as in the concept image's navigation.

**Confirmed answers:**
- light theme in a macOS/iPadOS style;
- the concept image's layout with less text;
- synthetic TV illustrations.

**Basis:** blueprint §6, §11 (CI-1…CI-12); `PRODUCT.md`; STEP 7 record; surface brief `.impeccable/surfaces/apps-web-src-routes-index-tsx.md` (new direction contract; supersedes "Market Page", seed 6330389d).

## 1. What changed

| Area | Before (Market Page) | Now |
|---|---|---|
| Visual world | Newsprint-gray ground, slate bars, dense ledger table, footnote marks on every figure | Light daylight wallpaper. Liquid Glass sidebar, toolbar, chat composer and decision bar float over solid white content. iOS status hues |
| Pages | One page | **Chat & Advisor** (`/`) and **Product dashboard** (`/dashboard`), linked from the sidebar |
| Text density | Every figure and rule visible at once | Progressive disclosure: verdict and 4 key facts first. Rules, alternatives and evidence sit behind one click (tabs). Provenance marks appear only in the Overview figure table |
| Shortlist | Table rows grouped under bars | Product cards with a size-true TV illustration, status chip, action or specific reason, and 2 figures |
| Chat | None (fixed question header) | A conversation. The answer bubble lists the ranked SKUs and a clickable status breakdown. Preset follow-up chips answer from the structured data. There is no free-text input, because no LLM exists |
| Data freshness | Footnote strip | Sidebar foot (≥ 1360 px) and a "which sources" chat answer. External sources are shown as "not connected" |

## 2. Decisions (proposed)

| ID | Decision | Rationale |
|---|---|---|
| S7b-DEC-01 | Glass only on the control/navigation layer (sidebar, toolbar, composer, decision bar). Content stays on solid surfaces. Popovers are solid (no glass on glass). Solid fallbacks: `@supports not (backdrop-filter)` and `prefers-reduced-transparency` | Apple's Liquid Glass guidance; legibility |
| S7b-DEC-02 | No SVG refraction (displacement filter) | Chromium-only, pixelates, and costs scroll performance. The frost, specular top edge and inner stroke carry the material |
| S7b-DEC-03 | Status counts are the only "KPI" figures, and they double as filters | CI-1: no invented KPIs, no score |
| S7b-DEC-04 | The chat has no free-text box. Follow-ups are preset intents (needs review / missing data / blocked / sources) whose answers come from the redacted recommendation set | No LLM yet. Never imply generated answers |
| S7b-DEC-05 | TV illustrations are plain SVG geometry scaled from `screenSizeInches` (16:9). They are decorative in cards and rows, and labeled as synthetic on the focus panel | There are no product images. Never look like a photo |
| S7b-DEC-06 | Typeface: system UI stack (SF on Apple platforms) with self-hosted Noto Sans Thai (variable). Anuphan and Sarabun are removed | macOS/iPadOS feel; consistent Thai on every OS |
| S7b-DEC-07 | "Internal data only", status chips, redaction locks and the existence of review/insufficient/blocked SKUs stay visible without a click: as filters with counts on the dashboard, and as a status breakdown in the chat | INV-09 |

## 3. Output files

| File | Responsibility |
|---|---|
| `apps/web/src/search.ts` | Shared URL search schema |
| `apps/web/src/ui/model.ts` | Shared reading order, status counts, sources used |
| `apps/web/src/ui/Shell.tsx` | Glass sidebar (pages, data freshness), glass toolbar (search, window, language, demo menu) |
| `apps/web/src/ui/Chat.tsx` | Chat page: conversation, answer composition, follow-up chips, rows linking to the dashboard |
| `apps/web/src/ui/Dashboard.tsx` | Dashboard: filters, product cards, focus panel with tabs, floating decision bar |
| `apps/web/src/ui/parts.tsx` | Status chip, fact value and states, provenance marks, rule labels, TV illustration |
| `apps/web/src/routes/index.tsx`, `routes/dashboard.tsx` | The two routes |
| `apps/web/src/styles.css` | The Liquid Glass world |
| `apps/web/src/ui/Workspace.tsx` | Removed (split into the files above) |

Server, packages, tests and i18n structure are unchanged; i18n gained new keys.

## 4. Verify

Commands run on 11 Oct 2026 after the fix batch:

| Check | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run typecheck:web` | exit 0 |
| `npm test` | 151 pass, 0 fail |
| `npm run build:web` | exit 0 |
| `npm run check:web-bundle` | OK: no confidential value or server-only code in the client bundle |
| Mobile 375 px (in-app browser), both pages | no horizontal page scroll; card values not clipped |
| `impeccable detect --json apps/web/src` | 38 findings → 9 after the DESIGN.md rewrite. All 9 are minor design-system drift in `styles.css`: wallpaper gradient rgba, the reduced-transparency solid `#f6f7f9`, and small radii (4–7 px, chat bubble tail) outside the documented scale |

**Finish review (fresh reviewer), disposition `fix`; one batch applied:**
1. Withheld rank shows a lock on dashboard cards (as in chat).
2. Chat answer separates "to promote" from "to hold" (hold is not counted as a promotion).
3. Dashboard shows the ranking basis ("Ordered by …").
4. Disabled Approve/Reject show a one-line reason (approval off in demo controls / only a recommended SKU can be approved); visible on mobile too.
5. Card fact values wrap instead of clipping (EN).
6. Card illustration box has a fixed height; TVs are bottom-aligned.
7. `--text-3` darkened to `#5d5d63`; disabled zero-count filters raised to 0.7 opacity.
8. Scroll-edge fades under the floating decision bar and toolbar.

Also taken from the reviewer's optional list: screen tone varies with screen size, specular reflection, and a two-foot TV stand.

**Documenter:** `DESIGN.md` and `.impeccable/design.json` rewritten for the "Daylight Glass" world (Market Page retired).

**Known residuals (not fixed):** the 9 detector findings above; the scroll-edge fades hardcode the wallpaper rgba; ad hoc pill shadows; TV widths use `!important`; the font-size scale has a few one-off steps.

## 5. Polish pass: spacing, ground and AI-slop (11 Oct 2026)

**Trigger:** the user marked uneven gutters and mismatched background colours on the dashboard (a band beside the sidebar, and above and below the floating bars) and asked to reduce AI slop, then review and fix until the quality is there.

**Root causes:**
1. The pastel radial-gradient wallpaper was fixed to the viewport, while the scroll-edge fades were painted in one flat colour, so they showed as bands.
2. The fades also cut through the glass shadows.
3. The sidebar's glass shadow darkened the gutter next to it.

**Changes:**
- **Ground:** one flat Wallpaper.
- **Gutter:** one `--gutter` token (16 px desktop, 12 px mobile) for page padding, the sidebar–content gap and sticky offsets.
- **Spacing and radii:** spacing snapped to 4 / 8 / 12 / 16 / 24 and radii to the DESIGN.md scale.
- **Scroll-edge fades:** moved to `.bar-dock` wrappers behind the glass, spanning only the content column.
- **Sidebar shadow:** a quieter shadow (`--glass-shadow-quiet`).
- **Alignment:**
  - The card rail fills the content width.
  - The chat answer, question and composer share one right edge.
  - The focus TV and the facts-table values align to the panel edges.
  - The chat composer sits level with the sidebar bottom.
- **Slop removed:**
  - Sparkles icons are replaced by a TV brand mark.
  - Purple/blue TV screens are now neutral graphite, with no glare streak.
  - The card hover lift is gone.
  - The chat status breakdown uses the same pills as the dashboard filters.
- **Mobile:**
  - Filters scroll in one row.
  - The decision buttons stay on one line.
  - The chat thumbnails no longer overlap the text.
  - The date chip ends with an ellipsis instead of being cut off.
- **Content fix:** when a blocked action's failing rules are redacted (internal clearance), the "why blocked" callout shows a lock and "Redacted" instead of a dangling separator.

**Verify (run after the pass):**
- `typecheck`: exit 0.
- `test`: 151 pass, 0 fail.
- `typecheck:web`: exit 0.
- `build:web`: exit 0.
- `check:web-bundle`: OK.
- `impeccable detect`: **0 findings**.
- **Fresh finish reviewer:** disposition `fix` with 8 items, all applied.
  - It also found that the earlier blocked and review captures were identical, because `?sku=` takes the SKU id (`sku_syn_e3`), not the merchant SKU.
  - Those captures were retaken with the correct id.
