import { useEffect, useMemo, useState } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Check, Database, Lock } from "lucide-react";
import type { MetricId } from "../../../../packages/metrics/src/index.ts";
import type { DecisionKind, Recommendation, SkuStatus } from "../../../../packages/recommendation/src/index.ts";
import type { WorkspaceView } from "../server/pipeline.ts";
import { submitDecision } from "../server/functions.ts";
import { ACTION, DECISION, DIRECTION, fmt, METRIC, NEXT_STEP, REFUSAL, STATUS, t, UI, VERDICT } from "../i18n.ts";
import type { Lang } from "../i18n.ts";
import type { Search } from "../search.ts";
import { buildMarks, FactValue, ruleLabel, ruleReasonText, StatusChip, statusReasonText, TvIllustration } from "./parts.tsx";
import type { Mark } from "./parts.tsx";
import { orderRecs, STATUS_ORDER, statusCounts } from "./model.ts";
import { Shell } from "./Shell.tsx";
// Pure classification table (no server code).
import { UNKNOWN_REASON_CLASS } from "../../../../packages/recommendation/src/classes.ts";

type Tab = "overview" | "rules" | "alternatives" | "evidence";
type Filter = "all" | SkuStatus;

const KEY_FACTS: MetricId[] = ["units_sold", "available_stock", "stock_cover_days", "realized_gross_margin_ratio"];
const ALL_FACTS: MetricId[] = ["units_sold", "gross_revenue", "available_stock", "stock_cover_days", "realized_gross_margin_ratio"];

const inches = (rec: Recommendation) => {
  const v = rec.identity.attributes.screenSizeInches;
  return typeof v === "number" ? v : undefined;
};

/** Product dashboard: status filters, product cards, the focus panel and the floating decision bar. */
export function Dashboard({ view, search }: { view: WorkspaceView; search: Search }) {
  const lang = search.lang;
  const navigate = useNavigate({ from: "/dashboard" });
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [litMark, setLitMark] = useState<number | null>(null);

  const recs = view.set.recommendations;
  const bySku = useMemo(() => new Map(recs.map((r) => [r.skuId, r])), [recs]);
  const ordered = useMemo(() => orderRecs(view), [view]);
  const counts = useMemo(() => statusCounts(view), [view]);
  const q = query.trim().toLowerCase();
  const visible = ordered.filter(({ rec }) =>
    (filter === "all" || rec.status === filter)
    && (q === "" || [rec.identity.merchantSku, rec.identity.modelName, rec.identity.brandName, rec.skuId].some((x) => x?.toLowerCase().includes(q))));

  const marks = useMemo(() => buildMarks(ordered.map((o) => o.rec), ALL_FACTS, view.sources), [ordered, view.sources]);
  const selected = (search.sku ? bySku.get(search.sku) : undefined) ?? visible[0]?.rec ?? ordered[0]?.rec;
  const selectedRank = ordered.find((o) => o.rec.skuId === selected?.skuId);
  const openEvidence = (n: number) => { setTab("evidence"); setLitMark(n); };
  const rankedGroup = view.groups.find((g) => g.criteria.length > 0);
  const basis = rankedGroup ? `${t(lang, ACTION[rankedGroup.action])}: ${rankedGroup.criteria.map((c) => `${t(lang, METRIC[c.metric])} ${t(lang, DIRECTION[c.direction])}`).join(" · ")}` : null;
  const select = (skuId: string) => navigate({ search: (prev) => ({ ...prev, sku: skuId }) });
  // Keep the selected card visible in the horizontal rail (e.g. when the URL selects it).
  useEffect(() => {
    document.querySelector(".rail .card.selected")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selected?.skuId]);

  return (
    <Shell page="dashboard" view={view} search={search} toolbarSearch={{ query, setQuery }}>
      <header className="question">
        <h1>{t(lang, UI.dashboardTitle)}</h1>
        <p className="meta">
          <span>{t(lang, UI.evaluated)} {fmt.dateTime(lang, view.evaluatedAt)}</span>
          <span className="badge"><Database aria-hidden size={13} />{t(lang, UI.internalOnly)}</span>
          <span className="badge badge-quiet">{t(lang, UI.synthetic)}</span>
        </p>
        {basis && <p className="basis">{t(lang, UI.sortedBy)} {basis}</p>}
      </header>

      <div className="filters" role="toolbar" aria-label={t(lang, UI.status)}>
        <button type="button" className={`filter${filter === "all" ? " on" : ""}`} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
          {t(lang, UI.filterAll)} <span className="count">{fmt.int(lang, recs.length)}</span>
        </button>
        {STATUS_ORDER.map((s) => (
          <button key={s} type="button" className={`filter st-${s}${filter === s ? " on" : ""}`} aria-pressed={filter === s} onClick={() => setFilter(s)} disabled={counts[s] === 0}>
            {t(lang, STATUS[s])} <span className="count">{fmt.int(lang, counts[s])}</span>
          </button>
        ))}
      </div>

      <section className="rail" aria-label={t(lang, UI.sku)}>
        {visible.map(({ rec, rank, tied, withheld }) => (
          <ProductCard key={rec.skuId} rec={rec} rank={rank} tied={tied} withheld={withheld} lang={lang} marks={marks} onOpen={openEvidence}
            selected={rec.skuId === selected?.skuId} onSelect={() => select(rec.skuId)} />
        ))}
        {visible.length === 0 && (
          <div className="empty surface">
            <p>{t(lang, UI.noMatch)}</p>
            <button type="button" className="link" onClick={() => { setFilter("all"); setQuery(""); }}>{t(lang, UI.clearFilter)}</button>
          </div>
        )}
      </section>

      {selected && (
        <Focus rec={selected} rank={selectedRank?.rank ?? null} tied={selectedRank?.tied ?? false} view={view} lang={lang}
          marks={marks} tab={tab} setTab={setTab} litMark={litMark} setLitMark={setLitMark} onOpen={openEvidence} />
      )}

      {selected && <DecisionBar rec={selected} view={view} search={search} />}
    </Shell>
  );
}

