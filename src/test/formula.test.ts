import { describe, expect, it } from "vitest";
import { calculate, evaluate } from "@/lib/formula";
import { computeSheet, displayCell, sheetToCsv } from "@/lib/sheet";

describe("calculadora segura", () => {
  it("respeita precedência e potência à direita", () => {
    expect(evaluate("2+3*4")).toBe(14);
    expect(evaluate("2^3^2")).toBe(512);
    expect(evaluate("-(2+3)*2")).toBe(-10);
    expect(evaluate("50%*200")).toBe(100);
  });
  it("não executa código arbitrário", () => {
    expect(calculate("alert(1)")).toEqual({ ok: false, error: "#NOME?" });
    expect(calculate("constructor.constructor('x')()").ok).toBe(false);
  });
  it("detecta divisão por zero", () => {
    expect(calculate("1/0")).toEqual({ ok: false, error: "#DIV/0!" });
  });
  it("funções em português e inglês", () => {
    expect(evaluate("SOMA(1;2;3)")).toBe(6);
    expect(evaluate("sum(1,2,3)")).toBe(6);
    expect(evaluate("MÉDIA(2;4)")).toBe(3);
    expect(evaluate("MAX(1;9;3)")).toBe(9);
    expect(evaluate("mínimo(4;2)")).toBe(2);
    expect(evaluate("RAIZ(16)")).toBe(4);
  });
});

describe("planilha", () => {
  it("referências A1 e intervalos", () => {
    const r = computeSheet({ rows: 5, cols: 3, cells: { A1: "10", A2: "20", A3: "=SOMA(A1:A2)", B1: "=A3*2", C1: "=MÉDIA(A1:A2)" } });
    expect(r.A3.value).toBe(30);
    expect(r.B1.value).toBe(60);
    expect(r.C1.value).toBe(15);
  });
  it("recalcula ao alterar uma célula", () => {
    const cells: Record<string, string> = { A1: "1", A2: "=A1+1" };
    expect(computeSheet({ rows: 3, cols: 2, cells }).A2.value).toBe(2);
    cells.A1 = "41";
    expect(computeSheet({ rows: 3, cols: 2, cells }).A2.value).toBe(42);
  });
  it("detecta ciclos", () => {
    const r = computeSheet({ rows: 3, cols: 2, cells: { A1: "=B1", B1: "=A1", A2: "=A1+1" } });
    expect(r.A1.error).toBe("#CICLO!");
    expect(r.B1.error).toBe("#CICLO!");
    expect(r.A2.error).toBe("#CICLO!");
  });
  it("erros de referência, texto e divisão", () => {
    const r = computeSheet({ rows: 3, cols: 2, cells: { A1: "=Z99", A2: "texto", B1: "=A2+1", B2: "=1/0" } });
    expect(r.A1.error).toBe("#REF!");
    expect(r.B1.error).toBe("#VALOR!");
    expect(r.B2.error).toBe("#DIV/0!");
  });
  it("exporta CSV com valores calculados", () => {
    const d = { rows: 3, cols: 2, cells: { A1: "Item", B1: "Valor", A2: "x", B2: "=2*3" } };
    expect(sheetToCsv(d)).toBe("Item,Valor\nx,6");
    expect(displayCell(computeSheet(d).B2)).toBe("6");
  });
});

