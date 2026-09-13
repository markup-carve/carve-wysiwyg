/**
 * Import direction: Carve source -> ProseMirror JSON through the shared AST
 * bridge. Keeping this seam in one module makes the app exercise the same
 * public API that downstream editors consume.
 */
import { carveToHtml, citations, codeGroup, details, parse, presets, resolve, spoiler, tabs } from '@markup-carve/carve';
import { carveToProseMirror } from '@markup-carve/carve-grammars/tiptap';
import type { JSONContent } from '@tiptap/core';

const EXTENSIONS = [citations(), codeGroup(), details(), spoiler(), tabs(), ...presets()];
export const DIAGRAM_LANGUAGES = new Set(['mermaid', 'graphviz', 'dot', 'd2', 'plantuml', 'wavedrom', 'abc', 'vega-lite', 'chart']);

/** Parse Carve into the lossless document shape consumed by CarveKit. */
export function carveToEditorDocument(source: string): JSONContent {
  return carveToProseMirror(source, {
    unsupported: 'preserve',
    parse: { extensions: EXTENSIONS },
  });
}

/** Render Carve source for the preview pane. */
export function carveToHtmlRaw(source: string): string {
  const html = carveToHtml(source, { extensions: EXTENSIONS });
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

/** Resolve heading IDs with the engine, including suffixes and Unicode rules. */
export function carveHeadingTargets(source: string): HeadingTarget[] {
  const root = resolve(parse(source, { extensions: EXTENSIONS })) as unknown as Record<string, unknown>;
  const found: HeadingTarget[] = [];
  const text = (node: Record<string, unknown>): string => {
    if (typeof node.value === 'string') return node.value;
    return Array.isArray(node.children)
      ? node.children.map(child => text(child as Record<string, unknown>)).join('') : '';
  };
  const visit = (node: Record<string, unknown>): void => {
    if (node.type === 'heading') {
      const attrs = node.attrs as Record<string, unknown> | undefined;
      if (typeof attrs?.id === 'string') found.push({ id: attrs.id, type: 'heading', label: text(node) });
    }
    if (Array.isArray(node.children)) node.children.forEach(child => visit(child as Record<string, unknown>));
  };
  visit(root);
  return found;
}
