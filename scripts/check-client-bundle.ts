/**
 * STEP 7 server-boundary check (blueprint §11.4, §15.2): after `npm run build:web`, the browser
 * bundle must contain no confidential sample values and no server-only pipeline code.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../apps/web/dist/client/", import.meta.url).pathname;
const files: string[] = [];
const walk = (dir: string) => { for (const f of readdirSync(dir)) { const p = join(dir, f); statSync(p).isDirectory() ? walk(p) : /\.(js|css|html|json)$/.test(f) && files.push(p); } };
walk(root);

// Unit costs from tests/fixtures/csv/costs.csv (minor and major units), cost-file text, server-only APIs.
const forbidden = [
  "1680000", "2450000", "1890000", "910000", "16,800.00", "24,500.00", "18,900.00", "9,100.00",
  "unitCostMinor", "costs.csv", "merchant_sku,cost_type", "realizedGrossMarginRatio", "importCsv", "recordDecision",
  "redactForViewer", "policy_SYNTHETIC_sample", "createHash",
];
const hits: string[] = [];
for (const f of files) {
  const text = readFileSync(f, "utf8");
  for (const needle of forbidden) if (text.includes(needle)) hits.push(`${f.slice(root.length)}: ${needle}`);
}
console.log(`checked ${files.length} client files for ${forbidden.length} forbidden strings`);
if (hits.length > 0) { console.error(`LEAK:\n${hits.join("\n")}`); process.exit(1); }
console.log("OK: no confidential value or server-only code in the client bundle");
