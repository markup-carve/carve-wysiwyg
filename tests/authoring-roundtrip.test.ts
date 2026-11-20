import { describe, expect, it } from 'vitest';
import { AUTHORING_RECIPES } from '../src/authoring';
import { carveToEditorDocument } from '../src/carve-import';
import { createCarveEditor, jsonToCarve, setCarveDocument } from '../src/editor';

describe('authoring recipe round trips', () => {
  it('keeps every generated recipe canonical through the editor', () => {
    const editor = createCarveEditor({ element: document.createElement('div') });
    const report: string[] = [];
    for (const recipe of AUTHORING_RECIPES) {
      const values = Object.fromEntries(recipe.fields.map(field => [field.name, field.value]));
      const source = recipe.source(values);
      let output = '';
      try {
        setCarveDocument(editor, carveToEditorDocument(source));
        output = jsonToCarve(editor.getJSON());
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
