import { describe, expect, it } from 'vitest';
import { AUTHORING_RECIPES, lineDiff } from '../src/authoring';
import { carveHeadingTargets, carveToEditorDocument, carveToHtmlRaw } from '../src/carve-import';

describe('rich authoring recipes', () => {
  it('has a unique, parseable recipe for every advertised structure family', () => {
    const ids = AUTHORING_RECIPES.map(recipe => recipe.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining([
      'table', 'code-block', 'footnote', 'crossref', 'figure', 'figure-group',
      'note', 'details', 'spoiler', 'tabs', 'code-group', 'citation',
      'abbreviation-definition', 'link-definition', 'metadata', 'attributes',
      'diagram-mermaid', 'diagram-graphviz', 'diagram-d2', 'diagram-plantuml',
      'diagram-wavedrom', 'diagram-abc', 'diagram-vega-lite', 'diagram-chart',
      'math-inline', 'math-display',
    ]));

    for (const recipe of AUTHORING_RECIPES) {
      const values = Object.fromEntries(recipe.fields.map(field => [field.name, field.value]));
      const source = recipe.source(values);
      const doc = carveToEditorDocument(source);
      expect(doc.type, recipe.id).toBe('doc');
      expect(doc.content?.length, recipe.id).toBeGreaterThan(0);
    }
  });

  it('sanitizes authored identifiers rather than emitting broken syntax', () => {
    const figure = AUTHORING_RECIPES.find(recipe => recipe.id === 'figure')!;
    expect(figure.source({ id: 'my bad id', alt: 'Alt', url: 'x', caption: 'Cap' }))
      .toContain('{#my-bad-id}');
  });

  it('widens a code fence around backticks in its body', () => {
    const recipe = AUTHORING_RECIPES.find(item => item.id === 'code-block')!;
    expect(recipe.source({ language: 'typescript', body: 'const fence = ```;' }))
      .toMatch(/^````typescript\n/);
  });

  it('emits canonical recipes without an immediate normalization-only diff', () => {
    for (const recipe of AUTHORING_RECIPES) {
      const values = Object.fromEntries(recipe.fields.map(field => [field.name, field.value]));
      const source = recipe.source(values);
      const normalized = carveToEditorDocument(source);
      expect(normalized.type, recipe.id).toBe('doc');
      if (recipe.id === 'code-block' || recipe.id.startsWith('diagram-')) {
        expect(source, recipe.id).toMatch(/^`{3,}[^ ]/);
      }
    }
    expect(AUTHORING_RECIPES.find(recipe => recipe.id === 'code-group')!.source({ title: 'Examples' }))
      .not.toMatch(/^`{3,} /m);
    expect(AUTHORING_RECIPES.find(recipe => recipe.id === 'citation')!.source({ key: 'doe', entry: 'Doe.' }))
      .not.toContain(': {} ');
  });

  it('keeps hostile titles and multiline definition bodies inside their structures', () => {
    const note = AUTHORING_RECIPES.find(recipe => recipe.id === 'note')!;
    const noteDoc = carveToEditorDocument(note.source({ title: 'He said "hi"', body: 'before\n:::\nafter' }));
    expect(noteDoc.content?.[0]?.type).toBe('carveDiv');

    const footnote = AUTHORING_RECIPES.find(recipe => recipe.id === 'footnote')!;
    const footnoteDoc = carveToEditorDocument(footnote.source({ label: 'n', body: 'First.\n\nSecond.' }));
    expect(footnoteDoc.content?.some(node => node.type === 'carveFootnoteDefinition')).toBe(true);
  });

  it('renders optional-extension recipes with their semantic HTML transforms', () => {
    const details = AUTHORING_RECIPES.find(recipe => recipe.id === 'details')!;
    expect(carveToHtmlRaw(details.source({ title: 'More', body: 'Body.' }))).toContain('<details');
    const citation = AUTHORING_RECIPES.find(recipe => recipe.id === 'citation')!;
    const html = carveToHtmlRaw(citation.source({ key: 'doe', entry: 'Doe.' }));
    expect(html).toContain('href="#ref-doe"');
    expect(html).toContain('class="references"');
  });

  it('labels fenced code and diagram previews with their language', () => {
    expect(carveToHtmlRaw('``` javascript\nalert(1)\n```\n')).toContain('data-language="javascript"');
    const mermaid = carveToHtmlRaw('``` mermaid\nA --> B\n```\n');
    expect(mermaid).toContain('data-language="mermaid"');
    expect(mermaid.match(/data-language=/g)).toHaveLength(1);
    expect(carveToHtmlRaw('``` vega-lite\n{}\n```\n')).toContain('<div class="vega-lite"');
  });

  it('authors inline and display math without forcing inline content onto a new line', () => {
    const inline = AUTHORING_RECIPES.find(recipe => recipe.id === 'math-inline')!;
    const display = AUTHORING_RECIPES.find(recipe => recipe.id === 'math-display')!;
    expect(inline.source({ tex: 'E = mc^2' })).toBe('$`E = mc^2`');
    expect(inline.source({ tex: '`x`' })).toBe('$`` `x` ``');
    expect(display.source({ tex: 'x^2' })).toBe('$$`x^2`\n');
  });
});

describe('authoring support utilities', () => {
  it('collects searchable block and definition targets without duplicates', () => {
    const targets = carveHeadingTargets(
      '# Heading\n\n## Auto Heading\n\n{#figure-one}\n![Alt](one.png)\n^ Caption\n\n[^n]: Note.\n',
    );
    expect(targets.map(target => target.id)).toEqual(expect.arrayContaining(['Heading', 'Auto-Heading']));
    expect(targets.map(target => target.id)).not.toEqual(expect.arrayContaining(['figure-one', 'n']));
  });

  it('uses the engine heading IDs for digits, Unicode, and duplicates', () => {
    expect(carveHeadingTargets('# 2026 Review\n\n# emoji 🎉 here\n\n# Intro\n\n# Intro\n').map(target => target.id))
      .toEqual(['s-2026-Review', 'emoji-🎉-here', 'Intro', 'Intro-2']);
  });

  it('makes source normalization explicit', () => {
    expect(lineDiff('same', 'same')).toBe('No source normalization.');
    expect(lineDiff('old\nkeep', 'new\nkeep')).toBe('- old\n+ new');
  });
});
