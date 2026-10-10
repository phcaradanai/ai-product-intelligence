/** Cell parsers. Each returns a value or a typed failure; none of them rounds or guesses. */

export type ValueIssueCode =
  | "missing_value" | "invalid_value" | "invalid_number" | "excess_precision"
  | "unsupported_currency" | "missing_offset" | "invalid_timestamp";

export type Parsed<T> = { ok: true; value: T } | { ok: false; code: ValueIssueCode; message: string };

const ok = <T>(value: T): Parsed<T> => ({ ok: true, value });
const fail = <T>(code: ValueIssueCode, message: string): Parsed<T> => ({ ok: false, code, message });

const GROUPED = /^\d{1,3}(,\d{3})+(\.\d+)?$/;
const PLAIN = /^\d+(\.\d+)?$/;

/** Removes strict thousands grouping ("24,000.00"); any other comma form is invalid (S2-DEC-06). */
function ungroup(value: string): string | null {
  if (GROUPED.test(value)) return value.replaceAll(",", "");
  return PLAIN.test(value) ? value : null;
}

export function parseCount(cell: string): Parsed<number> {
  if (cell === "") return fail("missing_value", "Value is required");
  const plain = ungroup(cell);
  if (plain === null || plain.includes(".")) return fail("invalid_number", `Not a non-negative integer: "${cell}"`);
  const n = Number(plain);
  return Number.isSafeInteger(n) ? ok(n) : fail("invalid_number", `Integer out of range: "${cell}"`);
}

/** Decimal string → integer minor units using string arithmetic only (S2-DEC-06/07). */
export function parseMoneyMinor(cell: string, currency: string, exponents: Readonly<Record<string, number>>): Parsed<number> {
  const exponent = exponents[currency];
  if (exponent === undefined) return fail("unsupported_currency", `Currency "${currency}" is not enabled for this import`);
  if (cell === "") return fail("missing_value", "Amount is required");
  const plain = ungroup(cell);
  if (plain === null) return fail("invalid_number", `Not a non-negative decimal amount: "${cell}"`);
  const [whole = "", fraction = ""] = plain.split(".");
  if (fraction.length > exponent) {
    return fail("excess_precision", `"${cell}" has more than ${exponent} decimal place(s) for ${currency}`);
  }
  const minor = BigInt(whole) * 10n ** BigInt(exponent) + BigInt(fraction.padEnd(exponent, "0") || "0");
  return minor <= BigInt(Number.MAX_SAFE_INTEGER) ? ok(Number(minor)) : fail("invalid_number", `Amount out of range: "${cell}"`);
}

const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})?$/;
const OFFSET = /^(Z|[+-]\d{2}:\d{2})$/;

/**
 * ISO 8601 date-time with seconds. A missing offset is filled only from an explicit run-level
 * `assumeOffset` (S2-DEC-08); date-only values are always rejected.
 */
export function parseInstant(cell: string, assumeOffset: string | null): Parsed<string> {
  if (cell === "") return fail("missing_value", "Timestamp is required");
  const m = DATE_TIME.exec(cell);
  if (!m) return fail("invalid_timestamp", `Not an ISO 8601 date-time with seconds: "${cell}"`);
  let value = cell;
  if (m[2] === undefined) {
    if (assumeOffset === null) return fail("missing_offset", `Timestamp "${cell}" has no time-zone offset and no assumeOffset was given`);
    value = cell + assumeOffset;
  }
  return Number.isNaN(Date.parse(value)) ? fail("invalid_timestamp", `Invalid date-time: "${cell}"`) : ok(value);
}

export function isValidOffset(offset: string): boolean {
  return OFFSET.test(offset);
}

export function parseEnum<T extends string>(cell: string, allowed: readonly T[]): Parsed<T> {
  if (cell === "") return fail("missing_value", "Value is required");
  return (allowed as readonly string[]).includes(cell)
    ? ok(cell as T)
    : fail("invalid_value", `"${cell}" is not one of: ${allowed.join(", ")}`);
}

/** `attr:<name>` cells: numeric → number, true/false → boolean, otherwise string. */
export function parseAttribute(cell: string): string | number | boolean {
  if (/^-?\d+(\.\d+)?$/.test(cell)) return Number(cell);
  if (cell === "true") return true;
  if (cell === "false") return false;
  return cell;
}
