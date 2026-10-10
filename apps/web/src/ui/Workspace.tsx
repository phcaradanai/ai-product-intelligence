import { useMemo, useState } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity, ArrowRight, Ban, CircleCheck, CircleHelp, History, Lock, MessageSquareText, PackageSearch, TriangleAlert,
} from "lucide-react";
import type { MetricId } from "../../../../packages/metrics/src/index.ts";
import type { DecisionKind, FactView, Recommendation, RuleResultView, SkuStatus, StatusReason } from "../../../../packages/recommendation/src/index.ts";
import type { PromotionAction, RuleReason } from "../../../../packages/rules/src/index.ts";
import type { WorkspaceView } from "../server/pipeline.ts";
import { submitDecision } from "../server/functions.ts";
import {
  ACTION, DECISION, DIRECTION, fmt, GATE_REASON, METRIC, NEXT_STEP, REFUSAL, STATUS, t, UI, UNKNOWN_REASON, VERDICT, VERDICT_REASON,
} from "../i18n.ts";
import type { Lang } from "../i18n.ts";

interface Search { lang: Lang; clearance: "internal" | "confidential"; approve: boolean; sku?: string | undefined }

const LISTING_METRICS: MetricId[] = ["units_sold", "available_stock", "stock_cover_days", "realized_gross_margin_ratio"];
const SHEET_METRICS: MetricId[] = ["units_sold", "gross_revenue", "available_stock", "stock_cover_days", "realized_gross_margin_ratio"];
const STATUS_ORDER: SkuStatus[] = ["recommended", "review_required", "insufficient_data", "blocked"];

// ---------- footnote marks (the signature move) ----------

interface Mark { n: number; sourceId: string | null; file: string; lines: Set<number>; ingestedAt: string | null }

function sourceKey(locator: string | null): { file: string; line: number | null } {
  const m = /^file:(.+?)#L(\d+)$/.exec(locator ?? "");
  return m ? { file: m[1]!, line: Number(m[2]) } : { file: locator ?? "?", line: null };
}

/** One mark per (source, file), numbered in reading order: same source, same mark. */
function buildMarks(recs: Recommendation[]): Map<string, Mark> {
  const marks = new Map<string, Mark>();
  for (const rec of recs) {
    for (const metric of SHEET_METRICS) {
      const fact = rec.facts.find((f) => f.metric === metric);
      for (const s of fact?.sources ?? []) {
        const { file, line } = sourceKey(s.locator);
        const key = `${s.sourceId}|${file}`;
        if (!marks.has(key)) marks.set(key, { n: marks.size + 1, sourceId: s.sourceId, file, lines: new Set(), ingestedAt: s.ingestedAt });
        if (line !== null) marks.get(key)!.lines.add(line);
      }
    }
  }
  return marks;
}

function factMarks(fact: FactView | undefined, marks: Map<string, Mark>): number[] {
  const ns = new Set<number>();
  for (const s of fact?.sources ?? []) {
    const m = marks.get(`${s.sourceId}|${sourceKey(s.locator).file}`);
    if (m) ns.add(m.n);
  }
  return [...ns].sort((a, b) => a - b);
}

// ---------- code → text ----------

function statusReasonText(lang: Lang, code: StatusReason): string {
  const entry = (VERDICT_REASON as Record<string, { th: string; en: string }>)[code]
    ?? (UNKNOWN_REASON as Record<string, { th: string; en: string }>)[code]
    ?? (GATE_REASON as Record<string, { th: string; en: string }>)[code];
  return entry ? t(lang, entry) : code;
}

function ruleReasonText(lang: Lang, code: RuleReason): string {
  if (code === "below_threshold") return t(lang, UI.ruleBelow);
  if (code === "above_threshold") return t(lang, UI.ruleAbove);
  if (code.startsWith("excluded_")) return `${t(lang, UI.ruleExcluded)} (${code.slice(code.indexOf(":") + 1)})`;
  if (code.startsWith("sku_status_")) return `${t(lang, UI.ruleStatus)} (${code.slice("sku_status_".length)})`;
  return t(lang, UNKNOWN_REASON[code as keyof typeof UNKNOWN_REASON]);
}

