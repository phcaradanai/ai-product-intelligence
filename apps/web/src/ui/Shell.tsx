import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Activity, History, LayoutDashboard, Lock, MessageSquareText, Search as SearchIcon, SlidersHorizontal, Tv } from "lucide-react";
import type { WorkspaceView } from "../server/pipeline.ts";
import { fmt, t, UI } from "../i18n.ts";
import type { Lang } from "../i18n.ts";
import type { Search } from "../search.ts";
import { sourcesUsed } from "./model.ts";

type Page = "chat" | "dashboard";

/**
 * Shared shell: the glass sidebar (page navigation + data freshness) and the glass toolbar.
 * Glass is used only for these control and navigation layers; page content stays on solid surfaces.
 */
export function Shell({ page, view, search, toolbarSearch, children }: {
  page: Page; view: WorkspaceView; search: Search;
  toolbarSearch?: { query: string; setQuery: (q: string) => void };
  children: ReactNode;
}) {
  const lang = search.lang;
  const windowEnd = new Date(Date.parse(view.set.window!.end) - 1).toISOString();
  return (
    <div className={`app app-${page}`}>
      <Sidebar page={page} search={search} view={view} />
      <main className="main" id="top">
        <Toolbar lang={lang} search={search} toolbarSearch={toolbarSearch}
          windowLabel={`${fmt.date(lang, view.set.window!.start)} – ${fmt.date(lang, windowEnd)}`} />
        {children}
      </main>
    </div>
  );
}

function Sidebar({ page, search, view }: { page: Page; search: Search; view: WorkspaceView }) {
  const lang = search.lang;
  const sources = sourcesUsed(view);
  const links: [Page, "/" | "/dashboard", typeof MessageSquareText, { th: string; en: string }][] = [
    ["chat", "/", MessageSquareText, UI.navChat],
    ["dashboard", "/dashboard", LayoutDashboard, UI.navDashboard],
  ];
  return (
    <nav className="sidebar glass" aria-label={t(lang, UI.product)}>
      <div className="brand"><span className="brand-mark" aria-hidden><Tv size={16} /></span><span className="nav-label">{t(lang, UI.product)}</span></div>
      <ul>
        {links.map(([id, to, Icon, label]) => (
          <li key={id}>
            <Link to={to} search={{ ...search, sku: id === "dashboard" ? search.sku : undefined }} className={`nav${page === id ? " on" : ""}`}
              aria-current={page === id ? "page" : undefined} title={t(lang, label)}>
              <Icon aria-hidden size={18} /><span className="nav-label">{t(lang, label)}</span>
            </Link>
          </li>
        ))}
        {([[Activity, UI.navHealth], [History, UI.navHistory]] as const).map(([Icon, label]) => (
          <li key={label.en}>
            <span className="nav off" aria-disabled="true" title={`${t(lang, label)} · ${t(lang, UI.navSoon)}`}>
              <Icon aria-hidden size={18} /><span className="nav-label">{t(lang, label)}<small>{t(lang, UI.navSoon)}</small></span>
            </span>
          </li>
        ))}
      </ul>

      <section className="freshness" aria-label={t(lang, UI.freshness)}>
        <h3>{t(lang, UI.freshness)}</h3>
        <ul>
          {sources.map((s) => (
            <li key={s.id} title={s.ingestedAt ? fmt.dateTime(lang, s.ingestedAt) : undefined}>
              <span className="dot ok" aria-hidden /><span className="fresh-name">{s.name}<small>{s.ingestedAt ? fmt.dateTime(lang, s.ingestedAt) : ""}</small></span>
            </li>
          ))}
          {sources.length === 0 && <li className="muted"><Lock aria-hidden size={12} /><span className="fresh-name">{t(lang, UI.redacted)}</span></li>}
          <li className="muted"><span className="dot off" aria-hidden /><span className="fresh-name">{t(lang, UI.externalNone)}</span></li>
        </ul>
      </section>
    </nav>
  );
}

function Toolbar({ lang, search, toolbarSearch, windowLabel }: {
  lang: Lang; search: Search; toolbarSearch: { query: string; setQuery: (q: string) => void } | undefined; windowLabel: string;
}) {
  const navigate = useNavigate();
  const set = (patch: Partial<Search>) => navigate({ to: ".", search: { ...search, ...patch }, replace: true });
  const [demoOpen, setDemoOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!demoOpen) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setDemoOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDemoOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [demoOpen]);

  return (
    <div className="bar-dock bar-top">
    <div className="toolbar glass">
      {toolbarSearch
        ? (
          <label className="searchbox">
            <SearchIcon aria-hidden size={16} />
            <input type="search" value={toolbarSearch.query} onChange={(e) => toolbarSearch.setQuery(e.target.value)} placeholder={t(lang, UI.search)} aria-label={t(lang, UI.search)} />
          </label>
        )
        : <span className="toolbar-title">{t(lang, UI.advisor)}</span>}
      <span className="window-chip" title={t(lang, UI.window)}>{windowLabel}</span>
      <div className="segmented" role="group" aria-label={t(lang, UI.language)}>
        {(["th", "en"] as const).map((l) => (
          <button key={l} type="button" aria-pressed={lang === l} onClick={() => set({ lang: l })}>{l.toUpperCase()}</button>
        ))}
      </div>
      <div className="demo" ref={ref}>
        <button type="button" className="tool-btn" aria-expanded={demoOpen} aria-haspopup="dialog" onClick={() => setDemoOpen((o) => !o)}>
          <SlidersHorizontal aria-hidden size={16} /><span>{t(lang, UI.demo)}</span>
          {search.clearance === "internal" && <Lock aria-hidden size={13} />}
        </button>
        {demoOpen && (
          <div className="popover surface" role="dialog" aria-label={t(lang, UI.demo)}>
            <label>{t(lang, UI.viewer)}
              <select value={search.clearance} onChange={(e) => set({ clearance: e.target.value as Search["clearance"] })}>
                <option value="internal">{t(lang, UI.clearance_internal)}</option>
                <option value="confidential">{t(lang, UI.clearance_confidential)}</option>
              </select>
            </label>
            <label>{t(lang, UI.scenario)}
              <select value={search.scenario} onChange={(e) => set({ scenario: e.target.value as Search["scenario"], sku: undefined })}>
                <option value="sample">{t(lang, UI.scenario_sample)}</option>
                <option value="edge">{t(lang, UI.scenario_edge)}</option>
              </select>
            </label>
            <label className="check"><input type="checkbox" checked={search.approve} onChange={(e) => set({ approve: e.target.checked })} />{t(lang, UI.canApprove)}</label>
            <p className="hint">{t(lang, UI.demoNote)}</p>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
