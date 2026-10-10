/**
 * Bilingual copy (S7, PRODUCT.md). Every code table is a full Record over its code union, so a new
 * reason, status, action or metric fails the typecheck until it is translated. Product, model and
 * brand names are data and are never translated.
 */
import type { MetricId, MetricReason } from "../../../packages/metrics/src/index.ts";
import type { RankingCriterion } from "../../../packages/ranking/src/index.ts";
import type { DecisionKind, NextStep, PolicyGateReason, SkuStatus } from "../../../packages/recommendation/src/index.ts";
import type { PromotionAction, RuleUnknownReason, VerdictReason } from "../../../packages/rules/src/index.ts";
import type { DecisionRefusal } from "./server/pipeline.ts";

export const LANGS = ["th", "en"] as const;
export type Lang = (typeof LANGS)[number];
type T = { th: string; en: string };

export const ACTION: Record<PromotionAction, T> = {
  advertise_only: { th: "โฆษณาอย่างเดียว", en: "Advertise only" },
  discount: { th: "ลดราคา", en: "Discount" },
  bundle: { th: "จัดชุดบันเดิล", en: "Bundle" },
  hold: { th: "คงไว้", en: "Hold" },
};

export const STATUS: Record<SkuStatus, T> = {
  recommended: { th: "แนะนำ", en: "Recommended" },
  insufficient_data: { th: "ข้อมูลไม่พอ", en: "Insufficient data" },
  review_required: { th: "ต้องทบทวน", en: "Review required" },
  blocked: { th: "ถูกกฎกัน", en: "Blocked" },
};

export const VERDICT: Record<"eligible" | "blocked" | "review_required", T> = {
  eligible: { th: "ผ่านเกณฑ์", en: "Eligible" },
  blocked: { th: "ถูกกฎกัน", en: "Blocked" },
  review_required: { th: "ต้องทบทวน", en: "Review required" },
};

const METRIC_REASON: Record<MetricReason, T> = {
  no_sales_rows: { th: "ไม่มีรายการขายในช่วงนี้", en: "No sales rows in the window" },
  no_inventory_snapshots: { th: "ไม่มีข้อมูลสต็อก", en: "No inventory snapshot" },
  mixed_currency: { th: "มีหลายสกุลเงินปนกัน", en: "Mixed currencies" },
  multiple_sales_sources: { th: "ยอดขายมาจากหลายแหล่ง", en: "Sales from more than one source" },
  zero_baseline: { th: "ช่วงก่อนหน้าขายได้ 0", en: "Previous period sold zero" },
  zero_revenue: { th: "ยอดขายรวมเป็น 0", en: "Zero revenue" },
  missing_cost: { th: "ไม่มีต้นทุนที่มีผล ณ วันขาย", en: "No cost effective at the sale date" },
  overlapping_cost: { th: "ต้นทุนมีช่วงเวลาซ้อนกัน", en: "Overlapping cost periods" },
  currency_mismatch: { th: "สกุลเงินต้นทุนไม่ตรงกับยอดขาย", en: "Cost currency differs from sales" },
  no_sales_in_window: { th: "ไม่มียอดขายในช่วงนี้", en: "No sales in the window" },
  zero_denominator: { th: "ไม่มีทั้งยอดขายและสต็อก", en: "Neither sales nor stock" },
};

export const UNKNOWN_REASON: Record<RuleUnknownReason, T> = {
  ...METRIC_REASON,
  post_action_unknown: { th: "มาร์จิ้นหลังเปลี่ยนราคายังประเมินไม่ได้", en: "Margin after a price change cannot be assessed yet" },
  unknown_sku: { th: "ไม่พบ SKU ในแคตตาล็อก", en: "SKU not in catalog" },
};

export const VERDICT_REASON: Record<VerdictReason, T> = {
  missing_owner_policy: { th: "ยังไม่มีนโยบายจากเจ้าของ", en: "No owner policy yet" },
  policy_not_approved: { th: "นโยบายยังไม่อนุมัติ", en: "Policy not approved" },
  policy_not_effective: { th: "นโยบายไม่อยู่ในช่วงมีผล", en: "Policy not in effect" },
  policy_reference_error: { th: "นโยบายอ้างรหัสที่ไม่มีในข้อมูล", en: "Policy references unknown ids" },
  no_applicable_rules: { th: "ไม่มีกฎสำหรับรูปแบบโปรโมชั่นนี้", en: "No rules for this action" },
  rule_failed: { th: "ไม่ผ่านกฎ", en: "A rule failed" },
  rule_unknown: { th: "มีกฎที่ประเมินไม่ได้", en: "A rule could not be assessed" },
};