function formatValue(lang: Lang, fact: FactView): string {
  const v = fact.value!;
  switch (fact.unit) {
    case "units": return fmt.int(lang, v);
    case "days": return fmt.days(lang, v);
    case "ratio": return fmt.percent(lang, v);
    default: return fact.currency ? fmt.money(lang, v, fact.currency) : fmt.int(lang, v);
  }
}

// ---------- small pieces ----------

const STATUS_ICON: Record<SkuStatus, typeof CircleCheck> = {
  recommended: CircleCheck, review_required: TriangleAlert, insufficient_data: CircleHelp, blocked: Ban,
};

function StatusFlag({ status, lang }: { status: SkuStatus; lang: Lang }) {
  const Icon = STATUS_ICON[status];
  return <span className={`flag st-${status}`}><Icon aria-hidden size={14} strokeWidth={2.25} />{t(lang, STATUS[status])}</span>;
}

function MarkRefs({ ns, lit, setLit }: { ns: number[]; lit: number | null; setLit: (n: number | null) => void }) {
  return (
    <>
      {ns.map((n) => (
        <a key={n} href={`#fn-${n}`} className={`mark${lit === n ? " lit" : ""}`} aria-label={`source ${n}`}
          onMouseEnter={() => setLit(n)} onMouseLeave={() => setLit(null)} onFocus={() => setLit(n)} onBlur={() => setLit(null)}>{n}</a>
      ))}
    </>
  );
}

function FactValue({ fact, lang, marks, lit, setLit, compactRedaction = false }: { fact: FactView | undefined; lang: Lang; marks: Map<string, Mark>; lit: number | null; setLit: (n: number | null) => void; compactRedaction?: boolean }) {
  if (!fact) return <span className="state">{t(lang, UI.noData)}</span>;
  if (fact.redacted && compactRedaction) return <span className="state redacted" role="img" aria-label={t(lang, UI.redacted)} title={t(lang, UI.redacted)}><Lock aria-hidden size={13} strokeWidth={2.5} /></span>;
  if (fact.redacted) return <span className="state redacted"><Lock aria-hidden size={12} strokeWidth={2.5} />{t(lang, UI.redacted)}</span>;
  if (fact.status === "no_data") return <span className="state nodata" title={fact.reasons.map((r) => t(lang, UNKNOWN_REASON[r])).join(" · ")}>{t(lang, UI.noData)}</span>;
  if (fact.status === "insufficient_data") return <span className="state insufficient" title={fact.reasons.map((r) => t(lang, UNKNOWN_REASON[r])).join(" · ")}>{t(lang, UI.insufficient)}</span>;
  return <span className="fig">{formatValue(lang, fact)}<MarkRefs ns={factMarks(fact, marks)} lit={lit} setLit={setLit} /></span>;
}

function ruleCount(rec: Recommendation, action: PromotionAction | null, lang: Lang) {
  const c = rec.constraints.find((x) => x.action === action);
  if (!c) return null;
  if (c.rules.length === 0) return <span className="reason-short">{c.verdict === "eligible" ? t(lang, UI.unrestricted) : c.reasons.map((r) => statusReasonText(lang, r)).join(" · ")}</span>;
  const pass = c.rules.filter((r) => r.outcome === "pass").length;
  const hidden = c.rules.filter((r) => r.redacted).length;
  return (
    <span className="rulecount">
      {fmt.int(lang, pass)}/{fmt.int(lang, c.rules.length)}
      {hidden > 0 && <span className="hidden-count" title={t(lang, UI.redacted)}><Lock aria-hidden size={11} strokeWidth={2.5} />{fmt.int(lang, hidden)}</span>}
    </span>
  );
}

// ---------- the workspace ----------

