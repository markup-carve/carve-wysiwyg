/**
 * Carve WYSIWYG app entry point.
 *
 * Layout:
 *   - left:   the Tiptap visual editor (CarveKit) + a toolbar
 *   - middle: live Carve source (read-only, updates on every edit) and an
 *             import box + "Load Carve" button (Carve -> editor round trip)
 *   - right:  rendered HTML preview (carve-js) of the current Carve source
 */
import './style.css';
import { Editor } from '@tiptap/core';
import { createCarveEditor, editorToCarve } from './editor';
import { carveToEditorHtml, carveToHtmlRaw } from './carve-import';

const SAMPLE = `# Carve WYSIWYG

This is *bold*, /italic/, _underline_ and ~struck~ text.

A [link](https://github.com/markup-carve) and inline \`code\`.

- first item
- second item

> A blockquote.

:::tip
A tip admonition (Carve div).
:::

A footnote reference[^1].

[^1]: The footnote body.
`;

const $ = (sel: string): HTMLElement => {
  const el = document.querySelector(sel);
  if (!el) throw new Error(`missing element: ${sel}`);
  return el as HTMLElement;
};

const editorEl = $('#editor');
const sourceEl = $('#carve-source') as HTMLTextAreaElement;
const previewEl = $('#html-preview');
const importEl = $('#carve-import') as HTMLTextAreaElement;

let editor: Editor;

function refreshOutputs(carve: string): void {
  sourceEl.value = carve;
  try {
    previewEl.innerHTML = carveToHtmlRaw(carve);
  } catch (err) {
    previewEl.textContent = `Preview error: ${(err as Error).message}`;
  }
}

/** Load Carve source into the editor (import direction). */
function loadCarve(source: string): void {
  const html = carveToEditorHtml(source, document);
  // emitUpdate defaults to false; we refresh the outputs explicitly below.
  editor.commands.setContent(html);
  refreshOutputs(editorToCarve(editor));
}

editor = createCarveEditor({
  element: editorEl,
  onUpdate: refreshOutputs,
});

// Toolbar wiring -----------------------------------------------------------
const toolbarActions: Record<string, () => void> = {
  bold: () => editor.chain().focus().toggleBold().run(),
  italic: () => editor.chain().focus().toggleItalic().run(),
  underline: () => editor.chain().focus().toggleUnderline().run(),
  strike: () => editor.chain().focus().toggleStrike().run(),
  code: () => editor.chain().focus().toggleCode().run(),
  h1: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
  h2: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  bulletList: () => editor.chain().focus().toggleBulletList().run(),
  orderedList: () => editor.chain().focus().toggleOrderedList().run(),
  blockquote: () => editor.chain().focus().toggleBlockquote().run(),
  link: () => {
    const url = window.prompt('Link URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    } else {
      editor.chain().focus().unsetLink().run();
    }
  },
};

document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.action!;
    toolbarActions[action]?.();
  });
});

$('#load-carve').addEventListener('click', () => {
  loadCarve(importEl.value);
});

// Initial content ----------------------------------------------------------
importEl.value = SAMPLE;
loadCarve(SAMPLE);
