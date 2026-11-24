import { Marked, type TokenizerAndRendererExtension } from "marked";
import katex from "katex";
import DOMPurify from "dompurify";
import { normTitle } from "./links";

function renderMath(src: string, display: boolean) {
  try {
    return katex.renderToString(src, { displayMode: display, throwOnError: false, output: "html" });
  } catch {
    return `<code class="math-error">${escapeHtml(src)}</code>`;
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function renderMarkdown(md: string, titles: Set<string>): string {
  const blockMath: TokenizerAndRendererExtension = {
    name: "blockMath",
    level: "block",
    start: (s) => s.indexOf("$$"),
    tokenizer(src) {
      const m = /^\$\$([\s\S]+?)\$\$(?:\n|$)/.exec(src);
      if (m) return { type: "blockMath", raw: m[0], text: m[1].trim() };
    },
    renderer: (t) => `<div class="math-block">${renderMath(t.text, true)}</div>`,
  };
  const inlineMath: TokenizerAndRendererExtension = {
    name: "inlineMath",
    level: "inline",
    start: (s) => s.indexOf("$"),
    tokenizer(src) {
      const m = /^\$(?!\s)([^$\n]+?)(?<!\s)\$(?!\d)/.exec(src);
      if (m) return { type: "inlineMath", raw: m[0], text: m[1] };
    },
    renderer: (t) => renderMath(t.text, false),
  };
  const wiki: TokenizerAndRendererExtension = {
    name: "wikilink",
    level: "inline",
    start: (s) => s.indexOf("[["),
    tokenizer(src) {
      const m = /^\[\[([^\]\n|]+)(?:\|([^\]\n]+))?\]\]/.exec(src);
      if (m) return { type: "wikilink", raw: m[0], target: m[1].split("#")[0].trim(), alias: m[2]?.trim() };
    },
    renderer: (t) => {
      const exists = titles.has(normTitle(t.target));
      return `<a href="#" class="wikilink${exists ? "" : " wikilink-missing"}" data-wikilink="${escapeHtml(t.target)}">${escapeHtml(t.alias || t.target)}</a>`;
    },
  };
  const tag: TokenizerAndRendererExtension = {
    name: "tag",
    level: "inline",
    start: (s) => {
      const m = /(^|\s)#[\p{L}]/u.exec(s);
      return m ? m.index + m[1].length : -1;
    },
    tokenizer(src) {
      const m = /^#([\p{L}\p{N}_\-/]*\p{L}[\p{L}\p{N}_\-/]*)/u.exec(src);
      if (m) return { type: "tag", raw: m[0], text: m[1] };
    },
    renderer: (t) => `<span class="md-tag" data-tag="${escapeHtml(t.text.toLowerCase())}">#${escapeHtml(t.text)}</span>`,
  };
  const marked = new Marked({ gfm: true, breaks: true, extensions: [blockMath, inlineMath, wiki, tag] });
  const html = (marked.parse(md, { async: false }) as string).replace(
    /<input\b([^>]*)\bdisabled(?:=""|="disabled")?([^>]*type="checkbox"[^>]*|[^>]*)/gi,
    (match) => (match.includes('type="checkbox"') ? match.replace(/\s+disabled(?:=""|="disabled")?/i, '') : match),
  );
  return DOMPurify.sanitize(html, { ADD_ATTR: ["data-wikilink", "data-tag"] });
}