// ---------- content: product cards ----------

/** One short line per card: the action, or the most specific reason it has none. */
function cardReason(rec: Recommendation, lang: Lang): string {
  if (rec.action) return t(lang, ACTION[rec.action]);
  if (rec.status === "blocked") {
    const failed = [...new Set(rec.constraints.flatMap((c) => c.rules.filter((r) => r.outcome === "fail").map((r) => ruleLabel(r, lang))))];
    return failed.length > 0 ? `${failed.join(" · ")} — ${t(lang, UI.ruleFail)}` : statusReasonText(lang, "rule_failed");
  }
  const specific = rec.statusReasons.find((r) => r !== "rule_unknown") ?? rec.statusReasons[0];
  return specific ? statusReasonText(lang, specific) : "";
}

function ProductCard({ rec, rank, tied, withheld, lang, marks, onOpen, selected, onSelect }: {
  rec: Recommendation; rank: number | null; tied: boolean; withheld: boolean; lang: Lang; marks: Map<string, Mark>; onOpen: (n: number) => void; selected: boolean; onSelect: () => void;
}) {
  const fact = (m: MetricId) => rec.facts.find((f) => f.metric === m);
  return (
    <article className={`card surface${selected ? " selected" : ""}`} onClick={onSelect}>
      <div className="card-top">
        {withheld
          ? <span className="rank rank-withheld" role="img" aria-label={t(lang, UI.rankWithheld)} title={t(lang, UI.rankWithheld)}><Lock aria-hidden size={14} /></span>
          : rank !== null
          ? <span className="rank" title={t(lang, tied ? UI.rankTied : UI.rankLabel, { n: rank })}>{fmt.int(lang, rank)}{tied && <small>=</small>}</span>
          : <span />}
        <StatusChip status={rec.status} lang={lang} size="sm" />
      </div>
      <div className="card-media"><TvIllustration inches={inches(rec)} lang={lang} maxWidth={150} decorative /></div>
      <button type="button" className="card-title" aria-current={selected ? "true" : undefined} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        {rec.identity.merchantSku ?? rec.skuId}
      </button>
      <p className="card-sub">{cardReason(rec, lang)}</p>
      <dl className="card-facts">
        <div><dt>{t(lang, METRIC.stock_cover_days)}</dt><dd><FactValue fact={fact("stock_cover_days")} lang={lang} marks={marks} onOpen={onOpen} compact /></dd></div>
        <div><dt>{t(lang, METRIC.realized_gross_margin_ratio)}</dt><dd><FactValue fact={fact("realized_gross_margin_ratio")} lang={lang} marks={marks} onOpen={onOpen} compact /></dd></div>
      </dl>
    </article>
  );
}

