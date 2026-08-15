/**
 * The language attribute (`{:TAG}`) through the editor's own import and
 * serialize path.
 *
 * The editor consumes the Tiptap span mark and the serializer from
 * carve-grammars, so the production only works here when the pinned
 * carve-grammars build carries it. Nothing else in this repository looks at
 * what the pin resolves to, which is how the pin went stale unnoticed: these
 * assertions fail against a build without the production instead.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Editor } from '@tiptap/core';
import { CarveKit, serializeToCarve } from '@markup-carve/carve-grammars/tiptap';
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

/** Load Carve source the way the app does, then serialize the editor state. */
function fromCarve(source: string): string {
  setCarveDocument(editor, carveToEditorDocument(source));
  return editorToCarve(editor);
}

/** Load HTML the way a paste does, then serialize the editor state. */
function fromHtml(html: string): string {
  editor.commands.setContent(html);
  return serializeToCarve(editor.getJSON());
}

/** The marks carried by the first inline node that has any. */
function firstMarks(): Array<{ type: string; attrs?: Record<string, unknown> }> {
  const json = editor.getJSON() as {
    content?: Array<{ content?: Array<{ marks?: Array<{ type: string; attrs?: Record<string, unknown> }> }> }>;
  };
  for (const inline of json.content?.[0]?.content ?? []) {
    if (inline.marks?.length) return inline.marks;
  }
  return [];
}

describe('language attribute through import and serialize', () => {
  it('serializes an imported lang="fr" span as {:fr} sugar', () => {
    const out = fromCarve('A [bonjour]{lang="fr"} end.');
    expect(out).toContain('[bonjour]{:fr}');
    expect(out).not.toContain('lang="fr"');
  });

  // The SHORT form typed in the source pane, which is what markup-carve/carve-wysiwyg#12
  // reported. The editor's loader parses it with the engine carve-grammars
  // installs for itself, not with this app's own `@markup-carve/carve`, so no
  // pin here could reach it - only the grammar pin can.
  //
  // Asserted on the MARK. `A [bonjour]{:fr} end.` that the engine does not
  // recognize is one text node the serializer writes back verbatim, so the
  // round-tripped string is a fixed point at both pins and a string assertion
  // would be vacuous. The absent backslash is checked as well, since the escape
  // is what the reporter saw.
  it('parses the {:fr} shorthand typed in the source pane onto the span mark', () => {
    const out = fromCarve('A [bonjour]{:fr} end.');
    const span = firstMarks().find((mark) => mark.type === 'carveSpan');
    expect(span, `no carveSpan mark in ${JSON.stringify(firstMarks())}`).toBeDefined();
    const attrs = span?.attrs as { lang?: string; keyValues?: Record<string, string> } | undefined;
    expect(attrs?.keyValues?.lang ?? attrs?.lang).toBe('fr');
    expect(out).toContain('[bonjour]{:fr}');
    expect(out).not.toContain('\\[bonjour]');
  });

  it('keeps a subtag intact in the sugar', () => {
    expect(fromCarve('A [x]{lang="zh-Hant"} end.')).toContain('[x]{:zh-Hant}');
  });

  it('parses span[lang] from pasted HTML onto the span mark', () => {
    const out = fromHtml('<p>A <span lang="fr">bonjour</span> end.</p>');
    const span = firstMarks().find((mark) => mark.type === 'carveSpan');
    expect(span, `no carveSpan mark in ${JSON.stringify(firstMarks())}`).toBeDefined();
    expect(span?.attrs?.lang).toBe('fr');
    expect(out).toContain('[bonjour]{:fr}');
  });

  it('falls back to lang="..." when the value is not a language tag', () => {
    const out = fromHtml('<p>A <span lang="not a tag!">x</span> end.</p>');
    expect(out).toContain('{lang="not a tag!"}');
    expect(out).not.toContain('{:not');
  });

  it('control: a span carrying only a class is unaffected', () => {
    const out = fromCarve('A [text]{.note} end.');
    expect(out).toContain('[text]{.note}');
  });
});
