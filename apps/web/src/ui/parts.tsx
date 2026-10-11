import { Ban, CircleCheck, CircleHelp, Lock, TriangleAlert } from "lucide-react";
import type { MetricId } from "../../../../packages/metrics/src/index.ts";
import type { FactView, Recommendation, RuleResultView, SkuStatus, StatusReason } from "../../../../packages/recommendation/src/index.ts";
// Pure classification table (no server code): a cell takes the colour of the class its reasons map to.
import { UNKNOWN_REASON_CLASS } from "../../../../packages/recommendation/src/classes.ts";
import type { RuleReason } from "../../../../packages/rules/src/index.ts";
import { fmt, GATE_REASON, METRIC, STATUS, t, UI, UNKNOWN_REASON, VERDICT_REASON } from "../i18n.ts";
import type { Lang } from "../i18n.ts";

// ---------- provenance marks ----------

export interface Mark { n: number; sourceId: string | null; file: string; lines: Set<number>; ingestedAt: string | null; label: string }

export function sourceKey(locator: string | null): { file: string; line: number | null } {
  const m = /^file:(.+?)#L(\d+)$/.exec(locator ?? "");
  return m ? { file: m[1]!, line: Number(m[2]) } : { file: locator ?? "?", line: null };
}

/** One mark per (source, file), numbered in reading order: same source, same mark. */
export function buildMarks(recs: Recommendation[], metrics: MetricId[], sourceNames: Record<string, { name: string }>): Map<string, Mark> {
  const marks = new Map<string, Mark>();
  for (const rec of recs) {
    for (const metric of metrics) {
      for (const s of rec.facts.find((f) => f.metric === metric)?.sources ?? []) {
        const { file, line } = sourceKey(s.locator);
        const key = `${s.sourceId}|${file}`;
        if (!marks.has(key)) {
          marks.set(key, { n: marks.size + 1, sourceId: s.sourceId, file, lines: new Set(), ingestedAt: s.ingestedAt, label: `${(s.sourceId && sourceNames[s.sourceId]?.name) ?? s.sourceId} · ${file}` });
        }
        if (line !== null) marks.get(key)!.lines.add(line);
      }
    }
  }
  return marks;
}

function factMarks(fact: FactView | undefined, marks: Map<string, Mark>): Mark[] {
  const found = new Map<number, Mark>();
  for (const s of fact?.sources ?? []) {
    const m = marks.get(`${s.sourceId}|${sourceKey(s.locator).file}`);
    if (m) found.set(m.n, m);
  }
  return [...found.values()].sort((a, b) => a.n - b.n);
}

/** Small numbered marks; hover/focus shows the source in place, click opens the evidence tab. */
export function MarkRefs({ fact, marks, onOpen }: { fact: FactView | undefined; marks: Map<string, Mark>; onOpen: (n: number) => void }) {
  return (
    <>
      {factMarks(fact, marks).map(({ n, label }) => (
        <button key={n} type="button" className="mark" data-src={`${n} · ${label}`} aria-label={`${n}: ${label}`} onClick={(e) => { e.stopPropagation(); onOpen(n); }}>{n}</button>
      ))}
    </>
  );
}

// ---------- values and states ----------

export function formatValue(lang: Lang, fact: FactView): string {
  const v = fact.value!;
  switch (fact.unit) {
    case "units": return fmt.int(lang, v);
    case "days": return fmt.days(lang, v);
    case "ratio": return fmt.percent(lang, v);
    default: return fact.currency ? fmt.money(lang, v, fact.currency) : fmt.int(lang, v);
  }
}

/**
 * A figure, or a visibly distinct state. `withMarks` shows provenance marks; summary contexts (cards,
 * key facts, advisor list) omit them to stay quiet, and the Overview tab carries them for every figure.
 */
export function FactValue({ fact, lang, marks, onOpen, compact = false, withMarks = false }: { fact: FactView | undefined; lang: Lang; marks: Map<string, Mark>; onOpen: (n: number) => void; compact?: boolean; withMarks?: boolean }) {
  if (!fact) return <span className="state st-insufficient_data">{t(lang, UI.noData)}</span>;
  if (fact.redacted) {
    return compact
      ? <span className="state st-redacted" role="img" aria-label={t(lang, UI.redacted)} title={t(lang, UI.redacted)}><Lock aria-hidden size={13} strokeWidth={2.4} /></span>
      : <span className="state st-redacted"><Lock aria-hidden size={13} strokeWidth={2.4} />{t(lang, UI.redacted)}</span>;
  }
  const why = fact.reasons.map((r) => t(lang, UNKNOWN_REASON[r])).join(" · ");
  if (fact.status === "no_data") return <span className="state st-insufficient_data" title={why}>{t(lang, UI.noData)}</span>;
  if (fact.status === "insufficient_data") {
    const conflicting = fact.reasons.some((r) => UNKNOWN_REASON_CLASS[r].status === "review_required");
    return <span className={`state ${conflicting ? "st-review_required" : "st-insufficient_data"}`} title={why}>{t(lang, conflicting ? UI.conflicting : UI.insufficient)}</span>;
  }
  return <span className="fig">{formatValue(lang, fact)}{withMarks && <MarkRefs fact={fact} marks={marks} onOpen={onOpen} />}</span>;
}

