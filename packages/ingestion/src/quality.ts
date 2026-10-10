import { checkDatasetIntegrity } from "../../domain/src/index.ts";
import type { IntegrityIssue } from "../../domain/src/index.ts";
import type { DomainDataset } from "../../domain/src/models.ts";
import type { ImportIssueCode, ImportRun } from "./import.ts";

export interface RunSummary {
  runId: string;
  kind: ImportRun["kind"];
  fileName: string;
  sha256: string;
  status: ImportRun["status"];
  assumeOffset: string | null;
  rowsRead: number;
  rowsAccepted: number;
  rowsUnchanged: number;
  rowsDuplicate: number;
  rowsRejected: number;
  recordsAdded: number;
  issueCounts: Partial<Record<ImportIssueCode, number>>;
}

/**
 * Data problems and coverage gaps only — deliberately no business metric such as margin,
 * stock cover or growth (S2-DEC-13; metrics are MET-01).
 */
export interface QualityReport {
  runs: RunSummary[];
  totals: { runs: number; refusedRuns: number; rowsRead: number; rowsAccepted: number; rowsUnchanged: number; rowsDuplicate: number; rowsRejected: number };
  coverage: {
    activeSkus: number;
    activeSkusWithoutPrice: string[];
    activeSkusWithoutCost: string[];
    activeSkusWithoutInventory: string[];
    activeSkusWithoutSales: string[];
  };
  integrityIssues: IntegrityIssue[];
}

export function buildQualityReport(dataset: DomainDataset, runs: readonly ImportRun[]): QualityReport {
  const summaries = runs.map((r): RunSummary => {
    const issueCounts: Partial<Record<ImportIssueCode, number>> = {};
    for (const i of r.issues) issueCounts[i.code] = (issueCounts[i.code] ?? 0) + 1;
    return {
      runId: r.id, kind: r.kind, fileName: r.fileName, sha256: r.sha256, status: r.status, assumeOffset: r.assumeOffset,
      rowsRead: r.rowsRead, rowsAccepted: r.rowsAccepted, rowsUnchanged: r.rowsUnchanged, rowsDuplicate: r.rowsDuplicate, rowsRejected: r.rowsRejected,
      recordsAdded: r.recordsAdded, issueCounts,
    };
  });
  const sum = (k: "rowsRead" | "rowsAccepted" | "rowsUnchanged" | "rowsDuplicate" | "rowsRejected") => runs.reduce((n, r) => n + r[k], 0);
  const active = dataset.skus.filter((s) => s.status === "active").map((s) => s.id);
  const without = (facts: readonly { skuId: string }[]) => {
    const covered = new Set(facts.map((f) => f.skuId));
    return active.filter((id) => !covered.has(id));
  };
  return {
    runs: summaries,
    totals: {
      runs: runs.length, refusedRuns: runs.filter((r) => r.status === "refused").length,
      rowsRead: sum("rowsRead"), rowsAccepted: sum("rowsAccepted"), rowsUnchanged: sum("rowsUnchanged"), rowsDuplicate: sum("rowsDuplicate"), rowsRejected: sum("rowsRejected"),
    },
    coverage: {
      activeSkus: active.length,
      activeSkusWithoutPrice: without(dataset.prices),
      activeSkusWithoutCost: without(dataset.costs),
      activeSkusWithoutInventory: without(dataset.inventory),
      activeSkusWithoutSales: without(dataset.sales),
    },
    integrityIssues: checkDatasetIntegrity(dataset),
  };
}