export const GATE_REASON: Record<PolicyGateReason, T> = {
  missing_action_preference: { th: "ยังไม่มีลำดับความชอบของรูปแบบโปรโมชั่น", en: "No action preference yet" },
  recommendation_policy_not_approved: { th: "นโยบายลำดับรูปแบบโปรโมชั่นยังไม่อนุมัติ", en: "Action preference not approved" },
  recommendation_policy_not_effective: { th: "นโยบายลำดับรูปแบบโปรโมชั่นไม่อยู่ในช่วงมีผล", en: "Action preference not in effect" },
};

export const NEXT_STEP: Record<NextStep, T> = {
  import_sales_for_window: { th: "นำเข้ายอดขายของช่วงนี้", en: "Import sales for this window" },
  import_inventory_snapshot: { th: "นำเข้าข้อมูลสต็อก", en: "Import an inventory snapshot" },
  import_cost_for_cost_type: { th: "นำเข้าต้นทุนตามฐานที่นโยบายกำหนด", en: "Import cost for the policy's cost basis" },
  check_sales_coverage: { th: "ตรวจว่าไฟล์ยอดขายครอบคลุมช่วงนี้", en: "Check sales export coverage" },
  import_previous_period_sales: { th: "นำเข้ายอดขายช่วงก่อนหน้า", en: "Import previous-period sales" },
  verify_sales_revenue: { th: "ตรวจยอดขายรวม", en: "Verify sales revenue" },
  verify_sales_and_inventory: { th: "ตรวจยอดขายและสต็อก", en: "Verify sales and inventory" },
  resolve_currency: { th: "แก้เรื่องสกุลเงิน", en: "Resolve currency" },
  choose_authoritative_sales_source: { th: "เลือกแหล่งยอดขายหลัก", en: "Choose the authoritative sales source" },
  fix_overlapping_cost_periods: { th: "แก้ช่วงต้นทุนที่ซ้อนกัน", en: "Fix overlapping cost periods" },
  owner_review_post_action_margin: { th: "ให้เจ้าของกำหนดสมมติฐานมาร์จิ้นหลังโปรโมชั่น", en: "Owner to set post-promotion margin assumptions" },
  fix_catalog: { th: "แก้แคตตาล็อก", en: "Fix the catalog" },
};

export const METRIC: Record<MetricId, T> = {
  units_sold: { th: "ขาย (ชิ้น)", en: "Units sold" },
  gross_revenue: { th: "ยอดขายรวม", en: "Gross revenue" },
  sales_growth_units: { th: "การเติบโต (ชิ้น)", en: "Unit growth" },
  realized_gross_margin_ratio: { th: "มาร์จิ้นจริง", en: "Realized margin" },
  available_stock: { th: "สต็อกพร้อมขาย", en: "Available stock" },
  stock_cover_days: { th: "รองรับได้", en: "Stock cover" },
  sell_through_proxy: { th: "อัตราขายออก (ประมาณ)", en: "Sell-through (proxy)" },
};

export const DIRECTION: Record<RankingCriterion["direction"], T> = {
  desc: { th: "มากไปน้อย", en: "high to low" },
  asc: { th: "น้อยไปมาก", en: "low to high" },
};

export const DECISION: Record<DecisionKind, T> = {
  approve: { th: "อนุมัติ", en: "Approve" },
  reject: { th: "ปฏิเสธ", en: "Reject" },
  request_more_data: { th: "ขอข้อมูลเพิ่ม", en: "Request more data" },
};

export const REFUSAL: Record<DecisionRefusal, T> = {
  unknown_recommendation: { th: "ไม่พบคำแนะนำนี้ (เซิร์ฟเวอร์อาจเริ่มใหม่) — โหลดหน้าใหม่", en: "Recommendation not found (the server may have restarted). Reload the page." },
  not_recommended: { th: "อนุมัติได้เฉพาะ SKU ที่มีสถานะ “แนะนำ”", en: "Only a recommended SKU can be approved." },
  no_permission: { th: "ต้องมีสิทธิ์อนุมัติจึงจะอนุมัติหรือปฏิเสธได้", en: "Approve and reject need approval permission." },
  empty_rationale: { th: "กรุณาระบุเหตุผลก่อนบันทึก", en: "Add a rationale before recording." },
  refused_by_recorder: { th: "ระบบบันทึกปฏิเสธ (นโยบายหมดช่วงหรือข้อมูลไม่ตรง) — โหลดหน้าใหม่", en: "The recorder refused (policy period or content mismatch). Reload the page." },
};