// ---------- content: focus panel ----------

function Focus({ rec, rank, tied, view, lang, marks, tab, setTab, litMark, setLitMark, onOpen }: {
  rec: Recommendation; rank: number | null; tied: boolean; view: WorkspaceView; lang: Lang; marks: Map<string, Mark>;
  tab: Tab; setTab: (t: Tab) => void; litMark: number | null; setLitMark: (n: number | null) => void; onOpen: (n: number) => void;
}) {
  const fact = (m: MetricId) => rec.facts.find((f) => f.metric === m);
  const chosen = rec.constraints.find((c) => c.action === rec.action);
  const blocking = rec.constraints.filter((c) => c.verdict === "blocked").map((c) => ({ action: c.action, rules: c.rules.filter((r) => r.outcome === "fail").map((r) => ruleLabel(r, lang)) }));
  const nextSteps = [...new Set(rec.missing.flatMap((m) => m.nextSteps))];
  const tabs: [Tab, { th: string; en: string }][] = [["overview", UI.tabOverview], ["rules", UI.tabRules], ["alternatives", UI.tabAlternatives], ["evidence", UI.tabEvidence]];

  return (
    <section className="focus surface" aria-labelledby="focus-title">
      <div className="focus-hero">
        <TvIllustration inches={inches(rec)} lang={lang} maxWidth={300} caption align="start" />
        <div className="focus-head">
          <h2 id="focus-title">{rec.identity.merchantSku ?? rec.skuId}</h2>
          <p className="identity">{rec.identity.brandName} · {rec.identity.modelName}</p>
          <div className="verdict">
            <StatusChip status={rec.status} lang={lang} />
            {rec.action && <span className="verdict-action">{t(lang, ACTION[rec.action])}</span>}
            {rank !== null && <span className="verdict-rank">{t(lang, tied ? UI.rankTied : UI.rankLabel, { n: fmt.int(lang, rank) })}</span>}
          </div>

          {rec.status !== "recommended" && (
            <div className={`callout st-${rec.status}`}>
              <strong>{t(lang, rec.status === "blocked" ? UI.blockedWhy : UI.missing)}</strong>
              <ul>
                {rec.status === "blocked"
                  ? blocking.map((b) => <li key={b.action}>{t(lang, ACTION[b.action])} · {b.rules.length > 0 ? b.rules.join(" · ") : <span className="state st-redacted"><Lock aria-hidden size={12} />{t(lang, UI.redacted)}</span>}</li>)
                  : rec.statusReasons.filter((r) => r !== "rule_unknown").map((r) => <li key={r}>{statusReasonText(lang, r)}</li>)}
              </ul>
              {nextSteps.map((n) => <p key={n} className="next"><ArrowRight aria-hidden size={13} />{t(lang, NEXT_STEP[n])}</p>)}
            </div>
          )}

          <dl className="key-facts">
            {KEY_FACTS.map((m) => (
              <div key={m}><dt>{t(lang, METRIC[m])}</dt><dd><FactValue fact={fact(m)} lang={lang} marks={marks} onOpen={onOpen} /></dd></div>
            ))}
          </dl>
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label={rec.identity.merchantSku ?? rec.skuId}>
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls={`panel-${id}`} onClick={() => setTab(id)}>{t(lang, label)}</button>
        ))}
      </div>

      <div className="tab-panel" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "overview" && (
          <>
            <table className="facts">
              <tbody>
                {ALL_FACTS.map((m) => {
                  const f = fact(m);
                  return (
                    <tr key={m}>
                      <th scope="row">{t(lang, METRIC[m])}</th>
                      <td className="num"><FactValue fact={f} lang={lang} marks={marks} onOpen={onOpen} withMarks /></td>
                      <td className="muted small">{f?.dataAsOf && !f.redacted ? `${t(lang, UI.asOf)} ${fmt.date(lang, f.dataAsOf)} · ` : ""}{f ? `${t(lang, UI.formula)} v${f.version}` : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <ul className="confidence">
              <li>{t(lang, UI.confEntity)}</li><li>{t(lang, UI.confRetrieval)}</li><li>{t(lang, UI.confModel)}</li><li>{t(lang, UI.confQuality)}</li>
            </ul>
          </>
        )}

        {tab === "rules" && (
          <div className="rules-list">
            {(chosen ? [chosen, ...rec.constraints.filter((c) => c !== chosen)] : rec.constraints).map((c) => (
              <div key={c.action} className="rule-group">
                <div className="rule-head"><strong>{t(lang, ACTION[c.action])}</strong><span className={`verdict-tag v-${c.verdict}`}>{t(lang, VERDICT[c.verdict])}</span></div>
                {c.rules.length === 0
                  ? <p className="muted small">{c.verdict === "eligible" ? t(lang, UI.unrestricted) : c.reasons.map((r) => statusReasonText(lang, r)).join(" · ")}</p>
                  : (
                    <ul>
                      {c.rules.map((r) => {
                        const unknownClass = r.outcome === "unknown" && r.reasons.every((x) => UNKNOWN_REASON_CLASS[x as keyof typeof UNKNOWN_REASON_CLASS]?.status === "insufficient_data") ? " u-insufficient" : "";
                        const threshold = r.threshold ? ` ${r.threshold.comparator === "gte" ? "≥" : "≤"} ${r.threshold.unit === "ratio" ? fmt.percent(lang, r.threshold.value) : fmt.int(lang, r.threshold.value)}` : "";
                        const outcome = r.outcome === "pass" ? UI.rulePass : r.outcome === "fail" ? UI.ruleFail : r.outcome === "unknown" ? UI.ruleUnknown : UI.ruleRedacted;
                        return (
                          <li key={r.ruleId} className={`rule r-${r.outcome}${unknownClass}`}>
                            <span>{ruleLabel(r, lang)}{threshold}</span>
                            <span className="rule-outcome">{r.redacted && <Lock aria-hidden size={11} />}{t(lang, outcome)}</span>
                            {r.reasons.length > 0 && <span className="rule-why">{r.reasons.map((x) => ruleReasonText(lang, x)).join(" · ")}</span>}
                          </li>
                        );
                      })}
                    </ul>
                  )}
              </div>
            ))}
          </div>
        )}

        {tab === "alternatives" && (
          <ul className="alternatives">
            {rec.constraints.map((c) => (
              <li key={c.action} className={c.action === rec.action ? "chosen" : ""}>
                <span className="alt-action">{t(lang, ACTION[c.action])}{c.action === rec.action && <Check aria-hidden size={14} />}</span>
                <span className={`verdict-tag v-${c.verdict}`}>{t(lang, VERDICT[c.verdict])}</span>
                <span className="muted small">{c.reasons.map((r) => statusReasonText(lang, r)).join(" · ")}</span>
              </li>
            ))}
          </ul>
        )}

        {tab === "evidence" && (
          <>
            <ol className="sources">
              {[...marks.values()].map((m) => (
                <li key={m.n} className={litMark === m.n ? "lit" : ""} tabIndex={0} onFocus={() => setLitMark(m.n)} onMouseEnter={() => setLitMark(m.n)}>
                  <span className="src-n">{m.n}</span>
                  <span>{m.label} · {t(lang, UI.lines, { n: fmt.int(lang, m.lines.size) })}{m.ingestedAt ? ` · ${t(lang, UI.ingested)} ${fmt.dateTime(lang, m.ingestedAt)}` : ""}</span>
                </li>
              ))}
              {marks.size === 0 && <li className="muted">{t(lang, UI.redacted)}</li>}
            </ol>
            <p className="muted small">{t(lang, UI.policies)}: {view.policies.promotion} · {view.policies.ranking} · {view.policies.recommendation}</p>
          </>
        )}
      </div>
    </section>
  );
}

// ---------- glass: floating decision bar ----------

function DecisionBar({ rec, view, search }: { rec: Recommendation; view: WorkspaceView; search: Search }) {
  const lang = search.lang;
  const router = useRouter();
  const submit = useServerFn(submitDecision);
  const [pending, setPending] = useState<DecisionKind | null>(null);
  const [rationale, setRationale] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const current = view.decisions.find((d) => d.recommendationId === rec.id);
  useEffect(() => { setPending(null); setMessage(null); setRationale(""); }, [rec.id]);

  const canAsk: Record<DecisionKind, boolean> = {
    approve: rec.status === "recommended" && search.approve,
    reject: search.approve,
    request_more_data: true,
  };

  const disabledWhy = !search.approve ? t(lang, UI.approvalOff) : rec.status !== "recommended" ? t(lang, UI.onlyRecommended) : null;

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await submit({ data: { recommendationId: rec.id, decision: pending, rationale, canApprove: search.approve, scenario: search.scenario } });
      if (res.ok) {
        setMessage({ kind: "ok", text: `${t(lang, UI.recorded)}: ${t(lang, DECISION[pending])}` });
        setPending(null);
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
    <div className="decision-dock bar-dock bar-bottom">
      {pending && (
        <div className="popover surface decision-pop" role="dialog" aria-label={`${t(lang, DECISION[pending])} · ${rec.identity.merchantSku}`}>
          <label className="rationale">{t(lang, UI.rationale)}
            <textarea value={rationale} onChange={(e) => setRationale(e.target.value)} rows={3} placeholder={t(lang, UI.rationalePlaceholder)} autoFocus />
          </label>
          <div className="pop-actions">
            <button type="button" className="btn" onClick={() => setPending(null)}>{t(lang, UI.cancel)}</button>
            <button type="button" className="btn primary" disabled={busy || rationale.trim() === ""} onClick={confirm}>{busy ? t(lang, UI.saving) : `${t(lang, UI.confirm)} · ${t(lang, DECISION[pending])}`}</button>
          </div>
          <p className="hint">{t(lang, UI.decisionNote)}</p>
        </div>
      )}
      <div className="decision-bar glass">
        <div className="decision-what">
          <span className="muted small">{t(lang, UI.decideFor)}</span>
          <strong>{rec.identity.merchantSku}</strong>
          {message
            ? <span className={`small ${message.kind}`} role="status">{message.text}</span>
            : current ? <span className="small">{t(lang, UI.current)}: {t(lang, DECISION[current.decision])} · {t(lang, UI.outcome)}</span> : null}
          {disabledWhy && <span className="small muted" id="decision-why">{disabledWhy}</span>}
        </div>
        <div className="decision-actions">
          {(["request_more_data", "reject", "approve"] as const).map((k) => (
            <button key={k} type="button" className={`btn${k === "approve" ? " primary" : ""}`} disabled={!canAsk[k] || busy} aria-pressed={pending === k} aria-describedby={!canAsk[k] && disabledWhy ? "decision-why" : undefined} title={!canAsk[k] && disabledWhy ? disabledWhy : undefined}
              onClick={() => { setPending(k); setMessage(null); }}>{t(lang, DECISION[k])}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
