---
name: AI Product Intelligence Advisor
description: "Daylight Glass: a light Liquid Glass control layer floating over solid white content, for an evidence-first promotion advisor."
colors:
  wallpaper: "#eef1f6"
  glass-solid: "#f6f7f9"
  surface: "#ffffff"
  text: "#1d1d1f"
  text-2: "#424247"
  text-3: "#5d5d63"
  hairline: "rgba(29, 29, 31, 0.1)"
  fill: "rgba(118, 118, 128, 0.12)"
  fill-strong: "rgba(118, 118, 128, 0.2)"
  accent: "#0062cc"
  accent-deep: "#0052ad"
  accent-tint: "rgba(0, 113, 227, 0.12)"
  on-accent: "#ffffff"
  status-recommended: "#1d7a38"
  status-recommended-tint: "rgba(52, 199, 89, 0.15)"
  status-review: "#a3500a"
  status-review-tint: "rgba(255, 149, 0, 0.16)"
  status-insufficient: "#4644b0"
  status-insufficient-tint: "rgba(88, 86, 214, 0.13)"
  status-blocked: "#c0161c"
  status-blocked-tint: "rgba(255, 59, 48, 0.12)"
  status-redacted: "#6a6a70"
  live: "#34c759"
  idle: "rgba(118, 118, 128, 0.45)"
  tooltip: "rgba(29, 29, 31, 0.92)"
  glass-bg: "rgba(255, 255, 255, 0.58)"
  glass-stroke: "rgba(255, 255, 255, 0.72)"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"Segoe UI\", Roboto, \"Noto Sans Thai Variable\", \"Noto Sans Thai\", sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"Segoe UI\", Roboto, \"Noto Sans Thai Variable\", \"Noto Sans Thai\", sans-serif"
    fontSize: "24px"
    fontWeight: 650
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  key-figure:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"Segoe UI\", Roboto, \"Noto Sans Thai Variable\", \"Noto Sans Thai\", sans-serif"
    fontSize: "20px"
    fontWeight: 650
    lineHeight: 1.4
    fontFeature: "\"tnum\""
  rank:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"Segoe UI\", Roboto, \"Noto Sans Thai Variable\", \"Noto Sans Thai\", sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "\"tnum\""
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"Segoe UI\", Roboto, \"Noto Sans Thai Variable\", \"Noto Sans Thai\", sans-serif"
    fontSize: "17px"
    fontWeight: 650
    lineHeight: 1.4
  card-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"Segoe UI\", Roboto, \"Noto Sans Thai Variable\", \"Noto Sans Thai\", sans-serif"
    fontSize: "15px"
    fontWeight: 650
    lineHeight: 1.4
  answer:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"Segoe UI\", Roboto, \"Noto Sans Thai Variable\", \"Noto Sans Thai\", sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"Segoe UI\", Roboto, \"Noto Sans Thai Variable\", \"Noto Sans Thai\", sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  control:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"Segoe UI\", Roboto, \"Noto Sans Thai Variable\", \"Noto Sans Thai\", sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4
  body-small:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"Segoe UI\", Roboto, \"Noto Sans Thai Variable\", \"Noto Sans Thai\", sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"Segoe UI\", Roboto, \"Noto Sans Thai Variable\", \"Noto Sans Thai\", sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.4
  caption:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"Segoe UI\", Roboto, \"Noto Sans Thai Variable\", \"Noto Sans Thai\", sans-serif"
    fontSize: "11.5px"
    fontWeight: 400
    lineHeight: 1.4
  mark:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"Segoe UI\", Roboto, \"Noto Sans Thai Variable\", \"Noto Sans Thai\", sans-serif"
    fontSize: "10px"
    fontWeight: 700
    lineHeight: 1
