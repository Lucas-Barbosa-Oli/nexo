export interface WikiLink {
  target: string;
  alias?: string;
}

/** Removes fenced code, inline code and math so links/tags inside them are ignored. */
export function stripCode(md: string) {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`\n]*`/g, " ")
    .replace(/\$\$[\s\S]*?\$\$/g, " ");
}

export function extractWikilinks(md: string): WikiLink[] {
  const out: WikiLink[] = [];
  const re = /\[\[([^\]\n|]+)(?:\|([^\]\n]+))?\]\]/g;
  const src = stripCode(md);
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const target = m[1].split("#")[0].trim();
    if (target) out.push({ target, alias: m[2]?.trim() });
  }
  return out;
}

export function extractTags(md: string): string[] {
  const set = new Set<string>();
  const re = /(^|[\s(])#([\p{L}\p{N}_\-/]*\p{L}[\p{L}\p{N}_\-/]*)/gu;
  let m: RegExpExecArray | null;
  const src = stripCode(md);
  while ((m = re.exec(src))) set.add(m[2].toLowerCase());
  return [...set].sort();
}

export const normTitle = (s: string) => s.trim().toLowerCase();

export interface LinkableNote {
  id: string;
  title: string;
  content: string;
  kind?: string;
  deleted_at?: string | null;
}

export interface LinkIndex {
  byTitle: Map<string, string>;
  outgoing: Map<string, string[]>;
  backlinks: Map<string, string[]>;
  missing: Map<string, string[]>;
}

export function buildLinkIndex(notes: LinkableNote[]): LinkIndex {
  const live = notes.filter((n) => !n.deleted_at);
  const byTitle = new Map<string, string>();
  for (const n of live) if (!byTitle.has(normTitle(n.title))) byTitle.set(normTitle(n.title), n.id);
  const outgoing = new Map<string, string[]>();
  const backlinks = new Map<string, string[]>();
  const missing = new Map<string, string[]>();
  for (const n of live) {
    if (n.kind === "sheet") continue;
    const outs = new Set<string>();
    const miss = new Set<string>();
    for (const l of extractWikilinks(n.content)) {
      const id = byTitle.get(normTitle(l.target));
      if (id && id !== n.id) outs.add(id);
      else if (!id) miss.add(l.target);
    }
    outgoing.set(n.id, [...outs]);
    missing.set(n.id, [...miss]);
    for (const t of outs) {
      const arr = backlinks.get(t) ?? [];
      arr.push(n.id);
      backlinks.set(t, arr);
    }
  }
  return { byTitle, outgoing, backlinks, missing };
}

