import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseDomainDataset } from "../packages/contracts/src/index.ts";
import { checkDatasetIntegrity } from "../packages/domain/src/index.ts";
import type { DomainDataset } from "../packages/domain/src/models.ts";
import {
  buildQualityReport, importCsv, naturalKeyId, parseCsv, parseInstant, parseMoneyMinor, CsvSyntaxError,
} from "../packages/ingestion/src/index.ts";
import type { ImportKind, ImportOptions, ImportResult, ImportRun } from "../packages/ingestion/src/index.ts";
import { registryDataset, sampleFiles, SAMPLE_NOW } from "./fixtures/csv/registry.ts";

const sample = (file: string): Buffer => readFileSync(new URL(`./fixtures/csv/${file}`, import.meta.url));

const run = (dataset: DomainDataset, kind: ImportKind, sourceId: string, content: string | Uint8Array, extra: Partial<ImportOptions> = {}): ImportResult =>
  importCsv(dataset, { kind, sourceId, fileName: `${kind}.csv`, content, now: SAMPLE_NOW, ...extra });

/** Registry + all five sample files imported in order. */
function importAll(): { dataset: DomainDataset; runs: ImportRun[] } {
  let dataset = registryDataset();
  const runs: ImportRun[] = [];
  for (const f of sampleFiles) {
    const r = importCsv(dataset, { kind: f.kind, sourceId: f.sourceId, fileName: f.file, content: sample(f.file), now: SAMPLE_NOW });
    dataset = r.dataset; runs.push(r.run);
  }
  return { dataset, runs };
}

const withCatalog = (): DomainDataset => run(registryDataset(), "catalog", "src_syn_catalog", sample("catalog.csv")).dataset;
const saleId = (txn: string, line: number) => naturalKeyId("sales", ["src_syn_erp", txn, line]);
const SALES_HEADER = "transaction_id,line_no,merchant_sku,event_at,quantity,gross_revenue,currency";

// ---------- CSV parser ----------

test("csv: quoted commas, escaped quotes, Thai text, BOM and CRLF", () => {
  const rows = parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\nเดโม,ทีวี\r\n');
  assert.deepEqual(rows.map((r) => r.fields), [["a", "b"], ["x, y", 'say "hi"'], ["เดโม", "ทีวี"]]);
  assert.deepEqual(rows.map((r) => r.line), [1, 2, 3]);
});
test("csv: embedded newline keeps the physical start line of each row", () => {
  const rows = parseCsv('h1,h2\n"multi\nline",1\nnext,2\n\nlast,3');
  assert.deepEqual(rows.map((r) => r.line), [1, 2, 4, 6]);
  assert.equal(rows[1]!.fields[0], "multi\nline");
  assert.equal(rows[1]!.raw, '"multi\nline",1');
});
test("csv: unterminated or stray quotes are syntax errors", () => {
  assert.throws(() => parseCsv('a\n"open'), CsvSyntaxError);
  assert.throws(() => parseCsv('a\nab"c'), CsvSyntaxError);
  assert.throws(() => parseCsv('a\n"x"y'), CsvSyntaxError);
});

// ---------- value parsers ----------

test("money: exact minor units without floating point", () => {
  const thb = { THB: 2 };
  assert.deepEqual(parseMoneyMinor("19.99", "THB", thb), { ok: true, value: 1999 });
  assert.deepEqual(parseMoneyMinor("24,000.00", "THB", thb), { ok: true, value: 2_400_000 });
  assert.deepEqual(parseMoneyMinor("1234567.8", "THB", thb), { ok: true, value: 123_456_780 });
  assert.deepEqual(parseMoneyMinor("27000", "THB", thb), { ok: true, value: 2_700_000 });
});
test("money: excess precision, bad grouping, negatives and unknown currency are rejected", () => {
  const thb = { THB: 2 };
  assert.equal((parseMoneyMinor("10.999", "THB", thb) as { code: string }).code, "excess_precision");
  assert.equal((parseMoneyMinor("24,00", "THB", thb) as { code: string }).code, "invalid_number");
  assert.equal((parseMoneyMinor("2400,000.00", "THB", thb) as { code: string }).code, "invalid_number");
  assert.equal((parseMoneyMinor("-5.00", "THB", thb) as { code: string }).code, "invalid_number");
  assert.equal((parseMoneyMinor("5.00", "USD", thb) as { code: string }).code, "unsupported_currency");
});
test("timestamps: offset required unless explicitly assumed; date-only always rejected", () => {
  assert.equal((parseInstant("2026-09-02T11:15:00", null) as { code: string }).code, "missing_offset");
  assert.deepEqual(parseInstant("2026-09-02T11:15:00", "+07:00"), { ok: true, value: "2026-09-02T11:15:00+07:00" });
  assert.deepEqual(parseInstant("2026-09-02T04:15:00Z", "+07:00"), { ok: true, value: "2026-09-02T04:15:00Z" });
  assert.equal((parseInstant("2026-09-02", "+07:00") as { code: string }).code, "invalid_timestamp");
});

