import { extractTags } from "./links";

export type NoteKind = "note" | "sheet";
export interface Note {
  id: string;
  kind: NoteKind;
  title: string;
  content: string;
  folder: string;
  tags: string[];
  favorite: boolean;
  deleted_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}
export type NoteFields = Partial<Pick<Note, "title" | "content" | "folder" | "tags" | "favorite" | "deleted_at" | "kind">>;

export type Op =
  | { kind: "create"; note: Note }
  | { kind: "update"; id: string; base: number; fields: NoteFields }
  | { kind: "remove"; id: string; base: number }
  | { kind: "folder-add"; path: string }
  | { kind: "folder-del"; path: string };

export interface Conflict {
  id: string;
  local: Note;
  server: Note | null;
}

export type SyncStatus = "demo" | "saved" | "pending" | "saving" | "offline" | "error" | "conflict";

/** Result of a remote write. "mismatch" = server row has a different version (or is gone). */
export type WriteResult = { ok: true; note?: Note } | { ok: false; reason: "mismatch" | "network" | "error"; message?: string };

export interface Backend {
  list(): Promise<{ notes: Note[]; folders: string[] }>;
  get(id: string): Promise<Note | null>;
  insert(n: Note): Promise<WriteResult>;
  update(id: string, base: number, fields: NoteFields): Promise<WriteResult>;
  remove(id: string, base: number): Promise<WriteResult>;
  addFolder(path: string): Promise<WriteResult>;
  delFolder(path: string): Promise<WriteResult>;
}

/** Coalesces a new op into the queue. Pure, exported for tests. */
export function enqueue(queue: Op[], op: Op): Op[] {
  const q = [...queue];
  if (op.kind === "update") {
    const i = q.findIndex((o) => (o.kind === "create" && o.note.id === op.id) || (o.kind === "update" && o.id === op.id));
    if (i >= 0) {
      const prev = q[i];
      if (prev.kind === "create") q[i] = { kind: "create", note: { ...prev.note, ...op.fields } };
      else if (prev.kind === "update") q[i] = { ...prev, fields: { ...prev.fields, ...op.fields } };
      return q;
    }
  }
  if (op.kind === "remove") {
    const ci = q.findIndex((o) => o.kind === "create" && o.note.id === op.id);
    if (ci >= 0) return q.filter((_, j) => j !== ci && !(q[j].kind === "update" && (q[j] as { id: string }).id === op.id));
    const ui = q.findIndex((o) => o.kind === "update" && o.id === op.id);
    if (ui >= 0) {
      const base = (q[ui] as { base: number }).base;
      q.splice(ui, 1);
      q.push({ kind: "remove", id: op.id, base });
      return q;
    }
  }
  q.push(op);
  return q;
}

export function opNoteId(op: Op): string | null {
  if (op.kind === "create") return op.note.id;
  if (op.kind === "update" || op.kind === "remove") return op.id;
  return null;
}

export interface VaultState {
  notes: Record<string, Note>;
  folders: string[];
  queue: Op[];
  conflicts: Conflict[];
  status: SyncStatus;
  lastError?: string;
  lastSynced?: string;
  hydrated: boolean;
}

export function cacheKey(scope: string) {
  return `nexo:v1:${scope}`;
}

interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

export class Vault {
  state: VaultState;
  private listeners = new Set<() => void>();
  private flushJob: Promise<void> | null = null;

