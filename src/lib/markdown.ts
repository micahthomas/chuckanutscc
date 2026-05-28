import { Marked } from "marked";

const marked = new Marked({
  gfm: true,
  breaks: false,
});

export function renderMarkdown(md: string): string {
  return marked.parse(md, { async: false }) as string;
}

export interface TocItem {
  id: string;
  label: string;
}

/** Slugify a heading text into an id suitable for `<a href="#…">`. */
function headingSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Render markdown and, while doing it, (a) inject `id` attributes on every
 * `<h2>` / `<h3>` and (b) collect the `<h2>` headings into a flat TOC array
 * the CmsPage sidebar can render.
 *
 * Kept separate from `renderMarkdown` so admin previews and other callers
 * that don't want the IDs are unaffected.
 */
export function renderMarkdownWithToc(md: string): { html: string; toc: TocItem[] } {
  const toc: TocItem[] = [];
  const used = new Set<string>();

  const inst = new Marked({ gfm: true, breaks: false });
  inst.use({
    renderer: {
      heading(token: { depth: number; text: string; tokens: unknown[] }) {
        // @ts-expect-error — marked's renderer.this is the Renderer; .parser is
        // attached at parse time and isn't in the published type.
        const inline = this.parser.parseInline(token.tokens) as string;
        const base = headingSlug(token.text) || `section-${toc.length + 1}`;
        let id = base;
        let n = 2;
        while (used.has(id)) id = `${base}-${n++}`;
        used.add(id);
        if (token.depth === 2) toc.push({ id, label: token.text });
        return `<h${token.depth} id="${id}">${inline}</h${token.depth}>\n`;
      },
    },
  });

  const html = inst.parse(md, { async: false }) as string;
  return { html, toc };
}
