import { describe, expect, it } from 'vitest';
import { lintCarve } from '@markup-carve/carve';
import { AUTHORING_RECIPES } from '../src/authoring';
import { SAMPLE } from '../src/sample';
import { isLintHint, lintFindingLabel } from '../src/lint-findings';

const rules = (source: string) => lintCarve(source).map(finding => finding.rule);

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
    const hint = lintCarve('Above\n\n---\n\nBelow\n').find(finding => finding.rule === 'thematic-break-spelling');
    expect(hint).toBeDefined();
    expect(isLintHint(hint!)).toBe(true);
    expect(lintFindingLabel(hint!)).toMatch(/^Line 3 · Hint · thematic-break-spelling: /);
  });

  it('leaves a warning unmarked', () => {
    const warning = lintCarve('|=< A |\n| b |\n').find(finding => finding.rule === 'deprecated-cell-alignment');
    expect(warning).toBeDefined();
    expect(isLintHint(warning!)).toBe(false);
    expect(lintFindingLabel(warning!)).toMatch(/^Line 1 · deprecated-cell-alignment: /);
  });
});