rounded:
  glass: "22px"
  bubble: "20px"
  surface: "18px"
  popover: "16px"
  tile: "14px"
  control: "12px"
  field: "10px"
  segment: "9px"
  tooltip: "8px"
  mark: "5px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "18px"
  2xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.accent-deep}"
  button-secondary:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
  button-secondary-hover:
    backgroundColor: "{colors.fill-strong}"
  glass-bar:
    backgroundColor: "{colors.glass-bg}"
    rounded: "{rounded.glass}"
    padding: "8px"
  nav-item:
    textColor: "{colors.text-2}"
    rounded: "{rounded.control}"
    padding: "9px 10px"
  nav-item-on:
    backgroundColor: "{colors.accent-tint}"
    textColor: "{colors.accent}"
  searchbox:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.text-3}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "38px"
  segmented:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.text-2}"
    rounded: "{rounded.control}"
    padding: "3px"
  segmented-on:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.segment}"
    padding: "0 12px"
    height: "32px"
  filter:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-2}"
    typography: "{typography.control}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "34px"
  filter-on:
    backgroundColor: "{colors.text}"
    textColor: "{colors.surface}"
  status-chip-recommended:
    backgroundColor: "{colors.status-recommended-tint}"
    textColor: "{colors.status-recommended}"
    rounded: "{rounded.pill}"
    padding: "0 11px"
    height: "28px"
  status-chip-review:
    backgroundColor: "{colors.status-review-tint}"
    textColor: "{colors.status-review}"
    rounded: "{rounded.pill}"
    padding: "0 11px"
    height: "28px"
  status-chip-insufficient:
    backgroundColor: "{colors.status-insufficient-tint}"
    textColor: "{colors.status-insufficient}"
    rounded: "{rounded.pill}"
    padding: "0 11px"
    height: "28px"
  status-chip-blocked:
    backgroundColor: "{colors.status-blocked-tint}"
    textColor: "{colors.status-blocked}"
    rounded: "{rounded.pill}"
    padding: "0 11px"
    height: "28px"
  badge:
    backgroundColor: "{colors.accent-tint}"
    textColor: "{colors.accent}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 9px"
    height: "24px"
  badge-quiet:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.text-2}"
  product-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.surface}"
    padding: "12px 14px 14px"
  focus-panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.surface}"
    padding: "24px"
  key-fact-tile:
    backgroundColor: "{colors.fill}"
    typography: "{typography.key-figure}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  tabs:
    backgroundColor: "{colors.fill}"
    rounded: "{rounded.control}"
    padding: "3px"
  tab-on:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.segment}"
    padding: "0 14px"
    height: "32px"
  provenance-mark:
    backgroundColor: "{colors.accent-tint}"
    textColor: "{colors.accent}"
    typography: "{typography.mark}"
    rounded: "{rounded.mark}"
    padding: "0 3px"
    height: "15px"
  provenance-mark-hover:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
  source-tooltip:
    backgroundColor: "{colors.tooltip}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.tooltip}"
    padding: "5px 9px"
  bubble-question:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.answer}"
    padding: "12px 16px"
  bubble-answer:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.answer}"
    rounded: "{rounded.bubble}"
    padding: "16px 24px 16px 56px"
  follow-up-chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.accent}"
    rounded: "{rounded.pill}"
    padding: "0 15px"
    height: "36px"
  follow-up-chip-hover:
    backgroundColor: "{colors.accent-tint}"
  popover:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.popover}"
    padding: "16px"
  rationale-field:
    backgroundColor: "{colors.fill}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
---

# Design System: AI Product Intelligence Advisor

## Overview

**Creative North Star: "Daylight Glass"**

A calm, light workspace in Apple's Liquid Glass idiom. One flat, cool daylight ground (Wallpaper) sits behind everything: gutters, page and scroll-edge fades are the same colour, so no band or seam ever shows. Frosted glass carries only the controls and navigation (the sidebar, the toolbar, the chat composer and the floating decision bar). The content sits on solid white surfaces below that layer, so the product and its verdict lead and the evidence waits one click away. The world rejects two things. One is the dense ledger table of the superseded "Market Page" direction. The other is the dark KPI-tile dashboard full of invented numbers.

