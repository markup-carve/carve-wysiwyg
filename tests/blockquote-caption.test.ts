/**
 * A caption on a quote, through the editor's own import and serialize path.
 *
 * WHICH SHAPE THE ENGINE USES HAS CHANGED TWICE, and this file deliberately
 * does not care. PART 9 section 4a briefly made the caption an `attribution`
 * field on `block_quote`; that clause is withdrawn (markup-carve/carve#1213),
 * and section 4b now says a quote is not a special host - a captioned quote is
 * a `figure` whose target is the quote, which the loader projects onto a
 * `carveFigure`/`carveCaption` pair like any other captioned host. The
 * assertions below are about the line reaching the user's document, not about
 * the node it arrives in, so they held across both pins.
 *
 * What they DO depend on is the line reaching an editable node rather than
 * only the whole-document source envelope, which is keyed to a fingerprint of
 * the untouched document - so the FIRST EDIT drops anything that lives only
 * there.
 *
 * That is why every case here EDITS before serializing. Loading and serializing
 * an untouched document returns the envelope verbatim and passes at any pin,
 * which would make the check vacuous.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Editor } from '@tiptap/core';
import { CarveKit, serializeToCarve } from '@markup-carve/carve-grammars/tiptap';
import { carveToEditorDocument } from '../src/carve-import';
import { setCarveDocument } from '../src/editor';

let editor: Editor;

beforeAll(() => {
  const el = document.createElement('div');
  document.body.appendChild(el);
  editor = new Editor({ element: el, extensions: [CarveKit] });
});

afterAll(() => {
  editor?.destroy();
});

/** Load Carve, type somewhere that is NOT the attribution, then serialize. */
function editElsewhereAndSerialize(source: string): string {
  setCarveDocument(editor, carveToEditorDocument(source));
  editor.commands.insertContentAt(1, 'EDITED');
  // serializeToCarve on the raw editor JSON, deliberately NOT editorToCarve:
  // the point is what the CONTENT tree holds, and the app's serializer would
  // re-attach the document's source envelope, which is the very thing this
  // test must not read.
  return serializeToCarve(editor.getJSON());
}

/**
 * The text the editor holds in its CONTENT tree, ignoring the document's
 * `attrs`. The whole-document source envelope lives in `attrs`, so reading it
 * would count the very thing whose loss is the bug: an attribution that is only
 * in the envelope is not editable, and the first edit discards it.
 *
 * Deliberately shape-independent. The attribution has reached the editor as a
 * caption inside a figure and as a caption inside the quote at different
 * carve-grammars pins; what the user cares about is that it is in the document
 * at all.
 */
function editableText(): string {
  const walk = (node: { type?: string; text?: string; content?: unknown[] }): string =>
    node.type === 'text'
      ? node.text ?? ''
      : ((node.content ?? []) as Array<Parameters<typeof walk>[0]>).map(walk).join(' ');
  const doc = editor.getJSON() as { content?: unknown[] };
  return ((doc.content ?? []) as Array<Parameters<typeof walk>[0]>).map(walk).join(' ');
}

describe("a quote's caption survives an edit", () => {
  it('keeps the attribution when something else is edited', () => {
    const out = editElsewhereAndSerialize('> Stay hungry, stay foolish.\n^ Steve Jobs\n');
    expect(out).toContain('EDITED');
    expect(out).toContain('^ Steve Jobs');
  });

  it('holds the attribution in an editable node, not only the source envelope', () => {
    setCarveDocument(editor, carveToEditorDocument('> Stay hungry, stay foolish.\n^ Steve Jobs\n'));
    expect(editableText()).toContain('Steve Jobs');
  });

  it('keeps an attribution written one blank line below the quote', () => {
    const out = editElsewhereAndSerialize('> quote text\n\n^ Source: Someone\n');
    expect(out).toContain('EDITED');
    expect(out).toContain('^ Source: Someone');
  });

  it('control: the probe reads the content tree and not everything', () => {
    setCarveDocument(editor, carveToEditorDocument('> Just a quote\n'));
    expect(editableText()).toContain('Just a quote');
    expect(editableText()).not.toContain('Steve Jobs');
  });
});