// ---------- end-to-end import ----------

test("sample CSVs import into a dataset that passes schema and integrity validation", () => {
  const { dataset, runs } = importAll();
  assert.ok(runs.every((r) => r.status === "completed" && r.rowsRejected === 0 && r.issues.length === 0));
  assert.deepEqual(checkDatasetIntegrity(parseDomainDataset(dataset)), []);
  assert.equal(dataset.skus.length, 5);
  assert.equal(dataset.sales.length, 6);
  assert.equal(dataset.sales.find((s) => s.id === saleId("SYN-T0002", 1))!.grossRevenueMinor, 7_000_000);
});
test("every accepted record traces to its raw row, file hash and ingestion time", () => {
  const { dataset, runs } = importAll();
  const salesRun = runs.find((r) => r.kind === "sales")!;
  for (const fact of dataset.sales) {
    const ref = dataset.references.find((r) => r.id === fact.sourceReferenceId)!;
    const line = Number(ref.locator.value.split("#L")[1]);
    assert.equal(ref.locator.kind, "file");
    assert.equal(ref.id, naturalKeyId("ref", ["src_syn_erp", salesRun.sha256, line]));
    assert.ok(salesRun.rawRows.some((r) => r.line === line && r.raw !== null && r.raw.includes(ref.recordKey.slice(4).split("/")[0]!)));
    assert.equal(fact.ingestedAt, SAMPLE_NOW);
    assert.notEqual(fact.eventAt, fact.ingestedAt);
  }
});
test("re-importing the same files adds nothing (idempotent)", () => {
  const first = importAll();
  let dataset = first.dataset;
  for (const f of sampleFiles) {
    const r = importCsv(dataset, { kind: f.kind, sourceId: f.sourceId, fileName: f.file, content: sample(f.file), now: "2026-10-11T09:00:00+07:00" });
    assert.equal(r.run.recordsAdded, 0, f.file);
    assert.equal(r.run.rowsUnchanged, r.run.rowsRead, f.file);
    dataset = r.dataset;
  }
  assert.deepEqual(dataset, first.dataset);
});
test("a changed row under the same natural key is a conflict; the existing record is kept", () => {
  const { dataset } = importAll();
  const r = run(dataset, "sales", "src_syn_erp", `${SALES_HEADER}\nSYN-T0001,1,SYN-AX25-55,2026-09-02T11:15:00+07:00,5,120000.00,THB\n`);
  assert.equal(r.run.rowsRejected, 1);
  assert.equal(r.run.issues[0]!.code, "conflict");
  assert.equal(r.dataset.sales.find((s) => s.id === saleId("SYN-T0001", 1))!.quantitySold, 1);
});
test("in-file duplicates: identical rows are unchanged, divergent rows conflict", () => {
  const ds = withCatalog();
  const row = "SYN-T9,1,SYN-BZ-50,2026-09-02T11:15:00+07:00,1,13000.00,THB";
  const r = run(ds, "sales", "src_syn_erp", `${SALES_HEADER}\n${row}\n${row}\nSYN-T9,1,SYN-BZ-50,2026-09-02T11:15:00+07:00,2,26000.00,THB\n`);
  assert.deepEqual([r.run.rowsAccepted, r.run.rowsUnchanged, r.run.rowsDuplicate, r.run.rowsRejected], [1, 0, 1, 1]);
  assert.deepEqual(r.run.issues.map((i) => [i.line, i.code]), [[3, "duplicate_row"], [4, "conflict"]]);
});
test("a transaction with several lines keeps each line", () => {
  const { dataset } = importAll();
  assert.ok(dataset.sales.some((s) => s.id === saleId("SYN-T0001", 1)));
  assert.ok(dataset.sales.some((s) => s.id === saleId("SYN-T0001", 2)));
});
test("natural-key IDs do not collide when key parts contain the separator, and stay short", () => {
  assert.notEqual(naturalKeyId("stock", ["src", "sku_x", "y_z", "t"]), naturalKeyId("stock", ["src", "sku_x_y", "z", "t"]));
  const long = naturalKeyId("price", ["0b6f3c1e-5d0a-4a8e-9a49-1f7e2b9c4d11", "7d1e9a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b", "SYN-MARKETPLACE-CHANNEL-01", "selling", "2026-09-30T22:00:00+07:00"]);
  assert.ok(long.length <= 128);
});
test("raw row text is not stored when the source forbids storing full content", () => {
  const ds = withCatalog();
  ds.sources.find((src) => src.id === "src_syn_erp")!.permittedUse.storeFullContent = false;
  const r = run(ds, "sales", "src_syn_erp", sample("sales.csv"));
  assert.equal(r.run.rowsAccepted, 6);
  assert.ok(r.run.rawRows.every((row) => row.raw === null && row.line > 1));
});