export function Workspace({ view, search }: { view: WorkspaceView; search: Search }) {
  const lang = search.lang;
  const navigate = useNavigate({ from: "/" });
  const set = (patch: Partial<Search>, replace = true) => navigate({ search: (prev) => ({ ...prev, ...patch }), replace });
  const [lit, setLit] = useState<number | null>(null);

  const recs = view.set.recommendations;
  const bySku = useMemo(() => new Map(recs.map((r) => [r.skuId, r])), [recs]);

  // Listing order: preferred action groups (rank, then unranked), then SKUs with no action.
  const sections = useMemo(() => {
    const groups = view.set.shortlist.map((g) => ({
      group: g,
      summary: view.groups.find((s) => s.action === g.action),
      rows: [...g.ranked.map((c) => ({ rec: bySku.get(c.skuId)!, rank: c.rank, tied: c.tied, ranked: true })),
        ...g.unranked.map((id) => ({ rec: bySku.get(id)!, rank: null, tied: false, ranked: false }))],
    }));
    const noAction = recs.filter((r) => r.action === null)
      .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || (a.skuId < b.skuId ? -1 : 1));
    return { groups, noAction };
  }, [view, recs, bySku]);

  const readingOrder = useMemo(() => [...sections.groups.flatMap((g) => g.rows.map((r) => r.rec)), ...sections.noAction], [sections]);
  /** A column whose every cell is redacted says so once, in its header (nothing labeled twice). */
  const redactedColumns = useMemo(() => new Set(LISTING_METRICS.filter((m) => readingOrder.length > 0 && readingOrder.every((r) => r.facts.find((f) => f.metric === m)?.redacted))), [readingOrder]);
  const marks = useMemo(() => buildMarks(readingOrder), [readingOrder]);
  const selected = (search.sku ? bySku.get(search.sku) : undefined) ?? readingOrder[0];
  const windowEnd = new Date(Date.parse(view.set.window!.end) - 1).toISOString();

  return (
    <div className="app">
      <nav className="rail" aria-label={t(lang, UI.product)}>
        <div className="brand"><span className="brand-mark" aria-hidden>AI</span><span className="nav-label">{t(lang, UI.product)}</span></div>
        <ul>
          <li><a className="nav on" aria-current="page" href="#top" title={t(lang, UI.navAsk)}><MessageSquareText aria-hidden size={18} /><span className="nav-label">{t(lang, UI.navAsk)}</span></a></li>
          {([[PackageSearch, UI.navExplorer], [Activity, UI.navHealth], [History, UI.navHistory]] as const).map(([Icon, label]) => (
            <li key={label.en}><span className="nav off" aria-disabled="true" title={`${t(lang, label)} · ${t(lang, UI.navSoon)}`}><Icon aria-hidden size={18} /><span className="nav-label">{t(lang, label)}</span><small>{t(lang, UI.navSoon)}</small></span></li>
          ))}
        </ul>
      </nav>

      <main className="main" id="top">
        <header className="head">
          <div className="head-text">
            <h1>{t(lang, UI.question)}</h1>
            <dl className="meta">
              <div><dt>{t(lang, UI.window)}</dt><dd>{fmt.date(lang, view.set.window!.start)} – {fmt.date(lang, windowEnd)}</dd></div>
              <div><dt>{t(lang, UI.evaluated)}</dt><dd>{fmt.dateTime(lang, view.evaluatedAt)}</dd></div>
              <div><dt>{t(lang, UI.evidence)}</dt><dd>{t(lang, UI.internalOnly)}</dd></div>
              <div><dt>{t(lang, UI.objective)}</dt><dd>{view.set.objective ?? t(lang, UI.objectiveUnspecified)}</dd></div>
            </dl>
            <p className="synthetic">{t(lang, UI.synthetic)}</p>
          </div>
          <div className="controls">
            <div className="segmented" role="group" aria-label={t(lang, UI.language)}>
              {(["th", "en"] as const).map((l) => (
                <button key={l} type="button" aria-pressed={lang === l} onClick={() => set({ lang: l })}>{l.toUpperCase()}</button>
              ))}
            </div>
            <fieldset className="demo">
              <legend>{t(lang, UI.demo)}</legend>
              <label>{t(lang, UI.viewer)}
                <select value={search.clearance} onChange={(e) => set({ clearance: e.target.value as Search["clearance"] })}>
                  <option value="internal">{t(lang, UI.clearance_internal)}</option>
                  <option value="confidential">{t(lang, UI.clearance_confidential)}</option>
                </select>
              </label>
              <label className="check"><input type="checkbox" checked={search.approve} onChange={(e) => set({ approve: e.target.checked })} />{t(lang, UI.canApprove)}</label>
              <p>{t(lang, UI.demoNote)}</p>
            </fieldset>
          </div>
        </header>

        <div className="listing-scroll">
          <table className="listing">
            <thead>
              <tr>
                <th scope="col" className="c-rank">{t(lang, UI.rank)}</th>
                <th scope="col" className="c-sku">{t(lang, UI.sku)}</th>
                <th scope="col" className="c-status">{t(lang, UI.status)}</th>
                {LISTING_METRICS.map((m) => (
                  <th key={m} scope="col" className="num">{t(lang, METRIC[m])}{redactedColumns.has(m) && <span className="th-redacted"><Lock aria-hidden size={11} strokeWidth={2.5} />{t(lang, UI.redacted)}</span>}</th>
                ))}
                <th scope="col" className="num">{t(lang, UI.rules)}</th>
              </tr>
            </thead>
            {sections.groups.map(({ group, summary, rows }) => (
              <tbody key={group.action}>
                <tr className="sector">
                  <th colSpan={8} scope="rowgroup">
                    <span className="sector-name">{t(lang, ACTION[group.action])}</span>
                    {summary && <span className="sector-fit">{t(lang, UI.ofPass, { n: fmt.int(lang, summary.eligible), m: fmt.int(lang, summary.total) })}</span>}
                    {summary && summary.criteria.length > 0 && !group.rankWithheld && (
                      <span className="sector-sort">{t(lang, UI.sortedBy)} {summary.criteria.map((c) => `${t(lang, METRIC[c.metric])} ${t(lang, DIRECTION[c.direction])}`).join(" · ")}</span>
                    )}
                    {group.rankWithheld && <span className="sector-sort"><Lock aria-hidden size={12} />{t(lang, UI.rankWithheld)}</span>}
                  </th>
                </tr>
                {rows.length === 0 && <tr className="empty"><td colSpan={8}>{t(lang, UI.noneForAction)}</td></tr>}
                {rows.map(({ rec, rank, tied, ranked }) => (
                  <Row key={rec.skuId} rec={rec} lang={lang} marks={marks} lit={lit} setLit={setLit} selected={selected?.skuId === rec.skuId} redactedColumns={redactedColumns}
                    onSelect={() => set({ sku: rec.skuId }, false)}
                    rankCell={rank !== null ? <span className="rank">{fmt.int(lang, rank)}{tied && <small>=</small>}</span> : <span className="unranked">{ranked ? "" : t(lang, UI.notRanked)}</span>}
                    rulesCell={ruleCount(rec, rec.action, lang)} />
                ))}
              </tbody>
            ))}
            {sections.noAction.length > 0 && <tbody>
              <tr className="sector sector-none">
                <th colSpan={8} scope="rowgroup"><span className="sector-name">{t(lang, UI.noAction)}</span><span className="sector-fit">{t(lang, UI.noActionNote)}</span></th>
              </tr>
              {sections.noAction.map((rec) => (
                <Row key={rec.skuId} rec={rec} lang={lang} marks={marks} lit={lit} setLit={setLit} selected={selected?.skuId === rec.skuId} redactedColumns={redactedColumns}
                  onSelect={() => set({ sku: rec.skuId }, false)} rankCell={<span className="unranked" />}
                  rulesCell={<span className="reason-short">{rec.statusReasons[0] ? statusReasonText(lang, rec.statusReasons[0]) : ""}</span>} />
              ))}
            </tbody>}
          </table>
        </div>

        <section className="footnotes" aria-label={t(lang, UI.sources)}>
          <h2>{t(lang, UI.sources)}</h2>
          <ol>
            {[...marks.values()].map((m) => (
              <li key={m.n} id={`fn-${m.n}`} className={lit === m.n ? "lit" : ""} tabIndex={0}
                onMouseEnter={() => setLit(m.n)} onMouseLeave={() => setLit(null)} onFocus={() => setLit(m.n)} onBlur={() => setLit(null)}>
                <span className="fn-n">{m.n}</span>
                <span>{(m.sourceId && view.sources[m.sourceId]?.name) ?? m.sourceId} · {m.file} · {t(lang, UI.lines, { n: fmt.int(lang, m.lines.size) })}{m.ingestedAt ? ` · ${t(lang, UI.ingested)} ${fmt.dateTime(lang, m.ingestedAt)}` : ""}</span>
              </li>
            ))}
            {marks.size === 0 && <li className="muted">{t(lang, UI.redacted)}</li>}
          </ol>
          <p className="policies">{t(lang, UI.policies)}: {view.policies.promotion} · {view.policies.ranking} · {view.policies.recommendation}</p>
        </section>
      </main>

      <Sheet rec={selected} view={view} search={search} marks={marks} lit={lit} setLit={setLit} />
    </div>
  );
}

