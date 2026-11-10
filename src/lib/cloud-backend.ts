import { createAccountClient } from "@/integrations/supabase/client";
import type { Backend, Note, WriteResult } from "./vault";

const COLS = "id,kind,title,content,folder,tags,favorite,deleted_at,version,created_at,updated_at";

function fail(error: { message: string; code?: string } | null): WriteResult {
  const msg = error?.message ?? "erro";
  const network = !error?.code && /fetch|network|Failed|Load failed|timeout/i.test(msg);
  return { ok: false, reason: network ? "network" : "error", message: msg };
}

async function guard<T>(p: PromiseLike<T>): Promise<T | WriteResult> {
  try {
    return await p;
  } catch (e) {
    return { ok: false, reason: "network", message: String(e) };
  }
}

/** Bind every request to the account that owns this vault, including retries and paginated reads. */
export function createCloudBackend(userId: string): Backend {
  const supabase = createAccountClient(userId);
  return {
    async list() {
      const notes: Note[] = [];
      for(let start=0;;start+=1000){
        const n=await supabase.from("notes").select(COLS).order("id").range(start,start+999);
        if(n.error)throw new Error(n.error.message);
        notes.push(...(n.data??[]) as Note[]);
        if((n.data?.length??0)<1000)break;
      }
      const folders: string[]=[];
      for(let start=0;;start+=1000){
        const f=await supabase.from("folders").select("path").order("id").range(start,start+999);
        if(f.error)throw new Error(f.error.message);
        folders.push(...(f.data??[]).map(x=>x.path));
        if((f.data?.length??0)<1000)break;
      }
      return {notes,folders};
    },
    async get(id) {
      const r = await supabase.from("notes").select(COLS).eq("id", id).maybeSingle();
      if (r.error) throw new Error(r.error.message);
      return (r.data as Note) ?? null;
    },
    async insert(n) {
      const { id, kind, title, content, folder, tags, favorite, deleted_at, created_at } = n;
      const r = await guard(supabase.from("notes").insert({ id, kind, title, content, folder, tags, favorite, deleted_at, created_at }).select(COLS).single());
      if ("ok" in r) return r;
      if (r.error) {
        if (r.error.code === "23505") return { ok: false, reason: "mismatch" };
        return fail(r.error);
      }
      return { ok: true, note: r.data as Note };
    },
    async update(id, base, fields) {
      const r = await guard(supabase.from("notes").update(fields).eq("id", id).eq("version", base).select(COLS));
      if ("ok" in r) return r;
      if (r.error) return fail(r.error);
      if (!r.data?.length) return { ok: false, reason: "mismatch" };
      return { ok: true, note: r.data[0] as Note };
    },
    async remove(id, base) {
      const r = await guard(supabase.from("notes").delete().eq("id", id).eq("version", base).select("id"));
      if ("ok" in r) return r;
      if (r.error) return fail(r.error);
      if (!r.data?.length) return { ok: false, reason: "mismatch" };
      return { ok: true };
    },
    async addFolder(path) {
      const r = await guard(supabase.from("folders").upsert({ path }, { onConflict: "user_id,path", ignoreDuplicates: true }));
      if ("ok" in r) return r;
      return r.error ? fail(r.error) : { ok: true };
    },
    async delFolder(path) {
      const r = await guard(supabase.from("folders").delete().eq("path", path));
      if ("ok" in r) return r;
      return r.error ? fail(r.error) : { ok: true };
    },
  };
}
