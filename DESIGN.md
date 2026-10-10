---
name: AI Product Intelligence Advisor
description: "Market Page: an evidence-first decision workspace set like a Thai business-daily market listing."
colors:
  newsprint-ground: "#f1f1ee"
  sheet-white: "#ffffff"
  press-ink: "#141414"
  ink-slate-2: "#33404a"
  ink-muted: "#56626c"
  column-rule: "#c9c9c2"
  hairline-rule: "#e1e1db"
  slate-field: "#1d2b36"
  slate-field-raised: "#2b3c49"
  on-slate: "#f1f1ee"
  on-slate-muted: "#b9c6cf"
  selection-gray: "#e3e3dc"
  row-hover: "#e9e9e3"
  status-recommended: "#13703f"
  status-recommended-deep: "#0f5c33"
  status-review: "#8a5a00"
  status-insufficient: "#2b5b84"
  status-blocked: "#b42318"
  status-redacted: "#56626c"
  footnote-mark: "#8a5a00"
  footnote-lit: "#f3d48f"
typography:
  display:
    fontFamily: "Anuphan, Sarabun, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Anuphan, Sarabun, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  rank:
    fontFamily: "Anuphan, Sarabun, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "\"tnum\", \"lnum\""
  title:
    fontFamily: "Anuphan, Sarabun, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.35
  figure:
    fontFamily: "Anuphan, Sarabun, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.35
    fontFeature: "\"tnum\", \"lnum\""
  body:
    fontFamily: "Sarabun, Anuphan, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  body-small:
    fontFamily: "Sarabun, Anuphan, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Anuphan, Sarabun, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.35
  mark:
    fontFamily: "Anuphan, Sarabun, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 700
    lineHeight: 1
rounded:
  none: "0px"
  mark: "2px"
  nav: "4px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "24px"
  "6": "32px"
components:
  button-approve:
    backgroundColor: "{colors.status-recommended}"
    textColor: "{colors.sheet-white}"
    rounded: "{rounded.none}"
    padding: "10px 8px"
  button-approve-hover:
    backgroundColor: "{colors.status-recommended-deep}"
  button-secondary:
    backgroundColor: "{colors.sheet-white}"
    textColor: "{colors.press-ink}"
    rounded: "{rounded.none}"
    padding: "10px 8px"
  button-secondary-hover:
    backgroundColor: "{colors.selection-gray}"
  segmented-on:
    backgroundColor: "{colors.press-ink}"
    textColor: "{colors.newsprint-ground}"
    rounded: "{rounded.none}"
    padding: "5px 12px"
  segmented-off-hover:
    backgroundColor: "{colors.selection-gray}"
  rail:
    backgroundColor: "{colors.slate-field}"
    textColor: "{colors.on-slate-muted}"
    width: "232px"
  rail-nav-on:
    backgroundColor: "{colors.slate-field-raised}"
    textColor: "{colors.on-slate}"
    rounded: "{rounded.nav}"
    padding: "9px 12px"
  sector-bar:
    backgroundColor: "{colors.slate-field}"
    textColor: "{colors.on-slate}"
    padding: "7px 8px"
  sector-bar-none:
    backgroundColor: "{colors.slate-field-raised}"
    textColor: "{colors.on-slate}"
  listing-row-hover:
    backgroundColor: "{colors.row-hover}"
  listing-row-selected:
    backgroundColor: "{colors.selection-gray}"
  footnote-mark:
    textColor: "{colors.footnote-mark}"
    typography: "{typography.mark}"
    rounded: "{rounded.mark}"
    padding: "0 2px"
  footnote-mark-lit:
    backgroundColor: "{colors.footnote-lit}"
    textColor: "{colors.press-ink}"
  sku-sheet:
    backgroundColor: "{colors.sheet-white}"
    padding: "32px 24px"
    width: "420px"
  synthetic-label:
    backgroundColor: "{colors.slate-field}"
    textColor: "{colors.on-slate}"
    padding: "2px 8px"
  textarea:
    backgroundColor: "{colors.sheet-white}"
    rounded: "{rounded.mark}"
    padding: "8px"
---

# Design System: AI Product Intelligence Advisor

## Overview

**Creative North Star: "The Market Page"**

The workspace reads like the market-listing page of a Thai business daily. Dense tabular figures sit on a cool newsprint-gray ground, grouped under solid slate sector bars. Every figure carries a small amber footnote mark that points to a numbered source strip below the table. The page answers one fixed question. It shows which SKUs are recommended for which promotion action and why, and what is blocked, unknown or redacted. A white SKU sheet on the right is where the decision gets recorded. The page sits in the evidence-first tradition of print finance listings. It rejects the dark KPI-card dashboard with a chat sidebar.