function Row(props: {
  rec: Recommendation; lang: Lang; marks: Map<string, Mark>; lit: number | null; setLit: (n: number | null) => void;
  selected: boolean; onSelect: () => void; rankCell: React.ReactNode; rulesCell: React.ReactNode; redactedColumns: Set<MetricId>;
}) {
  const { rec, lang } = props;
  const size = rec.identity.attributes.screenSizeInches;
  return (
    <tr className={props.selected ? "sel" : undefined} onClick={props.onSelect}>
      <td className="c-rank">{props.rankCell}</td>
      <td className="c-sku">
        <button type="button" className="sku" aria-current={props.selected ? "true" : undefined} onClick={(e) => { e.stopPropagation(); props.onSelect(); }}>
          {rec.identity.merchantSku ?? rec.skuId}
        </button>
        <span className="model">{rec.identity.brandName} · {rec.identity.modelName}{size !== undefined ? ` · ${size}"` : ""}</span>
      </td>
      <td className="c-status"><StatusFlag status={rec.status} lang={lang} /></td>
      {LISTING_METRICS.map((m) => (
        <td key={m} className="num"><FactValue fact={rec.facts.find((f) => f.metric === m)} lang={lang} marks={props.marks} lit={props.lit} setLit={props.setLit} compactRedaction={props.redactedColumns.has(m)} /></td>
      ))}
      <td className="num">{props.rulesCell}</td>
    </tr>
  );
}