  constructor(
    public scope: string,
    private backend: Backend | null,
    private storage: StorageLike | null,
  ) {
    let cached: Partial<VaultState> = {};
    try {
      const raw = storage?.getItem(cacheKey(scope));
      if (raw) cached = JSON.parse(raw);
    } catch {
      /* corrupt cache: start fresh */
    }
    this.state = {
      notes: cached.notes ?? {},
      folders: cached.folders ?? [],
      queue: cached.queue ?? [],
      conflicts: cached.conflicts ?? [],
      lastSynced: cached.lastSynced,
      status: backend ? ((cached.queue?.length ?? 0) > 0 ? "pending" : "saved") : "demo",
      hydrated: !backend,
    };
    if (this.state.conflicts.length) this.state.status = "conflict";
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.state;

  private set(patch: Partial<VaultState>) {
    this.state = { ...this.state, ...patch };
    try {
      const { notes, folders, queue, conflicts, lastSynced } = this.state;
      this.storage?.setItem(cacheKey(this.scope), JSON.stringify({ notes, folders, queue, conflicts, lastSynced }));
    } catch {
      this.state = { ...this.state, status: "error", lastError: "Armazenamento local cheio ou indisponível. Exporte um backup antes de fechar." };
    }
    this.listeners.forEach((l) => l());
  }

  private push(op: Op) {
    if (!this.backend) return;
    this.set({ queue: enqueue(this.state.queue, op), status: this.state.conflicts.length ? "conflict" : "pending" });
    // Sync is scheduled by the application; the persistent queue keeps every edit.
  }

  // ---------- note API ----------
  createNote(input: Partial<Note> & { title: string }): Note {
    const now = new Date().toISOString();
    const note: Note = {
      id: input.id ?? crypto.randomUUID(),
      kind: input.kind ?? "note",
      title: input.title,
      content: input.content ?? "",
      folder: input.folder ?? "",
      tags: input.kind === "sheet" ? [] : extractTags(input.content ?? ""),
      favorite: input.favorite ?? false,
      deleted_at: null,
      version: 1,
      created_at: now,
      updated_at: now,
    };
    this.set({ notes: { ...this.state.notes, [note.id]: note } });
    this.push({ kind: "create", note });
    return note;
  }

  updateNote(id: string, fields: NoteFields) {
    const n = this.state.notes[id];
    if (!n) return;
    const f: NoteFields = { ...fields };
    if (fields.content !== undefined && n.kind === "note") f.tags = extractTags(fields.content);
    const next = { ...n, ...f, updated_at: new Date().toISOString() };
    this.set({ notes: { ...this.state.notes, [id]: next } });
    this.push({ kind: "update", id, base: n.version, fields: f });
  }

  trash(id: string) {
    this.updateNote(id, { deleted_at: new Date().toISOString() });
  }
  restore(id: string) {
    this.updateNote(id, { deleted_at: null });
  }
  deleteForever(id: string) {
    const n = this.state.notes[id];
    if (!n) return;
    const notes = { ...this.state.notes };
    delete notes[id];
    this.set({ notes });
    this.push({ kind: "remove", id, base: n.version });
  }

  addFolder(path: string) {
    path = path.trim().replace(/^\/+|\/+$/g, "");
    if (!path || this.state.folders.includes(path)) return;
    this.set({ folders: [...this.state.folders, path].sort() });
    this.push({ kind: "folder-add", path });
  }
  removeFolder(path: string) {
    this.set({ folders: this.state.folders.filter((f) => f !== path) });
    this.push({ kind: "folder-del", path });
  }

  // ---------- conflicts ----------
  resolveConflict(id: string, choice: "local" | "server" | "both") {
    const c = this.state.conflicts.find((x) => x.id === id);
    if (!c) return;
    const conflicts = this.state.conflicts.filter((x) => x.id !== id);
    let queue = this.state.queue.filter((o) => opNoteId(o) !== id);
    const notes = { ...this.state.notes };
    if (choice === "local") {
      const local = { ...c.local, ...notes[id] };
      if (c.server) {
        notes[id] = { ...local, version: c.server.version };
        queue = [
          { kind: "update", id, base: c.server.version, fields: pickFields(local) },
          ...queue,
        ];
      } else {
        queue = [{ kind: "create", note: { ...local, version: 1 } }, ...queue];
      }
    } else if (choice === "server") {
      if (c.server) notes[id] = c.server;
      else delete notes[id];
    } else {
      const local = { ...c.local, ...notes[id] };
      if (c.server) notes[id] = c.server;
      else delete notes[id];
      const copy: Note = { ...local, id: crypto.randomUUID(), title: `${local.title} (cópia local)`, version: 1 };
      notes[copy.id] = copy;
      queue = [{ kind: "create", note: copy }, ...queue];
    }
    this.set({ notes, conflicts, queue, status: conflicts.length ? "conflict" : queue.length ? "pending" : "saved" });
    // Sync is scheduled by the application; the persistent queue keeps every edit.
  }

  // ---------- sync ----------
  flush(): Promise<void> {
    if (this.flushJob) return this.flushJob;
    this.flushJob = this.runFlush().finally(() => { this.flushJob = null; });
    return this.flushJob;
  }

  private async runFlush(): Promise<void> {
    if (!this.backend) return;
    while (true) {
      const blocked = new Set(this.state.conflicts.map(c => c.id));
      const op = this.state.queue.find(o => !blocked.has(opNoteId(o) ?? ""));
      if (!op) break;
      this.set({ status: "saving" });
      let res: WriteResult;
      try {
        switch(op.kind) {
          case "create": res = await this.backend.insert(op.note); break;
          case "update": res = await this.backend.update(op.id, op.base, op.fields); break;
          case "remove": res = await this.backend.remove(op.id, op.base); break;
          case "folder-add": res = await this.backend.addFolder(op.path); break;
          case "folder-del": res = await this.backend.delFolder(op.path); break;
        }
      } catch(e) { res = { ok:false, reason:"network", message:String(e) }; }
      const id = opNoteId(op);
      if (res.ok) {
        const version = res.note?.version;
        let queue = this.state.queue.filter(o => o !== op);
        if (id && version) queue = queue.map(o => {
          if (opNoteId(o) !== id) return o;
          if (o.kind === "create") return {kind:"update",id,base:version,fields:pickFields(o.note)};
          if (o.kind === "update" || o.kind === "remove") return {...o,base:version};
          return o;
        });
        const notes = {...this.state.notes};
        if (id && notes[id] && version) notes[id] = {...notes[id],version};
        this.set({queue,notes});
      } else if (res.reason === "mismatch" && id) {
        let server: Note|null;
        try { server = await this.backend.get(id); }
        catch(e) { this.set({status:"offline",lastError:String(e)}); return; }
        if (op.kind === "remove" && !server) {
          this.set({queue:this.state.queue.filter(o => o !== op)}); continue;
        }
        const local = this.state.notes[id] ?? (op.kind === "create" ? op.note : server);
        if (!local) { this.set({status:"error",lastError:"Não foi possível recuperar a versão em conflito."}); return; }
        this.set({conflicts:[...this.state.conflicts.filter(c=>c.id!==id),{id,local,server}],notes:{...this.state.notes,[id]:local}});
      } else {
        this.set({status:res.reason === "network" ? "offline" : "error",lastError:res.message}); return;
      }
    }
    this.set({status:this.state.conflicts.length ? "conflict" : this.state.queue.length ? "pending" : "saved",lastError:undefined,lastSynced:new Date().toISOString()});
  }

  async pull(): Promise<boolean> {
    if (!this.backend) return true;
    const before = this.state.notes;
    let data: { notes: Note[]; folders: string[] };
    try {
      data = await this.backend.list();
    } catch (e) {
      this.set({ status: this.state.queue.length ? "offline" : "offline", lastError: String(e), hydrated: true });
      return false;
    }
    const pendingIds = new Set(this.state.queue.map(opNoteId).filter(Boolean) as string[]);
    for (const c of this.state.conflicts) pendingIds.add(c.id);
    for (const [id,n] of Object.entries(this.state.notes)) if(n !== before[id]) pendingIds.add(id);
    const notes: Record<string, Note> = {};
    for (const n of data.notes) notes[n.id] = (pendingIds.has(n.id) || (this.state.notes[n.id]?.version ?? 0) > n.version) && this.state.notes[n.id] ? this.state.notes[n.id] : n;
    for (const id of pendingIds) if (!notes[id] && this.state.notes[id]) notes[id] = this.state.notes[id];
    const folders = new Set(data.folders);
    for (const o of this.state.queue) {
      if (o.kind === "folder-add") folders.add(o.path);
      if (o.kind === "folder-del") folders.delete(o.path);
    }
    this.set({ notes, folders: [...folders].sort(), hydrated: true, lastSynced: new Date().toISOString() });
    return true;
  }

  async sync() {
    await this.flush();
    const ok = await this.pull();
    if (ok) await this.flush();
    return ok;
  }
}

function pickFields(n: Note): NoteFields {
  const { title, content, folder, tags, favorite, deleted_at, kind } = n;
  return { title, content, folder, tags, favorite, deleted_at, kind };
}

