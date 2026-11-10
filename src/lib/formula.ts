// Safe expression evaluator (no eval / Function). Supports numbers, + - * / ^, parentheses,
// unary minus, percent, A1 refs, ranges (A1:B3) and a fixed set of functions (PT + EN names).

export class FormulaError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

type Tok =
  | { t: "num"; v: number }
  | { t: "id"; v: string }
  | { t: "op"; v: string };

export type Ast =
  | { k: "num"; v: number }
  | { k: "ref"; ref: string }
  | { k: "range"; from: string; to: string }
  | { k: "un"; op: string; a: Ast }
  | { k: "bin"; op: string; a: Ast; b: Ast }
  | { k: "pct"; a: Ast }
  | { k: "call"; name: string; args: Ast[] }
  | { k: "const"; name: string };

const CELL_RE = /^\$?([A-Z]{1,3})\$?([0-9]{1,5})$/;

export function isCellRef(s: string) {
  return CELL_RE.test(s.toUpperCase());
}
export function normalizeRef(s: string) {
  const m = CELL_RE.exec(s.toUpperCase());
  if (!m) throw new FormulaError("#REF!");
  return m[1] + m[2];
}

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const num = /^(\d+(?:[.]\d+)?|[.]\d+)(?:[eE][+-]?\d+)?/.exec(src.slice(i));
    if (num && /[\d.]/.test(c)) {
      // A comma followed by digits directly after a number is a decimal separator only when
      // no other argument separator style is used; we accept "." always and "," only between digits.
      out.push({ t: "num", v: Number(num[0].replace(",", ".")) });
      i += num[0].length;
      continue;
    }
    const id = /^[$A-Za-zÀ-ÿ_][$A-Za-zÀ-ÿ0-9_]*/.exec(src.slice(i));
    if (id) {
      out.push({ t: "id", v: id[0] });
      i += id[0].length;
      continue;
    }
    if ("+-*/^(),;:%×÷".includes(c)) {
      out.push({ t: "op", v: c === "×" ? "*" : c === "÷" ? "/" : c });
      i++;
      continue;
    }
    throw new FormulaError("#ERRO!");
  }
  return out;
}

export function parse(src: string): Ast {
  if (src.length > 4000) throw new FormulaError("#ERRO!");
  // Semicolon selects decimal-comma mode; function arguments otherwise use commas.
  const normalized = src.includes(";") || !/[A-Za-zÀ-ÿ_]\s*\(/.test(src) ? src.replace(/(\d),(?=\d)/g, "$1.") : src;
  const toks = tokenize(normalized);
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v: string) => toks[p]?.t === "op" && toks[p].v === v;
  const expect = (v: string) => {
    if (!isOp(v)) throw new FormulaError("#ERRO!");
    p++;
  };

  function expr(): Ast {
    let a = term();
    while (isOp("+") || isOp("-")) {
      const op = (toks[p++] as { v: string }).v;
      a = { k: "bin", op, a, b: term() };
    }
    return a;
  }
  function term(): Ast {
    let a = unary();
    while (isOp("*") || isOp("/")) {
      const op = (toks[p++] as { v: string }).v;
      a = { k: "bin", op, a, b: unary() };
    }
    return a;
  }
  function unary(): Ast {
    if (isOp("-") || isOp("+")) {
      const op = (toks[p++] as { v: string }).v;
      return { k: "un", op, a: unary() };
    }
    return power();
  }
  function power(): Ast {
    const base = postfix();
    if (isOp("^")) {
      p++;
      return { k: "bin", op: "^", a: base, b: unary() }; // right-assoc
    }
    return base;
  }
  function postfix(): Ast {
    let a = primary();
    while (isOp("%")) {
      p++;
      a = { k: "pct", a };
    }
    return a;
  }
  function primary(): Ast {
    const t = peek();
    if (!t) throw new FormulaError("#ERRO!");
    if (t.t === "num") {
      p++;
      return { k: "num", v: t.v };
    }
    if (t.t === "op" && t.v === "(") {
      p++;
      const e = expr();
      expect(")");
      return e;
    }
    if (t.t === "id") {
      p++;
      if (isOp("(")) {
        p++;
        const args: Ast[] = [];
        if (!isOp(")")) {
          args.push(rangeOrExpr());
          while (isOp(",") || isOp(";")) {
            p++;
            args.push(rangeOrExpr());
          }
        }
        expect(")");
        return { k: "call", name: normName(t.v), args };
      }
      if (isCellRef(t.v)) {
        if (isOp(":")) {
          p++;
          const n = peek();
          if (!n || n.t !== "id" || !isCellRef(n.v)) throw new FormulaError("#REF!");
          p++;
          return { k: "range", from: normalizeRef(t.v), to: normalizeRef(n.v) };
        }
        return { k: "ref", ref: normalizeRef(t.v) };
      }
      return { k: "const", name: normName(t.v) };
    }
    throw new FormulaError("#ERRO!");
  }
  function rangeOrExpr(): Ast {
    return expr();
  }

  const ast = expr();
  if (p !== toks.length) throw new FormulaError("#ERRO!");
  return ast;
}

