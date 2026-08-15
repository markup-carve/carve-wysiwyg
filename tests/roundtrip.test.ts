/**
 * Round-trip test: Carve source -> Carve AST -> ProseMirror doc ->
 * serializeToCarve -> Carve source.
 *
 * This drives the exact same path the app uses: carveToEditorDocument(), then
 * setCarveDocument() (which is setContent plus the source envelope), then
 * editorToCarve().
 *
 * The loader's preservation mode guarantees that constructs without an
 * editable Tiptap representation survive load/save instead of disappearing.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Editor } from '@tiptap/core';
import { CarveKit } from '@markup-carve/carve-grammars/tiptap';
import { carveToEditorDocument } from '../src/carve-import';
import { editorToCarve, setCarveDocument } from '../src/editor';

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
  setCarveDocument(editor, carveToEditorDocument(source));
  return editorToCarve(editor);
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

/**
 * The source envelope, which is what carries a block-attribute line above a
 * construct the rich model does not fully hold. It is honored only while the
 * mounted document is still recognizable as the one that was loaded, and
 * `src/editor.ts` decides that by reducing both documents to what the author
 * wrote - dropping every attribute Tiptap materialized from a schema default.
 *
 * BOTH sides, and that is the point of the second case. The bridge sets some
 * attributes to a value that is ALSO the schema default, so reducing only the
 * mounted side makes those documents stop matching and quietly discards the
 * envelope they depend on. That is not hypothetical: `carveComment` declares
 * `block` with a default of `false` and the bridge writes `block: false` for
 * every `%%` line.
 */
describe('the source envelope survives a mount', () => {
  it('keeps a block-attribute line above a container the editor models partly', () => {
    expect(roundTrip('{#fig-x}\n::: note\nBody.\n:::\n')).toContain('{#fig-x}');
  });

  it('keeps it when the document also holds an attribute set to its own default', () => {
    // A `%%` line, whose `block: false` equals the schema default. Reducing
    // only the mounted document loses the `{#fig-x}` here while the case above
    // still passes, so the pair is what pins the symmetry.
    const out = roundTrip('{#fig-x}\n::: note\n%% a note\n:::\n');
    expect(out).toContain('{#fig-x}');
    expect(out).toContain('%% a note');
  });

  it('control: an edited document is serialized from the editor, not the envelope', () => {
    setCarveDocument(editor, carveToEditorDocument('{#fig-x}\n::: note\nBody.\n:::\n'));
    editor.commands.insertContentAt(2, 'EDITED');
    const out = editorToCarve(editor);
    expect(out).toContain('EDITED');
    // Without this the two cases above would pass for a serializer that
    // returned the loaded source unconditionally, which is not preservation.
    expect(out).not.toBe('{#fig-x}\n::: note\nBody.\n:::\n');
  });
});
