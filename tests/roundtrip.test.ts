/**
 * Round-trip test: Carve source -> Carve AST -> ProseMirror doc ->
 * serializeToCarve -> Carve source.
 *
 * This drives the exact same path the app uses: carveToEditorDocument(), then
 * editor.commands.setContent(), then serializeToCarve(editor.getJSON()).
 *
 * The loader's preservation mode guarantees that constructs without an
 * editable Tiptap representation survive load/save instead of disappearing.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Editor } from '@tiptap/core';
import { CarveKit, serializeToCarve } from '@markup-carve/carve-grammars/tiptap';
import { carveToEditorDocument } from '../src/carve-import';

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
  editor.commands.setContent(carveToEditorDocument(source));
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
    source: 'Text with a note[^named].\n\n[^named]: The note body.',
    expect: ['[^named]', 'The note body.'],
    absent: ['doc-noteref', 'doc-backlink', '↩'],
  },
  {
    name: 'unsupported source is preserved instead of silently dropped',
    source: '---toml\ntitle = "Kept"\n---\n\nBody.',
    expect: ['---toml', 'title = "Kept"', 'Body.'],
  },
];

describe('Carve round trip (source -> AST -> editor -> source)', () => {
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