/** Interface copy. */
export const UI = {
  product: { th: "AI Product Intelligence Advisor", en: "AI Product Intelligence Advisor" },
  navAsk: { th: "ถามที่ปรึกษา", en: "Ask Advisor" },
  navExplorer: { th: "สำรวจสินค้า", en: "Product Explorer" },
  navHealth: { th: "สุขภาพข้อมูล", en: "Data Health" },
  navHistory: { th: "ประวัติการตัดสินใจ", en: "Decision History" },
  navSoon: { th: "ยังไม่เปิดใช้", en: "Not built yet" },
  question: { th: "ทีวีรุ่นไหนในสต็อกที่ควรทำโปรโมชั่นในเดือนนี้ และควรใช้โปรโมชั่นแบบใด?", en: "Which in-stock TVs should we promote this month, and with what kind of promotion?" },
  window: { th: "ช่วงข้อมูล", en: "Window" },
  evaluated: { th: "ประเมินเมื่อ", en: "Evaluated" },
  evidence: { th: "หลักฐาน", en: "Evidence" },
  internalOnly: { th: "ข้อมูลภายในเท่านั้น", en: "Internal data only" },
  synthetic: { th: "ข้อมูลสังเคราะห์ — ไม่ใช่ข้อมูลจริง", en: "Synthetic data — not real" },
  objective: { th: "เป้าหมาย", en: "Objective" },
  objectiveUnspecified: { th: "ยังไม่ระบุ", en: "Not specified" },
  demo: { th: "โหมดสาธิต", en: "Demo controls" },
  demoNote: { th: "สิทธิ์จริงยังไม่ได้กำหนด (DEC-008)", en: "Real permissions are not decided yet (DEC-008)" },
  viewer: { th: "ระดับสิทธิ์ผู้ดู", en: "Viewer clearance" },
  clearance_internal: { th: "ภายใน (internal)", en: "Internal" },
  clearance_confidential: { th: "ลับ (confidential)", en: "Confidential" },
  canApprove: { th: "มีสิทธิ์อนุมัติ", en: "Can approve" },
  language: { th: "ภาษา", en: "Language" },
  rank: { th: "อันดับ", en: "Rank" },
  sku: { th: "สินค้า / SKU", en: "Product / SKU" },
  status: { th: "สถานะ", en: "Status" },
  rules: { th: "กฎ", en: "Rules" },
  ofPass: { th: "ผ่านเกณฑ์ {n} จาก {m}", en: "{n} of {m} eligible" },
  sortedBy: { th: "เรียงตาม", en: "Ordered by" },
  notRanked: { th: "ไม่ได้จัดอันดับ", en: "Not ranked" },
  rankWithheld: { th: "ลำดับถูกปิดบังตามสิทธิ์ — เรียงตามรหัส", en: "Order withheld for this clearance — sorted by id" },
  noneForAction: { th: "ไม่มี SKU ที่แนะนำรูปแบบนี้ — ดูทางเลือกในรายละเอียดแต่ละ SKU", en: "No SKU is recommended for this action — see each SKU's alternatives" },
  noAction: { th: "ยังไม่มีรูปแบบโปรโมชั่น", en: "No action yet" },
  noActionNote: { th: "SKU ที่ยังแนะนำไม่ได้ พร้อมเหตุผล", en: "SKUs that cannot be recommended, with reasons" },
  redacted: { th: "ปิดบัง", en: "Redacted" },
  noData: { th: "ไม่มีข้อมูล", en: "No data" },
  insufficient: { th: "ข้อมูลไม่พอ", en: "Insufficient" },
  days: { th: "{n} วัน", en: "{n} days" },
  units: { th: "{n} ชิ้น", en: "{n} units" },
  sources: { th: "แหล่งข้อมูล", en: "Sources" },
  lines: { th: "{n} บรรทัด", en: "{n} lines" },
  ingested: { th: "นำเข้า", en: "ingested" },
  policies: { th: "นโยบาย (สังเคราะห์)", en: "Policies (synthetic)" },
  facts: { th: "ข้อเท็จจริง", en: "Facts" },
  asOf: { th: "ณ", en: "as of" },
  formula: { th: "สูตร", en: "formula" },
  constraints: { th: "ผลการตรวจกฎ", en: "Constraint results" },
  chosen: { th: "รูปแบบที่แนะนำ", en: "Recommended action" },
  alternatives: { th: "ทางเลือกอื่น", en: "Alternatives" },
  missing: { th: "ข้อมูลที่ขาดและสิ่งที่ควรทำ", en: "What is missing and what would help" },
  confidence: { th: "ความมั่นใจ (แยกมิติ)", en: "Confidence (separate dimensions)" },
  confEntity: { th: "ตัวตนสินค้า: canonical ภายใน", en: "Entity match: internal canonical" },
  confRetrieval: { th: "การค้นหลักฐาน: ไม่เกี่ยว (ข้อมูลภายในเท่านั้น)", en: "Retrieval: not applicable (internal only)" },
  confModel: { th: "การตัดสิน: กฎตายตัว", en: "Decision model: rule-based" },
  confQuality: { th: "คุณภาพข้อมูล: ยังไม่คำนวณ", en: "Data quality: not computed" },
  decide: { th: "บันทึกการตัดสินใจ", en: "Record a decision" },
  rationale: { th: "เหตุผล (จำเป็น)", en: "Rationale (required)" },
  rationalePlaceholder: { th: "เช่น สอดคล้องกับแผนการตลาดเดือนนี้", en: "e.g. fits this month's marketing plan" },
  decisionNote: { th: "การอนุมัติไม่ใช่การสั่งดำเนินการ · บันทึกเก็บในหน่วยความจำ หายเมื่อเซิร์ฟเวอร์เริ่มใหม่", en: "Approval is not execution · the log is in memory and resets when the server restarts" },
  recorded: { th: "บันทึกแล้ว", en: "Recorded" },
  current: { th: "การตัดสินใจล่าสุด", en: "Latest decision" },
  outcome: { th: "ผลลัพธ์จริง: ยังวัดไม่ได้", en: "Actual outcome: not yet measurable" },
  selectHint: { th: "เลือก SKU จากตารางเพื่อดูรายละเอียด", en: "Select a SKU in the listing to see its detail" },
  ruleBelow: { th: "ต่ำกว่าเกณฑ์", en: "below threshold" },
  ruleAbove: { th: "สูงกว่าเกณฑ์", en: "above threshold" },
  ruleExcluded: { th: "ถูกตัดออก", en: "excluded" },
  ruleExclusionName: { th: "รายการตัดออก", en: "Exclusion list" },
  ruleStatusName: { th: "สถานะ SKU ที่อนุญาต", en: "Allowed SKU status" },
  ruleStatus: { th: "สถานะ SKU ไม่อนุญาต", en: "SKU status not allowed" },
  unrestricted: { th: "ไม่จำกัด", en: "Unrestricted" },
  rulePass: { th: "ผ่าน", en: "pass" },
  ruleFail: { th: "ไม่ผ่าน", en: "fail" },
  ruleUnknown: { th: "ประเมินไม่ได้", en: "unknown" },
  ruleRedacted: { th: "ปิดบัง", en: "redacted" },
  saving: { th: "กำลังบันทึก…", en: "Saving…" },
  versions: { th: "เวอร์ชัน", en: "Versions" },
} satisfies Record<string, T>;

