import { FormulaError, evaluateAst, parse, formatNumber } from "./formula";

export interface SheetData {
  rows: number;
  cols: number;
  cells: Record<string, string>;
}

export interface CellResult {
  value: number | string | null;
  error?: string;
}

export function colName(i: number): string {
  let s = "";
  i += 1;
  while (i > 0) {
    const m = (i - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
}
export function colIndex(name: string): number {
  let n = 0;
  for (const ch of name) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}
export function parseRef(ref: string): { c: number; r: number } {
  const m = /^([A-Z]+)(\d+)$/.exec(ref);
  if (!m) throw new FormulaError("#REF!");
  return { c: colIndex(m[1]), r: Number(m[2]) - 1 };
}
export function refName(c: number, r: number) {
  return colName(c) + (r + 1);
}

export function emptySheet(rows = 20, cols = 8): SheetData {
  return { rows, cols, cells: {} };
}

export function parseSheet(content: string): SheetData {
  try {
    const d = JSON.parse(content);
    if (d && typeof d === "object" && d.cells) {
      return { rows: Math.min(500, Math.max(1, Math.floor(Number(d.rows)||20))), cols: Math.min(52,Math.max(1,Math.floor(Number(d.cols)||8))), cells: Object.fromEntries(Object.entries(d.cells).filter(([k,v])=>/^[A-Z]{1,2}[1-9][0-9]{0,2}$/.test(k)&&typeof v === "string").map(([k,v])=>[k,(v as string).slice(0,4000)])) };
    }
  } catch {
    /* ignore */
  }
  return emptySheet();
}

export function computeSheet(data: SheetData): Record<string, CellResult> {
  const out: Record<string, CellResult> = {};
  const visiting = new Set<string>();

  const inBounds = (ref: string) => {
    const { c, r } = parseRef(ref);
    return c >= 0 && r >= 0 && c < data.cols && r < data.rows;
  };

  const calc = (ref: string): CellResult => {
    if (out[ref]) return out[ref];
    if (visiting.has(ref)) throw new FormulaError("#CICLO!");
    const raw = (data.cells[ref] ?? "").trim();
    let res: CellResult;
    if (raw === "") res = { value: null };
    else if (raw.startsWith("=")) {
      visiting.add(ref);
      try {
        const v = evaluateAst(parse(raw.slice(1)), {
          cell: (r) => {
            if (!inBounds(r)) throw new FormulaError("#REF!");
            const d = calc(r);
            if (d.error) throw new FormulaError(d.error);
            if (d.value === null) return 0;
            if (typeof d.value === "string") throw new FormulaError("#VALOR!");
            return d.value;
          },
          range: (a, b) => {
            const A = parseRef(a);
            const B = parseRef(b);
            const xs: number[] = [];
            for (let r = Math.min(A.r, B.r); r <= Math.max(A.r, B.r); r++)
              for (let c = Math.min(A.c, B.c); c <= Math.max(A.c, B.c); c++) {
                const rn = refName(c, r);
                if (!inBounds(rn)) throw new FormulaError("#REF!");
                const d = calc(rn);
                if (d.error) throw new FormulaError(d.error);
                if (typeof d.value === "number") xs.push(d.value);
              }
            return xs;
          },
        });
        res = { value: v };
      } catch (e) {
        res = { value: null, error: e instanceof FormulaError ? e.code : "#ERRO!" };
      } finally {
        visiting.delete(ref);
      }
    } else {
      const n = Number(raw.replace(",", "."));
      res = /^[-+]?(\d+([.,]\d+)?|[.,]\d+)$/.test(raw) && Number.isFinite(n) ? { value: n } : { value: raw };
    }
    out[ref] = res;
    return res;
  };

  for (let r = 0; r < data.rows; r++)
    for (let c = 0; c < data.cols; c++) {
      const ref = refName(c, r);
      try {
        calc(ref);
      } catch (e) {
        out[ref] = { value: null, error: e instanceof FormulaError ? e.code : "#ERRO!" };
      }
    }
  return out;
}

export function displayCell(r: CellResult | undefined): string {
  if (!r) return "";
  if (r.error) return r.error;
  if (r.value === null) return "";
  return typeof r.value === "number" ? formatNumber(r.value) : r.value;
}

export function sheetToCsv(data: SheetData): string {
  const res = computeSheet(data);
  let lastRow = -1;
  let lastCol = -1;
  for (let r = 0; r < data.rows; r++)
    for (let c = 0; c < data.cols; c++)
      if (displayCell(res[refName(c, r)]) !== "") {
        lastRow = Math.max(lastRow, r);
        lastCol = Math.max(lastCol, c);
      }
  const lines: string[] = [];
  for (let r = 0; r <= lastRow; r++) {
    const row: string[] = [];
    for (let c = 0; c <= lastCol; c++) {
      const s = displayCell(res[refName(c, r)]);
      row.push(/[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    }
    lines.push(row.join(","));
  }
  return lines.join("\n");
}

