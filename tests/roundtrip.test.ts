/**
 * Round-trip test: Carve source -> carve-js HTML -> (normalize) -> Tiptap
 * ProseMirror doc -> serializeToCarve -> Carve source.
 *
 * This drives the *exact same path the app uses*: carveToEditorHtml() then
 * editor.commands.setContent() then serializeToCarve(editor.getJSON()).
 *
 * We assert on the semantically important tokens rather than byte-equality,
 * because both renderers normalize whitespace/structure. Lossy constructs are
 * documented inline (see the `lossy` notes) rather than hidden.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Editor } from '@tiptap/core';
import { CarveKit, serializeToCarve } from '@markup-carve/carve-grammars/tiptap';
import { carveToEditorHtml } from '../src/carve-import';

let editor: Editor;

beforeAll(() => {
  const el = document.createElement('div');
  document.body.appendChild(el);
  editor = new Editor({ element: el, extensions: [CarveKit] });
});

afterAll(() => {
  editor?.destroy();
});

/** Run the app's full import + serialize round trip on a Carve source string. */
function roundTrip(source: string): string {
  const html = carveToEditorHtml(source, document);
  editor.commands.setContent(html);
  return serializeToCarve(editor.getJSON());
}

interface Sample {
  name: string;
  source: string;
  /** Tokens that MUST appear in the round-tripped output. */
  expect: string[];
  /** Tokens that must NOT appear (e.g. leaked HTML). */
  absent?: string[];
}

const samples: Sample[] = [
  {
    name: 'headings',
    source: '# Title\n\n## Subtitle',
    expect: ['# Title', '## Subtitle'],
  },
  {
    name: 'inline emphasis (bold/italic/underline/strike)',
    source: 'a *bold* b /italic/ c _underline_ d ~struck~ e',
    expect: ['*bold*', '/italic/', '_underline_', '~struck~'],
  },
  {
    name: 'bullet list',
    source: '- one\n- two\n- three',
    expect: ['- one', '- two', '- three'],
  },
  {
    name: 'ordered list',
    source: '1. alpha\n2. beta',
    expect: ['1. alpha', '2. beta'],
  },
  {
    name: 'link + inline code',
    source: 'See [the docs](https://example.com) and run `npm test`.',
    expect: ['[the docs](https://example.com)', '`npm test`'],
  },
  {
    name: 'blockquote',
    source: '> quoted line',
    expect: ['> quoted line'],
  },
  {
    name: 'admonition div',
    source: ':::warning\nBe careful here.\n:::',
    // CarveDiv keeps the `warning` class; body text survives.
    expect: [':::', 'warning', 'Be careful here.'],
    absent: ['<aside', 'admonition'],
  },
  {
    name: 'footnote reference + definition',
    source: 'Text with a note[^1].\n\n[^1]: The note body.',
    // carve-js auto-numbers the label to "1"; the ref + definition survive.
    expect: ['[^1]', 'The note body.'],
    absent: ['doc-noteref', 'doc-backlink', '↩'],
  },
];

describe('Carve round trip (source -> HTML -> editor -> source)', () => {
  for (const sample of samples) {
    it(sample.name, () => {
      const out = roundTrip(sample.source);
      for (const token of sample.expect) {
        expect(out, `expected token "${token}" in:\n${out}`).toContain(token);
      }
      for (const token of sample.absent ?? []) {
        expect(out, `unexpected token "${token}" in:\n${out}`).not.toContain(token);
      }
    });
  }
});