const STATUS_ICON: Record<SkuStatus, typeof CircleCheck> = {
  recommended: CircleCheck, review_required: TriangleAlert, insufficient_data: CircleHelp, blocked: Ban,
};

export function StatusChip({ status, lang, size = "md" }: { status: SkuStatus; lang: Lang; size?: "sm" | "md" }) {
  const Icon = STATUS_ICON[status];
  return <span className={`chip chip-${size} st-${status}`}><Icon aria-hidden size={size === "sm" ? 12 : 14} strokeWidth={2.4} />{t(lang, STATUS[status])}</span>;
}

// ---------- code → text ----------

export function statusReasonText(lang: Lang, code: StatusReason): string {
  const entry = (VERDICT_REASON as Record<string, { th: string; en: string }>)[code]
    ?? (UNKNOWN_REASON as Record<string, { th: string; en: string }>)[code]
    ?? (GATE_REASON as Record<string, { th: string; en: string }>)[code];
  return entry ? t(lang, entry) : code;
}

export function ruleReasonText(lang: Lang, code: RuleReason): string {
  if (code === "below_threshold") return t(lang, UI.ruleBelow);
  if (code === "above_threshold") return t(lang, UI.ruleAbove);
  if (code.startsWith("excluded_")) return `${t(lang, UI.ruleExcluded)} (${code.slice(code.indexOf(":") + 1)})`;
  if (code.startsWith("sku_status_")) return `${t(lang, UI.ruleStatus)} (${code.slice("sku_status_".length)})`;
  return t(lang, UNKNOWN_REASON[code as keyof typeof UNKNOWN_REASON]);
}

/** Rule name without values, so it can be shown at any clearance. */
export function ruleLabel(rule: RuleResultView, lang: Lang): string {
  if (rule.kind === "metric_threshold" && rule.metric) return t(lang, METRIC[rule.metric.id as MetricId]);
  return rule.kind === "exclusion" ? t(lang, UI.ruleExclusionName) : t(lang, UI.ruleStatusName);
}

// ---------- synthetic TV illustration ----------

/**
 * Size-true synthetic TV: plain SVG geometry scaled from the variant's real screen diagonal
 * (16:9 panel). Not a product photo, no brand marks; labeled synthetic for assistive tech.
 */
export function TvIllustration({ inches, lang, maxInches = 65, maxWidth, caption = false, decorative = false, align = "center" }: { inches: number | undefined; lang: Lang; maxInches?: number; maxWidth: number; caption?: boolean; decorative?: boolean; align?: "center" | "start" }) {
  const size = inches ?? 55;
  const w = (maxWidth * size) / maxInches;
  const h = (w * 9) / 16;
  const bezel = Math.max(2, w * 0.012);
  const neck = h * 0.12;
  const total = h + neck + bezel * 2 + 4;
  const label = t(lang, UI.illustration, { n: size });
  const foot = h * 0.1;
  return (
    <figure className="tv" style={{ width: maxWidth }}>
      <svg {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": label })} viewBox={`0 0 ${maxWidth} ${total}`} width={maxWidth} height={total}>
        {!decorative && <title>{label}</title>}
        <defs>
          <linearGradient id={`tv-screen-${size}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2c2f36" />
            <stop offset="1" stopColor="#4a505b" />
          </linearGradient>
          <linearGradient id={`tv-sheen-${size}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
            <stop offset="0.45" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g transform={`translate(${align === "start" ? 0 : (maxWidth - w) / 2} 0)`}>
          <rect x="0" y="0" width={w} height={h + bezel * 2} rx={Math.max(3, w * 0.012)} fill="#1d1d1f" />
          <rect x={bezel} y={bezel} width={w - bezel * 2} height={h} rx={Math.max(2, w * 0.006)} fill={`url(#tv-screen-${size})`} />
          <rect x={bezel} y={bezel} width={w - bezel * 2} height={h} rx={Math.max(2, w * 0.006)} fill={`url(#tv-sheen-${size})`} />
          <path d={`M${bezel * 2 + w * 0.06} ${h + bezel * 2} l${-w * 0.03} ${foot} M${w - bezel * 2 - w * 0.06} ${h + bezel * 2} l${w * 0.03} ${foot}`} stroke="#2c2c2e" strokeWidth={Math.max(2, w * 0.018)} strokeLinecap="round" />
        </g>
      </svg>
      {caption && <figcaption>{fmt.int(lang, size)}″ · {t(lang, UI.synthetic).split(" — ")[0]}</figcaption>}
    </figure>
  );
}
