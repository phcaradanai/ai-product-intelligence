import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ChevronRight, Database, Lock, Tv } from "lucide-react";
import type { Recommendation } from "../../../../packages/recommendation/src/index.ts";
import type { WorkspaceView } from "../server/pipeline.ts";
import { ACTION, DIRECTION, fmt, METRIC, NEXT_STEP, STATUS, t, UI } from "../i18n.ts";
import type { Lang } from "../i18n.ts";
import type { Search } from "../search.ts";
import { FactValue, ruleLabel, StatusChip, statusReasonText, TvIllustration } from "./parts.tsx";
import { orderRecs, sourcesUsed, statusCounts } from "./model.ts";
import type { Ordered } from "./model.ts";
import { Shell } from "./Shell.tsx";

/**
 * Follow-up intents. With no LLM yet, every question is a preset whose answer is composed from the
 * same structured recommendation set the dashboard shows — nothing is generated or inferred.
 */
type Intent = "answer" | "review" | "missing" | "blocked" | "sources";

const noMarks = new Map();
const noop = () => {};

export function Chat({ view, search }: { view: WorkspaceView; search: Search }) {
  const lang = search.lang;
  const ordered = useMemo(() => orderRecs(view), [view]);
  const counts = useMemo(() => statusCounts(view), [view]);
  const [thread, setThread] = useState<Intent[]>(["answer"]);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (thread.length > 1) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [thread.length]);
  // A new data set or clearance starts a fresh thread.
  useEffect(() => { setThread(["answer"]); }, [view]);

  const ask = (intent: Intent) => setThread((th) => [...th, intent]);
  const chips: [Intent, { th: string; en: string }, boolean][] = [
    ["review", UI.chipReview, counts.review_required > 0],
    ["missing", UI.chipMissing, counts.insufficient_data > 0],
    ["blocked", UI.chipBlocked, counts.blocked > 0],
    ["sources", UI.chipSources, true],
  ];
  const question: Record<Intent, { th: string; en: string }> = {
    answer: UI.question, review: UI.chipReview, missing: UI.chipMissing, blocked: UI.chipBlocked, sources: UI.chipSources,
  };

  return (
    <Shell page="chat" view={view} search={search}>
      <section className="chat" aria-label={t(lang, UI.advisor)}>
        <div className="thread" role="log" aria-live="polite">
          {thread.map((intent, i) => (
            <div key={i} className="turn">
              <p className="bubble-q">{t(lang, question[intent])}</p>
              <div className="bubble-a surface">
                <span className="bubble-avatar" aria-hidden><Tv size={14} /></span>
                <Answer intent={intent} view={view} ordered={ordered} search={search} onAsk={ask} />
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <div className="bar-dock bar-bottom composer-dock">
        <div className="composer glass">
          <p className="composer-label">{t(lang, UI.chatFollowUp)}</p>
          <div className="chips">
            {chips.filter(([, , show]) => show).map(([intent, label]) => (
              <button key={intent} type="button" className="chip-btn" onClick={() => ask(intent)}>{t(lang, label)}</button>
            ))}
          </div>
          <p className="hint">{t(lang, UI.chatNoLlm)}</p>
        </div>
        </div>
      </section>
    </Shell>
  );
}

function SkuRow({ o, search, children }: { o: Ordered; search: Search; children?: React.ReactNode }) {
  const lang = search.lang;
  const v = o.rec.identity.attributes.screenSizeInches;
  return (
    <li>
      <Link to="/dashboard" search={{ ...search, sku: o.rec.skuId }} className="answer-row" title={t(lang, UI.openInDashboard)}>
        <span className="answer-rank">{o.withheld ? <Lock aria-label={t(lang, UI.rankWithheld)} size={13} /> : o.rank !== null ? fmt.int(lang, o.rank) : ""}</span>
        <TvIllustration inches={typeof v === "number" ? v : undefined} lang={lang} maxWidth={56} decorative />
        <span className="answer-sku">{o.rec.identity.merchantSku}{children ?? <small>{o.rec.action ? t(lang, ACTION[o.rec.action]) : ""}</small>}</span>
        <span className="answer-fig"><FactValue fact={o.rec.facts.find((f) => f.metric === "stock_cover_days")} lang={lang} marks={noMarks} onOpen={noop} compact /></span>
        <ChevronRight aria-hidden size={16} className="answer-go" />
      </Link>
    </li>
  );
}

function Answer({ intent, view, ordered, search, onAsk }: { intent: Intent; view: WorkspaceView; ordered: Ordered[]; search: Search; onAsk: (i: Intent) => void }) {
  const lang = search.lang;
  const of = (status: Recommendation["status"]) => ordered.filter((o) => o.rec.status === status);
  const internalOnly = <p className="badge"><Database aria-hidden size={13} />{t(lang, UI.internalOnly)}</p>;

  if (intent === "answer") {
    const recommended = of("recommended");
    const promote = recommended.filter((o) => o.rec.action !== "hold");
    const hold = recommended.filter((o) => o.rec.action === "hold");
    const others = ordered.length - recommended.length;
    const group = view.groups.find((g) => g.action === recommended[0]?.rec.action);
    return (
      <>
        <p className="answer">
          {t(lang, UI.answerLead)}: <strong>{promote.length > 0 ? t(lang, UI.answerPromote, { n: fmt.int(lang, promote.length) }) : t(lang, UI.answerNone)}</strong>
          {hold.length > 0 && <> · {t(lang, UI.answerHold, { n: fmt.int(lang, hold.length) })}</>}
          {others > 0 && <> · {t(lang, UI.answerOthers, { n: fmt.int(lang, others) })}</>}
        </p>
        {group && group.criteria.length > 0 && (
          <p className="muted small">{t(lang, UI.sortedBy)} {group.criteria.map((c) => `${t(lang, METRIC[c.metric])} ${t(lang, DIRECTION[c.direction])}`).join(" · ")}</p>
        )}
        <ol className="answer-list">{recommended.map((o) => <SkuRow key={o.rec.skuId} o={o} search={search} />)}</ol>
        {others > 0 && (
          <div className="status-row">
            {([["review_required", "review"], ["insufficient_data", "missing"], ["blocked", "blocked"]] as const).map(([status, next]) => {
              const n = of(status).length;
              return n > 0 && (
                <button key={status} type="button" className={`filter st-${status}`} onClick={() => onAsk(next)}>
                  {t(lang, STATUS[status])}<span className="count">{fmt.int(lang, n)}</span>
                </button>
              );
            })}
          </div>
        )}
        {internalOnly}
      </>
    );
  }

  if (intent === "sources") {
    return (
      <>
        <p className="answer">{t(lang, UI.answerSourcesLead)}</p>
        <ul className="source-list">
          {sourcesUsed(view).map((s) => <li key={s.id}><span className="dot ok" aria-hidden />{s.name}<span className="muted small">{s.ingestedAt ? fmt.dateTime(lang, s.ingestedAt) : ""}</span></li>)}
          <li className="muted"><span className="dot off" aria-hidden />{t(lang, UI.externalNone)}</li>
        </ul>
        <p className="muted small">{t(lang, UI.policies)}: {view.policies.promotion} · {view.policies.ranking} · {view.policies.recommendation}</p>
      </>
    );
  }

  const status = intent === "review" ? "review_required" : intent === "missing" ? "insufficient_data" : "blocked";
  const items = of(status);
  if (items.length === 0) return <p className="answer">{t(lang, UI.noneInStatus)}</p>;
  return (
    <>
      <p className="answer"><StatusChip status={status} lang={lang} size="sm" /> {fmt.int(lang, items.length)}</p>
      <ol className="answer-list">
        {items.map((o) => (
          <SkuRow key={o.rec.skuId} o={o} search={search}>
            <small>{whyText(o.rec, lang)}</small>
            {o.rec.missing.length > 0 && [...new Set(o.rec.missing.flatMap((m) => m.nextSteps))].map((n) => (
              <small key={n} className="next"><ArrowRight aria-hidden size={11} />{t(lang, NEXT_STEP[n])}</small>
            ))}
          </SkuRow>
        ))}
      </ol>
      {internalOnly}
    </>
  );
}

function whyText(rec: Recommendation, lang: Lang): string {
  if (rec.status === "blocked") {
    const failed = [...new Set(rec.constraints.flatMap((c) => c.rules.filter((r) => r.outcome === "fail").map((r) => ruleLabel(r, lang))))];
    return failed.length > 0 ? `${failed.join(" · ")} — ${t(lang, UI.ruleFail)}` : statusReasonText(lang, "rule_failed");
  }
  return rec.statusReasons.filter((r) => r !== "rule_unknown").map((r) => statusReasonText(lang, r)).join(" · ") || statusReasonText(lang, "rule_unknown");
}