export type UiKey = keyof typeof UI;

export function t(lang: Lang, entry: T, vars: Record<string, string | number> = {}): string {
  return entry[lang].replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}

const LOCALE: Record<Lang, string> = { th: "th-TH-u-ca-gregory-nu-latn", en: "en-GB" };

export const fmt = {
  int: (lang: Lang, n: number) => new Intl.NumberFormat(LOCALE[lang], { maximumFractionDigits: 0 }).format(n),
  days: (lang: Lang, n: number) => t(lang, UI.days, { n: new Intl.NumberFormat(LOCALE[lang], { maximumFractionDigits: 0 }).format(n) }),
  percent: (lang: Lang, ratio: number) => new Intl.NumberFormat(LOCALE[lang], { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(ratio),
  /** Minor units → currency, using the currency's own fraction digits from Intl. */
  money: (lang: Lang, minor: number, currency: string) => {
    const digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
    return new Intl.NumberFormat(LOCALE[lang], { style: "currency", currency, maximumFractionDigits: 0 }).format(minor / 10 ** digits);
  },
  dateTime: (lang: Lang, iso: string) => new Intl.DateTimeFormat(LOCALE[lang], { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(iso)) + " ICT",
  date: (lang: Lang, iso: string) => new Intl.DateTimeFormat(LOCALE[lang], { dateStyle: "medium", timeZone: "Asia/Bangkok" }).format(new Date(iso)),
};
