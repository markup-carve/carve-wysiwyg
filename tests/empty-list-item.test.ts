/**
 * An empty list item never reaches the source or the preview. Before the
 * carve-grammars serializer pruned them, pressing Enter in a list wrote a bare
 * marker, which reparses as a nested list and shows a stray `-` in the preview.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Editor } from '@tiptap/core';
import type { JSONContent } from '@tiptap/core';
import { createCarveEditor, editorToCarve, jsonToCarve } from '../src/editor';
import { carveToHtmlRaw } from '../src/carve-import';

let editor: Editor;

beforeAll(() => {
  const el = document.createElement('div');
  document.body.appendChild(el);
  editor = createCarveEditor({ element: el, onUpdate: () => {} });
});

afterAll(() => {
  editor?.destroy();
});

const item = (text: string): JSONContent => ({
  type: 'listItem',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

const listDoc = (middle: JSONContent): JSONContent => ({
  type: 'doc',
  content: [{ type: 'bulletList', content: [item('a'), middle, item('c')] }],
});

function expectNoStrayMarker(carve: string): void {
  expect(carve).toContain('- a');
  expect(carve).toContain('- c');
  expect(carve.split('\n').some(line => /^\s*[-*+]\s*$/.test(line) || /^\s*-\s+-/.test(line))).toBe(false);

  const preview = document.createElement('div');
  preview.innerHTML = carveToHtmlRaw(carve);
  expect(preview.querySelectorAll('ul ul')).toHaveLength(0);
  const items = [...preview.querySelectorAll('li')].map(li => li.textContent?.trim());
  expect(items).toEqual(['a', 'c']);
  expect(preview.textContent).not.toMatch(/(^|\s)-(\s|$)/);
}

describe('an empty list item between items', () => {
  it('drops an item with no children', () => {
    expectNoStrayMarker(jsonToCarve(listDoc({ type: 'listItem' })));
  });

  it('drops an item holding an empty paragraph', () => {
    expectNoStrayMarker(jsonToCarve(listDoc({ type: 'listItem', content: [{ type: 'paragraph' }] })));
  });

  it('drops the item Enter creates in the editor', () => {
    editor.commands.setContent({
      type: 'doc',
      content: [{ type: 'bulletList', content: [item('a'), item('c')] }],
    });
    let endOfA = -1;
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === 'a') endOfA = pos + node.nodeSize;
    });
    editor.chain().setTextSelection(endOfA).splitListItem('listItem').run();
    expect(editor.getJSON().content?.[0].content).toHaveLength(3);
    expectNoStrayMarker(editorToCarve(editor));
  });
});
