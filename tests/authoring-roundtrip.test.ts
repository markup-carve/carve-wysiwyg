import { describe, expect, it } from 'vitest';
import { AUTHORING_RECIPES } from '../src/authoring';
import { carveToEditorDocument } from '../src/carve-import';
import { createCarveEditor, htmlToCarve, setCarveDocument } from '../src/editor';

// Recipes whose structure Tiptap's stock schema cannot hold; the 0.1 kit
// (CarveKit) modeled them and is gone in Carve 0.2: markup-carve/carve-grammars#906.
const NEEDS_KIT = new Set([
  'table', 'math-inline', 'math-display', 'footnote', 'inline-footnote', 'crossref',
  'abbreviation-definition', 'link-definition', 'figure', 'figure-group', 'note', 'tip',
  'warning', 'danger', 'info', 'success', 'example', 'quote', 'details', 'spoiler', 'div',
  'line-block', 'tabs', 'code-group', 'citation', 'definition-list', 'comment',
  'block-comment', 'span', 'metadata', 'attributes',
]);

describe('authoring recipe round trips', () => {
  it.skip('keeps every kit-modeled recipe canonical (needs a Carve 0.2 Tiptap kit: markup-carve/carve-grammars#906)', () => {});

  it('keeps every generated recipe the stock editor holds canonical', () => {
    const editor = createCarveEditor({ element: document.createElement('div') });
    const report: string[] = [];
    for (const recipe of AUTHORING_RECIPES.filter(item => !NEEDS_KIT.has(item.id))) {
      const values = Object.fromEntries(recipe.fields.map(field => [field.name, field.value]));
      const source = recipe.source(values);
      let output = '';
      try {
        setCarveDocument(editor, carveToEditorDocument(source));
        output = htmlToCarve(editor.getHTML());
      } catch (error) {
        output = `ERROR ${(error as Error).message}`;
      }
      if (output.trim() !== source.trim()) {
        report.push(`### ${recipe.id}\nIN:\n${JSON.stringify(source)}\nOUT:\n${JSON.stringify(output)}`);
      }
    }
    expect(report).toEqual([]);
  });
});
