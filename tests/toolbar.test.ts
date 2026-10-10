/**
 * The toolbar's tooltips name keyboard shortcuts; each one must be a binding
 * the editor actually registers, and every formatting button must name one.
 */
import { describe, it, expect, afterAll } from 'vitest';
import indexHtml from '../index.html?raw';
import { Editor } from '@tiptap/core';
import { CarveKit } from '@markup-carve/carve-grammars/tiptap';
import { CarveCodeHighlight } from '../src/code-highlight';
import { editorToCarve, setCarveDocument } from '../src/editor';
import { carveToEditorDocument } from '../src/carve-import';

const editor = new Editor({
  element: document.createElement('div'),
  extensions: [CarveKit, CarveCodeHighlight],
});
afterAll(() => editor.destroy());

/** Every key binding the loaded extensions register, lower-cased. */
function boundKeys(): Set<string> {
  const keys = new Set<string>();
  for (const ext of editor.extensionManager.extensions) {
    const add = (ext.config as { addKeyboardShortcuts?: () => Record<string, unknown> }).addKeyboardShortcuts;
    if (!add) continue;
    const ctx = {
      name: ext.name, options: ext.options, storage: ext.storage, editor,
      type: editor.schema.nodes[ext.name] ?? editor.schema.marks[ext.name],
    };
    for (const key of Object.keys(add.call(ctx))) keys.add(key.toLowerCase());
  }
  return keys;
}

/** `Ctrl/Cmd+Shift+H` -> `mod-shift-h`; `Shift+Enter` -> `shift-enter`. */
function binding(shortcut: string): string {
  return shortcut.replace('Ctrl/Cmd', 'Mod').split('+').join('-').toLowerCase();
}

const toolbar = new DOMParser()
  .parseFromString(indexHtml, 'text/html')
  .querySelector('.toolbar')!;
const SHORTCUT = /((?:Ctrl\/Cmd|Alt|Shift)\+.+?)(?=\)|, |$)/;

describe('toolbar tooltips', () => {
  const keys = boundKeys();
  const buttons = [...toolbar.querySelectorAll<HTMLButtonElement>('button[data-action], #open-code-block')];

  it.each(buttons.map(b => [b.getAttribute('aria-label'), b.title]))('%s names a bound shortcut', (_label, title) => {
    const shortcut = SHORTCUT.exec(title)?.[1];
    expect(shortcut, title).toBeTruthy();
    expect(keys.has(binding(shortcut!)), `${shortcut} is not bound`).toBe(true);
  });

  it('every shortcut named anywhere in the toolbar is bound', () => {
    for (const button of toolbar.querySelectorAll<HTMLButtonElement>('button[title]')) {
      const shortcut = SHORTCUT.exec(button.title)?.[1];
      // Alt+Shift+K is the app's own document-level handler, not an editor binding.
      if (shortcut && !shortcut.startsWith('Alt')) expect(keys.has(binding(shortcut)), shortcut).toBe(true);
    }
  });
});

describe('marks the new toolbar buttons toggle', () => {
  it.each([
    ['highlight', '=word='],
    ['superscript', '{^word^}'],
    ['subscript', '{,word,}'],
    ['carveInsert', '{+word+}'],
    ['carveDelete', '{-word-}'],
  ])('%s serializes as %s', (mark, expected) => {
    setCarveDocument(editor, carveToEditorDocument('a word b'));
    editor.chain().setTextSelection({ from: 3, to: 7 }).toggleMark(mark).run();
    expect(editor.isActive(mark)).toBe(true);
    expect(editorToCarve(editor)).toBe(`a ${expected} b`);
  });

  it.each([3, 4, 5, 6])('heading level %i serializes', level => {
    setCarveDocument(editor, carveToEditorDocument('Title'));
    editor.chain().setTextSelection(2).toggleHeading({ level: level as 3 | 4 | 5 | 6 }).run();
    expect(editorToCarve(editor)).toBe(`${'#'.repeat(level)} Title`);
  });
});
