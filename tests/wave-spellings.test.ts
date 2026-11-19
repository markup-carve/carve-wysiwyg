import { describe, expect, it } from 'vitest';
import { lint } from '@markup-carve/carve';
import { AUTHORING_RECIPES } from '../src/authoring';
import { SAMPLE } from '../src/sample';
import { isLintHint, lintFindingLabel } from '../src/lint-findings';

// A 0.2 lint finding names its rule in `code` (C2-W-103).
const rules = (source: string) => lint(source).map(finding => finding.code);

describe('current Carve spellings', () => {
  it('writes the starter document without deprecated cell alignment', () => {
    expect(rules(SAMPLE)).not.toContain('deprecated-cell-alignment');
  });

  it.each(AUTHORING_RECIPES.map(recipe => [recipe.id, recipe]))('%s recipe uses no deprecated cell alignment', (_id, recipe) => {
    const values = Object.fromEntries(recipe.fields.map(field => [field.name, field.value]));
    expect(rules(recipe.source(values))).not.toContain('deprecated-cell-alignment');
  });
});

describe('lint panel labels', () => {
  it('marks a Hint finding as advisory', () => {
    const source = 'Above\n\n---\n\nBelow\n';
    const hint = lint(source).find(finding => finding.code === 'thematic-break-spelling');
    expect(hint).toBeDefined();
    expect(isLintHint(hint!)).toBe(true);
    expect(lintFindingLabel(hint!, source)).toMatch(/^Line 3 · Hint · thematic-break-spelling: /);
  });

  it('leaves a warning unmarked', () => {
    const source = '|=< A |\n| b |\n';
    const warning = lint(source).find(finding => finding.code === 'deprecated-cell-alignment');
    expect(warning).toBeDefined();
    expect(isLintHint(warning!)).toBe(false);
    expect(lintFindingLabel(warning!, source)).toMatch(/^Line 1 · deprecated-cell-alignment: /);
  });
});
