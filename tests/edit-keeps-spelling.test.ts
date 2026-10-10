/**
 * An edit must only respell what it touched: the source envelope's projected
 * source lets the serializer merge the edit into the authored text.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import { CarveKit } from '@markup-carve/carve-grammars/tiptap';
import { carveToEditorDocument } from '../src/carve-import';
import { editorToCarve, setCarveDocument } from '../src/editor';

const SOURCE = [
  ':: term',
  ':  definition',
  '',
  '- step one',
  '+',
  '> a note',
  '- step two',
  '',
  '::: >',
  'Quote.',
  ':::',
  '',
  'End',
  '',
].join('\n');

let editor: Editor;

beforeEach(() => {
  const el = document.createElement('div');
  document.body.appendChild(el);
  editor = new Editor({ element: el, extensions: [CarveKit] });
});

afterEach(() => {
  editor.destroy();
});

/** The position just after the last character of the document's text. */
function endOfText(): number {
  let end = -1;
  editor.state.doc.descendants((node, at) => {
    if (node.isText) end = at + node.nodeSize;
  });
  return end;
}

describe('editing keeps the authored spelling outside the edit', () => {
  it('leaves unedited constructs untouched when text is typed at the end', () => {
    setCarveDocument(editor, carveToEditorDocument(SOURCE));
    expect(editorToCarve(editor)).toBe(SOURCE);

    editor.commands.insertContentAt(endOfText(), '!');
    const out = editorToCarve(editor);

    expect(out).toBe(SOURCE.replace('End\n', 'End!\n'));
  });

  it('applies an edit in the middle of the document in place', () => {
    setCarveDocument(editor, carveToEditorDocument(SOURCE));
    let pos = -1;
    editor.state.doc.descendants((node, at) => {
      if (pos < 0 && node.isText && node.text === 'Quote.') pos = at + node.text.length;
    });
    expect(pos).toBeGreaterThan(0);
    editor.commands.insertContentAt(pos, ' More.');

    expect(editorToCarve(editor)).toBe(SOURCE.replace('Quote.', 'Quote. More.'));
  });

  it('a new document loaded after an edit does not inherit the old envelope', () => {
    setCarveDocument(editor, carveToEditorDocument(SOURCE));
    editor.commands.insertContentAt(endOfText(), '!');
    setCarveDocument(editor, carveToEditorDocument('# Fresh\n'));
    editor.commands.insertContentAt(endOfText(), '!');
    expect(editorToCarve(editor)).toBe('# Fresh!');
  });
});
