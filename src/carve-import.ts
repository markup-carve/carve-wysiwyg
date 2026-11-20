/**
 * Import direction: Carve source -> preview HTML and document facts through the
 * Carve 0.2 engine. Keeping this seam in one module makes the app exercise the
 * same public API that downstream editors consume.
 */
import { parse, renderWithDocumentTransforms, tabsExtensions, tabsRenderer, type DocumentNode } from '@markup-carve/carve';
import { citations, codeGroup, details, presets, spoiler, withExtensions } from '@markup-carve/carve/extensions';

const BUNDLE = withExtensions(citations(), codeGroup(), details(), spoiler(), presets(), {
  extensions: tabsExtensions,
  renderers: { 'carve.tabs': tabsRenderer },
});
const EXTENSION_OPTIONS = { extensions: BUNDLE.extensions, renderers: BUNDLE.renderers };
export { carveToEditorDocument } from './editor';

export const DIAGRAM_LANGUAGES = new Set(['mermaid', 'graphviz', 'dot', 'd2', 'plantuml', 'wavedrom', 'abc', 'vega-lite', 'chart']);

/** UTF-16 index of a UTF-8 byte offset into `source` (0.2 positions count bytes, C2-A-027). */
function utf16Index(source: string, byteOffset: number): number {
  let bytes = 0;
  for (let index = 0; index < source.length;) {
    if (bytes >= byteOffset) return index;
    const code = source.codePointAt(index) as number;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
    index += code > 0xffff ? 2 : 1;
  }
  return source.length;
}

/** The front matter of `source`, with its line break, and the body after it, as the engine reads them. */
export function splitFrontmatter(source: string): { frontmatter: string; body: string } {
  const first = parse(source, { positions: true }).children[0] as { type: string; pos?: { endOffset: number } } | undefined;
  if (first?.type !== 'frontmatter' || first.pos === undefined) return { frontmatter: '', body: source };
  const end = utf16Index(source, first.pos.endOffset);
  const split = end + (/^(?:\r\n|\n)/.exec(source.slice(end))?.[0].length ?? 0);
  return { frontmatter: source.slice(0, split), body: source.slice(split) };
}

/** Render Carve source for the preview pane. */
export function carveToHtmlRaw(source: string): string {
  const html = renderWithDocumentTransforms(source, BUNDLE.transforms ?? [], EXTENSION_OPTIONS).html;
  const withCodeLanguages = html.replace(
    /<pre([^>]*)><code class="language-([^"\s]+)"/g,
    '<pre$1 data-language="$2"><code class="language-$2"',
  );
  return withCodeLanguages.replace(/<pre([^>]*)>/g, (match, attrs: string) => {
    if (/\sdata-language=/.test(attrs)) return match;
    const classes = attrs.match(/\sclass="([^"]+)"/)?.[1] ?? '';
    const language = classes.split(/\s+/).find(name => DIAGRAM_LANGUAGES.has(name));
    return language ? `<pre${attrs} data-language="${language}">` : match;
  });
}

export interface HeadingTarget { id: string; type: 'heading'; label: string }

/** Heading ids as the engine assigns them, including suffixes and Unicode rules. */
export function carveHeadingTargets(source: string): HeadingTarget[] {
  const root = parse(source, { extensions: BUNDLE.extensions }) as DocumentNode as unknown as Record<string, unknown>;
  const found: HeadingTarget[] = [];
  const text = (node: Record<string, unknown>): string => {
    if (typeof node.value === 'string') return node.value;
    return Array.isArray(node.children)
      ? node.children.map(child => text(child as Record<string, unknown>)).join('') : '';
  };
  const visit = (node: Record<string, unknown>): void => {
    if (node.type === 'heading') {
      const attrs = node.attrs as Record<string, unknown> | undefined;
      const id = typeof attrs?.id === 'string' ? attrs.id : node.generatedId;
      if (typeof id === 'string') found.push({ id, type: 'heading', label: text(node) });
    }
    if (Array.isArray(node.children)) node.children.forEach(child => visit(child as Record<string, unknown>));
  };
  visit(root);
  return found;
}

/** The comments of `source`: the editor has no comment node, so they are counted in the tree. */
export function carveCommentCount(source: string): number {
  let count = 0;
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!value || typeof value !== 'object') return;
    const node = value as Record<string, unknown>;
    if (node.type === 'comment') count += 1;
    for (const [key, child] of Object.entries(node)) if (key !== 'pos' && key !== 'attrs') visit(child);
  };
  visit(parse(source).children);
  return count;
}
