/**
 * Editor-surface code highlighting must be decoration-only: the document the
 * serializer reads, and therefore the Carve written back, stays byte-identical.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { Editor } from '@tiptap/core';
import { CarveCodeHighlight } from '../src/code-highlight';
import { carveToEditorDocument } from '../src/carve-import';
import { createCarveEditor, EDITOR_EXTENSIONS, editorToCarve, htmlToCarve, setCarveDocument } from '../src/editor';
import FIXTURE from './fixtures/code-highlight.crv?raw';

const SOURCE = FIXTURE;
const PLAIN_EXTENSIONS = EDITOR_EXTENSIONS.filter(extension => extension !== CarveCodeHighlight);

const editors: Editor[] = [];

// The first import and editor mount pay the engine's cold start; keep that out
// of the per-test timeout.
beforeAll(() => {
  const element = document.createElement('div');
  createCarveEditor({ element }).destroy();
  carveToEditorDocument(SOURCE);
}, 60_000);

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

/** The code text the nth code block of the document holds in an editor without highlighting. */
function codeTextAt(index: number): string {
  const plain = new Editor({ element: document.createElement('div'), extensions: PLAIN_EXTENSIONS });
  editors.push(plain);
  setCarveDocument(plain, carveToEditorDocument(SOURCE));
  const texts: string[] = [];
  plain.state.doc.descendants(node => {
    if (node.type.name === 'codeBlock') texts.push(node.textContent);
  });
  return texts[index] ?? '';
}

describe('code block highlighting on the editor surface', () => {
  it('round-trips js, {.diff} js and carve fences byte-identically', () => {
    const editor = mount();
    expect(editorToCarve(editor)).toBe(SOURCE);
    // Through the HTML pivot too, so the editor document itself is checked.
    expect(htmlToCarve(editor.getHTML())).toBe(SOURCE);
  });

  it('leaves the document JSON identical to an editor without highlighting', () => {
    const plainEl = document.createElement('div');
    const plain = new Editor({ element: plainEl, extensions: PLAIN_EXTENSIONS });
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

  it('marks the csv separator apart from its fields', () => {
    const editor = mount();
    const separators = Array.from(editor.view.dom.querySelectorAll('pre')[4]?.querySelectorAll('span.hljs-operator') ?? []);
    expect(separators.map((s) => s.textContent)).toEqual([',', ',']);
    expect(spans(editor, 4)).toContain('hljs-string');
  });

  it('marks the csv separator in a csv fence nested in a carve fence', () => {
    const editor = mount();
    setCarveDocument(editor, carveToEditorDocument('````carve\n```csv\na,b\n```\n````'));
    const separator = editor.view.dom.querySelector('pre code span.hljs-operator');
    expect(separator?.textContent).toBe(',');
  });

  it('keeps the code text free of injected characters', () => {
    const editor = mount();
    const code = editor.view.dom.querySelectorAll('pre code')[1]?.textContent;
    // Measured against the imported document, not a literal: whether a fence
    // keeps its final newline is the engine's call, and what this test watches
    // is only whether the decoration adds or drops characters.
    expect(code).toBe(codeTextAt(1));
    expect(code).toContain(' const a = 1;\n-const b = 2;\n+const b = 3;');
  });

  it('highlights an unmarked {.diff} line from its first column', () => {
    const editor = mount();
    setCarveDocument(editor, carveToEditorDocument('{.diff}\n```js\nconst a = 1;\n+let b = 2;\n```'));
    const first = editor.view.dom.querySelector('pre code span[class*="hljs-keyword"]');
    expect(first?.textContent).toBe('const');
  });

  // A captioned fence renders as a figure, which the stock editor schema has no node for.
  it.skip('presents a captioned {.diff} fence as a diff (needs a Carve 0.2 Tiptap kit: markup-carve/carve-grammars#906)', () => {
    const editor = mount();
    setCarveDocument(editor, carveToEditorDocument('{#lst-a .diff}\n```js\n-let a = 1;\n+let a = 2;\n```\n^ Listing #: x'));
    const classes = spans(editor, 0);
    expect(classes).toContain('hljs-addition');
    expect(classes).toContain('hljs-deletion');
  });

  it('needs diff as a whole class token on the figure', () => {
    const editor = mount();
    setCarveDocument(editor, carveToEditorDocument('{#lst-a .diffs}\n```js\n-let a = 1;\n+let a = 2;\n```\n^ Listing #: x'));
    expect(spans(editor, 0)).not.toContain('hljs-addition');
    expect(spans(editor, 0)).not.toContain('hljs-deletion');
  });
});
