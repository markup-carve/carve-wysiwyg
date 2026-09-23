/**
 * Editor-surface code highlighting must be decoration-only: the document the
 * serializer reads, and therefore the Carve written back, stays byte-identical.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import { CarveKit, serializeToCarve } from '@markup-carve/carve-grammars/tiptap';
import { carveToEditorDocument } from '../src/carve-import';
import { createCarveEditor, editorToCarve, setCarveDocument } from '../src/editor';
import FIXTURE from './fixtures/code-highlight.crv?raw';

// The serializer writes no file-final newline.
const SOURCE = FIXTURE.replace(/\n$/, '');

const editors: Editor[] = [];

function mount(): Editor {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = createCarveEditor({ element });
  editors.push(editor);
  setCarveDocument(editor, carveToEditorDocument(SOURCE));
  return editor;
}

afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
});

function spans(editor: Editor, index: number): string[] {
  const pre = editor.view.dom.querySelectorAll('pre')[index];
  return Array.from(pre?.querySelectorAll('span[class*="hljs-"]') ?? []).map((s) => s.className);
}

describe('code block highlighting on the editor surface', () => {
  it('round-trips js, {.diff} js and carve fences byte-identically', () => {
    const editor = mount();
    expect(editorToCarve(editor)).toBe(SOURCE);
    // Without the source envelope too, so the rich document itself is checked.
    expect(serializeToCarve(editor.getJSON())).toBe(SOURCE);
  });

  it('leaves the document JSON identical to a plain CarveKit editor', () => {
    const plainEl = document.createElement('div');
    const plain = new Editor({ element: plainEl, extensions: [CarveKit] });
    editors.push(plain);
    setCarveDocument(plain, carveToEditorDocument(SOURCE));
    expect(mount().getJSON()).toEqual(plain.getJSON());
  });

  it('decorates each fence with hljs spans', () => {
    const editor = mount();
    expect(spans(editor, 0)).toContain('hljs-keyword');
    const diff = spans(editor, 1);
    expect(diff).toContain('hljs-addition');
    expect(diff).toContain('hljs-deletion');
    expect(diff).toContain('hljs-keyword');
    expect(spans(editor, 2).length).toBeGreaterThan(0);
    expect(spans(editor, 3).length).toBeGreaterThan(0);
  });

  it('keeps the code text free of injected characters', () => {
    const editor = mount();
    const code = editor.view.dom.querySelectorAll('pre code')[1]?.textContent;
    expect(code).toBe(' const a = 1;\n-const b = 2;\n+const b = 3;');
  });

  it('highlights an unmarked {.diff} line from its first column', () => {
    const editor = mount();
    setCarveDocument(editor, carveToEditorDocument('{.diff}\n```js\nconst a = 1;\n+let b = 2;\n```'));
    const first = editor.view.dom.querySelector('pre code span[class*="hljs-keyword"]');
    expect(first?.textContent).toBe('const');
  });
});
