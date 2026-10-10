/** Minimal RFC 4180 CSV parser (comma delimiter, `"` quoting). No dependency; UTF-8 text in. */

export interface CsvRow {
  /** 1-based physical line where the row starts; differs from row index when quoted fields span lines. */
  line: number;
  /** Raw text of the row exactly as in the file, without the trailing line break. */
  raw: string;
  fields: string[];
}

export class CsvSyntaxError extends Error {
  readonly line: number;
  constructor(line: number, message: string) {
    super(`CSV syntax error at line ${line}: ${message}`);
    this.name = "CsvSyntaxError";
    this.line = line;
  }
}

/** Parses all rows, header included. Blank lines are skipped. A leading BOM is removed. */
export function parseCsv(input: string): CsvRow[] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: CsvRow[] = [];
  let fields: string[] = [];
  let field = "";
  let line = 1;
  let rowLine = 1;
  let rowStart = 0;
  let i = 0;
  let quoted = false;
  let fieldStarted = false;

  const endRow = (end: number): void => {
    fields.push(field);
    const raw = text.slice(rowStart, end);
    if (!(fields.length === 1 && raw === "")) rows.push({ line: rowLine, raw, fields });
    fields = [];
    field = "";
    fieldStarted = false;
  };

  while (i < text.length) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        quoted = false;
        const next = text[i + 1];
        if (next !== undefined && next !== "," && next !== "\n" && next !== "\r") {
          throw new CsvSyntaxError(line, "unexpected character after closing quote");
        }
        i += 1;
        continue;
      }
      if (c === "\n") line += 1;
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      if (fieldStarted) throw new CsvSyntaxError(line, "quote inside unquoted field");
      quoted = true;
      fieldStarted = true;
      i += 1;
    } else if (c === ",") {
      fields.push(field);
      field = "";
      fieldStarted = false;
      i += 1;
    } else if (c === "\r" && text[i + 1] === "\n") {
      endRow(i);
      i += 2; line += 1; rowLine = line; rowStart = i;
    } else if (c === "\n") {
      endRow(i);
      i += 1; line += 1; rowLine = line; rowStart = i;
    } else {
      field += c;
      fieldStarted = true;
      i += 1;
    }
  }
  if (quoted) throw new CsvSyntaxError(rowLine, "unterminated quoted field");
  if (rowStart < text.length) endRow(text.length);
  return rows;
}