Two pages share one shell. **Chat & Advisor** (`/`) is a centred conversation. The fixed north-star question appears as a blue bubble. The answer is a white bubble holding one composed sentence, the ranking basis and ranked rows with a small TV thumbnail. A glass composer offers preset follow-up chips, and there is no free-text input because no LLM exists. **Product dashboard** (`/dashboard`) has a title and meta line, status filters with counts, a horizontal rail of product cards, a focus panel for the selected SKU, and a floating glass decision bar.

Thai is the primary language and English is switchable. The system UI typeface carries Latin, and self-hosted Noto Sans Thai carries Thai. Line-heights leave room for stacked Thai vowel and tone marks. All data is synthetic and says so on the page.

**Key Characteristics:**
- Liquid Glass control layer floating over solid white content; never glass on glass.
- Size-true synthetic TV illustrations: plain SVG geometry scaled from the real screen diagonal.
- Progressive disclosure: verdict and four key facts first; rules, alternatives and evidence behind one-click tabs.
- iOS status hues used only for status, always with the same icon on every surface.
- Status counts are the only aggregate figures; there is no score and no KPI tile.
- Redaction is always visible as a lock, never as a silent gap.

**The Control Layer Rule.** Glass is reserved for the sidebar, the toolbar, the chat composer and the decision bar. Every piece of content (cards, the focus panel, answer bubbles, popovers) sits on a solid surface.

## Colors

The palette is a daylight neutral set with one system-blue accent and an iOS status ramp. Colour carries meaning, never decoration.

### Primary
- **System Blue** (`accent`) is used for the current navigation item, the selected card ring, the primary action (Approve, Confirm), the question bubble, the advisor avatar, provenance marks, follow-up chips, links and next-step guidance. **Pressed Blue** (`accent-deep`) is its hover state. **Blue Wash** (`accent-tint`) is the selected fill for the current nav item, the "Internal data only" badge, a resting provenance mark, the chosen alternative and a lit source line.

### Status ramp
- **Recommended Green**, **Review Orange**, **Insufficient Indigo** and **Blocked Red** each have a text hue and a pale tint. The token comment states that each text hue meets 4.5:1 on white. Tints are backgrounds only.
- **Redacted Gray** (`status-redacted`) marks redacted values and the withheld-rank lock.
- **Live Green** (`live`) and **Idle Gray** (`idle`) are the 8px source dots: connected internal source vs. "external sources not connected".