The page is dense and calm. It does not use cards, score tiles, gradients, illustrations or decorative imagery. Hierarchy comes from type-scale contrast (a 28px question over 15px figures over 11.5px column heads) and from a ladder of ink rules of different weights. Colour works at two scales only. Slate fills whole regions: the rail and the sector bars. The status hues appear only at word scale, on a flag, a verdict or a rule outcome. Thai is the primary language and English is switchable, so the line-heights leave room for Thai stacked vowel and tone marks.

All data in the built workspace is synthetic and labelled as synthetic on the page. This document describes the visual system only. No figure seen in the build is a business fact.

**Key Characteristics:**
- Newsprint-gray ground, a white decision sheet, press-black ink.
- Slate as region-scale colour: the rail and the reverse sector bars.
- One fixed five-step status ramp, the same in the listing, the sheet and the rules.
- A footnote mark on every figure, linked both ways to a numbered source strip.
- No cards and no KPI tiles. Hierarchy comes from type scale and ink-rule weight.
- Tabular lining numerals in every figure table.
- Almost no motion: a 160ms background change on marks, footnotes and buttons.

## Colors

The palette is restrained and print-derived: cool neutrals, one committed slate for regions, and a market status ramp used only at word scale.

### Primary
- **Slate Field** (slate-field): fills the navigation rail, the reverse sector bars that head each action group in the listing, and the "synthetic data" label. It is also the focus-ring, caret, checkbox-accent and text-selection colour. Its raised step (slate-field-raised) marks the active or hovered rail item and the "no action" sector bar.
- **Text on slate** (on-slate, on-slate-muted): light text for slate regions. The muted step is used for inactive nav items and for the secondary text in sector bars (counts and sort criteria).

### Secondary
- **Footnote Amber** (footnote-mark): the colour of the superscript footnote marks and the numbers in the source strip.
- **Lit Amber** (footnote-lit): a pale highlight laid behind a mark and its matching source line together, on hover or focus.

### Tertiary: the status ramp
This one ramp is fixed and appears with the same meaning everywhere it is used.
- **Market Green** (status-recommended): recommended / eligible / pass. It is also the fill of the Approve button, the only action a recommended status unlocks. The deep step (status-recommended-deep) is used only as that button's hover fill.
- **Review Amber** (status-review): review required / unknown rule outcome.
- **Blue-Slate** (status-insufficient): insufficient data, no data, and next-step guidance.
- **Market Red** (status-blocked): blocked / fail / error messages.
- **Redaction Gray** (status-redacted): redacted values and rules. It always comes with a lock icon and never stands as colour alone.

### Neutral
- **Newsprint Ground** (newsprint-ground): the page background behind the listing.
- **Sheet White** (sheet-white): the SKU sheet, form fields and secondary buttons.
- **Press Ink** (press-ink): body text, figures, and the heavy structural rules.
- **Ink 2 / Ink Muted** (ink-slate-2, ink-muted): secondary text, metadata labels, column heads, and as-of notes.
- **Column Rule** (column-rule): the 1px divider between listing rows.
- **Hairline Rule** (hairline-rule): the 1px divider between rows in the sheet's fact table and constraint lists.
- **Selection Gray / Row Hover** (selection-gray, row-hover): the selected listing row, button hover, and segmented hover; row-hover is a lighter tint for pointer hover on a listing row.

### Named Rules
**The Region-Scale Rule.** Slate is laid down only as a whole field: the rail, a full-width sector bar, or a label block. It is never a thin accent, a border tint, or a background behind a single figure.

**The One Ramp Rule.** The five status hues mean the same thing in the listing, the sheet, and the rule lines. They are used only for status words, status icons, rule outcomes, and the Approve action that a recommended status enables. They are never decoration, and they never fill a region.

**The Lock Rule.** Redaction is always shown as Redaction Gray plus a lock icon, with the word "redacted" or an aria-label. When every cell in a column is redacted, the column head says so once and the cells show only the lock (nothing labelled twice).

## Typography

**Display Font:** Anuphan (with Sarabun, system-ui, sans-serif). Used for figures, headings, labels, and controls.
**Body Font:** Sarabun (with Anuphan, system-ui, sans-serif). Used for running text, model lines, reasons, footnote text, and form input.

Both fonts are self-hosted through Fontsource and loaded in the root route. Anuphan is loaded at 400, 500, 600 and 700. Sarabun is loaded at 400, 500 and 600 only.

