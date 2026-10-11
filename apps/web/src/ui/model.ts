import type { Recommendation, SkuStatus } from "../../../../packages/recommendation/src/index.ts";
import type { WorkspaceView } from "../server/pipeline.ts";

export type Ordered = { rec: Recommendation; rank: number | null; tied: boolean; withheld: boolean };
export const STATUS_ORDER: SkuStatus[] = ["recommended", "review_required", "insufficient_data", "blocked"];

/** Reading order shared by both pages: preferred actions by rank, then unranked, then SKUs without an action. */
export function orderRecs(view: WorkspaceView): Ordered[] {
  const bySku = new Map(view.set.recommendations.map((r) => [r.skuId, r]));
  const seen = new Set<string>();
  const out: Ordered[] = [];
  for (const g of view.set.shortlist) {
    for (const c of g.ranked) { seen.add(c.skuId); out.push({ rec: bySku.get(c.skuId)!, rank: c.rank, tied: c.tied, withheld: g.rankWithheld }); }
    for (const id of g.unranked) { seen.add(id); out.push({ rec: bySku.get(id)!, rank: null, tied: false, withheld: false }); }
  }
  view.set.recommendations.filter((r) => !seen.has(r.skuId))
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || (a.skuId < b.skuId ? -1 : 1))
    .forEach((rec) => out.push({ rec, rank: null, tied: false, withheld: false }));
  return out;
}

export function statusCounts(view: WorkspaceView): Record<SkuStatus, number> {
  return Object.fromEntries(STATUS_ORDER.map((s) => [s, view.set.recommendations.filter((r) => r.status === s).length])) as Record<SkuStatus, number>;
}

/** Internal sources behind the visible figures, with their latest ingestion time (data freshness). */
export function sourcesUsed(view: WorkspaceView): { id: string; name: string; ingestedAt: string | null }[] {
  const latest = new Map<string, string | null>();
  for (const rec of view.set.recommendations) {
    for (const fact of rec.facts) {
      for (const s of fact.sources) {
        if (!s.sourceId) continue;
        const prev = latest.get(s.sourceId) ?? null;
        if (!latest.has(s.sourceId) || (s.ingestedAt && (!prev || s.ingestedAt > prev))) latest.set(s.sourceId, s.ingestedAt);
      }
    }
  }
  return [...latest.entries()].map(([id, ingestedAt]) => ({ id, name: view.sources[id]?.name ?? id, ingestedAt }));
}