// ---------- the SKU sheet ----------

function RuleLine({ rule, lang }: { rule: RuleResultView; lang: Lang }) {
  const label = rule.kind === "metric_threshold" && rule.metric
    ? t(lang, METRIC[rule.metric.id as MetricId])
    : rule.kind === "exclusion" ? t(lang, UI.ruleExclusionName) : t(lang, UI.ruleStatusName);
  const outcome = rule.outcome === "pass" ? UI.rulePass : rule.outcome === "fail" ? UI.ruleFail : rule.outcome === "unknown" ? UI.ruleUnknown : UI.ruleRedacted;
  const threshold = rule.threshold
    ? ` ${rule.threshold.comparator === "gte" ? "≥" : "≤"} ${rule.threshold.unit === "ratio" ? fmt.percent(lang, rule.threshold.value) : fmt.int(lang, rule.threshold.value)}`
    : "";
  return (
    <li className={`rule r-${rule.outcome}`}>
      <span className="rule-label">{label}{threshold}</span>
      <span className="rule-outcome">{rule.redacted && <Lock aria-hidden size={11} />}{t(lang, outcome)}</span>
      {rule.reasons.length > 0 && <span className="rule-why">{rule.reasons.map((r) => ruleReasonText(lang, r)).join(" · ")}</span>}
    </li>
  );
}

