import { describe, expect, it } from 'vitest';
import { parse, treesEqual } from '@markup-carve/carve';
import { AUTHORING_RECIPES, TASK_STATES } from '../src/authoring';
import { carveToEditorDocument, carveToHtmlRaw } from '../src/carve-import';
import { createCarveEditor, editorToCarve, jsonToCarve, setCarveDocument } from '../src/editor';

const editor = createCarveEditor({ element: document.createElement('div') });
const recipe = (id: string) => AUTHORING_RECIPES.find(item => item.id === id)!;
/** What the editor writes once the document is edited: the kit's tree through the engine's writer. */
const roundTrip = (source: string) => {
  setCarveDocument(editor, carveToEditorDocument(source));
  return jsonToCarve(editor.getJSON());
};

describe('palette recipes for constructs that used to need typed source', () => {
  it('widens a block comment fence around a percent line in its body', () => {
    const source = recipe('block-comment').source({ body: 'before\n%%%\nafter' });
    expect(source).toBe('%%%%\nbefore\n%%%\nafter\n%%%%\n');
    expect(carveToHtmlRaw(source + '\nVisible\n')).toBe('<p>Visible</p>');
  });

  it('widens a block comment fence around an indented percent line', () => {
    const source = recipe('block-comment').source({ body: 'before\n  %%%\nafter' });
    expect(source.startsWith('%%%%\n')).toBe(true);
    expect(carveToHtmlRaw(source + '\nVisible\n')).toBe('<p>Visible</p>');
  });

  it("keeps the indentation of a line block's first line", () => {
    const source = recipe('line-block').source({ body: '\n  indented\nnext\n\n' });
    expect(source).toBe('::: |\n  indented\nnext\n:::\n');
    expect(roundTrip(source).trim()).toBe(source.trim());
  });

  // After an edit the 0.2 writer escapes the colon line (`\:::`) instead of widening; both read as the same lines.
  it('widens a line block fence around a colon fence line in its body', () => {
    const source = recipe('line-block').source({ body: 'one\n:::\ntwo' });
    expect(source.startsWith('::::')).toBe(true);
    setCarveDocument(editor, carveToEditorDocument(source));
    expect(editorToCarve(editor)).toBe(source);
    expect(treesEqual(parse(roundTrip(source)), parse(source))).toBe(true);
  });

  it('keeps a bracket inside an inline footnote from closing it early', () => {
    const source = recipe('inline-footnote').source({ body: 'see [1] here' });
    expect(carveToHtmlRaw(source)).toContain('see [1] here');
  });

  it('round-trips an inline footnote through the editor', () => {
    const source = recipe('inline-footnote').source({ body: 'see [1] here' });
    expect(roundTrip(source).trim()).toBe(source.trim());
  });

  it('writes a span with only the attributes that were given', () => {
    expect(recipe('span').source({ text: 'x', id: '', class: 'lead' })).toBe('[x]{.lead}\n');
    expect(recipe('span').source({ text: 'x', id: 'a b', class: '' })).toBe('[x]{#a-b}\n');
  });

  it.each(TASK_STATES)('round-trips the [%s] task state', state => {
    const source = recipe('task-state').source({ state, task: 'Task' });
    expect(source).toBe(`- [${state}] Task\n`);
    expect(roundTrip(source).trim()).toBe(source.trim());
  });

  it('falls back to [?] for a state Carve does not define', () => {
    expect(recipe('task-state').source({ state: 'z', task: 'Task' })).toBe('- [?] Task\n');
  });

  // The 0.2 writer ends a document with a line feed (C2-W-100).
  it('serializes the state the inspector sets on a task item', () => {
    setCarveDocument(editor, carveToEditorDocument('- [ ] Task\n'));
    editor.commands.command(({ tr, state }) => {
      state.doc.descendants((node, pos) => {
        if (node.type.name === 'taskItem') tr.setNodeMarkup(pos, undefined, { ...node.attrs, checked: false, carve: { ...node.attrs.carve, task: { mark: '>' } } });
      });
      return true;
    });
    expect(editorToCarve(editor)).toBe('- [>] Task\n');
  });
});