function normName(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

export interface EvalContext {
  cell?: (ref: string) => number;
  range?: (from: string, to: string) => number[];
}

const AGG: Record<string, (xs: number[]) => number> = {
  SOMA: (xs) => xs.reduce((a, b) => a + b, 0),
  SUM: (xs) => xs.reduce((a, b) => a + b, 0),
  MEDIA: (xs) => {
    if (!xs.length) throw new FormulaError("#DIV/0!");
    return xs.reduce((a, b) => a + b, 0) / xs.length;
  },
  AVERAGE: (xs) => AGG.MEDIA(xs),
  MINIMO: (xs) => (xs.length ? Math.min(...xs) : 0),
  MIN: (xs) => AGG.MINIMO(xs),
  MAXIMO: (xs) => (xs.length ? Math.max(...xs) : 0),
  MAX: (xs) => AGG.MAXIMO(xs),
  CONT: (xs) => xs.length,
  COUNT: (xs) => xs.length,
};

const UNARY: Record<string, (x: number) => number> = {
  ABS: Math.abs,
  RAIZ: Math.sqrt,
  SQRT: Math.sqrt,
  SIN: Math.sin,
  SEN: Math.sin,
  COS: Math.cos,
  TAN: Math.tan,
  LN: Math.log,
  LOG: Math.log10,
  EXP: Math.exp,
};

const CONSTS: Record<string, number> = { PI: Math.PI, E: Math.E };

export function evaluateAst(ast: Ast, ctx: EvalContext = {}): number {
  const ev = (n: Ast): number => {
    switch (n.k) {
      case "num":
        return n.v;
      case "const":
        if (n.name in CONSTS) return CONSTS[n.name];
        throw new FormulaError("#NOME?");
      case "ref":
        if (!ctx.cell) throw new FormulaError("#NOME?");
        return ctx.cell(n.ref);
      case "range":
        throw new FormulaError("#VALOR!");
      case "pct":
        return ev(n.a) / 100;
      case "un":
        return n.op === "-" ? -ev(n.a) : ev(n.a);
      case "bin": {
        const a = ev(n.a);
        const b = ev(n.b);
        switch (n.op) {
          case "+":
            return a + b;
          case "-":
            return a - b;
          case "*":
            return a * b;
          case "/":
            if (b === 0) throw new FormulaError("#DIV/0!");
            return a / b;
          case "^":
            return Math.pow(a, b);
        }
        throw new FormulaError("#ERRO!");
      }
      case "call": {
        if (n.name in AGG) {
          const xs: number[] = [];
          for (const a of n.args) {
            if (a.k === "range") {
              if (!ctx.range) throw new FormulaError("#NOME?");
              xs.push(...ctx.range(a.from, a.to));
            } else xs.push(ev(a));
          }
          return AGG[n.name](xs);
        }
        if (n.name in UNARY) {
          if (n.args.length !== 1) throw new FormulaError("#ERRO!");
          return UNARY[n.name](ev(n.args[0]));
        }
        if (n.name === "ARRED" || n.name === "ROUND") {
          const x = ev(n.args[0]);
          const d = n.args[1] ? ev(n.args[1]) : 0;
          const f = Math.pow(10, d);
          return Math.round(x * f) / f;
        }
        if (n.name === "POTENCIA" || n.name === "POWER") {
          return Math.pow(ev(n.args[0]), ev(n.args[1]));
        }
        throw new FormulaError("#NOME?");
      }
    }
  };
  const r = ev(ast);
  if (!Number.isFinite(r)) throw new FormulaError("#NUM!");
  return r;
}

export function evaluate(src: string, ctx: EvalContext = {}): number {
  return evaluateAst(parse(src), ctx);
}

/** Calculator helper for the editor: returns formatted result or an error code. */
export function calculate(expr: string): { ok: true; value: number; text: string } | { ok: false; error: string } {
  try {
    const v = evaluate(expr);
    return { ok: true, value: v, text: formatNumber(v) };
  } catch (e) {
    return { ok: false, error: e instanceof FormulaError ? e.code : "#ERRO!" };
  }
}

export function formatNumber(v: number) {
  const r = Math.round(v * 1e10) / 1e10;
  return String(r);
}