// ---------- file-level refusals ----------

const refusals: [string, ImportKind, string, string | Uint8Array, string][] = [
  ["unregistered source", "sales", "src_unknown", `${SALES_HEADER}\n`, "unregistered_source"],
  ["expired rights", "catalog", "src_syn_expired", "brand_id\n", "unauthorized_source"],
  ["external source kind", "sales", "src_syn_feed", `${SALES_HEADER}\n`, "source_not_internal"],
  ["cost data from a non-confidential source", "costs", "src_syn_catalog", "merchant_sku\n", "sensitivity_mismatch"],
  ["invalid UTF-8 (e.g. TIS-620 bytes)", "sales", "src_syn_erp", new Uint8Array([0x74, 0x78, 0xbb, 0xff, 0x0a]), "invalid_encoding"],
  ["unknown column", "sales", "src_syn_erp", `${SALES_HEADER},discount\n`, "unknown_column"],
  ["missing column", "sales", "src_syn_erp", "transaction_id,line_no\n", "missing_column"],
  ["duplicate column", "sales", "src_syn_erp", `${SALES_HEADER},currency\n`, "duplicate_column"],
  ["malformed CSV", "sales", "src_syn_erp", `${SALES_HEADER}\n"open`, "malformed_csv"],
  ["empty file", "sales", "src_syn_erp", "", "missing_header"],
];
for (const [name, kind, sourceId, content, code] of refusals) {
  test(`refuses whole file: ${name}`, () => {
    const ds = withCatalog();
    const r = run(ds, kind, sourceId, content);
    assert.equal(r.run.status, "refused");
    assert.equal(r.run.issues[0]!.code, code);
    assert.equal(r.dataset, ds);
  });
}
test("refuses an invalid assumeOffset option", () => {
  assert.equal(run(withCatalog(), "sales", "src_syn_erp", `${SALES_HEADER}\n`, { assumeOffset: "Asia/Bangkok" }).run.issues[0]!.code, "invalid_option");
});

// ---------- row-level rejections ----------

