import { escapeCarve } from '@markup-carve/carve-grammars/tiptap';

export interface AuthoringField {
  name: string;
  label: string;
  value: string;
  required?: boolean;
}

export interface AuthoringRecipe {
  id: string;
  label: string;
  group: string;
  description: string;
  fields: AuthoringField[];
  source(values: Record<string, string>): string;
}

const clean = (value: string, fallback: string): string => value.trim() || fallback;
const safeLabel = (value: string, fallback: string): string => clean(value, fallback).replace(/[^\w.-]/g, '-');
const yamlQuoted = (value: string): string => value.replace(/["\\]/g, '\\$&');
const titleSafe = (value: string): string => value.replaceAll('"', '”');
const continuation = (value: string): string => value.replace(/\n/g, '\n    ');
const fenced = (kind: string, title: string, body: string): string => {
  const longest = Math.max(0, ...[...body.matchAll(/:+/g)].map(match => match[0].length));
  const fence = ':'.repeat(Math.max(3, longest + 1));
  return `${fence} ${kind} "${titleSafe(title)}"\n${body}\n${fence}\n`;
};
const oneLine = (value: string): string => value.replace(/\s*\n\s*/g, ' ');
const colonFenced = (opener: string, body: string): string => {
  const longest = Math.max(0, ...[...body.matchAll(/:+/g)].map(match => match[0].length));
  const fence = ':'.repeat(Math.max(3, longest + 1));
  return `${fence} ${opener}`.trimEnd() + `\n${body}\n${fence}\n`;
};
const commentFenced = (body: string): string => {
  const longest = Math.max(0, ...[...body.matchAll(/^[ \t]*(%+)/gm)].map(match => match[1].length));
  const fence = '%'.repeat(Math.max(3, longest + 1));
  return `${fence}\n${body}\n${fence}\n`;
};
/** The extended task states and what each one means. */
export const TASK_STATES: Array<[state: string, meaning: string]> = [
  ['-', 'dropped'], ['_', 'paused'], ['>', 'deferred'], ['?', 'maybe'],
];
const ADMONITIONS = ['note', 'tip', 'warning', 'danger', 'info', 'success', 'example', 'quote'];
const codeFenced = (language: string, body: string): string => {
  const longest = Math.max(0, ...[...body.matchAll(/`+/g)].map(match => match[0].length));
  const fence = '`'.repeat(Math.max(3, longest + 1));
  const safeLanguage = clean(language, 'text').replace(/[^\w+./-]/g, '-');
  return `${fence}${safeLanguage}\n${body}\n${fence}\n`;
};
const mathFenced = (display: boolean, body: string): string => {
  const longest = Math.max(0, ...[...body.matchAll(/`+/g)].map(match => match[0].length));
  const fence = '`'.repeat(Math.max(1, longest + 1));
  const pad = body.startsWith('`') || body.endsWith('`') || body === '' ? ' ' : '';
  return `${display ? '$$' : '$'}${fence}${pad}${body}${pad}${fence}${display ? '\n' : ''}`;
};

export const AUTHORING_RECIPES: AuthoringRecipe[] = [
  {
    id: 'table', label: 'Table', group: 'Structure',
    description: 'Header row, alignment, caption, ID, and editable cells.',
    fields: [
      { name: 'caption', label: 'Caption', value: 'Table caption' },
      { name: 'id', label: 'ID', value: 'table-1' },
    ],
    source: v => `{#${safeLabel(v.id, 'table-1')}}\n|=< Name |=> Value |\n| First | 1 |\n^ ${clean(v.caption, 'Table caption')}`,
  },
  {
    id: 'code-block', label: 'Code block', group: 'Structure',
    description: 'A syntax-labelled fenced block with safe fence widening.',
    fields: [
      { name: 'language', label: 'Language', value: 'javascript', required: true },
      { name: 'body', label: 'Code', value: "console.log('Hello, Carve!');" },
    ],
    source: v => codeFenced(v.language, v.body),
  },
  ...[
    ['mermaid', 'Mermaid', 'flowchart LR\n  A[Source] --> B[Preview]'],
    ['graphviz', 'Graphviz', 'digraph G { source -> preview }'],
    ['d2', 'D2', 'source -> preview'],
    ['plantuml', 'PlantUML', '@startuml\nAlice -> Bob: Hello\n@enduml'],
    ['wavedrom', 'WaveDrom', '{ signal: [{ name: "clk", wave: "p....." }] }'],
    ['abc', 'ABC music', 'X:1\nT:Scale\nK:C\nC D E F G A B c'],
    ['vega-lite', 'Vega-Lite', '{"mark":"bar","data":{"values":[{"x":"A","y":2}]},"encoding":{"x":{"field":"x"},"y":{"field":"y"}}}'],
    ['chart', 'Chart.js', '{"type":"bar","data":{"labels":["A"],"datasets":[{"data":[2]}]}}'],
  ].map(([id, label, example]): AuthoringRecipe => ({
    id: `diagram-${id}`,
    label,
    group: 'Diagrams',
    description: `${label} source block for client-side or build-time rendering.`,
    fields: [{ name: 'body', label: `${label} source`, value: example, required: true }],
    source: v => codeFenced(id, v.body),
  })),
  {
    id: 'math-inline', label: 'Inline math', group: 'Math',
    description: 'TeX mathematics that flows within a paragraph.',
    fields: [{ name: 'tex', label: 'TeX', value: 'E = mc^2', required: true }],
    source: v => mathFenced(false, clean(v.tex, 'E = mc^2')),
  },
  {
    id: 'math-display', label: 'Display math', group: 'Math',
    description: 'TeX mathematics rendered as a standalone display.',
    fields: [{ name: 'tex', label: 'TeX', value: '\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}', required: true }],
    source: v => mathFenced(true, clean(v.tex, 'x^2 + y^2')),
  },
  {
    id: 'footnote', label: 'Footnote', group: 'References',
    description: 'A reference at the cursor and its matching definition.',
    fields: [
      { name: 'label', label: 'Label', value: 'note', required: true },
      { name: 'body', label: 'Footnote text', value: 'Footnote text.' },
    ],
    source: v => `Footnote[^${safeLabel(v.label, 'note')}].\n\n[^${safeLabel(v.label, 'note')}]: ${continuation(clean(v.body, 'Footnote text.'))}\n`,
  },
  {
    id: 'inline-footnote', label: 'Inline footnote', group: 'References',
    description: 'A footnote written where it is referenced, with no separate definition.',
    fields: [{ name: 'body', label: 'Footnote text', value: 'An inline note.', required: true }],
    source: v => `Text^[${escapeCarve(oneLine(clean(v.body, 'An inline note.')))}].\n`,
  },
  {
    id: 'crossref', label: 'Cross-reference', group: 'References',
    description: 'A reference to a document ID.',
    fields: [{ name: 'target', label: 'Target ID', value: 'figure-1', required: true }],
    source: v => `See </#${safeLabel(v.target, 'figure-1')}>.\n`,
  },
  {
    id: 'abbreviation-definition', label: 'Abbreviation definition', group: 'References',
    description: 'A reusable abbreviation and its expansion.',
    fields: [
      { name: 'abbr', label: 'Abbreviation', value: 'HTML', required: true },
      { name: 'expansion', label: 'Expansion', value: 'HyperText Markup Language', required: true },
    ],
    source: v => `*[${clean(v.abbr, 'HTML').replace(/[\]\\]/g, '')}]: ${clean(v.expansion, 'HyperText Markup Language').replace(/\n/g, ' ')}\n`,
  },
  {
    id: 'link-definition', label: 'Link definition', group: 'References',
    description: 'A reusable link destination with an optional title.',
    fields: [
      { name: 'label', label: 'Label', value: 'project', required: true },
      { name: 'url', label: 'Destination', value: 'https://github.com/markup-carve', required: true },
      { name: 'title', label: 'Title', value: 'Markup Carve' },
    ],
    source: v => `[${safeLabel(v.label, 'project')}]: ${clean(v.url, 'https://github.com/markup-carve')}${v.title.trim() ? ` "${titleSafe(v.title.trim())}"` : ''}\n`,
  },
  {
    id: 'figure', label: 'Figure', group: 'Media',
    description: 'Image, accessible alternative text, caption, and ID.',
    fields: [
      { name: 'url', label: 'Image URL', value: 'https://example.com/image.png', required: true },
      { name: 'alt', label: 'Alternative text', value: 'Describe the image', required: true },
      { name: 'caption', label: 'Caption', value: 'Figure caption' },
      { name: 'id', label: 'ID', value: 'figure-1' },
    ],
    source: v => `{#${safeLabel(v.id, 'figure-1')}}\n![${clean(v.alt, 'Describe the image')}](${clean(v.url, 'https://example.com/image.png')})\n^ ${clean(v.caption, 'Figure caption')}\n`,
  },
  {
    id: 'figure-group', label: 'Figure group', group: 'Media',
    description: 'Two accessible panels with individual and group captions.',
    fields: [
      { name: 'caption', label: 'Group caption', value: 'Figure group' },
      { name: 'id', label: 'ID', value: 'figures-1' },
    ],
    source: v => `{#${safeLabel(v.id, 'figures-1')}}\n::: figure\n{#panel-a}\n![First panel](https://example.com/one.png)\n^ (a) First panel\n\n{#panel-b}\n![Second panel](https://example.com/two.png)\n^ (b) Second panel\n:::\n^ ${clean(v.caption, 'Figure group')}\n`,
  },
  ...[...ADMONITIONS, 'details', 'spoiler'].map((kind): AuthoringRecipe => ({
    id: kind, label: kind[0].toUpperCase() + kind.slice(1), group: 'Containers',
    description: ADMONITIONS.includes(kind)
      ? `${kind[0].toUpperCase() + kind.slice(1)} admonition with a title and body.`
      : `${kind[0].toUpperCase() + kind.slice(1)} container with a title and body.`,
    fields: [
      { name: 'title', label: 'Title', value: kind[0].toUpperCase() + kind.slice(1) },
      { name: 'body', label: 'Body', value: 'Write content here.' },
    ],
    source: v => fenced(kind, clean(v.title, kind), clean(v.body, 'Write content here.')),
  })),
  {
    id: 'div', label: 'Generic div', group: 'Containers',
    description: 'A plain container with a class, for styling or host hooks.',
    fields: [
      { name: 'class', label: 'Class', value: 'sidebar', required: true },
      { name: 'body', label: 'Body', value: 'Write content here.' },
    ],
    source: v => colonFenced(safeLabel(v.class, 'sidebar'), clean(v.body, 'Write content here.')),
  },
  {
    id: 'line-block', label: 'Line block', group: 'Containers',
    description: 'Keeps every line break and leading space, for verse or addresses.',
    fields: [{ name: 'body', label: 'Lines', value: 'Roses are red,\n  violets are blue.' }],
    // Leading spaces are content here, so only blank edge lines are dropped.
    source: v => colonFenced('|', v.body.replace(/^(?:[ \t]*\n)+|\s+$/g, '') || 'First line'),
  },
  {
    id: 'tabs', label: 'Tabs', group: 'Containers',
    description: 'Keyboard-friendly tab set with two editable panels.',
    fields: [
      { name: 'first', label: 'First tab', value: 'First' },
      { name: 'second', label: 'Second tab', value: 'Second' },
    ],
    source: v => `::: tabs\n:::: tab [${titleSafe(clean(v.first, 'First'))}]\nFirst panel.\n::::\n\n:::: tab [${titleSafe(clean(v.second, 'Second'))}]\nSecond panel.\n::::\n:::`,
  },
  {
    id: 'code-group', label: 'Code group', group: 'Containers',
    description: 'Related, language-labelled code examples.',
    fields: [{ name: 'title', label: 'Title', value: 'Examples' }],
    source: v => `::: code-group "${titleSafe(clean(v.title, 'Examples'))}"\n\`\`\`javascript\nconsole.log('Hello')\n\`\`\`\n\n\`\`\`python\nprint('Hello')\n\`\`\`\n:::`,
  },
  {
    id: 'citation', label: 'Citation', group: 'References',
    description: 'Citation and matching bibliography definition.',
    fields: [
      { name: 'key', label: 'Citation key', value: 'doe2026', required: true },
      { name: 'entry', label: 'Bibliography entry', value: 'Doe, J. (2026). Example.' },
    ],
    source: v => `Evidence [@${safeLabel(v.key, 'doe2026')}].\n\n[@${safeLabel(v.key, 'doe2026')}]: ${continuation(clean(v.entry, 'Doe, J. (2026). Example.'))}\n`,
  },
  {
    id: 'definition-list', label: 'Definition list', group: 'Structure',
    description: 'A term followed by its definition.',
    fields: [
      { name: 'term', label: 'Term', value: 'Term', required: true },
      { name: 'definition', label: 'Definition', value: 'Definition of the term.' },
    ],
    source: v => `:: ${escapeCarve(oneLine(clean(v.term, 'Term')))}\n: ${escapeCarve(oneLine(clean(v.definition, 'Definition of the term.')))}\n`,
  },
  {
    id: 'task-state', label: 'Task with a state', group: 'Structure',
    description: 'A task item that is dropped (-), paused (_), deferred (>) or maybe (?).',
    fields: [
      { name: 'state', label: 'State (- _ > ?)', value: '?', required: true },
      { name: 'task', label: 'Task', value: 'Decide later' },
    ],
    source: v => {
      const state = TASK_STATES.find(([mark]) => mark === v.state.trim())?.[0] ?? '?';
      return `- [${state}] ${escapeCarve(oneLine(clean(v.task, 'Decide later')))}\n`;
    },
  },
  {
    id: 'comment', label: 'Comment', group: 'Document',
    description: 'A one-line %% comment that never renders.',
    fields: [{ name: 'body', label: 'Comment', value: 'Check this before publishing.', required: true }],
    source: v => `%% ${oneLine(clean(v.body, 'Check this before publishing.'))}\n`,
  },
  {
    id: 'block-comment', label: 'Block comment', group: 'Document',
    description: 'A fenced %%% comment that can span several lines.',
    fields: [{ name: 'body', label: 'Comment', value: 'Review notes\nfor this section.', required: true }],
    source: v => commentFenced(clean(v.body, 'Review notes')),
  },
  {
    id: 'span', label: 'Span with attributes', group: 'Document',
    description: 'Inline text carrying an ID and a class.',
    fields: [
      { name: 'text', label: 'Text', value: 'styled text', required: true },
      { name: 'id', label: 'ID', value: '' },
      { name: 'class', label: 'Class', value: 'highlight' },
    ],
    source: v => {
      const attrs = [
        v.id.trim() ? `#${safeLabel(v.id, 'span-1')}` : '',
        v.class.trim() ? `.${safeLabel(v.class, 'highlight')}` : '',
      ].filter(Boolean);
      return `[${escapeCarve(oneLine(clean(v.text, 'styled text')))}]{${attrs.length ? attrs.join(' ') : '.highlight'}}\n`;
    },
  },
  {
    id: 'metadata', label: 'Document metadata', group: 'Document',
    description: 'YAML frontmatter for title, author, and language.',
    fields: [
      { name: 'title', label: 'Title', value: 'Document title' },
      { name: 'author', label: 'Author', value: 'Author name' },
      { name: 'language', label: 'Language', value: 'en' },
    ],
    source: v => `---\ntitle: "${yamlQuoted(clean(v.title, 'Document title'))}"\nauthor: "${yamlQuoted(clean(v.author, 'Author name'))}"\nlang: ${safeLabel(v.language, 'en')}\n---\n`,
  },
  {
    id: 'attributes', label: 'Attributed block', group: 'Document',
    description: 'A block with ID, classes, and language metadata.',
    fields: [
      { name: 'id', label: 'ID', value: 'section-1' },
      { name: 'class', label: 'Class', value: 'example' },
      { name: 'language', label: 'Language', value: 'en' },
    ],
    source: v => `{#${safeLabel(v.id, 'section-1')} .${safeLabel(v.class, 'example')} :${safeLabel(v.language, 'en')}}\nAttributed paragraph.`,
  },
];

export function recipeById(id: string): AuthoringRecipe | undefined {
  return AUTHORING_RECIPES.find(recipe => recipe.id === id);
}

export function lineDiff(before: string, after: string): string {
  if (before === after) return 'No source normalization.';
  const left = before.split('\n');
  const right = after.split('\n');
  const lengths = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0) as number[]);
  for (let i = left.length - 1; i >= 0; i -= 1) for (let j = right.length - 1; j >= 0; j -= 1) {
    lengths[i][j] = left[i] === right[j] ? lengths[i + 1][j + 1] + 1 : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
  }
  const rows: string[] = [];
  let i = 0; let j = 0;
  while (i < left.length || j < right.length) {
    if (left[i] === right[j]) { i += 1; j += 1; }
    else if (j < right.length && (i === left.length || lengths[i][j + 1] > lengths[i + 1][j])) rows.push(`+ ${right[j++]}`);
    else rows.push(`- ${left[i++]}`);
  }
  return rows.join('\n');
}
