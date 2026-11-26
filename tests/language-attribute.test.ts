/**
 * The language attribute (`{:TAG}`) through the editor's own import and
 * serialize path.
 *
 * The editor consumes the Tiptap span mark and the serializer from the
 * carve-grammars kit, so the production only works here when the pinned
 * carve-grammars build carries it: these assertions fail against a build
 * without it. In 0.2 `{:fr}` is the span's `lang` field and `{lang="fr"}` an
 * ordinary key-value attribute; the kit keeps each as written.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Editor } from '@tiptap/core';
import { carveToEditorDocument } from '../src/carve-import';
import { EDITOR_EXTENSIONS, editorToCarve, htmlToCarve, jsonToCarve, setCarveDocument } from '../src/editor';

let editor: Editor;

beforeAll(() => {
  const el = document.createElement('div');
  document.body.appendChild(el);
  editor = new Editor({ element: el, extensions: EDITOR_EXTENSIONS });
});

afterAll(() => {
  editor?.destroy();
});

/** Load Carve source the way the app does, then serialize the editor state after an edit elsewhere. */
function fromCarve(source: string): string {
  setCarveDocument(editor, carveToEditorDocument(source));
  editor.commands.insertContentAt(1, 'X');
  return editorToCarve(editor);
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
  it('parses the {:fr} shorthand typed in the source pane onto the span mark', () => {
    const out = fromCarve('A [bonjour]{:fr} end.');
    const span = firstMarks().find((mark) => mark.type === 'carveSpan');
    expect(span, `no carveSpan mark in ${JSON.stringify(firstMarks())}`).toBeDefined();
    expect((span?.attrs?.carve as { lang?: string } | null)?.lang).toBe('fr');
    expect(out).toContain('[bonjour]{:fr}');
    expect(out).not.toContain('\\[bonjour]');
  });

  it('keeps a subtag intact in the sugar', () => {
    expect(fromCarve('A [x]{:zh-Hant} end.')).toContain('[x]{:zh-Hant}');
  });

  it('keeps a lang key-value as a key-value', () => {
    const out = fromCarve('A [bonjour]{lang="fr"} end.');
    expect(out).toContain('[bonjour]{lang=fr}');
    expect(out).not.toContain('{:fr}');
  });

  it('reads span[lang] from pasted HTML as the {:fr} sugar', () => {
    expect(htmlToCarve('<p>A <span lang="fr">bonjour</span> end.</p>')).toContain('[bonjour]{:fr}');
  });

  it('control: a span carrying only a class is unaffected', () => {
    setCarveDocument(editor, carveToEditorDocument('A [text]{.note} end.'));
    expect(jsonToCarve(editor.getJSON())).toContain('[text]{.note}');
  });
});