**Character:** Anuphan is a compact, loopless Thai/Latin grotesque. It gives the figures and headings the clipped authority of a market table. Sarabun is a quieter text face for reading the reasons behind each number.

### Hierarchy
- **Display:** the north-star question as the H1. 700 at 28px with a 1.35 line-height in Thai, tightened to 1.2 when the page is in English. Measure capped at 34ch, balanced wrap. Drops to 23px below 760px.
- **Headline:** the SKU code at the top of the sheet. 700 at 28px with a 1.2 line-height (SKU codes are Latin).
- **Rank:** the rank number in the listing. 700 at 22px with a 1.0 line-height. A tie shows a small "=" in muted ink.
- **Title:** the sheet verdict line (status flag plus the chosen action). 700 at 17px.
- **Figure:** listing cells at 500 15px/1.35 (14px below 760px). SKU codes in the listing at 700 15px. Sheet fact values at 600 14.5px/1.35.
- **Body:** 400 14px/1.6 Sarabun. Smaller body steps (13px, 12.5px, 12px) are used for model lines, reasons, footnote text and notes.
- **Label:** column heads 600 11.5px; sheet block heads and the sources head 600 12px in ink-muted; status flags 600 12.5px.
- **Mark:** footnote superscripts at 700 10px.

### Named Rules
**The Stacked-Vowel Rule.** Thai text uses a line-height of at least 1.35 so that stacked vowel and tone marks never collide or clip. Only Latin-only settings go tighter: the English H1 at 1.2 and the SKU title at 1.2.