### Neutral
- **Daylight Wallpaper** (`wallpaper`) is the single flat page ground. There are no gradient light fields: pastel blobs read as decoration and made the gutters and fades visibly uneven.
- **Glass Solid** (`glass-solid`) is the opaque glass under `prefers-reduced-transparency`.
- **Surface White** (`surface`) is the solid ground for all content.
- **Ink** (`text`), **Ink 2** (`text-2`) and **Ink 3** (`text-3`) form the text ladder. Ink 3 (#5d5d63) is the lightest text allowed: it holds the muted labels, captions, placeholders and meta lines.
- **Hairline** (`hairline`) divides the card facts from the card head, separates the freshness block and rules the fact table rows.
- **Fill** (`fill`) and **Fill Strong** (`fill-strong`) are translucent gray fills for controls (search, segmented controls, tabs, secondary buttons, key-fact tiles, alternatives, confidence pills) and their hover or pressed states.
- **Glass** (`glass-bg`, `glass-stroke`) is the frosted material and its inner stroke.
- **Tooltip Ink** (`tooltip`) is the background of the in-place source tooltip.

**The One Ramp Rule.** A status hue means the same thing on every surface: chip, filter, callout, rule outcome, verdict tag and data state. Hues colour text and icons only. A tint appears only as the background of a status chip or a callout. Status colour never marks a region, a brand element or a provenance mark.

**The Blue Means Act Rule.** System Blue marks what is selected, what can be done next, and where a figure came from. It never encodes a status.

### Dark theme

Every colour token carries both values through CSS `light-dark()`. The page follows the system scheme by default. The toolbar theme button cycles System → Light → Dark, writes `data-theme` on `<html>` and saves the choice per viewer (`localStorage` key `advisor-theme`). A small script in the route head applies the saved choice before first paint, so the page never flashes.

- **Ground and surfaces:**
  - Wallpaper `#0e0f12`.
  - Surface `#1c1c1e`.
  - Dark surfaces separate by a 1px white hairline at 6%, not by shadow.
- **Ink:** `#f5f5f7` / `#d1d1d6` / `#a1a1a8`. Ink 3 is still the lightest text allowed (6.6:1 on the surface).
- **Accent:** splits into two tokens.
  - `accent` `#5aa9ff` for blue text and icons.
  - `accent-fill` `#1a6fd6` (hover `#1662c0`) for blue backgrounds that carry white labels (primary button, question bubble, brand mark), at 4.9:1 or more.
  - In light both are `#0062cc`.
- **Status text:**
  - green `#3ad16a`, orange `#ffa53a`, indigo `#a5a3ff`, red `#ff6f66`.
  - Each is at least 6.3:1 on the surface and 5.3:1 on its own tint.
  - Tints are 13–18% alpha.
- **Glass:**
  - `rgba(40, 40, 44, 0.58)` with a 10% white stroke and a deep black drop shadow.
  - The reduced-transparency solid is `#232326`.
- **Selected segment and tab:** `control-on` `#636366`.
- **TV illustration:**
  - The SVG reads `--tv-bezel`, `--tv-edge`, `--tv-stand`, `--tv-screen-a` and `--tv-screen-b`.
  - In dark, the bezel gains a 22% white edge so it does not vanish into the surface, and the screen goes near-black, like a panel that is off.
- **Rule:** never write a literal colour outside the token block. A new colour is a new token with both values.

## Typography

**Font stack:** the system UI face (`-apple-system`, `SF Pro Text`, `Segoe UI`, `Roboto`), then **Noto Sans Thai Variable**, self-hosted through `@fontsource-variable/noto-sans-thai`, for Thai on every OS. Anuphan and Sarabun are no longer used. The variable font allows the 650 weight used for titles.

**Character:** native-app and quiet. Hierarchy comes from size and weight steps, not from colour or rules.

### Hierarchy
- **Display** (700, 28px, 1.2, -0.015em): the SKU code at the top of the focus panel. The code is Latin, so the tighter line-height is allowed.
- **Headline** (650, 24px, 1.4, -0.01em): the dashboard title. Balanced wrap, max 36ch; 1.25 under `html[lang="en"]`, 20px below 760px.
- **Key figure** (650, 20px, 1.4, tabular): values in the four key-fact tiles.
- **Rank** (700, 20px, 1, tabular): the rank numeral on a card, with a small "=" for ties. The chat row rank is 16px.
- **Title** (650, 17px, 1.4): the verdict action next to the status chip.
- **Card title** (650, 15px, 1.4): the SKU code on a card.
- **Answer** (400, 15px, 1.55): the chat bubbles.
- **Body** (400, 14px, 1.5): the default text, inputs and buttons (buttons at 600).
- **Control** (500, 13px, 1.4): filters, the window chip, the demo button and tool buttons.
- **Body small** (400, 12.5px, 1.45): reasons, meta, the basis line and hints.
- **Label** (600, 12px, 1.4): badges, small chips, the freshness heading and fact-tile labels (at 400).
- **Caption** (400, 11.5px, 1.4): nav sub-labels, card fact labels and the TV caption.
- **Mark** (700, 10px, 1): provenance-mark numerals.

**The Thai Headroom Rule.** Anything that can carry Thai keeps a line-height of 1.4 or more. Only digit-only or Latin-only elements go tighter: the rank, the mark, the SKU code display, and the English headline.

**The Tabular Figures Rule.** Every figure, rank, count and key fact uses `font-variant-numeric: tabular-nums`. Figures do not wrap.

## Layout

- **Shell:** a two-column grid, with a 232px glass sidebar and a fluid main column. Gap and outer padding are both the gutter (16px). The sidebar is sticky, full height minus two gutters. The main column stacks with 16px gaps.
- **Sidebar:** a brand mark (a 32px blue tile), then the pages (Chat, Dashboard, and two disabled future surfaces marked "not built yet"), then **data freshness** at its foot: one live dot per connected source with its ingested time, and an idle dot for "external sources not connected".
- **Toolbar:** sticky at the top. It holds the search field on the dashboard or the "Advisor" title on the chat, the window chip, the TH/EN segmented control, and the demo-controls button, which shows a lock at internal clearance.
- **Chat:** a centred column, max 860px. Answer bubbles are at most 720px; question bubbles at most 80%, aligned right. The composer is sticky at the bottom.
- **Dashboard:** the title and meta line, then the filters, then a horizontal snap-scrolling **rail** of cards (176–186px columns, 14px gap), so the focus panel stays in the first viewport. Below it is the focus panel: a 300px TV column beside the head (28px gap), then the tabs. The decision dock floats at the bottom.
- **Spacing** values are literals in the stylesheet, not custom properties. The reused steps are 4, 8, 12, 16 and 24px.
- **Breakpoints:**
  - **≤ 1360px:** the sidebar collapses to a 76px icon rail (labels visually hidden), freshness is hidden, and the focus TV is 240px.
  - **≤ 1100px:** the focus hero stacks, with the TV centred.
  - **≤ 760px:** the sidebar becomes a glass bottom tab bar fixed 12px from the edges. The toolbar wraps, with search on its own row and the demo label visually hidden. Rail cards are 160px and key facts sit in 2 columns. The decision dock and composer rise to 84px above the tab bar, and the decision bar shows only its three buttons.

**The One-Click Evidence Rule.** The first view shows the verdict and four key facts. Rules, alternatives and evidence sit one tab away, and they are never two clicks deep.

## Elevation & Depth

Depth has two materials, plus a solid popover.

- **Glass** (control layer): `glass-bg` with `blur(28px) saturate(175%)`, a 1px `glass-stroke` border, 22px radius. The shadow has a bright top specular inset, a soft bottom inset, a 12px/32px ambient drop and a 1px contact shadow.
- **Surface** (content): solid white with a soft two-layer offset shadow (1px/2px plus 8px/24px at 6%).
- **Popover**: solid white with a deeper two-layer shadow (2px/6px plus 24px/48px at 18%), 16px radius. Popovers hold the demo controls and the decision rationale.
- **Scroll-edge fades:** every floating glass bar (toolbar, decision bar, chat composer) sits in a `.bar-dock` wrapper. The wrapper's backing is solid Wallpaper across the gutter and fades to transparent toward the content, so content dissolves before it passes under the glass. The backing spans only the content column, never the gutter beside the sidebar, and sits behind the bar so the glass and its shadow are never cut.
- **Spacing:** one gutter token (`--gutter`, 16px desktop / 12px mobile) is the page padding, the sidebar–content gap and the sticky offset. Inner steps are 4 / 8 / 12 / 16 / 24 only.
- **Card lift:** on hover a card rises 2px with a stronger shadow. The selected card takes a 2px blue ring.

**The No Glass on Glass Rule.** Anything that opens from a glass bar (the demo popover, the decision popover) is a solid surface. Glass never stacks on glass.

**The Solid Fallback Rule.** Without `backdrop-filter` support, glass becomes near-opaque white (rgba(250, 251, 253, 0.97)). Under `prefers-reduced-transparency: reduce` it becomes solid #f6f7f9 with no blur. The control layer must stay legible with no frost at all.

**The No Refraction Rule.** There is no SVG displacement or refraction filter. The frost, the specular top edge and the inner stroke carry the material.

## Shapes

The corners nest, and the radius steps down as elements get smaller: glass bars 22px, bubbles 20px (the tail corner is 5px), surfaces 18px, popovers 16px, tiles, callouts and controls 12px, select fields 10px, segment and tab pills 9px, tooltips and the focus ring 8px, provenance marks 5px. Filters, chips, badges and follow-up chips are full pills (999px). Icons are lucide line icons at 11–18px, with a heavier 2.4 stroke on status and lock icons.

## Components

### Glass bars (sidebar, toolbar, composer, decision bar)
- Glass material, 22px radius. The sidebar is a vertical column of nav items. The toolbar is a single 8px-padded row. The composer has a "follow up" label, the preset chips and a hint saying there is no LLM yet. The decision bar shows "Decide on SKU", the status or disabled reason, and three buttons.
- **Nav item:** 14px/500 in Ink 2, 18px icon, 12px radius. The current page takes Blue Wash with blue 600 text. A disabled surface has Ink 3 text, a 55% icon and a "not built yet" sub-label.

### Buttons
- **Primary** (Approve, Confirm): System Blue, white 600 14px, 40px tall, 12px radius. Hover is Pressed Blue; press scales to 0.98. Disabled at 40% opacity.
- **Secondary** (Request more data, Reject, Cancel): Fill with Ink text, Fill Strong on hover.
- A pressed decision button shows a 2px blue ring while its rationale popover is open.

### Toolbar controls
- **Search field:** a Fill pill (12px radius, 38px), with a 16px search icon and an Ink 3 placeholder. Focus-within shows a 2px blue ring.
- **Segmented control / tabs:** a Fill track with 3px padding. The active segment is a white pill (9px radius) with a small shadow and Ink text.

### Status filters (dashboard)
- White pills (34px) with a hairline shadow, the status word in its status hue, and a count bubble in Fill. The active filter inverts to Ink with white text. A filter with a count of 0 is disabled, but it stays visible so the existence of every status is never hidden.

### Status chip
- A pill in the status tint, with the status hue for the text and its fixed icon: check-circle (recommended), triangle-alert (review), circle-help (insufficient), ban (blocked). It comes in two sizes, sm (24px, 12px text) and md (28px, 13px text).

### Product card
- A white surface, 18px radius, in the rail. The top row is the rank, or a withheld-rank lock tile, opposite the status chip. Then come a 104px media well with the **decorative** TV illustration, the SKU code (a button), the action or one specific reason, and two figures (stock cover, realized margin) under a hairline.
- Hover lifts it 2px. The selected card takes a 2px blue ring.

### Focus panel
- A white surface with 24px padding. The hero holds the large **labeled** TV illustration (caption "55″ · Synthetic data"), the SKU code, the identity line, and the verdict (status chip, action, rank).
- A non-recommended SKU adds a tinted **callout** with its reasons and next steps (blue, arrow icon). Then come four **key-fact tiles** (Fill, 14px radius).
- **Tabs:** Overview (fact table with provenance marks, as-of date and formula version, then the confidence pills), Rules (per action: verdict tag and pass/fail/unknown/redacted outcomes, reasons as text, never values), Alternatives (Fill rows; the chosen one in Blue Wash with a check), Evidence (numbered source lines).

### Provenance mark and source list (signature, carried forward)
- A small superscript blue numeral appears on figures **in the Overview fact table only**. Cards, key facts and chat rows omit marks on purpose to stay quiet. One source always gets the same number.
- On hover or focus, the mark fills with System Blue and shows the source in place, in a Tooltip Ink bubble above it. Clicking it opens the Evidence tab, where the matching source line lights in Blue Wash.

### Chat bubbles and answer rows
- **Question:** a System Blue bubble with white 15px text, right-aligned, with a 5px tail corner at the bottom right.
- **Answer:** a white surface bubble with a 28px blue avatar tile in its inset. It holds the sentence, the ranking basis, ranked rows, the status breakdown, and the "Internal data only" badge.
- **Answer row:** rank, a 56px decorative TV thumbnail, the SKU and its action or next step, a stock-cover figure, and a chevron. The whole row links to the dashboard on that SKU, with a Fill hover.
- **Status ask:** a Fill pill per non-recommended status (chip plus count), which asks the matching follow-up.
- **Follow-up chip:** a white pill with blue text and a Blue Wash hover.

### Synthetic TV illustration
- Plain SVG geometry: a near-black bezel, a neutral graphite 16:9 screen (a powered-off panel, the same for every SKU), a soft sheen and two splayed feet. No coloured or purple screen gradients. The width is scaled from the variant's real screen diagonal against a 65″ maximum. There is no brand mark and no photo realism.

### Badges and source dots
- **Internal data only:** a Blue Wash pill with a database icon, on the dashboard meta and on every chat answer.
- **Synthetic data:** a quiet Fill pill.
- **Source dots:** 8px, Live Green for connected and Idle Gray for not connected.

### Inputs
- **Select, textarea:** a Fill background, no border, 10–12px radius, 14px body. The placeholder is Ink 3. **Checkbox** accent colour is System Blue.
- **Focus:** every focusable element gets a global 2px System Blue outline at a 2px offset with a 6px radius.

**The Size-True Rule.** A TV illustration's width always comes from its real screen size, so a 65″ set reads as larger than a 43″ set. It is decorative (`aria-hidden`) in cards and chat rows. It is labeled as synthetic, with a caption, on the focus panel. It must never look like a product photo.

**The Lock Rule.** Every redaction shows a lock: a redacted value is a lock plus "Redacted" (lock alone in compact cells), a withheld rank is a lock tile, a redacted rule outcome carries a lock, and the demo button shows a lock at internal clearance. Redaction is never an empty cell.

**The Counts-Only Rule.** Status counts (on the filters and in the chat breakdown) are the only aggregate figures on any page. Per-SKU key facts are shown, but there are no aggregate KPI tiles, no score, no "potential" label and no discount percentage.

## Do's and Don'ts

### Do:
- **Do** keep glass on the control layer only (the sidebar, toolbar, composer and decision bar), and keep every popover and piece of content solid.
- **Do** ship both glass fallbacks: `@supports not (backdrop-filter)` and `prefers-reduced-transparency`.
- **Do** use the four status hues with their fixed icons on every surface, with tints only behind chips and callouts.
- **Do** show every status as a filter with its count, even when the count is 0, and show "Internal data only" on every answer.
- **Do** show a lock wherever something is redacted.
- **Do** scale TV illustrations from the real screen size, and label the large one as synthetic.
- **Do** keep line-height at 1.4 or more on anything that can carry Thai.
- **Do** keep motion to the shared ease (cubic-bezier(0.22, 1, 0.36, 1)): 180ms background changes, a 200ms card lift, a 120ms press. Remove all of it under `prefers-reduced-motion`.
- **Do** keep Ink 3 as the lightest text colour.

### Don't:
- **Don't** put glass on glass, or glass behind content (cards, the focus panel, bubbles, tables).
- **Don't** use SVG refraction or displacement filters.
- **Don't** show aggregate KPI tiles, scores, success probabilities, "top/potential" badges, discount percentages or placeholder market signals. External sources read "not connected".
- **Don't** use status hues for decoration, brand accents or provenance marks. Don't use System Blue to mean a status.
- **Don't** add a free-text chat input or imply generated answers while no LLM exists.
- **Don't** let a TV illustration look like a product photo, or carry a brand mark.
- **Don't** hide insufficient, review or blocked SKUs behind a click, or let redacted data disappear without a lock.
