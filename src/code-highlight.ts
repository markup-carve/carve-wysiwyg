/**
 * Syntax highlighting for code blocks on the editor surface.
 *
 * CarveKit's code block is a custom node (language picker, raw-language and
 * title attributes) that the serializer reads by name, so swapping in
 * `extension-code-block-lowlight` would replace that node. This adds the same
 * lowlight decorations as a separate plugin instead: the schema and the
 * document JSON stay untouched, only the rendered DOM gains `hljs-*` spans.
 */
import { Extension } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { common, createLowlight } from 'lowlight';
import carveHighlight from '@markup-carve/carve-grammars/highlightjs/carve.js';

export const lowlight = createLowlight(common);
lowlight.register({ carve: carveHighlight });
lowlight.registerAlias({ carve: ['crv'] });

interface HastNode {
  type: string;
  value?: string;
  properties?: { className?: string[] };
  children?: HastNode[];
}

interface Token { text: string; classes: string[] }

function flatten(nodes: HastNode[], classes: string[] = []): Token[] {
  return nodes.flatMap((node) => {
    const inner = [...classes, ...(node.properties?.className ?? [])];
    if (node.children) return flatten(node.children, inner);
    return [{ text: node.value ?? '', classes: inner }];
  });
}

function tokens(language: string, text: string): Token[] {
  return flatten(lowlight.highlight(language, text).children as HastNode[]);
}

function push(out: Decoration[], from: number, list: Token[]): void {
  let pos = from;
  for (const token of list) {
    const to = pos + token.text.length;
    if (token.classes.length) out.push(Decoration.inline(pos, to, { class: token.classes.join(' ') }));
    pos = to;
  }
}

function blockDecorations(node: PMNode, start: number, out: Decoration[]): void {
  const language = String(node.attrs.language ?? '');
  const known = language !== '' && lowlight.registered(language);
  const isDiff = String(node.attrs.class ?? '').split(/\s+/).includes('diff');
  const text = node.textContent;
  if (!isDiff) {
    if (known) push(out, start, tokens(language, text));
    return;
  }
  // A {.diff} fence: the first column is the +/-/space marker, the rest of the
  // line is code in the fence language (same model as the preview's helper).
  let pos = start;
  for (const line of text.split('\n')) {
    const marker = line.charAt(0);
    const kind = marker === '+' ? 'hljs-addition' : marker === '-' ? 'hljs-deletion' : null;
    if (kind && line.length) out.push(Decoration.inline(pos, pos + line.length, { class: kind }));
    if (known && line.length > 1) push(out, pos + 1, tokens(language, line.slice(1)));
    pos += line.length + 1;
  }
}

function decorate(doc: PMNode): DecorationSet {
  const out: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== 'codeBlock') return true;
    blockDecorations(node, pos + 1, out);
    return false;
  });
  return DecorationSet.create(doc, out);
}

const key = new PluginKey<DecorationSet>('carveCodeHighlight');

export const CarveCodeHighlight = Extension.create({
  name: 'carveCodeHighlight',
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key,
        state: {
          init: (_, { doc }) => decorate(doc),
          apply: (tr, set) => (tr.docChanged ? decorate(tr.doc) : set),
        },
        props: {
          decorations: (state) => key.getState(state),
        },
      }),
    ];
  },
});
