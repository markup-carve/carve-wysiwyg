import { describe, expect, it } from 'vitest';
import { AUTHORING_RECIPES, TASK_STATES } from '../src/authoring';
import { carveToEditorDocument, carveToHtmlRaw } from '../src/carve-import';
import { jsonToCarve } from '../src/editor';

const recipe = (id: string) => AUTHORING_RECIPES.find(item => item.id === id)!;
const roundTrip = (source: string) => jsonToCarve(carveToEditorDocument(source));

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

  it('keeps the indentation of a line block\'s first line', () => {
    const source = recipe('line-block').source({ body: '\n  indented\nnext\n\n' });
    expect(source).toBe('::: |\n  indented\nnext\n:::\n');
    expect(roundTrip(source).trim()).toBe(source.trim());
  });

  it('widens a line block fence around a colon fence line in its body', () => {
    const source = recipe('line-block').source({ body: 'one\n:::\ntwo' });
    expect(source.startsWith('::::')).toBe(true);
    expect(roundTrip(source).trim()).toBe(source.trim());
  });

  it('keeps a bracket inside an inline footnote from closing it early', () => {
    const source = recipe('inline-footnote').source({ body: 'see [1] here' });
    expect(carveToHtmlRaw(source)).toContain('see [1] here');
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

  it('serializes the state the inspector sets on a task item', () => {
    const doc = carveToEditorDocument('- [ ] Task\n');
    const item = doc.content![0].content![0];
    item.attrs = { ...item.attrs, checked: false, carveTaskState: '>' };
    expect(jsonToCarve({ type: 'doc', content: doc.content })).toBe('- [>] Task');
  });
});