test("unknown merchant SKU is rejected, never auto-created", () => {
  const r = run(withCatalog(), "sales", "src_syn_erp", `${SALES_HEADER}\nSYN-T9,1,SYN-NOPE,2026-09-02T11:15:00+07:00,1,1.00,THB\n`);
  assert.equal(r.run.issues[0]!.code, "unknown_sku");
  assert.equal(r.dataset.skus.length, 5);
});
test("a merchant SKU shared by two SKUs is ambiguous, not first-match", () => {
  const catalog = sample("catalog.csv").toString("utf8").trimEnd()
    + "\nbrand_syn_bright,BrightLab (synthetic),cat_tv,Televisions (synthetic),fam_syn_bz,BrightLab BZ (synthetic),SYN-BZ,var_syn_bz_50,50,2026,LED,sku_syn_bz_50_b,SYN-BZ-50,,active,,,\n";
  const ds = run(registryDataset(), "catalog", "src_syn_catalog", catalog).dataset;
  const r = run(ds, "sales", "src_syn_erp", `${SALES_HEADER}\nSYN-T9,1,SYN-BZ-50,2026-09-02T11:15:00+07:00,1,13000.00,THB\n`);
  assert.equal(r.run.issues[0]!.code, "ambiguous_sku");
});
test("timestamps without offset are rejected unless the run assumes one, which is recorded", () => {
  const csv = `${SALES_HEADER}\nSYN-T9,1,SYN-BZ-50,2026-09-02T11:15:00,1,13000.00,THB\n`;
  assert.equal(run(withCatalog(), "sales", "src_syn_erp", csv).run.issues[0]!.code, "missing_offset");
  const r = run(withCatalog(), "sales", "src_syn_erp", csv, { assumeOffset: "+07:00" });
  assert.equal(r.run.assumeOffset, "+07:00");
  assert.equal(r.dataset.sales[0]!.eventAt, "2026-09-02T11:15:00+07:00");
});
test("row issues carry physical line, column and code", () => {
  const csv = `${SALES_HEADER}\nSYN-T9,1,SYN-BZ-50,2026-09-02T11:15:00+07:00,1,13000.001,THB\nSYN-T10,1,SYN-BZ-50,2026-09-02T11:15:00+07:00,1\n`;
  const r = run(withCatalog(), "sales", "src_syn_erp", csv);
  assert.deepEqual(r.run.issues.map((i) => [i.line, i.column, i.code]), [[2, "gross_revenue", "excess_precision"], [3, null, "field_count"]]);
});
test("schema rules still apply to imported rows (reserved > on hand)", () => {
  const r = run(withCatalog(), "inventory", "src_syn_erp", "merchant_sku,location_code,observed_at,on_hand,reserved\nSYN-BZ-50,SYN-X,2026-09-30T22:00:00+07:00,1,5\n");
  assert.equal(r.run.issues[0]!.code, "schema_invalid");
});
test("catalog aliases are unverified unless explicitly marked", () => {
  const ds = withCatalog();
  assert.ok(ds.aliases.length > 0 && ds.aliases.every((a) => a.verified === false));
  const catalog = sample("catalog.csv").toString("utf8").replace(",DemoVision AX 55in,false", ",DemoVision AX 55in,true");
  const verified = run(registryDataset(), "catalog", "src_syn_catalog", catalog).dataset.aliases.filter((a) => a.verified);
  assert.deepEqual(verified.map((a) => a.id).sort(), ["alias_sku_syn_ax25_55_en", "alias_sku_syn_ax25_55_th"]);
});
test("variant attributes keep size and year as numbers", () => {
  const variant = withCatalog().variants.find((v) => v.id === "var_syn_ax25_65")!;
  assert.deepEqual(variant.attributes, { screenSizeInches: 65, modelYear: 2025, panelType: "QLED" });
});
test("import never mutates the input dataset", () => {
  const ds = withCatalog();
  const before = structuredClone(ds);
  run(ds, "sales", "src_syn_erp", sample("sales.csv"));
  assert.deepEqual(ds, before);
});

// ---------- quality report ----------

test("quality report shows coverage gaps and issue counts, without business metrics", () => {
  const catalogOnly = run(registryDataset(), "catalog", "src_syn_catalog", sample("catalog.csv"));
  const bad = run(catalogOnly.dataset, "sales", "src_syn_erp", `${SALES_HEADER}\nSYN-T9,1,SYN-NOPE,2026-09-02T11:15:00+07:00,1,1.00,THB\n`);
  const report = buildQualityReport(bad.dataset, [catalogOnly.run, bad.run]);
  assert.equal(report.coverage.activeSkus, 4);
  assert.equal(report.coverage.activeSkusWithoutSales.length, 4);
  assert.ok(!report.coverage.activeSkusWithoutPrice.includes("sku_syn_bz_55"), "discontinued SKUs are not coverage gaps");
  assert.deepEqual(report.runs[1]!.issueCounts, { unknown_sku: 1 });
  assert.deepEqual(report.totals, { runs: 2, refusedRuns: 0, rowsRead: 6, rowsAccepted: 5, rowsUnchanged: 0, rowsDuplicate: 0, rowsRejected: 1 });
  assert.deepEqual(report.integrityIssues, []);
  const keys = JSON.stringify(report).toLowerCase();
  assert.ok(!/margin|revenue|growth|cover/.test(keys.replace(/coverage/g, "")));
});
