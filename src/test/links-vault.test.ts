import { describe, expect, it } from "vitest";
import { buildLinkIndex, extractTags, extractWikilinks } from "@/lib/links";
import { Vault, cacheKey, enqueue, type Backend, type Note } from "@/lib/vault";

describe("wikilinks", () => {
  it("extrai alvos e apelidos, ignorando código", () => {
    const l = extractWikilinks("Veja [[Ideias]] e [[Projeto X|o projeto]].\n`[[não]]`\n```\n[[nem]]\n```");
    expect(l).toEqual([{ target: "Ideias", alias: undefined }, { target: "Projeto X", alias: "o projeto" }]);
  });
  it("backlinks e links ausentes", () => {
    const idx = buildLinkIndex([
      { id: "a", title: "A", content: "liga [[B]] e [[Fantasma]]" },
      { id: "b", title: "B", content: "volta para [[a]]" },
      { id: "c", title: "C", content: "[[B]]", deleted_at: "2026-01-01" },
    ]);
    expect(idx.backlinks.get("b")).toEqual(["a"]);
    expect(idx.backlinks.get("a")).toEqual(["b"]);
    expect(idx.missing.get("a")).toEqual(["Fantasma"]);
  });
  it("tags não confundem títulos", () => {
    expect(extractTags("# Título\ntexto #ideia e #projeto/alfa #123")).toEqual(["ideia", "projeto/alfa"]);
  });
});

function memStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
}

function fakeServer() {
  const rows = new Map<string, Note>();
  let offline = false;
  const backend: Backend = {
    async list() {
      if (offline) throw new Error("Failed to fetch");
      return { notes: [...rows.values()], folders: [] };
    },
    async get(id) {
      return rows.get(id) ?? null;
    },
    async insert(n) {
      if (offline) return { ok: false, reason: "network" };
      rows.set(n.id, { ...n, version: 1 });
      return { ok: true, note: rows.get(n.id) };
    },
    async update(id, base, fields) {
      if (offline) return { ok: false, reason: "network" };
      const r = rows.get(id);
      if (!r || r.version !== base) return { ok: false, reason: "mismatch" };
      const n = { ...r, ...fields, version: r.version + 1 };
      rows.set(id, n);
      return { ok: true, note: n };
    },
    async remove(id, base) {
      const r = rows.get(id);
      if (!r || r.version !== base) return { ok: false, reason: "mismatch" };
      rows.delete(id);
      return { ok: true };
    },
    async addFolder() {
      return { ok: true };
    },
    async delFolder() {
      return { ok: true };
    },
  };
  return { rows, backend, setOffline: (v: boolean) => (offline = v) };
}

describe("sincronização e conflitos", () => {
  it("coalesce edições pendentes", () => {
    let q = enqueue([], { kind: "update", id: "x", base: 3, fields: { title: "a" } });
    q = enqueue(q, { kind: "update", id: "x", base: 3, fields: { content: "b" } });
    expect(q).toEqual([{ kind: "update", id: "x", base: 3, fields: { title: "a", content: "b" } }]);
  });

  it("fila offline é enviada quando volta a conexão", async () => {
    const s = fakeServer();
    const v = new Vault("u1", s.backend, memStorage());
    s.setOffline(true);
    const n = v.createNote({ title: "Offline" });
    await v.flush();
    expect(v.state.status).toBe("offline");
    expect(v.state.queue).toHaveLength(1);
    s.setOffline(false);
    await v.sync();
    expect(s.rows.get(n.id)?.title).toBe("Offline");
    expect(v.state.status).toBe("saved");
  });

  it("nunca sobrescreve silenciosamente: edição concorrente vira conflito", async () => {
    const s = fakeServer();
    const a = new Vault("u1", s.backend, memStorage());
    const n = a.createNote({ title: "Nota", content: "v1" });
    await a.flush();
    const b = new Vault("u1", s.backend, memStorage());
    await b.pull();
    b.updateNote(n.id, { content: "editado em B" });
    await b.flush();
    a.updateNote(n.id, { content: "editado em A" });
    await a.flush();
    expect(a.state.status).toBe("conflict");
    expect(s.rows.get(n.id)?.content).toBe("editado em B");
    a.resolveConflict(n.id, "both");
    await a.flush();
    const titles = [...s.rows.values()].map((r) => r.content).sort();
    expect(titles).toEqual(["editado em A", "editado em B"]);
  });
});

describe("isolamento de dados no dispositivo", () => {
  it("cache local separado por usuário", () => {
    const st = memStorage();
    const u1 = new Vault("user-1", null, st);
    u1.createNote({ title: "Segredo de 1" });
    const u2 = new Vault("user-2", null, st);
    expect(Object.values(u2.state.notes)).toHaveLength(0);
    expect(cacheKey("user-1")).not.toBe(cacheKey("user-2"));
  });
});


describe('salvamento durante requisições',()=>{
 it('preserva edições feitas durante a criação remota',async()=>{
  const s=fakeServer();let release!:()=>void;const gate=new Promise<void>(r=>release=r);const original=s.backend.insert;
  s.backend.insert=async n=>{await gate;return original(n)};
  const v=new Vault('u1',s.backend,memStorage());const n=v.createNote({title:'Nota',content:'antes'});const pending=v.flush();
  v.updateNote(n.id,{content:'depois'});release();await pending;
  expect(s.rows.get(n.id)?.content).toBe('depois');expect(v.state.queue).toHaveLength(0);
 });
 it('recupera fila persistida após fechamento offline',async()=>{
  const s=fakeServer(),storage=memStorage();s.setOffline(true);const a=new Vault('u1',s.backend,storage);const n=a.createNote({title:'Recuperação'});await a.flush();
  const b=new Vault('u1',s.backend,storage);expect(b.state.queue).toHaveLength(1);s.setOffline(false);await b.sync();expect(s.rows.get(n.id)?.title).toBe('Recuperação');
 });
 it('não apaga uma nota criada durante uma leitura antiga',async()=>{
  const s=fakeServer();let release!:()=>void;const gate=new Promise<void>(r=>release=r);
  s.backend.list=async()=>{await gate;return {notes:[],folders:[]}};
  const v=new Vault('u1',s.backend,memStorage());const pending=v.pull();const n=v.createNote({title:'Nova durante leitura'});await v.flush();release();await pending;
  expect(v.state.notes[n.id]?.title).toBe('Nova durante leitura');
 });
});