**The Tabular Figure Rule.** Every figure table (the listing and the sheet's fact table) sets `font-variant-numeric: tabular-nums lining-nums`. Figures are right-aligned and do not wrap.

**The Scale-Contrast Rule.** Hierarchy comes from size and weight steps and from ink rules. It never comes from boxes, tinted panels or decorative colour.

## Layout

The page is a full-height, three-column grid: a 232px slate rail, a fluid main column, and a 420px white SKU sheet. The main column and the sheet scroll independently.

The main column reads top to bottom:
1. The header: the question, a metadata list (window, evaluated-at, evidence basis, objective), the synthetic-data label, and on the right the TH/EN switch and the dashed demo-controls fieldset.
2. The listing table, grouped by action. Groups are separated by a 16px band of ground colour above each sector bar.
3. The numbered source strip, pushed to the bottom of the column.

Spacing follows a 4px-based scale (4, 8, 12, 16, 24, 32). Column gutters are 32px at full width. Table cells are dense, with roughly 9px of vertical padding.

**Responsive behaviour:**
- **1440px and below:** the rail collapses to a 64px icon rail; labels are kept for screen readers only. The sheet narrows to 380px and gutters drop to 24px.
- **1100px and below:** the sheet stacks under the main column. It keeps the icon rail, takes a 3px ink top rule in place of its left edge, and the decision bar stops being sticky.
- **760px and below:** the rail becomes a horizontal top bar and everything is one column. The header controls stack. The listing scrolls horizontally with an 85% fade mask at the right edge.

## Elevation & Depth

The system is flat. Depth comes from tone (ground against white sheet against slate field) and from rule weight, not from shadows. There is exactly one shadow: the scroll-edge seam above the sticky decision bar at the foot of the sheet. It tells the reader there is content scrolling under the bar. The exact value is recorded in the sidecar.

### Named Rules
**The Ink-Rule Ladder.** Structure is drawn with rules of fixed weights, from heaviest to lightest:
- **3px ink** under the page head, and as the top edge of the stacked sheet.
- **1.5px ink** under the listing column heads and above the source strip.
- **1px ink** under sheet block heads, on the sheet's left edge, under the selected row, and above the decision bar.
- **1px column-rule** between listing rows.
- **1px hairline** between rows inside the sheet.

## Shapes

Corners are square. The only rounding is small:
- **2px** on footnote marks, source-strip lines, the select and the textarea.
- **4px** on rail nav items.

Buttons, the segmented control, sector bars and the sheet are square. Borders do the shaping. Ink outlines are 1.5px on buttons and the segmented control, and 1px on fields. The demo-controls fieldset is the only dashed border: a 1px dashed ink-muted line that marks those controls as provisional.

## Components

### Buttons
Square, outlined and plain; they sit at the foot of the sheet in a three-column grid.
- **Shape:** square corners, 1.5px ink outline, 10px × 8px padding, 700 13.5px Anuphan.
- **Approve (primary):** Market Green fill and border with white text. Hover changes the fill to the deep green.
- **Reject / Request more data (secondary):** white fill with an ink outline. Hover changes the fill to selection gray.
- **Disabled:** 45% opacity with a not-allowed cursor. Approve is enabled only when the SKU is recommended and the viewer has approval permission.
- **Motion:** a 160ms background-color transition.

### Segmented control (TH / EN)
- A 1.5px ink frame around two square buttons at 600 12px. The pressed button is filled ink with ground-colour text. Hovering the unpressed button fills it with selection gray.

### Navigation rail
- A solid slate field. Each item is an 18px icon plus a 500 14px label. The active item is raised slate with on-slate text at weight 600, with 4px corners.
- Surfaces that are not built yet appear as disabled items with a "not built yet" sublabel and a dimmed icon.
- At 1440px the rail becomes icon-only; at 760px it becomes a horizontal top bar.

### Status flag
- An inline 14px status icon followed by the status word, both in the status hue, at 600 12.5px:
  - check-circle for recommended
  - warning triangle for review required
  - question-circle for insufficient data
  - ban for blocked
- Redacted values use the same pattern with a lock icon in Redaction Gray.
- Data states inside a cell ("no data", "insufficient") are 600 11px words in their ramp colour.

### Listing table and sector bars
- Grouped `tbody` sections. Each group opens with a full-width slate sector bar:
  - the action name, 700 13px on-slate;
  - then "n of m eligible" and the sort criteria in on-slate-muted.
- The group with no action uses the raised slate bar.
- A row has the rank, the SKU code (a button) over a truncated model line, the status flag, four figures with footnote marks, and a rule count. The rule count shows a lock with the number of hidden rules when any are redacted.
- Hovering a row fills it with row-hover. The selected row fills with selection gray and takes an ink bottom rule.

### Footnote mark and source strip (signature)
- Every figure ends in one or more superscript marks: 700 10px amber numerals, 2px corners. Each mark is a link to its numbered line in the source strip under the table. Marks are numbered in reading order, and one source always gets the same number.
- Hovering or focusing a mark lights it, and lights its source line, with Lit Amber. Hovering or focusing a source line lights every mark that cites it.
- Source lines are focusable. They read: source name · file · line count · ingested-at time. A line targeted from a link also lights.
- Transition: background-color over 160ms.

### SKU sheet
- A white panel with no card shell. It is set off only by a 1px ink left edge.
- The sheet stacks, top to bottom: SKU code headline, identity line, verdict, then blocks for missing evidence, facts, constraints and rule results, confidence dimensions, and the decision.
- Each block head is a 600 12px muted label over a 1px ink rule.
- The fact table puts each value with its marks, then an as-of date and formula version in small muted type.
- Next-step guidance is in Blue-Slate with an arrow icon.
- The decision block is sticky at the foot of the sheet. It holds the rationale textarea, the three buttons, a live status line, and a note that approval is not execution.

### Inputs / Fields
- **Textarea and select:** white fill, 1px ink-muted outline, 2px corners, 14px Sarabun.
- **Focus:** the global focus ring, a 2px slate outline at a 2px offset, on every focusable element.
- **Checkbox:** accent colour is slate.

### Synthetic-data label
- A small slate block with 600 12px on-slate text. It sits under the header metadata and states that the data is synthetic. It is a provenance statement, not decoration.

## Do's and Don'ts

### Do:
- **Do** put a footnote mark on every figure and link it to a numbered source line. Light the mark and its line together on hover and focus, in both directions.
- **Do** use the fixed five-step status ramp, with the same hue and icon for the same status on every surface. Pair redaction with a lock icon every time.
- **Do** lay slate down as a whole region (rail, sector bar). Use the status hues only at word scale.
- **Do** build hierarchy from type-scale contrast and the ink-rule ladder (3px, 1.5px, 1px ink; 1px column-rule and hairline).
- **Do** keep Thai line-height at 1.35 or more. Tighten only Latin-only settings.
- **Do** set every figure table in Anuphan with tabular lining numerals, right-aligned and not wrapping.
- **Do** keep motion to the 160ms background-color transition on marks, source lines and buttons. Remove it under `prefers-reduced-motion`.
- **Do** label synthetic data and provisional demo controls on the page.

### Don't:
- **Don't** wrap content in cards, tinted panels or drop-shadowed containers. The scroll seam on the sticky decision bar is the only shadow.
- **Don't** show score tiles, KPI blocks, success probabilities or "top/potential" badges. A rank is an order, not a score.
- **Don't** use status hues for decoration, region fills or brand accents.
- **Don't** let a figure appear without its source mark, or let missing, stale or redacted evidence disappear from view.
- **Don't** label the same thing twice. A fully redacted column says "redacted" once, in its head.
- **Don't** add Sarabun at 700. It is not loaded.
