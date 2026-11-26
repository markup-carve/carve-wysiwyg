import { describe, expect, it } from 'vitest';
import { lint } from '@markup-carve/carve';
import { AUTHORING_RECIPES } from '../src/authoring';
import { SAMPLE } from '../src/sample';
import { isLintHint, lintFindingLabel } from '../src/lint-findings';

// A 0.2 lint finding names its rule in `code` (C2-W-103).
// deprecated-cell-alignment is an upgrade-only rule, so the check runs lint's upgrade set.
const rules = (source: string) => lint(source, { upgrade: true }).map(finding => finding.code);

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
    const source = 'Above\n\nText {.x} here.\n';
    const hint = lint(source).find(finding => finding.code === 'unattached-inline-attribute');
    expect(hint).toBeDefined();
    expect(isLintHint(hint!)).toBe(true);
    expect(lintFindingLabel(hint!, source)).toMatch(/^Line 3 · Hint · unattached-inline-attribute: /);
  });

  it('leaves a warning unmarked', () => {
    const source = 'See [x](#nope).\n';
    const warning = lint(source).find(finding => finding.code === 'broken-fragment-link');
    expect(warning).toBeDefined();
    expect(isLintHint(warning!)).toBe(false);
    expect(lintFindingLabel(warning!, source)).toMatch(/^Line 1 · broken-fragment-link: /);
  });
});