function Sheet({ rec, view, search, marks, lit, setLit }: { rec: Recommendation | undefined; view: WorkspaceView; search: Search; marks: Map<string, Mark>; lit: number | null; setLit: (n: number | null) => void }) {
  const lang = search.lang;
  const router = useRouter();
  const submit = useServerFn(submitDecision);
  const [rationale, setRationale] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  if (!rec) return <aside className="sheet"><p className="muted">{t(lang, UI.selectHint)}</p></aside>;
  const current = view.decisions.find((d) => d.recommendationId === rec.id);
  const size = rec.identity.attributes.screenSizeInches;
  const year = rec.identity.attributes.modelYear;
  const orderedConstraints = [...rec.constraints].sort((a, b) => (a.action === rec.action ? -1 : b.action === rec.action ? 1 : 0));

  const record = async (decision: DecisionKind) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await submit({ data: { recommendationId: rec.id, decision, rationale, canApprove: search.approve } });
      if (res.ok) {
        setMessage({ kind: "ok", text: `${t(lang, UI.recorded)}: ${t(lang, DECISION[decision])}` });
        setRationale("");
        await router.invalidate();
      } else {
        setMessage({ kind: "error", text: t(lang, REFUSAL[res.reason]) });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="sheet" aria-labelledby="sheet-title">
      <h2 id="sheet-title">{rec.identity.merchantSku ?? rec.skuId}</h2>
      <p className="identity">{rec.identity.brandName} · {rec.identity.modelName}{size !== undefined ? ` · ${size}"` : ""}{year !== undefined ? ` · ${year}` : ""}</p>
      <p className="verdict"><StatusFlag status={rec.status} lang={lang} />{rec.action && <strong>{t(lang, ACTION[rec.action])}</strong>}</p>

      {rec.status !== "recommended" && (
        <section className="block">
          <h3>{t(lang, UI.missing)}</h3>
          <ul className="reasons">
            {rec.statusReasons.map((r) => <li key={r}>{statusReasonText(lang, r)}</li>)}
          </ul>
          {rec.missing.length > 0 && (
            <ul className="next">
              {[...new Set(rec.missing.flatMap((m) => m.nextSteps))].map((n) => <li key={n}><ArrowRight aria-hidden size={12} strokeWidth={2.25} />{t(lang, NEXT_STEP[n])}</li>)}
            </ul>
          )}
        </section>
      )}

      <section className="block">
        <h3>{t(lang, UI.facts)}</h3>
        <table className="facts">
          <tbody>
            {SHEET_METRICS.map((m) => {
              const fact = rec.facts.find((f) => f.metric === m);
              return (
                <tr key={m}>
                  <th scope="row">{t(lang, METRIC[m])}</th>
                  <td className="num"><FactValue fact={fact} lang={lang} marks={marks} lit={lit} setLit={setLit} /></td>
                  <td className="asof">{fact?.dataAsOf && !fact.redacted ? `${t(lang, UI.asOf)} ${fmt.date(lang, fact.dataAsOf)}` : ""}{fact ? ` · ${t(lang, UI.formula)} v${fact.version}` : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="block">
        <h3>{t(lang, UI.constraints)}</h3>
        {orderedConstraints.map((c) => (
          <div key={c.action} className={`constraint${c.action === rec.action ? " chosen" : ""}`}>
            <div className="constraint-head">
              <span className="constraint-action">{t(lang, ACTION[c.action])}{c.action === rec.action && <small> · {t(lang, UI.chosen)}</small>}</span>
              <span className={`verdict-tag v-${c.verdict}`}>{t(lang, VERDICT[c.verdict])}</span>
            </div>
            {c.rules.length > 0 && <ul className="rules">{c.rules.map((r) => <RuleLine key={r.ruleId} rule={r} lang={lang} />)}</ul>}
            {c.rules.length === 0 && c.reasons.length > 0 && <p className="muted small">{c.reasons.map((r) => statusReasonText(lang, r)).join(" · ")}</p>}
          </div>
        ))}
      </section>

      <section className="block">
        <h3>{t(lang, UI.confidence)}</h3>
        <ul className="plain">
          <li>{t(lang, UI.confEntity)}</li><li>{t(lang, UI.confRetrieval)}</li><li>{t(lang, UI.confModel)}</li><li>{t(lang, UI.confQuality)}</li>
        </ul>
      </section>

      <section className="block decide">
        <h3>{t(lang, UI.decide)}</h3>
        {current && (
          <p className="current">{t(lang, UI.current)}: <strong>{t(lang, DECISION[current.decision])}</strong> · {fmt.dateTime(lang, current.decidedAt)}<br /><span className="muted">{t(lang, UI.outcome)}</span></p>
        )}
        <label className="rationale">{t(lang, UI.rationale)}
          <textarea value={rationale} onChange={(e) => setRationale(e.target.value)} rows={3} placeholder={t(lang, UI.rationalePlaceholder)} />
        </label>
        <div className="buttons">
          <button type="button" className="primary" disabled={busy || rec.status !== "recommended" || !search.approve} onClick={() => record("approve")}>{t(lang, DECISION.approve)}</button>
          <button type="button" disabled={busy || !search.approve} onClick={() => record("reject")}>{t(lang, DECISION.reject)}</button>
          <button type="button" disabled={busy} onClick={() => record("request_more_data")}>{t(lang, DECISION.request_more_data)}</button>
        </div>
        <p className="muted small" role="status">{busy ? t(lang, UI.saving) : message ? <span className={message.kind}>{message.text}</span> : null}</p>
        <p className="muted small">{t(lang, UI.decisionNote)}</p>
      </section>
    </aside>
  );
}
